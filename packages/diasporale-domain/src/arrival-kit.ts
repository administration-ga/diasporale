/**
 * Kit d'arrivée DIASPORALE (DG-024 b, plan global §4 G8 point 3) — règles pures des
 * ressources pratiques DATÉES, par pays et par ville : rubrique fermée, textes bornés
 * sans coordonnée, source citée (nom et adresse https, sans identifiant de suivi),
 * date de dernière vérification, cycle brouillon → soumise → publiée → à revoir →
 * archivée, relecture par une AUTRE personne habilitée, signalement « information
 * périmée ». PROPRIÉTAIRE : chantier « kit d'arrivée ».
 *
 * Une ressource communautaire ne revendique aucune autorité : seule une page au badge
 * « Officiel » CALCULÉ côté serveur porte une ressource qui se dit officielle. Les
 * mêmes règles servent le formulaire, le fournisseur de démonstration et la tranche
 * `convex/modules/diaspora/arrivalKit.ts` du moteur : un refus ici l'est partout, avec
 * le même code fermé.
 */
import type { PageOwnerKind } from "./badges"
import { HOME_COUNTRY, isCountryCode, normalizeCountryCode, type CountryCode } from "./countries"
import { hasCapability, type MembershipStatus } from "./eligibility"
import { ok, refuse, type Result } from "./result"
import { cityKeyOf, containsContactDetails } from "./services"
import { DAY_MS } from "./time"

// ═══════════════════════════════════════════════════════════════
// Listes fermées
// ═══════════════════════════════════════════════════════════════

/** Les rubriques du kit, dans l'ordre de l'écran (démarches, logement… urgence). */
export const ARRIVAL_KIT_CATEGORIES = [
  "procedures",
  "housing",
  "health",
  "banking",
  "transport",
  "employment",
  "schooling",
  "culture_associations",
  "emergency",
] as const
export type ArrivalKitCategory = (typeof ARRIVAL_KIT_CATEGORIES)[number]

/**
 * Le cycle d'une ressource : brouillon → soumise → publiée → à revoir → archivée.
 * Toute nouvelle version repasse par la relecture ; archivée est terminale.
 */
export const ARRIVAL_KIT_STATUSES = ["draft", "submitted", "published", "needs_review", "archived"] as const
export type ArrivalKitStatus = (typeof ARRIVAL_KIT_STATUSES)[number]

/** Les états lus dans le kit public : publiée, et à revoir (lue avec son avertissement). */
export const ARRIVAL_KIT_LISTED_STATUSES = ["published", "needs_review"] as const satisfies readonly ArrivalKitStatus[]

/**
 * Les gestes sur une ressource : enregistrer une version (brouillon, ou soumise
 * aussitôt), soumettre un brouillon tel quel, publier ou renvoyer (relecture),
 * marquer « à revoir » (relecture), archiver (qui gère la ressource).
 */
export const ARRIVAL_KIT_GESTURES = ["save_draft", "save_and_submit", "submit", "publish", "return", "mark_needs_review", "archive"] as const
export type ArrivalKitGesture = (typeof ARRIVAL_KIT_GESTURES)[number]

/** Ce que décide la relecture d'une version soumise : la publier, ou la renvoyer avec un motif. */
export const ARRIVAL_KIT_REVIEW_DECISIONS = ["publish", "return"] as const satisfies readonly ArrivalKitGesture[]
export type ArrivalKitReviewDecision = (typeof ARRIVAL_KIT_REVIEW_DECISIONS)[number]

/** Le journal des relectures : version publiée, renvoyée, ou marquée « à revoir ». */
export const ARRIVAL_KIT_REVIEW_OUTCOMES = ["published", "returned", "needs_review"] as const
export type ArrivalKitReviewOutcome = (typeof ARRIVAL_KIT_REVIEW_OUTCOMES)[number]

