import { describe, expect, test } from "bun:test"

import {
  canReadPilotMetrics,
  emptyPilotCounts,
  emptyPilotDay,
  normalizePilotHistogram,
  parsePilotScope,
  parsePilotWindowDays,
  PILOT_ACCEPTED_MEMBERSHIP_STATUSES,
  PILOT_DAILY_COUNTERS,
  PILOT_DEFAULT_WINDOW_DAYS,
  PILOT_DISPLAY_THRESHOLD,
  PILOT_FIRST_RESPONSE_BUCKET_HOURS,
  PILOT_FIRST_RESPONSE_BUCKETS,
  PILOT_METRIC_GROUPS,
  PILOT_METRIC_IDS,
  PILOT_METRICS,
  PILOT_METRICS_REFUSALS,
  PILOT_PASS_RANGE_DAYS,
  PILOT_WINDOW_DAYS,
  pilotFirstResponseBucket,
  pilotMembershipCounters,
  pilotPassRange,
  pilotRegistrationCounters,
  pilotRequestTally,
  pilotReviewCounters,
  pilotUtcDayStart,
  pilotWindow,
  presentPilotCount,
  presentPilotFirstResponse,
  presentPilotIndicators,
  presentPilotRatio,
  sumPilotDays,
  tallyPilotDay,
  type PilotDailyCounter,
  type PilotDayTotals,
  type PilotRequestFacts,
} from "./pilot-metrics"
import { DAY_MS, HOUR_MS } from "./time"

const NOW = Date.UTC(2026, 9, 18, 10)
const TODAY = Date.UTC(2026, 9, 18)

/** Un histogramme dont seules les classes citées portent des réponses. */
function histogram(entries: Record<number, number>): number[] {
  return Array.from({ length: PILOT_FIRST_RESPONSE_BUCKETS }, (_, index) => entries[index] ?? 0)
}

describe("accès et refus fermés", () => {
  test("seuls les administrateurs et modérateurs du réseau lisent la mesure", () => {
    expect(canReadPilotMetrics("network_admin")).toBe(true)
    expect(canReadPilotMetrics("network_moderator")).toBe(true)
    for (const role of ["member", "platform_admin", "", "NETWORK_ADMIN"]) expect(canReadPilotMetrics(role)).toBe(false)
  })

  test("les refus sont des codes fermés, propres au chantier", () => {
    expect(PILOT_METRICS_REFUSALS).toEqual(["pilot_metrics_window_invalid", "pilot_metrics_country_invalid"])
  })
})

describe("périodes, portée et jours UTC", () => {
  test("seules 7, 30 et 90 journées sont proposées ; 30 par défaut", () => {
    expect(PILOT_WINDOW_DAYS).toEqual([7, 30, 90])
    expect(PILOT_DEFAULT_WINDOW_DAYS).toBe(30)
    for (const days of PILOT_WINDOW_DAYS) expect(parsePilotWindowDays(days)).toEqual({ ok: true, value: days })
    for (const value of [0, 1, 14, 31, 90.5, -7, Number.NaN, "30", null, undefined]) {
      expect(parsePilotWindowDays(value)).toEqual({ ok: false, code: "pilot_metrics_window_invalid" })
    }
  })

  test("la portée : tout le réseau, ou un pays de résidence normalisé — jamais le Gabon", () => {
    expect(parsePilotScope(null)).toEqual({ ok: true, value: null })
    expect(parsePilotScope(undefined)).toEqual({ ok: true, value: null })
    expect(parsePilotScope(" fr ")).toEqual({ ok: true, value: "FR" })
    for (const raw of ["GA", "ga", "XX", "", "France"]) expect(parsePilotScope(raw)).toEqual({ ok: false, code: "pilot_metrics_country_invalid" })
  })

  test("le passage recalcule les 90 jours UTC complets qui précèdent son jour", () => {
    expect(pilotUtcDayStart(NOW)).toBe(TODAY)
    expect(pilotUtcDayStart(TODAY)).toBe(TODAY)
    expect(pilotUtcDayStart(TODAY - 1)).toBe(TODAY - DAY_MS)
    expect(PILOT_PASS_RANGE_DAYS).toBe(90)
    expect(pilotPassRange(NOW)).toEqual({ startAt: TODAY - 90 * DAY_MS, endAt: TODAY })
  })

  test("une période finit avec le dernier jour mesuré, inclus", () => {
    const lastDay = TODAY - DAY_MS
    expect(pilotWindow(lastDay, 7)).toEqual({ startAt: TODAY - 7 * DAY_MS, endAt: TODAY })
    // Un instant du jour vaut son jour.
    expect(pilotWindow(lastDay + 5 * HOUR_MS, 30)).toEqual({ startAt: TODAY - 30 * DAY_MS, endAt: TODAY })
    expect(pilotWindow(lastDay, 90).startAt).toBe(pilotPassRange(NOW).startAt)
  })
})

