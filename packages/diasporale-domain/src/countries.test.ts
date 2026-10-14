import { describe, expect, test } from "bun:test"
import {
  DEFAULT_OPEN_COUNTRIES,
  HOME_COUNTRY,
  ISO_COUNTRY_CODES,
  NEXT_OPENING_CANDIDATES,
  RESIDENCE_COUNTRY_CODES,
  isCountryCode,
  isCountryOpen,
  isResidenceCountry,
  normalizeCountryCode,
  parseResidenceCountry,
} from "./countries"

describe("codes ISO 3166-1 alpha-2", () => {
  test("les 249 codes officiellement attribués, uniques, triés, au bon format", () => {
    expect(ISO_COUNTRY_CODES).toHaveLength(249)
    expect(new Set(ISO_COUNTRY_CODES).size).toBe(249)
    expect([...ISO_COUNTRY_CODES]).toEqual([...ISO_COUNTRY_CODES].sort())
    for (const code of ISO_COUNTRY_CODES) expect(code).toMatch(/^[A-Z]{2}$/)
  })

  test("aucun code réservé à l'utilisateur", () => {
    for (const reserved of ["XK", "AA", "QM", "ZZ", "EU"]) expect(isCountryCode(reserved)).toBe(false)
  })

  test("pays de résidence = tous les pays sauf le Gabon", () => {
    expect(HOME_COUNTRY).toBe("GA")
    expect(RESIDENCE_COUNTRY_CODES).toHaveLength(248)
    expect(RESIDENCE_COUNTRY_CODES).not.toContain("GA")
    expect(isResidenceCountry("FR")).toBe(true)
    expect(isResidenceCountry("GA")).toBe(false)
    expect(isResidenceCountry("XK")).toBe(false)
  })
})

describe("parseResidenceCountry", () => {
  test("normalise la casse et les espaces", () => {
    expect(normalizeCountryCode(" fr ")).toBe("FR")
    expect(parseResidenceCountry(" fr ")).toEqual({ ok: true, value: "FR" })
    expect(parseResidenceCountry("ca")).toEqual({ ok: true, value: "CA" })
  })

  test("refus fermés : absent, inconnu, Gabon", () => {
    expect(parseResidenceCountry(undefined)).toEqual({ ok: false, code: "country_required" })
    expect(parseResidenceCountry(null)).toEqual({ ok: false, code: "country_required" })
    expect(parseResidenceCountry("   ")).toEqual({ ok: false, code: "country_required" })
    expect(parseResidenceCountry("France")).toEqual({ ok: false, code: "country_unknown" })
    expect(parseResidenceCountry("XK")).toEqual({ ok: false, code: "country_unknown" })
    expect(parseResidenceCountry("ga")).toEqual({ ok: false, code: "country_is_home" })
  })
})

describe("pays ouverts (A8)", () => {
  test("la France seule au lancement", () => {
    expect([...DEFAULT_OPEN_COUNTRIES]).toEqual(["FR"])
    expect(isCountryOpen("FR", DEFAULT_OPEN_COUNTRIES)).toBe(true)
    expect(isCountryOpen("CA", DEFAULT_OPEN_COUNTRIES)).toBe(false)
  })

  test("le Gabon n'est jamais un pays ouvert de la diaspora, même par erreur de configuration", () => {
    expect(isCountryOpen("GA", ["GA", "FR"])).toBe(false)
  })

  test("les candidats suivants sont des pays de résidence", () => {
    expect([...NEXT_OPENING_CANDIDATES]).toEqual(["ES", "BE", "CA", "MA", "SN"])
    for (const code of NEXT_OPENING_CANDIDATES) expect(isResidenceCountry(code)).toBe(true)
  })
})
