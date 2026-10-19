/**
 * Demandes de service, propositions et rendez-vous (DG-014/015) — machines
 * d'états pures du plan global §3.2. PROPRIÉTAIRE : chantier « demandes et
 * rendez-vous ».
 *
 *   sent ──► proposed ──► confirmed ──► completed
 *     │        │  ▲ (nouvelle version)   ├──► cancelled (avant le début, motif)
 *     │        └──┘                      └──► no_show (constat après le début)
 *     ├──► refused (la page décline, avant tout accord)
 *     ├──► cancelled (le demandeur retire sa demande)
 *     └──► expired (échéance de la demande ou de la proposition courante)
 *
 * Mise en relation SEULEMENT : un montant décrit ce que la page propose ; la
 * plateforme n'encaisse rien et ne facture rien. L'échange est STRUCTURÉ
 * (besoin, fenêtres souhaitées, proposition versionnée, réponses) : aucune
 * conversation libre dans ce lot, aucune coordonnée, aucune adresse exacte.
 *
 * Idempotence alignée sur le contrat de commande du moteur : même clé et même
 * corps rendent le même résultat ; même clé et autre corps sont un conflit.
 * Le corps comparé est le corps NORMALISÉ (`serviceRequestFingerprint`).
 *
 * Instants : millisecondes UTC, jamais une heure « locale » stockée ; le fuseau
 * IANA dit comment l'heure a été pensée et sert à l'affichage. Une heure
 * murale qui n'existe pas (passage à l'heure d'été) ou qui existe deux fois
 * (retour à l'heure d'hiver) est refusée : l'instant reste exact.
 *
 * Les règles rendent des CODES fermés (`SERVICE_REQUEST_REFUSALS`), traduits
 * par l'interface : aucune phrase ici. Ce module est relu par le moteur (lib
 * ES2021) : aucune API plus récente.
 */
import { parseMoney, type CurrencyCode, type MoneyRefusal } from "./money"
import { ok, refuse, type Result } from "./result"
import { DAY_MS, HOUR_MS, MINUTE_MS } from "./time"

// ═══════════════════════════════════════════════════════════════
// États, gestes et acteurs
// ═══════════════════════════════════════════════════════════════

export const SERVICE_REQUEST_STATUSES = ["sent", "proposed", "confirmed", "completed", "refused", "cancelled", "expired", "no_show"] as const
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number]

/** Une demande encore ouverte à une proposition. */
export const SERVICE_REQUEST_OPEN_STATUSES = ["sent", "proposed"] as const satisfies readonly ServiceRequestStatus[]

/** Les états sans retour : aucune transition n'en sort. */
export const SERVICE_REQUEST_TERMINAL_STATUSES = ["completed", "refused", "cancelled", "expired", "no_show"] as const satisfies readonly ServiceRequestStatus[]

/** Une proposition est la version COURANTE, ou remplacée par une version plus récente. */
export const SERVICE_PROPOSAL_STATES = ["current", "superseded"] as const
export type ServiceProposalState = (typeof SERVICE_PROPOSAL_STATES)[number]

/** Un rendez-vous naît confirmé ; il est ensuite annulé, réalisé ou constaté manqué. */
export const SERVICE_BOOKING_STATUSES = ["confirmed", "cancelled", "completed", "no_show"] as const
export type ServiceBookingStatus = (typeof SERVICE_BOOKING_STATUSES)[number]

export const SERVICE_REQUEST_ACTIONS = ["propose", "refuse", "cancel", "accept", "complete", "no_show"] as const
export type ServiceRequestAction = (typeof SERVICE_REQUEST_ACTIONS)[number]

/** Qui agit : la personne qui demande, ou la page (un de ses signataires VIVANTS). */
export const SERVICE_REQUEST_ACTORS = ["requester", "page"] as const
export type ServiceRequestActor = (typeof SERVICE_REQUEST_ACTORS)[number]

/** Qui a clos une demande : les deux parties, ou le constat d'échéance. */
export const SERVICE_REQUEST_CLOSERS = ["requester", "page", "system"] as const
export type ServiceRequestCloser = (typeof SERVICE_REQUEST_CLOSERS)[number]

