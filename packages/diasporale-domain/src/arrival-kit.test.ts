import { describe, expect, test } from "bun:test"

import {
  ARRIVAL_KIT_BODY_MAX_LENGTH,
  ARRIVAL_KIT_CARRIER_OWNER_KINDS,
  ARRIVAL_KIT_CATEGORIES,
  ARRIVAL_KIT_CITY_MAX_LENGTH,
  ARRIVAL_KIT_GESTURES,
  ARRIVAL_KIT_LISTED_STATUSES,
  ARRIVAL_KIT_OUTDATED_FLAG_THRESHOLD,
  ARRIVAL_KIT_OUTDATED_REASONS,
  ARRIVAL_KIT_REASON_MAX_LENGTH,
  ARRIVAL_KIT_REFUSALS,
  ARRIVAL_KIT_RESOURCES_PER_PROPOSER_MAX,
  ARRIVAL_KIT_REVIEW_CAUSES,
  ARRIVAL_KIT_REVIEW_DECISIONS,
  ARRIVAL_KIT_REVIEW_OUTCOMES,
  ARRIVAL_KIT_SOURCE_NAME_MAX_LENGTH,
  ARRIVAL_KIT_SOURCE_URL_MAX_LENGTH,
  ARRIVAL_KIT_STATUSES,
  ARRIVAL_KIT_SUMMARY_MAX_LENGTH,
  ARRIVAL_KIT_TITLE_MAX_LENGTH,
  ARRIVAL_KIT_VERIFIED_AT_FUTURE_TOLERANCE_MS,
  arrivalKitReviewCause,
  arrivalKitReviewDueAt,
  checkArrivalKitFlag,
  checkArrivalKitReviewer,
  checkArrivalKitVersion,
  effectiveArrivalKitStatus,
  formatArrivalKitDateInput,
  isArrivalKitCarrierKind,
  isArrivalKitCategory,
  isArrivalKitIndependent,
  isArrivalKitListed,
  isArrivalKitOutdatedReason,
  isArrivalKitQuotaReached,
  isArrivalKitReviewer,
  isArrivalKitTrackingParameter,
  matchesArrivalKitListing,
  parseArrivalKitCity,
  parseArrivalKitCountry,
  parseArrivalKitDateInput,
  parseArrivalKitListing,
  parseArrivalKitReason,
  parseArrivalKitResource,
  parseArrivalKitSourceName,
  parseArrivalKitSourceUrl,
  parseArrivalKitVerifiedAt,
  transitionArrivalKit,
  type ArrivalKitGesture,
  type ArrivalKitListing,
  type ArrivalKitResourceInput,
  type ArrivalKitReviewCause,
  type ArrivalKitStanding,
  type ArrivalKitStatus,
} from "./arrival-kit"
import { DAY_MS } from "./time"

const NOW = Date.UTC(2026, 9, 18, 12)

/** Une ressource fictive complète et valide : chaque test n'en change qu'un trait. */
const RESOURCE: ArrivalKitResourceInput = {
  title: "  Ouvrir un   compte bancaire  ",
  summary: "Les pièces demandées et les délais habituels pour un premier compte.",
  body: "Prenez rendez-vous en agence.\r\n\r\n\r\n\r\nApportez une pièce d'identité,  \nun justificatif de domicile et votre titre de séjour.",
  category: "banking",
  country: " fr ",
  city: "  Saint-Étienne  ",
  sourceName: "  Portail public   d'information bancaire ",
  sourceUrl: "https://www.exemple-public.fr/compte?utm_source=lettre&ref=kit&UTM_Medium=mail&fbclid=abc",
  lastVerifiedAt: NOW - 3 * DAY_MS,
}

const refusalOf = (input: Partial<ArrivalKitResourceInput>) => {
  const result = parseArrivalKitResource({ ...RESOURCE, ...input }, NOW)
  return result.ok ? null : result.code
}

