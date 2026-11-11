/**
 * MD-07 — ce que l'auteur d'un contenu lit d'un dossier : la règle du port est
 * CELLE du moteur (`authorDecisionOutcome` de `@antsia/social-domain/moderation`),
 * vérifiée sur toutes les combinaisons d'état et de recours.
 */
import { authorDecisionOutcome as engineAuthorDecisionOutcome } from "@antsia/social-domain/moderation"
import { describe, expect, it } from "vitest"

import {
  authorDecisionOutcome,
  authorDecisionsOnly,
  DECISION_APPEAL_STATUSES,
  DECISION_STATUSES,
  type DecisionAppealStatus,
  type ModerationDecisionView,
} from "./data-rights-port"

const decision = (status: ModerationDecisionView["status"], appeals: readonly DecisionAppealStatus[]): ModerationDecisionView => ({
  reportId: `dossier-${status}`,
  network: "diasporale",
  surface: "post",
  ground: "harassment",
  status,
  level: "network",
  createdAt: 0,
  decisionReason: null,
  sanctions: [],
  appeals: appeals.map((appealStatus) => ({ level: "network" as const, status: appealStatus, decisionReason: null })),
  appealLevel: null,
})

const APPEAL_SETS: readonly (readonly DecisionAppealStatus[])[] = [[], ...DECISION_APPEAL_STATUSES.map((status) => [status]), ["upheld", "overturned"]]

describe("MD-07 — la règle de l'auteur est celle du moteur", () => {
  it("rend la même issue que le moteur pour chaque état et chaque jeu de recours", () => {
    for (const status of DECISION_STATUSES) {
      for (const appeals of APPEAL_SETS) {
        expect(authorDecisionOutcome(decision(status, appeals))).toBe(engineAuthorDecisionOutcome(status, appeals))
      }
    }
  })

  it("ne montre ni dossier ouvert, ni dossier en examen, ni classement ; montre la mesure prise et la mesure annulée sur recours", () => {
    expect(authorDecisionOutcome(decision("open", []))).toBeNull()
    expect(authorDecisionOutcome(decision("reviewing", []))).toBeNull()
    expect(authorDecisionOutcome(decision("dismissed", []))).toBeNull()
    expect(authorDecisionOutcome(decision("dismissed", ["upheld"]))).toBeNull()
    expect(authorDecisionOutcome(decision("actioned", []))).toBe("actioned")
    expect(authorDecisionOutcome(decision("dismissed", ["overturned"]))).toBe("overturned")
  })

  it("réduit une fenêtre à ce que l'auteur lit, en gardant la continuation du moteur", () => {
    const page = { items: [decision("open", []), decision("actioned", []), decision("dismissed", [])], continueCursor: "suite", isDone: false }
    const kept = authorDecisionsOnly(page)
    expect(kept.items.map((item) => item.status)).toEqual(["actioned"])
    expect(kept).toMatchObject({ continueCursor: "suite", isDone: false })
  })
})
