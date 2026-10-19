"use client"

/**
 * Adaptateur moteur de la capacité « kit d'arrivée » (DG-024 b) : les fonctions de la
 * tranche `convex/modules/diaspora/arrivalKit.ts` du moteur ANTSIA, bornées par le
 * réseau `diasporale`. PROPRIÉTAIRE : ce chantier.
 *
 * - Lectures RÉACTIVES (abonnements Convex), après le refus standard d'une lecture de
 *   membre (`memberReadError`) : rien n'est demandé avant que l'adhésion du lecteur
 *   ne soit connue ; une réponse garde sa référence tant que le moteur ne rend rien
 *   de neuf. L'état « à revoir », le badge de la page, les droits du lecteur et l'état
 *   de modération (servi à qui gère seulement) sont jugés par le moteur : l'adaptateur
 *   ne fait que les traduire.
 * - Écritures : un résultat à code FERMÉ (`errors.<code>`) ; les refus du domaine
 *   (`arrival_kit_*`) arrivent tels quels du moteur.
 */
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import type { CountryCode } from "@diasporale/domain"
import {
  ARRIVAL_KIT_LIST_PAGE_SIZE,
  type ActionErrorCode,
  type ArrivalKitCapability,
  type ArrivalKitCarrierView,
  type ArrivalKitListPage,
  type ArrivalKitListRequest,
  type ArrivalKitOwnItemView,
  type ArrivalKitPageLabel,
  type ArrivalKitQueueItemView,
  type ArrivalKitResourceCardView,
  type ArrivalKitResourceDetailView,
  type ArrivalKitResourceInputView,
  type ArrivalKitStandingView,
  type Loadable,
  type ManagedModerationState,
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

const KIT = api.modules.diaspora.arrivalKit

type CardDto = FunctionReturnType<typeof KIT.listResources>["page"][number]
type DetailDto = NonNullable<FunctionReturnType<typeof KIT.getResource>>
type QueueDto = FunctionReturnType<typeof KIT.reviewQueue>["page"][number]
type OwnDto = FunctionReturnType<typeof KIT.myResources>["page"][number]
type StandingDto = FunctionReturnType<typeof KIT.myKitStanding>
type PageCardDto = StandingDto["carrierPages"][number]

/** La carte d'une page du moteur, vue par l'écran : identité publique et badge calculé. */
export function toArrivalKitPage(card: PageCardDto): ArrivalKitPageLabel {
  return { id: card.pageId, handle: card.handle, name: card.name, badge: card.badge, ownerKind: card.ownerKind }
}

function toCarrier(carrier: CardDto["carrier"]): ArrivalKitCarrierView {
  return carrier.kind === "page"
    ? { kind: "page", page: toArrivalKitPage(carrier.page) }
    : { kind: "person", person: { displayName: carrier.person.displayName, handle: carrier.person.handle } }
}

/** La carte du moteur, vue par l'écran (le pays est un code déjà validé par le domaine, côté moteur). */
export function toArrivalKitCard(dto: CardDto): ArrivalKitResourceCardView {
  return {
    id: dto.resourceId,
    version: dto.version,
    revision: dto.revision,
    title: dto.title,
    summary: dto.summary,
    category: dto.category,
    country: dto.country as CountryCode,
    city: dto.city,
    status: dto.status,
    reviewCause: dto.reviewCause,
    lastVerifiedAt: dto.lastVerifiedAt,
    reviewDueAt: dto.reviewDueAt,
    revisedAt: dto.revisedAt,
    reviewedAt: dto.reviewedAt,
    carrier: toCarrier(dto.carrier),
    official: dto.official,
  }
}

/**
 * L'état de modération (G9) : le moteur ne le sert qu'à qui gère la ressource (`null` pour
 * tout autre lecteur) ; absent de la réponse (moteur antérieur), il reste absent de la vue.
 */
function moderationOf(state: ManagedModerationState | null | undefined): Pick<ArrivalKitOwnItemView, "moderation"> {
  return state === null || state === undefined ? {} : { moderation: state }
}

export function toArrivalKitDetail(dto: DetailDto): ArrivalKitResourceDetailView {
  return {
    ...toArrivalKitCard(dto),
    body: dto.body,
    source: { name: dto.sourceName, url: dto.sourceUrl },
    createdAt: dto.createdAt,
    submittedAt: dto.submittedAt,
    reviewer: dto.reviewer === null ? null : { displayName: dto.reviewer.displayName, handle: dto.reviewer.handle },
    statusReason: dto.statusReason,
    outdatedFlags: dto.outdatedFlags,
    ...moderationOf(dto.moderation),
    viewer: { canManage: dto.viewer.canManage, canReview: dto.viewer.canReview, canFlag: dto.viewer.canFlag, hasFlagged: dto.viewer.hasFlagged },
  }
}

export function toArrivalKitQueueItem(dto: QueueDto): ArrivalKitQueueItemView {
  return { ...toArrivalKitCard(dto), submittedAt: dto.submittedAt }
}

export function toArrivalKitOwnItem(dto: OwnDto): ArrivalKitOwnItemView {
  return { ...toArrivalKitCard(dto), statusReason: dto.statusReason, outdatedFlags: dto.outdatedFlags, ...moderationOf(dto.moderation) }
}

export function toArrivalKitStanding(dto: StandingDto): ArrivalKitStandingView {
  return { canPropose: dto.canPropose, canReview: dto.canReview, carrierPages: dto.carrierPages.map(toArrivalKitPage) }
}

/** Une fenêtre du moteur, vue par l'écran : aucune suite annoncée après la dernière fenêtre. */
function pageOf<Dto, Row>(result: { readonly page: readonly Dto[]; readonly continueCursor: string; readonly isDone: boolean }, map: (dto: Dto) => Row): ArrivalKitListPage<Row> {
  return { items: result.page.map(map), continueCursor: result.isDone ? null : result.continueCursor, isDone: result.isDone }
}

/** Les arguments d'une lecture du kit : une ville vide n'est pas envoyée ; « national » seulement sans ville. */
export function listArgsOf(request: ArrivalKitListRequest) {
  const city = request.city?.trim() ?? ""
  return {
    country: request.country,
    ...(city.length > 0 ? { city } : request.nationalOnly ? { nationalOnly: true } : {}),
    ...(request.category !== null ? { category: request.category } : {}),
  }
}

/** Les champs d'une version : une ville vide n'est pas envoyée (la ressource vaut pour tout le pays). */
export function resourceArgsOf(input: ArrivalKitResourceInputView) {
  return {
    title: input.title,
    summary: input.summary,
    body: input.body,
    category: input.category,
    country: input.country,
    ...(input.city.trim().length > 0 ? { city: input.city } : {}),
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl,
    lastVerifiedAt: input.lastVerifiedAt,
  }
}

/** Le réseau lisible par ce membre ; `null` tant qu'un refus ou un chargement l'empêche. */
function useReadableNetwork(): { readonly networkId: Id<"networks"> | null; readonly refusal: ActionErrorCode | null } {
  const member = useEngineMember()
  const refusal = memberReadError(member)
  const id = member.networkId.state === "ready" ? member.networkId.value : null
  const isMember = member.membership.state === "ready" && member.membership.value !== null
  return { networkId: refusal === null && member.auth.isAuthenticated && isMember ? id : null, refusal }
}

/**
 * La réponse du moteur projetée pour l'écran, MÉMORISÉE sur cette réponse : même
 * réponse, même référence (aucune boucle de rendu chez qui la compare).
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

export function createEngineArrivalKit(deps: EngineSourceDeps): ArrivalKitCapability {
  /** Une écriture dans le réseau `diasporale` : résultat à code fermé, jamais une exception. */
  const write = <T>(work: (networkId: Id<"networks">) => Promise<T>) =>
    attemptAction(async () => await work(await resolveDiasporaleNetworkId(deps.convex)))
  const perform = (work: (networkId: Id<"networks">) => Promise<unknown>) => write(async (networkId) => {
    await work(networkId)
    return null
  })

  return {
    useStanding() {
      const { networkId, refusal } = useReadableNetwork()
      const loaded = useLoaded(KIT.myKitStanding, networkId ? { networkId } : "skip")
      return useProjected(refusal, loaded, (dto) => ready(toArrivalKitStanding(dto)))
    },

    useResources(request) {
      const { networkId, refusal } = useReadableNetwork()
      const loaded = useLoaded(
        KIT.listResources,
        networkId ? { networkId, ...listArgsOf(request), paginationOpts: { numItems: ARRIVAL_KIT_LIST_PAGE_SIZE, cursor: request.cursor } } : "skip",
      )
      return useProjected(refusal, loaded, (result) => ready(pageOf(result, toArrivalKitCard)))
    },

    useResource(resourceId) {
      const { networkId, refusal } = useReadableNetwork()
      const loaded = useLoaded(KIT.getResource, networkId && resourceId ? { networkId, resourceId } : "skip")
      return useProjected(refusal, loaded, (dto) => ready(dto === null ? null : toArrivalKitDetail(dto)))
    },

    useMyResources({ cursor }) {
      const { networkId, refusal } = useReadableNetwork()
      const loaded = useLoaded(KIT.myResources, networkId ? { networkId, paginationOpts: { numItems: ARRIVAL_KIT_LIST_PAGE_SIZE, cursor } } : "skip")
      return useProjected(refusal, loaded, (result) => ready(pageOf(result, toArrivalKitOwnItem)))
    },

    useReviewQueue({ country, cursor }) {
      const { networkId, refusal } = useReadableNetwork()
      const loaded = useLoaded(KIT.reviewQueue, networkId ? { networkId, country, paginationOpts: { numItems: ARRIVAL_KIT_LIST_PAGE_SIZE, cursor } } : "skip")
      return useProjected(refusal, loaded, (result) => ready(pageOf(result, toArrivalKitQueueItem)))
    },

    propose: (input) => write(async (networkId) => {
      const result = await deps.convex.mutation(KIT.proposeResource, {
        networkId,
        ...resourceArgsOf(input),
        ...(input.pageId !== null ? { pageId: input.pageId as Id<"pages"> } : {}),
        submit: input.submit,
      })
      return { resourceId: result.resourceId as string }
    }),

    update: (input) => perform((networkId) => deps.convex.mutation(KIT.updateResource, {
      networkId,
      resourceId: input.resourceId as Id<"kitResources">,
      expectedVersion: input.expectedVersion,
      ...resourceArgsOf(input),
      submit: input.submit,
    })),

    submit: ({ resourceId, expectedVersion }) => perform((networkId) => deps.convex.mutation(KIT.submitResource, {
      networkId,
      resourceId: resourceId as Id<"kitResources">,
      expectedVersion,
    })),

    withdraw: ({ resourceId, expectedVersion }) => perform((networkId) => deps.convex.mutation(KIT.withdrawResource, {
      networkId,
      resourceId: resourceId as Id<"kitResources">,
      expectedVersion,
    })),

    review: ({ resourceId, expectedVersion, decision, reason }) => perform((networkId) => deps.convex.mutation(KIT.reviewResource, {
      networkId,
      resourceId: resourceId as Id<"kitResources">,
      expectedVersion,
      decision,
      // Un motif n'accompagne qu'un renvoi ; vide, le moteur le refuse (motif obligatoire).
      ...(decision === "return" && reason.trim().length > 0 ? { reason } : {}),
    })),

    markForReview: ({ resourceId, expectedVersion, reason }) => perform((networkId) => deps.convex.mutation(KIT.markResourceForReview, {
      networkId,
      resourceId: resourceId as Id<"kitResources">,
      expectedVersion,
      reason,
    })),

    flagOutdated: ({ resourceId, revision, reason }) => perform((networkId) => deps.convex.mutation(KIT.flagResourceOutdated, {
      networkId,
      resourceId: resourceId as Id<"kitResources">,
      revision,
      reason,
    })),
  }
}
