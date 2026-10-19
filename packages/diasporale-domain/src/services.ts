/**
 * Catalogue des services DIASPORALE (DG-011/012) — règles pures des offres des
 * pages professionnelles : catégories, modes de prestation, tarifs annoncés,
 * zone de service, états d'une offre, recherche et budget. PROPRIÉTAIRE :
 * chantier « catalogue ».
 *
 * CONTRAT posé par le coordinateur (tables `serviceOffers` du moteur) : les
 * quatre listes ci-dessous peuvent s'allonger, jamais perdre un membre existant.
 * Mise en relation seulement : aucun encaissement, aucune commande. Un tarif est
 * ce que le professionnel ANNONCE ; la plateforme ne facture rien.
 *
 * Les mêmes règles servent l'écran (formulaire), le fournisseur de
 * démonstration et la tranche `convex/modules/diaspora/services.ts` du moteur :
 * une offre refusée ici l'est partout, avec le même code fermé.
 */
import type { PageOwnerKind } from "./badges"
import { HOME_COUNTRY, isCountryCode, normalizeCountryCode, type CountryCode } from "./countries"
import { parseMoney, type CurrencyCode, type Money, type MoneyRefusal } from "./money"
import { ok, refuse, type Result } from "./result"

/**
 * Catégories du pilote (plan global §G4) : coiffure et beauté NON médicale,
 * création numérique, photographie, traduction, aide à l'installation. Une
 * profession réglementée (santé, droit, finance) n'entre pas par une catégorie
 * générique : elle attendra sa politique propre.
 */
export const SERVICE_CATEGORIES = ["beauty", "digital_creation", "photography", "translation", "settling_in"] as const
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]

/** Où la prestation a lieu : chez le professionnel ou chez le client (présentiel), à distance, ou les deux. */
export const SERVICE_DELIVERY_MODES = ["onsite", "remote", "both"] as const
export type ServiceDeliveryMode = (typeof SERVICE_DELIVERY_MODES)[number]

/** Tarif annoncé : prix fixe, « à partir de », ou sur devis (aucun montant). */
export const SERVICE_PRICING_MODES = ["fixed", "from", "quote"] as const
export type ServicePricingMode = (typeof SERVICE_PRICING_MODES)[number]

/** États d'une offre : brouillon, active (visible et contactable), en pause, retirée. */
export const SERVICE_OFFER_STATUSES = ["draft", "active", "paused", "withdrawn"] as const
export type ServiceOfferStatus = (typeof SERVICE_OFFER_STATUSES)[number]

// ═══════════════════════════════════════════════════════════════
// Qui propose, et dans quelles bornes
// ═══════════════════════════════════════════════════════════════

/**
 * Les pages qui peuvent proposer des services : une entreprise ou une
 * association. Une institution (poste consulaire), un média ou une page de
 * communauté ne vend ni ne prête de prestation par ce catalogue.
 */
export const SERVICE_PROVIDER_OWNER_KINDS = ["company", "association"] as const satisfies readonly PageOwnerKind[]
export type ServiceProviderOwnerKind = (typeof SERVICE_PROVIDER_OWNER_KINDS)[number]

export function isServiceProviderOwnerKind(kind: string): kind is ServiceProviderOwnerKind {
  return (SERVICE_PROVIDER_OWNER_KINDS as readonly string[]).includes(kind)
}

export const SERVICE_TITLE_MIN_LENGTH = 3
export const SERVICE_TITLE_MAX_LENGTH = 100
export const SERVICE_DESCRIPTION_MIN_LENGTH = 10
export const SERVICE_DESCRIPTION_MAX_LENGTH = 2000
/** Même borne que la ville d'une facette : un nom de ville, pas une adresse. */
export const SERVICE_CITY_MAX_LENGTH = 80
export const SERVICE_LANGUAGES_MAX = 5
/** Durée indicative, en minutes entières : de cinq minutes à une journée. */
export const SERVICE_DURATION_MIN_MINUTES = 5
export const SERVICE_DURATION_MAX_MINUTES = 1440
/** Offres non retirées par page : une vitrine lisible, et une lecture bornée côté moteur. */
export const SERVICE_OFFERS_PER_PAGE_MAX = 30

