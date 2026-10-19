// @vitest-environment node
import { describe, expect, it } from "vitest"

import type { FeedCursorView, PostView } from "../../data/types"
import {
  canAutoAppend,
  discoveryReducer,
  discoveryTail,
  initialDiscoveryState,
  pageKey,
  snapshotOf,
  type DiscoveryPageReport,
  type DiscoveryState,
} from "./discovery-state"

const BASE = Date.UTC(2026, 9, 18, 12)
const PAGE = 30

/** Une publication fictive : plus le rang est petit, plus elle est récente. */
function post(rank: number | string, at?: number): PostView {
  const id = typeof rank === "number" ? `post-${String(rank).padStart(3, "0")}` : rank
  return {
    id,
    author: { kind: "person", id: "person-recette", handle: "recette", displayName: "Recette", badges: [] },
    body: `Publication ${id}`,
    media: [],
    share: null,
    shareCount: 0,
    scope: { reach: "diaspora" },
    audience: "public",
    visibility: "network",
    moderation: "published",
    createdAt: at ?? BASE - (typeof rank === "number" ? rank : 0) * 1_000,
    reactionCount: 0,
    commentCount: 0,
    myReaction: null,
    isMine: false,
    bookmarked: false,
    edited: false,
  }
}

const feedOf = (count: number) => Array.from({ length: count }, (_, index) => post(index + 1))

/** Comme une query réactive : la même lecture rend la même réponse tant que le fil ne change pas. */
const answers = new WeakMap<readonly PostView[], Map<string, DiscoveryPageReport>>()

function serve(feed: readonly PostView[], cursor: FeedCursorView | null): DiscoveryPageReport {
  const cache = answers.get(feed) ?? new Map<string, DiscoveryPageReport>()
  answers.set(feed, cache)
  const cached = cache.get(pageKey(cursor))
  if (cached !== undefined) return cached
  const answer = read(feed, cursor)
  cache.set(pageKey(cursor), answer)
  return answer
}

/** Le serveur : ordre décroissant, fenêtre STRICTEMENT derrière le curseur, curseur = dernière ligne rendue. */
function read(feed: readonly PostView[], cursor: FeedCursorView | null): DiscoveryPageReport {
  const ordered = [...feed].sort((left, right) => right.createdAt - left.createdAt || (left.id < right.id ? 1 : left.id > right.id ? -1 : 0))
  const after = cursor === null
    ? ordered
    : ordered.filter((item) => item.createdAt < cursor.publishedAt || (item.createdAt === cursor.publishedAt && item.id < cursor.postId))
  const items = after.slice(0, PAGE)
  const last = items.at(-1)
  return { items, nextCursor: after.length > PAGE && last ? { publishedAt: last.createdAt, postId: last.id } : null, lacunar: false, isLoading: false, error: null }
}

function report(state: DiscoveryState, cursor: FeedCursorView | null, value: DiscoveryPageReport): DiscoveryState {
  return discoveryReducer(state, { type: "report", key: pageKey(cursor), report: value })
}

/** Chaque page montée répond, jusqu'à stabilité (un pont inséré répond au tour suivant). */
function settle(start: DiscoveryState, feed: readonly PostView[]): DiscoveryState {
  let state = start
  for (let round = 0; round < 20; round += 1) {
    let next = state
    for (const cursor of [...next.cursors]) next = report(next, cursor, serve(feed, cursor))
    if (next === state) return state
    state = next
  }
  throw new Error("la chaîne ne se stabilise pas")
}

function appendAll(start: DiscoveryState, feed: readonly PostView[]): DiscoveryState {
  let state = settle(start, feed)
  while (canAutoAppend(state)) state = settle(discoveryReducer(state, { type: "append" }), feed)
  return state
}

const ids = (state: DiscoveryState) => state.items.map((item) => item.id)

