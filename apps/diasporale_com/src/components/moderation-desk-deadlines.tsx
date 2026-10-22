"use client"

/**
 * La voie « Délais légaux » du guichet de modération (SU01d du moteur, ordonnance
 * n° 0011/PR/2026, art. 24, 32 et 33) : les dossiers à délai légal de la file lue
 * (réseau ou équipe), l'échéance la plus proche d'abord, chacun avec son fondement,
 * son chronomètre (reste ou retard), son échéance et l'état de son accusé de
 * réception. En tête de l'onglet « File », avant la file ordinaire, qui ne les
 * reprend pas ; ni le pays ni la nature ne la filtrent. Le temps de l'écran avance
 * seul (toutes les 30 s) ; la base n'est relue que par la lecture réactive. Comme
 * la file, la voie liste et ne compte rien.
 * PROPRIÉTAIRE : chantier « modération par pays ».
 */
import { Button, Card, Skeleton, cn } from "@diasporale/features"
import {
  DESK_DEADLINES_MAX,
  DESK_DEADLINES_ORDINANCE,
  deskCountdown,
  personalReportDelayHours,
  type DeskDeadlineLane,
  type DeskDeadlineView,
  type DeskLegalBasis,
  type Loadable,
  type ModerationDeskView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { CircleAlertIcon, TimerIcon } from "lucide-react"
import { useCallback, useId, useRef, type ReactNode } from "react"

import { deskDateTime, useDeskLabels, useFocusFallback } from "./moderation-desk-parts"
import { useNow } from "./service-request-ui"

/** Le délai légal d'un dossier : fondement, reste ou retard, échéance, accusé de réception. */
export function DeskDeadline(props: { readonly basis: DeskLegalBasis; readonly dueAt: number; readonly acknowledgedAt: number | null; readonly now: number }) {
  const { t, locale } = useDiasporaleT()
  const countdown = deskCountdown(props.dueAt, props.now)
  const duration = countdown.hours > 0
    ? t("moderationDesk.deadlines.hoursMinutes", { hours: countdown.hours, minutes: countdown.minutes })
    : t("moderationDesk.deadlines.minutes", { minutes: countdown.minutes })
  const Icon = countdown.overdue ? CircleAlertIcon : TimerIcon
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-lg border p-3 text-sm", countdown.overdue ? "border-destructive" : "border-border")}>
      <p className="break-words font-medium">{t(`moderationDesk.deadlines.basis.${props.basis}`, { hours: personalReportDelayHours(props.basis) })}</p>
      <p role="timer" className={cn("flex items-center gap-1.5 font-semibold", countdown.overdue && "text-destructive")}>
        <Icon aria-hidden className="size-4 shrink-0" />
        <span>{t(countdown.overdue ? "moderationDesk.deadlines.overdue" : "moderationDesk.deadlines.remaining", { duration })}</span>
      </p>
      <p className="text-muted-foreground">
        <time dateTime={new Date(props.dueAt).toISOString()}>{t("moderationDesk.deadlines.dueAt", { date: deskDateTime(props.dueAt, locale) })}</time>
      </p>
      <p className="text-muted-foreground">
        {props.acknowledgedAt !== null
          ? t("moderationDesk.deadlines.acknowledged", { date: deskDateTime(props.acknowledgedAt, locale) })
          : t("moderationDesk.deadlines.notAcknowledged")}
      </p>
    </div>
  )
}

/** Le délai légal d'un dossier ouvert depuis la voie, rappelé dans sa feuille ; l'horloge y avance aussi. */
export function DeskCaseDeadline(props: { readonly deadline: DeskDeadlineView }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const now = useNow()
  const { deadline } = props
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-2">
      <h3 id={id} className="text-sm font-semibold">{t("moderationDesk.deadlines.caseTitle")}</h3>
      <DeskDeadline basis={deadline.basis} dueAt={deadline.dueAt} acknowledgedAt={deadline.acknowledgedAt} now={now} />
    </section>
  )
}

export function ModerationDeskDeadlines(props: {
  readonly lane: Loadable<DeskDeadlineLane>
  readonly view: ModerationDeskView
  readonly onOpen: (row: DeskDeadlineView) => void
  /** Le message d'issue d'une décision prise depuis la voie. */
  readonly notice: ReactNode
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const now = useNow()
  /** Un dossier tranché pendant que son bouton avait le focus : le focus revient au titre de la voie. */
  const focusLane = useCallback(() => heading.current?.focus(), [])
  const teamName = (teamId: string | null) => props.view.teams.find((team) => team.teamId === teamId)?.name ?? null
  const { lane } = props

  let content: ReactNode
  if (lane.status === "loading") {
    content = (
      <div role="status">
        <span className="sr-only">{t("moderationDesk.deadlines.loading")}</span>
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  } else if (lane.status === "error") {
    content = <Card role="alert" className="p-4 text-sm">{t("moderationDesk.deadlines.error")}</Card>
  } else if (lane.data.items.length === 0) {
    content = <p role="status" className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("moderationDesk.deadlines.empty")}</p>
  } else {
    content = (
      <>
        <ul className="flex min-w-0 flex-col gap-3">
          {lane.data.items.map((row) => (
            <DeadlineCard key={row.reportId} row={row} teamName={teamName(row.teamId)} now={now} onOpen={() => props.onOpen(row)} onGone={focusLane} />
          ))}
        </ul>
        {lane.data.truncated ? <p className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.deadlines.truncated", { max: DESK_DEADLINES_MAX })}</p> : null}
      </>
    )
  }

  return (
    <section aria-labelledby={`${id}-titre`} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-titre`} ref={heading} tabIndex={-1} className="rounded-md font-display text-xl font-bold focus-visible:shadow-focus">{t("moderationDesk.deadlines.title")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("moderationDesk.deadlines.lead", { ordinance: DESK_DEADLINES_ORDINANCE })}</p>
      </div>
      {props.notice}
      {content}
    </section>
  )
}

function DeadlineCard(props: { readonly row: DeskDeadlineView; readonly teamName: string | null; readonly now: number; readonly onOpen: () => void; readonly onGone: () => void }) {
  const { t, locale } = useDiasporaleT()
  const labels = useDeskLabels()
  const titleId = useId()
  const item = useFocusFallback(props.onGone)
  const { row } = props
  return (
    <li ref={item}>
      <Card className="flex min-w-0 flex-col gap-2 p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 id={titleId} className="min-w-0 break-words font-semibold">{labels.surface(row.surface)}</h3>
          {row.status === "reviewing" ? <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{t("moderationDesk.case.reviewing")}</span> : null}
        </div>
        <p className="break-words text-sm">{t("moderationDesk.case.groundLine", { ground: labels.ground(row.ground) })}</p>
        <DeskDeadline basis={row.basis} dueAt={row.dueAt} acknowledgedAt={row.acknowledgedAt} now={props.now} />
        <p className="break-words text-xs text-muted-foreground">
          {t("moderationDesk.case.openedLine", { date: deskDateTime(row.createdAt, locale) })} · {labels.level(row.level, props.teamName)}
        </p>
        <Button variant="outline" size="sm" className="self-start" aria-describedby={titleId} aria-haspopup="dialog" onClick={props.onOpen}>
          {t("moderationDesk.case.open")}
        </Button>
      </Card>
    </li>
  )
}
