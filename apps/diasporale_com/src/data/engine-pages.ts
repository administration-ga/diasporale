"use client"

/**
 * Adaptateur moteur de la capacité « pages » (DG-007) et de la fiche `usePage`
 * du port principal. PROPRIÉTAIRE : chantier « pages ».
 *
 * - La fiche : `pages.getPage` (identité, badge calculé, compteurs de l'agrégat,
 *   images par la garde des fichiers, rôle VIVANT et abonnement du lecteur), la
 *   première fenêtre de `pages.pagePosts` (chaque publication repassée par la
 *   garde du fil) et `diaspora.hubPages.pageStanding` (revendicabilité jugée par
 *   la tranche). `null` du moteur → `null` : inconnue, retirée ou d'ailleurs, la
 *   même réponse. Un refus → une erreur à code fermé, et le cache se retire
 *   (`useReadablePostsQuery`) ; une reprise relit les trois lectures.
 * - L'annuaire : `pages.paginateDiscover` — la recherche dès deux caractères,
 *   sinon l'ordre de l'annuaire (confiance, puis récence) ; fenêtres bornées,
 *   filtres pays, nature et catégorie avant pagination, curseur opaque du moteur,
 *   `isDone` pour la fin.
 * - Mes pages suivies : `pages.paginateMyPageFollows`, par récence d'abonnement,
 *   avec les mêmes gardes de lecture et de retrait du cache que l'annuaire.
 * - Le hub : `diaspora.hubPages.listCountryPages`, bornée par nature.
 * - Suivre / ne plus suivre : `pages.follow` / `pages.unfollow`, idempotents ;
 *   la fiche, abonnée, se met à jour d'elle-même.
 */
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import type { CountryCode } from "@diasporale/domain"
import {
  type ActionErrorCode,
  type HubPagesQuery,
  type PageDetailQuery,
  type PageDirectoryQuery,
  type PageDirectoryRequest,
  type PagesCapability,
  type PostView,
  PAGE_DIRECTORY_PAGE_SIZE,
  PAGE_DIRECTORY_QUERY_MIN_LENGTH,
  normalizePageDirectoryCategories,
} from "@diasporale/features/data"
import { useCallback, useMemo } from "react"
import { useConvexAuth } from "convex/react"

import { engineActionErrorCode } from "./engine-errors"
import {
  attemptAction,
  type EngineMember,
  type EngineSourceDeps,
  memberReadError,
  Refusal,
  resolveDiasporaleNetworkId,
  useEngineMember,
  useReadablePostsQuery,
} from "./engine-kit"
import { toHubPagesView, toPageDetailView, toPageDirectoryPage } from "./engine-views"

/** La première fenêtre du mur d'une page (le moteur plafonne à cinquante). */
export const PAGE_POSTS_WINDOW = 20

export interface EnginePagesOptions {
  /**
   * Relève les publications lues dans une fiche, comme le fil le fait pour sa
   * mémoire des réactions (« retirer ma réaction » rejoue la même) ; facultatif.
   */
  readonly onPosts?: (posts: readonly PostView[]) => void
}

/** Ce que le lecteur peut lire d'ici : le réseau, et le refus standard d'une lecture de membre. */
function readerOf(member: EngineMember) {
  const id = member.networkId.state === "ready" ? member.networkId.value : null
  const row = member.membership.state === "ready" ? member.membership.value : null
  const canRead = member.auth.isAuthenticated && id !== null && row?.capabilities.includes("read_network") === true
  return { id, canRead, error: memberReadError(member) }
}

function queryError(query: { readonly isError: boolean; readonly error: unknown }): ActionErrorCode | null {
  return query.isError ? engineActionErrorCode(query.error) : null
}

/** La fiche d'une page lisible d'ici (`null` : introuvable ou illisible, même réponse). */
export function useEnginePage(handle: string): PageDetailQuery {
  const member = useEngineMember()
  const { id, canRead, error: memberError } = readerOf(member)
  const key = handle.trim()
  const args = canRead && id ? { networkId: id, handle: key } : "skip"
  const pageQuery = useAuthenticatedConvexQuery(api.modules.pages.pages.getPage, args)
  const wallQuery = useAuthenticatedConvexQuery(api.modules.pages.pages.pagePosts, canRead && id ? { networkId: id, handle: key, limit: PAGE_POSTS_WINDOW } : "skip")
  const standingQuery = useAuthenticatedConvexQuery(api.modules.diaspora.hubPages.pageStanding, args)
  const requestKey = JSON.stringify(["page", id, key, canRead])
  // Un refus retire le cache de CHAQUE lecture : seule une réponse fraîche rouvre la fiche.
  const page = useReadablePostsQuery(pageQuery, `${requestKey}:fiche`, canRead, memberError ?? queryError(pageQuery))
  const wall = useReadablePostsQuery(wallQuery, `${requestKey}:mur`, canRead, memberError ?? queryError(wallQuery))
  const standing = useReadablePostsQuery(standingQuery, `${requestKey}:statut`, canRead, memberError ?? queryError(standingQuery))
  const view = useMemo(() => {
    if (page.data === undefined || wall.data === undefined || standing.data === undefined) return undefined
    return page.data === null ? null : toPageDetailView(page.data, wall.data, standing.data)
  }, [page.data, wall.data, standing.data])
  const retryPage = page.retry
  const retryWall = wall.retry
  const retryStanding = standing.retry
  const retry = useCallback(() => {
    retryPage()
    retryWall()
    retryStanding()
  }, [retryPage, retryWall, retryStanding])
  const error = page.error ?? wall.error ?? standing.error
  if (error !== null) return { status: "error", code: error, retry }
  if (view === undefined) return { status: "loading", retry }
  return { status: "ready", data: view, retry }
}

