import { describe, expect, it } from "bun:test"

import {
  canTransitionOffer,
  checkOfferVersion,
  cityKeyOf,
  clampServicePageSize,
  containsContactDetails,
  foldServiceText,
  initialOfferStatus,
  isKeptByBudget,
  isOfferEditable,
  isOfferPublic,
  isServiceCategory,
  isServiceDeliveryMode,
  isServiceLanguageCode,
  isServiceProviderOwnerKind,
  matchesDeliveryFilter,
  parseServiceCity,
  parseServiceCountry,
  parseServiceOffer,
  parseServicePricing,
  parseServiceQuery,
  parseServiceSearch,
  SERVICE_CATEGORIES,
  SERVICE_DELIVERY_MODES,
  SERVICE_DESCRIPTION_MAX_LENGTH,
  SERVICE_DURATION_MAX_MINUTES,
  SERVICE_DURATION_MIN_MINUTES,
  SERVICE_LANGUAGE_CODES,
  SERVICE_OFFER_STATUSES,
  SERVICE_PRICING_MODES,
  SERVICE_PROVIDER_OWNER_KINDS,
  SERVICE_QUERY_MAX_LENGTH,
  SERVICE_REFUSALS,
  SERVICE_SEARCH_PAGE_MAX,
  SERVICE_TITLE_MAX_LENGTH,
  serviceBudgetFit,
  serviceSearchTextOf,
  serviceSearchWords,
  transitionOffer,
  type ServiceOfferInput,
} from "./services"

/** Une offre fictive complète et valide : chaque test n'en change qu'un trait. */
const OFFER: ServiceOfferInput = {
  title: "  Tresses   et coiffure afro ",
  description: "Coiffure afro à domicile.\r\n\r\n\r\n\r\nNattes, tresses, entretien.  \nSur rendez-vous.",
  category: "beauty",
  country: " fr ",
  city: "  Saint-Étienne   du Rouvray ",
  delivery: "onsite",
  languages: ["FR", " en ", "fr"],
  durationMinutes: 90,
  pricing: { mode: "from", amountMinor: 6000, currency: "eur" },
}

describe("listes du catalogue (contrat des tables du moteur)", () => {
  it("gardent les membres posés par le coordinateur", () => {
    expect(SERVICE_CATEGORIES).toEqual(["beauty", "digital_creation", "photography", "translation", "settling_in"])
    expect(SERVICE_DELIVERY_MODES).toEqual(["onsite", "remote", "both"])
    expect(SERVICE_PRICING_MODES).toEqual(["fixed", "from", "quote"])
    expect(SERVICE_OFFER_STATUSES).toEqual(["draft", "active", "paused", "withdrawn"])
  })

  it("n'admettent comme fournisseurs que les entreprises et les associations", () => {
    expect(SERVICE_PROVIDER_OWNER_KINDS).toEqual(["company", "association"])
    expect(isServiceProviderOwnerKind("company")).toBe(true)
    expect(isServiceProviderOwnerKind("association")).toBe(true)
    expect(isServiceProviderOwnerKind("institution")).toBe(false)
    expect(isServiceProviderOwnerKind("media")).toBe(false)
    expect(isServiceProviderOwnerKind("community")).toBe(false)
  })

  it("reconnaissent leurs valeurs et rien d'autre", () => {
    expect(isServiceCategory("photography")).toBe(true)
    expect(isServiceCategory("health")).toBe(false)
    expect(isServiceDeliveryMode("both")).toBe(true)
    expect(isServiceDeliveryMode("everywhere")).toBe(false)
    expect(isServiceLanguageCode("fan")).toBe(true)
    expect(isServiceLanguageCode("FR")).toBe(false)
    expect(SERVICE_LANGUAGE_CODES).toContain("ln")
  })

  it("portent des codes de refus uniques et bien formés", () => {
    expect(new Set(SERVICE_REFUSALS).size).toBe(SERVICE_REFUSALS.length)
    for (const code of SERVICE_REFUSALS) expect(code).toMatch(/^service_[a-z0-9_]+$/)
  })
})

