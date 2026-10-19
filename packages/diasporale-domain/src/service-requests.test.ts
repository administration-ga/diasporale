import { describe, expect, it } from "bun:test"

import {
  SERVICE_NO_SHOW_CONTEST_DAYS,
  SERVICE_PROPOSAL_MAX_VERSIONS,
  SERVICE_REQUEST_ACTIONS,
  SERVICE_REQUEST_REFUSALS,
  SERVICE_REQUEST_STATUSES,
  SERVICE_REQUEST_TERMINAL_STATUSES,
  availableServiceRequestActions,
  canContestNoShow,
  canonicalTimeZone,
  checkNoShowContest,
  checkProposalVersion,
  checkServiceRequestTiming,
  checkServiceRequestTransition,
  effectiveServiceRequestStatus,
  isServiceIdempotencyKey,
  isServiceInstant,
  isServiceRequestTerminal,
  nextProposalVersion,
  normalizeServiceRequestDraft,
  normalizeServiceText,
  parseServiceProposal,
  parseServiceReason,
  serviceRequestDeadline,
  serviceRequestFingerprint,
  serviceRequestTimeline,
  serviceTextRefusal,
  slotsOverlap,
  utcToZonedWallTime,
  zonedWallTimeToUtc,
  type ServiceProposalInput,
  type ServiceRequestStatus,
} from "./service-requests"
import { DAY_MS, HOUR_MS, MINUTE_MS } from "./time"

const NOW = Date.UTC(2026, 9, 18, 10)
const NEED = "Tresses africaines pour un mariage, cheveux mi-longs."
const window = (startHours: number, lengthHours = 2) => ({ startAt: NOW + startHours * HOUR_MS, endAt: NOW + (startHours + lengthHours) * HOUR_MS })

function proposal(overrides: Partial<ServiceProposalInput> = {}): ServiceProposalInput {
  return {
    amountMinor: 4500,
    currency: "eur",
    durationMinutes: 90,
    startAt: NOW + 2 * DAY_MS,
    timeZone: "Europe/Paris",
    location: { mode: "onsite", area: "  Paris   11e  " },
    details: "Tresses, mèches fournies.",
    cancellationTerms: "Annulation libre jusqu'à la veille.",
    expiresAt: NOW + DAY_MS,
    ...overrides,
  }
}

describe("demandes de service — listes fermées", () => {
  it("chaque état terminal appartient aux états, et chaque refus est unique", () => {
    for (const status of SERVICE_REQUEST_TERMINAL_STATUSES) expect(SERVICE_REQUEST_STATUSES).toContain(status)
    expect(new Set(SERVICE_REQUEST_REFUSALS).size).toBe(SERVICE_REQUEST_REFUSALS.length)
    for (const code of SERVICE_REQUEST_REFUSALS) expect(code).toMatch(/^[a-z][a-z0-9_]{1,63}$/)
  })
})

describe("textes libres", () => {
  it("normalise les espaces, les fins de ligne et les lignes vides", () => {
    expect(normalizeServiceText("  Bonjour\r\n\r\n\r\n\tà   tous  ")).toBe("Bonjour\n\nà tous")
    expect(normalizeServiceText("été")).toBe("été")
  })

  it("refuse une adresse e-mail, un numéro de téléphone ou une adresse exacte", () => {
    expect(serviceTextRefusal("écrivez-moi à awa@example.com")).toBe("request_contact_forbidden")
    expect(serviceTextRefusal("appelez le 06 12 34 56 78")).toBe("request_contact_forbidden")
    expect(serviceTextRefusal("+33 (0)6 12 34 56 78")).toBe("request_contact_forbidden")
    expect(serviceTextRefusal("venez au 12 rue des Lilas")).toBe("request_address_forbidden")
    expect(serviceTextRefusal("3 bis, avenue Foch")).toBe("request_address_forbidden")
    expect(serviceTextRefusal("221B Baker Street")).toBe("request_address_forbidden")
    expect(serviceTextRefusal("at 10 Oak Lane, London")).toBe("request_address_forbidden")
    expect(serviceTextRefusal("12 allée des Pins")).toBe("request_address_forbidden")
  })

  it("laisse passer un lieu approximatif, une date ou un prix", () => {
    for (const text of ["Paris 11e", "75011 Paris", "le 12/06/2027 à 10:30", "5 rues plus loin", "budget 1 250 000 XAF", "le 12.06.2027", "1st floor", "J'ai 3 enfants à la place", "2 kids on the road"]) {
      expect(serviceTextRefusal(text)).toBeNull()
    }
  })
})

