// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import type { PageDirectoryRequest } from "@diasporale/features/data"
import { act, cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEnginePages, PAGE_POSTS_WINDOW, useEnginePage } from "./engine-pages"

/** Une lecture TanStack du moteur, telle que `useAuthenticatedConvexQuery` la rend. */
interface FakeQuery {
  data: unknown
  isError: boolean
  isSuccess: boolean
  isFetching: boolean
  dataUpdatedAt: number
  error: unknown
  refetch: ReturnType<typeof vi.fn>
}

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isPending: false, isUnauthenticated: false },
  network: { _id: "network-diasporale" } as unknown,
  membership: undefined as unknown,
  queries: new Map<string, unknown>(),
  calls: [] as [string, unknown][],
}))

vi.mock("@antsia/api/hooks", () => ({
  useStableConvexAuth: () => mocks.auth,
  useAuthenticatedConvexQuery: (query: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(query)
    mocks.calls.push([name, args])
    if (args === "skip") return { data: undefined, isError: false, isSuccess: false, isFetching: false, dataUpdatedAt: 0, error: null, refetch: vi.fn() }
    return mocks.queries.get(name) ?? { data: undefined, isError: false, isSuccess: false, isFetching: true, dataUpdatedAt: 0, error: null, refetch: vi.fn() }
  },
}))

vi.mock("convex/react", () => ({
  useQueries: (queries: Record<string, { query: Parameters<typeof getFunctionName>[0]; args?: unknown }>) => {
    if (!queries.value) return {}
    const name = getFunctionName(queries.value.query)
    switch (name) {
      case "modules/networks/networks:getBySlug":
        return { value: mocks.network }
      case "modules/diaspora/membership:myMembership":
        return { value: mocks.membership }
      default:
        throw new Error(`Unexpected query ${name}`)
    }
  },
}))

const GET_PAGE = "modules/pages/pages:getPage"
const PAGE_POSTS = "modules/pages/pages:pagePosts"
const STANDING = "modules/diaspora/hubPages:pageStanding"
const DISCOVER = "modules/pages/pages:paginateDiscover"
const HUB_PAGES = "modules/diaspora/hubPages:listCountryPages"

const MEMBER = { status: "declaree", capabilities: ["read_network", "publish"], facet: { countryOfResidence: "FR" } }

const CARD = {
  pageId: "page-lyon",
  networkId: "network-diasporale",
  handle: "collectif-lyon",
  name: "Collectif de Lyon",
  shortName: "CDL",
  logoUrl: "blob:logo-lyon",
  badge: "verified",
  ownerKind: "association",
  country: "FR",
}

const PAGE = {
  ...CARD,
  description: null,
  bannerUrl: "blob:banniere-lyon",
  visibility: "network",
  followerCount: 3,
  postCount: 7,
  createdAt: 1,
  viewer: { following: true, role: "admin" },
}

const POST = {
  _id: "post-page-1",
  body: "Assemblée générale samedi",
  media: [],
  share: null,
  shareCount: 0,
  audience: "public",
  visibility: "network",
  reach: "diaspora",
  country: null,
  publishedAt: 5,
  isMine: false,
  editedAt: null,
  commentCount: 1,
  page: { pageId: "page-lyon", handle: "collectif-lyon", name: "Collectif de Lyon", badge: "verified" },
  author: { personId: "signataire", handle: "signataire", displayName: "Signataire", badges: [] },
  reactions: { counts: { like: 1, bravo: 0, soutien: 0, instructif: 0 }, total: 1, mine: "like" },
  viewer: { bookmarked: false, notifying: false },
}

function ok(data: unknown, dataUpdatedAt = 1): FakeQuery {
  return { data, isError: false, isSuccess: true, isFetching: false, dataUpdatedAt, error: null, refetch: vi.fn().mockResolvedValue(undefined) }
}

function refused(code: string): FakeQuery {
  return { data: undefined, isError: true, isSuccess: false, isFetching: false, dataUpdatedAt: 0, error: new ConvexError({ code }), refetch: vi.fn().mockResolvedValue(undefined) }
}

