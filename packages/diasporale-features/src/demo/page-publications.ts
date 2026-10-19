"use client"

/**
 * Publications de pages dans le seul navigateur de démonstration. Les rôles
 * viennent de page-admin, les abonnements de pages, les publications et photos
 * déposées du magasin commun. Aucun droit personnel n'est créé par ce port.
 */
import { hasCapability } from "@diasporale/domain"
import { useMemo, useSyncExternalStore } from "react"

import {
  PAGE_MEDIA_KINDS,
  PAGE_PUBLICATIONS_PAGE_SIZE,
  type PageMediaRequest,
  type PagePinnedQuery,
  type PagePublicationsCapability,
  type PageWallRequest,
} from "../data/page-publications-port"
import type { FeedPageQuery } from "../data/types"
import { demoPageReader } from "./pages"
import { canRead, findDemoPage, postDetailView, postView, statusOf } from "./selectors"
import type { DemoState } from "./state"
import type { DemoStore } from "./store"

/** Les lectures locales sont immédiates ; aucune requête distante à relancer. */
const retryLocalWall = () => undefined
const LOADING: FeedPageQuery = { data: undefined, isLoading: true, error: null, retry: retryLocalWall }
const PINNED_LOADING: PagePinnedQuery = { data: undefined, isLoading: true, error: null, retry: retryLocalWall }

function pinnedOf(state: DemoState, handle: string, now: number): PagePinnedQuery {
  const unavailable = (error: PagePinnedQuery["error"]): PagePinnedQuery => ({ data: undefined, isLoading: false, error, retry: retryLocalWall })
  const viewerId = state.session.personId
  if (!viewerId || !state.persons[viewerId]) return unavailable("not_signed_in")
  const membership = state.memberships[viewerId]
  if (!membership) return unavailable("not_member")
  const status = statusOf(state, viewerId, now)
  if (status === null || status === "partie") return unavailable("not_member")
  if (!hasCapability(status, "read_network", { suspensionReadAccess: membership.grounds.suspension?.readAccess ?? "none" })) return unavailable(status === "suspendue" ? "suspended" : "not_member")
  const page = findDemoPage(state, handle)
  const pinnedId = page === null ? undefined : state.pagePinnedPosts?.[page.id]
  const post = pinnedId === undefined ? undefined : state.posts.find((candidate) => candidate.id === pinnedId)
  const data = page !== null && post !== undefined && post.author.kind === "page" && post.author.id === page.id && post.moderation === "published" && canRead(state, post, viewerId, now)
    ? postView(state, post, viewerId, now)
    : null
  return { data, isLoading: false, error: null, retry: retryLocalWall }
}

function wallOf(state: DemoState, { handle, cursor }: PageWallRequest, now: number): FeedPageQuery {
  const unavailable = (error: FeedPageQuery["error"]): FeedPageQuery => ({ data: undefined, isLoading: false, error, retry: retryLocalWall })
  const viewerId = state.session.personId
  if (!viewerId || !state.persons[viewerId]) return unavailable("not_signed_in")
  const membership = state.memberships[viewerId]
  if (!membership) return unavailable("not_member")
  const status = statusOf(state, viewerId, now)
  if (status === null || status === "partie") return unavailable("not_member")
  if (!hasCapability(status, "read_network", { suspensionReadAccess: membership.grounds.suspension?.readAccess ?? "none" })) return unavailable(status === "suspendue" ? "suspended" : "not_member")
  if (cursor !== null && (!Number.isFinite(cursor.publishedAt) || typeof cursor.postId !== "string" || cursor.postId.length === 0 || cursor.postId.length > 200)) return unavailable("unknown")
  const page = findDemoPage(state, handle)
  const eligible = page === null ? [] : state.posts
    .filter((post) => post.author.kind === "page" && post.author.id === page.id)
    .sort((left, right) => right.createdAt - left.createdAt || (left.id === right.id ? 0 : left.id < right.id ? 1 : -1))
    .filter((post) => cursor === null || post.createdAt < cursor.publishedAt || (post.createdAt === cursor.publishedAt && post.id < cursor.postId))
    .flatMap((post) => {
      // La garde commune relit l'audience, la modération et les choix privés.
      const view = postDetailView(state, post.id, viewerId, now)
      return view === null ? [] : [view]
    })
  const items = eligible.slice(0, PAGE_PUBLICATIONS_PAGE_SIZE)
  const last = items.at(-1)
  return {
    data: {
      items,
      nextCursor: eligible.length > PAGE_PUBLICATIONS_PAGE_SIZE && last ? { publishedAt: last.createdAt, postId: last.id } : null,
      lacunar: false,
    },
    isLoading: false,
    error: null,
    retry: retryLocalWall,
  }
}

