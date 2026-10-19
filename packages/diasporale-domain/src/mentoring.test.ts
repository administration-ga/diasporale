import { describe, expect, it } from "bun:test"

import { DEFAULT_FACET_VISIBILITY } from "./facet"
import {
  MENTEE_OPEN_REQUESTS_MAX,
  MENTOR_CAPACITY_MAX,
  MENTOR_LANGUAGE_CODES,
  MENTOR_LISTING_STATES,
  MENTOR_PENDING_REQUESTS_MAX,
  MENTOR_PROFILE_STATES,
  MENTORING_DOMAINS,
  MENTORING_REASON_MAX_LENGTH,
  MENTORING_REFUSALS,
  MENTORING_REQUEST_ACTIONS,
  MENTORING_REQUEST_OPEN_STATUSES,
  MENTORING_REQUEST_STATUSES,
  MENTORING_REQUEST_TERMINAL_STATUSES,
  MENTORING_REQUEST_TTL_DAYS,
  availableMentoringActions,
  checkMentorCapacity,
  checkMentorCapacityChange,
  checkMentoringAdmission,
  checkMentoringRequestTiming,
  checkMentoringSlotVersion,
  checkMentoringTransition,
  checkMentorOptIn,
  checkMentorProfileEditable,
  checkMentorProfileVersion,
  effectiveMentoringStatus,
  isMentorCapacity,
  isMentoringDomain,
  isMentoringIdempotencyKey,
  isMentoringRequestOpen,
  isMentoringRequestTerminal,
  mentorAcceptsRequests,
  mentoringRequestDeadline,
  mentoringRequestFingerprint,
  mentoringTextRefusal,
  mentoringWallTimeToUtc,
  normalizeMentoringRequestDraft,
  parseMentoringReason,
  parseMentoringSlot,
  parseMentorProfile,
  projectMentorPlace,
  transitionMentorState,
  type MentoringRequestInput,
  type MentorProfileInput,
} from "./mentoring"
import { SERVICE_LANGUAGE_CODES } from "./services"
import { DAY_MS, HOUR_MS, MINUTE_MS } from "./time"

const NOW = Date.UTC(2026, 9, 18, 10)
const PRESENTATION = "Arrivée à Paris en 2015, j'aide les nouveaux venus à trouver un logement et à faire leurs démarches."
const MESSAGE = "Je viens d'arriver à Lyon pour mes études et je cherche des conseils pour le logement."
const slot = (startHours: number, lengthMinutes = 60) => ({ startAt: NOW + startHours * HOUR_MS, endAt: NOW + startHours * HOUR_MS + lengthMinutes * MINUTE_MS })

function profile(overrides: Partial<MentorProfileInput> = {}): MentorProfileInput {
  return {
    domains: ["admin", "housing"],
    presentation: PRESENTATION,
    languages: ["fr", "en"],
    country: "fr",
    city: "  Paris   11e ",
    availability: "Le soir en semaine",
    maxActiveMentees: 3,
    ...overrides,
  }
}

function request(overrides: Partial<MentoringRequestInput> = {}): MentoringRequestInput {
  return { domain: "housing", goal: "Trouver un logement étudiant", message: MESSAGE, wishedSlots: [slot(24)], timeZone: "Europe/Paris", ...overrides }
}

describe("mentorat — listes fermées", () => {
  it("chaque sous-liste appartient à sa liste, et chaque refus est unique et bien formé", () => {
    for (const status of MENTORING_REQUEST_TERMINAL_STATUSES) expect(MENTORING_REQUEST_STATUSES).toContain(status)
    for (const status of MENTORING_REQUEST_OPEN_STATUSES) expect(MENTORING_REQUEST_STATUSES).toContain(status)
    for (const state of MENTOR_LISTING_STATES) expect(MENTOR_PROFILE_STATES).toContain(state)
    expect(new Set(MENTORING_REFUSALS).size).toBe(MENTORING_REFUSALS.length)
    for (const code of MENTORING_REFUSALS) expect(code).toMatch(/^[a-z][a-z0-9_]{1,63}$/)
    expect(MENTOR_LANGUAGE_CODES).toBe(SERVICE_LANGUAGE_CODES)
  })

  it("reconnaît les domaines d'aide et refuse le reste", () => {
    for (const domain of MENTORING_DOMAINS) expect(isMentoringDomain(domain)).toBe(true)
    expect(isMentoringDomain("legal")).toBe(false)
    expect(isMentoringDomain("Housing")).toBe(false)
  })

  it("le plafond de mentorés actifs est un entier de 1 à 10", () => {
    expect(isMentorCapacity(1)).toBe(true)
    expect(isMentorCapacity(MENTOR_CAPACITY_MAX)).toBe(true)
    for (const value of [0, 11, 2.5, Number.NaN, -1]) expect(isMentorCapacity(value)).toBe(false)
  })
})

