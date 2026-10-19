import { describe, expect, it } from "bun:test"

import { CURRENCY_CODES, isCurrencyCode, minorUnitsOf, MONEY_AMOUNT_MAX_MINOR, parseMajorAmount, parseMoney } from "./money"

describe("montants des services", () => {
  it("connaissent les unités mineures des devises admises", () => {
    expect(CURRENCY_CODES).toContain("EUR")
    expect(CURRENCY_CODES).toContain("XAF")
    expect(minorUnitsOf("EUR")).toBe(2)
    expect(minorUnitsOf("XAF")).toBe(0)
    expect(isCurrencyCode("EUR")).toBe(true)
    expect(isCurrencyCode("eur")).toBe(false)
    expect(isCurrencyCode("toString")).toBe(false)
  })

  it("acceptent un entier positif borné dans une devise admise", () => {
    expect(parseMoney({ amountMinor: 4500, currency: "eur" })).toEqual({ ok: true, value: { amountMinor: 4500, currency: "EUR" } })
    expect(parseMoney({ amountMinor: 0, currency: "XAF" })).toEqual({ ok: true, value: { amountMinor: 0, currency: "XAF" } })
  })

  it("refusent une devise inconnue, un montant fractionnaire, négatif ou démesuré", () => {
    expect(parseMoney({ amountMinor: 100, currency: "BTC" })).toEqual({ ok: false, code: "currency_invalid" })
    expect(parseMoney({ amountMinor: 10.5, currency: "EUR" })).toEqual({ ok: false, code: "amount_invalid" })
    expect(parseMoney({ amountMinor: -1, currency: "EUR" })).toEqual({ ok: false, code: "amount_invalid" })
    expect(parseMoney({ amountMinor: Number.NaN, currency: "EUR" })).toEqual({ ok: false, code: "amount_invalid" })
    expect(parseMoney({ amountMinor: MONEY_AMOUNT_MAX_MINOR + 1, currency: "EUR" })).toEqual({ ok: false, code: "amount_too_large" })
  })

  it("convertissent une saisie lisible sans arrondi silencieux", () => {
    expect(parseMajorAmount("45", "EUR")).toEqual({ ok: true, value: { amountMinor: 4500, currency: "EUR" } })
    expect(parseMajorAmount(" 45,5 ", "EUR")).toEqual({ ok: true, value: { amountMinor: 4550, currency: "EUR" } })
    expect(parseMajorAmount("1 250.75", "eur")).toEqual({ ok: true, value: { amountMinor: 125075, currency: "EUR" } })
    expect(parseMajorAmount("15000", "XAF")).toEqual({ ok: true, value: { amountMinor: 15000, currency: "XAF" } })
    expect(parseMajorAmount("15000,5", "XAF")).toEqual({ ok: false, code: "amount_invalid" })
    expect(parseMajorAmount("45,555", "EUR")).toEqual({ ok: false, code: "amount_invalid" })
    expect(parseMajorAmount("-3", "EUR")).toEqual({ ok: false, code: "amount_invalid" })
    expect(parseMajorAmount("abc", "EUR")).toEqual({ ok: false, code: "amount_invalid" })
    expect(parseMajorAmount("45", "BTC")).toEqual({ ok: false, code: "currency_invalid" })
    expect(parseMajorAmount("99999999999", "EUR")).toEqual({ ok: false, code: "amount_too_large" })
  })
})
