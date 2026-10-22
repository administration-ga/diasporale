"use client"

/**
 * Le détail d'un dossier du guichet (PD6 · G9), dans une feuille : la file
 * reste en place derrière elle, à la même position, et le focus revient au
 * dossier ouvert à la fermeture.
 *
 *  · un signalement : nature, pays de la cible, motif, ouverture, niveau, délai
 *    légal s'il a été ouvert depuis la voie des délais (SU01d), aperçu borné du
 *    moteur, décisions antérieures sur la même cible, puis la décision MOTIVÉE
 *    (classer, ou prendre des mesures choisies une à une) ;
 *  · un contenu en relecture préalable : aperçu, puis approuver ou refuser,
 *    motif obligatoire.
 * Une mesure lourde (suspension, exclusion, retrait d'une page ou d'un compte)
 * passe par une étape de confirmation explicite. Une personne partie au
 * dossier ne voit aucun formulaire. Le moteur reste l'autorité : il relit la
 * compétence, journalise la décision et prévient l'auteur.
 * PROPRIÉTAIRE : chantier « modération par pays ».
 */
import { Button, Checkbox, Label, RadioCard, RadioGroup, Sheet, SheetContent, Skeleton } from "@diasporale/features"
import {
  DESK_DECISIONS,
  DESK_DURATION_DAYS,
  DESK_PERSON_MEASURES,
  DESK_REASON_MAX,
  DESK_REASON_MIN,
  isDeskDuration,
  isHeavyDecision,
  isHeavyPendingRejection,
  isTimedMeasure,
  type ActionErrorCode,
  type DeskCaseView,
  type DeskDeadlineView,
  type DeskDecision,
  type DeskHistoryEntry,
  type DeskMeasureChoice,
  type DeskPendingView,
  type DeskSurface,
  type ModerationDeskCapability,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useLayoutEffect, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { DeskCaseDeadline } from "./moderation-desk-deadlines"
import {
  DESK_ERROR_VALUES,
  DeskConfirmStep,
  DeskCountry,
  DeskErrorLine,
  DeskPartyNotice,
  DeskPreview,
  DeskReasonField,
  deskDateTime,
  deskList,
  deskSelectClass,
  useDeskLabels,
  useMounted,
} from "./moderation-desk-parts"

/** Le dossier ouvert : depuis la file ordinaire, ou depuis la voie des délais légaux avec son délai. */
export interface DeskCaseOpening {
  readonly reportId: string
  readonly surface: DeskSurface
  readonly deadline: DeskDeadlineView | null
}

const reasonSchema = z.string().trim().min(DESK_REASON_MIN, "moderation_desk_reason_length").max(DESK_REASON_MAX, "moderation_desk_reason_length")

const decisionSchema = z
  .object({
    decision: z.enum(DESK_DECISIONS, { errorMap: () => ({ message: "moderation_desk_outcome_required" }) }),
    removal: z.boolean(),
    personMeasure: z.enum(DESK_PERSON_MEASURES),
    durationDays: z.string(),
    reason: reasonSchema,
  })
  .superRefine((values, context) => {
    if (values.decision !== "actioned") return
    if (!values.removal && values.personMeasure === "none") {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["personMeasure"], message: "moderation_desk_measure_required" })
    }
    if (isTimedMeasure(values.personMeasure) && !isDeskDuration(Number(values.durationDays))) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["durationDays"], message: "moderation_desk_duration_required" })
    }
  })
type DecisionValues = z.infer<typeof decisionSchema>

const pendingSchema = z.object({
  outcome: z.enum(["approve", "reject"], { errorMap: () => ({ message: "moderation_desk_outcome_required" }) }),
  reason: reasonSchema,
})
type PendingValues = z.infer<typeof pendingSchema>

