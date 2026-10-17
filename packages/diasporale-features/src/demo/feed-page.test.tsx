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

  it("filtre les mots-dièse avant la pagination et conserve trente puis cinq résultats sans doublon", () => {
    const matches = Array.from({ length: 35 }, (_, index) => post(`tag-${String(index + 1).padStart(3, "0")}`, { body: index % 2 === 0 ? "Recette #ÉTÉ" : "Recette #été" }))
    const unrelated = Array.from({ length: 8 }, (_, index) => post(`sans-${index}`, { body: "Une autre publication #gabon" }))
    const data = source({ posts: [...matches, ...unrelated] })
    const { result, rerender } = renderHook((args: FeedPageRequest) => data.useFeedPage(args), { initialProps: { scope: "recents", tag: " ÉTÉ " } as FeedPageRequest })
    const first = result.current.data
    expect(first?.items).toHaveLength(30)
    expect(first?.nextCursor).toEqual({ publishedAt: NOW, postId: "tag-006" })
    rerender({ scope: "recents", tag: "été", cursor: first?.nextCursor })
    const second = result.current.data
    expect(second?.items.map((item) => item.id)).toEqual(["tag-005", "tag-004", "tag-003", "tag-002", "tag-001"])
    expect(second?.nextCursor).toBeNull()
    expect(new Set([...(first?.items ?? []), ...(second?.items ?? [])].map((item) => item.id)).size).toBe(35)
  })

  it("conserve le jeton Unicode canonique sans confondre İSTANBUL et istanbul", () => {
    const data = source({ posts: [post("unicode", { body: "Recette #İSTANBUL" }), post("simple", { body: "Recette #istanbul" })] })
    const { result } = renderHook(() => data.useFeedPage({ scope: "recents", tag: "i̇stanbul" }))
    expect(result.current.data?.items.map((item) => item.id)).toEqual(["unicode"])
  })

  it("aucun mot-dièse ne réintroduit une audience interdite, un contenu masqué ou un auteur bloqué", () => {
    const tagged = (id: string, overrides: Partial<DemoPost> = {}) => post(id, { body: "Recette #gabon", ...overrides })
    const data = source({
      posts: [
        tagged("visible"),
        tagged("hidden"),
        tagged("muted", { author: { kind: "person", id: "p-nadia" } }),
        tagged("blocked", { author: { kind: "person", id: "p-rodrigue" } }),
        tagged("private", { author: { kind: "person", id: "p-clarisse" }, audience: "connections" }),
        tagged("pending", { moderation: "pending_review" }),
        post("unrelated", { body: "Recette #été" }),
      ],
      marks: [{ personId: VIEWER, postId: "hidden", kind: "hidden", createdAt: NOW }],
      mutes: [[VIEWER, "p-nadia"]],
      blocks: [{ id: "block-recette", byId: "p-rodrigue", targetId: VIEWER, createdAt: NOW }],
    })
    const { result } = renderHook(() => data.useFeedPage({ scope: "recents", tag: "gabon" }))
    expect(result.current.data?.items.map((item) => item.id)).toEqual(["visible"])
  })

  it.each([
    { scope: "recents" as const, expected: ["local-fr", "local-ca", "diaspora"] },
    { scope: "diaspora" as const, expected: ["diaspora"] },
    { scope: "pour_vous" as const, expected: ["local-fr"] },
  ])("garde la portée $scope quand l'adresse conserve le pays d'un hub", ({ scope, expected }) => {
    const data = source({ posts: [
      post("local-fr", { author: { kind: "person", id: VIEWER }, body: "Recette #gabon", scope: { reach: "local", country: "FR" } }),
      post("local-ca", { body: "Recette #gabon", scope: { reach: "local", country: "CA" } }),
      post("diaspora", { body: "Recette #gabon" }),
    ] })
    const { result } = renderHook(() => data.useFeedPage({ scope, hubCountry: "CA", tag: "gabon" }))
    expect(result.current.data?.items.map((item) => item.id).sort()).toEqual([...expected].sort())
  })

  it("remplacer puis retirer le filtre relit le même fil autorisé", () => {
    const data = source({ posts: [post("gabon", { body: "Recette #gabon" }), post("ete", { body: "Recette #été" }), post("sans") ] })
    const { result, rerender } = renderHook((args: FeedPageRequest) => data.useFeedPage(args), { initialProps: { scope: "recents", tag: "gabon" } as FeedPageRequest })
    expect(result.current.data?.items.map((item) => item.id)).toEqual(["gabon"])
    rerender({ scope: "recents", tag: "été" })
    expect(result.current.data?.items.map((item) => item.id)).toEqual(["ete"])
    rerender({ scope: "recents", tag: " \t " })
    expect(result.current.data?.items.map((item) => item.id).sort()).toEqual(["ete", "gabon", "sans"])
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
