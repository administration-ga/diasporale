import {
  FACET_REFUSALS,
  MEMBERSHIP_EVENT_REFUSALS,
  RESIDENCE_COUNTRY_REFUSALS,
  SCOPE_REFUSALS,
  SPONSORSHIP_REFUSALS,
  SPONSORSHIP_REVOCATION_REFUSALS,
} from "@diasporale/domain"

import { HANDLE_REFUSALS } from "../lib/handle"

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
  "handle_taken",
  "consent_social_profile_required",
  "consent_directory_required",
  "publish_not_allowed",
  "post_empty",
  "comment_empty",
  "comment_too_long",
  "post_too_long",
  "attestation_not_needed",
  "attestation_too_soon",
  "attestation_unavailable",
  // Refus du moteur ANTIA (PD2) : débit, sanction, statut, codes à usage unique, câblage à venir.
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
] as const

export type ActionErrorCode = (typeof ACTION_ERROR_CODES)[number]
export type FormErrorCode = (typeof FORM_ERROR_CODES)[number]
export type ErrorCode = ActionErrorCode | FormErrorCode

/** Tous les codes traduisibles, sans doublon. */
export const ERROR_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([...ACTION_ERROR_CODES, ...FORM_ERROR_CODES])
