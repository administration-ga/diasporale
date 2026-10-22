/**
 * Capacité « droits personnels » du port (DG-026) — export de ses données,
 * effacement avec délai de grâce et annulation, suivi, décisions de modération
 * et recours ; « Mes signalements » (SU01d du moteur). PROPRIÉTAIRE : chantier
 * « droits personnels » (vague G1).
 *
 * Reste accessible à un membre suspendu, sans lui rouvrir les surfaces sociales.
 *
 * Chaque geste est SELF-SCOPED : il porte sur la personne authentifiée, jamais
 * sur une autre. Le moteur relit la session à chaque appel (portes
 * `personQuery` / `personMutation` de `people/erasure` et `moderation/cases`) ;
 * l'écran passe en plus la personne qu'il affiche, et un changement de session
 * ferme le geste (`not_found`). Aucune lecture d'adhésion ici : un membre
 * suspendu exerce ses droits sans qu'aucun fil, message ni annuaire ne lui soit
 * rouvert.
 *
 * Les bornes sont CELLES du moteur ANTSIA, jamais inventées :
 *   · grâce de l'effacement : 30 jours (`convex/modules/people/erasure.ts`,
 *     `ERASURE_GRACE_MS`) ; annulable tant qu'elle court, jamais après ;
 *   · motif d'un recours : 3 caractères au moins, `DECISION_REASON_MAX` au plus,
 *     bords retirés (`moderation/cases.ts`, `assertDecisionReason(reason, 3)`) ;
 *   · niveau d'un recours : la règle de `fileAppeal` (`nextAppealLevel`).
 * L'export n'assemble que les projections que rend le moteur
 * (`exportableRecord`) : jamais une ligne d'autrui, jamais une URL de fichier.
 */
import { DECISION_REASON_MAX } from "@antsia/social-domain/audit"
import {
  CONTENT_REPORT_REASONS,
  CONTENT_REPORT_STATUSES,
  REPORT_LEGAL_BASES,
  REPORT_OUTCOMES,
  reportDecisionDelayHours,
  type ContentReportStatus,
  type ReportLegalBasis,
  type ReportOutcome,
} from "@antsia/social-domain/moderation"
import { MODERATION_SURFACES, SANCTION_KINDS, type ModerationSurface, type SanctionKind } from "@antsia/social-domain/moderationPolicy"

import type { ActionResult } from "./port"
import type { Loadable } from "./types"

const DAY_MS = 24 * 60 * 60 * 1000

/** Délai de grâce d'une demande d'effacement, en jours (moteur : `ERASURE_GRACE_MS`, 30 jours). */
export const ERASURE_GRACE_DAYS = 30
export const ERASURE_GRACE_MS = ERASURE_GRACE_DAYS * DAY_MS

/** Bornes du motif d'un recours, une fois les espaces des bords retirés (moteur : `motiveOf`). */
export const APPEAL_REASON_MIN = 3
export const APPEAL_REASON_MAX = DECISION_REASON_MAX

/** Une page de décisions (le moteur borne chaque page à cinquante). */
export const DECISIONS_PAGE_SIZE = 10

/** Codes de refus propres aux droits personnels (fragment `data-rights.json`). */
export const DATA_RIGHTS_ERROR_CODES = [
  // Effacement : la grâce est passée, la demande ne peut plus être annulée.
  "erasure_not_cancellable",
  // Export : momentanément refusé par le moteur (inventaire des données incomplet).
  "export_unavailable",
  // Export : la préparation n'est plus lisible (échue, ou la session a changé).
  "export_expired",
  // Export : l'assemblage page à page s'est interrompu ; aucun fichier partiel n'est rendu.
  "export_interrupted",
  // Export : interrompu par la personne elle-même.
  "export_cancelled",
  // Export : ce navigateur n'a pas pu enregistrer le fichier assemblé.
  "export_download_failed",
  // Recours : motif hors des bornes du moteur.
  "appeal_reason_length",
] as const
export type DataRightsErrorCode = (typeof DATA_RIGHTS_ERROR_CODES)[number]

// ── Effacement ─────────────────────────────────────────────────────────────

/**
 * Ma demande d'effacement. `grace` : annulable jusqu'à `dueAt` ; `processing` :
 * la grâce est passée, l'effacement est engagé (les sessions se ferment, rien ne
 * se restaure). L'issue « terminé » ne se lit jamais depuis le compte effacé :
 * il n'existe plus, ses sessions sont révoquées et le reçu du moteur ne le nomme pas.
 */
export type ErasureView =
  | { readonly state: "none" }
  | { readonly state: "grace"; readonly requestedAt: number; readonly dueAt: number }
  | { readonly state: "processing"; readonly requestedAt: number; readonly dueAt: number }

/** L'état affiché à l'instant `now` : une grâce échue se lit « en cours », même avant la relecture du serveur. */
export function erasureStateAt(view: ErasureView, now: number): ErasureView["state"] {
  return view.state === "grace" && now >= view.dueAt ? "processing" : view.state
}

