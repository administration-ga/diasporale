import { COMMUNITY_RULES, isCommunityRule } from "@diasporale/domain"
import { describe, expect, it } from "vitest"

import { communityRuleOf, REPORT_REASON_RULES, reportReasonsOfRule, SERVICE_REVIEW_REASON_RULES } from "./community-rules"
import { DECISION_GROUNDS } from "./data-rights-port"
import { DESK_GROUNDS } from "./moderation-desk-port"
import { SERVICE_REVIEW_REPORT_REASONS } from "./service-reviews-port"
import { REPORT_REASONS } from "./types"

/** Complétude (MD-05) : chaque motif de signalement renvoie à une règle de la communauté, et à une seule. */
describe("règles de la communauté — chaque motif a sa règle", () => {
  it("chaque motif du moteur (`REPORT_REASONS`) renvoie à une règle existante, sans motif en trop", () => {
    expect(Object.keys(REPORT_REASON_RULES).sort()).toEqual([...REPORT_REASONS].sort())
    for (const reason of REPORT_REASONS) expect(isCommunityRule(REPORT_REASON_RULES[reason]), reason).toBe(true)
  })

  it("chaque motif d'un avis renvoie aussi à une règle existante", () => {
    expect(Object.keys(SERVICE_REVIEW_REASON_RULES).sort()).toEqual([...SERVICE_REVIEW_REPORT_REASONS].sort())
    for (const reason of SERVICE_REVIEW_REPORT_REASONS) expect(isCommunityRule(SERVICE_REVIEW_REASON_RULES[reason]), reason).toBe(true)
  })

  it("les motifs se répartissent entre les règles : chacun sous une seule, dans l'ordre du moteur", () => {
    const listed = COMMUNITY_RULES.flatMap((rule) => reportReasonsOfRule(rule))
    expect([...listed].sort()).toEqual([...REPORT_REASONS].sort())
    expect(new Set(listed).size).toBe(REPORT_REASONS.length)
    expect(reportReasonsOfRule("respect")).toEqual(["harassment", "hate", "violence"])
    expect(reportReasonsOfRule("impersonation")).toEqual(["institution_impersonation", "impersonation"])
    expect(reportReasonsOfRule("politics")).toEqual([])
  })

  it("la règle d'un motif reçu : signalement, avis, relecture ; rien de deviné pour un motif inconnu", () => {
    expect(communityRuleOf("harassment")).toBe("respect")
    expect(communityRuleOf("privacy_or_honor")).toBe("privacy")
    expect(communityRuleOf("misinformation")).toBe("scams")
    expect(communityRuleOf("fraud")).toBe("scams")
    expect(communityRuleOf("spam")).toBe("scams")
    expect(communityRuleOf("pre_review")).toBe("measures")
    expect(communityRuleOf("unspecified")).toBeNull()
    expect(communityRuleOf("motif-inconnu")).toBeNull()
  })

  it("tout motif qu'une décision ou le guichet peut montrer a sa règle, sauf « non précisé »", () => {
    for (const ground of [...DECISION_GROUNDS, ...DESK_GROUNDS]) {
      if (ground === "unspecified") expect(communityRuleOf(ground)).toBeNull()
      else expect(communityRuleOf(ground), ground).not.toBeNull()
    }
  })
})
