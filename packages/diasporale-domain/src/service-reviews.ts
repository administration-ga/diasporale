/**
 * Avis sur une prestation (DG-016) — règles pures : auteur admissible, preuve,
 * note et textes bornés, consentement, version et retrait.
 * PROPRIÉTAIRE : chantier « avis ».
 *
 * Le fournisseur relit les faits, garantit l'unicité par prestation et auteur,
 * les droits de réponse et la publication après modération. La réalisation
 * déclarée par la page reste une déclaration, jamais une preuve indépendante.
 * Ce module partagé avec le moteur reste compatible ES2021, sans texte d'UI.
 */
import { ok, refuse, type Result } from "./result"
import {
  isServiceInstant,
  normalizeServiceText,
  serviceTextRefusal,
  type ServiceBookingStatus,
  type ServiceRequestStatus,
} from "./service-requests"

export const SERVICE_REVIEW_PROOFS = ["booking_confirmed", "completion_declared"] as const
export type ServiceReviewProof = (typeof SERVICE_REVIEW_PROOFS)[number]

export const SERVICE_REVIEW_STATUSES = ["active", "withdrawn"] as const
export type ServiceReviewStatus = (typeof SERVICE_REVIEW_STATUSES)[number]

export const SERVICE_REVIEW_BODY_MIN_LENGTH = 10
export const SERVICE_REVIEW_BODY_MAX_LENGTH = 2000
export const SERVICE_REVIEW_REPLY_MIN_LENGTH = 2
export const SERVICE_REVIEW_REPLY_MAX_LENGTH = 1000

/** Refus fermés : les fournisseurs et l'interface traduisent ces codes. */
export const SERVICE_REVIEW_REFUSALS = [
  "review_rating_invalid",
  "review_body_too_short",
  "review_body_too_long",
  "review_reply_too_short",
  "review_reply_too_long",
  "review_contact_forbidden",
  "review_address_forbidden",
  "review_consent_required",
  "review_booking_required",
  "review_booking_not_finished",
  "review_booking_ineligible",
  "review_own_page",
  "review_not_requester",
  "review_already_exists",
  "review_version_changed",
  "review_withdrawn",
  "review_reply_unavailable",
  "review_not_published",
] as const
export type ServiceReviewRefusal = (typeof SERVICE_REVIEW_REFUSALS)[number]

const REVIEW_TEXT_REFUSALS = {
  request_contact_forbidden: "review_contact_forbidden",
  request_address_forbidden: "review_address_forbidden",
} as const

/** Un avis consenti : note entière et commentaire normalisé, sans coordonnée. */
export function parseServiceReview(input: {
  readonly rating: number
  readonly body: string
  readonly consentToPublish: boolean
}): Result<{ readonly rating: number; readonly body: string }, ServiceReviewRefusal> {
  if (!Number.isSafeInteger(input.rating) || input.rating < 1 || input.rating > 5) return refuse("review_rating_invalid")
  const body = normalizeServiceText(input.body)
  if (body.length < SERVICE_REVIEW_BODY_MIN_LENGTH) return refuse("review_body_too_short")
  if (body.length > SERVICE_REVIEW_BODY_MAX_LENGTH) return refuse("review_body_too_long")
  const textRefusal = serviceTextRefusal(body)
  if (textRefusal !== null) return refuse(REVIEW_TEXT_REFUSALS[textRefusal])
  if (input.consentToPublish !== true) return refuse("review_consent_required")
  return ok({ rating: input.rating, body })
}

/** Le droit de réponse ne dispense ni des bornes ni de la protection du contact. */
export function parseServiceReviewReply(raw: string): Result<string, ServiceReviewRefusal> {
  const body = normalizeServiceText(raw)
  if (body.length < SERVICE_REVIEW_REPLY_MIN_LENGTH) return refuse("review_reply_too_short")
  if (body.length > SERVICE_REVIEW_REPLY_MAX_LENGTH) return refuse("review_reply_too_long")
  const textRefusal = serviceTextRefusal(body)
  return textRefusal === null ? ok(body) : refuse(REVIEW_TEXT_REFUSALS[textRefusal])
}

export interface ServiceReviewEligibilityInput {
  readonly isRequester: boolean
  /** Signataire vivant de la page professionnelle, même s'il est aussi demandeur. */
  readonly isProvider: boolean
  readonly requestStatus: ServiceRequestStatus
  readonly bookingStatus: ServiceBookingStatus | null
  readonly bookingEndAt: number | null
  /** La personne qui demande a contesté l'absence déclarée par la page (DG-015). */
  readonly noShowContested: boolean
  readonly now: number
}

/**
 * Seul le demandeur peut évaluer, jamais le professionnel lui-même. La demande
 * et son rendez-vous doivent porter le même état admissible et leur fin être
 * atteinte : un simple passage du temps n'atteste aucune réalisation. Une
 * absence CONTESTÉE par le demandeur reste admissible, preuve « rendez-vous
 * confirmé » : un constat d'absence ne sert pas à écarter un avis (DG-015).
 */
export function serviceReviewEligibility(input: ServiceReviewEligibilityInput): Result<ServiceReviewProof, ServiceReviewRefusal> {
  if (input.isProvider) return refuse("review_own_page")
  if (!input.isRequester) return refuse("review_not_requester")
  if (input.bookingStatus === null) return refuse("review_booking_required")
  if (
    input.bookingEndAt === null ||
    !isServiceInstant(input.bookingEndAt) ||
    !isServiceInstant(input.now) ||
    !(
      (input.requestStatus === "confirmed" && input.bookingStatus === "confirmed") ||
      (input.requestStatus === "completed" && input.bookingStatus === "completed") ||
      (input.requestStatus === "no_show" && input.bookingStatus === "no_show" && input.noShowContested)
    )
  ) {
    return refuse("review_booking_ineligible")
  }
  if (input.now < input.bookingEndAt) return refuse("review_booking_not_finished")
  return ok(input.bookingStatus === "completed" ? "completion_declared" : "booking_confirmed")
}

/** Un geste cite une version positive, entière et représentable, encore courante. */
export function checkServiceReviewVersion(expected: number, actual: number): Result<null, ServiceReviewRefusal> {
  if (!Number.isSafeInteger(expected) || expected < 1 || !Number.isSafeInteger(actual) || actual < 1 || expected !== actual) {
    return refuse("review_version_changed")
  }
  return ok(null)
}

/** Un avis ou une réponse retiré ne se modifie plus et ne se republie pas implicitement. */
export function checkServiceReviewActive(status: ServiceReviewStatus): Result<null, ServiceReviewRefusal> {
  return status === "active" ? ok(null) : refuse("review_withdrawn")
}
