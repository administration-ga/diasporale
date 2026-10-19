"use client"

/**
 * L'onglet « Recours » du guichet de modération (PD6 · G9) : les recours du
 * réseau à examiner, réservés à l'administration du réseau, filtrés par pays
 * de la cible et par nature. Chaque recours montre la décision contestée et
 * son motif, ses mesures, le motif de la personne qui conteste ; l'examen se
 * fait dans une feuille, motif obligatoire, et l'annulation (mesures levées,
 * contenu rétabli s'il avait été retiré) passe par une confirmation.
 * L'ancien décideur et la personne qui conteste n'examinent pas le recours.
 * PROPRIÉTAIRE : chantier « modération par pays ».
 */
import { Button, Card, EmptyState, RadioCard, RadioGroup, Sheet, SheetContent } from "@diasporale/features"
import {
  deskZoneFromKey,
  type ActionErrorCode,
  type DeskAppealView,
  type DeskSurface,
  type ModerationDeskCapability,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { ScaleIcon } from "lucide-react"
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import {
  DESK_ERROR_VALUES,
  DeskConfirmStep,
  DeskCountry,
  DeskErrorLine,
  DeskPartyNotice,
  DeskReasonField,
  DeskSurfaceSelect,
  DeskZoneSelect,
  deskDateTime,
  deskList,
  useDeskLabels,
  useMounted,
} from "./moderation-desk-parts"
import { ServicePager } from "./service-pager"

const appealSchema = z.object({
  outcome: z.enum(["uphold", "overturn"], { errorMap: () => ({ message: "moderation_desk_outcome_required" }) }),
  reason: z.string().trim().min(DESK_ERROR_VALUES.min, "moderation_desk_reason_length").max(DESK_ERROR_VALUES.max, "moderation_desk_reason_length"),
})
type AppealValues = z.infer<typeof appealSchema>

export function ModerationDeskAppeals(props: { readonly desk: ModerationDeskCapability; readonly personId: string }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const statusLine = useRef<HTMLParagraphElement>(null)
  const [zoneKey, setZoneKey] = useState("all")
  const [surface, setSurface] = useState<DeskSurface | null>(null)
  const [opened, setOpened] = useState<DeskAppealView | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [focusRequest, setFocusRequest] = useState(0)
  const zone = useMemo(() => deskZoneFromKey(zoneKey), [zoneKey])
  const narrowed = zoneKey !== "all" || surface !== null
  const { desk, personId } = props

  useEffect(() => {
    if (focusRequest === 0) return
    const timer = setTimeout(() => statusLine.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [focusRequest])

  return (
    <section aria-labelledby={`${id}-titre`} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-titre`} className="font-display text-xl font-bold">{t("moderationDesk.appeals.title")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("moderationDesk.appeals.lead")}</p>
      </div>
      <div role="group" aria-label={t("moderationDesk.filters.label")} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <DeskZoneSelect id={`${id}-pays`} value={zoneKey} onChange={setZoneKey} />
        <DeskSurfaceSelect id={`${id}-nature`} value={surface} onChange={setSurface} />
      </div>
      {status !== null ? (
        <p ref={statusLine} tabIndex={-1} role="status" className="rounded-xl bg-muted p-3 text-sm focus-visible:shadow-focus">{status}</p>
      ) : null}
      <ServicePager<DeskAppealView>
        key={`${zoneKey}:${surface ?? "*"}`}
        read={(cursor) => desk.useAppeals({ personId, zone, surface, cursor })}
        keyOf={(row) => row.appealId}
        empty={
          <EmptyState
            icon={<ScaleIcon />}
            title={t(narrowed ? "moderationDesk.appeals.emptyFilteredTitle" : "moderationDesk.appeals.emptyTitle")}
            description={t("moderationDesk.appeals.emptyBody")}
          />
        }
      >
        {(rows) => (
          <ul className="flex min-w-0 flex-col gap-3">
            {rows.map((row) => <AppealCard key={row.appealId} row={row} onOpen={() => setOpened(row)} />)}
          </ul>
        )}
      </ServicePager>
      <AppealSheet
        desk={desk}
        personId={personId}
        row={opened}
        onClose={() => setOpened(null)}
        onDecided={(overturn) => {
          setOpened(null)
          setStatus(t(overturn ? "moderationDesk.appeals.doneOverturned" : "moderationDesk.appeals.doneUpheld"))
          setFocusRequest((value) => value + 1)
        }}
      />
    </section>
  )
}

/** La décision contestée, telle que l'équipe l'a motivée. */
function AppealFacts(props: { readonly row: DeskAppealView }) {
  const { t, locale } = useDiasporaleT()
  const labels = useDeskLabels()
  const { row } = props
  const measures = row.sanctions.map((sanction) =>
    sanction.until === null ? labels.sanction(sanction.kind) : t("moderationDesk.appeals.measureUntil", { measure: labels.sanction(sanction.kind), date: deskDateTime(sanction.until, locale) }),
  )
  return (
    <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2 text-sm">
      <dt className="text-muted-foreground">{t("moderationDesk.case.fact.ground")}</dt>
      <dd className="min-w-0 break-words">{labels.ground(row.ground)}</dd>
      {row.decidedAt !== null ? (
        <>
          <dt className="text-muted-foreground">{t("moderationDesk.appeals.decidedAt")}</dt>
          <dd className="min-w-0">{deskDateTime(row.decidedAt, locale)}</dd>
        </>
      ) : null}
      <dt className="text-muted-foreground">{t("moderationDesk.appeals.decisionReason")}</dt>
      <dd className="min-w-0 whitespace-pre-line break-words">{row.decisionReason ?? t("moderationDesk.appeals.noReason")}</dd>
      <dt className="text-muted-foreground">{t("moderationDesk.appeals.measures")}</dt>
      <dd className="min-w-0 break-words">{measures.length > 0 ? deskList(measures, locale) : t("moderationDesk.appeals.noMeasure")}</dd>
      <dt className="text-muted-foreground">{t("moderationDesk.appeals.appealReason")}</dt>
      <dd className="min-w-0 whitespace-pre-line break-words">{row.appealReason}</dd>
      <dt className="text-muted-foreground">{t("moderationDesk.appeals.filedAt")}</dt>
      <dd className="min-w-0">{deskDateTime(row.createdAt, locale)}</dd>
    </dl>
  )
}

function AppealCard(props: { readonly row: DeskAppealView; readonly onOpen: () => void }) {
  const { t } = useDiasporaleT()
  const labels = useDeskLabels()
  const titleId = useId()
  const { row } = props
  return (
    <li>
      <Card className="flex min-w-0 flex-col gap-3 p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 id={titleId} className="min-w-0 break-words font-semibold">{labels.surface(row.surface)}</h3>
          <DeskCountry country={row.country} />
        </div>
        <AppealFacts row={row} />
        {row.party !== null ? <p className="break-words text-xs text-muted-foreground">{labels.party(row.party)}</p> : null}
        <Button variant="outline" size="sm" className="self-start" aria-describedby={titleId} aria-haspopup="dialog" onClick={props.onOpen}>
          {t(row.party === null ? "moderationDesk.appeals.open" : "moderationDesk.case.view")}
        </Button>
      </Card>
    </li>
  )
}

function AppealSheet(props: {
  readonly desk: ModerationDeskCapability
  readonly personId: string
  readonly row: DeskAppealView | null
  readonly onClose: () => void
  readonly onDecided: (overturn: boolean) => void
}) {
  const { t } = useDiasporaleT()
  const labels = useDeskLabels()
  const busy = useRef(false)
  const { row } = props
  return (
    <Sheet open={row !== null} onOpenChange={(open) => { if (!open && !busy.current) props.onClose() }}>
      {row ? (
        <SheetContent
          title={t("moderationDesk.appeals.sheetTitle", { surface: labels.surface(row.surface) })}
          description={t("moderationDesk.appeals.sheetDescription")}
          closeLabel={t("common.close")}
        >
          <div className="flex min-w-0 flex-col gap-4">
            <AppealFacts row={row} />
            {row.party !== null ? (
              <DeskPartyNotice party={row.party} />
            ) : (
              <AppealForm
                key={row.appealId}
                desk={props.desk}
                personId={props.personId}
                appealId={row.appealId}
                onBusyChange={(value) => { busy.current = value }}
                onDecided={props.onDecided}
              />
            )}
          </div>
        </SheetContent>
      ) : null}
    </Sheet>
  )
}

function AppealForm(props: {
  readonly desk: ModerationDeskCapability
  readonly personId: string
  readonly appealId: string
  readonly onBusyChange: (busy: boolean) => void
  readonly onDecided: (overturn: boolean) => void
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const mounted = useMounted()
  const locked = useRef(false)
  const errorLine = useRef<HTMLParagraphElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const [confirming, setConfirming] = useState<AppealValues | null>(null)
  const form = useForm<AppealValues>({ resolver: zodResolver(appealSchema), defaultValues: { reason: "" } })
  const errors = form.formState.errors

  useLayoutEffect(() => {
    if (error !== null) errorLine.current?.focus()
  }, [error])

  const send = async (values: AppealValues) => {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    props.onBusyChange(true)
    setError(null)
    try {
      const overturn = values.outcome === "overturn"
      const result = await props.desk.decideAppeal({ personId: props.personId, appealId: props.appealId, overturn, reason: values.reason })
      if (!mounted.current) return
      if (!result.ok) {
        setConfirming(null)
        setError(result.code)
        return
      }
      props.onBusyChange(false)
      props.onDecided(overturn)
    } catch {
      if (mounted.current) setError("unknown")
    } finally {
      locked.current = false
      props.onBusyChange(false)
      if (mounted.current) setBusy(false)
    }
  }

  const submit = async (values: AppealValues) => {
    // Annuler la décision lève ses mesures et rétablit le contenu : une confirmation explicite d'abord.
    if (values.outcome === "overturn") {
      setError(null)
      setConfirming(values)
      return
    }
    await send(values)
  }

  const disabled = busy || confirming !== null
  return (
    <form noValidate onSubmit={(event) => void form.handleSubmit(submit)(event)} className="flex min-w-0 flex-col gap-4 border-t border-border pt-4">
      <h3 className="font-semibold">{t("moderationDesk.appeals.decisionTitle")}</h3>
      <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <p id={`${id}-issue`} className="text-sm font-medium">{t("moderationDesk.appeals.outcomeLegend")}</p>
          <Controller
            control={form.control}
            name="outcome"
            render={({ field }) => (
              <RadioGroup
                aria-labelledby={`${id}-issue`}
                value={field.value ?? ""}
                onValueChange={(value) => field.onChange(value === "uphold" || value === "overturn" ? value : undefined)}
              >
                <RadioCard value="uphold">
                  <span className="block font-medium">{t("moderationDesk.appeals.uphold")}</span>
                  <span className="block text-[13px] text-muted-foreground">{t("moderationDesk.appeals.upholdHint")}</span>
                </RadioCard>
                <RadioCard value="overturn">
                  <span className="block font-medium">{t("moderationDesk.appeals.overturn")}</span>
                  <span className="block text-[13px] text-muted-foreground">{t("moderationDesk.appeals.overturnHint")}</span>
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
          confirmLabel={t("moderationDesk.confirm.overturn")}
          busy={busy}
          onConfirm={() => void send(confirming)}
          onBack={() => setConfirming(null)}
        >
          <p>{t("moderationDesk.confirm.overturnBody")}</p>
        </DeskConfirmStep>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>{busy ? t("common.pleaseWait") : t("moderationDesk.appeals.submit")}</Button>
        </div>
      )}
    </form>
  )
}
