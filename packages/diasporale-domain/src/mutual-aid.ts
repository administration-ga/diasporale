/**
 * Entraide DIASPORALE (DG-024 a, plan global §G8.2) — règles PURES des
 * questions d'entraide, de leurs réponses (dont la « réponse retenue ») et des
 * missions bénévoles portées par les pages d'association. PROPRIÉTAIRE :
 * chantier « entraide ».
 *
 *   Question : ouverte ⇄ résolue (une réponse retenue par son AUTEUR, une seule,
 *              révocable) ; ouverte | résolue → close (plus aucune réponse) ;
 *              tout état → retirée (terminale, plus lisible par personne).
 *   Mission  : ouverte ⇄ complète (les places se relisent à chaque inscription
 *              ou retrait) ; ouverte | complète → close (plus d'inscription) ;
 *              → annulée (terminale).
 *
 * Mêmes règles pour l'écran, la démonstration et la tranche
 * `convex/modules/diaspora/mutualAid.ts` du moteur : codes FERMÉS
 * (`MUTUAL_AID_REFUSALS`), traduits par l'écran, aucune phrase ici.
 *
 * - Aucune coordonnée : un texte qui porte un téléphone, une adresse e-mail, un
 *   lien ou une adresse exacte est refusé — on se répond ici, le contact privé
 *   passe par la messagerie. Les détecteurs sont ceux des services et des
 *   demandes (une seule définition d'une coordonnée dans le domaine).
 * - Aucune donnée consulaire, aucun GPS : la ville est SAISIE, puis repliée
 *   (`cityKeyOf`) ; le pays est un pays de résidence, jamais le Gabon.
 * - Les gestes d'une mission reviennent à l'équipe VIVANTE de la page
 *   d'association, jugée par le fournisseur avant ces règles.
 *
 * Ce module est relu par le moteur (lib ES2021) : aucune API plus récente.
 */
import { HOME_COUNTRY, isCountryCode, normalizeCountryCode, type CountryCode } from "./countries"
import { ok, refuse, type Result } from "./result"
import { canonicalTimeZone, isServiceInstant, normalizeServiceText, serviceTextRefusal } from "./service-requests"
import { cityKeyOf, containsContactDetails } from "./services"
import { DAY_MS } from "./time"

// ═══════════════════════════════════════════════════════════════
// Listes fermées
// ═══════════════════════════════════════════════════════════════

/**
 * Thèmes d'une question, utiles aux nouveaux arrivants : logement, démarches
 * (administration du pays d'accueil — jamais une donnée consulaire), santé,
 * emploi, scolarité, transports, vie quotidienne. La liste peut s'allonger,
 * jamais perdre un membre (les lignes du moteur la portent).
 */
export const AID_THEMES = ["housing", "procedures", "health", "employment", "schooling", "transport", "daily_life"] as const
export type AidTheme = (typeof AID_THEMES)[number]

/** États d'une question : ouverte, résolue (réponse retenue), close, retirée par son auteur. */
export const AID_QUESTION_STATUSES = ["open", "resolved", "closed", "withdrawn"] as const
export type AidQuestionStatus = (typeof AID_QUESTION_STATUSES)[number]

/** Ce qu'une liste de questions montre : jamais une question retirée. */
export const AID_QUESTION_LIST_STATUSES = ["open", "resolved", "closed"] as const
export type AidQuestionListStatus = (typeof AID_QUESTION_LIST_STATUSES)[number]

/** Une réponse est publiée, ou retirée par son auteur (terminal). */
export const AID_ANSWER_STATUSES = ["published", "withdrawn"] as const
export type AidAnswerStatus = (typeof AID_ANSWER_STATUSES)[number]

/** États d'une mission : ouverte, complète (places prises), close (inscriptions fermées), annulée. */
export const AID_MISSION_STATUSES = ["open", "full", "closed", "cancelled"] as const
export type AidMissionStatus = (typeof AID_MISSION_STATUSES)[number]

/** Une inscription bénévole est confirmée, ou retirée par la personne. */
export const AID_SIGNUP_STATUSES = ["confirmed", "withdrawn"] as const
export type AidSignupStatus = (typeof AID_SIGNUP_STATUSES)[number]

