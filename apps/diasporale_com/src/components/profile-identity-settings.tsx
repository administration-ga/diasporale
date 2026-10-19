"use client"

import { Button, Field, Input, Textarea } from "@diasporale/features"
import { DISPLAY_NAME_MAX_LENGTH, HEADLINE_MAX_LENGTH, type ActionErrorCode, type DiasporaleDataSource, type OwnProfileView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

type Publication = NonNullable<DiasporaleDataSource["profilePublication"]>
const identitySchema = z.object({
  displayName: z.string().trim().min(1, "display_name_invalid").max(DISPLAY_NAME_MAX_LENGTH, "display_name_invalid"),
  headline: z.string().trim().max(HEADLINE_MAX_LENGTH, "headline_too_long"),
})
type Values = z.infer<typeof identitySchema>

/** Éditer les textes ne constitue jamais un consentement à publier le profil. */
export function ProfileIdentitySettings(props: { profile: OwnProfileView; publication: Publication; disabled: boolean; acquire: () => (() => void) | null }) {
  const { t } = useDiasporaleT()
  const { profile, publication } = props
  const snapshot = JSON.stringify([profile.personId, profile.handle, profile.displayName, profile.headline, profile.published, profile.private])
  const scope = useMemo(() => ({ publication, snapshot, personId: profile.personId }), [publication, snapshot, profile.personId])
  const [editing, setEditing] = useState<typeof scope | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const previousEditor = useRef<typeof scope | null>(null)
  const open = editing === scope
  useEffect(() => {
    const previous = previousEditor.current
    previousEditor.current = open ? scope : null
    if (!open && (restoreFocus.current || (previous?.publication === publication && previous.personId === profile.personId))) {
      restoreFocus.current = false
      trigger.current?.focus()
    }
  }, [open, scope, publication, profile.personId])
  if (!publication.updateIdentity || !profile.handle || !profile.displayName) return null
  return (
    <div className="flex flex-col items-start gap-3 border-b border-border pb-4">
      <h3 className="font-semibold">{t("settings.profileIdentity.title")}</h3>
      <p className="text-sm text-muted-foreground">{t("settings.profileIdentity.lead")}</p>
      {open ? (
        <IdentityForm
          profile={profile}
          update={publication.updateIdentity}
          disabled={props.disabled}
          acquire={props.acquire}
          onClose={() => { restoreFocus.current = true; setEditing(null) }}
        />
      ) : (
        <>
          <p className="max-w-full whitespace-pre-line break-words text-sm">{profile.displayName}{profile.headline ? ` — ${profile.headline}` : ""}</p>
          <Button ref={trigger} variant="outline" disabled={props.disabled} onClick={() => setEditing(scope)}>{t("settings.profileIdentity.edit")}</Button>
        </>
      )}
    </div>
  )
}

function IdentityForm(props: { profile: OwnProfileView; update: NonNullable<Publication["updateIdentity"]>; disabled: boolean; acquire: () => (() => void) | null; onClose: () => void }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const form = useForm<Values>({ resolver: zodResolver(identitySchema), defaultValues: { displayName: props.profile.displayName ?? "", headline: props.profile.headline ?? "" } })
  const nameInput = useRef<HTMLInputElement | null>(null)
  const nameField = form.register("displayName")
  const scope = useMemo(() => ({ update: props.update, personId: props.profile.personId }), [props.update, props.profile.personId])
  const active = useRef<typeof scope | null>(null)
  const locked = useRef(false)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  useLayoutEffect(() => {
    active.current = scope
    return () => { if (active.current === scope) active.current = null }
  }, [scope])
  useLayoutEffect(() => { nameInput.current?.focus() }, [])
  const validatedSubmit = form.handleSubmit(async (values) => {
    if (active.current !== scope) return
    setError(null)
    try {
      const result = await props.update(props.profile.personId, values)
      if (active.current !== scope) return
      if (result.ok) props.onClose()
      else setError(result.code)
    } catch {
      if (active.current === scope) setError("unknown")
    }
  })
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (locked.current || props.disabled || active.current !== scope) return
    const release = props.acquire()
    if (!release) return
    locked.current = true
    try { await validatedSubmit(event) }
    finally { locked.current = false; release() }
  }
  const busy = form.formState.isSubmitting
  return (
    <form noValidate className="flex w-full flex-col gap-4" onSubmit={submit}>
      <Field id={`${id}-name`} label={t("settings.profileIdentity.name")} hint={t("settings.profileIdentity.nameHint")} error={form.formState.errors.displayName?.message ? t(`errors.${form.formState.errors.displayName.message}`) : undefined}>
        {(field) => <Input id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} maxLength={DISPLAY_NAME_MAX_LENGTH} disabled={busy || props.disabled} {...nameField} ref={(element) => { nameField.ref(element); nameInput.current = element }} />}
      </Field>
      <Field id={`${id}-headline`} label={t("settings.profileIdentity.headline")} hint={t("settings.profileIdentity.headlineHint", { max: HEADLINE_MAX_LENGTH })} error={form.formState.errors.headline?.message ? t(`errors.${form.formState.errors.headline.message}`) : undefined}>
        {(field) => <Textarea id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} maxLength={HEADLINE_MAX_LENGTH} rows={2} disabled={busy || props.disabled} {...form.register("headline")} />}
      </Field>
      {error ? <p role="alert" className="text-sm text-destructive">{t(`errors.${error}`)}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || props.disabled}>{t(busy ? "settings.profilePublication.working" : "settings.profileIdentity.save")}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={props.onClose}>{t("common.cancel")}</Button>
      </div>
    </form>
  )
}
