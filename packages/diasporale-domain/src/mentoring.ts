/**
 * Mentorat bénévole de DIASPORALE (DG-024, troisième tranche, lot G8 point 2 du
 * plan global) — règles pures. PROPRIÉTAIRE : chantier « mentorat ».
 *
 * Être mentor est un OPT-IN explicite, horodaté et révocable : jamais déduit de
 * la facette (« disponible pour aider » ne fait de personne un mentor), ni
 * d'aucune autre donnée. Le mentorat est BÉNÉVOLE : aucun tarif, aucun paiement.
 *
 *   profil :  active ⇄ paused ; active | paused ──► retired ; retired ──► active
 *             (un nouvel opt-in explicite, jamais une reprise silencieuse)
 *
 *   demande : sent ──► accepted ──► closed (par l'un ou l'autre, motif facultatif)
 *               ├──► declined (le mentor décline, motif facultatif)
 *               ├──► cancelled (le mentoré retire sa demande, motif facultatif)
 *               └──► expired (14 jours sans réponse, constatée à la lecture)
 *
 * Un mentor ne dépasse jamais son plafond de mentorés actifs (1 à 10) ; une
 * seule demande ouverte (envoyée ou acceptée) par paire mentoré → mentor ;
 * personne ne se mentore soi-même. Le message, l'objectif et les textes du
 * profil ne portent aucune coordonnée : le contact passe par la messagerie, une
 * fois la demande acceptée.
 *
 * Instants en millisecondes UTC ; le fuseau IANA dit comment une heure a été
 * pensée (règles de fuseau et de texte reprises des demandes de service). Les
 * règles rendent des CODES fermés (`MENTORING_REFUSALS`), traduits par
 * l'interface. Ce module est relu par le moteur (lib ES2021) : aucune API plus
 * récente.
 */
import { parseResidenceCountry, type CountryCode } from "./countries"
import { isFieldVisibleTo, type DiasporaFacet, type FacetViewer } from "./facet"
import { ok, refuse, type Result } from "./result"
import { canonicalTimeZone, isServiceInstant, normalizeServiceText, serviceTextRefusal, zonedWallTimeToUtc } from "./service-requests"
import { isServiceLanguageCode, SERVICE_LANGUAGE_CODES } from "./services"
import { DAY_MS, MINUTE_MS } from "./time"

// ═══════════════════════════════════════════════════════════════
// Listes fermées
// ═══════════════════════════════════════════════════════════════

/** Les domaines d'aide d'un mentor (miroir de `MENTOR_DOMAINS` des surfaces, carte C9). */
export const MENTORING_DOMAINS = ["housing", "studies", "work", "family", "admin"] as const
export type MentoringDomain = (typeof MENTORING_DOMAINS)[number]

export function isMentoringDomain(value: string): value is MentoringDomain {
  return (MENTORING_DOMAINS as readonly string[]).includes(value)
}

/** Les langues d'un mentor : la liste fermée des prestations (nom affiché par `Intl.DisplayNames`). */
export const MENTOR_LANGUAGE_CODES = SERVICE_LANGUAGE_CODES
export type MentorLanguageCode = (typeof MENTOR_LANGUAGE_CODES)[number]

/** Actif (trouvé, demandable), en pause (ni trouvé ni demandable), retiré (opt-in révoqué). */
export const MENTOR_PROFILE_STATES = ["active", "paused", "retired"] as const
export type MentorProfileState = (typeof MENTOR_PROFILE_STATES)[number]

/** Un profil a des lignes d'annuaire tant qu'il n'est pas retiré. */
export const MENTOR_LISTING_STATES = ["active", "paused"] as const satisfies readonly MentorProfileState[]
export type MentorListingState = (typeof MENTOR_LISTING_STATES)[number]

export const MENTORING_REQUEST_STATUSES = ["sent", "accepted", "declined", "cancelled", "expired", "closed"] as const
export type MentoringRequestStatus = (typeof MENTORING_REQUEST_STATUSES)[number]

