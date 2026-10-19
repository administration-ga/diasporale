/**
 * Projections de lecture de DIASPORALE — ce que le moteur RENDRA (projections
 * allowlistées, cahier §12.5) et ce que le fournisseur de démonstration rend
 * en attendant. Aucun enregistrement source, aucun identifiant interne exposé
 * au-delà de l'identifiant opaque de la ligne ; aucune coordonnée, jamais.
 */
export { DISPLAY_NAME_MAX_LENGTH, HEADLINE_MAX_LENGTH } from "@antsia/social-domain/content"
import { PAGE_ASSOCIATION_TYPES, PAGE_COMPANY_SECTORS } from "@antsia/social-domain/pagePresentation"
import type { PageAssociationType, PageCompanySector } from "@antsia/social-domain/pagePresentation"

import type {
  AttestationOutcome,
  ConsentPurpose,
  ContentModerationState,
  ContentScope,
  CountryCode,
  DiasporaFacet,
  DirectoryVisibility,
  FacetProjection,
  FeedScope,
  HubCountersPresentation,
  MembershipStatus,
  PageOwnerKind,
  PageTrustLevel,
  PostAudience,
  SponsorshipRefusal,
  SuggestionReasons,
  TrustBadge,
  Visibility,
  WriteRateTier,
} from "@diasporale/domain"

import type { ActionErrorCode } from "./errors"

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

/**
 * Un média d'une publication (EXF-DG-10). Le moteur ne délivre un fichier qu'une
 * fois analysé : tant que la garde le retient, l'URL manque et la raison se dit
 * (analyse en cours, bloqué), le média garde sa place dans la publication.
 */
export interface PostMediaView {
  readonly kind: "image" | "video"
  readonly url: string | null
  readonly withheld: "scan_pending" | "quarantined" | null
  readonly altText: string | null
  readonly width: number | null
  readonly height: number | null
}

/**
 * L'original d'un PARTAGE cité (EXF-DG-10), tel que le lecteur a le droit de le
 * voir À CET INSTANT : retiré ou hors de sa portée, la carte le dit et ne dit
 * que cela. Partager un partage cite l'original.
 */
export type SharedPostView =
  | { readonly available: false }
  | {
      readonly available: true
      readonly postId: string
      readonly author: { readonly kind: "person" | "page"; readonly handle: string | null; readonly displayName: string | null }
      readonly body: string
      readonly media: readonly PostMediaView[]
      readonly publishedAt: number
    }

export interface PostView {
  readonly id: string
  /** Galerie collective événementielle ; l'éditeur des posts de page ordinaires ne s'applique pas. */
  readonly eventGalleryId?: string
  readonly author: AuthorView
  readonly body: string
  /** Quatre photos au plus, ou une vidéo seule (règle du moteur). */
  readonly media: readonly PostMediaView[]
  /** L'original cité, si cette publication en partage une ; `null` sinon. */
  readonly share: SharedPostView | null
  /** Combien de fois elle a été partagée. */
  readonly shareCount: number
  readonly scope: ContentScope
  readonly audience: PostAudience
  readonly visibility: Visibility
  readonly moderation: ContentModerationState
  readonly createdAt: number
  readonly reactionCount: number
  readonly commentCount: number
  readonly myReaction: ReactionKind | null
  readonly isMine: boolean
  /** Enregistrée par le lecteur (signet, visible de lui seul). */
  readonly bookmarked: boolean
  /** Modifiée après sa publication : la carte le dit. */
  readonly edited: boolean
  /** Version d'édition pour les gestes collectifs de page ; absente des anciens fournisseurs. */
  readonly editedAt?: number | null
}

/** Curseur opaque du fil : l'instant seul ne départage pas deux publications. */
export interface FeedCursorView {
  readonly publishedAt: number
  readonly postId: string
}

export interface FeedPageRequest {
  readonly scope: FeedScope
  readonly hubCountry?: CountryCode
  /** Jeton canonique du moteur ; restreint les publications déjà lisibles. */
  readonly tag?: string
  /** Absent ou nul pour la première page ; les suivantes reprennent le curseur reçu. */
  readonly cursor?: FeedCursorView | null
}

export interface ProfilePostsPageRequest {
  readonly handle: string
  readonly cursor?: FeedCursorView | null
}

export interface FeedPageView {
  readonly items: readonly PostView[]
  readonly nextCursor: FeedCursorView | null
  /** Fenêtre bornée par le moteur, distincte de la fin du fil. */
  readonly lacunar: boolean
}

/** Une page réactive : une panne après données conserve celles-ci pendant la reprise. */
export interface FeedPageQuery {
  readonly data: FeedPageView | undefined
  readonly isLoading: boolean
  readonly error: ActionErrorCode | null
  readonly retry: () => void
}

