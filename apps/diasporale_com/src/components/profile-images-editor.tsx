"use client"

import type { ImageRuntime } from "@antsia/social-features/media-upload"
import { Button, Field, Input } from "@diasporale/features"
import { IMAGE_PREPARATION_CODES, type ProfileImageView, type ProfileImagesActions } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useId, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import {
  INITIAL_CROP,
  prepareProfileImage,
  PROFILE_IMAGE_INPUT_MAX_BYTES,
  PROFILE_IMAGE_MIME_TYPES,
  type CropState,
  type ImageSize,
  type ProfileImageFrameUsage,
  type ProfileImageRefusal,
} from "@/lib/profile-image-crop"

import { ProfileImageCropper } from "./profile-image-cropper"

export interface ProfileImagesEditorProps {
  readonly avatar: ProfileImageView | null
  readonly cover: ProfileImageView | null
  readonly actions: ProfileImagesActions
  /**
   * Le décodeur et le canvas de la préparation — ceux du navigateur par
   * défaut. Injectés par les tests : `jsdom` n'a ni décodeur d'image ni canvas.
   */
  readonly imageRuntime?: ImageRuntime
}

interface DeliveryNotice {
  readonly kind: "updated" | "pending" | "unavailable" | "blocked" | "removed"
  readonly previous: string
  readonly delivered: string
}

const NOTICE_KEYS = {
  updated: "profile.images.updated",
  pending: "profile.images.pending",
  unavailable: "errors:fileScanUnavailable",
  blocked: "profile.images.blocked",
  removed: "profile.images.removed",
} as const

/** Le refus d'un fichier CHOISI, avant tout recadrage. */
type InputRefusal = "required" | "format" | "inputTooLarge"

const INPUT_REFUSAL_KEYS = {
  required: "profile.images.required",
  format: "profile.images.format",
  inputTooLarge: "profile.images.inputTooLarge",
} as const satisfies Record<InputRefusal, string>

function inputRefusal(usage: ProfileImageFrameUsage, file: File | null | undefined): InputRefusal | null {
  if (!file || file.size <= 0) return "required"
  if (!PROFILE_IMAGE_MIME_TYPES[usage].includes(file.type)) return "format"
  if (file.size > PROFILE_IMAGE_INPUT_MAX_BYTES) return "inputTooLarge"
  return null
}

/** L'adresse locale d'un fichier pour l'aperçu ; `null` si ce navigateur n'en donne pas (l'envoi reste possible). */
function localPreviewUrl(file: File): string | null {
  try {
    return typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null
  } catch {
    return null
  }
}

function imageKey(image: ProfileImageView | null) {
  return JSON.stringify(image === null ? null : [image.url, image.withheld])
}

/**
 * Présentation et recadrage : l'image choisie est recadrée, puis préparée par
 * le module du moteur (`prepareProfileImage` : sans métadonnées, échec fermé)
 * AVANT d'atteindre le port ; le port conserve le dépôt, les mutations et
 * leurs gardes.
 */
export function ProfileImagesEditor(props: ProfileImagesEditorProps) {
  return (
    <div className="flex flex-col gap-6">
      <ProfileImageForm usage="avatar" image={props.avatar} actions={props.actions} imageRuntime={props.imageRuntime} />
      <ProfileImageForm usage="cover" image={props.cover} actions={props.actions} imageRuntime={props.imageRuntime} />
    </div>
  )
}

/** Le cadrage de l'image choisie : il ne vaut que pour CE fichier. */
interface Framing {
  readonly file: File
  readonly crop: CropState
  readonly size: ImageSize | null
  readonly failed: boolean
}

