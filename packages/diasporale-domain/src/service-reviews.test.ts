import { describe, expect, it } from "bun:test"

import {
  SERVICE_REVIEW_BODY_MAX_LENGTH,
  SERVICE_REVIEW_BODY_MIN_LENGTH,
  SERVICE_REVIEW_PROOFS,
  SERVICE_REVIEW_REFUSALS,
  SERVICE_REVIEW_REPLY_MAX_LENGTH,
  SERVICE_REVIEW_REPLY_MIN_LENGTH,
  SERVICE_REVIEW_STATUSES,
  checkServiceReviewActive,
  checkServiceReviewVersion,
  parseServiceReview,
  parseServiceReviewReply,
  serviceReviewEligibility,
  type ServiceReviewEligibilityInput,
} from "./service-reviews"

const END = Date.UTC(2026, 9, 18, 12)
const BODY = "Prestation soignée et ponctuelle."
const review = (overrides: Partial<Parameters<typeof parseServiceReview>[0]> = {}) => ({ rating: 4, body: BODY, consentToPublish: true, ...overrides })

function eligibility(overrides: Partial<ServiceReviewEligibilityInput> = {}): ServiceReviewEligibilityInput {
  return {
    isRequester: true,
    isProvider: false,
    requestStatus: "confirmed",
    bookingStatus: "confirmed",
    bookingEndAt: END,
    noShowContested: false,
    now: END,
    ...overrides,
  }
}

describe("avis de service — contrat fermé", () => {
  it("distingue le rendez-vous de la réalisation déclarée et garde un retrait explicite", () => {
    expect(SERVICE_REVIEW_PROOFS).toEqual(["booking_confirmed", "completion_declared"])
    expect(SERVICE_REVIEW_STATUSES).toEqual(["active", "withdrawn"])
    expect(SERVICE_REVIEW_BODY_MIN_LENGTH).toBe(10)
    expect(SERVICE_REVIEW_BODY_MAX_LENGTH).toBe(2000)
    expect(SERVICE_REVIEW_REPLY_MIN_LENGTH).toBe(2)
    expect(SERVICE_REVIEW_REPLY_MAX_LENGTH).toBe(1000)
  })

  it("expose les dix-huit refus publics, sans doublon", () => {
    expect(SERVICE_REVIEW_REFUSALS).toEqual([
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
    ])
    expect(new Set(SERVICE_REVIEW_REFUSALS).size).toBe(18)
  })
})

describe("le commentaire et la note", () => {
  it("normalise NFC, espaces, fins de ligne et lignes vides avant de rendre l'avis", () => {
    const input = review({ body: "  Prestation   soigne\u0301e. \r\n\r\n\r\n\tMerci !  " })
    expect(parseServiceReview(input)).toEqual({ ok: true, value: { rating: 4, body: "Prestation soignée.\n\nMerci !" } })
    expect(input.body).toBe("  Prestation   soigne\u0301e. \r\n\r\n\r\n\tMerci !  ")
  })

  it.each([1, 2, 3, 4, 5])("admet la note entière %s", (rating) => {
    expect(parseServiceReview(review({ rating }))).toEqual({ ok: true, value: { rating, body: BODY } })
  })

  it.each([0, -1, 6, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])("refuse une note hors de l'échelle : %s", (rating) => {
    expect(parseServiceReview(review({ rating }))).toEqual({ ok: false, code: "review_rating_invalid" })
  })

  it("admet les deux bornes inclusives du commentaire après normalisation", () => {
    for (const length of [10, 2000]) {
      const body = "é".repeat(length)
      expect(parseServiceReview(review({ body: `  ${body.normalize("NFD")}  ` }))).toEqual({ ok: true, value: { rating: 4, body } })
    }
  })

  it.each(["", " \t\r\n ", "x".repeat(9), "  x".repeat(4)])("refuse un commentaire trop court après normalisation : %s", (body) => {
    expect(parseServiceReview(review({ body }))).toEqual({ ok: false, code: "review_body_too_short" })
  })

  it("refuse le premier caractère au-delà de la borne haute", () => {
    expect(parseServiceReview(review({ body: "x".repeat(2001) }))).toEqual({ ok: false, code: "review_body_too_long" })
  })

  it.each([
    "Contact : membre@example.com",
    "Joignez le 06 12 34 56 78 après la prestation.",
    "Joignez le +33 (0)6 12 34 56 78.",
  ])("refuse les coordonnées dans l'avis : %s", (body) => {
    expect(parseServiceReview(review({ body }))).toEqual({ ok: false, code: "review_contact_forbidden" })
  })

  it.each(["Prestation au 12 rue des Lilas.", "Accueil au 221B Baker Street."])("refuse une adresse exacte dans l'avis : %s", (body) => {
    expect(parseServiceReview(review({ body }))).toEqual({ ok: false, code: "review_address_forbidden" })
  })

  it("admet les indications approximatives et les dates sans coordonnée", () => {
    const body = "Très bon accueil à Paris 11e le 12/06/2027."
    expect(parseServiceReview(review({ body }))).toEqual({ ok: true, value: { rating: 4, body } })
  })

  it("exige un consentement explicite à la publication", () => {
    expect(parseServiceReview(review({ consentToPublish: false }))).toEqual({ ok: false, code: "review_consent_required" })
  })
})