/** Une demande OUVERTE entre deux personnes : envoyée, ou acceptée (mentorat en cours). */
export const MENTORING_REQUEST_OPEN_STATUSES = ["sent", "accepted"] as const satisfies readonly MentoringRequestStatus[]

/** Les états sans retour : aucune transition n'en sort. */
export const MENTORING_REQUEST_TERMINAL_STATUSES = ["declined", "cancelled", "expired", "closed"] as const satisfies readonly MentoringRequestStatus[]

/** Qui parle : la personne qui demande un mentorat, ou le mentor. */
export const MENTORING_ROLES = ["mentee", "mentor"] as const
export type MentoringRole = (typeof MENTORING_ROLES)[number]

/** Qui a clos une demande : les deux parties, ou le constat d'échéance. */
export const MENTORING_CLOSERS = ["mentee", "mentor", "system"] as const
export type MentoringCloser = (typeof MENTORING_CLOSERS)[number]

export const MENTORING_REQUEST_ACTIONS = ["accept", "decline", "cancel", "propose_slot", "close"] as const
export type MentoringRequestAction = (typeof MENTORING_REQUEST_ACTIONS)[number]

// ═══════════════════════════════════════════════════════════════
// Bornes
// ═══════════════════════════════════════════════════════════════

export const MENTOR_PRESENTATION_MIN_LENGTH = 20
export const MENTOR_PRESENTATION_MAX_LENGTH = 600
export const MENTOR_AVAILABILITY_MIN_LENGTH = 2
export const MENTOR_AVAILABILITY_MAX_LENGTH = 200
export const MENTOR_LANGUAGES_MAX = 5
/** Même borne que la ville d'une facette : un nom de ville, pas une adresse. */
export const MENTOR_CITY_MAX_LENGTH = 80
/** Mentorés actifs au plus, choisi par le mentor : de un à dix. */
export const MENTOR_CAPACITY_MIN = 1
export const MENTOR_CAPACITY_MAX = 10
/** Demandes en attente au plus chez un mentor : au-delà, il ne reçoit plus de demande nouvelle. */
export const MENTOR_PENDING_REQUESTS_MAX = 20
/** Demandes en attente au plus envoyées par une même personne. */
export const MENTEE_OPEN_REQUESTS_MAX = 5
export const MENTORING_GOAL_MIN_LENGTH = 4
export const MENTORING_GOAL_MAX_LENGTH = 120
export const MENTORING_MESSAGE_MIN_LENGTH = 20
export const MENTORING_MESSAGE_MAX_LENGTH = 1000
/** Zéro à trois créneaux souhaités. */
export const MENTORING_SLOTS_MAX = 3
/** Un créneau dure de 15 minutes à 4 heures. */
export const MENTORING_SLOT_MIN_MINUTES = 15
export const MENTORING_SLOT_MAX_MINUTES = 240
/** Un créneau se termine au plus tard dans 90 jours. */
export const MENTORING_SLOT_HORIZON_DAYS = 90
/** Une demande sans réponse expire au bout de 14 jours. */
export const MENTORING_REQUEST_TTL_DAYS = 14
export const MENTORING_REASON_MAX_LENGTH = 500

// ═══════════════════════════════════════════════════════════════
// Refus fermés
// ═══════════════════════════════════════════════════════════════

