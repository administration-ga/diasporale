import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { LIGHT_ACCOUNT_GROUNDS } from "@diasporale/domain"
import type { BookmarksPageRequest } from "../data/types"
import { createDemoDataSource } from "./source"
import { createDemoSeed, type DemoPost, type DemoState } from "./state"
import { DemoStore } from "./store"

const NOW = Date.UTC(2026, 9, 17, 9)
const VIEWER = "p-steeve"
const ids = Array.from({ length: 55 }, (_, index) => `post-${String(index + 1).padStart(3, "0")}`)
function source(overrides: Partial<DemoState> = {}) {
  const seed = createDemoSeed(NOW)
  const posts: DemoPost[] = ids.map((id) => ({
    id, author: { kind: "person", id: "p-mireille" }, body: "Signet fictif de recette", scope: { reach: "diaspora" },
    audience: "public", visibility: "network", moderation: "published", createdAt: NOW, reactions: {}, baseReactions: 0, editedAt: null,
  }))
  const state: DemoState = { ...seed, posts, marks: ids.map((postId) => ({ personId: VIEWER, postId, kind: "bookmark", createdAt: NOW })), session: { personId: VIEWER }, ...overrides }
  const store = new DemoStore({ getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }, () => NOW, 0)
  return { store, data: createDemoDataSource(store) }
}

describe("démonstration — pages natives des signets", () => {
  it("lit cinquante marques puis les cinq suivantes sans trou à date identique", () => {
    const { data } = source()
    const { result, rerender } = renderHook((args: BookmarksPageRequest) => data.useBookmarksPage(args), { initialProps: {} as BookmarksPageRequest })
    const first = result.current.data!
    expect(first.items).toHaveLength(50)
    expect(first.items[0]!.postId).toBe("post-055")
    expect(first.isDone).toBe(false)
    expect(typeof first.continueCursor).toBe("string")
    rerender({ cursor: first.continueCursor })
    expect(result.current.data?.items.map((item) => item.postId)).toEqual(["post-005", "post-004", "post-003", "post-002", "post-001"])
    expect(result.current.data?.isDone).toBe(true)
    expect(new Set([...first.items, ...result.current.data!.items].map((item) => item.postId)).size).toBe(55)
  })
  it("une première fenêtre entièrement devenue illisible reste continuable", () => {
    const { data } = source({ posts: [] })
    const { result, rerender } = renderHook((args: BookmarksPageRequest) => data.useBookmarksPage(args), { initialProps: {} as BookmarksPageRequest })
    expect(result.current.data).toMatchObject({ items: [], isDone: false })
    rerender({ cursor: result.current.data!.continueCursor })
    expect(result.current.data).toMatchObject({ items: [], isDone: true })
  })
  it("ne change pas la projection sans changement d'état local", () => {
    const { data } = source()
    const { result, rerender } = renderHook(() => data.useBookmarksPage({}))
    const first = result.current.data
    rerender()
    expect(result.current.data).toBe(first)
  })
  it("un retrait normal actualise la page et sa frontière sans recharger", async () => {
    const { data } = source()
    const { result } = renderHook(() => data.useBookmarksPage({}))
    const retry = result.current.retry
    const before = result.current.data!.continueCursor
    await act(async () => { await data.actions.toggleBookmark("post-055") })
    expect(result.current.data!.items).toHaveLength(50)
    expect(result.current.data!.items.some((item) => item.postId === "post-055")).toBe(false)
    expect(result.current.data!.continueCursor).not.toBe(before)
    const fresh = await retry()
    expect(fresh?.items.some((item) => item.postId === "post-055")).toBe(false)
    expect(fresh?.continueCursor).not.toBe(before)
  })
  it("garde useBookmarks historique et ne rend aucune query distante", () => {
    const { data } = source()
    const { result } = renderHook(() => ({ page: data.useBookmarksPage({}), legacy: data.useBookmarks() }))
    expect(result.current.legacy.status === "ready" && result.current.legacy.data.length).toBe(55)
    expect(result.current.page.data?.items).toHaveLength(50)
    expect(() => result.current.page.retry()).not.toThrow()
  })
  it("refuse un curseur malformé avec un code déjà connu", () => {
    const { data } = source()
    const { result } = renderHook(() => data.useBookmarksPage({ cursor: "not-json" }))
    expect(result.current).toMatchObject({ data: undefined, error: "unknown", isLoading: false })
  })
  it("un curseur d'un autre lecteur ne transporte pas ses choix", async () => {
    const { data, store } = source()
    const { result, rerender } = renderHook((args: BookmarksPageRequest) => data.useBookmarksPage(args), { initialProps: {} as BookmarksPageRequest })
    const cursor = result.current.data!.continueCursor
    await act(async () => { await store.switchTo("p-mireille") })
    rerender({ cursor })
    expect(result.current).toMatchObject({ data: undefined, error: "unknown" })
    rerender({ cursor: null })
    expect(result.current.data).toMatchObject({ items: [], isDone: true })
  })
  it("permet les lectures d'un compte en attente", () => {
    const seed = createDemoSeed(NOW)
    const pendingId = "p-nadia"
    const { data } = source({ session: { personId: pendingId }, memberships: { ...seed.memberships, [pendingId]: { ...seed.memberships[pendingId]!, grounds: LIGHT_ACCOUNT_GROUNDS } } })
    const { result } = renderHook(() => data.useBookmarksPage({}))
    expect(result.current).toMatchObject({ data: { items: [], isDone: true }, error: null })
  })
  it("refuse la session anonyme et une suspension sans droit de lire", () => {
    const seed = createDemoSeed(NOW)
    const member = seed.memberships[VIEWER]!
    const anonymous = source({ session: { personId: null } }).data
    const suspended = source({ memberships: { ...seed.memberships, [VIEWER]: { ...member, grounds: { ...member.grounds, suspension: { until: null, readAccess: "none" } } } } }).data
    const { result } = renderHook(() => [anonymous.useBookmarksPage({}), suspended.useBookmarksPage({})])
    expect(result.current[0]).toMatchObject({ data: undefined, error: "not_signed_in" })
    expect(result.current[1]).toMatchObject({ data: undefined, error: "suspended" })
  })
  it("une reprise relit la session courante et ne renvoie pas la page d'avant déconnexion", async () => {
    const { data, store } = source()
    const { result } = renderHook(() => data.useBookmarksPage({}))
    const retry = result.current.retry
    expect(result.current.data?.items).toHaveLength(50)
    await act(async () => { await store.signOutEverywhere() })
    expect(await retry()).toBeUndefined()
    expect(result.current.data).toBeUndefined()
  })
})
