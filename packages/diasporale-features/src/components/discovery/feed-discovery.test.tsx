import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useMemo, useSyncExternalStore, type ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DataSourceProvider } from "../../data/context"
import type { DiasporaleDataSource } from "../../data/port"
import type { FeedCursorView, FeedPageQuery, FeedPageRequest, FeedPageView, Loadable, MembershipView, PostMediaView, PostView, SessionView } from "../../data/types"
import { getFixedT } from "../../i18n"
import { I18nProvider } from "../../i18n/client"
import { MEDIA_PLAYBACK_STOP_EVENT, registeredMediaPlayerCount, suspendMediaPlayback } from "../../lib/media-viewer-lease"
import { RoutingProvider, type FeatureRoutes } from "../../routing"
import { discoveryPositionKey, forgetDiscoveryPosition, readDiscoveryPosition } from "./discovery-position"
import { FeedDiscovery } from "./feed-discovery"

const BASE = Date.UTC(2026, 9, 18, 12)
const t = getFixedT("fr")

const member: MembershipView = {
  personId: "person-lectrice", handle: "lectrice", displayName: "Lectrice de recette", status: "declaree", badges: ["community"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: null, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: true, rateTier: "reinforced", directoryVisibility: "hidden",
}
const session: Loadable<SessionView> = { status: "ready", data: { status: "signed_in", account: { id: member.personId, idn: null, local: null, nameHints: {} }, membership: member } }

const routes: FeatureRoutes = {
  profile: (handle) => `/@${handle}`,
  post: (id) => `/publication/${id}`,
  page: (handle) => `/pages/${handle}`,
  hub: (country) => `/pays/${country}`,
  feed: () => "/fil",
  sponsor: () => "/parrainer",
  settings: () => "/parametres",
  attestation: () => "/verification",
  enter: () => "/entrer",
}
function Link({ children, ...props }: ComponentProps<"a">) { return <a {...props}>{children}</a> }

function video(rank: number): PostMediaView {
  return { kind: "video", url: `/recette-video-${rank}.mp4`, withheld: null, altText: `Vidéo ${rank}`, width: 720, height: 1280 }
}

function post(rank: number | string, options: { at?: number; media?: readonly PostMediaView[] } = {}): PostView {
  const id = typeof rank === "number" ? `post-${String(rank).padStart(3, "0")}` : rank
  return {
    id,
    author: { kind: "person", id: "person-autrice", handle: "autrice", displayName: "Autrice de recette", badges: [] },
    body: `Texte de ${id}`,
    media: options.media ?? [],
    share: null,
    shareCount: 0,
    scope: { reach: "diaspora" },
    audience: "public",
    visibility: "network",
    moderation: "published",
    createdAt: options.at ?? BASE - (typeof rank === "number" ? rank : 0) * 1_000,
    reactionCount: 0,
    commentCount: 0,
    myReaction: null,
    isMine: false,
    bookmarked: false,
    edited: false,
  }
}

const textFeed = (count: number) => Array.from({ length: count }, (_, index) => post(index + 1))
const videoFeed = (count: number) => Array.from({ length: count }, (_, index) => post(index + 1, { media: [video(index + 1)] }))

/** Un fournisseur réactif minimal : le même découpage que le moteur (trente par page, curseur de la dernière ligne). */
function fakeSource(initial: readonly PostView[]) {
  // Un instantané du fil par version : la page relit celui de la version qu'elle observe.
  const history: PostView[][] = [[...initial]]
  let version = 0
  const listeners = new Set<() => void>()
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  const getVersion = () => version
  const requests: FeedPageRequest[] = []
  const read = (feed: readonly PostView[], cursor: FeedCursorView | null): FeedPageView => {
    const ordered = [...feed].sort((left, right) => right.createdAt - left.createdAt || (left.id < right.id ? 1 : -1))
    const after = cursor === null ? ordered : ordered.filter((item) => item.createdAt < cursor.publishedAt || (item.createdAt === cursor.publishedAt && item.id < cursor.postId))
    const items = after.slice(0, 30)
    const last = items.at(-1)
    return { items, nextCursor: after.length > 30 && last ? { publishedAt: last.createdAt, postId: last.id } : null, lacunar: false }
  }
  const retry = () => undefined
  const source = {
    kind: "demo",
    useSession: () => session,
    useComments: () => ({ status: "ready", data: [] }),
    useReplies: () => ({ status: "ready", data: [] }),
    useFeedPage(args: FeedPageRequest): FeedPageQuery {
      const current = useSyncExternalStore(subscribe, getVersion, getVersion)
      requests.push(args)
      const at = args.cursor?.publishedAt
      const id = args.cursor?.postId
      return useMemo(() => ({
        data: read(history[current] ?? [], at === undefined || id === undefined ? null : { publishedAt: at, postId: id }),
        isLoading: false,
        error: null,
        retry,
      }), [current, at, id])
    },
    actions: { react: vi.fn(async () => ({ ok: true as const, value: null })) },
  } as unknown as DiasporaleDataSource
  return {
    source,
    requests,
    publish(next: PostView) {
      history.push([next, ...(history[version] ?? [])])
      version += 1
      for (const listener of [...listeners]) listener()
    },
  }
}

function Harness(props: { source: DiasporaleDataSource; onExit?: (id: string | null) => void; locale?: "fr" | "en"; tag?: string; hubCountry?: "CA" }) {
  return (
    <I18nProvider locale={props.locale ?? "fr"}>
      <DataSourceProvider source={props.source}>
        <RoutingProvider routes={routes} Link={Link}>
          <FeedDiscovery
            membership={member}
            scope="mon_pays"
            {...(props.hubCountry === undefined ? {} : { hubCountry: props.hubCountry })}
            {...(props.tag === undefined ? {} : { tag: props.tag })}
            now={BASE}
            emptyFallback={<p>Fil vide de recette</p>}
            onExit={props.onExit ?? (() => undefined)}
          />
        </RoutingProvider>
      </DataSourceProvider>
    </I18nProvider>
  )
}

/** Lecture simulée : `paused`, `play()` et `pause()` tiennent un état et émettent leurs événements. */
const playing = new Set<HTMLMediaElement>()
function mockMedia() {
  vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(function (this: HTMLMediaElement) { return !playing.has(this) })
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    playing.add(this)
    this.dispatchEvent(new Event("play"))
    return Promise.resolve()
  })
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    if (playing.delete(this)) this.dispatchEvent(new Event("pause"))
  })
  return { play, pause }
}