/** Où la prestation a lieu : un lieu APPROXIMATIF (ville, quartier), ou à distance. */
export const SERVICE_LOCATION_MODES = ["onsite", "remote"] as const
export type ServiceLocationMode = (typeof SERVICE_LOCATION_MODES)[number]

// ═══════════════════════════════════════════════════════════════
// Bornes
// ═══════════════════════════════════════════════════════════════

export const SERVICE_NEED_MIN_LENGTH = 10
export const SERVICE_NEED_MAX_LENGTH = 1000
/** Une à trois fenêtres souhaitées. */
export const SERVICE_WINDOWS_MAX = 3
export const SERVICE_WINDOW_MIN_MINUTES = 15
export const SERVICE_WINDOW_MAX_DAYS = 14
/** Une fenêtre souhaitée se termine au plus tard dans 90 jours. */
export const SERVICE_REQUEST_HORIZON_DAYS = 90
/** Durée d'un créneau proposé : de 15 minutes à 12 heures. */
export const SERVICE_SLOT_MIN_MINUTES = 15
export const SERVICE_SLOT_MAX_MINUTES = 720
/** Un créneau proposé commence au plus tard dans 180 jours. */
export const SERVICE_SLOT_HORIZON_DAYS = 180
/** Une proposition s'accepte au plus tard 14 jours après son envoi, et avant son début. */
export const SERVICE_PROPOSAL_DEADLINE_MAX_DAYS = 14
/** Dix versions de proposition au plus par demande (lectures bornées). */
export const SERVICE_PROPOSAL_MAX_VERSIONS = 10
export const SERVICE_LOCATION_AREA_MIN_LENGTH = 2
export const SERVICE_LOCATION_AREA_MAX_LENGTH = 80
export const SERVICE_PROPOSAL_DETAILS_MIN_LENGTH = 2
export const SERVICE_PROPOSAL_DETAILS_MAX_LENGTH = 1000
export const SERVICE_CANCELLATION_TERMS_MIN_LENGTH = 2
export const SERVICE_CANCELLATION_TERMS_MAX_LENGTH = 500
export const SERVICE_REASON_MAX_LENGTH = 500
export const SERVICE_TIME_ZONE_MAX_LENGTH = 64
/** Le plus grand instant qu'une date JavaScript sait représenter. */
const MAX_INSTANT = 8_640_000_000_000_000

// ═══════════════════════════════════════════════════════════════
// Refus fermés
// ═══════════════════════════════════════════════════════════════

export const SERVICE_REQUEST_REFUSALS = [
  // Le besoin et les textes libres.
  "request_need_too_short",
  "request_need_too_long",
  "request_contact_forbidden",
  "request_address_forbidden",
  // Les fenêtres souhaitées et les heures saisies.
  "request_windows_required",
  "request_windows_too_many",
  "request_window_invalid",
  "request_window_past",
  "request_window_too_far",
  "request_time_invalid",
  "request_time_nonexistent",
  "request_time_ambiguous",
  "request_time_zone_invalid",
  // L'envoi (faits relus par le fournisseur de données).
  "request_consent_required",
  "request_offer_changed",
  "request_own_page",
  "request_already_open",
  "request_idempotency_conflict",
  // La proposition.
  "proposal_amount_invalid",
  "proposal_currency_invalid",
  "proposal_amount_too_large",
  "proposal_duration_invalid",
  "proposal_start_invalid",
  "proposal_deadline_invalid",
  "proposal_location_invalid",
  "proposal_details_invalid",
  "proposal_terms_invalid",
  "proposal_versions_exhausted",
  "proposal_version_changed",
  // Les transitions.
  "request_expired",
  "request_closed",
  "request_not_open",
  "request_action_forbidden",
  "request_reason_required",
  "request_reason_too_long",
  "booking_started",
  "booking_not_started",
  "booking_slot_unavailable",
  // La contestation d'une absence (DG-015).
  "request_contest_unavailable",
  "request_contest_window_closed",
] as const
export type ServiceRequestRefusal = (typeof SERVICE_REQUEST_REFUSALS)[number]