function ProfileImageForm(props: {
  readonly usage: ProfileImageFrameUsage
  readonly image: ProfileImageView | null
  readonly actions: ProfileImagesActions
  readonly imageRuntime: ImageRuntime | undefined
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const formElement = useRef<HTMLFormElement>(null)
  const running = useRef(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState<DeliveryNotice | null>(null)
  const [framing, setFraming] = useState<Framing | null>(null)
  const [preview, setPreview] = useState<{ readonly file: File; readonly url: string } | null>(null)
  const schema = z.object({
    file: z.custom<FileList>(
      (value) => typeof FileList !== "undefined" && value instanceof FileList,
      { message: t("profile.images.required") },
    ).superRefine((files, context) => {
      const refusal = inputRefusal(props.usage, files.item(0))
      if (refusal) context.addIssue({ code: "custom", message: t(INPUT_REFUSAL_KEYS[refusal]) })
    }),
  })
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })
  const files = useWatch({ control: form.control, name: "file" })
  const chosen = typeof FileList !== "undefined" && files instanceof FileList ? files.item(0) : null
  const croppable = chosen !== null && inputRefusal(props.usage, chosen) === null ? chosen : null
  const current = framing !== null && framing.file === croppable ? framing : null
  const busy = form.formState.isSubmitting || saving || removing
  const isAvatar = props.usage === "avatar"
  const currentUrl = props.image?.withheld === null ? props.image.url : null
  const currentNotice = props.image?.withheld === "fileScanPending" ? "pending" : props.image?.withheld === "fileScanUnavailable" ? "unavailable" : props.image?.withheld === "fileQuarantined" ? "blocked" : null
  const currentKey = imageKey(props.image)
  // Un nouveau verdict reçu par le port remplace l'avis d'attente précédent.
  const shownNotice = notice && (notice.previous === currentKey || notice.delivered === currentKey) ? notice.kind : currentNotice
  const headingId = `${id}-titre`
  const confirmationId = `${id}-confirmation`

  // L'aperçu lit l'image sur place (adresse locale, libérée au changement) : rien ne part pour le montrer.
  useEffect(() => {
    const url = croppable === null ? null : localPreviewUrl(croppable)
    if (croppable === null || url === null) {
      setPreview(null)
      return
    }
    setPreview({ file: croppable, url })
    return () => {
      if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url)
    }
  }, [croppable])
  const previewUrl = preview !== null && preview.file === croppable ? preview.url : null

  const reframe = (update: (framing: Framing) => Framing) => {
    if (croppable === null) return
    setFraming((previous) => update(previous !== null && previous.file === croppable ? previous : { file: croppable, crop: INITIAL_CROP, size: null, failed: false }))
  }

  const refusalText = (refusal: ProfileImageRefusal) =>
    refusal === "too-large"
      ? t(isAvatar ? "profile.images.tooLargeAvatar" : "profile.images.tooLargeCover")
      : t(`errors.${IMAGE_PREPARATION_CODES[refusal]}`)

  const resetFile = () => {
    formElement.current?.reset()
    form.reset()
    const input = formElement.current?.elements.namedItem("file")
    if (input instanceof HTMLInputElement) input.value = ""
    setFraming(null)
  }

  const save = form.handleSubmit(async ({ file: chosenFiles }) => {
    const file = chosenFiles.item(0)
    if (!file || running.current) return
    running.current = true
    setSaving(true)
    setNotice(null)
    form.clearErrors("root")
    try {
      // Recadrée et préparée AVANT le port : seule l'image du cadre, sans métadonnées, quitte le navigateur.
      const crop = framing !== null && framing.file === file ? framing.crop : INITIAL_CROP
      const prepared = await prepareProfileImage(file, props.usage, crop, props.imageRuntime)
      if (!prepared.ok) {
        form.setError("root", { type: "client", message: refusalText(prepared.refusal) })
        return
      }
      const result = await props.actions.set(props.usage, prepared.file)
      if (!result.ok) {
        form.setError("root", { type: "server", message: t(`errors.${result.code}`) })
        return
      }
      setNotice({
        kind: result.value.withheld === "fileScanPending" ? "pending" : result.value.withheld === "fileScanUnavailable" ? "unavailable" : result.value.withheld === "fileQuarantined" ? "blocked" : "updated",
        previous: currentKey,
        delivered: imageKey(result.value),
      })
      setConfirming(false)
      resetFile()
    } catch {
      form.setError("root", { type: "server", message: t("errors.unknown") })
    } finally {
      running.current = false
      setSaving(false)
    }
  })

  const remove = async () => {
    if (!confirming || running.current) return
    running.current = true
    setRemoving(true)
    setNotice(null)
    form.clearErrors("root")
    try {
      const result = await props.actions.clear(props.usage)
      if (!result.ok) {
        form.setError("root", { type: "server", message: t(`errors.${result.code}`) })
        return
      }
      setNotice({ kind: "removed", previous: currentKey, delivered: imageKey(null) })
      setConfirming(false)
      resetFile()
    } catch {
      form.setError("root", { type: "server", message: t("errors.unknown") })
    } finally {
      running.current = false
      setRemoving(false)
    }
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3" aria-busy={busy}>
      <h3 id={headingId} className="font-display text-lg font-bold">{t(isAvatar ? "profile.images.avatar" : "profile.images.cover")}</h3>
      {currentUrl ? (
        <img
          src={currentUrl}
          alt=""
          aria-hidden
          width={isAvatar ? 80 : 960}
          height={isAvatar ? 80 : 280}
          loading="lazy"
          className={isAvatar ? "size-20 rounded-full object-cover" : "h-28 w-full rounded-xl object-cover"}
        />
      ) : null}
      {shownNotice ? (
        <p role={shownNotice === "blocked" || shownNotice === "unavailable" ? "alert" : "status"} className="text-sm text-muted-foreground">
          {t(NOTICE_KEYS[shownNotice])}
        </p>
      ) : null}
      <form ref={formElement} aria-labelledby={headingId} noValidate onSubmit={(event) => void save(event)} className="flex flex-col items-start gap-3">
        <Field
          id={`${id}-fichier`}
          label={t(isAvatar ? "profile.images.chooseAvatar" : "profile.images.chooseCover")}
          hint={t("profile.images.requirements")}
          error={form.formState.errors.file?.message}
        >
          {(control) => (
            <Input
              {...form.register("file")}
              id={control.id}
              type="file"
              accept={PROFILE_IMAGE_MIME_TYPES[props.usage].join(",")}
              disabled={busy}
              aria-invalid={control.invalid}
              aria-describedby={control.describedBy}
            />
          )}
        </Field>
        {croppable !== null ? (
          <ProfileImageCropper
            usage={props.usage}
            src={previewUrl}
            crop={current?.crop ?? INITIAL_CROP}
            size={current?.size ?? null}
            failed={current?.failed ?? false}
            disabled={busy}
            onSize={(size) => reframe((previous) => ({ ...previous, size }))}
            onFailed={() => reframe((previous) => ({ ...previous, failed: true }))}
            onChange={(crop) => reframe((previous) => ({ ...previous, crop }))}
          />
        ) : null}
        <Button type="submit" disabled={busy}>
          {t(busy ? "profile.images.saving" : isAvatar ? "profile.images.saveAvatar" : "profile.images.saveCover")}
        </Button>
      </form>
      {form.formState.errors.root?.message ? <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
      {props.image !== null ? (
        confirming ? (
          <div role="group" aria-labelledby={confirmationId} className="flex flex-col items-start gap-3 rounded-xl bg-muted p-3">
            <p id={confirmationId} className="text-sm">{t("profile.images.confirmRemove")}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => void remove()}>{t(isAvatar ? "profile.images.removeAvatar" : "profile.images.removeCover")}</Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>{t("profile.images.cancel")}</Button>
            </div>
          </div>
        ) : <Button type="button" variant="ghost" disabled={busy} className="self-start" onClick={() => setConfirming(true)}>{t(isAvatar ? "profile.images.removeAvatar" : "profile.images.removeCover")}</Button>
      ) : null}
    </section>
  )
}