describe("fuseaux et heures murales", () => {
  it("canonise un fuseau IANA et refuse le reste", () => {
    expect(canonicalTimeZone(" Europe/Paris ")).toBe("Europe/Paris")
    // V8 (le moteur) rend le nom canonique d'un alias ; d'autres moteurs le gardent tel quel.
    expect(["America/New_York", "US/Eastern"]).toContain(canonicalTimeZone("US/Eastern") ?? "")
    expect(canonicalTimeZone("UTC")).toBe("UTC")
    for (const zone of ["", "   ", "Not/A_Zone", "../Europe/Paris", "+02:00", "x".repeat(65)]) expect(canonicalTimeZone(zone)).toBeNull()
  })

  it("reconnaît un instant représentable", () => {
    expect(isServiceInstant(NOW)).toBe(true)
    for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 9e15]) expect(isServiceInstant(value)).toBe(false)
  })

  it("convertit une heure murale en instant exact (R-G21)", () => {
    expect(zonedWallTimeToUtc({ date: "2026-10-24", time: "18:00" }, "Europe/Paris")).toEqual({ ok: true, value: Date.UTC(2026, 9, 24, 16) })
    expect(zonedWallTimeToUtc({ date: "2026-10-26", time: "18:00" }, "Europe/Paris")).toEqual({ ok: true, value: Date.UTC(2026, 9, 26, 17) })
    expect(zonedWallTimeToUtc({ date: "2026-10-25", time: "03:30" }, "Europe/Paris")).toEqual({ ok: true, value: Date.UTC(2026, 9, 25, 2, 30) })
    expect(zonedWallTimeToUtc({ date: "2026-11-02", time: "09:15" }, "America/Toronto")).toEqual({ ok: true, value: Date.UTC(2026, 10, 2, 14, 15) })
  })

  it("refuse l'heure qui n'existe pas et celle qui existe deux fois", () => {
    expect(zonedWallTimeToUtc({ date: "2026-03-29", time: "02:30" }, "Europe/Paris")).toEqual({ ok: false, code: "request_time_nonexistent" })
    expect(zonedWallTimeToUtc({ date: "2026-10-25", time: "02:30" }, "Europe/Paris")).toEqual({ ok: false, code: "request_time_ambiguous" })
    expect(zonedWallTimeToUtc({ date: "2026-03-08", time: "02:30" }, "America/Toronto")).toEqual({ ok: false, code: "request_time_nonexistent" })
    expect(zonedWallTimeToUtc({ date: "2026-11-01", time: "01:30" }, "America/Toronto")).toEqual({ ok: false, code: "request_time_ambiguous" })
  })

  it("refuse une saisie mal formée, une date impossible ou un fuseau inconnu", () => {
    expect(zonedWallTimeToUtc({ date: "2026-02-30", time: "10:00" }, "Europe/Paris")).toEqual({ ok: false, code: "request_time_invalid" })
    expect(zonedWallTimeToUtc({ date: "2026-10-24", time: "24:00" }, "Europe/Paris")).toEqual({ ok: false, code: "request_time_invalid" })
    expect(zonedWallTimeToUtc({ date: "2026-10-24", time: "10:60" }, "Europe/Paris")).toEqual({ ok: false, code: "request_time_invalid" })
    expect(zonedWallTimeToUtc({ date: "24/10/2026", time: "10:00" }, "Europe/Paris")).toEqual({ ok: false, code: "request_time_invalid" })
    expect(zonedWallTimeToUtc({ date: "2026-10-24", time: "10h" }, "Europe/Paris")).toEqual({ ok: false, code: "request_time_invalid" })
    expect(zonedWallTimeToUtc({ date: "2026-10-24", time: "10:00" }, "Mars/Olympus")).toEqual({ ok: false, code: "request_time_zone_invalid" })
  })

  it("relit un instant dans un autre fuseau : un rendez-vous de Paris vu de Montréal", () => {
    const parisEvening = Date.UTC(2026, 9, 27, 17)
    expect(utcToZonedWallTime(parisEvening, "Europe/Paris")).toEqual({ date: "2026-10-27", time: "18:00" })
    expect(utcToZonedWallTime(parisEvening, "America/Toronto")).toEqual({ date: "2026-10-27", time: "13:00" })
    expect(utcToZonedWallTime(Date.UTC(2026, 0, 1), "Asia/Tokyo")).toEqual({ date: "2026-01-01", time: "09:00" })
    expect(utcToZonedWallTime(parisEvening, "Nowhere/Zone")).toBeNull()
    expect(utcToZonedWallTime(-5, "Europe/Paris")).toBeNull()
  })
})

