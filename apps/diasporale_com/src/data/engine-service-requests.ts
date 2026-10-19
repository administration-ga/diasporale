"use client"

/**
 * Adaptateur moteur de la capacité « demandes de service » (DG-014/015).
 * PROPRIÉTAIRE : chantier « demandes et rendez-vous ».
 *
 * Les lectures passent par la tranche `convex/modules/diaspora/serviceRequests`
 * du moteur, bornée par `networkId = diasporale` : la session, le réseau et
 * l'adhésion du lecteur sont jugés d'abord (`memberReadError`), puis le serveur
 * juge le droit sur la demande (demandeur ou signataire vivant ; `null` ou
 * `notFound` sinon). Les écritures rendent un code fermé (`attemptAction`).
 */
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  SERVICE_REQUESTS_PAGE_SIZE,
  type ActionErrorCode,
  type Loadable,
  type ServiceRequestDetailView,
  type ServiceRequestsCapability,
  type ServiceRequestsPageQuery,
  type ServiceRequestSummaryView,
} from "@diasporale/features/data"
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

const SR = api.modules.diaspora.serviceRequests

type SummaryDto = FunctionReturnType<typeof SR.myServiceRequests>["page"][number]
type PageDto = FunctionReturnType<typeof SR.myServiceRequests>
type DetailDto = NonNullable<FunctionReturnType<typeof SR.getServiceRequest>>

