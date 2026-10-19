// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY, type FeedScope } from "@diasporale/domain"
import { RoutingProvider, useRouting, type FeatureRoutes } from "@diasporale/features"
import type { FeedCursorView, FeedPageView, MembershipView, PostView, ReactionKind } from "@diasporale/features/data"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useEffect, type ButtonHTMLAttributes, type HTMLAttributes } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FeedPages, ProfilePostPages, type FeedPagesProps, type ProfilePostPagesProps } from "./feed-pages"
import { routes } from "@/lib/routes"

interface PageResult {
  data: FeedPageView | undefined
  isLoading: boolean
  error: "unknown" | null
  retry: () => void
}

const mocks = vi.hoisted(() => ({
  kind: "engine" as "engine" | "demo",
  pages: new Map<string, PageResult>(),
  profilePages: new Map<string, PageResult>(),
  read: vi.fn(),
  readProfile: vi.fn(),
  mounted: vi.fn(),
  unmounted: vi.fn(),
  profileMounted: vi.fn(),
  profileUnmounted: vi.fn(),
  react: vi.fn(),
  error: vi.fn(),
  card: vi.fn(),
}))

function cursorKey(cursor: FeedCursorView | null | undefined) {
  return cursor ? `${cursor.publishedAt}:${cursor.postId}` : "first"
}

// Les constantes et règles réelles du port restent exportées (les gestes du mur des pages
// en lisent au chargement) ; seules la source et ses lectures sont remplacées.
vi.mock("@diasporale/features/data", async (original) => ({
  ...(await original<typeof import("@diasporale/features/data")>()),
  useDataSource: () => ({ kind: mocks.kind }),
  useActions: () => ({ react: mocks.react }),
  useFeedPage: (args: { scope: FeedScope; hubCountry?: string; tag?: string; cursor?: FeedCursorView | null }) => {
    const key = cursorKey(args.cursor)
    mocks.read(args)
    useEffect(() => {
      mocks.mounted(key)
      return () => { mocks.unmounted(key) }
    }, [key])
    return mocks.pages.get(key) ?? { data: undefined, isLoading: true, error: null, retry: vi.fn() }
  },
  useProfilePostsPage: (args: { handle: string; cursor?: FeedCursorView | null }) => {
    const key = `${args.handle}:${cursorKey(args.cursor)}`
    mocks.readProfile(args)
    useEffect(() => {
      mocks.profileMounted(key)
      return () => { mocks.profileUnmounted(key) }
    }, [key])
    return mocks.profilePages.get(key) ?? { data: undefined, isLoading: true, error: null, retry: vi.fn() }
  },
}))

vi.mock("@diasporale/features/i18n/client", () => ({
  useDiasporaleT: () => ({ t: (key: string, options?: { count?: number }) => options?.count === undefined ? key : `${key}:${options.count}` }),
}))

vi.mock("sonner", () => ({ toast: { error: mocks.error } }))