/** Les jours qui restent pour annuler (au moins un tant que la grâce court). */
export function erasureDaysLeft(dueAt: number, now: number): number {
  return Math.max(1, Math.ceil((dueAt - now) / DAY_MS))
}

// ── Export ─────────────────────────────────────────────────────────────────

/** L'avancement de l'assemblage : `done` parties lues sur `total`. */
export interface DataExportProgress {
  readonly done: number
  readonly total: number
}

export interface DataExportOptions {
  readonly onProgress?: (progress: DataExportProgress) => void
  /** Interrompt l'assemblage (`export_cancelled`) : aucune page n'est plus lue. */
  readonly signal?: AbortSignal
}

/** Le fichier assemblé dans ce navigateur, prêt à être enregistré par la personne. */
export interface DataExportFile {
  readonly json: string
  /** Instant de l'assemblage (horloge de l'appareil). */
  readonly exportedAt: number
}

/** Le dernier export assemblé dans cet onglet (mémoire de la page, jamais persistée). */
export interface LastExportView {
  readonly exportedAt: number
}

// ── Décisions de modération et recours ─────────────────────────────────────

/** Les surfaces modérées par le moteur (`MODERATION_SURFACES`). */
export const DECISION_SURFACES = MODERATION_SURFACES
export type DecisionSurface = ModerationSurface
/** L'état d'un dossier (`CONTENT_REPORT_STATUSES`). */
export const DECISION_STATUSES = CONTENT_REPORT_STATUSES
export type DecisionStatus = ContentReportStatus
export const DECISION_LEVELS = ["team", "network", "platform"] as const
export type DecisionLevel = (typeof DECISION_LEVELS)[number]
/** Le réseau du dossier, dit sans identifiant : DIASPORALE, la racine ANTSIA, ou un autre réseau du compte. */
export const DECISION_NETWORKS = ["diasporale", "antsia", "other"] as const
export type DecisionNetwork = (typeof DECISION_NETWORKS)[number]
/** Le motif du dossier : un motif de signalement connu, la relecture préalable, ou un motif non précisé. */
export const DECISION_GROUNDS = [...CONTENT_REPORT_REASONS, "pre_review", "unspecified"] as const
export type DecisionGround = (typeof DECISION_GROUNDS)[number]
export const DECISION_SANCTION_KINDS = SANCTION_KINDS
export type DecisionSanctionKind = SanctionKind
export const DECISION_SANCTION_STATUSES = ["active", "expired", "revoked"] as const
export type DecisionSanctionStatus = (typeof DECISION_SANCTION_STATUSES)[number]
export const DECISION_APPEAL_LEVELS = ["network", "platform"] as const
export type DecisionAppealLevel = (typeof DECISION_APPEAL_LEVELS)[number]
export const DECISION_APPEAL_STATUSES = ["open", "upheld", "overturned"] as const
export type DecisionAppealStatus = (typeof DECISION_APPEAL_STATUSES)[number]

/** Un code de motif reçu du moteur, dit par une valeur fermée (jamais le code brut à l'écran). */
export function decisionGround(reason: string): DecisionGround {
  return (DECISION_GROUNDS as readonly string[]).includes(reason) ? (reason as DecisionGround) : "unspecified"
}

export interface DecisionSanctionView {
  readonly kind: DecisionSanctionKind
  readonly status: DecisionSanctionStatus
  readonly until: number | null
  /** Motif écrit par l'équipe de modération, affiché tel quel. */
  readonly reason: string
}

export interface DecisionAppealView {
  readonly level: DecisionAppealLevel
  readonly status: DecisionAppealStatus
  /** Réponse motivée au recours, une fois examiné. */
  readonly decisionReason: string | null
}

/**
 * Une décision qui me concerne. Aucun déclarant, aucun contenu, aucun
 * identifiant de cible ou d'équipe : seulement ce qu'il faut pour comprendre et
 * contester.
 */
export interface ModerationDecisionView {
  readonly reportId: string
  readonly network: DecisionNetwork
  readonly surface: DecisionSurface
  readonly ground: DecisionGround
  readonly status: DecisionStatus
  readonly level: DecisionLevel
  /** Ouverture du dossier. */
  readonly createdAt: number
  /** Motif de la décision écrit par l'équipe, `null` tant qu'elle n'a pas statué. */
  readonly decisionReason: string | null
  readonly sanctions: readonly DecisionSanctionView[]
  readonly appeals: readonly DecisionAppealView[]
  /** Le niveau d'un nouveau recours possible, `null` si aucun (`nextAppealLevel`). */
  readonly appealLevel: DecisionAppealLevel | null
}

/**
 * La règle de `fileAppeal` (moteur) : seule une décision suivie d'effet se
 * conteste ; une décision d'équipe va d'abord au réseau, puis à la plateforme si
 * le réseau la maintient ; un recours déjà posé à ce niveau ne se redouble pas.
 */
