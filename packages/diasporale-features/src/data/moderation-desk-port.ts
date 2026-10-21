/**
 * Capacité « modération par pays » du port (PD6 · G9, plan global DIASPORALE).
 * PROPRIÉTAIRE : ce chantier. Facultative : un fournisseur qui ne la sert pas la
 * laisse absente, et l'écran le dit au lieu d'inventer.
 *
 * Ce que le guichet sert, et à qui :
 *   · seules les équipes HABILITÉES du réseau (rôle réseau de modération ou
 *     d'administration, ou membre actif d'une équipe vivante) ont un guichet ;
 *     pour toute autre personne, `useDesk` rend `null` et chaque lecture le refus
 *     indistinct (`not_found`) — rien n'est dit des équipes ni de leurs membres ;
 *   · la file des signalements OUVERTS, filtrée par le pays que porte la CIBLE
 *     (publication locale, page, évènement ou direct d'une page, avis et réponse
 *     d'avis par la zone de l'offre) et par nature ; le pays d'une personne n'est
 *     jamais lu. Le moteur ne rattache pas encore une équipe à un pays : le pays
 *     FILTRE la file, il ne délimite aucune compétence ;
 *   · l'aperçu est la projection bornée du moteur (contenu signalé seul : ni
 *     auteur, ni déclarant, ni coordonnée, ni pièce privée, ni besoin d'une
 *     demande de service) ;
 *   · toute décision est MOTIVÉE (motif obligatoire, bornes ci-dessous), passe
 *     par les mutations EXISTANTES du moteur, qui la journalisent et en
 *     préviennent l'auteur, et reste susceptible de recours ;
 *   · une personne PARTIE au dossier (auteur, déclarant, signataire de la page
 *     visée, ancien décideur) ne le tranche pas : le moteur refuse ce qu'il
 *     garde, l'écran n'offre pas le geste (`party`) ;
 *   · les recours du réseau et la composition des équipes sont à
 *     l'administration du réseau seule.
 *
 * Aucune donnée consulaire, aucune statistique : une fenêtre de file ne compte
 * rien, elle liste.
 */
import { DECISION_REASON_MAX } from "@antsia/social-domain/audit"
import type { ContentReportReason } from "@antsia/social-domain/moderation"
import { MODERATION_SURFACES, SANCTION_KINDS, type ModerationSurface, type SanctionKind } from "@antsia/social-domain/moderationPolicy"
import { isCountryCode, normalizeCountryCode, type CountryCode } from "@diasporale/domain"

import type { ActionResult } from "./port"
import type { ServiceReviewReportReason } from "./service-reviews-port"
import type { Loadable, PostMediaView } from "./types"

const DAY_MS = 24 * 60 * 60 * 1000

/** Codes de refus propres au chantier, traduits par errors.<code> dans son fragment. */
export const MODERATION_DESK_ERROR_CODES = [
  // Motif d'une décision hors des bornes ({{min}} à {{max}} caractères).
  "moderation_desk_reason_length",
  // Aucune issue choisie (classer ou prendre une mesure, approuver ou refuser, maintenir ou annuler).
  "moderation_desk_outcome_required",
  // « Prendre une mesure » sans aucune mesure choisie.
  "moderation_desk_measure_required",
  // Sourdine ou suspension sans durée.
  "moderation_desk_duration_required",
  // Mesure refusée par le moteur pour ce dossier (aucune personne sanctionnable, durée refusée).
  "moderation_desk_measure_refused",
  // Le dossier, le contenu ou le recours a changé entre-temps (déjà tranché).
  "moderation_desk_conflict",
  // Une limite du moteur est atteinte (équipes, sanctions d'un dossier).
  "moderation_desk_limit",
  // La personne est partie au dossier : un autre membre de l'équipe tranche.
  "moderation_desk_party",
  // Nom d'équipe hors des bornes ({{nameMin}} à {{nameMax}} caractères).
  "moderation_desk_team_name_length",
  // Identifiant d'un membre à ajouter manquant.
  "moderation_desk_handle_required",
  // Aucun membre actif du réseau ne porte cet identifiant.
  "moderation_desk_member_unknown",
] as const
export type ModerationDeskErrorCode = (typeof MODERATION_DESK_ERROR_CODES)[number]