type TextRefusal = "request_contact_forbidden" | "request_address_forbidden"
type TimeRefusal = "request_time_invalid" | "request_time_nonexistent" | "request_time_ambiguous" | "request_time_zone_invalid"

// ═══════════════════════════════════════════════════════════════
// Textes libres : ni coordonnée, ni adresse exacte
// ═══════════════════════════════════════════════════════════════

/** Forme NFC, fins de ligne unifiées, espaces horizontales simples, au plus une ligne vide. */
export function normalizeServiceText(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Une seule ligne (lieu approximatif). */
function singleLine(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim()
}

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/u
/** Neuf chiffres ou plus, séparés au plus par deux signes de mise en forme : un numéro de téléphone. */
const PHONE_PATTERN = /\d(?:[\s.()-]{0,2}\d){8,}/u
/** Un numéro puis le type de voie : « 12 rue … », « 3 bis, avenue … ». */
const STREET_TYPES = ["rue", "avenue", "av", "boulevard", "bd", "blvd", "chemin", "impasse", "allée", "allee", "place", "quai", "route", "street", "road", "rd", "lane"]
const ADDRESS_PATTERN = new RegExp(`(?<![\\p{L}\\p{N}])\\d{1,4}\\s*(?:bis|ter)?,?\\s+(?:${STREET_TYPES.join("|")})\\.?(?![\\p{L}\\p{N}])`, "iu")
/** Un numéro, un nom de voie à majuscules, puis le type : « 221B Baker Street », « 10 Oak Lane ». */
const ENGLISH_ADDRESS_PATTERN = /(?<![\p{L}\p{N}])\d{1,5}[A-Za-z]?\s+(?:\p{Lu}[\p{L}'-]*\s+){1,3}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Boulevard|Blvd|Way)\.?(?![\p{L}\p{N}])/u

/**
 * Une adresse exacte (numéro et voie, en français ou en anglais) ? La même
 * détection sert aux textes de la demande et aux conversations (D8 du contrat
 * CONVERSATION-CONTEXTUELLE-V1, `conversation-contexts.ts`).
 */
export function containsExactAddress(text: string): boolean {
  return ADDRESS_PATTERN.test(text) || ENGLISH_ADDRESS_PATTERN.test(text)
}

/**
 * Un texte libre qui porte une coordonnée (adresse e-mail, numéro de
 * téléphone) ou une adresse exacte (numéro et voie) est refusé : le contact
 * passe par la messagerie, le lieu reste approximatif. Détection simple, à
 * dessein : elle protège d'un oubli, elle ne prétend pas tout reconnaître.
 */
export function serviceTextRefusal(text: string): TextRefusal | null {
  if (EMAIL_PATTERN.test(text) || PHONE_PATTERN.test(text)) return "request_contact_forbidden"
  if (containsExactAddress(text)) return "request_address_forbidden"
  return null
}

// ═══════════════════════════════════════════════════════════════
// Instants et fuseaux
// ═══════════════════════════════════════════════════════════════

/** Un instant en millisecondes UTC : entier, positif, représentable. */
export function isServiceInstant(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_INSTANT
}

const IANA_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/

/**
 * Le nom CANONIQUE d'un fuseau IANA (« US/Eastern » → « America/New_York »),
 * ou `null`. Validé par `Intl` lui-même : une liste tenue à la main serait
 * fausse un jour. Un décalage fixe (« +02:00 ») n'est pas un fuseau.
 */
export function canonicalTimeZone(raw: string): string | null {
  const zone = raw.trim()
  if (zone.length === 0 || zone.length > SERVICE_TIME_ZONE_MAX_LENGTH || !IANA_NAME.test(zone)) return null
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone
  } catch {
    return null
  }
}

const WALL_FORMATTERS = new Map<string, Intl.DateTimeFormat>()

function wallFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = WALL_FORMATTERS.get(timeZone)
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    WALL_FORMATTERS.set(timeZone, formatter)
  }
  return formatter
}

