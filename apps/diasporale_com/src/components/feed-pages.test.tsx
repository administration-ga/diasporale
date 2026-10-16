// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY, type FeedScope } from "@diasporale/domain"
import type { FeedCursorView, FeedPageView, MembershipView, PostView, ReactionKind } from "@diasporale/features/data"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useEffect, type ButtonHTMLAttributes, type HTMLAttributes } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FeedPages, type FeedPagesProps } from "./feed-pages"

interface PageResult {
  data: FeedPageView | undefined
  isLoading: boolean
  error: "unknown" | null
  retry: () => void
}

const mocks = vi.hoisted(() => ({
  kind: "engine" as "engine" | "demo",
  pages: new Map<string, PageResult>(),
  read: vi.fn(),
  mounted: vi.fn(),
  unmounted: vi.fn(),
  react: vi.fn(),
  error: vi.fn(),
  card: vi.fn(),
}))

function cursorKey(cursor: FeedCursorView | null | undefined) {
  return cursor ? `${cursor.publishedAt}:${cursor.postId}` : "first"
}

vi.mock("@diasporale/features/data", () => ({
  useDataSource: () => ({ kind: mocks.kind }),
  useActions: () => ({ react: mocks.react }),
  useFeedPage: (args: { scope: FeedScope; hubCountry?: string; cursor?: FeedCursorView | null }) => {
    const key = cursorKey(args.cursor)
    mocks.read(args)
    useEffect(() => {
      mocks.mounted(key)
      return () => { mocks.unmounted(key) }
    }, [key])
    return mocks.pages.get(key) ?? { data: undefined, isLoading: true, error: null, retry: vi.fn() }
  },
}))

vi.mock("@diasporale/features/i18n/client", () => ({
  useDiasporaleT: () => ({ t: (key: string, options?: { count?: number }) => options?.count === undefined ? key : `${key}:${options.count}` }),
}))

vi.mock("sonner", () => ({ toast: { error: mocks.error } }))

// Les vraies règles de chaîne du moteur restent actives ; seules les cartes,
// leurs propres dialogues et les lectures réseau sont remplacés.
vi.mock("@diasporale/features", () => ({
  Button: ({ children, variant: _variant, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => <button type="button" {...props}>{children}</button>,
  Card: (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  Skeleton: () => <span data-testid="skeleton" />,
  PostCard: (props: { post: PostView; canReact: boolean; onReact: (kind: ReactionKind | null) => Promise<void> }) => {
    mocks.card(props)
    return (
      <article aria-label={props.post.id}>
        <p>{props.post.body}</p>
        <button type="button" disabled={!props.canReact} onClick={() => void props.onReact("like")}>Réagir</button>
      </article>
    )
  },
}))

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
  return <FeedPages membership={membership} scope="mon_pays" now={1_000} emptyFallback={<p>Fil vide confirmé</p>} {...overrides} />
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.kind = "engine"
  mocks.pages.clear()
  mocks.react.mockResolvedValue({ ok: true, value: null })
})

afterEach(cleanup)

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

  it("continue après une page vide munie d'un curseur sans annoncer de fil vide", () => {
    setPage(null, [], second)
    setPage(second, [post("accessible après filtrage")], null)
    render(tree())

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

  it.each(["scope", "hub", "residence", "person", "source"] as const)("remet la chaîne à zéro après changement de %s", (kind) => {
    setPage(null, [post("première")], second)
    setPage(second, [post("seconde")], null)
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: "feed.pagination.loadMore" }))
    const overrides: Partial<FeedPagesProps> = kind === "scope" ? { scope: "diaspora" }
      : kind === "hub" ? { hubCountry: "CA" }
        : kind === "residence" ? { membership: { ...membership, facet: { ...membership.facet, countryOfResidence: "CA" } } }
          : kind === "person" ? { membership: { ...membership, personId: "persons_autre" } } : {}
    if (kind === "source") mocks.kind = "demo"
    view.rerender(tree(overrides))

    expect(screen.queryByRole("article", { name: "seconde" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "feed.pagination.loadMore" })).toBeInTheDocument()
    expect(mocks.unmounted).toHaveBeenCalledWith(cursorKey(second))
    expect(mocks.mounted.mock.calls.filter(([key]) => key === "first")).toHaveLength(2)
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