/** Pourquoi une ressource est « à revoir » : vérification trop ancienne, signalements, ou relecture. */
export const ARRIVAL_KIT_REVIEW_CAUSES = ["age", "flags", "reviewer"] as const
export type ArrivalKitReviewCause = (typeof ARRIVAL_KIT_REVIEW_CAUSES)[number]

/** Motifs FERMÉS d'un signalement « information périmée » : aucun texte libre, aucune donnée personnelle. */
export const ARRIVAL_KIT_OUTDATED_REASONS = ["link_broken", "information_changed", "service_closed", "other"] as const
export type ArrivalKitOutdatedReason = (typeof ARRIVAL_KIT_OUTDATED_REASONS)[number]

/**
 * Les pages qui peuvent porter une ressource : une institution (un poste
 * consulaire), une association ou une page de communauté. Une entreprise ou un
 * média n'y place pas de contenu promotionnel.
 */
export const ARRIVAL_KIT_CARRIER_OWNER_KINDS = ["institution", "association", "community"] as const satisfies readonly PageOwnerKind[]
export type ArrivalKitCarrierOwnerKind = (typeof ARRIVAL_KIT_CARRIER_OWNER_KINDS)[number]

// ═══════════════════════════════════════════════════════════════
// Bornes
// ═══════════════════════════════════════════════════════════════

export const ARRIVAL_KIT_TITLE_MIN_LENGTH = 5
export const ARRIVAL_KIT_TITLE_MAX_LENGTH = 120
export const ARRIVAL_KIT_SUMMARY_MIN_LENGTH = 20
export const ARRIVAL_KIT_SUMMARY_MAX_LENGTH = 300
export const ARRIVAL_KIT_BODY_MIN_LENGTH = 40
export const ARRIVAL_KIT_BODY_MAX_LENGTH = 5000
/** Même borne que la ville d'une facette : un nom de ville, pas une adresse. */
export const ARRIVAL_KIT_CITY_MAX_LENGTH = 80
export const ARRIVAL_KIT_SOURCE_NAME_MIN_LENGTH = 3
export const ARRIVAL_KIT_SOURCE_NAME_MAX_LENGTH = 120
export const ARRIVAL_KIT_SOURCE_URL_MAX_LENGTH = 2048
/** Motif d'un renvoi ou d'une mise « à revoir » : une explication, pas un mot. */
export const ARRIVAL_KIT_REASON_MIN_LENGTH = 10
export const ARRIVAL_KIT_REASON_MAX_LENGTH = 500
/** Une vérification vaut douze mois ; au-delà, la ressource est « à revoir ». */
export const ARRIVAL_KIT_VERIFICATION_VALIDITY_MONTHS = 12
/** Tolérance de fuseau : une date de vérification « demain » (l'heure UTC devance la locale) reste admise. */
export const ARRIVAL_KIT_VERIFIED_AT_FUTURE_TOLERANCE_MS = DAY_MS
/** Signalements distincts sur une même version à partir desquels elle est « à revoir ». */
export const ARRIVAL_KIT_OUTDATED_FLAG_THRESHOLD = 3
/** Ressources non archivées par personne qui propose : une contribution, pas un annuaire. */
export const ARRIVAL_KIT_RESOURCES_PER_PROPOSER_MAX = 30
/** Taille d'une page de lecture (kit, file de relecture, mes propositions), plafond dur du moteur. */
export const ARRIVAL_KIT_PAGE_SIZE = 20

// ═══════════════════════════════════════════════════════════════
// Refus — codes FERMÉS, traduits par l'écran
// ═══════════════════════════════════════════════════════════════

