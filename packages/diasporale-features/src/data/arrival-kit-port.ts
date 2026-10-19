/**
 * Capacité « kit d'arrivée » du port (DG-024 b, plan global DIASPORALE §4 G8 point 3).
 * PROPRIÉTAIRE : ce chantier. Facultative : un fournisseur qui ne la sert pas la laisse
 * absente, et l'écran le dit au lieu d'inventer.
 *
 * Des ressources pratiques DATÉES par pays et par ville, chacune avec sa source citée
 * et sa date de dernière vérification, publiées après la relecture d'une AUTRE
 * personne habilitée (membre vérifié, ou signataire vivant d'une page). Une ressource
 * « à revoir » reste lue, avec la raison de l'avertissement. Seule une page au badge
 * « Officiel » CALCULÉ par le fournisseur fait dire à une ressource qu'elle est
 * officielle (`official`). Les règles sont celles de `@diasporale/domain`
 * (arrival-kit), lues par les deux fournisseurs : le moteur (`engine-arrival-kit.ts`)
 * et la démonstration (`demo/arrival-kit.ts`).
 *
 * L'état de MODÉRATION du moteur (G9 : en relecture préalable, retirée), distinct du
 * cycle du kit, ne se dit qu'à qui gère la ressource (`moderation`, facultatif : un
 * fournisseur qui ne modère pas peut le taire).
 */
import {
  ARRIVAL_KIT_PAGE_SIZE,
  ARRIVAL_KIT_REFUSALS,
  type ArrivalKitCategory,
  type ArrivalKitOutdatedReason,
  type ArrivalKitReviewCause,
  type ArrivalKitReviewDecision,
  type ArrivalKitStatus,
  type CountryCode,
  type PageOwnerKind,
  type TrustBadge,
} from "@diasporale/domain"

import type { ManagedModerationState } from "./managed-moderation"
import type { ActionResult } from "./port"
import type { Loadable } from "./types"

/**
 * Codes de refus propres au chantier, traduits par `errors.<code>` dans son fragment :
 * les refus du domaine, rendus tels quels par le moteur (`appRule`) et par la
 * démonstration, et posés aussi par le formulaire.
 */
export const ARRIVAL_KIT_ERROR_CODES = [...ARRIVAL_KIT_REFUSALS] as const

/** Taille d'une fenêtre de liste (kit, file de relecture, mes propositions). */
export const ARRIVAL_KIT_LIST_PAGE_SIZE = ARRIVAL_KIT_PAGE_SIZE

/**
 * Les vues de l'écran du kit (`arrivalKit.tabs.<vue>`) : les ressources de la zone, mes
 * propositions, la file de relecture (relecteurs habilités seulement). Module pur : lu par
 * l'écran et par le cliquet des clés.
 */
export const ARRIVAL_KIT_VIEWS = ["resources", "mine", "review"] as const
export type ArrivalKitView = (typeof ARRIVAL_KIT_VIEWS)[number]

/** Les issues annoncées après un geste (`arrivalKit.feedback.<issue>`). */
export const ARRIVAL_KIT_FEEDBACK = [
  "proposedSubmitted",
  "proposedDraft",
  "savedSubmitted",
  "savedDraft",
  "submitted",
  "withdrawn",
  "published",
  "returned",
  "marked",
  "flagged",
] as const
export type ArrivalKitFeedbackKind = (typeof ARRIVAL_KIT_FEEDBACK)[number]

/** Une personne citée (auteur, relecteur) : son profil PUBLIÉ ; `displayName: null` = nom neutre. Aucune coordonnée. */
export interface ArrivalKitPersonLabel {
  readonly displayName: string | null
  readonly handle: string | null
}

/** La page qui porte une ressource : son identité publique et son badge CALCULÉ. */
export interface ArrivalKitPageLabel {
  readonly id: string
  readonly handle: string
  readonly name: string
  readonly badge: TrustBadge
  readonly ownerKind: PageOwnerKind
}

/** Qui porte la ressource : une personne (ressource communautaire), ou une page. */
export type ArrivalKitCarrierView =
  | { readonly kind: "person"; readonly person: ArrivalKitPersonLabel }
  | { readonly kind: "page"; readonly page: ArrivalKitPageLabel }

/** La carte d'une ressource : le kit public, la file de relecture, « Mes propositions ». */
export interface ArrivalKitResourceCardView {
  readonly id: string
  /** La version lue de la ressource : tout geste la cite. */
  readonly version: number
  /** La version du contenu : un signalement la cite. */
  readonly revision: number
  readonly title: string
  readonly summary: string
  readonly category: ArrivalKitCategory
  readonly country: CountryCode
  /** `null` : la ressource vaut pour tout le pays. */
  readonly city: string | null
  /** L'état EFFECTIF (ancienneté et signalements compris). */
  readonly status: ArrivalKitStatus
  /** Pourquoi « à revoir » ; `null` sinon. */
  readonly reviewCause: ArrivalKitReviewCause | null
  readonly lastVerifiedAt: number
  /** À partir de quand la vérification ne vaut plus (douze mois). */
  readonly reviewDueAt: number
  readonly revisedAt: number
  readonly reviewedAt: number | null
  readonly carrier: ArrivalKitCarrierView
  /** Vrai SEULEMENT si la page qui porte la ressource a le badge « Officiel » calculé. */
  readonly official: boolean
}

/** Ce que la personne peut faire de la ressource, jugé par le fournisseur. */
export interface ArrivalKitViewerRights {
  readonly canManage: boolean
  readonly canReview: boolean
  readonly canFlag: boolean
  readonly hasFlagged: boolean
}

