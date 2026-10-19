/**
 * Talents et emploi DIASPORALE (DG-025, plan global §G8 point 4) — règles pures
 * des offres d'emploi publiées par les PAGES, des candidatures PRIVÉES et des
 * profils de talent OPT-IN. PROPRIÉTAIRE : chantier « talents et emploi ».
 *
 * Les mêmes règles servent l'écran (formulaires), le fournisseur de
 * démonstration et la tranche `convex/modules/diaspora/jobs.ts` du moteur : une
 * saisie refusée ici l'est partout, avec le même code fermé.
 *
 * Invariants portés par ces règles :
 *   · aucune coordonnée (téléphone, e-mail, lien, adresse exacte) dans un texte :
 *     le contact passe par DIASPORALE, jamais par un numéro affiché ;
 *   · aucun critère discriminant : ni âge, ni sexe, ni origine, ni situation
 *     familiale, ni photo — ces champs n'existent tout simplement pas ;
 *   · une offre appartient à une page d'entreprise ou d'association ;
 *   · candidater exige le consentement explicite à transmettre son nom publié ;
 *     le profil de talent n'est joint que si la personne le choisit ;
 *   · un profil de talent est un opt-in révocable ; ses compétences sont
 *     DÉCLARÉES : une attestation consulaire ne dit rien d'une compétence.
 */
import type { PageOwnerKind } from "./badges"
import { HOME_COUNTRY, isCountryCode, normalizeCountryCode, type CountryCode } from "./countries"
import { parseMoney, type CurrencyCode, type MoneyRefusal } from "./money"
import { ok, refuse, type Result } from "./result"
import { normalizeServiceText, serviceTextRefusal } from "./service-requests"
import { cityKeyOf, containsContactDetails, foldServiceText, SERVICE_LANGUAGE_CODES, serviceSearchWords, type ServiceLanguageCode } from "./services"
import { DAY_MS } from "./time"

// ═══════════════════════════════════════════════════════════════
// Listes fermées
// ═══════════════════════════════════════════════════════════════

/**
 * Contrats proposés : la liste des cartes d'emploi de l'interface
 * (`JOB_CONTRACTS` des surfaces), dans le même ordre — un test le vérifie.
 */
export const JOB_OFFER_CONTRACTS = ["cdi", "cdd", "internship", "part_time", "freelance"] as const
export type JobOfferContract = (typeof JOB_OFFER_CONTRACTS)[number]

/** Où le travail se fait : sur site, à distance, ou un peu des deux. */
export const JOB_WORK_MODES = ["onsite", "remote", "hybrid"] as const
export type JobWorkMode = (typeof JOB_WORK_MODES)[number]

/** La période d'une fourchette de rémunération annoncée. */
export const JOB_PAY_PERIODS = ["hour", "day", "month", "year"] as const
export type JobPayPeriod = (typeof JOB_PAY_PERIODS)[number]

/**
 * États d'une offre : brouillon → ouverte ↔ suspendue → close. Close est
 * TERMINALE ; une date limite atteinte vaut clôture (état effectif).
 */
export const JOB_OFFER_STATUSES = ["draft", "open", "suspended", "closed"] as const
export type JobOfferStatus = (typeof JOB_OFFER_STATUSES)[number]

/** Les états que l'on demande (on ne revient jamais au brouillon). */
export const JOB_OFFER_STATUS_TARGETS = ["open", "suspended", "closed"] as const
export type JobOfferStatusTarget = (typeof JOB_OFFER_STATUS_TARGETS)[number]

/** Les pages qui publient des offres : une entreprise ou une association, jamais une institution. */
export const JOB_EMPLOYER_OWNER_KINDS = ["company", "association"] as const satisfies readonly PageOwnerKind[]
export type JobEmployerOwnerKind = (typeof JOB_EMPLOYER_OWNER_KINDS)[number]

/** Langues de travail : celles des prestations du catalogue (sous-étiquettes BCP 47). */
export const JOB_LANGUAGE_CODES = SERVICE_LANGUAGE_CODES
export type JobLanguageCode = ServiceLanguageCode

/**
 * États d'une candidature : envoyée → vue → présélectionnée | non retenue ;
 * retirée par la personne qui candidate. Non retenue et retirée sont terminales.
 */
export const JOB_APPLICATION_STATUSES = ["sent", "seen", "shortlisted", "not_selected", "withdrawn"] as const
export type JobApplicationStatus = (typeof JOB_APPLICATION_STATUSES)[number]

/** Les gestes sur une candidature : trois de l'équipe de la page, un de la personne qui candidate. */
export const JOB_APPLICATION_ACTIONS = ["mark_seen", "shortlist", "not_select", "withdraw"] as const
export type JobApplicationAction = (typeof JOB_APPLICATION_ACTIONS)[number]

