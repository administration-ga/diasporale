"use client"

/**
 * Adaptateur moteur de la capacité « gestion des pages » (DG-008).
 * PROPRIÉTAIRE : chantier « gestion des pages ». `useMyPages` est un contrat
 * consommé par le catalogue des services.
 *
 * Fonctions du moteur EXISTANTES, bornées par le réseau `diasporale` :
 *   · `pages.pages` : `myPages`, `getPage`, `createPage` (adhésion `verifiee`) ;
 *   · `pages.identity` : `updatePageIdentity`, `generatePageImageUploadUrl`, `setPageImage` ;
 *   · `pages.signatories` : `listPageSignatories`, `grantPageRole`, `revokePageRole`,
 *     `myPageInvitations`, `respondToPageInvitation` ;
 *   · `pages.claims` : `generateClaimEvidenceUploadUrl`, `requestPageClaim`,
 *     `withdrawPageClaim`, `paginateMyPageClaims`, et, pour la modération du réseau
 *     seule, `paginatePageClaims`, `getPageClaim`, `decidePageClaim`.
 *
 * Garde des fichiers (pièces, logo, bannière) : URL de dépôt d'un usage nommé,
 * dépôt NEUF au moment de l'envoi, rattachement par la mutation qui admet le
 * fichier — jamais un identifiant de stockage réutilisé.
 *
 * Les lectures sont réactives : un rôle retiré disparaît de `getPage`
 * (`viewer.role`) et `listPageSignatories` est aussitôt refusée (`pageRoleRequired`).
 */
import { engineErrorCode, engineErrorRule, type EngineErrorCode } from "@antsia/social-contracts/errors"
import { normalizePageAssociationType, normalizePageCity, normalizePageSector } from "@antsia/social-domain/pagePresentation"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { isCountryCode, type CountryCode, type PageTrustLevel } from "@diasporale/domain"
import {
  isMemberPageKind,
  pageAssociationTypeRefusal,
  pageCityRefusal,
  pageClaimNoteRefusal,
  pageDecisionReasonRefusal,
  pageDescriptionRefusal,
  pageEvidenceSetRefusal,
  pageHandleRefusal,
  pageImageRefusal,
  pageNameRefusal,
  pageSectorRefusal,
  pageShortNameRefusal,
  type ActionErrorCode,
  type ActionResult,
  type CreatePageInput,
  type Loadable,
  type ManagedPageDetailView,
  type ManagedPageView,
  type PageAdminCapability,
  type PageClaimDetailView,
  type PageClaimQueueView,
  type PageClaimView,
  type PageIdentityInput,
  type PageImageSlot,
  type PageImageView,
  type PageInvitationView,
  type PageManagement,
  type PageRefView,
  type PageSignatoryView,
} from "@diasporale/features/data"
import { useQueries, type RequestForQueries } from "convex/react"
import { type FunctionArgs, type FunctionReference, type FunctionReturnType, getFunctionName, makeFunctionReference } from "convex/server"
import { convexToJson, jsonToConvex, type Value } from "convex/values"
import { useMemo } from "react"

import { engineActionErrorCode } from "./engine-errors"
import {
  type EngineSourceDeps,
  failed,
  LOADING,
  type Loaded,
  memberReadError,
  ready,
  Refusal,
  resolveDiasporaleNetworkId,
  useEngineMember,
  useLoaded,
} from "./engine-kit"

/** Mes revendications : la première page du moteur (son plafond). */
const MY_CLAIMS_PAGE = 50
/** La file d'instruction, par pages de vingt. */
const CLAIM_QUEUE_PAGE = 20

// ═══════════════════════════════════════════════════════════════
// Refus du moteur, lus dans le CONTEXTE d'un geste de gestion
// ═══════════════════════════════════════════════════════════════

/**
 * Un refus du moteur se lit d'abord dans le contexte du geste (la même règle de
 * dépôt dit « pièce » pour une revendication et « image » pour un logo), puis
 * par la table commune (`engine-errors.ts`). Jamais une phrase du serveur.
 */
interface RefusalContext {
  readonly codes?: Partial<Record<EngineErrorCode, ActionErrorCode>>
  readonly rules?: Readonly<Record<string, ActionErrorCode>>
  /** `invalidArgument` portant un champ, sans règle (ex. s'habiliter soi-même). */
  readonly fields?: Readonly<Record<string, ActionErrorCode>>
}

