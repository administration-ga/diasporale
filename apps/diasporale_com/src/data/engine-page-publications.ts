"use client"

/**
 * Publications des pages : chaque fenêtre du mur repasse la garde du moteur ;
 * un changement de lecteur, de page ou de curseur retire les données précédentes.
 * Les écritures utilisent les fonctions génériques des pages, dans DIASPORALE.
 * Le pays d'une publication locale est relu sur la page dont le membre parle ;
 * l'autorité du signataire et les médias sont revalidés par la mutation.
 */
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { parseContentScope } from "@diasporale/domain"
import {
  type FeedPageQuery,
  PAGE_PUBLICATIONS_PAGE_SIZE,
  type PageMediaRequest,
  type PagePinnedQuery,
  type PagePublicationsCapability,
  type PageWallRequest,
  type PostView,
} from "@diasporale/features/data"
import { useConvexAuth } from "convex/react"
import { useMemo } from "react"

import { engineActionErrorCode } from "./engine-errors"
import {
  attemptAction,
  type EngineSourceDeps,
  memberReadError,
  Refusal,
  resolveDiasporaleNetworkId,
  useEngineMember,
  useReadablePostsQuery,
} from "./engine-kit"
import { toDeclaredMedia, toPostView } from "./engine-views"

interface EnginePagePublicationsOptions {
  /** Mémoire des réactions commune au fil, à la fiche et au mur paginé. */
  readonly onPosts?: (posts: readonly PostView[]) => void
}

function useEnginePagePinnedPost({ handle: rawHandle, personId }: { readonly handle: string; readonly personId: string }): PagePinnedQuery {
  const member = useEngineMember()
  const auth = useConvexAuth()
  const id = member.networkId.state === "ready" ? member.networkId.value : null
  const membership = member.membership.state === "ready" ? member.membership.value : null
  const canRead = auth.isAuthenticated && !auth.isLoading && member.auth.isAuthenticated && id !== null && membership?.capabilities.includes("read_network") === true && personId.trim().length > 0
  const handle = rawHandle.trim().replace(/^@/, "").toLowerCase()
  const query = useAuthenticatedConvexQuery(
    api.modules.pages.pages.pagePinnedPost,
    canRead && id ? { networkId: id, handle, expectedPersonId: personId as Id<"persons"> } : "skip",
  )
  const error = memberReadError(member)
    ?? (query.isError ? engineActionErrorCode(query.error) : null)
  const readable = useReadablePostsQuery(query, JSON.stringify(["page-pinned-post", id, personId, handle, canRead]), canRead, error)
  const data = useMemo(() => readable.data === undefined ? undefined : readable.data === null ? null : toPostView(readable.data), [readable.data])
  // Tout refus referme la projection ; aucune référence d'une ancienne session
  // ou d'une annonce devenue illisible n'est transmise à l'écran.
  return { ...readable, data: readable.error === null ? data : undefined }
}

function useEnginePageWall(args: PageWallRequest): FeedPageQuery {
  const member = useEngineMember()
  // Le garde stable sert la navigation ; la perte effective de session ferme
  // immédiatement ce mur, même pendant le délai de stabilisation du garde.
  const auth = useConvexAuth()
  const id = member.networkId.state === "ready" ? member.networkId.value : null
  const membership = member.membership.state === "ready" ? member.membership.value : null
  const canRead = auth.isAuthenticated && !auth.isLoading && member.auth.isAuthenticated && id !== null && membership?.capabilities.includes("read_network") === true
  const handle = args.handle.trim().replace(/^@/, "").toLowerCase()
  const query = useAuthenticatedConvexQuery(
    api.modules.pages.pages.pagePosts,
    canRead && id
      ? {
          networkId: id,
          handle,
          limit: PAGE_PUBLICATIONS_PAGE_SIZE,
          ...(args.cursor ? { cursor: { publishedAt: args.cursor.publishedAt, postId: args.cursor.postId as Id<"posts"> } } : {}),
        }
      : "skip",
  )
  const error = memberReadError(member) ?? (query.isError ? engineActionErrorCode(query.error) : null)
  const page = useReadablePostsQuery(query, JSON.stringify(["page-publications", id, handle, args.cursor, canRead]), canRead, error)
  const data = useMemo(
    () => page.data === undefined ? undefined : { items: page.data.items.map(toPostView), nextCursor: page.data.nextCursor, lacunar: false },
    [page.data],
  )
  return { ...page, data }
}

function useEnginePageMedia(args: PageMediaRequest): FeedPageQuery {
  const member = useEngineMember()
  const auth = useConvexAuth()
  const id = member.networkId.state === "ready" ? member.networkId.value : null
  const membership = member.membership.state === "ready" ? member.membership.value : null
  const canRead = auth.isAuthenticated && !auth.isLoading && member.auth.isAuthenticated && id !== null && membership?.capabilities.includes("read_network") === true && args.personId.trim().length > 0
  const handle = args.handle.trim().replace(/^@/, "").toLowerCase()
  const query = useAuthenticatedConvexQuery(
    api.modules.pages.pages.pageMediaPosts,
    canRead && id
      ? {
          networkId: id,
          handle,
          expectedPersonId: args.personId as Id<"persons">,
          kind: args.kind,
          limit: PAGE_PUBLICATIONS_PAGE_SIZE,
          ...(args.cursor ? { cursor: { publishedAt: args.cursor.publishedAt, postId: args.cursor.postId as Id<"posts"> } } : {}),
        }
      : "skip",
  )
  const error = memberReadError(member) ?? (query.isError ? engineActionErrorCode(query.error) : null)
  const page = useReadablePostsQuery(query, JSON.stringify(["page-media", id, args.personId, handle, args.kind, args.cursor, canRead]), canRead, error)
  const data = useMemo(
    () => page.data === undefined ? undefined : { items: page.data.items.map(toPostView), nextCursor: page.data.nextCursor, lacunar: false },
    [page.data],
  )
  // Une erreur retire aussi les données précédentes : aucune vignette d'une
  // autre session ou d'une audience devenue illisible ne reste exposée.
  return { ...page, data: page.error === null ? data : undefined }
}

