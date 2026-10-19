// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import type { BookmarksPageRequest } from "@diasporale/features/data"
import { act, cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEngineDataSource } from "./engine-source"

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isPending: false, isUnauthenticated: false },
  network: { _id: "network-diasporale" } as unknown,
  membership: undefined as unknown,
  query: vi.fn(), loaded: vi.fn(),
  page: { data: undefined as unknown, isError: false, isSuccess: true, isFetching: false, dataUpdatedAt: 1, error: null as unknown, refetch: vi.fn() },
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
    if (!queries.value) return {}
    const name = getFunctionName(queries.value.query)
    mocks.loaded(name, queries.value.args)
    switch (name) {
      case "modules/networks/networks:getBySlug": return { value: mocks.network }
      case "modules/diaspora/membership:myMembership": return { value: mocks.membership }
      case "modules/diaspora/suggestions:forMe": return { value: [] }
      case "modules/marks/marks:paginateBookmarks": return { value: mocks.page.data }
      default: throw new Error(`Unexpected query ${name}`)
    }
  },
}))
const MEMBER = { status: "en_attente", capabilities: ["read_network"], facet: { countryOfResidence: "FR" } }
const bookmark = {
  postId: "post-one", body: "Texte fictif", publishedAt: 1, markedAt: 2, page: null,
  author: { personId: "person-one", displayName: null, handle: null, avatarUrl: null },
}
function source() {
  return createEngineDataSource({ convex: {} as ConvexReactClient, authClient: {} as EngineAuthClient })
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
  mocks.network = { _id: "network-diasporale" }
  mocks.membership = { ...MEMBER }
  mocks.page = { data: { page: [bookmark], isDone: false, continueCursor: "opaque:native/next" }, isError: false, isSuccess: true, isFetching: false, dataUpdatedAt: 1, error: null, refetch: vi.fn().mockResolvedValue(undefined) }
})
afterEach(cleanup)

