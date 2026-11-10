/**
 * Mesure du pilote (plan global DIASPORALE §4 G11 et §7 ; ticket DG-027) —
 * règles PURES, lues à l'identique par le moteur (tranche
 * `convex/modules/diaspora/pilotMetrics.ts`), la démonstration et l'écran
 * `/pilote`. PROPRIÉTAIRE : chantier « mesure du pilote ».
 *
 * - Une définition FERMÉE des indicateurs : offres actives ; demandes
 *   envoyées, répondues (proposition ou refus), confirmées, réalisées,
 *   annulées, expirées ; délai de première réponse (médiane et 75e centile) ;
 *   adhésions associatives demandées et acceptées ; inscriptions et présences
 *   aux évènements de page ; avis publiés ; ET-10 — l'utilité de l'entraide :
 *   questions posées, part ayant reçu une réponse, délai de première réponse,
 *   part résolue (la « première aide aboutie ») ; inscriptions bénévoles ;
 *   demandes de mentorat et part acceptée ; ressources du kit publiées et part
 *   « à revoir » (relevé du passage).
 * - Des COHORTES en jours UTC : une demande, une adhésion ou un avis compte le
 *   jour de sa création, avec son état au dernier passage ; une inscription
 *   compte le jour de son évènement. Un taux rapporte une partie de la cohorte
 *   à sa base : jamais plus de cent pour cent, et la base reste visible.
 * - Des PRÉSENTATIONS anti-réidentification : un compte sous le seuil se dit
 *   « moins de 5 », jamais le chiffre ; une part dont l'écart avec sa base
 *   passe sous le seuil est masquée, et son taux n'est pas publié (même règle
 *   que l'export de transparence du moteur) ; un délai se donne par classe
 *   d'heures, jamais un délai individuel.
 * - Aucun texte, aucun identifiant de personne : seulement des comptes.
 *
 * Les agrégats sont MATÉRIALISÉS par le passage nocturne du moteur ; ce module
 * ne lit aucune base. Il est relu par le moteur (lib ES2021) : aucune API plus
 * récente.
 */
import { arrivalKitReviewCause, isArrivalKitListed, type ArrivalKitStanding } from "./arrival-kit"
import type { AssociationMembershipStatus } from "./associations"
import { isResidenceCountry, normalizeCountryCode, type CountryCode } from "./countries"
import type { AidQuestionStatus, AidSignupStatus } from "./mutual-aid"
import { ok, refuse, type Result } from "./result"
import { effectiveServiceRequestStatus, type ServiceRequestStatus } from "./service-requests"
import { DAY_MS, HOUR_MS } from "./time"

// ═══════════════════════════════════════════════════════════════
// Refus fermés et accès
// ═══════════════════════════════════════════════════════════════

/** Refus fermés du chantier : une période hors liste, un pays inconnu ou le Gabon. */
export const PILOT_METRICS_REFUSALS = ["pilot_metrics_window_invalid", "pilot_metrics_country_invalid"] as const
export type PilotMetricsRefusal = (typeof PILOT_METRICS_REFUSALS)[number]

/**
 * Les rôles de réseau qui lisent la mesure : administrateurs et modérateurs du
 * réseau. Les opérateurs de plateforme la lisent par la console du moteur.
 */
export const PILOT_METRICS_READER_ROLES = ["network_admin", "network_moderator"] as const

export function canReadPilotMetrics(role: string): boolean {
  return (PILOT_METRICS_READER_ROLES as readonly string[]).includes(role)
}

// ═══════════════════════════════════════════════════════════════
// Fenêtres, portée et jours UTC
// ═══════════════════════════════════════════════════════════════

/** Les périodes proposées, en jours UTC complets. */
export const PILOT_WINDOW_DAYS = [7, 30, 90] as const
export type PilotWindowDays = (typeof PILOT_WINDOW_DAYS)[number]
export const PILOT_DEFAULT_WINDOW_DAYS: PilotWindowDays = 30

/** Le passage recalcule chaque nuit les cohortes de la plus longue période. */
export const PILOT_PASS_RANGE_DAYS = 90