export const ARRIVAL_KIT_REFUSALS = [
  "arrival_kit_title_too_short",
  "arrival_kit_title_too_long",
  "arrival_kit_summary_too_short",
  "arrival_kit_summary_too_long",
  "arrival_kit_body_too_short",
  "arrival_kit_body_too_long",
  /** Téléphone, adresse e-mail ou lien dans le texte : l'adresse de la source a son propre champ. */
  "arrival_kit_contact_details_forbidden",
  "arrival_kit_category_invalid",
  "arrival_kit_country_required",
  "arrival_kit_country_unknown",
  "arrival_kit_country_is_home",
  "arrival_kit_city_too_long",
  "arrival_kit_city_invalid",
  "arrival_kit_source_name_too_short",
  "arrival_kit_source_name_too_long",
  "arrival_kit_source_url_required",
  "arrival_kit_source_url_invalid",
  "arrival_kit_source_url_not_https",
  "arrival_kit_verified_at_invalid",
  "arrival_kit_verified_at_in_future",
  /** La source n'a pas été vérifiée depuis douze mois : la date doit être actualisée avant toute relecture. */
  "arrival_kit_verified_at_too_old",
  "arrival_kit_reason_too_short",
  "arrival_kit_reason_too_long",
  "arrival_kit_outdated_reason_invalid",
  "arrival_kit_transition_invalid",
  /** Une ressource archivée est terminale : ni modifiée, ni republiée. */
  "arrival_kit_archived",
  /** La ressource a changé depuis sa lecture (version attendue périmée). */
  "arrival_kit_version_conflict",
  /** Relire est réservé à un membre vérifié ou au signataire vivant d'une page. */
  "arrival_kit_reviewer_not_eligible",
  /** Personne ne relit ce qu'elle a écrit, ni ce que porte une page dont elle est signataire. */
  "arrival_kit_review_own_resource",
  "arrival_kit_not_flaggable",
  "arrival_kit_flag_own_resource",
  /** Un seul signalement par personne et par version. */
  "arrival_kit_already_flagged",
  "arrival_kit_resource_limit_reached",
  "arrival_kit_page_kind_not_allowed",
] as const
export type ArrivalKitRefusal = (typeof ARRIVAL_KIT_REFUSALS)[number]

// ═══════════════════════════════════════════════════════════════
// Gardes de type
// ═══════════════════════════════════════════════════════════════

export function isArrivalKitCategory(value: string): value is ArrivalKitCategory {
  return (ARRIVAL_KIT_CATEGORIES as readonly string[]).includes(value)
}

export function isArrivalKitOutdatedReason(value: string): value is ArrivalKitOutdatedReason {
  return (ARRIVAL_KIT_OUTDATED_REASONS as readonly string[]).includes(value)
}

export function isArrivalKitCarrierKind(kind: string): kind is ArrivalKitCarrierOwnerKind {
  return (ARRIVAL_KIT_CARRIER_OWNER_KINDS as readonly string[]).includes(kind)
}

/** La ressource se lit-elle dans le kit public ? Publiée, ou à revoir (avec son avertissement). */
export function isArrivalKitListed(status: ArrivalKitStatus): boolean {
  return (ARRIVAL_KIT_LISTED_STATUSES as readonly ArrivalKitStatus[]).includes(status)
}

// ═══════════════════════════════════════════════════════════════
// Textes
// ═══════════════════════════════════════════════════════════════

/** Une ligne : espaces et retours resserrés en une espace. */
function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

/** Un texte long : fins de ligne unifiées, deux lignes vides au plus, bords nets. */
function textBlock(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 31 || code === 127) return true
  }
  return false
}

/** Le pays de la ressource : un pays de résidence de la diaspora, jamais le Gabon. */
export function parseArrivalKitCountry(raw: string | null | undefined): Result<CountryCode, ArrivalKitRefusal> {
  const code = normalizeCountryCode(raw ?? "")
  if (code.length === 0) return refuse("arrival_kit_country_required")
  if (!isCountryCode(code)) return refuse("arrival_kit_country_unknown")
  if (code === HOME_COUNTRY) return refuse("arrival_kit_country_is_home")
  return ok(code)
}

/**
 * La ville, FACULTATIVE : vide, la ressource vaut pour tout le pays (clé vide).
 * Saisie libre, sans GPS ; repliée comme celle du catalogue (`cityKeyOf`), pour
 * que « Saint-Étienne » et « saint etienne » désignent la même ville.
 */