/** Un signet (EXF-DG-12) : de quoi reconnaître la publication et l'ouvrir. */
export interface BookmarkView {
  readonly postId: string
  readonly author: { readonly kind: "person" | "page"; readonly handle: string | null; readonly displayName: string | null }
  readonly body: string
  readonly publishedAt: number
  readonly markedAt: number
}

export const BOOKMARKS_PAGE_SIZE = 50

/** Curseur opaque du fournisseur : jamais converti en curseur de fil. */
export interface BookmarksPageRequest {
  readonly cursor?: string | null
}

export interface BookmarksPageView {
  readonly items: readonly BookmarkView[]
  readonly continueCursor: string
  readonly isDone: boolean
}

export interface BookmarksPageQuery {
  readonly data: BookmarksPageView | undefined
  readonly isLoading: boolean
  readonly error: ActionErrorCode | null
  /** Une page rendue par cette tentative est fraîche ; undefined ne réautorise aucun cache. */
  readonly retry: () => Promise<BookmarksPageView | undefined> | BookmarksPageView | undefined
}

/** Les six motifs de signalement (EXF-DG-12), ceux du moteur (`CONTENT_REPORT_REASONS`). */
export const REPORT_REASONS = ["harassment", "hate", "violence", "sexual_content", "misinformation", "other"] as const
export type ReportReason = (typeof REPORT_REASONS)[number]
/** Longueur de la précision d'un signalement, règle du moteur (`CONTENT_REPORT_NOTE_MAX`). */
export const REPORT_NOTE_MAX = 1000

/** Un commentaire (EXF-DG-12) : l'auteur par son profil PUBLIÉ (`null` : nom neutre, profil retiré). */
export interface CommentView {
  readonly id: string
  readonly author: { readonly personId: string; readonly handle: string | null; readonly displayName: string | null }
  readonly body: string
  readonly createdAt: number
  readonly edited: boolean
  readonly isMine: boolean
}

/** Un commentaire racine et ses premières réponses ; la suite se lit à la demande (un seul niveau). */
export interface CommentThreadView extends CommentView {
  readonly replyCount: number
  readonly replies: readonly CommentView[]
}

/** Longueur d'un commentaire, règle du moteur (`PERSONAL_COMMENT_MAX_LENGTH`). */
export const COMMENT_MAX_LENGTH = 1000
/** Réponses montrées sous une racine avant « voir les réponses », comme le moteur. */
export const COMMENT_REPLIES_PREVIEW = 3
/** Racines lues par ouverture des commentaires. */
export const COMMENTS_PAGE = 20

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

export const ASSOCIATION_TYPES = PAGE_ASSOCIATION_TYPES
export type AssociationType = PageAssociationType

export const COMPANY_SECTORS = PAGE_COMPANY_SECTORS
export type CompanySector = PageCompanySector

export interface PageView {
  readonly id: string
  readonly handle: string
  readonly name: string
  readonly ownerKind: PageOwnerKind
  readonly trust: PageTrustLevel
  /** Calculé côté serveur à partir de la confiance de la page, jamais déclaré. */
  readonly badge: TrustBadge
  readonly country: CountryCode | null
  readonly city: string | null
  /** Vide quand la page n'en a pas. */
  readonly description: string
  /** Abonnés comptés (agrégat du moteur, état local en démonstration) — un zéro reste un zéro. */
  readonly followers: number
  /** Revendicable par CE lecteur ; `false` quand le fournisseur ne le sait pas (annuaire). */
  readonly claimable: boolean
  readonly associationType?: AssociationType
  readonly sector?: CompanySector
  /** Sigle de la page, quand elle en a un. */
  readonly shortName?: string | null
  /** Logo délivré par la garde des fichiers ; `null` : sans logo, ou retenu par la garde. */
  readonly logoUrl?: string | null
}

export interface CountryHubView {
  readonly country: CountryCode
  readonly open: boolean
  /** Membres, associations, entreprises : MATÉRIALISÉS par le passage nocturne, jamais comptés à la lecture. */
  readonly counters: HubCountersPresentation
  /** `materialized` : compteurs du moteur ; `demo` : jeu de démonstration (toujours signalé). */
  readonly countersSource: "materialized" | "demo"
  /**
   * Les pages du pays, quand le fournisseur les joint au hub (démonstration).
   * Avec le moteur, elles se lisent par la capacité « pages » (`useHubPages`,
   * bornées par nature) : ces listes restent vides plutôt qu'inventées.
   */
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
  /**
   * Le thème enregistré sur le compte, absent tant que la personne n'en a choisi aucun. Le
   * compte est commun aux réseaux du moteur : un thème qu'antsia.ga propose et que DIASPORALE
   * n'a pas laisse ici le choix de l'appareil.
   */
  readonly theme?: string
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
  readonly root: { readonly network: "antsia"; readonly status: MembershipStatus; readonly derivedFrom: "diasporale" }
  readonly canPublish: boolean
  readonly rateTier: WriteRateTier
  readonly directoryVisibility: DirectoryVisibility
}

