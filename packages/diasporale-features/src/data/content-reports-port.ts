/**
 * Capacité « signalements » du port (G9, MD-02) — signaler un objet de DIASPORALE par
 * la porte unique de modération du moteur (`moderation/cases`, geste `report`).
 * PROPRIÉTAIRE : chantier « confiance des surfaces », étendu par MD-02 (signaler
 * depuis chaque objet). Facultative : un fournisseur qui ne la sert pas la laisse
 * absente, et l'écran n'offre alors aucun geste « Signaler ».
 *
 * CONTRAT FIGÉ des natures signalables (mêmes noms que les surfaces du moteur,
 * `MODERATION_SURFACES`, vérifié à la compilation) :
 *   · vague H : diasporaAidQuestion, diasporaAidAnswer, diasporaAidMission,
 *     diasporaMentorProfile, diasporaMentoringRequest (signalée par le mentor),
 *     diasporaKitResource (abus ou fausse information, distinct d'une information
 *     périmée), diasporaJobOffer, diasporaTalentProfile, diasporaJobApplication
 *     (signalée par l'équipe recruteuse) ;
 *   · MD-02 : post (publication du mur d'un groupe d'association, ajout de la
 *     galerie d'un évènement), comment, page, event (évènement d'association), person
 *     (profil). Le moteur range le dossier d'un profil au réseau RACINE : le profil
 *     est commun à tout le moteur (`ROOT_NETWORK_REPORT_KINDS`).
 * La publication du fil garde son propre geste (`reportPost`, avec précision écrite).
 *
 * Ce que le geste fait, et ne fait pas :
 *   · un motif FERMÉ, ceux du moteur (`REPORT_REASONS`), aucune saisie libre ;
 *   · jamais sur son propre contenu, ni sur la page que l'on administre ou ce qu'elle
 *     publie : l'écran n'offre pas le geste, et le moteur refuse son propre contenu
 *     d'un refus indistinct (`not_found`) ;
 *   · rejoué, il ne crée rien de plus : `created: false` dit « déjà signalé » ;
 *   · la cible est aussitôt MASQUÉE pour la personne qui signale ; son auteur
 *     n'apprend jamais qui l'a signalée ;
 *   · la démonstration ne transmet rien : elle masque la cible dans ce seul navigateur.
 */
import type { ModerationSurface } from "@antsia/social-domain/moderationPolicy"

import type { ActionResult } from "./port"
import { REPORT_REASONS, type ReportReason } from "./types"

/** Les natures signalables : chacune est une surface modérée par le moteur. */
export const CONTENT_REPORT_KINDS = [
  "diasporaAidQuestion",
  "diasporaAidAnswer",
  "diasporaAidMission",
  "diasporaMentorProfile",
  "diasporaMentoringRequest",
  "diasporaKitResource",
  "diasporaJobOffer",
  "diasporaTalentProfile",
  "diasporaJobApplication",
  // MD-02 : les objets communs du moteur, montrés par DIASPORALE.
  "post",
  "comment",
  "page",
  "event",
  "person",
] as const satisfies readonly ModerationSurface[]
export type ContentReportKind = (typeof CONTENT_REPORT_KINDS)[number]

/**
 * Les natures dont le moteur range le dossier au réseau RACINE (ANTSIA), pas à celui
 * de DIASPORALE : le profil est commun, et une suspension vaut partout. La feuille le dit.
 */
export const ROOT_NETWORK_REPORT_KINDS = ["person"] as const satisfies readonly ContentReportKind[]

/** Vrai si le dossier de cette nature est traité par la modération du réseau racine. */
export function reportReachesRootNetwork(kind: ContentReportKind): boolean {
  return (ROOT_NETWORK_REPORT_KINDS as readonly ContentReportKind[]).includes(kind)
}

/** Codes de refus propres aux signalements, traduits par errors.<code> dans leur fragment. */
export const CONTENT_REPORT_ERROR_CODES = [
  // La cible n'est pas l'une des natures du contrat, ou son identifiant est illisible (garde avant tout appel).
  "content_report_target_invalid",
  // Le moteur ferme momentanément le geste (restriction en cours, limite de la modération atteinte).
  "content_report_unavailable",
] as const
export type ContentReportErrorCode = (typeof CONTENT_REPORT_ERROR_CODES)[number]

/** Longueur maximale d'un identifiant de cible : un identifiant opaque, jamais un texte. */
export const CONTENT_REPORT_TARGET_ID_MAX = 128

/** Une cible signalable : sa nature et son identifiant opaque. */
export interface ContentReportTarget {
  readonly kind: ContentReportKind
  readonly id: string
}

export interface ContentReportInput extends ContentReportTarget {
  readonly reason: ReportReason
}

export function isContentReportKind(value: string): value is ContentReportKind {
  return (CONTENT_REPORT_KINDS as readonly string[]).includes(value)
}

/**
 * La garde commune aux deux fournisseurs, jugée avant tout appel : une nature du
 * contrat, un identifiant lisible (ni vide, ni bordé d'espaces, ni trop long), un
 * motif du moteur. `null` : rien ne s'y oppose.
 */
export function contentReportRefusal(input: { readonly kind: string; readonly id: string; readonly reason: string }): "content_report_target_invalid" | "report_reason_required" | null {
  if (!isContentReportKind(input.kind)) return "content_report_target_invalid"
  if (input.id.length === 0 || input.id.trim() !== input.id || input.id.length > CONTENT_REPORT_TARGET_ID_MAX) return "content_report_target_invalid"
  if (!(REPORT_REASONS as readonly string[]).includes(input.reason)) return "report_reason_required"
  return null
}

/** La clé stable d'une cible (mémoire des signalements). */
export function contentReportKey(target: ContentReportTarget): string {
  return `${target.kind}:${target.id}`
}

export interface ContentReportsCapability {
  /** Vrai pour la démonstration : rien n'est transmis, la cible est masquée dans ce seul navigateur. */
  readonly demonstration: boolean
  /**
   * Signaler une cible du contrat, pour un motif fermé. Rejoué, le fournisseur rend
   * le signalement existant : `created: false` (« déjà signalé »), rien n'est recréé.
   */
  report(input: ContentReportInput): Promise<ActionResult<{ readonly created: boolean }>>
  /**
   * Vrai si la personne de la session a signalé cette cible : l'écran la masque pour
   * elle. La démonstration le garde dans ce navigateur ; le moteur ne relit plus à la
   * personne ce qu'elle a signalé, et son adaptateur garde en plus les signalements de
   * cet onglet, pour un masque immédiat.
   */
  useReported(target: ContentReportTarget): boolean
}
