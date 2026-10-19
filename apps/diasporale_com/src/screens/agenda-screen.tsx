"use client"

import { EvenementsPanel } from "@antsia/social-features/reseau-personnel"
import { Card, Skeleton } from "@diasporale/features"
import { useAssociationEvents, type AssociationAgendaEventView, type AssociationAgendaPeriod, type AssociationEventCalendarCapability, type MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import NextLink from "next/link"
import { useCallback, useState } from "react"

import { AppShell } from "@/components/app-shell"
import { Gate, GateSkeleton } from "@/components/gate"
import { IcomIsland, useEngineNetwork, useIcomState } from "@/components/icom"
import { browserTimeZone, SlotText, useNow } from "@/components/service-request-ui"
import { ServicePager } from "@/components/service-pager"
import { routes } from "@/lib/routes"

export function AgendaScreen() {
  return <Gate require="member">{(session) => session.membership ? <AppShell membership={session.membership}><Agenda key={session.membership.personId} membership={session.membership} /></AppShell> : null}</Gate>
}

function Agenda(props: { readonly membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const capability = useAssociationEvents()?.calendar ?? null
  const network = useEngineNetwork()
  const icom = useIcomState()
  const now = useNow(60_000)
  const member = props.membership
  const blocked = member.status === "suspendue" || member.status === "partie" || member.root.status === "suspendue" || member.root.status === "partie"
  return <>
    <header><h1 className="font-display text-3xl font-bold">{t("eventCalendar.agendaTitle")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("eventCalendar.agendaLead")}</p></header>
    {blocked ? <Card role="alert" className="p-4">{t("errors.suspended")}</Card>
      : capability?.mode === "demonstration" ? <DemoAgenda key={`${member.personId}:${capability.mode}`} capability={capability} now={now} readerPersonId={member.personId} />
      : network && network.personId === member.personId ? <IcomIsland key={`${network.networkId}:${network.personId}`} network={network}><EvenementsPanel now={now} canWrite={member.canPublish} /></IcomIsland>
      : network || icom.status === "loading" ? <GateSkeleton />
      : <Card className="p-4">{t("errors.feature_unavailable")}</Card>}
  </>
}

function DemoAgenda(props: { readonly capability: AssociationEventCalendarCapability; readonly now: number; readonly readerPersonId: string }) {
  const { t } = useDiasporaleT()
  const [anchor] = useState(props.now)
  return <div className="flex min-w-0 flex-col gap-3">
    <p className="rounded-lg bg-muted p-3 text-sm">{t("eventCalendar.demoAgenda")}</p>
    {props.capability.useAgendaPage ? <>
      <p className="text-sm text-muted-foreground">{t("eventCalendar.paginationHint")}</p>
      <DemoAgendaPeriod capability={props.capability} anchor={anchor} period="upcoming" readerPersonId={props.readerPersonId} />
      <DemoAgendaPeriod capability={props.capability} anchor={anchor} period="history" readerPersonId={props.readerPersonId} />
    </> : <LegacyDemoAgenda capability={props.capability} now={props.now} />}
  </div>
}

/** Titres et états vides de chaque période, en clés citées en entier (le cliquet i18n les lit). */
const PERIOD_TITLE = { upcoming: "eventCalendar.upcoming", history: "eventCalendar.history" } as const satisfies Record<AssociationAgendaPeriod, string>
const PERIOD_EMPTY = { upcoming: "eventCalendar.emptyUpcoming", history: "eventCalendar.emptyHistory" } as const satisfies Record<AssociationAgendaPeriod, string>

function DemoAgendaPeriod(props: { readonly capability: AssociationEventCalendarCapability; readonly anchor: number; readonly period: AssociationAgendaPeriod; readonly readerPersonId: string }) {
  const { t } = useDiasporaleT()
  const [viewerZone] = useState(browserTimeZone)
  const read = useCallback((cursor: string | null) => props.capability.useAgendaPage!({ anchor: props.anchor, period: props.period, readerPersonId: props.readerPersonId, cursor }), [props.capability, props.anchor, props.period, props.readerPersonId])
  return <section className="flex min-w-0 flex-col gap-3" aria-labelledby={`agenda-${props.period}`}>
    <h2 id={`agenda-${props.period}`} className="text-xl font-semibold">{t(PERIOD_TITLE[props.period])}</h2>
    <ServicePager<AssociationAgendaEventView>
      key={`${props.readerPersonId}:${props.anchor}:${props.period}`}
      read={read}
      keyOf={(event) => event.eventId}
      clearOnError
      empty={<Card className="p-4">{t(PERIOD_EMPTY[props.period])}</Card>}
    >{(items) => <>
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{t("eventCalendar.loaded", { count: items.length })}</p>
      <AgendaEventsList items={items} viewerZone={viewerZone} />
    </>}</ServicePager>
  </section>
}

/** Compatibilité avec les fournisseurs qui n'exposent pas encore les curseurs. */
function LegacyDemoAgenda(props: { readonly capability: AssociationEventCalendarCapability; readonly now: number }) {
  const { t } = useDiasporaleT()
  const [viewerZone] = useState(browserTimeZone)
  const query = props.capability.useAgenda({ now: props.now })
  return <div className="flex min-w-0 flex-col gap-3">
    {query.status === "loading" ? <Skeleton className="h-32 w-full rounded-xl" />
      : query.status === "error" ? <Card role="alert" className="p-4">{t(`errors.${query.code}`)}</Card>
      : <>
        {query.data.truncated ? <p className="rounded-lg bg-muted p-3 text-sm">{t("eventCalendar.truncated")}</p> : null}
        {query.data.items.length === 0 ? <Card className="p-4">{t("eventCalendar.empty")}</Card> : <AgendaEventsList items={query.data.items} viewerZone={viewerZone} />}
      </>}
  </div>
}

function AgendaEventsList(props: { readonly items: readonly AssociationAgendaEventView[]; readonly viewerZone: string }) {
  const { t } = useDiasporaleT()
  return <ul className="flex min-w-0 flex-col gap-3">{props.items.map((event) => <li key={event.eventId}>
    <Card className="flex min-w-0 flex-col gap-3 p-4">
      <h3 className="text-lg font-semibold"><NextLink href={routes.associationEvent(event.organizer.handle, event.eventId)} className="break-words rounded-sm hover:underline focus-visible:shadow-focus">{event.title}</NextLink></h3>
      <p className="text-sm font-medium">{event.organizer.name}</p>
      <SlotText slot={{ startAt: event.startAt, endAt: event.endAt }} timeZone={event.timeZone} viewerTimeZone={props.viewerZone} />
      {event.status === "cancelled" ? <p className="font-semibold">{t("eventCalendar.cancelled")}</p> : <p>{t(event.registration === "waitlisted" ? "eventCalendar.waitlisted" : "eventCalendar.confirmed")}</p>}
      {event.location ? <p className="whitespace-pre-line break-words">{event.location}</p> : null}
      {event.description ? <p className="whitespace-pre-line break-words">{event.description}</p> : null}
    </Card>
  </li>)}</ul>
}