/** L'heure murale d'un instant dans un fuseau, lue comme si elle était UTC. */
function wallClockOf(instant: number, timeZone: string): number {
  const parts: Record<string, number> = {}
  for (const part of wallFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value)
  }
  return Date.UTC(parts.year ?? 0, (parts.month ?? 1) - 1, parts.day ?? 1, parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0)
}

/**
 * Une date (`AAAA-MM-JJ`) et une heure (`HH:MM`) murales d'un fuseau, en
 * instant UTC EXACT. L'heure qui n'existe pas ce jour-là (passage à l'heure
 * d'été) et celle qui existe deux fois (retour à l'heure d'hiver) sont
 * refusées plutôt que devinées.
 */
export function zonedWallTimeToUtc(input: { readonly date: string; readonly time: string }, timeZone: string): Result<number, TimeRefusal> {
  const zone = canonicalTimeZone(timeZone)
  if (zone === null) return refuse("request_time_zone_invalid")
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.date.trim())
  const time = /^(\d{2}):(\d{2})$/.exec(input.time.trim())
  if (!date || !time) return refuse("request_time_invalid")
  const year = Number(date[1])
  const month = Number(date[2])
  const day = Number(date[3])
  const hour = Number(time[1])
  const minute = Number(time[2])
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  const check = new Date(wall)
  if (hour > 23 || minute > 59 || check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return refuse("request_time_invalid")
  }
  // Les décalages en vigueur autour de cette heure murale (un changement d'heure au plus en pratique).
  const offsets = new Set<number>()
  for (let step = -9; step <= 9; step += 1) {
    const sample = wall + step * 2 * HOUR_MS
    offsets.add(wallClockOf(sample, zone) - sample)
  }
  const instants: number[] = []
  for (const offset of offsets) {
    if (wallClockOf(wall - offset, zone) === wall) instants.push(wall - offset)
  }
  const [instant] = instants
  if (instant === undefined) return refuse("request_time_nonexistent")
  if (instants.length > 1) return refuse("request_time_ambiguous")
  return ok(instant)
}

/** L'heure murale d'un instant dans un fuseau (`AAAA-MM-JJ`, `HH:MM`), ou `null`. */
export function utcToZonedWallTime(instant: number, timeZone: string): { readonly date: string; readonly time: string } | null {
  const zone = canonicalTimeZone(timeZone)
  if (zone === null || !isServiceInstant(instant)) return null
  const wall = new Date(wallClockOf(instant, zone))
  const pad = (value: number, size = 2) => String(value).padStart(size, "0")
  return {
    date: `${pad(wall.getUTCFullYear(), 4)}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}`,
    time: `${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}`,
  }
}

// ═══════════════════════════════════════════════════════════════
// La demande
// ═══════════════════════════════════════════════════════════════

/** Une fenêtre souhaitée, ou un créneau : début inclus, fin exclue, en millisecondes UTC. */
export interface ServiceWindow {
  readonly startAt: number
  readonly endAt: number
}

export interface ServiceRequestDraft {
  readonly need: string
  /** Triées par début, sans doublon. */
  readonly windows: readonly ServiceWindow[]
  /** Le fuseau CANONIQUE du demandeur. */
  readonly timeZone: string
}

/**
 * La FORME d'une demande, indépendante de l'heure : besoin borné et sans
 * coordonnée, une à trois fenêtres bien formées, un fuseau valide. Le rejeu
 * idempotent compare ce corps normalisé ; la date du jour ne le juge pas.
 */