// Les vraies règles de chaîne du moteur restent actives ; seules les cartes,
// leurs propres dialogues et les lectures réseau sont remplacés.
vi.mock("@diasporale/features", async (original) => {
  const real = await original<typeof import("@diasporale/features")>()
  return {
    RoutingProvider: real.RoutingProvider,
    useRouting: real.useRouting,
    Button: ({ children, variant: _variant, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => <button type="button" {...props}>{children}</button>,
    Card: (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />,
    Skeleton: () => <span data-testid="skeleton" />,
    PostCard: (props: { post: PostView; canReact: boolean; onReact: (kind: ReactionKind | null) => Promise<void> }) => {
      const { routes } = useRouting()
      mocks.card(props)
      return (
        <article aria-label={props.post.id}>
          <p>{props.post.body}</p>
          <a href={routes.feed("été")}>#ÉTÉ</a>
          <button type="button" disabled={!props.canReact} onClick={() => void props.onReact("like")}>Réagir</button>
        </article>
      )
    },
  }
})

const membership: MembershipView = {
  personId: "persons_awa",
  handle: "awa.demo",
  displayName: "Awa",
  status: "declaree",
  badges: ["community"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1,
  verifiedSince: null,
  sponsoredBy: null,
  attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" },
  canPublish: true,
  rateTier: "reinforced",
  directoryVisibility: "hidden",
}

const second: FeedCursorView = { publishedAt: 200, postId: "post-second" }
const third: FeedCursorView = { publishedAt: 100, postId: "post-third" }
const shifted: FeedCursorView = { publishedAt: 250, postId: "post-shifted" }

function post(id: string, body = id): PostView {
  return {
    id,
    author: { kind: "person", id: "person-author", handle: "auteur", displayName: "Auteur", badges: [] },
    body,
    media: [],
    share: null,
    shareCount: 0,
    scope: { reach: "local", country: "FR" },
    audience: "public",
    visibility: "network",
    moderation: "published",
    createdAt: 300,
    reactionCount: 0,
    commentCount: 0,
    myReaction: null,
    isMine: false,
    bookmarked: false,
    edited: false,
  }
}

function setPage(cursor: FeedCursorView | null, items: readonly PostView[], nextCursor: FeedCursorView | null, overrides: Partial<PageResult> = {}) {
  const result: PageResult = { data: { items, nextCursor, lacunar: false }, isLoading: false, error: null, retry: vi.fn(), ...overrides }
  mocks.pages.set(cursorKey(cursor), result)
  return result
}

function tree(overrides: Partial<FeedPagesProps> = {}) {
  const featureRoutes: FeatureRoutes = {
    profile: routes.profile, post: routes.post, page: routes.page, hub: routes.hub,
    feed: (tag, context) => routes.feed(context?.scope, tag, context?.country),
    sponsor: routes.sponsor, settings: routes.settings, attestation: routes.attestation, enter: routes.enter,
  }
  return (
    <RoutingProvider routes={featureRoutes} Link={({ children, ...rest }) => <a {...rest}>{children}</a>}>
      <FeedPages membership={membership} scope="mon_pays" now={1_000} emptyFallback={<p>Fil vide confirmé</p>} {...overrides} />
    </RoutingProvider>
  )
}

function setProfilePage(cursor: FeedCursorView | null, items: readonly PostView[], nextCursor: FeedCursorView | null, overrides: Partial<PageResult> = {}, handle = "awa.demo") {
  const result: PageResult = { data: { items, nextCursor, lacunar: false }, isLoading: false, error: null, retry: vi.fn(), ...overrides }
  mocks.profilePages.set(`${handle}:${cursorKey(cursor)}`, result)
  return result
}

function profileTree(overrides: Partial<ProfilePostPagesProps> = {}) {
  const featureRoutes: FeatureRoutes = {
    profile: routes.profile, post: routes.post, page: routes.page, hub: routes.hub,
    feed: (tag, context) => routes.feed(context?.scope, tag, context?.country),
    sponsor: routes.sponsor, settings: routes.settings, attestation: routes.attestation, enter: routes.enter,
  }
  return (
    <RoutingProvider routes={featureRoutes} Link={({ children, ...rest }) => <a {...rest}>{children}</a>}>
      <ProfilePostPages membership={membership} handle="awa.demo" now={1_000} emptyFallback={<p>Mur vide confirmé</p>} {...overrides} />
    </RoutingProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.kind = "engine"
  mocks.pages.clear()
  mocks.profilePages.clear()
  mocks.react.mockResolvedValue({ ok: true, value: null })
})

afterEach(cleanup)

describe("ProfilePostPages — le même chaînage pour le mur personnel", () => {
  it("lit seulement le mur et garde l'épinglée déjà projetée une seule fois, dans l'ordre reçu", () => {
    setProfilePage(null, [post("épinglée"), post("publication courante")], second)
    setProfilePage(second, [post("publication antérieure")], null)
    render(profileTree({ handle: " @AWA.DEMO " }))

    expect(mocks.readProfile).toHaveBeenLastCalledWith({ handle: "awa.demo", cursor: null })
    expect(mocks.read).not.toHaveBeenCalled()
    expect(screen.getAllByRole("link", { name: "#ÉTÉ" })[0]).toHaveAttribute("href", "/fil?tag=%C3%A9t%C3%A9")
    expect(screen.queryByText("feed.pagination.added:1")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))

    expect(screen.getAllByRole("article").map((article) => article.getAttribute("aria-label"))).toEqual([
      "épinglée", "publication courante", "publication antérieure",
    ])
    expect(screen.getAllByRole("article", { name: "épinglée" })).toHaveLength(1)
    expect(mocks.readProfile).toHaveBeenLastCalledWith({ handle: "awa.demo", cursor: second })
    expect(screen.queryByRole("button", { name: "feed.pagination.loadMore" })).not.toBeInTheDocument()
    expect(screen.getByText("feed.pagination.added:1")).toBeInTheDocument()
  })

  it("conserve le début du mur et le cache d'une page en erreur, puis reprend son abonnement", () => {
    setProfilePage(null, [post("début du mur")], second)
    const failed = setProfilePage(second, [post("suite en cache")], null, { error: "unknown" })
    const view = render(profileTree())
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))

    expect(screen.getByRole("alert")).toHaveTextContent("feed.pagination.errorBody")
    expect(screen.getByRole("article", { name: "début du mur" })).toBeInTheDocument()
    expect(screen.getByRole("article", { name: "suite en cache" })).toBeInTheDocument()
    expect(screen.queryByText("Mur vide confirmé")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.retry" }))
    expect(failed.retry).toHaveBeenCalledOnce()

    setProfilePage(second, [post("suite rétablie")], null)
    view.rerender(profileTree())
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByRole("article", { name: "suite rétablie" })).toBeInTheDocument()
    expect(mocks.profileMounted).toHaveBeenCalledTimes(2)
    expect(mocks.read).not.toHaveBeenCalled()
  })

  it("réaligne le mur quand sa frontière amont change et ignore l'ancien terminal", () => {
    setProfilePage(null, [post("début du mur")], second)
    setProfilePage(second, [post("ancienne suite")], third)
    setProfilePage(third, [post("ancienne fin")], null)
    setProfilePage(shifted, [post("nouvelle suite")], third)
    const view = render(profileTree())
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))

    setProfilePage(null, [post("nouveau début du mur")], shifted)
    setProfilePage(third, [post("résultat terminal tardif")], null)
    view.rerender(profileTree())

    expect(screen.getByRole("article", { name: "nouvelle suite" })).toBeInTheDocument()
    expect(screen.queryByRole("article", { name: "ancienne suite" })).not.toBeInTheDocument()
    expect(screen.queryByRole("article", { name: "résultat terminal tardif" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "feed.pagination.loadMore" })).toBeInTheDocument()
    expect(mocks.profileUnmounted).toHaveBeenCalledWith(`awa.demo:${cursorKey(second)}`)
    expect(mocks.profileUnmounted).toHaveBeenCalledWith(`awa.demo:${cursorKey(third)}`)
  })

  it.each(["handle", "person", "source"] as const)("réinitialise le mur après changement de %s", (kind) => {
    setProfilePage(null, [post("début du mur")], second)
    setProfilePage(second, [post("suite du mur")], null)
    setProfilePage(null, [post("autre profil")], second, {}, "autre.demo")
    const view = render(profileTree())
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))

    const overrides: Partial<ProfilePostPagesProps> = kind === "handle" ? { handle: "autre.demo" }
      : kind === "person" ? { membership: { ...membership, personId: "persons_autre" } } : {}
    if (kind === "source") mocks.kind = "demo"
    view.rerender(profileTree(overrides))

    expect(screen.queryByRole("article", { name: "suite du mur" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "feed.pagination.loadMore" })).toBeInTheDocument()
    expect(mocks.profileUnmounted).toHaveBeenCalledWith(`awa.demo:${cursorKey(second)}`)
    expect(mocks.profileMounted.mock.calls.filter(([key]) => key.endsWith(":first"))).toHaveLength(2)
    expect(mocks.read).not.toHaveBeenCalled()
  })

  it("conserve la chaîne quand seul l'habillage du même handle normalisé change", () => {
    setProfilePage(null, [post("début du mur")], second)
    setProfilePage(second, [post("suite du mur")], null)
    const view = render(profileTree())
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))
    view.rerender(profileTree({ handle: " @AWA.DEMO " }))

    expect(screen.getByRole("article", { name: "suite du mur" })).toBeInTheDocument()
    expect(mocks.profileUnmounted).not.toHaveBeenCalled()
    expect(mocks.profileMounted).toHaveBeenCalledTimes(2)
    expect(mocks.readProfile).toHaveBeenLastCalledWith({ handle: "awa.demo", cursor: second })
  })

  it("ferme aussi les réactions du mur pour le membre en attente", async () => {
    setProfilePage(null, [post("début du mur")], null)
    render(profileTree({ membership: { ...membership, status: "en_attente", canPublish: false } }))

    expect(within(screen.getByRole("article")).getByRole("button", { name: "Réagir" })).toBeDisabled()
    const card = mocks.card.mock.lastCall?.[0] as { onReact: (kind: ReactionKind | null) => Promise<void> }
    await card.onReact("like")
    expect(mocks.react).not.toHaveBeenCalled()
  })
})

