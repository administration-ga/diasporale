// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import type { CommentsPageRequest } from "@diasporale/features/data"
import { act, cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEngineDataSource } from "./engine-source"

/**
 * FD-03 — les commentaires et les réponses se lisent page après page sur le curseur du
 * moteur (`paginateComments`, `paginateReplies`), avec la reprise et les refus des pages.
 */
const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isPending: false, isUnauthenticated: false },
  network: { _id: "network-diasporale" } as unknown,
  membership: undefined as unknown,
  query: vi.fn(),
  page: { data: undefined as unknown, isError: false, isSuccess: true, isFetching: false, dataUpdatedAt: 1, error: null as unknown, refetch: vi.fn() },
}))
vi.mock("@antsia/api/hooks", () => ({
  useStableConvexAuth: () => mocks.auth,
  useAuthenticatedConvexQuery: (query: Parameters<typeof getFunctionName>[0], args: unknown) => {
    mocks.query(getFunctionName(query), args)
    return args === "skip" ? { data: undefined, isError: false, isSuccess: false, isFetching: false, dataUpdatedAt: 0, error: null, refetch: vi.fn() } : mocks.page
  },
}))
vi.mock("convex/react", () => ({
  useQueries: (queries: Record<string, { query: Parameters<typeof getFunctionName>[0]; args?: unknown }>) => {
    if (!queries.value) return {}
    const name = getFunctionName(queries.value.query)
    switch (name) {
      case "modules/networks/networks:getBySlug": return { value: mocks.network }
      case "modules/diaspora/membership:myMembership": return { value: mocks.membership }
      default: throw new Error(`Unexpected query ${name}`)
    }
  },
}))

const MEMBER = { status: "declaree", capabilities: ["read_network", "publish"], facet: { countryOfResidence: "FR" } }
const author = { personId: "person-one", displayName: "Membre Fictif", handle: "membre.fictif", avatarUrl: null }
const reply = { commentId: "reply-one", author, body: "Réponse fictive", createdAt: 2, editedAt: null, isMine: false }
const thread = { commentId: "comment-one", author, body: "Commentaire fictif", createdAt: 1, editedAt: 3, isMine: true, replyCount: 51, replies: [reply] }

function source() {
  return createEngineDataSource({ convex: {} as ConvexReactClient, authClient: {} as EngineAuthClient })
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
  mocks.network = { _id: "network-diasporale" }
  mocks.membership = { ...MEMBER }
  mocks.page = { data: { page: [thread], isDone: false, continueCursor: "opaque:next" }, isError: false, isSuccess: true, isFetching: false, dataUpdatedAt: 1, error: null, refetch: vi.fn().mockResolvedValue(undefined) }
})
afterEach(cleanup)

describe("commentaires — port moteur paginé (FD-03)", () => {
  it("lit vingt racines par page, avec leur aperçu, et rend la suite du moteur", () => {
    const data = source()
    const { result } = renderHook(() => data.useCommentsPage({ postId: "post-one" }))
    expect(mocks.query).toHaveBeenLastCalledWith("modules/engagement/engagement:paginateComments", {
      networkId: "network-diasporale", postId: "post-one", paginationOpts: { numItems: 20, cursor: null },
    })
    expect(result.current).toMatchObject({
      isLoading: false,
      error: null,
      data: {
        isDone: false,
        continueCursor: "opaque:next",
        items: [{ id: "comment-one", body: "Commentaire fictif", edited: true, isMine: true, replyCount: 51, replies: [{ id: "reply-one", edited: false }] }],
      },
    })
  })

  it("transmet le curseur opaque de la page suivante, sans le décoder", () => {
    const data = source()
    const { rerender } = renderHook((args: CommentsPageRequest) => data.useCommentsPage(args), { initialProps: { postId: "post-one" } as CommentsPageRequest })
    rerender({ postId: "post-one", cursor: "opaque:{page-2}" })
    expect(mocks.query).toHaveBeenLastCalledWith("modules/engagement/engagement:paginateComments", {
      networkId: "network-diasporale", postId: "post-one", paginationOpts: { numItems: 20, cursor: "opaque:{page-2}" },
    })
  })

  it("les réponses d'une racine : cinquante par page, suite par le curseur", () => {
    mocks.page = { ...mocks.page, data: { page: [reply], isDone: true, continueCursor: "opaque:end" } }
    const data = source()
    const { result } = renderHook(() => data.useRepliesPage({ postId: "post-one", commentId: "comment-one", cursor: "opaque:reponses-2" }))
    expect(mocks.query).toHaveBeenLastCalledWith("modules/engagement/engagement:paginateReplies", {
      networkId: "network-diasporale", postId: "post-one", commentId: "comment-one", paginationOpts: { numItems: 50, cursor: "opaque:reponses-2" },
    })
    expect(result.current.data).toEqual({ items: [{ id: "reply-one", author: { personId: "person-one", handle: "membre.fictif", displayName: "Membre Fictif" }, body: "Réponse fictive", createdAt: 2, edited: false, isMine: false }], continueCursor: "opaque:end", isDone: true })
  })

  it("ne recrée pas la page sans nouvelle réponse du moteur", () => {
    const data = source()
    const { result, rerender } = renderHook(() => data.useCommentsPage({ postId: "post-one" }))
    const first = result.current.data
    rerender()
    expect(result.current.data).toBe(first)
  })

  it("une panne garde la page lue et se reprend ; le rejet de la reprise est absorbé", async () => {
    mocks.page = { ...mocks.page, isError: true, error: new Error("trace privée"), refetch: vi.fn().mockRejectedValue(new Error("hors ligne")) }
    const data = source()
    const { result } = renderHook(() => data.useCommentsPage({ postId: "post-one" }))
    expect(result.current.data?.items).toHaveLength(1)
    expect(result.current.error).toBe("unknown")
    await act(async () => { result.current.retry() })
    expect(mocks.page.refetch).toHaveBeenCalledOnce()
  })

  it("un refus d'accès ne sert aucun cache, pas même pendant la reprise", () => {
    const data = source()
    const { result, rerender } = renderHook(() => data.useRepliesPage({ postId: "post-one", commentId: "comment-one" }))
    expect(result.current.data?.items).toHaveLength(1)
    mocks.page = { ...mocks.page, isError: true, isSuccess: false, error: new ConvexError({ code: "notFound" }) }
    rerender()
    expect(result.current).toMatchObject({ data: undefined, error: "not_found" })
    mocks.page = { ...mocks.page, isError: false, isSuccess: true, isFetching: true, error: null }
    rerender()
    expect(result.current.data).toBeUndefined()
  })

  it("hors du réseau : rien n'est demandé au moteur, le refus est dit", () => {
    mocks.membership = { ...MEMBER, status: "suspendue", capabilities: [] }
    const data = source()
    const { result } = renderHook(() => data.useCommentsPage({ postId: "post-one" }))
    expect(mocks.query).toHaveBeenLastCalledWith("modules/engagement/engagement:paginateComments", "skip")
    expect(result.current).toMatchObject({ data: undefined, error: "suspended" })
    mocks.auth = { isAuthenticated: false, isPending: false, isUnauthenticated: true }
    const anonymous = renderHook(() => data.useCommentsPage({ postId: "post-one" }))
    expect(anonymous.result.current).toMatchObject({ data: undefined, error: "not_signed_in" })
  })
})