describe("la réponse de la page", () => {
  it("normalise la réponse avec les mêmes règles que le commentaire", () => {
    expect(parseServiceReviewReply("  Merci\t pour\r\n\r\n\r\n votre   fide\u0301lite\u0301.  ")).toEqual({ ok: true, value: "Merci pour\n\nvotre fidélité." })
  })

  it("admet les deux bornes inclusives après NFC", () => {
    for (const length of [2, 1000]) {
      const body = "é".repeat(length)
      expect(parseServiceReviewReply(`\n ${body.normalize("NFD")} \n`)).toEqual({ ok: true, value: body })
    }
  })

  it.each(["", "  \t\n  ", "x", " e\u0301 "])("refuse une réponse trop courte : %s", (body) => {
    expect(parseServiceReviewReply(body)).toEqual({ ok: false, code: "review_reply_too_short" })
  })

  it("refuse le premier caractère au-delà de la borne haute", () => {
    expect(parseServiceReviewReply("x".repeat(1001))).toEqual({ ok: false, code: "review_reply_too_long" })
  })

  it.each(["membre@example.com", "Merci, appelez le 06 12 34 56 78."])("protège les coordonnées du professionnel : %s", (body) => {
    expect(parseServiceReviewReply(body)).toEqual({ ok: false, code: "review_contact_forbidden" })
  })

  it.each(["Merci, rendez-vous au 12 rue des Lilas.", "Notre accueil est au 10 Oak Lane."])("protège l'adresse exacte du professionnel : %s", (body) => {
    expect(parseServiceReviewReply(body)).toEqual({ ok: false, code: "review_address_forbidden" })
  })
})