export function parsePilotWindowDays(value: unknown): Result<PilotWindowDays, "pilot_metrics_window_invalid"> {
  const days = PILOT_WINDOW_DAYS.find((candidate) => candidate === value)
  return days === undefined ? refuse("pilot_metrics_window_invalid") : ok(days)
}

/** La portée lue : `null` pour tout le réseau, sinon un pays de résidence (jamais le Gabon). */
export function parsePilotScope(raw: string | null | undefined): Result<CountryCode | null, "pilot_metrics_country_invalid"> {
  if (raw === null || raw === undefined) return ok(null)
  const code = normalizeCountryCode(raw)
  return isResidenceCountry(code) ? ok(code) : refuse("pilot_metrics_country_invalid")
}

/** Minuit UTC du jour d'un instant. */
export function pilotUtcDayStart(instant: number): number {
  return Math.floor(instant / DAY_MS) * DAY_MS
}

/** Une période : début inclus, fin exclue (millisecondes UTC). */
export interface PilotPeriod {
  readonly startAt: number
  readonly endAt: number
}

/** Les jours que recalcule le passage : les 90 jours UTC COMPLETS qui précèdent le jour du passage. */
export function pilotPassRange(now: number): PilotPeriod {
  const endAt = pilotUtcDayStart(now)
  return { startAt: endAt - PILOT_PASS_RANGE_DAYS * DAY_MS, endAt }
}

/** La période lue : les `days` jours qui finissent avec le dernier jour mesuré (inclus). */
export function pilotWindow(lastDayStartAt: number, days: PilotWindowDays): PilotPeriod {
  const endAt = pilotUtcDayStart(lastDayStartAt) + DAY_MS
  return { startAt: endAt - days * DAY_MS, endAt }
}

// ═══════════════════════════════════════════════════════════════
// Compteurs quotidiens et classes de délai
// ═══════════════════════════════════════════════════════════════

/**
 * ET-10 — les compteurs de l'entraide, ajoutés après les premiers : une ligne écrite
 * avant leur ajout ne les porte pas, et ils s'y lisent zéro (jamais un compte inventé).
 * Une question compte le jour de sa création, une inscription bénévole et une demande
 * de mentorat aussi, chacune avec son état au dernier passage.
 */
export const PILOT_AID_DAILY_COUNTERS = [
  "aidQuestionsAsked",
  "aidQuestionsAnswered",
  "aidQuestionsResolved",
  "aidSignups",
  "mentoringRequested",
  "mentoringAccepted",
] as const
export type PilotAidDailyCounter = (typeof PILOT_AID_DAILY_COUNTERS)[number]

/** Les compteurs matérialisés d'un jour et d'une portée, dans un ordre FIXE. */
export const PILOT_DAILY_COUNTERS = [
  "requestsSent",
  "requestsAnswered",
  "requestsConfirmed",
  "requestsCompleted",
  "requestsCancelled",
  "requestsExpired",
  "membershipsRequested",
  "membershipsAccepted",
  "eventRegistrations",
  "eventAttendances",
  "reviewsPublished",
  ...PILOT_AID_DAILY_COUNTERS,
] as const
export type PilotDailyCounter = (typeof PILOT_DAILY_COUNTERS)[number]
/** Les compteurs lus d'une ligne : ceux de l'entraide peuvent manquer (ligne d'avant ET-10), ils valent alors zéro. */
export type PilotDailyCounts = { readonly [Counter in Exclude<PilotDailyCounter, PilotAidDailyCounter>]: number } & { readonly [Counter in PilotAidDailyCounter]?: number }

export function isPilotAidDailyCounter(counter: string): counter is PilotAidDailyCounter {
  return (PILOT_AID_DAILY_COUNTERS as readonly string[]).includes(counter)
}

/**
 * Classes du délai de première réponse : borne HAUTE incluse, en heures. Au-delà
 * de la dernière borne, une classe « plus de 720 h ». Aucun délai individuel
 * n'est conservé : seulement le nombre de réponses par classe.
 */