describe("découverte — même source paginée que la liste", () => {
  it("lit trente publications puis la suite au curseur du serveur, sans trou ni doublon", () => {
    const feed = feedOf(35)
    const first = settle(initialDiscoveryState(), feed)
    expect(first.items).toHaveLength(30)
    expect(first.activeId).toBe("post-001")
    expect(discoveryTail(first)).toBe("more")
    expect(canAutoAppend(first)).toBe(true)

    const all = settle(discoveryReducer(first, { type: "append" }), feed)
    expect(ids(all)).toEqual(feed.map((item) => item.id))
    expect(all.cursors).toEqual([null, { publishedAt: feed[29]!.createdAt, postId: "post-030" }])
    expect(discoveryTail(all)).toBe("end")
    expect(canAutoAppend(all)).toBe(false)
    // Ajouter deux fois la même page ne monte rien de plus.
    expect(discoveryReducer(all, { type: "append" })).toBe(all)
  })

  it("une arrivée en tête attend « Actualiser » : curseurs stables, actif et position inchangés", () => {
    const feed = feedOf(65)
    const loaded = discoveryReducer(appendAll(initialDiscoveryState(), feed), { type: "activate", index: 45 })
    const before = loaded.cursors
    expect(loaded.items).toHaveLength(65)
    expect(loaded.activeId).toBe("post-046")

    const fresh = [post("arrivee-1", BASE + 5_000), post("arrivee-2", BASE + 9_000)]
    const live = settle(loaded, [...fresh, ...feed])
    expect(ids(live)).toEqual(ids(loaded))
    expect(live.pending.map((item) => item.id)).toEqual(["arrivee-2", "arrivee-1"])
    expect(live.activeId).toBe("post-046")
    expect(live.activeIndex).toBe(45)
    // Aucune page déjà montée n'est réalignée ni abandonnée : un pont s'ajoute.
    for (const cursor of before) expect(live.cursors).toContainEqual(cursor)
    expect(live.cursors.length).toBe(before.length + 1)

    const refreshed = discoveryReducer(live, { type: "refresh" })
    expect(refreshed.items).toHaveLength(67)
    expect(refreshed.items[0]?.id).toBe("arrivee-2")
    expect(refreshed.pending).toEqual([])
    expect(refreshed.activeIndex).toBe(0)
    expect(refreshed.activeId).toBe("arrivee-2")
    expect(discoveryReducer(refreshed, { type: "refresh" })).toBe(refreshed)
  })

  it("ramasse les ponts devenus inutiles : la chaîne reste bornée sous un flux d'arrivées", () => {
    const feed = feedOf(65)
    let state = discoveryReducer(appendAll(initialDiscoveryState(), feed), { type: "activate", index: 40 })
    const pages = state.cursors.length
    let current = feed
    for (let arrival = 1; arrival <= 12; arrival += 1) {
      current = [post(`arrivee-${arrival}`, BASE + arrival * 10_000), ...current]
      state = settle(state, current)
      expect(state.cursors.length).toBeLessThanOrEqual(pages + 1)
      expect(ids(state)).toEqual(feed.map((item) => item.id))
    }
    expect(state.pending).toHaveLength(12)
    expect(state.activeId).toBe("post-041")
  })

  it("garde sa place pendant une transition, puis la rend au pont qui répond", () => {
    const feed = feedOf(65)
    const loaded = discoveryReducer(appendAll(initialDiscoveryState(), feed), { type: "activate", index: 29 })
    expect(loaded.activeId).toBe("post-030")
    const current = [post("arrivee", BASE + 10_000), ...feed]
    // Seule la première page répond : la frontière recule, `post-030` n'est plus dans aucune page répondue.
    const shifted = report(loaded, null, serve(current, null))
    expect(shifted.cursors.length).toBe(loaded.cursors.length + 1)
    expect(ids(shifted)).toEqual(ids(loaded))
    expect(shifted.activeId).toBe("post-030")
    const bridged = settle(shifted, current)
    expect(ids(bridged)).toEqual(ids(loaded))
    expect(bridged.activeId).toBe("post-030")
  })

  it("une publication retirée disparaît dès que les pages ont répondu, la suivante prend la place", () => {
    const feed = feedOf(40)
    const loaded = discoveryReducer(appendAll(initialDiscoveryState(), feed), { type: "activate", index: 10 })
    expect(loaded.activeId).toBe("post-011")
    const removed = settle(loaded, feed.filter((item) => item.id !== "post-011"))
    expect(ids(removed)).not.toContain("post-011")
    expect(removed.items).toHaveLength(39)
    expect(removed.activeIndex).toBe(10)
    expect(removed.activeId).toBe("post-012")
  })

  it("rien n'est gardé quand la lecture tombe (adhésion suspendue)", () => {
    const feed = feedOf(40)
    const loaded = appendAll(initialDiscoveryState(), feed)
    let state = loaded
    for (const cursor of loaded.cursors) state = report(state, cursor, { items: undefined, nextCursor: null, lacunar: false, isLoading: false, error: "suspended" })
    expect(state.items).toEqual([])
    expect(state.pending).toEqual([])
    expect(state.activeId).toBeNull()
    expect(discoveryTail(state)).toBe("error")
    // Même un chargement sans données en tête ne garde rien : seule une transition locale garde sa place.
    const reloading = report(loaded, null, { items: undefined, nextCursor: null, lacunar: false, isLoading: true, error: null })
    expect(reloading.items.map((item) => item.id)).not.toContain("post-001")
  })

  it("derrière une fenêtre lacunaire vide, la suite ne s'enchaîne qu'au geste", () => {
    const frontier = { publishedAt: BASE - 99_000, postId: "post-099" }
    const state = report(initialDiscoveryState(), null, { items: [], nextCursor: frontier, lacunar: true, isLoading: false, error: null })
    expect(canAutoAppend(state)).toBe(false)
    expect(discoveryTail(state)).toBe("more")
    expect(discoveryReducer(state, { type: "append" }).cursors).toEqual([null, frontier])
  })

  it("un fil vide se dit vide ; un chargement se dit en cours", () => {
    expect(discoveryTail(initialDiscoveryState())).toBe("loading")
    expect(discoveryTail(settle(initialDiscoveryState(), []))).toBe("empty")
  })

  it("reprend au même endroit : mêmes curseurs, même actif, arrivées tenues en attente", () => {
    const feed = feedOf(65)
    const left = discoveryReducer(appendAll(initialDiscoveryState(), feed), { type: "activate", index: 52 })
    const snapshot = snapshotOf(left)
    const back = settle(initialDiscoveryState(snapshot), [post("pendant-absence", BASE + 60_000), ...feed])
    expect(back.cursors).toEqual(expect.arrayContaining([...left.cursors]))
    expect(back.activeId).toBe("post-053")
    expect(back.activeIndex).toBe(52)
    expect(back.pending.map((item) => item.id)).toEqual(["pendant-absence"])
  })

  it("borne l'activation, diapositive d'état comprise", () => {
    const state = settle(initialDiscoveryState(), feedOf(3))
    expect(discoveryReducer(state, { type: "activate", index: 99 })).toMatchObject({ activeIndex: 3, activeId: null })
    expect(discoveryReducer(state, { type: "activate", index: -4 })).toBe(state)
  })

  it("ignore le rapport d'une page qui n'est plus montée", () => {
    const state = settle(initialDiscoveryState(), feedOf(3))
    expect(report(state, { publishedAt: 1, postId: "ailleurs" }, serve(feedOf(3), null))).toBe(state)
  })
})