export interface ArrivalKitResourceDetailView extends ArrivalKitResourceCardView {
  readonly body: string
  /** La source citée ; `url: null` pour une source fictive de démonstration (aucun lien). */
  readonly source: { readonly name: string; readonly url: string | null }
  readonly createdAt: number
  readonly submittedAt: number | null
  /** Qui a relu et publié la version courante (publiée ou à revoir seulement). */
  readonly reviewer: ArrivalKitPersonLabel | null
  /** Le motif d'un renvoi ou d'une mise « à revoir » : pour qui gère ou relit seulement. */
  readonly statusReason: string | null
  /** Signalements sur la version courante : pour qui gère ou relit seulement. */
  readonly outdatedFlags: number | null
  /**
   * L'état de modération du moteur (G9), distinct du cycle du kit : pour qui GÈRE la
   * ressource seulement ; absent pour tout autre lecteur, relecteur compris.
   */
  readonly moderation?: ManagedModerationState
  readonly viewer: ArrivalKitViewerRights
}

/** Une ressource soumise, dans la file de relecture de son pays. */
export interface ArrivalKitQueueItemView extends ArrivalKitResourceCardView {
  readonly submittedAt: number
}

/** Une de « Mes propositions » : l'état, et le motif, les signalements et l'état de modération si je la gère. */
export interface ArrivalKitOwnItemView extends ArrivalKitResourceCardView {
  readonly statusReason: string | null
  readonly outdatedFlags: number | null
  /** L'état de modération du moteur (G9), si je gère la ressource ; absent sinon. */
  readonly moderation?: ManagedModerationState
}

export interface ArrivalKitListPage<T> {
  readonly items: readonly T[]
  /** `null` : rien après cette fenêtre. */
  readonly continueCursor: string | null
  readonly isDone: boolean
}

/** Une lecture du kit public : un pays, une ville saisie (sans GPS) ou tout le pays, une rubrique. */
export interface ArrivalKitListRequest {
  readonly country: CountryCode
  /** Ville saisie ; `null` : tout le pays. */
  readonly city: string | null
  /** Sans ville : ne garder que les ressources valables dans tout le pays. */
  readonly nationalOnly: boolean
  readonly category: ArrivalKitCategory | null
  readonly cursor: string | null
}

/** Ce que je peux faire dans le kit, et au nom de quelles pages je peux proposer. */
export interface ArrivalKitStandingView {
  readonly canPropose: boolean
  readonly canReview: boolean
  readonly carrierPages: readonly ArrivalKitPageLabel[]
}

/** Une version saisie par le formulaire ; le fournisseur la rejuge par la règle du domaine. */
export interface ArrivalKitResourceInputView {
  readonly title: string
  readonly summary: string
  readonly body: string
  readonly category: ArrivalKitCategory
  readonly country: CountryCode
  /** Vide : la ressource vaut pour tout le pays. */
  readonly city: string
  readonly sourceName: string
  readonly sourceUrl: string
  /** Date de dernière vérification auprès de la source (ms UTC, minuit du jour choisi). */
  readonly lastVerifiedAt: number
}

export interface ArrivalKitCapability {
  /** Ce que je peux faire dans le kit (proposer, relire) et mes pages porteuses. */
  useStanding(): Loadable<ArrivalKitStandingView>
  /** Le kit public d'une zone, les plus récemment vérifiées d'abord. */
  useResources(request: ArrivalKitListRequest): Loadable<ArrivalKitListPage<ArrivalKitResourceCardView>>
  /** La fiche d'une ressource ; `null` : inconnue, retirée ou non lisible par moi (une seule réponse). */
  useResource(resourceId: string): Loadable<ArrivalKitResourceDetailView | null>
  /** « Mes propositions », les plus récemment changées d'abord. */
  useMyResources(args: { readonly cursor: string | null }): Loadable<ArrivalKitListPage<ArrivalKitOwnItemView>>
  /** La file de relecture d'un pays — refus `arrival_kit_reviewer_not_eligible` hors des relecteurs habilités. */
  useReviewQueue(args: { readonly country: CountryCode; readonly cursor: string | null }): Loadable<ArrivalKitListPage<ArrivalKitQueueItemView>>
  /** Proposer une ressource, en mon nom (`pageId: null`) ou au nom d'une page ; brouillon, ou soumise aussitôt. */
  propose(input: ArrivalKitResourceInputView & { readonly pageId: string | null; readonly submit: boolean }): Promise<ActionResult<{ readonly resourceId: string }>>
  /** Une nouvelle version, à la version lue : elle repasse par la relecture (soumise) ou reste un brouillon. */
  update(input: ArrivalKitResourceInputView & { readonly resourceId: string; readonly expectedVersion: number; readonly submit: boolean }): Promise<ActionResult>
  /** Soumettre un brouillon tel quel. */
  submit(input: { readonly resourceId: string; readonly expectedVersion: number }): Promise<ActionResult>
  /** Retirer ma ressource : archivée, terminale. */
  withdraw(input: { readonly resourceId: string; readonly expectedVersion: number }): Promise<ActionResult>
  /** Relire une version soumise : la publier, ou la renvoyer (motif obligatoire). */
  review(input: { readonly resourceId: string; readonly expectedVersion: number; readonly decision: ArrivalKitReviewDecision; readonly reason: string }): Promise<ActionResult>
  /** Marquer « à revoir » une ressource publiée (motif obligatoire). */
  markForReview(input: { readonly resourceId: string; readonly expectedVersion: number; readonly reason: string }): Promise<ActionResult>
  /** Signaler une information périmée sur la version lue, une fois, motif fermé. */
  flagOutdated(input: { readonly resourceId: string; readonly revision: number; readonly reason: ArrivalKitOutdatedReason }): Promise<ActionResult>
}