export const PILOT_FIRST_RESPONSE_BUCKET_HOURS = [1, 2, 3, 4, 6, 8, 12, 18, 24, 36, 48, 72, 96, 120, 168, 240, 336, 720] as const
/** Les classes, plus celle du dépassement. */
export const PILOT_FIRST_RESPONSE_BUCKETS: number = PILOT_FIRST_RESPONSE_BUCKET_HOURS.length + 1
const OVERFLOW_FROM_HOURS: number = Math.max(...PILOT_FIRST_RESPONSE_BUCKET_HOURS)

/** L'agrégat d'un jour, tel qu'il est lu (ligne matérialisée, cellule du passage). */
export interface PilotDayAggregate {
  readonly counts: PilotDailyCounts
  /** Réponses par classe de délai (`PILOT_FIRST_RESPONSE_BUCKET_HOURS`, puis le dépassement). */
  readonly firstResponse: readonly number[]
  /** ET-10 — premières réponses aux questions d'entraide du jour, mêmes classes ; absent d'une ligne d'avant ET-10. */
  readonly aidFirstAnswer?: readonly number[]
}

/** L'agrégat d'un jour, tel qu'il est produit (copie neuve, modifiable). */
export interface PilotDayTotals {
  readonly counts: Record<PilotDailyCounter, number>
  readonly firstResponse: number[]
  readonly aidFirstAnswer: number[]
}

function sanitize(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0
}

export function emptyPilotCounts(): Record<PilotDailyCounter, number> {
  return {
    requestsSent: 0,
    requestsAnswered: 0,
    requestsConfirmed: 0,
    requestsCompleted: 0,
    requestsCancelled: 0,
    requestsExpired: 0,
    membershipsRequested: 0,
    membershipsAccepted: 0,
    eventRegistrations: 0,
    eventAttendances: 0,
    reviewsPublished: 0,
    aidQuestionsAsked: 0,
    aidQuestionsAnswered: 0,
    aidQuestionsResolved: 0,
    aidSignups: 0,
    mentoringRequested: 0,
    mentoringAccepted: 0,
  }
}

/** Un histogramme à la longueur exacte des classes ; une valeur absente ou aberrante vaut zéro. */
export function normalizePilotHistogram(histogram: readonly number[]): number[] {
  return Array.from({ length: PILOT_FIRST_RESPONSE_BUCKETS }, (_, index) => sanitize(histogram[index] ?? 0))
}

export function emptyPilotDay(): PilotDayTotals {
  return { counts: emptyPilotCounts(), firstResponse: normalizePilotHistogram([]), aidFirstAnswer: normalizePilotHistogram([]) }
}

/** Une classe de plus dans un histogramme, si elle existe. */
function bump(histogram: number[], bucket: number | null): void {
  if (bucket !== null && Number.isInteger(bucket) && bucket >= 0 && bucket < histogram.length) histogram[bucket] = (histogram[bucket] ?? 0) + 1
}

/**
 * Ajoute une ligne source à l'agrégat d'un jour : un par compteur cité, et sa classe de
 * délai s'il en a une — délai de première réponse d'une demande de service, ou (ET-10)
 * délai de première réponse d'une question d'entraide.
 */
export function tallyPilotDay(day: PilotDayAggregate, counters: readonly PilotDailyCounter[], firstResponseBucket: number | null = null, aidFirstAnswerBucket: number | null = null): PilotDayTotals {
  const counts = emptyPilotCounts()
  for (const counter of PILOT_DAILY_COUNTERS) counts[counter] = sanitize(day.counts[counter])
  for (const counter of counters) counts[counter] += 1
  const firstResponse = normalizePilotHistogram(day.firstResponse)
  bump(firstResponse, firstResponseBucket)
  const aidFirstAnswer = normalizePilotHistogram(day.aidFirstAnswer ?? [])
  bump(aidFirstAnswer, aidFirstAnswerBucket)
  return { counts, firstResponse, aidFirstAnswer }
}

