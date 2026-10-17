// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import type { ProfilePostsPageRequest } from "@diasporale/features/data"
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
  profile: null as unknown,
  facet: null as unknown,
  query: vi.fn(),
  loaded: vi.fn(),
  page: { data: undefined, isLoading: true, isError: false, isSuccess: false, isFetching: true, dataUpdatedAt: 0, error: null, refetch: vi.fn() } as {
    data: unknown
    isLoading: boolean
    isError: boolean
    isSuccess: boolean
    isFetching: boolean
    dataUpdatedAt: number
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
  useQueries: (queries: Record<string, { query: Parameters<typeof getFunctionName>[0]; args?: unknown }>) => {
    const query = queries.value
    if (!query) return {}
    const name = getFunctionName(query.query)
    mocks.loaded(name, query.args)
    switch (name) {
      case "modules/networks/networks:getBySlug": return { value: mocks.network }
      case "modules/diaspora/membership:myMembership": return { value: mocks.membership }
      case "modules/people/profile:getPublicProfile": return { value: mocks.profile }
      case "modules/diaspora/profile:memberFacet": return { value: mocks.facet }
      default: throw new Error(`Lecture inattendue dans le contrat du profil : ${name}`)
    }
  },
}))

const MEMBERSHIP = { status: "en_attente", capabilities: ["read_network"], facet: { countryOfResidence: "FR" } }
const CURSOR = { publishedAt: 123, postId: "post-frontier" }

function post(id: string) {
  return {
    _id: id,
    body: "Publication du mur fictif",
    media: [],
    share: null,
    shareCount: 0,
    audience: "public",
    visibility: "network",
    reach: "diaspora",
    publishedAt: 122,
    editedAt: null,
    isMine: false,
    reason: "public",
    author: { personId: "person-awa", handle: "awa.recette", displayName: "Awa recette", badges: [] },
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
  mocks.profile = {
    personId: "person-awa", handle: "awa.recette", displayName: "Awa recette", headline: null,
    avatar: { url: null, withheld: null }, cover: { url: null, withheld: null }, badges: [], isMe: false,
  }
  mocks.facet = { facet: { countryOfResidence: "FR" }, preview: null }
  mocks.page = { data: { items: [], nextCursor: null, pinned: null }, isLoading: false, isError: false, isSuccess: true, isFetching: false, dataUpdatedAt: 1, error: null, refetch: vi.fn().mockResolvedValue({}) }
})

afterEach(cleanup)