const slides = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>("[data-discovery-slide]")]
const slideWithVideo = (container: HTMLElement) => slides(container).filter((slide) => slide.querySelector("video") !== null).map((slide) => Number(slide.dataset.discoveryIndex))
const activeSlide = (container: HTMLElement) => slides(container).find((slide) => !slide.hasAttribute("inert"))
const playingVideos = () => [...document.querySelectorAll("video")].filter((element) => playing.has(element))
/** La région polie de la découverte (les diapositives d'état ont leur propre statut). */
const announcement = () => document.querySelector<HTMLElement>('p[role="status"][aria-live="polite"]')!

let visibility: DocumentVisibilityState = "visible"
function setVisibility(next: DocumentVisibilityState) {
  visibility = next
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility })
  act(() => { document.dispatchEvent(new Event("visibilitychange")) })
}

function setReducedMotion(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: reduce && query === "(prefers-reduced-motion: reduce)",
      media: query, onchange: null,
      addEventListener: () => undefined, removeEventListener: () => undefined,
      addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
    }),
  })
}

beforeEach(() => {
  playing.clear()
  forgetDiscoveryPosition()
})
afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, "visibilityState")
  Reflect.deleteProperty(window, "matchMedia")
  Reflect.deleteProperty(navigator, "connection")
  forgetDiscoveryPosition()
})

