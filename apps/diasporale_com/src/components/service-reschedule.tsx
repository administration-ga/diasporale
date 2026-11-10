"use client"

/**
 * SV-03 — déplacer un rendez-vous CONFIRMÉ sans l'annuler. L'une ou l'autre
 * partie propose un autre horaire (même durée, mêmes conditions) ; l'autre
 * l'accepte après avoir vu l'ancien et le nouvel horaire, dans le fuseau du
 * rendez-vous et dans le sien ; sinon le rendez-vous reste tel quel (déclin,
 * retrait ou échéance). Les gestes ouverts se relisent avec l'heure courante
 * par les règles du domaine ; le fournisseur les rejuge à l'écriture.
 * PROPRIÉTAIRE : chantier « demandes et rendez-vous ».
 */
import {
  availableServiceRescheduleActions,
  DAY_MS,
  openServiceReschedule,
  parseServiceReschedule,
  utcToZonedWallTime,
  zonedWallTimeToUtc,
  type ServiceRescheduleAction,
} from "@diasporale/domain"
import { Button, Card, Field, Input } from "@diasporale/features"
import type { ActionErrorCode, ServiceBookingView, ServiceRequestDetailView, ServiceRequestsCapability, ServiceRescheduleView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useMemo, useRef, useState, type FormEvent } from "react"
import { useForm, type FieldPath } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { ConfirmSheet } from "./service-request-sheets"
import { formatServiceInstant, SlotText, timeZoneOptions } from "./service-request-ui"

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

const rescheduleSchema = z.object({
  date: z.string().regex(DATE, "request_time_invalid"),
  time: z.string().regex(TIME, "request_time_invalid"),
  timeZone: z.string().min(1, "request_time_zone_invalid"),
  deadlineDate: z.string().regex(DATE, "request_time_invalid"),
  deadlineTime: z.string().regex(TIME, "request_time_invalid"),
})

type RescheduleValues = z.infer<typeof rescheduleSchema>

/** Le champ qui porte un refus du domaine ou du fournisseur ; sinon, le formulaire entier. */
const FIELD_OF: Partial<Record<ActionErrorCode, FieldPath<RescheduleValues>>> = {
  proposal_start_invalid: "time",
  reschedule_same_slot: "time",
  booking_slot_unavailable: "time",
  request_time_invalid: "time",
  request_time_nonexistent: "time",
  request_time_ambiguous: "time",
  request_time_zone_invalid: "timeZone",
  proposal_deadline_invalid: "deadlineTime",
}

/** Le rendez-vous lu dans son fuseau ; l'échéance au plus tard dans deux jours, avant son début. */
function startValues(booking: ServiceBookingView, now: number): RescheduleValues {
  const start = utcToZonedWallTime(booking.startAt, booking.timeZone)
  const deadline = utcToZonedWallTime(Math.min(now + 2 * DAY_MS, booking.startAt), booking.timeZone)
  return { date: start?.date ?? "", time: start?.time ?? "", timeZone: booking.timeZone, deadlineDate: deadline?.date ?? "", deadlineTime: deadline?.time ?? "" }
}