export const MENTORING_REFUSALS = [
  // Le profil de mentor.
  "mentor_consent_required",
  "mentor_domains_required",
  "mentor_domain_invalid",
  "mentor_presentation_too_short",
  "mentor_presentation_too_long",
  "mentor_languages_required",
  "mentor_language_invalid",
  "mentor_languages_too_many",
  "mentor_country_invalid",
  "mentor_city_invalid",
  "mentor_availability_too_short",
  "mentor_availability_too_long",
  "mentor_capacity_invalid",
  "mentor_capacity_below_active",
  "mentor_profile_exists",
  "mentor_profile_retired",
  "mentor_profile_version_changed",
  // Les textes libres : ni coordonnée, ni adresse exacte.
  "mentoring_contact_forbidden",
  "mentoring_address_forbidden",
  // La demande.
  "mentoring_consent_required",
  "mentoring_domain_not_offered",
  "mentoring_goal_too_short",
  "mentoring_goal_too_long",
  "mentoring_message_too_short",
  "mentoring_message_too_long",
  "mentoring_slots_too_many",
  "mentoring_slot_invalid",
  "mentoring_slot_past",
  "mentoring_slot_too_far",
  "mentoring_time_invalid",
  "mentoring_time_nonexistent",
  "mentoring_time_ambiguous",
  "mentoring_time_zone_invalid",
  "mentoring_self_request",
  "mentoring_pair_open",
  "mentoring_mentee_limit",
  "mentoring_mentor_full",
  "mentoring_idempotency_conflict",
  // Les gestes.
  "mentoring_request_expired",
  "mentoring_request_closed",
  "mentoring_request_not_open",
  "mentoring_action_forbidden",
  "mentoring_capacity_reached",
  "mentoring_slot_version_changed",
  "mentoring_reason_too_long",
] as const
export type MentoringRefusal = (typeof MENTORING_REFUSALS)[number]

type TextRefusal = "mentoring_contact_forbidden" | "mentoring_address_forbidden"

// ═══════════════════════════════════════════════════════════════
// Textes libres
// ═══════════════════════════════════════════════════════════════

/**
 * Un texte libre du mentorat qui porte une coordonnée (adresse e-mail, numéro
 * de téléphone) ou une adresse exacte est refusé : même détection que les
 * demandes de service, codes propres au mentorat.
 */
export function mentoringTextRefusal(text: string): TextRefusal | null {
  const refusal = serviceTextRefusal(text)
  if (refusal === "request_contact_forbidden") return "mentoring_contact_forbidden"
  if (refusal === "request_address_forbidden") return "mentoring_address_forbidden"
  return null
}

/** Un texte sur plusieurs lignes, normalisé, borné, sans coordonnée. */
function boundedText(raw: string, min: number, max: number, tooShort: MentoringRefusal, tooLong: MentoringRefusal): Result<string, MentoringRefusal> {
  const text = normalizeServiceText(raw)
  if (text.length < min) return refuse(tooShort)
  if (text.length > max) return refuse(tooLong)
  const refusal = mentoringTextRefusal(text)
  return refusal === null ? ok(text) : refuse(refusal)
}

/** Un texte sur une ligne (objectif) : forme NFC, espaces simples. */
function singleLine(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim()
}

// Caractères de contrôle (dont retours à la ligne) : une ville tient sur une ligne.
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]")

// ═══════════════════════════════════════════════════════════════
// Le profil de mentor
// ═══════════════════════════════════════════════════════════════

export interface MentorProfileInput {
  readonly domains: readonly string[]
  readonly presentation: string
  readonly languages: readonly string[]
  readonly country: string
  readonly city?: string | null
  readonly availability: string
  readonly maxActiveMentees: number
}

export interface MentorProfileDraft {
  /** Dans l'ordre canonique des domaines, sans doublon. */
  readonly domains: readonly MentoringDomain[]
  readonly presentation: string
  readonly languages: readonly MentorLanguageCode[]
  /** Le pays où le mentor aide : jamais le Gabon. */
  readonly country: CountryCode
  readonly city: string | null
  /** La disponibilité DÉCLARÉE (« le soir en semaine ») : un texte, jamais un agenda. */
  readonly availability: string
  readonly maxActiveMentees: number
}

export function isMentorCapacity(value: number): boolean {
  return Number.isSafeInteger(value) && value >= MENTOR_CAPACITY_MIN && value <= MENTOR_CAPACITY_MAX
}