function serveDetail(page: unknown = PAGE, wall: unknown = { items: [POST], nextCursor: { publishedAt: 5, postId: "post-page-1" } }, standing: unknown = { claimable: false }) {
  mocks.queries.set(GET_PAGE, ok(page))
  mocks.queries.set(PAGE_POSTS, ok(wall))
  mocks.queries.set(STANDING, ok(standing))
}

function lastArgs(name: string): unknown {
  return [...mocks.calls].reverse().find(([called]) => called === name)?.[1]
}

function client(handlers: { query?: (name: string, args: unknown) => unknown; mutation?: (name: string, args: unknown) => unknown } = {}) {
  const query = vi.fn(async (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(reference)
    if (name === "modules/networks/networks:getBySlug") return { _id: "network-diasporale" }
    return handlers.query?.(name, args)
  })
  const mutation = vi.fn(async (reference: Parameters<typeof getFunctionName>[0], args: unknown) => handlers.mutation?.(getFunctionName(reference), args))
  return { convex: { query, mutation } as unknown as ConvexReactClient, query, mutation }
}

const AUTH = {} as EngineAuthClient

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
  mocks.network = { _id: "network-diasporale" }
  mocks.membership = { ...MEMBER }
  mocks.queries.clear()
  mocks.calls.length = 0
})

afterEach(cleanup)

describe("fiche d'une page — adaptateur moteur", () => {
  it("projette fidèlement getPage, la première fenêtre du mur et la revendicabilité de la tranche", () => {
    serveDetail(PAGE, undefined, { claimable: true })
    const { result } = renderHook(() => useEnginePage(" collectif-lyon "))

    expect(lastArgs(GET_PAGE)).toEqual({ networkId: "network-diasporale", handle: "collectif-lyon" })
    expect(lastArgs(PAGE_POSTS)).toEqual({ networkId: "network-diasporale", handle: "collectif-lyon", limit: PAGE_POSTS_WINDOW })
    expect(lastArgs(STANDING)).toEqual({ networkId: "network-diasporale", handle: "collectif-lyon" })
    expect(result.current.status).toBe("ready")
    if (result.current.status !== "ready" || result.current.data === null) throw new Error("fiche attendue")
    expect(result.current.data.page).toEqual({
      id: "page-lyon",
      handle: "collectif-lyon",
      name: "Collectif de Lyon",
      ownerKind: "association",
      trust: "verified",
      badge: "verified",
      country: "FR",
      city: null,
      description: "",
      followers: 3,
      claimable: true,
      shortName: "CDL",
      logoUrl: "blob:logo-lyon",
    })
    expect(result.current.data).toMatchObject({
      bannerUrl: "blob:banniere-lyon",
      postCount: 7,
      morePosts: true,
      events: [],
      viewer: { role: "admin", following: true },
    })
    expect(result.current.data.posts).toHaveLength(1)
    expect(result.current.data.posts[0]).toMatchObject({
      id: "post-page-1",
      author: { kind: "page", id: "page-lyon", handle: "collectif-lyon", displayName: "Collectif de Lyon", badges: ["verified"] },
      myReaction: "like",
      reactionCount: 1,
    })
  })

  it("un pays hors diaspora est écarté, jamais deviné ; un mur épuisé ne promet rien de plus", () => {
    serveDetail({ ...PAGE, country: "GA", badge: "community", viewer: { following: false, role: null } }, { items: [], nextCursor: null }, { claimable: false })
    const { result } = renderHook(() => useEnginePage("collectif-lyon"))
    if (result.current.status !== "ready" || result.current.data === null) throw new Error("fiche attendue")
    expect(result.current.data.page).toMatchObject({ country: null, trust: "community", badge: "community", claimable: false })
    expect(result.current.data).toMatchObject({ morePosts: false, posts: [], viewer: { role: null, following: false } })
  })

  it("le null du moteur (inconnue, retirée ou d'ailleurs) rend le même null", () => {
    serveDetail(null, { items: [], nextCursor: null }, null)
    const { result } = renderHook(() => useEnginePage("inconnue"))
    expect(result.current).toMatchObject({ status: "ready", data: null })
  })

  it("attend chaque lecture avant de rendre une fiche", () => {
    mocks.queries.set(GET_PAGE, ok(PAGE))
    const { result } = renderHook(() => useEnginePage("collectif-lyon"))
    expect(result.current.status).toBe("loading")
  })

  it.each([
    { code: "notFound", expected: "not_found" },
    { code: "statusInsufficient", expected: "status_insufficient" },
    { code: "rateLimited", expected: "rate_limited" },
  ])("un refus $code sort du squelette : erreur à code fermé, sans fiche en cache, avec reprise", async ({ code, expected }) => {
    serveDetail()
    const { result, rerender } = renderHook(() => useEnginePage("collectif-lyon"))
    expect(result.current.status).toBe("ready")
    const refusal = refused(code)
    mocks.queries.set(GET_PAGE, refusal)
    rerender()
    expect(result.current).toMatchObject({ status: "error", code: expected })
    expect("data" in result.current).toBe(false)
    await act(async () => {
      await result.current.retry?.()
    })
    expect(refusal.refetch).toHaveBeenCalledOnce()
  })

  it.each([
    { membership: null, code: "not_member" },
    { membership: { ...MEMBER, status: "suspendue", capabilities: [] }, code: "suspended" },
  ])("sans droit de lecture ($code), aucune lecture n'est tentée", ({ membership, code }) => {
    mocks.membership = membership
    serveDetail()
    const { result } = renderHook(() => useEnginePage("collectif-lyon"))
    expect(lastArgs(GET_PAGE)).toBe("skip")
    expect(lastArgs(PAGE_POSTS)).toBe("skip")
    expect(lastArgs(STANDING)).toBe("skip")
    expect(result.current).toMatchObject({ status: "error", code })
  })

  it("la capacité relève les publications lues (mémoire des réactions du fil)", () => {
    serveDetail()
    const onPosts = vi.fn()
    const pages = createEnginePages({ convex: client().convex, authClient: AUTH }, { onPosts })
    renderHook(() => pages.usePage("collectif-lyon"))
    expect(onPosts).toHaveBeenCalledWith([expect.objectContaining({ id: "post-page-1", myReaction: "like" })])
  })
})

