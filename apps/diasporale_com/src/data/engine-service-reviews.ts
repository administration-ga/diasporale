"use client"

/** Avis admissibles (DG-016) : projection explicite, lectures de membre, écritures bornées par le moteur. */
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  SERVICE_REVIEWS_PAGE_SIZE,
  type ActionErrorCode,
  type Loadable,
  type MyServiceReviewView,
  type PageServiceReviewsPageView,
  type ServiceReviewsCapability,
  type ServiceReviewsPageView,
  type ServiceReviewView,
} from "@diasporale/features/data"
import { useConvexAuth } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { useMemo } from "react"

import {
  attemptAction,
  failed,
  LOADING,
  memberReadError,
  ready,
  resolveDiasporaleNetworkId,
  useEngineMember,
  useLoaded,
  type EngineSourceDeps,
  type Loaded,
} from "./engine-kit"

const REVIEWS = api.modules.diaspora.serviceReviews
type ReviewDto = FunctionReturnType<typeof REVIEWS.offerReviews>["items"][number]

/** Aucun identifiant privé de demande, de rendez-vous ou d'auteur ne traverse cette projection. */
export function serviceReviewView(row: ReviewDto): ServiceReviewView {
  return {
    reviewId: row.reviewId,
    pageId: row.pageId,
    offerId: row.offerId,
    rating: row.rating,
    body: row.body,
    proof: row.proof,
    version: row.version,
    status: row.status,
    moderation: row.moderation,
    author: { displayName: row.author.displayName },
    isMine: row.isMine,
    canReply: row.canReply,
    reply: row.reply ? {
      replyId: row.reply.replyId,
      body: row.reply.body,
      version: row.reply.version,
      status: row.reply.status,
      moderation: row.reply.moderation,
      canManage: row.reply.canManage,
      createdAt: row.reply.createdAt,
      updatedAt: row.reply.updatedAt,
    } : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function useReader(): { readonly networkId: Id<"networks"> | null; readonly error: ActionErrorCode | null } {
  const member = useEngineMember()
  const error = memberReadError(member)
  const networkId = member.networkId.state === "ready" ? member.networkId.value : null
  const canRead = error === null && member.auth.isAuthenticated && member.membership.state === "ready" && member.membership.value !== null
  return { networkId: canRead ? networkId : null, error }
}

/** Une réponse identique garde la même projection ; un refus ne laisse jamais son contenu à l'écran. */
function useStableLoaded<T, V>(error: ActionErrorCode | null, loaded: Loaded<T>, project: (error: ActionErrorCode | null, loaded: Loaded<T>) => V): V {
  const value = loaded.state === "ready" ? loaded.value : undefined
  const code = loaded.state === "error" ? loaded.code : null
  return useMemo(
    () => project(error, loaded),
    // La projection est constante ; seuls la réponse et les refus comptent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [error, loaded.state, value, code],
  )
}

export function createEngineServiceReviews(deps: EngineSourceDeps): ServiceReviewsCapability {
  const networkOf = () => resolveDiasporaleNetworkId(deps.convex)
  return {
    useOfferReviews({ offerId, cursor }) {
      const reader = useReader()
      const loaded = useLoaded(REVIEWS.offerReviews, reader.networkId
        ? { networkId: reader.networkId, offerId: offerId as Id<"serviceOffers">, paginationOpts: { cursor, numItems: SERVICE_REVIEWS_PAGE_SIZE } }
        : "skip")
      return useStableLoaded(reader.error, loaded, (error, result): Loadable<ServiceReviewsPageView> => {
        if (error !== null) return failed(error)
        if (result.state === "loading") return LOADING
        if (result.state === "error") return failed(result.code)
        return ready({ items: result.value.items.map(serviceReviewView), continueCursor: result.value.isDone ? null : result.value.continueCursor, isDone: result.value.isDone })
      })
    },

    usePageReviews({ pageId, personId, cursor }) {
      const reader = useReader()
      // La session brute ferme immédiatement la projection pendant sa transition,
      // même si le garde de navigation conserve encore son dernier état stable.
      const auth = useConvexAuth()
      const canRead = auth.isAuthenticated && !auth.isLoading && reader.networkId !== null && personId.trim().length > 0
      const loaded = useLoaded(REVIEWS.pageReviews, canRead && reader.networkId
        ? { networkId: reader.networkId, pageId: pageId as Id<"pages">, expectedPersonId: personId as Id<"persons">, paginationOpts: { cursor, numItems: SERVICE_REVIEWS_PAGE_SIZE } }
        : "skip")
      const value = loaded.state === "ready" ? loaded.value : undefined
      const code = loaded.state === "error" ? loaded.code : null
      return useMemo<Loadable<PageServiceReviewsPageView>>(() => {
        if (auth.isLoading) return LOADING
        if (!auth.isAuthenticated) return failed("not_signed_in")
        if (reader.error !== null) return failed(reader.error)
        if (!canRead || value === undefined) return code === null ? LOADING : failed(code)
        return ready({
          items: value.items.map((row) => ({ ...serviceReviewView(row), offerTitle: row.offerTitle })),
          continueCursor: value.isDone ? null : value.continueCursor,
          isDone: value.isDone,
        })
      }, [auth.isLoading, auth.isAuthenticated, reader.error, canRead, reader.networkId, pageId, personId, cursor, value, code])
    },

    useMyReview({ requestId }) {
      const reader = useReader()
      const loaded = useLoaded(REVIEWS.myReviewForRequest, reader.networkId
        ? { networkId: reader.networkId, requestId: requestId as Id<"serviceRequests"> }
        : "skip")
      return useStableLoaded(reader.error, loaded, (error, result): Loadable<MyServiceReviewView | null> => {
        if (error !== null) return failed(error)
        if (result.state === "loading") return LOADING
        if (result.state === "error") return failed(result.code)
        return ready(result.value ? {
          canCreate: result.value.canCreate,
          refusal: result.value.refusal,
          proof: result.value.proof,
          review: result.value.review ? serviceReviewView(result.value.review) : null,
        } : null)
      })
    },

    publish: (input) => attemptAction(async () => {
      const result = await deps.convex.mutation(REVIEWS.createReview, { networkId: await networkOf(), requestId: input.requestId as Id<"serviceRequests">, rating: input.rating, body: input.body, consentToPublish: input.consentToPublish })
      return { reviewId: result.reviewId as string, created: result.created }
    }),

    update: (input) => attemptAction(async () => {
      await deps.convex.mutation(REVIEWS.updateReview, { networkId: await networkOf(), reviewId: input.reviewId as Id<"serviceReviews">, expectedVersion: input.expectedVersion, rating: input.rating, body: input.body })
      return null
    }),

    withdraw: (input) => attemptAction(async () => {
      await deps.convex.mutation(REVIEWS.withdrawReview, { networkId: await networkOf(), reviewId: input.reviewId as Id<"serviceReviews">, expectedVersion: input.expectedVersion })
      return null
    }),

    reply: (input) => attemptAction(async () => {
      await deps.convex.mutation(REVIEWS.replyToReview, { networkId: await networkOf(), reviewId: input.reviewId as Id<"serviceReviews">, expectedVersion: input.expectedVersion, body: input.body })
      return null
    }),

    withdrawReply: (input) => attemptAction(async () => {
      await deps.convex.mutation(REVIEWS.withdrawReviewReply, { networkId: await networkOf(), reviewId: input.reviewId as Id<"serviceReviews">, expectedVersion: input.expectedVersion })
      return null
    }),

    report: ({ target, reason }) => attemptAction(async () => {
      await deps.convex.mutation(api.modules.moderation.cases.report, {
        networkId: await networkOf(),
        target: target.kind === "review" ? { kind: "serviceReview", id: target.id as Id<"serviceReviews"> } : { kind: "serviceReviewReply", id: target.id as Id<"serviceReviewReplies"> },
        reason,
      })
      return null
    }),
  }
}