function parseMentorDomains(raw: readonly string[]): Result<MentoringDomain[], MentoringRefusal> {
  const chosen = new Set<string>()
  for (const value of raw) {
    const domain = value.trim()
    if (!isMentoringDomain(domain)) return refuse("mentor_domain_invalid")
    chosen.add(domain)
  }
  if (chosen.size === 0) return refuse("mentor_domains_required")
  return ok(MENTORING_DOMAINS.filter((domain) => chosen.has(domain)))
}

function parseMentorLanguages(raw: readonly string[]): Result<MentorLanguageCode[], MentoringRefusal> {
  const chosen: MentorLanguageCode[] = []
  for (const value of raw) {
    const code = value.trim().toLowerCase()
    if (!isServiceLanguageCode(code)) return refuse("mentor_language_invalid")
    if (!chosen.includes(code)) chosen.push(code)
  }
  if (chosen.length === 0) return refuse("mentor_languages_required")
  if (chosen.length > MENTOR_LANGUAGES_MAX) return refuse("mentor_languages_too_many")
  return ok(chosen)
}

function parseMentorCity(raw: string | null | undefined): Result<string | null, MentoringRefusal> {
  if (raw === null || raw === undefined) return ok(null)
  if (CONTROL_CHARS.test(raw)) return refuse("mentor_city_invalid")
  const city = raw.trim().replace(/\s+/g, " ")
  if (city.length === 0) return ok(null)
  if (city.length > MENTOR_CITY_MAX_LENGTH) return refuse("mentor_city_invalid")
  const refusal = mentoringTextRefusal(city)
  return refusal === null ? ok(city) : refuse(refusal)
}

/**
 * Un profil de mentor complet : un à cinq domaines de la liste fermée, une
 * présentation et une disponibilité bornées sans coordonnée, une à cinq
 * langues, un pays de la diaspora (jamais le Gabon), une ville facultative et
 * le plafond de mentorés actifs (1 à 10).
 */
export function parseMentorProfile(input: MentorProfileInput): Result<MentorProfileDraft, MentoringRefusal> {
  const domains = parseMentorDomains(input.domains)
  if (!domains.ok) return domains
  const presentation = boundedText(input.presentation, MENTOR_PRESENTATION_MIN_LENGTH, MENTOR_PRESENTATION_MAX_LENGTH, "mentor_presentation_too_short", "mentor_presentation_too_long")
  if (!presentation.ok) return presentation
  const languages = parseMentorLanguages(input.languages)
  if (!languages.ok) return languages
  const country = parseResidenceCountry(input.country)
  if (!country.ok) return refuse("mentor_country_invalid")
  const city = parseMentorCity(input.city)
  if (!city.ok) return city
  const availability = boundedText(input.availability, MENTOR_AVAILABILITY_MIN_LENGTH, MENTOR_AVAILABILITY_MAX_LENGTH, "mentor_availability_too_short", "mentor_availability_too_long")
  if (!availability.ok) return availability
  if (!isMentorCapacity(input.maxActiveMentees)) return refuse("mentor_capacity_invalid")
  return ok({
    domains: domains.value,
    presentation: presentation.value,
    languages: languages.value,
    country: country.value,
    city: city.value,
    availability: availability.value,
    maxActiveMentees: input.maxActiveMentees,
  })
}

/**
 * Devenir mentor : un consentement explicite, et aucun profil vivant (actif ou
 * en pause) déjà posé. Après un retrait, c'est un NOUVEL opt-in.
 */
export function checkMentorOptIn(input: { readonly consent: boolean; readonly existing: MentorProfileState | null }): Result<null, MentoringRefusal> {
  if (!input.consent) return refuse("mentor_consent_required")
  if (input.existing !== null && input.existing !== "retired") return refuse("mentor_profile_exists")
  return ok(null)
}