export function normalizeServiceRequestDraft(input: {
  readonly need: string
  readonly windows: readonly ServiceWindow[]
  readonly timeZone: string
}): Result<ServiceRequestDraft, ServiceRequestRefusal> {
  const need = normalizeServiceText(input.need)
  if (need.length < SERVICE_NEED_MIN_LENGTH) return refuse("request_need_too_short")
  if (need.length > SERVICE_NEED_MAX_LENGTH) return refuse("request_need_too_long")
  const textRefusal = serviceTextRefusal(need)
  if (textRefusal !== null) return refuse(textRefusal)
  const timeZone = canonicalTimeZone(input.timeZone)
  if (timeZone === null) return refuse("request_time_zone_invalid")
  if (input.windows.length === 0) return refuse("request_windows_required")
  if (input.windows.length > SERVICE_WINDOWS_MAX) return refuse("request_windows_too_many")
  const windows: ServiceWindow[] = []
  for (const window of input.windows) {
    const length = window.endAt - window.startAt
    if (!isServiceInstant(window.startAt) || !isServiceInstant(window.endAt) || length < SERVICE_WINDOW_MIN_MINUTES * MINUTE_MS || length > SERVICE_WINDOW_MAX_DAYS * DAY_MS) {
      return refuse("request_window_invalid")
    }
    if (!windows.some((kept) => kept.startAt === window.startAt && kept.endAt === window.endAt)) windows.push({ startAt: window.startAt, endAt: window.endAt })
  }
  windows.sort((left, right) => left.startAt - right.startAt || left.endAt - right.endAt)
  return ok({ need, windows, timeZone })
}

/**
 * L'HEURE d'une demande nouvelle : chaque fenêtre commence dans le futur et se
 * termine dans l'horizon. La demande échoit à la fin de sa dernière fenêtre.
 */
export function checkServiceRequestTiming(draft: Pick<ServiceRequestDraft, "windows">, now: number): Result<{ readonly expiresAt: number }, ServiceRequestRefusal> {
  let expiresAt = now
  for (const window of draft.windows) {
    if (window.startAt <= now) return refuse("request_window_past")
    if (window.endAt > now + SERVICE_REQUEST_HORIZON_DAYS * DAY_MS) return refuse("request_window_too_far")
    expiresAt = Math.max(expiresAt, window.endAt)
  }
  return ok({ expiresAt })
}