export const JOB_APPLICATION_ACTORS = ["candidate", "page"] as const
export type JobApplicationActor = (typeof JOB_APPLICATION_ACTORS)[number]

/** Disponibilité déclarée d'un talent. */
export const TALENT_AVAILABILITIES = ["immediate", "one_month", "three_months", "open_to_offers"] as const
export type TalentAvailability = (typeof TALENT_AVAILABILITIES)[number]

/** Visible dans la recherche des talents du réseau, ou masqué de la recherche (joint seulement à mes candidatures). */
export const TALENT_VISIBILITIES = ["network", "unlisted"] as const
export type TalentVisibility = (typeof TALENT_VISIBILITIES)[number]

/** Actif, ou masqué par la personne : un profil masqué n'apparaît nulle part. */
export const TALENT_PROFILE_STATUSES = ["active", "hidden"] as const
export type TalentProfileStatus = (typeof TALENT_PROFILE_STATUSES)[number]

// ═══════════════════════════════════════════════════════════════
// Bornes
// ═══════════════════════════════════════════════════════════════

export const JOB_TITLE_MIN_LENGTH = 3
export const JOB_TITLE_MAX_LENGTH = 120
export const JOB_DESCRIPTION_MIN_LENGTH = 30
export const JOB_DESCRIPTION_MAX_LENGTH = 4000
/** Même borne que la ville d'une offre de service : un nom de ville, pas une adresse. */
export const JOB_CITY_MAX_LENGTH = 80
export const JOB_LANGUAGES_MAX = 5
/** Une date limite tient dans les six mois qui viennent. */
export const JOB_DEADLINE_HORIZON_DAYS = 180
/** Offres non closes par page : une lecture bornée côté moteur. */
export const JOB_OFFERS_PER_PAGE_MAX = 30
/** Taille d'une page de résultats, plafond dur du moteur. */
export const JOB_SEARCH_PAGE_MAX = 20
export const JOB_QUERY_MIN_LENGTH = 2
export const JOB_QUERY_MAX_LENGTH = 100
export const JOB_APPLICATION_MESSAGE_MIN_LENGTH = 20
export const JOB_APPLICATION_MESSAGE_MAX_LENGTH = 3000
/** Motif de non-sélection : une note de l'équipe, jamais montrée à la personne qui candidate. */
export const JOB_DECISION_REASON_MAX_LENGTH = 500
/** Candidatures lues au plus par page de liste (côté page comme côté candidat). */
export const JOB_APPLICATIONS_PAGE_MAX = 50
export const TALENT_TITLE_MIN_LENGTH = 3
export const TALENT_TITLE_MAX_LENGTH = 100
export const TALENT_SKILLS_MIN = 1
export const TALENT_SKILLS_MAX = 15
export const TALENT_SKILL_MIN_LENGTH = 2
export const TALENT_SKILL_MAX_LENGTH = 40
/** Plafond STRICT d'une page de talents : on affine la recherche, on ne parcourt pas l'annuaire. */
export const TALENT_SEARCH_PAGE_MAX = 12

// ═══════════════════════════════════════════════════════════════
// Refus — codes FERMÉS, traduits par l'écran (`errors.<code>`)
// ═══════════════════════════════════════════════════════════════

/** Refus du chantier ; les montants ajoutent `MONEY_REFUSALS` (`money.ts`). */
export const JOB_REFUSALS = [
  "job_title_too_short",
  "job_title_too_long",
  "job_description_too_short",
  "job_description_too_long",
  /** Téléphone, e-mail, lien ou adresse exacte dans un texte : le contact passe par DIASPORALE. */
  "job_contact_details_forbidden",
  "job_contract_invalid",
  "job_country_required",
  "job_country_unknown",
  "job_country_is_home",
  "job_city_too_long",
  "job_work_mode_invalid",
  "job_languages_required",
  "job_languages_too_many",
  "job_language_invalid",
  "job_pay_period_invalid",
  /** Fourchette illisible : maximum nul ou inférieur au minimum. */
  "job_pay_range_invalid",
  /** Date limite passée, ou au-delà de l'horizon. */
  "job_deadline_invalid",
  "job_query_too_long",
  /** Une offre close est terminale : ni modifiée, ni rouverte. */
  "job_offer_closed",
  "job_offer_transition_invalid",
  /** L'offre a changé depuis sa lecture (version attendue périmée). */
  "job_offer_version_conflict",
  "job_offer_limit_reached",
  /** La page n'est ni une entreprise ni une association. */
  "job_page_kind_not_allowed",
  /** La candidature cite une version de l'offre qui n'est plus la courante : relire l'offre. */
  "job_offer_changed",
  "job_application_message_too_short",
  "job_application_message_too_long",
  "job_application_consent_required",
  /** On ne candidate pas aux offres d'une page dont on est signataire. */
  "job_application_own_page",
  /** Une candidature par personne et par offre. */
  "job_application_already_exists",
  /** Même clé d'envoi, autre contenu. */
  "job_application_idempotency_conflict",
  "job_application_transition_invalid",
  "job_decision_reason_too_long",
  /** Joindre un profil de talent absent ou masqué. */
  "job_talent_profile_unavailable",
  "talent_title_too_short",
  "talent_title_too_long",
  "talent_skills_required",
  "talent_skills_too_many",
  "talent_skill_invalid",
  "talent_availability_invalid",
  "talent_visibility_invalid",
  "talent_profile_version_conflict",
] as const
export type JobRefusal = (typeof JOB_REFUSALS)[number]

