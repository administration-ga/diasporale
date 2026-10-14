/**
 * Le réseau `diasporale` dans le moteur (cahier §7).
 *
 * C'est la ligne que le seed du moteur pose dans `networks` (PD1). Le moteur
 * ne connaît que des champs génériques (`networkId`, `visibility`, `reach?`,
 * `country?`) ; ce paquet est la source des valeurs propres à la diaspora.
 */
import { DEFAULT_OPEN_COUNTRIES } from "./countries"
import { REACH_VALUES } from "./reach"

export const DIASPORALE_NETWORK_SLUG = "diasporale"

/** Le réseau racine : toute adhésion à DIASPORALE y crée une adhésion dérivée. */
export const ROOT_NETWORK_SLUG = "antia"

export const NETWORK_KINDS = ["root", "closed"] as const
export type NetworkKind = (typeof NETWORK_KINDS)[number]

export const MEMBERSHIP_POLICIES = ["open", "declared_or_verified", "mirror"] as const
export type MembershipPolicy = (typeof MEMBERSHIP_POLICIES)[number]

export const DIASPORALE_NETWORK = Object.freeze({
  slug: DIASPORALE_NETWORK_SLUG,
  kind: "closed" satisfies NetworkKind,
  parentSlug: ROOT_NETWORK_SLUG,
  membershipPolicy: "declared_or_verified" satisfies MembershipPolicy,
  defaultVisibility: "network",
  reachValues: REACH_VALUES,
  openCountries: DEFAULT_OPEN_COUNTRIES,
})
