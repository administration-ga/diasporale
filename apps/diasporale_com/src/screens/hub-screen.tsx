"use client"

import { parseResidenceCountry, type CountryCode } from "@diasporale/domain"
import {
  AssociationCard,
  Button,
  CommunityTabSwitcher,
  CompanyCard,
  CountryMonument,
  CountrySwitch,
  EmptyState,
  EventCard,
  FloatingNotice,
  FolderTabs,
  FolderTabsContent,
  OfficialPageCard,
  PostCard,
  Skeleton,
  StatCounter,
  countryName,
} from "@diasporale/features"
import { useActions, useCountryHub, useFeed, useOpenCountries, type MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowLeftRightIcon, CalendarDaysIcon, CompassIcon, GlobeIcon, HourglassIcon, NewspaperIcon, StoreIcon, UsersRoundIcon } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { AppShell, useComposer } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { StatusBanner } from "@/components/status-banner"
import { routes } from "@/lib/routes"

/** `/pays/[iso]` — le hub d'un pays (EXF-DG-15/16, E02, l'écran le plus important du projet). */
export function HubScreen(props: { iso: string }) {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <AppShell membership={session.membership}>
            <Hub iso={props.iso} membership={session.membership} />
          </AppShell>
        ) : null
      }
    </Gate>
  )
}

function Hub(props: { iso: string; membership: MembershipView }) {
  const { t, locale } = useDiasporaleT()
  const parsed = parseResidenceCountry(props.iso)
  if (!parsed.ok) {
    // Refus indistinct : un code inconnu et le Gabon rendent la même page.
    return (
      <EmptyState
        icon={<CompassIcon />}
        title={t("hub.notFoundTitle")}
        description={t("hub.notFoundBody")}
        action={<CountryJump membership={props.membership} label={t("hub.chooseCountry")} />}
      />
    )
  }
  return <HubContent country={parsed.value} membership={props.membership} locale={locale} />
}

function CountryJump(props: { membership: MembershipView; label: string; current?: CountryCode }) {
  const { t } = useDiasporaleT()
  const router = useRouter()
  const open = useOpenCountries()
  return (
    <CountrySwitch
      value={props.current ?? null}
      onChange={(code) => router.push(routes.hub(code))}
      openCountries={open.status === "ready" ? open.data.map((item) => item.country) : []}
      title={t("hub.switchTitle")}
      description={t("hub.switchDescription")}
      trigger={
        <Button variant="outline">
          <ArrowLeftRightIcon aria-hidden />
          {props.label}
        </Button>
      }
    />
  )
}