describe("textes libres", () => {
  it("refuse une coordonnée ou une adresse exacte, avec les codes du mentorat", () => {
    expect(mentoringTextRefusal("écrivez-moi à awa@example.com")).toBe("mentoring_contact_forbidden")
    expect(mentoringTextRefusal("appelez le 06 12 34 56 78")).toBe("mentoring_contact_forbidden")
    expect(mentoringTextRefusal("venez au 12 rue des Lilas")).toBe("mentoring_address_forbidden")
    expect(mentoringTextRefusal("Paris 11e, près du métro")).toBeNull()
  })
})

describe("profil de mentor", () => {
  it("normalise un profil complet : domaines dans l'ordre canonique, langues dédoublonnées, pays et ville", () => {
    expect(parseMentorProfile(profile({ domains: [" housing", "admin", "housing"], languages: ["FR", "en", "fr"] }))).toEqual({
      ok: true,
      value: {
        domains: ["housing", "admin"],
        presentation: PRESENTATION,
        languages: ["fr", "en"],
        country: "FR",
        city: "Paris 11e",
        availability: "Le soir en semaine",
        maxActiveMentees: 3,
      },
    })
  })

  it("la ville est facultative : absente, nulle ou vide", () => {
    const withoutCity: MentorProfileInput = { domains: ["work"], presentation: PRESENTATION, languages: ["fr"], country: "BE", availability: "Le samedi matin", maxActiveMentees: 1 }
    for (const input of [withoutCity, { ...withoutCity, city: null }, { ...withoutCity, city: "   " }]) {
      const parsed = parseMentorProfile(input)
      expect(parsed.ok && parsed.value.city).toBeNull()
    }
  })

  it("refuse chaque champ invalide par son code", () => {
    expect(parseMentorProfile(profile({ domains: [] }))).toEqual({ ok: false, code: "mentor_domains_required" })
    expect(parseMentorProfile(profile({ domains: ["housing", "legal"] }))).toEqual({ ok: false, code: "mentor_domain_invalid" })
    expect(parseMentorProfile(profile({ presentation: "Trop court." }))).toEqual({ ok: false, code: "mentor_presentation_too_short" })
    expect(parseMentorProfile(profile({ presentation: "a".repeat(601) }))).toEqual({ ok: false, code: "mentor_presentation_too_long" })
    expect(parseMentorProfile(profile({ presentation: `${PRESENTATION} Écrivez à mireille@example.com` }))).toEqual({ ok: false, code: "mentoring_contact_forbidden" })
    expect(parseMentorProfile(profile({ languages: [] }))).toEqual({ ok: false, code: "mentor_languages_required" })
    expect(parseMentorProfile(profile({ languages: ["fr", "klingon"] }))).toEqual({ ok: false, code: "mentor_language_invalid" })
    expect(parseMentorProfile(profile({ languages: ["fr", "en", "es", "pt", "de", "it"] }))).toEqual({ ok: false, code: "mentor_languages_too_many" })
    for (const country of ["GA", "ZZ", ""]) expect(parseMentorProfile(profile({ country }))).toEqual({ ok: false, code: "mentor_country_invalid" })
    expect(parseMentorProfile(profile({ city: "Paris\nNord" }))).toEqual({ ok: false, code: "mentor_city_invalid" })
    expect(parseMentorProfile(profile({ city: "x".repeat(81) }))).toEqual({ ok: false, code: "mentor_city_invalid" })
    expect(parseMentorProfile(profile({ city: "12 rue des Lilas" }))).toEqual({ ok: false, code: "mentoring_address_forbidden" })
    expect(parseMentorProfile(profile({ availability: "x" }))).toEqual({ ok: false, code: "mentor_availability_too_short" })
    expect(parseMentorProfile(profile({ availability: "x".repeat(201) }))).toEqual({ ok: false, code: "mentor_availability_too_long" })
    for (const maxActiveMentees of [0, 11, 1.5]) expect(parseMentorProfile(profile({ maxActiveMentees }))).toEqual({ ok: false, code: "mentor_capacity_invalid" })
  })

  it("devenir mentor exige un consentement explicite et aucun profil vivant ; un retrait permet un nouvel opt-in", () => {
    expect(checkMentorOptIn({ consent: false, existing: null })).toEqual({ ok: false, code: "mentor_consent_required" })
    expect(checkMentorOptIn({ consent: true, existing: "active" })).toEqual({ ok: false, code: "mentor_profile_exists" })
    expect(checkMentorOptIn({ consent: true, existing: "paused" })).toEqual({ ok: false, code: "mentor_profile_exists" })
    expect(checkMentorOptIn({ consent: true, existing: "retired" })).toEqual({ ok: true, value: null })
    expect(checkMentorOptIn({ consent: true, existing: null })).toEqual({ ok: true, value: null })
  })

  it("une modification cite la version courante, jamais sur un profil retiré, jamais sous les mentorés actifs", () => {
    expect(checkMentorProfileVersion(4, 4)).toEqual({ ok: true, value: 5 })
    expect(checkMentorProfileVersion(3, 4)).toEqual({ ok: false, code: "mentor_profile_version_changed" })
    expect(checkMentorProfileEditable("retired")).toEqual({ ok: false, code: "mentor_profile_retired" })
    expect(checkMentorProfileEditable("paused")).toEqual({ ok: true, value: null })
    expect(checkMentorCapacityChange(2, 2)).toEqual({ ok: true, value: null })
    expect(checkMentorCapacityChange(1, 2)).toEqual({ ok: false, code: "mentor_capacity_below_active" })
  })

  it("pause, reprise et retrait ; l'état déjà courant ne change rien ; un profil retiré ne bouge plus", () => {
    expect(transitionMentorState("active", "paused")).toEqual({ ok: true, value: { state: "paused", changed: true } })
    expect(transitionMentorState("paused", "active")).toEqual({ ok: true, value: { state: "active", changed: true } })
    expect(transitionMentorState("paused", "retired")).toEqual({ ok: true, value: { state: "retired", changed: true } })
    expect(transitionMentorState("active", "active")).toEqual({ ok: true, value: { state: "active", changed: false } })
    expect(transitionMentorState("retired", "active")).toEqual({ ok: false, code: "mentor_profile_retired" })
  })

  it("un mentor reçoit une demande s'il est actif, sous son plafond et sans boîte saturée", () => {
    const facts = { state: "active" as const, activeMentees: 1, maxActiveMentees: 2, pendingRequests: 0 }
    expect(mentorAcceptsRequests(facts)).toBe(true)
    expect(mentorAcceptsRequests({ ...facts, state: "paused" })).toBe(false)
    expect(mentorAcceptsRequests({ ...facts, activeMentees: 2 })).toBe(false)
    expect(mentorAcceptsRequests({ ...facts, pendingRequests: MENTOR_PENDING_REQUESTS_MAX })).toBe(false)
  })

  it("la ville et l'année d'arrivée suivent les niveaux de la facette du mentor", () => {
    const stranger = { isSelf: false, isConnection: false, isSameCountryMember: false, isActiveMember: true }
    const facet = { arrivedAt: 2015, visibility: DEFAULT_FACET_VISIBILITY }
    // Par défaut : la ville aux seules relations, l'année d'arrivée à soi seul.
    expect(projectMentorPlace({ city: "Paris", facet, viewer: stranger })).toEqual({ city: null, arrivedAt: null })
    expect(projectMentorPlace({ city: "Paris", facet, viewer: { ...stranger, isConnection: true } })).toEqual({ city: "Paris", arrivedAt: null })
    expect(projectMentorPlace({ city: "Paris", facet, viewer: { ...stranger, isSelf: true } })).toEqual({ city: "Paris", arrivedAt: 2015 })
    const open = { arrivedAt: 2015, visibility: { ...DEFAULT_FACET_VISIBILITY, city: "network" as const, arrivedAt: "network" as const } }
    expect(projectMentorPlace({ city: "Paris", facet: open, viewer: stranger })).toEqual({ city: "Paris", arrivedAt: 2015 })
    expect(projectMentorPlace({ city: null, facet: { visibility: open.visibility }, viewer: stranger })).toEqual({ city: null, arrivedAt: null })
    expect(projectMentorPlace({ city: "Paris", facet: null, viewer: stranger })).toEqual({ city: null, arrivedAt: null })
  })
})

