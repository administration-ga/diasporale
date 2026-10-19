/**
 * Capacité « talents et emploi » du port (DG-025, plan global DIASPORALE §G8
 * point 4). PROPRIÉTAIRE : ce chantier. Facultative : un fournisseur qui ne la
 * sert pas la laisse absente, et l'écran le dit au lieu d'inventer.
 *
 * Trois objets, trois frontières (les mêmes règles de part et d'autre, celles
 * de `@diasporale/domain`, module des emplois) :
 *   · les OFFRES des pages d'entreprise et d'association, ouvertes à la lecture
 *     du réseau, gérées par les signataires vivants de leur page ;
 *   · les CANDIDATURES, privées : la personne qui candidate et l'équipe de la
 *     page, personne d'autre ; le motif de non-sélection reste à l'équipe ;
 *   · les PROFILS DE TALENT, opt-in et révocables, cherchés par pays et
 *     compétence, sans coordonnée ni nom complet : le contact passera par la
 *     messagerie, jamais par une adresse affichée.
 *
 * Deux fournisseurs, une forme : le moteur (`convex/modules/diaspora/jobs.ts`)
 * et la démonstration (`demo/jobs.ts`, offres et talents fictifs).
 *
 * Confiance (G9) : les seules vues de GESTION portent l'état de modération
 * (`moderation`, facultatif) — les offres pour l'équipe vivante de leur page, la
 * candidature et le profil de talent pour leur personne propriétaire. Absent :
 * publié, ou fournisseur qui ne modère pas (la démonstration).
 */
import {
  JOB_REFUSALS,
  MONEY_REFUSALS,
  type CountryCode,
  type JobApplicationAction,
  type JobApplicationStatus,
  type JobLanguageCode,
  type JobOfferContract,
  type JobOfferStatus,
  type JobOfferStatusTarget,
  type JobPayRangeLike,
  type JobWorkMode,
  type PageOwnerKind,
  type TalentAvailability,
  type TalentProfileStatus,
  type TalentVisibility,
  type TrustBadge,
} from "@diasporale/domain"

import type { ManagedModerationState } from "./managed-moderation"
import type { ActionResult } from "./port"
import type { Loadable } from "./types"

/** Les refus posés par les seuls formulaires du chantier, avant tout envoi. */
export const JOB_FORM_ERROR_CODES = [
  /** Créer un profil de talent est un geste explicite : la case d'accord n'est jamais cochée d'avance. */
  "talent_opt_in_required",
] as const

/**
 * Codes de refus propres au chantier, traduits par `errors.<code>` dans son
 * fragment de locale ; les montants (`MONEY_REFUSALS`) gardent la phrase posée
 * par le catalogue des services.
 */
export const JOB_ERROR_CODES = [...JOB_REFUSALS, ...MONEY_REFUSALS, ...JOB_FORM_ERROR_CODES] as const

/** Taille d'une fenêtre de recherche d'offres (le moteur plafonne à vingt). */
export const JOB_RESULTS_PAGE_SIZE = 12
/** Taille d'une fenêtre de candidatures (les miennes, ou celles d'une offre). */
export const JOB_APPLICATIONS_PAGE_SIZE = 20
/** Taille d'une fenêtre d'offres gérées. */
export const MANAGED_JOBS_PAGE_SIZE = 20
/** Taille d'une fenêtre de talents (le moteur plafonne à douze : on affine, on ne parcourt pas). */
export const TALENT_RESULTS_PAGE_SIZE = 12

/** Une fenêtre de résultats : curseur opaque du fournisseur, fin distincte d'une page vide. */
export interface JobsPage<Row> {
  readonly items: readonly Row[]
  readonly continueCursor: string
  readonly isDone: boolean
}

/** La page qui recrute : sa carte publique, badge CALCULÉ par le serveur. Aucun signataire. */
export interface JobEmployerView {
  readonly id: string
  readonly handle: string
  readonly name: string
  readonly ownerKind: PageOwnerKind
  readonly badge: TrustBadge
  readonly logoUrl: string | null
}

/** Une offre dans les résultats. Aucune coordonnée : on candidate sur DIASPORALE. */
export interface JobOfferCardView {
  readonly id: string
  /** La version lue : une candidature la cite, une modification l'attend. */
  readonly version: number
  readonly title: string
  readonly description: string
  readonly contract: JobOfferContract
  readonly country: CountryCode
  readonly city: string | null
  readonly workMode: JobWorkMode
  readonly languages: readonly string[]
  /** Fourchette ANNONCÉE par la page, en unités mineures ; `null` : non communiquée. */
  readonly payRange: JobPayRangeLike | null
  /** Date limite des candidatures ; `null` : sans date limite. */
  readonly closesAt: number | null
  readonly publishedAt: number
  readonly updatedAt: number
  readonly employer: JobEmployerView
}

