/**
 * Montants des services DIASPORALE — partagés par le catalogue (tarif d'une
 * offre) et les demandes (prix d'une proposition).
 *
 * Un montant est un ENTIER en unités mineures (centimes pour l'euro, franc
 * entier pour le franc CFA) et une devise ISO 4217 : jamais de nombre à
 * virgule flottante stocké, jamais de devise implicite. Le domaine n'encaisse
 * rien : un montant décrit ce que le professionnel annonce ou propose ; la
 * plateforme ne facture pas (mise en relation, sans paiement intégré).
 */
import { ok, refuse, type Result } from "./result"

/**
 * Devises admises, avec leurs unités mineures (ISO 4217) : celles des pays où
 * vit la diaspora gabonaise, et les deux francs CFA.
 */
export const CURRENCY_MINOR_UNITS = {
  EUR: 2,
  XAF: 0,
  XOF: 0,
  USD: 2,
  CAD: 2,
  GBP: 2,
  CHF: 2,
  MAD: 2,
  ZAR: 2,
  CNY: 2,
  AED: 2,
} as const

export type CurrencyCode = keyof typeof CURRENCY_MINOR_UNITS

export const CURRENCY_CODES = Object.freeze(Object.keys(CURRENCY_MINOR_UNITS)) as readonly CurrencyCode[]

/** Plafond d'un montant annoncé, en unités mineures (borne de saisie, pas une règle de prix). */
export const MONEY_AMOUNT_MAX_MINOR = 1_000_000_000

export const MONEY_REFUSALS = ["currency_invalid", "amount_invalid", "amount_too_large"] as const
export type MoneyRefusal = (typeof MONEY_REFUSALS)[number]

export interface Money {
  readonly amountMinor: number
  readonly currency: CurrencyCode
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCY_MINOR_UNITS, value)
}

export function minorUnitsOf(currency: CurrencyCode): number {
  return CURRENCY_MINOR_UNITS[currency]
}

/** Un montant en unités mineures : entier, positif ou nul, borné ; une devise admise. */
export function parseMoney(input: { readonly amountMinor: number; readonly currency: string }): Result<Money, MoneyRefusal> {
  const currency = input.currency.trim().toUpperCase()
  if (!isCurrencyCode(currency)) return refuse("currency_invalid")
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0) return refuse("amount_invalid")
  if (input.amountMinor > MONEY_AMOUNT_MAX_MINOR) return refuse("amount_too_large")
  return ok({ amountMinor: input.amountMinor, currency })
}

/**
 * Une saisie lisible (« 45 », « 45,50 », « 45.5 ») convertie en unités mineures
 * de la devise, sans arrondi silencieux : plus de décimales que la devise n'en
 * porte est un refus, pas une approximation.
 */
export function parseMajorAmount(text: string, currency: string): Result<Money, MoneyRefusal> {
  const code = currency.trim().toUpperCase()
  if (!isCurrencyCode(code)) return refuse("currency_invalid")
  const normalized = text.trim().replace(/[\s  ]/g, "").replace(",", ".")
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized)
  if (!match) return refuse("amount_invalid")
  const digits = minorUnitsOf(code)
  const fraction = match[2] ?? ""
  if (fraction.length > digits) return refuse("amount_invalid")
  const amountMinor = Number(`${match[1]}${fraction.padEnd(digits, "0")}`)
  return parseMoney({ amountMinor, currency: code })
}