export type JobOfferRefusal = JobRefusal | MoneyRefusal

// ═══════════════════════════════════════════════════════════════
// Gardiens de type
// ═══════════════════════════════════════════════════════════════

export function isJobOfferContract(value: string): value is JobOfferContract {
  return (JOB_OFFER_CONTRACTS as readonly string[]).includes(value)
}

export function isJobWorkMode(value: string): value is JobWorkMode {
  return (JOB_WORK_MODES as readonly string[]).includes(value)
}

export function isJobPayPeriod(value: string): value is JobPayPeriod {
  return (JOB_PAY_PERIODS as readonly string[]).includes(value)
}

export function isJobLanguageCode(value: string): value is JobLanguageCode {
  return (JOB_LANGUAGE_CODES as readonly string[]).includes(value)
}

export function isJobEmployerOwnerKind(kind: string): kind is JobEmployerOwnerKind {
  return (JOB_EMPLOYER_OWNER_KINDS as readonly string[]).includes(kind)
}

export function isJobOfferStatus(value: string): value is JobOfferStatus {
  return (JOB_OFFER_STATUSES as readonly string[]).includes(value)
}

export function isJobApplicationStatus(value: string): value is JobApplicationStatus {
  return (JOB_APPLICATION_STATUSES as readonly string[]).includes(value)
}

export function isTalentAvailability(value: string): value is TalentAvailability {
  return (TALENT_AVAILABILITIES as readonly string[]).includes(value)
}

export function isTalentVisibility(value: string): value is TalentVisibility {
  return (TALENT_VISIBILITIES as readonly string[]).includes(value)
}

// ═══════════════════════════════════════════════════════════════
// Textes : une ligne, des paragraphes, aucune coordonnée
// ═══════════════════════════════════════════════════════════════

/** Une ligne : forme NFC, espaces et retours resserrés en une espace. */
function oneLine(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim()
}

/**
 * Le texte porte-t-il une coordonnée ou une adresse exacte ? Les deux détections
 * du catalogue et des demandes, réunies : téléphone, e-mail, lien, domaine,
 * « 12 rue … ». Elles protègent d'un oubli ; elles ne prétendent pas tout voir.
 */
export function jobTextHasContact(text: string): boolean {
  return containsContactDetails(text) || serviceTextRefusal(text) !== null
}

// ═══════════════════════════════════════════════════════════════
// Une offre : saisie → brouillon validé
// ═══════════════════════════════════════════════════════════════

/** Fourchette de rémunération ANNONCÉE : entiers en unités mineures, devise ISO 4217, période. */
export interface JobPayRange {
  readonly minMinor: number
  readonly maxMinor: number
  readonly currency: CurrencyCode
  readonly period: JobPayPeriod
}

/** Une fourchette relue d'une table ou d'une projection : la devise n'y est qu'une chaîne. */
export interface JobPayRangeLike {
  readonly minMinor: number
  readonly maxMinor: number
  readonly currency: string
  readonly period: JobPayPeriod
}

/** La fourchette saisie : rien n'y est encore garanti. */
export interface JobPayRangeInput {
  readonly minMinor: number
  readonly maxMinor: number
  readonly currency: string
  readonly period: string
}

export interface JobOfferInput {
  readonly title: string
  readonly description: string
  readonly contract: string
  readonly country: string
  /** Facultative : vide ou absente, la ville n'est pas annoncée. */
  readonly city?: string | null | undefined
  readonly workMode: string
  readonly languages: readonly string[]
  /** Facultative : `null` ou absente, aucune rémunération n'est annoncée. */
  readonly payRange?: JobPayRangeInput | null | undefined
  /** Date limite des candidatures (millisecondes UTC) ; `null` : sans date limite. */
  readonly closesAt?: number | null | undefined
}

/** Une offre VALIDÉE, normalisée, prête à être écrite (moteur) ou gardée (démonstration). */
export interface JobOfferDraft {
  readonly title: string
  readonly description: string
  readonly contract: JobOfferContract
  readonly country: CountryCode
  readonly city: string | null
  /** La ville repliée : clé d'index de la recherche par ville (saisie libre, sans GPS). */
  readonly cityKey: string | null
  readonly workMode: JobWorkMode
  readonly languages: readonly JobLanguageCode[]
  readonly payRange: JobPayRange | null
  readonly closesAt: number | null
  /** Titre, description et ville repliés : le texte de la recherche, jamais une coordonnée. */
  readonly searchText: string
}