export const AID_QUESTION_GESTURES = ["edit", "accept", "unaccept", "close", "withdraw"] as const
export type AidQuestionGesture = (typeof AID_QUESTION_GESTURES)[number]

export const AID_ANSWER_GESTURES = ["edit", "withdraw"] as const
export type AidAnswerGesture = (typeof AID_ANSWER_GESTURES)[number]

export const AID_MISSION_GESTURES = ["edit", "close", "cancel"] as const
export type AidMissionGesture = (typeof AID_MISSION_GESTURES)[number]

export function isAidTheme(value: string): value is AidTheme {
  return (AID_THEMES as readonly string[]).includes(value)
}

export function isAidQuestionListStatus(value: string): value is AidQuestionListStatus {
  return (AID_QUESTION_LIST_STATUSES as readonly string[]).includes(value)
}

// ═══════════════════════════════════════════════════════════════
// Bornes
// ═══════════════════════════════════════════════════════════════

/** Le titre d'une question ou d'une mission : une ligne. */
export const AID_TITLE_MIN_LENGTH = 5
export const AID_TITLE_MAX_LENGTH = 140
/** Le détail d'une question : facultatif, borné. */
export const AID_DETAIL_MAX_LENGTH = 2000
export const AID_ANSWER_MIN_LENGTH = 2
export const AID_ANSWER_MAX_LENGTH = 2000
/** Même borne que la ville d'une facette ou d'une offre : un nom de ville, pas une adresse. */
export const AID_CITY_MAX_LENGTH = 80
export const AID_MISSION_DESCRIPTION_MIN_LENGTH = 10
export const AID_MISSION_DESCRIPTION_MAX_LENGTH = 2000
/** Le lieu APPROXIMATIF d'une mission (quartier, repère) : une ligne, jamais une adresse exacte. */
export const AID_MISSION_AREA_MAX_LENGTH = 80
export const AID_MISSION_PLACES_MIN = 1
export const AID_MISSION_PLACES_MAX = 500
/** Une mission commence au plus tard dans un an… */
export const AID_MISSION_HORIZON_DAYS = 365
/** …et une période dure au plus trois mois. */
export const AID_MISSION_PERIOD_MAX_DAYS = 92
/** Le motif facultatif d'une annulation. */
export const AID_REASON_MAX_LENGTH = 500
/** Réponses publiées au plus par question : une lecture bornée, une limite aux abus. */
export const AID_ANSWERS_PER_QUESTION_MAX = 300
/** Taille d'une page de liste : plafond dur du moteur. */
export const AID_PAGE_MAX = 50

// ═══════════════════════════════════════════════════════════════
// Refus fermés, traduits par l'écran (`errors.<code>`)
// ═══════════════════════════════════════════════════════════════

export const MUTUAL_AID_REFUSALS = [
  // Les textes.
  "aid_title_too_short",
  "aid_title_too_long",
  "aid_detail_too_long",
  /** Téléphone, adresse e-mail ou lien : on se répond ici, le contact passe par la messagerie. */
  "aid_contact_forbidden",
  /** Numéro et voie : un lieu reste approximatif. */
  "aid_address_forbidden",
  // Le thème et le lieu.
  "aid_theme_invalid",
  "aid_country_required",
  "aid_country_unknown",
  "aid_country_is_home",
  "aid_city_required",
  "aid_city_invalid",
  "aid_city_too_long",
  // Les réponses.
  "aid_answer_too_short",
  "aid_answer_too_long",
  "aid_answers_limit_reached",
  // Les gestes sur une question ou une réponse.
  "aid_not_author",
  /** La ligne a changé depuis sa lecture (version attendue périmée). */
  "aid_version_conflict",
  "aid_question_closed",
  "aid_question_withdrawn",
  "aid_question_not_resolved",
  "aid_answer_withdrawn",
  /** La réponse retenue ne se modifie plus : son auteur peut la retirer. */
  "aid_answer_locked",
  /** La réponse à retenir n'appartient pas à la question, ou n'est plus publiée. */
  "aid_answer_unavailable",
  // Les missions.
  /** Une mission bénévole est portée par une page d'ASSOCIATION, jamais par une entreprise ou une institution. */
  "aid_page_kind_not_allowed",
  "aid_mission_description_too_short",
  "aid_mission_description_too_long",
  "aid_mission_area_too_long",
  "aid_mission_schedule_invalid",
  "aid_mission_start_past",
  "aid_mission_too_far",
  "aid_time_zone_invalid",
  "aid_mission_places_invalid",
  "aid_mission_places_below_signups",
  "aid_mission_closed",
  "aid_mission_cancelled",
  "aid_mission_started",
  "aid_mission_full",
  // Les inscriptions bénévoles.
  "aid_signup_consent_required",
  "aid_signup_exists",
  "aid_signup_missing",
  "aid_reason_too_long",
] as const
export type MutualAidRefusal = (typeof MUTUAL_AID_REFUSALS)[number]

