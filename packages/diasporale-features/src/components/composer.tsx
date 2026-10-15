"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { canAlsoPublishOnRoot, isCountryOpen, type CountryCode } from "@diasporale/domain"
import { GlobeIcon, ImagePlusIcon, LoaderCircleIcon, SendIcon, TriangleAlertIcon, XIcon } from "lucide-react"
import { type ChangeEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from "react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { useActions } from "../data/context"
import type { ActionErrorCode } from "../data/errors"
import {
  POST_MEDIA_ACCEPT,
  POST_MEDIA_ALT_MAX_LENGTH,
  POST_MEDIA_MAX_COUNT,
  type PostMediaKind,
  postMediaKindOf,
  postMediaRefusal,
} from "../data/media"
import type { PublishMediaInput, UploadedMedia } from "../data/port"
import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"
import { countryName } from "../lib/countries"
import { Button } from "../primitives/button"
import { Checkbox } from "../primitives/checkbox"
import { Field, Input, Label, Textarea } from "../primitives/field"
import { RadioCard, RadioGroup } from "../primitives/radio-group"
import { Sheet, SheetContent } from "../primitives/sheet"
import { CountryTag, ScopeTag } from "./country-tag"

export const POST_BODY_MAX = 2000

const composerFields = z.object({
  body: z.string().trim().max(POST_BODY_MAX, "post_too_long"),
  reach: z.enum(["local", "diaspora"]),
  audience: z.enum(["public", "connections"]),
  alsoOnRoot: z.boolean(),
  /** Les médias joints, dans l'ordre : la clé de leur dépôt et leur texte alternatif. */
  media: z
    .array(z.object({ key: z.string(), altText: z.string().max(POST_MEDIA_ALT_MAX_LENGTH, "media_alt_too_long") }))
    .max(POST_MEDIA_MAX_COUNT, "media_too_many"),
})
// Une photo sans légende est une publication légitime ; un message vide sans média ne l'est pas.
const composerSchema = composerFields.superRefine((values, context) => {
  if (values.body.length === 0 && values.media.length === 0) context.addIssue({ code: "custom", path: ["body"], message: "post_empty" })
})
type ComposerValues = z.infer<typeof composerFields>

const DEFAULTS: ComposerValues = { body: "", reach: "local", audience: "public", alsoOnRoot: false, media: [] }

/** Un brouillon relu du navigateur : le texte et les choix, sans exiger un texte non vide. Les médias n'y vont pas. */
const draftSchema = composerFields.omit({ media: true }).extend({ body: z.string().max(POST_BODY_MAX + 200) })
type DraftValues = z.infer<typeof draftSchema>
/** Attente après la dernière frappe avant de garder le brouillon. */
const DRAFT_SAVE_MS = 400

function readDraft(key: string): DraftValues | null {
  try {
    const parsed = draftSchema.safeParse(JSON.parse(window.localStorage.getItem(key) ?? "null"))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function writeDraft(key: string, values: DraftValues): void {
  try {
    if (values.body.trim().length === 0) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(values))
  } catch {
    // Stockage refusé (navigation privée…) : le brouillon vit le temps de la page.
  }
}

/** Un média joint : son aperçu local et l'état de son dépôt. */
interface Attachment {
  readonly name: string
  readonly kind: PostMediaKind
  readonly mimeType: string
  readonly sizeBytes: number
  readonly previewUrl: string
  readonly state:
    | { readonly status: "uploading" }
    | { readonly status: "ready"; readonly upload: UploadedMedia }
    | { readonly status: "failed"; readonly code: ActionErrorCode }
}

function without<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const next = { ...record }
  delete next[key]
  return next
}

/** Entrée dans un texte alternatif ne publie pas : on décrit, on n'envoie pas. */
function keepEnterInField(event: KeyboardEvent<HTMLInputElement>): void {
  if (event.key === "Enter") event.preventDefault()
}

/**
 * Composeur en feuille (charte §8, EXF-DG-10/11). La portée est visible avant
 * l'envoi (le pays de l'auteur, ou toute la diaspora). La visibilité reste
 * `network` par défaut : « Publier aussi sur ANTIA » est un GESTE, désactivé
 * hors audience publique, expliqué en une ligne. La case naît décochée.
 *
 * Médias : quatre photos, ou une vidéo seule (règles du moteur, jugées AVANT
 * tout envoi). Chaque fichier part dès qu'il est choisi ; la publication attend
 * la fin des envois. Le texte alternatif se donne photo par photo.
 */
export function PostComposerSheet(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberCountry: CountryCode
  openCountries: readonly CountryCode[]
  /**
   * Brouillon durable (EXF-DG-10) : gardé dans CE navigateur sous cette clé (une
   * par personne), rétabli à l'ouverture, effacé à la publication. Jamais envoyé.
   */
  draftKey?: string
}) {
  const { t, locale } = useDiasporaleT()
  const actions = useActions()
  const ids = useId()
  const form = useForm<ComposerValues>({ resolver: zodResolver(composerSchema), defaultValues: DEFAULTS })
  const mediaFields = useFieldArray({ control: form.control, name: "media" })
  const [attachments, setAttachments] = useState<Readonly<Record<string, Attachment>>>({})
  const [mediaError, setMediaError] = useState<ActionErrorCode | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const attachedCount = useRef(0)
  const audience = useWatch({ control: form.control, name: "audience" })
  const reach = useWatch({ control: form.control, name: "reach" })
  const body = useWatch({ control: form.control, name: "body" })
  const rootAllowed = canAlsoPublishOnRoot(audience)

  // Une audience restreinte ferme la case ANTIA : la valeur suit, jamais l'inverse.
  useEffect(() => {
    if (!rootAllowed) form.setValue("alsoOnRoot", false)
  }, [rootAllowed, form])

  // Le brouillon gardé est rétabli une fois, au montage (le stockage n'existe pas au rendu serveur).
  const draftKey = props.draftKey
  useEffect(() => {
    if (!draftKey) return
    const draft = readDraft(draftKey)
    if (draft) form.reset({ ...draft, media: [] })
  }, [draftKey, form])

  // Puis gardé à chaque pause dans la frappe.
  const alsoOnRoot = useWatch({ control: form.control, name: "alsoOnRoot" })
  useEffect(() => {
    if (!draftKey) return
    const timer = setTimeout(() => writeDraft(draftKey, { body, reach, audience, alsoOnRoot }), DRAFT_SAVE_MS)
    return () => clearTimeout(timer)
  }, [draftKey, body, reach, audience, alsoOnRoot])

  // Les aperçus locaux (URL d'objet) se libèrent au retrait, à la publication, et quand le composeur quitte l'écran.
  const previewUrls = useRef(new Set<string>())
  useEffect(() => {
    const urls = previewUrls.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])
  function releasePreview(url: string) {
    URL.revokeObjectURL(url)
    previewUrls.current.delete(url)
  }

  const attached = Object.values(attachments)
  const uploading = attached.some((item) => item.state.status === "uploading")
  const canAttachMore = mediaFields.fields.length < POST_MEDIA_MAX_COUNT && !attached.some((item) => item.kind === "video")

  function attachFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (files.length === 0) return
    const chosen: { file: File; kind: PostMediaKind }[] = []
    for (const file of files) {
      const kind = postMediaKindOf(file.type)
      if (!kind) {
        setMediaError("media_type_invalid")
        return
      }
      chosen.push({ file, kind })
    }
    // Les règles du moteur jugent l'ensemble AVANT tout envoi : rien ne part qui serait refusé.
    const refusal = postMediaRefusal([
      ...attached.map((item) => ({ kind: item.kind, mimeType: item.mimeType, sizeBytes: item.sizeBytes })),
      ...chosen.map(({ file, kind }) => ({ kind, mimeType: file.type, sizeBytes: file.size })),
    ])
    if (refusal) {
      setMediaError(refusal)
      return
    }
    setMediaError(null)
    const added = chosen.map(({ file, kind }) => {
      attachedCount.current += 1
      const key = `media-${attachedCount.current}`
      const previewUrl = URL.createObjectURL(file)
      previewUrls.current.add(previewUrl)
      const attachment: Attachment = { name: file.name, kind, mimeType: file.type, sizeBytes: file.size, previewUrl, state: { status: "uploading" } }
      return { key, file, attachment }
    })
    setAttachments((current) => ({ ...current, ...Object.fromEntries(added.map(({ key, attachment }) => [key, attachment])) }))
    mediaFields.append(added.map(({ key }) => ({ key, altText: "" })))
    for (const { key, file } of added) {
      void actions.uploadMedia(file).then((result) => {
        setAttachments((current) => {
          const entry = current[key]
          // Retiré pendant l'envoi : le fichier déposé n'existe pour personne tant qu'aucune publication ne l'embarque.
          if (!entry) return current
          return { ...current, [key]: { ...entry, state: result.ok ? { status: "ready", upload: result.value } : { status: "failed", code: result.code } } }
        })
      })
    }
  }

  function detach(index: number, key: string) {
    const entry = attachments[key]
    if (entry) releasePreview(entry.previewUrl)
    setAttachments((current) => without(current, key))
    mediaFields.remove(index)
    setMediaError(null)
  }

  // Après publication : les aperçus se libèrent ici (une URL déjà libérée se relibère sans effet au démontage).
  function clearAttachments() {
    for (const item of attached) URL.revokeObjectURL(item.previewUrl)
    setAttachments({})
    setMediaError(null)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const media: PublishMediaInput[] = []
    for (const item of values.media) {
      const state = attachments[item.key]?.state
      if (state?.status !== "ready") {
        if (state?.status !== "uploading") setMediaError("media_upload_failed")
        return
      }
      media.push({ upload: state.upload, altText: item.altText })
    }
    const result = await actions.publish({
      body: values.body,
      reach: values.reach,
      audience: values.audience,
      alsoOnRoot: values.alsoOnRoot,
      // Local : le pays du hub. Diaspora : le pays d'ORIGINE, en pastille dans les autres hubs (EXF-DG-16).
      country: props.memberCountry,
      ...(media.length > 0 ? { media } : {}),
    })
    if (!result.ok) {
      toast.error(t(`errors.${result.code}`))
      return
    }
    toast.success(result.value.moderation === "published" ? t("composer.published") : t("composer.sentForReview"))
    if (draftKey) writeDraft(draftKey, { body: "", reach: DEFAULTS.reach, audience: DEFAULTS.audience, alsoOnRoot: DEFAULTS.alsoOnRoot })
    clearAttachments()
    form.reset(DEFAULTS)
    props.onOpenChange(false)
  })

  const countryLabel = countryName(props.memberCountry, locale)
  const reviewNotice = reach === "local" && !isCountryOpen(props.memberCountry, props.openCountries)
  const bodyError = form.formState.errors.body?.message

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent title={t("composer.title")} description={t("composer.description")} hideDescription closeLabel={t("common.close")}>
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <Field
            id={`${ids}-corps`}
            label={t("composer.bodyLabel")}
            error={bodyError ? t(`errors.${bodyError}`) : undefined}
            hint={
              draftKey && body.trim().length > 0
                ? `${t("composer.counter", { count: body.length, max: POST_BODY_MAX })} · ${t("composer.draftKept")}`
                : t("composer.counter", { count: body.length, max: POST_BODY_MAX })
            }
          >
            {(control) => (
              <Textarea
                id={control.id}
                aria-describedby={control.describedBy}
                aria-invalid={control.invalid || undefined}
                rows={5}
                maxLength={POST_BODY_MAX + 200}
                placeholder={t("composer.placeholder", { country: countryLabel })}
                {...form.register("body")}
              />
            )}
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("composer.mediaLegend")}</legend>
            {mediaFields.fields.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3" aria-label={t("composer.mediaListLabel")}>
                {mediaFields.fields.map((field, index) => {
                  const attachment = attachments[field.key]
                  if (!attachment) return null
                  const altError = form.formState.errors.media?.[index]?.altText?.message
                  const altId = `${ids}-alt-${field.key}`
                  return (
                    <li key={field.id} className="flex min-w-0 flex-col gap-1.5">
                      <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                        {attachment.kind === "video" ? (
                          <video src={attachment.previewUrl} muted playsInline preload="metadata" aria-hidden className="size-full object-cover" />
                        ) : (
                          // Aperçu local (URL d'objet du navigateur) : rien à optimiser, rien à décrire en double.
                          // eslint-disable-next-line @next/next/no-img-element -- aperçu local, le texte alternatif se donne dessous
                          <img src={attachment.previewUrl} alt="" className="size-full object-cover" />
                        )}
                        {attachment.state.status === "ready" ? null : (
                          <div
                            className={cn(
                              "absolute inset-0 flex flex-col items-center justify-center gap-1 bg-card/85 p-2 text-center text-[12px] font-medium",
                              attachment.state.status === "failed" ? "text-destructive" : "text-foreground",
                            )}
                          >
                            {attachment.state.status === "uploading" ? (
                              <LoaderCircleIcon className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
                            ) : (
                              <TriangleAlertIcon className="size-5" aria-hidden />
                            )}
                            <span role={attachment.state.status === "failed" ? "alert" : undefined}>
                              {attachment.state.status === "uploading" ? t("composer.mediaUploading") : t(`errors.${attachment.state.code}`)}
                            </span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => detach(index, field.key)}
                          aria-label={t("composer.mediaRemove", { name: attachment.name })}
                          className="absolute right-1.5 top-1.5 inline-flex size-8 items-center justify-center rounded-full bg-card text-foreground shadow-float transition-colors hover:bg-muted focus-visible:shadow-focus"
                        >
                          <XIcon className="size-4" aria-hidden />
                        </button>
                      </div>
                      <Label htmlFor={altId} className="text-[13px] text-muted-foreground">
                        {t("composer.mediaAltLabel")}
                      </Label>
                      <Input
                        id={altId}
                        maxLength={POST_MEDIA_ALT_MAX_LENGTH}
                        placeholder={attachment.kind === "video" ? t("composer.mediaAltPlaceholderVideo") : t("composer.mediaAltPlaceholder")}
                        aria-invalid={altError ? true : undefined}
                        enterKeyHint="done"
                        onKeyDown={keepEnterInField}
                        {...form.register(`media.${index}.altText`)}
                      />
                      {altError ? <p className="text-[13px] text-destructive">{t(`errors.${altError}`)}</p> : null}
                    </li>
                  )
                })}
              </ul>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={!canAttachMore} aria-describedby={`${ids}-medias-aide`}>
                <ImagePlusIcon aria-hidden />
                {t("composer.mediaAdd")}
              </Button>
              <p id={`${ids}-medias-aide`} className="text-[13px] text-muted-foreground">
                {uploading ? t("composer.mediaWaiting") : t("composer.mediaHint")}
              </p>
            </div>
            <input ref={fileInput} type="file" accept={POST_MEDIA_ACCEPT} multiple hidden onChange={attachFiles} />
            {mediaError ? (
              <p role="alert" className="text-[13px] text-destructive">
                {t(`errors.${mediaError}`)}
              </p>
            ) : null}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("composer.reachLegend")}</legend>
            <Controller
              control={form.control}
              name="reach"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} aria-label={t("composer.reachLegend")}>
                  <RadioCard value="local">
                    <span className="flex flex-wrap items-center gap-2">
                      <CountryTag country={props.memberCountry} />
                      <span className="text-sm">{t("composer.reachLocal", { country: countryLabel })}</span>
                    </span>
                  </RadioCard>
                  <RadioCard value="diaspora">
                    <span className="flex flex-wrap items-center gap-2">
                      <ScopeTag />
                      <span className="text-sm">{t("composer.reachDiaspora")}</span>
                    </span>
                  </RadioCard>
                </RadioGroup>
              )}
            />
            {reviewNotice ? <p className="text-[13px] text-pending-foreground">{t("composer.reviewNotice")}</p> : null}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("composer.audienceLegend")}</legend>
            <Controller
              control={form.control}
              name="audience"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} aria-label={t("composer.audienceLegend")}>
                  <RadioCard value="public">
                    <span className="text-sm">{t("composer.audiencePublic")}</span>
                  </RadioCard>
                  <RadioCard value="connections">
                    <span className="text-sm">{t("composer.audienceConnections")}</span>
                  </RadioCard>
                </RadioGroup>
              )}
            />
          </fieldset>

          <div className="flex items-start gap-3 rounded-lg bg-muted p-3">
            <Controller
              control={form.control}
              name="alsoOnRoot"
              render={({ field }) => (
                <Checkbox
                  id={`${ids}-antia`}
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  disabled={!rootAllowed}
                  aria-describedby={`${ids}-antia-aide`}
                  className="mt-0.5"
                />
              )}
            />
            <div className="min-w-0">
              <Label htmlFor={`${ids}-antia`} className="inline-flex items-center gap-1.5">
                <GlobeIcon className="size-4" aria-hidden />
                {t("composer.alsoOnRoot")}
              </Label>
              <p id={`${ids}-antia-aide`} className="mt-0.5 text-[13px] text-muted-foreground">
                {rootAllowed ? t("composer.alsoOnRootHint") : t("composer.alsoOnRootDisabled")}
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 -mx-5 -mb-4 flex justify-end gap-2 border-t border-border bg-card px-5 py-3">
            <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting || uploading}>
              <SendIcon aria-hidden />
              {form.formState.isSubmitting ? t("composer.publishing") : t("composer.publish")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