describe("listes fermées du kit d'arrivée", () => {
  test("les rubriques, le cycle et les motifs suivent le plan global §G8.3", () => {
    expect(ARRIVAL_KIT_CATEGORIES).toEqual(["procedures", "housing", "health", "banking", "transport", "employment", "schooling", "culture_associations", "emergency"])
    expect(ARRIVAL_KIT_STATUSES).toEqual(["draft", "submitted", "published", "needs_review", "archived"])
    expect(ARRIVAL_KIT_LISTED_STATUSES).toEqual(["published", "needs_review"])
    expect(ARRIVAL_KIT_REVIEW_DECISIONS.every((decision) => (ARRIVAL_KIT_GESTURES as readonly string[]).includes(decision))).toBe(true)
    expect(ARRIVAL_KIT_REVIEW_OUTCOMES).toEqual(["published", "returned", "needs_review"])
    expect(ARRIVAL_KIT_REVIEW_CAUSES).toEqual(["age", "flags", "reviewer"])
    expect(ARRIVAL_KIT_OUTDATED_REASONS).toEqual(["link_broken", "information_changed", "service_closed", "other"])
    // Ni entreprise ni média : le kit n'est pas un espace promotionnel.
    expect(ARRIVAL_KIT_CARRIER_OWNER_KINDS).toEqual(["institution", "association", "community"])
  })

  test("les refus sont des codes fermés, uniques, au format des refus d'application du moteur", () => {
    expect(new Set(ARRIVAL_KIT_REFUSALS).size).toBe(ARRIVAL_KIT_REFUSALS.length)
    for (const code of ARRIVAL_KIT_REFUSALS) {
      expect(code).toMatch(/^arrival_kit_[a-z_]+$/)
      expect(code.length).toBeLessThanOrEqual(64)
    }
  })

  test("les gardes de type ne reconnaissent que les membres des listes", () => {
    expect(isArrivalKitCategory("housing")).toBe(true)
    expect(isArrivalKitCategory("logement")).toBe(false)
    expect(isArrivalKitOutdatedReason("other")).toBe(true)
    expect(isArrivalKitOutdatedReason("spam")).toBe(false)
    expect(isArrivalKitCarrierKind("association")).toBe(true)
    expect(isArrivalKitCarrierKind("company")).toBe(false)
    expect(isArrivalKitListed("published")).toBe(true)
    expect(isArrivalKitListed("needs_review")).toBe(true)
    expect(isArrivalKitListed("submitted")).toBe(false)
    expect(isArrivalKitListed("archived")).toBe(false)
  })
})

describe("zone : pays et ville saisie", () => {
  test("le pays est obligatoire, connu, et jamais le Gabon", () => {
    expect(parseArrivalKitCountry(" fr ")).toEqual({ ok: true, value: "FR" })
    expect(parseArrivalKitCountry(undefined)).toEqual({ ok: false, code: "arrival_kit_country_required" })
    expect(parseArrivalKitCountry("  ")).toEqual({ ok: false, code: "arrival_kit_country_required" })
    expect(parseArrivalKitCountry("ZZ")).toEqual({ ok: false, code: "arrival_kit_country_unknown" })
    expect(parseArrivalKitCountry("ga")).toEqual({ ok: false, code: "arrival_kit_country_is_home" })
  })

  test("la ville est facultative ; saisie, elle est bornée et repliée comme celle du catalogue", () => {
    expect(parseArrivalKitCity(null)).toEqual({ ok: true, value: { city: null, cityKey: "" } })
    expect(parseArrivalKitCity("   ")).toEqual({ ok: true, value: { city: null, cityKey: "" } })
    expect(parseArrivalKitCity("  Saint-Étienne   du  Rouvray ")).toEqual({ ok: true, value: { city: "Saint-Étienne du Rouvray", cityKey: "saint etienne du rouvray" } })
    expect(parseArrivalKitCity("x".repeat(ARRIVAL_KIT_CITY_MAX_LENGTH + 1))).toEqual({ ok: false, code: "arrival_kit_city_too_long" })
    // Une ville qui ne se replie en rien, ou qui porte un numéro, n'est pas une ville.
    expect(parseArrivalKitCity("---")).toEqual({ ok: false, code: "arrival_kit_city_invalid" })
    expect(parseArrivalKitCity("06 12 34 56 78")).toEqual({ ok: false, code: "arrival_kit_city_invalid" })
  })
})

