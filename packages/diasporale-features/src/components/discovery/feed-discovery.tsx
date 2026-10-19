"use client"

/**
 * Le fil en mode « Découverte » (DG-017, sous-lot G6a) : un élément par écran,
 * défilement vertical par accrochage (`scroll-snap`), sur la MÊME source paginée
 * que la liste (`useFeedPage`, curseur serveur), portée, pays et filtre conservés.
 *
 *  · Recyclage borné : au plus `DISCOVERY_MAX_MOUNTED` diapositives montées
 *    autour de l'active, deux intercalaires pour le reste (`discovery-window`).
 *  · Ordre chronologique du fil, aucun classement ; les nouvelles publications
 *    attendent le geste « Actualiser » (`discovery-state`).
 *  · Lecteur unique, son coupé au départ, aucune lecture automatique sous
 *    mouvement réduit ou économie de données (`use-discovery-playback`).
 *  · Aucun geste obligatoire : flèches haut et bas, Page précédente et suivante,
 *    Début et Fin, boutons visibles, Échap pour revenir à la liste ; position
 *    annoncée en région polie, focus porté à chaque changement au clavier. Les
 *    flèches gauche et droite restent aux galeries et à la visionneuse.
 *
 * Le mode Liste reste le mode par défaut de l'application ; ce composant ne
 * connaît aucune URL (la sortie passe par `onExit`).
 */
import type { CountryCode, FeedScope } from "@diasporale/domain"
import { ChevronDownIcon, ChevronUpIcon, RefreshCwIcon } from "lucide-react"
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { toast } from "sonner"

import { useActions, useDataSource, useFeedPage } from "../../data/context"
import type { FeedCursorView, FeedPageRequest, MembershipView, ReactionKind } from "../../data/types"
import { useDiasporaleT } from "../../i18n/client"
import { cn } from "../../lib/cn"
import { Button } from "../../primitives/button"
import { Card, Skeleton } from "../../primitives/surface"
import { RoutingProvider, useRouting } from "../../routing"
import { discoveryPositionKey, readDiscoveryPosition, rememberDiscoveryPosition } from "./discovery-position"
import { DiscoveryItem } from "./discovery-item"
import {
  canAutoAppend,
  discoveryReducer,
  discoveryTail,
  failedPages,
  hasLacunarPage,
  initialDiscoveryState,
  pageKey,
  snapshotOf,
  type DiscoveryPageReport,
} from "./discovery-state"
import { DISCOVERY_PREFETCH_DISTANCE, discoveryWindow, rememberSeen, slideRendering } from "./discovery-window"
import { usePlaybackEnvironment } from "./playback-environment"
import { useDiscoveryPlayback } from "./use-discovery-playback"

export interface FeedDiscoveryProps {
  readonly membership: MembershipView
  readonly scope: FeedScope
  readonly hubCountry?: CountryCode
  readonly tag?: string
  readonly now: number
  /** Ce que montre un fil vide (le même état vide que la liste). */
  readonly emptyFallback: ReactNode
  /** Revenir à la liste sur la publication donnée (Échap, fin du fil). */
  readonly onExit: (activePostId: string | null) => void
  /** L'élément actif a changé : l'application peut y ramener la liste (bascule « Liste »). */
  readonly onActiveChange?: (activePostId: string | null) => void
  /** Ce qui ouvre la barre de la découverte (la bascule Liste / Découverte de l'application). */
  readonly toolbarStart?: ReactNode
  /** Hauteur de la fenêtre de lecture : l'application connaît sa coque. */
  readonly viewportClassName?: string
}

/** Un changement de lecteur, de portée, de pays ou de filtre démonte toute la séance. */
export function FeedDiscovery(props: FeedDiscoveryProps) {
  const source = useDataSource()
  const { routes, Link } = useRouting()
  const country = props.hubCountry ?? props.membership.facet.countryOfResidence
  const tag = props.tag?.trim().toLowerCase() || undefined
  const positionKey = discoveryPositionKey({
    source: source.kind,
    personId: props.membership.personId,
    scope: props.scope,
    country,
    ...(tag === undefined ? {} : { tag }),
  })
  // Comme la liste : un mot-dièse ouvert depuis une carte garde la portée et le pays du fil.
  const scopedRoutes = useMemo(() => ({
    ...routes,
    feed: (nextTag?: string, context?: Parameters<typeof routes.feed>[1]) => routes.feed(nextTag, context ?? {
      scope: props.scope,
      ...(props.hubCountry === undefined ? {} : { country: props.hubCountry }),
    }),
  }), [routes, props.scope, props.hubCountry])
  return (
    <RoutingProvider routes={scopedRoutes} Link={Link}>
      <DiscoverySession key={positionKey} {...props} {...(tag === undefined ? {} : { tag })} positionKey={positionKey} />
    </RoutingProvider>
  )
}