/** La somme de plusieurs jours (une période, ou plusieurs pays). */
export function sumPilotDays(days: readonly PilotDayAggregate[]): PilotDayTotals {
  const total = emptyPilotDay()
  for (const day of days) {
    for (const counter of PILOT_DAILY_COUNTERS) total.counts[counter] += sanitize(day.counts[counter])
    normalizePilotHistogram(day.firstResponse).forEach((count, index) => {
      total.firstResponse[index] = (total.firstResponse[index] ?? 0) + count
    })
    normalizePilotHistogram(day.aidFirstAnswer ?? []).forEach((count, index) => {
      total.aidFirstAnswer[index] = (total.aidFirstAnswer[index] ?? 0) + count
    })
  }
  return total
}

/** La classe d'un délai de première réponse, ou `null` pour un délai négatif ou illisible. */
export function pilotFirstResponseBucket(delayMs: number): number | null {
  if (!Number.isFinite(delayMs) || delayMs < 0) return null
  const hours = delayMs / HOUR_MS
  const index = PILOT_FIRST_RESPONSE_BUCKET_HOURS.findIndex((bound) => hours <= bound)
  return index === -1 ? PILOT_FIRST_RESPONSE_BUCKET_HOURS.length : index
}

// ═══════════════════════════════════════════════════════════════
// Ce que compte chaque ligne source
// ═══════════════════════════════════════════════════════════════

/** Les seuls faits lus d'une demande : états, dates, versions ; jamais le besoin ni un motif. */
export interface PilotRequestFacts {
  readonly status: ServiceRequestStatus
  readonly deadlineAt: number | null
  readonly createdAt: number
  /** Zéro avant toute proposition. */
  readonly proposalVersion: number
  /** La création de la proposition de version 1, si elle existe. */
  readonly firstProposalAt: number | null
  readonly closedAt: number | null
  /** Un rendez-vous a été convenu (même annulé ensuite). */
  readonly hasBooking: boolean
}

export interface PilotTally {
  readonly counters: readonly PilotDailyCounter[]
  readonly firstResponseBucket: number | null
}

/**
 * Une demande de la cohorte : envoyée ; répondue si la page a proposé ou
 * refusé ; confirmée si un rendez-vous a été convenu ; réalisée, annulée ou
 * expirée selon son état EFFECTIF au passage (une échéance atteinte vaut
 * expiration). Le délai de première réponse va de l'envoi à la première
 * proposition, ou au refus si la page a refusé sans proposer.
 */
export function pilotRequestTally(facts: PilotRequestFacts, now: number): PilotTally {
  const status = effectiveServiceRequestStatus({ status: facts.status, deadlineAt: facts.deadlineAt }, now)
  const proposed = facts.proposalVersion >= 1
  const refused = status === "refused"
  const counters: PilotDailyCounter[] = ["requestsSent"]
  if (proposed || refused) counters.push("requestsAnswered")
  if (facts.hasBooking) counters.push("requestsConfirmed")
  if (status === "completed") counters.push("requestsCompleted")
  if (status === "cancelled") counters.push("requestsCancelled")
  if (status === "expired") counters.push("requestsExpired")
  const answeredAt = proposed ? facts.firstProposalAt : refused ? facts.closedAt : null
  return { counters, firstResponseBucket: answeredAt === null ? null : pilotFirstResponseBucket(answeredAt - facts.createdAt) }
}

/** Une adhésion acceptée le reste dans la cohorte, même quittée ou exclue ensuite. */
export const PILOT_ACCEPTED_MEMBERSHIP_STATUSES = ["accepted", "left", "removed"] as const satisfies readonly AssociationMembershipStatus[]

export function pilotMembershipCounters(status: AssociationMembershipStatus): readonly PilotDailyCounter[] {
  return (PILOT_ACCEPTED_MEMBERSHIP_STATUSES as readonly AssociationMembershipStatus[]).includes(status)
    ? ["membershipsRequested", "membershipsAccepted"]
    : ["membershipsRequested"]
}

/** Une place confirmée à un évènement de page, et sa présence si elle a été pointée. */
export function pilotRegistrationCounters(checkedIn: boolean): readonly PilotDailyCounter[] {
  return checkedIn ? ["eventRegistrations", "eventAttendances"] : ["eventRegistrations"]
}