/** Les codes du moteur propres aux pages, absents de la table commune. */
const PAGE_ENGINE_CODES: Partial<Record<EngineErrorCode, ActionErrorCode>> = {
  pageRoleRequired: "page_role_required",
}

const PRESENTATION_RULES: Readonly<Record<string, ActionErrorCode>> = {
  PAGE_CITY_INVALID: "page_city_invalid",
  PAGE_CITY_TOO_LONG: "page_city_too_long",
  PAGE_ASSOCIATION_TYPE_INVALID: "page_association_type_invalid",
  PAGE_SECTOR_INVALID: "page_sector_invalid",
}

function errorField(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("data" in error)) return null
  const data = (error as { data: unknown }).data
  if (typeof data !== "object" || data === null || !("field" in data)) return null
  const field = (data as { field: unknown }).field
  return typeof field === "string" ? field : null
}

/** Le code FERMÉ d'un refus reçu pendant un geste de gestion des pages. */
export function pageAdminErrorCode(error: unknown, context: RefusalContext = {}): ActionErrorCode {
  if (error instanceof Refusal) return error.code
  const rule = engineErrorRule(error)
  if (rule) return context.rules?.[rule.rule] ?? engineActionErrorCode(error)
  const code = engineErrorCode(error)
  if (code === "invalidArgument") {
    const field = errorField(error)
    const byField = field ? context.fields?.[field] : undefined
    if (byField) return byField
  }
  if (code) {
    const local = context.codes?.[code] ?? PAGE_ENGINE_CODES[code]
    if (local) return local
  }
  return engineActionErrorCode(error)
}

const CREATE_CONTEXT: RefusalContext = {
  // Créer une page exige une adhésion VÉRIFIÉE : le refus l'explique, il ne dit pas « statut » en général.
  codes: { statusInsufficient: "page_verified_required", handleUnavailable: "page_handle_taken", policyRefused: "not_allowed" },
  rules: { ...PRESENTATION_RULES, POST_COUNTRY_INVALID: "page_country_invalid" },
}
const IDENTITY_CONTEXT: RefusalContext = {
  codes: { policyRefused: "not_allowed" },
  rules: { ...PRESENTATION_RULES, POST_COUNTRY_INVALID: "page_country_invalid" },
}
const IMAGE_CONTEXT: RefusalContext = {
  codes: { conflict: "media_upload_failed" },
  rules: { UPLOAD_TYPE_NOT_ALLOWED: "page_image_type_invalid", UPLOAD_SIZE_OUT_OF_RANGE: "page_image_too_large" },
}
const GRANT_CONTEXT: RefusalContext = {
  // Personne inconnue, non publiée ou hors réseau : le même refus, sans oracle.
  codes: { notFound: "page_member_not_found" },
  fields: { handle: "page_signatory_self" },
}
const INVITATION_CONTEXT: RefusalContext = { codes: { notFound: "page_invitation_gone" } }
const CLAIM_CONTEXT: RefusalContext = {
  codes: { conflict: "media_upload_failed" },
  rules: { UPLOAD_TYPE_NOT_ALLOWED: "page_claim_evidence_type", UPLOAD_SIZE_OUT_OF_RANGE: "page_claim_evidence_too_large" },
}
const DECISION_CONTEXT: RefusalContext = {
  // Déjà tranchée, ou son auteur n'est plus membre actif : la décision n'est plus ouverte.
  codes: { conflict: "page_claim_closed" },
  rules: { DECISION_REASON_LENGTH: "page_decision_reason_length" },
}

async function attempt<T>(work: () => Promise<T>, context: RefusalContext = {}): Promise<ActionResult<T>> {
  try {
    return { ok: true, value: await work() }
  } catch (error) {
    return { ok: false, code: pageAdminErrorCode(error, context) }
  }
}

// ═══════════════════════════════════════════════════════════════
// Lectures
// ═══════════════════════════════════════════════════════════════

/**
 * Une query du moteur dont le refus se lit avec les codes des pages
 * (`pageRoleRequired` n'est pas dans la table commune). Même mémorisation que
 * `useLoaded` : une clé stable, jamais un abonnement relancé à chaque rendu.
 */
