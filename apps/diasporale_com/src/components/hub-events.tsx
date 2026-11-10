"use client"

/**
 * HB-02 : les évènements d'un pays dans le hub et dans le rail du fil — les
 * prochains évènements OUVERTS AU RÉSEAU des associations du pays, publiés et non
 * annulés, lus par fenêtres bornées (`associationEvents.useCountryEvents`). Chaque
 * carte mène à la fiche de l'évènement (inscription, rappel, calendrier) et à la
 * page de son association. Aucun nombre ici : le compteur du hub vient du passage
 * nocturne et ne s'affiche que mesuré.
 */
import type { CountryCode } from "@diasporale/domain"
import { Button, Card, EmptyState } from "@diasporale/features"
import type { AssociationEventsCapability, CountryEventsPage, CountryEventsRequest, CountryEventView, Loadable } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowRightIcon, CalendarDaysIcon, MapPinIcon, UsersRoundIcon } from "lucide-react"
import NextLink from "next/link"
import { useState } from "react"

import { routes } from "@/lib/routes"

import { ServicePager } from "./service-pager"
import { browserTimeZone, SlotText } from "./service-request-ui"

/** La lecture des évènements d'un pays, telle que le fournisseur la sert (un hook). */
export type CountryEventsReader = (request: CountryEventsRequest) => Loadable<CountryEventsPage>

/**
 * La lecture des évènements d'un pays, liée à sa capacité, ou `null` quand le
 * fournisseur ne la sert pas. La capacité ne change pas pendant la vie de l'arbre :
 * l'écran garde l'ordre de ses hooks.
 */
export function countryEventsReader(capability: AssociationEventsCapability | null | undefined): CountryEventsReader | null {
  const read = capability?.useCountryEvents
  if (!capability || !read) return null
  return (request) => read.call(capability, request)
}

/** Les prochains évènements montrés dans le rail du fil ; la suite est dans le hub. */
export const RAIL_COUNTRY_EVENTS = 3

const LINK_CLASS = "inline-flex min-h-10 items-center gap-1 self-start text-sm font-semibold text-primary hover:underline focus-visible:shadow-focus"

/** Jour et mois abrégé dans le fuseau de l'évènement, celui où l'association l'a pensé. */
function calendarBlock(at: number, timeZone: string, locale: string): { day: string; month: string } {
  const format = (options: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(at)
    } catch {
      // Un fuseau inconnu du navigateur : le sien.
      return new Intl.DateTimeFormat(locale, options).format(at)
    }
  }
  return { day: format({ day: "numeric" }), month: format({ month: "short" }).replace(".", "") }
}

/** La carte d'un évènement du hub : date, titre vers sa fiche, horaire dans son fuseau, lieu, association. */
export function HubEventCard(props: { readonly event: CountryEventView }) {
  const { t, locale } = useDiasporaleT()
  const [viewerZone] = useState(browserTimeZone)
  const { event } = props
  const { day, month } = calendarBlock(event.startAt, event.timeZone, locale)
  return (
    <Card className="flex min-w-0 gap-3 p-3">
      <div aria-hidden className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-tag py-2 text-tag-code">
        <span className="font-mono text-xl font-semibold leading-none">{day}</span>
        <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.06em]">{month}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="text-[15px] font-semibold leading-snug">
          <NextLink href={routes.associationEvent(event.organizer.handle, event.eventId)} className="break-words rounded-sm hover:underline focus-visible:shadow-focus">
            {event.title}
          </NextLink>
        </h3>
        <div className="text-[13px] text-muted-foreground">
          <SlotText slot={{ startAt: event.startAt, endAt: event.endAt }} timeZone={event.timeZone} viewerTimeZone={viewerZone} />
        </div>
        {event.location ? (
          <p className="flex min-w-0 items-start gap-1 text-[13px] text-muted-foreground">
            <MapPinIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">{event.location}</span>
          </p>
        ) : null}
        <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-[13px]">
          <span className="text-muted-foreground">{t("event.by")}</span>
          <NextLink href={routes.page(event.organizer.handle)} className="break-words rounded-sm font-medium text-foreground hover:underline focus-visible:shadow-focus">
            {event.organizer.name}
          </NextLink>
        </p>
      </div>
    </Card>
  )
}