describe("source : nom et adresse", () => {
  test("le nom de la source est une ligne bornée ; un nom de site est admis, une coordonnée non", () => {
    expect(parseArrivalKitSourceName("  Portail   public ")).toEqual({ ok: true, value: "Portail public" })
    expect(parseArrivalKitSourceName("service-public.fr")).toEqual({ ok: true, value: "service-public.fr" })
    expect(parseArrivalKitSourceName("ab")).toEqual({ ok: false, code: "arrival_kit_source_name_too_short" })
    expect(parseArrivalKitSourceName("x".repeat(ARRIVAL_KIT_SOURCE_NAME_MAX_LENGTH + 1))).toEqual({ ok: false, code: "arrival_kit_source_name_too_long" })
    expect(parseArrivalKitSourceName("Écrire à accueil@exemple.fr")).toEqual({ ok: false, code: "arrival_kit_contact_details_forbidden" })
    expect(parseArrivalKitSourceName("Accueil 01 23 45 67 89")).toEqual({ ok: false, code: "arrival_kit_contact_details_forbidden" })
  })

  test("les identifiants de suivi sont reconnus : utm_* en toute casse et identifiants de clic", () => {
    expect(isArrivalKitTrackingParameter("utm_campaign")).toBe(true)
    expect(isArrivalKitTrackingParameter("UTM_Source")).toBe(true)
    expect(isArrivalKitTrackingParameter("gclid")).toBe(true)
    expect(isArrivalKitTrackingParameter("page")).toBe(false)
  })

  test("l'adresse est normalisée et débarrassée de ses identifiants de suivi", () => {
    expect(parseArrivalKitSourceUrl(RESOURCE.sourceUrl)).toEqual({ ok: true, value: "https://www.exemple-public.fr/compte?ref=kit" })
    expect(parseArrivalKitSourceUrl("  https://Exemple-Public.FR  ")).toEqual({ ok: true, value: "https://exemple-public.fr/" })
    expect(parseArrivalKitSourceUrl("HTTPS://exemple-public.fr/aide?utm_source=x")).toEqual({ ok: true, value: "https://exemple-public.fr/aide" })
  })

  test("une adresse non https est refusée, quelle qu'en soit la forme", () => {
    for (const url of ["http://exemple-public.fr/", "javascript:alert(1)", "ftp://exemple-public.fr/", "data:text/html,bonjour"]) {
      expect(parseArrivalKitSourceUrl(url)).toEqual({ ok: false, code: "arrival_kit_source_url_not_https" })
    }
  })

  test("une adresse absente, mal formée, privée ou locale est refusée", () => {
    expect(parseArrivalKitSourceUrl("   ")).toEqual({ ok: false, code: "arrival_kit_source_url_required" })
    for (const url of [
      `https://exemple-public.fr/${"a".repeat(ARRIVAL_KIT_SOURCE_URL_MAX_LENGTH)}`,
      "https://exemple-public.fr/une page",
      "https://exemple-public.fr\\chemin",
      "https://exemple-public.fr/\u0007",
      "exemple-public.fr/page",
      "https://",
      "https://agent:secret@exemple-public.fr/",
      "https://localhost/",
      "https://intranet/",
      "https://192.168.1.10/",
      "https://[::1]/",
      "https://mairie.local/",
    ]) {
      expect(parseArrivalKitSourceUrl(url)).toEqual({ ok: false, code: "arrival_kit_source_url_invalid" })
    }
  })
})

