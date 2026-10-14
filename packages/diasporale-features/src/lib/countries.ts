import { RESIDENCE_COUNTRY_CODES, type CountryCode } from "@diasporale/domain"

/**
 * Noms de pays dans la langue de la personne, calculés par le moteur ICU du
 * navigateur (`Intl.DisplayNames`) : aucun nom de pays n'est écrit en dur, ni
 * dans le code ni dans les locales.
 */
const displayNamesCache = new Map<string, Intl.DisplayNames>()

function displayNames(locale: string): Intl.DisplayNames {
  let names = displayNamesCache.get(locale)
  if (names === undefined) {
    names = new Intl.DisplayNames([locale], { type: "region", fallback: "code" })
    displayNamesCache.set(locale, names)
  }
  return names
}

export function countryName(code: CountryCode, locale: string): string {
  return displayNames(locale).of(code) ?? code
}

/** Forme de comparaison : minuscules, sans accents — « Côte d'Ivoire » se trouve en tapant « cote ». */
export function searchKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
}

export interface CountryOption {
  readonly code: CountryCode
  readonly name: string
}

/** Les pays de résidence, triés par nom dans la langue de la personne. */
export function residenceCountryOptions(locale: string): CountryOption[] {
  const collator = new Intl.Collator(locale, { sensitivity: "base" })
  return RESIDENCE_COUNTRY_CODES.map((code) => ({ code, name: countryName(code, locale) })).sort((a, b) =>
    collator.compare(a.name, b.name),
  )
}

/** Filtre par nom ou par code ISO (« fr », « france », « fra » trouvent la France). */
export function filterCountryOptions(options: readonly CountryOption[], query: string): CountryOption[] {
  const key = searchKey(query)
  if (key.length === 0) return [...options]
  return options.filter((option) => searchKey(option.name).includes(key) || option.code.toLowerCase() === key)
}
