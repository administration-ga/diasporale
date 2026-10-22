"use client"

/**
 * L'onglet « File » du guichet de modération (PD6 · G9). En tête, la voie des
 * délais légaux (SU01d du moteur) ; puis la file ordinaire, qui ne la reprend
 * pas : les signalements ouverts, ou les contenus en relecture préalable (pages
 * à vérifier, évènements en relecture…), filtrés par le pays que porte la CIBLE
 * et par nature. L'équipe choisie vaut pour les deux. Une fenêtre à la fois
 * (« Afficher plus ») : une fenêtre filtrée peut être vide et annoncer sa
 * suite ; rien n'est compté.
 *
 * Un dossier s'examine dans une feuille : la file reste en place derrière elle,
 * à la même position. Une décision prise, le message d'issue reçoit le focus,
 * dans la partie d'où le dossier a été ouvert ; un dossier qui quitte la file
 * pendant que son bouton a le focus le rend au titre de sa partie.
 * PROPRIÉTAIRE : chantier « modération par pays ».
 */
import { Button, Card, EmptyState } from "@diasporale/features"
import {
  DESK_OPEN_STATUSES,
  DESK_SOURCES,
  deskZoneFromKey,
  type DeskCaseView,
  type DeskDecision,
  type DeskOpenStatus,
  type DeskPendingView,
  type DeskSource,
  type DeskSurface,
  type ModerationDeskCapability,
  type ModerationDeskView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { InboxIcon, ScanSearchIcon } from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"

import { ModerationDeskCaseSheet, ModerationDeskPendingSheet, type DeskCaseOpening } from "./moderation-desk-case"
import { ModerationDeskDeadlines } from "./moderation-desk-deadlines"
import { DeskCountry, DeskSurfaceSelect, DeskZoneSelect, deskDateTime, deskSelectClass, useDeskLabels, useFocusFallback } from "./moderation-desk-parts"
import { ServicePager } from "./service-pager"

/** La partie de l'onglet d'où vient une décision : son message d'issue s'y affiche. */
type DeskPart = "deadlines" | "queue"

/** L'équipe lue par défaut : toute la file accessible pour un rôle réseau, sinon la première équipe. */
export function defaultDeskTeam(view: ModerationDeskView): string | null {
  if (view.networkWide) return null
  return view.teams.find((team) => team.isMember)?.teamId ?? view.teams[0]?.teamId ?? null
}

export function ModerationDeskQueue(props: { readonly desk: ModerationDeskCapability; readonly view: ModerationDeskView; readonly personId: string }) {
  const { t } = useDiasporaleT()
  const labels = useDeskLabels()
  const id = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const statusLine = useRef<HTMLParagraphElement>(null)
  const [source, setSource] = useState<DeskSource>("reports")
  const [zoneKey, setZoneKey] = useState("all")
  const [surface, setSurface] = useState<DeskSurface | null>(null)
  const [teamId, setTeamId] = useState<string | null>(() => defaultDeskTeam(props.view))
  const [status, setStatus] = useState<DeskOpenStatus>("open")
  const [openedCase, setOpenedCase] = useState<DeskCaseOpening | null>(null)
  const [openedPending, setOpenedPending] = useState<DeskPendingView | null>(null)
  const [notice, setNotice] = useState<{ readonly message: string; readonly part: DeskPart } | null>(null)
  const [focusRequest, setFocusRequest] = useState(0)
  const zone = useMemo(() => deskZoneFromKey(zoneKey), [zoneKey])
  const filtersKey = `${source}:${status}:${zoneKey}:${surface ?? "*"}:${teamId ?? "*"}`
  const narrowed = zoneKey !== "all" || surface !== null || (source === "reports" && status !== "open")
  const { desk, personId } = props
  // SU01d : la voie des délais légaux de la file lue ; ni le pays, ni la nature, ni l'état ne la filtrent.
  const deadlines = desk.useDeadlines({ personId, teamId })
  const deadlinesShown = deadlines.status === "ready" && deadlines.data.items.length > 0

  // Après la fermeture de la feuille : la restauration du focus de la feuille passe d'abord, puis le message.
  useEffect(() => {
    if (focusRequest === 0) return
    const timer = setTimeout(() => statusLine.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [focusRequest])

  const announce = (message: string, part: DeskPart) => {
    setNotice({ message, part })
    setFocusRequest((value) => value + 1)
  }
  const noticeLine = (part: DeskPart) =>
    notice !== null && notice.part === part ? (
      <p ref={statusLine} tabIndex={-1} role="status" className="rounded-xl bg-muted p-3 text-sm focus-visible:shadow-focus">{notice.message}</p>
    ) : null
  /** Un dossier retiré de la file pendant que son bouton avait le focus : le focus revient au titre. */
  const focusQueue = useCallback(() => heading.current?.focus(), [])

  const teamOptions = props.view.teams
  // Un rôle réseau choisit entre toute la file et une équipe ; un membre d'équipe, entre ses équipes.
  const showTeams = props.view.networkWide ? teamOptions.length > 0 : teamOptions.length > 1

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {showTeams ? (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={`${id}-equipe`} className="text-sm font-medium">{t("moderationDesk.filters.team")}</label>
            <select
              id={`${id}-equipe`}
              className={deskSelectClass}
              value={teamId ?? ""}
              aria-describedby={`${id}-equipe-aide`}
              onChange={(event) => setTeamId(event.target.value === "" ? null : event.target.value)}
            >
              {props.view.networkWide ? <option value="">{t("moderationDesk.filters.teamAll")}</option> : null}
              {teamOptions.map((team) => (
                <option key={team.teamId} value={team.teamId}>
                  {team.scope === null ? team.name : t("moderationDesk.filters.teamScoped", { name: team.name, surface: labels.surface(team.scope) })}
                </option>
              ))}
            </select>
            <p id={`${id}-equipe-aide`} className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.deadlines.teamHint")}</p>
          </div>
        </div>
      ) : null}

      <ModerationDeskDeadlines
        lane={deadlines}
        view={props.view}
        notice={noticeLine("deadlines")}
        onOpen={(row) => setOpenedCase({ reportId: row.reportId, surface: row.surface, deadline: row })}
      />

      <section aria-labelledby={`${id}-titre`} className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id={`${id}-titre`} ref={heading} tabIndex={-1} className="rounded-md font-display text-xl font-bold focus-visible:shadow-focus">{t("moderationDesk.queue.title")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("moderationDesk.queue.lead")}</p>
          {source === "reports" ? <p className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.deadlines.ordinaryNote")}</p> : null}
        </div>

        <div role="group" aria-label={t("moderationDesk.filters.label")} className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={`${id}-source`} className="text-sm font-medium">{t("moderationDesk.filters.source")}</label>
            <select
              id={`${id}-source`}
              className={deskSelectClass}
              value={source}
              onChange={(event) => setSource(DESK_SOURCES.find((value) => value === event.target.value) ?? "reports")}
            >
              {DESK_SOURCES.map((value) => <option key={value} value={value}>{t(`moderationDesk.filters.sourceOption.${value}`)}</option>)}
            </select>
          </div>
          {source === "reports" ? (
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={`${id}-etat`} className="text-sm font-medium">{t("moderationDesk.filters.status")}</label>
              <select
                id={`${id}-etat`}
                className={deskSelectClass}
                value={status}
                onChange={(event) => setStatus(DESK_OPEN_STATUSES.find((value) => value === event.target.value) ?? "open")}
              >
                {DESK_OPEN_STATUSES.map((value) => <option key={value} value={value}>{t(`moderationDesk.filters.statusOption.${value}`)}</option>)}
              </select>
            </div>
          ) : null}
          <DeskZoneSelect id={`${id}-pays`} value={zoneKey} onChange={setZoneKey} />
          <DeskSurfaceSelect id={`${id}-nature`} value={surface} onChange={setSurface} />
        </div>
        <p className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.filters.countryNote")}</p>

        {noticeLine("queue")}

        {source === "reports" ? (
          <ServicePager<DeskCaseView>
            key={filtersKey}
            read={(cursor) => desk.useQueue({ personId, zone, surface, teamId, status, lane: "ordinary", cursor })}
            keyOf={(row) => row.reportId}
            empty={
              <EmptyState
                icon={<InboxIcon />}
                title={t(narrowed ? "moderationDesk.queue.emptyFilteredTitle" : deadlinesShown ? "moderationDesk.deadlines.ordinaryEmptyTitle" : "moderationDesk.queue.emptyTitle")}
                description={t(narrowed ? "moderationDesk.queue.emptyFilteredBody" : deadlinesShown ? "moderationDesk.deadlines.ordinaryEmptyBody" : "moderationDesk.queue.emptyBody")}
              />
            }
          >
            {(rows) => (
              <ul className="flex min-w-0 flex-col gap-3">
                {rows.map((row) => (
                  <CaseCard key={row.reportId} row={row} onOpen={() => setOpenedCase({ reportId: row.reportId, surface: row.surface, deadline: null })} onGone={focusQueue} />
                ))}
              </ul>
            )}
          </ServicePager>
        ) : (
          <ServicePager<DeskPendingView>
            key={filtersKey}
            read={(cursor) => desk.usePending({ personId, zone, surface, teamId, cursor })}
            keyOf={(row) => row.key}
            empty={
              <EmptyState
                icon={<ScanSearchIcon />}
                title={t("moderationDesk.queue.emptyPendingTitle")}
                description={t(narrowed ? "moderationDesk.queue.emptyFilteredBody" : "moderationDesk.queue.emptyPendingBody")}
              />
            }
          >
            {(rows) => (
              <ul className="flex min-w-0 flex-col gap-3">
                {rows.map((row) => <PendingCard key={row.key} row={row} onOpen={() => setOpenedPending(row)} onGone={focusQueue} />)}
              </ul>
            )}
          </ServicePager>
        )}
      </section>

      <ModerationDeskCaseSheet
        desk={desk}
        personId={personId}
        row={openedCase}
        onClose={() => setOpenedCase(null)}
        onDecided={(decision: DeskDecision) => {
          const part: DeskPart = openedCase?.deadline ? "deadlines" : "queue"
          setOpenedCase(null)
          announce(t(`moderationDesk.decision.done.${decision}`), part)
        }}
      />
      <ModerationDeskPendingSheet
        desk={desk}
        personId={personId}
        row={openedPending}
        onClose={() => setOpenedPending(null)}
        onReviewed={(approved) => {
          setOpenedPending(null)
          announce(t(approved ? "moderationDesk.pending.doneApproved" : "moderationDesk.pending.doneRejected"), "queue")
        }}
      />
    </div>
  )
}

function CaseCard(props: { readonly row: DeskCaseView; readonly onOpen: () => void; readonly onGone: () => void }) {
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
          <DeskCountry country={row.country} />
          {row.status === "reviewing" ? <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{t("moderationDesk.case.reviewing")}</span> : null}
        </div>
        <p className="break-words text-sm">{t("moderationDesk.case.groundLine", { ground: labels.ground(row.ground) })}</p>
        <p className="break-words text-xs text-muted-foreground">
          {t("moderationDesk.case.openedLine", { date: deskDateTime(row.createdAt, locale) })} · {labels.level(row.level, row.teamName)}
        </p>
        {row.party !== null ? <p className="break-words text-xs text-muted-foreground">{labels.party(row.party)}</p> : null}
        <Button variant="outline" size="sm" className="self-start" aria-describedby={titleId} aria-haspopup="dialog" onClick={props.onOpen}>
          {t(row.party === null ? "moderationDesk.case.open" : "moderationDesk.case.view")}
        </Button>
      </Card>
    </li>
  )
}

function PendingCard(props: { readonly row: DeskPendingView; readonly onOpen: () => void; readonly onGone: () => void }) {
  const { t, locale } = useDiasporaleT()
  const labels = useDeskLabels()
  const titleId = useId()
  const item = useFocusFallback(props.onGone)
  const { row } = props
  return (
    <li ref={item}>
      <Card className="flex min-w-0 flex-col gap-2 p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 id={titleId} className="min-w-0 break-words font-semibold">{labels.surface(row.targetKind)}</h3>
          <DeskCountry country={row.country} />
        </div>
        <p className="break-words text-xs text-muted-foreground">
          {t("moderationDesk.pending.sinceLine", { date: deskDateTime(row.updatedAt, locale) })}
          {row.teamName ? <> · {t("moderationDesk.level.teamNamed", { name: row.teamName })}</> : null}
        </p>
        {row.party !== null ? <p className="break-words text-xs text-muted-foreground">{labels.party(row.party)}</p> : null}
        <Button variant="outline" size="sm" className="self-start" aria-describedby={titleId} aria-haspopup="dialog" onClick={props.onOpen}>
          {t(row.party === null ? "moderationDesk.pending.open" : "moderationDesk.case.view")}
        </Button>
      </Card>
    </li>
  )
}
