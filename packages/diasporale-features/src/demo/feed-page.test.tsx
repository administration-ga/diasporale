import type { FeedPageRequest } from "../data/types"
import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createDemoDataSource } from "./source"
import { createDemoSeed, type DemoPost, type DemoState } from "./state"
import { DemoStore } from "./store"

const NOW = Date.UTC(2026, 9, 16, 12)
const VIEWER = "p-steeve"

function post(id: string, overrides: Partial<DemoPost> = {}): DemoPost {
  return {
    id,
    author: { kind: "person", id: "p-mireille" },
    body: "Publication fictive de recette",
    scope: { reach: "diaspora" },
    audience: "public",
    visibility: "network",
    moderation: "published",
    createdAt: NOW,
    reactions: {},
    baseReactions: 0,
    editedAt: null,
    ...overrides,
  }
}

function source(overrides: Partial<DemoState> = {}) {
  const seed = createDemoSeed(NOW)
  const state: DemoState = { ...seed, posts: [], session: { personId: VIEWER }, ...overrides }
  const store = new DemoStore({ getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }, () => NOW, 0)
  return createDemoDataSource(store)
}

describe("démonstration — pagination du même fil gardé", () => {
  it("lit trente publications puis la suite sans trou ni doublon, même au même instant", () => {
    const posts = Array.from({ length: 35 }, (_, index) => post(`post-${String(index + 1).padStart(3, "0")}`))
    const data = source({ posts })
    const { result, rerender } = renderHook((args: FeedPageRequest) => data.useFeedPage(args), { initialProps: { scope: "recents" } as FeedPageRequest })
    const first = result.current.data
    expect(first?.items).toHaveLength(30)
    expect(first?.items[0]?.id).toBe("post-035")
    expect(first?.nextCursor).toEqual({ publishedAt: NOW, postId: "post-006" })

    rerender({ scope: "recents", cursor: first?.nextCursor })
    const second = result.current.data
    expect(second?.items.map((item) => item.id)).toEqual(["post-005", "post-004", "post-003", "post-002", "post-001"])
    expect(second?.nextCursor).toBeNull()
    expect(new Set([...(first?.items ?? []), ...(second?.items ?? [])].map((item) => item.id)).size).toBe(35)
    expect(result.current).toMatchObject({ error: null, isLoading: false, data: { lacunar: false } })
  })

  it("garde le pays du hub et les audiences avant la pagination", () => {
    const data = source({
      posts: [
        post("local-fr", { scope: { reach: "local", country: "FR" } }),
        post("local-ca", { scope: { reach: "local", country: "CA" } }),
        post("diaspora"),
        post("connections-only", { author: { kind: "person", id: "p-nadia" }, audience: "connections" }),
      ],
    })
    const { result } = renderHook(() => data.useFeedPage({ scope: "mon_pays", hubCountry: "CA" }))
    expect(result.current.data?.items.map((item) => item.id)).toEqual(["local-ca", "diaspora"])
  })

  it("ne remet pas dans une page les publications masquées ou l'auteur en sourdine", () => {
    const data = source({
      posts: [post("hidden"), post("muted", { author: { kind: "person", id: "p-nadia" } }), post("visible")],
      marks: [{ personId: VIEWER, postId: "hidden", kind: "hidden", createdAt: NOW }],
      mutes: [[VIEWER, "p-nadia"]],
    })
    const { result } = renderHook(() => data.useFeedPage({ scope: "recents" }))
    expect(result.current.data?.items.map((item) => item.id)).toEqual(["visible"])
  })

  it("permet la lecture au membre en attente et garde useFeed compatible", () => {
    const data = source({ posts: [post("visible")] })
    const { result } = renderHook(() => ({ page: data.useFeedPage({ scope: "recents" }), legacy: data.useFeed({ scope: "recents" }) }))
    expect(result.current.page.data?.items.map((item) => item.id)).toEqual(["visible"])
    expect(result.current.legacy).toMatchObject({ status: "ready", data: [{ id: "visible" }] })
    expect(() => result.current.page.retry()).not.toThrow()
  })

  it("rend un refus fermé sans page pour une session anonyme", () => {
    const data = source({ session: { personId: null }, posts: [post("unreadable")] })
    const { result } = renderHook(() => data.useFeedPage({ scope: "recents" }))
    expect(result.current).toMatchObject({ data: undefined, isLoading: false, error: "not_signed_in" })
  })

  it("ne rend aucune page à une adhésion suspendue sans lecture", () => {
    const seed = createDemoSeed(NOW)
    const membership = seed.memberships[VIEWER]
    if (!membership) throw new Error("adhésion de démonstration absente")
    const data = source({
      posts: [post("unreadable")],
      memberships: { ...seed.memberships, [VIEWER]: { ...membership, grounds: { ...membership.grounds, suspension: { until: null, readAccess: "none" } } } },
    })
    const { result } = renderHook(() => data.useFeedPage({ scope: "recents" }))
    expect(result.current).toMatchObject({ data: undefined, isLoading: false, error: "suspended" })
  })
})