describe("demande de mentorat", () => {
  it("normalise une demande : objectif sur une ligne, message, créneaux triés et dédoublonnés, fuseau canonique", () => {
    const later = slot(48)
    const sooner = slot(24, 30)
    expect(normalizeMentoringRequestDraft(request({ goal: "  Trouver   un logement\nétudiant ", wishedSlots: [later, sooner, later], timeZone: " Europe/Paris " }))).toEqual({
      ok: true,
      value: { domain: "housing", goal: "Trouver un logement étudiant", message: MESSAGE, wishedSlots: [sooner, later], timeZone: "Europe/Paris" },
    })
    const sameStart = { startAt: later.startAt, endAt: later.endAt + 30 * MINUTE_MS }
    const sorted = normalizeMentoringRequestDraft(request({ wishedSlots: [sameStart, later] }))
    expect(sorted.ok && sorted.value.wishedSlots).toEqual([later, sameStart])
    expect(normalizeMentoringRequestDraft(request({ wishedSlots: [] }))).toMatchObject({ ok: true, value: { wishedSlots: [] } })
  })

  it("refuse chaque champ invalide par son code", () => {
    expect(normalizeMentoringRequestDraft(request({ domain: "legal" }))).toEqual({ ok: false, code: "mentor_domain_invalid" })
    expect(normalizeMentoringRequestDraft(request({ goal: "Oui" }))).toEqual({ ok: false, code: "mentoring_goal_too_short" })
    expect(normalizeMentoringRequestDraft(request({ goal: "x".repeat(121) }))).toEqual({ ok: false, code: "mentoring_goal_too_long" })
    expect(normalizeMentoringRequestDraft(request({ goal: "Rappelez-moi au 06 12 34 56 78" }))).toEqual({ ok: false, code: "mentoring_contact_forbidden" })
    expect(normalizeMentoringRequestDraft(request({ message: "Trop court." }))).toEqual({ ok: false, code: "mentoring_message_too_short" })
    expect(normalizeMentoringRequestDraft(request({ message: "x".repeat(1001) }))).toEqual({ ok: false, code: "mentoring_message_too_long" })
    expect(normalizeMentoringRequestDraft(request({ message: `${MESSAGE} awa@example.com` }))).toEqual({ ok: false, code: "mentoring_contact_forbidden" })
    expect(normalizeMentoringRequestDraft(request({ timeZone: "Mars/Olympus" }))).toEqual({ ok: false, code: "mentoring_time_zone_invalid" })
    expect(normalizeMentoringRequestDraft(request({ wishedSlots: [slot(24), slot(48), slot(72), slot(96)] }))).toEqual({ ok: false, code: "mentoring_slots_too_many" })
    for (const wrong of [slot(24, 10), slot(24, 241), { startAt: -1, endAt: NOW }, { startAt: NOW, endAt: Number.POSITIVE_INFINITY }]) {
      expect(normalizeMentoringRequestDraft(request({ wishedSlots: [wrong] }))).toEqual({ ok: false, code: "mentoring_slot_invalid" })
    }
  })

  it("l'heure d'une demande nouvelle : créneaux futurs dans l'horizon ; échéance à 14 jours", () => {
    expect(checkMentoringRequestTiming({ wishedSlots: [slot(24)] }, NOW)).toEqual({ ok: true, value: { expiresAt: NOW + MENTORING_REQUEST_TTL_DAYS * DAY_MS } })
    expect(checkMentoringRequestTiming({ wishedSlots: [] }, NOW)).toEqual({ ok: true, value: { expiresAt: NOW + 14 * DAY_MS } })
    expect(checkMentoringRequestTiming({ wishedSlots: [slot(0)] }, NOW)).toEqual({ ok: false, code: "mentoring_slot_past" })
    expect(checkMentoringRequestTiming({ wishedSlots: [slot(24 * 90)] }, NOW)).toEqual({ ok: false, code: "mentoring_slot_too_far" })
  })

  it("une clé d'idempotence sûre ; une empreinte stable du corps normalisé", () => {
    expect(isMentoringIdempotencyKey("2b4a7a0e-6a52-4c8e-9a52-7f1f0b6c2d11")).toBe(true)
    for (const key of ["court", "a".repeat(129), "clé avec espaces 0123"]) expect(isMentoringIdempotencyKey(key)).toBe(false)
    const draft = normalizeMentoringRequestDraft(request())
    if (!draft.ok) throw new Error(draft.code)
    const fingerprint = mentoringRequestFingerprint({ mentorId: "mentor-1", ...draft.value })
    expect(fingerprint).toMatch(/^v1:[0-9a-f]{16}$/)
    expect(mentoringRequestFingerprint({ mentorId: "mentor-1", ...draft.value })).toBe(fingerprint)
    expect(mentoringRequestFingerprint({ mentorId: "mentor-2", ...draft.value })).not.toBe(fingerprint)
    expect(mentoringRequestFingerprint({ mentorId: "mentor-1", ...draft.value, goal: "Autre objectif" })).not.toBe(fingerprint)
  })

  it("admission : soi-même, domaine non proposé, paire ouverte, plafonds", () => {
    const facts = { isSelf: false, domainOffered: true, pairOpen: false, menteeOpenRequests: 0, mentorAccepts: true }
    expect(checkMentoringAdmission(facts)).toEqual({ ok: true, value: null })
    expect(checkMentoringAdmission({ ...facts, isSelf: true })).toEqual({ ok: false, code: "mentoring_self_request" })
    expect(checkMentoringAdmission({ ...facts, domainOffered: false })).toEqual({ ok: false, code: "mentoring_domain_not_offered" })
    expect(checkMentoringAdmission({ ...facts, pairOpen: true })).toEqual({ ok: false, code: "mentoring_pair_open" })
    expect(checkMentoringAdmission({ ...facts, menteeOpenRequests: MENTEE_OPEN_REQUESTS_MAX })).toEqual({ ok: false, code: "mentoring_mentee_limit" })
    expect(checkMentoringAdmission({ ...facts, mentorAccepts: false })).toEqual({ ok: false, code: "mentoring_mentor_full" })
  })

  it("accepter ne dépasse jamais le plafond", () => {
    expect(checkMentorCapacity(1, 2)).toEqual({ ok: true, value: null })
    expect(checkMentorCapacity(2, 2)).toEqual({ ok: false, code: "mentoring_capacity_reached" })
  })

  it("un créneau proposé : bien formé, futur, dans l'horizon, fuseau canonique ; sa version se cite", () => {
    expect(parseMentoringSlot({ ...slot(24, 45), timeZone: " Europe/Paris " }, NOW)).toEqual({ ok: true, value: { ...slot(24, 45), timeZone: "Europe/Paris" } })
    expect(parseMentoringSlot({ ...slot(24, 5), timeZone: "Europe/Paris" }, NOW)).toEqual({ ok: false, code: "mentoring_slot_invalid" })
    expect(parseMentoringSlot({ ...slot(-1), timeZone: "Europe/Paris" }, NOW)).toEqual({ ok: false, code: "mentoring_slot_past" })
    expect(parseMentoringSlot({ ...slot(24 * 91), timeZone: "Europe/Paris" }, NOW)).toEqual({ ok: false, code: "mentoring_slot_too_far" })
    expect(parseMentoringSlot({ ...slot(24), timeZone: "+02:00" }, NOW)).toEqual({ ok: false, code: "mentoring_time_zone_invalid" })
    expect(checkMentoringSlotVersion(1, 1)).toEqual({ ok: true, value: 2 })
    expect(checkMentoringSlotVersion(0, 1)).toEqual({ ok: false, code: "mentoring_slot_version_changed" })
  })

  it("un motif facultatif, borné, sans coordonnée", () => {
    for (const empty of [null, undefined, "", "   "]) expect(parseMentoringReason(empty)).toEqual({ ok: true, value: null })
    expect(parseMentoringReason("  Je ne suis plus  disponible ")).toEqual({ ok: true, value: "Je ne suis plus disponible" })
    expect(parseMentoringReason("x".repeat(MENTORING_REASON_MAX_LENGTH + 1))).toEqual({ ok: false, code: "mentoring_reason_too_long" })
    expect(parseMentoringReason("Écrivez-moi : awa@example.com")).toEqual({ ok: false, code: "mentoring_contact_forbidden" })
  })

  it("les heures murales deviennent un instant exact ; un changement d'heure est refusé avec les codes du mentorat", () => {
    expect(mentoringWallTimeToUtc({ date: "2026-10-24", time: "18:00" }, "Europe/Paris")).toEqual({ ok: true, value: Date.UTC(2026, 9, 24, 16) })
    expect(mentoringWallTimeToUtc({ date: "2026-02-30", time: "10:00" }, "Europe/Paris")).toEqual({ ok: false, code: "mentoring_time_invalid" })
    expect(mentoringWallTimeToUtc({ date: "2026-03-29", time: "02:30" }, "Europe/Paris")).toEqual({ ok: false, code: "mentoring_time_nonexistent" })
    expect(mentoringWallTimeToUtc({ date: "2026-10-25", time: "02:30" }, "Europe/Paris")).toEqual({ ok: false, code: "mentoring_time_ambiguous" })
    expect(mentoringWallTimeToUtc({ date: "2026-10-24", time: "10:00" }, "Mars/Olympus")).toEqual({ ok: false, code: "mentoring_time_zone_invalid" })
  })
})