// ═══════════════════════════════════════════════════════════════
// Textes : lignes, paragraphes, coordonnées
// ═══════════════════════════════════════════════════════════════

/** Une ligne : forme NFC, espaces et retours resserrés en une espace. */
function singleLine(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim()
}

/**
 * Un texte porte-t-il une coordonnée (téléphone, adresse e-mail, lien, domaine)
 * ou une adresse exacte (numéro et voie) ? Les deux détecteurs du domaine, dans
 * cet ordre : la coordonnée d'abord.
 */
export function aidTextRefusal(text: string): "aid_contact_forbidden" | "aid_address_forbidden" | null {
  const refusal = serviceTextRefusal(text)
  if (refusal === "request_contact_forbidden" || containsContactDetails(text)) return "aid_contact_forbidden"
  if (refusal === "request_address_forbidden") return "aid_address_forbidden"
  return null
}

/** Le titre d'une question ou d'une mission : une ligne bornée, sans coordonnée. */
export function parseAidTitle(raw: string): Result<string, MutualAidRefusal> {
  const title = singleLine(raw)
  if (title.length < AID_TITLE_MIN_LENGTH) return refuse("aid_title_too_short")
  if (title.length > AID_TITLE_MAX_LENGTH) return refuse("aid_title_too_long")
  const refusal = aidTextRefusal(title)
  return refusal === null ? ok(title) : refuse(refusal)
}

// ═══════════════════════════════════════════════════════════════
// Le lieu : pays de résidence, ville saisie et repliée
// ═══════════════════════════════════════════════════════════════

/** Le pays : un pays de résidence de la diaspora, jamais le Gabon. */
export function parseAidCountry(raw: string | null | undefined): Result<CountryCode, MutualAidRefusal> {
  const code = normalizeCountryCode(raw ?? "")
  if (code.length === 0) return refuse("aid_country_required")
  if (!isCountryCode(code)) return refuse("aid_country_unknown")
  if (code === HOME_COUNTRY) return refuse("aid_country_is_home")
  return ok(code)
}

export interface AidCity {
  readonly city: string
  /** La ville repliée (casse, accents, tirets) : la clé des index et des filtres. */
  readonly cityKey: string
}

/** La ville saisie : une ligne non vide, bornée, sans coordonnée ; et sa clé repliée. */
export function parseAidCity(raw: string | null | undefined): Result<AidCity, MutualAidRefusal> {
  const city = singleLine(raw ?? "")
  if (city.length === 0) return refuse("aid_city_required")
  if (city.length > AID_CITY_MAX_LENGTH) return refuse("aid_city_too_long")
  const cityKey = cityKeyOf(city)
  if (cityKey.length === 0) return refuse("aid_city_invalid")
  const refusal = aidTextRefusal(city)
  return refusal === null ? ok({ city, cityKey }) : refuse(refusal)
}

/** Une ville FACULTATIVE : vide, aucune ville ; sinon la règle de la ville. */
export function parseAidOptionalCity(raw: string | null | undefined): Result<AidCity | null, MutualAidRefusal> {
  if (singleLine(raw ?? "").length === 0) return ok(null)
  return parseAidCity(raw)
}

export interface AidPlaceFilter {
  readonly country: CountryCode
  /** `null` : tout le pays. */
  readonly cityKey: string | null
}

/**
 * Le filtre d'une liste : un pays (obligatoire, la liste est celle d'un pays)
 * et une ville saisie facultative. Le filtre RESTREINT : il n'ouvre rien.
 */
export function parseAidPlaceFilter(input: { readonly country: string; readonly city?: string | null | undefined }): Result<AidPlaceFilter, MutualAidRefusal> {
  const country = parseAidCountry(input.country)
  if (!country.ok) return country
  const city = parseAidOptionalCity(input.city)
  if (!city.ok) return city
  return ok({ country: country.value, cityKey: city.value === null ? null : city.value.cityKey })
}

