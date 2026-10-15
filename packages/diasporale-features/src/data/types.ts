/**
 * Projections de lecture de DIASPORALE — ce que le moteur RENDRA (projections
 * allowlistées, cahier §12.5) et ce que le fournisseur de démonstration rend
 * en attendant. Aucun enregistrement source, aucun identifiant interne exposé
 * au-delà de l'identifiant opaque de la ligne ; aucune coordonnée, jamais.
 */
import type {
  AttestationOutcome,
  ConsentPurpose,
  ContentModerationState,
  ContentScope,
  CountryCode,
  DiasporaFacet,
  DirectoryVisibility,
  FacetProjection,
  HubCountersPresentation,
  MembershipStatus,
  PageOwnerKind,
  PageTrustLevel,
  PostAudience,
  SponsorshipRefusal,
  TrustBadge,
  Visibility,
  WriteRateTier,
} from "@diasporale/domain"

export type Loadable<T> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: T }
  | { readonly status: "error"; readonly code: string }

export const REACTION_KINDS = ["like", "bravo", "soutien", "instructif"] as const
export type ReactionKind = (typeof REACTION_KINDS)[number]

export interface AuthorView {
  readonly kind: "person" | "page"
  readonly id: string
  readonly handle: string
  readonly displayName: string
  readonly badges: readonly TrustBadge[]
}

export interface PostView {
  readonly id: string
  readonly author: AuthorView
  readonly body: string
  readonly scope: ContentScope
  readonly audience: PostAudience
  readonly visibility: Visibility
  readonly moderation: ContentModerationState
  readonly createdAt: number
  readonly reactionCount: number
  readonly commentCount: number
  readonly myReaction: ReactionKind | null
  readonly isMine: boolean
}

export const EVENT_CATEGORIES = ["celebration", "culture", "sport", "charity", "diplomacy"] as const
export type EventCategory = (typeof EVENT_CATEGORIES)[number]

export interface EventView {
  readonly id: string
  readonly title: string
  readonly startsAt: number
  readonly city: string
  readonly scope: ContentScope
  readonly category: EventCategory
  readonly organizer: AuthorView
  readonly capacity: number | null
  readonly registered: number
  readonly moderation: ContentModerationState
}

export const ASSOCIATION_TYPES = [
  "cultural",
  "sports",
  "religious",
  "professional",
  "solidarity",
  "education",
  "youth",
  "women",
  "student",
  "other",
] as const
export type AssociationType = (typeof ASSOCIATION_TYPES)[number]

export const COMPANY_SECTORS = ["food", "services", "retail", "tech", "transport", "health", "beauty", "other"] as const
export type CompanySector = (typeof COMPANY_SECTORS)[number]

export interface PageView {
  readonly id: string
  readonly handle: string
  readonly name: string
  readonly ownerKind: PageOwnerKind
  readonly trust: PageTrustLevel
  readonly badge: TrustBadge
  readonly country: CountryCode | null
  readonly city: string | null
  readonly description: string
  readonly followers: number
  readonly claimable: boolean
  readonly associationType?: AssociationType
  readonly sector?: CompanySector
}

export interface CountryHubView {
  readonly country: CountryCode
  readonly open: boolean
  readonly counters: HubCountersPresentation
  /** `materialized` : compteurs du moteur ; `demo` : jeu de démonstration (toujours signalé). */
  readonly countersSource: "materialized" | "demo"
  readonly officialPages: readonly PageView[]
  readonly associations: readonly PageView[]
  readonly companies: readonly PageView[]
  readonly events: readonly EventView[]
}

export interface AccountView {
  readonly id: string
  /** Porte d'entrée : IDN (niveau de garantie) ou compte léger (adresse masquée). */
  readonly idn: { readonly loa: number } | null
  readonly local: { readonly kind: "email" | "phone"; readonly masked: string } | null
  /** Prénom et nom reçus d'IDN — servent aux SUGGESTIONS de handle, jamais recopiés d'office. */
  readonly nameHints: { readonly firstName?: string; readonly lastName?: string }
}

export interface MembershipView {
  readonly personId: string
  readonly handle: string
  readonly displayName: string
  readonly status: MembershipStatus
  readonly badges: readonly TrustBadge[]
  readonly facet: DiasporaFacet
  readonly joinedAt: number
  readonly verifiedSince: number | null
  readonly sponsoredBy: { readonly handle: string; readonly displayName: string } | null
  readonly attestation: {
    readonly outcome: AttestationOutcome | "none"
    readonly postSlug: string | null
    readonly requestedAt: number | null
  }
  /** L'adhésion dérivée au réseau racine (invariant 3) — elle existe sans geste. */
  readonly root: { readonly network: "antia"; readonly status: MembershipStatus; readonly derivedFrom: "diasporale" }
  readonly canPublish: boolean
  readonly rateTier: WriteRateTier
  readonly directoryVisibility: DirectoryVisibility
}

export type SessionView =
  | { readonly status: "anonymous" }
  | { readonly status: "signed_in"; readonly account: AccountView; readonly membership: MembershipView | null }

export interface ProfileView {
  readonly personId: string
  readonly handle: string
  readonly displayName: string
  readonly headline: string | null
  readonly badges: readonly TrustBadge[]
  readonly facet: FacetProjection
  /** Ce qu'un membre ordinaire d'un autre pays voit de la facette (`?apercu=1`). */
  readonly publicFacet: FacetProjection
  /** Nom de la page du poste de rattachement, quand la facette le montre. */
  readonly postName: string | null
  readonly isSelf: boolean
  readonly posts: readonly PostView[]
}

