import { HOUR_MS } from "@diasporale/domain"
import { describe, expect, it } from "vitest"

import { NOTIFICATIONS_PAGE_SIZE } from "../data/types"
import { demoNotificationCursor, notificationsPageView, notificationsView, readDemoNotificationCursor } from "./selectors"
import { createDemoSeed, type DemoNotification, type DemoState } from "./state"

/**
 * NP-04 — la démonstration pagine la cloche comme le moteur : du plus récent au plus ancien, une
 * page de vingt, la suite reprise au dernier avis montré ; la feuille garde ses trente premiers.
 */
const T0 = Date.UTC(2026, 10, 10, 9)
const VIEWER = "p-mireille"

function avis(index: number, overrides: Partial<DemoNotification> = {}): DemoNotification {
  return {
    id: `avis-${String(index).padStart(2, "0")}`,
    recipientId: VIEWER,
    kind: "post_comment",
    actorId: "p-prisca",
    createdAt: T0 - index * HOUR_MS,
    readAt: index % 2 === 0 ? null : T0,
    connectionRequestId: null,
    inviteDeclined: false,
    postId: `pub-${index}`,
    ...overrides,
  }
}

function stateWith(notifications: readonly DemoNotification[]): DemoState {
  return { ...createDemoSeed(T0), notifications }
}

describe("démonstration — la cloche page après page (NP-04)", () => {
  const state = stateWith([...Array.from({ length: 45 }, (_, index) => avis(index)), avis(99, { recipientId: "p-prisca" })])

  it("avec 45 avis : trois pages de vingt, vingt, cinq, sans doublon ni saut, et les avis d'un autre membre exclus", () => {
    const first = notificationsPageView(state, VIEWER)
    expect(first.items).toHaveLength(NOTIFICATIONS_PAGE_SIZE)
    expect(first.isDone).toBe(false)
    const second = notificationsPageView(state, VIEWER, readDemoNotificationCursor(first.continueCursor))
    const third = notificationsPageView(state, VIEWER, readDemoNotificationCursor(second.continueCursor))
    expect(second.items).toHaveLength(20)
    expect(third.items).toHaveLength(5)
    expect(third.isDone).toBe(true)
    const ids = [...first.items, ...second.items, ...third.items].map((item) => item.id)
    expect(ids).toEqual(Array.from({ length: 45 }, (_, index) => `avis-${String(index).padStart(2, "0")}`))
    expect(first.items[0]).toMatchObject({ kind: "post_comment", postId: "pub-0", read: false })
  })

  it("un avis arrivé en tête ne décale pas la suite déjà demandée", () => {
    const first = notificationsPageView(state, VIEWER)
    const later = stateWith([avis(-1, { id: "avis-nouveau" }), ...state.notifications])
    const second = notificationsPageView(later, VIEWER, readDemoNotificationCursor(first.continueCursor))
    expect(second.items[0]?.id).toBe("avis-20")
  })

  it("la feuille de la cloche garde ses trente premiers avis, dans le même ordre", () => {
    expect(notificationsView(state, VIEWER).map((item) => item.id)).toEqual(notificationsPageView(state, VIEWER, null, 30).items.map((item) => item.id))
  })

  it("un curseur illisible ou d'une autre liste n'est pas lu", () => {
    expect(readDemoNotificationCursor(null)).toBeNull()
    expect(readDemoNotificationCursor("pas-un-curseur")).toBeUndefined()
    expect(readDemoNotificationCursor(JSON.stringify(["demo-comments", 1, "x"]))).toBeUndefined()
    expect(readDemoNotificationCursor(demoNotificationCursor({ at: 5, id: "avis-05" }))).toEqual({ at: 5, id: "avis-05" })
  })

  it("aucun avis : une page vide, finie", () => {
    expect(notificationsPageView(stateWith([]), VIEWER)).toEqual({ items: [], continueCursor: "", isDone: true })
  })
})