// ── Vocabulaire ────────────────────────────────────────────────────────────

/** Les natures de cible que le moteur modère (`MODERATION_SURFACES`). */
export const DESK_SURFACES = MODERATION_SURFACES
export type DeskSurface = ModerationSurface

/** Les mesures du moteur (`SANCTION_KINDS`). */
export const DESK_SANCTION_KINDS = SANCTION_KINDS
export type DeskSanctionKind = SanctionKind

/**
 * Le motif d'un dossier, dit par une valeur fermée : ceux des signalements du
 * moteur (`CONTENT_REPORT_REASONS`), ceux des avis (`SERVICE_REVIEW_REPORT_REASONS`),
 * la relecture préalable, et « non précisé » pour tout autre code.
 */
export const DESK_GROUNDS = [
  "harassment",
  // SU01d du moteur (21/10/2026, ordonnance n° 0011/PR/2026) : les six motifs ajoutés aux signalements.
  "minor_harm",
  "hate",
  "violence",
  "sexual_content",
  "deepfake_of_me",
  "prohibited_ai_content",
  "institution_impersonation",
  "impersonation",
  "privacy_or_honor",
  "misinformation",
  "spam",
  "fraud",
  "other",
  "pre_review",
  "unspecified",
] as const satisfies readonly (ContentReportReason | ServiceReviewReportReason | "pre_review" | "unspecified")[]
export type DeskGround = (typeof DESK_GROUNDS)[number]

/** Un code de motif reçu du moteur, jamais affiché brut. */
export function deskGround(reason: string): DeskGround {
  return (DESK_GROUNDS as readonly string[]).includes(reason) ? (reason as DeskGround) : "unspecified"
}

/** Le rôle qui ouvre le guichet. */
export const DESK_ROLES = ["network_admin", "network_moderator", "team_member"] as const
export type DeskRole = (typeof DESK_ROLES)[number]

/** Le niveau d'un dossier (`reports.level`). */
export const DESK_CASE_LEVELS = ["team", "network", "platform"] as const
export type DeskCaseLevel = (typeof DESK_CASE_LEVELS)[number]

/** Pourquoi la personne ne tranche pas ce dossier. */
export const DESK_PARTIES = ["author", "reporter", "page", "decider"] as const
export type DeskParty = (typeof DESK_PARTIES)[number]

/** Les deux sources de la file : les signalements, la relecture préalable (pages à vérifier, évènements…). */
export const DESK_SOURCES = ["reports", "pre_review"] as const
export type DeskSource = (typeof DESK_SOURCES)[number]

/** Les états d'un dossier encore à trancher (`reports.status`) : ouvert, ou mis en examen. */
export const DESK_OPEN_STATUSES = ["open", "reviewing"] as const
export type DeskOpenStatus = (typeof DESK_OPEN_STATUSES)[number]

/** Les deux issues d'un dossier. */
export const DESK_DECISIONS = ["dismissed", "actioned"] as const
export type DeskDecision = (typeof DESK_DECISIONS)[number]

/** L'origine d'une décision antérieure : un signalement, ou la relecture préalable. */
export const DESK_HISTORY_ORIGINS = ["reader", "pre_review"] as const
export type DeskHistoryOrigin = (typeof DESK_HISTORY_ORIGINS)[number]

/** La mesure qui vise la PERSONNE (une seule par décision) ; le retrait du contenu se choisit à part. */
export const DESK_PERSON_MEASURES = ["none", "warning", "mute", "suspension", "exclusion"] as const
export type DeskPersonMeasure = (typeof DESK_PERSON_MEASURES)[number]

/** Les durées proposées pour une sourdine ou une suspension (le moteur borne à un an). */
export const DESK_DURATION_DAYS = [1, 7, 30, 90, 180] as const
export type DeskDurationDays = (typeof DESK_DURATION_DAYS)[number]

export function isDeskDuration(value: number): value is DeskDurationDays {
  return (DESK_DURATION_DAYS as readonly number[]).includes(value)
}

/** Une mesure temporaire exige une durée (règle `validSanctionDuration` du moteur). */
export function isTimedMeasure(measure: DeskPersonMeasure): measure is "mute" | "suspension" {
  return measure === "mute" || measure === "suspension"
}

// ── Bornes ─────────────────────────────────────────────────────────────────

