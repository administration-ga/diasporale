/**
 * L'interface de données de DIASPORALE — le « port » que l'interface consomme.
 *
 * Deux implémentations, une seule forme :
 *   · `demo` (aujourd'hui) — fournisseur FACTICE, en mémoire du navigateur,
 *     données de démonstration explicitement fictives, règles appliquées par
 *     `@diasporale/domain` ;
 *   · `engine` (au câblage du moteur, PD2/PD4) — les queries et mutations
 *     Convex du moteur ANTIA, bornées par `networkId = diasporale`.
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
  CountryHubView,
  ConsentView,
  Loadable,
  MemberHitView,
  PageDetailView,
  OpenCountryView,
  PostView,
  NotificationView,
  ProfileView,
  ReactionKind,
  RelationView,
  SessionView,
  SponsorDashboardView,
  UnreadCountView,
} from "./types"

import type { ActionErrorCode } from "./errors"

export type ActionResult<T = null> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: ActionErrorCode }

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

export interface PublishInput {
  readonly body: string
  readonly reach: Reach
  readonly country?: CountryCode
  readonly audience: "public" | "connections"
  /** « Publier aussi sur ANTIA » — geste explicite, ignoré hors audience publique. */
  readonly alsoOnRoot: boolean
}

export interface DiasporaleActions {
  signInWithIdn(input: IdnSignInInput): Promise<ActionResult>
  requestCode(destination: CodeDestination): Promise<ActionResult<{ demoCode: string | null }>>
  verifyCode(code: string): Promise<ActionResult>
  /** Révocation de toutes les sessions côté serveur, puis purge locale (EXT-DG-01). */
  signOutEverywhere(): Promise<void>
  checkHandle(handle: string): Promise<ActionResult<{ available: boolean }>>
  join(input: JoinInput): Promise<ActionResult<{ country: CountryCode }>>
  publish(input: PublishInput): Promise<ActionResult<{ moderation: ContentModerationState }>>
  react(postId: string, kind: ReactionKind | null): Promise<ActionResult>
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
  useSession(): Loadable<SessionView>
  useOpenCountries(): Loadable<readonly OpenCountryView[]>
  useCountryHub(country: CountryCode): Loadable<CountryHubView>
  useFeed(args: { scope: FeedScope; hubCountry?: CountryCode }): Loadable<readonly PostView[]>
  useProfile(handle: string): Loadable<ProfileView | null>
  /** Ma relation avec une personne (connexion, abonnement, mon blocage). */
  useRelation(personId: string): Loadable<RelationView>
  /**
   * L'annuaire opt-in : rien sous `MEMBER_SEARCH_MIN_LENGTH` caractères ; réservé
   * aux membres actifs ; le filtre de pays restreint, il n'ouvre jamais rien.
   */
  useMemberSearch(args: { query: string; country?: CountryCode }): Loadable<readonly MemberHitView[]>
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
