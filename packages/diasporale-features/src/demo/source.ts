"use client"

import { hasCapability, type CountryCode, type FeedScope } from "@diasporale/domain"
import { useMemo, useSyncExternalStore } from "react"

import { describeMediaFile, downscaleImage } from "../data/media"
import type { DemoAccountView, DiasporaleDataSource } from "../data/port"
import type {
  BookmarkView,
  CommentThreadView,
  CommentView,
  FeedCursorView,
  FeedPageQuery,
  FeedPageRequest,
  FeedPageView,
  Loadable,
  MemberHitView,
  NotificationView,
  PostView,
  ProfilePostsPageRequest,
  RelationView,
  SuggestionView,
  UnreadCountView,
} from "../data/types"
import { splitDisplayName, suggestHandles } from "../lib/handle"
import {
  bookmarksView,
  commentsView,
  consentsView,
  countryHubView,
  demoAccountsView,
  feedView,
  memberSearchView,
  openCountriesView,
  pageDetailView,
  postDetailView,
  notificationsView,
  profileView,
  relationView,
  repliesView,
  sessionView,
  sponsorDashboardView,
  statusOf,
  suggestionsView,
  unreadCountView,
} from "./selectors"
import type { DemoStore } from "./store"

const LOADING = { status: "loading" } as const
const FEED_PAGE = 30
/** Les lectures locales sont immédiates ; il n'existe aucune requête distante à relancer. */
const retryLocalFeed = () => undefined

/** Côté le plus long d'une photo gardée par la démonstration (stockage du navigateur : quelques Mo). */
const DEMO_IMAGE_MAX_SIDE = 1280

function ready<T>(data: T): Loadable<T> {
  return { status: "ready", data }
}

/** Même ordre composite pour les pages locales du fil et du mur. */
function localPostsPage(posts: readonly PostView[], cursor: FeedCursorView | null): FeedPageView {
  // Le jeu local ne possède pas `_creationTime` : son identifiant opaque
  // départage les publications de même instant de manière déterministe.
  const items = [...posts]
    .sort((left, right) => right.createdAt - left.createdAt || (left.id === right.id ? 0 : left.id < right.id ? 1 : -1))
    .filter((post) => cursor === null || post.createdAt < cursor.publishedAt || (post.createdAt === cursor.publishedAt && post.id < cursor.postId))
  const page = items.slice(0, FEED_PAGE)
  const last = page.at(-1)
  return {
    items: page,
    nextCursor: items.length > FEED_PAGE && last ? { publishedAt: last.createdAt, postId: last.id } : null,
    lacunar: false,
  }
}

/**
 * La source de données de DÉMONSTRATION, branchée sur un `DemoStore`.
 *
 * Rendu serveur et premier rendu client : « en chargement » (instantané serveur
 * à -1), puis l'état local du navigateur — aucun écart d'hydratation, comme une
 * query Convex qui arrive après le premier rendu.
 */