/** La fiche d'une offre : sa carte, son état effectif, la gestion et MA candidature. */
export interface JobOfferDetailView extends JobOfferCardView {
  readonly status: JobOfferStatus
  /** Signataire vivant de la page : il voit l'offre dans tous ses états et la gère. */
  readonly viewerCanManage: boolean
  /** G9 : l'état de modération de l'offre, pour l'équipe vivante seulement (`viewerCanManage`) ; absent pour tout autre lecteur. */
  readonly moderation?: ManagedModerationState
  /** Ma candidature à cette offre, si j'en ai une. */
  readonly myApplication: { readonly id: string; readonly status: JobApplicationStatus } | null
}

/** Le profil de talent joint à une candidature, relu vivant (masqué ou supprimé : absent). */
export interface JobTalentSummaryView {
  readonly title: string
  readonly skills: readonly string[]
  readonly availability: TalentAvailability
  readonly languages: readonly string[]
  readonly country: CountryCode
}

/** Ma candidature, vue par moi : jamais le motif de l'équipe, jamais qui a décidé. */
export interface MyJobApplicationView {
  readonly id: string
  readonly status: JobApplicationStatus
  readonly jobId: string
  /** Le titre de l'offre lu au moment de candidater. */
  readonly offerTitle: string
  readonly offerVersion: number
  /** L'offre reçoit-elle encore des candidatures ? */
  readonly offerOpen: boolean
  /** La page, si elle se lit encore ; `null` sinon. */
  readonly employer: JobEmployerView | null
  readonly message: string
  readonly sharedTalentProfile: boolean
  readonly createdAt: number
  readonly updatedAt: number
  /** Les gestes ouverts maintenant (calculés par le fournisseur). */
  readonly actions: readonly JobApplicationAction[]
  /** G9 : l'état de modération de MA candidature ; l'équipe de la page ne le voit jamais. */
  readonly moderation?: ManagedModerationState
}

/** Une candidature reçue par l'équipe de la page : retirée, il n'en reste que l'état. */
export interface ReceivedJobApplicationView {
  readonly id: string
  readonly jobId: string
  readonly status: JobApplicationStatus
  readonly offerVersion: number
  /** Nom publié (consentement explicite) ; `null` : candidature retirée. */
  readonly candidate: { readonly displayName: string | null; readonly handle: string | null } | null
  readonly message: string | null
  readonly talentProfile: JobTalentSummaryView | null
  /** La note de l'équipe ; jamais montrée à la personne qui candidate. */
  readonly notSelectedReason: string | null
  readonly createdAt: number
  readonly updatedAt: number
  readonly actions: readonly JobApplicationAction[]
}

/** Mon profil de talent, tel que je le vois (et moi seul). */
export interface OwnTalentProfileView {
  readonly id: string
  readonly title: string
  readonly skills: readonly string[]
  readonly availability: TalentAvailability
  readonly languages: readonly string[]
  readonly country: CountryCode
  readonly visibility: TalentVisibility
  readonly status: TalentProfileStatus
  readonly version: number
  readonly createdAt: number
  readonly updatedAt: number
  /** G9 : l'état de modération de mon profil. */
  readonly moderation?: ManagedModerationState
}

/** Un talent trouvé : nom COURT, compétences DÉCLARÉES ; aucune coordonnée, aucun identifiant de personne. */
export interface TalentHitView {
  readonly id: string
  readonly shortName: string
  readonly title: string
  readonly skills: readonly string[]
  readonly availability: TalentAvailability
  readonly languages: readonly string[]
  readonly country: CountryCode
  readonly updatedAt: number
}

export interface JobSearchRequest {
  readonly query?: string
  readonly country?: CountryCode
  readonly city?: string
  readonly contract?: JobOfferContract
  readonly workMode?: JobWorkMode
  readonly cursor: string | null
}

export interface TalentSearchRequest {
  /** Obligatoire : une recherche bornée à un pays. */
  readonly country: CountryCode
  readonly skill?: string
  readonly cursor: string | null
}