/**
 * L'onglet « Évènements » du hub : les évènements à venir du pays, fenêtre par
 * fenêtre, à partir de l'instant d'ouverture de l'onglet (toutes ses fenêtres le
 * partagent). Une lecture qui n'a parcouru qu'une partie des pages du pays le dit ;
 * le vide renvoie aux associations du pays et à l'agenda, sans rien promettre.
 */
export function HubEventsTab(props: { readonly read: CountryEventsReader; readonly country: CountryCode; readonly countryLabel: string }) {
  const { t } = useDiasporaleT()
  const [anchor] = useState(() => Date.now())
  const { read, country } = props
  // La première fenêtre, relue pour sa mention « incomplète » : la même lecture que celle de la liste.
  const opening = read({ country, anchor, cursor: null })
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t("hubEvents.lead", { country: props.countryLabel })}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <NextLink href={routes.pages({ ownerKind: "association", country })}>
              <UsersRoundIcon aria-hidden />
              {t("hub.eventsUnlistedAssociations")}
            </NextLink>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <NextLink href={routes.agenda()}>
              <CalendarDaysIcon aria-hidden />
              {t("eventCalendar.agendaTitle")}
            </NextLink>
          </Button>
        </div>
      </div>
      {opening.status === "ready" && opening.data.partial ? <p role="note" className="text-sm text-muted-foreground">{t("hubEvents.partial")}</p> : null}
      <ServicePager
        read={(cursor) => read({ country, anchor, cursor })}
        keyOf={(event) => event.eventId}
        empty={<EmptyState icon={<CalendarDaysIcon />} title={t("hubEvents.emptyTitle", { country: props.countryLabel })} description={t("hubEvents.emptyBody")} />}
      >
        {(events) => (
          <ul aria-label={t("hubEvents.listLabel", { country: props.countryLabel })} className="flex min-w-0 flex-col gap-3">
            {events.map((event) => (
              <li key={event.eventId} className="min-w-0">
                <HubEventCard event={event} />
              </li>
            ))}
          </ul>
        )}
      </ServicePager>
    </div>
  )
}

/**
 * Le rail du fil : les trois prochains évènements du pays de résidence, puis le
 * hub pour la suite. Rien n'est affirmé avant la lecture ; une lecture refusée ne
 * se dit pas « aucun évènement ».
 */
export function RailCountryEvents(props: { readonly read: CountryEventsReader; readonly country: CountryCode }) {
  const { t } = useDiasporaleT()
  const [anchor] = useState(() => Date.now())
  const events = props.read({ country: props.country, anchor, cursor: null, limit: RAIL_COUNTRY_EVENTS })
  if (events.status === "loading") return null
  if (events.status === "error") return <p className="text-[13px] text-muted-foreground">{t("hubEvents.railError")}</p>
  if (events.data.items.length === 0) {
    return (
      <>
        <p className="text-[13px] text-muted-foreground">{t("hubEvents.railEmpty")}</p>
        <NextLink href={routes.agenda()} className={LINK_CLASS}>
          {t("eventCalendar.agendaTitle")}
          <ArrowRightIcon className="size-4" aria-hidden />
        </NextLink>
      </>
    )
  }
  return (
    <>
      <ul className="flex min-w-0 flex-col gap-3">
        {events.data.items.slice(0, RAIL_COUNTRY_EVENTS).map((event) => (
          <li key={event.eventId} className="min-w-0">
            <HubEventCard event={event} />
          </li>
        ))}
      </ul>
      <NextLink href={routes.hub(props.country)} className={LINK_CLASS}>
        {t("hubEvents.railAll")}
        <ArrowRightIcon className="size-4" aria-hidden />
      </NextLink>
    </>
  )
}