describe("compteurs quotidiens", () => {
  test("un jour vide : onze compteurs à zéro et une classe par borne, plus le dépassement", () => {
    const day = emptyPilotDay()
    expect(Object.keys(day.counts).sort()).toEqual([...PILOT_DAILY_COUNTERS].sort())
    expect(Object.values(emptyPilotCounts()).every((value) => value === 0)).toBe(true)
    expect(day.firstResponse).toHaveLength(PILOT_FIRST_RESPONSE_BUCKET_HOURS.length + 1)
    expect(day.firstResponse.every((count) => count === 0)).toBe(true)
  })

  test("un histogramme lu est ramené à sa longueur exacte, sans valeur aberrante", () => {
    const normalized = normalizePilotHistogram([2, -1, 1.7, Number.NaN, Number.POSITIVE_INFINITY])
    expect(normalized).toHaveLength(PILOT_FIRST_RESPONSE_BUCKETS)
    expect(normalized.slice(0, 5)).toEqual([2, 0, 1, 0, 0])
    expect(normalizePilotHistogram(new Array<number>(40).fill(1))).toHaveLength(PILOT_FIRST_RESPONSE_BUCKETS)
  })

  test("une ligne source ajoute un par compteur cité, et sa classe de délai si elle en a une", () => {
    const once = tallyPilotDay(emptyPilotDay(), ["requestsSent", "requestsAnswered"], 3)
    expect(once.counts.requestsSent).toBe(1)
    expect(once.counts.requestsAnswered).toBe(1)
    expect(once.counts.requestsConfirmed).toBe(0)
    expect(once.firstResponse[3]).toBe(1)
    const twice = tallyPilotDay(once, ["requestsSent"])
    expect(twice.counts.requestsSent).toBe(2)
    expect(twice.firstResponse[3]).toBe(1)
    // La copie est neuve : l'agrégat d'origine ne bouge pas.
    expect(once.counts.requestsSent).toBe(1)
  })

  test("une classe de délai hors bornes ou fractionnaire est ignorée", () => {
    for (const bucket of [-1, PILOT_FIRST_RESPONSE_BUCKETS, 2.5]) {
      expect(tallyPilotDay(emptyPilotDay(), ["requestsSent"], bucket).firstResponse.every((count) => count === 0)).toBe(true)
    }
  })

  test("la somme de plusieurs jours additionne compteurs et classes", () => {
    const first = tallyPilotDay(emptyPilotDay(), ["requestsSent", "requestsAnswered"], 0)
    const second = tallyPilotDay(tallyPilotDay(emptyPilotDay(), ["requestsSent"]), ["eventRegistrations", "eventAttendances"], 0)
    const total = sumPilotDays([first, second, { counts: { ...emptyPilotCounts(), reviewsPublished: -4 }, firstResponse: [] }])
    expect(total.counts.requestsSent).toBe(2)
    expect(total.counts.requestsAnswered).toBe(1)
    expect(total.counts.eventAttendances).toBe(1)
    expect(total.counts.reviewsPublished).toBe(0)
    expect(total.firstResponse[0]).toBe(2)
    expect(sumPilotDays([])).toEqual(emptyPilotDay())
  })
})

describe("classes du délai de première réponse", () => {
  test("borne haute incluse, puis la classe du dépassement", () => {
    expect(pilotFirstResponseBucket(0)).toBe(0)
    expect(pilotFirstResponseBucket(HOUR_MS)).toBe(0)
    expect(pilotFirstResponseBucket(HOUR_MS + 1)).toBe(1)
    expect(pilotFirstResponseBucket(5 * HOUR_MS)).toBe(4)
    expect(pilotFirstResponseBucket(720 * HOUR_MS)).toBe(PILOT_FIRST_RESPONSE_BUCKET_HOURS.length - 1)
    expect(pilotFirstResponseBucket(721 * HOUR_MS)).toBe(PILOT_FIRST_RESPONSE_BUCKET_HOURS.length)
  })

  test("un délai négatif ou illisible n'a pas de classe", () => {
    for (const delay of [-1, Number.NaN, Number.POSITIVE_INFINITY]) expect(pilotFirstResponseBucket(delay)).toBeNull()
  })
})