// ═══════════════════════════════════════════════════════════════
// Une question et ses réponses
// ═══════════════════════════════════════════════════════════════

export interface AidQuestionInput {
  readonly title: string
  /** Facultatif : vide, la question tient dans son titre. */
  readonly detail: string
  readonly theme: string
  readonly country: string
  /** Facultative : vide, la question vaut pour tout le pays. */
  readonly city?: string | null | undefined
}

/** Une question VALIDÉE, normalisée, prête à être écrite (moteur) ou gardée (démonstration). */
export interface AidQuestionDraft {
  readonly title: string
  readonly detail: string
  readonly theme: AidTheme
  readonly country: CountryCode
  readonly city: string | null
  readonly cityKey: string | null
}

/**
 * LA règle d'une question. Ordre des contrôles (le premier refus est rendu) :
 * titre, détail, coordonnées, thème, pays, ville.
 */
export function parseAidQuestion(input: AidQuestionInput): Result<AidQuestionDraft, MutualAidRefusal> {
  const title = parseAidTitle(input.title)
  if (!title.ok) return title
  const detail = normalizeServiceText(input.detail)
  if (detail.length > AID_DETAIL_MAX_LENGTH) return refuse("aid_detail_too_long")
  const detailRefusal = aidTextRefusal(detail)
  if (detailRefusal !== null) return refuse(detailRefusal)
  if (!isAidTheme(input.theme)) return refuse("aid_theme_invalid")
  const country = parseAidCountry(input.country)
  if (!country.ok) return country
  const city = parseAidOptionalCity(input.city)
  if (!city.ok) return city
  return ok({
    title: title.value,
    detail,
    theme: input.theme,
    country: country.value,
    city: city.value === null ? null : city.value.city,
    cityKey: city.value === null ? null : city.value.cityKey,
  })
}

/** Le texte d'une réponse : borné, sans coordonnée ni adresse exacte. */
export function parseAidAnswer(raw: string): Result<string, MutualAidRefusal> {
  const body = normalizeServiceText(raw)
  if (body.length < AID_ANSWER_MIN_LENGTH) return refuse("aid_answer_too_short")
  if (body.length > AID_ANSWER_MAX_LENGTH) return refuse("aid_answer_too_long")
  const refusal = aidTextRefusal(body)
  return refusal === null ? ok(body) : refuse(refusal)
}

/** Le motif FACULTATIF d'un geste (annulation d'une mission) : vide, aucun motif ; sinon borné et sans coordonnée. */
export function parseAidReason(raw: string | null | undefined): Result<string | null, MutualAidRefusal> {
  const reason = normalizeServiceText(raw ?? "")
  if (reason.length === 0) return ok(null)
  if (reason.length > AID_REASON_MAX_LENGTH) return refuse("aid_reason_too_long")
  const refusal = aidTextRefusal(reason)
  return refusal === null ? ok(reason) : refuse(refusal)
}

/** D'où chaque geste de l'auteur peut partir, et où il mène (`null` : l'état ne change pas). */
export const AID_QUESTION_TRANSITIONS: Readonly<Record<AidQuestionGesture, { readonly from: readonly AidQuestionStatus[]; readonly to: AidQuestionStatus | null }>> = Object.freeze({
  edit: { from: ["open", "resolved"], to: null },
  accept: { from: ["open", "resolved"], to: "resolved" },
  unaccept: { from: ["resolved"], to: "open" },
  close: { from: ["open", "resolved"], to: "closed" },
  withdraw: { from: ["open", "resolved", "closed"], to: "withdrawn" },
})

export interface AidQuestionGestureInput {
  readonly gesture: AidQuestionGesture
  /** La personne qui agit a-t-elle posé la question ? Seule elle modifie, retient, clôt ou retire. */
  readonly isAuthor: boolean
  readonly status: AidQuestionStatus
  /** La version lue par l'écran, et celle de la ligne : un geste sur une ligne changée est refusé. */
  readonly expectedVersion: number
  readonly version: number
}

/**
 * Un geste de l'auteur sur sa question. L'auteur d'abord (retenir une réponse
 * pour autrui est refusé), puis la version lue, puis l'état de départ. Rend
 * l'état après le geste.
 */