/**
 * Langues de prestation proposées (sous-étiquettes BCP 47) : celles de la
 * diaspora et des pays d'accueil, plus le lingala et le fang. Le nom affiché
 * se calcule par `Intl.DisplayNames` dans la langue de l'écran.
 */
export const SERVICE_LANGUAGE_CODES = ["fr", "en", "es", "pt", "de", "it", "nl", "ar", "zh", "ln", "fan"] as const
export type ServiceLanguageCode = (typeof SERVICE_LANGUAGE_CODES)[number]

export function isServiceLanguageCode(value: string): value is ServiceLanguageCode {
  return (SERVICE_LANGUAGE_CODES as readonly string[]).includes(value)
}

export function isServiceCategory(value: string): value is ServiceCategory {
  return (SERVICE_CATEGORIES as readonly string[]).includes(value)
}

export function isServiceDeliveryMode(value: string): value is ServiceDeliveryMode {
  return (SERVICE_DELIVERY_MODES as readonly string[]).includes(value)
}

// ═══════════════════════════════════════════════════════════════
// Refus — codes FERMÉS, traduits par l'écran (`errors.<code>`)
// ═══════════════════════════════════════════════════════════════

/** Refus des règles du catalogue ; les montants ajoutent `MONEY_REFUSALS` (`money.ts`). */
export const SERVICE_REFUSALS = [
  "service_title_too_short",
  "service_title_too_long",
  "service_description_too_short",
  "service_description_too_long",
  /** Téléphone, adresse e-mail ou lien dans le texte : le contact passe par la demande sur DIASPORALE. */
  "service_contact_details_forbidden",
  "service_category_invalid",
  "service_country_required",
  "service_country_unknown",
  "service_country_is_home",
  "service_city_required",
  "service_city_too_long",
  "service_delivery_invalid",
  "service_languages_required",
  "service_languages_too_many",
  "service_language_invalid",
  "service_duration_invalid",
  "service_pricing_invalid",
  /** « À partir de 0 » ne dit rien : une prestation gratuite est un prix fixe de zéro. */
  "service_price_from_zero",
  "service_query_too_long",
  "service_delivery_filter_invalid",
  /** Une offre retirée est terminale : ni modifiée, ni remise en ligne. */
  "service_offer_withdrawn",
  "service_offer_transition_invalid",
  /** L'offre a changé depuis sa lecture (version attendue périmée). */
  "service_offer_version_conflict",
  "service_offer_limit_reached",
  /** La page n'est ni une entreprise ni une association. */
  "service_page_kind_not_allowed",
] as const
export type ServiceRefusal = (typeof SERVICE_REFUSALS)[number]

export type ServiceOfferRefusal = ServiceRefusal | MoneyRefusal

// ═══════════════════════════════════════════════════════════════
// Texte : repli de recherche, lignes, coordonnées
// ═══════════════════════════════════════════════════════════════

/**
 * Repli de RECHERCHE : sans accents, en minuscules, espaces resserrées —
 * « Saint-Étienne » et « saint etienne » se rencontrent. Même repli que la
 * recherche du moteur (`foldSearchQuery`), pour qu'une saisie trouve des deux côtés.
 */
export function foldServiceText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim()
}

/**
 * Les MOTS d'un texte de recherche : repliés, toute ponctuation comptée pour une
 * espace — « d'évènements » donne « d evenements », que « évènements » trouve.
 * Sert le texte indexé d'une offre ET la requête : les deux côtés se découpent pareil.
 */
export function serviceSearchWords(value: string): string {
  return foldServiceText(value.replace(/[^\p{L}\p{N}\p{M}]+/gu, " "))
}

/** Le texte indexé d'une offre : son titre, sa description et sa ville, en mots repliés. */
export function serviceSearchTextOf(parts: { readonly title: string; readonly description: string; readonly city: string }): string {
  return serviceSearchWords(`${parts.title} ${parts.description} ${parts.city}`)
}