describe("ce que compte une demande de la cohorte", () => {
  const sent: PilotRequestFacts = {
    status: "sent",
    deadlineAt: NOW + DAY_MS,
    createdAt: NOW - 10 * HOUR_MS,
    proposalVersion: 0,
    firstProposalAt: null,
    closedAt: null,
    hasBooking: false,
  }

  test("une demande ouverte compte seulement comme envoyée", () => {
    expect(pilotRequestTally(sent, NOW)).toEqual({ counters: ["requestsSent"], firstResponseBucket: null })
  })

  test("une proposition répond ; son délai court de l'envoi à la version 1", () => {
    const proposed = { ...sent, status: "proposed" as const, proposalVersion: 2, firstProposalAt: sent.createdAt + 3 * HOUR_MS }
    expect(pilotRequestTally(proposed, NOW)).toEqual({ counters: ["requestsSent", "requestsAnswered"], firstResponseBucket: 2 })
    // Une version 1 introuvable : répondue, sans délai classé.
    expect(pilotRequestTally({ ...proposed, firstProposalAt: null }, NOW).firstResponseBucket).toBeNull()
  })

  test("un refus sans proposition répond aussi ; son délai court jusqu'au refus", () => {
    const refused = { ...sent, status: "refused" as const, deadlineAt: null, closedAt: sent.createdAt + 30 * HOUR_MS }
    expect(pilotRequestTally(refused, NOW)).toEqual({ counters: ["requestsSent", "requestsAnswered"], firstResponseBucket: 9 })
    expect(pilotRequestTally({ ...refused, closedAt: null }, NOW).firstResponseBucket).toBeNull()
  })

  test("confirmée, puis réalisée ou annulée : un rendez-vous convenu le reste", () => {
    const booked = { ...sent, proposalVersion: 1, firstProposalAt: sent.createdAt, hasBooking: true, deadlineAt: null }
    expect(pilotRequestTally({ ...booked, status: "completed" }, NOW).counters).toEqual(["requestsSent", "requestsAnswered", "requestsConfirmed", "requestsCompleted"])
    expect(pilotRequestTally({ ...booked, status: "cancelled" }, NOW).counters).toEqual(["requestsSent", "requestsAnswered", "requestsConfirmed", "requestsCancelled"])
    expect(pilotRequestTally({ ...booked, status: "no_show" }, NOW).counters).toEqual(["requestsSent", "requestsAnswered", "requestsConfirmed"])
  })

  test("l'expiration écrite et l'échéance atteinte comptent toutes deux", () => {
    expect(pilotRequestTally({ ...sent, status: "expired", deadlineAt: null }, NOW).counters).toEqual(["requestsSent", "requestsExpired"])
    expect(pilotRequestTally({ ...sent, deadlineAt: NOW - 1 }, NOW).counters).toEqual(["requestsSent", "requestsExpired"])
    // Une demande annulée par la personne avant toute réponse.
    expect(pilotRequestTally({ ...sent, status: "cancelled", deadlineAt: null }, NOW).counters).toEqual(["requestsSent", "requestsCancelled"])
  })
})

describe("adhésions, inscriptions et avis", () => {
  test("une adhésion acceptée le reste, même quittée ou exclue ensuite", () => {
    expect(PILOT_ACCEPTED_MEMBERSHIP_STATUSES).toEqual(["accepted", "left", "removed"])
    for (const status of PILOT_ACCEPTED_MEMBERSHIP_STATUSES) expect(pilotMembershipCounters(status)).toEqual(["membershipsRequested", "membershipsAccepted"])
    for (const status of ["requested", "rejected", "cancelled"] as const) expect(pilotMembershipCounters(status)).toEqual(["membershipsRequested"])
  })

  test("une place confirmée, et sa présence si elle est pointée", () => {
    expect(pilotRegistrationCounters(false)).toEqual(["eventRegistrations"])
    expect(pilotRegistrationCounters(true)).toEqual(["eventRegistrations", "eventAttendances"])
  })

  test("un avis compte seulement s'il est actif et publié", () => {
    expect(pilotReviewCounters({ active: true, published: true })).toEqual(["reviewsPublished"])
    expect(pilotReviewCounters({ active: true, published: false })).toEqual([])
    expect(pilotReviewCounters({ active: false, published: true })).toEqual([])
  })
})