/** La version citée doit être la version courante ; rend la version suivante. */
export function checkMentorProfileVersion(expected: number, current: number): Result<number, "mentor_profile_version_changed"> {
  return expected === current ? ok(current + 1) : refuse("mentor_profile_version_changed")
}

/** Un profil retiré ne se modifie plus : on redevient mentor par un nouvel opt-in. */
export function checkMentorProfileEditable(state: MentorProfileState): Result<null, "mentor_profile_retired"> {
  return state === "retired" ? refuse("mentor_profile_retired") : ok(null)
}

/** Un plafond ne descend jamais sous le nombre de mentorés actifs : on clôt d'abord un mentorat. */
export function checkMentorCapacityChange(maxActiveMentees: number, activeMentees: number): Result<null, "mentor_capacity_below_active"> {
  return maxActiveMentees >= activeMentees ? ok(null) : refuse("mentor_capacity_below_active")
}

/**
 * Pause, reprise ou retrait. L'état demandé déjà courant ne change rien (double
 * clic, second onglet) ; un profil retiré ne bouge plus.
 */
export function transitionMentorState(current: MentorProfileState, target: MentorProfileState): Result<{ readonly state: MentorProfileState; readonly changed: boolean }, "mentor_profile_retired"> {
  if (current === "retired") return refuse("mentor_profile_retired")
  return ok({ state: target, changed: target !== current })
}

/** Les faits relus pour dire si un mentor reçoit une demande nouvelle. */
export interface MentorAvailabilityFacts {
  readonly state: MentorProfileState
  readonly activeMentees: number
  readonly maxActiveMentees: number
  readonly pendingRequests: number
}

/** Un mentor reçoit une demande nouvelle s'il est actif, sous son plafond et sans boîte saturée. */
export function mentorAcceptsRequests(facts: MentorAvailabilityFacts): boolean {
  return facts.state === "active" && facts.activeMentees < facts.maxActiveMentees && facts.pendingRequests < MENTOR_PENDING_REQUESTS_MAX
}

/**
 * Ce qu'un lecteur voit du lieu d'un mentor : la ville et l'année d'arrivée
 * selon les niveaux de SA facette (`only_me` ⊂ `connections` ⊂ `country` ⊂
 * `network`). Le pays du mentorat, lui, est publié par l'opt-in même.
 */
export function projectMentorPlace(input: {
  readonly city: string | null
  readonly facet: Pick<DiasporaFacet, "arrivedAt" | "visibility"> | null
  readonly viewer: FacetViewer
}): { readonly city: string | null; readonly arrivedAt: number | null } {
  const { facet, viewer } = input
  if (facet === null) return { city: null, arrivedAt: null }
  return {
    city: input.city !== null && isFieldVisibleTo(facet.visibility.city, viewer) ? input.city : null,
    arrivedAt: facet.arrivedAt !== undefined && isFieldVisibleTo(facet.visibility.arrivedAt, viewer) ? facet.arrivedAt : null,
  }
}

// ═══════════════════════════════════════════════════════════════
// La demande de mentorat
// ═══════════════════════════════════════════════════════════════

/** Un créneau : début inclus, fin exclue, en millisecondes UTC. */
export interface MentoringSlot {
  readonly startAt: number
  readonly endAt: number
}

/** Un créneau proposé par le mentor, avec le fuseau dans lequel il a été pensé. */
export interface MentoringSlotProposal extends MentoringSlot {
  readonly timeZone: string
}

export interface MentoringRequestInput {
  readonly domain: string
  readonly goal: string
  readonly message: string
  readonly wishedSlots: readonly MentoringSlot[]
  readonly timeZone: string
}

export interface MentoringRequestDraft {
  readonly domain: MentoringDomain
  readonly goal: string
  readonly message: string
  /** Triés par début, sans doublon. */
  readonly wishedSlots: readonly MentoringSlot[]
  /** Le fuseau CANONIQUE du mentoré. */
  readonly timeZone: string
}