export function checkAidQuestionGesture(input: AidQuestionGestureInput): Result<AidQuestionStatus, MutualAidRefusal> {
  if (!input.isAuthor) return refuse("aid_not_author")
  if (input.expectedVersion !== input.version) return refuse("aid_version_conflict")
  const rule = AID_QUESTION_TRANSITIONS[input.gesture]
  if (!rule.from.includes(input.status)) {
    if (input.status === "withdrawn") return refuse("aid_question_withdrawn")
    if (input.status === "closed") return refuse("aid_question_closed")
    return refuse("aid_question_not_resolved")
  }
  return ok(rule.to ?? input.status)
}

/** Peut-on répondre ? Une question ni close ni retirée, sous le plafond des réponses publiées. */
export function checkAidAnswering(input: { readonly questionStatus: AidQuestionStatus; readonly answerCount: number }): Result<true, MutualAidRefusal> {
  if (input.questionStatus === "withdrawn") return refuse("aid_question_withdrawn")
  if (input.questionStatus === "closed") return refuse("aid_question_closed")
  if (input.answerCount >= AID_ANSWERS_PER_QUESTION_MAX) return refuse("aid_answers_limit_reached")
  return ok(true)
}

export interface AidAnswerGestureInput {
  readonly gesture: AidAnswerGesture
  readonly isAuthor: boolean
  readonly status: AidAnswerStatus
  /** La réponse est-elle la réponse retenue de sa question ? */
  readonly isAccepted: boolean
  readonly questionStatus: AidQuestionStatus
  readonly expectedVersion: number
  readonly version: number
}

/**
 * Un geste de l'auteur sur SA réponse. La retirer reste possible sur une
 * question close (retrait personnel) ; la modifier, non. La réponse retenue ne
 * se modifie plus : l'auteur de la question l'a retenue telle qu'elle était.
 */
export function checkAidAnswerGesture(input: AidAnswerGestureInput): Result<AidAnswerStatus, MutualAidRefusal> {
  if (!input.isAuthor) return refuse("aid_not_author")
  if (input.expectedVersion !== input.version) return refuse("aid_version_conflict")
  if (input.status === "withdrawn") return refuse("aid_answer_withdrawn")
  if (input.questionStatus === "withdrawn") return refuse("aid_question_withdrawn")
  if (input.gesture === "withdraw") return ok("withdrawn")
  if (input.questionStatus === "closed") return refuse("aid_question_closed")
  if (input.isAccepted) return refuse("aid_answer_locked")
  return ok("published")
}

/** La réponse à retenir : une réponse PUBLIÉE de cette question (jamais celle d'une autre). */
export function checkAidAcceptedAnswer(answer: { readonly questionId: string; readonly status: AidAnswerStatus } | null, questionId: string): Result<true, MutualAidRefusal> {
  return answer !== null && answer.questionId === questionId && answer.status === "published" ? ok(true) : refuse("aid_answer_unavailable")
}

/** L'état d'une question quand sa réponse retenue disparaît (retirée ou effacée) : résolue redevient ouverte. */
export function aidStatusWithoutAcceptedAnswer(status: AidQuestionStatus): AidQuestionStatus {
  return status === "resolved" ? "open" : status
}

// ═══════════════════════════════════════════════════════════════
// Une mission bénévole
// ═══════════════════════════════════════════════════════════════

export interface AidMissionInput {
  readonly title: string
  readonly description: string
  readonly country: string
  readonly city: string
  /** Facultatif : un quartier, un repère — jamais une adresse exacte. */
  readonly area?: string | null | undefined
  /** Début, en millisecondes UTC. */
  readonly startsAt: number
  /** Fin facultative (une période) ; absente, la mission est datée de son seul début. */
  readonly endsAt?: number | null | undefined
  /** Le fuseau IANA dans lequel l'équipe a pensé l'horaire (affichage). */
  readonly timeZone: string
  readonly places: number
}

/** Une mission VALIDÉE, normalisée. */
export interface AidMissionDraft {
  readonly title: string
  readonly description: string
  readonly country: CountryCode
  readonly city: string
  readonly cityKey: string
  readonly area: string | null
  readonly startsAt: number
  readonly endsAt: number | null
  readonly timeZone: string
  readonly places: number
}

