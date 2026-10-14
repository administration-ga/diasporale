/**
 * Modération par pays (cahier §5 invariant 10, EXF-DG-42, P4 des specs design).
 *
 *   · Un contenu communautaire naît en relecture (`pending_review`) tant que
 *     l'équipe compétente n'a pas DEUX modérateurs actifs (PD6, paramètre de
 *     réseau), puis se publie directement, modéré a posteriori.
 *   · Compétence : l'équipe du pays pour un contenu local d'un pays OUVERT ;
 *     l'équipe réseau pour la portée `diaspora` et pour un pays pas encore ouvert.
 *   · L'auteur voit l'état de son contenu ; les autres ne voient jamais un
 *     contenu non publié.
 */
import { isCountryOpen, type CountryCode } from "./countries"
import type { ContentScope } from "./reach"

export const CONTENT_MODERATION_STATES = ["pending_review", "published", "rejected"] as const
export type ContentModerationState = (typeof CONTENT_MODERATION_STATES)[number]

/** Un contenu en relecture ou refusé n'existe que pour son auteur (P4). */
export function isReadableByOthers(state: ContentModerationState): boolean {
  return state === "published"
}

/** Seuil de publication directe : deux modérateurs actifs dans l'équipe compétente. */
export const DIRECT_PUBLICATION_MODERATOR_THRESHOLD = 2

export type ReviewMode = "direct" | "pending_review"

export type ModerationScope =
  | { readonly kind: "country"; readonly country: CountryCode }
  | { readonly kind: "network" }

export interface PublicationPolicy {
  readonly review: ReviewMode
  readonly moderation: ModerationScope
}

export interface PublicationPolicyInput {
  readonly scope: ContentScope
  readonly openCountries: readonly CountryCode[]
  /** Modérateurs actifs de l'équipe du pays du contenu (0 si aucune équipe). */
  readonly countryActiveModerators: number
  /** Modérateurs actifs de l'équipe réseau. */
  readonly networkActiveModerators: number
  /**
   * Relecture imposée par le réseau pour cette surface (emploi, annonces au
   * lancement…), quels que soient les effectifs.
   */
  readonly surfaceForcesReview?: boolean
}

export function moderationScopeFor(scope: ContentScope, openCountries: readonly CountryCode[]): ModerationScope {
  if (scope.reach === "local" && isCountryOpen(scope.country, openCountries)) {
    return { kind: "country", country: scope.country }
  }
  return { kind: "network" }
}

/** Le sort d'un contenu communautaire à sa publication : relu d'abord, ou publié. */
export function publicationPolicy(input: PublicationPolicyInput): PublicationPolicy {
  const moderation = moderationScopeFor(input.scope, input.openCountries)
  const activeModerators =
    moderation.kind === "country" ? input.countryActiveModerators : input.networkActiveModerators
  // Un pays fermé passe TOUJOURS par la relecture réseau, même quand l'équipe
  // réseau est au complet : aucun contenu local n'y paraît sans regard humain.
  const closedLocal = input.scope.reach === "local" && moderation.kind === "network"
  const review: ReviewMode =
    input.surfaceForcesReview === true || closedLocal || activeModerators < DIRECT_PUBLICATION_MODERATOR_THRESHOLD
      ? "pending_review"
      : "direct"
  return { review, moderation }
}

/** État initial d'un contenu communautaire selon la politique. */
export function initialModerationState(policy: PublicationPolicy): ContentModerationState {
  return policy.review === "direct" ? "published" : "pending_review"
}