/** Un avis compte s'il est actif ET publié par la modération ; sinon il ne compte pas. */
export function pilotReviewCounters(review: { readonly active: boolean; readonly published: boolean }): readonly PilotDailyCounter[] {
  return review.active && review.published ? ["reviewsPublished"] : []
}

// ── ET-10 : l'utilité de l'entraide ──────────────────────────────

/** Les seuls faits lus d'une question : son état, sa réponse retenue, ses réponses publiées, sa première réponse ; jamais un texte. */
export interface PilotAidQuestionFacts {
  readonly status: AidQuestionStatus
  readonly hasAcceptedAnswer: boolean
  /** Les réponses publiées au passage. */
  readonly answerCount: number
  readonly createdAt: number
  /** La création de sa plus ancienne réponse encore publiée, si elle existe. */
  readonly firstAnswerAt: number | null
}

export interface PilotAidTally {
  readonly counters: readonly PilotDailyCounter[]
  readonly aidFirstAnswerBucket: number | null
}

/**
 * Une question de la cohorte : posée ; « a reçu une réponse » si une réponse publiée
 * existe au passage ; « résolue » si son auteur a retenu une réponse (résolue, ou close
 * après l'avoir retenue) — la PREMIÈRE AIDE ABOUTIE. Une question retirée par son auteur
 * ne compte pas. Le délai va de la question à sa plus ancienne réponse encore publiée.
 */
export function pilotAidQuestionTally(facts: PilotAidQuestionFacts): PilotAidTally {
  if (facts.status === "withdrawn") return { counters: [], aidFirstAnswerBucket: null }
  const counters: PilotDailyCounter[] = ["aidQuestionsAsked"]
  if (facts.answerCount > 0 || facts.firstAnswerAt !== null) counters.push("aidQuestionsAnswered")
  if (facts.hasAcceptedAnswer) counters.push("aidQuestionsResolved")
  return { counters, aidFirstAnswerBucket: facts.firstAnswerAt === null ? null : pilotFirstResponseBucket(facts.firstAnswerAt - facts.createdAt) }
}

/** Une inscription bénévole compte si elle est confirmée au passage (un retrait la retire du compte). */
export function pilotAidSignupCounters(status: AidSignupStatus): readonly PilotDailyCounter[] {
  return status === "confirmed" ? ["aidSignups"] : []
}

/** Une demande de mentorat, et son acceptation si elle a été acceptée (même close ensuite). */
export function pilotMentoringCounters(accepted: boolean): readonly PilotDailyCounter[] {
  return accepted ? ["mentoringRequested", "mentoringAccepted"] : ["mentoringRequested"]
}

/** Le relevé d'une ressource du kit au passage : listée (publiée ou à revoir), et « à revoir » par son état EFFECTIF. */
export function pilotKitSnapshot(standing: ArrivalKitStanding, now: number): { readonly listed: boolean; readonly toReview: boolean } {
  const listed = isArrivalKitListed(standing.status)
  return { listed, toReview: listed && arrivalKitReviewCause(standing, now) !== null }
}

// ═══════════════════════════════════════════════════════════════
// Présentations (seuil, part masquée, taux, classes de délai)
// ═══════════════════════════════════════════════════════════════

/** En deçà, un compte ne se publie pas : même seuil que l'export de transparence du moteur. */
export const PILOT_DISPLAY_THRESHOLD = 5

export type PilotCount =
  | { readonly kind: "value"; readonly value: number }
  | { readonly kind: "below_threshold"; readonly threshold: number }

/** La part d'une base : un compte, ou masquée parce que son écart avec la base passe sous le seuil. */
export type PilotPart = PilotCount | { readonly kind: "complement_below_threshold"; readonly threshold: number }

/** Un taux entier en points ; non publié dès que la part ou son écart passe sous le seuil. */
export type PilotRate = { readonly kind: "value"; readonly percent: number } | { readonly kind: "withheld" }

/** Un délai par classe : « au plus N heures », « plus de N heures », ou non publié (moins de 5 réponses). */
export type PilotHours =
  | { readonly kind: "at_most"; readonly hours: number }
  | { readonly kind: "above"; readonly hours: number }
  | { readonly kind: "withheld" }

