/**
 * Formats du catalogue des services, dans la langue de l'écran : tarif annoncé
 * (`Intl.NumberFormat`, devise et unités mineures ISO 4217), durée indicative,
 * noms de langues (`Intl.DisplayNames`). Aucune chaîne en dur : les phrases
 * viennent de la locale (`services.*`), les noms des API du navigateur.
 */
import { isCurrencyCode, minorUnitsOf, type ServicePricingLike } from "@diasporale/domain"

type Translate = (key: string, options?: Record<string, unknown>) => string

/** Un montant en unités mineures, affiché avec sa devise (« 60,00 € », « 15 000 FCFA »). */
export function formatMoney(amountMinor: number, currency: string, locale: string): string {
  const digits = isCurrencyCode(currency) ? minorUnitsOf(currency) : 2
  return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amountMinor / 10 ** digits)
}

/** Le tarif ANNONCÉ : prix fixe, gratuit, « à partir de », ou sur devis. */
export function formatServicePrice(pricing: ServicePricingLike, locale: string, t: Translate): string {
  if (pricing.mode === "quote") return t("services.price.quote")
  if (pricing.mode === "fixed" && pricing.amountMinor === 0) return t("services.price.free")
  return t(`services.price.${pricing.mode}`, { price: formatMoney(pricing.amountMinor, pricing.currency, locale) })
}

/** La durée indicative : « 45 min », « 2 h », « 1 h 30 ». */
export function formatServiceDuration(minutes: number, t: Translate): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return t("services.duration.minutes", { minutes: rest })
  if (rest === 0) return t("services.duration.hours", { hours })
  return t("services.duration.hoursMinutes", { hours, minutes: String(rest).padStart(2, "0") })
}

const languageNames = new Map<string, Intl.DisplayNames>()

/** Le nom d'une langue dans la langue de l'écran ; le code s'il est inconnu du navigateur. */
export function languageName(code: string, locale: string): string {
  let names = languageNames.get(locale)
  if (!names) {
    names = new Intl.DisplayNames([locale], { type: "language", fallback: "code" })
    languageNames.set(locale, names)
  }
  const name = names.of(code) ?? code
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1)
}

/** Les langues d'une prestation, en liste lisible (« français et anglais »). */
export function languageList(codes: readonly string[], locale: string): string {
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(codes.map((code) => languageName(code, locale)))
}

/** Un montant en unités mineures, prêt à être ressaisi (« 60 », « 45.50 ») : `parseMajorAmount` le relit. */
export function majorAmountInput(amountMinor: number, currency: string): string {
  const digits = isCurrencyCode(currency) ? minorUnitsOf(currency) : 2
  const factor = 10 ** digits
  return amountMinor % factor === 0 ? String(amountMinor / factor) : (amountMinor / factor).toFixed(digits)
}