export function createEnginePagePublications(deps: EngineSourceDeps, options: EnginePagePublicationsOptions = {}): PagePublicationsCapability {
  let networkId: Id<"networks"> | null = null
  const diasporale = async (): Promise<Id<"networks">> => {
    networkId ??= await resolveDiasporaleNetworkId(deps.convex)
    return networkId
  }

  return {
    media: {
      useMedia(args) {
        const media = useEnginePageMedia(args)
        if (media.data !== undefined) options.onPosts?.(media.data.items)
        return media
      },
    },
    pinning: {
      usePinned(args) {
        const pinned = useEnginePagePinnedPost(args)
        if (pinned.data !== undefined && pinned.data !== null) options.onPosts?.([pinned.data])
        return pinned
      },
      setPinned: (input) =>
        attemptAction(async () => {
          try {
            return await deps.convex.mutation(api.modules.pages.pages.setPagePinnedPost, {
              networkId: await diasporale(),
              pageId: input.pageId as Id<"pages">,
              postId: input.postId as Id<"posts"> | null,
              expectedPinnedPostId: input.expectedPinnedPostId as Id<"posts"> | null,
            })
          } catch (error) {
            if (engineErrorCode(error) === "conflict") throw new Refusal("page_pin_changed")
            throw error
          }
        }),
    },
    useWall(args) {
      const wall = useEnginePageWall(args)
      if (wall.data !== undefined) options.onPosts?.(wall.data.items)
      return wall
    },
    publish: (input) =>
      attemptAction(async () => {
        const id = await diasporale()
        let country: string | null = null
        if (input.reach === "local") {
          // `myPages` ne rend que les pages de ce réseau dont le lecteur est
          // actuellement signataire ; le pays vient de cette carte gardée.
          const pages = await deps.convex.query(api.modules.pages.pages.myPages, { networkId: id })
          const page = pages.find((item) => item.pageId === input.pageId)
          if (!page) throw new Refusal("page_role_required")
          if (page.country === null) throw new Refusal("page_post_country_required")
          country = page.country
        }
        const scope = parseContentScope({ reach: input.reach, country })
        if (!scope.ok) throw new Refusal(scope.code)
        if (scope.value.reach === "local") {
          // Même garde de tranche que le composeur personnel, tant que le
          // crochet de politique serveur ne porte pas encore cette règle.
          const open = await deps.convex.query(api.modules.diaspora.hubs.listOpenCountries, { networkId: id })
          const localCountry = scope.value.country
          if (!open.some((hub) => hub.country === localCountry)) throw new Refusal("feature_unavailable")
        }
        // Aucun contrôle après l'écriture : une panne de lecture ne doit pas
        // transformer une publication réussie en échec affiché au signataire.
        return await deps.convex.mutation(api.modules.pages.pages.publishAsPage, {
          networkId: id,
          pageId: input.pageId as Id<"pages">,
          body: input.body,
          reach: scope.value.reach,
          audience: input.audience,
          idempotencyKey: input.idempotencyKey,
          ...(input.media && input.media.length > 0 ? { media: input.media.map(toDeclaredMedia) } : {}),
        })
      }),
    edit: (input) =>
      attemptAction(async () => {
        const id = await diasporale()
        const postId = input.postId as Id<"posts">
        const post = await deps.convex.query(api.modules.posts.posts.getPost, { networkId: id, postId })
        if (post.page?.pageId !== input.pageId) throw new Refusal("not_found")
        try {
          // Le rôle vivant, la version lue et le contenu sont revalidés dans
          // la mutation ; l'ancien déposant ne conserve aucun droit personnel.
          return await deps.convex.mutation(api.modules.pages.pages.editPagePost, {
            networkId: id,
            pageId: input.pageId as Id<"pages">,
            postId,
            body: input.body,
            expectedBody: input.expectedBody,
            expectedEditedAt: input.expectedEditedAt,
          })
        } catch (error) {
          // Ce conflit signifie une version dépassée uniquement pour ce geste.
          if (engineErrorCode(error) === "conflict") throw new Refusal("page_post_changed")
          throw error
        }
      }),
    remove: (input) =>
      attemptAction(async () => {
        const id = await diasporale()
        const postId = input.postId as Id<"posts">
        const post = await deps.convex.query(api.modules.posts.posts.getPost, { networkId: id, postId })
        if (post.page?.pageId !== input.pageId) throw new Refusal("not_found")
        // Le moteur relit le rôle vivant sur la page de la publication, puis
        // retire la publication ; aucune autorité n'est déduite du seul écran.
        await deps.convex.mutation(api.modules.pages.pages.removePagePost, { networkId: id, postId })
        return null
      }),
  }
}