export function ServiceRescheduleSection(props: {
  readonly capability: ServiceRequestsCapability
  readonly detail: ServiceRequestDetailView
  readonly viewerTimeZone: string
  readonly now: number
}) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const { capability, detail, now } = props
  const [proposing, setProposing] = useState(false)
  const [accepting, setAccepting] = useState<ServiceRescheduleView | null>(null)
  const [declining, setDeclining] = useState(false)
  const booking = detail.booking
  const { proposeReschedule, acceptReschedule, declineReschedule } = capability
  // Le fournisseur sert le déplacement (gestes et projection), et le rendez-vous est confirmé.
  if (!booking || booking.status !== "confirmed" || detail.rescheduleActions === undefined || !proposeReschedule || !acceptReschedule || !declineReschedule) return null
  const version = detail.currentProposal ? detail.currentProposal.version : 0
  const pending = openServiceReschedule(detail.reschedule ?? null, now)
  const actions = new Set<ServiceRescheduleAction>(availableServiceRescheduleActions({
    actor: detail.viewerRole, status: detail.status, now, bookingStartAt: booking.startAt, reschedule: pending, proposalVersion: version,
  }))
  if (pending === null && !actions.has("propose_reschedule")) return null
  const mine = pending !== null && pending.proposedBy === detail.viewerRole

  const decline = async () => {
    if (declining) return
    setDeclining(true)
    try {
      const result = await declineReschedule({ requestId: detail.requestId })
      if (result.ok) toast.success(t(mine ? "serviceReschedule.withdrawn" : "serviceReschedule.declined"))
      else toast.error(t(`errors.${result.code}`))
    } catch {
      toast.error(t("errors.unknown"))
    } finally {
      setDeclining(false)
    }
  }

  return (
    <section aria-labelledby={`${id}-deplacer`} className="flex min-w-0 flex-col gap-3">
      <h2 id={`${id}-deplacer`} className="text-lg font-semibold">{t("serviceReschedule.title")}</h2>
      {pending !== null ? (
        <Card className="flex min-w-0 flex-col gap-3 p-4">
          <p className="font-medium">
            {t(mine ? "serviceReschedule.pendingByMe" : pending.proposedBy === "page" ? "serviceReschedule.pendingByPage" : "serviceReschedule.pendingByRequester")}
          </p>
          <SlotComparison booking={booking} pending={pending} viewerTimeZone={props.viewerTimeZone} />
          <p className="text-[13px] text-muted-foreground">{t("serviceReschedule.deadline", { date: formatServiceInstant(pending.expiresAt, props.viewerTimeZone, locale) })}</p>
          <div className="flex flex-wrap gap-2">
            {actions.has("accept_reschedule") ? <Button variant="commerce" onClick={() => setAccepting(pending)}>{t("serviceReschedule.accept")}</Button> : null}
            {actions.has("decline_reschedule") ? (
              <Button variant="outline" disabled={declining} aria-busy={declining} onClick={() => void decline()}>
                {t(mine ? "serviceReschedule.withdraw" : "serviceReschedule.decline")}
              </Button>
            ) : null}
          </div>
        </Card>
      ) : proposing ? (
        <RescheduleForm
          booking={booking}
          viewerTimeZone={props.viewerTimeZone}
          onSubmit={(input) => proposeReschedule({ requestId: detail.requestId, expectedProposalVersion: version, ...input })}
          onDone={() => setProposing(false)}
        />
      ) : (
        <div className="flex min-w-0 flex-col items-start gap-2">
          <p className="text-[13px] leading-snug text-muted-foreground">{t("serviceReschedule.lead")}</p>
          <Button variant="outline" onClick={() => setProposing(true)}>{t("serviceReschedule.cta")}</Button>
        </div>
      )}
      {accepting ? (
        <ConfirmSheet
          open
          onOpenChange={(open) => {
            if (!open) setAccepting(null)
          }}
          title={t("serviceReschedule.acceptTitle")}
          description={t("serviceReschedule.acceptDescription")}
          confirmLabel={t("serviceReschedule.acceptConfirm")}
          onConfirm={async () => {
            // L'horaire LU est cité : un autre horaire proposé entre-temps fait refuser l'accord.
            const result = await acceptReschedule({ requestId: detail.requestId, expectedProposalVersion: version, expectedStartAt: accepting.startAt })
            if (!result.ok) return result.code
            toast.success(t("serviceReschedule.accepted"))
            return null
          }}
        >
          <SlotComparison booking={booking} pending={accepting} viewerTimeZone={props.viewerTimeZone} />
        </ConfirmSheet>
      ) : null}
    </section>
  )
}

/** L'horaire actuel et le nouvel horaire, chacun dans son fuseau et, s'il diffère, dans celui du lecteur. */
function SlotComparison(props: { readonly booking: ServiceBookingView; readonly pending: ServiceRescheduleView; readonly viewerTimeZone: string }) {
  const { t } = useDiasporaleT()
  return (
    <dl className="grid min-w-0 gap-2 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted px-3 py-2">
        <dt className="text-[13px] text-muted-foreground">{t("serviceReschedule.current")}</dt>
        <dd className="break-words"><SlotText slot={props.booking} timeZone={props.booking.timeZone} viewerTimeZone={props.viewerTimeZone} /></dd>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted px-3 py-2">
        <dt className="text-[13px] text-muted-foreground">{t("serviceReschedule.proposed")}</dt>
        <dd className="break-words font-medium"><SlotText slot={props.pending} timeZone={props.pending.timeZone} viewerTimeZone={props.viewerTimeZone} /></dd>
      </div>
    </dl>
  )
}