describe("la demande", () => {
  const draft = { need: NEED, windows: [window(48), window(24)], timeZone: "Europe/Paris" }

  it("normalise le besoin, trie les fenêtres et retire les doublons", () => {
    const result = normalizeServiceRequestDraft({ ...draft, need: `  ${NEED}  `, windows: [window(48), window(24), window(24)] })
    expect(result).toEqual({ ok: true, value: { need: NEED, windows: [window(24), window(48)], timeZone: "Europe/Paris" } })
  })

  it("refuse un besoin trop court, trop long, ou porteur de coordonnées", () => {
    expect(normalizeServiceRequestDraft({ ...draft, need: "Coiffure" })).toEqual({ ok: false, code: "request_need_too_short" })
    expect(normalizeServiceRequestDraft({ ...draft, need: "x".repeat(1001) })).toEqual({ ok: false, code: "request_need_too_long" })
    expect(normalizeServiceRequestDraft({ ...draft, need: `${NEED} 06 12 34 56 78` })).toEqual({ ok: false, code: "request_contact_forbidden" })
    expect(normalizeServiceRequestDraft({ ...draft, need: `${NEED} Au 4 rue Monge.` })).toEqual({ ok: false, code: "request_address_forbidden" })
  })

  it("refuse un fuseau inconnu et un nombre de fenêtres hors bornes", () => {
    expect(normalizeServiceRequestDraft({ ...draft, timeZone: "Paris" })).toEqual({ ok: false, code: "request_time_zone_invalid" })
    expect(normalizeServiceRequestDraft({ ...draft, windows: [] })).toEqual({ ok: false, code: "request_windows_required" })
    expect(normalizeServiceRequestDraft({ ...draft, windows: [window(1), window(4), window(8), window(12)] })).toEqual({ ok: false, code: "request_windows_too_many" })
  })

  it.each([
    { startAt: NOW, endAt: NOW },
    { startAt: NOW + HOUR_MS, endAt: NOW },
    { startAt: NOW, endAt: NOW + 10 * MINUTE_MS },
    { startAt: NOW, endAt: NOW + 15 * DAY_MS },
    { startAt: 1.5, endAt: NOW },
    { startAt: NOW, endAt: Number.NaN },
  ])("refuse une fenêtre mal formée : %o", (bad) => {
    expect(normalizeServiceRequestDraft({ ...draft, windows: [bad] })).toEqual({ ok: false, code: "request_window_invalid" })
  })

  it("juge l'heure à l'envoi seulement : futur, horizon, échéance à la fin de la dernière fenêtre", () => {
    expect(checkServiceRequestTiming({ windows: [window(24), window(48, 3)] }, NOW)).toEqual({ ok: true, value: { expiresAt: NOW + 51 * HOUR_MS } })
    expect(checkServiceRequestTiming({ windows: [window(0)] }, NOW)).toEqual({ ok: false, code: "request_window_past" })
    expect(checkServiceRequestTiming({ windows: [{ startAt: NOW + 89 * DAY_MS, endAt: NOW + 91 * DAY_MS }] }, NOW)).toEqual({ ok: false, code: "request_window_too_far" })
  })

  it("accepte une clé d'idempotence sûre et rien d'autre", () => {
    expect(isServiceIdempotencyKey("2b4a7a0e-6a52-4c8e-9a52-7f1f0b6c2d11")).toBe(true)
    for (const key of ["court", "x".repeat(129), "clé avec espaces !!!!", ""]) expect(isServiceIdempotencyKey(key)).toBe(false)
  })

  it("donne la même empreinte au même corps normalisé, une autre à tout autre corps", () => {
    const first = normalizeServiceRequestDraft(draft)
    const spaced = normalizeServiceRequestDraft({ ...draft, need: `\n${NEED.replace(" ", "   ")}\n`, windows: [window(24), window(48)] })
    if (!first.ok || !spaced.ok) throw new Error("brouillon de fixture refusé")
    const body = { offerId: "offre-1", offerVersion: 3, ...first.value }
    const fingerprint = serviceRequestFingerprint(body)
    expect(fingerprint).toMatch(/^v1:[0-9a-f]{16}$/)
    expect(serviceRequestFingerprint({ ...body, ...spaced.value })).toBe(fingerprint)
    expect(serviceRequestFingerprint({ ...body, offerVersion: 4 })).not.toBe(fingerprint)
    expect(serviceRequestFingerprint({ ...body, need: `${NEED} Merci.` })).not.toBe(fingerprint)
    expect(serviceRequestFingerprint({ ...body, windows: [window(24)] })).not.toBe(fingerprint)
    expect(serviceRequestFingerprint({ ...body, timeZone: "America/Toronto" })).not.toBe(fingerprint)
  })
})

