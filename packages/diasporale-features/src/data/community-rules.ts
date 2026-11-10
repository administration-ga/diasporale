/**
 * Les règles de la communauté vues par le signalement et la modération (MD-05). PROPRIÉTAIRE :
 * ce lot. Module PUR.
 *
 * Chaque motif de signalement renvoie à UNE règle : celle que la page des règles détaille et
 * que la fiche d'une décision ou le guichet citent. Les tables sont typées sur les motifs du
 * moteur : un motif ajouté sans sa règle ne compile pas. Les règles elles-mêmes (leur ordre,
 * leur version, leur état) vivent dans le domaine (`COMMUNITY_RULES`, `LEGAL_TEXTS.community`).
 */
import type { CommunityRule } from "@diasporale/domain"

import { SERVICE_REVIEW_REPORT_REASONS, type ServiceReviewReportReason } from "./service-reviews-port"
import { REPORT_REASONS, type ReportReason } from "./types"

/** La règle de chaque motif de signalement du moteur (`REPORT_REASONS`). */
export const REPORT_REASON_RULES: Readonly<Record<ReportReason, CommunityRule>> = Object.freeze({
  harassment: "respect",
  minor_harm: "prohibited",
  hate: "respect",
  violence: "respect",
  sexual_content: "prohibited",
  deepfake_of_me: "prohibited",
  prohibited_ai_content: "prohibited",
  institution_impersonation: "impersonation",
  impersonation: "impersonation",
  privacy_or_honor: "privacy",
  misinformation: "scams",
  other: "reporting",
})

/** La règle de chaque motif de signalement d'un avis ou d'une réponse d'avis (`SERVICE_REVIEW_REPORT_REASONS`). */
export const SERVICE_REVIEW_REASON_RULES: Readonly<Record<ServiceReviewReportReason, CommunityRule>> = Object.freeze({
  spam: "scams",
  harassment: "respect",
  fraud: "scams",
  other: "reporting",
})

function isReportReason(ground: string): ground is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(ground)
}

function isServiceReviewReason(ground: string): ground is ServiceReviewReportReason {
  return (SERVICE_REVIEW_REPORT_REASONS as readonly string[]).includes(ground)
}

/**
 * La règle qu'un motif reçu cite : motif d'un signalement, motif d'un avis, ou relecture avant
 * publication (`pre_review`, que « Mesures et recours » explique). `null` pour un motif non
 * précisé ou inconnu : on renvoie alors à la page entière, jamais à une règle devinée.
 */
export function communityRuleOf(ground: string): CommunityRule | null {
  if (ground === "pre_review") return "measures"
  if (isReportReason(ground)) return REPORT_REASON_RULES[ground]
  if (isServiceReviewReason(ground)) return SERVICE_REVIEW_REASON_RULES[ground]
  return null
}

/** Les motifs de signalement qui renvoient à une règle, dans l'ordre du moteur : la page des règles les nomme sous elle. */
export function reportReasonsOfRule(rule: CommunityRule): ReportReason[] {
  return REPORT_REASONS.filter((reason) => REPORT_REASON_RULES[reason] === rule)
}