describe("échéance et transitions", () => {
  it("une demande envoyée expire à son échéance, écrite ou non ; un mentorat accepté n'expire pas", () => {
    const expiresAt = NOW + DAY_MS
    expect(effectiveMentoringStatus({ status: "sent", expiresAt }, NOW)).toBe("sent")
    expect(effectiveMentoringStatus({ status: "sent", expiresAt }, expiresAt)).toBe("expired")
    expect(effectiveMentoringStatus({ status: "accepted", expiresAt }, expiresAt + DAY_MS)).toBe("accepted")
    expect(mentoringRequestDeadline({ status: "sent", expiresAt })).toBe(expiresAt)
    expect(mentoringRequestDeadline({ status: "accepted", expiresAt })).toBeNull()
  })

  it("distingue les états ouverts et terminaux", () => {
    expect(MENTORING_REQUEST_STATUSES.filter(isMentoringRequestOpen)).toEqual(["sent", "accepted"])
    expect(MENTORING_REQUEST_STATUSES.filter(isMentoringRequestTerminal)).toEqual(["declined", "cancelled", "expired", "closed"])
  })

  it("qui peut faire quoi, et quand", () => {
    expect(checkMentoringTransition({ action: "accept", role: "mentor", status: "sent" })).toEqual({ ok: true, value: "accepted" })
    expect(checkMentoringTransition({ action: "decline", role: "mentor", status: "sent" })).toEqual({ ok: true, value: "declined" })
    expect(checkMentoringTransition({ action: "cancel", role: "mentee", status: "sent" })).toEqual({ ok: true, value: "cancelled" })
    expect(checkMentoringTransition({ action: "propose_slot", role: "mentor", status: "accepted" })).toEqual({ ok: true, value: "accepted" })
    expect(checkMentoringTransition({ action: "close", role: "mentee", status: "accepted" })).toEqual({ ok: true, value: "closed" })
    expect(checkMentoringTransition({ action: "close", role: "mentor", status: "accepted" })).toEqual({ ok: true, value: "closed" })
    expect(checkMentoringTransition({ action: "accept", role: "mentor", status: "expired" })).toEqual({ ok: false, code: "mentoring_request_expired" })
    expect(checkMentoringTransition({ action: "close", role: "mentor", status: "closed" })).toEqual({ ok: false, code: "mentoring_request_closed" })
    expect(checkMentoringTransition({ action: "accept", role: "mentee", status: "sent" })).toEqual({ ok: false, code: "mentoring_action_forbidden" })
    expect(checkMentoringTransition({ action: "cancel", role: "mentor", status: "sent" })).toEqual({ ok: false, code: "mentoring_action_forbidden" })
    expect(checkMentoringTransition({ action: "accept", role: "mentor", status: "accepted" })).toEqual({ ok: false, code: "mentoring_request_not_open" })
    expect(checkMentoringTransition({ action: "close", role: "mentee", status: "sent" })).toEqual({ ok: false, code: "mentoring_request_not_open" })
  })

  it("rend les seuls gestes ouverts, dans l'ordre fixe des gestes", () => {
    expect(availableMentoringActions({ role: "mentee", status: "sent" })).toEqual(["cancel"])
    expect(availableMentoringActions({ role: "mentor", status: "sent" })).toEqual(["accept", "decline"])
    expect(availableMentoringActions({ role: "mentor", status: "accepted" })).toEqual(["propose_slot", "close"])
    expect(availableMentoringActions({ role: "mentee", status: "accepted" })).toEqual(["close"])
    for (const status of MENTORING_REQUEST_TERMINAL_STATUSES) expect(availableMentoringActions({ role: "mentor", status })).toEqual([])
    expect(MENTORING_REQUEST_ACTIONS).toEqual(["accept", "decline", "cancel", "propose_slot", "close"])
  })
})
