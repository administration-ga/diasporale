"use client"

import { parseResidenceCountry, type CountryCode } from "@diasporale/domain"
import {
  AssociationCard,
  Button,
  Card,
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
  Skeleton,
  StatCounter,
  cn,
  countryName,
} from "@diasporale/features"
import {
  useCountryHub,
  useOpenCountries,
  useOptionalDataSource,
  type CountryHubView,
  type HubPagesQuery,
  type HubPagesView,
  type MembershipView,
  type PagesCapability,
  type PagesRetry,
  type PageView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowLeftRightIcon, ArrowRightIcon, CalendarDaysIcon, CompassIcon, GlobeIcon, HourglassIcon, NewspaperIcon, StoreIcon, UsersRoundIcon } from "lucide-react"
import NextLink from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { type ReactNode, useLayoutEffect, useRef, useState } from "react"

import { AppShell, useComposer } from "@/components/app-shell"
import { FeedPages } from "@/components/feed-pages"
import { Gate } from "@/components/gate"
import { HubJobsTab } from "@/components/job-hub-tab"
import { StatusBanner } from "@/components/status-banner"
import { routes } from "@/lib/routes"

/** `/pays/[iso]` — le hub d'un pays (EXF-DG-15/16, E02, l'écran le plus important du projet). */
export function HubScreen(props: { iso: string; entryAction?: ReactNode }) {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <AppShell membership={session.membership}>
            <Hub iso={props.iso} membership={session.membership} entryAction={props.entryAction} />
          </AppShell>
        ) : null
      }
    </Gate>
  )
}

function Hub(props: { iso: string; membership: MembershipView; entryAction?: ReactNode }) {
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
  return <HubContent country={parsed.value} membership={props.membership} locale={locale} entryAction={props.entryAction} />
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
      rememberKey="diasporale:hubs:recents"
      home={props.membership.facet.countryOfResidence}
      trigger={
        <Button variant="outline">
          <ArrowLeftRightIcon aria-hidden />
          {props.label}
        </Button>
      }
    />
  )
}

interface HubContentProps {
  readonly country: CountryCode
  readonly membership: MembershipView
  readonly locale: string
  readonly entryAction?: ReactNode
}

/**
 * Les pages du hub se lisent par la capacité « pages » quand le fournisseur la
 * sert (pages réellement publiées et lisibles du pays, bornées par nature) ;
 * sinon, celles que le hub joint lui-même. La source ne change pas pendant la vie
 * de l'arbre : chaque branche garde l'ordre de ses hooks.
 */
function HubContent(props: HubContentProps) {
  const source = useOptionalDataSource()
  const capability = source?.pages ?? null
  return capability ? <HubWithPages {...props} capability={capability} /> : <HubBody {...props} pages={null} />
}

function HubWithPages(props: HubContentProps & { readonly capability: PagesCapability }) {
  const pages = props.capability.useHubPages(props.country)
  return <HubBody {...props} pages={pages} />
}

const NOTHING_MORE: HubPagesView["more"] = { officialPages: false, associations: false, companies: false }

/** Sans capacité : les listes que le hub joint (démonstration), sans suite annoncée. */
function pagesOfHub(hub: CountryHubView): HubPagesQuery {
  return {
    status: "ready",
    data: { country: hub.country, officialPages: hub.officialPages, associations: hub.associations, companies: hub.companies, more: NOTHING_MORE },
  }
}