describe("texte des offres", () => {
  it("découpe en mots repliés le texte indexé d'une offre", () => {
    expect(serviceSearchWords("L'atelier — tresses & nattes (Paris 15e)")).toBe("l atelier tresses nattes paris 15e")
    expect(serviceSearchTextOf({ title: "Coiffure", description: "À domicile.", city: "Saint-Denis" })).toBe("coiffure a domicile saint denis")
  })

  it("replie accents, casse et espaces pour la recherche", () => {
    expect(foldServiceText("  Saint-Étienne   du ROUVRAY ")).toBe("saint-etienne du rouvray")
    expect(foldServiceText("Côte\td'Ivoire\n")).toBe("cote d'ivoire")
  })

  it("reconnaît une coordonnée : téléphone, e-mail, lien, domaine", () => {
    expect(containsContactDetails("Appelez le 06 12 34 56 78")).toBe(true)
    expect(containsContactDetails("WhatsApp +241 77 12 34 56")).toBe(true)
    expect(containsContactDetails("Écrivez à nom@example.com")).toBe(true)
    expect(containsContactDetails("Voir https://exemple.test/tarifs")).toBe(true)
    expect(containsContactDetails("Voir www.exemple.test")).toBe(true)
    expect(containsContactDetails("Mon site ma-coiffure.fr")).toBe(true)
  })

  it("laisse passer les prix, les années et les dates", () => {
    expect(containsContactDetails("À partir de 1 250 000 FCFA")).toBe(false)
    expect(containsContactDetails("Saison 2025-2026, ouvert le 12.10.2026")).toBe(false)
    expect(containsContactDetails("Paris 15e, sur rendez-vous.")).toBe(false)
  })
})

describe("zone de service", () => {
  it("exige un pays de résidence de la diaspora, jamais le Gabon", () => {
    expect(parseServiceCountry(" be ")).toEqual({ ok: true, value: "BE" })
    expect(parseServiceCountry("")).toEqual({ ok: false, code: "service_country_required" })
    expect(parseServiceCountry(null)).toEqual({ ok: false, code: "service_country_required" })
    expect(parseServiceCountry(undefined)).toEqual({ ok: false, code: "service_country_required" })
    expect(parseServiceCountry("XX")).toEqual({ ok: false, code: "service_country_unknown" })
    expect(parseServiceCountry("ga")).toEqual({ ok: false, code: "service_country_is_home" })
  })

  it("prend une ville saisie, sans GPS, et en tire sa clé", () => {
    expect(parseServiceCity("  Saint-Étienne\n du Rouvray ")).toEqual({ ok: true, value: { city: "Saint-Étienne du Rouvray", cityKey: "saint etienne du rouvray" } })
    expect(cityKeyOf("Saint-Étienne")).toBe(cityKeyOf(" saint etienne "))
    expect(cityKeyOf("L'Haÿ-les-Roses")).toBe("l hay les roses")
    expect(cityKeyOf("L’Haÿ-les-Roses")).toBe("l hay les roses")
    expect(parseServiceCity("   ")).toEqual({ ok: false, code: "service_city_required" })
    expect(parseServiceCity("x".repeat(81))).toEqual({ ok: false, code: "service_city_too_long" })
  })
})