describe("l'admissibilité et la preuve", () => {
  it("permet au seul demandeur de publier dès la fin du rendez-vous confirmé", () => {
    expect(serviceReviewEligibility(eligibility())).toEqual({ ok: true, value: "booking_confirmed" })
    expect(serviceReviewEligibility(eligibility({ now: END + 1 }))).toEqual({ ok: true, value: "booking_confirmed" })
  })

  it("rend une réalisation déclarée, jamais une preuve indépendante ni un effet du temps", () => {
    expect(serviceReviewEligibility(eligibility({ requestStatus: "completed", bookingStatus: "completed" }))).toEqual({ ok: true, value: "completion_declared" })
    expect(serviceReviewEligibility(eligibility({ now: END + 30 * 24 * 60 * 60 * 1000 }))).toEqual({ ok: true, value: "booking_confirmed" })
  })

  it("refuse le professionnel, même s'il est aussi demandeur", () => {
    expect(serviceReviewEligibility(eligibility({ isProvider: true }))).toEqual({ ok: false, code: "review_own_page" })
    expect(serviceReviewEligibility(eligibility({ isProvider: true, isRequester: false }))).toEqual({ ok: false, code: "review_own_page" })
  })

  it("refuse un tiers, même quand la prestation est terminée", () => {
    expect(serviceReviewEligibility(eligibility({ isRequester: false }))).toEqual({ ok: false, code: "review_not_requester" })
  })

  it("exige un rendez-vous existant, même pour une demande déclarée réalisée", () => {
    expect(serviceReviewEligibility(eligibility({ bookingStatus: null, bookingEndAt: null }))).toEqual({ ok: false, code: "review_booking_required" })
    expect(serviceReviewEligibility(eligibility({ requestStatus: "completed", bookingStatus: null }))).toEqual({ ok: false, code: "review_booking_required" })
  })

  it.each([
    { requestStatus: "confirmed", bookingStatus: "confirmed" },
    { requestStatus: "completed", bookingStatus: "completed" },
  ] as const)("refuse une publication avant la fin, même avec ces états : %o", (states) => {
    expect(serviceReviewEligibility(eligibility({ ...states, now: END - 1 }))).toEqual({ ok: false, code: "review_booking_not_finished" })
  })

  it.each([
    { requestStatus: "sent", bookingStatus: "confirmed" },
    { requestStatus: "proposed", bookingStatus: "confirmed" },
    { requestStatus: "refused", bookingStatus: "confirmed" },
    { requestStatus: "expired", bookingStatus: "confirmed" },
    { requestStatus: "cancelled", bookingStatus: "cancelled" },
    { requestStatus: "no_show", bookingStatus: "no_show" },
    { requestStatus: "confirmed", bookingStatus: "cancelled" },
    { requestStatus: "confirmed", bookingStatus: "no_show" },
    { requestStatus: "completed", bookingStatus: "cancelled" },
    { requestStatus: "completed", bookingStatus: "no_show" },
    { requestStatus: "completed", bookingStatus: "confirmed" },
    { requestStatus: "confirmed", bookingStatus: "completed" },
  ] as const)("refuse les états sans accord, annulés, manqués ou incohérents : %o", (states) => {
    expect(serviceReviewEligibility(eligibility(states))).toEqual({ ok: false, code: "review_booking_ineligible" })
  })

  it("une absence CONTESTÉE par le demandeur reste admissible, preuve « rendez-vous confirmé » (DG-015)", () => {
    const contested = { requestStatus: "no_show", bookingStatus: "no_show", noShowContested: true } as const
    expect(serviceReviewEligibility(eligibility(contested))).toEqual({ ok: true, value: "booking_confirmed" })
    expect(serviceReviewEligibility(eligibility({ ...contested, now: END - 1 }))).toEqual({ ok: false, code: "review_booking_not_finished" })
    expect(serviceReviewEligibility(eligibility({ ...contested, isProvider: true }))).toEqual({ ok: false, code: "review_own_page" })
    // La contestation ne vaut que pour une absence : elle n'ouvre aucun autre état.
    expect(serviceReviewEligibility(eligibility({ requestStatus: "cancelled", bookingStatus: "cancelled", noShowContested: true }))).toEqual({ ok: false, code: "review_booking_ineligible" })
    expect(serviceReviewEligibility(eligibility({ requestStatus: "confirmed", bookingStatus: "no_show", noShowContested: true }))).toEqual({ ok: false, code: "review_booking_ineligible" })
  })

  it("refuse un rendez-vous sans instant de fin exploitable", () => {
    expect(serviceReviewEligibility(eligibility({ bookingEndAt: null }))).toEqual({ ok: false, code: "review_booking_ineligible" })
  })

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 8_640_000_000_000_001])("refuse un instant de fin ou de lecture invalide : %s", (instant) => {
    expect(serviceReviewEligibility(eligibility({ bookingEndAt: instant }))).toEqual({ ok: false, code: "review_booking_ineligible" })
    expect(serviceReviewEligibility(eligibility({ now: instant }))).toEqual({ ok: false, code: "review_booking_ineligible" })
  })

  it("admet les bornes représentables des instants UTC", () => {
    expect(serviceReviewEligibility(eligibility({ bookingEndAt: 0, now: 0 }))).toEqual({ ok: true, value: "booking_confirmed" })
    expect(serviceReviewEligibility(eligibility({ bookingEndAt: 8_640_000_000_000_000, now: 8_640_000_000_000_000 }))).toEqual({ ok: true, value: "booking_confirmed" })
  })
})

describe("les gestes sur un avis ou une réponse", () => {
  it("accepte la version courante positive et refuse une version périmée", () => {
    expect(checkServiceReviewVersion(1, 1)).toEqual({ ok: true, value: null })
    expect(checkServiceReviewVersion(4, 4)).toEqual({ ok: true, value: null })
    expect(checkServiceReviewVersion(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toEqual({ ok: true, value: null })
    expect(checkServiceReviewVersion(3, 4)).toEqual({ ok: false, code: "review_version_changed" })
    expect(checkServiceReviewVersion(4, 3)).toEqual({ ok: false, code: "review_version_changed" })
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])("refuse une version invalide, même égale à l'autre : %s", (version) => {
    expect(checkServiceReviewVersion(version, 1)).toEqual({ ok: false, code: "review_version_changed" })
    expect(checkServiceReviewVersion(1, version)).toEqual({ ok: false, code: "review_version_changed" })
    expect(checkServiceReviewVersion(version, version)).toEqual({ ok: false, code: "review_version_changed" })
  })

  it("autorise les gestes sur un contenu actif et ferme le retrait", () => {
    expect(checkServiceReviewActive("active")).toEqual({ ok: true, value: null })
    expect(checkServiceReviewActive("withdrawn")).toEqual({ ok: false, code: "review_withdrawn" })
  })
})
