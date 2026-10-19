/**
 * Capacité « services » du port (DG-011/012) — catalogue des offres des pages
 * professionnelles, recherche bornée au réseau, gestion des offres dans « Mon
 * activité ». PROPRIÉTAIRE : chantier « catalogue des services » (vague G1).
 *
 * Mise en relation seulement : aucun paiement, aucun lien vers un autre
 * produit, aucun vocabulaire de vente (conditions de la session ANTSIA, 18/10).
 * Un tarif est ANNONCÉ par le professionnel ; le contact passe par la demande
 * structurée, jamais par une coordonnée.
 *
 * Deux fournisseurs, une forme : le moteur (`convex/modules/diaspora/services.ts`)
 * et la démonstration (`demo/services.ts`, offres fictives). Les règles sont
 * celles du domaine (`@diasporale/domain`, module des services) des deux côtés.
 */
import {
  MONEY_REFUSALS,
  SERVICE_REFUSALS,
  type CountryCode,
  type Money,
  type PageOwnerKind,
  type ServiceBudgetFit,
  type ServiceCategory,
  type ServiceDeliveryFilter,
  type ServiceDeliveryMode,
  type ServiceLanguageCode,
  type ServiceOfferStatus,
  type ServiceOfferStatusTarget,
  type ServicePricingLike,
  type TrustBadge,
} from "@diasporale/domain"

import type { ActionResult } from "./port"
import type { Loadable } from "./types"

/** Codes de refus propres au catalogue, traduits par `errors.<code>` (fragment de locale du catalogue). */
export const SERVICE_ERROR_CODES = [...SERVICE_REFUSALS, ...MONEY_REFUSALS] as const

/** La page qui propose : sa carte publique, badge CALCULÉ par le serveur. Aucun signataire. */
export interface ServiceProviderView {
  readonly id: string
  readonly handle: string
  readonly name: string
  readonly ownerKind: PageOwnerKind
  readonly badge: TrustBadge
  readonly logoUrl: string | null
}

/** Une offre dans le catalogue. Aucune coordonnée, aucune note ni avis. */
export interface ServiceOfferCardView {
  readonly id: string
  /** La version lue : une demande la cite, une modification l'attend. */
  readonly version: number
  readonly title: string
  readonly description: string
  readonly category: ServiceCategory
  readonly country: CountryCode
  readonly city: string
  readonly delivery: ServiceDeliveryMode
  readonly languages: readonly string[]
  readonly durationMinutes: number | null
  /** Le tarif ANNONCÉ par le professionnel ; la plateforme n'encaisse rien. */
  readonly pricing: ServicePricingLike
  readonly provider: ServiceProviderView
  /** Ce que le budget demandé dit de l'offre ; `null` sans budget. */
  readonly budgetFit: ServiceBudgetFit | null
  readonly updatedAt: number
}

/** La fiche d'une offre : sa carte, son état, et si le lecteur peut la gérer. */
export interface ServiceOfferDetailView extends ServiceOfferCardView {
  readonly status: ServiceOfferStatus
  /** Signataire vivant de la page : il voit l'offre dans tous ses états et la gère. */
  readonly viewerCanManage: boolean
}

/** Une fenêtre de résultats : curseur opaque du fournisseur, fin distincte d'une page vide. */
export interface ServiceOffersPage<Row> {
  readonly items: readonly Row[]
  readonly continueCursor: string
  readonly isDone: boolean
}

export interface ServiceSearchRequest {
  readonly query?: string
  readonly country?: CountryCode
  readonly city?: string
  readonly category?: ServiceCategory
  readonly delivery?: ServiceDeliveryFilter
  /** Budget maximal, en unités mineures d'une devise. */
  readonly budget?: Money
  readonly cursor: string | null
}

/** Taille d'une fenêtre de résultats demandée au fournisseur (le moteur plafonne à vingt). */
export const SERVICE_RESULTS_PAGE_SIZE = 12
/** Taille d'une fenêtre de « mes offres ». */
export const MANAGED_OFFERS_PAGE_SIZE = 20

/** La saisie d'une offre, telle que le formulaire la rend ; le domaine la juge. */
export interface ServiceOfferInputView {
  readonly title: string
  readonly description: string
  readonly category: ServiceCategory
  readonly country: CountryCode
  readonly city: string
  readonly delivery: ServiceDeliveryMode
  readonly languages: readonly ServiceLanguageCode[]
  readonly durationMinutes: number | null
  readonly pricing: ServicePricingLike
}

export interface ServicesCapability {
  /** Le fournisseur sait filtrer les offres d'une page avant leur pagination. */
  readonly supportsPageOfferFilters?: true
  /** Le fournisseur sait filtrer les offres gérées par état avant leur pagination. */
  readonly supportsManagedOfferStatusFilter?: true
  /** Le catalogue du réseau : offres ACTIVES de pages actives et lisibles, filtrées. */
  useSearch(request: ServiceSearchRequest): Loadable<ServiceOffersPage<ServiceOfferCardView>>
  /** Une offre ; `null` : indisponible pour ce lecteur (inconnue, en pause, retirée — même réponse). */
  useOffer(offerId: string): Loadable<ServiceOfferDetailView | null>
  /** Les offres actives d'une page, sur sa fiche ; page illisible : `not_found`. */
  usePageOffers(request: {
    readonly pageHandle: string
    readonly cursor: string | null
    readonly category?: ServiceCategory
    readonly delivery?: ServiceDeliveryFilter
    /** Lie la lecture au membre courant sans modifier les anciens appels. */
    readonly personId?: string
  }): Loadable<ServiceOffersPage<ServiceOfferCardView>>
  /** « Mon activité » : les offres d'une page que je gère, dans tous leurs états. */
  useMyPageOffers(request: {
    readonly pageId: string
    readonly cursor: string | null
    readonly status?: ServiceOfferStatus
    readonly personId?: string
  }): Loadable<ServiceOffersPage<ServiceOfferDetailView>>
  createOffer(input: ServiceOfferInputView & { readonly pageId: string; readonly publish: boolean }): Promise<ActionResult<{ offerId: string; version: number; status: ServiceOfferStatus }>>
  /** Modifier une offre : la version lue est exigée (`service_offer_version_conflict` sinon). */
  updateOffer(input: ServiceOfferInputView & { readonly offerId: string; readonly expectedVersion: number }): Promise<ActionResult<{ version: number }>>
  /** Publier, mettre en pause, reprendre, retirer ; l'état déjà courant ne change rien. */
  setOfferStatus(input: { readonly offerId: string; readonly expectedVersion: number; readonly status: ServiceOfferStatusTarget }): Promise<ActionResult<{ status: ServiceOfferStatus; version: number }>>
}