describe("source moteur — pages du mur indépendantes de la fiche", () => {
  it("un membre en attente lit la première page dans DIASPORALE, sans curseur ni filtre de fil", () => {
    const { data } = source()
    const { result } = renderHook(() => data.useProfilePostsPage({ handle: "awa.recette", cursor: null }))

    expect(mocks.query).toHaveBeenLastCalledWith("modules/posts/posts:personPosts", { networkId: "network-diasporale", handle: "awa.recette", limit: 30 })
    expect(result.current).toMatchObject({ data: { items: [], nextCursor: null, lacunar: false }, isLoading: false, error: null })
  })

  it("reprend exactement le curseur composite et le même handle normalisé", () => {
    const { data } = source()
    const { rerender } = renderHook((args: ProfilePostsPageRequest) => data.useProfilePostsPage(args), { initialProps: { handle: " @AWA.recette " } as ProfilePostsPageRequest })
    rerender({ handle: " @AWA.recette ", cursor: CURSOR })
    expect(mocks.query).toHaveBeenLastCalledWith("modules/posts/posts:personPosts", { networkId: "network-diasporale", handle: "awa.recette", limit: 30, cursor: CURSOR })
  })

  it("place l'épinglée une fois en tête de la première page sans déplacer son curseur", () => {
    const pinned = post("pinned")
    mocks.page.data = { items: [post("newer"), pinned, post("older")], nextCursor: CURSOR, pinned }
    const { data } = source()
    const { result } = renderHook(() => data.useProfilePostsPage({ handle: "awa.recette" }))

    expect(result.current.data?.items.map((item) => item.id)).toEqual(["pinned", "newer", "older"])
    expect(result.current.data?.nextCursor).toEqual(CURSOR)
  })

  it("ignore une épingle reçue sur une page suivante", () => {
    mocks.page.data = { items: [post("older")], nextCursor: null, pinned: post("pinned") }
    const { data } = source()
    const { result } = renderHook(() => data.useProfilePostsPage({ handle: "awa.recette", cursor: CURSOR }))
    expect(result.current.data?.items.map((item) => item.id)).toEqual(["older"])
  })

  it("ne transforme pas une page vide avec continuation en fin de mur", () => {
    mocks.page.data = { items: [], nextCursor: CURSOR, pinned: null }
    const { data } = source()
    const { result } = renderHook(() => data.useProfilePostsPage({ handle: "awa.recette" }))
    expect(result.current.data).toEqual({ items: [], nextCursor: CURSOR, lacunar: false })
  })

  it("conserve les publications déjà lues pendant une panne, avec un code fermé", () => {
    mocks.page = { ...mocks.page, data: { items: [post("older")], nextCursor: CURSOR, pinned: null }, isError: true, error: new Error("Server Error: détail interne") }
    const { data } = source()
    const { result } = renderHook(() => data.useProfilePostsPage({ handle: "awa.recette" }))
    expect(result.current.data?.items.map((item) => item.id)).toEqual(["older"])
    expect(result.current).toMatchObject({ error: "unknown", isLoading: false })
  })

  it("reprend la page par le hook public et absorbe un rejet de la tentative", async () => {
    mocks.page = { ...mocks.page, data: undefined, isLoading: false, isError: true, isSuccess: false, error: new ConvexError({ code: "rateLimited" }), refetch: vi.fn().mockRejectedValue(new Error("hors connexion")) }
    const { data } = source()
    const { result, rerender } = renderHook(() => data.useProfilePostsPage({ handle: "awa.recette" }))
    expect(result.current).toMatchObject({ data: undefined, error: "rate_limited", isLoading: false })
    await act(async () => result.current.retry())
    expect(mocks.page.refetch).toHaveBeenCalledOnce()

    mocks.page = { ...mocks.page, data: { items: [], nextCursor: null, pinned: null }, isError: false, isSuccess: true, error: null }
    rerender()
    expect(result.current).toMatchObject({ data: { items: [] }, error: null })
  })

  it("masque les données en cache et ferme la reprise quand le droit de lecture tombe", () => {
    mocks.page.data = { items: [post("older")], nextCursor: CURSOR, pinned: null }
    const { data } = source()
    const { result, rerender } = renderHook(() => data.useProfilePostsPage({ handle: "awa.recette" }))
    expect(result.current.data?.items).toHaveLength(1)

    mocks.membership = { ...MEMBERSHIP, status: "suspendue", capabilities: [] }
    rerender()
    expect(mocks.query).toHaveBeenLastCalledWith("modules/posts/posts:personPosts", "skip")
    expect(result.current).toMatchObject({ data: undefined, error: "suspended", isLoading: false })
    result.current.retry()
    expect(mocks.page.refetch).not.toHaveBeenCalled()
  })

  it.each([
    { code: "unauthenticated", error: "not_signed_in" },
    { code: "profileRequired", error: "not_member" },
    { code: "notFound", error: "not_found" },
    { code: "statusInsufficient", error: "status_insufficient" },
    { code: "membershipSuspended", error: "suspended" },
    { code: "policyRefused", appRule: "network_unavailable", error: "network_unavailable" },
  ])("retire publications et épingle après $error jusqu'à une réponse fraîche", ({ code, appRule, error }) => {
    mocks.page.data = { items: [post("cached")], nextCursor: CURSOR, pinned: post("pinned") }
    const { data } = source()
    const { result, rerender } = renderHook(() => data.useProfilePostsPage({ handle: "awa.recette" }))
    expect(result.current.data?.items).toHaveLength(2)
    mocks.page = { ...mocks.page, isError: true, isSuccess: false, error: new ConvexError({ code, ...(appRule ? { appRule } : {}) }) }
    rerender()
    expect(result.current).toMatchObject({ data: undefined, error, isLoading: false })
    mocks.page.refetch.mockResolvedValue(mocks.page)
    act(() => result.current.retry())
    mocks.page = { ...mocks.page, isError: false, isSuccess: true, isFetching: true, error: null }
    rerender()
    expect(result.current).toMatchObject({ data: undefined, error, isLoading: true })
    mocks.page = { ...mocks.page, isError: true, isSuccess: false, isFetching: false, error: new Error("offline") }
    rerender()
    expect(result.current).toMatchObject({ data: undefined, error })
    mocks.page = { ...mocks.page, isError: false, isSuccess: true, error: null }
    rerender()
    expect(result.current.data).toBeUndefined()
    mocks.page = { ...mocks.page, data: { items: [post("fresh")], nextCursor: null, pinned: null }, dataUpdatedAt: 2 }
    rerender()
    expect(result.current).toMatchObject({ error: null, data: { items: [{ id: "fresh" }] } })
  })

  it("ne rouvre le même DTO et le même instant qu'après une reprise effectivement réussie", async () => {
    mocks.page.data = { items: [post("cached")], nextCursor: null, pinned: null }
    const { data } = source()
    const { result, rerender } = renderHook(() => data.useProfilePostsPage({ handle: "awa.recette" }))
    mocks.page = { ...mocks.page, isError: true, isSuccess: false, error: new ConvexError({ code: "notFound" }) }
    rerender()
    mocks.page.refetch.mockResolvedValue(mocks.page)
    await act(async () => result.current.retry())
    expect(result.current.data).toBeUndefined()
    mocks.page = { ...mocks.page, isError: false, isSuccess: true, error: null }
    rerender()
    expect(result.current.data).toBeUndefined()
    mocks.page.refetch.mockResolvedValue(mocks.page)
    await act(async () => result.current.retry())
    expect(result.current.data?.items.map((item) => item.id)).toEqual(["cached"])
    expect(result.current.error).toBeNull()
  })

  it("le retour du droit de lecture attend une revalidation et ne rejoue pas le cache du mur", () => {
    mocks.page.data = { items: [post("cached")], nextCursor: null, pinned: null }
    const { data } = source()
    const { result, rerender } = renderHook(() => data.useProfilePostsPage({ handle: "awa.recette" }))
    mocks.membership = { ...MEMBERSHIP, status: "suspendue", capabilities: [] }
    rerender()
    result.current.retry()
    expect(mocks.page.refetch).not.toHaveBeenCalled()
    mocks.membership = { ...MEMBERSHIP }
    rerender()
    expect(result.current).toMatchObject({ data: undefined, error: "suspended" })
    mocks.page = { ...mocks.page, dataUpdatedAt: 2 }
    rerender()
    expect(result.current.data?.items).toHaveLength(1)
  })

  it.each([
    { handle: "autre.recette" },
    { handle: "awa.recette", cursor: CURSOR },
  ] satisfies ProfilePostsPageRequest[])("ignore une reprise appartenant à l'ancien mur ou curseur $handle/$cursor", async (next) => {
    mocks.page.data = { items: [post("cached")], nextCursor: null, pinned: null }
    let resolve!: (value: typeof mocks.page) => void
    mocks.page.refetch.mockReturnValue(new Promise<typeof mocks.page>((yes) => { resolve = yes }))
    const { data } = source()
    const { result, rerender } = renderHook((args: ProfilePostsPageRequest) => data.useProfilePostsPage(args), { initialProps: { handle: "awa.recette" } as ProfilePostsPageRequest })
    result.current.retry()
    rerender(next)
    mocks.page = { ...mocks.page, isError: true, isSuccess: false, error: new ConvexError({ code: "notFound" }) }
    rerender(next)
    mocks.page = { ...mocks.page, isError: false, isSuccess: true, error: null }
    rerender(next)
    await act(async () => { resolve(mocks.page) })
    expect(result.current).toMatchObject({ data: undefined, error: "not_found" })
  })

  it("attend l'adhésion sans afficher de page cachée", () => {
    mocks.membership = undefined
    mocks.page.data = { items: [post("cached")], nextCursor: null, pinned: null }
    const { data } = source()
    const { result } = renderHook(() => data.useProfilePostsPage({ handle: "awa.recette" }))
    expect(mocks.query).toHaveBeenLastCalledWith("modules/posts/posts:personPosts", "skip")
    expect(result.current).toMatchObject({ data: undefined, error: null, isLoading: true })
  })

  it("une fiche de profil n'attend ni ne lit plus son mur", () => {
    mocks.page = { ...mocks.page, data: undefined, isLoading: true }
    const { data } = source()
    const { result } = renderHook(() => data.useProfile("awa.recette"))
    expect(result.current).toMatchObject({ status: "ready", data: { handle: "awa.recette", posts: [] } })
    expect(mocks.query).not.toHaveBeenCalled()
    expect(mocks.loaded.mock.calls.map(([name]) => name)).not.toContain("modules/posts/posts:personPosts")
  })

  it.each(["pinned", "older"])("retient la réaction de %s pour pouvoir la retirer", async (id) => {
    mocks.page.data = { items: [post("older")], nextCursor: null, pinned: post("pinned") }
    const { data, convex } = source()
    renderHook(() => data.useProfilePostsPage({ handle: "awa.recette" }))
    expect(await data.actions.react(id, null)).toEqual({ ok: true, value: null })
    expect(getFunctionName(convex.mutation.mock.calls[0]?.[0])).toBe("modules/engagement/engagement:toggleReaction")
    expect(convex.mutation.mock.calls[0]?.[1]).toEqual({ networkId: "network-diasporale", postId: id, kind: "bravo" })
  })
})