describe("FeedDiscovery — un élément par écran, au clavier et aux boutons", () => {
  it("annonce la position, suit les flèches, Page précédente et suivante, Début et Fin, et rend la main à Échap", async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    const { container } = render(<Harness source={fakeSource(textFeed(35)).source} onExit={onExit} />)

    const region = screen.getByRole("region", { name: t("discovery.label") })
    expect(region).toHaveAttribute("aria-roledescription", t("discovery.roleDescription"))
    expect(announcement()).toHaveTextContent(t("discovery.positionMore", { position: 1, total: 30 }))
    const first = screen.getByRole("group", { name: t("discovery.slide.label", { position: 1, total: 30 }) })
    expect(within(first).getByText("Texte de post-001")).toBeInTheDocument()
    expect(activeSlide(container)).toBe(first)
    expect(screen.getByRole("button", { name: t("discovery.previous") })).toBeDisabled()

    first.focus()
    await user.keyboard("{ArrowDown}")
    expect(document.activeElement).toBe(screen.getByRole("group", { name: t("discovery.slide.label", { position: 2, total: 30 }) }))
    await user.keyboard("{PageDown}{PageDown}")
    expect(activeSlide(container)?.dataset.discoveryIndex).toBe("3")
    await user.keyboard("{PageUp}{ArrowUp}")
    expect(activeSlide(container)?.dataset.discoveryIndex).toBe("1")
    // Les flèches horizontales restent aux galeries : rien ne bouge.
    await user.keyboard("{ArrowRight}{ArrowLeft}")
    expect(activeSlide(container)?.dataset.discoveryIndex).toBe("1")
    await user.keyboard("{End}")
    expect(activeSlide(container)?.dataset.discoveryIndex).toBe(String(29))
    // Près de la fin, la page suivante est venue d'elle-même : le fil est désormais complet.
    expect(activeSlide(container)).toHaveAttribute("aria-label", t("discovery.slide.label", { position: 30, total: 35 }))
    await user.keyboard("{Home}")
    expect(activeSlide(container)?.dataset.discoveryIndex).toBe("0")
    await user.keyboard("{ArrowDown}{ArrowDown}")
    expect(announcement()).toHaveTextContent(t("discovery.position", { position: 3, total: 35 }))
    await user.keyboard("{Escape}")
    expect(onExit).toHaveBeenCalledWith("post-003")
  }, 20_000)

  it("les boutons Précédente et Suivante gardent le focus et annoncent la position, en français et en anglais", async () => {
    const user = userEvent.setup()
    const english = getFixedT("en")
    const { container } = render(<Harness source={fakeSource(textFeed(3)).source} locale="en" />)
    const next = screen.getByRole("button", { name: english("discovery.next") })
    await user.click(next)
    expect(next).toHaveFocus()
    expect(announcement()).toHaveTextContent(english("discovery.position", { position: 2, total: 3 }))
    expect(activeSlide(container)).toHaveAttribute("aria-label", "2 of 3")
    await user.click(next)
    await user.click(next)
    // Après la dernière publication, la diapositive de fin, puis plus rien.
    expect(screen.getByRole("heading", { name: english("discovery.end.title") })).toBeInTheDocument()
    expect(next).toBeDisabled()
    await user.click(screen.getByRole("button", { name: english("discovery.end.top") }))
    expect(activeSlide(container)?.dataset.discoveryIndex).toBe("0")
  })
})

describe("FeedDiscovery — carte de découverte", () => {
  it("un texte long se déroule dans son panneau : ses flèches lui restent, Page suivante change de publication", async () => {
    const user = userEvent.setup()
    const long = { ...post(1), body: "Une très longue publication de recette, pour la diaspora. ".repeat(6) }
    const { container } = render(<Harness source={fakeSource([long, ...textFeed(4).slice(1)]).source} />)
    const toggle = within(activeSlide(container)!).getByRole("button", { name: t("discovery.item.expand") })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    // Auteur, réactions, commentaires et partage restent ceux de la carte du fil.
    expect(within(activeSlide(container)!).getByRole("article", { name: "Autrice de recette" })).toBeInTheDocument()
    expect(within(activeSlide(container)!).getByRole("button", { name: t("post.comments", { count: 0 }) })).toBeInTheDocument()
    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(toggle).toHaveAccessibleName(t("discovery.item.collapse"))
    const panel = within(activeSlide(container)!).getByRole("region", { name: t("discovery.item.panel") })
    expect(toggle).toHaveAttribute("aria-controls", panel.id)
    panel.focus()
    await user.keyboard("{ArrowDown}{ArrowUp}")
    expect(activeSlide(container)?.dataset.discoveryIndex).toBe("0")
    await user.keyboard("{PageDown}")
    expect(activeSlide(container)?.dataset.discoveryIndex).toBe("1")
    // La publication quittée se replie : on la retrouve au début.
    expect(within(slides(container)[0]!).getByRole("button", { name: t("discovery.item.expand") })).toHaveAttribute("aria-expanded", "false")
  })
})