export function nextAppealLevel(decision: Pick<ModerationDecisionView, "status" | "level" | "appeals">): DecisionAppealLevel | null {
  if (decision.status !== "actioned") return null
  const network = decision.appeals.find((appeal) => appeal.level === "network")
  const level: DecisionAppealLevel = decision.level === "team" && network?.status !== "upheld" ? "network" : "platform"
  return decision.appeals.some((appeal) => appeal.level === level) ? null : level
}

/** Le motif d'un recours, jugé avant tout appel : la même borne que le moteur. */
export function appealReasonRefusal(reason: string): "appeal_reason_length" | null {
  const length = reason.trim().length
  return length < APPEAL_REASON_MIN || length > APPEAL_REASON_MAX ? "appeal_reason_length" : null
}

export interface ModerationDecisionsPage {
  readonly items: readonly ModerationDecisionView[]
  readonly continueCursor: string | null
  readonly isDone: boolean
}

export interface DecisionsRequest {
  readonly personId: string
  readonly cursor: string | null
}

export type DecisionsQuery = Loadable<ModerationDecisionsPage> & {
  readonly retry?: () => Promise<unknown>
}

// ── Mes signalements (SU01d du moteur) ─────────────────────────────────────

/** Ce que le déclarant apprend d'un dossier : l'effet sur le contenu (`REPORT_OUTCOMES`), jamais la sanction. */
export const PERSONAL_REPORT_OUTCOMES = REPORT_OUTCOMES
export type PersonalReportOutcome = ReportOutcome
/** Le fondement d'un délai légal de l'ordonnance n° 0011/PR/2026 (`REPORT_LEGAL_BASES`). */
export const PERSONAL_REPORT_LEGAL_BASES = REPORT_LEGAL_BASES
export type PersonalReportLegalBasis = ReportLegalBasis
/** Le délai d'un fondement, en heures, tel que le moteur le pose (72 h ou 24 h). */
export function personalReportDelayHours(basis: PersonalReportLegalBasis): number {
  return reportDecisionDelayHours(basis)
}

/**
 * Un signalement que j'ai transmis, dans tous les réseaux du compte commun : l'accusé de
 * réception, l'échéance légale et l'issue pour le contenu. Ni l'auteur, ni la sanction, ni le
 * motif écrit par la modération, ni de lien vers le contenu.
 */
export interface PersonalReportView {
  readonly reportId: string
  readonly surface: DecisionSurface
  readonly ground: DecisionGround
  /** Transmission du signalement. */
  readonly createdAt: number
  readonly acknowledgedAt: number | null
  /** Fondement et échéance d'un délai légal ; `null` hors délai légal. */
  readonly legal: { readonly basis: PersonalReportLegalBasis; readonly dueAt: number } | null
  readonly outcome: PersonalReportOutcome
  readonly decidedAt: number | null
}

export interface PersonalReportsPage {
  readonly items: readonly PersonalReportView[]
  readonly continueCursor: string | null
  readonly isDone: boolean
}

export interface ReportsRequest {
  readonly personId: string
  readonly cursor: string | null
}

export type ReportsQuery = Loadable<PersonalReportsPage>

export interface AppealInput {
  readonly personId: string
  readonly reportId: string
  readonly reason: string
}

// ── La capacité ────────────────────────────────────────────────────────────

export interface DataRightsCapability {
  /** État de MA demande d'effacement ; la session d'une autre personne : `not_found`. */
  useErasure(personId: string): Loadable<ErasureView>
  /**
   * Demande l'effacement de TOUT le compte commun (ANTSIA et ses réseaux,
   * DIASPORALE compris), avec délai de grâce. Rejouée, elle rend la même
   * échéance. Distincte de « quitter DIASPORALE », qui ne termine que l'adhésion.
   */
  requestErasure(personId: string): Promise<ActionResult<{ readonly dueAt: number }>>
  /** Annule pendant la grâce seulement (`erasure_not_cancellable` ensuite) ; sans demande, ne fait rien. */
  cancelErasure(personId: string): Promise<ActionResult>
  /**
   * Prépare un export puis l'assemble page à page dans ce navigateur : le
   * fichier ne passe par aucune adresse publique ni aucun stockage tiers. Jamais
   * de fichier partiel : une page refusée ou interrompue rend un refus.
   */
  prepareExport(personId: string, options?: DataExportOptions): Promise<ActionResult<DataExportFile>>
  /** Le dernier export assemblé dans cet onglet pour cette personne, `null` sinon. */
  useLastExport(personId: string): LastExportView | null
  /** Les décisions de modération qui me concernent, dans tous les réseaux du compte commun. */
  useDecisions(args: DecisionsRequest): DecisionsQuery
  /** Recours sur MA décision ; rejoué au même niveau, il rend le recours existant (`created: false`). */
  fileAppeal(input: AppealInput): Promise<ActionResult<{ readonly created: boolean }>>
  /**
   * Mes signalements (SU01d du moteur) : la destination de l'accusé de réception et de l'avis de
   * décision. Absente du fournisseur de démonstration, qui ne transmet aucun signalement à une
   * modération : la rubrique ne s'affiche pas.
   */
  useReports?(args: ReportsRequest): ReportsQuery
}