/** Lignes demandées par fenêtre (le moteur relit au plus vingt-cinq lignes brutes par fenêtre). */
export const DESK_PAGE_SIZE = 20
/**
 * Motif d'une décision, bords retirés. Le moteur exige au moins trois caractères
 * (`assertDecisionReason`) ; le guichet en demande dix, comme la tranche pour un
 * retrait de parrainage par la modération (`MODERATION_REASON_MIN`).
 */
export const DESK_REASON_MIN = 10
export const DESK_REASON_MAX = DECISION_REASON_MAX
/** Nom d'une équipe (`cases.createTeam`). */
export const DESK_TEAM_NAME_MIN = 2
export const DESK_TEAM_NAME_MAX = 100

export function deskReasonRefusal(reason: string): "moderation_desk_reason_length" | null {
  const length = reason.trim().length
  return length < DESK_REASON_MIN || length > DESK_REASON_MAX ? "moderation_desk_reason_length" : null
}

export function deskTeamNameRefusal(name: string): "moderation_desk_team_name_length" | null {
  const length = name.trim().length
  return length < DESK_TEAM_NAME_MIN || length > DESK_TEAM_NAME_MAX ? "moderation_desk_team_name_length" : null
}

// ── Zone (pays de la cible) ────────────────────────────────────────────────

/** Toute la file, les cibles sans pays (portée diaspora, compte, message…), ou un pays. */
export type DeskZone =
  | { readonly kind: "all" }
  | { readonly kind: "none" }
  | { readonly kind: "country"; readonly country: CountryCode }

export const DESK_ZONE_ALL: DeskZone = { kind: "all" }

/** La clé d'une zone dans un sélecteur : `all`, `none` ou le code ISO. */
export function deskZoneKey(zone: DeskZone): string {
  return zone.kind === "country" ? zone.country : zone.kind
}

/** La zone d'une clé de sélecteur ; une clé illisible rend toute la file, jamais un pays deviné. */
export function deskZoneFromKey(key: string): DeskZone {
  if (key === "all") return DESK_ZONE_ALL
  if (key === "none") return { kind: "none" }
  const code = normalizeCountryCode(key)
  return isCountryCode(code) ? { kind: "country", country: code } : DESK_ZONE_ALL
}

/** Le pays reçu du moteur, s'il est un code connu. */
export function deskCountry(raw: string | null): CountryCode | null {
  if (raw === null) return null
  const code = normalizeCountryCode(raw)
  return isCountryCode(code) ? code : null
}

export function isInDeskZone(zone: DeskZone, country: CountryCode | null): boolean {
  if (zone.kind === "all") return true
  if (zone.kind === "none") return country === null
  return country === zone.country
}

// ── Décision ───────────────────────────────────────────────────────────────

export interface DeskMeasureChoice {
  readonly decision: DeskDecision
  /** Retirer le contenu visé. */
  readonly removal: boolean
  readonly personMeasure: DeskPersonMeasure
  /** Pour une sourdine ou une suspension. */
  readonly durationDays: DeskDurationDays | null
}

/** Une mesure telle que le moteur la reçoit (`sanctionInput` de `cases.decide`). */
export interface DeskSanction {
  readonly kind: DeskSanctionKind
  readonly until?: number
}

/**
 * Les mesures envoyées au moteur. Classer n'en porte aucune ; « prendre une
 * mesure » en exige au moins une, choisie : jamais un retrait implicite (le
 * moteur retire le contenu d'un dossier suivi d'effet sans mesure).
 */
export function deskSanctions(choice: DeskMeasureChoice, now: number): { readonly ok: true; readonly value: readonly DeskSanction[] } | { readonly ok: false; readonly code: ModerationDeskErrorCode } {
  if (choice.decision === "dismissed") return { ok: true, value: [] }
  const sanctions: DeskSanction[] = []
  if (choice.removal) sanctions.push({ kind: "removal" })
  if (choice.personMeasure === "warning" || choice.personMeasure === "exclusion") sanctions.push({ kind: choice.personMeasure })
  if (isTimedMeasure(choice.personMeasure)) {
    if (choice.durationDays === null) return { ok: false, code: "moderation_desk_duration_required" }
    sanctions.push({ kind: choice.personMeasure, until: now + choice.durationDays * DAY_MS })
  }
  if (sanctions.length === 0) return { ok: false, code: "moderation_desk_measure_required" }
  return { ok: true, value: sanctions }
}