/** Le lieu approximatif : facultatif, une ligne bornée, sans coordonnée ni adresse exacte. */
export function parseAidMissionArea(raw: string | null | undefined): Result<string | null, MutualAidRefusal> {
  const area = singleLine(raw ?? "")
  if (area.length === 0) return ok(null)
  if (area.length > AID_MISSION_AREA_MAX_LENGTH) return refuse("aid_mission_area_too_long")
  const refusal = aidTextRefusal(area)
  return refusal === null ? ok(area) : refuse(refusal)
}

/**
 * La FORME de l'horaire, indépendante de l'heure : un fuseau IANA valide, un
 * début représentable, et une fin facultative, après le début, à trois mois au plus.
 */
export function parseAidMissionSchedule(input: { readonly startsAt: number; readonly endsAt: number | null; readonly timeZone: string }): Result<{ readonly startsAt: number; readonly endsAt: number | null; readonly timeZone: string }, MutualAidRefusal> {
  const timeZone = canonicalTimeZone(input.timeZone)
  if (timeZone === null) return refuse("aid_time_zone_invalid")
  if (!isServiceInstant(input.startsAt)) return refuse("aid_mission_schedule_invalid")
  const { endsAt } = input
  if (endsAt !== null && (!isServiceInstant(endsAt) || endsAt <= input.startsAt || endsAt - input.startsAt > AID_MISSION_PERIOD_MAX_DAYS * DAY_MS)) {
    return refuse("aid_mission_schedule_invalid")
  }
  return ok({ startsAt: input.startsAt, endsAt, timeZone })
}

/** L'HEURE d'une mission nouvelle ou replanifiée : elle commence dans le futur, à un an au plus. */
export function checkAidMissionTiming(startsAt: number, now: number): Result<true, MutualAidRefusal> {
  if (startsAt <= now) return refuse("aid_mission_start_past")
  if (startsAt > now + AID_MISSION_HORIZON_DAYS * DAY_MS) return refuse("aid_mission_too_far")
  return ok(true)
}

/** Le nombre de places : un entier de 1 à 500. */
export function parseAidMissionPlaces(raw: number): Result<number, MutualAidRefusal> {
  return Number.isInteger(raw) && raw >= AID_MISSION_PLACES_MIN && raw <= AID_MISSION_PLACES_MAX ? ok(raw) : refuse("aid_mission_places_invalid")
}

/**
 * LA règle d'une mission. Ordre des contrôles : titre, description,
 * coordonnées, pays, ville, lieu approximatif, horaire, places. L'heure du jour
 * se juge à part (`checkAidMissionTiming`) : une modification qui ne replanifie
 * pas une mission commencée reste admise.
 */
export function parseAidMission(input: AidMissionInput): Result<AidMissionDraft, MutualAidRefusal> {
  const title = parseAidTitle(input.title)
  if (!title.ok) return title
  const description = normalizeServiceText(input.description)
  if (description.length < AID_MISSION_DESCRIPTION_MIN_LENGTH) return refuse("aid_mission_description_too_short")
  if (description.length > AID_MISSION_DESCRIPTION_MAX_LENGTH) return refuse("aid_mission_description_too_long")
  const descriptionRefusal = aidTextRefusal(description)
  if (descriptionRefusal !== null) return refuse(descriptionRefusal)
  const country = parseAidCountry(input.country)
  if (!country.ok) return country
  const city = parseAidCity(input.city)
  if (!city.ok) return city
  const area = parseAidMissionArea(input.area)
  if (!area.ok) return area
  const schedule = parseAidMissionSchedule({ startsAt: input.startsAt, endsAt: input.endsAt ?? null, timeZone: input.timeZone })
  if (!schedule.ok) return schedule
  const places = parseAidMissionPlaces(input.places)
  if (!places.ok) return places
  return ok({
    title: title.value,
    description,
    country: country.value,
    city: city.value.city,
    cityKey: city.value.cityKey,
    area: area.value,
    startsAt: schedule.value.startsAt,
    endsAt: schedule.value.endsAt,
    timeZone: schedule.value.timeZone,
    places: places.value,
  })
}

/** Une mission vivante est ouverte, ou complète tant que ses places sont prises. */
export function aidMissionStatusFor(places: number, signupCount: number): "open" | "full" {
  return signupCount >= places ? "full" : "open"
}