/**
 * La CLÉ d'une ville saisie : repliée, tirets et apostrophes comptés pour des
 * espaces — « Saint-Étienne », « saint etienne » et « SAINT ETIENNE » sont la
 * même ville ; « L'Haÿ-les-Roses » se trouve en tapant « l hay les roses ».
 */
export function cityKeyOf(city: string): string {
  return foldServiceText(city.replace(/[-'’‐‑]/g, " "))
}

/** Une ligne : espaces et retours resserrés en une espace. */
function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

/** Un texte long : fins de ligne unifiées, deux lignes vides au plus, bords nets. */
function paragraphs(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i
const LINK = /\b(?:https?:\/\/|www\.)\S+/i
/** Domaines sans ambiguïté seulement : « ma-coiffure.fr », pas une phrase où manque une espace. */
const DOMAIN = /\b[a-z0-9-]{2,}\.(?:com|fr|net|org|io|be|ca|ga|ch|info|biz)\b/i
/**
 * Neuf chiffres au moins, séparés ou non : un numéro de téléphone. Une année
 * (« 2025-2026 ») ou une date (« 12.10.2026 ») n'en compte que huit.
 */
const PHONE = /\+?\d(?:[\s().-]*\d){8,}/

/**
 * Le texte porte-t-il une coordonnée (téléphone, e-mail, lien) ? Invariant 6
 * du cahier : aucune coordonnée exposée, le contact passe par la demande
 * structurée puis par la messagerie.
 */
export function containsContactDetails(text: string): boolean {
  return EMAIL.test(text) || LINK.test(text) || DOMAIN.test(text) || PHONE.test(text)
}

// ═══════════════════════════════════════════════════════════════
// Une offre : saisie → brouillon validé
// ═══════════════════════════════════════════════════════════════

/** Tarif d'une offre, tel que la table du moteur le porte (devise ISO 4217 déjà vérifiée). */
export type ServicePricing =
  | { readonly mode: "fixed" | "from"; readonly amountMinor: number; readonly currency: CurrencyCode }
  | { readonly mode: "quote" }

/** Un tarif relu d'une table ou d'une projection : la devise n'y est qu'une chaîne. */
export type ServicePricingLike =
  | { readonly mode: "fixed" | "from"; readonly amountMinor: number; readonly currency: string }
  | { readonly mode: "quote" }

/** Le tarif saisi (formulaire, arguments d'une mutation) : rien n'y est encore garanti. */
export interface ServicePricingInput {
  readonly mode: string
  readonly amountMinor?: number | undefined
  readonly currency?: string | undefined
}

export interface ServiceOfferInput {
  readonly title: string
  readonly description: string
  readonly category: string
  readonly country: string
  readonly city: string
  readonly delivery: string
  readonly languages: readonly string[]
  /** Facultative : `null` ou absente, la durée n'est pas annoncée. */
  readonly durationMinutes?: number | null | undefined
  readonly pricing: ServicePricingInput
}

/** Une offre VALIDÉE, normalisée, prête à être écrite (moteur) ou gardée (démonstration). */
export interface ServiceOfferDraft {
  readonly title: string
  readonly description: string
  readonly category: ServiceCategory
  readonly country: CountryCode
  readonly city: string
  /** La ville repliée : clé d'index de la recherche par ville (saisie libre, sans GPS). */
  readonly cityKey: string
  readonly delivery: ServiceDeliveryMode
  readonly languages: readonly ServiceLanguageCode[]
  readonly durationMinutes: number | null
  readonly pricing: ServicePricing
  /** Titre, description et ville repliés : le texte de la recherche, jamais une coordonnée. */
  readonly searchText: string
}

/** Le pays de la zone de service : un pays de résidence de la diaspora, jamais le Gabon. */
export function parseServiceCountry(raw: string | null | undefined): Result<CountryCode, ServiceRefusal> {
  const code = normalizeCountryCode(raw ?? "")
  if (code.length === 0) return refuse("service_country_required")
  if (!isCountryCode(code)) return refuse("service_country_unknown")
  if (code === HOME_COUNTRY) return refuse("service_country_is_home")
  return ok(code)
}

/** La ville saisie : une ligne non vide, bornée ; et sa clé repliée. */
export function parseServiceCity(raw: string): Result<{ readonly city: string; readonly cityKey: string }, ServiceRefusal> {
  const city = singleLine(raw)
  if (city.length === 0) return refuse("service_city_required")
  if (city.length > SERVICE_CITY_MAX_LENGTH) return refuse("service_city_too_long")
  return ok({ city, cityKey: cityKeyOf(city) })
}

function parseLanguages(raw: readonly string[]): Result<readonly ServiceLanguageCode[], ServiceRefusal> {
  const languages: ServiceLanguageCode[] = []
  for (const value of raw) {
    const code = value.trim().toLowerCase()
    if (!isServiceLanguageCode(code)) return refuse("service_language_invalid")
    if (!languages.includes(code)) languages.push(code)
  }
  if (languages.length === 0) return refuse("service_languages_required")
  if (languages.length > SERVICE_LANGUAGES_MAX) return refuse("service_languages_too_many")
  return ok(languages)
}

function parseDuration(raw: number | null | undefined): Result<number | null, ServiceRefusal> {
  if (raw === null || raw === undefined) return ok(null)
  if (!Number.isInteger(raw) || raw < SERVICE_DURATION_MIN_MINUTES || raw > SERVICE_DURATION_MAX_MINUTES) return refuse("service_duration_invalid")
  return ok(raw)
}

/** Le tarif annoncé : sur devis sans montant ; fixe (zéro = gratuit) ou « à partir de » (plus que zéro). */
export function parseServicePricing(input: ServicePricingInput): Result<ServicePricing, ServiceOfferRefusal> {
  if (input.mode === "quote") return ok({ mode: "quote" })
  if (input.mode !== "fixed" && input.mode !== "from") return refuse("service_pricing_invalid")
  const money = parseMoney({ amountMinor: input.amountMinor ?? Number.NaN, currency: input.currency ?? "" })
  if (!money.ok) return money
  if (input.mode === "from" && money.value.amountMinor === 0) return refuse("service_price_from_zero")
  return ok({ mode: input.mode, amountMinor: money.value.amountMinor, currency: money.value.currency })
}

/**
 * LA règle d'une offre. Ordre des contrôles (le premier refus est rendu) :
 * titre, description, coordonnées, catégorie, pays, ville, mode, langues,
 * durée, tarif.
 */
export function parseServiceOffer(input: ServiceOfferInput): Result<ServiceOfferDraft, ServiceOfferRefusal> {
  const title = singleLine(input.title)
  if (title.length < SERVICE_TITLE_MIN_LENGTH) return refuse("service_title_too_short")
  if (title.length > SERVICE_TITLE_MAX_LENGTH) return refuse("service_title_too_long")
  const description = paragraphs(input.description)
  if (description.length < SERVICE_DESCRIPTION_MIN_LENGTH) return refuse("service_description_too_short")
  if (description.length > SERVICE_DESCRIPTION_MAX_LENGTH) return refuse("service_description_too_long")
  if (containsContactDetails(title) || containsContactDetails(description)) return refuse("service_contact_details_forbidden")
  if (!isServiceCategory(input.category)) return refuse("service_category_invalid")
  const country = parseServiceCountry(input.country)
  if (!country.ok) return country
  const city = parseServiceCity(input.city)
  if (!city.ok) return city
  if (containsContactDetails(city.value.city)) return refuse("service_contact_details_forbidden")
  if (!isServiceDeliveryMode(input.delivery)) return refuse("service_delivery_invalid")
  const languages = parseLanguages(input.languages)
  if (!languages.ok) return languages
  const durationMinutes = parseDuration(input.durationMinutes)
  if (!durationMinutes.ok) return durationMinutes
  const pricing = parseServicePricing(input.pricing)
  if (!pricing.ok) return pricing
  return ok({
    title,
    description,
    category: input.category,
    country: country.value,
    city: city.value.city,
    cityKey: city.value.cityKey,
    delivery: input.delivery,
    languages: languages.value,
    durationMinutes: durationMinutes.value,
    pricing: pricing.value,
    searchText: serviceSearchTextOf({ title, description, city: city.value.city }),
  })
}

// ═══════════════════════════════════════════════════════════════
// États d'une offre
// ═══════════════════════════════════════════════════════════════

/** Les états que l'on demande (on ne revient jamais au brouillon). */
export const SERVICE_OFFER_STATUS_TARGETS = ["active", "paused", "withdrawn"] as const
export type ServiceOfferStatusTarget = (typeof SERVICE_OFFER_STATUS_TARGETS)[number]

/**
 * Brouillon → active (publier) ou retirée ; active ↔ en pause ; tout état
 * vivant → retirée ; retirée est TERMINALE (un lien conservé ne la rouvre jamais).
 */
const OFFER_TRANSITIONS: Readonly<Record<ServiceOfferStatus, readonly ServiceOfferStatus[]>> = Object.freeze({
  draft: ["active", "withdrawn"],
  active: ["paused", "withdrawn"],
  paused: ["active", "withdrawn"],
  withdrawn: [],
})

export function canTransitionOffer(from: ServiceOfferStatus, to: ServiceOfferStatus): boolean {
  return OFFER_TRANSITIONS[from].includes(to)
}

/**
 * Changer l'état d'une offre. Demander l'état courant n'est pas une erreur
 * (double clic, deux gestionnaires) : rien ne change, `changed` le dit.
 */
export function transitionOffer(
  from: ServiceOfferStatus,
  to: ServiceOfferStatusTarget,
): Result<{ readonly status: ServiceOfferStatus; readonly changed: boolean }, ServiceRefusal> {
  if (from === to) return ok({ status: from, changed: false })
  if (from === "withdrawn") return refuse("service_offer_withdrawn")
  if (!canTransitionOffer(from, to)) return refuse("service_offer_transition_invalid")
  return ok({ status: to, changed: true })
}

/** Une offre se modifie tant qu'elle n'est pas retirée. */
export function isOfferEditable(status: ServiceOfferStatus): boolean {
  return status !== "withdrawn"
}

/** Seule une offre ACTIVE se lit dans le catalogue et se demande. */
export function isOfferPublic(status: ServiceOfferStatus): boolean {
  return status === "active"
}

/** Une offre naît brouillon, ou active si le professionnel la publie aussitôt. */
export function initialOfferStatus(publish: boolean): ServiceOfferStatus {
  return publish ? "active" : "draft"
}

/**
 * Concurrence optimiste : la modification cite la version lue. Une version
 * différente de la version courante est un conflit ; sinon, la version suivante.
 */
export function checkOfferVersion(current: number, expected: number): Result<number, ServiceRefusal> {
  if (expected !== current) return refuse("service_offer_version_conflict")
  return ok(current + 1)
}

// ═══════════════════════════════════════════════════════════════
// Recherche : requête, filtres, budget
// ═══════════════════════════════════════════════════════════════

/** En deçà, une saisie ne cherche pas (le catalogue retombe sur ses filtres) ; au-delà, refusée. */
export const SERVICE_QUERY_MIN_LENGTH = 2
export const SERVICE_QUERY_MAX_LENGTH = 100
/** Taille d'une page de résultats, plafond dur du moteur. */
export const SERVICE_SEARCH_PAGE_MAX = 20

export const SERVICE_DELIVERY_FILTERS = ["onsite", "remote"] as const
export type ServiceDeliveryFilter = (typeof SERVICE_DELIVERY_FILTERS)[number]

/** Une offre « les deux » répond aux deux filtres ; sans filtre, toutes répondent. */
export function matchesDeliveryFilter(delivery: ServiceDeliveryMode, filter: ServiceDeliveryFilter | null): boolean {
  return filter === null || delivery === "both" || delivery === filter
}

/**
 * Ce que le budget demandé dit d'une offre :
 *   · `within` — le prix annoncé (fixe, ou « à partir de ») tient dans le budget ;
 *   · `above` — il le dépasse : l'offre est ÉCARTÉE ;
 *   · `quote` — sur devis, aucun prix à comparer : l'offre RESTE, signalée ;
 *   · `other_currency` — autre devise, aucune conversion : l'offre RESTE, signalée.
 * Aucune offre n'est incluse ni exclue en silence : l'écran dit la règle.
 */
export const SERVICE_BUDGET_FITS = ["within", "above", "quote", "other_currency"] as const
export type ServiceBudgetFit = (typeof SERVICE_BUDGET_FITS)[number]

export function serviceBudgetFit(pricing: ServicePricingLike, budget: Money): ServiceBudgetFit {
  if (pricing.mode === "quote") return "quote"
  if (pricing.currency !== budget.currency) return "other_currency"
  return pricing.amountMinor <= budget.amountMinor ? "within" : "above"
}

/** Seule une offre au-dessus du budget quitte les résultats. */
export function isKeptByBudget(fit: ServiceBudgetFit): boolean {
  return fit !== "above"
}

/** La requête en mots repliés, ou `null` si elle est trop courte pour chercher. */
export function parseServiceQuery(raw: string | null | undefined): Result<string | null, ServiceRefusal> {
  const query = serviceSearchWords(raw ?? "")
  if (query.length > SERVICE_QUERY_MAX_LENGTH) return refuse("service_query_too_long")
  return ok(query.length >= SERVICE_QUERY_MIN_LENGTH ? query : null)
}

export interface ServiceSearchInput {
  readonly query?: string | undefined
  readonly country?: string | undefined
  readonly city?: string | undefined
  readonly category?: string | undefined
  readonly delivery?: string | undefined
  /** Budget maximal : un montant en unités mineures et sa devise, ensemble ou pas du tout. */
  readonly budget?: { readonly amountMinor: number; readonly currency: string } | undefined
}

/** Les filtres d'une recherche, normalisés ; `null` : filtre absent. */
export interface ServiceSearchFilters {
  readonly query: string | null
  readonly country: CountryCode | null
  readonly cityKey: string | null
  readonly category: ServiceCategory | null
  readonly delivery: ServiceDeliveryFilter | null
  readonly budget: Money | null
}

function isDeliveryFilter(value: string): value is ServiceDeliveryFilter {
  return (SERVICE_DELIVERY_FILTERS as readonly string[]).includes(value)
}

/**
 * Les filtres d'une recherche : chaque filtre RESTREINT, aucun n'ouvre rien
 * (les offres actives du réseau restent la seule source). Une valeur vide vaut
 * « sans ce filtre ».
 */
export function parseServiceSearch(input: ServiceSearchInput): Result<ServiceSearchFilters, ServiceOfferRefusal> {
  const query = parseServiceQuery(input.query)
  if (!query.ok) return query
  let country: CountryCode | null = null
  if (input.country !== undefined && input.country.trim().length > 0) {
    const parsed = parseServiceCountry(input.country)
    if (!parsed.ok) return parsed
    country = parsed.value
  }
  let cityKey: string | null = null
  if (input.city !== undefined && input.city.trim().length > 0) {
    const parsed = parseServiceCity(input.city)
    if (!parsed.ok) return parsed
    cityKey = parsed.value.cityKey
  }
  let category: ServiceCategory | null = null
  if (input.category !== undefined && input.category.length > 0) {
    if (!isServiceCategory(input.category)) return refuse("service_category_invalid")
    category = input.category
  }
  let delivery: ServiceDeliveryFilter | null = null
  if (input.delivery !== undefined && input.delivery.length > 0) {
    if (!isDeliveryFilter(input.delivery)) return refuse("service_delivery_filter_invalid")
    delivery = input.delivery
  }
  let budget: Money | null = null
  if (input.budget !== undefined) {
    const parsed = parseMoney(input.budget)
    if (!parsed.ok) return parsed
    budget = parsed.value
  }
  return ok({ query: query.value, country, cityKey, category, delivery, budget })
}

/** Taille de page demandée, bornée : jamais plus que le plafond, jamais moins d'une offre. */
export function clampServicePageSize(requested: number): number {
  if (!Number.isFinite(requested)) return SERVICE_SEARCH_PAGE_MAX
  return Math.min(SERVICE_SEARCH_PAGE_MAX, Math.max(1, Math.trunc(requested)))
}