describe("suivre une page — écritures idempotentes du moteur", () => {
  it("suivre passe par pages.follow dans DIASPORALE", async () => {
    const { convex, mutation } = client({ mutation: () => ({ pageId: "page-lyon", following: true }) })
    const pages = createEnginePages({ convex, authClient: AUTH })
    expect(await pages.follow(" collectif-lyon ")).toEqual({ ok: true, value: { following: true } })
    expect(mutation).toHaveBeenCalledWith(expect.anything(), { networkId: "network-diasporale", handle: "collectif-lyon" })
    expect(getFunctionName(mutation.mock.calls[0]![0])).toBe("modules/pages/pages:follow")
  })

  it("ne plus suivre relit la page par son adresse puis désabonne par son identifiant", async () => {
    const { convex, query, mutation } = client({ query: (name) => (name === GET_PAGE ? PAGE : null), mutation: () => ({ following: false }) })
    const pages = createEnginePages({ convex, authClient: AUTH })
    expect(await pages.unfollow("collectif-lyon")).toEqual({ ok: true, value: { following: false } })
    expect(query).toHaveBeenCalledWith(expect.anything(), { networkId: "network-diasporale", handle: "collectif-lyon" })
    expect(getFunctionName(mutation.mock.calls[0]![0])).toBe("modules/pages/pages:unfollow")
    expect(mutation.mock.calls[0]![1]).toEqual({ networkId: "network-diasporale", pageId: "page-lyon" })
  })

  it("une page devenue illisible ne se désabonne pas : le même introuvable", async () => {
    const { convex, mutation } = client({ query: () => null })
    const pages = createEnginePages({ convex, authClient: AUTH })
    expect(await pages.unfollow("disparue")).toEqual({ ok: false, code: "not_found" })
    expect(mutation).not.toHaveBeenCalled()
  })

  it.each([
    { code: "rateLimited", expected: "rate_limited" },
    { code: "statusInsufficient", expected: "status_insufficient" },
    { code: "notFound", expected: "not_found" },
  ])("un refus $code du moteur devient un code fermé", async ({ code, expected }) => {
    const { convex } = client({
      mutation: () => {
        throw new ConvexError({ code })
      },
    })
    const pages = createEnginePages({ convex, authClient: AUTH })
    expect(await pages.follow("collectif-lyon")).toEqual({ ok: false, code: expected })
  })
})