/** Le nouvel horaire : date, heure et fuseau explicites, échéance de la réponse ; même durée. */
function RescheduleForm(props: {
  readonly booking: ServiceBookingView
  readonly viewerTimeZone: string
  readonly onSubmit: (input: { readonly startAt: number; readonly timeZone: string; readonly expiresAt: number }) => Promise<{ ok: true } | { ok: false; code: ActionErrorCode }>
  readonly onDone: () => void
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const [defaults] = useState(() => startValues(props.booking, Date.now()))
  const zones = useMemo(() => [...new Set([props.booking.timeZone, ...timeZoneOptions(props.viewerTimeZone)])], [props.booking.timeZone, props.viewerTimeZone])
  const form = useForm<RescheduleValues>({ resolver: zodResolver(rescheduleSchema), defaultValues: defaults })
  const [formError, setFormError] = useState<ActionErrorCode | null>(null)
  const locked = useRef(false)
  const errors = form.formState.errors
  const message = (code: string | undefined) => (code ? t(`errors.${code}`) : undefined)
  const minutes = Math.round((props.booking.endAt - props.booking.startAt) / 60_000)

  const refuse = (code: ActionErrorCode) => {
    const field = FIELD_OF[code]
    if (field) form.setError(field, { message: code })
    else setFormError(code)
  }

  const validatedSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    const startAt = zonedWallTimeToUtc({ date: values.date, time: values.time }, values.timeZone)
    if (!startAt.ok) return refuse(startAt.code)
    const expiresAt = zonedWallTimeToUtc({ date: values.deadlineDate, time: values.deadlineTime }, values.timeZone)
    if (!expiresAt.ok) return form.setError("deadlineTime", { message: expiresAt.code })
    const input = { startAt: startAt.value, timeZone: values.timeZone, expiresAt: expiresAt.value }
    // Les règles du domaine d'abord : un refus se montre au champ, sans aller-retour.
    const checked = parseServiceReschedule(input, props.booking, Date.now())
    if (!checked.ok) return refuse(checked.code)
    try {
      const result = await props.onSubmit(input)
      if (result.ok) {
        toast.success(t("serviceReschedule.form.sent"))
        props.onDone()
      } else refuse(result.code)
    } catch {
      setFormError("unknown")
    }
  })

  /** Une proposition à la fois : un double clic n'envoie rien deux fois. */
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

  const busy = form.formState.isSubmitting
  return (
    <form noValidate className="flex min-w-0 flex-col gap-4" onSubmit={submit} aria-describedby={`${id}-duree`}>
      <p id={`${id}-duree`} className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("serviceReschedule.form.duration", { count: minutes })}</p>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field id={`${id}-date`} label={t("serviceReschedule.form.date")} error={message(errors.date?.message)}>
          {(field) => <Input id={field.id} type="date" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("date")} />}
        </Field>
        <Field id={`${id}-heure`} label={t("serviceReschedule.form.time")} error={message(errors.time?.message)}>
          {(field) => <Input id={field.id} type="time" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("time")} />}
        </Field>
        <Field id={`${id}-fuseau`} label={t("serviceReschedule.form.timeZone")} hint={t("serviceReschedule.form.timeZoneHint")} error={message(errors.timeZone?.message)}>
          {(field) => (
            <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} className="h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-[15px]" {...form.register("timeZone")}>
              {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          )}
        </Field>
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field id={`${id}-echeance-date`} label={t("serviceReschedule.form.deadlineDate")} hint={t("serviceReschedule.form.deadlineHint")} error={message(errors.deadlineDate?.message)}>
          {(field) => <Input id={field.id} type="date" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("deadlineDate")} />}
        </Field>
        <Field id={`${id}-echeance-heure`} label={t("serviceReschedule.form.deadlineTime")} error={message(errors.deadlineTime?.message)}>
          {(field) => <Input id={field.id} type="time" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("deadlineTime")} />}
        </Field>
      </div>
      {formError ? <p role="alert" className="text-sm font-medium text-destructive">{t(`errors.${formError}`)}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="send" disabled={busy} aria-busy={busy}>{t(busy ? "serviceReschedule.form.sending" : "serviceReschedule.form.submit")}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={props.onDone}>{t("serviceRequests.sheet.back")}</Button>
      </div>
    </form>
  )
}