describe("présentations anti-réidentification", () => {
  test("un compte sous le seuil se dit « moins de 5 », jamais le chiffre", () => {
    expect(PILOT_DISPLAY_THRESHOLD).toBe(5)
    for (const value of [0, 1, 4, 4.9]) expect(presentPilotCount(value)).toEqual({ kind: "below_threshold", threshold: 5 })
    expect(presentPilotCount(5)).toEqual({ kind: "value", value: 5 })
    expect(presentPilotCount(42.8)).toEqual({ kind: "value", value: 42 })
    expect(presentPilotCount(-3)).toEqual({ kind: "below_threshold", threshold: 5 })
    expect(presentPilotCount(3, 2)).toEqual({ kind: "value", value: 3 })
  })

  test("un seuil aberrant redevient 1 : rien n'est publié à partir d'une base vide", () => {
    expect(presentPilotCount(0, 0)).toEqual({ kind: "below_threshold", threshold: 1 })
    expect(presentPilotCount(0, Number.NaN)).toEqual({ kind: "below_threshold", threshold: 1 })
    expect(presentPilotRatio(0, 0, 0)).toEqual({ value: { kind: "below_threshold", threshold: 1 }, denominator: { kind: "below_threshold", threshold: 1 }, rate: { kind: "withheld" } })
  })

  test("un taux garde sa base ; il n'est publié qu'avec une part et un écart au-dessus du seuil", () => {
    expect(presentPilotRatio(7, 12)).toEqual({ value: { kind: "value", value: 7 }, denominator: { kind: "value", value: 12 }, rate: { kind: "value", percent: 58 } })
    expect(presentPilotRatio(5, 12)).toEqual({ value: { kind: "value", value: 5 }, denominator: { kind: "value", value: 12 }, rate: { kind: "value", percent: 42 } })
  })

  test("une part sous le seuil : « moins de 5 », sans taux ; la base reste visible", () => {
    expect(presentPilotRatio(3, 12)).toEqual({ value: { kind: "below_threshold", threshold: 5 }, denominator: { kind: "value", value: 12 }, rate: { kind: "withheld" } })
    expect(presentPilotRatio(2, 3)).toEqual({ value: { kind: "below_threshold", threshold: 5 }, denominator: { kind: "below_threshold", threshold: 5 }, rate: { kind: "withheld" } })
  })

  test("une part trop proche de sa base est masquée : l'écart ne se déduit pas", () => {
    expect(presentPilotRatio(10, 12)).toEqual({ value: { kind: "complement_below_threshold", threshold: 5 }, denominator: { kind: "value", value: 12 }, rate: { kind: "withheld" } })
    expect(presentPilotRatio(12, 12).value).toEqual({ kind: "complement_below_threshold", threshold: 5 })
    // Une part supérieure à sa base est ramenée à la base.
    expect(presentPilotRatio(15, 12).value).toEqual({ kind: "complement_below_threshold", threshold: 5 })
  })
})

describe("délais de première réponse", () => {
  test("médiane et 75e centile au rang le plus proche, par classe", () => {
    // Sept réponses : ≤ 1 h, ≤ 2 h, ≤ 3 h, ≤ 6 h, ≤ 12 h, ≤ 24 h, ≤ 36 h.
    const sample = histogram({ 0: 1, 1: 1, 2: 1, 4: 1, 6: 1, 8: 1, 9: 1 })
    expect(presentPilotFirstResponse(sample)).toEqual({
      sample: { kind: "value", value: 7 },
      median: { kind: "at_most", hours: 6 },
      p75: { kind: "at_most", hours: 24 },
    })
  })

  test("au-delà de 720 heures, la classe du dépassement", () => {
    const late = histogram({ 0: 2, [PILOT_FIRST_RESPONSE_BUCKET_HOURS.length]: 4 })
    expect(presentPilotFirstResponse(late)).toEqual({
      sample: { kind: "value", value: 6 },
      median: { kind: "above", hours: 720 },
      p75: { kind: "above", hours: 720 },
    })
  })

  test("moins de 5 réponses : aucun délai publié", () => {
    expect(presentPilotFirstResponse(histogram({ 3: 4 }))).toEqual({
      sample: { kind: "below_threshold", threshold: 5 },
      median: { kind: "withheld" },
      p75: { kind: "withheld" },
    })
    expect(presentPilotFirstResponse([]).median).toEqual({ kind: "withheld" })
  })
})

