import { describe, expect, it } from "vitest"

import { avatarTone, initials } from "./avatar"

describe("initials — les deux lettres de l'avatar", () => {
  it.each([
    ["Awa Ogooué", "AO"],
    ["Awa O.", "AO"],
    ["Jean-Pierre Mba", "JM"],
    ["Éloïse", "É"],
    ["Association d'exemple (démo)", "AE"],
    ["Sample association (demo)", "SA"],
    ["Gabonais de Lyon (démo)", "GL"],
    ["  ", ""],
  ])("« %s » donne « %s »", (name, expected) => {
    expect(initials(name)).toBe(expected)
  })

  it("une mention entre parenthèses ne devient jamais une initiale", () => {
    expect(initials("Entreprise d'exemple (démo)")).not.toMatch(/[()]/)
  })
})

describe("avatarTone — une teinte stable par identifiant", () => {
  it("rend toujours la même teinte, entre 1 et 6", () => {
    const tone = avatarTone("awa")
    expect(tone).toBe(avatarTone("awa"))
    expect(tone).toBeGreaterThanOrEqual(1)
    expect(tone).toBeLessThanOrEqual(6)
  })
})