/** L'annuaire paginé des pages du réseau `diasporale`. */
function useEngineDirectory(args: PageDirectoryRequest): PageDirectoryQuery {
  const member = useEngineMember()
  const { id, canRead, error: memberError } = readerOf(member)
  const term = args.query.trim()
  const searching = term.length >= PAGE_DIRECTORY_QUERY_MIN_LENGTH
  const categories = normalizePageDirectoryCategories(args)
  const allowed = canRead && categories.ok
  const categoryError = canRead && !categories.ok ? categories.code : null
  const query = useAuthenticatedConvexQuery(
    api.modules.pages.pages.paginateDiscover,
    allowed && id && categories.ok
      ? {
          networkId: id,
          ...(searching ? { query: term } : {}),
          ...(args.country ? { country: args.country } : {}),
          ...categories.value,
          paginationOpts: { numItems: PAGE_DIRECTORY_PAGE_SIZE, cursor: args.cursor },
        }
      : "skip",
  )
  const requestKey = JSON.stringify(["pages-directory", id, searching ? term : null, args.country ?? null, categories.ok ? categories.value.ownerKind ?? null : args.ownerKind ?? null, args.associationType ?? null, args.sector ?? null, args.cursor, allowed])
  const readable = useReadablePostsQuery(query, requestKey, allowed, memberError ?? categoryError ?? queryError(query))
  const data = useMemo(() => (readable.data === undefined ? undefined : toPageDirectoryPage(readable.data)), [readable.data])
  const retry = readable.retry
  if (readable.error !== null) return { status: "error", code: readable.error, retry }
  if (data === undefined) return { status: "loading", retry }
  return { status: "ready", data, retry }
}

/** Mes abonnements : le moteur ne retourne que les pages encore lisibles par ce lecteur. */
function useEngineFollowedPages(args: { readonly cursor: string | null }): PageDirectoryQuery {
  const member = useEngineMember()
  const { id, canRead, error: memberError } = readerOf(member)
  const auth = useConvexAuth()
  const canIdentify = canRead && auth.isAuthenticated && !auth.isLoading
  const person = useAuthenticatedConvexQuery(api.modules.people.persons.getMyPerson, canIdentify ? {} : "skip")
  const personId = person.data?._id ?? null
  const allowed = canIdentify && personId !== null && !person.isError
  const query = useAuthenticatedConvexQuery(
    api.modules.pages.pages.paginateMyPageFollows,
    allowed && id
      ? { networkId: id, paginationOpts: { numItems: PAGE_DIRECTORY_PAGE_SIZE, cursor: args.cursor } }
      : "skip",
  )
  const requestKey = JSON.stringify(["pages-followed", id, personId, args.cursor, allowed])
  const identityError = person.isSuccess && person.data === null ? "not_signed_in" as const : null
  const readable = useReadablePostsQuery(query, requestKey, allowed, memberError ?? queryError(person) ?? identityError ?? queryError(query))
  const data = useMemo(() => (readable.data === undefined ? undefined : toPageDirectoryPage(readable.data)), [readable.data])
  const retry = readable.retry
  if (readable.error !== null) return { status: "error", code: readable.error, retry }
  if (data === undefined) return { status: "loading", retry }
  return { status: "ready", data, retry }
}

/** Les pages officielles, associations et entreprises d'un pays (tranche `diaspora`). */
function useEngineHubPages(country: CountryCode): HubPagesQuery {
  const member = useEngineMember()
  const { id, canRead, error: memberError } = readerOf(member)
  const query = useAuthenticatedConvexQuery(api.modules.diaspora.hubPages.listCountryPages, canRead && id ? { networkId: id, country } : "skip")
  const readable = useReadablePostsQuery(query, JSON.stringify(["hub-pages", id, country, canRead]), canRead, memberError ?? queryError(query))
  const data = useMemo(() => (readable.data === undefined ? undefined : toHubPagesView(readable.data, country)), [readable.data, country])
  const retry = readable.retry
  if (readable.error !== null) return { status: "error", code: readable.error, retry }
  if (data === undefined) return { status: "loading", retry }
  return { status: "ready", data, retry }
}

export function createEnginePages(deps: EngineSourceDeps, options: EnginePagesOptions = {}): PagesCapability {
  let networkId: Id<"networks"> | null = null
  const diasporale = async (): Promise<Id<"networks">> => {
    networkId ??= await resolveDiasporaleNetworkId(deps.convex)
    return networkId
  }

  return {
    supportsDirectoryCategories: true,
    usePage(handle) {
      const detail = useEnginePage(handle)
      if (detail.status === "ready" && detail.data !== null) options.onPosts?.(detail.data.posts)
      return detail
    },
    useDirectory: useEngineDirectory,
    useFollowedPages: useEngineFollowedPages,
    useHubPages: useEngineHubPages,
    follow: (handle) =>
      attemptAction(async () => {
        await deps.convex.mutation(api.modules.pages.pages.follow, { networkId: await diasporale(), handle: handle.trim() })
        return { following: true }
      }),
    unfollow: (handle) =>
      attemptAction(async () => {
        const id = await diasporale()
        // Le moteur désabonne par identifiant : la page se relit par son adresse, sous la garde de la fiche.
        const page = await deps.convex.query(api.modules.pages.pages.getPage, { networkId: id, handle: handle.trim() })
        if (!page) throw new Refusal("not_found")
        await deps.convex.mutation(api.modules.pages.pages.unfollow, { networkId: id, pageId: page.pageId })
        return { following: false }
      }),
  }
}