describe("les indicateurs du pilote", () => {
  test("une liste fermée, dans l'ordre, chaque taux rapporté à une base de la liste", () => {
    expect(PILOT_METRICS.map((metric) => metric.id)).toEqual([...PILOT_METRIC_IDS])
    expect(new Set(PILOT_METRICS.map((metric) => metric.group))).toEqual(new Set(PILOT_METRIC_GROUPS))
    for (const metric of PILOT_METRICS) {
      if (metric.kind !== "ratio") continue
      const base = PILOT_METRICS.find((candidate) => candidate.id === metric.denominatorId)
      expect(base?.kind === "count" || base?.kind === "ratio").toBe(true)
      expect(base !== undefined && "counter" in base ? base.counter : null).toBe(metric.denominator)
    }
  })

  test("une période réelle : comptes, parts, bases, taux et délais présentés", () => {
    let day: PilotDayTotals = emptyPilotDay()
    const sent = 12
    for (let index = 0; index < sent; index += 1) {
      const counters: PilotDailyCounter[] = ["requestsSent"]
      if (index < 7) counters.push("requestsAnswered")
      if (index < 5) counters.push("requestsConfirmed")
      if (index < 3) counters.push("requestsCompleted")
      day = tallyPilotDay(day, counters, index < 7 ? index : null)
    }
    const indicators = presentPilotIndicators({ days: [day, emptyPilotDay()], offersActive: 6 })
    expect(indicators.map((indicator) => indicator.id)).toEqual([...PILOT_METRIC_IDS])
    const byId = new Map(indicators.map((indicator) => [indicator.id, indicator]))
    expect(byId.get("offers_active")).toEqual({ id: "offers_active", group: "services", kind: "snapshot", value: { kind: "value", value: 6 } })
    expect(byId.get("requests_sent")).toEqual({ id: "requests_sent", group: "services", kind: "count", value: { kind: "value", value: 12 } })
    expect(byId.get("requests_answered")).toEqual({
      id: "requests_answered", group: "services", kind: "ratio", denominatorId: "requests_sent",
      value: { kind: "value", value: 7 }, denominator: { kind: "value", value: 12 }, rate: { kind: "value", percent: 58 },
    })
    expect(byId.get("requests_completed")).toMatchObject({ kind: "ratio", denominatorId: "requests_confirmed", value: { kind: "below_threshold" }, denominator: { kind: "value", value: 5 }, rate: { kind: "withheld" } })
    expect(byId.get("first_response_hours")).toEqual({
      id: "first_response_hours", group: "services", kind: "duration",
      sample: { kind: "value", value: 7 }, median: { kind: "at_most", hours: 4 }, p75: { kind: "at_most", hours: 8 },
    })
    expect(byId.get("memberships_requested")).toMatchObject({ kind: "count", value: { kind: "below_threshold", threshold: 5 } })
  })

  test("un seuil explicite remplace celui par défaut", () => {
    const day = tallyPilotDay(emptyPilotDay(), ["reviewsPublished", "reviewsPublished"])
    const reviews = presentPilotIndicators({ days: [day], offersActive: 0, threshold: 2 }).find((indicator) => indicator.id === "reviews_published")
    expect(reviews).toEqual({ id: "reviews_published", group: "reviews", kind: "count", value: { kind: "value", value: 2 } })
  })

  test("aucun compte brut sous le seuil ne quitte la présentation", () => {
    const tiny = tallyPilotDay(emptyPilotDay(), ["requestsSent", "requestsAnswered", "membershipsRequested"], 1)
    const json = JSON.stringify(presentPilotIndicators({ days: [tiny], offersActive: 2 }))
    expect(json).not.toContain('"value":1')
    expect(json).not.toContain('"value":2')
  })
})
