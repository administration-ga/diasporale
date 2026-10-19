"use client"

/**
 * Adaptateur moteur de la capacité « mentorat » (DG-024, troisième tranche).
 * PROPRIÉTAIRE : ce chantier.
 *
 * Les lectures passent par la tranche `convex/modules/diaspora/mentoring` du
 * moteur, bornée par `networkId = diasporale` : la session, le réseau et
 * l'adhésion du lecteur sont jugés d'abord (`memberReadError`), puis le serveur
 * juge le droit (mentor qui se montre à ce lecteur, partie d'une demande ;
 * `null` ou `notFound` sinon). Les écritures rendent un code fermé
 * (`attemptAction`). Les projections sont recopiées champ par champ : rien
 * d'inattendu ne passe à l'écran, aucune coordonnée. L'état de modération (G9)
 * n'est recopié que là où le moteur le sert, à qui gère le contenu.
 */
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import type { CountryCode } from "@diasporale/domain"
import {
  MENTORING_REQUESTS_PAGE_SIZE,
  MENTORS_PAGE_SIZE,
  type ActionErrorCode,
  type Loadable,
  type ManagedModerationState,
  type MentorCardView,
  type MentorDetailView,
  type MentoringCapability,
  type MentoringPage,
  type MentoringRequestDetailView,
  type MentoringRequestSummaryView,
  type MentorProfileInputView,
  type MyMentorProfileView,
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

const M = api.modules.diaspora.mentoring

type MentorCardDto = FunctionReturnType<typeof M.searchMentors>["page"][number]
type MentorDetailDto = NonNullable<FunctionReturnType<typeof M.getMentorProfile>>
type MyMentorProfileDto = NonNullable<FunctionReturnType<typeof M.myMentorProfile>>
type RequestSummaryDto = FunctionReturnType<typeof M.menteeMentoringRequests>["page"][number]
type RequestDetailDto = NonNullable<FunctionReturnType<typeof M.getMentoringRequest>>

/** Une page native du moteur (`paginate`), telle que l'adaptateur la relit. */
type PageDto<Row> = { readonly page: readonly Row[]; readonly isDone: boolean; readonly continueCursor: string }

/**
 * L'état de modération d'une vue de gestion (G9), recopié s'il est servi ; `null` (le mentor
 * qui lit une demande) ou absent (moteur antérieur) : le champ est omis.
 */
function managedModerationOf(state: ManagedModerationState | null | undefined): { readonly moderation?: ManagedModerationState } {
  return state ? { moderation: state } : {}
}

/** La carte d'un mentor, recopiée champ par champ. */
export function mentorCardView(row: MentorCardDto): MentorCardView {
  return {
    mentorId: row.mentorId,
    personId: row.personId,
    displayName: row.displayName,
    handle: row.handle,
    badges: [...row.badges],
    // Le pays a été validé par le moteur à l'écriture (`parseMentorProfile`, jamais le Gabon).
    country: row.country as CountryCode,
    city: row.city,
    arrivedAt: row.arrivedAt,
    domains: [...row.domains],
    languages: [...row.languages],
    acceptsRequests: row.acceptsRequests,
  }
}

export function mentorDetailView(row: MentorDetailDto): MentorDetailView {
  return {
    ...mentorCardView(row),
    presentation: row.presentation,
    availability: row.availability,
    state: row.state,
    isSelf: row.isSelf,
    viewerRequest: row.viewerRequest ? { requestId: row.viewerRequest.requestId, status: row.viewerRequest.status } : null,
  }
}

export function myMentorProfileView(row: MyMentorProfileDto): MyMentorProfileView {
  return {
    mentorId: row.mentorId,
    state: row.state,
    domains: [...row.domains],
    presentation: row.presentation,
    languages: [...row.languages],
    country: row.country as CountryCode,
    city: row.city,
    availability: row.availability,
    maxActiveMentees: row.maxActiveMentees,
    activeMentees: row.activeMentees,
    pendingRequests: row.pendingRequests,
    version: row.version,
    optedInAt: row.optedInAt,
    updatedAt: row.updatedAt,
    ...managedModerationOf(row.moderation),
  }
}

export function mentoringRequestSummaryView(row: RequestSummaryDto): MentoringRequestSummaryView {
  return {
    requestId: row.requestId,
    status: row.status,
    viewerRole: row.viewerRole,
    mentorId: row.mentorId,
    counterpart: { displayName: row.counterpart.displayName, handle: row.counterpart.handle },
    domain: row.domain,
    goal: row.goal,
    wishedSlots: row.wishedSlots.map((slot) => ({ startAt: slot.startAt, endAt: slot.endAt })),
    timeZone: row.timeZone,
    slot: row.slot ? { startAt: row.slot.startAt, endAt: row.slot.endAt, timeZone: row.slot.timeZone, proposedAt: row.slot.proposedAt } : null,
    deadlineAt: row.deadlineAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...managedModerationOf(row.moderation),
  }
}

export function mentoringRequestDetailView(row: RequestDetailDto): MentoringRequestDetailView {
  return {
    ...mentoringRequestSummaryView(row),
    message: row.message,
    slotVersion: row.slotVersion,
    acceptedAt: row.acceptedAt,
    closedBy: row.closedBy,
    closedReason: row.closedReason,
    closedAt: row.closedAt,
    actions: [...row.actions],
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

function pageQuery<Row, View>(error: ActionErrorCode | null, loaded: Loaded<PageDto<Row>>, project: (row: Row) => View): Loadable<MentoringPage<View>> {
  if (error !== null) return failed(error)
  if (loaded.state === "loading") return LOADING
  if (loaded.state === "error") return failed(loaded.code)
  return ready({
    items: loaded.value.page.map(project),
    continueCursor: loaded.value.isDone ? null : loaded.value.continueCursor,
    isDone: loaded.value.isDone,
  })
}

function nullableQuery<Dto, View>(error: ActionErrorCode | null, loaded: Loaded<Dto | null>, project: (row: Dto) => View): Loadable<View | null> {
  if (error !== null) return failed(error)
  if (loaded.state === "loading") return LOADING
  if (loaded.state === "error") return failed(loaded.code)
  return ready(loaded.value === null ? null : project(loaded.value))
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

/** Le profil saisi, au format des arguments du moteur (listes copiées). */
function profileArgs(input: MentorProfileInputView) {
  return {
    domains: [...input.domains],
    presentation: input.presentation,
    languages: [...input.languages],
    country: input.country,
    city: input.city,
    availability: input.availability,
    maxActiveMentees: input.maxActiveMentees,
  }
}

export function createEngineMentoring(deps: EngineSourceDeps): MentoringCapability {
  const networkOf = () => resolveDiasporaleNetworkId(deps.convex)

  return {
    useMyProfile() {
      const reader = useReader()
      const loaded = useLoaded(M.myMentorProfile, reader.networkId ? { networkId: reader.networkId } : "skip")
      return useStableLoaded(reader.error, loaded, (error, result) => nullableQuery(error, result, myMentorProfileView))
    },

    useSearch({ country, domain, cursor }) {
      const reader = useReader()
      const loaded = useLoaded(
        M.searchMentors,
        reader.networkId
          ? { networkId: reader.networkId, country, ...(domain === null ? {} : { domain }), paginationOpts: { cursor, numItems: MENTORS_PAGE_SIZE } }
          : "skip",
      )
      return useStableLoaded(reader.error, loaded, (error, result) => pageQuery(error, result, mentorCardView))
    },

    useMentor(mentorId) {
      const reader = useReader()
      const loaded = useLoaded(M.getMentorProfile, reader.networkId ? { networkId: reader.networkId, mentorId } : "skip")
      return useStableLoaded(reader.error, loaded, (error, result) => nullableQuery(error, result, mentorDetailView))
    },

    useMenteeRequests({ cursor }) {
      const reader = useReader()
      const loaded = useLoaded(
        M.menteeMentoringRequests,
        reader.networkId ? { networkId: reader.networkId, paginationOpts: { cursor, numItems: MENTORING_REQUESTS_PAGE_SIZE } } : "skip",
      )
      return useStableLoaded(reader.error, loaded, (error, result) => pageQuery(error, result, mentoringRequestSummaryView))
    },

    useMentorRequests({ status, cursor }) {
      const reader = useReader()
      const loaded = useLoaded(
        M.mentorMentoringRequests,
        reader.networkId
          ? { networkId: reader.networkId, ...(status === null ? {} : { status }), paginationOpts: { cursor, numItems: MENTORING_REQUESTS_PAGE_SIZE } }
          : "skip",
      )
      return useStableLoaded(reader.error, loaded, (error, result) => pageQuery(error, result, mentoringRequestSummaryView))
    },

    useRequest(requestId) {
      const reader = useReader()
      const loaded = useLoaded(M.getMentoringRequest, reader.networkId ? { networkId: reader.networkId, requestId: requestId as Id<"mentoringRequests"> } : "skip")
      return useStableLoaded(reader.error, loaded, (error, result) => nullableQuery(error, result, mentoringRequestDetailView))
    },

    becomeMentor: (input) =>
      attemptAction(async () => {
        const result = await deps.convex.mutation(M.becomeMentor, { networkId: await networkOf(), ...profileArgs(input), consent: input.consent })
        return { mentorId: result.mentorId as string, version: result.version }
      }),

    updateProfile: (input) =>
      attemptAction(async () => {
        const result = await deps.convex.mutation(M.updateMentorProfile, { networkId: await networkOf(), expectedVersion: input.expectedVersion, ...profileArgs(input) })
        return { version: result.version }
      }),

    setState: ({ expectedVersion, state }) =>
      attemptAction(async () => {
        const result = await deps.convex.mutation(M.setMentorState, { networkId: await networkOf(), expectedVersion, state })
        return { state: result.state, version: result.version }
      }),

    request: (input) =>
      attemptAction(async () => {
        const result = await deps.convex.mutation(M.requestMentoring, {
          networkId: await networkOf(),
          mentorId: input.mentorId as Id<"mentorProfiles">,
          domain: input.domain,
          goal: input.goal,
          message: input.message,
          wishedSlots: input.wishedSlots.map((slot) => ({ startAt: slot.startAt, endAt: slot.endAt })),
          timeZone: input.timeZone,
          shareWithMentor: input.shareWithMentor,
          idempotencyKey: input.idempotencyKey,
        })
        return { requestId: result.requestId as string, created: result.created }
      }),

    cancel: ({ requestId, reason }) =>
      attemptAction(async () => {
        await deps.convex.mutation(M.cancelMentoringRequest, { networkId: await networkOf(), requestId: requestId as Id<"mentoringRequests">, ...(reason === null ? {} : { reason }) })
        return null
      }),

    accept: ({ requestId, slot }) =>
      attemptAction(async () => {
        const result = await deps.convex.mutation(M.acceptMentoringRequest, {
          networkId: await networkOf(),
          requestId: requestId as Id<"mentoringRequests">,
          ...(slot === null ? {} : { slot: { startAt: slot.startAt, endAt: slot.endAt, timeZone: slot.timeZone } }),
        })
        return { slotVersion: result.slotVersion }
      }),

    decline: ({ requestId, reason }) =>
      attemptAction(async () => {
        await deps.convex.mutation(M.declineMentoringRequest, { networkId: await networkOf(), requestId: requestId as Id<"mentoringRequests">, ...(reason === null ? {} : { reason }) })
        return null
      }),

    proposeSlot: ({ requestId, expectedSlotVersion, slot }) =>
      attemptAction(async () => {
        const result = await deps.convex.mutation(M.proposeMentoringSlot, {
          networkId: await networkOf(),
          requestId: requestId as Id<"mentoringRequests">,
          expectedSlotVersion,
          startAt: slot.startAt,
          endAt: slot.endAt,
          timeZone: slot.timeZone,
        })
        return { slotVersion: result.slotVersion }
      }),

    close: ({ requestId, reason }) =>
      attemptAction(async () => {
        await deps.convex.mutation(M.closeMentorship, { networkId: await networkOf(), requestId: requestId as Id<"mentoringRequests">, ...(reason === null ? {} : { reason }) })
        return null
      }),
  }
}