describe("dates : vérification et révision", () => {
  test("une vérification vaut douze mois calendaires", () => {
    expect(arrivalKitReviewDueAt(Date.UTC(2025, 9, 18, 12))).toBe(NOW)
    // Le 29 février d'une année bissextile mène au 1er mars de l'année suivante.
    expect(arrivalKitReviewDueAt(Date.UTC(2024, 1, 29))).toBe(Date.UTC(2025, 2, 1))
  })

  test("la date de vérification est réelle, pas dans le futur, et de moins de douze mois", () => {
    expect(parseArrivalKitVerifiedAt(Number.NaN, NOW)).toEqual({ ok: false, code: "arrival_kit_verified_at_invalid" })
    expect(parseArrivalKitVerifiedAt(1.5, NOW)).toEqual({ ok: false, code: "arrival_kit_verified_at_invalid" })
    expect(parseArrivalKitVerifiedAt(0, NOW)).toEqual({ ok: false, code: "arrival_kit_verified_at_invalid" })
    expect(parseArrivalKitVerifiedAt(NOW + ARRIVAL_KIT_VERIFIED_AT_FUTURE_TOLERANCE_MS + 1, NOW)).toEqual({ ok: false, code: "arrival_kit_verified_at_in_future" })
    expect(parseArrivalKitVerifiedAt(NOW + ARRIVAL_KIT_VERIFIED_AT_FUTURE_TOLERANCE_MS, NOW)).toEqual({ ok: true, value: NOW + DAY_MS })
    expect(parseArrivalKitVerifiedAt(Date.UTC(2025, 9, 18, 12), NOW)).toEqual({ ok: false, code: "arrival_kit_verified_at_too_old" })
    expect(parseArrivalKitVerifiedAt(Date.UTC(2025, 9, 18, 12) + 1, NOW)).toEqual({ ok: true, value: Date.UTC(2025, 9, 18, 12) + 1 })
  })

  test("la date d'un formulaire se lit en minuit UTC ; une date qui n'existe pas est refusée", () => {
    expect(parseArrivalKitDateInput(" 2026-10-18 ")).toBe(Date.UTC(2026, 9, 18))
    expect(parseArrivalKitDateInput("2026-02-30")).toBeNull()
    expect(parseArrivalKitDateInput("0026-01-01")).toBeNull()
    expect(parseArrivalKitDateInput("18/10/2026")).toBeNull()
    expect(formatArrivalKitDateInput(Date.UTC(2026, 9, 18, 23, 59))).toBe("2026-10-18")
  })
})

