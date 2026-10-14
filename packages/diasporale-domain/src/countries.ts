/**
 * Pays — codes ISO 3166-1 alpha-2, pays de résidence, pays ouverts.
 *
 * Le domaine ne porte que des CODES. Les noms affichés se calculent dans
 * l'interface par `Intl.DisplayNames` (dans la langue de la personne) : aucun
 * nom de pays n'est écrit en dur, ni ici ni dans les locales.
 *
 * Le pays est le contexte permanent de DIASPORALE (cahier §5, invariant 7) :
 * le pays de résidence est obligatoire et ne peut pas être le Gabon — ce
 * réseau est celui des Gabonais de l'étranger.
 */
import { ok, refuse, type Result } from "./result"

/**
 * Les 249 codes officiellement attribués par l'ISO 3166-1 (alpha-2), triés.
 * Les codes « réservés à l'utilisateur » (XK…) n'en font pas partie : une
 * facette doit désigner un pays que tout le monde reconnaît par le même code.
 */
export const ISO_COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ",
  "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW",
  "CX", "CY", "CZ",
  "DE", "DJ", "DK", "DM", "DO", "DZ",
  "EC", "EE", "EG", "EH", "ER", "ES", "ET",
  "FI", "FJ", "FK", "FM", "FO", "FR",
  "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT",
  "GU", "GW", "GY",
  "HK", "HM", "HN", "HR", "HT", "HU",
  "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT",
  "JE", "JM", "JO", "JP",
  "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ",
  "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
  "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS",
  "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
  "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ",
  "OM",
  "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY",
  "QA",
  "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ",
  "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ",
  "UA", "UG", "UM", "US", "UY", "UZ",
  "VA", "VC", "VE", "VG", "VI", "VN", "VU",
  "WF", "WS",
  "YE", "YT",
  "ZA", "ZM", "ZW",
] as const

export type CountryCode = (typeof ISO_COUNTRY_CODES)[number]

/** Le Gabon : jamais un pays de résidence de la diaspora. */
export const HOME_COUNTRY = "GA" satisfies CountryCode

const COUNTRY_SET: ReadonlySet<string> = new Set(ISO_COUNTRY_CODES)

/** Les pays où un membre peut déclarer résider (tous sauf le Gabon). */
export const RESIDENCE_COUNTRY_CODES: readonly CountryCode[] = Object.freeze(
  ISO_COUNTRY_CODES.filter((code) => code !== HOME_COUNTRY),
)

/** `" fr "` → `"FR"` : une URL `/pays/fr` et une saisie libre désignent le même pays. */
export function normalizeCountryCode(raw: string): string {
  return raw.trim().toUpperCase()
}

export function isCountryCode(value: string): value is CountryCode {
  return COUNTRY_SET.has(value)
}

export function isResidenceCountry(value: string): value is CountryCode {
  return isCountryCode(value) && value !== HOME_COUNTRY
}

export const RESIDENCE_COUNTRY_REFUSALS = [
  "country_required",
  "country_unknown",
  "country_is_home",
] as const
export type ResidenceCountryRefusal = (typeof RESIDENCE_COUNTRY_REFUSALS)[number]

/**
 * Le pays de résidence saisi, normalisé — ou la raison du refus.
 * Sert la facette (onboarding, paramètres) et l'adresse d'un hub `/pays/[iso]`.
 */
export function parseResidenceCountry(
  raw: string | null | undefined,
): Result<CountryCode, ResidenceCountryRefusal> {
  if (raw === null || raw === undefined) return refuse("country_required")
  const code = normalizeCountryCode(raw)
  if (code.length === 0) return refuse("country_required")
  if (!isCountryCode(code)) return refuse("country_unknown")
  if (code === HOME_COUNTRY) return refuse("country_is_home")
  return ok(code)
}

/**
 * Pays ouverts au lancement — arbitrage A8, valeur par défaut retenue : la
 * France seule. La liste vivante est une donnée du réseau (`networks.openCountries`)
 * modifiée par la console ; cette constante n'est que la valeur de départ.
 */
export const DEFAULT_OPEN_COUNTRIES: readonly CountryCode[] = Object.freeze(["FR"])

/** Ordre d'ouverture envisagé ensuite (A8), selon les associations relais. */
export const NEXT_OPENING_CANDIDATES: readonly CountryCode[] = Object.freeze([
  "ES",
  "BE",
  "CA",
  "MA",
  "SN",
])

export function isCountryOpen(
  country: CountryCode,
  openCountries: readonly CountryCode[],
): boolean {
  return country !== HOME_COUNTRY && openCountries.includes(country)
}