export function parseArrivalKitCity(raw: string | null | undefined): Result<{ readonly city: string | null; readonly cityKey: string }, ArrivalKitRefusal> {
  const city = oneLine(raw ?? "")
  if (city.length === 0) return ok({ city: null, cityKey: "" })
  if (city.length > ARRIVAL_KIT_CITY_MAX_LENGTH) return refuse("arrival_kit_city_too_long")
  const cityKey = cityKeyOf(city)
  if (cityKey.length === 0 || containsContactDetails(city)) return refuse("arrival_kit_city_invalid")
  return ok({ city, cityKey })
}

const EMAIL_IN_NAME = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i
/** Neuf chiffres au moins, séparés ou non : un numéro de téléphone (même règle que le catalogue). */
const PHONE_IN_NAME = /\+?\d(?:[\s().-]*\d){8,}/

/**
 * Le NOM de la source : une ligne bornée. Un nom de site (« service-public.fr »)
 * y est admis — c'est le nom de la source — mais ni adresse e-mail ni téléphone.
 */
export function parseArrivalKitSourceName(raw: string): Result<string, ArrivalKitRefusal> {
  const name = oneLine(raw)
  if (name.length < ARRIVAL_KIT_SOURCE_NAME_MIN_LENGTH) return refuse("arrival_kit_source_name_too_short")
  if (name.length > ARRIVAL_KIT_SOURCE_NAME_MAX_LENGTH) return refuse("arrival_kit_source_name_too_long")
  if (EMAIL_IN_NAME.test(name) || PHONE_IN_NAME.test(name)) return refuse("arrival_kit_contact_details_forbidden")
  return ok(name)
}

/** Paramètres de suivi retirés d'une adresse de source (en plus de tout `utm_…`). */
const TRACKING_PARAMETERS: ReadonlySet<string> = new Set(["fbclid", "gclid", "dclid", "gbraid", "wbraid", "msclkid", "mc_cid", "mc_eid", "igshid", "yclid"])

/** Un paramètre d'adresse est-il un identifiant de suivi (`utm_*`, identifiants de clic) ? */
export function isArrivalKitTrackingParameter(name: string): boolean {
  const key = name.toLowerCase()
  return key.startsWith("utm_") || TRACKING_PARAMETERS.has(key)
}

/** Un hôte PUBLIC nommé : ni adresse IP, ni nom local ou réservé, ni nom sans domaine. */
function isPublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "")
  if (host.length === 0 || host.length > 253 || !host.includes(".") || host.includes(":") || host.startsWith("[")) return false
  if (/^\d+(?:\.\d+){3}$/.test(host)) return false
  return !/(?:^|\.)(?:localhost|local|localdomain|internal|home|invalid|test|onion)$/.test(host)
}

/**
 * L'adresse de la source : absolue, en https SEULEMENT, vers un site public nommé,
 * sans identifiants de connexion. Les identifiants de suivi (`utm_*`, identifiants
 * de clic) sont RETIRÉS ; l'adresse rendue est la forme normalisée qui sera
 * enregistrée — et l'écran l'ouvre dans un nouvel onglet, sans référent.
 */
export function parseArrivalKitSourceUrl(raw: string): Result<string, ArrivalKitRefusal> {
  const value = raw.trim()
  if (value.length === 0) return refuse("arrival_kit_source_url_required")
  if (value.length > ARRIVAL_KIT_SOURCE_URL_MAX_LENGTH || /\s/.test(value) || value.includes("\\") || hasControlCharacter(value)) {
    return refuse("arrival_kit_source_url_invalid")
  }
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value)
  if (scheme === null) return refuse("arrival_kit_source_url_invalid")
  if (scheme[1]?.toLowerCase() !== "https") return refuse("arrival_kit_source_url_not_https")
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return refuse("arrival_kit_source_url_invalid")
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || !isPublicHostname(url.hostname)) {
    return refuse("arrival_kit_source_url_invalid")
  }
  // Les noms d'abord, la suppression ensuite : on ne retire rien pendant le parcours.
  const names: string[] = []
  url.searchParams.forEach((_value, name) => {
    names.push(name)
  })
  for (const name of names) {
    if (isArrivalKitTrackingParameter(name)) url.searchParams.delete(name)
  }
  const normalized = url.toString()
  return normalized.length > ARRIVAL_KIT_SOURCE_URL_MAX_LENGTH ? refuse("arrival_kit_source_url_invalid") : ok(normalized)
}

