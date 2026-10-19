/**
 * Capacité « avis » du port (DG-016) — un avis n'existe que sur une prestation
 * admissible (rendez-vous confirmé ou réalisation déclarée, preuve affichée telle
 * quelle), un par prestation et par auteur, jamais par le professionnel lui-même ;
 * droit de réponse de la page ; relecture par la modération.
 * PROPRIÉTAIRE : chantier « avis » de la reprise DIASPORALE.
 */

import { SERVICE_REVIEW_REFUSALS, type ServiceReviewProof, type ServiceReviewRefusal } from "@diasporale/domain"

import type { ActionResult } from "./port"
import type { Loadable } from "./types"

export const SERVICE_REVIEW_ERROR_CODES = SERVICE_REVIEW_REFUSALS
export const SERVICE_REVIEWS_PAGE_SIZE = 20
export const SERVICE_REVIEW_REPORT_REASONS = ["spam", "harassment", "fraud", "other"] as const
export type ServiceReviewReportReason = (typeof SERVICE_REVIEW_REPORT_REASONS)[number]
export type ServiceReviewModeration = "published" | "pending_review" | "removed"

export interface ServiceReviewReplyView {
  readonly replyId: string
  readonly body: string
  readonly version: number
  readonly status: "active" | "withdrawn"
  readonly moderation: ServiceReviewModeration
  readonly canManage: boolean
  readonly createdAt: number
  readonly updatedAt: number
}

/** Projection publique dans le réseau : aucune référence de demande ou de rendez-vous. */
export interface ServiceReviewView {
  readonly reviewId: string
  readonly pageId: string
  readonly offerId: string
  readonly rating: number
  readonly body: string
  readonly proof: ServiceReviewProof
  readonly version: number
  readonly status: "active" | "withdrawn"
  readonly moderation: ServiceReviewModeration
  /** Le nom social publié, ou null après retrait ; aucun lien vers l'annuaire. */
  readonly author: { readonly displayName: string | null }
  readonly isMine: boolean
  readonly canReply: boolean
  readonly reply: ServiceReviewReplyView | null
  readonly createdAt: number
  readonly updatedAt: number
}

export interface ServiceReviewsPageView {
  readonly items: readonly ServiceReviewView[]
  readonly continueCursor: string | null
  readonly isDone: boolean
}

/** Avis publié dans la fiche de la page, avec le seul titre public de sa prestation. */
export interface PageServiceReviewView extends ServiceReviewView {
  readonly offerTitle: string
}

export interface PageServiceReviewsPageView {
  readonly items: readonly PageServiceReviewView[]
  readonly continueCursor: string | null
  readonly isDone: boolean
}

/** Lecture personnelle de la preuve et de l'avis associé à SA demande. */
export interface MyServiceReviewView {
  readonly canCreate: boolean
  readonly refusal: ServiceReviewRefusal | null
  readonly proof: ServiceReviewProof | null
  readonly review: ServiceReviewView | null
}

export interface ServiceReviewInput {
  readonly requestId: string
  readonly rating: number
  readonly body: string
  readonly consentToPublish: boolean
}

export interface ServiceReviewsCapability {
  useOfferReviews(input: { readonly offerId: string; readonly cursor: string | null }): Loadable<ServiceReviewsPageView>
  /** Facultative pour les fournisseurs antérieurs ; lecture liée à la page et au lecteur courant. */
  usePageReviews?(input: { readonly pageId: string; readonly personId: string; readonly cursor: string | null }): Loadable<PageServiceReviewsPageView>
  useMyReview(input: { readonly requestId: string }): Loadable<MyServiceReviewView | null>
  publish(input: ServiceReviewInput): Promise<ActionResult<{ readonly reviewId: string; readonly created: boolean }>>
  update(input: { readonly reviewId: string; readonly expectedVersion: number; readonly rating: number; readonly body: string }): Promise<ActionResult>
  withdraw(input: { readonly reviewId: string; readonly expectedVersion: number }): Promise<ActionResult>
  reply(input: { readonly reviewId: string; readonly expectedVersion: number | null; readonly body: string }): Promise<ActionResult>
  withdrawReply(input: { readonly reviewId: string; readonly expectedVersion: number }): Promise<ActionResult>
  report(input: {
    readonly target: { readonly kind: "review" | "reply"; readonly id: string }
    readonly reason: ServiceReviewReportReason
  }): Promise<ActionResult>
}