describe("une ressource : saisie → version validée", () => {
  test("la version validée est normalisée : textes resserrés, pays, ville repliée, adresse sans suivi", () => {
    expect(parseArrivalKitResource(RESOURCE, NOW)).toEqual({
      ok: true,
      value: {
        title: "Ouvrir un compte bancaire",
        summary: "Les pièces demandées et les délais habituels pour un premier compte.",
        body: "Prenez rendez-vous en agence.\n\nApportez une pièce d'identité,\nun justificatif de domicile et votre titre de séjour.",
        category: "banking",
        country: "FR",
        city: "Saint-Étienne",
        cityKey: "saint etienne",
        sourceName: "Portail public d'information bancaire",
        sourceUrl: "https://www.exemple-public.fr/compte?ref=kit",
        lastVerifiedAt: NOW - 3 * DAY_MS,
      },
    })
    // Sans ville : la ressource vaut pour tout le pays.
    expect(parseArrivalKitResource({ ...RESOURCE, city: undefined }, NOW)).toMatchObject({ ok: true, value: { city: null, cityKey: "" } })
  })

  test("chaque champ a sa borne, dans l'ordre de la règle", () => {
    expect(refusalOf({ title: "abc" })).toBe("arrival_kit_title_too_short")
    expect(refusalOf({ title: "x".repeat(ARRIVAL_KIT_TITLE_MAX_LENGTH + 1) })).toBe("arrival_kit_title_too_long")
    expect(refusalOf({ summary: "Trop court" })).toBe("arrival_kit_summary_too_short")
    expect(refusalOf({ summary: "x".repeat(ARRIVAL_KIT_SUMMARY_MAX_LENGTH + 1) })).toBe("arrival_kit_summary_too_long")
    expect(refusalOf({ body: "Court." })).toBe("arrival_kit_body_too_short")
    expect(refusalOf({ body: "x".repeat(ARRIVAL_KIT_BODY_MAX_LENGTH + 1) })).toBe("arrival_kit_body_too_long")
    expect(refusalOf({ category: "sports" })).toBe("arrival_kit_category_invalid")
    expect(refusalOf({ country: "" })).toBe("arrival_kit_country_required")
    expect(refusalOf({ country: "GA" })).toBe("arrival_kit_country_is_home")
    expect(refusalOf({ city: "x".repeat(ARRIVAL_KIT_CITY_MAX_LENGTH + 1) })).toBe("arrival_kit_city_too_long")
    expect(refusalOf({ sourceName: "ab" })).toBe("arrival_kit_source_name_too_short")
    expect(refusalOf({ sourceUrl: "http://exemple-public.fr/" })).toBe("arrival_kit_source_url_not_https")
    expect(refusalOf({ sourceUrl: "" })).toBe("arrival_kit_source_url_required")
    expect(refusalOf({ lastVerifiedAt: NOW + 2 * DAY_MS })).toBe("arrival_kit_verified_at_in_future")
    expect(refusalOf({ lastVerifiedAt: Date.UTC(2025, 0, 1) })).toBe("arrival_kit_verified_at_too_old")
  })

  test("aucune coordonnée dans le titre, le résumé ou le contenu : la source a son propre champ", () => {
    expect(refusalOf({ title: "Appelez le 06 12 34 56 78" })).toBe("arrival_kit_contact_details_forbidden")
    expect(refusalOf({ summary: "Écrivez à accueil@exemple-public.fr pour toute question pratique." })).toBe("arrival_kit_contact_details_forbidden")
    expect(refusalOf({ body: "Tout est expliqué sur www.exemple-public.fr, rubrique des nouveaux arrivants." })).toBe("arrival_kit_contact_details_forbidden")
    // Un numéro d'urgence court n'est pas une coordonnée personnelle.
    expect(refusalOf({ category: "emergency", body: "Le 112 répond partout en Europe ; le 15 pour une urgence médicale en France." })).toBeNull()
  })

  test("le motif d'un renvoi ou d'une mise « à revoir » est obligatoire, borné, sans coordonnée", () => {
    expect(parseArrivalKitReason(undefined)).toEqual({ ok: false, code: "arrival_kit_reason_too_short" })
    expect(parseArrivalKitReason("  bref  ")).toEqual({ ok: false, code: "arrival_kit_reason_too_short" })
    expect(parseArrivalKitReason("x".repeat(ARRIVAL_KIT_REASON_MAX_LENGTH + 1))).toEqual({ ok: false, code: "arrival_kit_reason_too_long" })
    expect(parseArrivalKitReason("Voir plutôt www.exemple-public.fr pour la date.")).toEqual({ ok: false, code: "arrival_kit_contact_details_forbidden" })
    expect(parseArrivalKitReason("  Le lien de la source ne répond plus.  ")).toEqual({ ok: true, value: "Le lien de la source ne répond plus." })
  })
})