function usePageQuery<Query extends FunctionReference<"query">>(query: Query, args: FunctionArgs<Query> | "skip"): Loaded<FunctionReturnType<Query>> {
  const name = getFunctionName(query)
  const argsKey = args === "skip" ? null : JSON.stringify(convexToJson(args as Value))
  const queries = useMemo(() => {
    const request: RequestForQueries = {}
    if (argsKey !== null) {
      request.value = { query: makeFunctionReference<"query">(name), args: jsonToConvex(JSON.parse(argsKey) as never) as Record<string, Value> }
    }
    return request
  }, [name, argsKey])
  const results = useQueries(queries) as Record<string, unknown>
  if (argsKey === null) return { state: "loading" }
  const value = results.value
  if (value === undefined) return { state: "loading" }
  if (value instanceof Error) return { state: "error", code: pageAdminErrorCode(value) }
  return { state: "ready", value: value as FunctionReturnType<Query> }
}

/** Le lecteur peut-il lire DIASPORALE ? Sinon, le refus standard d'une lecture de membre. */
function useReader() {
  const member = useEngineMember()
  const networkId = member.networkId.state === "ready" ? member.networkId.value : null
  const row = member.membership.state === "ready" ? member.membership.value : null
  const refusal = memberReadError(member)
  const settled = refusal === null && member.auth.isAuthenticated && networkId !== null && row !== null
  return { networkId: settled ? networkId : null, row: settled ? row : null, refusal, settled }
}

type Reader = ReturnType<typeof useReader>

/** Une lecture du moteur projetée, MÉMORISÉE sur la réponse : même objet tant que rien ne change. */
function useProjected<T, R>(reader: Reader, loaded: Loaded<T>, project: (value: T) => R): Loadable<R> {
  const state = loaded.state
  const value = loaded.state === "ready" ? loaded.value : undefined
  const code = loaded.state === "error" ? loaded.code : null
  const { refusal, settled } = reader
  return useMemo<Loadable<R>>(() => {
    if (refusal) return failed(refusal)
    if (!settled) return LOADING
    if (state === "error" && code !== null) return failed(code)
    if (state !== "ready") return LOADING
    return ready(project(value as T))
  }, [refusal, settled, state, value, code, project])
}

type PageCard = FunctionReturnType<typeof api.modules.pages.pages.myPages>[number]
type PageDto = NonNullable<FunctionReturnType<typeof api.modules.pages.pages.getPage>>
type ClaimDto = FunctionReturnType<typeof api.modules.pages.claims.paginateMyPageClaims>["page"][number]
type ClaimDetailDto = FunctionReturnType<typeof api.modules.pages.claims.getPageClaim>

/** Le badge d'une PAGE est sa confiance ; tout autre badge n'a pas de sens ici (lu « Communauté »). */
function toPageBadge(badge: string): PageTrustLevel {
  return badge === "official" || badge === "verified" ? badge : "community"
}

function toCountry(country: string | null): CountryCode | null {
  return country !== null && isCountryCode(country) ? country : null
}

function toPageRef(card: Omit<PageCard, "role">): PageRefView {
  return { id: card.pageId, handle: card.handle, name: card.name, ownerKind: card.ownerKind, badge: toPageBadge(card.badge), country: toCountry(card.country) }
}

function toManagedPages(rows: readonly PageCard[]): readonly ManagedPageView[] {
  return rows.map((row) => ({ ...toPageRef(row), role: row.role }))
}

function toManagedPageDetail(page: PageDto | null): ManagedPageDetailView | null {
  if (page === null) return null
  return {
    ...toPageRef(page),
    shortName: page.shortName,
    description: page.description,
    city: page.city ?? null,
    associationType: page.associationType ?? null,
    sector: page.sector ?? null,
    logoUrl: page.logoUrl,
    bannerUrl: page.bannerUrl,
    myRole: page.viewer.role,
  }
}

function toClaimView(claim: ClaimDto): PageClaimView {
  return {
    id: claim.claimId,
    page: toPageRef(claim.page),
    claimant: { personId: claim.claimant.personId, handle: claim.claimant.handle, displayName: claim.claimant.displayName },
    status: claim.status,
    note: claim.note,
    evidenceCount: claim.evidenceCount,
    decisionReason: claim.decisionReason,
    createdAt: claim.createdAt,
    decidedAt: claim.decidedAt,
  }
}

function toClaimViews(result: { readonly page: readonly ClaimDto[] }): readonly PageClaimView[] {
  return result.page.map(toClaimView)
}

function toClaimQueue(result: { readonly page: readonly ClaimDto[]; readonly isDone: boolean; readonly continueCursor: string }): PageClaimQueueView {
  return { items: result.page.map(toClaimView), continueCursor: result.isDone ? null : result.continueCursor }
}