/**
 * Une mesure LOURDE demande une confirmation explicite : suspension ou exclusion
 * de la personne (elles valent partout), retrait d'une page ou d'un compte.
 */
export function isHeavyDecision(choice: DeskMeasureChoice, surface: DeskSurface): boolean {
  if (choice.decision !== "actioned") return false
  if (choice.personMeasure === "suspension" || choice.personMeasure === "exclusion") return true
  return choice.removal && (surface === "page" || surface === "person")
}

/** Refuser en relecture préalable retire le contenu : lourd pour une page ou un compte. */
export function isHeavyPendingRejection(approve: boolean, surface: DeskSurface): boolean {
  return !approve && (surface === "page" || surface === "person")
}

// ── Vues ───────────────────────────────────────────────────────────────────

export interface DeskTeamView {
  readonly teamId: string
  readonly name: string
  /** La nature de contenu que l'équipe traite ; `null` : toutes. */
  readonly scope: DeskSurface | null
  readonly isMember: boolean
}

export interface ModerationDeskView {
  readonly role: DeskRole
  /** Lit la file du réseau entier (rôle réseau). */
  readonly networkWide: boolean
  readonly canReviewAppeals: boolean
  readonly canManageTeams: boolean
  /** Toutes les équipes vivantes pour l'administration du réseau ; les siennes sinon. */
  readonly teams: readonly DeskTeamView[]
}

export interface DeskQueueFilters {
  readonly zone: DeskZone
  readonly surface: DeskSurface | null
  /** La file d'une équipe ; `null` : toute la file accessible (rôle réseau). */
  readonly teamId: string | null
}

export interface DeskQueueRequest extends DeskQueueFilters {
  readonly personId: string
  readonly cursor: string | null
  /** Signalements seulement : les dossiers ouverts (par défaut) ou ceux mis en examen. */
  readonly status?: DeskOpenStatus
}

export interface DeskPage<Row> {
  readonly items: readonly Row[]
  readonly continueCursor: string | null
  readonly isDone: boolean
}

/** Un dossier ouvert : ni déclarant, ni auteur, ni contenu. */
export interface DeskCaseView {
  readonly reportId: string
  readonly surface: DeskSurface
  readonly country: CountryCode | null
  readonly ground: DeskGround
  readonly status: DeskOpenStatus
  readonly level: DeskCaseLevel
  readonly teamName: string | null
  readonly createdAt: number
  /** Une personne peut recevoir une mesure ; sinon seul le retrait du contenu s'applique. */
  readonly hasAuthor: boolean
  readonly party: DeskParty | null
}

export interface DeskHistoryEntry {
  readonly status: DeskDecision
  readonly origin: DeskHistoryOrigin
  readonly decidedAt: number | null
  readonly decisionReason: string | null
  readonly sanctions: readonly DeskSanctionKind[]
}

export interface DeskCaseDetailView {
  readonly case: DeskCaseView
  /** Les décisions antérieures sur la même cible, de ma compétence, les plus récentes d'abord. */
  readonly history: readonly DeskHistoryEntry[]
  readonly historyMore: boolean
}

export interface DeskCaseRequest {
  readonly personId: string
  readonly reportId: string
}

/** La projection bornée du moteur : le contenu visé seul. */
export interface DeskPreviewView {
  readonly available: boolean
  readonly title: string | null
  readonly body: string | null
  readonly media: readonly PostMediaView[]
}

/** Un contenu en relecture préalable. */
export interface DeskPendingView {
  /** `nature:identifiant`, stable. */
  readonly key: string
  readonly targetKind: DeskSurface
  readonly targetId: string
  readonly country: CountryCode | null
  readonly teamName: string | null
  readonly updatedAt: number
  readonly party: DeskParty | null
}

export interface DeskPendingRequest {
  readonly personId: string
  readonly targetKind: DeskSurface
  readonly targetId: string
}

export interface DeskAppealView {
  readonly appealId: string
  readonly reportId: string
  readonly surface: DeskSurface
  readonly country: CountryCode | null
  readonly ground: DeskGround
  /** Le motif écrit par la personne qui conteste. */
  readonly appealReason: string
  readonly createdAt: number
  /** Le motif de la décision contestée. */
  readonly decisionReason: string | null
  readonly decidedAt: number | null
  readonly sanctions: readonly { readonly kind: DeskSanctionKind; readonly until: number | null }[]
  readonly party: DeskParty | null
}

