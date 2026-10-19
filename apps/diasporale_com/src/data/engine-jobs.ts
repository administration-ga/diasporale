"use client"

/**
 * Adaptateur moteur de la capacité « talents et emploi » (DG-025), branché sur
 * `convex/modules/diaspora/jobs.ts` du moteur ANTSIA. PROPRIÉTAIRE : ce chantier.
 *
 * - Lectures : abonnements bornés au réseau `diasporale`, après le refus
 *   standard d'une lecture de membre (`memberReadError`) — la recherche des
 *   talents exige en plus le droit à l'annuaire ; une page de résultats garde sa
 *   référence tant que le moteur ne rend rien de neuf.
 * - Écritures : un résultat à code FERMÉ (`errors.<code>`) ; les refus du
 *   domaine (`job_*`, `talent_*`, montants) arrivent tels quels du moteur.
 * - Confiance (G9) : l'état de modération (`moderation`) n'est lu que des vues de
 *   gestion où le moteur le sert ; le `null` qu'il rend à tout autre lecteur
 *   devient un champ absent.
 */
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import type { CountryCode } from "@diasporale/domain"
import {
  JOB_APPLICATIONS_PAGE_SIZE,
  JOB_RESULTS_PAGE_SIZE,
  MANAGED_JOBS_PAGE_SIZE,
  TALENT_RESULTS_PAGE_SIZE,
  type ActionErrorCode,
  type JobEmployerView,
  type JobOfferCardView,
  type JobOfferDetailView,
  type JobOfferInputView,
  type JobsCapability,
  type JobSearchRequest,
  type JobsPage,
  type Loadable,
  type MyJobApplicationView,
  type OwnTalentProfileView,
  type ReceivedJobApplicationView,
  type TalentHitView,
} from "@diasporale/features/data"
import type { FunctionReturnType } from "convex/server"
import { useMemo } from "react"