export function createDemoDataSource(store: DemoStore): DiasporaleDataSource {
  const useVersion = () => useSyncExternalStore(store.subscribe, store.getVersion, () => -1)

  return {
    kind: "demo",

    useSession() {
      const version = useVersion()
      return useMemo(() => (version < 0 ? LOADING : ready(sessionView(store.getState(), store.now()))), [version])
    },

    useOpenCountries() {
      const version = useVersion()
      return useMemo(() => (version < 0 ? LOADING : ready(openCountriesView(store.getState(), store.now()))), [version])
    },

    useCountryHub(country: CountryCode) {
      const version = useVersion()
      return useMemo(
        () => (version < 0 ? LOADING : ready(countryHubView(store.getState(), country, store.now()))),
        [version, country],
      )
    },

    useFeed(args: { scope: FeedScope; hubCountry?: CountryCode }) {
      const version = useVersion()
      const { scope, hubCountry } = args
      return useMemo(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        const viewerId = state.session.personId
        return ready(viewerId ? feedView(state, viewerId, scope, store.now(), hubCountry) : [])
      }, [version, scope, hubCountry])
    },

    useFeedPage(args: FeedPageRequest): FeedPageQuery {
      const version = useVersion()
      const { scope, hubCountry } = args
      const publishedAt = args.cursor?.publishedAt
      const postId = args.cursor?.postId
      return useMemo<FeedPageQuery>(() => {
        if (version < 0) return { data: undefined, isLoading: true, error: null, retry: retryLocalFeed }
        const state = store.getState()
        const viewerId = state.session.personId
        if (!viewerId) return { data: undefined, isLoading: false, error: "not_signed_in", retry: retryLocalFeed }
        const membership = state.memberships[viewerId]
        if (!membership) return { data: undefined, isLoading: false, error: "not_member", retry: retryLocalFeed }
        const status = statusOf(state, viewerId, store.now())
        if (status === null || !hasCapability(status, "read_network", { suspensionReadAccess: membership.grounds.suspension?.readAccess ?? "none" })) {
          return { data: undefined, isLoading: false, error: status === "suspendue" ? "suspended" : "not_member", retry: retryLocalFeed }
        }
        // Le sélecteur applique déjà audiences, réseau, blocages et masquages.
        const posts = feedView(state, viewerId, scope, store.now(), hubCountry)
        return {
          data: localPostsPage(posts, publishedAt === undefined || postId === undefined ? null : { publishedAt, postId }),
          isLoading: false,
          error: null,
          retry: retryLocalFeed,
        }
      }, [version, scope, hubCountry, publishedAt, postId])
    },

    useProfile(handle: string) {
      const version = useVersion()
      return useMemo(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        return ready(profileView(state, handle, state.session.personId, store.now(), { includePosts: false }))
      }, [version, handle])
    },

    useProfilePostsPage(args: ProfilePostsPageRequest): FeedPageQuery {
      const version = useVersion()
      const handle = args.handle.trim().replace(/^@/, "").toLowerCase()
      const publishedAt = args.cursor?.publishedAt
      const postId = args.cursor?.postId
      return useMemo<FeedPageQuery>(() => {
        if (version < 0) return { data: undefined, isLoading: true, error: null, retry: retryLocalFeed }
        const state = store.getState()
        const viewerId = state.session.personId
        if (!viewerId) return { data: undefined, isLoading: false, error: "not_signed_in", retry: retryLocalFeed }
        const membership = state.memberships[viewerId]
        if (!membership) return { data: undefined, isLoading: false, error: "not_member", retry: retryLocalFeed }
        const status = statusOf(state, viewerId, store.now())
        if (status === null || !hasCapability(status, "read_network", { suspensionReadAccess: membership.grounds.suspension?.readAccess ?? "none" })) {
          return { data: undefined, isLoading: false, error: status === "suspendue" ? "suspended" : "not_member", retry: retryLocalFeed }
        }
        // Le profil applique déjà le refus indistinct et les audiences du mur.
        const profile = profileView(state, handle, viewerId, store.now())
        return {
          data: localPostsPage(profile?.posts ?? [], publishedAt === undefined || postId === undefined ? null : { publishedAt, postId }),
          isLoading: false,
          error: null,
          retry: retryLocalFeed,
        }
      }, [version, handle, publishedAt, postId])
    },

    usePage(handle: string) {
      const version = useVersion()
      return useMemo(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        return ready(pageDetailView(state, handle, state.session.personId, store.now()))
      }, [version, handle])
    },

    useRelation(personId: string) {
      const version = useVersion()
      return useMemo<Loadable<RelationView>>(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        const viewerId = state.session.personId
        return viewerId ? ready(relationView(state, viewerId, personId)) : { status: "error", code: "not_signed_in" }
      }, [version, personId])
    },

    useMemberSearch(args: { query: string; country?: CountryCode }) {
      const version = useVersion()
      const { query, country } = args
      return useMemo<Loadable<readonly MemberHitView[]>>(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        const viewerId = state.session.personId
        if (!viewerId) return { status: "error", code: "not_signed_in" }
        // Un compte en attente lit le réseau ; il ne consulte pas l'annuaire.
        const status = statusOf(state, viewerId, store.now())
        if (!status || !hasCapability(status, "view_directory")) return { status: "error", code: "status_insufficient" }
        return ready(memberSearchView(state, viewerId, query, country, store.now()))
      }, [version, query, country])
    },

    usePost(postId: string) {
      const version = useVersion()
      return useMemo<Loadable<PostView | null>>(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        const viewerId = state.session.personId
        return viewerId ? ready(postDetailView(state, postId, viewerId, store.now())) : { status: "error", code: "not_signed_in" }
      }, [version, postId])
    },

    useBookmarks() {
      const version = useVersion()
      return useMemo<Loadable<readonly BookmarkView[]>>(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        const viewerId = state.session.personId
        return viewerId ? ready(bookmarksView(state, viewerId, store.now())) : { status: "error", code: "not_signed_in" }
      }, [version])
    },

    useSuggestions() {
      const version = useVersion()
      return useMemo<Loadable<readonly SuggestionView[]>>(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        const viewerId = state.session.personId
        if (!viewerId) return { status: "error", code: "not_signed_in" }
        const status = statusOf(state, viewerId, store.now())
        if (!status || !hasCapability(status, "view_directory")) return { status: "error", code: "status_insufficient" }
        return ready(suggestionsView(state, viewerId, store.now()))
      }, [version])
    },

    useComments(postId: string) {
      const version = useVersion()
      return useMemo<Loadable<readonly CommentThreadView[]>>(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        const viewerId = state.session.personId
        if (!viewerId) return { status: "error", code: "not_signed_in" }
        const threads = commentsView(state, postId, viewerId, store.now())
        return threads ? ready(threads) : { status: "error", code: "not_found" }
      }, [version, postId])
    },

    useReplies(args: { postId: string; commentId: string | null }) {
      const version = useVersion()
      const { postId, commentId } = args
      return useMemo<Loadable<readonly CommentView[]>>(() => {
        if (version < 0) return LOADING
        if (commentId === null) return ready([])
        const state = store.getState()
        const viewerId = state.session.personId
        if (!viewerId) return { status: "error", code: "not_signed_in" }
        const replies = repliesView(state, postId, commentId, viewerId, store.now())
        return replies ? ready(replies) : { status: "error", code: "not_found" }
      }, [version, postId, commentId])
    },

    useNotifications() {
      const version = useVersion()
      return useMemo<Loadable<readonly NotificationView[]>>(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        const viewerId = state.session.personId
        return viewerId ? ready(notificationsView(state, viewerId)) : { status: "error", code: "not_signed_in" }
      }, [version])
    },

    useUnreadCount() {
      const version = useVersion()
      return useMemo<Loadable<UnreadCountView>>(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        const viewerId = state.session.personId
        return viewerId ? ready(unreadCountView(state, viewerId)) : { status: "error", code: "not_signed_in" }
      }, [version])
    },

    useHandleSuggestions(displayName: string) {
      const version = useVersion()
      return useMemo(() => {
        if (version < 0) return []
        const state = store.getState()
        const person = state.session.personId ? state.persons[state.session.personId] : undefined
        // Les propositions viennent du nom reçu d'IDN, sinon du nom affiché saisi.
        const names = person?.idn
          ? { firstName: person.idn.firstName, lastName: person.idn.lastName }
          : splitDisplayName(displayName)
        const taken = new Set(Object.values(state.persons).map((candidate) => candidate.profile?.handle))
        return suggestHandles(names.firstName, names.lastName).filter((handle) => !taken.has(handle))
      }, [version, displayName])
    },

    useSponsorDashboard() {
      const version = useVersion()
      return useMemo(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        const viewerId = state.session.personId
        return viewerId ? ready(sponsorDashboardView(state, viewerId, store.now())) : { status: "error", code: "not_signed_in" }
      }, [version])
    },

    useMyConsents() {
      const version = useVersion()
      return useMemo(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        const viewerId = state.session.personId
        return viewerId ? ready(consentsView(state, viewerId)) : { status: "error", code: "not_signed_in" }
      }, [version])
    },

    actions: {
      signInWithIdn: (input) => store.signInWithIdn(input),
      requestCode: (destination) => store.requestCode(destination),
      verifyCode: (code) => store.verifyCode(code),
      signOutEverywhere: () => store.signOutEverywhere(),
      checkHandle: (handle) => store.checkHandle(handle),
      join: (input) => store.join(input),
      uploadMedia: async (file) => {
        const facts = await describeMediaFile(file)
        if (!facts.ok) return facts
        // Le stockage du navigateur ne garderait pas une vidéo d'une visite à l'autre : pas de vidéo en démonstration.
        if (facts.value.kind === "video") return { ok: false, code: "feature_unavailable" }
        const image = await downscaleImage(file, DEMO_IMAGE_MAX_SIDE)
        if (!image) return { ok: false, code: "media_upload_failed" }
        return { ok: true, value: store.stageMedia({ kind: "image", url: image.dataUrl, width: image.width, height: image.height }) }
      },
      publish: (input) => store.publish(input),
      react: (postId, kind) => store.react(postId, kind),
      comment: (input) => store.comment(input),
      removeComment: (commentId) => store.removeComment(commentId),
      dismissSuggestion: (handle) => store.dismissSuggestion(handle),
      toggleBookmark: (postId) => store.toggleBookmark(postId),
      hidePost: (postId) => store.hidePost(postId),
      muteAuthor: (personId) => store.muteAuthor(personId),
      reportPost: (input) => store.reportPost(input),
      removePost: (postId) => store.removePost(postId),
      editPost: (postId, body) => store.editPost(postId, body),
      connect: (personId) => store.connect(personId),
      respondToConnection: (connectionId, accept) => store.respondToConnection(connectionId, accept),
      follow: (handle) => store.follow(handle),
      unfollow: (personId) => store.unfollow(personId),
      block: (personId) => store.block(personId),
      unblock: (personId) => store.unblock(personId),
      markNotificationRead: (notificationId) => store.markNotificationRead(notificationId),
      markAllNotificationsRead: () => store.markAllNotificationsRead(),
      sponsor: (handle) => store.sponsor(handle),
      revokeSponsorship: (id) => store.revokeSponsorship(id),
      requestAttestation: () => store.requestAttestation(),
      setConsent: (purpose, granted) => store.setConsent(purpose, granted),
      updateFacet: (input) => store.updateFacet(input),
      setDirectoryVisibility: (level) => store.setDirectoryVisibility(level),
      exportMyData: () => store.exportMyData(),
      deleteMyAccount: () => store.deleteMyAccount(),
    },

    demo: {
      useAccounts() {
        const version = useVersion()
        return useMemo<Loadable<readonly DemoAccountView[]>>(
          () => (version < 0 ? LOADING : ready(demoAccountsView(store.getState()))),
          [version],
        )
      },
      switchTo: (personId) => store.switchTo(personId),
      reset: () => store.reset(),
    },
  }
}