function HubContent(props: { country: CountryCode; membership: MembershipView; locale: string }) {
  const { t } = useDiasporaleT()
  const searchParams = useSearchParams()
  const hub = useCountryHub(props.country)
  const feed = useFeed({ scope: "mon_pays", hubCountry: props.country })
  const actions = useActions()
  const composer = useComposer()
  const name = countryName(props.country, props.locale)
  const isHome = props.country === props.membership.facet.countryOfResidence
  const now = Date.now()

  return (
    <>
      <header className="overflow-hidden rounded-2xl bg-card shadow-card">
        <div className="flex flex-col gap-5 p-5 md:flex-row md:items-end md:justify-between md:p-6">
          <div className="flex items-end gap-4">
            <CountryMonument country={props.country} />
            <div className="pb-1">
              <h1 className="font-display text-3xl font-bold leading-tight md:text-4xl">{t("hub.title", { country: name })}</h1>
              {hub.status === "ready" ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold">
                  <span aria-hidden className={hub.data.open ? "size-2 rounded-full bg-[var(--success)]" : "size-2 rounded-full bg-[var(--warning)]"} />
                  {hub.data.open ? t("hub.open") : t("hub.notOpen")}
                </p>
              ) : null}
            </div>
          </div>
          <CountryJump membership={props.membership} label={t("hub.switch")} current={props.country} />
        </div>
        {hub.status === "ready" && !hub.data.counters.dormant ? (
          <div className="grid grid-cols-2 gap-4 border-t border-border bg-[var(--ink-50)] px-5 py-4 sm:grid-cols-4 md:px-6">
            <StatCounter value={hub.data.counters.members} label={t("hub.counters.members")} />
            <StatCounter value={hub.data.counters.associations} label={t("hub.counters.associations")} />
            <StatCounter value={hub.data.counters.companies} label={t("hub.counters.companies")} />
            <StatCounter value={hub.data.counters.upcomingEvents} label={t("hub.counters.events")} />
            {hub.data.countersSource === "demo" ? (
              <p className="col-span-full text-[11px] text-muted-foreground">{t("hub.countersDemo")}</p>
            ) : null}
          </div>
        ) : null}
      </header>

      {searchParams.get("bienvenue") === "1" && isHome ? (
        <FloatingNotice
          role="status"
          tone="info"
          icon={<GlobeIcon />}
          heading={t("hub.welcomeTitle", { name: props.membership.displayName })}
          dismissLabel={t("notice.dismiss")}
        >
          {t("hub.welcomeBody")}
        </FloatingNotice>
      ) : null}

      {isHome ? <StatusBanner membership={props.membership} /> : null}

      {hub.status === "ready" && !hub.data.open ? (
        <FloatingNotice role="note" tone="pending" icon={<HourglassIcon />} heading={t("hub.notOpen")} dismissLabel={t("notice.dismiss")}>
          {t("hub.notOpenNotice", { country: name })}
        </FloatingNotice>
      ) : null}

      {hub.status !== "ready" ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : hub.data.counters.dormant && feed.status === "ready" && feed.data.length === 0 ? (
        <EmptyState icon={<CompassIcon />} title={t("hub.dormantTitle", { country: name })} description={t("hub.dormantBody")} />
      ) : (
        <>
          {hub.data.officialPages.length > 0 ? (
            <section aria-labelledby="hub-officiel" className="flex flex-col gap-3">
              <h2 id="hub-officiel" className="font-display text-xl font-bold">
                {t("hub.official")}
              </h2>
              {hub.data.officialPages.map((page) => (
                <OfficialPageCard key={page.id} page={page} />
              ))}
            </section>
          ) : null}

          <FolderTabs defaultValue="actus">
            <CommunityTabSwitcher tabs={["actus", "evenements", "associations", "entreprises"]} label={t("hub.tabsLabel", { country: name })} />
            <FolderTabsContent value="actus" className="flex flex-col gap-4">
              {feed.status !== "ready" ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : feed.data.length === 0 ? (
                <EmptyState
                  icon={<NewspaperIcon />}
                  title={t("hub.emptyPosts", { country: name })}
                  description={t("hub.emptyPostsBody")}
                  action={
                    composer.canPublish && isHome ? (
                      <Button onClick={composer.open}>{t("feed.empty.action")}</Button>
                    ) : undefined
                  }
                />
              ) : (
                feed.data.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    now={now}
                    hubCountry={props.country}
                    canReact={props.membership.canPublish}
                    onReact={async (kind) => {
                      const result = await actions.react(post.id, kind)
                      if (!result.ok) toast.error(t(`errors.${result.code}`))
                    }}
                  />
                ))
              )}
            </FolderTabsContent>
            <FolderTabsContent value="evenements" className="flex flex-col gap-3">
              {hub.data.events.length === 0 ? (
                <EmptyState icon={<CalendarDaysIcon />} title={t("hub.emptyEvents", { country: name })} description={t("hub.emptyEventsBody")} />
              ) : (
                hub.data.events.map((event, index) => (
                  <EventCard key={event.id} event={event} now={now} hubCountry={props.country} variant={index === 0 ? "wide" : "compact"} />
                ))
              )}
            </FolderTabsContent>
            <FolderTabsContent value="associations" className="grid gap-3 sm:grid-cols-2">
              {hub.data.associations.length === 0 ? (
                <EmptyState
                  className="sm:col-span-2"
                  icon={<UsersRoundIcon />}
                  title={t("hub.emptyAssociations", { country: name })}
                  description={t("hub.emptyAssociationsBody")}
                />
              ) : (
                hub.data.associations.map((page) => <AssociationCard key={page.id} page={page} />)
              )}
            </FolderTabsContent>
            <FolderTabsContent value="entreprises" className="grid gap-3 sm:grid-cols-2">
              {hub.data.companies.length === 0 ? (
                <EmptyState
                  className="sm:col-span-2"
                  icon={<StoreIcon />}
                  title={t("hub.emptyCompanies", { country: name })}
                  description={t("hub.emptyCompaniesBody")}
                />
              ) : (
                hub.data.companies.map((page) => <CompanyCard key={page.id} page={page} />)
              )}
            </FolderTabsContent>
          </FolderTabs>
        </>
      )}
    </>
  )
}
