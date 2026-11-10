"use client"

/**
 * Le formulaire de PROPOSITION d'une page (DG-014) : montant et devise, durée,
 * créneau dans un fuseau explicite, lieu approximatif ou à distance, contenu,
 * conditions d'annulation, échéance de l'accord. Chaque envoi crée une NOUVELLE
 * version ; la version lue est citée, un second onglet ne l'écrase pas.
 * SV-04 : il s'ouvre PRÉREMPLI depuis l'offre (tarif, durée, devise, titre), ses
 * réglages de prestation (fuseau, lieu, conditions) et la première disponibilité
 * du demandeur ; « Reprendre la version précédente » recopie la dernière version.
 * Rien n'est envoyé sans validation explicite.
 * PROPRIÉTAIRE : chantier « demandes et rendez-vous ».
 */
import {
  CURRENCY_CODES,
  DAY_MS,
  parseMajorAmount,
  parseServiceProposal,
  SERVICE_CANCELLATION_TERMS_MAX_LENGTH,
  SERVICE_LOCATION_AREA_MAX_LENGTH,
  SERVICE_PROPOSAL_DETAILS_MAX_LENGTH,
  SERVICE_SLOT_MAX_MINUTES,
  SERVICE_SLOT_MIN_MINUTES,
  serviceTextRefusal,
  utcToZonedWallTime,
  zonedWallTimeToUtc,
  type ServiceWindow,
} from "@diasporale/domain"
import { Button, Field, Input, Textarea } from "@diasporale/features"
import type { ActionErrorCode, ServiceProposalPrefillView, ServiceProposalView, ServiceRequestsCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useMemo, useRef, useState, type FormEvent } from "react"
import { useForm, useWatch, type FieldPath } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { majorAmountInput } from "./service-format"
import { timeZoneOptions } from "./service-request-ui"

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

const proposalSchema = z
  .object({
    amount: z.string().trim().min(1, "proposal_amount_invalid"),
    currency: z.string().min(3, "proposal_currency_invalid"),
    date: z.string().regex(DATE, "request_time_invalid"),
    time: z.string().regex(TIME, "request_time_invalid"),
    duration: z.string().regex(/^\d{1,4}$/, "proposal_duration_invalid"),
    timeZone: z.string().min(1, "request_time_zone_invalid"),
    locationMode: z.enum(["onsite", "remote"]),
    area: z.string().max(SERVICE_LOCATION_AREA_MAX_LENGTH, "proposal_location_invalid"),
    details: z.string().trim().min(2, "proposal_details_invalid").max(SERVICE_PROPOSAL_DETAILS_MAX_LENGTH, "proposal_details_invalid"),
    cancellationTerms: z.string().trim().min(2, "proposal_terms_invalid").max(SERVICE_CANCELLATION_TERMS_MAX_LENGTH, "proposal_terms_invalid"),
    deadlineDate: z.string().regex(DATE, "request_time_invalid"),
    deadlineTime: z.string().regex(TIME, "request_time_invalid"),
  })
  .refine((values) => values.locationMode === "remote" || values.area.trim().length >= 2, { message: "proposal_location_invalid", path: ["area"] })

type ProposalValues = z.infer<typeof proposalSchema>

/** Le champ qui porte un refus du domaine ; `null` : un refus de tout le formulaire. */
const FIELD_OF: Partial<Record<ActionErrorCode, FieldPath<ProposalValues>>> = {
  proposal_amount_invalid: "amount",
  proposal_amount_too_large: "amount",
  proposal_currency_invalid: "currency",
  proposal_duration_invalid: "duration",
  proposal_start_invalid: "time",
  request_time_nonexistent: "time",
  request_time_ambiguous: "time",
  request_time_invalid: "time",
  request_time_zone_invalid: "timeZone",
  proposal_location_invalid: "area",
  proposal_details_invalid: "details",
  proposal_terms_invalid: "cancellationTerms",
  proposal_deadline_invalid: "deadlineTime",
}