export interface DeskAppealsRequest {
  readonly personId: string
  readonly zone: DeskZone
  readonly surface: DeskSurface | null
  readonly cursor: string | null
}

export interface DeskTeamMemberView {
  readonly personId: string
  /** Profil PUBLIÉ ; `null` : nom neutre. */
  readonly handle: string | null
  readonly displayName: string | null
  /** Faux : la personne n'est plus membre active du réseau. */
  readonly inNetwork: boolean
  readonly isMe: boolean
}

export interface DeskRosterView {
  readonly members: readonly DeskTeamMemberView[]
  readonly more: boolean
}

export interface DeskRosterRequest {
  readonly personId: string
  readonly teamId: string
}

export interface DeskCandidateView {
  readonly personId: string
  readonly handle: string
  readonly displayName: string
}

// ── Gestes ─────────────────────────────────────────────────────────────────

export interface DeskDecisionInput extends DeskMeasureChoice {
  readonly personId: string
  readonly reportId: string
  readonly reason: string
}

export interface DeskPendingDecisionInput {
  readonly personId: string
  readonly targetKind: DeskSurface
  readonly targetId: string
  readonly approve: boolean
  readonly reason: string
}

export interface DeskAppealDecisionInput {
  readonly personId: string
  readonly appealId: string
  /** Vrai : la décision est annulée (mesures levées, contenu rétabli s'il avait été retiré). */
  readonly overturn: boolean
  readonly reason: string
}

export interface DeskTeamInput {
  readonly personId: string
  readonly name: string
  readonly scope: DeskSurface | null
  readonly reason: string
}

export interface DeskTeamMemberInput {
  readonly personId: string
  readonly teamId: string
  readonly memberPersonId: string
  readonly active: boolean
  readonly reason: string
}

export interface DeskMemberLookup {
  readonly personId: string
  readonly handle: string
}

// ── La capacité ────────────────────────────────────────────────────────────

export interface ModerationDeskCapability {
  /** Vrai pour la démonstration : dossiers fictifs, décisions gardées dans ce navigateur, sans aucun effet. */
  readonly demonstration: boolean
  /** Ma capacité de modération ; `null` : aucune (rien n'est dit de plus). */
  useDesk(personId: string): Loadable<ModerationDeskView | null>
  /** Une fenêtre de la file des signalements ouverts, la plus ancienne d'abord. */
  useQueue(request: DeskQueueRequest): Loadable<DeskPage<DeskCaseView>>
  /** Un dossier encore ouvert et de ma compétence ; tranché entre-temps : `not_found`. */
  useCase(request: DeskCaseRequest): Loadable<DeskCaseDetailView>
  useCasePreview(request: DeskCaseRequest): Loadable<DeskPreviewView>
  /** Trancher, motif obligatoire ; une mesure lourde a été confirmée par l'écran. */
  decide(input: DeskDecisionInput): Promise<ActionResult<{ readonly status: DeskDecision }>>
  /** Une fenêtre des contenus en relecture préalable. */
  usePending(request: DeskQueueRequest): Loadable<DeskPage<DeskPendingView>>
  usePendingPreview(request: DeskPendingRequest): Loadable<DeskPreviewView>
  reviewPending(input: DeskPendingDecisionInput): Promise<ActionResult>
  /** Les recours du réseau à examiner (administration du réseau). */
  useAppeals(request: DeskAppealsRequest): Loadable<DeskPage<DeskAppealView>>
  decideAppeal(input: DeskAppealDecisionInput): Promise<ActionResult>
  /** La composition d'une équipe (administration du réseau). */
  useRoster(request: DeskRosterRequest): Loadable<DeskRosterView>
  /** Le membre actif du réseau qui porte cet identifiant ; `null` sinon. */
  findMember(request: DeskMemberLookup): Promise<ActionResult<DeskCandidateView | null>>
  createTeam(input: DeskTeamInput): Promise<ActionResult<{ readonly teamId: string }>>
  setTeamMember(input: DeskTeamMemberInput): Promise<ActionResult>
}