describe("la proposition", () => {
  it("rend des conditions complètes : montant entier, devise, créneau, lieu approximatif", () => {
    expect(parseServiceProposal(proposal(), NOW)).toEqual({
      ok: true,
      value: {
        amountMinor: 4500,
        currency: "EUR",
        durationMinutes: 90,
        startAt: NOW + 2 * DAY_MS,
        endAt: NOW + 2 * DAY_MS + 90 * MINUTE_MS,
        timeZone: "Europe/Paris",
        location: { mode: "onsite", area: "Paris 11e" },
        details: "Tresses, mèches fournies.",
        cancellationTerms: "Annulation libre jusqu'à la veille.",
        expiresAt: NOW + DAY_MS,
      },
    })
    const remote = parseServiceProposal(proposal({ location: { mode: "remote" }, currency: "XAF", amountMinor: 15000, timeZone: " Africa/Libreville " }), NOW)
    expect(remote.ok && remote.value).toMatchObject({ location: { mode: "remote" }, currency: "XAF", timeZone: "Africa/Libreville" })
  })

  it.each([
    [{ currency: "BTC" }, "proposal_currency_invalid"],
    [{ amountMinor: 10.5 }, "proposal_amount_invalid"],
    [{ amountMinor: 2_000_000_000 }, "proposal_amount_too_large"],
    [{ durationMinutes: 10 }, "proposal_duration_invalid"],
    [{ durationMinutes: 721 }, "proposal_duration_invalid"],
    [{ durationMinutes: 60.5 }, "proposal_duration_invalid"],
    [{ startAt: NOW }, "proposal_start_invalid"],
    [{ startAt: NOW + 181 * DAY_MS }, "proposal_start_invalid"],
    [{ startAt: 1.5 }, "proposal_start_invalid"],
    [{ timeZone: "Lune/Mer_de_la_Tranquillite" }, "request_time_zone_invalid"],
    [{ location: { mode: "onsite", area: " x " } }, "proposal_location_invalid"],
    [{ location: { mode: "onsite", area: "y".repeat(81) } }, "proposal_location_invalid"],
    [{ location: { mode: "onsite", area: "8 rue Oberkampf" } }, "request_address_forbidden"],
    [{ details: " " }, "proposal_details_invalid"],
    [{ details: "z".repeat(1001) }, "proposal_details_invalid"],
    [{ details: "Écrire à pro@example.com" }, "request_contact_forbidden"],
    [{ cancellationTerms: "" }, "proposal_terms_invalid"],
    [{ cancellationTerms: "t".repeat(501) }, "proposal_terms_invalid"],
    [{ cancellationTerms: "Prévenir au 07 12 34 56 78 9" }, "request_contact_forbidden"],
    [{ expiresAt: NOW }, "proposal_deadline_invalid"],
    [{ expiresAt: NOW + 15 * DAY_MS, startAt: NOW + 20 * DAY_MS }, "proposal_deadline_invalid"],
    [{ expiresAt: NOW + 3 * DAY_MS }, "proposal_deadline_invalid"],
    [{ expiresAt: 2.5 }, "proposal_deadline_invalid"],
  ] as const)("refuse %o par %s", (overrides, code) => {
    expect(parseServiceProposal(proposal(overrides as Partial<ServiceProposalInput>), NOW)).toEqual({ ok: false, code })
  })

  it("exige la version courante et borne le nombre de versions", () => {
    expect(checkProposalVersion(2, 2)).toEqual({ ok: true, value: null })
    expect(checkProposalVersion(1, 2)).toEqual({ ok: false, code: "proposal_version_changed" })
    expect(nextProposalVersion(0)).toEqual({ ok: true, value: 1 })
    expect(nextProposalVersion(SERVICE_PROPOSAL_MAX_VERSIONS)).toEqual({ ok: false, code: "proposal_versions_exhausted" })
  })

  it("lit un motif facultatif ou requis, borné et sans coordonnée", () => {
    expect(parseServiceReason(null, false)).toEqual({ ok: true, value: null })
    expect(parseServiceReason(undefined, false)).toEqual({ ok: true, value: null })
    expect(parseServiceReason("   ", true)).toEqual({ ok: false, code: "request_reason_required" })
    expect(parseServiceReason(" Empêchement  familial ", true)).toEqual({ ok: true, value: "Empêchement familial" })
    expect(parseServiceReason("r".repeat(501), false)).toEqual({ ok: false, code: "request_reason_too_long" })
    expect(parseServiceReason("appelez le 06 12 34 56 78", false)).toEqual({ ok: false, code: "request_contact_forbidden" })
  })
})