/** Une clé d'idempotence fournie par le client : 16 à 128 signes sûrs (un UUID convient). */
export function isServiceIdempotencyKey(value: string): boolean {
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
export function serviceRequestFingerprint(body: ServiceRequestDraft & { readonly offerId: string; readonly offerVersion: number }): string {
  const canonical = JSON.stringify(["v1", body.offerId, body.offerVersion, body.need, body.windows.map((window) => [window.startAt, window.endAt]), body.timeZone])
  return `v1:${hash64(canonical)}`
}

// ═══════════════════════════════════════════════════════════════
// La proposition
// ═══════════════════════════════════════════════════════════════

export type ServiceLocation = { readonly mode: "remote" } | { readonly mode: "onsite"; readonly area: string }

export interface ServiceProposalInput {
  readonly amountMinor: number
  readonly currency: string
  readonly durationMinutes: number
  readonly startAt: number
  readonly timeZone: string
  readonly location: ServiceLocation
  readonly details: string
  readonly cancellationTerms: string
  readonly expiresAt: number
}

export interface ServiceProposalTerms {
  readonly amountMinor: number
  readonly currency: CurrencyCode
  readonly durationMinutes: number
  readonly startAt: number
  readonly endAt: number
  readonly timeZone: string
  readonly location: ServiceLocation
  readonly details: string
  readonly cancellationTerms: string
  readonly expiresAt: number
}

const MONEY_REFUSAL_CODES: Readonly<Record<MoneyRefusal, ServiceRequestRefusal>> = {
  currency_invalid: "proposal_currency_invalid",
  amount_invalid: "proposal_amount_invalid",
  amount_too_large: "proposal_amount_too_large",
}

function boundedText(raw: string, min: number, max: number): string | null {
  const text = normalizeServiceText(raw)
  return text.length < min || text.length > max ? null : text
}

/**
 * Une proposition complète : un MONTANT (en unités mineures, devise ISO 4217),
 * une durée, un créneau futur, un fuseau, un lieu approximatif ou à distance,
 * le contenu de la prestation, ses conditions d'annulation et l'échéance de
 * l'accord (future, à 14 jours au plus, avant le début du créneau).
 */
export function parseServiceProposal(input: ServiceProposalInput, now: number): Result<ServiceProposalTerms, ServiceRequestRefusal> {
  const money = parseMoney({ amountMinor: input.amountMinor, currency: input.currency })
  if (!money.ok) return refuse(MONEY_REFUSAL_CODES[money.code])
  const { durationMinutes, startAt, expiresAt } = input
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes < SERVICE_SLOT_MIN_MINUTES || durationMinutes > SERVICE_SLOT_MAX_MINUTES) {
    return refuse("proposal_duration_invalid")
  }
  if (!isServiceInstant(startAt) || startAt <= now || startAt > now + SERVICE_SLOT_HORIZON_DAYS * DAY_MS) return refuse("proposal_start_invalid")
  const timeZone = canonicalTimeZone(input.timeZone)
  if (timeZone === null) return refuse("request_time_zone_invalid")
  let location: ServiceLocation = { mode: "remote" }
  if (input.location.mode === "onsite") {
    const area = singleLine(input.location.area)
    if (area.length < SERVICE_LOCATION_AREA_MIN_LENGTH || area.length > SERVICE_LOCATION_AREA_MAX_LENGTH) return refuse("proposal_location_invalid")
    location = { mode: "onsite", area }
  }
  const details = boundedText(input.details, SERVICE_PROPOSAL_DETAILS_MIN_LENGTH, SERVICE_PROPOSAL_DETAILS_MAX_LENGTH)
  if (details === null) return refuse("proposal_details_invalid")
  const cancellationTerms = boundedText(input.cancellationTerms, SERVICE_CANCELLATION_TERMS_MIN_LENGTH, SERVICE_CANCELLATION_TERMS_MAX_LENGTH)
  if (cancellationTerms === null) return refuse("proposal_terms_invalid")
  for (const text of [location.mode === "onsite" ? location.area : "", details, cancellationTerms]) {
    const textRefusal = serviceTextRefusal(text)
    if (textRefusal !== null) return refuse(textRefusal)
  }
  if (!isServiceInstant(expiresAt) || expiresAt <= now || expiresAt > now + SERVICE_PROPOSAL_DEADLINE_MAX_DAYS * DAY_MS || expiresAt > startAt) {
    return refuse("proposal_deadline_invalid")
  }
  return ok({
    amountMinor: money.value.amountMinor,
    currency: money.value.currency,
    durationMinutes,
    startAt,
    endAt: startAt + durationMinutes * MINUTE_MS,
    timeZone,
    location,
    details,
    cancellationTerms,
    expiresAt,
  })
}

/** La version citée par un geste doit être la version COURANTE (deux onglets, deux signataires). */
export function checkProposalVersion(expected: number, current: number): Result<null, "proposal_version_changed"> {
  return expected === current ? ok(null) : refuse("proposal_version_changed")
}

/** La version suivante d'une proposition, dans la limite des dix versions. */
export function nextProposalVersion(current: number): Result<number, "proposal_versions_exhausted"> {
  return current >= SERVICE_PROPOSAL_MAX_VERSIONS ? refuse("proposal_versions_exhausted") : ok(current + 1)
}

/** Un motif libre : facultatif ou requis, borné, sans coordonnée. */
export function parseServiceReason(raw: string | null | undefined, required: boolean): Result<string | null, ServiceRequestRefusal> {
  const reason = raw ? normalizeServiceText(raw) : ""
  if (reason.length === 0) return required ? refuse("request_reason_required") : ok(null)
  if (reason.length > SERVICE_REASON_MAX_LENGTH) return refuse("request_reason_too_long")
  const textRefusal = serviceTextRefusal(reason)
  return textRefusal === null ? ok(reason) : refuse(textRefusal)
}

// ═══════════════════════════════════════════════════════════════
// Échéances, créneaux et transitions
// ═══════════════════════════════════════════════════════════════

export function isServiceRequestTerminal(status: ServiceRequestStatus): boolean {
  return (SERVICE_REQUEST_TERMINAL_STATUSES as readonly ServiceRequestStatus[]).includes(status)
}

