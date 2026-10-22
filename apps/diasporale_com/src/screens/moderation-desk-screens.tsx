"use client"

/**
 * `/moderation` — le guichet de modération par pays de DIASPORALE (PD6 · G9).
 *
 * Trois onglets portés par l'adresse (`routes.moderationDesk(tab)`) :
 *   · « File » : en tête, les délais légaux (SU01d du moteur : fondement,
 *     chronomètre, échéance, accusé de réception) ; puis la file ordinaire, les
 *     signalements ouverts et la relecture préalable, filtrés par le pays de la
 *     cible, la nature et l'équipe ; un dossier s'examine dans une feuille
 *     (aperçu borné, décisions antérieures, décision motivée) ;
 *   · « Recours » : les recours du réseau, à l'administration du réseau seule ;
 *   · « Équipe » : ses équipes ; leur composition pour l'administration du réseau.
 *
 * L'autorité reste au moteur : seules les équipes HABILITÉES lisent la file ;
 * un membre sans compétence voit « indisponible », exactement comme si la
 * capacité n'était pas servie — aucune équipe, aucun membre, aucun dossier
 * n'est révélé. La démonstration le dit : dossiers fictifs, décisions sans effet.
 * PROPRIÉTAIRE : chantier « modération par pays ».
 */
import { Card, EmptyState, FolderTabsNav, Skeleton } from "@diasporale/features"
import { useModerationDesk, type MembershipView, type ModerationDeskCapability, type ModerationDeskView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { FlaskConicalIcon, ShieldOffIcon } from "lucide-react"
import NextLink from "next/link"
import { useSearchParams } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { ModerationDeskAppeals } from "@/components/moderation-desk-appeals"
import { DESK_ACCESS_ERRORS, DeskErrorLine, deskList } from "@/components/moderation-desk-parts"
import { ModerationDeskQueue } from "@/components/moderation-desk-queue"
import { ModerationDeskTeam } from "@/components/moderation-desk-team"
import { routes } from "@/lib/routes"

/** Les onglets du guichet, mêmes valeurs que `routes.moderationDesk(tab)`. */
export const DESK_TABS = ["file", "recours", "equipe"] as const
export type DeskTab = (typeof DESK_TABS)[number]

/** L'onglet demandé par l'adresse ; inconnu ou absent : « File ». */
export function parseDeskTab(raw: string | null): DeskTab {
  return DESK_TABS.find((tab) => tab === raw) ?? "file"
}

const TAB_LABELS: Readonly<Record<DeskTab, string>> = {
  file: "moderationDesk.tab.file",
  recours: "moderationDesk.tab.appeals",
  equipe: "moderationDesk.tab.team",
}

export function ModerationDeskScreen() {
  return (
    <Gate require="member">
      {(session) => (session.membership ? <AppShell membership={session.membership}><ModerationDesk membership={session.membership} /></AppShell> : null)}
    </Gate>
  )
}

export function ModerationDesk(props: { readonly membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const desk = useModerationDesk()
  const params = useSearchParams()
  const tab = parseDeskTab(params.get("onglet"))
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">{t("moderationDesk.title")}</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{t("moderationDesk.lead")}</p>
      </header>
      {desk === null ? (
        <Unavailable />
      ) : (
        <DeskGate key={props.membership.personId} desk={desk} personId={props.membership.personId} tab={tab} />
      )}
    </div>
  )
}

/** Le même message pour une capacité non servie et pour un membre sans compétence : rien n'est révélé. */
function Unavailable() {
  const { t } = useDiasporaleT()
  return <EmptyState icon={<ShieldOffIcon />} title={t("moderationDesk.unavailable.title")} description={t("moderationDesk.unavailable.body")} />
}

function DeskGate(props: { readonly desk: ModerationDeskCapability; readonly personId: string; readonly tab: DeskTab }) {
  const { t } = useDiasporaleT()
  const view = props.desk.useDesk(props.personId)
  if (view.status === "loading") {
    return (
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">{t("moderationDesk.loading")}</span>
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }
  if (view.status === "error") {
    if (DESK_ACCESS_ERRORS.has(view.code)) return <Unavailable />
    return (
      <Card role="alert" className="p-4">
        <DeskErrorLine code={view.code} />
      </Card>
    )
  }
  if (view.data === null) return <Unavailable />
  return <DeskBody desk={props.desk} view={view.data} personId={props.personId} tab={props.tab} />
}

function DeskBody(props: { readonly desk: ModerationDeskCapability; readonly view: ModerationDeskView; readonly personId: string; readonly tab: DeskTab }) {
  const { t } = useDiasporaleT()
  const { view } = props
  const tabs = DESK_TABS.filter((tab) => tab !== "recours" || view.canReviewAppeals)
  return (
    <>
      {props.desk.demonstration ? (
        <Card className="flex items-start gap-3 p-4">
          <FlaskConicalIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-relaxed">{t("moderationDesk.demoNotice")}</p>
        </Card>
      ) : null}
      <Capacity view={view} />
      <FolderTabsNav
        label={t("moderationDesk.tabsLabel")}
        items={tabs.map((item) => ({ id: item, label: t(TAB_LABELS[item]), href: routes.moderationDesk(item), active: item === props.tab }))}
        renderLink={(item, className, children) => (
          <NextLink key={item.id} href={item.href} className={className} aria-current={item.active ? "page" : undefined}>{children}</NextLink>
        )}
      />
      {props.tab === "recours" ? (
        view.canReviewAppeals
          ? <ModerationDeskAppeals desk={props.desk} personId={props.personId} />
          : <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("moderationDesk.appeals.restricted")}</p>
      ) : props.tab === "equipe" ? (
        <ModerationDeskTeam desk={props.desk} view={view} personId={props.personId} />
      ) : (
        <ModerationDeskQueue desk={props.desk} view={view} personId={props.personId} />
      )}
    </>
  )
}

/** Ma capacité : le rôle qui ouvre le guichet, mes équipes ; la couverture par pays n'existe pas encore au moteur. */
function Capacity(props: { readonly view: ModerationDeskView }) {
  const { t, locale } = useDiasporaleT()
  const { view } = props
  const names = view.teams.filter((team) => team.isMember).map((team) => team.name)
  const teamsLine = names.length > 0 ? t("moderationDesk.capacity.teams", { names: deskList(names, locale) }) : t("moderationDesk.capacity.noTeam")
  return (
    <Card className="flex min-w-0 flex-col gap-1.5 p-4">
      <p className="text-sm font-semibold">{t(`moderationDesk.capacity.role.${view.role}`)}</p>
      <p className="break-words text-sm text-muted-foreground">{teamsLine}</p>
      <p className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.capacity.decisions")}</p>
    </Card>
  )
}
