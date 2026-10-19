"use client"

/**
 * Adaptateur moteur de la capacité « entraide » (DG-024 a) : les fonctions de
 * la tranche `convex/modules/diaspora/mutualAid.ts` du moteur, bornées par le
 * réseau `diasporale`. PROPRIÉTAIRE : chantier « entraide ».
 *
 * - Lectures RÉACTIVES (abonnements Convex), jamais avant que l'adhésion du
 *   lecteur au réseau ne soit connue ; un refus du serveur devient un code
 *   fermé (`errors.<code>`), jamais un écran blanc. Une projection garde sa
 *   référence tant que le moteur ne rend rien de neuf.
 * - Écritures : un résultat à code fermé, jamais une exception ; une saisie
 *   facultative vide n'est pas envoyée (le moteur l'efface).
 * - L'état de modération (G9) : le moteur ne le sert qu'à qui gère le contenu
 *   (`null` ailleurs) ; la vue ne le porte que s'il est servi.
 */
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import type { CountryCode } from "@diasporale/domain"
import {
  MUTUAL_AID_PAGE_SIZE,
  type AidAnswerView,
  type AidItemView,
  type AidListPage,
  type AidMissionCardView,
  type AidMissionDetailView,
  type AidMissionPageOption,
  type AidPageView,
  type AidQuestionCardView,
  type AidQuestionDetailView,
  type AidVolunteerView,
  type Loadable,
  type ManagedModerationState,
  type MutualAidCapability,
} from "@diasporale/features/data"
import type { FunctionReturnType } from "convex/server"
import { useMemo } from "react"

import {
  attemptAction,
  type EngineMember,
  type EngineSourceDeps,
  failed,
  LOADING,
  type Loaded,
  memberReadError,
  ready,
  resolveDiasporaleNetworkId,
  useEngineMember,
  useLoaded,
} from "./engine-kit"

const AID = api.modules.diaspora.mutualAid

type QuestionCardDto = FunctionReturnType<typeof AID.listQuestions>["page"][number]
type AnswerDto = FunctionReturnType<typeof AID.listAnswers>["page"][number]
type ItemDto = NonNullable<FunctionReturnType<typeof AID.aidItem>>
type QuestionDetailDto = Extract<ItemDto, { kind: "question" }>["question"]
type MissionDetailDto = Extract<ItemDto, { kind: "mission" }>["mission"]
type MissionCardDto = FunctionReturnType<typeof AID.listMissions>["page"][number]
type VolunteerDto = FunctionReturnType<typeof AID.missionVolunteers>["page"][number]
type MissionPageDto = FunctionReturnType<typeof AID.missionPages>[number]

// ═══════════════════════════════════════════════════════════════
// Projections : la réponse du moteur, vue par l'écran
// ═══════════════════════════════════════════════════════════════

/** L'état de modération servi à qui gère le contenu ; `null` (tout autre lecteur) ou absent : la vue ne le porte pas. */
function moderationOf(state: ManagedModerationState | null | undefined): { readonly moderation?: ManagedModerationState } {
  return state ? { moderation: state } : {}
}

export function toAidQuestionCard(dto: QuestionCardDto): AidQuestionCardView {
  return {
    id: dto.questionId,
    title: dto.title,
    detail: dto.detail,
    theme: dto.theme,
    // Le pays est un code déjà validé par le domaine, côté moteur.
    country: dto.country as CountryCode,
    city: dto.city,
    status: dto.status,
    answerCount: dto.answerCount,
    hasAcceptedAnswer: dto.hasAcceptedAnswer,
    author: { displayName: dto.author.displayName, handle: dto.author.handle },
    isMine: dto.isMine,
    createdAt: dto.createdAt,
    ...moderationOf(dto.moderation),
  }
}

export function toAidAnswer(dto: AnswerDto): AidAnswerView {
  return {
    id: dto.answerId,
    questionId: dto.questionId,
    body: dto.body,
    version: dto.version,
    author: { displayName: dto.author.displayName, handle: dto.author.handle },
    isMine: dto.isMine,
    isAccepted: dto.isAccepted,
    createdAt: dto.createdAt,
    editedAt: dto.editedAt,
    ...moderationOf(dto.moderation),
  }
}

export function toAidQuestionDetail(dto: QuestionDetailDto): AidQuestionDetailView {
  return {
    ...toAidQuestionCard(dto),
    version: dto.version,
    updatedAt: dto.updatedAt,
    editedAt: dto.editedAt,
    acceptedAnswer: dto.acceptedAnswer ? toAidAnswer(dto.acceptedAnswer) : null,
    canAnswer: dto.canAnswer,
    canEdit: dto.canEdit,
  }
}