describe("tarif annoncé", () => {
  it("sur devis : aucun montant", () => {
    expect(parseServicePricing({ mode: "quote", amountMinor: 100, currency: "EUR" })).toEqual({ ok: true, value: { mode: "quote" } })
  })

  it("fixe : un montant entier, zéro pour une prestation gratuite", () => {
    expect(parseServicePricing({ mode: "fixed", amountMinor: 0, currency: "xaf" })).toEqual({ ok: true, value: { mode: "fixed", amountMinor: 0, currency: "XAF" } })
    expect(parseServicePricing({ mode: "fixed", amountMinor: 4500, currency: "EUR" })).toEqual({ ok: true, value: { mode: "fixed", amountMinor: 4500, currency: "EUR" } })
  })

  it("« à partir de » : plus que zéro", () => {
    expect(parseServicePricing({ mode: "from", amountMinor: 6000, currency: "EUR" })).toEqual({ ok: true, value: { mode: "from", amountMinor: 6000, currency: "EUR" } })
    expect(parseServicePricing({ mode: "from", amountMinor: 0, currency: "EUR" })).toEqual({ ok: false, code: "service_price_from_zero" })
  })

  it("refuse un mode inconnu, une devise ou un montant manquants", () => {
    expect(parseServicePricing({ mode: "auction" })).toEqual({ ok: false, code: "service_pricing_invalid" })
    expect(parseServicePricing({ mode: "fixed" })).toEqual({ ok: false, code: "currency_invalid" })
    expect(parseServicePricing({ mode: "fixed", currency: "EUR" })).toEqual({ ok: false, code: "amount_invalid" })
    expect(parseServicePricing({ mode: "fixed", amountMinor: 10.5, currency: "EUR" })).toEqual({ ok: false, code: "amount_invalid" })
  })
})

describe("une offre", () => {
  it("normalise une saisie valide et calcule son texte de recherche", () => {
    expect(parseServiceOffer(OFFER)).toEqual({
      ok: true,
      value: {
        title: "Tresses et coiffure afro",
        description: "Coiffure afro à domicile.\n\nNattes, tresses, entretien.\nSur rendez-vous.",
        category: "beauty",
        country: "FR",
        city: "Saint-Étienne du Rouvray",
        cityKey: "saint etienne du rouvray",
        delivery: "onsite",
        languages: ["fr", "en"],
        durationMinutes: 90,
        pricing: { mode: "from", amountMinor: 6000, currency: "EUR" },
        searchText: "tresses et coiffure afro coiffure afro a domicile nattes tresses entretien sur rendez vous saint etienne du rouvray",
      },
    })
  })

  it("accepte une durée non annoncée", () => {
    const withoutDuration = parseServiceOffer({ ...OFFER, durationMinutes: null })
    expect(withoutDuration.ok && withoutDuration.value.durationMinutes).toBeNull()
    const { durationMinutes: _omitted, ...rest } = OFFER
    const omitted = parseServiceOffer(rest)
    expect(omitted.ok && omitted.value.durationMinutes).toBeNull()
  })

  it.each([
    [{ title: "Ab" }, "service_title_too_short"],
    [{ title: "x".repeat(SERVICE_TITLE_MAX_LENGTH + 1) }, "service_title_too_long"],
    [{ description: "Trop cour" }, "service_description_too_short"],
    [{ description: "x".repeat(SERVICE_DESCRIPTION_MAX_LENGTH + 1) }, "service_description_too_long"],
    [{ title: "Coiffure, appelez le 0612345678" }, "service_contact_details_forbidden"],
    [{ description: "Écrivez-moi à nom@example.com pour réserver." }, "service_contact_details_forbidden"],
    [{ city: "Paris www.exemple.test" }, "service_contact_details_forbidden"],
    [{ category: "health" }, "service_category_invalid"],
    [{ country: "" }, "service_country_required"],
    [{ country: "GA" }, "service_country_is_home"],
    [{ city: " " }, "service_city_required"],
    [{ delivery: "teleport" }, "service_delivery_invalid"],
    [{ languages: [] }, "service_languages_required"],
    [{ languages: ["fr", "en", "es", "pt", "de", "it"] }, "service_languages_too_many"],
    [{ languages: ["fr", "klingon"] }, "service_language_invalid"],
    [{ durationMinutes: SERVICE_DURATION_MIN_MINUTES - 1 }, "service_duration_invalid"],
    [{ durationMinutes: SERVICE_DURATION_MAX_MINUTES + 1 }, "service_duration_invalid"],
    [{ durationMinutes: 30.5 }, "service_duration_invalid"],
    [{ pricing: { mode: "free" } }, "service_pricing_invalid"],
    [{ pricing: { mode: "fixed", amountMinor: 100, currency: "BTC" } }, "currency_invalid"],
  ] as const)("refuse %o par un code fermé", (change, code) => {
    expect(parseServiceOffer({ ...OFFER, ...change })).toEqual({ ok: false, code })
  })
})

