"use client"

import { AVATAR_ACCEPT, avatarRejectionFor } from "@antsia/social-features/features/reseau-personnel/shared"
import { Button, Field, Input } from "@diasporale/features"
import type { ProfileImageView, ProfileImagesActions } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

export interface ProfileImagesEditorProps {
  readonly avatar: ProfileImageView | null
  readonly cover: ProfileImageView | null
  readonly actions: ProfileImagesActions
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

function imageKey(image: ProfileImageView | null) {
  return JSON.stringify(image === null ? null : [image.url, image.withheld])
}

/** Présentation seulement : le port conserve le dépôt, les mutations et leurs gardes. */
export function ProfileImagesEditor(props: ProfileImagesEditorProps) {
  return (
    <div className="flex flex-col gap-6">
      <ProfileImageForm usage="avatar" image={props.avatar} actions={props.actions} />
      <ProfileImageForm usage="cover" image={props.cover} actions={props.actions} />
    </div>
  )
}

function ProfileImageForm(props: {
  readonly usage: "avatar" | "cover"
  readonly image: ProfileImageView | null
  readonly actions: ProfileImagesActions
}) {
  const { t } = useDiasporaleT()
  const { t: tEngine } = useTranslation("reseau")
  const id = useId()
  const formElement = useRef<HTMLFormElement>(null)
  const running = useRef(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState<DeliveryNotice | null>(null)
  const schema = z.object({
    file: z.custom<FileList>(
      (value) => typeof FileList !== "undefined" && value instanceof FileList,
      { message: t("profile.images.required") },
    ).superRefine((files, context) => {
      const file = files.item(0)
      const refusal = file && file.size > 0 ? avatarRejectionFor(file, tEngine) : t("profile.images.required")
      if (refusal) context.addIssue({ code: "custom", message: refusal })
    }),
  })
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })
  const busy = form.formState.isSubmitting || saving || removing
  const isAvatar = props.usage === "avatar"
  const currentUrl = props.image?.withheld === null ? props.image.url : null
  const currentNotice = props.image?.withheld === "fileScanPending" ? "pending" : props.image?.withheld === "fileScanUnavailable" ? "unavailable" : props.image?.withheld === "fileQuarantined" ? "blocked" : null
  const currentKey = imageKey(props.image)
  // Un nouveau verdict reçu par le port remplace l'avis d'attente précédent.
  const shownNotice = notice && (notice.previous === currentKey || notice.delivered === currentKey) ? notice.kind : currentNotice
  const headingId = `${id}-titre`
  const confirmationId = `${id}-confirmation`

  const resetFile = () => {
    formElement.current?.reset()
    form.reset()
    const input = formElement.current?.elements.namedItem("file")
    if (input instanceof HTMLInputElement) input.value = ""
  }

  const save = form.handleSubmit(async ({ file: files }) => {
    const file = files.item(0)
    if (!file || running.current) return
    running.current = true
    setSaving(true)
    setNotice(null)
    form.clearErrors("root")
    try {
      const result = await props.actions.set(props.usage, file)
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
              accept={AVATAR_ACCEPT}
              disabled={busy}
              aria-invalid={control.invalid}
              aria-describedby={control.describedBy}
            />
          )}
        </Field>
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