// ═══════════════════════════════════════════════════════════════
// Dates : vérification et révision
// ═══════════════════════════════════════════════════════════════

/** L'instant où une vérification cesse de valoir : douze mois CALENDAIRES après elle (UTC). */
export function arrivalKitReviewDueAt(lastVerifiedAt: number): number {
  const date = new Date(lastVerifiedAt)
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + ARRIVAL_KIT_VERIFICATION_VALIDITY_MONTHS,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  )
}

/**
 * La date de dernière vérification auprès de la source : un instant réel, pas
 * dans le futur (au-delà d'un jour de fuseau), et de moins de douze mois — une
 * vérification plus ancienne doit être refaite avant de proposer ou de publier.
 */
export function parseArrivalKitVerifiedAt(raw: number, now: number): Result<number, ArrivalKitRefusal> {
  if (!Number.isSafeInteger(raw) || raw <= 0) return refuse("arrival_kit_verified_at_invalid")
  if (raw > now + ARRIVAL_KIT_VERIFIED_AT_FUTURE_TOLERANCE_MS) return refuse("arrival_kit_verified_at_in_future")
  if (arrivalKitReviewDueAt(raw) <= now) return refuse("arrival_kit_verified_at_too_old")
  return ok(raw)
}

/** Une date de formulaire (`AAAA-MM-JJ`) → minuit UTC de ce jour, ou `null` si la date n'existe pas. */
export function parseArrivalKitDateInput(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (match === null) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const at = Date.UTC(year, month - 1, day)
  const date = new Date(at)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? at : null
}

/** Un instant → la date de formulaire (`AAAA-MM-JJ`) de son jour UTC. */
export function formatArrivalKitDateInput(at: number): string {
  return new Date(at).toISOString().slice(0, 10)
}

// ═══════════════════════════════════════════════════════════════
// Une ressource : saisie → version validée
// ═══════════════════════════════════════════════════════════════

/** Ce que la personne saisit (formulaire, arguments d'une mutation) : rien n'y est encore garanti. */
export interface ArrivalKitResourceInput {
  readonly title: string
  readonly summary: string
  readonly body: string
  readonly category: string
  readonly country: string
  /** Facultative : vide ou absente, la ressource vaut pour tout le pays. */
  readonly city?: string | null | undefined
  readonly sourceName: string
  readonly sourceUrl: string
  /** Date de dernière vérification auprès de la source (ms UTC). */
  readonly lastVerifiedAt: number
}

/** Une version VALIDÉE, normalisée, prête à être écrite (moteur) ou gardée (démonstration). */
export interface ArrivalKitResourceDraft {
  readonly title: string
  readonly summary: string
  readonly body: string
  readonly category: ArrivalKitCategory
  readonly country: CountryCode
  readonly city: string | null
  /** La ville repliée ; chaîne vide pour une ressource valable dans tout le pays. */
  readonly cityKey: string
  readonly sourceName: string
  /** L'adresse normalisée, en https, sans identifiant de suivi. */
  readonly sourceUrl: string
  readonly lastVerifiedAt: number
}

/**
 * LA règle d'une version de ressource. Ordre des contrôles (le premier refus est
 * rendu) : titre, résumé, contenu, coordonnées, rubrique, pays, ville, nom de la
 * source, adresse de la source, date de vérification.
 */
