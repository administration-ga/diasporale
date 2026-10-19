"use client"

import { FEED_SCOPES, parseFeedScope, parseResidenceCountry, type CountryCode, type FeedScope } from "@diasporale/domain"
import { Avatar, Card, EmptyState, EventCard, FeedDiscovery, FolderTabsNav, MemberSuggestions, StatCounter, countryName } from "@diasporale/features"
import { useCountryHub, type MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowRightIcon, GalleryVerticalEndIcon, ListIcon, NewspaperIcon } from "lucide-react"
import NextLink from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState, type RefObject } from "react"

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

/** Les paramètres que la table des routes attache au mode Découverte (DG-017). */
function discoveryParams(): URLSearchParams {
  const href = routes.feedDiscovery()
  const at = href.indexOf("?")
  return new URLSearchParams(at < 0 ? "" : href.slice(at + 1))
}

/** Le mode Liste reste celui par défaut : la découverte ne s'ouvre que sur son adresse. */
function isDiscoveryView(searchParams: { get(name: string): string | null }): boolean {
  const entries = [...discoveryParams()]
  return entries.length > 0 && entries.every(([key, value]) => searchParams.get(key) === value)
}

/** L'adresse du fil en découverte : celle de la liste (portée, filtre, pays) plus le mode, sans rien écrire en dur. */
function discoveryHref(scope: FeedScope, tag: string | undefined, country: CountryCode | undefined): string {
  const list = routes.feed(scope, tag, country)
  const at = list.indexOf("?")
  const query = new URLSearchParams(at < 0 ? "" : list.slice(at + 1))
  for (const [key, value] of discoveryParams()) query.set(key, value)
  return `${at < 0 ? list : list.slice(0, at)}?${query.toString()}`
}

function Feed(props: { membership: MembershipView }) {
  const { t, locale } = useDiasporaleT()
  const searchParams = useSearchParams()
  const router = useRouter()
  const scope = parseFeedScope(searchParams.get("scope"))
  const tag = normalizeFeedTag(searchParams.get("tag"))
  const parsedCountry = parseResidenceCountry(searchParams.get("country"))
  const hubCountry = parsedCountry.ok ? parsedCountry.value : undefined
  const discovery = isDiscoveryView(searchParams)
  const composer = useComposer()
  const country = hubCountry ?? props.membership.facet.countryOfResidence
  const now = Date.now()
  // Changer de portée ou retirer le filtre garde le mode d'affichage choisi.
  const viewHref = (nextScope: FeedScope, nextTag: string | undefined) =>
    discovery ? discoveryHref(nextScope, nextTag, hubCountry) : routes.feed(nextScope, nextTag, hubCountry)
  const listHref = routes.feed(scope, tag, hubCountry)
  // L'élément actif de la découverte, et celui sur lequel la liste doit se recaler en revenant.
  const lastActive = useRef<string | null>(null)
  const listLink = useRef<HTMLAnchorElement>(null)
  const [returnTo, setReturnTo] = useState<string | null>(null)
  const clearReturn = useCallback(() => setReturnTo(null), [setReturnTo])
  const rememberActive = useCallback((postId: string | null) => { lastActive.current = postId }, [])

  const viewToggle = (
    <FolderTabsNav
      label={t("discovery.view.label")}
      className="w-auto"
      items={[
        { id: "list", label: t("discovery.view.list"), href: listHref, active: !discovery, icon: <ListIcon className="size-4" aria-hidden /> },
        { id: "discovery", label: t("discovery.view.discovery"), href: discoveryHref(scope, tag, hubCountry), active: discovery, icon: <GalleryVerticalEndIcon className="size-4" aria-hidden /> },
      ]}
      renderLink={(item, className, children) => (
        <NextLink
          key={item.id}
          ref={item.id === "list" ? listLink : undefined}
          href={item.href}
          className={className}
          aria-current={item.active ? "page" : undefined}
          scroll={false}
          onClick={item.id === "list" && discovery ? () => setReturnTo(lastActive.current) : undefined}
        >
          {children}
        </NextLink>
      )}
    />
  )

  const emptyFallback = (
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
  )

  return (
    <>
      <StatusBanner membership={props.membership} />
      <h1 className="sr-only">{t("feed.title")}</h1>
      <FolderTabsNav
        label={t("feed.scopesLabel")}
        items={FEED_SCOPES.map((id: FeedScope) => ({
          id,
          label: id === "mon_pays" ? countryName(country, locale) : t(`feed.scope.${id}`),
          href: viewHref(id, tag),
          active: id === scope,
        }))}
        renderLink={(item, className, children) => (
          <NextLink key={item.id} href={item.href} className={className} aria-current={item.active ? "page" : undefined} scroll={false}>
            {children}
          </NextLink>
        )}
      />
      {discovery ? null : <p className="-mt-1 text-[13px] text-muted-foreground">{t(`feed.scopeHint.${scope}`, { country: countryName(country, locale) })}</p>}

      {tag !== undefined ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
          <p className="min-w-0 break-all text-sm font-medium">{t("feed.tagFilter", { tag })}</p>
          <NextLink href={viewHref(scope, undefined)} className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:shadow-focus" scroll={false}>
            {t("feed.clearTag")}
          </NextLink>
        </div>
      ) : null}

      {discovery ? (
        <FeedDiscovery
          membership={props.membership}
          scope={scope}
          {...(hubCountry === undefined ? {} : { hubCountry })}
          {...(tag === undefined ? {} : { tag })}
          now={now}
          emptyFallback={emptyFallback}
          toolbarStart={viewToggle}
          onActiveChange={rememberActive}
          onExit={(postId) => {
            setReturnTo(postId)
            router.push(listHref, { scroll: false })
          }}
          // La fenêtre de lecture tient entre l'en-tête, les portées et la barre basse ; le filtre de mot-dièse prend sa ligne.
          viewportClassName={tag === undefined
            ? "h-[calc(100dvh-19rem)] min-h-[20rem] min-[960px]:h-[calc(100dvh-13rem)]"
            : "h-[calc(100dvh-23rem)] min-h-[20rem] min-[960px]:h-[calc(100dvh-17rem)]"}
        />
      ) : (
        <>
          <div className="flex">{viewToggle}</div>

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
            emptyFallback={emptyFallback}
          />
          <ListReturn postId={returnTo} fallback={listLink} onDone={clearReturn} />
        </>
      )}
    </>
  )
}