describe("états d'une offre", () => {
  it("brouillon, active et en pause se modifient ; retirée est terminale", () => {
    expect(isOfferEditable("draft")).toBe(true)
    expect(isOfferEditable("active")).toBe(true)
    expect(isOfferEditable("paused")).toBe(true)
    expect(isOfferEditable("withdrawn")).toBe(false)
  })

  it("seule une offre active est publique", () => {
    expect(SERVICE_OFFER_STATUSES.filter(isOfferPublic)).toEqual(["active"])
  })

  it("naît brouillon, ou active si elle est publiée tout de suite", () => {
    expect(initialOfferStatus(false)).toBe("draft")
    expect(initialOfferStatus(true)).toBe("active")
  })

  it("suit la machine : publier, mettre en pause, reprendre, retirer", () => {
    expect(canTransitionOffer("draft", "active")).toBe(true)
    expect(canTransitionOffer("draft", "paused")).toBe(false)
    expect(canTransitionOffer("active", "paused")).toBe(true)
    expect(canTransitionOffer("paused", "active")).toBe(true)
    expect(canTransitionOffer("paused", "withdrawn")).toBe(true)
    expect(canTransitionOffer("withdrawn", "active")).toBe(false)
    expect(transitionOffer("draft", "active")).toEqual({ ok: true, value: { status: "active", changed: true } })
    expect(transitionOffer("active", "paused")).toEqual({ ok: true, value: { status: "paused", changed: true } })
    expect(transitionOffer("paused", "withdrawn")).toEqual({ ok: true, value: { status: "withdrawn", changed: true } })
  })

  it("demander l'état courant ne change rien, même retirée", () => {
    expect(transitionOffer("paused", "paused")).toEqual({ ok: true, value: { status: "paused", changed: false } })
    expect(transitionOffer("withdrawn", "withdrawn")).toEqual({ ok: true, value: { status: "withdrawn", changed: false } })
  })

  it("refuse de rouvrir une offre retirée et de mettre un brouillon en pause", () => {
    expect(transitionOffer("withdrawn", "active")).toEqual({ ok: false, code: "service_offer_withdrawn" })
    expect(transitionOffer("draft", "paused")).toEqual({ ok: false, code: "service_offer_transition_invalid" })
  })

  it("compare la version lue à la version courante", () => {
    expect(checkOfferVersion(3, 3)).toEqual({ ok: true, value: 4 })
    expect(checkOfferVersion(4, 3)).toEqual({ ok: false, code: "service_offer_version_conflict" })
  })
})

