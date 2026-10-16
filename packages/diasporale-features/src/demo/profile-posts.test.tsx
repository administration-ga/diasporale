import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { ProfilePostsPageRequest } from "../data/types"
import { createDemoDataSource } from "./source"
import { createDemoSeed, type DemoPost, type DemoState } from "./state"
import { DemoStore } from "./store"

const NOW = Date.UTC(2026, 9, 16, 14)
const VIEWER = "p-steeve"
const AUTHOR = "p-mireille"
const HANDLE = "mireille.ivindo"

function post(id: string, overrides: Partial<DemoPost> = {}): DemoPost {
  return {
    id, author: { kind: "person", id: AUTHOR }, body: "Publication fictive du mur",
    scope: { reach: "diaspora" }, audience: "public", visibility: "network", moderation: "published",
    createdAt: NOW, reactions: {}, baseReactions: 0, editedAt: null, ...overrides,
  }
}

function source(overrides: Partial<DemoState> = {}) {
  const seed = createDemoSeed(NOW)
  const state: DemoState = { ...seed, posts: [], session: { personId: VIEWER }, ...overrides }
  const store = new DemoStore({ getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }, () => NOW, 0)
  return createDemoDataSource(store)
}

describe("démonstration — pages du mur gardé", () => {
  it("pagine trente publications d'un auteur puis la suite, sans mélanger les autres auteurs", () => {
    const posts = Array.from({ length: 35 }, (_, index) => post(`post-${String(index + 1).padStart(3, "0")}`))
    const data = source({ posts: [...posts, post("another-author", { author: { kind: "person", id: "p-nadia" }, createdAt: NOW + 1 })] })
    const { result, rerender } = renderHook((args: ProfilePostsPageRequest) => data.useProfilePostsPage(args), { initialProps: { handle: HANDLE } as ProfilePostsPageRequest })
    const first = result.current.data
    expect(first?.items).toHaveLength(30)
    expect(first?.items[0]?.id).toBe("post-035")
    expect(first?.nextCursor).toEqual({ publishedAt: NOW, postId: "post-006" })

    rerender({ handle: HANDLE, cursor: first?.nextCursor })
    const second = result.current.data
    expect(second?.items.map((item) => item.id)).toEqual(["post-005", "post-004", "post-003", "post-002", "post-001"])
    expect(second?.nextCursor).toBeNull()
    expect(new Set([...(first?.items ?? []), ...(second?.items ?? [])].map((item) => item.id)).size).toBe(35)
  })

  it("l'abonné ne voit que le public ; une connexion lit aussi le cercle", () => {
    const posts = [post("public"), post("circle", { audience: "connections" })]
    const following = source({ posts, connections: [], follows: [[VIEWER, AUTHOR]] })
    const connected = source({ posts, connections: [[VIEWER, AUTHOR]] })
    const { result: reader } = renderHook(() => following.useProfilePostsPage({ handle: HANDLE }))
    const { result: friend } = renderHook(() => connected.useProfilePostsPage({ handle: HANDLE }))
    expect(reader.current.data?.items.map((item) => item.id)).toEqual(["public"])
    expect(friend.current.data?.items.map((item) => item.id)).toEqual(["public", "circle"])
  })

  it("un mur ne filtre pas le pays de la publication comme un fil de hub", () => {
    const data = source({ posts: [post("local-ca", { scope: { reach: "local", country: "CA" } })] })
    const { result } = renderHook(() => data.useProfilePostsPage({ handle: ` @${HANDLE.toUpperCase()} ` }))
    expect(result.current.data?.items.map((item) => item.id)).toEqual(["local-ca"])
  })

  it("un handle inconnu, un profil retiré et un blocage rendent le même mur vide", () => {
    const seed = createDemoSeed(NOW)
    const author = seed.persons[AUTHOR]
    if (!author) throw new Error("auteur de démonstration absent")
    const missing = source({ posts: [post("unreadable")] })
    const withdrawn = source({ posts: [post("unreadable")], persons: { ...seed.persons, [AUTHOR]: { ...author, profile: null } } })
    const blocked = source({ posts: [post("unreadable")], blocks: [{ id: "block", byId: AUTHOR, targetId: VIEWER, createdAt: NOW }] })
    const { result } = renderHook(() => [
      missing.useProfilePostsPage({ handle: "unknown.recette" }),
      withdrawn.useProfilePostsPage({ handle: HANDLE }),
      blocked.useProfilePostsPage({ handle: HANDLE }),
    ])
    for (const page of result.current) expect(page).toMatchObject({ data: { items: [], nextCursor: null, lacunar: false }, error: null, isLoading: false })
  })

  it("la fiche fournit des images nulles et un mur historique vide, indépendamment des pages", () => {
    const data = source({ posts: [post("published")] })
    const { result } = renderHook(() => ({ profile: data.useProfile(HANDLE), wall: data.useProfilePostsPage({ handle: HANDLE }) }))
    expect(result.current.profile).toMatchObject({ status: "ready", data: { handle: HANDLE, avatar: null, cover: null, posts: [] } })
    expect(result.current.wall.data?.items.map((item) => item.id)).toEqual(["published"])
  })
})