/** Un seuil lisible : un entier d'au moins 1 (un seuil aberrant redevient 1). */
function thresholdOf(threshold: number): number {
  return Number.isFinite(threshold) && threshold >= 1 ? Math.trunc(threshold) : 1
}

export function presentPilotCount(value: number, threshold: number = PILOT_DISPLAY_THRESHOLD): PilotCount {
  const minimum = thresholdOf(threshold)
  const count = sanitize(value)
  return count < minimum ? { kind: "below_threshold", threshold: minimum } : { kind: "value", value: count }
}

export interface PilotRatioPresentation {
  readonly value: PilotPart
  readonly denominator: PilotCount
  readonly rate: PilotRate
}

/**
 * Une part et sa base. La base se présente comme tout compte ; la part sous le
 * seuil se dit « moins de 5 » ; une part dont l'écart avec la base passe sous
 * le seuil est masquée (l'écart se déduirait sinon de la base). Le taux n'est
 * publié qu'avec une part publiée.
 */
export function presentPilotRatio(numerator: number, denominator: number, threshold: number = PILOT_DISPLAY_THRESHOLD): PilotRatioPresentation {
  const minimum = thresholdOf(threshold)
  const total = sanitize(denominator)
  const part = Math.min(sanitize(numerator), total)
  const base = presentPilotCount(total, minimum)
  if (part < minimum) return { value: { kind: "below_threshold", threshold: minimum }, denominator: base, rate: { kind: "withheld" } }
  if (total - part < minimum) return { value: { kind: "complement_below_threshold", threshold: minimum }, denominator: base, rate: { kind: "withheld" } }
  return { value: { kind: "value", value: part }, denominator: base, rate: { kind: "value", percent: Math.round((part * 100) / total) } }
}

export interface PilotFirstResponsePresentation {
  /** Le nombre de réponses classées : la base des deux délais. */
  readonly sample: PilotCount
  readonly median: PilotHours
  readonly p75: PilotHours
}

function bucketHours(index: number): PilotHours {
  const bound = PILOT_FIRST_RESPONSE_BUCKET_HOURS[index]
  return bound === undefined ? { kind: "above", hours: OVERFLOW_FROM_HOURS } : { kind: "at_most", hours: bound }
}

/** La classe qui contient le rang du quantile (rang le plus proche, borné à l'échantillon). */
function quantileBucket(histogram: readonly number[], total: number, quantile: number): number {
  const rank = Math.min(total, Math.max(1, Math.ceil(quantile * total)))
  let cumulative = 0
  let index = 0
  while (index < histogram.length - 1) {
    cumulative += histogram[index] ?? 0
    if (cumulative >= rank) break
    index += 1
  }
  return index
}

/** Médiane et 75e centile des délais, par classe ; non publiés sous le seuil de réponses. */
export function presentPilotFirstResponse(histogram: readonly number[], threshold: number = PILOT_DISPLAY_THRESHOLD): PilotFirstResponsePresentation {
  const minimum = thresholdOf(threshold)
  const counts = normalizePilotHistogram(histogram)
  const total = counts.reduce((sum, count) => sum + count, 0)
  const sample = presentPilotCount(total, minimum)
  if (total < minimum) return { sample, median: { kind: "withheld" }, p75: { kind: "withheld" } }
  return { sample, median: bucketHours(quantileBucket(counts, total, 0.5)), p75: bucketHours(quantileBucket(counts, total, 0.75)) }
}

// ═══════════════════════════════════════════════════════════════
// Les indicateurs du pilote (liste fermée)
// ═══════════════════════════════════════════════════════════════

export const PILOT_METRIC_GROUPS = ["services", "associations", "events", "reviews", "mutual_aid"] as const
export type PilotMetricGroup = (typeof PILOT_METRIC_GROUPS)[number]

