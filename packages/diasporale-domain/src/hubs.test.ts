import { describe, expect, test } from "bun:test"
import { countsAsHubMember, MEMBER_COUNTER_DISPLAY_THRESHOLD, presentHubCounters, presentMemberCounter } from "./hubs"
import { DIASPORALE_NETWORK, ROOT_NETWORK_SLUG } from "./network"
import { DiasporaleViolation, ok, refuse, unwrap } from "./result"
import { DAY_MS, HOUR_MS, MINUTE_MS, utcYear } from "./time"

describe("qui compte parmi les membres d'un hub", () => {
  const listed = { status: "declaree", directoryVisibility: "country", directoryConsent: true } as const

  test("un membre actif qui a choisi un niveau et consenti à l'annuaire", () => {
    expect(countsAsHubMember(listed)).toBe(true)
    expect(countsAsHubMember({ ...listed, status: "verifiee", directoryVisibility: "network" })).toBe(true)
  })

  test("ni le niveau « personne », ni un consentement retiré, ni un statut sans annuaire", () => {
    expect(countsAsHubMember({ ...listed, directoryVisibility: "hidden" })).toBe(false)
    expect(countsAsHubMember({ ...listed, directoryConsent: false })).toBe(false)
    for (const status of ["en_attente", "suspendue", "partie"] as const) {
      expect(countsAsHubMember({ ...listed, status })).toBe(false)
    }
  })
})

describe("compteurs d'un hub", () => {
  test("membres sous le seuil : jamais le chiffre exact", () => {
    expect(presentMemberCounter(MEMBER_COUNTER_DISPLAY_THRESHOLD - 1)).toEqual({
      kind: "below_threshold",
      threshold: MEMBER_COUNTER_DISPLAY_THRESHOLD,
    })
    expect(presentMemberCounter(MEMBER_COUNTER_DISPLAY_THRESHOLD)).toEqual({ kind: "value", value: 20 })
    expect(presentMemberCounter(3, 2)).toEqual({ kind: "value", value: 3 })
  })

  test("hub sans aucun contenu : « bientôt », pas une rangée de zéros", () => {
    expect(presentHubCounters({ members: 0, associations: 0, companies: 0, upcomingEvents: 0 }).dormant).toBe(true)
    expect(presentHubCounters({ members: 0, associations: 1, companies: 0, upcomingEvents: 0 }).dormant).toBe(false)
  })

  test("valeurs aberrantes ramenées à zéro, décimales tronquées", () => {
    const presented = presentHubCounters({ members: 42.7, associations: -3, companies: Number.NaN, upcomingEvents: 5 })
    expect(presented).toEqual({
      dormant: false,
      members: { kind: "value", value: 42 },
      associations: { kind: "value", value: 0 },
      companies: { kind: "value", value: 0 },
      upcomingEvents: { kind: "value", value: 5 },
    })
  })

  test("le seuil se règle (réglage du réseau)", () => {
    expect(presentHubCounters({ members: 6, associations: 1, companies: 0, upcomingEvents: 0 }, 5).members).toEqual({
      kind: "value",
      value: 6,
    })
  })
})

describe("le réseau diasporale (cahier §7)", () => {
  test("fermé, enfant d'antia, déclaré ou vérifié, network par défaut, France ouverte", () => {
    expect(DIASPORALE_NETWORK).toEqual({
      slug: "diasporale",
      kind: "closed",
      parentSlug: ROOT_NETWORK_SLUG,
      membershipPolicy: "declared_or_verified",
      defaultVisibility: "network",
      reachValues: ["local", "diaspora"],
      openCountries: ["FR"],
    })
    expect(ROOT_NETWORK_SLUG).toBe("antia")
  })
})

describe("résultats et temps", () => {
  test("unwrap rend la valeur ou lève une violation portant le code", () => {
    expect(unwrap(ok(3))).toBe(3)
    expect(() => unwrap(refuse("country_required"))).toThrow(DiasporaleViolation)
    try {
      unwrap(refuse("country_required"))
    } catch (error) {
      expect(error).toBeInstanceOf(DiasporaleViolation)
      expect((error as DiasporaleViolation).code).toBe("country_required")
      expect((error as DiasporaleViolation).name).toBe("DiasporaleViolation")
    }
  })

  test("unités et année UTC", () => {
    expect(DAY_MS).toBe(24 * HOUR_MS)
    expect(HOUR_MS).toBe(60 * MINUTE_MS)
    expect(utcYear(Date.UTC(2026, 11, 31, 23, 59))).toBe(2026)
    expect(utcYear(Date.UTC(2027, 0, 1, 0, 0))).toBe(2027)
  })
})