/** Le pays de l'offre ou du talent : un pays de résidence de la diaspora, jamais le Gabon. */
export function parseJobCountry(raw: string | null | undefined): Result<CountryCode, JobRefusal> {
  const code = normalizeCountryCode(raw ?? "")
  if (code.length === 0) return refuse("job_country_required")
  if (!isCountryCode(code)) return refuse("job_country_unknown")
  if (code === HOME_COUNTRY) return refuse("job_country_is_home")
  return ok(code)
}

/** La ville saisie, facultative : une ligne bornée sans coordonnée, et sa clé repliée. */
export function parseJobCity(raw: string | null | undefined): Result<{ readonly city: string | null; readonly cityKey: string | null }, JobRefusal> {
  const city = oneLine(raw ?? "")
  if (city.length > JOB_CITY_MAX_LENGTH) return refuse("job_city_too_long")
  if (jobTextHasContact(city)) return refuse("job_contact_details_forbidden")
  const cityKey = cityKeyOf(city)
  // Une saisie sans lettre ni chiffre (« - ») ne désigne aucune ville.
  if (cityKey.length === 0) return ok({ city: null, cityKey: null })
  return ok({ city, cityKey })
}

/** Les langues de travail : au moins une, sans doublon, bornées. */
export function parseJobLanguages(raw: readonly string[]): Result<readonly JobLanguageCode[], JobRefusal> {
  const languages: JobLanguageCode[] = []
  for (const value of raw) {
    const code = value.trim().toLowerCase()
    if (!isJobLanguageCode(code)) return refuse("job_language_invalid")
    if (!languages.includes(code)) languages.push(code)
  }
  if (languages.length === 0) return refuse("job_languages_required")
  if (languages.length > JOB_LANGUAGES_MAX) return refuse("job_languages_too_many")
  return ok(languages)
}

/** La fourchette annoncée, facultative : même devise aux deux bornes, maximum non nul, minimum au plus égal. */
export function parseJobPayRange(input: JobPayRangeInput | null | undefined): Result<JobPayRange | null, JobOfferRefusal> {
  if (input === null || input === undefined) return ok(null)
  if (!isJobPayPeriod(input.period)) return refuse("job_pay_period_invalid")
  const min = parseMoney({ amountMinor: input.minMinor, currency: input.currency })
  if (!min.ok) return min
  const max = parseMoney({ amountMinor: input.maxMinor, currency: input.currency })
  if (!max.ok) return max
  if (max.value.amountMinor === 0 || min.value.amountMinor > max.value.amountMinor) return refuse("job_pay_range_invalid")
  return ok({ minMinor: min.value.amountMinor, maxMinor: max.value.amountMinor, currency: min.value.currency, period: input.period })
}

/** La date limite, facultative : à venir, et dans l'horizon de six mois. */
export function checkJobDeadline(closesAt: number | null | undefined, now: number): Result<number | null, JobRefusal> {
  if (closesAt === null || closesAt === undefined) return ok(null)
  if (!Number.isSafeInteger(closesAt) || closesAt <= now || closesAt > now + JOB_DEADLINE_HORIZON_DAYS * DAY_MS) return refuse("job_deadline_invalid")
  return ok(closesAt)
}

/** Le texte indexé d'une offre : son titre, sa description et sa ville, en mots repliés. */
export function jobSearchTextOf(parts: { readonly title: string; readonly description: string; readonly city: string | null }): string {
  return serviceSearchWords(`${parts.title} ${parts.description} ${parts.city ?? ""}`)
}

/**
 * LA règle d'une offre. Ordre des contrôles (le premier refus est rendu) :
 * titre, description, coordonnées, contrat, pays, ville, mode, langues,
 * rémunération, date limite.
 */