import {
  attemptAction,
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

const JOBS = api.modules.diaspora.jobs

type CardDto = FunctionReturnType<typeof JOBS.searchJobOffers>["page"][number]
type DetailDto = NonNullable<FunctionReturnType<typeof JOBS.getJobOffer>>
type MyApplicationDto = FunctionReturnType<typeof JOBS.myJobApplications>["page"][number]
type ReceivedDto = FunctionReturnType<typeof JOBS.jobOfferApplications>["page"][number]
type OwnTalentDto = NonNullable<FunctionReturnType<typeof JOBS.myTalentProfile>>
type TalentHitDto = FunctionReturnType<typeof JOBS.searchTalents>["page"][number]

function toEmployer(page: CardDto["page"]): JobEmployerView {
  return { id: page.pageId, handle: page.handle, name: page.name, ownerKind: page.ownerKind, badge: page.badge, logoUrl: page.logoUrl }
}

/** La carte du moteur, vue par l'écran (le pays est un code déjà validé par le domaine, côté moteur). */
export function toJobOfferCard(dto: CardDto): JobOfferCardView {
  return {
    id: dto.jobId,
    version: dto.version,
    title: dto.title,
    description: dto.description,
    contract: dto.contract,
    country: dto.country as CountryCode,
    city: dto.city,
    workMode: dto.workMode,
    languages: dto.languages,
    payRange: dto.payRange,
    closesAt: dto.closesAt,
    publishedAt: dto.publishedAt,
    updatedAt: dto.updatedAt,
    employer: toEmployer(dto.page),
  }
}

export function toJobOfferDetail(dto: DetailDto): JobOfferDetailView {
  return {
    ...toJobOfferCard(dto),
    status: dto.status,
    viewerCanManage: dto.viewerCanManage,
    // G9 : servi à l'équipe vivante seulement ; `null` (tout autre lecteur) reste absent.
    ...(dto.moderation ? { moderation: dto.moderation } : {}),
    myApplication: dto.myApplication ? { id: dto.myApplication.applicationId, status: dto.myApplication.status } : null,
  }
}

export function toMyJobApplication(dto: MyApplicationDto): MyJobApplicationView {
  return {
    id: dto.applicationId,
    status: dto.status,
    jobId: dto.jobId,
    offerTitle: dto.offerTitle,
    offerVersion: dto.offerVersion,
    offerOpen: dto.offerOpen,
    employer: dto.page ? toEmployer(dto.page) : null,
    message: dto.message,
    sharedTalentProfile: dto.sharedTalentProfile,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    actions: dto.actions,
    // G9 : servi à la personne propriétaire de la candidature ; l'équipe ne reçoit jamais cet état.
    moderation: dto.moderation,
  }
}

export function toReceivedJobApplication(dto: ReceivedDto): ReceivedJobApplicationView {
  return {
    id: dto.applicationId,
    jobId: dto.jobId,
    status: dto.status,
    offerVersion: dto.offerVersion,
    candidate: dto.candidate,
    message: dto.message,
    talentProfile: dto.talentProfile ? { ...dto.talentProfile, country: dto.talentProfile.country as CountryCode } : null,
    notSelectedReason: dto.notSelectedReason,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    actions: dto.actions,
  }
}

export function toOwnTalentProfile(dto: OwnTalentDto): OwnTalentProfileView {
  return {
    id: dto.talentId,
    title: dto.title,
    skills: dto.skills,
    availability: dto.availability,
    languages: dto.languages,
    country: dto.country as CountryCode,
    visibility: dto.visibility,
    status: dto.status,
    version: dto.version,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    // G9 : servi à la personne propriétaire du profil.
    moderation: dto.moderation,
  }
}

export function toTalentHit(dto: TalentHitDto): TalentHitView {
  return {
    id: dto.talentId,
    shortName: dto.shortName,
    title: dto.title,
    skills: dto.skills,
    availability: dto.availability,
    languages: dto.languages,
    country: dto.country as CountryCode,
    updatedAt: dto.updatedAt,
  }
}

/** Les arguments de recherche du moteur : un filtre absent ou vide n'est pas envoyé. */
export function jobSearchArgsOf(request: JobSearchRequest) {
  return {
    ...(request.query !== undefined && request.query.trim().length > 0 ? { query: request.query } : {}),
    ...(request.country !== undefined ? { country: request.country } : {}),
    ...(request.city !== undefined && request.city.trim().length > 0 ? { city: request.city } : {}),
    ...(request.contract !== undefined ? { contract: request.contract } : {}),
    ...(request.workMode !== undefined ? { workMode: request.workMode } : {}),
  }
}

/** Le réseau lisible par ce membre ; `null` tant qu'un refus ou un chargement l'empêche. */
function useReadableNetwork(capability: "read_network" | "view_directory" = "read_network"): { readonly networkId: Id<"networks"> | null; readonly refusal: ActionErrorCode | null } {
  const member = useEngineMember()
  const refusal = memberReadError(member, capability)
  const id = member.networkId.state === "ready" ? member.networkId.value : null
  const isMember = member.membership.state === "ready" && member.membership.value !== null
  return { networkId: refusal === null && member.auth.isAuthenticated && isMember ? id : null, refusal }
}

/**
 * La réponse du moteur projetée pour l'écran, MÉMORISÉE sur cette réponse :
 * même réponse, même référence (aucune boucle de rendu chez qui la compare).
 */
function useProjected<Value, View>(refusal: ActionErrorCode | null, loaded: Loaded<Value>, project: (value: Value) => Loadable<View>): Loadable<View> {
  const value = loaded.state === "ready" ? loaded.value : undefined
  const code = loaded.state === "error" ? loaded.code : null
  return useMemo(() => {
    if (refusal !== null) return failed<View>(refusal)
    if (code !== null) return failed<View>(code)
    if (value === undefined) return LOADING
    return project(value)
    // `project` est une fonction pure de `value` : seule la réponse du moteur compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refusal, code, value])
}

function pageOf<Dto, Row>(result: { readonly page: readonly Dto[]; readonly continueCursor: string; readonly isDone: boolean }, map: (dto: Dto) => Row): JobsPage<Row> {
  return { items: result.page.map(map), continueCursor: result.continueCursor, isDone: result.isDone }
}

/** Les champs d'une offre envoyés au moteur (copies : le moteur ne reçoit aucun tableau en lecture seule). */
function offerFieldsOf(input: JobOfferInputView) {
  return {
    title: input.title,
    description: input.description,
    contract: input.contract,
    country: input.country,
    city: input.city,
    workMode: input.workMode,
    languages: [...input.languages],
    payRange: input.payRange === null ? null : { minMinor: input.payRange.minMinor, maxMinor: input.payRange.maxMinor, currency: input.payRange.currency, period: input.payRange.period },
    closesAt: input.closesAt,
  }
}

export function createEngineJobs(deps: EngineSourceDeps): JobsCapability {
  /** Une écriture dans le réseau `diasporale` : résultat à code fermé, jamais une exception. */
  const write = <T>(work: (networkId: Id<"networks">) => Promise<T>) =>
    attemptAction(async () => await work(await resolveDiasporaleNetworkId(deps.convex)))

  return {
    useSearch(request) {
      const { networkId, refusal } = useReadableNetwork()
      const loaded = useLoaded(
        JOBS.searchJobOffers,
        networkId ? { networkId, ...jobSearchArgsOf(request), paginationOpts: { numItems: JOB_RESULTS_PAGE_SIZE, cursor: request.cursor } } : "skip",
      )
      return useProjected(refusal, loaded, (result) => ready(pageOf(result, toJobOfferCard)))
    },

    useOffer(jobId) {
      const { networkId, refusal } = useReadableNetwork()
      const loaded = useLoaded(JOBS.getJobOffer, networkId ? { networkId, jobId } : "skip")
      return useProjected(refusal, loaded, (result) => ready(result === null ? null : toJobOfferDetail(result)))
    },

    usePageOffers({ pageId, status, cursor }) {
      const { networkId, refusal } = useReadableNetwork()
      const loaded = useLoaded(
        JOBS.pageJobOffers,
        networkId ? { networkId, pageId: pageId as Id<"pages">, ...(status !== undefined ? { status } : {}), paginationOpts: { numItems: MANAGED_JOBS_PAGE_SIZE, cursor } } : "skip",
      )
      return useProjected(refusal, loaded, (result) => ready(pageOf(result, toJobOfferDetail)))
    },

    createOffer: (input) =>
      write(async (networkId) => {
        const created = await deps.convex.mutation(JOBS.createJobOffer, { networkId, pageId: input.pageId as Id<"pages">, ...offerFieldsOf(input), publish: input.publish })
        return { jobId: created.jobId as string, version: created.version, status: created.status }
      }),

    updateOffer: (input) =>
      write(async (networkId) =>
        await deps.convex.mutation(JOBS.updateJobOffer, { networkId, jobId: input.jobId as Id<"jobOffers">, expectedVersion: input.expectedVersion, ...offerFieldsOf(input) }),
      ),

    setOfferStatus: (input) =>
      write(async (networkId) =>
        await deps.convex.mutation(JOBS.setJobOfferStatus, { networkId, jobId: input.jobId as Id<"jobOffers">, expectedVersion: input.expectedVersion, status: input.status }),
      ),

    apply: (input) =>
      write(async (networkId) => {
        const result = await deps.convex.mutation(JOBS.applyToJobOffer, {
          networkId,
          jobId: input.jobId as Id<"jobOffers">,
          offerVersion: input.offerVersion,
          message: input.message,
          shareName: input.shareName,
          shareTalentProfile: input.shareTalentProfile,
          idempotencyKey: input.idempotencyKey,
        })
        return { applicationId: result.applicationId as string, created: result.created }
      }),

    withdraw: (applicationId) =>
      write(async (networkId) => await deps.convex.mutation(JOBS.withdrawJobApplication, { networkId, applicationId: applicationId as Id<"jobApplications"> })),

    useMyApplications({ cursor }) {
      const { networkId, refusal } = useReadableNetwork()
      const loaded = useLoaded(JOBS.myJobApplications, networkId ? { networkId, paginationOpts: { numItems: JOB_APPLICATIONS_PAGE_SIZE, cursor } } : "skip")
      return useProjected(refusal, loaded, (result) => ready(pageOf(result, toMyJobApplication)))
    },

    useOfferApplications({ jobId, status, cursor }) {
      const { networkId, refusal } = useReadableNetwork()
      const loaded = useLoaded(
        JOBS.jobOfferApplications,
        networkId ? { networkId, jobId: jobId as Id<"jobOffers">, ...(status !== undefined ? { status } : {}), paginationOpts: { numItems: JOB_APPLICATIONS_PAGE_SIZE, cursor } } : "skip",
      )
      return useProjected(refusal, loaded, (result) => ready(pageOf(result, toReceivedJobApplication)))
    },

    markSeen: (applicationId) =>
      write(async (networkId) => await deps.convex.mutation(JOBS.markJobApplicationSeen, { networkId, applicationId: applicationId as Id<"jobApplications"> })),

    shortlist: (applicationId) =>
      write(async (networkId) => await deps.convex.mutation(JOBS.shortlistJobApplication, { networkId, applicationId: applicationId as Id<"jobApplications"> })),

    markNotSelected: ({ applicationId, reason }) =>
      write(async (networkId) =>
        await deps.convex.mutation(JOBS.markJobApplicationNotSelected, {
          networkId,
          applicationId: applicationId as Id<"jobApplications">,
          ...(reason !== null ? { reason } : {}),
        }),
      ),

    useMyTalentProfile() {
      const { networkId, refusal } = useReadableNetwork()
      const loaded = useLoaded(JOBS.myTalentProfile, networkId ? { networkId } : "skip")
      return useProjected(refusal, loaded, (result) => ready(result === null ? null : toOwnTalentProfile(result)))
    },

    saveTalentProfile: (input) =>
      write(async (networkId) => {
        const saved = await deps.convex.mutation(JOBS.saveMyTalentProfile, {
          networkId,
          expectedVersion: input.expectedVersion,
          title: input.title,
          skills: [...input.skills],
          availability: input.availability,
          languages: [...input.languages],
          country: input.country,
          visibility: input.visibility,
        })
        return { id: saved.talentId as string, version: saved.version }
      }),

    setTalentProfileStatus: (input) =>
      write(async (networkId) => await deps.convex.mutation(JOBS.setMyTalentProfileStatus, { networkId, status: input.status, expectedVersion: input.expectedVersion })),

    removeTalentProfile: () =>
      write(async (networkId) => await deps.convex.mutation(JOBS.removeMyTalentProfile, { networkId })),

    useTalentSearch({ country, skill, cursor }) {
      const { networkId, refusal } = useReadableNetwork("view_directory")
      const loaded = useLoaded(
        JOBS.searchTalents,
        networkId
          ? { networkId, country, ...(skill !== undefined && skill.trim().length > 0 ? { skill } : {}), paginationOpts: { numItems: TALENT_RESULTS_PAGE_SIZE, cursor } }
          : "skip",
      )
      return useProjected(refusal, loaded, (result) => ready(pageOf(result, toTalentHit)))
    },
  }
}