/**
 * L'échéance qui court : celle de la demande tant qu'aucune proposition n'est
 * faite, celle de la proposition COURANTE ensuite ; aucune après l'accord.
 */
export function serviceRequestDeadline(request: { readonly status: ServiceRequestStatus; readonly expiresAt: number; readonly proposalExpiresAt: number | null }): number | null {
  if (request.status === "sent") return request.expiresAt
  if (request.status === "proposed") return request.proposalExpiresAt
  return null
}

/**
 * L'état EFFECTIF : une demande ouverte dont l'échéance est atteinte est
 * expirée, que le passage d'expiration l'ait déjà écrit ou non. Rien d'autre
 * ne change avec le temps : un rendez-vous n'est jamais « réalisé » faute de
 * réponse.
 */
export function effectiveServiceRequestStatus(request: { readonly status: ServiceRequestStatus; readonly deadlineAt: number | null }, now: number): ServiceRequestStatus {
  return (request.status === "sent" || request.status === "proposed") && request.deadlineAt !== null && now >= request.deadlineAt ? "expired" : request.status
}

/** Deux créneaux se chevauchent-ils ? Début inclus, fin exclue : 10 h–11 h et 11 h–12 h se suivent. */
export function slotsOverlap(left: ServiceWindow, right: ServiceWindow): boolean {
  return left.startAt < right.endAt && right.startAt < left.endAt
}

const TRANSITIONS: Readonly<Record<ServiceRequestAction, { readonly actors: readonly ServiceRequestActor[]; readonly from: readonly ServiceRequestStatus[]; readonly to: ServiceRequestStatus }>> = {
  propose: { actors: ["page"], from: ["sent", "proposed"], to: "proposed" },
  refuse: { actors: ["page"], from: ["sent", "proposed"], to: "refused" },
  cancel: { actors: ["requester", "page"], from: ["sent", "proposed", "confirmed"], to: "cancelled" },
  accept: { actors: ["requester"], from: ["proposed"], to: "confirmed" },
  complete: { actors: ["page"], from: ["confirmed"], to: "completed" },
  no_show: { actors: ["page"], from: ["confirmed"], to: "no_show" },
}

export interface ServiceRequestTransitionInput {
  readonly action: ServiceRequestAction
  readonly actor: ServiceRequestActor
  /** L'état EFFECTIF (`effectiveServiceRequestStatus`). */
  readonly status: ServiceRequestStatus
  readonly now: number
  /** Le début du rendez-vous confirmé ; `null` avant l'accord. */
  readonly bookingStartAt: number | null
}

/**
 * Qui peut faire quoi, et quand. Avant l'accord, la page propose ou décline,
 * le demandeur accepte la version courante ou retire sa demande. Après
 * l'accord, l'une ou l'autre partie annule AVANT le début (motif requis) ; la
 * page constate ensuite la réalisation ou l'absence, jamais avant le début.
 */
export function checkServiceRequestTransition(input: ServiceRequestTransitionInput): Result<ServiceRequestStatus, ServiceRequestRefusal> {
  if (input.status === "expired") return refuse("request_expired")
  if (isServiceRequestTerminal(input.status)) return refuse("request_closed")
  const rule = TRANSITIONS[input.action]
  if (!rule.actors.includes(input.actor)) return refuse("request_action_forbidden")
  // Avant l'accord, la page DÉCLINE (refus) : elle n'annule que le rendez-vous convenu.
  if (input.action === "cancel" && input.actor === "page" && input.status !== "confirmed") return refuse("request_action_forbidden")
  if (!rule.from.includes(input.status)) return refuse("request_not_open")
  if (input.status === "confirmed") {
    if (input.bookingStartAt === null) return refuse("request_not_open")
    if (input.action === "cancel" && input.now >= input.bookingStartAt) return refuse("booking_started")
    if (input.action !== "cancel" && input.now < input.bookingStartAt) return refuse("booking_not_started")
  }
  return ok(rule.to)
}

/** Le délai pour contester une absence déclarée par la page (DG-015), compté depuis le constat. */
export const SERVICE_NO_SHOW_CONTEST_DAYS = 14