export function parseArrivalKitResource(input: ArrivalKitResourceInput, now: number): Result<ArrivalKitResourceDraft, ArrivalKitRefusal> {
  const title = oneLine(input.title)
  if (title.length < ARRIVAL_KIT_TITLE_MIN_LENGTH) return refuse("arrival_kit_title_too_short")
  if (title.length > ARRIVAL_KIT_TITLE_MAX_LENGTH) return refuse("arrival_kit_title_too_long")
  const summary = oneLine(input.summary)
  if (summary.length < ARRIVAL_KIT_SUMMARY_MIN_LENGTH) return refuse("arrival_kit_summary_too_short")
  if (summary.length > ARRIVAL_KIT_SUMMARY_MAX_LENGTH) return refuse("arrival_kit_summary_too_long")
  const body = textBlock(input.body)
  if (body.length < ARRIVAL_KIT_BODY_MIN_LENGTH) return refuse("arrival_kit_body_too_short")
  if (body.length > ARRIVAL_KIT_BODY_MAX_LENGTH) return refuse("arrival_kit_body_too_long")
  if (containsContactDetails(title) || containsContactDetails(summary) || containsContactDetails(body)) return refuse("arrival_kit_contact_details_forbidden")
  if (!isArrivalKitCategory(input.category)) return refuse("arrival_kit_category_invalid")
  const country = parseArrivalKitCountry(input.country)
  if (!country.ok) return country
  const city = parseArrivalKitCity(input.city)
  if (!city.ok) return city
  const sourceName = parseArrivalKitSourceName(input.sourceName)
  if (!sourceName.ok) return sourceName
  const sourceUrl = parseArrivalKitSourceUrl(input.sourceUrl)
  if (!sourceUrl.ok) return sourceUrl
  const lastVerifiedAt = parseArrivalKitVerifiedAt(input.lastVerifiedAt, now)
  if (!lastVerifiedAt.ok) return lastVerifiedAt
  return ok({
    title,
    summary,
    body,
    category: input.category,
    country: country.value,
    city: city.value.city,
    cityKey: city.value.cityKey,
    sourceName: sourceName.value,
    sourceUrl: sourceUrl.value,
    lastVerifiedAt: lastVerifiedAt.value,
  })
}

/** Le motif d'un renvoi ou d'une mise « à revoir » : obligatoire, borné, sans coordonnée. */
export function parseArrivalKitReason(raw: string | null | undefined): Result<string, ArrivalKitRefusal> {
  const reason = textBlock(raw ?? "")
  if (reason.length < ARRIVAL_KIT_REASON_MIN_LENGTH) return refuse("arrival_kit_reason_too_short")
  if (reason.length > ARRIVAL_KIT_REASON_MAX_LENGTH) return refuse("arrival_kit_reason_too_long")
  if (containsContactDetails(reason)) return refuse("arrival_kit_contact_details_forbidden")
  return ok(reason)
}

// ═══════════════════════════════════════════════════════════════
// Cycle d'une ressource
// ═══════════════════════════════════════════════════════════════

/** Depuis quels états chaque geste est admis (archivée : aucun). */
const GESTURE_SOURCES: Readonly<Record<ArrivalKitGesture, readonly ArrivalKitStatus[]>> = Object.freeze({
  save_draft: ["draft", "submitted", "published", "needs_review"],
  save_and_submit: ["draft", "submitted", "published", "needs_review"],
  submit: ["draft"],
  publish: ["submitted"],
  return: ["submitted"],
  mark_needs_review: ["published"],
  archive: ["draft", "submitted", "published", "needs_review"],
})

/** L'état où chaque geste mène : une version enregistrée quitte le kit public jusqu'à sa relecture. */
const GESTURE_TARGETS: Readonly<Record<ArrivalKitGesture, ArrivalKitStatus>> = Object.freeze({
  save_draft: "draft",
  save_and_submit: "submitted",
  submit: "submitted",
  publish: "published",
  return: "draft",
  mark_needs_review: "needs_review",
  archive: "archived",
})