/** La saisie d'une offre, telle que le formulaire la rend ; le domaine la juge. */
export interface JobOfferInputView {
  readonly title: string
  readonly description: string
  readonly contract: JobOfferContract
  readonly country: CountryCode
  readonly city: string | null
  readonly workMode: JobWorkMode
  readonly languages: readonly JobLanguageCode[]
  readonly payRange: JobPayRangeLike | null
  readonly closesAt: number | null
}

/** La candidature saisie : message, consentement explicite, choix de joindre son profil. */
export interface JobApplicationInputView {
  readonly jobId: string
  readonly offerVersion: number
  readonly message: string
  readonly shareName: boolean
  readonly shareTalentProfile: boolean
  /** Idempotence : la même clé rejouée (réseau coupé, double envoi) rend la même candidature. */
  readonly idempotencyKey: string
}

/** La saisie d'un profil de talent. */
export interface TalentProfileInputView {
  readonly title: string
  readonly skills: readonly string[]
  readonly availability: TalentAvailability
  readonly languages: readonly JobLanguageCode[]
  readonly country: CountryCode
  readonly visibility: TalentVisibility
}

export interface JobsCapability {
  // ── Offres ────────────────────────────────────────────────────────────
  /** Les offres OUVERTES du réseau, de pages lisibles, filtrées. */
  useSearch(request: JobSearchRequest): Loadable<JobsPage<JobOfferCardView>>
  /** Une offre ; `null` : indisponible pour ce lecteur (inconnue, suspendue, close, échue — même réponse). */
  useOffer(jobId: string): Loadable<JobOfferDetailView | null>
  /** Les offres d'une page que je gère, dans tous leurs états. */
  usePageOffers(request: { readonly pageId: string; readonly status?: JobOfferStatus; readonly cursor: string | null }): Loadable<JobsPage<JobOfferDetailView>>
  createOffer(input: JobOfferInputView & { readonly pageId: string; readonly publish: boolean }): Promise<ActionResult<{ jobId: string; version: number; status: JobOfferStatus }>>
  /** Modifier une offre : la version lue est exigée (`job_offer_version_conflict` sinon). */
  updateOffer(input: JobOfferInputView & { readonly jobId: string; readonly expectedVersion: number }): Promise<ActionResult<{ version: number }>>
  /** Ouvrir, suspendre, reprendre, clore ; l'état déjà courant ne change rien. */
  setOfferStatus(input: { readonly jobId: string; readonly expectedVersion: number; readonly status: JobOfferStatusTarget }): Promise<ActionResult<{ status: JobOfferStatus; version: number }>>

  // ── Candidatures ──────────────────────────────────────────────────────
  apply(input: JobApplicationInputView): Promise<ActionResult<{ applicationId: string; created: boolean }>>
  /** Retirer MA candidature : définitif. */
  withdraw(applicationId: string): Promise<ActionResult<{ status: JobApplicationStatus }>>
  useMyApplications(request: { readonly cursor: string | null }): Loadable<JobsPage<MyJobApplicationView>>
  /** Les candidatures d'une offre de ma page ; signataire vivant seulement. */
  useOfferApplications(request: { readonly jobId: string; readonly status?: JobApplicationStatus; readonly cursor: string | null }): Loadable<JobsPage<ReceivedJobApplicationView>>
  markSeen(applicationId: string): Promise<ActionResult<{ status: JobApplicationStatus }>>
  shortlist(applicationId: string): Promise<ActionResult<{ status: JobApplicationStatus }>>
  /** Ne pas retenir, motif facultatif (note de l'équipe, jamais montrée à la personne). */
  markNotSelected(input: { readonly applicationId: string; readonly reason: string | null }): Promise<ActionResult<{ status: JobApplicationStatus }>>

  // ── Profils de talent ─────────────────────────────────────────────────
  useMyTalentProfile(): Loadable<OwnTalentProfileView | null>
  /** Créer (`expectedVersion: null`) ou modifier (version lue) MON profil. */
  saveTalentProfile(input: TalentProfileInputView & { readonly expectedVersion: number | null }): Promise<ActionResult<{ id: string; version: number }>>
  /** Masquer ou réactiver MON profil. */
  setTalentProfileStatus(input: { readonly status: TalentProfileStatus; readonly expectedVersion: number }): Promise<ActionResult<{ status: TalentProfileStatus; version: number }>>
  /** Supprimer MON profil : la révocation complète. */
  removeTalentProfile(): Promise<ActionResult>
  /** Les talents actifs et visibles d'un pays, page par page. */
  useTalentSearch(request: TalentSearchRequest): Loadable<JobsPage<TalentHitView>>
}
