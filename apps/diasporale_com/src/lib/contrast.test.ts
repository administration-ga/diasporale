import { describe, expect, it } from "vitest"

import { contrastLevel, contrastRatio, relativeLuminance } from "./contrast"

describe("contrastRatio — WCAG 2.1", () => {
  it("noir sur blanc : 21:1 ; une couleur sur elle-même : 1:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5)
    expect(contrastRatio("#0072b9", "#0072b9")).toBeCloseTo(1, 5)
  })

  it("retrouve les paires mesurées de la charte v2", () => {
    expect(contrastRatio("#14130f", "#f7f6f2")).toBeCloseTo(17.19, 2)
    expect(contrastRatio("#5c5952", "#f7f6f2")).toBeCloseTo(6.46, 2)
    expect(contrastRatio("#f7f6f2", "#14130f")).toBeCloseTo(17.19, 2)
    expect(contrastRatio("#b0aa99", "#14130f")).toBeCloseTo(8.02, 2)
  })

  it("accepte la forme courte, refuse ce qui n'est pas une couleur opaque", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 5)
    expect(relativeLuminance("color-mix(in srgb, #fff 50%, transparent)")).toBeNull()
    expect(contrastRatio("", "#ffffff")).toBeNull()
    expect(contrastRatio("#ffffff80", "#000000")).toBeNull()
  })
})

describe("contrastLevel — le niveau atteint", () => {
  it.each([
    [7.1, "text", "aaa"],
    [4.5, "text", "aa"],
    [4.49, "text", "fail"],
    [3, "component", "component"],
    [2.99, "component", "fail"],
  ] as const)("%s:1 en %s donne %s", (ratio, kind, level) => {
    expect(contrastLevel(ratio, kind)).toBe(level)
  })
})
