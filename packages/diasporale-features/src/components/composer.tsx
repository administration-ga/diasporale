"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { canAlsoPublishOnRoot, isCountryOpen, type CountryCode } from "@diasporale/domain"
import { GlobeIcon, ImagePlusIcon, LoaderCircleIcon, SendIcon, TriangleAlertIcon, XIcon } from "lucide-react"
import { type ChangeEvent, type FormEvent, type KeyboardEvent, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
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
import type { PagePublicationInput, PagePublicationsCapability } from "../data/page-publications-port"
import type { PostView } from "../data/types"
import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"
import { countryName } from "../lib/countries"
import { Button } from "../primitives/button"
import { Checkbox } from "../primitives/checkbox"
import { Field, Input, Label, Textarea } from "../primitives/field"
import { RadioCard, RadioGroup } from "../primitives/radio-group"
import { Sheet, SheetContent } from "../primitives/sheet"
import { CountryTag, ScopeTag } from "./country-tag"
import { SharedPostEmbed, sharedPreviewOf } from "./post-share"

export const POST_BODY_MAX = 2000

const composerFields = z.object({
  body: z.string().trim().max(POST_BODY_MAX, "post_too_long"),
  reach: z.enum(["local", "diaspora"]),
  audience: z.enum(["public", "connections", "followers"]),
  alsoOnRoot: z.boolean(),
  /** Les médias joints, dans l'ordre : la clé de leur dépôt et leur texte alternatif. */
  media: z
    .array(z.object({ key: z.string(), altText: z.string().max(POST_MEDIA_ALT_MAX_LENGTH, "media_alt_too_long") }))
    .max(POST_MEDIA_MAX_COUNT, "media_too_many"),
  /** Partage cité en cours : le texte devient facultatif (l'original porte la publication). */
  sharing: z.boolean(),
})
// Une photo sans légende, un partage sans un mot, sont des publications légitimes ; un message vide seul ne l'est pas.
const composerSchemaFor = (requireMedia: boolean) => composerFields.superRefine((values, context) => {
  if (requireMedia && values.media.length === 0) {
    context.addIssue({ code: "custom", path: ["media"], message: "association_event_gallery_media_required" })
  } else if (values.body.length === 0 && values.media.length === 0 && !values.sharing) {
    context.addIssue({ code: "custom", path: ["body"], message: "post_empty" })
  }
})
type ComposerValues = z.infer<typeof composerFields>

const DEFAULTS: ComposerValues = { body: "", reach: "local", audience: "public", alsoOnRoot: false, media: [], sharing: false }

/** Un brouillon relu du navigateur : le texte et les choix, sans exiger un texte non vide. Ni médias ni partage n'y vont. */
const draftSchema = composerFields.omit({ media: true, sharing: true }).extend({ body: z.string().max(POST_BODY_MAX + 200) })
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

/** Une clé d'idempotence neuve (EXF-DG-10) : une par série d'essais d'une même publication. */
function newPublishKey(): string {
  return crypto.randomUUID()
}

/** Entrée dans un texte alternatif ne publie pas : on décrit, on n'envoie pas. */
function keepEnterInField(event: KeyboardEvent<HTMLInputElement>): void {
  if (event.key === "Enter") event.preventDefault()
}

/**
 * Composeur en feuille (charte §8, EXF-DG-10/11). La portée est visible avant
 * l'envoi (le pays de l'auteur, ou toute la diaspora). La visibilité reste
 * `network` par défaut : « Publier aussi sur ANTSIA » est un GESTE, désactivé
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
  /**
   * Partage cité : la publication partagée (son original si c'en est un). Le
   * composeur la montre, n'offre aucun média, et rend le texte facultatif.
   */
  share?: PostView | null
  /** Une page parle sous sa propre identité, avec ses abonnés et sa règle collective. */
  page?: {
    readonly id: string
    readonly name: string
    readonly country: CountryCode | null
    readonly publish: PagePublicationsCapability["publish"]
    /** Un contexte collectif fermé : aucun choix de portée ne peut l'élargir. */
    readonly fixedScope?: { readonly description: string; readonly audienceLabel: string; readonly requireMedia: boolean }
  }
}) {
  const { t, locale } = useDiasporaleT()
  const actions = useActions()
  const ids = useId()
  // Un partage monte sa propre instance (la coque la remonte à chaque partage) : il naît en mode partage.
  const page = props.page
  const fixedScope = page?.fixedScope
  const hasFixedScope = fixedScope !== undefined
  const share = page ? null : props.share ?? null
  const defaults: ComposerValues = { ...DEFAULTS, reach: fixedScope || (page && !page.country) ? "diaspora" : "local", sharing: share !== null }
  const schema = useMemo(() => composerSchemaFor(fixedScope?.requireMedia === true), [fixedScope?.requireMedia])
  const form = useForm<ComposerValues>({ resolver: zodResolver(schema), defaultValues: defaults })
  const active = useRef(false)
  useLayoutEffect(() => { active.current = true; return () => { active.current = false } }, [])
  // Idempotence : la même clé pour tous les essais d'une publication (un échec réseau rejoué ne double
  // rien), une clé neuve dès qu'elle est publiée.
  const [publishKey, setPublishKey] = useState(newPublishKey)
  const mediaFields = useFieldArray({ control: form.control, name: "media" })
  const [attachments, setAttachments] = useState<Readonly<Record<string, Attachment>>>({})
  const [mediaError, setMediaError] = useState<ActionErrorCode | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const attachedCount = useRef(0)
  // Le verrou précède même la validation asynchrone : un sélecteur déjà ouvert
  // ne doit pas ajouter des photos à une publication dont le contenu est parti.
  const submissionInFlight = useRef(false)
  const audience = useWatch({ control: form.control, name: "audience" })
  const reach = useWatch({ control: form.control, name: "reach" })
  const body = useWatch({ control: form.control, name: "body" })
  const rootAllowed = !page && canAlsoPublishOnRoot(audience === "followers" ? "connections" : audience)

  // Une audience restreinte ferme la case ANTSIA : la valeur suit, jamais l'inverse.
  useEffect(() => {
    if (!rootAllowed) form.setValue("alsoOnRoot", false)
  }, [rootAllowed, form])

  // Le brouillon gardé est rétabli une fois, au montage (le stockage n'existe pas au rendu serveur).
  const draftKey = props.draftKey
  useEffect(() => {
    if (!draftKey) return
    const draft = readDraft(draftKey)
    if (draft) form.reset({
      ...draft,
      reach: hasFixedScope || (page && !page.country) ? "diaspora" : draft.reach,
      audience: hasFixedScope ? "public" : page ? (draft.audience === "followers" ? "followers" : "public") : (draft.audience === "connections" ? "connections" : "public"),
      alsoOnRoot: page ? false : draft.alsoOnRoot,
      media: [],
      sharing: false,
    })
  }, [draftKey, form, page?.country, page?.id, hasFixedScope])

  // Puis gardé à chaque pause dans la frappe.
  const alsoOnRoot = useWatch({ control: form.control, name: "alsoOnRoot" })
  useEffect(() => {
    if (!draftKey) return
    const timer = setTimeout(() => writeDraft(draftKey, { body, reach: hasFixedScope ? "diaspora" : reach, audience: hasFixedScope ? "public" : audience, alsoOnRoot: hasFixedScope ? false : alsoOnRoot }), DRAFT_SAVE_MS)
    return () => clearTimeout(timer)
  }, [draftKey, body, reach, audience, alsoOnRoot, hasFixedScope])

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
    if (submissionInFlight.current || files.length === 0) return
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
    if (submissionInFlight.current) return
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

  const publishValidatedForm = form.handleSubmit(async (values) => {
    const media: PublishMediaInput[] = []
    for (const item of values.media) {
      const state = attachments[item.key]?.state
      if (state?.status !== "ready") {
        if (state?.status !== "uploading") setMediaError("media_upload_failed")
        return
      }
      media.push({ upload: state.upload, altText: item.altText })
    }
    if (fixedScope?.requireMedia && media.length === 0) { setMediaError("association_event_gallery_media_required"); return }
    const pageInput: Omit<PagePublicationInput, "pageId"> = {
      body: values.body,
      reach: fixedScope || (page && !page.country) ? "diaspora" : values.reach,
      audience: !fixedScope && values.audience === "followers" ? "followers" : "public",
      ...(media.length > 0 ? { media } : {}),
      idempotencyKey: publishKey,
    }
    const result = page ? await page.publish({ pageId: page.id, ...pageInput }) : await actions.publish({
      body: values.body,
      reach: values.reach,
      audience: values.audience === "connections" ? "connections" : "public",
      alsoOnRoot: values.alsoOnRoot,
      // Local : le pays du hub. Diaspora : le pays d'ORIGINE, en pastille dans les autres hubs (EXF-DG-16).
      country: props.memberCountry,
      ...(media.length > 0 ? { media } : {}),
      ...(share ? { sharedPostId: share.id } : {}),
      idempotencyKey: publishKey,
    })
    if (fixedScope && !active.current) return
    if (!result.ok) {
      toast.error(t(`errors.${result.code}`))
      return
    }
    setPublishKey(newPublishKey())
    if (page) toast.success(t("pagePublications.sent", { name: page.name }))
    else toast.success("moderation" in result.value && result.value.moderation === "published" ? t(share ? "composer.shared" : "composer.published") : t("composer.sentForReview"))
    if (draftKey) writeDraft(draftKey, { body: "", reach: hasFixedScope ? "diaspora" : DEFAULTS.reach, audience: DEFAULTS.audience, alsoOnRoot: DEFAULTS.alsoOnRoot })
    clearAttachments()
    form.reset(defaults)
    props.onOpenChange(false)
  })

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submissionInFlight.current) return
    submissionInFlight.current = true
    try {
      await publishValidatedForm(event)
    } catch {
      if (!fixedScope || active.current) toast.error(t("errors.unknown"))
    } finally {
      submissionInFlight.current = false
    }
  }

  const localCountry = page?.country ?? props.memberCountry
  const countryLabel = countryName(localCountry, locale)
  const reviewNotice = reach === "local" && !isCountryOpen(localCountry, props.openCountries)
  const bodyError = form.formState.errors.body?.message
  const mediaFieldError = form.formState.errors.media?.root?.message ?? form.formState.errors.media?.message
  const mediaNotice = mediaError ?? mediaFieldError

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        title={page ? t("pagePublications.composeTitle") : share ? t("composer.shareTitle") : t("composer.title")}
        description={fixedScope?.description ?? (page ? t("pagePublications.composeDescription", { name: page.name }) : share ? t("composer.shareDescription") : t("composer.description"))}
        hideDescription={!fixedScope}
        closeLabel={t("common.close")}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-5" aria-busy={form.formState.isSubmitting} noValidate>
          {/* Le succès ne doit effacer que le contenu effectivement envoyé.
              Un fieldset conserve les valeurs RHF tout en gelant tous les contrôles. */}
          <fieldset disabled={form.formState.isSubmitting} className="contents">
          {page ? (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-semibold">{t("pagePublications.identity", { name: page.name })}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{t("pagePublications.networkNotice")}</p>
            </div>
          ) : null}
          {share ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">{t("composer.shareOriginal")}</p>
              <SharedPostEmbed share={sharedPreviewOf(share)} now={Date.now()} interactiveMedia={false} />
            </div>
          ) : null}
          <Field
            id={`${ids}-corps`}
            label={share ? t("composer.shareBodyLabel") : t("composer.bodyLabel")}
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
                placeholder={page ? t("pagePublications.placeholder", { name: page.name }) : share ? t("composer.sharePlaceholder") : t("composer.placeholder", { country: countryLabel })}
                {...form.register("body")}
              />
            )}
          </Field>

          {/* Un partage ne joint aucun média : il montre ceux de l'original (règle du moteur). */}
          <fieldset className={cn("flex flex-col gap-2", share && "hidden")} disabled={share !== null}>
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
                          // Pastille de 32 px, cible tactile de 44 px (le pseudo-élément déborde de 6 px).
                          className="absolute right-1.5 top-1.5 inline-flex size-8 items-center justify-center rounded-full bg-card text-foreground shadow-float transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-muted focus-visible:shadow-focus"
                        >
                          <XIcon className="size-4" aria-hidden />
                        </button>
                      </div>
                      <Label htmlFor={altId} className="text-[13px] text-muted-foreground">
                        {t("composer.mediaAltLabel")}
                      </Label>
                      <Input
                        id={altId}
                        autoComplete="off"
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
              <p id={`${ids}-medias-aide`} aria-live="polite" className="text-[13px] text-muted-foreground">
                {uploading ? t("composer.mediaWaiting") : t("composer.mediaHint")}
              </p>
            </div>
            <input ref={fileInput} type="file" accept={POST_MEDIA_ACCEPT} multiple hidden onChange={attachFiles} />
            {mediaNotice ? (
              <p role="alert" className="text-[13px] text-destructive">
                {t(`errors.${mediaNotice}`)}
              </p>
            ) : null}
          </fieldset>

          {fixedScope ? <p className="rounded-lg bg-muted p-3 text-sm font-medium">{fixedScope.audienceLabel}</p> : <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("composer.reachLegend")}</legend>
            <Controller
              control={form.control}
              name="reach"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} aria-label={t("composer.reachLegend")}>
                  {!page || page.country ? <RadioCard value="local">
                    <span className="flex flex-wrap items-center gap-2">
                      <CountryTag country={localCountry} />
                      <span className="text-sm">{t("composer.reachLocal", { country: countryLabel })}</span>
                    </span>
                  </RadioCard> : null}
                  <RadioCard value="diaspora">
                    <span className="flex flex-wrap items-center gap-2">
                      <ScopeTag />
                      <span className="text-sm">{t("composer.reachDiaspora")}</span>
                    </span>
                  </RadioCard>
                </RadioGroup>
              )}
            />
            {page && !page.country ? <p className="text-[13px] text-muted-foreground">{t("pagePublications.noCountry")}</p> : null}
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
                  <RadioCard value={page ? "followers" : "connections"}>
                    <span className="text-sm">{page ? t("pagePublications.followersAudience") : t("composer.audienceConnections")}</span>
                  </RadioCard>
                </RadioGroup>
              )}
            />
          </fieldset>
          </>}

          {!page ? <div className="flex items-start gap-3 rounded-lg bg-muted p-3">
            <Controller
              control={form.control}
              name="alsoOnRoot"
              render={({ field }) => (
                <Checkbox
                  id={`${ids}-antsia`}
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  disabled={!rootAllowed}
                  aria-describedby={`${ids}-antsia-aide`}
                  className="mt-0.5"
                />
              )}
            />
            <div className="min-w-0">
              <Label htmlFor={`${ids}-antsia`} className="inline-flex items-center gap-1.5">
                <GlobeIcon className="size-4" aria-hidden />
                {t("composer.alsoOnRoot")}
              </Label>
              <p id={`${ids}-antsia-aide`} className="mt-0.5 text-[13px] text-muted-foreground">
                {rootAllowed ? t("composer.alsoOnRootHint") : t("composer.alsoOnRootDisabled")}
              </p>
            </div>
          </div> : null}

          <div className="sticky bottom-0 -mx-5 -mb-4 flex justify-end gap-2 border-t border-border bg-card px-5 py-3">
            <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting || uploading}>
              <SendIcon aria-hidden />
              {form.formState.isSubmitting ? t("composer.publishing") : t("composer.publish")}
            </Button>
          </div>
          </fieldset>
        </form>
      </SheetContent>
    </Sheet>
  )
}
