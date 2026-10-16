/**
 * L'interface de données de DIASPORALE — le « port » que l'interface consomme.
 *
 * Deux implémentations, une seule forme :
 *   · `demo` (aujourd'hui) — fournisseur FACTICE, en mémoire du navigateur,
 *     données de démonstration explicitement fictives, règles appliquées par
 *     `@diasporale/domain` ;
 *   · `engine` (au câblage du moteur, PD2/PD4) — les queries et mutations
 *     Convex du moteur ANTSIA, bornées par `networkId = diasporale`.
 *
 * Les lectures sont des HOOKS (comme `useQuery` de Convex : réactives, d'abord
 * « en chargement ») ; les écritures sont des actions qui rendent un résultat
 * à code FERMÉ (traduit par `errors.<code>`), jamais une exception à l'écran.
 */
import type {
  AttestationOutcome,
  ConsentPurpose,
  ContentModerationState,
  CountryCode,
  DirectoryVisibility,
  FacetInput,
  FeedScope,
  OnboardingConsentChoices,
  Reach,
} from "@diasporale/domain"

import type {
  BookmarkView,
  CommentThreadView,
  CommentView,
  CountryHubView,
  ConsentView,
  FeedPageQuery,
  FeedPageRequest,
  Loadable,
  MemberHitView,
  PageDetailView,
  OpenCountryView,
  PostView,
  NotificationView,
  ProfileImageView,
  ProfileView,
  ProfilePostsPageRequest,
  ReactionKind,
  RelationView,
  ReportReason,
  SessionView,
  SponsorDashboardView,
  SuggestionView,
  UnreadCountView,
} from "./types"

import type { ActionErrorCode } from "./errors"

export type ActionResult<T = null> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: ActionErrorCode }

/** Images du profil commun aux réseaux ; la personne authentifiée est seule propriétaire. */
export type ProfileImageUsage = "avatar" | "cover"

export interface ProfileImagesActions {
  set(usage: ProfileImageUsage, file: File): Promise<ActionResult<ProfileImageView>>
  /** Retire la référence de l'image, sans effacer le profil ni le fichier stocké. */
  clear(usage: ProfileImageUsage): Promise<ActionResult<ProfileImageView>>
}

/** Ce qu'IDN rend au retour OIDC (simulé en démonstration). */
export interface IdnSignInInput {
  readonly firstName: string
  readonly lastName: string
  readonly loa: number
  readonly gaboneseNationality: boolean | null
}

export interface CodeDestination {
  readonly kind: "email" | "phone"
  readonly value: string
}

/** Les trois écrans de l'onboarding (EXF-DG-02), en une seule écriture. */
export interface JoinInput {
  readonly facet: FacetInput
  readonly handle: string
  readonly displayName: string
  readonly consents: OnboardingConsentChoices
  readonly directoryVisibility: DirectoryVisibility
}

/**
 * Un fichier déposé, prêt à rejoindre une publication. `ref` est opaque pour
 * l'écran (identifiant de stockage du moteur, ou clé de la démonstration) ; un
 * dépôt ne publie rien tant qu'une publication ne l'embarque pas.
 */
export interface UploadedMedia {
  readonly ref: string
  readonly kind: "image" | "video"
  readonly mimeType: string
  readonly sizeBytes: number
  readonly width?: number
  readonly height?: number
  readonly durationMs?: number
}

export interface PublishMediaInput {
  readonly upload: UploadedMedia
  /** Texte alternatif : ce que la personne qui ne voit pas l'image doit en savoir. */
  readonly altText: string
}

