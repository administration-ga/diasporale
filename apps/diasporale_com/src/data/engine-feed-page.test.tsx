// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import type { FeedPageRequest } from "@diasporale/features/data"
import { act, cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEngineDataSource } from "./engine-source"

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isPending: false, isUnauthenticated: false },
  network: { _id: "network-diasporale" } as unknown,
  membership: null as unknown,
  query: vi.fn(),
  page: { data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() } as {
    data: unknown
    isLoading: boolean
    isError: boolean
    error: unknown
    refetch: ReturnType<typeof vi.fn>
  },
}))

vi.mock("@antsia/api/hooks", () => ({
  useStableConvexAuth: () => mocks.auth,
  useAuthenticatedConvexQuery: (query: Parameters<typeof getFunctionName>[0], args: unknown) => {
    mocks.query(getFunctionName(query), args)
    return mocks.page
  },
}))

vi.mock("convex/react", () => ({
  useQueries: (queries: Record<string, { query: Parameters<typeof getFunctionName>[0] }>) => {
    const query = queries.value
    if (!query) return {}
    const name = getFunctionName(query.query)
    return { value: name === "modules/networks/networks:getBySlug" ? mocks.network : mocks.membership }
  },
}))

const MEMBERSHIP = {
  status: "en_attente",
  capabilities: ["read_network"],
  facet: { countryOfResidence: "FR" },
}

const CURSOR = { publishedAt: 123, postId: "post-frontier" }

function post(id = "post-later") {
  return {
    _id: id,
    body: "Une publication de la recette",
    media: [],
    share: null,
    shareCount: 0,
    audience: "public",
    visibility: "network",
    reach: "diaspora",
    publishedAt: 122,
    isMine: false,
    reason: "public",
    author: { personId: "person-other", handle: "autre.recette", displayName: "Autre recette", badges: [] },
    reactions: { counts: { like: 0, bravo: 1, soutien: 0, instructif: 0 }, total: 1, mine: "bravo" },
    viewer: { bookmarked: false, notifying: false },
  }
}