describe("échéances et créneaux", () => {
  it("fait courir l'échéance de la demande, puis celle de la proposition, puis aucune", () => {
    const base = { expiresAt: NOW + DAY_MS, proposalExpiresAt: NOW + 2 * DAY_MS }
    expect(serviceRequestDeadline({ ...base, status: "sent" })).toBe(NOW + DAY_MS)
    expect(serviceRequestDeadline({ ...base, status: "proposed" })).toBe(NOW + 2 * DAY_MS)
    expect(serviceRequestDeadline({ ...base, status: "confirmed" })).toBeNull()
  })

  it("constate l'expiration d'une demande ouverte seulement, jamais une réalisation", () => {
    expect(effectiveServiceRequestStatus({ status: "sent", deadlineAt: NOW }, NOW)).toBe("expired")
    expect(effectiveServiceRequestStatus({ status: "proposed", deadlineAt: NOW - 1 }, NOW)).toBe("expired")
    expect(effectiveServiceRequestStatus({ status: "proposed", deadlineAt: NOW + 1 }, NOW)).toBe("proposed")
    expect(effectiveServiceRequestStatus({ status: "sent", deadlineAt: null }, NOW)).toBe("sent")
    expect(effectiveServiceRequestStatus({ status: "confirmed", deadlineAt: NOW - 1 }, NOW)).toBe("confirmed")
    expect(isServiceRequestTerminal("expired")).toBe(true)
    expect(isServiceRequestTerminal("confirmed")).toBe(false)
  })

  it("compte le chevauchement avec début inclus et fin exclue", () => {
    expect(slotsOverlap(window(1), window(2))).toBe(true)
    expect(slotsOverlap(window(1), window(3))).toBe(false)
    expect(slotsOverlap(window(3), window(1))).toBe(false)
    expect(slotsOverlap(window(1, 5), window(2, 1))).toBe(true)
  })
})

