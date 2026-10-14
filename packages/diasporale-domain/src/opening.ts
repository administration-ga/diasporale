/**
 * Ouverture d'un pays (cahier §7, A8) : « un pays s'ouvre avec deux
 * associations relais et un modérateur ». Tant qu'il n'est pas ouvert, ses
 * membres entrent et lisent ; le contenu communautaire qu'ils y publient passe
 * par la relecture de l'équipe RÉSEAU (invariant 10 : jamais de contenu
 * communautaire sans modération dans un pays).
 */

export const COUNTRY_OPENING_REQUIREMENTS = Object.freeze({
  relayAssociations: 2,
  activeModerators: 1,
})

export interface CountryOpeningFacts {
  /** Associations vérifiées qui se sont engagées à relayer le lancement. */
  readonly relayAssociations: number
  /** Modérateurs pays actifs de l'équipe du pays. */
  readonly activeModerators: number
}

export const COUNTRY_OPENING_GAPS = ["relay_associations_missing", "moderator_missing"] as const
export type CountryOpeningGap = (typeof COUNTRY_OPENING_GAPS)[number]

/** Ce qui manque pour ouvrir — vide quand le pays peut s'ouvrir. */
export function countryOpeningGaps(facts: CountryOpeningFacts): CountryOpeningGap[] {
  const gaps: CountryOpeningGap[] = []
  if (facts.relayAssociations < COUNTRY_OPENING_REQUIREMENTS.relayAssociations) gaps.push("relay_associations_missing")
  if (facts.activeModerators < COUNTRY_OPENING_REQUIREMENTS.activeModerators) gaps.push("moderator_missing")
  return gaps
}

export function canOpenCountry(facts: CountryOpeningFacts): boolean {
  return countryOpeningGaps(facts).length === 0
}
