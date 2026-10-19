"use client"

/**
 * Adaptateur moteur de la capacité « services » (DG-011/012) : le catalogue et
 * la gestion des offres, branchés sur `convex/modules/diaspora/services.ts` du
 * moteur ANTSIA. PROPRIÉTAIRE : chantier « catalogue des services ».
 *
 * - Lectures : abonnements bornés au réseau `diasporale`, après le refus
 *   standard d'une lecture de membre (`memberReadError`) ; une page de
 *   résultats garde sa référence tant que le moteur ne rend rien de neuf.
 * - Écritures : un résultat à code FERMÉ (`errors.<code>`) ; les refus du
 *   domaine (`service_*`, montants) arrivent tels quels du moteur.
 */
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import type { CountryCode } from "@diasporale/domain"
import {
  MANAGED_OFFERS_PAGE_SIZE,
  SERVICE_RESULTS_PAGE_SIZE,
  type ActionErrorCode,
  type Loadable,
  type ServiceOfferCardView,
  type ServiceOfferDetailView,
  type ServiceOffersPage,
  type ServiceProviderView,
  type ServicesCapability,
  type ServiceSearchRequest,
} from "@diasporale/features/data"
import { useConvexAuth } from "convex/react"
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

const SERVICES = api.modules.diaspora.services

type CardDto = FunctionReturnType<typeof SERVICES.searchOffers>["page"][number]
type DetailDto = FunctionReturnType<typeof SERVICES.myPageOffers>["page"][number]

function toProvider(page: CardDto["page"]): ServiceProviderView {
  return { id: page.pageId, handle: page.handle, name: page.name, ownerKind: page.ownerKind, badge: page.badge, logoUrl: page.logoUrl }
}

/** La carte du moteur, vue par l'écran (le pays est un code déjà validé par le domaine, côté moteur). */
export function toServiceOfferCard(dto: CardDto): ServiceOfferCardView {
  return {
    id: dto.offerId,
    version: dto.version,
    title: dto.title,
    description: dto.description,
    category: dto.category,
    country: dto.country as CountryCode,
    city: dto.city,
    delivery: dto.delivery,
    languages: dto.languages,
    durationMinutes: dto.durationMinutes,
    pricing: dto.pricing,
    provider: toProvider(dto.page),
    budgetFit: dto.budgetFit,
    updatedAt: dto.updatedAt,
  }
}

export function toServiceOfferDetail(dto: DetailDto): ServiceOfferDetailView {
  return { ...toServiceOfferCard(dto), status: dto.status, viewerCanManage: dto.viewerCanManage }
}