export function parseJobOffer(input: JobOfferInput, now: number): Result<JobOfferDraft, JobOfferRefusal> {
  const title = oneLine(input.title)
  if (title.length < JOB_TITLE_MIN_LENGTH) return refuse("job_title_too_short")
  if (title.length > JOB_TITLE_MAX_LENGTH) return refuse("job_title_too_long")
  const description = normalizeServiceText(input.description)
  if (description.length < JOB_DESCRIPTION_MIN_LENGTH) return refuse("job_description_too_short")
  if (description.length > JOB_DESCRIPTION_MAX_LENGTH) return refuse("job_description_too_long")
  if (jobTextHasContact(title) || jobTextHasContact(description)) return refuse("job_contact_details_forbidden")
  if (!isJobOfferContract(input.contract)) return refuse("job_contract_invalid")
  const country = parseJobCountry(input.country)
  if (!country.ok) return country
  const city = parseJobCity(input.city)
  if (!city.ok) return city
  if (!isJobWorkMode(input.workMode)) return refuse("job_work_mode_invalid")
  const languages = parseJobLanguages(input.languages)
  if (!languages.ok) return languages
  const payRange = parseJobPayRange(input.payRange)
  if (!payRange.ok) return payRange
  const closesAt = checkJobDeadline(input.closesAt, now)
  if (!closesAt.ok) return closesAt
  return ok({
    title,
    description,
    contract: input.contract,
    country: country.value,
    city: city.value.city,
    cityKey: city.value.cityKey,
    workMode: input.workMode,
    languages: languages.value,
    payRange: payRange.value,
    closesAt: closesAt.value,
    searchText: jobSearchTextOf({ title, description, city: city.value.city }),
  })
}

// ═══════════════════════════════════════════════════════════════
// États d'une offre
// ═══════════════════════════════════════════════════════════════

/** Ce que l'état effectif d'une offre lit : son état écrit et sa date limite. */
export interface JobOfferState {
  readonly status: JobOfferStatus
  readonly closesAt: number | null
}

const JOB_OFFER_TRANSITIONS: Readonly<Record<JobOfferStatus, readonly JobOfferStatus[]>> = Object.freeze({
  draft: ["open", "closed"],
  open: ["suspended", "closed"],
  suspended: ["open", "closed"],
  closed: [],
})

export function canTransitionJobOffer(from: JobOfferStatus, to: JobOfferStatus): boolean {
  return JOB_OFFER_TRANSITIONS[from].includes(to)
}

/**
 * L'état EFFECTIF : une offre ouverte ou suspendue dont la date limite est
 * atteinte est close, que le passage d'expiration l'ait déjà écrit ou non.
 */
export function effectiveJobOfferStatus(offer: JobOfferState, now: number): JobOfferStatus {
  if ((offer.status === "open" || offer.status === "suspended") && offer.closesAt !== null && offer.closesAt <= now) return "closed"
  return offer.status
}

/** Seule une offre effectivement OUVERTE se lit dans la recherche et reçoit des candidatures. */
export function isJobOfferOpen(offer: JobOfferState, now: number): boolean {
  return effectiveJobOfferStatus(offer, now) === "open"
}

/** Une offre se modifie tant qu'elle n'est pas close. */
export function isJobOfferEditable(status: JobOfferStatus): boolean {
  return status !== "closed"
}

/** Une offre naît brouillon, ou ouverte si la page la publie aussitôt. */
export function initialJobOfferStatus(publish: boolean): JobOfferStatus {
  return publish ? "open" : "draft"
}

/**
 * Changer l'état (EFFECTIF) d'une offre. Demander l'état courant n'est pas une
 * erreur (double clic, deux signataires) : rien ne change, `changed` le dit.
 */
export function transitionJobOffer(
  from: JobOfferStatus,
  to: JobOfferStatusTarget,
): Result<{ readonly status: JobOfferStatus; readonly changed: boolean }, JobRefusal> {
  if (from === to) return ok({ status: from, changed: false })
  if (from === "closed") return refuse("job_offer_closed")
  if (!canTransitionJobOffer(from, to)) return refuse("job_offer_transition_invalid")
  return ok({ status: to, changed: true })
}

/** Concurrence optimiste : la modification cite la version lue ; sinon, conflit. */
export function checkJobOfferVersion(current: number, expected: number): Result<number, JobRefusal> {
  if (expected !== current) return refuse("job_offer_version_conflict")
  return ok(current + 1)
}

/** La date de publication : celle de la première ouverture d'un brouillon ; inchangée ensuite. */
export function jobOfferPublishedAt(from: JobOfferStatus, to: JobOfferStatus, publishedAt: number, now: number): number {
  return from === "draft" && to === "open" ? now : publishedAt
}

// ═══════════════════════════════════════════════════════════════
// Recherche des offres
// ═══════════════════════════════════════════════════════════════

export interface JobSearchInput {
  readonly query?: string | undefined
  readonly country?: string | undefined
  readonly city?: string | undefined
  readonly contract?: string | undefined
  readonly workMode?: string | undefined
}

/** Les filtres d'une recherche, normalisés ; `null` : filtre absent. */
export interface JobSearchFilters {
  readonly query: string | null
  readonly country: CountryCode | null
  readonly cityKey: string | null
  readonly contract: JobOfferContract | null
  readonly workMode: JobWorkMode | null
}

/** La requête en mots repliés, ou `null` si elle est trop courte pour chercher. */
export function parseJobQuery(raw: string | null | undefined): Result<string | null, JobRefusal> {
  const query = serviceSearchWords(raw ?? "")
  if (query.length > JOB_QUERY_MAX_LENGTH) return refuse("job_query_too_long")
  return ok(query.length >= JOB_QUERY_MIN_LENGTH ? query : null)
}

