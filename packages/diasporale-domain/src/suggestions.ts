/**
 * Suggestions de relations (EXF-DG-18) — le classement, pur.
 *
 * Le vivier est l'annuaire opt-in : seule y entre une personne qui a choisi
 * d'être trouvée par ce lecteur (`isListedInDirectoryFor`). Le classement ne
 * s'appuie JAMAIS sur ce que le lecteur ne voit pas : la facette du candidat
 * est celle PROJETÉE pour lui (`projectFacet`). Une ville gardée pour ses
 * relations ne fait donc pas une « même ville » pour un inconnu.
 */
import type { DiasporaFacet, FacetProjection } from "./facet"

/** Suggestions rendues à la fois : peu, et pertinentes. */
export const SUGGESTIONS_MAX = 6

export interface SuggestionReasons {
  readonly sameCountry: boolean
  readonly sameCity: boolean
  readonly sharedAssociations: number
  readonly mutualConnections: number
}

/** Une ville comparée sans casse, sans accents ni espaces superflus. */
function cityKey(city: string): string {
  return city.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().replace(/\s+/g, " ").toLowerCase()
}

/** Ce qui rapproche le lecteur d'un candidat, lu sur ce que le lecteur a le droit d'en voir. */
export function suggestionReasons(reader: DiasporaFacet, candidate: FacetProjection, mutualConnections: number): SuggestionReasons {
  const sameCountry = candidate.countryOfResidence !== undefined && candidate.countryOfResidence === reader.countryOfResidence
  const sameCity = sameCountry && reader.city !== undefined && candidate.city !== undefined && cityKey(reader.city) === cityKey(candidate.city)
  const mine = new Set(reader.associationIds)
  const sharedAssociations = (candidate.associationIds ?? []).filter((id) => mine.has(id)).length
  return { sameCountry, sameCity, sharedAssociations, mutualConnections: Math.max(0, Math.trunc(mutualConnections)) }
}

/** Les poids, bornés : une association ou une relation de plus n'écrase pas tout le reste. */
const WEIGHTS = Object.freeze({ sameCountry: 1, sameCity: 4, association: 3, associationsMax: 3, mutual: 2, mutualMax: 5 })

export function suggestionScore(reasons: SuggestionReasons): number {
  return (
    (reasons.sameCountry ? WEIGHTS.sameCountry : 0) +
    (reasons.sameCity ? WEIGHTS.sameCity : 0) +
    Math.min(reasons.sharedAssociations, WEIGHTS.associationsMax) * WEIGHTS.association +
    Math.min(reasons.mutualConnections, WEIGHTS.mutualMax) * WEIGHTS.mutual
  )
}

/** Sans aucun point commun visible, une personne n'est pas une suggestion (EXF-DG-18 : pays, ville, association, relations). */
export function isWorthSuggesting(reasons: SuggestionReasons): boolean {
  return suggestionScore(reasons) > 0
}

/** Les mieux classés d'abord ; à égalité, l'ordre du vivier (stable). */
export function rankSuggestions<T extends { readonly reasons: SuggestionReasons }>(candidates: readonly T[], max = SUGGESTIONS_MAX): T[] {
  return candidates
    .map((candidate, index) => ({ candidate, index, score: suggestionScore(candidate.reasons) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, max))
    .map((entry) => entry.candidate)
}
