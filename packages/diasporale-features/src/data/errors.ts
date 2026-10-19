import {
  FACET_REFUSALS,
  MEMBERSHIP_EVENT_REFUSALS,
  RESIDENCE_COUNTRY_REFUSALS,
  SCOPE_REFUSALS,
  SPONSORSHIP_REFUSALS,
  SPONSORSHIP_REVOCATION_REFUSALS,
} from "@diasporale/domain"

import { HANDLE_REFUSALS } from "../lib/handle"
import { ASSOCIATION_ERROR_CODES } from "./associations-port"
import { ASSOCIATION_ACTIVITY_ERROR_CODES } from "./association-activities-port"
import { DATA_RIGHTS_ERROR_CODES } from "./data-rights-port"
import { PAGE_ADMIN_ERROR_CODES } from "./page-admin-port"
import { PAGE_ERROR_CODES } from "./pages-port"
import { PAGE_PUBLICATIONS_ERROR_CODES } from "./page-publications-port"
import { SERVICE_REQUEST_ERROR_CODES } from "./service-requests-port"
import { SERVICE_REVIEW_ERROR_CODES } from "./service-reviews-port"
import { SERVICE_ERROR_CODES } from "./services-port"
import { CONTENT_REPORT_ERROR_CODES } from "./content-reports-port"
import { CONVERSATION_ERROR_CODES } from "./conversations-port"
import { MUTUAL_AID_ERROR_CODES } from "./mutual-aid-port"
import { ARRIVAL_KIT_ERROR_CODES } from "./arrival-kit-port"
import { MENTORING_ERROR_CODES } from "./mentoring-port"
import { JOB_ERROR_CODES } from "./jobs-port"
import { MODERATION_DESK_ERROR_CODES } from "./moderation-desk-port"
import { PILOT_METRICS_ERROR_CODES } from "./pilot-metrics-port"

/**
 * Les codes de refus FERMÉS que l'écran traduit par `errors.<code>`.
 *
 * Trois sources, et aucune autre :
 *   · les refus du domaine (`@diasporale/domain`), rendus tels quels ;
 *   · les refus propres à la couche de données (session, adhésion,
 *     publication, attestation) — ce que le moteur rendra aussi en
 *     `ConvexError` à code ;
 *   · les refus des formulaires, posés par l'écran avant toute écriture.
 * Le cliquet i18n vérifie que chaque code a sa phrase, en français comme en
 * anglais, et qu'aucune phrase d'erreur n'est orpheline.
 */
export const DATA_ERROR_CODES = [
  "unknown",
  "not_found",
  "not_signed_in",
  "not_member",
  "already_member",
  "idn_invalid",
  "email_invalid",
  "phone_invalid",
  "code_invalid",
  "code_expired",
  "display_name_invalid",
  "headline_too_long",
  "handle_taken",
  "consent_social_profile_required",
  "consent_directory_required",
  "publish_not_allowed",
  "post_empty",
  "comment_empty",
  "comment_too_long",
  "report_reason_required",
  "report_note_too_long",
  "post_too_long",
  // Médias d'une publication (EXF-DG-10) : les règles du moteur, et l'envoi lui-même.
  "media_too_many",
  "media_video_alone",
  "media_type_invalid",
  "media_too_large",
  "media_alt_too_long",
  "media_upload_failed",
  // Partage cité : seule une publication publique et publiée se partage ; un partage ne joint pas de média.
  "share_not_allowed",
  "share_with_media",
  "attestation_not_needed",
  "attestation_too_soon",
  "attestation_unavailable",
  // Refus du moteur ANTSIA (PD2) : débit, sanction, statut, codes à usage unique, câblage à venir.
  "rate_limited",
  "status_insufficient",
  "suspended",
  "too_many_attempts",
  "delivery_unavailable",
  "feature_unavailable",
  "network_unavailable",
] as const

export const FORM_ERROR_CODES = [
  "idn_identity_required",
  "idn_consent_required",
  "code_format",
  "handle_required",
  "attestation_consent_required",
  "clipboard_unavailable",
] as const

export const ACTION_ERROR_CODES = [
  ...DATA_ERROR_CODES,
  ...MEMBERSHIP_EVENT_REFUSALS,
  ...RESIDENCE_COUNTRY_REFUSALS,
  ...FACET_REFUSALS,
  ...SCOPE_REFUSALS,
  ...SPONSORSHIP_REFUSALS,
  ...SPONSORSHIP_REVOCATION_REFUSALS,
  ...HANDLE_REFUSALS,
  // Les codes des capacités du plan global (docs/14), chacun tenu par son chantier.
  ...PAGE_ERROR_CODES,
  ...PAGE_PUBLICATIONS_ERROR_CODES,
  ...PAGE_ADMIN_ERROR_CODES,
  ...SERVICE_ERROR_CODES,
  ...SERVICE_REQUEST_ERROR_CODES,
  ...DATA_RIGHTS_ERROR_CODES,
  ...ASSOCIATION_ERROR_CODES,
  ...ASSOCIATION_ACTIVITY_ERROR_CODES,
  ...SERVICE_REVIEW_ERROR_CODES,
  ...CONTENT_REPORT_ERROR_CODES,
  ...MUTUAL_AID_ERROR_CODES,
  ...ARRIVAL_KIT_ERROR_CODES,
  ...MENTORING_ERROR_CODES,
  ...JOB_ERROR_CODES,
  ...MODERATION_DESK_ERROR_CODES,
  ...PILOT_METRICS_ERROR_CODES,
  ...CONVERSATION_ERROR_CODES,
] as const

export type ActionErrorCode = (typeof ACTION_ERROR_CODES)[number]
export type FormErrorCode = (typeof FORM_ERROR_CODES)[number]
export type ErrorCode = ActionErrorCode | FormErrorCode

/** Tous les codes traduisibles, sans doublon. */
export const ERROR_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([...ACTION_ERROR_CODES, ...FORM_ERROR_CODES])

/**
 * Les refus d'ACCÈS d'une lecture : réessayer n'y change rien. Un écran les dit
 * tels quels (`errors.<code>`), sans « Réessayer » ; une panne
 * (`network_unavailable`, `unknown`…) garde sa reprise.
 */
export const ACCESS_REFUSAL_CODES: ReadonlySet<ActionErrorCode> = new Set<ActionErrorCode>([
  "not_signed_in",
  "not_member",
  "not_found",
  "status_insufficient",
  "suspended",
])