export type SessionView =
  | { readonly status: "anonymous" }
  | { readonly status: "signed_in"; readonly account: AccountView; readonly membership: MembershipView | null }

/** État du profil commun, réservé à la personne authentifiée, même après retrait. */
export interface OwnProfileView {
  readonly personId: string
  readonly handle: string | null
  readonly displayName: string | null
  readonly headline: string | null
  readonly published: boolean
  readonly private: boolean
}

/** Une image de profil déjà jugée par la garde des fichiers du moteur. */
export interface ProfileImageView {
  readonly url: string | null
  readonly withheld: "fileScanPending" | "fileQuarantined" | null
}

export interface ProfileView {
  readonly personId: string
  readonly handle: string
  readonly displayName: string
  readonly headline: string | null
  readonly avatar: ProfileImageView | null
  readonly cover: ProfileImageView | null
  readonly badges: readonly TrustBadge[]
  readonly facet: FacetProjection
  /** Ce qu'un membre ordinaire d'un autre pays voit de la facette (`?apercu=1`). */
  readonly publicFacet: FacetProjection
  /** Nom de la page du poste de rattachement, quand la facette le montre. */
  readonly postName: string | null
  readonly isSelf: boolean
  /** Champ historique : la fiche est indépendante des pages de son mur. */
  readonly posts: readonly PostView[]
}

/** Rôle VIVANT d'un signataire : `admin` publie et gère, `signatory` publie. */
export type PageViewerRole = "admin" | "signatory"

/** Le lecteur face à la page : son rôle vivant (relu à chaque lecture) et son abonnement. */
export interface PageViewerView {
  /** `null` : simple lecteur (une invitation en attente ne donne aucun rôle). */
  readonly role: PageViewerRole | null
  readonly following: boolean
}

export interface PageDetailView {
  readonly page: PageView
  /** Bannière délivrée par la garde des fichiers ; `null` : sans bannière, ou retenue. */
  readonly bannerUrl: string | null
  /** Publications de la page, comptées par le moteur (un zéro reste un zéro). */
  readonly postCount: number
  /** La première fenêtre du mur, chaque publication repassée par la garde du fil. */
  readonly posts: readonly PostView[]
  /** Des publications plus anciennes existent au-delà de cette première fenêtre. */
  readonly morePosts: boolean
  /** Le moteur n'a pas encore d'organisateur « page » : vide plutôt qu'inventé. */
  readonly events: readonly EventView[]
  readonly viewer: PageViewerView
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
 * Un membre trouvé dans l'annuaire opt-in (EXF-DG-19, EXF-DG-46) : seulement
 * la facette PROJETÉE pour le lecteur, aucune coordonnée — le contact passe par
 * la messagerie.
 */
export interface MemberHitView {
  readonly personId: string
  readonly handle: string
  readonly displayName: string
  readonly headline: string | null
  readonly badges: readonly TrustBadge[]
  readonly facet: FacetProjection
}

/** Une requête plus courte ne cherche pas : « chercher sans chercher » viderait l'annuaire. */
export const MEMBER_SEARCH_MIN_LENGTH = 2

/**
 * Une suggestion de relation (EXF-DG-18) : un membre de l'annuaire opt-in et ce
 * qui le rapproche du lecteur — lu sur ce que le lecteur a le droit de voir.
 */
export interface SuggestionView extends MemberHitView {
  readonly reasons: SuggestionReasons
}

/**
 * Les avis de MISE EN RELATION (DG-010, DG-015, DG-016) : des phrases du système,
 * neutres — ni besoin, ni montant, ni créneau, ni nom —, que le moteur relit avec
 * les droits du lecteur (mêmes genres que la tranche `diaspora` du moteur).
 */
export const SERVICE_NOTIFICATION_KINDS = [
  "service_request_received",
  "service_proposal_received",
  "service_request_declined",
  "service_proposal_accepted",
  "service_request_cancelled",
  "service_request_expired",
  "service_booking_completed",
  "service_booking_no_show",
  "service_no_show_contested",
  "association_membership_requested",
  "association_membership_accepted",
  "association_membership_declined",
  "association_membership_removed",
  "service_review_replied",
] as const
export type ServiceNotificationKind = (typeof SERVICE_NOTIFICATION_KINDS)[number]

/**
 * Les avis de la VIE COMMUNAUTAIRE (vague H : entraide, mentorat, emploi, kit d'arrivée) :
 * des phrases du système, neutres, sans contenu ni nom ni motif, relues par le moteur avec
 * les droits du lecteur (mêmes genres que `diaspora/communityNotifications.ts` du moteur).
 */
export const COMMUNITY_NOTIFICATION_KINDS = [
  "aid_answer_received",
  "aid_answer_retained",
  "aid_mission_signup",
  "mentoring_request_received",
  "mentoring_request_accepted",
  "mentoring_request_declined",
  "mentoring_closed",
  "job_application_received",
  "job_application_shortlisted",
  "job_application_not_selected",
  "kit_resource_reviewed",
] as const
export type CommunityNotificationKind = (typeof COMMUNITY_NOTIFICATION_KINDS)[number]

/** À qui parle un avis communautaire : l'auteur d'un contenu, l'équipe d'une page, le mentor, le mentoré, la personne qui candidate. */
export const COMMUNITY_NOTICE_AUDIENCES = ["author", "team", "mentor", "mentee", "candidate"] as const
export type CommunityNoticeAudience = (typeof COMMUNITY_NOTICE_AUDIENCES)[number]

/** L'objet qu'un avis communautaire ouvre, par une route de l'application. */
export const COMMUNITY_NOTICE_OPENS = ["aidQuestion", "aidMission", "mentoringRequest", "jobApplication", "kitResource"] as const
export type CommunityNoticeOpens = (typeof COMMUNITY_NOTICE_OPENS)[number]

/** Ce qu'un avis communautaire DÉSIGNE, relu par le moteur avec les droits du lecteur : jamais un contenu. */
export interface CommunityNoticeView {
  readonly audience: CommunityNoticeAudience
  readonly opens: CommunityNoticeOpens
  /** L'identifiant de l'objet ouvert (la question, pour une réponse retenue). */
  readonly objectId: string
  /** L'adresse publique de la page concernée, si elle se lit encore ; `null` sinon. */
  readonly pageHandle: string | null
}

/**
 * Les avis d'une CONVERSATION DE MISE EN RELATION (CC-2b du moteur) : un message reçu, un fil
 * clos. Neutres : ni contenu, ni nom ; le fil est relu avec les droits du lecteur.
 */
export const CONTEXTUAL_NOTIFICATION_KINDS = ["contextual_message", "contextual_closed"] as const
export type ContextualNotificationKind = (typeof CONTEXTUAL_NOTIFICATION_KINDS)[number]

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
  "post_share",
  "mention",
  "sponsorship_received",
  "sponsorship_withdrawn",
  "attestation_verified",
  "attestation_not_confirmed",
  "association_event_reminder",
  ...SERVICE_NOTIFICATION_KINDS,
  ...COMMUNITY_NOTIFICATION_KINDS,
  ...CONTEXTUAL_NOTIFICATION_KINDS,
  // P16 · G9 : une décision de modération qui me concerne, ou qui concerne une page dont je signe.
  "moderation_decision",
  "other",
] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

