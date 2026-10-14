/**
 * Les quatre badges de confiance (cahier §6.3) — Officiel · Vérifié ·
 * Agent public · Communauté.
 *
 * La confiance est visible et JAMAIS déclarative (invariant 8) : ces règles
 * pures se calculent côté serveur à partir des liens d'identité et de la
 * nature des pages, et le résultat se lit dans des projections. Aucun champ
 * saisi par une personne ne porte un badge.
 */
import { VERIFIED_LOA_THRESHOLD, type MembershipStatus } from "./eligibility"

export const TRUST_BADGES = ["official", "verified", "public_agent", "community"] as const
export type TrustBadge = (typeof TRUST_BADGES)[number]

/** Les faits d'une PERSONNE dont ses badges se calculent. */
export interface PersonTrustFacts {
  /** Niveau de garantie du lien IDN vivant ; absent sans lien IDN. */
  readonly idnLoa?: number
  /** Lien `consular_attestation` vivant (attestation consulaire confirmée). */
  readonly consularAttestation: boolean
  /** Lien `administration` vivant (reflet du socle, opt-in de l'agent). */
  readonly administrationLink: boolean
  /** Statut d'adhésion à `diasporale`, quand la personne en est membre. */
  readonly membershipStatus?: MembershipStatus
}

/**
 * Badges d'une personne, dans l'ordre d'affichage. « Vérifié » et « Agent
 * public » peuvent coexister ; « Communauté » n'apparaît que seul — c'est
 * l'absence des autres, pas un rang.
 */
export function personBadges(facts: PersonTrustFacts): TrustBadge[] {
  const badges: TrustBadge[] = []
  const verified =
    facts.consularAttestation ||
    (facts.idnLoa ?? 0) >= VERIFIED_LOA_THRESHOLD ||
    facts.membershipStatus === "verifiee"
  if (verified) badges.push("verified")
  if (facts.administrationLink) badges.push("public_agent")
  return badges.length > 0 ? badges : ["community"]
}

// ═══════════════════════════════════════════════════════════════
// Pages
// ═══════════════════════════════════════════════════════════════

export const PAGE_OWNER_KINDS = ["institution", "association", "company", "media", "community"] as const
export type PageOwnerKind = (typeof PAGE_OWNER_KINDS)[number]

export const PAGE_TRUST_LEVELS = ["official", "verified", "community"] as const
export type PageTrustLevel = (typeof PAGE_TRUST_LEVELS)[number]

/**
 * D'où vient une page. Seules trois origines peuvent faire une page
 * « Officiel » : l'import contractuel des postes consulaires
 * (`DIASPORA-COMMUNAUTE-V1`), la fédération (`RESEAU-PUBLIC-V1`) et la création
 * tracée par l'opérateur de la plateforme. Un membre ne crée jamais une page
 * d'institution.
 */
export const PAGE_SOURCES = [
  "consular_import",
  "federation",
  "platform_manual",
  "community_import",
  "member_created",
] as const
export type PageSource = (typeof PAGE_SOURCES)[number]

const OFFICIAL_SOURCES: ReadonlySet<PageSource> = new Set(["consular_import", "federation", "platform_manual"])

export interface PageTrustFacts {
  readonly ownerKind: PageOwnerKind
  readonly source: PageSource
  /** Revendication (association) ou vérification (entreprise) validée par décision tracée. */
  readonly claimValidated: boolean
}

export function pageTrustLevel(facts: PageTrustFacts): PageTrustLevel {
  if (facts.ownerKind === "institution" && OFFICIAL_SOURCES.has(facts.source)) return "official"
  if (facts.claimValidated) return "verified"
  return "community"
}

export function pageBadge(facts: PageTrustFacts): TrustBadge {
  return pageTrustLevel(facts)
}

/** Une page `official` n'est pas revendicable ; une page `community` l'est (§12.3). */
export function isPageClaimable(facts: PageTrustFacts): boolean {
  return pageTrustLevel(facts) === "community" && facts.ownerKind !== "institution"
}

/** Ce qu'un membre (vérifié) peut créer : jamais une institution, jamais une page « Officiel ». */
export const MEMBER_CREATABLE_PAGE_KINDS: readonly PageOwnerKind[] = Object.freeze([
  "association",
  "company",
  "media",
  "community",
])

export function canMemberCreatePageKind(kind: PageOwnerKind): boolean {
  return MEMBER_CREATABLE_PAGE_KINDS.includes(kind)
}

// ═══════════════════════════════════════════════════════════════
// Contenus — le badge de leur auteur
// ═══════════════════════════════════════════════════════════════

export type ContentAuthorFacts =
  | { readonly kind: "person"; readonly facts: PersonTrustFacts }
  | { readonly kind: "page"; readonly facts: PageTrustFacts }

/** Une publication de page porte le badge de la page ; celle d'une personne, les siens. */
export function contentBadges(author: ContentAuthorFacts): TrustBadge[] {
  return author.kind === "page" ? [pageBadge(author.facts)] : personBadges(author.facts)
}