export interface PublishInput {
  /** Facultatif dès qu'un média porte la publication (une photo sans légende est légitime). */
  readonly body: string
  readonly reach: Reach
  readonly country?: CountryCode
  readonly audience: "public" | "connections"
  /** « Publier aussi sur ANTSIA » — geste explicite, ignoré hors audience publique. */
  readonly alsoOnRoot: boolean
  /** Quatre photos au plus, ou une vidéo seule, dans l'ordre choisi. */
  readonly media?: readonly PublishMediaInput[]
  /**
   * Partage cité : la publication citée (publique et publiée). Un partage ne
   * joint aucun média (il montre ceux de l'original) ; son texte est facultatif.
   */
  readonly sharedPostId?: string
  /**
   * Idempotence (EXF-DG-10) : la même clé rejouée (réseau coupé, double envoi)
   * rend la publication déjà créée au lieu d'en créer une seconde.
   */
  readonly idempotencyKey?: string
}

/** Commenter une publication ; une réponse à une réponse rejoint sa racine (un seul niveau). */
export interface CommentInput {
  readonly postId: string
  readonly body: string
  readonly parentCommentId?: string
}

/** Signaler une publication : un motif parmi six, une précision facultative. */
export interface ReportInput {
  readonly postId: string
  readonly reason: ReportReason
  readonly note?: string
}

export interface DiasporaleActions {
  signInWithIdn(input: IdnSignInInput): Promise<ActionResult>
  requestCode(destination: CodeDestination): Promise<ActionResult<{ demoCode: string | null }>>
  verifyCode(code: string): Promise<ActionResult>
  /** Révocation de toutes les sessions côté serveur, puis purge locale (EXT-DG-01). */
  signOutEverywhere(): Promise<void>
  checkHandle(handle: string): Promise<ActionResult<{ available: boolean }>>
  join(input: JoinInput): Promise<ActionResult<{ country: CountryCode }>>
  /** Déposer une photo ou une vidéo avant de publier ; les règles du moteur jugent le fichier d'abord. */
  uploadMedia(file: File): Promise<ActionResult<UploadedMedia>>
  publish(input: PublishInput): Promise<ActionResult<{ moderation: ContentModerationState }>>
  react(postId: string, kind: ReactionKind | null): Promise<ActionResult>
  /** Commenter ou répondre (EXF-DG-12) ; l'auteur de la publication et la personne à qui l'on répond sont avisés. */
  comment(input: CommentInput): Promise<ActionResult>
  /** Retirer un commentaire — le sien, ou n'importe lequel sous sa propre publication. */
  removeComment(commentId: string): Promise<ActionResult>
  /** Enregistrer une publication, ou la retirer des enregistrements (signet, privé). */
  toggleBookmark(postId: string): Promise<ActionResult<{ bookmarked: boolean }>>
  /** Ne plus voir une publication — pour soi seulement. */
  hidePost(postId: string): Promise<ActionResult>
  /** Mettre un auteur en sourdine : ses publications quittent mes fils, sans qu'il l'apprenne. */
  muteAuthor(personId: string): Promise<ActionResult>
  /** Signaler une publication ; elle est aussitôt masquée pour la personne qui signale. */
  reportPost(input: ReportInput): Promise<ActionResult>
  /** Retirer MA publication, partout où elle est lue. */
  removePost(postId: string): Promise<ActionResult>
  /** Modifier le texte de MA publication ; la carte dira « modifiée ». */
  editPost(postId: string, body: string): Promise<ActionResult>
  /** « Ne plus me proposer » : un choix privé, réversible, que l'autre n'apprend pas. */
  dismissSuggestion(handle: string): Promise<ActionResult>
  /** Demander une connexion. Un blocage, dans un sens ou dans l'autre, rend la même réponse, sans rien écrire. */
  connect(personId: string): Promise<ActionResult>
  /** Répondre à une demande reçue (le destinataire seul). */
  respondToConnection(connectionId: string, accept: boolean): Promise<ActionResult>
  follow(handle: string): Promise<ActionResult>
  unfollow(personId: string): Promise<ActionResult>
  /** Bloquer : la relation et les abonnements de la paire tombent, partout. */
  block(personId: string): Promise<ActionResult>
  unblock(personId: string): Promise<ActionResult>
  /** Marquer un avis lu (destinataire seul) ; tout marquer lu. */
  markNotificationRead(notificationId: string): Promise<ActionResult>
  markAllNotificationsRead(): Promise<ActionResult>
  sponsor(handle: string): Promise<ActionResult>
  revokeSponsorship(sponsorshipId: string): Promise<ActionResult>
  requestAttestation(): Promise<ActionResult<{ outcome: AttestationOutcome }>>
  setConsent(purpose: ConsentPurpose, granted: boolean): Promise<ActionResult>
  updateFacet(input: FacetInput): Promise<ActionResult>
  setDirectoryVisibility(level: DirectoryVisibility): Promise<ActionResult>
  exportMyData(): Promise<ActionResult<string>>
  deleteMyAccount(): Promise<ActionResult>
}