/** À qui parle un avis de mise en relation — d'où son lien : le demandeur, l'équipe de la page, les responsables, la personne. */
export const SERVICE_NOTICE_AUDIENCES = ["requester", "provider", "responsible", "member"] as const
export type ServiceNoticeAudience = (typeof SERVICE_NOTICE_AUDIENCES)[number]

/** Ce qu'un avis de mise en relation DÉSIGNE, relu par le moteur avec les droits du lecteur : jamais un contenu. */
export interface ServiceNoticeView {
  readonly audience: ServiceNoticeAudience
  /** La demande concernée (demandeur, équipe de la page, auteur d'un avis) ; `null` pour une adhésion. */
  readonly requestId: string | null
  /** L'adresse publique de la page concernée, si elle se lit encore ; `null` sinon. */
  readonly pageHandle: string | null
}

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
  /** La publication dont parle l'avis (réaction, commentaire, citation) : de quoi l'ouvrir. */
  readonly postId: string | null
  /** Lien vers l'événement de page, relu avec les droits du destinataire. */
  readonly associationEvent?: { readonly eventId: string; readonly pageHandle: string } | null
  /** Avis de mise en relation : sa cible relue (demande ou page) ; `null` si elle ne se lit plus. */
  readonly serviceNotice?: ServiceNoticeView | null
  /** Avis de la vie communautaire : l'objet qu'il ouvre, relu ; `null` s'il ne se lit plus. */
  readonly communityNotice?: CommunityNoticeView | null
  /**
   * Avis de décision de modération : la page porteuse quand le dossier est celui d'une
   * page dont je signe à la lecture (ses décisions), sinon `null` (« Mes données »).
   * Ni contenu, ni motif, ni modérateur.
   */
  readonly moderationDecision?: { readonly pageHandle: string | null }
  /** Avis d'une conversation de mise en relation : le fil, relu pour moi ; `null` s'il ne se lit plus. */
  readonly contextualThreadId?: string | null
}

/** Les non-lues, bornées : au-delà de 99, la cloche dit « 99+ ». */
export interface UnreadCountView {
  readonly count: number
  readonly capped: boolean
  readonly truncated?: boolean
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