export const PILOT_METRIC_IDS = [
  "offers_active",
  "requests_sent",
  "requests_answered",
  "requests_confirmed",
  "requests_completed",
  "requests_cancelled",
  "requests_expired",
  "first_response_hours",
  "memberships_requested",
  "memberships_accepted",
  "event_registrations",
  "event_attendances",
  "reviews_published",
  // ET-10 : l'utilité de l'entraide.
  "aid_questions_asked",
  "aid_questions_answered",
  "aid_first_answer_hours",
  "aid_questions_resolved",
  "aid_signups",
  "mentoring_requested",
  "mentoring_accepted",
  "kit_resources_listed",
  "kit_resources_to_review",
] as const
export type PilotMetricId = (typeof PILOT_METRIC_IDS)[number]

/** Les relevés du dernier passage (pas des cohortes) : offres actives ; ressources du kit listées, et « à revoir » (ET-10). */
export const PILOT_SNAPSHOTS = ["offersActive", "kitListed", "kitToReview"] as const
export type PilotSnapshot = (typeof PILOT_SNAPSHOTS)[number]

/** Les histogrammes de délai : première réponse d'une demande de service ; première réponse d'une question d'entraide (ET-10). */
export const PILOT_DELAY_HISTOGRAMS = ["firstResponse", "aidFirstAnswer"] as const
export type PilotDelayHistogram = (typeof PILOT_DELAY_HISTOGRAMS)[number]

interface PilotMetricBase {
  readonly id: PilotMetricId
  readonly group: PilotMetricGroup
}

/**
 * La définition d'un indicateur : un relevé au dernier passage (`snapshot`), un compte
 * de cohorte (`count`), une part de cohorte et sa base (`ratio`), une part d'un relevé
 * et sa base (`snapshot_ratio`, présentée comme une part), ou des délais (`duration`).
 */
export type PilotMetricDefinition =
  | (PilotMetricBase & { readonly kind: "snapshot"; readonly snapshot: PilotSnapshot })
  | (PilotMetricBase & { readonly kind: "count"; readonly counter: PilotDailyCounter })
  | (PilotMetricBase & { readonly kind: "ratio"; readonly counter: PilotDailyCounter; readonly denominator: PilotDailyCounter; readonly denominatorId: PilotMetricId })
  | (PilotMetricBase & { readonly kind: "snapshot_ratio"; readonly snapshot: PilotSnapshot; readonly denominator: PilotSnapshot; readonly denominatorId: PilotMetricId })
  | (PilotMetricBase & { readonly kind: "duration"; readonly histogram: PilotDelayHistogram })

export const PILOT_METRICS: readonly PilotMetricDefinition[] = [
  { id: "offers_active", group: "services", kind: "snapshot", snapshot: "offersActive" },
  { id: "requests_sent", group: "services", kind: "count", counter: "requestsSent" },
  { id: "requests_answered", group: "services", kind: "ratio", counter: "requestsAnswered", denominator: "requestsSent", denominatorId: "requests_sent" },
  { id: "requests_confirmed", group: "services", kind: "ratio", counter: "requestsConfirmed", denominator: "requestsSent", denominatorId: "requests_sent" },
  { id: "requests_completed", group: "services", kind: "ratio", counter: "requestsCompleted", denominator: "requestsConfirmed", denominatorId: "requests_confirmed" },
  { id: "requests_cancelled", group: "services", kind: "ratio", counter: "requestsCancelled", denominator: "requestsSent", denominatorId: "requests_sent" },
  { id: "requests_expired", group: "services", kind: "ratio", counter: "requestsExpired", denominator: "requestsSent", denominatorId: "requests_sent" },
  { id: "first_response_hours", group: "services", kind: "duration", histogram: "firstResponse" },
  { id: "memberships_requested", group: "associations", kind: "count", counter: "membershipsRequested" },
  { id: "memberships_accepted", group: "associations", kind: "ratio", counter: "membershipsAccepted", denominator: "membershipsRequested", denominatorId: "memberships_requested" },
  { id: "event_registrations", group: "events", kind: "count", counter: "eventRegistrations" },
  { id: "event_attendances", group: "events", kind: "ratio", counter: "eventAttendances", denominator: "eventRegistrations", denominatorId: "event_registrations" },
  { id: "reviews_published", group: "reviews", kind: "count", counter: "reviewsPublished" },
  { id: "aid_questions_asked", group: "mutual_aid", kind: "count", counter: "aidQuestionsAsked" },
  { id: "aid_questions_answered", group: "mutual_aid", kind: "ratio", counter: "aidQuestionsAnswered", denominator: "aidQuestionsAsked", denominatorId: "aid_questions_asked" },
  { id: "aid_first_answer_hours", group: "mutual_aid", kind: "duration", histogram: "aidFirstAnswer" },
  { id: "aid_questions_resolved", group: "mutual_aid", kind: "ratio", counter: "aidQuestionsResolved", denominator: "aidQuestionsAsked", denominatorId: "aid_questions_asked" },
  { id: "aid_signups", group: "mutual_aid", kind: "count", counter: "aidSignups" },
  { id: "mentoring_requested", group: "mutual_aid", kind: "count", counter: "mentoringRequested" },
  { id: "mentoring_accepted", group: "mutual_aid", kind: "ratio", counter: "mentoringAccepted", denominator: "mentoringRequested", denominatorId: "mentoring_requested" },
  { id: "kit_resources_listed", group: "mutual_aid", kind: "snapshot", snapshot: "kitListed" },
  { id: "kit_resources_to_review", group: "mutual_aid", kind: "snapshot_ratio", snapshot: "kitToReview", denominator: "kitListed", denominatorId: "kit_resources_listed" },
]