export interface PageDetailView {
  readonly page: PageView
  readonly posts: readonly PostView[]
  readonly events: readonly EventView[]
}

/**
 * Ma relation avec une personne, dans DIASPORALE (EXF-DG-11, EXF-DG-12) : la
 * connexion (demande, réponse, lien établi), l'abonnement, et MON blocage. Un
 * blocage posé par l'AUTRE ne se voit pas : pour le bloqué, il n'y a « rien ».
 */
export const CONNECTION_STATES = ["none", "requested_by_me", "requested_by_them", "connected", "blocked_by_me"] as const
export type ConnectionState = (typeof CONNECTION_STATES)[number]

export interface RelationView {
  readonly connection: ConnectionState
  /** La demande ou le lien en cours, pour y répondre ou le défaire ; `null` sans relation. */
  readonly connectionId: string | null
  readonly following: boolean
}

/**
 * Les avis de la cloche que DIASPORALE sait dire. Tout autre genre du moteur se
 * dit « nouvelle activité » (`other`) : jamais un libellé inventé.
 */
export const NOTIFICATION_KINDS = [
  "connection_request",
  "connection_accepted",
  "new_follower",
  "post_reaction",
  "post_comment",
  "mention",
  "sponsorship_received",
  "sponsorship_withdrawn",
  "attestation_verified",
  "attestation_not_confirmed",
  "other",
] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

/** Ce qu'est DEVENUE une demande de relation reçue (relu à l'instant). */
export const INVITE_OUTCOMES = ["accepted", "declined", "gone"] as const
export type InviteOutcome = (typeof INVITE_OUTCOMES)[number]

export interface NotificationView {
  readonly id: string
  readonly kind: NotificationKind
  /** Qui a agi, par son profil PUBLIÉ ; `null` pour un avis du système ou un profil retiré. */
  readonly actor: { readonly handle: string; readonly displayName: string } | null
  readonly createdAt: number
  readonly read: boolean
  /** Une demande de relation encore à trancher PAR MOI : de quoi l'accepter ou la refuser d'ici. */
  readonly pendingConnectionId: string | null
  readonly inviteOutcome: InviteOutcome | null
}

/** Les non-lues, bornées : au-delà de 99, la cloche dit « 99+ ». */
export interface UnreadCountView {
  readonly count: number
  readonly capped: boolean
}

export interface SponsorshipView {
  readonly id: string
  readonly sponsored: { readonly handle: string; readonly displayName: string }
  readonly createdAt: number
  readonly revokedAt: number | null
}

export interface SponsorDashboardView {
  readonly eligible: boolean
  readonly refusal: SponsorshipRefusal | null
  readonly remaining: number
  readonly windowDays: number
  readonly seniorityReachedAt: number | null
  readonly given: readonly SponsorshipView[]
}

export interface ConsentView {
  readonly purpose: ConsentPurpose
  readonly granted: boolean
  readonly recordedAt: number | null
  readonly textVersion: string
}

export interface OpenCountryView {
  readonly country: CountryCode
  readonly counters: HubCountersPresentation
  readonly countersSource: "materialized" | "demo"
}

// ═══════════════════════════════════════════════════════════════
// Projections des cartes du lot D2 (emploi, annonces, talents, groupes,
// entraide) — formes stables dès maintenant pour les cartes C4–C9 ; leurs
// données arrivent avec la tranche `diaspora` du moteur (PD8).
// ═══════════════════════════════════════════════════════════════

export const JOB_CONTRACTS = ["cdi", "cdd", "internship", "part_time", "freelance"] as const
export type JobContract = (typeof JOB_CONTRACTS)[number]

export interface JobView {
  readonly id: string
  readonly title: string
  readonly employer: { readonly name: string; readonly id: string; readonly badge: TrustBadge }
  readonly contract: JobContract
  readonly city: string
  readonly scope: ContentScope
  readonly salary: string | null
  readonly publishedAt: number
  readonly sponsored: boolean
  readonly filled: boolean
}

export const CLASSIFIED_CATEGORIES = ["housing", "goods", "services", "parcel", "other"] as const
export type ClassifiedCategory = (typeof CLASSIFIED_CATEGORIES)[number]

export interface ClassifiedView {
  readonly id: string
  readonly title: string
  readonly category: ClassifiedCategory
  /** Montant déjà formaté avec sa devise par le serveur — aucun calcul de prix côté interface. */
  readonly price: string | null
  readonly city: string
  readonly country: CountryCode
  readonly seller: { readonly displayName: string; readonly badges: readonly TrustBadge[] }
  readonly publishedAt: number
}

export interface TalentView {
  readonly personId: string
  /** Prénom et initiale du nom — jamais le nom complet en liste (spec C6). */
  readonly shortName: string
  readonly title: string
  readonly skills: readonly string[]
  /** Langues en codes ISO 639-1 (« fr », « en ») : le nom se calcule par `Intl.DisplayNames`. */
  readonly languages: readonly string[]
  readonly city: string | null
  readonly country: CountryCode
  readonly badges: readonly TrustBadge[]
}

export interface GroupView {
  readonly id: string
  readonly name: string
  readonly scope: ContentScope
  readonly memberCount: number
  readonly lastMessage: string | null
  readonly unread: number
  readonly private: boolean
}

export const MENTOR_DOMAINS = ["housing", "studies", "work", "family", "admin"] as const
export type MentorDomain = (typeof MENTOR_DOMAINS)[number]

export interface MentorView {
  readonly personId: string
  readonly shortName: string
  readonly city: string | null
  readonly country: CountryCode
  readonly domains: readonly MentorDomain[]
  readonly arrivedAt: number | null
}