describe("cycle : brouillon → soumise → publiée → à revoir → archivée", () => {
  const EXPECTED: Readonly<Record<Exclude<ArrivalKitStatus, "archived">, Readonly<Record<ArrivalKitGesture, ArrivalKitStatus | null>>>> = {
    draft: { save_draft: "draft", save_and_submit: "submitted", submit: "submitted", publish: null, return: null, mark_needs_review: null, archive: "archived" },
    submitted: { save_draft: "draft", save_and_submit: "submitted", submit: null, publish: "published", return: "draft", mark_needs_review: null, archive: "archived" },
    published: { save_draft: "draft", save_and_submit: "submitted", submit: null, publish: null, return: null, mark_needs_review: "needs_review", archive: "archived" },
    needs_review: { save_draft: "draft", save_and_submit: "submitted", submit: null, publish: null, return: null, mark_needs_review: null, archive: "archived" },
  }

  test("chaque geste a ses états de départ ; une nouvelle version quitte le kit public jusqu'à sa relecture", () => {
    for (const [from, row] of Object.entries(EXPECTED) as [Exclude<ArrivalKitStatus, "archived">, Readonly<Record<ArrivalKitGesture, ArrivalKitStatus | null>>][]) {
      for (const gesture of ARRIVAL_KIT_GESTURES) {
        const expected = row[gesture]
        expect(transitionArrivalKit(from, gesture)).toEqual(expected === null ? { ok: false, code: "arrival_kit_transition_invalid" } : { ok: true, value: expected })
      }
    }
  })

  test("archivée est terminale", () => {
    for (const gesture of ARRIVAL_KIT_GESTURES) expect(transitionArrivalKit("archived", gesture)).toEqual({ ok: false, code: "arrival_kit_archived" })
  })

  test("un geste cite la version lue", () => {
    expect(checkArrivalKitVersion(3, 3)).toEqual({ ok: true, value: 4 })
    expect(checkArrivalKitVersion(3, 2)).toEqual({ ok: false, code: "arrival_kit_version_conflict" })
  })

  test("à revoir : marquée par une relecture, vérifiée il y a douze mois, ou signalée au-delà du seuil", () => {
    const fresh = NOW - DAY_MS
    const old = Date.UTC(2025, 9, 18, 12)
    const cases: readonly { readonly standing: ArrivalKitStanding; readonly cause: ArrivalKitReviewCause | null; readonly status: ArrivalKitStatus }[] = [
      { standing: { status: "needs_review", lastVerifiedAt: fresh, outdatedFlags: 0 }, cause: "reviewer", status: "needs_review" },
      { standing: { status: "draft", lastVerifiedAt: old, outdatedFlags: 9 }, cause: null, status: "draft" },
      { standing: { status: "published", lastVerifiedAt: old, outdatedFlags: 0 }, cause: "age", status: "needs_review" },
      { standing: { status: "published", lastVerifiedAt: fresh, outdatedFlags: ARRIVAL_KIT_OUTDATED_FLAG_THRESHOLD }, cause: "flags", status: "needs_review" },
      { standing: { status: "published", lastVerifiedAt: fresh, outdatedFlags: ARRIVAL_KIT_OUTDATED_FLAG_THRESHOLD - 1 }, cause: null, status: "published" },
    ]
    for (const { standing, cause, status } of cases) {
      expect(arrivalKitReviewCause(standing, NOW)).toBe(cause)
      expect(effectiveArrivalKitStatus(standing, NOW)).toBe(status)
    }
  })

  test("une personne garde au plus trente ressources non archivées", () => {
    expect(isArrivalKitQuotaReached(ARRIVAL_KIT_RESOURCES_PER_PROPOSER_MAX - 1)).toBe(false)
    expect(isArrivalKitQuotaReached(ARRIVAL_KIT_RESOURCES_PER_PROPOSER_MAX)).toBe(true)
  })
})

describe("relecture et signalement", () => {
  test("relit un membre vérifié, ou le signataire vivant d'une page qui peut publier", () => {
    expect(isArrivalKitReviewer({ status: "verifiee", livePageSignatory: false })).toBe(true)
    expect(isArrivalKitReviewer({ status: "declaree", livePageSignatory: false })).toBe(false)
    expect(isArrivalKitReviewer({ status: "declaree", livePageSignatory: true })).toBe(true)
    expect(isArrivalKitReviewer({ status: "en_attente", livePageSignatory: true })).toBe(false)
    expect(isArrivalKitReviewer({ status: "suspendue", livePageSignatory: true })).toBe(false)
    expect(isArrivalKitReviewer({ status: "partie", livePageSignatory: true })).toBe(false)
  })

  test("personne ne relit ce qu'elle a écrit, ni ce que porte son équipe", () => {
    const verified = { status: "verifiee" as const, livePageSignatory: false }
    expect(isArrivalKitIndependent({ actorId: "p-1", writerIds: ["p-2"], onCarrierTeam: false })).toBe(true)
    expect(checkArrivalKitReviewer({ reviewer: { status: "declaree", livePageSignatory: false }, actorId: "p-1", writerIds: ["p-2"], onCarrierTeam: false })).toEqual({ ok: false, code: "arrival_kit_reviewer_not_eligible" })
    expect(checkArrivalKitReviewer({ reviewer: verified, actorId: "p-1", writerIds: ["p-2", "p-1"], onCarrierTeam: false })).toEqual({ ok: false, code: "arrival_kit_review_own_resource" })
    expect(checkArrivalKitReviewer({ reviewer: verified, actorId: "p-1", writerIds: ["p-2"], onCarrierTeam: true })).toEqual({ ok: false, code: "arrival_kit_review_own_resource" })
    expect(checkArrivalKitReviewer({ reviewer: verified, actorId: "p-1", writerIds: ["p-2"], onCarrierTeam: false })).toEqual({ ok: true, value: null })
  })

  test("signaler : une ressource du kit public, une fois par version, avec un motif fermé, jamais la sienne", () => {
    const base = { actorId: "p-1", writerIds: ["p-2"], onCarrierTeam: false, alreadyFlagged: false, reason: "link_broken" }
    expect(checkArrivalKitFlag({ ...base, status: "submitted" })).toEqual({ ok: false, code: "arrival_kit_not_flaggable" })
    expect(checkArrivalKitFlag({ ...base, status: "published", writerIds: ["p-1"] })).toEqual({ ok: false, code: "arrival_kit_flag_own_resource" })
    expect(checkArrivalKitFlag({ ...base, status: "published", onCarrierTeam: true })).toEqual({ ok: false, code: "arrival_kit_flag_own_resource" })
    expect(checkArrivalKitFlag({ ...base, status: "published", alreadyFlagged: true })).toEqual({ ok: false, code: "arrival_kit_already_flagged" })
    expect(checkArrivalKitFlag({ ...base, status: "published", reason: "spam" })).toEqual({ ok: false, code: "arrival_kit_outdated_reason_invalid" })
    expect(checkArrivalKitFlag({ ...base, status: "published" })).toEqual({ ok: true, value: "link_broken" })
    expect(checkArrivalKitFlag({ ...base, status: "needs_review", reason: "service_closed" })).toEqual({ ok: true, value: "service_closed" })
  })
})