function HubBody(props: HubContentProps & { readonly pages: HubPagesQuery | null }) {
  const { t } = useDiasporaleT()
  const searchParams = useSearchParams()
  const hub = useCountryHub(props.country)
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
          <div className="flex flex-wrap gap-2">
            {props.entryAction}
            <CountryJump membership={props.membership} label={t("hub.switch")} current={props.country} />
          </div>
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

      {hub.status === "loading" ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : hub.status === "error" ? (
        <Card role="alert" className="flex flex-col items-start gap-3 p-4">
          <div>
            <h2 className="font-semibold">{t("hub.errorTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("hub.errorBody")}</p>
          </div>
          <Button variant="outline" onClick={() => window.location.reload()}>{t("hub.reload")}</Button>
        </Card>
      ) : (
        <HubSections
          hub={hub.data}
          pages={props.pages ?? pagesOfHub(hub.data)}
          country={props.country}
          countryLabel={name}
          membership={props.membership}
          isHome={isHome}
          now={now}
          composer={composer}
        />
      )}
    </>
  )
}

function HubSections(props: {
  hub: CountryHubView
  pages: HubPagesQuery
  country: CountryCode
  countryLabel: string
  membership: MembershipView
  isHome: boolean
  now: number
  composer: ReturnType<typeof useComposer>
}) {
  const { t } = useDiasporaleT()
  const { hub, pages, composer } = props
  const name = props.countryLabel
  // L'onglet « Emploi » n'apparaît que si le fournisseur sert la capacité (DG-025).
  const jobs = useOptionalDataSource()?.jobs ?? null
  return (
    <>
      {pages.status === "ready" && pages.data.officialPages.length > 0 ? (
        <section aria-labelledby="hub-officiel" className="flex flex-col gap-3">
          <h2 id="hub-officiel" className="font-display text-xl font-bold">
            {t("hub.official")}
          </h2>
          {pages.data.officialPages.map((page) => (
            <OfficialPageCard key={page.id} page={page} />
          ))}
          {pages.data.more.officialPages ? <MorePagesLink /> : null}
        </section>
      ) : null}

      <FolderTabs defaultValue="actus">
        <CommunityTabSwitcher
          tabs={jobs ? ["actus", "evenements", "associations", "entreprises", "emploi"] : ["actus", "evenements", "associations", "entreprises"]}
          label={t("hub.tabsLabel", { country: name })}
        />
        <FolderTabsContent value="actus" className="flex flex-col gap-4">
          <FeedPages
            membership={props.membership}
            scope="mon_pays"
            hubCountry={props.country}
            now={props.now}
            emptyFallback={hub.counters.dormant ? (
              <EmptyState icon={<CompassIcon />} title={t("hub.dormantTitle", { country: name })} description={t("hub.dormantBody")} />
            ) : (
              <EmptyState
                icon={<NewspaperIcon />}
                title={t("hub.emptyPosts", { country: name })}
                description={t("hub.emptyPostsBody")}
                action={composer.canPublish && props.isHome ? <Button onClick={composer.open}>{t("feed.empty.action")}</Button> : undefined}
              />
            )}
          />
        </FolderTabsContent>
        <FolderTabsContent value="evenements" className="flex flex-col gap-3">
          {hub.events.length === 0 ? (
            <EmptyState icon={<CalendarDaysIcon />} title={t("hub.emptyEvents", { country: name })} description={t("hub.emptyEventsBody")} />
          ) : (
            hub.events.map((event, index) => (
              <EventCard key={event.id} event={event} now={props.now} hubCountry={props.country} variant={index === 0 ? "wide" : "compact"} />
            ))
          )}
        </FolderTabsContent>
        <FolderTabsContent value="associations" className="grid gap-3 sm:grid-cols-2">
          <HubPageList
            pages={pages}
            pick={(data) => ({ rows: data.associations, more: data.more.associations })}
            directoryHref={routes.pages({ ownerKind: "association", country: props.country })}
            card={(page) => <AssociationCard key={page.id} page={page} />}
            empty={
              <EmptyState
                className="sm:col-span-2"
                icon={<UsersRoundIcon />}
                title={t("hub.emptyAssociations", { country: name })}
                description={t("hub.emptyAssociationsBody")}
              />
            }
          />
        </FolderTabsContent>
        <FolderTabsContent value="entreprises" className="grid gap-3 sm:grid-cols-2">
          <HubPageList
            pages={pages}
            pick={(data) => ({ rows: data.companies, more: data.more.companies })}
            directoryHref={routes.pages({ ownerKind: "company", country: props.country })}
            card={(page) => <CompanyCard key={page.id} page={page} />}
            empty={
              <EmptyState
                className="sm:col-span-2"
                icon={<StoreIcon />}
                title={t("hub.emptyCompanies", { country: name })}
                description={t("hub.emptyCompaniesBody")}
              />
            }
          />
        </FolderTabsContent>
        {jobs ? (
          <FolderTabsContent value="emploi" className="flex flex-col gap-3">
            <HubJobsTab jobs={jobs} country={props.country} countryLabel={name} />
          </FolderTabsContent>
        ) : null}
      </FolderTabs>
    </>
  )
}

/**
 * Une liste de pages du hub, dans ses quatre états : chargement, erreur traduite
 * (avec reprise si le fournisseur en a une), vide réel, pages lues. Une liste
 * vide dont la fenêtre bornée n'a pas tout vu ne se dit pas « vide » : elle
 * renvoie à l'annuaire.
 */
function HubPageList(props: {
  pages: HubPagesQuery
  pick: (data: HubPagesView) => { rows: readonly PageView[]; more: boolean }
  card: (page: PageView) => ReactNode
  empty: ReactNode
  directoryHref?: string
}) {
  const { t } = useDiasporaleT()
  const { pages } = props
  if (pages.status === "loading") {
    return (
      <div role="status" aria-busy="true" className="flex flex-col gap-3 sm:col-span-2">
        <span className="sr-only">{t("common.pleaseWait")}</span>
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }
  if (pages.status === "error") return <HubPagesError {...(pages.retry ? { retry: pages.retry } : {})} />
  const { rows, more } = props.pick(pages.data)
  if (rows.length === 0 && !more) return <>{props.empty}</>
  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-start gap-3 p-4 sm:col-span-2">
        <p className="text-sm text-muted-foreground">{t("hub.pagesElsewhere")}</p>
        <MorePagesLink {...(props.directoryHref ? { href: props.directoryHref } : {})} />
      </Card>
    )
  }
  return (
    <>
      {rows.map((page) => props.card(page))}
      {more ? <MorePagesLink className="sm:col-span-2" {...(props.directoryHref ? { href: props.directoryHref } : {})} /> : null}
    </>
  )
}

function MorePagesLink(props: { className?: string; href?: string }) {
  const { t } = useDiasporaleT()
  return (
    <NextLink
      href={props.href ?? routes.pages()}
      className={cn("inline-flex min-h-10 items-center gap-1 self-start rounded-md px-2 text-sm font-semibold text-primary hover:bg-muted focus-visible:shadow-focus", props.className)}
    >
      {t("hub.morePages")}
      <ArrowRightIcon className="size-4" aria-hidden />
    </NextLink>
  )
}

function HubPagesError(props: { retry?: PagesRetry }) {
  const { t } = useDiasporaleT()
  const [retrying, setRetrying] = useState(false)
  const active = useRef(false)
  useLayoutEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const retry = props.retry
  const again = async () => {
    if (!retry || retrying) return
    setRetrying(true)
    try {
      await retry()
    } catch {
      // La lecture garde son erreur traduite.
    } finally {
      if (active.current) setRetrying(false)
    }
  }
  return (
    <Card role="alert" className="flex flex-col items-start gap-3 p-4 sm:col-span-2">
      <p className="text-sm">{t("hub.pagesError")}</p>
      {retry ? (
        <Button variant="outline" disabled={retrying} aria-busy={retrying} onClick={() => void again()}>
          {t("hub.pagesRetry")}
        </Button>
      ) : null}
    </Card>
  )
}