interface PilotIndicatorBase {
  readonly id: PilotMetricId
  readonly group: PilotMetricGroup
}

/** La présentation d'un indicateur : aucune donnée brute sous le seuil n'y figure. */
export type PilotIndicator =
  | (PilotIndicatorBase & { readonly kind: "snapshot"; readonly value: PilotCount })
  | (PilotIndicatorBase & { readonly kind: "count"; readonly value: PilotCount })
  | (PilotIndicatorBase & { readonly kind: "ratio"; readonly value: PilotPart; readonly denominatorId: PilotMetricId; readonly denominator: PilotCount; readonly rate: PilotRate })
  | (PilotIndicatorBase & { readonly kind: "duration"; readonly sample: PilotCount; readonly median: PilotHours; readonly p75: PilotHours })

export interface PilotIndicatorsInput {
  /** Les jours de la période pour la portée lue. */
  readonly days: readonly PilotDayAggregate[]
  /** Les offres actives relevées au dernier passage pour cette portée. */
  readonly offersActive: number
  /** ET-10 — les ressources du kit listées, et « à revoir », relevées au dernier passage ; absentes : zéro. */
  readonly kitListed?: number
  readonly kitToReview?: number
  readonly threshold?: number
}

/** Les indicateurs d'une période et d'une portée, dans l'ordre de `PILOT_METRICS`. */
export function presentPilotIndicators(input: PilotIndicatorsInput): PilotIndicator[] {
  const threshold = thresholdOf(input.threshold ?? PILOT_DISPLAY_THRESHOLD)
  const total = sumPilotDays(input.days)
  const snapshots: Readonly<Record<PilotSnapshot, number>> = { offersActive: input.offersActive, kitListed: input.kitListed ?? 0, kitToReview: input.kitToReview ?? 0 }
  return PILOT_METRICS.map((metric): PilotIndicator => {
    switch (metric.kind) {
      case "snapshot":
        return { id: metric.id, group: metric.group, kind: "snapshot", value: presentPilotCount(snapshots[metric.snapshot], threshold) }
      case "snapshot_ratio":
        return {
          id: metric.id,
          group: metric.group,
          kind: "ratio",
          denominatorId: metric.denominatorId,
          ...presentPilotRatio(snapshots[metric.snapshot], snapshots[metric.denominator], threshold),
        }
      case "count":
        return { id: metric.id, group: metric.group, kind: "count", value: presentPilotCount(total.counts[metric.counter], threshold) }
      case "ratio":
        return {
          id: metric.id,
          group: metric.group,
          kind: "ratio",
          denominatorId: metric.denominatorId,
          ...presentPilotRatio(total.counts[metric.counter], total.counts[metric.denominator], threshold),
        }
      case "duration":
        return { id: metric.id, group: metric.group, kind: "duration", ...presentPilotFirstResponse(total[metric.histogram], threshold) }
    }
  })
}