export interface DemoAccountView {
  readonly personId: string
  readonly displayName: string
  readonly handle: string | null
  readonly descriptionKey: string
  readonly current: boolean
}

/** Commandes réservées au mode démonstration (comptes fictifs, remise à zéro). */
export interface DemoControls {
  useAccounts(): Loadable<readonly DemoAccountView[]>
  switchTo(personId: string): Promise<void>
  reset(): Promise<void>
}

export interface DiasporaleDataSource {
  readonly kind: "demo" | "engine"
  /** Disponible seulement si le fournisseur sait gérer les images du profil commun. */
  readonly profileImages?: ProfileImagesActions | null
  useSession(): Loadable<SessionView>
  useOpenCountries(): Loadable<readonly OpenCountryView[]>
  useCountryHub(country: CountryCode): Loadable<CountryHubView>
  useFeed(args: { scope: FeedScope; hubCountry?: CountryCode }): Loadable<readonly PostView[]>
  /** Une fenêtre du même fil, avec son curseur serveur et sa reprise indépendante. */
  useFeedPage(args: FeedPageRequest): FeedPageQuery
  useProfile(handle: string): Loadable<ProfileView | null>
  /** Le mur gardé du profil, paginé indépendamment de sa fiche. */
  useProfilePostsPage(args: ProfilePostsPageRequest): FeedPageQuery
  /** Ma relation avec une personne (connexion, abonnement, mon blocage). */
  useRelation(personId: string): Loadable<RelationView>
  /**
   * L'annuaire opt-in : rien sous `MEMBER_SEARCH_MIN_LENGTH` caractères ; réservé
   * aux membres actifs ; le filtre de pays restreint, il n'ouvre jamais rien.
   */
  useMemberSearch(args: { query: string; country?: CountryCode }): Loadable<readonly MemberHitView[]>
  /** Une publication seule ; `null` : introuvable ou illisible pour ce lecteur (même réponse). */
  usePost(postId: string): Loadable<PostView | null>
  /** Mes signets, du plus récent ; une publication devenue illisible disparaît de la liste. */
  useBookmarks(): Loadable<readonly BookmarkView[]>
  /** Des membres à rencontrer (EXF-DG-18) : six au plus, réservées aux membres actifs. */
  useSuggestions(): Loadable<readonly SuggestionView[]>
  /** Les commentaires d'une publication, des plus anciens aux plus récents, avec leurs premières réponses. */
  useComments(postId: string): Loadable<readonly CommentThreadView[]>
  /** Toutes les réponses d'une racine (`commentId` à `null` : rien à lire). */
  useReplies(args: { postId: string; commentId: string | null }): Loadable<readonly CommentView[]>
  /** La cloche : les avis les plus récents, et le compte des non-lus. */
  useNotifications(): Loadable<readonly NotificationView[]>
  useUnreadCount(): Loadable<UnreadCountView>
  usePage(handle: string): Loadable<PageDetailView | null>
  useHandleSuggestions(displayName: string): readonly string[]
  useSponsorDashboard(): Loadable<SponsorDashboardView>
  useMyConsents(): Loadable<readonly ConsentView[]>
  readonly actions: DiasporaleActions
  readonly demo: DemoControls | null
}