/** L'état après un geste, ou le refus : archivée est terminale, et chaque geste a ses états de départ. */
export function transitionArrivalKit(from: ArrivalKitStatus, gesture: ArrivalKitGesture): Result<ArrivalKitStatus, ArrivalKitRefusal> {
  if (from === "archived") return refuse("arrival_kit_archived")
  if (!GESTURE_SOURCES[gesture].includes(from)) return refuse("arrival_kit_transition_invalid")
  return ok(GESTURE_TARGETS[gesture])
}

/**
 * Concurrence optimiste : un geste cite la version lue. Une version différente de
 * la version courante est un conflit ; sinon, la version suivante.
 */
export function checkArrivalKitVersion(current: number, expected: number): Result<number, ArrivalKitRefusal> {
  if (expected !== current) return refuse("arrival_kit_version_conflict")
  return ok(current + 1)
}

/** Ce qui décide de l'état EFFECTIF d'une ressource, relu à la lecture. */
export interface ArrivalKitStanding {
  /** L'état enregistré. */
  readonly status: ArrivalKitStatus
  readonly lastVerifiedAt: number
  /** Signalements distincts sur la version COURANTE. */
  readonly outdatedFlags: number
}

/**
 * Pourquoi la ressource est « à revoir », ou `null` : marquée par une relecture,
 * ou — publiée — vérifiée il y a plus de douze mois, ou signalée périmée par
 * assez de personnes. La règle se calcule à la lecture : aucune tâche planifiée
 * n'est nécessaire pour qu'une information vieillie le dise.
 */
export function arrivalKitReviewCause(standing: ArrivalKitStanding, now: number): ArrivalKitReviewCause | null {
  if (standing.status === "needs_review") return "reviewer"
  if (standing.status !== "published") return null
  if (arrivalKitReviewDueAt(standing.lastVerifiedAt) <= now) return "age"
  if (standing.outdatedFlags >= ARRIVAL_KIT_OUTDATED_FLAG_THRESHOLD) return "flags"
  return null
}

/** L'état EFFECTIF : une ressource publiée devient « à revoir » dès qu'une cause s'applique. */
export function effectiveArrivalKitStatus(standing: ArrivalKitStanding, now: number): ArrivalKitStatus {
  return arrivalKitReviewCause(standing, now) === null ? standing.status : "needs_review"
}

/** Une personne qui propose ne garde pas plus de `ARRIVAL_KIT_RESOURCES_PER_PROPOSER_MAX` ressources non archivées. */
export function isArrivalKitQuotaReached(liveResources: number): boolean {
  return liveResources >= ARRIVAL_KIT_RESOURCES_PER_PROPOSER_MAX
}

// ═══════════════════════════════════════════════════════════════
// Relecture et signalement
// ═══════════════════════════════════════════════════════════════

export interface ArrivalKitReviewerFacts {
  /** Le statut d'adhésion EFFECTIF de la personne dans DIASPORALE. */
  readonly status: MembershipStatus
  /** Signataire vivant d'au moins une page active du réseau. */
  readonly livePageSignatory: boolean
}

/**
 * Qui peut relire : un membre VÉRIFIÉ, ou le signataire vivant d'une page — dans
 * les deux cas une personne qui peut publier (une suspension ferme tout).
 */
export function isArrivalKitReviewer(facts: ArrivalKitReviewerFacts): boolean {
  if (!hasCapability(facts.status, "publish")) return false
  return facts.status === "verifiee" || facts.livePageSignatory
}

export interface ArrivalKitIndependence {
  /** La personne qui agit (relire ou signaler). */
  readonly actorId: string
  /** Celles qui ont écrit la ressource : qui l'a proposée, son auteur, l'auteur de la version courante. */
  readonly writerIds: readonly string[]
  /** La personne est signataire vivante de la page qui porte la ressource. */
  readonly onCarrierTeam: boolean
}