export interface NoShowContestInput {
  /** L'état EFFECTIF de la demande. */
  readonly status: ServiceRequestStatus
  /** L'instant du constat d'absence par la page ; `null` s'il n'y en a pas. */
  readonly declaredAt: number | null
  /** L'instant d'une contestation déjà posée ; `null` sinon. */
  readonly contestedAt: number | null
  readonly now: number
}

/**
 * DG-015 : la personne qui demande conteste l'ABSENCE que la page a déclarée, une seule fois,
 * dans les quatorze jours qui suivent le constat, avec un motif. La contestation ne réécrit
 * pas l'historique : l'état reste `no_show`, la contestation s'y ajoute, lisible des deux
 * côtés, et rend au demandeur son droit d'avis (preuve « rendez-vous confirmé »), pour
 * qu'un constat d'absence ne serve jamais à écarter un avis. Rejouée, elle rend `already` :
 * la première contestation reste la seule.
 */
export function checkNoShowContest(input: NoShowContestInput): Result<"contest" | "already", ServiceRequestRefusal> {
  if (input.status !== "no_show" || input.declaredAt === null) return refuse("request_contest_unavailable")
  if (input.contestedAt !== null) return ok("already")
  if (input.now > input.declaredAt + SERVICE_NO_SHOW_CONTEST_DAYS * DAY_MS) return refuse("request_contest_window_closed")
  return ok("contest")
}

/** Le geste de contestation est-il ouvert maintenant ? L'écran ne montre pas un bouton qu'un refus attend. */
export function canContestNoShow(input: NoShowContestInput): boolean {
  const verdict = checkNoShowContest(input)
  return verdict.ok && verdict.value === "contest"
}

/** Les gestes RÉELLEMENT ouverts à cet acteur maintenant : l'écran ne montre pas de bouton qu'un refus attend. */
export function availableServiceRequestActions(input: {
  readonly actor: ServiceRequestActor
  readonly status: ServiceRequestStatus
  readonly now: number
  readonly bookingStartAt: number | null
  readonly proposalVersion: number
}): ServiceRequestAction[] {
  return SERVICE_REQUEST_ACTIONS.filter(
    (action) =>
      (action !== "propose" || input.proposalVersion < SERVICE_PROPOSAL_MAX_VERSIONS) &&
      checkServiceRequestTransition({ action, actor: input.actor, status: input.status, now: input.now, bookingStartAt: input.bookingStartAt }).ok,
  )
}

export interface ServiceRequestEvent {
  readonly status: ServiceRequestStatus
  readonly at: number
  /** La version d'une proposition ; `null` pour les autres étapes. */
  readonly version: number | null
}

/**
 * La chronologie d'une demande, DÉRIVÉE de ses faits (envoi, versions de
 * proposition, accord, clôture) : aucun historique recopié. Une échéance
 * atteinte que le passage d'expiration n'a pas encore écrite y figure aussi.
 */
export function serviceRequestTimeline(input: {
  readonly createdAt: number
  readonly proposals: readonly { readonly version: number; readonly createdAt: number }[]
  readonly confirmedAt: number | null
  readonly closed: { readonly status: ServiceRequestStatus; readonly at: number } | null
  readonly effectiveStatus: ServiceRequestStatus
  readonly deadlineAt: number | null
}): ServiceRequestEvent[] {
  const events: ServiceRequestEvent[] = [{ status: "sent", at: input.createdAt, version: null }]
  for (const proposal of [...input.proposals].sort((left, right) => left.version - right.version)) {
    events.push({ status: "proposed", at: proposal.createdAt, version: proposal.version })
  }
  if (input.confirmedAt !== null) events.push({ status: "confirmed", at: input.confirmedAt, version: null })
  if (input.closed !== null) events.push({ status: input.closed.status, at: input.closed.at, version: null })
  else if (input.effectiveStatus === "expired" && input.deadlineAt !== null) events.push({ status: "expired", at: input.deadlineAt, version: null })
  return events
}
