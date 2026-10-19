"use client"

/**
 * « Demander ce service » depuis la fiche d'une offre : la demande STRUCTURÉE
 * (besoin, une à trois disponibilités dans le fuseau du navigateur, consentement
 * à montrer son nom à l'équipe de la page). PROPRIÉTAIRE : chantier « demandes
 * et rendez-vous ». La fiche d'offre (chantier « catalogue ») le monte ; la
 * signature est figée.
 *
 * Idempotence : une clé STABLE pendant la vie de la feuille ; un double clic ou
 * un renvoi après une coupure rend la même demande. Aucun paiement, aucune
 * adresse exacte, aucune coordonnée : le rappel le dit avant l'envoi.
 */
import {
  SERVICE_NEED_MAX_LENGTH,
  SERVICE_NEED_MIN_LENGTH,
  SERVICE_WINDOWS_MAX,
  serviceTextRefusal,
  utcToZonedWallTime,
  zonedWallTimeToUtc,
  DAY_MS,
} from "@diasporale/domain"
import { Button, Checkbox, Field, Input, Label, Sheet, SheetContent, Textarea } from "@diasporale/features"
import { useServiceRequests, useSession, type ActionErrorCode, type ServiceRequestsCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarPlusIcon, CheckCircle2Icon, Trash2Icon } from "lucide-react"
import NextLink from "next/link"
import { useId, useMemo, useRef, useState, type FormEvent } from "react"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { routes } from "@/lib/routes"

import { browserTimeZone } from "./service-request-ui"

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

const windowSchema = z.object({
  date: z.string().regex(DATE, "request_time_invalid"),
  start: z.string().regex(TIME, "request_time_invalid"),
  end: z.string().regex(TIME, "request_time_invalid"),
})

const requestSchema = z.object({
  need: z.string().trim().min(SERVICE_NEED_MIN_LENGTH, "request_need_too_short").max(SERVICE_NEED_MAX_LENGTH, "request_need_too_long"),
  windows: z.array(windowSchema).min(1, "request_windows_required").max(SERVICE_WINDOWS_MAX, "request_windows_too_many"),
  consent: z.boolean().refine((value) => value, { message: "request_consent_required" }),
})

type RequestValues = z.infer<typeof requestSchema>

