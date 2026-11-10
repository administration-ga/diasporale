import { describe, expect, test } from "bun:test"

import {
  COMMUNITY_RULES,
  isCommunityRule,
  LAWYER_QUESTIONS,
  LEGAL_TEXT_KINDS,
  LEGAL_TEXT_STATUSES,
  LEGAL_TEXTS,
  legalTextsBlockingRelease,
  pendingLegalTexts,
} from "./legal-texts"

describe("textes du site (LX-05)", () => {
  test("chaque texte a une version, une date valide, un état connu et des rubriques uniques", () => {
    expect(Object.keys(LEGAL_TEXTS).sort()).toEqual([...LEGAL_TEXT_KINDS].sort())
    for (const kind of LEGAL_TEXT_KINDS) {
      const edition = LEGAL_TEXTS[kind]
      expect(edition.version.length, kind).toBeGreaterThan(0)
      expect(edition.date, kind).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(new Date(`${edition.date}T00:00:00Z`).toISOString().slice(0, 10), kind).toBe(edition.date)
      expect(LEGAL_TEXT_STATUSES, kind).toContain(edition.status)
      expect(edition.sections.length, kind).toBeGreaterThan(0)
      expect(new Set(edition.sections).size, kind).toBe(edition.sections.length)
    }
  })

  test("conditions d'utilisation, règles de la communauté et contact sont présents", () => {
    expect(LEGAL_TEXT_KINDS).toEqual(expect.arrayContaining(["terms", "community", "contact"]))
  })

  test("trois états, du texte à fournir au texte définitif", () => {
    expect(LEGAL_TEXT_STATUSES).toEqual(["missing", "provisional", "final"])
  })

  test("aucun texte n'est définitif : chacun tient fermée la porte de mise en ligne", () => {
    expect(legalTextsBlockingRelease()).toEqual([...LEGAL_TEXT_KINDS])
    for (const kind of LEGAL_TEXT_KINDS) expect(LEGAL_TEXTS[kind].status, kind).not.toBe("final")
  })

  test("les règles de la communauté sont provisoires (MD-05) ; les quatre autres textes restent à fournir", () => {
    expect(LEGAL_TEXTS.community.status).toBe("provisional")
    expect(pendingLegalTexts()).toEqual(LEGAL_TEXT_KINDS.filter((kind) => kind !== "community"))
  })

  test("le registre est figé : aucun écran ne peut le réécrire", () => {
    expect(Object.isFrozen(LEGAL_TEXTS)).toBe(true)
  })
})

describe("règles de la communauté (MD-05)", () => {
  test("leurs rubriques sont les règles, dans l'ordre d'affichage", () => {
    expect(LEGAL_TEXTS.community.sections).toEqual([...COMMUNITY_RULES])
    expect(COMMUNITY_RULES).toEqual(expect.arrayContaining(["respect", "scams", "impersonation", "politics", "privacy", "prohibited", "measures"]))
  })

  test("reconnaît une règle, refuse tout autre identifiant", () => {
    for (const rule of COMMUNITY_RULES) expect(isCommunityRule(rule), rule).toBe(true)
    expect(isCommunityRule("sanctions")).toBe(false)
    expect(isCommunityRule("")).toBe(false)
  })

  test("un passage « À fournir » nomme une question posée au juriste, sur une rubrique du texte", () => {
    for (const kind of LEGAL_TEXT_KINDS) {
      const edition = LEGAL_TEXTS[kind]
      const entries = Object.entries(edition.awaiting)
      // Seul un texte provisoire a des passages qui attendent : à fournir, tout manque ; définitif, rien.
      if (edition.status !== "provisional") expect(entries, kind).toEqual([])
      for (const [section, questions] of entries) {
        expect(edition.sections, `${kind}.${section}`).toContain(section)
        expect(questions.length, `${kind}.${section}`).toBeGreaterThan(0)
        for (const question of questions) expect(LAWYER_QUESTIONS, `${kind}.${section}`).toContain(question)
      }
    }
  })

  test("les règles attendent le juriste pour les interdits légaux, les délais et le recours", () => {
    expect(LEGAL_TEXTS.community.awaiting).toEqual({ prohibited: ["Q1"], reporting: ["Q6"], measures: ["Q3"] })
  })
})
