"use client"

import { FEED_SCOPES, parseFeedScope, type FeedScope } from "@diasporale/domain"
import { Avatar, Card, EmptyState, EventCard, FolderTabsNav, PostCard, Skeleton, StatCounter, countryName } from "@diasporale/features"
import { useActions, useCountryHub, useFeed, type MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowRightIcon, NewspaperIcon } from "lucide-react"
import NextLink from "next/link"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { AppShell, useComposer } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { StatusBanner } from "@/components/status-banner"
import { routes } from "@/lib/routes"

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
  const feed = useFeed({ scope })
  const actions = useActions()
  const composer = useComposer()
  const country = props.membership.facet.countryOfResidence
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
          href: routes.feed(id),
          active: id === scope,
        }))}
        renderLink={(item, className, children) => (
          <NextLink key={item.id} href={item.href} className={className} aria-current={item.active ? "page" : undefined} scroll={false}>
            {children}
          </NextLink>
        )}
      />
      <p className="-mt-1 text-[13px] text-muted-foreground">{t(`feed.scopeHint.${scope}`, { country: countryName(country, locale) })}</p>

      {composer.canPublish ? (
        <Card className="flex items-center gap-3 p-3">
          <Avatar id={props.membership.personId} name={props.membership.displayName} />
          <button
            type="button"
            onClick={composer.open}
            className="flex min-h-11 flex-1 items-center rounded-[var(--esp-r-chrome)] bg-muted px-4 text-left text-[15px] text-muted-foreground transition-colors hover:bg-[var(--ink-150)] focus-visible:shadow-focus"
          >
            {t("feed.prompt", { city: props.membership.facet.city ?? countryName(country, locale) })}
          </button>
        </Card>
      ) : null}

      {feed.status !== "ready" ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : feed.data.length === 0 ? (
        <EmptyState
          icon={<NewspaperIcon />}
          title={t(`feed.empty.${scope}.title`, { country: countryName(country, locale) })}
          description={t(`feed.empty.${scope}.body`)}
          action={
            composer.canPublish ? (
              <button type="button" onClick={composer.open} className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:shadow-focus">
                {t("feed.empty.action")}
              </button>
            ) : undefined
          }
        />
      ) : (
        <ol className="flex flex-col gap-4">
          {feed.data.map((post) => (
            <li key={post.id}>
              <PostCard
                post={post}
                now={now}
                canReact={props.membership.canPublish}
                onReact={async (kind) => {
                  const result = await actions.react(post.id, kind)
                  if (!result.ok) toast.error(t(`errors.${result.code}`))
                }}
              />
            </li>
          ))}
        </ol>
      )}
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