const EDITABLE = "input, textarea, select, [contenteditable=''], [contenteditable='true'], video, audio, [role='slider'], [role='listbox'], [role='menu'], [role='menuitem'], [role='combobox']"

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function scrollViewport(node: HTMLElement, top: number, behavior: ScrollBehavior): void {
  if (typeof node.scrollTo === "function") node.scrollTo({ top, behavior })
  else node.scrollTop = top
}

function DiscoverySession(props: FeedDiscoveryProps & { readonly positionKey: string }) {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const environment = usePlaybackEnvironment()
  const [state, dispatch] = useReducer(discoveryReducer, props.positionKey, (key: string) => initialDiscoveryState(readDiscoveryPosition(key)))
  const [settled, setSettled] = useState(true)
  const [seen, setSeen] = useState<readonly string[]>([])
  const [announcement, setAnnouncement] = useState("")
  const viewport = useRef<HTMLDivElement>(null)
  const retries = useRef(new Map<string, () => void>())
  const programmatic = useRef<{ readonly target: number; readonly until: number } | null>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const focusOnChange = useRef(false)
  const pendingNotice = useRef<string | null>(null)
  const activeIndexRef = useRef(state.activeIndex)
  const hintId = useId()

  const count = state.items.length
  const total = count + 1 // + la diapositive d'état, après la dernière publication
  const tail = discoveryTail(state)
  const appendable = canAutoAppend(state)
  const range = discoveryWindow(state.activeIndex, total)
  const activePost = state.items[state.activeIndex]
  const errors = failedPages(state)

  useLayoutEffect(() => {
    activeIndexRef.current = state.activeIndex
  }, [state.activeIndex])

  const report = useCallback((key: string, value: DiscoveryPageReport) => dispatch({ type: "report", key, report: value }), [])
  const registerRetry = useCallback((key: string, retry: (() => void) | null) => {
    if (retry === null) retries.current.delete(key)
    else retries.current.set(key, retry)
  }, [])

  // La position se retient à chaque changement : revenir d'un profil rouvre la même publication.
  useEffect(() => {
    rememberDiscoveryPosition(props.positionKey, snapshotOf(state))
  }, [props.positionKey, state])

  const { onActiveChange } = props
  useEffect(() => {
    onActiveChange?.(state.activeId)
  }, [onActiveChange, state.activeId])

  // Près de la fin, la page suivante se demande d'elle-même (même curseur serveur que la liste).
  useEffect(() => {
    if (state.activeIndex >= count - DISCOVERY_PREFETCH_DISTANCE && appendable) dispatch({ type: "append" })
  }, [state.activeIndex, count, appendable])

  // Une publication devient « vue » quand on s'y arrête : la précédente pourra rendre ses médias.
  const activeId = state.activeId
  useEffect(() => {
    if (settled && activeId !== null) setSeen((current) => rememberSeen(current, activeId))
  }, [settled, activeId])

  // La position s'annonce une fois le défilement arrêté, pas à chaque étape ; une actualisation la précède.
  useEffect(() => {
    if (!settled) return
    const notice = pendingNotice.current
    pendingNotice.current = null
    const position = state.activeIndex < count
      ? t(state.exhausted ? "discovery.position" : "discovery.positionMore", { position: state.activeIndex + 1, total: count })
      : tail === "end" ? t("discovery.end.title") : null
    if (position !== null) setAnnouncement(notice === null ? position : `${notice} ${position}`)
  }, [settled, state.activeIndex, state.exhausted, count, tail, t])

  // Le focus suit l'élément actif après un geste au clavier (ou s'il était déjà dans la fenêtre).
  useEffect(() => {
    if (!focusOnChange.current) return
    focusOnChange.current = false
    const node = viewport.current?.querySelector<HTMLElement>(`[data-discovery-index="${state.activeIndex}"]`)
    node?.focus({ preventScroll: true })
  }, [state.activeIndex, state.activeId])

  // Hors défilement, la fenêtre se cale sur l'actif (retour, actualisation, publication retirée avant lui).
  useLayoutEffect(() => {
    const node = viewport.current
    if (node === null || !settled || programmatic.current !== null) return
    const height = node.clientHeight
    if (height <= 0) return
    const target = state.activeIndex * height
    if (Math.abs(node.scrollTop - target) > 1) node.scrollTop = target
  }, [state.activeIndex, settled, total])

  const settleLater = useCallback((delay: number) => {
    if (settleTimer.current !== null) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null
      programmatic.current = null
      setSettled(true)
    }, delay)
  }, [])

  useEffect(() => () => {
    if (settleTimer.current !== null) clearTimeout(settleTimer.current)
  }, [])

  // `scrollend` (quand le navigateur le connaît) arrête l'attente au plus tôt ; la fenêtre peut naître après un fil vide.
  const hasViewport = tail !== "empty"
  useEffect(() => {
    const node = viewport.current
    if (node === null) return
    const onScrollEnd = () => {
      if (settleTimer.current !== null) clearTimeout(settleTimer.current)
      settleTimer.current = null
      programmatic.current = null
      setSettled(true)
    }
    node.addEventListener("scrollend", onScrollEnd)
    return () => node.removeEventListener("scrollend", onScrollEnd)
  }, [hasViewport])

  const navigate = useCallback((requested: number, focus: boolean) => {
    const current = activeIndexRef.current
    const index = clamp(requested, 0, total - 1)
    if (index === current) return
    focusOnChange.current = focus
    const node = viewport.current
    const height = node?.clientHeight ?? 0
    if (node !== null && height > 0) {
      // Un pas : défilement doux (sauf mouvement réduit) ; un saut : immédiat, rien entre les deux ne se monte.
      const smooth = !environment.reducedMotion && Math.abs(index - current) === 1
      programmatic.current = { target: index, until: Date.now() + 1500 }
      setSettled(false)
      // « auto » plutôt que « instant » : d'anciens navigateurs refusent cette valeur ; sans `scroll-behavior`, c'est un saut.
      scrollViewport(node, index * height, smooth ? "smooth" : "auto")
      settleLater(smooth ? 900 : 150)
    }
    dispatch({ type: "activate", index })
  }, [environment.reducedMotion, settleLater, total])

  const onScroll = () => {
    const node = viewport.current
    if (node === null) return
    const height = node.clientHeight
    if (height <= 0) return
    const index = clamp(Math.round(node.scrollTop / height), 0, total - 1)
    const pending = programmatic.current
    if (pending !== null) {
      // En route vers la cible d'un geste : les étapes intermédiaires ne deviennent pas actives.
      if (index !== pending.target && Date.now() < pending.until) {
        settleLater(200)
        return
      }
      programmatic.current = null
    }
    setSettled(false)
    settleLater(200)
    if (index !== activeIndexRef.current) {
      focusOnChange.current = node.contains(document.activeElement)
      dispatch({ type: "activate", index })
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // Un menu, une feuille ou la visionneuse sont rendus hors de cette région : leurs touches leur restent.
    const target = event.target
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    if (!(target instanceof Element) || !event.currentTarget.contains(target) || target.closest(EDITABLE)) return
    // Le panneau d'une publication longue, rejoint au clavier, garde ses flèches pour défiler ; ses liens, non.
    const inPanel = target.hasAttribute("data-discovery-scroll")
    const current = activeIndexRef.current
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        if (inPanel) return
        event.preventDefault()
        navigate(current + (event.key === "ArrowDown" ? 1 : -1), true)
        return
      case "PageDown":
      case "PageUp":
        event.preventDefault()
        navigate(current + (event.key === "PageDown" ? 1 : -1), true)
        return
      case "Home":
        if (inPanel) return
        event.preventDefault()
        navigate(0, true)
        return
      case "End":
        if (inPanel) return
        event.preventDefault()
        navigate(Math.max(count - 1, 0), true)
        return
      case "Escape":
        event.preventDefault()
        props.onExit(state.activeId)
        return
    }
  }

  const refresh = () => {
    for (const key of errors) retries.current.get(key)?.()
    if (state.pending.length === 0) {
      setAnnouncement(t("discovery.refresh.upToDate"))
      return
    }
    pendingNotice.current = t("discovery.refresh.added", { count: state.pending.length })
    programmatic.current = null
    dispatch({ type: "refresh" })
  }

  const react = async (postId: string, kind: ReactionKind | null) => {
    if (!props.membership.canPublish) return
    try {
      const result = await actions.react(postId, kind)
      if (!result.ok) toast.error(t(`errors.${result.code}`))
    } catch {
      toast.error(t("errors.unknown"))
    }
  }

  const positionText = count === 0
    ? null
    : state.activeIndex >= count && tail === "end"
      ? t("discovery.counterEnd")
      : t("discovery.counter", { position: Math.min(state.activeIndex + 1, count), total: count })
  // Seule la publication active ATTENDUE joue : pendant une transition, une voisine montée à sa place ne démarre pas.
  const playable = activePost !== undefined && activePost.id === state.activeId ? activePost : null
  const revision = playable === null
    ? ""
    : JSON.stringify(playable.media.map((item) => [item.kind, item.url, item.withheld]))
  useDiscoveryPlayback({ root: viewport, activeKey: playable?.id ?? null, settled, revision })

  const seenSet = new Set(seen)
  const slides: ReactNode[] = []
  for (let index = range.start; index < range.end; index += 1) {
    const active = index === state.activeIndex
    const post = state.items[index]
    if (post === undefined) {
      slides.push(
        <div
          key="etat"
          data-discovery-slide=""
          data-discovery-index={index}
          role="group"
          aria-roledescription={t("discovery.slide.roleDescription")}
          aria-label={t("discovery.slide.status")}
          tabIndex={-1}
          inert={!active}
          className="flex h-full snap-start snap-always flex-col items-center justify-center gap-3 px-4 py-6 text-center outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"
        >
          <StatusSlide
            tail={tail === "more" && appendable ? "loading" : tail}
            lacunar={hasLacunarPage(state)}
            onRetry={() => { for (const key of errors) retries.current.get(key)?.() }}
            onMore={() => dispatch({ type: "append" })}
            onTop={() => navigate(0, true)}
            onList={() => props.onExit(state.items[count - 1]?.id ?? null)}
          />
        </div>,
      )
      continue
    }
    const rendering = slideRendering(index, {
      active: state.activeIndex,
      wasSeen: (candidate) => {
        const id = state.items[candidate]?.id
        return id !== undefined && seenSet.has(id)
      },
      preloadNext: !environment.saveData,
    })
    slides.push(
      <div
        key={post.id}
        data-discovery-slide={post.id}
        data-discovery-index={index}
        data-discovery-rendering={rendering}
        role="group"
        aria-roledescription={t("discovery.slide.roleDescription")}
        aria-label={t("discovery.slide.label", { position: index + 1, total: count })}
        tabIndex={-1}
        inert={!active}
        className="flex h-full snap-start snap-always flex-col justify-center px-0.5 py-2 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"
      >
        <DiscoveryItem
          post={post}
          now={props.now}
          {...(props.hubCountry === undefined ? {} : { hubCountry: props.hubCountry })}
          canReact={props.membership.canPublish}
          onReact={(kind) => void react(post.id, kind)}
          rendering={rendering}
          active={active}
        />
      </div>,
    )
  }

  return (
    <section aria-roledescription={t("discovery.roleDescription")} aria-label={t("discovery.label")} aria-describedby={hintId} onKeyDown={onKeyDown} className="flex min-w-0 flex-col gap-2">
      {state.cursors.map((cursor) => (
        <DiscoveryPage
          key={pageKey(cursor)}
          pageKey={pageKey(cursor)}
          request={{
            scope: props.scope,
            ...(props.hubCountry === undefined ? {} : { hubCountry: props.hubCountry }),
            ...(props.tag === undefined ? {} : { tag: props.tag }),
            cursor,
          }}
          onReport={report}
          onRetry={registerRetry}
        />
      ))}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {props.toolbarStart}
        <div className="ml-auto flex items-center gap-1">
          {positionText === null ? null : <span aria-hidden className="min-w-12 px-1 text-right font-mono text-[13px] tabular-nums text-muted-foreground">{positionText}</span>}
          <Button variant={state.pending.length > 0 ? "secondary" : "ghost"} size="sm" onClick={refresh} className="min-h-11">
            <RefreshCwIcon aria-hidden />
            <span className="max-[379px]:sr-only">{t("discovery.refresh.label")}</span>
            {state.pending.length > 0 ? (
              <>
                {" "}
                <span aria-hidden className="rounded-full bg-primary px-1.5 font-mono text-[11px] font-semibold tabular-nums text-primary-foreground">{state.pending.length}</span>
                <span className="sr-only">{t("discovery.refresh.pending", { count: state.pending.length })}</span>
              </>
            ) : null}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(state.activeIndex - 1, false)} disabled={state.activeIndex === 0} className="min-h-11">
            <ChevronUpIcon aria-hidden />
            <span className="max-[479px]:sr-only">{t("discovery.previous")}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(state.activeIndex + 1, false)} disabled={state.activeIndex >= total - 1} className="min-h-11">
            <ChevronDownIcon aria-hidden />
            <span className="max-[479px]:sr-only">{t("discovery.next")}</span>
          </Button>
        </div>
      </div>
      {errors.length > 0 && tail !== "error" ? (
        <Card role="alert" className="flex flex-wrap items-center justify-between gap-3 p-3">
          <p className="text-sm">{t("feed.pagination.errorTitle")}</p>
          <Button variant="outline" size="sm" onClick={() => { for (const key of errors) retries.current.get(key)?.() }}>{t("feed.pagination.retry")}</Button>
        </Card>
      ) : null}
      {tail === "empty" ? props.emptyFallback : (
        <div
          ref={viewport}
          onScroll={onScroll}
          aria-busy={tail === "loading" && count === 0}
          className={cn(
            // L'ancrage du navigateur est coupé : la découverte cale elle-même sa position (recyclage, retour).
            "relative min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain snap-y snap-mandatory [container-type:size] [overflow-anchor:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            props.viewportClassName ?? "h-[calc(100dvh-16rem)]",
          )}
        >
          <div aria-hidden style={{ height: `${range.start * 100}%` }} />
          {slides}
          <div aria-hidden style={{ height: `${(total - range.end) * 100}%` }} />
        </div>
      )}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</p>
      <p id={hintId} className="sr-only">{t("discovery.hint")}</p>
    </section>
  )
}