/** Le début et l'échéance, en heure murale du fuseau : une échéance à deux jours au plus, avant le début. */
function slotValues(startAt: number | null, timeZone: string, now: number): Pick<ProposalValues, "date" | "time" | "deadlineDate" | "deadlineTime"> {
  const start = startAt === null ? null : utcToZonedWallTime(startAt, timeZone)
  const deadline = utcToZonedWallTime(Math.min(now + 2 * DAY_MS, startAt ?? now + 2 * DAY_MS), timeZone)
  return { date: start?.date ?? "", time: start?.time ?? "", deadlineDate: deadline?.date ?? "", deadlineTime: deadline?.time ?? "" }
}

/** Une durée d'offre ramenée dans les bornes d'un créneau ; sans durée annoncée, une heure. */
function durationValue(minutes: number | null): string {
  return String(minutes === null ? 60 : Math.min(Math.max(minutes, SERVICE_SLOT_MIN_MINUTES), SERVICE_SLOT_MAX_MINUTES))
}

/**
 * SV-04 — les valeurs de départ : le créneau souhaité le plus proche ; le tarif,
 * la devise et la durée de l'offre (montant vide sur devis) ; son titre comme
 * contenu ; le fuseau, le lieu et les conditions de ses réglages, sinon la ville
 * de l'offre (ou « à distance » pour une offre à distance seulement).
 */
export function proposalStartValues(input: {
  readonly windows: readonly ServiceWindow[]
  readonly viewerTimeZone: string
  readonly now: number
  readonly prefill: ServiceProposalPrefillView | null
  readonly offerTitle: string
}): ProposalValues {
  const { prefill, now } = input
  const timeZone = prefill?.settings.timeZone ?? input.viewerTimeZone
  const first = input.windows.find((window) => window.startAt > now) ?? input.windows[0]
  const pricing = prefill?.pricing ?? null
  const priced = pricing !== null && pricing.mode !== "quote" ? pricing : null
  const location = prefill?.settings.location ?? (prefill?.delivery === "remote" ? ({ mode: "remote" } as const) : null)
  return {
    amount: priced ? majorAmountInput(priced.amountMinor, priced.currency) : "",
    currency: priced ? priced.currency : "EUR",
    ...slotValues(first ? first.startAt : null, timeZone, now),
    duration: durationValue(prefill ? prefill.durationMinutes : null),
    timeZone,
    locationMode: location?.mode ?? "onsite",
    area: location?.mode === "onsite" ? location.area : (prefill?.city ?? ""),
    details: input.offerTitle.slice(0, SERVICE_PROPOSAL_DETAILS_MAX_LENGTH),
    cancellationTerms: prefill?.settings.cancellationTerms ?? "",
  }
}

/** SV-04 — « Reprendre la version précédente » : ses conditions, son créneau, une échéance recalculée. */
export function proposalValuesFrom(previous: ServiceProposalView, now: number): ProposalValues {
  const money = majorAmountInput(previous.amountMinor, previous.currency)
  return {
    amount: money,
    currency: previous.currency,
    ...slotValues(previous.startAt, previous.timeZone, now),
    duration: String(previous.durationMinutes),
    timeZone: previous.timeZone,
    locationMode: previous.location.mode,
    area: previous.location.mode === "onsite" ? previous.location.area : "",
    details: previous.details,
    cancellationTerms: previous.cancellationTerms,
  }
}