describe("recherche", () => {
  it("replie la requête ; trop courte, elle ne cherche pas ; trop longue, refusée", () => {
    expect(parseServiceQuery("  Coiffure AFRO ")).toEqual({ ok: true, value: "coiffure afro" })
    expect(parseServiceQuery("d'évènements, à Lyon !")).toEqual({ ok: true, value: "d evenements a lyon" })
    expect(parseServiceQuery(" ?! ")).toEqual({ ok: true, value: null })
    expect(parseServiceQuery("a")).toEqual({ ok: true, value: null })
    expect(parseServiceQuery(undefined)).toEqual({ ok: true, value: null })
    expect(parseServiceQuery(null)).toEqual({ ok: true, value: null })
    expect(parseServiceQuery("x".repeat(SERVICE_QUERY_MAX_LENGTH + 1))).toEqual({ ok: false, code: "service_query_too_long" })
  })

  it("le mode « les deux » répond aux deux filtres", () => {
    expect(matchesDeliveryFilter("onsite", null)).toBe(true)
    expect(matchesDeliveryFilter("both", "remote")).toBe(true)
    expect(matchesDeliveryFilter("both", "onsite")).toBe(true)
    expect(matchesDeliveryFilter("remote", "remote")).toBe(true)
    expect(matchesDeliveryFilter("remote", "onsite")).toBe(false)
    expect(matchesDeliveryFilter("onsite", "remote")).toBe(false)
  })

  it("dit ce que le budget fait de chaque offre, sans rien écarter en silence", () => {
    const budget = { amountMinor: 5000, currency: "EUR" } as const
    expect(serviceBudgetFit({ mode: "fixed", amountMinor: 4000, currency: "EUR" }, budget)).toBe("within")
    expect(serviceBudgetFit({ mode: "from", amountMinor: 5000, currency: "EUR" }, budget)).toBe("within")
    expect(serviceBudgetFit({ mode: "from", amountMinor: 6000, currency: "EUR" }, budget)).toBe("above")
    expect(serviceBudgetFit({ mode: "quote" }, budget)).toBe("quote")
    expect(serviceBudgetFit({ mode: "fixed", amountMinor: 100, currency: "XAF" }, budget)).toBe("other_currency")
    expect(isKeptByBudget("within")).toBe(true)
    expect(isKeptByBudget("quote")).toBe(true)
    expect(isKeptByBudget("other_currency")).toBe(true)
    expect(isKeptByBudget("above")).toBe(false)
  })

  it("normalise les filtres ; une valeur vide vaut « sans filtre »", () => {
    expect(parseServiceSearch({})).toEqual({ ok: true, value: { query: null, country: null, cityKey: null, category: null, delivery: null, budget: null } })
    expect(parseServiceSearch({ query: " ", country: " ", city: "", category: "", delivery: "" })).toEqual({
      ok: true,
      value: { query: null, country: null, cityKey: null, category: null, delivery: null, budget: null },
    })
    expect(parseServiceSearch({ query: "Tresses", country: "fr", city: " PARIS ", category: "beauty", delivery: "onsite", budget: { amountMinor: 5000, currency: "eur" } })).toEqual({
      ok: true,
      value: { query: "tresses", country: "FR", cityKey: "paris", category: "beauty", delivery: "onsite", budget: { amountMinor: 5000, currency: "EUR" } },
    })
  })

  it.each([
    [{ query: "x".repeat(SERVICE_QUERY_MAX_LENGTH + 1) }, "service_query_too_long"],
    [{ country: "GA" }, "service_country_is_home"],
    [{ country: "ZZ" }, "service_country_unknown"],
    [{ city: "x".repeat(81) }, "service_city_too_long"],
    [{ category: "health" }, "service_category_invalid"],
    [{ delivery: "both" }, "service_delivery_filter_invalid"],
    [{ budget: { amountMinor: -1, currency: "EUR" } }, "amount_invalid"],
    [{ budget: { amountMinor: 1, currency: "BTC" } }, "currency_invalid"],
  ] as const)("refuse le filtre %o", (input, code) => {
    expect(parseServiceSearch(input)).toEqual({ ok: false, code })
  })

  it("borne la taille d'une page de résultats", () => {
    expect(clampServicePageSize(12)).toBe(12)
    expect(clampServicePageSize(12.9)).toBe(12)
    expect(clampServicePageSize(0)).toBe(1)
    expect(clampServicePageSize(-5)).toBe(1)
    expect(clampServicePageSize(500)).toBe(SERVICE_SEARCH_PAGE_MAX)
    expect(clampServicePageSize(Number.NaN)).toBe(SERVICE_SEARCH_PAGE_MAX)
    expect(clampServicePageSize(Number.POSITIVE_INFINITY)).toBe(SERVICE_SEARCH_PAGE_MAX)
  })
})