describe("FeedPages — abonnements réactifs du fil DIASPORALE", () => {
  it("attend le geste Voir plus, conserve la première page et clôt la seconde", () => {
    setPage(null, [post("première")], second)
    setPage(second, [post("seconde")], null)
    render(tree())

    expect(mocks.read.mock.calls.every(([args]) => args.cursor === null)).toBe(true)
    expect(screen.queryByText("feed.pagination.added:1")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))

    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.getByRole("article", { name: "première" })).toBeInTheDocument()
    expect(screen.getByRole("article", { name: "seconde" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "feed.pagination.loadMore" })).not.toBeInTheDocument()
    expect(screen.getByText("feed.pagination.added:1")).toHaveAttribute("aria-live", "polite")
  })

  it.each([undefined, "gabon"])("continue après une page vide munie d'un curseur, filtre %s", (tag) => {
    setPage(null, [], second)
    setPage(second, [post("accessible après filtrage")], null)
    render(tree(tag === undefined ? {} : { tag }))

    expect(screen.queryByText("Fil vide confirmé")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))
    expect(screen.getByRole("article", { name: "accessible après filtrage" })).toBeInTheDocument()
    expect(screen.queryByText("Fil vide confirmé")).not.toBeInTheDocument()
  })

  it("garde le bouton et le focus pendant le chargement de la page demandée", () => {
    setPage(null, [post("première")], second)
    mocks.pages.set(cursorKey(second), { data: undefined, isLoading: true, error: null, retry: vi.fn() })
    const view = render(tree())
    const button = screen.getByRole("button", { name: "feed.pagination.loadMore" })
    button.focus()
    fireEvent.click(button)

    expect(screen.getByRole("button", { name: "feed.pagination.loading" })).toBe(button)
    expect(button).toBeDisabled()
    expect(button).toHaveFocus()
    expect(screen.getByRole("article", { name: "première" })).toBeInTheDocument()
    expect(screen.queryByText("feed.pagination.added:1")).not.toBeInTheDocument()

    setPage(second, [post("seconde")], third)
    view.rerender(tree())
    expect(screen.getByRole("button", { name: "feed.pagination.loadMore" })).toBe(button)
    expect(button).toBeEnabled()
    expect(button).toHaveFocus()
    expect(screen.getByText("feed.pagination.added:1")).toBeInTheDocument()
  })

  it("n'affiche l'état vide global qu'une fois toutes les pages vides et la fin confirmée", () => {
    setPage(null, [], second)
    setPage(second, [], null)
    render(tree())

    expect(screen.queryByText("Fil vide confirmé")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))
    expect(screen.getByText("Fil vide confirmé")).toBeInTheDocument()
    expect(screen.getByText("feed.pagination.noneAdded")).toBeInTheDocument()
  })

  it("conserve les publications lors d'une erreur de seconde page puis reprend cette même lecture", () => {
    setPage(null, [post("première")], second)
    const failed = setPage(second, [post("seconde en cache")], null, { error: "unknown" })
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))

    expect(screen.getByRole("article", { name: "première" })).toBeInTheDocument()
    expect(screen.getByRole("article", { name: "seconde en cache" })).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("feed.pagination.errorTitle")
    expect(screen.queryByText("Fil vide confirmé")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.retry" }))
    expect(failed.retry).toHaveBeenCalledOnce()

    setPage(second, [post("seconde rétablie")], null)
    view.rerender(tree())
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByRole("article", { name: "seconde rétablie" })).toBeInTheDocument()
    expect(screen.getByText("feed.pagination.added:1")).toBeInTheDocument()
    expect(mocks.mounted).toHaveBeenCalledTimes(2)
  })

  it("donne la priorité à une erreur initiale sur l'état vide même avec un résultat vide en cache", () => {
    setPage(null, [], null, { error: "unknown" })
    render(tree())

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.queryByText("Fil vide confirmé")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "feed.pagination.loadMore" })).not.toBeInTheDocument()
  })

  it("dit le chargement initial sans conclure à une fin ni à un fil vide", () => {
    render(tree())

    expect(screen.getByText("feed.pagination.loading")).toBeInTheDocument()
    expect(screen.getByTestId("skeleton")).toBeInTheDocument()
    expect(screen.queryByText("Fil vide confirmé")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "feed.pagination.loadMore" })).not.toBeInTheDocument()
  })

  it("garde chaque page montée réactive tant que sa frontière ne change pas", () => {
    setPage(null, [post("première")], second)
    setPage(second, [post("seconde")], null)
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))

    setPage(null, [post("première", "Première modifiée")], second)
    setPage(second, [post("seconde", "Seconde modifiée")], null)
    view.rerender(tree())

    expect(screen.getByText("Première modifiée")).toBeInTheDocument()
    expect(screen.getByText("Seconde modifiée")).toBeInTheDocument()
    expect(mocks.unmounted).not.toHaveBeenCalled()
  })

  it("réaligne une frontière amont et abandonne la fin annoncée par l'ancienne page terminale", () => {
    setPage(null, [post("première")], second)
    setPage(second, [post("ancienne seconde")], third)
    setPage(third, [post("ancienne terminale")], null)
    setPage(shifted, [post("nouvelle seconde")], third)
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))
    expect(screen.queryByRole("button", { name: "feed.pagination.loadMore" })).not.toBeInTheDocument()

    setPage(null, [post("première", "Frontière déplacée")], shifted)
    // Cet ancien terminal publie aussi un nouveau résultat au même rendu.
    setPage(third, [post("ancienne terminale", "Résultat tardif")], null)
    view.rerender(tree())

    expect(screen.getByRole("article", { name: "nouvelle seconde" })).toBeInTheDocument()
    expect(screen.queryByRole("article", { name: "ancienne seconde" })).not.toBeInTheDocument()
    expect(screen.queryByText("Résultat tardif")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "feed.pagination.loadMore" })).toBeInTheDocument()
    expect(mocks.unmounted).toHaveBeenCalledWith(cursorKey(second))
    expect(mocks.unmounted).toHaveBeenCalledWith(cursorKey(third))
  })

  it.each(["scope", "hub", "residence", "person", "source", "tag"] as const)("remet la chaîne à zéro après changement de %s", (kind) => {
    setPage(null, [post("première")], second)
    setPage(second, [post("seconde")], null)
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))
    const overrides: Partial<FeedPagesProps> = kind === "scope" ? { scope: "diaspora" }
      : kind === "hub" ? { hubCountry: "CA" }
        : kind === "residence" ? { membership: { ...membership, facet: { ...membership.facet, countryOfResidence: "CA" } } }
          : kind === "person" ? { membership: { ...membership, personId: "persons_autre" } }
            : kind === "tag" ? { tag: "été" } : {}
    if (kind === "source") mocks.kind = "demo"
    view.rerender(tree(overrides))

    expect(screen.queryByRole("article", { name: "seconde" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "feed.pagination.loadMore" })).toBeInTheDocument()
    expect(mocks.unmounted).toHaveBeenCalledWith(cursorKey(second))
    expect(mocks.mounted.mock.calls.filter(([key]) => key === "first")).toHaveLength(2)
  })

  it("transmet le tag canonique à chaque page sans toucher au curseur, à la portée ni au pays du hub", () => {
    setPage(null, [post("première")], second)
    setPage(second, [post("seconde")], null)
    render(tree({ scope: "mon_pays", hubCountry: "CA", tag: " İSTANBUL " }))
    expect(mocks.read).toHaveBeenLastCalledWith({ scope: "mon_pays", hubCountry: "CA", tag: "i̇stanbul", cursor: null })
    expect(screen.getByRole("link", { name: "#ÉTÉ" })).toHaveAttribute("href", "/fil?scope=mon_pays&tag=%C3%A9t%C3%A9&country=CA")
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))
    expect(mocks.read).toHaveBeenLastCalledWith({ scope: "mon_pays", hubCountry: "CA", tag: "i̇stanbul", cursor: second })
  })

  it("retirer ou remplacer le tag démonte les anciennes pages et repart de la première", () => {
    setPage(null, [post("première")], second)
    setPage(second, [post("seconde")], null)
    const view = render(tree({ tag: "gabon" }))
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))
    view.rerender(tree({ tag: "été" }))
    expect(screen.queryByRole("article", { name: "seconde" })).not.toBeInTheDocument()
    expect(mocks.read).toHaveBeenLastCalledWith({ scope: "mon_pays", tag: "été", cursor: null })
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))
    view.rerender(tree())
    expect(screen.queryByRole("article", { name: "seconde" })).not.toBeInTheDocument()
    expect(mocks.read).toHaveBeenLastCalledWith({ scope: "mon_pays", cursor: null })
  })

  it("un tag de même forme canonique ne réinitialise pas sa chaîne", () => {
    setPage(null, [post("première")], second)
    setPage(second, [post("seconde")], null)
    const view = render(tree({ tag: " ÉTÉ " }))
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))
    view.rerender(tree({ tag: "été" }))
    expect(screen.getByRole("article", { name: "seconde" })).toBeInTheDocument()
    expect(mocks.unmounted).not.toHaveBeenCalled()
  })

  it("transmet le hub et l'horloge à chaque carte et prévient d'une page lacunaire", () => {
    setPage(null, [post("première")], null, { data: { items: [post("première")], nextCursor: null, lacunar: true } })
    render(tree({ hubCountry: "CA", now: 12_345 }))

    expect(mocks.read).toHaveBeenLastCalledWith({ scope: "mon_pays", hubCountry: "CA", cursor: null })
    expect(mocks.card).toHaveBeenLastCalledWith(expect.objectContaining({ hubCountry: "CA", now: 12_345 }))
    expect(screen.getByText("feed.pagination.lacunar")).toBeInTheDocument()
  })

  it("ferme les réactions d'un membre en attente, y compris son callback", async () => {
    setPage(null, [post("première")], null)
    render(tree({ membership: { ...membership, status: "en_attente", canPublish: false } }))

    expect(within(screen.getByRole("article")).getByRole("button", { name: "Réagir" })).toBeDisabled()
    const card = mocks.card.mock.lastCall?.[0] as { onReact: (kind: ReactionKind | null) => Promise<void> }
    await card.onReact("like")
    expect(mocks.react).not.toHaveBeenCalled()
  })

  it("traduit les refus d'une réaction avec les codes fermés existants", async () => {
    setPage(null, [post("première")], null)
    mocks.react.mockResolvedValue({ ok: false, code: "status_insufficient" })
    render(tree())
    const card = mocks.card.mock.lastCall?.[0] as { onReact: (kind: ReactionKind | null) => Promise<void> }
    await card.onReact("like")

    expect(mocks.react).toHaveBeenCalledExactlyOnceWith("première", "like")
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith("errors.status_insufficient")
  })
})