/** Le choix du formulaire, tel que le port le reçoit : des mesures seulement pour une décision suivie d'effet. */
function choiceOf(values: DecisionValues, hasAuthor: boolean): DeskMeasureChoice {
  const actioned = values.decision === "actioned"
  const personMeasure = actioned && hasAuthor ? values.personMeasure : "none"
  const days = Number(values.durationDays)
  return {
    decision: values.decision,
    removal: actioned && values.removal,
    personMeasure,
    durationDays: isTimedMeasure(personMeasure) && isDeskDuration(days) ? days : null,
  }
}

/** Le résumé des mesures, dans la langue de l'écran. */
function useMeasureSummary() {
  const { t, locale } = useDiasporaleT()
  const labels = useDeskLabels()
  return (choice: DeskMeasureChoice): string => {
    const parts: string[] = []
    if (choice.removal) parts.push(labels.sanction("removal"))
    if (choice.personMeasure !== "none") {
      const label = labels.sanction(choice.personMeasure)
      parts.push(choice.durationDays === null ? label : t("moderationDesk.decision.measureFor", { measure: label, count: choice.durationDays }))
    }
    return deskList(parts, locale)
  }
}

// ── Signalement ────────────────────────────────────────────────────────────

export function ModerationDeskCaseSheet(props: {
  readonly desk: ModerationDeskCapability
  readonly personId: string
  /** Le dossier ouvert depuis la file ou la voie des délais légaux ; `null` : feuille fermée. */
  readonly row: DeskCaseOpening | null
  readonly onClose: () => void
  readonly onDecided: (status: DeskDecision) => void
}) {
  const { t } = useDiasporaleT()
  const labels = useDeskLabels()
  const busy = useRef(false)
  const { row } = props
  return (
    <Sheet open={row !== null} onOpenChange={(open) => { if (!open && !busy.current) props.onClose() }}>
      {row ? (
        <SheetContent
          title={t("moderationDesk.case.title", { surface: labels.surface(row.surface) })}
          description={t("moderationDesk.case.description")}
          closeLabel={t("common.close")}
        >
          <CaseBody
            key={row.reportId}
            desk={props.desk}
            personId={props.personId}
            reportId={row.reportId}
            deadline={row.deadline}
            onBusyChange={(value) => { busy.current = value }}
            onDecided={props.onDecided}
          />
        </SheetContent>
      ) : null}
    </Sheet>
  )
}