/** Les arguments de recherche du moteur : un filtre absent ou vide n'est pas envoyé. */
export function searchArgsOf(request: ServiceSearchRequest) {
  return {
    ...(request.query !== undefined && request.query.trim().length > 0 ? { query: request.query } : {}),
    ...(request.country !== undefined ? { country: request.country } : {}),
    ...(request.city !== undefined && request.city.trim().length > 0 ? { city: request.city } : {}),
    ...(request.category !== undefined ? { category: request.category } : {}),
    ...(request.delivery !== undefined ? { delivery: request.delivery } : {}),
    ...(request.budget !== undefined ? { maxBudgetMinor: request.budget.amountMinor, currency: request.budget.currency } : {}),
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

function pageOf<Dto, Row>(result: { readonly page: readonly Dto[]; readonly continueCursor: string; readonly isDone: boolean }, map: (dto: Dto) => Row): ServiceOffersPage<Row> {
  return { items: result.page.map(map), continueCursor: result.continueCursor, isDone: result.isDone }
}

export function createEngineServices(deps: EngineSourceDeps): ServicesCapability {
  /** Une écriture dans le réseau `diasporale` : résultat à code fermé, jamais une exception. */
  const write = <T>(work: (networkId: Id<"networks">) => Promise<T>) =>
    attemptAction(async () => await work(await resolveDiasporaleNetworkId(deps.convex)))

  return {
    supportsPageOfferFilters: true,
    supportsManagedOfferStatusFilter: true,
    useSearch(request) {
      const { networkId, refusal } = useReadableNetwork()
      const loaded = useLoaded(
        SERVICES.searchOffers,
        networkId ? { networkId, ...searchArgsOf(request), paginationOpts: { numItems: SERVICE_RESULTS_PAGE_SIZE, cursor: request.cursor } } : "skip",
      )
      return useProjected(refusal, loaded, (result) => ready(pageOf(result, toServiceOfferCard)))
    },

    useOffer(offerId) {
      const { networkId, refusal } = useReadableNetwork()
      const loaded = useLoaded(SERVICES.getOffer, networkId ? { networkId, offerId } : "skip")
      return useProjected(refusal, loaded, (result) => ready(result === null ? null : toServiceOfferDetail(result)))
    },

    usePageOffers({ pageHandle, cursor, category, delivery, personId }) {
      const { networkId, refusal } = useReadableNetwork()
      const auth = useConvexAuth()
      // Les nouveaux lecteurs identifiés se ferment dès la transition réelle de
      // session ; les appels historiques conservent leur contrat de lecture.
      const identified = personId !== undefined
      const canRead = networkId !== null && (personId === undefined || (!auth.isLoading && auth.isAuthenticated && personId.trim().length > 0))
      const loaded = useLoaded(
        SERVICES.pageOffers,
        canRead && networkId ? {
          networkId,
          handle: pageHandle,
          ...(category !== undefined ? { category } : {}),
          ...(delivery !== undefined ? { delivery } : {}),
          ...(personId !== undefined ? { expectedPersonId: personId as Id<"persons"> } : {}),
          paginationOpts: { numItems: SERVICE_RESULTS_PAGE_SIZE, cursor },
        } : "skip",
      )
      const value = loaded.state === "ready" ? loaded.value : undefined
      const code = loaded.state === "error" ? loaded.code : null
      // Une page illisible d'ici : le même refus qu'une page inconnue.
      return useMemo<Loadable<ServiceOffersPage<ServiceOfferCardView>>>(() => {
        if (identified && auth.isLoading) return LOADING
        if (identified && !auth.isAuthenticated) return failed("not_signed_in")
        if (refusal !== null) return failed(refusal)
        if (personId !== undefined && personId.trim().length === 0) return failed("not_found")
        if (code !== null) return failed(code)
        if (!canRead || value === undefined) return LOADING
        return value === null ? failed("not_found") : ready(pageOf(value, toServiceOfferCard))
      }, [identified, auth.isLoading, auth.isAuthenticated, refusal, canRead, networkId, pageHandle, cursor, category, delivery, personId, value, code])
    },

    useMyPageOffers({ pageId, cursor, status, personId }) {
      const { networkId, refusal } = useReadableNetwork()
      const auth = useConvexAuth()
      const identified = personId !== undefined
      const canRead = networkId !== null && (personId === undefined || (!auth.isLoading && auth.isAuthenticated && personId.trim().length > 0))
      const loaded = useLoaded(
        SERVICES.myPageOffers,
        canRead && networkId ? {
          networkId,
          pageId: pageId as Id<"pages">,
          ...(status !== undefined ? { status } : {}),
          ...(personId !== undefined ? { expectedPersonId: personId as Id<"persons"> } : {}),
          paginationOpts: { numItems: MANAGED_OFFERS_PAGE_SIZE, cursor },
        } : "skip",
      )
      const value = loaded.state === "ready" ? loaded.value : undefined
      const code = loaded.state === "error" ? loaded.code : null
      return useMemo<Loadable<ServiceOffersPage<ServiceOfferDetailView>>>(() => {
        if (identified && auth.isLoading) return LOADING
        if (identified && !auth.isAuthenticated) return failed("not_signed_in")
        if (refusal !== null) return failed(refusal)
        if (personId !== undefined && personId.trim().length === 0) return failed("not_found")
        if (code !== null) return failed(code)
        if (!canRead || value === undefined) return LOADING
        return ready(pageOf(value, toServiceOfferDetail))
      }, [identified, auth.isLoading, auth.isAuthenticated, refusal, canRead, networkId, pageId, cursor, status, personId, value, code])
    },

    createOffer: (input) =>
      write(async (networkId) => {
        const created = await deps.convex.mutation(SERVICES.createOffer, {
          networkId,
          pageId: input.pageId as Id<"pages">,
          title: input.title,
          description: input.description,
          category: input.category,
          country: input.country,
          city: input.city,
          delivery: input.delivery,
          languages: [...input.languages],
          durationMinutes: input.durationMinutes,
          pricing: input.pricing,
          publish: input.publish,
        })
        return { offerId: created.offerId as string, version: created.version, status: created.status }
      }),

    updateOffer: (input) =>
      write(async (networkId) =>
        await deps.convex.mutation(SERVICES.updateOffer, {
          networkId,
          offerId: input.offerId as Id<"serviceOffers">,
          expectedVersion: input.expectedVersion,
          title: input.title,
          description: input.description,
          category: input.category,
          country: input.country,
          city: input.city,
          delivery: input.delivery,
          languages: [...input.languages],
          durationMinutes: input.durationMinutes,
          pricing: input.pricing,
        }),
      ),

    setOfferStatus: (input) =>
      write(async (networkId) =>
        await deps.convex.mutation(SERVICES.setOfferStatus, {
          networkId,
          offerId: input.offerId as Id<"serviceOffers">,
          expectedVersion: input.expectedVersion,
          status: input.status,
        }),
      ),
  }
}
