"use client"

import type { CountryCode } from "@diasporale/domain"
import { MapPinIcon, UsersIcon } from "lucide-react"

import type { EventView } from "../../data/types"
import { useDiasporaleT } from "../../i18n/client"
import { cn } from "../../lib/cn"
import { calendarParts, formatDate } from "../../lib/format"
import { Card } from "../../primitives/surface"
import { ContentScopeTag } from "../country-tag"
import { TrustBadges } from "../trust-badge"

/**
 * Évènement (C1) : bloc calendrier, titre, lieu, étiquette pays ou portée,
 * catégorie, jauge d'inscrits, organisateur avec son badge. États « Complet »
 * (badge rose) et « Passé » (grisé). Variante `compact` (liste) et `wide`
 * (tête de hub).
 */
export function EventCard(props: {
  event: EventView
  now: number
  hubCountry?: CountryCode
  variant?: "compact" | "wide"
  className?: string
}) {
  const { t, locale } = useDiasporaleT()
  const { event } = props
  const { day, month } = calendarParts(event.startsAt, locale)
  const past = event.startsAt < props.now
  const full = event.capacity !== null && event.registered >= event.capacity
  const wide = props.variant === "wide"

  return (
    <Card className={cn("animate-rise flex gap-3 p-3", wide && "md:p-4", past && "opacity-70", props.className)}>
      <div
        aria-hidden
        className={cn(
          "flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-tag py-2 text-tag-code",
          wide && "md:w-16",
        )}
      >
        <span className="font-mono text-xl font-semibold leading-none">{day}</span>
        <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.06em]">{month}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-[var(--radius-xs)] bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {t(`event.category.${event.category}`)}
          </span>
          {full ? (
            <span className="rounded-[var(--radius-xs)] bg-rejected px-1.5 py-0.5 text-[11px] font-semibold text-rejected-foreground">
              {t("event.full")}
            </span>
          ) : null}
          {past ? (
            <span className="rounded-[var(--radius-xs)] bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {t("event.past")}
            </span>
          ) : null}
        </div>
        <h3 className={cn("mt-1 font-semibold leading-snug text-foreground", wide ? "text-lg" : "text-[15px]")}>
          {event.title}
        </h3>
        <p className="sr-only">{formatDate(event.startsAt, locale, { weekday: "long", day: "numeric", month: "long" })}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPinIcon className="size-3.5" aria-hidden />
            {event.city}
          </span>
          <ContentScopeTag scope={event.scope} {...(props.hubCountry ? { hubCountry: props.hubCountry } : {})} />
          {event.capacity !== null ? (
            <span className="inline-flex items-center gap-1 font-mono text-xs">
              <UsersIcon className="size-3.5" aria-hidden />
              {t("event.gauge", { registered: event.registered, capacity: event.capacity })}
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
          <span className="text-muted-foreground">{t("event.by")}</span>
          <span className="font-medium text-foreground">{event.organizer.displayName}</span>
          <TrustBadges badges={event.organizer.badges} />
        </div>
      </div>
    </Card>
  )
}