/** La personne est-elle étrangère à la ressource (ni écrite par elle, ni portée par son équipe) ? */
export function isArrivalKitIndependent(facts: ArrivalKitIndependence): boolean {
  return !facts.onCarrierTeam && !facts.writerIds.includes(facts.actorId)
}

/** Relire une ressource : une personne habilitée, et DIFFÉRENTE de ceux qui l'ont écrite ou la portent. */
export function checkArrivalKitReviewer(input: ArrivalKitIndependence & { readonly reviewer: ArrivalKitReviewerFacts }): Result<null, ArrivalKitRefusal> {
  if (!isArrivalKitReviewer(input.reviewer)) return refuse("arrival_kit_reviewer_not_eligible")
  if (!isArrivalKitIndependent(input)) return refuse("arrival_kit_review_own_resource")
  return ok(null)
}

/**
 * Signaler une information périmée : seulement une ressource du kit public, par
 * une personne étrangère à elle, une fois par version, avec un motif fermé.
 */
export function checkArrivalKitFlag(
  input: ArrivalKitIndependence & { readonly status: ArrivalKitStatus; readonly alreadyFlagged: boolean; readonly reason: string },
): Result<ArrivalKitOutdatedReason, ArrivalKitRefusal> {
  if (!isArrivalKitListed(input.status)) return refuse("arrival_kit_not_flaggable")
  if (!isArrivalKitIndependent(input)) return refuse("arrival_kit_flag_own_resource")
  if (input.alreadyFlagged) return refuse("arrival_kit_already_flagged")
  if (!isArrivalKitOutdatedReason(input.reason)) return refuse("arrival_kit_outdated_reason_invalid")
  return ok(input.reason)
}

// ═══════════════════════════════════════════════════════════════
// Lire le kit : pays, ville, rubrique
// ═══════════════════════════════════════════════════════════════

/**
 * La zone lue : tout le pays (ressources nationales ET de toutes ses villes), les
 * seules ressources nationales, ou une ville saisie (sans GPS).
 */
export type ArrivalKitZone =
  | { readonly kind: "country" }
  | { readonly kind: "national" }
  | { readonly kind: "city"; readonly cityKey: string }

export interface ArrivalKitListingInput {
  readonly country: string
  readonly city?: string | null | undefined
  /** Sans ville : ne garder que les ressources valables dans tout le pays. */
  readonly nationalOnly?: boolean | undefined
  readonly category?: string | null | undefined
}

export interface ArrivalKitListing {
  readonly country: CountryCode
  readonly zone: ArrivalKitZone
  readonly category: ArrivalKitCategory | null
}

/** Les filtres d'une lecture du kit : le pays est obligatoire, la ville et la rubrique RESTREIGNENT. */
export function parseArrivalKitListing(input: ArrivalKitListingInput): Result<ArrivalKitListing, ArrivalKitRefusal> {
  const country = parseArrivalKitCountry(input.country)
  if (!country.ok) return country
  const city = parseArrivalKitCity(input.city)
  if (!city.ok) return city
  const rawCategory = input.category ?? ""
  let category: ArrivalKitCategory | null = null
  if (rawCategory.length > 0) {
    if (!isArrivalKitCategory(rawCategory)) return refuse("arrival_kit_category_invalid")
    category = rawCategory
  }
  const zone: ArrivalKitZone = city.value.cityKey.length > 0
    ? { kind: "city", cityKey: city.value.cityKey }
    : input.nationalOnly === true ? { kind: "national" } : { kind: "country" }
  return ok({ country: country.value, zone, category })
}

/** Une ressource répond-elle à la lecture ? (défense en profondeur après l'index, et démonstration). */
export function matchesArrivalKitListing(
  resource: { readonly country: string; readonly cityKey: string; readonly category: string },
  listing: ArrivalKitListing,
): boolean {
  if (resource.country !== listing.country) return false
  if (listing.category !== null && resource.category !== listing.category) return false
  if (listing.zone.kind === "national") return resource.cityKey === ""
  if (listing.zone.kind === "city") return resource.cityKey === listing.zone.cityKey
  return true
}