/**
 * Les filtres d'une recherche : chaque filtre RESTREINT, aucun n'ouvre rien
 * (les offres ouvertes du réseau restent la seule source). Une valeur vide vaut
 * « sans ce filtre ».
 */
export function parseJobSearch(input: JobSearchInput): Result<JobSearchFilters, JobRefusal> {
  const query = parseJobQuery(input.query)
  if (!query.ok) return query
  let country: CountryCode | null = null
  if (input.country !== undefined && input.country.trim().length > 0) {
    const parsed = parseJobCountry(input.country)
    if (!parsed.ok) return parsed
    country = parsed.value
  }
  const city = parseJobCity(input.city)
  if (!city.ok) return city
  let contract: JobOfferContract | null = null
  if (input.contract !== undefined && input.contract.length > 0) {
    if (!isJobOfferContract(input.contract)) return refuse("job_contract_invalid")
    contract = input.contract
  }
  let workMode: JobWorkMode | null = null
  if (input.workMode !== undefined && input.workMode.length > 0) {
    if (!isJobWorkMode(input.workMode)) return refuse("job_work_mode_invalid")
    workMode = input.workMode
  }
  return ok({ query: query.value, country, cityKey: city.value.cityKey, contract, workMode })
}

/** L'offre répond-elle aux filtres de zone, de contrat et de mode ? (Défense en profondeur et démonstration.) */
export function matchesJobFilters(
  offer: { readonly country: string; readonly cityKey: string | null; readonly contract: string; readonly workMode: string },
  filters: JobSearchFilters,
): boolean {
  if (filters.country !== null && offer.country !== filters.country) return false
  if (filters.cityKey !== null && offer.cityKey !== filters.cityKey) return false
  if (filters.contract !== null && offer.contract !== filters.contract) return false
  return filters.workMode === null || offer.workMode === filters.workMode
}

/** Chaque mot cherché commence un mot du texte indexé (recherche locale, sans moteur plein texte). */
export function matchesJobQuery(searchText: string, query: string | null): boolean {
  if (query === null) return true
  const words = searchText.split(" ")
  return query.split(" ").every((term) => words.some((word) => word.startsWith(term)))
}

/** Taille de page demandée, bornée : jamais plus que le plafond, jamais moins d'une ligne. */
export function clampJobPageSize(requested: number, max: number): number {
  if (!Number.isFinite(requested)) return max
  return Math.min(max, Math.max(1, Math.trunc(requested)))
}

// ═══════════════════════════════════════════════════════════════
// Candidatures
// ═══════════════════════════════════════════════════════════════

export interface JobApplicationInput {
  readonly message: string
  /** Le consentement EXPLICITE à transmettre son nom publié à l'équipe de la page. */
  readonly shareName: boolean
  /** Joindre son profil de talent (s'il existe et reste actif) : un choix, jamais un défaut. */
  readonly shareTalentProfile: boolean
}

export interface JobApplicationDraft {
  readonly message: string
  readonly shareName: true
  readonly shareTalentProfile: boolean
}

/** Le message de motivation, borné et sans coordonnée, puis le consentement à transmettre son nom. */
export function normalizeJobApplication(input: JobApplicationInput): Result<JobApplicationDraft, JobRefusal> {
  const message = normalizeServiceText(input.message)
  if (message.length < JOB_APPLICATION_MESSAGE_MIN_LENGTH) return refuse("job_application_message_too_short")
  if (message.length > JOB_APPLICATION_MESSAGE_MAX_LENGTH) return refuse("job_application_message_too_long")
  if (jobTextHasContact(message)) return refuse("job_contact_details_forbidden")
  if (!input.shareName) return refuse("job_application_consent_required")
  return ok({ message, shareName: true, shareTalentProfile: input.shareTalentProfile })
}

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/

/** Une clé d'envoi : opaque, tirée par l'écran, stable pendant la vie de la feuille. */
export function isJobIdempotencyKey(value: string): boolean {
  return IDEMPOTENCY_KEY.test(value)
}