function CaseBody(props: {
  readonly desk: ModerationDeskCapability
  readonly personId: string
  readonly reportId: string
  readonly deadline: DeskDeadlineView | null
  readonly onBusyChange: (busy: boolean) => void
  readonly onDecided: (status: DeskDecision) => void
}) {
  const { t } = useDiasporaleT()
  const detail = props.desk.useCase({ personId: props.personId, reportId: props.reportId })
  const preview = props.desk.useCasePreview({ personId: props.personId, reportId: props.reportId })
  if (detail.status === "loading") {
    return (
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">{t("moderationDesk.loading")}</span>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }
  if (detail.status === "error") {
    return detail.code === "not_found"
      ? <p role="alert" className="rounded-xl bg-muted p-4 text-sm">{t("moderationDesk.case.closed")}</p>
      : <DeskErrorLine code={detail.code} />
  }
  const view = detail.data.case
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CaseFacts view={view} />
      {props.deadline !== null ? <DeskCaseDeadline deadline={props.deadline} /> : null}
      <DeskPreview preview={preview} />
      <CaseHistory history={detail.data.history} more={detail.data.historyMore} />
      {view.party !== null ? (
        <DeskPartyNotice party={view.party} />
      ) : (
        <DecisionForm
          desk={props.desk}
          personId={props.personId}
          reportId={view.reportId}
          surface={view.surface}
          hasAuthor={view.hasAuthor}
          onBusyChange={props.onBusyChange}
          onDecided={props.onDecided}
        />
      )}
    </div>
  )
}

function CaseFacts(props: { readonly view: DeskCaseView }) {
  const { t, locale } = useDiasporaleT()
  const labels = useDeskLabels()
  const { view } = props
  return (
    <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2 text-sm">
      <dt className="text-muted-foreground">{t("moderationDesk.case.fact.surface")}</dt>
      <dd className="min-w-0 break-words font-medium">{labels.surface(view.surface)}</dd>
      <dt className="text-muted-foreground">{t("moderationDesk.case.fact.country")}</dt>
      <dd className="min-w-0"><DeskCountry country={view.country} /></dd>
      <dt className="text-muted-foreground">{t("moderationDesk.case.fact.ground")}</dt>
      <dd className="min-w-0 break-words">{labels.ground(view.ground)}</dd>
      <dt className="text-muted-foreground">{t("moderationDesk.case.fact.opened")}</dt>
      <dd className="min-w-0">{deskDateTime(view.createdAt, locale)}</dd>
      <dt className="text-muted-foreground">{t("moderationDesk.case.fact.level")}</dt>
      <dd className="min-w-0 break-words">{labels.level(view.level, view.teamName)}</dd>
      {view.status === "reviewing" ? (
        <>
          <dt className="text-muted-foreground">{t("moderationDesk.case.fact.status")}</dt>
          <dd className="min-w-0">{t("moderationDesk.case.reviewing")}</dd>
        </>
      ) : null}
    </dl>
  )
}

function CaseHistory(props: { readonly history: readonly DeskHistoryEntry[]; readonly more: boolean }) {
  const { t, locale } = useDiasporaleT()
  const labels = useDeskLabels()
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-2">
      <h3 id={id} className="text-sm font-semibold">{t("moderationDesk.history.title")}</h3>
      {props.history.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("moderationDesk.history.empty")}</p>
      ) : (
        <ul className="flex min-w-0 flex-col gap-2">
          {props.history.map((entry, index) => (
            <li key={`${entry.decidedAt ?? 0}-${index}`} className="flex min-w-0 flex-col gap-1 rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">
                {t(`moderationDesk.history.status.${entry.status}`)} · {t(`moderationDesk.history.origin.${entry.origin}`)}
                {entry.decidedAt !== null ? <> · {deskDateTime(entry.decidedAt, locale)}</> : null}
              </p>
              {entry.decisionReason ? (
                <p className="whitespace-pre-line break-words text-muted-foreground">{t("moderationDesk.history.reason", { reason: entry.decisionReason })}</p>
              ) : null}
              {entry.sanctions.length > 0 ? (
                <p className="break-words">{t("moderationDesk.history.measures", { list: deskList(entry.sanctions.map(labels.sanction), locale) })}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {props.more ? <p className="text-[13px] text-muted-foreground">{t("moderationDesk.history.more")}</p> : null}
    </section>
  )
}

function DecisionForm(props: {
  readonly desk: ModerationDeskCapability
  readonly personId: string
  readonly reportId: string
  readonly surface: DeskSurface
  readonly hasAuthor: boolean
  readonly onBusyChange: (busy: boolean) => void
  readonly onDecided: (status: DeskDecision) => void
}) {
  const { t } = useDiasporaleT()
  const labels = useDeskLabels()
  const summary = useMeasureSummary()
  const id = useId()
  const mounted = useMounted()
  const locked = useRef(false)
  const errorLine = useRef<HTMLParagraphElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const [confirming, setConfirming] = useState<{ readonly choice: DeskMeasureChoice; readonly reason: string } | null>(null)
  const form = useForm<DecisionValues>({
    resolver: zodResolver(decisionSchema),
    defaultValues: { removal: false, personMeasure: "none", durationDays: "", reason: "" },
  })
  const decision = form.watch("decision")
  const personMeasure = form.watch("personMeasure")
  const errors = form.formState.errors

  useLayoutEffect(() => {
    if (error !== null) errorLine.current?.focus()
  }, [error])

  const send = async (choice: DeskMeasureChoice, reason: string) => {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    props.onBusyChange(true)
    setError(null)
    try {
      const result = await props.desk.decide({ personId: props.personId, reportId: props.reportId, reason, ...choice })
      if (!mounted.current) return
      if (!result.ok) {
        setConfirming(null)
        setError(result.code)
        return
      }
      props.onBusyChange(false)
      props.onDecided(result.value.status)
    } catch {
      if (mounted.current) setError("unknown")
    } finally {
      locked.current = false
      props.onBusyChange(false)
      if (mounted.current) setBusy(false)
    }
  }

  const submit = async (values: DecisionValues) => {
    const choice = choiceOf(values, props.hasAuthor)
    if (isHeavyDecision(choice, props.surface)) {
      setError(null)
      setConfirming({ choice, reason: values.reason })
      return
    }
    await send(choice, values.reason)
  }

  const disabled = busy || confirming !== null
  return (
    <form noValidate onSubmit={(event) => void form.handleSubmit(submit)(event)} className="flex min-w-0 flex-col gap-4 border-t border-border pt-4">
      <h3 className="font-semibold">{t("moderationDesk.decision.title")}</h3>
      <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <p id={`${id}-issue`} className="text-sm font-medium">{t("moderationDesk.decision.outcomeLegend")}</p>
          <Controller
            control={form.control}
            name="decision"
            render={({ field }) => (
              <RadioGroup
                aria-labelledby={`${id}-issue`}
                aria-describedby={errors.decision ? `${id}-issue-erreur` : undefined}
                value={field.value ?? ""}
                onValueChange={(value) => field.onChange(DESK_DECISIONS.find((item) => item === value))}
              >
                {DESK_DECISIONS.map((item) => (
                  <RadioCard key={item} value={item}>
                    <span className="block font-medium">{t(`moderationDesk.decision.outcome.${item}`)}</span>
                    <span className="block text-[13px] text-muted-foreground">{t(`moderationDesk.decision.outcomeHint.${item}`)}</span>
                  </RadioCard>
                ))}
              </RadioGroup>
            )}
          />
          {errors.decision?.message ? (
            <p id={`${id}-issue-erreur`} role="alert" className="text-[13px] font-medium text-destructive">{t(`errors.${errors.decision.message}`)}</p>
          ) : null}
        </div>

        {decision === "actioned" ? (
          <div className="flex min-w-0 flex-col gap-4 rounded-xl bg-muted p-4">
            <p className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.decision.measuresLead")}</p>
            <div className="flex items-start gap-3">
              <Controller
                control={form.control}
                name="removal"
                render={({ field }) => (
                  <Checkbox id={`${id}-retrait`} checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} className="mt-0.5" />
                )}
              />
              <Label htmlFor={`${id}-retrait`} className="leading-snug">{t("moderationDesk.decision.removal")}</Label>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={`${id}-personne`} className="text-sm font-medium">{t("moderationDesk.decision.personMeasure")}</label>
              <select
                id={`${id}-personne`}
                className={deskSelectClass}
                disabled={disabled || !props.hasAuthor}
                aria-invalid={errors.personMeasure ? true : undefined}
                aria-describedby={`${id}-personne-aide`}
                {...form.register("personMeasure")}
              >
                {DESK_PERSON_MEASURES.map((measure) => (
                  <option key={measure} value={measure}>{measure === "none" ? t("moderationDesk.decision.personNone") : labels.sanction(measure)}</option>
                ))}
              </select>
              <p id={`${id}-personne-aide`} className="text-[13px] leading-snug text-muted-foreground">
                {t(props.hasAuthor ? "moderationDesk.decision.personHint" : "moderationDesk.decision.noAuthor")}
              </p>
              {errors.personMeasure?.message ? (
                <p role="alert" className="text-[13px] font-medium text-destructive">{t(`errors.${errors.personMeasure.message}`)}</p>
              ) : null}
            </div>
            {props.hasAuthor && isTimedMeasure(personMeasure) ? (
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor={`${id}-duree`} className="text-sm font-medium">{t("moderationDesk.decision.duration")}</label>
                <select id={`${id}-duree`} className={deskSelectClass} aria-invalid={errors.durationDays ? true : undefined} {...form.register("durationDays")}>
                  <option value="">{t("moderationDesk.decision.durationChoose")}</option>
                  {DESK_DURATION_DAYS.map((days) => (
                    <option key={days} value={String(days)}>{t("moderationDesk.decision.days", { count: days })}</option>
                  ))}
                </select>
                {errors.durationDays?.message ? (
                  <p role="alert" className="text-[13px] font-medium text-destructive">{t(`errors.${errors.durationDays.message}`)}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <DeskReasonField
          id={`${id}-motif`}
          label={t("moderationDesk.decision.reason")}
          hint={t("moderationDesk.decision.reasonHint", DESK_ERROR_VALUES)}
          error={errors.reason?.message}
          disabled={disabled}
          registration={form.register("reason")}
        />
      </fieldset>

      <DeskErrorLine code={error} line={errorLine} />

      {confirming ? (
        <DeskConfirmStep
          title={t("moderationDesk.confirm.title")}
          confirmLabel={t("moderationDesk.confirm.decide")}
          busy={busy}
          onConfirm={() => void send(confirming.choice, confirming.reason)}
          onBack={() => setConfirming(null)}
        >
          <p>{t("moderationDesk.confirm.measures", { list: summary(confirming.choice) })}</p>
          {confirming.choice.personMeasure === "suspension" || confirming.choice.personMeasure === "exclusion" ? (
            <p>{t("moderationDesk.confirm.everywhere")}</p>
          ) : null}
          <p className="text-muted-foreground">{t("moderationDesk.confirm.appeal")}</p>
        </DeskConfirmStep>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>{busy ? t("common.pleaseWait") : t("moderationDesk.decision.submit")}</Button>
        </div>
      )}
    </form>
  )
}

// ── Relecture préalable ────────────────────────────────────────────────────

export function ModerationDeskPendingSheet(props: {
  readonly desk: ModerationDeskCapability
  readonly personId: string
  readonly row: DeskPendingView | null
  readonly onClose: () => void
  readonly onReviewed: (approved: boolean) => void
}) {
  const { t } = useDiasporaleT()
  const labels = useDeskLabels()
  const busy = useRef(false)
  const { row } = props
  return (
    <Sheet open={row !== null} onOpenChange={(open) => { if (!open && !busy.current) props.onClose() }}>
      {row ? (
        <SheetContent
          title={t("moderationDesk.pending.title", { surface: labels.surface(row.targetKind) })}
          description={t("moderationDesk.pending.description")}
          closeLabel={t("common.close")}
        >
          <PendingBody key={row.key} desk={props.desk} personId={props.personId} row={row} onBusyChange={(value) => { busy.current = value }} onReviewed={props.onReviewed} />
        </SheetContent>
      ) : null}
    </Sheet>
  )
}

function PendingBody(props: {
  readonly desk: ModerationDeskCapability
  readonly personId: string
  readonly row: DeskPendingView
  readonly onBusyChange: (busy: boolean) => void
  readonly onReviewed: (approved: boolean) => void
}) {
  const { t, locale } = useDiasporaleT()
  const labels = useDeskLabels()
  const id = useId()
  const mounted = useMounted()
  const locked = useRef(false)
  const errorLine = useRef<HTMLParagraphElement>(null)
  const { row } = props
  const preview = props.desk.usePendingPreview({ personId: props.personId, targetKind: row.targetKind, targetId: row.targetId })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const [confirming, setConfirming] = useState<PendingValues | null>(null)
  const form = useForm<PendingValues>({ resolver: zodResolver(pendingSchema), defaultValues: { reason: "" } })
  const errors = form.formState.errors

  useLayoutEffect(() => {
    if (error !== null) errorLine.current?.focus()
  }, [error])

  const send = async (values: PendingValues) => {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    props.onBusyChange(true)
    setError(null)
    try {
      const approve = values.outcome === "approve"
      const result = await props.desk.reviewPending({ personId: props.personId, targetKind: row.targetKind, targetId: row.targetId, approve, reason: values.reason })
      if (!mounted.current) return
      if (!result.ok) {
        setConfirming(null)
        setError(result.code)
        return
      }
      props.onBusyChange(false)
      props.onReviewed(approve)
    } catch {
      if (mounted.current) setError("unknown")
    } finally {
      locked.current = false
      props.onBusyChange(false)
      if (mounted.current) setBusy(false)
    }
  }

  const submit = async (values: PendingValues) => {
    if (isHeavyPendingRejection(values.outcome === "approve", row.targetKind)) {
      setError(null)
      setConfirming(values)
      return
    }
    await send(values)
  }

  const disabled = busy || confirming !== null
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t("moderationDesk.case.fact.surface")}</dt>
        <dd className="min-w-0 break-words font-medium">{labels.surface(row.targetKind)}</dd>
        <dt className="text-muted-foreground">{t("moderationDesk.case.fact.country")}</dt>
        <dd className="min-w-0"><DeskCountry country={row.country} /></dd>
        <dt className="text-muted-foreground">{t("moderationDesk.pending.since")}</dt>
        <dd className="min-w-0">{deskDateTime(row.updatedAt, locale)}</dd>
        {row.teamName ? (
          <>
            <dt className="text-muted-foreground">{t("moderationDesk.case.fact.level")}</dt>
            <dd className="min-w-0 break-words">{t("moderationDesk.level.teamNamed", { name: row.teamName })}</dd>
          </>
        ) : null}
      </dl>
      <DeskPreview preview={preview} />
      {row.party !== null ? (
        <DeskPartyNotice party={row.party} />
      ) : (
        <form noValidate onSubmit={(event) => void form.handleSubmit(submit)(event)} className="flex min-w-0 flex-col gap-4 border-t border-border pt-4">
          <h3 className="font-semibold">{t("moderationDesk.pending.decisionTitle")}</h3>
          <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <p id={`${id}-issue`} className="text-sm font-medium">{t("moderationDesk.pending.outcomeLegend")}</p>
              <Controller
                control={form.control}
                name="outcome"
                render={({ field }) => (
                  <RadioGroup
                    aria-labelledby={`${id}-issue`}
                    value={field.value ?? ""}
                    onValueChange={(value) => field.onChange(value === "approve" || value === "reject" ? value : undefined)}
                  >
                    <RadioCard value="approve">
                      <span className="block font-medium">{t("moderationDesk.pending.approve")}</span>
                      <span className="block text-[13px] text-muted-foreground">{t("moderationDesk.pending.approveHint")}</span>
                    </RadioCard>
                    <RadioCard value="reject">
                      <span className="block font-medium">{t("moderationDesk.pending.reject")}</span>
                      <span className="block text-[13px] text-muted-foreground">{t("moderationDesk.pending.rejectHint")}</span>
                    </RadioCard>
                  </RadioGroup>
                )}
              />
              {errors.outcome?.message ? (
                <p role="alert" className="text-[13px] font-medium text-destructive">{t(`errors.${errors.outcome.message}`)}</p>
              ) : null}
            </div>
            <DeskReasonField
              id={`${id}-motif`}
              label={t("moderationDesk.decision.reason")}
              hint={t("moderationDesk.decision.reasonHint", DESK_ERROR_VALUES)}
              error={errors.reason?.message}
              disabled={disabled}
              registration={form.register("reason")}
            />
          </fieldset>
          <DeskErrorLine code={error} line={errorLine} />
          {confirming ? (
            <DeskConfirmStep
              title={t("moderationDesk.confirm.title")}
              confirmLabel={t("moderationDesk.confirm.reject")}
              busy={busy}
              onConfirm={() => void send(confirming)}
              onBack={() => setConfirming(null)}
            >
              <p>{t("moderationDesk.confirm.rejectBody", { surface: labels.surface(row.targetKind) })}</p>
              <p className="text-muted-foreground">{t("moderationDesk.confirm.appeal")}</p>
            </DeskConfirmStep>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>{busy ? t("common.pleaseWait") : t("moderationDesk.pending.submit")}</Button>
            </div>
          )}
        </form>
      )}
    </div>
  )
}