function source() {
  const convex = {
    query: vi.fn().mockResolvedValue({ _id: "network-diasporale" }),
    mutation: vi.fn().mockResolvedValue({ mine: null }),
  }
  return { convex, data: createEngineDataSource({ convex: convex as unknown as ConvexReactClient, authClient: {} as EngineAuthClient }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
  mocks.network = { _id: "network-diasporale" }
  mocks.membership = { ...MEMBERSHIP }
  mocks.page = { data: { items: [], nextCursor: null, lacunar: false }, isLoading: false, isError: false, error: null, refetch: vi.fn().mockResolvedValue({}) }
})

afterEach(cleanup)

describe("source moteur — une page réactive du fil", () => {
  it("un membre en attente lit la première page du pays sans droit de publier", () => {
    const { data } = source()
    const { result } = renderHook(() => data.useFeedPage({ scope: "mon_pays" }))

    expect(mocks.query).toHaveBeenLastCalledWith("modules/posts/posts:myFeed", {
      networkId: "network-diasporale", limit: 30, lanes: [{ reach: "local", country: "FR" }, { reach: "diaspora" }],
    })
    expect(result.current).toMatchObject({ data: { items: [], nextCursor: null, lacunar: false }, isLoading: false, error: null })
  })

  it.each([
    { scope: "pour_vous" as const, request: { scope: "pour_vous" } },
    { scope: "recents" as const, request: { scope: "recents" } },
    { scope: "diaspora" as const, request: { lanes: [{ reach: "diaspora" }] } },
  ])("garde la portée $scope sur les pages suivantes", ({ scope, request }) => {
    const { data } = source()
    renderHook(() => data.useFeedPage({ scope, cursor: CURSOR }))
    expect(mocks.query).toHaveBeenLastCalledWith("modules/posts/posts:myFeed", { networkId: "network-diasporale", limit: 30, ...request, cursor: CURSOR })
  })

  it("reprend le curseur brut et les voies du hub choisi, plutôt que le pays de résidence", () => {
    const { data } = source()
    const { rerender } = renderHook((args: FeedPageRequest) => data.useFeedPage(args), { initialProps: { scope: "mon_pays", hubCountry: "CA" } as FeedPageRequest })
    rerender({ scope: "mon_pays", hubCountry: "CA", cursor: CURSOR })

    expect(mocks.query).toHaveBeenLastCalledWith("modules/posts/posts:myFeed", {
      networkId: "network-diasporale", limit: 30, lanes: [{ reach: "local", country: "CA" }, { reach: "diaspora" }], cursor: CURSOR,
    })
  })

  it("une fenêtre vide peut continuer ; lacunar ne remplace pas le curseur", () => {
    mocks.page.data = { items: [], nextCursor: CURSOR, lacunar: true }
    const { data } = source()
    const { result } = renderHook(() => data.useFeedPage({ scope: "mon_pays" }))

    expect(result.current.data).toEqual({ items: [], nextCursor: CURSOR, lacunar: true })
  })

  it("une panne après données garde la page et expose seulement un code fermé", () => {
    mocks.page.data = { items: [post()], nextCursor: CURSOR, lacunar: false }
    mocks.page.isError = true
    mocks.page.error = new Error("Server Error: détail interne à ne pas exposer")
    const { data } = source()
    const { result } = renderHook(() => data.useFeedPage({ scope: "recents" }))

    expect(result.current.data?.items.map((item) => item.id)).toEqual(["post-later"])
    expect(result.current).toMatchObject({ error: "unknown", isLoading: false })
  })

  it("une panne sans données se reprend par le hook public, sans rejet non traité", async () => {
    mocks.page = { data: undefined, isLoading: false, isError: true, error: new ConvexError({ code: "rateLimited" }), refetch: vi.fn().mockRejectedValue(new Error("connexion locale interrompue")) }
    const { data } = source()
    const { result, rerender } = renderHook(() => data.useFeedPage({ scope: "recents" }))
    expect(result.current).toMatchObject({ data: undefined, error: "rate_limited", isLoading: false })

    await act(async () => result.current.retry())
    expect(mocks.page.refetch).toHaveBeenCalledOnce()
    mocks.page = { ...mocks.page, data: { items: [], nextCursor: null, lacunar: false }, isError: false, error: null }
    rerender()
    expect(result.current).toMatchObject({ error: null, data: { items: [] } })
  })

  it("n'expose plus une page en cache quand l'adhésion perd la lecture", () => {
    mocks.page.data = { items: [post()], nextCursor: CURSOR, lacunar: false }
    const { data } = source()
    const { result, rerender } = renderHook(() => data.useFeedPage({ scope: "recents" }))
    expect(result.current.data?.items).toHaveLength(1)

    mocks.membership = { ...MEMBERSHIP, status: "suspendue", capabilities: [] }
    rerender()
    expect(mocks.query).toHaveBeenLastCalledWith("modules/posts/posts:myFeed", "skip")
    expect(result.current).toMatchObject({ data: undefined, isLoading: false, error: "suspended" })
    result.current.retry()
    expect(mocks.page.refetch).not.toHaveBeenCalled()
  })

  it("reste en chargement sans données durant la résolution de l'adhésion", () => {
    mocks.membership = undefined
    const { data } = source()
    const { result } = renderHook(() => data.useFeedPage({ scope: "recents" }))
    expect(mocks.query).toHaveBeenLastCalledWith("modules/posts/posts:myFeed", "skip")
    expect(result.current).toMatchObject({ data: undefined, isLoading: true, error: null })
  })

  it("retient la réaction lue sur une page suivante pour pouvoir la retirer", async () => {
    mocks.page.data = { items: [post()], nextCursor: null, lacunar: false }
    const { data, convex } = source()
    renderHook(() => data.useFeedPage({ scope: "recents", cursor: CURSOR }))

    expect(await data.actions.react("post-later", null)).toEqual({ ok: true, value: null })
    expect(getFunctionName(convex.mutation.mock.calls[0]?.[0])).toBe("modules/engagement/engagement:toggleReaction")
    expect(convex.mutation.mock.calls[0]?.[1]).toEqual({ networkId: "network-diasporale", postId: "post-later", kind: "bravo" })
  })
})