/** Empreinte non cryptographique (64 bits) d'un corps normalisé : le rejeu se reconnaît, il ne se devine pas. */
function fingerprintHash(text: string): string {
  let h1 = 0x6a09e667
  let h2 = 0x3c6ef372
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index)
    h1 = Math.imul(h1 ^ unit, 2654435761)
    h2 = Math.imul(h2 ^ unit, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}`
}

/**
 * Contrat de commande du moteur : même clé et même corps rendent la même
 * candidature ; même clé et autre corps sont un conflit.
 */
export function jobApplicationFingerprint(body: {
  readonly jobId: string
  readonly offerVersion: number
  readonly message: string
  readonly shareTalentProfile: boolean
}): string {
  return `v1:${fingerprintHash(JSON.stringify(["v1", body.jobId, body.offerVersion, body.message, body.shareTalentProfile]))}`
}

/** Qui fait chaque geste. */
const ACTION_ACTOR: Readonly<Record<JobApplicationAction, JobApplicationActor>> = Object.freeze({
  mark_seen: "page",
  shortlist: "page",
  not_select: "page",
  withdraw: "candidate",
})

/** L'état où mène chaque geste. */
const ACTION_TARGET: Readonly<Record<JobApplicationAction, JobApplicationStatus>> = Object.freeze({
  mark_seen: "seen",
  shortlist: "shortlisted",
  not_select: "not_selected",
  withdraw: "withdrawn",
})

/** Les états d'où chaque geste CHANGE quelque chose. */
const ACTION_FROM: Readonly<Record<JobApplicationAction, readonly JobApplicationStatus[]>> = Object.freeze({
  mark_seen: ["sent"],
  shortlist: ["sent", "seen"],
  not_select: ["sent", "seen", "shortlisted"],
  withdraw: ["sent", "seen", "shortlisted"],
})

/** Les états où le geste est déjà acquis : le refaire ne change rien (double clic, second signataire). */
const ACTION_ALREADY: Readonly<Record<JobApplicationAction, readonly JobApplicationStatus[]>> = Object.freeze({
  mark_seen: ["seen", "shortlisted", "not_selected"],
  shortlist: ["shortlisted"],
  not_select: ["not_selected"],
  withdraw: ["withdrawn"],
})

/**
 * Un geste sur une candidature. Le mauvais acteur, ou un état d'où le geste
 * ne mène nulle part (rouvrir une candidature non retenue, décider d'une
 * candidature retirée), est refusé ; un geste déjà acquis ne change rien.
 */
export function transitionJobApplication(input: {
  readonly actor: JobApplicationActor
  readonly action: JobApplicationAction
  readonly status: JobApplicationStatus
}): Result<{ readonly status: JobApplicationStatus; readonly changed: boolean }, JobRefusal> {
  if (ACTION_ACTOR[input.action] !== input.actor) return refuse("job_application_transition_invalid")
  if (ACTION_ALREADY[input.action].includes(input.status)) return ok({ status: input.status, changed: false })
  if (!ACTION_FROM[input.action].includes(input.status)) return refuse("job_application_transition_invalid")
  return ok({ status: ACTION_TARGET[input.action], changed: true })
}

/** Les gestes réellement ouverts à cet acteur maintenant (calculés par le serveur, montrés par l'écran). */
export function availableJobApplicationActions(actor: JobApplicationActor, status: JobApplicationStatus): JobApplicationAction[] {
  return JOB_APPLICATION_ACTIONS.filter((action) => ACTION_ACTOR[action] === actor && ACTION_FROM[action].includes(status))
}

/** Non retenue et retirée sont terminales. */
export function isJobApplicationTerminal(status: JobApplicationStatus): boolean {
  return status === "not_selected" || status === "withdrawn"
}

/** Le motif de non-sélection, facultatif : une note de l'équipe, bornée, sans coordonnée. */
export function parseJobDecisionReason(raw: string | null | undefined): Result<string | null, JobRefusal> {
  const reason = normalizeServiceText(raw ?? "")
  if (reason.length === 0) return ok(null)
  if (reason.length > JOB_DECISION_REASON_MAX_LENGTH) return refuse("job_decision_reason_too_long")
  if (jobTextHasContact(reason)) return refuse("job_contact_details_forbidden")
  return ok(reason)
}

// ═══════════════════════════════════════════════════════════════
// Profils de talent
// ═══════════════════════════════════════════════════════════════

export interface TalentProfileInput {
  readonly title: string
  readonly skills: readonly string[]
  readonly availability: string
  readonly languages: readonly string[]
  readonly country: string
  readonly visibility: string
}

/** Un profil VALIDÉ : ni âge, ni sexe, ni origine, ni situation familiale, ni photo — ces champs n'existent pas. */
export interface TalentProfileDraft {
  readonly title: string
  readonly skills: readonly string[]
  /** Titre et compétences repliés : le texte de la recherche. */
  readonly searchText: string
  readonly availability: TalentAvailability
  readonly languages: readonly JobLanguageCode[]
  readonly country: CountryCode
  readonly visibility: TalentVisibility
}

/** Les compétences : de une à quinze, chacune une ligne bornée sans coordonnée ; un doublon replié est ignoré. */
export function parseTalentSkills(raw: readonly string[]): Result<readonly string[], JobRefusal> {
  const skills: string[] = []
  const keys = new Set<string>()
  for (const value of raw) {
    const skill = oneLine(value)
    if (skill.length === 0) continue
    if (skill.length < TALENT_SKILL_MIN_LENGTH || skill.length > TALENT_SKILL_MAX_LENGTH) return refuse("talent_skill_invalid")
    if (jobTextHasContact(skill)) return refuse("job_contact_details_forbidden")
    const key = foldServiceText(skill)
    if (keys.has(key)) continue
    keys.add(key)
    skills.push(skill)
  }
  if (skills.length < TALENT_SKILLS_MIN) return refuse("talent_skills_required")
  if (skills.length > TALENT_SKILLS_MAX) return refuse("talent_skills_too_many")
  return ok(skills)
}

/** Le texte indexé d'un talent : son titre et ses compétences, en mots repliés. */
export function talentSearchTextOf(title: string, skills: readonly string[]): string {
  return serviceSearchWords(`${title} ${skills.join(" ")}`)
}

/**
 * LA règle d'un profil de talent. Ordre : titre, compétences, disponibilité,
 * langues, pays, visibilité.
 */
export function parseTalentProfile(input: TalentProfileInput): Result<TalentProfileDraft, JobRefusal> {
  const title = oneLine(input.title)
  if (title.length < TALENT_TITLE_MIN_LENGTH) return refuse("talent_title_too_short")
  if (title.length > TALENT_TITLE_MAX_LENGTH) return refuse("talent_title_too_long")
  if (jobTextHasContact(title)) return refuse("job_contact_details_forbidden")
  const skills = parseTalentSkills(input.skills)
  if (!skills.ok) return skills
  if (!isTalentAvailability(input.availability)) return refuse("talent_availability_invalid")
  const languages = parseJobLanguages(input.languages)
  if (!languages.ok) return languages
  const country = parseJobCountry(input.country)
  if (!country.ok) return country
  if (!isTalentVisibility(input.visibility)) return refuse("talent_visibility_invalid")
  return ok({
    title,
    skills: skills.value,
    searchText: talentSearchTextOf(title, skills.value),
    availability: input.availability,
    languages: languages.value,
    country: country.value,
    visibility: input.visibility,
  })
}

/** La recherche des talents : un pays OBLIGATOIRE (lecture bornée), une compétence facultative. */
export function parseTalentSearch(input: {
  readonly country: string
  readonly skill?: string | undefined
}): Result<{ readonly country: CountryCode; readonly skill: string | null }, JobRefusal> {
  const country = parseJobCountry(input.country)
  if (!country.ok) return country
  const skill = parseJobQuery(input.skill)
  if (!skill.ok) return skill
  return ok({ country: country.value, skill: skill.value })
}

/** Visible dans la recherche : actif ET visible du réseau. */
export function isTalentListed(profile: { readonly status: TalentProfileStatus; readonly visibility: TalentVisibility }): boolean {
  return profile.status === "active" && profile.visibility === "network"
}

/** Joignable à une candidature : actif (même masqué de la recherche). */
export function isTalentAttachable(profile: { readonly status: TalentProfileStatus }): boolean {
  return profile.status === "active"
}

/**
 * Concurrence optimiste du profil : une création cite `null` (aucun profil
 * lu), une modification cite la version lue ; sinon, conflit.
 */
export function checkTalentProfileVersion(current: number | null, expected: number | null): Result<number, JobRefusal> {
  if (current !== expected) return refuse("talent_profile_version_conflict")
  return ok((current ?? 0) + 1)
}

/** Un mot en capitales (deux lettres au moins) : un NOM de famille, selon la convention d'écriture des noms. */
function isFamilyNameWord(word: string): boolean {
  const letters = word.replace(/[^\p{L}]/gu, "")
  return letters.length >= 2 && letters === letters.toLocaleUpperCase() && letters !== letters.toLocaleLowerCase()
}

/** La première lettre d'un mot, en capitale. */
function initialOf(word: string): string {
  const letter = /\p{L}/u.exec(word)
  return (letter ? letter[0] : word.charAt(0)).toLocaleUpperCase()
}

/**
 * Le nom COURT d'un talent en liste : le prénom et l'initiale du nom de
 * famille (« Mireille I. », « Jean-Rémy N. » pour « NDONG MBA Jean-Rémy »),
 * jamais le nom complet. `null` : aucun nom publié.
 */
export function talentShortName(displayName: string | null | undefined): string | null {
  const words = oneLine(displayName ?? "").split(" ").filter((word) => word.length > 0)
  if (words.length === 0) return null
  const family = words.filter(isFamilyNameWord)
  const given = words.filter((word) => !isFamilyNameWord(word))
  const first = given.length > 0 ? given[0] : words[0]
  const surname = family.length > 0 ? family[0] : given.length > 1 ? given[given.length - 1] : undefined
  if (first === undefined || surname === undefined || surname === first) return first ?? null
  return `${first} ${initialOf(surname)}.`
}