describe("signets — port moteur paginé", () => {
  it("un membre en attente lit une fenêtre de cinquante dans DIASPORALE", () => {
    const data = source()
    const { result } = renderHook(() => data.useBookmarksPage({}))
    expect(mocks.query).toHaveBeenLastCalledWith("modules/marks/marks:paginateBookmarks", { networkId: "network-diasporale", paginationOpts: { numItems: 50, cursor: null } })
    expect(result.current).toMatchObject({ data: { items: [{ postId: "post-one", author: { displayName: null, handle: null } }], isDone: false, continueCursor: "opaque:native/next" }, isLoading: false, error: null })
  })
  it("transmet le curseur opaque sans décodage ni conversion de fil", () => {
    const data = source()
    const { rerender } = renderHook((args: BookmarksPageRequest) => data.useBookmarksPage(args), { initialProps: {} as BookmarksPageRequest })
    rerender({ cursor: "opaque:{not-json}/0" })
    expect(mocks.query).toHaveBeenLastCalledWith("modules/marks/marks:paginateBookmarks", { networkId: "network-diasporale", paginationOpts: { numItems: 50, cursor: "opaque:{not-json}/0" } })
  })
  it("garde la continuation d'une page filtrée vide et sa fin distincte", () => {
    mocks.page.data = { page: [], isDone: false, continueCursor: "next" }
    const data = source()
    const { result } = renderHook(() => data.useBookmarksPage({}))
    expect(result.current.data).toEqual({ items: [], isDone: false, continueCursor: "next" })
  })
  it("ne recrée pas la projection sans nouvelle réponse du moteur", () => {
    const data = source()
    const { result, rerender } = renderHook(() => data.useBookmarksPage({}))
    const first = result.current.data
    rerender()
    expect(result.current.data).toBe(first)
  })
  it("conserve une page valide pendant la panne avec un code fermé", () => {
    mocks.page = { ...mocks.page, isError: true, error: new Error("private trace") }
    const data = source()
    const { result } = renderHook(() => data.useBookmarksPage({}))
    expect(result.current.data?.items).toHaveLength(1)
    expect(result.current.error).toBe("unknown")
  })
  it("réessaie la page et absorbe le rejet de la tentative", async () => {
    mocks.page = { ...mocks.page, data: undefined, isError: true, isSuccess: false, error: new ConvexError({ code: "rateLimited" }), refetch: vi.fn().mockRejectedValue(new Error("offline")) }
    const data = source()
    const { result } = renderHook(() => data.useBookmarksPage({}))
    expect(result.current).toMatchObject({ data: undefined, error: "rate_limited", isLoading: false })
    await act(async () => result.current.retry())
    expect(mocks.page.refetch).toHaveBeenCalledOnce()
  })
  it.each([
    { code: "notFound", error: "not_found" },
    { code: "statusInsufficient", error: "status_insufficient" },
  ])("ne sert aucun cache après $code, pendant la reprise ou une panne intermédiaire", ({ code, error }) => {
    const data = source()
    const { result, rerender } = renderHook(() => data.useBookmarksPage({}))
    mocks.page = { ...mocks.page, isError: true, isSuccess: false, error: new ConvexError({ code }) }
    rerender()
    expect(result.current).toMatchObject({ data: undefined, error })
    mocks.page = { ...mocks.page, isError: false, isSuccess: true, isFetching: true, error: null }
    rerender()
    expect(result.current).toMatchObject({ data: undefined, isLoading: true, error })
    mocks.page = { ...mocks.page, isError: true, isSuccess: false, isFetching: false, error: new Error("offline") }
    rerender()
    expect(result.current).toMatchObject({ data: undefined, error })
    mocks.page = { ...mocks.page, isError: false, isSuccess: true, error: null }
    rerender()
    expect(result.current.data).toBeUndefined()
    mocks.page = { ...mocks.page, dataUpdatedAt: 2 }
    rerender()
    expect(result.current.data?.items).toHaveLength(1)
    expect(result.current.error).toBeNull()
  })
  it("rend la page réellement revalidée même si le DTO et son horodatage sont partagés", async () => {
    mocks.page = { ...mocks.page, isError: true, isSuccess: false, error: new ConvexError({ code: "notFound" }) }
    const data = source()
    const { result, rerender } = renderHook(() => data.useBookmarksPage({}))
    expect(result.current.data).toBeUndefined()
    mocks.page = { ...mocks.page, isError: false, isSuccess: true, error: null }
    mocks.page.refetch.mockResolvedValue(mocks.page)
    rerender()
    expect(result.current.data).toBeUndefined()
    let fresh: Awaited<ReturnType<typeof result.current.retry>>
    await act(async () => { fresh = await result.current.retry() })
    expect(fresh!).toMatchObject({ items: [{ postId: "post-one" }], continueCursor: "opaque:native/next" })
    expect(result.current.data?.items).toHaveLength(1)
  })
  it("un refetch rejeté ne réautorise pas le DTO conservé par la query", async () => {
    mocks.page = { ...mocks.page, isError: true, isSuccess: false, error: new ConvexError({ code: "notFound" }) }
    mocks.page.refetch.mockResolvedValue(mocks.page)
    const data = source()
    const { result } = renderHook(() => data.useBookmarksPage({}))
    await act(async () => { expect(await result.current.retry()).toBeUndefined() })
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBe("not_found")
  })
  it("ignore le résultat d'une reprise appartenant à un ancien curseur", async () => {
    let resolve!: (value: typeof mocks.page) => void
    mocks.page.refetch.mockReturnValue(new Promise<typeof mocks.page>((yes) => { resolve = yes }))
    const data = source()
    const { result, rerender } = renderHook((args: BookmarksPageRequest) => data.useBookmarksPage(args), { initialProps: {} as BookmarksPageRequest })
    const pending = result.current.retry()
    rerender({ cursor: "another" })
    await act(async () => {
      resolve(mocks.page)
      expect(await pending).toBeUndefined()
    })
  })
  it("une reprise commencée avant le retrait du droit de lecture ne rouvre aucun cache", async () => {
    let resolve!: (value: typeof mocks.page) => void
    mocks.page.refetch.mockReturnValue(new Promise<typeof mocks.page>((yes) => { resolve = yes }))
    const data = source()
    const { result, rerender } = renderHook(() => data.useBookmarksPage({}))
    const pending = result.current.retry()
    mocks.membership = { ...MEMBER, status: "suspendue", capabilities: [] }
    rerender()
    await act(async () => {
      resolve(mocks.page)
      expect(await pending).toBeUndefined()
    })
    expect(result.current).toMatchObject({ data: undefined, error: "suspended" })
  })
  it("attend l'adhésion sans servir une page restée en cache", () => {
    mocks.membership = undefined
    const data = source()
    const { result } = renderHook(() => data.useBookmarksPage({}))
    expect(mocks.query).toHaveBeenLastCalledWith("modules/marks/marks:paginateBookmarks", "skip")
    expect(result.current).toMatchObject({ data: undefined, isLoading: true, error: null })
  })
  it.each([
    { membership: null, error: "not_member" },
    { membership: { ...MEMBER, status: "suspendue", capabilities: [] }, error: "suspended" },
    { membership: new ConvexError({ code: "membershipSuspended" }), error: "suspended" },
  ])("ferme page et reprise : $error", ({ membership, error }) => {
    mocks.membership = membership
    const data = source()
    const { result } = renderHook(() => data.useBookmarksPage({}))
    expect(mocks.query).toHaveBeenLastCalledWith("modules/marks/marks:paginateBookmarks", "skip")
    expect(result.current).toMatchObject({ data: undefined, isLoading: false, error })
    result.current.retry()
    expect(mocks.page.refetch).not.toHaveBeenCalled()
  })
  it("conserve l'ABI historique de useBookmarks", () => {
    const data = source()
    const { result } = renderHook(() => data.useBookmarks())
    expect(result.current).toMatchObject({ status: "ready", data: [{ postId: "post-one" }] })
  })
})