function mediaOf(state: DemoState, { handle, personId, kind, cursor }: PageMediaRequest, now: number): FeedPageQuery {
  const unavailable = (error: FeedPageQuery["error"]): FeedPageQuery => ({ data: undefined, isLoading: false, error, retry: retryLocalWall })
  const viewerId = state.session.personId
  if (viewerId !== personId) return unavailable("not_found")
  if (!viewerId || !state.persons[viewerId]) return unavailable("not_signed_in")
  const membership = state.memberships[viewerId]
  if (!membership) return unavailable("not_member")
  const status = statusOf(state, viewerId, now)
  if (status === null || status === "partie") return unavailable("not_member")
  if (!hasCapability(status, "read_network", { suspensionReadAccess: membership.grounds.suspension?.readAccess ?? "none" })) return unavailable(status === "suspendue" ? "suspended" : "not_member")
  if (!PAGE_MEDIA_KINDS.includes(kind)) return unavailable("unknown")
  if (cursor !== null && (!Number.isSafeInteger(cursor.publishedAt) || cursor.publishedAt < 0 || typeof cursor.postId !== "string" || cursor.postId.length === 0 || cursor.postId.length > 200)) return unavailable("unknown")
  const page = findDemoPage(state, handle)
  if (page === null) return { data: { items: [], nextCursor: null, lacunar: false }, isLoading: false, error: null, retry: retryLocalWall }
  const eligible = state.posts
    .filter((post) => post.author.kind === "page" && post.author.id === page.id && post.moderation === "published")
    .filter((post) => post.media?.some((item) => kind === "all" || item.kind === kind) === true)
    .filter((post) => canRead(state, post, viewerId, now))
    .sort((left, right) => right.createdAt - left.createdAt || (left.id === right.id ? 0 : left.id < right.id ? 1 : -1))
    .filter((post) => cursor === null || post.createdAt < cursor.publishedAt || (post.createdAt === cursor.publishedAt && post.id < cursor.postId))
  const items = eligible.slice(0, PAGE_PUBLICATIONS_PAGE_SIZE).map((post) => postView(state, post, viewerId, now))
  const last = items.at(-1)
  return {
    data: {
      items,
      nextCursor: eligible.length > PAGE_PUBLICATIONS_PAGE_SIZE && last ? { publishedAt: last.createdAt, postId: last.id } : null,
      lacunar: false,
    },
    isLoading: false,
    error: null,
    retry: retryLocalWall,
  }
}

export function createDemoPagePublications(store: DemoStore): PagePublicationsCapability {
  const reader = demoPageReader(store)
  return {
    media: {
      useMedia(args) {
        const version = useSyncExternalStore(reader.subscribe, reader.getVersion, () => null)
        const { handle, personId, kind, cursor } = args
        return useMemo(() => version === null ? LOADING : mediaOf(store.getState(), { handle, personId, kind, cursor }, store.now()), [version, handle, personId, kind, cursor])
      },
    },
    pinning: {
      usePinned({ handle, personId }) {
        const version = useSyncExternalStore(reader.subscribe, reader.getVersion, () => null)
        return useMemo(() => {
          if (version === null) return PINNED_LOADING
          const state = store.getState()
          if (state.session.personId !== personId) return { data: undefined, isLoading: false, error: "not_found", retry: retryLocalWall } as const
          return pinnedOf(state, handle, store.now())
        }, [version, handle, personId])
      },
      async setPinned(input) {
        return store.setPagePinnedPost(input)
      },
    },
    useWall({ handle, cursor }) {
      const version = useSyncExternalStore(reader.subscribe, reader.getVersion, () => null)
      const publishedAt = cursor?.publishedAt
      const postId = cursor?.postId
      return useMemo(() => version === null ? LOADING : wallOf(store.getState(), {
        handle,
        cursor: publishedAt === undefined || postId === undefined ? null : { publishedAt, postId },
      }, store.now()), [version, handle, publishedAt, postId])
    },
    async publish(input) {
      // Le magasin garde l'autorité vivante, l'idempotence et la consommation
      // des dépôts dans un seul geste synchrone : aucun double envoi entre eux.
      return store.publishPage(input)
    },
    async edit(input) {
      return store.editPagePublication(input)
    },
    async remove(input) {
      return store.removePagePublication(input)
    },
  }
}