describe("FeedDiscovery — recyclage borné et préchargement", () => {
  it("cent avances : au plus cinq diapositives montées, trois cartes avec médias, lecteurs bornés", () => {
    const media = mockMedia()
    const { container } = render(<Harness source={fakeSource(videoFeed(120)).source} />)
    const next = screen.getByRole("button", { name: t("discovery.next") })
    let mountedMax = 0
    let videosMax = 0
    let playersMax = 0
    for (let step = 0; step < 100; step += 1) {
      fireEvent.click(next)
      mountedMax = Math.max(mountedMax, slides(container).length)
      videosMax = Math.max(videosMax, container.querySelectorAll("video").length)
      playersMax = Math.max(playersMax, registeredMediaPlayerCount())
      expect(playingVideos().length).toBeLessThanOrEqual(1)
    }
    expect(activeSlide(container)?.getAttribute("aria-label")).toBe(t("discovery.slide.label", { position: 101, total: 120 }))
    // Bornes atteintes et jamais dépassées : cinq montées, trois avec médias, trois lecteurs inscrits.
    expect(mountedMax).toBe(5)
    expect(videosMax).toBe(3)
    expect(playersMax).toBe(3)
    // Une lecture par élément atteint, jamais deux à la fois.
    expect(media.play.mock.calls.length).toBeGreaterThanOrEqual(100)
    expect(playingVideos()).toHaveLength(1)
  }, 30_000)

  it("ne précharge que la suivante (métadonnées seules) et une précédente déjà vue", async () => {
    mockMedia()
    const user = userEvent.setup()
    const { container } = render(<Harness source={fakeSource(videoFeed(10)).source} />)
    expect(slideWithVideo(container)).toEqual([0, 1])
    for (const element of container.querySelectorAll("video")) {
      expect(element).toHaveAttribute("preload", "metadata")
      expect(element).not.toHaveAttribute("autoplay")
    }
    const first = activeSlide(container)!
    first.focus()
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}")
    // Actives 3 : la 2 a été vue, la 4 est la suivante ; la 1 (vue) et la 5 restent en veille.
    expect(slides(container).map((slide) => Number(slide.dataset.discoveryIndex))).toEqual([1, 2, 3, 4, 5])
    expect(slideWithVideo(container)).toEqual([2, 3, 4])
  })
})