/** Une clé d'idempotence neuve, pour une nouvelle feuille. */
function newIdempotencyKey(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `demande-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  }
}

/** La première disponibilité proposée : demain, de 10 h à 12 h, dans le fuseau du navigateur. */
function defaultWindow(timeZone: string): RequestValues["windows"][number] {
  const tomorrow = utcToZonedWallTime(Date.now() + DAY_MS, timeZone)
  return { date: tomorrow?.date ?? "", start: "10:00", end: "12:00" }
}

export function ServiceRequestEntry(props: {
  readonly offerId: string
  readonly offerVersion: number
  readonly offerTitle: string
  readonly pageName: string
}) {
  const { t } = useDiasporaleT()
  const capability = useServiceRequests()
  const session = useSession()
  const [open, setOpen] = useState(false)
  // Une clé par ouverture de la feuille : stable pour ses renvois, neuve à la suivante.
  const [sheetKey, setSheetKey] = useState(0)
  const member = session.status === "ready" && session.data.status === "signed_in" ? session.data.membership : null
  const signedOut = session.status === "ready" && session.data.status === "anonymous"

  if (capability === null) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button disabled>{t("serviceRequests.entry.cta")}</Button>
        <p className="text-sm text-muted-foreground">{t("serviceRequests.entry.unavailable")}</p>
      </div>
    )
  }
  if (signedOut) {
    return (
      <Button asChild>
        <NextLink href={routes.enter()}>{t("serviceRequests.entry.signIn")}</NextLink>
      </Button>
    )
  }
  const canPublish = member !== null && member.status !== "partie" && member.canPublish
  return (
    <div className="flex flex-col items-start gap-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <Button
          disabled={!canPublish}
          aria-haspopup="dialog"
          onClick={() => {
            setSheetKey((value) => value + 1)
            setOpen(true)
          }}
        >
          <CalendarPlusIcon aria-hidden />
          {t("serviceRequests.entry.cta")}
        </Button>
        {open ? (
          <SheetContent
            title={t("serviceRequests.entry.title", { offer: props.offerTitle })}
            description={t("serviceRequests.entry.description", { page: props.pageName })}
            closeLabel={t("serviceRequests.sheet.close")}
          >
            <RequestForm key={sheetKey} capability={capability} offerId={props.offerId} offerVersion={props.offerVersion} pageName={props.pageName} onClose={() => setOpen(false)} />
          </SheetContent>
        ) : null}
      </Sheet>
      {member === null ? null : !canPublish ? (
        <p className="text-sm text-muted-foreground">{t("serviceRequests.entry.statusInsufficient")}</p>
      ) : null}
      {member !== null ? (
        <Button asChild variant="link">
          <NextLink href={routes.myServiceRequests()}>{t("serviceRequests.entry.myRequests")}</NextLink>
        </Button>
      ) : null}
    </div>
  )
}

function RequestForm(props: {
  readonly capability: ServiceRequestsCapability
  readonly offerId: string
  readonly offerVersion: number
  readonly pageName: string
  readonly onClose: () => void
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const timeZone = useMemo(() => browserTimeZone(), [])
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)
  const [sent, setSent] = useState<{ readonly requestId: string } | null>(null)
  const [formError, setFormError] = useState<ActionErrorCode | null>(null)
  const form = useForm<RequestValues>({ resolver: zodResolver(requestSchema), defaultValues: { need: "", windows: [defaultWindow(timeZone)], consent: false } })
  const windows = useFieldArray({ control: form.control, name: "windows" })
  const locked = useRef(false)
  const errors = form.formState.errors
  const message = (code: string | undefined) => (code ? t(`errors.${code}`) : undefined)

  const validatedSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    const textRefusal = serviceTextRefusal(values.need)
    if (textRefusal) return form.setError("need", { message: textRefusal })
    const converted: { startAt: number; endAt: number }[] = []
    for (const [index, window] of values.windows.entries()) {
      const startAt = zonedWallTimeToUtc({ date: window.date, time: window.start }, timeZone)
      if (!startAt.ok) return form.setError(`windows.${index}.start`, { message: startAt.code })
      const endAt = zonedWallTimeToUtc({ date: window.date, time: window.end }, timeZone)
      if (!endAt.ok) return form.setError(`windows.${index}.end`, { message: endAt.code })
      if (endAt.value <= startAt.value) return form.setError(`windows.${index}.end`, { message: "request_window_invalid" })
      if (startAt.value <= Date.now()) return form.setError(`windows.${index}.start`, { message: "request_window_past" })
      converted.push({ startAt: startAt.value, endAt: endAt.value })
    }
    try {
      const result = await props.capability.send({
        offerId: props.offerId,
        offerVersion: props.offerVersion,
        need: values.need,
        windows: converted,
        timeZone,
        shareIdentityWithPage: values.consent,
        idempotencyKey,
      })
      if (result.ok) {
        setSent({ requestId: result.value.requestId })
        toast.success(t("serviceRequests.entry.sent"))
        return
      }
      // Un autre corps sous la même clé : la feuille repart d'une clé neuve, sans rien deviner.
      if (result.code === "request_idempotency_conflict") setIdempotencyKey(newIdempotencyKey())
      setFormError(result.code)
    } catch {
      setFormError("unknown")
    }
  })

  /** Un envoi à la fois ; un renvoi rejoue la même clé, donc la même demande. */
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (locked.current) return
    locked.current = true
    try {
      await validatedSubmit(event)
    } finally {
      locked.current = false
    }
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2Icon aria-hidden className="size-5 text-primary" />
          {t("serviceRequests.entry.sent")}
        </p>
        <p className="text-sm">{t("serviceRequests.entry.sentBody", { page: props.pageName })}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <NextLink href={routes.serviceRequest(sent.requestId)}>{t("serviceRequests.entry.open")}</NextLink>
          </Button>
          <Button variant="ghost" onClick={props.onClose}>{t("serviceRequests.sheet.close")}</Button>
        </div>
      </div>
    )
  }

  const busy = form.formState.isSubmitting
  return (
    <form noValidate className="flex min-w-0 flex-col gap-4" onSubmit={submit}>
      <Field id={`${id}-besoin`} label={t("serviceRequests.entry.need")} hint={t("serviceRequests.entry.needHint", { min: SERVICE_NEED_MIN_LENGTH })} error={message(errors.need?.message)}>
        {(field) => (
          <Textarea id={field.id} rows={4} maxLength={SERVICE_NEED_MAX_LENGTH} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("need")} />
        )}
      </Field>

      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="text-sm font-medium">{t("serviceRequests.entry.windows")}</legend>
        <p className="text-[13px] text-muted-foreground">{t("serviceRequests.entry.windowsHint", { zone: timeZone })}</p>
        {windows.fields.map((item, index) => (
          <div key={item.id} className="flex min-w-0 flex-col gap-2 rounded-lg bg-muted p-3">
            <p className="text-sm font-medium">{t("serviceRequests.entry.window", { index: index + 1 })}</p>
            <div className="grid min-w-0 gap-2 sm:grid-cols-3">
              <Field id={`${id}-date-${index}`} label={t("serviceRequests.entry.date")} error={message(errors.windows?.[index]?.date?.message)}>
                {(field) => <Input id={field.id} type="date" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register(`windows.${index}.date`)} />}
              </Field>
              <Field id={`${id}-debut-${index}`} label={t("serviceRequests.entry.start")} error={message(errors.windows?.[index]?.start?.message)}>
                {(field) => <Input id={field.id} type="time" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register(`windows.${index}.start`)} />}
              </Field>
              <Field id={`${id}-fin-${index}`} label={t("serviceRequests.entry.end")} error={message(errors.windows?.[index]?.end?.message)}>
                {(field) => <Input id={field.id} type="time" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register(`windows.${index}.end`)} />}
              </Field>
            </div>
            {windows.fields.length > 1 ? (
              <div>
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => windows.remove(index)}>
                  <Trash2Icon aria-hidden />
                  {t("serviceRequests.entry.removeWindow", { index: index + 1 })}
                </Button>
              </div>
            ) : null}
          </div>
        ))}
        {errors.windows?.message ? <p role="alert" className="text-[13px] font-medium text-destructive">{message(errors.windows.message)}</p> : null}
        {windows.fields.length < SERVICE_WINDOWS_MAX ? (
          <div>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => windows.append(defaultWindow(timeZone))}>
              {t("serviceRequests.entry.addWindow")}
            </Button>
          </div>
        ) : null}
      </fieldset>

      <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("serviceRequests.entry.reminder")}</p>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-3">
          <Controller
            control={form.control}
            name="consent"
            render={({ field }) => (
              <Checkbox
                id={`${id}-consentement`}
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                onBlur={field.onBlur}
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={errors.consent ? `${id}-consentement-erreur` : undefined}
                disabled={busy}
              />
            )}
          />
          <Label htmlFor={`${id}-consentement`} className="font-normal leading-snug">{t("serviceRequests.entry.consent", { page: props.pageName })}</Label>
        </div>
        {errors.consent?.message ? <p id={`${id}-consentement-erreur`} role="alert" className="text-[13px] font-medium text-destructive">{message(errors.consent.message)}</p> : null}
      </div>

      {formError ? (
        <div role="alert" className="flex flex-col items-start gap-2 text-sm">
          <p className="font-medium text-destructive">{t(`errors.${formError}`)}</p>
          {formError === "request_already_open" ? (
            <Button asChild variant="outline" size="sm">
              <NextLink href={routes.myServiceRequests()}>{t("serviceRequests.entry.myRequests")}</NextLink>
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy} aria-busy={busy}>{t(busy ? "serviceRequests.entry.sending" : "serviceRequests.entry.submit")}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={props.onClose}>{t("serviceRequests.sheet.back")}</Button>
      </div>
    </form>
  )
}