describe("lire le kit : pays, ville, rubrique", () => {
  test("le pays est obligatoire ; la ville et la rubrique restreignent", () => {
    expect(parseArrivalKitListing({ country: "" })).toEqual({ ok: false, code: "arrival_kit_country_required" })
    expect(parseArrivalKitListing({ country: "FR", city: "x".repeat(ARRIVAL_KIT_CITY_MAX_LENGTH + 1) })).toEqual({ ok: false, code: "arrival_kit_city_too_long" })
    expect(parseArrivalKitListing({ country: "FR", category: "sports" })).toEqual({ ok: false, code: "arrival_kit_category_invalid" })
    expect(parseArrivalKitListing({ country: " fr " })).toEqual({ ok: true, value: { country: "FR", zone: { kind: "country" }, category: null } })
    expect(parseArrivalKitListing({ country: "FR", city: "", nationalOnly: false })).toEqual({ ok: true, value: { country: "FR", zone: { kind: "country" }, category: null } })
    expect(parseArrivalKitListing({ country: "FR", nationalOnly: true, category: "" })).toEqual({ ok: true, value: { country: "FR", zone: { kind: "national" }, category: null } })
    // Une ville saisie l'emporte sur « national seulement ».
    expect(parseArrivalKitListing({ country: "FR", city: " Lyon ", nationalOnly: true, category: "housing" })).toEqual({
      ok: true,
      value: { country: "FR", zone: { kind: "city", cityKey: "lyon" }, category: "housing" },
    })
  })

  test("une ressource répond à sa zone et à sa rubrique, jamais à celles d'un autre pays", () => {
    const country: ArrivalKitListing = { country: "FR", zone: { kind: "country" }, category: null }
    const lyon = { country: "FR", cityKey: "lyon", category: "housing" }
    const national = { country: "FR", cityKey: "", category: "housing" }
    expect(matchesArrivalKitListing(lyon, country)).toBe(true)
    expect(matchesArrivalKitListing({ ...lyon, country: "BE" }, country)).toBe(false)
    expect(matchesArrivalKitListing(lyon, { ...country, category: "health" })).toBe(false)
    expect(matchesArrivalKitListing(national, { ...country, zone: { kind: "national" } })).toBe(true)
    expect(matchesArrivalKitListing(lyon, { ...country, zone: { kind: "national" } })).toBe(false)
    expect(matchesArrivalKitListing(lyon, { ...country, zone: { kind: "city", cityKey: "lyon" } })).toBe(true)
    expect(matchesArrivalKitListing({ ...lyon, cityKey: "paris" }, { ...country, zone: { kind: "city", cityKey: "lyon" } })).toBe(false)
  })
})