/** Au-delà, la publication active n'est pas dans les pages que la liste a montées : on cesse de la chercher. */
const LIST_RETURN_BUDGET_MS = 2_000
const LIST_RETURN_STEP_MS = 50

/**
 * Retour de la découverte : la liste se cale sur la publication qui était
 * active dès qu'une de ses pages la rend, et y porte le focus (lien de
 * l'auteur, sinon premier lien de la carte) ; à défaut, le focus revient sur la
 * bascule « Liste ». La carte est repérée par l'identifiant d'auteur que pose
 * `PostCard` (`post-<id>-auteur`), qui nomme déjà son article.
 */
function ListReturn(props: { postId: string | null; fallback: RefObject<HTMLAnchorElement | null>; onDone: () => void }) {
  const { postId, fallback, onDone } = props
  useEffect(() => {
    if (postId === null) return
    const deadline = Date.now() + LIST_RETURN_BUDGET_MS
    let timer: ReturnType<typeof setTimeout> | null = null
    const seek = () => {
      const author = document.getElementById(`post-${postId}-auteur`)
      const article = author?.closest("article") ?? null
      if (author !== null && article !== null) {
        if (typeof article.scrollIntoView === "function") article.scrollIntoView({ block: "center" })
        const target = author instanceof HTMLAnchorElement ? author : article.querySelector<HTMLElement>("a[href]")
        target?.focus({ preventScroll: true })
        onDone()
        return
      }
      if (Date.now() >= deadline) {
        fallback.current?.focus()
        onDone()
        return
      }
      timer = setTimeout(seek, LIST_RETURN_STEP_MS)
    }
    seek()
    return () => {
      if (timer !== null) clearTimeout(timer)
    }
  }, [postId, fallback, onDone])
  return null
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
