import { describe, expect, test } from "bun:test"

import { LEGAL_TEXT_KINDS, LEGAL_TEXTS, pendingLegalTexts } from "./legal-texts"

describe("textes du site (LX-05)", () => {
  test("chaque texte a une version, une date valide et des rubriques uniques", () => {
    expect(Object.keys(LEGAL_TEXTS).sort()).toEqual([...LEGAL_TEXT_KINDS].sort())
    for (const kind of LEGAL_TEXT_KINDS) {
      const edition = LEGAL_TEXTS[kind]
      expect(edition.version.length, kind).toBeGreaterThan(0)
      expect(edition.date, kind).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(new Date(`${edition.date}T00:00:00Z`).toISOString().slice(0, 10), kind).toBe(edition.date)
      expect(edition.sections.length, kind).toBeGreaterThan(0)
      expect(new Set(edition.sections).size, kind).toBe(edition.sections.length)
    }
  })

  test("conditions d'utilisation, règles de la communauté et contact sont présents", () => {
    expect(LEGAL_TEXT_KINDS).toEqual(expect.arrayContaining(["terms", "community", "contact"]))
  })

  test("aucun texte n'est fourni : chacun garde son marqueur bloquant", () => {
    expect(pendingLegalTexts()).toEqual([...LEGAL_TEXT_KINDS])
    for (const kind of LEGAL_TEXT_KINDS) expect(LEGAL_TEXTS[kind].provided, kind).toBe(false)
  })

  test("le registre est figé : aucun écran ne peut le réécrire", () => {
    expect(Object.isFrozen(LEGAL_TEXTS)).toBe(true)
  })
})