function toClaimDetail(claim: ClaimDetailDto): PageClaimDetailView {
  // Une retenue gagne même si un fournisseur incohérent rend aussi une adresse.
  return { ...toClaimView(claim), evidence: claim.evidence.map((item) => ({ url: item.withheld === null ? item.url : null, withheld: item.withheld })) }
}

function toInvitations(rows: FunctionReturnType<typeof api.modules.pages.signatories.myPageInvitations>): readonly PageInvitationView[] {
  return rows.map((row) => ({ page: toPageRef(row.page), role: row.role, invitedAt: row.invitedAt }))
}

const isReviewerRole = (role: string | undefined) => role === "network_admin" || role === "network_moderator"

/** Réponses constantes : un écran qui compare les références ne voit pas de changement fantôme. */
const NOTHING: Loadable<null> = { status: "ready", data: null }
const NO_SIGNATORIES: Loadable<readonly PageSignatoryView[]> = { status: "ready", data: [] }

// ═══════════════════════════════════════════════════════════════
// La capacité
// ═══════════════════════════════════════════════════════════════

export function createEnginePageAdmin(deps: EngineSourceDeps, options: { fetch?: typeof fetch } = {}): PageAdminCapability {
  const post = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init))
  let networkId: Id<"networks"> | null = null

  async function diasporale(): Promise<Id<"networks">> {
    networkId ??= await resolveDiasporaleNetworkId(deps.convex)
    return networkId
  }

  /** Dépose UN fichier par l'URL que le moteur vient de délivrer pour cet usage ; rend son identifiant de stockage. */
  async function deposit(uploadUrl: string, file: File): Promise<Id<"_storage">> {
    const response = await post(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file })
    if (!response.ok) throw new Refusal("media_upload_failed")
    const uploaded: unknown = await response.json()
    if (uploaded === null || typeof uploaded !== "object" || !("storageId" in uploaded) || typeof uploaded.storageId !== "string") {
      throw new Refusal("media_upload_failed")
    }
    return uploaded.storageId as Id<"_storage">
  }

  const management: PageManagement = {
    supportsPresentation: true,
    useManagedPage(handle: string): Loadable<ManagedPageDetailView | null> {
      const reader = useReader()
      const page = usePageQuery(api.modules.pages.pages.getPage, reader.networkId ? { networkId: reader.networkId, handle } : "skip")
      return useProjected(reader, page, toManagedPageDetail)
    },

    useSignatories(pageId: string | null): Loadable<readonly PageSignatoryView[]> {
      const reader = useReader()
      const me = useLoaded(api.modules.people.persons.getMyPerson, reader.settled ? {} : "skip")
      const rows = usePageQuery(
        api.modules.pages.signatories.listPageSignatories,
        reader.networkId && pageId ? { networkId: reader.networkId, pageId: pageId as Id<"pages"> } : "skip",
      )
      const myId = me.state === "ready" ? me.value?._id ?? null : null
      const project = useMemo(
        () => (list: FunctionReturnType<typeof api.modules.pages.signatories.listPageSignatories>): readonly PageSignatoryView[] =>
          list.map((row) => ({
            personId: row.personId,
            handle: row.handle,
            displayName: row.displayName,
            role: row.role,
            accepted: row.accepted,
            since: row.since,
            isMe: row.personId === myId,
          })),
        [myId],
      )
      const projected = useProjected(reader, rows, project)
      if (pageId === null) return reader.refusal ? failed(reader.refusal) : NO_SIGNATORIES
      // « C'est moi » se relit sur la personne de la session : rien n'est montré avant de le savoir.
      if (projected.status === "ready" && me.state === "loading") return LOADING
      return projected
    },

    useMyInvitations(): Loadable<readonly PageInvitationView[]> {
      const reader = useReader()
      const rows = usePageQuery(api.modules.pages.signatories.myPageInvitations, reader.networkId ? { networkId: reader.networkId } : "skip")
      return useProjected(reader, rows, toInvitations)
    },

    useMyClaims(): Loadable<readonly PageClaimView[]> {
      const reader = useReader()
      const result = usePageQuery(
        api.modules.pages.claims.paginateMyPageClaims,
        reader.networkId ? { networkId: reader.networkId, paginationOpts: { numItems: MY_CLAIMS_PAGE, cursor: null } } : "skip",
      )
      return useProjected(reader, result, toClaimViews)
    },

    useClaimQueue(args): Loadable<PageClaimQueueView | null> {
      const reader = useReader()
      // La file est celle de la modération du réseau : un simple membre n'interroge même pas le moteur.
      const reviewer = isReviewerRole(reader.row?.role)
      const result = usePageQuery(
        api.modules.pages.claims.paginatePageClaims,
        reader.networkId && reviewer ? { networkId: reader.networkId, status: args.status, paginationOpts: { numItems: CLAIM_QUEUE_PAGE, cursor: args.cursor } } : "skip",
      )
      const projected = useProjected(reader, result, toClaimQueue)
      if (reader.settled && !reviewer) return NOTHING
      return projected
    },

    useClaim(claimId: string | null): Loadable<PageClaimDetailView | null> {
      const reader = useReader()
      const claim = usePageQuery(
        api.modules.pages.claims.getPageClaim,
        reader.networkId && claimId ? { networkId: reader.networkId, claimId: claimId as Id<"pageClaims"> } : "skip",
      )
      const projected = useProjected(reader, claim, toClaimDetail)
      if (claimId === null) return reader.refusal ? failed(reader.refusal) : NOTHING
      return projected
    },

    createPage: (input: CreatePageInput) => attempt(async () => {
      if (!isMemberPageKind(input.ownerKind)) throw new Refusal("page_kind_reserved")
      const refusal = pageNameRefusal(input.name) ?? pageHandleRefusal(input)
        ?? (input.shortName ? pageShortNameRefusal(input.shortName) : null)
        ?? (input.description ? pageDescriptionRefusal(input.description) : null)
        ?? pageCityRefusal(input.city)
        ?? pageAssociationTypeRefusal(input.ownerKind, input.associationType)
        ?? pageSectorRefusal(input.ownerKind, input.sector)
      if (refusal) throw new Refusal(refusal)
      if (!isCountryCode(input.country)) throw new Refusal("page_country_invalid")
      const handle = input.handle?.trim()
      const shortName = input.shortName?.trim()
      const description = input.description?.trim()
      const city = normalizePageCity(input.city)
      const associationType = normalizePageAssociationType(input.ownerKind, input.associationType)
      const sector = normalizePageSector(input.ownerKind, input.sector)
      const created = await deps.convex.mutation(api.modules.pages.pages.createPage, {
        networkId: await diasporale(),
        name: input.name,
        ownerKind: input.ownerKind,
        ...(handle ? { handle } : {}),
        ...(shortName ? { shortName } : {}),
        ...(description ? { description } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(associationType !== undefined ? { associationType } : {}),
        ...(sector !== undefined ? { sector } : {}),
        country: input.country,
      })
      return { pageId: created.pageId as string, handle: created.handle }
    }, CREATE_CONTEXT),

    updateIdentity: (pageId: string, input: PageIdentityInput) => attempt(async () => {
      const refusal = pageNameRefusal(input.name)
        ?? (input.shortName ? pageShortNameRefusal(input.shortName) : null)
        ?? (input.description ? pageDescriptionRefusal(input.description) : null)
        ?? pageCityRefusal(input.city)
        // La nature réelle est relue par le serveur avec le rôle vivant ; ici, la valeur seule est validée.
        ?? pageAssociationTypeRefusal("association", input.associationType)
        ?? pageSectorRefusal("company", input.sector)
      if (refusal) throw new Refusal(refusal)
      if (input.country !== null && !isCountryCode(input.country)) throw new Refusal("page_country_invalid")
      const shortName = input.shortName?.trim() || null
      const description = input.description?.trim() || null
      return await deps.convex.mutation(api.modules.pages.identity.updatePageIdentity, {
        networkId: await diasporale(),
        pageId: pageId as Id<"pages">,
        name: input.name,
        shortName,
        description,
        country: input.country,
        ...(input.city !== undefined ? { city: normalizePageCity(input.city) ?? null } : {}),
        ...(input.associationType !== undefined ? { associationType: normalizePageAssociationType("association", input.associationType) ?? null } : {}),
        ...(input.sector !== undefined ? { sector: normalizePageSector("company", input.sector) ?? null } : {}),
      })
    }, IDENTITY_CONTEXT),

    setImage: (pageId: string, slot: PageImageSlot, file: File | null) => attempt<PageImageView>(async () => {
      // Une image refusée ne quitte pas le navigateur.
      const refusal = file === null ? null : pageImageRefusal(slot, file)
      if (refusal) throw new Refusal(refusal)
      const network = await diasporale()
      let image: { url: string | null; withheld: PageImageView["withheld"] }
      if (file === null) {
        image = await deps.convex.mutation(api.modules.pages.identity.setPageImage, { networkId: network, pageId: pageId as Id<"pages">, slot, storageId: null })
      } else {
        const uploadUrl = await deps.convex.mutation(api.modules.pages.identity.generatePageImageUploadUrl, { networkId: network, slot })
        const storageId = await deposit(uploadUrl, file)
        image = await deps.convex.mutation(api.modules.pages.identity.setPageImage, {
          networkId: network,
          pageId: pageId as Id<"pages">,
          slot,
          storageId,
          ...(file.type ? { mimeType: file.type } : {}),
        })
      }
      // Une retenue gagne même si un fournisseur incohérent rend aussi une adresse.
      return { url: image.withheld === null ? image.url : null, withheld: image.withheld }
    }, IMAGE_CONTEXT),

    grantRole: (pageId, handle, role) => attempt(async () => {
      const target = handle.trim().replace(/^@/, "").toLowerCase()
      if (target.length === 0) throw new Refusal("page_member_handle_required")
      const granted = await deps.convex.mutation(api.modules.pages.signatories.grantPageRole, {
        networkId: await diasporale(),
        pageId: pageId as Id<"pages">,
        handle: target,
        role,
      })
      return { personId: granted.personId as string, role: granted.role, invited: granted.invited }
    }, GRANT_CONTEXT),

    revokeRole: (pageId, personId) => attempt(async () =>
      await deps.convex.mutation(api.modules.pages.signatories.revokePageRole, {
        networkId: await diasporale(),
        pageId: pageId as Id<"pages">,
        personId: personId as Id<"persons">,
      })),

    respondToInvitation: (pageId, accept) => attempt(async () =>
      await deps.convex.mutation(api.modules.pages.signatories.respondToPageInvitation, {
        networkId: await diasporale(),
        pageId: pageId as Id<"pages">,
        accept,
      }), INVITATION_CONTEXT),

    requestClaim: (input) => attempt(async () => {
      // Les pièces sont jugées AVANT tout dépôt : un fichier refusé ne quitte pas le navigateur.
      const refusal = pageEvidenceSetRefusal(input.evidence) ?? (input.note ? pageClaimNoteRefusal(input.note) : null)
      if (refusal) throw new Refusal(refusal)
      const network = await diasporale()
      const evidence: { storageId: Id<"_storage">; mimeType?: string }[] = []
      // Temps 1 de la garde des fichiers, pièce par pièce : une URL neuve, un dépôt neuf.
      for (const file of input.evidence) {
        const uploadUrl = await deps.convex.mutation(api.modules.pages.claims.generateClaimEvidenceUploadUrl, { networkId: network })
        const storageId = await deposit(uploadUrl, file)
        evidence.push({ storageId, ...(file.type ? { mimeType: file.type } : {}) })
      }
      // Temps 2 : la demande ADMET les pièces (dépôts neufs de la personne), privées, à l'analyse.
      const note = input.note?.trim()
      const claim = await deps.convex.mutation(api.modules.pages.claims.requestPageClaim, {
        networkId: network,
        pageId: input.pageId as Id<"pages">,
        ...(note ? { note } : {}),
        evidence,
      })
      return { claimId: claim.claimId as string }
    }, CLAIM_CONTEXT),

    withdrawClaim: (claimId) => attempt(async () =>
      await deps.convex.mutation(api.modules.pages.claims.withdrawPageClaim, { networkId: await diasporale(), claimId: claimId as Id<"pageClaims"> })),

    decideClaim: (claimId, decision, reason) => attempt(async () => {
      const refusal = pageDecisionReasonRefusal(reason)
      if (refusal) throw new Refusal(refusal)
      return await deps.convex.mutation(api.modules.pages.claims.decidePageClaim, {
        networkId: await diasporale(),
        claimId: claimId as Id<"pageClaims">,
        decision,
        reason: reason.trim(),
      })
    }, DECISION_CONTEXT),
  }

  return {
    useMyPages(): Loadable<readonly ManagedPageView[]> {
      const reader = useReader()
      const rows = usePageQuery(api.modules.pages.pages.myPages, reader.networkId ? { networkId: reader.networkId } : "skip")
      return useProjected(reader, rows, toManagedPages)
    },
    management,
  }
}