describe("FeedDiscovery — lecteur unique", () => {
  it("seule l'active joue, son coupé au départ ; changer d'élément arrête la précédente", async () => {
    const media = mockMedia()
    const user = userEvent.setup()
    const { container } = render(<Harness source={fakeSource(videoFeed(4)).source} />)
    const [firstVideo, secondVideo] = [...container.querySelectorAll("video")]
    expect(playingVideos()).toEqual([firstVideo])
    expect(firstVideo!.muted).toBe(true)
    expect(secondVideo).toBeDefined()
    expect(playing.has(secondVideo!)).toBe(false)

    await user.click(screen.getByRole("button", { name: t("discovery.next") }))
    expect(playing.has(firstVideo!)).toBe(false)
    expect(playingVideos()).toEqual([secondVideo])
    expect(secondVideo!.muted).toBe(true)
    expect(media.pause).toHaveBeenCalled()
  })

  it("respecte la pause manuelle : ni l'onglet masqué puis rendu, ni un nouveau rendu ne la lèvent", () => {
    mockMedia()
    const { container } = render(<Harness source={fakeSource(videoFeed(3)).source} />)
    const element = container.querySelector("video")!
    expect(playing.has(element)).toBe(true)
    act(() => { element.pause() })
    expect(playing.has(element)).toBe(false)

    setVisibility("hidden")
    setVisibility("visible")
    expect(playing.has(element)).toBe(false)
  })

  it("s'arrête quand l'onglet est masqué et reprend, son coupé, à son retour", () => {
    mockMedia()
    const { container } = render(<Harness source={fakeSource(videoFeed(3)).source} />)
    const element = container.querySelector("video")!
    setVisibility("hidden")
    expect(playing.has(element)).toBe(false)
    setVisibility("visible")
    expect(playing.has(element)).toBe(true)
    expect(element.muted).toBe(true)
  })

  it("s'arrête quand la fenêtre de lecture quitte l'écran et reprend quand elle y revient", () => {
    mockMedia()
    let notify: (visible: boolean) => void = () => undefined
    class FakeIntersectionObserver {
      constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
        notify = (visible) => callback([{ isIntersecting: visible, intersectionRatio: visible ? 1 : 0 } as IntersectionObserverEntry])
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver)
    try {
      const { container } = render(<Harness source={fakeSource(videoFeed(3)).source} />)
      const element = container.querySelector("video")!
      expect(playing.has(element)).toBe(true)
      act(() => notify(false))
      expect(playing.has(element)).toBe(false)
      act(() => notify(true))
      expect(playing.has(element)).toBe(true)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("un appel coupe la lecture et l'interdit jusqu'à sa fin ; l'événement d'arrêt coupe une fois", async () => {
    const media = mockMedia()
    const user = userEvent.setup()
    const { container } = render(<Harness source={fakeSource(videoFeed(4)).source} />)
    const firstVideo = container.querySelector("video")!
    expect(playing.has(firstVideo)).toBe(true)

    let release = () => undefined as void
    act(() => { release = suspendMediaPlayback("call") })
    expect(playingVideos()).toEqual([])
    await user.click(screen.getByRole("button", { name: t("discovery.next") }))
    expect(playingVideos()).toEqual([])
    // Un geste pendant l'appel est refusé lui aussi.
    const current = activeSlide(container)!.querySelector("video")!
    act(() => { current.play().catch(() => undefined) })
    expect(playing.has(current)).toBe(false)
    act(() => release())
    expect(playingVideos()).toEqual([current])

    media.play.mockClear()
    act(() => { window.dispatchEvent(new Event(MEDIA_PLAYBACK_STOP_EVENT)) })
    expect(playingVideos()).toEqual([])
  })

  it("mouvement réduit : aucune lecture automatique, même en changeant d'élément", async () => {
    setReducedMotion(true)
    const media = mockMedia()
    const user = userEvent.setup()
    const { container } = render(<Harness source={fakeSource(videoFeed(4)).source} />)
    expect(container.querySelectorAll("video").length).toBeGreaterThan(0)
    await user.click(screen.getByRole("button", { name: t("discovery.next") }))
    await user.click(screen.getByRole("button", { name: t("discovery.next") }))
    expect(media.play).not.toHaveBeenCalled()
    expect(playingVideos()).toEqual([])
  })

  it("économie de données : aucune lecture automatique et rien de préchargé, pas même la suivante", () => {
    Object.defineProperty(navigator, "connection", { configurable: true, value: Object.assign(new EventTarget(), { saveData: true }) })
    const media = mockMedia()
    const { container } = render(<Harness source={fakeSource(videoFeed(4)).source} />)
    expect(slideWithVideo(container)).toEqual([0])
    expect(media.play).not.toHaveBeenCalled()
  })
})

describe("FeedDiscovery — même source que la liste, actualisation et retour", () => {
  it("lit le port avec la portée, le pays et le filtre du fil, puis la page suivante au curseur serveur", () => {
    const fake = fakeSource(textFeed(40))
    render(<Harness source={fake.source} hubCountry="CA" tag=" ÉTÉ " />)
    expect(fake.requests[0]).toEqual({ scope: "mon_pays", hubCountry: "CA", tag: "été", cursor: null })
    const next = screen.getByRole("button", { name: t("discovery.next") })
    for (let step = 0; step < 27; step += 1) fireEvent.click(next)
    expect(fake.requests).toContainEqual({ scope: "mon_pays", hubCountry: "CA", tag: "été", cursor: { publishedAt: BASE - 30_000, postId: "post-030" } })
    expect(announcement()).toHaveTextContent(t("discovery.position", { position: 28, total: 40 }))
  })

  it("une nouvelle publication attend « Actualiser » sans déplacer l'élément regardé", async () => {
    const fake = fakeSource(textFeed(5))
    const user = userEvent.setup()
    const { container } = render(<Harness source={fake.source} />)
    await user.click(screen.getByRole("button", { name: t("discovery.next") }))
    act(() => fake.publish(post("nouvelle", { at: BASE + 60_000 })))
    expect(activeSlide(container)?.getAttribute("aria-label")).toBe(t("discovery.slide.label", { position: 2, total: 5 }))
    expect(within(activeSlide(container)!).getByText("Texte de post-002")).toBeInTheDocument()
    const refresh = screen.getByRole("button", { name: `${t("discovery.refresh.label")} ${t("discovery.refresh.pending", { count: 1 })}` })
    await user.click(refresh)
    expect(activeSlide(container)?.getAttribute("aria-label")).toBe(t("discovery.slide.label", { position: 1, total: 6 }))
    expect(within(activeSlide(container)!).getByText("Texte de nouvelle")).toBeInTheDocument()
    expect(announcement()).toHaveTextContent(`${t("discovery.refresh.added", { count: 1 })} ${t("discovery.position", { position: 1, total: 6 })}`)
    expect(screen.getByRole("button", { name: t("discovery.refresh.label") })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: t("discovery.refresh.label") }))
    expect(announcement()).toHaveTextContent(t("discovery.refresh.upToDate"))
  })

  it("rouvre sur la même publication après être sortie du mode, et la mémoire en garde la trace", async () => {
    const fake = fakeSource(textFeed(12))
    const user = userEvent.setup()
    const first = render(<Harness source={fake.source} />)
    activeSlide(first.container)!.focus()
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}")
    first.unmount()

    const key = discoveryPositionKey({ source: "demo", personId: member.personId, scope: "mon_pays", country: "FR" })
    expect(readDiscoveryPosition(key)?.activeId).toBe("post-006")
    const again = render(<Harness source={fake.source} />)
    expect(activeSlide(again.container)?.getAttribute("aria-label")).toBe(t("discovery.slide.label", { position: 6, total: 12 }))
    // Un autre contexte (autre portée, autre personne) efface la trace au lieu de la réutiliser.
    expect(readDiscoveryPosition(discoveryPositionKey({ source: "demo", personId: "person-autre", scope: "mon_pays", country: "FR" }))).toBeNull()
    expect(readDiscoveryPosition(key)).toBeNull()
  })

  it("un fil vide montre l'état vide de la liste", () => {
    render(<Harness source={fakeSource([]).source} />)
    expect(screen.getByText("Fil vide de recette")).toBeInTheDocument()
  })

  it("une touche dans la feuille des commentaires (rendue ailleurs) ne change pas de publication ni ne quitte le mode", async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    const { container } = render(<Harness source={fakeSource(textFeed(4)).source} onExit={onExit} />)
    await user.click(within(activeSlide(container)!).getByRole("button", { name: t("post.comments", { count: 0 }) }))
    const sheet = await screen.findByRole("dialog", { name: t("comments.title") })
    expect(container.contains(sheet)).toBe(false)
    fireEvent.keyDown(within(sheet).getByRole("button", { name: t("comments.close") }), { key: "ArrowDown" })
    fireEvent.keyDown(within(sheet).getByRole("button", { name: t("comments.close") }), { key: "PageDown" })
    expect(activeSlide(container)?.dataset.discoveryIndex).toBe("0")
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(onExit).not.toHaveBeenCalled()
    expect(activeSlide(container)?.dataset.discoveryIndex).toBe("0")
  })
})
