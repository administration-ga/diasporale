/**
 * Capacité « demandes de service » du port (DG-014/015) — demande, proposition
 * versionnée, rendez-vous, annulation, absence, réalisation. PROPRIÉTAIRE :
 * chantier « demandes et rendez-vous » (vague G1).
 *
 * Échange STRUCTURÉ (besoin, fenêtres souhaitées, proposition, réponses) : la
 * conversation libre attachée à une demande attend le canal générique du moteur
 * (P10 d'ANTSIA). Mise en relation seulement : aucun paiement, aucune
 * facturation ; un montant est ce que la page propose, en unités mineures.
 *
 * Deux fournisseurs, une forme : le moteur (`apps/diasporale_com/src/data/
 * engine-service-requests.ts`) et la démonstration (`demo/service-requests.ts`).
 * Les gestes rendent un code FERMÉ ; une demande d'autrui est introuvable.
 */
import {
  SERVICE_REQUEST_REFUSALS,
  type ServiceBookingStatus,
  type ServiceLocation,
  type ServiceProposalState,
  type ServiceRequestAction,
  type ServiceRequestActor,
  type ServiceRequestCloser,
  type ServiceRequestStatus,
  type ServiceWindow,
} from "@diasporale/domain"

import type { ActionResult } from "./port"
import type { Loadable } from "./types"

/** Codes de refus propres aux demandes (fragment `service-requests.json`) : ceux du domaine. */
export const SERVICE_REQUEST_ERROR_CODES = SERVICE_REQUEST_REFUSALS

/** Demandes par page de liste. */
export const SERVICE_REQUESTS_PAGE_SIZE = 20

export interface ServicePageLabelView {
  readonly pageId: string
  readonly handle: string
  readonly name: string
  readonly logoUrl: string | null
}

/** Le demandeur vu par l'équipe de la page, avec son consentement : nom publié, jamais une coordonnée. */
export interface ServiceRequesterView {
  readonly displayName: string | null
  readonly handle: string | null
}

export interface ServiceProposalSummaryView {
  readonly version: number
  readonly amountMinor: number
  readonly currency: string
  readonly startAt: number
  readonly endAt: number
  readonly timeZone: string
  readonly expiresAt: number
}

export interface ServiceBookingView {
  readonly startAt: number
  readonly endAt: number
  readonly timeZone: string
  readonly status: ServiceBookingStatus
}

export interface ServiceRequestSummaryView {
  readonly requestId: string
  /** L'état EFFECTIF lu par le fournisseur (expiration constatée). */
  readonly status: ServiceRequestStatus
  readonly offerId: string
  readonly offerTitle: string
  readonly offerVersion: number
  /** `null` : la page ne se lit plus d'ici. */
  readonly page: ServicePageLabelView | null
  /** Pour l'équipe de la page seulement ; `null` dans la vue du demandeur. */
  readonly requester: ServiceRequesterView | null
  readonly windows: readonly ServiceWindow[]
  /** Le fuseau du demandeur. */
  readonly timeZone: string
  readonly currentProposal: ServiceProposalSummaryView | null
  readonly booking: ServiceBookingView | null
  /** L'échéance qui court ; `null` après l'accord ou la clôture. */
  readonly deadlineAt: number | null
  readonly createdAt: number
  readonly updatedAt: number
}

export interface ServiceProposalView {
  readonly version: number
  readonly amountMinor: number
  readonly currency: string
  readonly durationMinutes: number
  readonly startAt: number
  readonly endAt: number
  readonly timeZone: string
  readonly location: ServiceLocation
  readonly details: string
  readonly cancellationTerms: string
  readonly expiresAt: number
  readonly state: ServiceProposalState
  readonly createdAt: number
}

export interface ServiceRequestEventView {
  readonly status: ServiceRequestStatus
  readonly at: number
  readonly version: number | null
}

export interface ServiceRequestDetailView extends ServiceRequestSummaryView {
  readonly viewerRole: ServiceRequestActor
  readonly need: string
  /** De la plus récente à la plus ancienne. */
  readonly proposals: readonly ServiceProposalView[]
  readonly timeline: readonly ServiceRequestEventView[]
  readonly closedBy: ServiceRequestCloser | null
  readonly closedReason: string | null
  /** Les gestes réellement ouverts à ce lecteur (calculés par le fournisseur). */
  readonly actions: readonly ServiceRequestAction[]
  /**
   * DG-015 : la contestation d'une absence par la personne qui demande, lisible des deux
   * côtés ; `null` (ou absente, fournisseur antérieur) : aucune contestation.
   */
  readonly noShowContest?: { readonly at: number; readonly reason: string } | null
  /** La personne qui demande peut contester l'absence maintenant (quatorze jours après le constat). */
  readonly canContestNoShow?: boolean
}

export interface ServiceRequestsPageView {
  readonly items: readonly ServiceRequestSummaryView[]
  readonly continueCursor: string | null
  readonly isDone: boolean
}

export type ServiceRequestsPageQuery = Loadable<ServiceRequestsPageView>

export interface SendServiceRequestInput {
  readonly offerId: string
  /** La version de l'offre LUE : une offre modifiée entre-temps est refusée. */
  readonly offerVersion: number
  readonly need: string
  readonly windows: readonly ServiceWindow[]
  readonly timeZone: string
  /** Consentement explicite à montrer son nom à l'équipe de la page. */
  readonly shareIdentityWithPage: boolean
  /** Stable pendant la vie de la feuille : un double envoi rend la même demande. */
  readonly idempotencyKey: string
}

export interface ProposeServiceInput {
  readonly requestId: string
  /** La version courante lue (zéro avant toute proposition). */
  readonly expectedVersion: number
  readonly amountMinor: number
  readonly currency: string
  readonly durationMinutes: number
  readonly startAt: number
  readonly timeZone: string
  readonly location: ServiceLocation
  readonly details: string
  readonly cancellationTerms: string
  readonly expiresAt: number
}

export interface ServiceRequestsCapability {
  /** Mes demandes, des plus récemment mises à jour. */
  useMyRequests(args: { readonly cursor: string | null }): ServiceRequestsPageQuery
  /** Les demandes reçues par une page que je gère, toutes (`status` à `null`) ou par état. */
  usePageRequests(args: { readonly pageId: string; readonly status: ServiceRequestStatus | null; readonly cursor: string | null }): ServiceRequestsPageQuery
  /** Une demande à laquelle je participe ; `null` : introuvable pour moi. */
  useRequest(requestId: string): Loadable<ServiceRequestDetailView | null>
  send(input: SendServiceRequestInput): Promise<ActionResult<{ readonly requestId: string; readonly created: boolean }>>
  propose(input: ProposeServiceInput): Promise<ActionResult<{ readonly version: number }>>
  refuse(input: { readonly requestId: string; readonly reason: string | null }): Promise<ActionResult>
  cancel(input: { readonly requestId: string; readonly reason: string | null }): Promise<ActionResult>
  accept(input: { readonly requestId: string; readonly expectedProposalVersion: number }): Promise<ActionResult<{ readonly bookingId: string }>>
  complete(requestId: string): Promise<ActionResult>
  markNoShow(requestId: string): Promise<ActionResult>
  /**
   * DG-015 : contester l'absence déclarée par la page, une seule fois, avec un motif ; rejouée,
   * elle rend la première (`created: false`). Facultative : un fournisseur qui ne la sert pas l'omet.
   */
  contestNoShow?(input: { readonly requestId: string; readonly reason: string }): Promise<ActionResult<{ readonly contestedAt: number; readonly created: boolean }>>
}