function isSlotShape(slot: MentoringSlot): boolean {
  const length = slot.endAt - slot.startAt
  return isServiceInstant(slot.startAt) && isServiceInstant(slot.endAt) && length >= MENTORING_SLOT_MIN_MINUTES * MINUTE_MS && length <= MENTORING_SLOT_MAX_MINUTES * MINUTE_MS
}

/**
 * La FORME d'une demande, indépendante de l'heure : un domaine, un objectif et
 * un message bornés sans coordonnée, zéro à trois créneaux bien formés, un
 * fuseau valide. Le rejeu idempotent compare ce corps normalisé.
 */
export function normalizeMentoringRequestDraft(input: MentoringRequestInput): Result<MentoringRequestDraft, MentoringRefusal> {
  const domain = input.domain.trim()
  if (!isMentoringDomain(domain)) return refuse("mentor_domain_invalid")
  const goal = singleLine(input.goal)
  if (goal.length < MENTORING_GOAL_MIN_LENGTH) return refuse("mentoring_goal_too_short")
  if (goal.length > MENTORING_GOAL_MAX_LENGTH) return refuse("mentoring_goal_too_long")
  const goalRefusal = mentoringTextRefusal(goal)
  if (goalRefusal !== null) return refuse(goalRefusal)
  const message = boundedText(input.message, MENTORING_MESSAGE_MIN_LENGTH, MENTORING_MESSAGE_MAX_LENGTH, "mentoring_message_too_short", "mentoring_message_too_long")
  if (!message.ok) return message
  const timeZone = canonicalTimeZone(input.timeZone)
  if (timeZone === null) return refuse("mentoring_time_zone_invalid")
  if (input.wishedSlots.length > MENTORING_SLOTS_MAX) return refuse("mentoring_slots_too_many")
  const wishedSlots: MentoringSlot[] = []
  for (const slot of input.wishedSlots) {
    if (!isSlotShape(slot)) return refuse("mentoring_slot_invalid")
    if (!wishedSlots.some((kept) => kept.startAt === slot.startAt && kept.endAt === slot.endAt)) wishedSlots.push({ startAt: slot.startAt, endAt: slot.endAt })
  }
  wishedSlots.sort((left, right) => left.startAt - right.startAt || left.endAt - right.endAt)
  return ok({ domain, goal, message: message.value, wishedSlots, timeZone })
}

/**
 * L'HEURE d'une demande nouvelle : chaque créneau souhaité commence dans le
 * futur et se termine dans l'horizon. La demande expire 14 jours après l'envoi.
 */
export function checkMentoringRequestTiming(draft: Pick<MentoringRequestDraft, "wishedSlots">, now: number): Result<{ readonly expiresAt: number }, MentoringRefusal> {
  for (const slot of draft.wishedSlots) {
    if (slot.startAt <= now) return refuse("mentoring_slot_past")
    if (slot.endAt > now + MENTORING_SLOT_HORIZON_DAYS * DAY_MS) return refuse("mentoring_slot_too_far")
  }
  return ok({ expiresAt: now + MENTORING_REQUEST_TTL_DAYS * DAY_MS })
}

/** Une clé d'idempotence fournie par le client : 16 à 128 signes sûrs (un UUID convient). */
export function isMentoringIdempotencyKey(value: string): boolean {
  return /^[A-Za-z0-9_-]{16,128}$/.test(value)
}