export function ServiceProposalForm(props: {
  readonly capability: ServiceRequestsCapability
  readonly requestId: string
  /** La version courante lue (zéro avant toute proposition). */
  readonly expectedVersion: number
  readonly windows: readonly ServiceWindow[]
  readonly viewerTimeZone: string
  /** SV-04 : ce que l'offre et ses réglages préremplissent ; `null` (ou absent) : formulaire vierge. */
  readonly prefill?: ServiceProposalPrefillView | null
  /** Le titre de l'offre demandée, repris comme contenu de la prestation. */
  readonly offerTitle?: string
  /** SV-04 : la dernière version envoyée, que « Reprendre la version précédente » recopie. */
  readonly previous?: ServiceProposalView | null
  readonly onDone: () => void
  readonly onCancel: () => void
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const [now] = useState(() => Date.now())
  const [startValues] = useState(() => proposalStartValues({ windows: props.windows, viewerTimeZone: props.viewerTimeZone, now, prefill: props.prefill ?? null, offerTitle: props.offerTitle ?? "" }))
  const previous = props.previous ?? null
  // Le fuseau prérempli ou celui de la version précédente reste choisissable, même hors de la liste du navigateur.
  const zones = useMemo(
    () => [...new Set([startValues.timeZone, ...(previous ? [previous.timeZone] : []), ...timeZoneOptions(props.viewerTimeZone)])],
    [startValues.timeZone, previous, props.viewerTimeZone],
  )
  const form = useForm<ProposalValues>({ resolver: zodResolver(proposalSchema), defaultValues: startValues })
  const [formError, setFormError] = useState<ActionErrorCode | null>(null)
  const locked = useRef(false)
  const locationMode = useWatch({ control: form.control, name: "locationMode" })
  const errors = form.formState.errors
  const message = (code: string | undefined) => (code ? t(`errors.${code}`) : undefined)

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
    const money = parseMajorAmount(values.amount, values.currency)
    if (!money.ok) return refuse(money.code === "currency_invalid" ? "proposal_currency_invalid" : money.code === "amount_too_large" ? "proposal_amount_too_large" : "proposal_amount_invalid")
    const input = {
      requestId: props.requestId,
      expectedVersion: props.expectedVersion,
      amountMinor: money.value.amountMinor,
      currency: money.value.currency,
      durationMinutes: Number(values.duration),
      startAt: startAt.value,
      timeZone: values.timeZone,
      location: values.locationMode === "remote" ? ({ mode: "remote" } as const) : ({ mode: "onsite", area: values.area } as const),
      details: values.details,
      cancellationTerms: values.cancellationTerms,
      expiresAt: expiresAt.value,
    }
    // Les règles du domaine d'abord : un refus se montre au champ, sans aller-retour.
    const checked = parseServiceProposal(input, Date.now())
    if (!checked.ok) {
      const textField = checked.code === "request_contact_forbidden" || checked.code === "request_address_forbidden"
        ? (["area", "details", "cancellationTerms"] as const).find((field) => serviceTextRefusal(values[field]) !== null)
        : undefined
      if (textField) return form.setError(textField, { message: checked.code })
      return refuse(checked.code)
    }
    try {
      const result = await props.capability.propose(input)
      if (result.ok) {
        toast.success(t("serviceRequests.form.sent", { version: result.value.version }))
        props.onDone()
      } else refuse(result.code)
    } catch {
      setFormError("unknown")
    }
  })

  /** Une proposition à la fois : un double clic n'envoie pas deux versions. */
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
    <form noValidate className="flex min-w-0 flex-col gap-4" onSubmit={submit} aria-describedby={`${id}-rappel`}>
      <p id={`${id}-rappel`} className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("serviceRequests.form.reminder")}</p>
      {props.prefill || previous ? (
        <div className="flex min-w-0 flex-col items-start gap-2">
          {props.prefill ? <p className="text-[13px] text-muted-foreground">{t("serviceProposalSettings.form.prefilled")}</p> : null}
          {previous ? (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { setFormError(null); form.reset(proposalValuesFrom(previous, Date.now())) }}>
              {t("serviceProposalSettings.form.reusePrevious", { version: previous.version })}
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field id={`${id}-montant`} label={t("serviceRequests.form.amount")} hint={t("serviceRequests.form.amountHint")} error={message(errors.amount?.message)}>
          {(field) => <Input id={field.id} inputMode="decimal" autoComplete="off" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("amount")} />}
        </Field>
        <Field id={`${id}-devise`} label={t("serviceRequests.form.currency")} error={message(errors.currency?.message)}>
          {(field) => (
            <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px]" {...form.register("currency")}>
              {CURRENCY_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          )}
        </Field>
        <Field id={`${id}-date`} label={t("serviceRequests.form.date")} error={message(errors.date?.message)}>
          {(field) => <Input id={field.id} type="date" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("date")} />}
        </Field>
        <Field id={`${id}-heure`} label={t("serviceRequests.form.time")} error={message(errors.time?.message)}>
          {(field) => <Input id={field.id} type="time" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("time")} />}
        </Field>
        <Field id={`${id}-duree`} label={t("serviceRequests.form.duration")} hint={t("serviceRequests.form.durationHint", { min: SERVICE_SLOT_MIN_MINUTES, max: SERVICE_SLOT_MAX_MINUTES })} error={message(errors.duration?.message)}>
          {(field) => <Input id={field.id} type="number" inputMode="numeric" min={SERVICE_SLOT_MIN_MINUTES} max={SERVICE_SLOT_MAX_MINUTES} step={5} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("duration")} />}
        </Field>
        <Field id={`${id}-fuseau`} label={t("serviceRequests.form.timeZone")} hint={t("serviceRequests.form.timeZoneHint")} error={message(errors.timeZone?.message)}>
          {(field) => (
            <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} className="h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-[15px]" {...form.register("timeZone")}>
              {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          )}
        </Field>
      </div>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="text-sm font-medium">{t("serviceRequests.form.location")}</legend>
        <label className="flex items-center gap-2 text-[15px]">
          <input type="radio" value="onsite" disabled={busy} {...form.register("locationMode")} />
          {t("serviceRequests.form.onsite")}
        </label>
        <label className="flex items-center gap-2 text-[15px]">
          <input type="radio" value="remote" disabled={busy} {...form.register("locationMode")} />
          {t("serviceRequests.form.remote")}
        </label>
      </fieldset>
      {locationMode === "onsite" ? (
        <Field id={`${id}-lieu`} label={t("serviceRequests.form.area")} hint={t("serviceRequests.form.areaHint")} error={message(errors.area?.message)}>
          {(field) => <Input id={field.id} autoComplete="off" maxLength={SERVICE_LOCATION_AREA_MAX_LENGTH} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("area")} />}
        </Field>
      ) : null}

      <Field id={`${id}-contenu`} label={t("serviceRequests.form.details")} hint={t("serviceRequests.form.detailsHint")} error={message(errors.details?.message)}>
        {(field) => <Textarea id={field.id} rows={3} maxLength={SERVICE_PROPOSAL_DETAILS_MAX_LENGTH} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("details")} />}
      </Field>
      <Field id={`${id}-conditions`} label={t("serviceRequests.form.terms")} hint={t("serviceRequests.form.termsHint")} error={message(errors.cancellationTerms?.message)}>
        {(field) => <Textarea id={field.id} rows={2} maxLength={SERVICE_CANCELLATION_TERMS_MAX_LENGTH} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("cancellationTerms")} />}
      </Field>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field id={`${id}-echeance-date`} label={t("serviceRequests.form.deadlineDate")} hint={t("serviceRequests.form.deadlineHint")} error={message(errors.deadlineDate?.message)}>
          {(field) => <Input id={field.id} type="date" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("deadlineDate")} />}
        </Field>
        <Field id={`${id}-echeance-heure`} label={t("serviceRequests.form.deadlineTime")} error={message(errors.deadlineTime?.message)}>
          {(field) => <Input id={field.id} type="time" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("deadlineTime")} />}
        </Field>
      </div>
      {formError ? <p role="alert" className="text-sm font-medium text-destructive">{t(`errors.${formError}`)}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="send" disabled={busy} aria-busy={busy}>{t(busy ? "serviceRequests.form.sending" : "serviceRequests.form.submit")}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={props.onCancel}>{t("serviceRequests.sheet.back")}</Button>
      </div>
    </form>
  )
}