function StatusSlide(props: {
  readonly tail: "loading" | "error" | "more" | "end" | "empty"
  readonly lacunar: boolean
  readonly onRetry: () => void
  readonly onMore: () => void
  readonly onTop: () => void
  readonly onList: () => void
}) {
  const { t } = useDiasporaleT()
  return (
    <>
      {props.tail === "loading" ? (
        <div role="status" className="flex w-full flex-col items-center gap-3">
          <Skeleton className="h-40 w-full max-w-md rounded-xl" />
          <p className="text-sm text-muted-foreground">{t("feed.pagination.loading")}</p>
        </div>
      ) : null}
      {props.tail === "error" ? (
        <Card role="alert" className="flex max-w-md flex-col items-center gap-3 p-4">
          <h2 className="font-semibold">{t("feed.pagination.errorTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("feed.pagination.errorBody")}</p>
          <Button variant="outline" onClick={props.onRetry}>{t("feed.pagination.retry")}</Button>
        </Card>
      ) : null}
      {props.tail === "more" ? <Button variant="outline" onClick={props.onMore}>{t("feed.pagination.loadMore")}</Button> : null}
      {props.tail === "end" ? (
        <div className="flex max-w-md flex-col items-center gap-3">
          <h2 className="font-semibold">{t("discovery.end.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("discovery.end.body")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={props.onTop}>{t("discovery.end.top")}</Button>
            <Button variant="ghost" onClick={props.onList}>{t("discovery.end.list")}</Button>
          </div>
        </div>
      ) : null}
      {props.lacunar ? <p className="max-w-md text-[13px] text-muted-foreground">{t("feed.pagination.lacunar")}</p> : null}
    </>
  )
}

/** Un composant par page : un abonnement, son curseur, sa reprise ; il ne rend rien lui-même. */
function DiscoveryPage(props: {
  readonly pageKey: string
  readonly request: FeedPageRequest & { readonly cursor: FeedCursorView | null }
  readonly onReport: (key: string, report: DiscoveryPageReport) => void
  readonly onRetry: (key: string, retry: (() => void) | null) => void
}) {
  const page = useFeedPage(props.request)
  const { onReport, onRetry, pageKey: key } = props
  useEffect(() => {
    onReport(key, {
      items: page.data?.items,
      nextCursor: page.data?.nextCursor ?? null,
      lacunar: page.data?.lacunar ?? false,
      isLoading: page.isLoading,
      error: page.error,
    })
  }, [onReport, key, page.data, page.isLoading, page.error])
  useEffect(() => {
    onRetry(key, page.retry)
    return () => onRetry(key, null)
  }, [onRetry, key, page.retry])
  return null
}