/** Empreinte 64 bits non cryptographique (variante de cyrb53) : comparer deux corps, pas les protéger. */
function hash64(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index)
    h1 = Math.imul(h1 ^ unit, 2654435761)
    h2 = Math.imul(h2 ^ unit, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}`
}

/** L'empreinte du corps NORMALISÉ d'une demande : même clé et même empreinte = même demande. */
export function mentoringRequestFingerprint(body: MentoringRequestDraft & { readonly mentorId: string }): string {
  const canonical = JSON.stringify(["v1", body.mentorId, body.domain, body.goal, body.message, body.wishedSlots.map((slot) => [slot.startAt, slot.endAt]), body.timeZone])
  return `v1:${hash64(canonical)}`
}

/** Les faits relus par le fournisseur de données au moment d'admettre une demande. */
export interface MentoringAdmissionFacts {
  readonly isSelf: boolean
  /** Le domaine demandé figure parmi ceux du mentor. */
  readonly domainOffered: boolean
  /** Une demande envoyée (non échue) ou un mentorat en cours existe déjà dans cette paire. */
  readonly pairOpen: boolean
  /** Demandes en attente (non échues) déjà envoyées par le mentoré. */
  readonly menteeOpenRequests: number
  readonly mentorAccepts: boolean
}

/** Admettre une demande : on ne se mentore pas soi-même, une paire n'a qu'une demande ouverte, les plafonds tiennent. */
export function checkMentoringAdmission(facts: MentoringAdmissionFacts): Result<null, MentoringRefusal> {
  if (facts.isSelf) return refuse("mentoring_self_request")
  if (!facts.domainOffered) return refuse("mentoring_domain_not_offered")
  if (facts.pairOpen) return refuse("mentoring_pair_open")
  if (facts.menteeOpenRequests >= MENTEE_OPEN_REQUESTS_MAX) return refuse("mentoring_mentee_limit")
  if (!facts.mentorAccepts) return refuse("mentoring_mentor_full")
  return ok(null)
}

/** Accepter : jamais au-delà du plafond de mentorés actifs (relu dans la transaction). */
export function checkMentorCapacity(activeMentees: number, maxActiveMentees: number): Result<null, "mentoring_capacity_reached"> {
  return activeMentees < maxActiveMentees ? ok(null) : refuse("mentoring_capacity_reached")
}

/**
 * Un créneau proposé par le mentor : bien formé (15 min à 4 h), futur, dans
 * l'horizon de 90 jours, pensé dans un fuseau valide (rendu canonique).
 */
export function parseMentoringSlot(input: MentoringSlotProposal, now: number): Result<MentoringSlotProposal, MentoringRefusal> {
  if (!isSlotShape(input)) return refuse("mentoring_slot_invalid")
  if (input.startAt <= now) return refuse("mentoring_slot_past")
  if (input.endAt > now + MENTORING_SLOT_HORIZON_DAYS * DAY_MS) return refuse("mentoring_slot_too_far")
  const timeZone = canonicalTimeZone(input.timeZone)
  if (timeZone === null) return refuse("mentoring_time_zone_invalid")
  return ok({ startAt: input.startAt, endAt: input.endAt, timeZone })
}

/** La version du créneau citée doit être la courante (deux onglets) ; rend la suivante. */
export function checkMentoringSlotVersion(expected: number, current: number): Result<number, "mentoring_slot_version_changed"> {
  return expected === current ? ok(current + 1) : refuse("mentoring_slot_version_changed")
}

/** Un motif facultatif : borné, sans coordonnée. */
export function parseMentoringReason(raw: string | null | undefined): Result<string | null, MentoringRefusal> {
  const reason = raw ? normalizeServiceText(raw) : ""
  if (reason.length === 0) return ok(null)
  if (reason.length > MENTORING_REASON_MAX_LENGTH) return refuse("mentoring_reason_too_long")
  const refusal = mentoringTextRefusal(reason)
  return refusal === null ? ok(reason) : refuse(refusal)
}

const TIME_REFUSALS = {
  request_time_invalid: "mentoring_time_invalid",
  request_time_nonexistent: "mentoring_time_nonexistent",
  request_time_ambiguous: "mentoring_time_ambiguous",
  request_time_zone_invalid: "mentoring_time_zone_invalid",
} as const satisfies Readonly<Record<string, MentoringRefusal>>

/**
 * Une date (`AAAA-MM-JJ`) et une heure (`HH:MM`) murales d'un fuseau, en
 * instant UTC exact : l'heure qui n'existe pas ou qui existe deux fois (changement
 * d'heure) est refusée plutôt que devinée — règle des demandes de service.
 */
export function mentoringWallTimeToUtc(input: { readonly date: string; readonly time: string }, timeZone: string): Result<number, MentoringRefusal> {
  const instant = zonedWallTimeToUtc(input, timeZone)
  return instant.ok ? instant : refuse(TIME_REFUSALS[instant.code])
}

// ═══════════════════════════════════════════════════════════════
// Échéance et transitions
// ═══════════════════════════════════════════════════════════════

export function isMentoringRequestTerminal(status: MentoringRequestStatus): boolean {
  return (MENTORING_REQUEST_TERMINAL_STATUSES as readonly MentoringRequestStatus[]).includes(status)
}

export function isMentoringRequestOpen(status: MentoringRequestStatus): boolean {
  return (MENTORING_REQUEST_OPEN_STATUSES as readonly MentoringRequestStatus[]).includes(status)
}

/**
 * L'état EFFECTIF : une demande envoyée dont l'échéance est atteinte est
 * expirée, que le passage d'expiration l'ait déjà écrit ou non. Un mentorat
 * accepté n'expire jamais faute de réponse : il se clôt par un geste.
 */
export function effectiveMentoringStatus(request: { readonly status: MentoringRequestStatus; readonly expiresAt: number }, now: number): MentoringRequestStatus {
  return request.status === "sent" && now >= request.expiresAt ? "expired" : request.status
}

/** L'échéance qui court : celle de la demande tant qu'elle attend une réponse ; aucune ensuite. */
export function mentoringRequestDeadline(request: { readonly status: MentoringRequestStatus; readonly expiresAt: number }): number | null {
  return request.status === "sent" ? request.expiresAt : null
}

const MENTORING_TRANSITIONS: Readonly<Record<MentoringRequestAction, { readonly roles: readonly MentoringRole[]; readonly from: MentoringRequestStatus; readonly to: MentoringRequestStatus }>> = {
  accept: { roles: ["mentor"], from: "sent", to: "accepted" },
  decline: { roles: ["mentor"], from: "sent", to: "declined" },
  cancel: { roles: ["mentee"], from: "sent", to: "cancelled" },
  propose_slot: { roles: ["mentor"], from: "accepted", to: "accepted" },
  close: { roles: ["mentee", "mentor"], from: "accepted", to: "closed" },
}

/**
 * Qui peut faire quoi. Tant que la demande attend, le mentor accepte ou
 * décline, le mentoré la retire ; une fois acceptée, le mentor propose un
 * créneau et l'un ou l'autre clôt le mentorat. L'état cité est l'état EFFECTIF.
 */
export function checkMentoringTransition(input: { readonly action: MentoringRequestAction; readonly role: MentoringRole; readonly status: MentoringRequestStatus }): Result<MentoringRequestStatus, MentoringRefusal> {
  if (input.status === "expired") return refuse("mentoring_request_expired")
  if (isMentoringRequestTerminal(input.status)) return refuse("mentoring_request_closed")
  const rule = MENTORING_TRANSITIONS[input.action]
  if (!rule.roles.includes(input.role)) return refuse("mentoring_action_forbidden")
  if (rule.from !== input.status) return refuse("mentoring_request_not_open")
  return ok(rule.to)
}

/** Les gestes RÉELLEMENT ouverts à ce rôle maintenant : l'écran ne montre pas de bouton qu'un refus attend. */
export function availableMentoringActions(input: { readonly role: MentoringRole; readonly status: MentoringRequestStatus }): MentoringRequestAction[] {
  return MENTORING_REQUEST_ACTIONS.filter((action) => checkMentoringTransition({ action, role: input.role, status: input.status }).ok)
}
