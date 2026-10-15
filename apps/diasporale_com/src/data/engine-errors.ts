/**
 * Les refus du moteur ANTIA, traduits en codes FERMÉS de DIASPORALE
 * (`ActionErrorCode`, que l'écran traduit par `errors.<code>`).
 *
 * Ordre de lecture d'une erreur reçue :
 *   1. un refus MÉTIER de la tranche `diaspora` (`appRule`), s'il appartient à
 *      l'ensemble fermé de DIASPORALE ;
 *   2. une règle du domaine du moteur (`rule`) que DIASPORALE sait dire ;
 *   3. le code du moteur.
 * Tout le reste devient `unknown` : jamais une phrase du serveur à l'écran.
 */
import { engineErrorAppRule, engineErrorCode, engineErrorRule, type EngineErrorCode } from "@antia/social-contracts/errors"
import { ACTION_ERROR_CODES, type ActionErrorCode, MEDIA_RULE_CODES } from "@diasporale/features/data"

const ACTION_CODES: ReadonlySet<string> = new Set(ACTION_ERROR_CODES)

function isActionErrorCode(value: string): value is ActionErrorCode {
  return ACTION_CODES.has(value)
}

/**
 * Les codes du moteur, vus par DIASPORALE. Table PARTIELLE à dessein : un code
 * que le moteur ajoute (dépôt de fichiers…) se dit `unknown` jusqu'à ce que
 * DIASPORALE sache le dire, sans rien casser.
 */
const ENGINE_CODES: Readonly<Partial<Record<EngineErrorCode, ActionErrorCode>>> = {
  unauthenticated: "not_signed_in",
  notFound: "not_found",
  rateLimited: "rate_limited",
  invalidArgument: "unknown",
  conflict: "unknown",
  handleUnavailable: "handle_taken",
  membershipSuspended: "suspended",
  statusInsufficient: "status_insufficient",
  operatorRequired: "not_found",
  policyRefused: "unknown",
  consentRequired: "consent_social_profile_required",
  profileRequired: "not_member",
}

/** Les règles du domaine du moteur que DIASPORALE sait dire à l'écran. */
const ENGINE_RULES: Readonly<Record<string, ActionErrorCode>> = {
  HANDLE_LENGTH: "handle_length",
  HANDLE_CHARSET: "handle_charset",
  DISPLAY_NAME_LENGTH: "display_name_invalid",
  POST_EMPTY: "post_empty",
  POST_TOO_LONG: "post_too_long",
  POST_REACH_INVALID: "scope_reach_invalid",
  POST_COUNTRY_INVALID: "scope_country_invalid",
  POST_COUNTRY_REQUIRED: "scope_country_required",
  COMMENT_EMPTY: "comment_empty",
  COMMENT_TOO_LONG: "comment_too_long",
  // Médias et dépôt de fichiers : la même table que l'écran (`@diasporale/features/data`).
  ...MEDIA_RULE_CODES,
  POST_NOT_SHAREABLE: "share_not_allowed",
  POST_SHARE_WITH_MEDIA: "share_with_media",
}

/** Le code FERMÉ d'une erreur levée par une fonction du moteur. */
export function engineActionErrorCode(error: unknown): ActionErrorCode {
  const app = engineErrorAppRule(error)
  if (app && isActionErrorCode(app.appRule)) return app.appRule
  const rule = engineErrorRule(error)
  const ruleCode = rule ? ENGINE_RULES[rule.rule] : undefined
  if (ruleCode) return ruleCode
  const code = engineErrorCode(error)
  return (code ? ENGINE_CODES[code] : undefined) ?? "unknown"
}

/** Un refus de Better Auth (code à usage unique) : code du greffon, du moteur, ou statut HTTP. */
export type AuthError = { readonly code?: string | undefined; readonly status?: number | undefined } | null | undefined

const AUTH_CODES: Readonly<Record<string, ActionErrorCode>> = {
  INVALID_OTP: "code_invalid",
  OTP_EXPIRED: "code_expired",
  TOO_MANY_ATTEMPTS: "too_many_attempts",
  INVALID_EMAIL: "email_invalid",
  otpDeliveryUnavailable: "delivery_unavailable",
  rateLimited: "rate_limited",
}

/** Le code FERMÉ d'un refus de Better Auth. */
export function authActionErrorCode(error: AuthError): ActionErrorCode {
  const code = error?.code ? AUTH_CODES[error.code] : undefined
  if (code) return code
  return error?.status === 429 ? "rate_limited" : "unknown"
}