describe("suggestions — admission de la lecture", () => {
  it("ne demande pas forMe pour un membre en attente et rend un tableau vide", () => {
    const data = source()
    const { result } = renderHook(() => data.useSuggestions())
    expect(result.current).toEqual({ status: "ready", data: [] })
    expect(mocks.loaded.mock.calls.map(([name]) => name)).not.toContain("modules/diaspora/suggestions:forMe")
  })
  it("ne demande pas forMe pendant la résolution de l'adhésion", () => {
    mocks.membership = undefined
    const data = source()
    const { result } = renderHook(() => data.useSuggestions())
    expect(result.current).toEqual({ status: "loading" })
    expect(mocks.loaded.mock.calls.map(([name]) => name)).not.toContain("modules/diaspora/suggestions:forMe")
  })
  it("rend le refus d'adhésion sans armer la lecture des suggestions", () => {
    mocks.membership = new ConvexError({ code: "membershipSuspended" })
    const data = source()
    const { result } = renderHook(() => data.useSuggestions())
    expect(result.current).toEqual({ status: "error", code: "suspended" })
    expect(mocks.loaded.mock.calls.map(([name]) => name)).not.toContain("modules/diaspora/suggestions:forMe")
  })
  it("arme la lecture publique normale après résolution d'un membre publiant", () => {
    mocks.membership = { ...MEMBER, status: "declaree", capabilities: ["read_network", "publish"] }
    const data = source()
    const { result } = renderHook(() => data.useSuggestions())
    expect(result.current).toEqual({ status: "ready", data: [] })
    expect(mocks.loaded).toHaveBeenCalledWith("modules/diaspora/suggestions:forMe", { networkId: "network-diasporale" })
  })
})
