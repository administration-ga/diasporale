// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  DISCOVERY_MAX_MOUNTED,
  DISCOVERY_SEEN_LIMIT,
  discoveryWindow,
  rememberSeen,
  slideRendering,
  type SlideRenderingContext,
} from "./discovery-window"

const context = (active: number, overrides: Partial<SlideRenderingContext> = {}): SlideRenderingContext => ({
  active,
  wasSeen: () => true,
  preloadNext: true,
  ...overrides,
})

describe("découverte — fenêtre de recyclage", () => {
  it("monte l'active et deux voisines de chaque côté, bornées par la liste", () => {
    expect(discoveryWindow(0, 30)).toEqual({ start: 0, end: 3 })
    expect(discoveryWindow(10, 30)).toEqual({ start: 8, end: 13 })
    expect(discoveryWindow(29, 30)).toEqual({ start: 27, end: 30 })
    expect(discoveryWindow(45, 30)).toEqual({ start: 27, end: 30 })
    expect(discoveryWindow(0, 0)).toEqual({ start: 0, end: 0 })
  })

  it("reste bornée après cent avances, quel que soit le nombre d'éléments", () => {
    const sizes = new Set<number>()
    let fullAtOnce = 0
    for (let active = 0; active <= 100; active += 1) {
      const range = discoveryWindow(active, 1_000)
      sizes.add(range.end - range.start)
      let full = 0
      for (let index = range.start; index < range.end; index += 1) if (slideRendering(index, context(active)) === "full") full += 1
      fullAtOnce = Math.max(fullAtOnce, full)
    }
    expect(Math.max(...sizes)).toBe(DISCOVERY_MAX_MOUNTED)
    expect(DISCOVERY_MAX_MOUNTED).toBe(5)
    // L'active, la suivante, la précédente déjà vue : jamais plus de trois cartes avec médias.
    expect(fullAtOnce).toBe(3)
  })

  it("ne précharge rien au-delà de la suivante, ni vers l'arrière ce qui n'a pas été vu", () => {
    const unseen = context(5, { wasSeen: () => false })
    expect([3, 4, 5, 6, 7].map((index) => slideRendering(index, unseen))).toEqual(["dormant", "dormant", "full", "full", "dormant"])
    const seen = context(5)
    expect([3, 4, 5, 6, 7].map((index) => slideRendering(index, seen))).toEqual(["dormant", "full", "full", "full", "dormant"])
  })

  it("sous économie de données, même la suivante reste en veille", () => {
    expect([4, 5, 6].map((index) => slideRendering(index, context(5, { preloadNext: false })))).toEqual(["full", "full", "dormant"])
  })

  it("retient une mémoire bornée des publications vues, la plus récente en dernier", () => {
    let seen: readonly string[] = []
    for (let index = 0; index < 100; index += 1) seen = rememberSeen(seen, `post-${index}`)
    expect(seen).toHaveLength(DISCOVERY_SEEN_LIMIT)
    expect(seen.at(-1)).toBe("post-99")
    expect(rememberSeen(seen, "post-99")).toBe(seen)
    expect(rememberSeen(seen, "post-95").at(-1)).toBe("post-95")
    expect(new Set(rememberSeen(seen, "post-95")).size).toBe(DISCOVERY_SEEN_LIMIT)
  })
})