describe("annuaire des pages — paginateDiscover", () => {
  const SUMMARY = { ...CARD, description: "Accueil des nouveaux arrivants", followerCount: 4, following: true }

  it("ne cherche qu'à partir de deux caractères, borne la fenêtre et transmet le pays et le curseur", () => {
    mocks.queries.set(DISCOVER, ok({ page: [SUMMARY], isDone: false, continueCursor: "opaque:suite" }))
    const pages = createEnginePages({ convex: client().convex, authClient: AUTH })
    const { result, rerender } = renderHook((args: PageDirectoryRequest) => pages.useDirectory(args), { initialProps: { query: "l", cursor: null } as PageDirectoryRequest })
    expect(lastArgs(DISCOVER)).toEqual({ networkId: "network-diasporale", paginationOpts: { numItems: 20, cursor: null } })
    expect(result.current).toMatchObject({
      status: "ready",
      data: { isDone: false, continueCursor: "opaque:suite", items: [{ id: "page-lyon", following: true, followers: 4, claimable: false, description: "Accueil des nouveaux arrivants" }] },
    })
    rerender({ query: " lyon ", country: "FR", cursor: "opaque:suite" })
    expect(lastArgs(DISCOVER)).toEqual({ networkId: "network-diasporale", query: "lyon", country: "FR", paginationOpts: { numItems: 20, cursor: "opaque:suite" } })
  })

  it("la fin se lit dans isDone, sans curseur à reprendre", () => {
    mocks.queries.set(DISCOVER, ok({ page: [], isDone: true, continueCursor: "fin" }))
    const pages = createEnginePages({ convex: client().convex, authClient: AUTH })
    const { result } = renderHook(() => pages.useDirectory({ query: "", cursor: null }))
    expect(result.current).toMatchObject({ status: "ready", data: { items: [], isDone: true, continueCursor: null } })
  })

  it("un refus rend une erreur fermée avec reprise", async () => {
    const refusal = refused("rateLimited")
    mocks.queries.set(DISCOVER, refusal)
    const pages = createEnginePages({ convex: client().convex, authClient: AUTH })
    const { result } = renderHook(() => pages.useDirectory({ query: "", cursor: null }))
    expect(result.current).toMatchObject({ status: "error", code: "rate_limited" })
    await act(async () => {
      await result.current.retry?.()
    })
    expect(refusal.refetch).toHaveBeenCalledOnce()
  })
})

describe("pages du hub — tranche diaspora", () => {
  it("lit les listes bornées du pays et garde l'annonce d'une suite", () => {
    const row = { ...CARD, description: "Accueil", followerCount: 2, claimable: true }
    mocks.queries.set(HUB_PAGES, ok({
      country: "FR",
      officialPages: [],
      associations: [row],
      companies: [],
      more: { officialPages: false, associations: true, companies: false },
    }))
    const pages = createEnginePages({ convex: client().convex, authClient: AUTH })
    const { result } = renderHook(() => pages.useHubPages("FR"))
    expect(lastArgs(HUB_PAGES)).toEqual({ networkId: "network-diasporale", country: "FR" })
    expect(result.current).toMatchObject({
      status: "ready",
      data: { country: "FR", officialPages: [], companies: [], associations: [{ id: "page-lyon", claimable: true, followers: 2 }], more: { associations: true } },
    })
  })

  it("hors adhésion, la liste ne se lit pas", () => {
    mocks.membership = null
    const pages = createEnginePages({ convex: client().convex, authClient: AUTH })
    const { result } = renderHook(() => pages.useHubPages("FR"))
    expect(lastArgs(HUB_PAGES)).toBe("skip")
    expect(result.current).toMatchObject({ status: "error", code: "not_member" })
  })
})