/** La projection du moteur, recopiée champ par champ : rien d'inattendu ne passe à l'écran. */
export function serviceRequestSummaryView(row: SummaryDto): ServiceRequestSummaryView {
  return {
    requestId: row.requestId,
    status: row.status,
    offerId: row.offerId,
    offerTitle: row.offerTitle,
    offerVersion: row.offerVersion,
    page: row.page ? { pageId: row.page.pageId, handle: row.page.handle, name: row.page.name, logoUrl: row.page.logoUrl } : null,
    requester: row.requester ? { displayName: row.requester.displayName, handle: row.requester.handle } : null,
    windows: row.windows.map((window) => ({ startAt: window.startAt, endAt: window.endAt })),
    timeZone: row.timeZone,
    currentProposal: row.currentProposal
      ? {
          version: row.currentProposal.version,
          amountMinor: row.currentProposal.amountMinor,
          currency: row.currentProposal.currency,
          startAt: row.currentProposal.startAt,
          endAt: row.currentProposal.endAt,
          timeZone: row.currentProposal.timeZone,
          expiresAt: row.currentProposal.expiresAt,
        }
      : null,
    booking: row.booking ? { startAt: row.booking.startAt, endAt: row.booking.endAt, timeZone: row.booking.timeZone, status: row.booking.status } : null,
    deadlineAt: row.deadlineAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function serviceRequestDetailView(row: DetailDto): ServiceRequestDetailView {
  return {
    ...serviceRequestSummaryView(row),
    viewerRole: row.viewerRole,
    need: row.need,
    proposals: row.proposals.map((proposal) => ({
      version: proposal.version,
      amountMinor: proposal.amountMinor,
      currency: proposal.currency,
      durationMinutes: proposal.durationMinutes,
      startAt: proposal.startAt,
      endAt: proposal.endAt,
      timeZone: proposal.timeZone,
      location: proposal.location.mode === "onsite" ? { mode: "onsite", area: proposal.location.area } : { mode: "remote" },
      details: proposal.details,
      cancellationTerms: proposal.cancellationTerms,
      expiresAt: proposal.expiresAt,
      state: proposal.state,
      createdAt: proposal.createdAt,
    })),
    timeline: row.timeline.map((event) => ({ status: event.status, at: event.at, version: event.version })),
    closedBy: row.closedBy,
    closedReason: row.closedReason,
    actions: [...row.actions],
    noShowContest: row.noShowContest ? { at: row.noShowContest.at, reason: row.noShowContest.reason } : null,
    canContestNoShow: row.canContestNoShow,
  }
}

/** Le réseau du lecteur s'il peut lire, et le refus standard sinon (session, réseau, adhésion). */
function useReader(): { readonly networkId: Id<"networks"> | null; readonly error: ActionErrorCode | null } {
  const member = useEngineMember()
  const error = memberReadError(member)
  const networkId = member.networkId.state === "ready" ? member.networkId.value : null
  const canRead = error === null && member.auth.isAuthenticated && member.membership.state === "ready" && member.membership.value !== null
  return { networkId: canRead ? networkId : null, error }
}

function pageQuery(error: ActionErrorCode | null, loaded: Loaded<PageDto>): ServiceRequestsPageQuery {
  if (error !== null) return failed(error)
  if (loaded.state === "loading") return LOADING
  if (loaded.state === "error") return failed(loaded.code)
  return ready({
    items: loaded.value.page.map(serviceRequestSummaryView),
    continueCursor: loaded.value.isDone ? null : loaded.value.continueCursor,
    isDone: loaded.value.isDone,
  })
}

/** Une lecture dont la projection ne change qu'avec la réponse du moteur (même objet tant qu'elle ne change pas). */
function useStableLoaded<T, V>(error: ActionErrorCode | null, loaded: Loaded<T>, project: (error: ActionErrorCode | null, loaded: Loaded<T>) => V): V {
  const value = loaded.state === "ready" ? loaded.value : undefined
  const code = loaded.state === "error" ? loaded.code : null
  return useMemo(
    () => project(error, loaded),
    // La projection est constante ; seuls le refus et la réponse du moteur comptent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [error, loaded.state, value, code],
  )
}

export function createEngineServiceRequests(deps: EngineSourceDeps): ServiceRequestsCapability {
  const networkOf = () => resolveDiasporaleNetworkId(deps.convex)

  return {
    useMyRequests({ cursor }) {
      const reader = useReader()
      const loaded = useLoaded(SR.myServiceRequests, reader.networkId ? { networkId: reader.networkId, paginationOpts: { cursor, numItems: SERVICE_REQUESTS_PAGE_SIZE } } : "skip")
      return useStableLoaded(reader.error, loaded, pageQuery)
    },

    usePageRequests({ pageId, status, cursor }) {
      const reader = useReader()
      const loaded = useLoaded(
        SR.pageServiceRequests,
        reader.networkId
          ? { networkId: reader.networkId, pageId: pageId as Id<"pages">, ...(status === null ? {} : { status }), paginationOpts: { cursor, numItems: SERVICE_REQUESTS_PAGE_SIZE } }
          : "skip",
      )
      return useStableLoaded(reader.error, loaded, pageQuery)
    },

    useRequest(requestId) {
      const reader = useReader()
      const loaded = useLoaded(SR.getServiceRequest, reader.networkId ? { networkId: reader.networkId, requestId: requestId as Id<"serviceRequests"> } : "skip")
      return useStableLoaded(reader.error, loaded, (error, result): Loadable<ServiceRequestDetailView | null> => {
        if (error !== null) return failed(error)
        if (result.state === "loading") return LOADING
        if (result.state === "error") return failed(result.code)
        return ready(result.value ? serviceRequestDetailView(result.value) : null)
      })
    },

    send: (input) =>
      attemptAction(async () => {
        const result = await deps.convex.mutation(SR.createServiceRequest, {
          networkId: await networkOf(),
          offerId: input.offerId as Id<"serviceOffers">,
          offerVersion: input.offerVersion,
          need: input.need,
          windows: input.windows.map((window) => ({ startAt: window.startAt, endAt: window.endAt })),
          timeZone: input.timeZone,
          shareIdentityWithPage: input.shareIdentityWithPage,
          idempotencyKey: input.idempotencyKey,
        })
        return { requestId: result.requestId as string, created: result.created }
      }),

    propose: (input) =>
      attemptAction(async () => {
        const result = await deps.convex.mutation(SR.proposeService, {
          networkId: await networkOf(),
          requestId: input.requestId as Id<"serviceRequests">,
          expectedVersion: input.expectedVersion,
          amountMinor: input.amountMinor,
          currency: input.currency,
          durationMinutes: input.durationMinutes,
          startAt: input.startAt,
          timeZone: input.timeZone,
          location: input.location.mode === "onsite" ? { mode: "onsite", area: input.location.area } : { mode: "remote" },
          details: input.details,
          cancellationTerms: input.cancellationTerms,
          expiresAt: input.expiresAt,
        })
        return { version: result.version }
      }),

    refuse: ({ requestId, reason }) =>
      attemptAction(async () => {
        await deps.convex.mutation(SR.refuseServiceRequest, { networkId: await networkOf(), requestId: requestId as Id<"serviceRequests">, ...(reason === null ? {} : { reason }) })
        return null
      }),

    cancel: ({ requestId, reason }) =>
      attemptAction(async () => {
        await deps.convex.mutation(SR.cancelServiceRequest, { networkId: await networkOf(), requestId: requestId as Id<"serviceRequests">, ...(reason === null ? {} : { reason }) })
        return null
      }),

    accept: ({ requestId, expectedProposalVersion }) =>
      attemptAction(async () => {
        const result = await deps.convex.mutation(SR.acceptServiceProposal, { networkId: await networkOf(), requestId: requestId as Id<"serviceRequests">, expectedProposalVersion })
        return { bookingId: result.bookingId as string }
      }),

    complete: (requestId) =>
      attemptAction(async () => {
        await deps.convex.mutation(SR.completeServiceBooking, { networkId: await networkOf(), requestId: requestId as Id<"serviceRequests"> })
        return null
      }),

    markNoShow: (requestId) =>
      attemptAction(async () => {
        await deps.convex.mutation(SR.markServiceNoShow, { networkId: await networkOf(), requestId: requestId as Id<"serviceRequests"> })
        return null
      }),

    contestNoShow: ({ requestId, reason }) =>
      attemptAction(async () => {
        const result = await deps.convex.mutation(SR.contestServiceNoShow, { networkId: await networkOf(), requestId: requestId as Id<"serviceRequests">, reason })
        return { contestedAt: result.contestedAt, created: result.created }
      }),
  }
}