describe("transitions", () => {
  const at = (action: (typeof SERVICE_REQUEST_ACTIONS)[number], actor: "requester" | "page", status: ServiceRequestStatus, bookingStartAt: number | null = null, now = NOW) =>
    checkServiceRequestTransition({ action, actor, status, now, bookingStartAt })

  it("avant l'accord : la page propose ou décline, le demandeur accepte ou retire", () => {
    expect(at("propose", "page", "sent")).toEqual({ ok: true, value: "proposed" })
    expect(at("propose", "page", "proposed")).toEqual({ ok: true, value: "proposed" })
    expect(at("refuse", "page", "proposed")).toEqual({ ok: true, value: "refused" })
    expect(at("accept", "requester", "proposed")).toEqual({ ok: true, value: "confirmed" })
    expect(at("cancel", "requester", "sent")).toEqual({ ok: true, value: "cancelled" })
    expect(at("accept", "requester", "sent")).toEqual({ ok: false, code: "request_not_open" })
    expect(at("propose", "requester", "sent")).toEqual({ ok: false, code: "request_action_forbidden" })
    expect(at("accept", "page", "proposed")).toEqual({ ok: false, code: "request_action_forbidden" })
    expect(at("cancel", "page", "sent")).toEqual({ ok: false, code: "request_action_forbidden" })
  })

  it("après l'accord : annulation avant le début, constat après le début", () => {
    const start = NOW + HOUR_MS
    expect(at("cancel", "page", "confirmed", start)).toEqual({ ok: true, value: "cancelled" })
    expect(at("cancel", "requester", "confirmed", start, start)).toEqual({ ok: false, code: "booking_started" })
    expect(at("complete", "page", "confirmed", start)).toEqual({ ok: false, code: "booking_not_started" })
    expect(at("complete", "page", "confirmed", start, start)).toEqual({ ok: true, value: "completed" })
    expect(at("no_show", "page", "confirmed", start, start + 1)).toEqual({ ok: true, value: "no_show" })
    expect(at("propose", "page", "confirmed", start)).toEqual({ ok: false, code: "request_not_open" })
    expect(at("complete", "page", "confirmed", null)).toEqual({ ok: false, code: "request_not_open" })
    expect(at("complete", "requester", "confirmed", start, start)).toEqual({ ok: false, code: "request_action_forbidden" })
  })

  it("aucun geste n'ouvre un état clos ou expiré", () => {
    expect(at("accept", "requester", "expired")).toEqual({ ok: false, code: "request_expired" })
    for (const status of ["completed", "refused", "cancelled", "no_show"] as const) {
      expect(at("cancel", "requester", status)).toEqual({ ok: false, code: "request_closed" })
    }
  })

  it("liste les gestes réellement ouverts, versions comprises", () => {
    expect(availableServiceRequestActions({ actor: "page", status: "sent", now: NOW, bookingStartAt: null, proposalVersion: 0 })).toEqual(["propose", "refuse"])
    expect(availableServiceRequestActions({ actor: "page", status: "proposed", now: NOW, bookingStartAt: null, proposalVersion: SERVICE_PROPOSAL_MAX_VERSIONS })).toEqual(["refuse"])
    expect(availableServiceRequestActions({ actor: "requester", status: "proposed", now: NOW, bookingStartAt: null, proposalVersion: 1 })).toEqual(["cancel", "accept"])
    expect(availableServiceRequestActions({ actor: "page", status: "confirmed", now: NOW, bookingStartAt: NOW + HOUR_MS, proposalVersion: 1 })).toEqual(["cancel"])
    expect(availableServiceRequestActions({ actor: "page", status: "confirmed", now: NOW + HOUR_MS, bookingStartAt: NOW + HOUR_MS, proposalVersion: 1 })).toEqual(["complete", "no_show"])
    expect(availableServiceRequestActions({ actor: "requester", status: "expired", now: NOW, bookingStartAt: null, proposalVersion: 1 })).toEqual([])
  })
})