/** La mission accepte-t-elle encore des inscriptions (ouverte ou complète) ? */
export function isAidMissionLive(status: AidMissionStatus): boolean {
  return status === "open" || status === "full"
}

/** Une mission est passée après sa fin, ou après son début si elle n'annonce pas de fin. */
export function isAidMissionPast(mission: { readonly startsAt: number; readonly endsAt: number | null }, now: number): boolean {
  return now >= (mission.endsAt ?? mission.startsAt)
}

export interface AidMissionGestureInput {
  readonly gesture: AidMissionGesture
  readonly status: AidMissionStatus
  readonly expectedVersion: number
  readonly version: number
}

/**
 * Un geste de l'équipe sur une mission (le rôle vivant est jugé AVANT, par le
 * fournisseur) : la version lue d'abord ; une mission annulée ne change plus ;
 * une mission close ne se modifie plus mais peut encore être annulée. Rend
 * l'état après le geste (l'état courant pour une modification : les places le
 * recalculent).
 */
export function checkAidMissionGesture(input: AidMissionGestureInput): Result<AidMissionStatus, MutualAidRefusal> {
  if (input.expectedVersion !== input.version) return refuse("aid_version_conflict")
  if (input.status === "cancelled") return refuse("aid_mission_cancelled")
  if (input.gesture === "cancel") return ok("cancelled")
  if (input.status === "closed") return refuse("aid_mission_closed")
  return ok(input.gesture === "close" ? "closed" : input.status)
}

/** Modifier le nombre de places : jamais sous le nombre des inscrits ; l'état suit les places. */
export function checkAidMissionPlacesChange(places: number, signupCount: number): Result<"open" | "full", MutualAidRefusal> {
  if (places < signupCount) return refuse("aid_mission_places_below_signups")
  return ok(aidMissionStatusFor(places, signupCount))
}

/** Ce qu'une mission dit d'elle-même pour les règles d'inscription, relu dans la transaction. */
export interface AidSignupFacts {
  readonly status: AidMissionStatus
  readonly startsAt: number
  readonly places: number
  readonly signupCount: number
  /** La personne y est-elle déjà inscrite (inscription confirmée) ? */
  readonly signedUp: boolean
}

/**
 * Ce qui empêche une inscription, hors consentement (demandé au geste) :
 * déjà inscrit, mission annulée, close, commencée, puis complète.
 */
export function aidSignupBlocker(facts: AidSignupFacts, now: number): MutualAidRefusal | null {
  if (facts.signedUp) return "aid_signup_exists"
  if (facts.status === "cancelled") return "aid_mission_cancelled"
  if (facts.status === "closed") return "aid_mission_closed"
  if (now >= facts.startsAt) return "aid_mission_started"
  if (facts.status === "full" || facts.signupCount >= facts.places) return "aid_mission_full"
  return null
}

/**
 * S'inscrire : le consentement EXPLICITE à montrer son nom publié à l'équipe
 * de la page d'abord, puis les places restantes, relues dans la transaction.
 * Rend le nouveau compte et l'état (complète à la dernière place).
 */
export function checkAidSignup(facts: AidSignupFacts, consent: boolean, now: number): Result<{ readonly status: "open" | "full"; readonly signupCount: number }, MutualAidRefusal> {
  if (!consent) return refuse("aid_signup_consent_required")
  const blocker = aidSignupBlocker(facts, now)
  if (blocker !== null) return refuse(blocker)
  const signupCount = facts.signupCount + 1
  return ok({ status: aidMissionStatusFor(facts.places, signupCount), signupCount })
}

/**
 * Se retirer : son inscription confirmée, avant le début de la mission. Une
 * place libérée rouvre une mission complète ; une mission close ou annulée le reste.
 */
export function checkAidSignupWithdrawal(facts: AidSignupFacts, now: number): Result<{ readonly status: AidMissionStatus; readonly signupCount: number }, MutualAidRefusal> {
  if (!facts.signedUp) return refuse("aid_signup_missing")
  if (now >= facts.startsAt) return refuse("aid_mission_started")
  const signupCount = Math.max(0, facts.signupCount - 1)
  return ok({ status: facts.status === "full" ? aidMissionStatusFor(facts.places, signupCount) : facts.status, signupCount })
}
