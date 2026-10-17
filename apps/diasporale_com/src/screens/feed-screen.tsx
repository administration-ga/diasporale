"use client"

import { FEED_SCOPES, parseFeedScope, parseResidenceCountry, type FeedScope } from "@diasporale/domain"
import { Avatar, Card, EmptyState, EventCard, FolderTabsNav, MemberSuggestions, StatCounter, countryName } from "@diasporale/features"
import { useCountryHub, type MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowRightIcon, NewspaperIcon } from "lucide-react"
import NextLink from "next/link"
import { useSearchParams } from "next/navigation"

import { AppShell, useComposer } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { FeedPages } from "@/components/feed-pages"
import { FeedStories } from "@/components/feed-stories"
import { StatusBanner } from "@/components/status-banner"
import { normalizeFeedTag, routes } from "@/lib/routes"

/** `/fil` — le fil et ses quatre portées (EXF-DG-13), « Mon pays » par défaut. */
export function FeedScreen() {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <AppShell membership={session.membership} rail={<FeedRail membership={session.membership} />}>
            <Feed membership={session.membership} />
          </AppShell>
        ) : null
      }
    </Gate>
  )
}

function Feed(props: { membership: MembershipView }) {
  const { t, locale } = useDiasporaleT()
  const searchParams = useSearchParams()
  const scope = parseFeedScope(searchParams.get("scope"))
  const tag = normalizeFeedTag(searchParams.get("tag"))
  const parsedCountry = parseResidenceCountry(searchParams.get("country"))
  const hubCountry = parsedCountry.ok ? parsedCountry.value : undefined
  const composer = useComposer()
  const country = hubCountry ?? props.membership.facet.countryOfResidence
  const now = Date.now()

  return (
    <>
      <StatusBanner membership={props.membership} />
      <h1 className="sr-only">{t("feed.title")}</h1>
      <FolderTabsNav
        label={t("feed.scopesLabel")}
        items={FEED_SCOPES.map((id: FeedScope) => ({
          id,
          label: id === "mon_pays" ? countryName(country, locale) : t(`feed.scope.${id}`),
          href: routes.feed(id, tag, hubCountry),
          active: id === scope,
        }))}
        renderLink={(item, className, children) => (
          <NextLink key={item.id} href={item.href} className={className} aria-current={item.active ? "page" : undefined} scroll={false}>
            {children}
          </NextLink>
        )}
      />
      <p className="-mt-1 text-[13px] text-muted-foreground">{t(`feed.scopeHint.${scope}`, { country: countryName(country, locale) })}</p>

      {tag !== undefined ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
          <p className="min-w-0 break-all text-sm font-medium">{t("feed.tagFilter", { tag })}</p>
          <NextLink href={routes.feed(scope, undefined, hubCountry)} className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:shadow-focus" scroll={false}>
            {t("feed.clearTag")}
          </NextLink>
        </div>
      ) : null}

      <FeedStories now={now} />

      {composer.canPublish ? (
        <Card className="flex items-center gap-3 p-3">
          <Avatar id={props.membership.personId} name={props.membership.displayName} />
          <button
            type="button"
            onClick={composer.open}
            className="flex min-h-11 flex-1 items-center rounded-[var(--esp-r-chrome)] bg-muted px-4 text-left text-[15px] text-muted-foreground transition-colors hover:bg-[var(--ink-150)] focus-visible:shadow-focus"
          >
            {props.membership.facet.city ? t("feed.prompt", { city: props.membership.facet.city }) : t("feed.promptNoCity")}
          </button>
        </Card>
      ) : null}

      <FeedPages
        membership={props.membership}
        scope={scope}
        {...(tag === undefined ? {} : { tag })}
        {...(hubCountry === undefined ? {} : { hubCountry })}
        now={now}
        emptyFallback={
          <EmptyState
            icon={<NewspaperIcon />}
            title={tag === undefined ? t(`feed.empty.${scope}.title`, { country: countryName(country, locale) }) : t("feed.tagEmptyTitle", { tag })}
            description={tag === undefined ? t(`feed.empty.${scope}.body`) : t("feed.tagEmptyBody")}
            action={
              tag === undefined && composer.canPublish ? (
                <button type="button" onClick={composer.open} className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:shadow-focus">
                  {t("feed.empty.action")}
                </button>
              ) : undefined
            }
          />
        }
      />
    </>
  )
}

/** Rail droit (≥ 1 280 px) : le hub de mon pays et ses prochains évènements. */
function FeedRail(props: { membership: MembershipView }) {
  const { t, locale } = useDiasporaleT()
  const country = props.membership.facet.countryOfResidence
  const hub = useCountryHub(country)
  const now = Date.now()
  return (
    <>
      <Card className="p-4">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{t("rail.myHub")}</p>
        <p className="mt-1 font-display text-xl font-bold">{countryName(country, locale)}</p>
        {hub.status === "ready" && !hub.data.counters.dormant ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatCounter value={hub.data.counters.associations} label={t("hub.counters.associations")} />
            <StatCounter value={hub.data.counters.upcomingEvents} label={t("hub.counters.events")} />
          </div>
        ) : null}
        <NextLink
          href={routes.hub(country)}
          className="mt-4 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary hover:underline focus-visible:shadow-focus"
        >
          {t("rail.openHub")}
          <ArrowRightIcon className="size-4" aria-hidden />
        </NextLink>
      </Card>
      <MemberSuggestions headingId="rail-suggestions" />
      <section aria-labelledby="rail-evenements" className="flex flex-col gap-3">
        <h2 id="rail-evenements" className="font-display text-lg font-bold">
          {t("rail.upcoming")}
        </h2>
        {hub.status === "ready" && hub.data.events.length > 0 ? (
          hub.data.events.slice(0, 3).map((event) => <EventCard key={event.id} event={event} now={now} hubCountry={country} />)
        ) : (
          <p className="text-[13px] text-muted-foreground">{t("rail.noEvents")}</p>
        )}
      </section>
    </>
  )
}