describe("chronologie", () => {
  it("dérive les étapes des faits, versions dans l'ordre", () => {
    expect(serviceRequestTimeline({
      createdAt: 1,
      proposals: [{ version: 2, createdAt: 5 }, { version: 1, createdAt: 3 }],
      confirmedAt: 7,
      closed: { status: "completed", at: 9 },
      effectiveStatus: "completed",
      deadlineAt: null,
    })).toEqual([
      { status: "sent", at: 1, version: null },
      { status: "proposed", at: 3, version: 1 },
      { status: "proposed", at: 5, version: 2 },
      { status: "confirmed", at: 7, version: null },
      { status: "completed", at: 9, version: null },
    ])
  })

  it("montre une échéance atteinte que le passage d'expiration n'a pas encore écrite", () => {
    expect(serviceRequestTimeline({ createdAt: 1, proposals: [], confirmedAt: null, closed: null, effectiveStatus: "expired", deadlineAt: 4 })).toEqual([
      { status: "sent", at: 1, version: null },
      { status: "expired", at: 4, version: null },
    ])
    expect(serviceRequestTimeline({ createdAt: 1, proposals: [], confirmedAt: null, closed: null, effectiveStatus: "sent", deadlineAt: 4 })).toEqual([
      { status: "sent", at: 1, version: null },
    ])
  })
})

describe("contestation d'une absence (DG-015)", () => {
  const DECLARED = Date.UTC(2026, 9, 19, 18)
  const input = (overrides: Partial<Parameters<typeof checkNoShowContest>[0]> = {}) => ({
    status: "no_show" as ServiceRequestStatus,
    declaredAt: DECLARED as number | null,
    contestedAt: null as number | null,
    now: DECLARED + HOUR_MS,
    ...overrides,
  })

  it("ouverte au demandeur pendant quatorze jours après le constat, bord compris", () => {
    expect(SERVICE_NO_SHOW_CONTEST_DAYS).toBe(14)
    expect(checkNoShowContest(input())).toEqual({ ok: true, value: "contest" })
    expect(checkNoShowContest(input({ now: DECLARED + 14 * DAY_MS }))).toEqual({ ok: true, value: "contest" })
    expect(checkNoShowContest(input({ now: DECLARED + 14 * DAY_MS + 1 }))).toEqual({ ok: false, code: "request_contest_window_closed" })
    expect(canContestNoShow(input())).toBe(true)
    expect(canContestNoShow(input({ now: DECLARED + 15 * DAY_MS }))).toBe(false)
  })

  it("une seule fois : rejouée, la première contestation reste la seule", () => {
    expect(checkNoShowContest(input({ contestedAt: DECLARED + MINUTE_MS }))).toEqual({ ok: true, value: "already" })
    // Déjà posée, elle se relit même après le délai ; le geste, lui, n'est plus offert.
    expect(checkNoShowContest(input({ contestedAt: DECLARED + MINUTE_MS, now: DECLARED + 30 * DAY_MS }))).toEqual({ ok: true, value: "already" })
    expect(canContestNoShow(input({ contestedAt: DECLARED + MINUTE_MS }))).toBe(false)
  })

  it("seulement une absence constatée : aucun autre état ne se conteste", () => {
    for (const status of SERVICE_REQUEST_STATUSES.filter((value) => value !== "no_show")) {
      expect(checkNoShowContest(input({ status }))).toEqual({ ok: false, code: "request_contest_unavailable" })
    }
    expect(checkNoShowContest(input({ declaredAt: null }))).toEqual({ ok: false, code: "request_contest_unavailable" })
    expect(SERVICE_REQUEST_REFUSALS).toContain("request_contest_unavailable")
    expect(SERVICE_REQUEST_REFUSALS).toContain("request_contest_window_closed")
  })
})