function toAidPage(card: MissionCardDto["page"]): AidPageView {
  return { id: card.pageId, handle: card.handle, name: card.name, badge: card.badge }
}

export function toAidMissionCard(dto: MissionCardDto): AidMissionCardView {
  return {
    id: dto.missionId,
    page: toAidPage(dto.page),
    title: dto.title,
    description: dto.description,
    country: dto.country as CountryCode,
    city: dto.city,
    area: dto.area,
    startsAt: dto.startsAt,
    endsAt: dto.endsAt,
    timeZone: dto.timeZone,
    places: dto.places,
    signupCount: dto.signupCount,
    status: dto.status,
    signedUp: dto.signedUp,
    ...moderationOf(dto.moderation),
  }
}

export function toAidMissionDetail(dto: MissionDetailDto): AidMissionDetailView {
  return {
    ...toAidMissionCard(dto),
    version: dto.version,
    cancelReason: dto.cancelReason,
    signup: { allowed: dto.signup.allowed, refusal: dto.signup.refusal },
    canManage: dto.canManage,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

export function toAidItem(dto: ItemDto): AidItemView {
  return dto.kind === "question"
    ? { kind: "question", question: toAidQuestionDetail(dto.question) }
    : { kind: "mission", mission: toAidMissionDetail(dto.mission) }
}

export function toAidVolunteer(dto: VolunteerDto): AidVolunteerView {
  return { id: dto.signupId, person: { displayName: dto.person.displayName, handle: dto.person.handle }, signedUpAt: dto.signedUpAt }
}

export function toAidMissionPage(dto: MissionPageDto): AidMissionPageOption {
  return { id: dto.pageId, handle: dto.handle, name: dto.name, country: dto.country as CountryCode | null, city: dto.city }
}

/** Une fenêtre du moteur, vue par l'écran : aucune suite après la dernière fenêtre. */
function windowOf<Dto, Row>(result: { readonly page: readonly Dto[]; readonly continueCursor: string; readonly isDone: boolean }, map: (dto: Dto) => Row): AidListPage<Row> {
  return { items: result.page.map(map), continueCursor: result.isDone ? null : result.continueCursor, isDone: result.isDone }
}

/** Les arguments d'une ville saisie : vide, la liste vaut pour tout le pays (rien n'est envoyé). */
function cityArgs(city: string | undefined): { city?: string } {
  const typed = city?.trim()
  return typed ? { city: typed } : {}
}

// ═══════════════════════════════════════════════════════════════
// Lectures
// ═══════════════════════════════════════════════════════════════

/** Le réseau du lecteur quand rien n'empêche la lecture (session, réseau, adhésion lisible), sinon `null`. */
function readableNetwork(member: EngineMember): Id<"networks"> | null {
  if (memberReadError(member) !== null || member.membership.state !== "ready" || member.networkId.state !== "ready") return null
  return member.networkId.value
}

/** Une lecture du moteur, vue par l'écran : le refus du lecteur d'abord, puis celui du serveur. */
function settle<Dto, View>(member: EngineMember, loaded: Loaded<Dto>, view: View | undefined): Loadable<View> {
  const blocked = memberReadError(member)
  if (blocked) return failed(blocked)
  if (loaded.state === "error") return failed(loaded.code)
  return view === undefined ? LOADING : ready(view)
}

export function createEngineMutualAid(deps: EngineSourceDeps): MutualAidCapability {
  /** Une écriture dans le réseau `diasporale` : résultat à code fermé, jamais une exception. */
  const write = <T>(work: (networkId: Id<"networks">) => Promise<T>) =>
    attemptAction(async () => await work(await resolveDiasporaleNetworkId(deps.convex)))
  const gesture = (work: (networkId: Id<"networks">) => Promise<unknown>) =>
    attemptAction(async () => {
      await work(await resolveDiasporaleNetworkId(deps.convex))
      return null
    })

  return {
    useQuestions({ country, city, status, cursor }) {
      const member = useEngineMember()
      const networkId = readableNetwork(member)
      const loaded = useLoaded(
        AID.listQuestions,
        networkId ? { networkId, country, ...cityArgs(city), status, paginationOpts: { cursor, numItems: MUTUAL_AID_PAGE_SIZE } } : "skip",
      )
      const value = loaded.state === "ready" ? loaded.value : undefined
      const view = useMemo(() => (value ? windowOf(value, toAidQuestionCard) : undefined), [value])
      return settle(member, loaded, view)
    },

    useMyQuestions({ cursor }) {
      const member = useEngineMember()
      const networkId = readableNetwork(member)
      const loaded = useLoaded(AID.myQuestions, networkId ? { networkId, paginationOpts: { cursor, numItems: MUTUAL_AID_PAGE_SIZE } } : "skip")
      const value = loaded.state === "ready" ? loaded.value : undefined
      const view = useMemo(() => (value ? windowOf(value, toAidQuestionCard) : undefined), [value])
      return settle(member, loaded, view)
    },

    useItem(itemId) {
      const member = useEngineMember()
      const networkId = readableNetwork(member)
      const loaded = useLoaded(AID.aidItem, networkId && itemId ? { networkId, itemId } : "skip")
      const value = loaded.state === "ready" ? loaded.value : undefined
      // `null` : introuvable ou illisible pour ce lecteur — une réponse, pas un chargement.
      const view = useMemo(() => (value === undefined ? undefined : value === null ? null : toAidItem(value)), [value])
      return settle(member, loaded, view)
    },

    useAnswers({ questionId, cursor }) {
      const member = useEngineMember()
      const networkId = readableNetwork(member)
      const loaded = useLoaded(
        AID.listAnswers,
        networkId && questionId ? { networkId, questionId: questionId as Id<"aidQuestions">, paginationOpts: { cursor, numItems: MUTUAL_AID_PAGE_SIZE } } : "skip",
      )
      const value = loaded.state === "ready" ? loaded.value : undefined
      const view = useMemo(() => (value ? windowOf(value, toAidAnswer) : undefined), [value])
      return settle(member, loaded, view)
    },

    useMissions({ country, city, from, cursor }) {
      const member = useEngineMember()
      const networkId = readableNetwork(member)
      const loaded = useLoaded(
        AID.listMissions,
        networkId ? { networkId, country, ...cityArgs(city), from, paginationOpts: { cursor, numItems: MUTUAL_AID_PAGE_SIZE } } : "skip",
      )
      const value = loaded.state === "ready" ? loaded.value : undefined
      const view = useMemo(() => (value ? windowOf(value, toAidMissionCard) : undefined), [value])
      return settle(member, loaded, view)
    },

    useMySignups({ cursor }) {
      const member = useEngineMember()
      const networkId = readableNetwork(member)
      const loaded = useLoaded(AID.mySignups, networkId ? { networkId, paginationOpts: { cursor, numItems: MUTUAL_AID_PAGE_SIZE } } : "skip")
      const value = loaded.state === "ready" ? loaded.value : undefined
      const view = useMemo(() => (value ? windowOf(value, toAidMissionCard) : undefined), [value])
      return settle(member, loaded, view)
    },

    useMissionPages() {
      const member = useEngineMember()
      const networkId = readableNetwork(member)
      const loaded = useLoaded(AID.missionPages, networkId ? { networkId } : "skip")
      const value = loaded.state === "ready" ? loaded.value : undefined
      const view = useMemo((): readonly AidMissionPageOption[] | undefined => (value ? value.map(toAidMissionPage) : undefined), [value])
      return settle(member, loaded, view)
    },

    usePageMissions({ pageId, cursor }) {
      const member = useEngineMember()
      const networkId = readableNetwork(member)
      const loaded = useLoaded(
        AID.pageMissions,
        networkId && pageId ? { networkId, pageId: pageId as Id<"pages">, paginationOpts: { cursor, numItems: MUTUAL_AID_PAGE_SIZE } } : "skip",
      )
      const value = loaded.state === "ready" ? loaded.value : undefined
      const view = useMemo(() => (value ? windowOf(value, toAidMissionCard) : undefined), [value])
      return settle(member, loaded, view)
    },

    useVolunteers({ missionId, cursor }) {
      const member = useEngineMember()
      const networkId = readableNetwork(member)
      const loaded = useLoaded(
        AID.missionVolunteers,
        networkId && missionId ? { networkId, missionId: missionId as Id<"aidMissions">, paginationOpts: { cursor, numItems: MUTUAL_AID_PAGE_SIZE } } : "skip",
      )
      const value = loaded.state === "ready" ? loaded.value : undefined
      const view = useMemo(() => (value ? windowOf(value, toAidVolunteer) : undefined), [value])
      return settle(member, loaded, view)
    },

    askQuestion: (input) => write(async (networkId) => {
      const { questionId } = await deps.convex.mutation(AID.askQuestion, {
        networkId,
        title: input.title,
        detail: input.detail,
        theme: input.theme,
        country: input.country,
        ...cityArgs(input.city),
      })
      return { questionId: questionId as string }
    }),

    updateQuestion: (input) => gesture((networkId) => deps.convex.mutation(AID.updateQuestion, {
      networkId,
      questionId: input.questionId as Id<"aidQuestions">,
      expectedVersion: input.expectedVersion,
      title: input.title,
      detail: input.detail,
      theme: input.theme,
      ...cityArgs(input.city),
    })),

    closeQuestion: ({ questionId, expectedVersion }) => gesture((networkId) => deps.convex.mutation(AID.closeQuestion, {
      networkId,
      questionId: questionId as Id<"aidQuestions">,
      expectedVersion,
    })),

    withdrawQuestion: ({ questionId, expectedVersion }) => gesture((networkId) => deps.convex.mutation(AID.withdrawQuestion, {
      networkId,
      questionId: questionId as Id<"aidQuestions">,
      expectedVersion,
    })),

    answer: ({ questionId, body }) => write(async (networkId) => {
      const { answerId } = await deps.convex.mutation(AID.answerQuestion, { networkId, questionId: questionId as Id<"aidQuestions">, body })
      return { answerId: answerId as string }
    }),

    updateAnswer: ({ answerId, expectedVersion, body }) => gesture((networkId) => deps.convex.mutation(AID.updateAnswer, {
      networkId,
      answerId: answerId as Id<"aidAnswers">,
      expectedVersion,
      body,
    })),

    withdrawAnswer: ({ answerId, expectedVersion }) => gesture((networkId) => deps.convex.mutation(AID.withdrawAnswer, {
      networkId,
      answerId: answerId as Id<"aidAnswers">,
      expectedVersion,
    })),

    acceptAnswer: ({ questionId, answerId, expectedVersion }) => gesture((networkId) => deps.convex.mutation(AID.acceptAnswer, {
      networkId,
      questionId: questionId as Id<"aidQuestions">,
      answerId: answerId as Id<"aidAnswers">,
      expectedVersion,
    })),

    unacceptAnswer: ({ questionId, expectedVersion }) => gesture((networkId) => deps.convex.mutation(AID.unacceptAnswer, {
      networkId,
      questionId: questionId as Id<"aidQuestions">,
      expectedVersion,
    })),

    createMission: (input) => write(async (networkId) => {
      const { missionId } = await deps.convex.mutation(AID.createMission, {
        networkId,
        pageId: input.pageId as Id<"pages">,
        title: input.title,
        description: input.description,
        country: input.country,
        city: input.city,
        ...(input.area.trim() ? { area: input.area } : {}),
        startsAt: input.startsAt,
        ...(input.endsAt !== null ? { endsAt: input.endsAt } : {}),
        timeZone: input.timeZone,
        places: input.places,
      })
      return { missionId: missionId as string }
    }),

    updateMission: (input) => gesture((networkId) => deps.convex.mutation(AID.updateMission, {
      networkId,
      missionId: input.missionId as Id<"aidMissions">,
      expectedVersion: input.expectedVersion,
      title: input.title,
      description: input.description,
      country: input.country,
      city: input.city,
      ...(input.area.trim() ? { area: input.area } : {}),
      startsAt: input.startsAt,
      ...(input.endsAt !== null ? { endsAt: input.endsAt } : {}),
      timeZone: input.timeZone,
      places: input.places,
    })),

    closeMission: ({ missionId, expectedVersion }) => gesture((networkId) => deps.convex.mutation(AID.closeMission, {
      networkId,
      missionId: missionId as Id<"aidMissions">,
      expectedVersion,
    })),

    cancelMission: ({ missionId, expectedVersion, reason }) => gesture((networkId) => deps.convex.mutation(AID.cancelMission, {
      networkId,
      missionId: missionId as Id<"aidMissions">,
      expectedVersion,
      ...(reason.trim() ? { reason } : {}),
    })),

    signUp: ({ missionId, shareNameWithTeam }) => gesture((networkId) => deps.convex.mutation(AID.signUpForMission, {
      networkId,
      missionId: missionId as Id<"aidMissions">,
      shareNameWithTeam,
    })),

    withdrawSignup: (missionId) => gesture((networkId) => deps.convex.mutation(AID.withdrawFromMission, {
      networkId,
      missionId: missionId as Id<"aidMissions">,
    })),
  }
}
