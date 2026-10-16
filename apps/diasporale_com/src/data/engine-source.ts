"use client"

/**
 * La source de données « moteur » de DIASPORALE (PD2) : la même interface que la
 * démonstration (`DiasporaleDataSource`), branchée sur le moteur ANTSIA.
 *
 * - Lectures : abonnements Convex aux fonctions du moteur — tranche `diaspora`
 *   (adhésion, hubs, parrainage, consentements) et chemins génériques (personne,
 *   profil, fil) — toutes bornées par le réseau `diasporale`. Une erreur du
 *   serveur devient un état `error` à code fermé, jamais un écran blanc.
 * - Écritures : client Convex et client Better Auth (codes à usage unique) ;
 *   chacune rend un résultat à code FERMÉ (`errors.<code>`), jamais une exception.
 * - Ce que le moteur ne sert pas encore rend `feature_unavailable` : IDN et SMS
 *   (PA4), export et effacement (PA5), profils et pages (PD4, PD5) — jamais une
 *   donnée inventée. L'attestation consulaire (PD3) rend `attestation_unavailable`
 *   tant que le déploiement n'a pas sa clé de service.
 */
import type { EngineAuthClient } from "@antsia/api/auth-client"
import { signOutEverywhere } from "@antsia/api/sign-out-everywhere"
import { useAuthenticatedConvexQuery, useStableConvexAuth } from "@antsia/api/hooks"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  type CountryCode,
  DIASPORALE_NETWORK_SLUG,
  type FeedScope,
  parseContentScope,
  parseResidenceCountry,
} from "@diasporale/domain"
import type {
  ActionErrorCode,
  ActionResult,
  BookmarkView,
  CommentThreadView,
  CommentView,
  ConsentView,
  CountryHubView,
  DiasporaleActions,
  DiasporaleDataSource,
  FeedPageQuery,
  FeedPageRequest,
  Loadable,
  MemberHitView,
  OpenCountryView,
  PostView,
  NotificationView,
  ProfileView,
  ProfilePostsPageRequest,
  ReactionKind,
  RelationView,
  SessionView,
  SponsorDashboardView,
  SuggestionView,
  UnreadCountView,
} from "@diasporale/features/data"
import { COMMENTS_PAGE, describeMediaFile, MEMBER_SEARCH_MIN_LENGTH } from "@diasporale/features/data"
import { type ConvexReactClient, type RequestForQueries, useQueries } from "convex/react"
import { type FunctionArgs, type FunctionReference, type FunctionReturnType, getFunctionName, makeFunctionReference } from "convex/server"
import { convexToJson, jsonToConvex, type Value } from "convex/values"
import { useCallback, useMemo } from "react"

import { routes } from "@/lib/routes"
import { clearDiasporaleDrafts } from "@/lib/sign-out-state"

import { authActionErrorCode, engineActionErrorCode } from "./engine-errors"
import { createEngineProfileImagesActions } from "./engine-profile-images"
import {
  toAccountView,
  toConsentViews,
  toCountryHubView,
  toDeclaredMedia,
  toFacetArgs,
  toFeed,
  toBookmarkView,
  toCommentThreadView,
  toCommentView,
  toMemberHitView,
  toMembershipView,
  toWall,
  toNotificationView,
  toOpenCountries,
  toPostView,
  toProfileView,
  toRelationView,
  toSuggestionView,
  toSponsorDashboardView,
} from "./engine-views"

/** Taille d'une fenêtre du fil DIASPORALE (le moteur accepte jusqu'à cinquante lignes). */
const FEED_PAGE = 30

/**
 * La requête du fil pour une portée. « Pour vous » et « Récents » sont celles du
 * moteur ; « Mon pays » et « Toute la diaspora » composent ses voies selon LA
 * règle du domaine (`isShownInHub`) : le local du pays, plus toute la diaspora.
 */
export function feedRequest(scope: FeedScope, country: CountryCode) {
  switch (scope) {
    case "pour_vous":
      return { scope: "pour_vous" as const }
    case "recents":
      return { scope: "recents" as const }
    case "mon_pays":
      return { lanes: [{ reach: "local", country }, { reach: "diaspora" }] }
    case "diaspora":
      return { lanes: [{ reach: "diaspora" }] }
  }
}
/** La première page de la cloche. */
const BELL_PAGE = 30
/** Les réponses d'une racine, lues d'un coup à la demande. */
const REPLIES_PAGE = 50
/** Les signets lus d'un coup (première page). */
const BOOKMARKS_PAGE = 50

const LOADING = { status: "loading" } as const

function ready<T>(data: T): Loadable<T> {
  return { status: "ready", data }
}

function failed<T>(code: ActionErrorCode): Loadable<T> {
  return { status: "error", code }
}

type Loaded<T> = { readonly state: "loading" } | { readonly state: "error"; readonly code: ActionErrorCode } | { readonly state: "ready"; readonly value: T }

/**
 * Une query du moteur dont l'erreur se LIT (`useQueries` la rend au lieu de la
 * lever) : un refus du serveur devient un code fermé, pas un écran d'erreur.
 *
 * L'objet de requêtes est MÉMORISÉ sur une clé stable (nom de la fonction et
 * arguments sérialisés), comme le fait le `useQuery` de Convex : un objet neuf à
 * chaque rendu relancerait l'abonnement à chaque rendu, sans fin.
 */
function useLoaded<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query> | "skip",
): Loaded<FunctionReturnType<Query>> {
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
  if (value instanceof Error) return { state: "error", code: engineActionErrorCode(value) }
  return { state: "ready", value: value as FunctionReturnType<Query> }
}

/** Le réseau `diasporale`, résolu par son identifiant public (projection publique du moteur). */
function useNetworkId(): Loaded<Id<"networks"> | null> {
  const network = useLoaded(api.modules.networks.networks.getBySlug, { slug: DIASPORALE_NETWORK_SLUG })
  if (network.state !== "ready") return network
  return { state: "ready", value: network.value?._id ?? null }
}

export interface EngineSourceDeps {
  readonly convex: ConvexReactClient
  readonly authClient: EngineAuthClient
  /** Attente entre deux lectures de l'issue d'une attestation (remplaçable dans les tests). */
  readonly sleep?: (ms: number) => Promise<void>
}

/** L'issue d'une attestation se lit au plus quinze secondes : au-delà, elle est tenue pour indisponible. */
export const ATTESTATION_POLL_MS = 750
export const ATTESTATION_POLLS = 20

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function createEngineDataSource(deps: EngineSourceDeps): DiasporaleDataSource {
  /** Réactions connues du lecteur, relevées par le fil : « retirer ma réaction » rejoue la même. */
  const myReactions = new Map<string, ReactionKind | null>()

  function useMember() {
    const auth = useStableConvexAuth()
    const networkId = useNetworkId()
    const id = networkId.state === "ready" ? networkId.value : null
    const membership = useLoaded(api.modules.diaspora.membership.myMembership, auth.isAuthenticated && id ? { networkId: id } : "skip")
    return { auth, networkId, membership }
  }

  return {
    kind: "engine",
    profileImages: createEngineProfileImagesActions({ convex: deps.convex }),

    useSession(): Loadable<SessionView> {
      const { auth, networkId, membership } = useMember()
      const signedIn = auth.isAuthenticated
      const person = useLoaded(api.modules.people.persons.getMyPerson, signedIn ? {} : "skip")
      const identity = useLoaded(api.modules.diaspora.membership.myIdentity, signedIn ? {} : "skip")
      const authSession = deps.authClient.useSession() as { data?: { user?: { email?: string | null } } | null }
      if (auth.isPending) return LOADING
      if (auth.isUnauthenticated) return ready({ status: "anonymous" })
      for (const loaded of [networkId, person, identity, membership]) if (loaded.state === "error") return failed(loaded.code)
      if (networkId.state !== "ready" || person.state !== "ready" || identity.state !== "ready") return LOADING
      if (networkId.value === null) return failed("network_unavailable")
      // La personne naît à la première session (`ensureMyPerson`) : un instant, elle n'existe pas encore.
      if (person.value === null || identity.value === null || membership.state !== "ready") return LOADING
      return ready({
        status: "signed_in",
        account: toAccountView(person.value, identity.value, authSession.data?.user?.email ?? null),
        membership: membership.value ? toMembershipView(person.value, membership.value) : null,
      })
    },

    useOpenCountries(): Loadable<readonly OpenCountryView[]> {
      const networkId = useNetworkId()
      const id = networkId.state === "ready" ? networkId.value : null
      const hubs = useLoaded(api.modules.diaspora.hubs.listOpenCountries, id ? { networkId: id } : "skip")
      if (networkId.state === "error") return failed(networkId.code)
      if (networkId.state === "ready" && networkId.value === null) return failed("network_unavailable")
      if (hubs.state === "error") return failed(hubs.code)
      return hubs.state === "ready" ? ready(toOpenCountries(hubs.value)) : LOADING
    },

    useCountryHub(country: CountryCode): Loadable<CountryHubView> {
      const { networkId } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const hub = useLoaded(api.modules.diaspora.hubs.getCountryHub, id ? { networkId: id, country } : "skip")
      if (networkId.state === "error") return failed(networkId.code)
      if (hub.state === "error") return failed(hub.code)
      return hub.state === "ready" ? ready(toCountryHubView(hub.value, country)) : LOADING
    },

    useFeed(args: { scope: FeedScope; hubCountry?: CountryCode }): Loadable<readonly PostView[]> {
      const { networkId, membership } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const memberCountry = membership.state === "ready" ? membership.value?.facet?.countryOfResidence : undefined
      const country = args.hubCountry ?? (memberCountry !== undefined && parseResidenceCountry(memberCountry).ok ? (memberCountry as CountryCode) : null)
      const feed = useLoaded(api.modules.posts.posts.myFeed, id && country ? { networkId: id, limit: FEED_PAGE, ...feedRequest(args.scope, country) } : "skip")
      for (const loaded of [networkId, membership, feed]) if (loaded.state === "error") return failed(loaded.code)
      if (membership.state !== "ready") return LOADING
      if (country === null) return failed("not_member")
      if (feed.state !== "ready") return LOADING
      const posts = toFeed(feed.value.items, args.scope, country)
      for (const post of posts) myReactions.set(post.id, post.myReaction)
      return ready(posts)
    },

    useFeedPage(args: FeedPageRequest): FeedPageQuery {
      const { auth, networkId, membership } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const member = membership.state === "ready" ? membership.value : null
      const residence = member?.facet?.countryOfResidence
      const country = args.hubCountry ?? (residence !== undefined && parseResidenceCountry(residence).ok ? (residence as CountryCode) : null)
      const canRead = auth.isAuthenticated && id !== null && country !== null && member?.capabilities.includes("read_network") === true
      const query = useAuthenticatedConvexQuery(
        api.modules.posts.posts.myFeed,
        canRead && id && country ? {
          networkId: id,
          limit: FEED_PAGE,
          ...feedRequest(args.scope, country),
          ...(args.cursor ? { cursor: { publishedAt: args.cursor.publishedAt, postId: args.cursor.postId as Id<"posts"> } } : {}),
        } : "skip",
      )
      const refetch = query.refetch
      const retry = useCallback(() => {
        if (canRead) void refetch().catch(() => undefined)
      }, [canRead, refetch])

      let error: ActionErrorCode | null = null
      if (auth.isUnauthenticated) error = "not_signed_in"
      else if (networkId.state === "error") error = networkId.code
      else if (membership.state === "error") error = membership.code
      else if (networkId.state === "ready" && id === null) error = "network_unavailable"
      else if (membership.state === "ready" && (!member || country === null)) error = "not_member"
      else if (member && !member.capabilities.includes("read_network")) error = member.status === "suspendue" ? "suspended" : "not_member"
      if (error !== null) return { data: undefined, isLoading: false, error, retry }
      if (!canRead) return { data: undefined, isLoading: true, error: null, retry }

      const items = query.data === undefined ? undefined : toFeed(query.data.items, args.scope, country as CountryCode)
      if (items) for (const post of items) myReactions.set(post.id, post.myReaction)
      return {
        data: query.data === undefined || items === undefined ? undefined : { items, nextCursor: query.data.nextCursor, lacunar: query.data.lacunar },
        isLoading: query.data === undefined && !query.isError,
        error: query.isError ? engineActionErrorCode(query.error) : null,
        retry,
      }
    },

    useProfile(handle: string): Loadable<ProfileView | null> {
      const { networkId } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const args = id ? { networkId: id, handle } : "skip"
      const profile = useLoaded(api.modules.people.profile.getPublicProfile, args)
      const member = useLoaded(api.modules.diaspora.profile.memberFacet, args)
      for (const loaded of [networkId, profile, member]) if (loaded.state === "error") return failed(loaded.code)
      if (profile.state !== "ready" || member.state !== "ready") return LOADING
      // Inconnu, non publié, hors réseau ou bloqué : le même « introuvable ».
      if (!profile.value || !member.value) return ready(null)
      return ready(toProfileView(profile.value, member.value))
    },

    useProfilePostsPage(args: ProfilePostsPageRequest): FeedPageQuery {
      const { auth, networkId, membership } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const member = membership.state === "ready" ? membership.value : null
      const canRead = auth.isAuthenticated && id !== null && member?.capabilities.includes("read_network") === true
      const query = useAuthenticatedConvexQuery(
        api.modules.posts.posts.personPosts,
        canRead && id ? {
          networkId: id,
          handle: args.handle.trim().replace(/^@/, "").toLowerCase(),
          limit: FEED_PAGE,
          ...(args.cursor ? { cursor: { publishedAt: args.cursor.publishedAt, postId: args.cursor.postId as Id<"posts"> } } : {}),
        } : "skip",
      )
      const refetch = query.refetch
      const retry = useCallback(() => {
        if (canRead) void refetch().catch(() => undefined)
      }, [canRead, refetch])

      let error: ActionErrorCode | null = null
      if (auth.isUnauthenticated) error = "not_signed_in"
      else if (networkId.state === "error") error = networkId.code
      else if (membership.state === "error") error = membership.code
      else if (networkId.state === "ready" && id === null) error = "network_unavailable"
      else if (membership.state === "ready" && !member) error = "not_member"
      else if (member && !member.capabilities.includes("read_network")) error = member.status === "suspendue" ? "suspended" : "not_member"
      if (error !== null) return { data: undefined, isLoading: false, error, retry }
      if (!canRead) return { data: undefined, isLoading: true, error: null, retry }

      const items = query.data === undefined ? undefined : toWall({ items: query.data.items, pinned: args.cursor ? null : query.data.pinned })
      if (items) for (const post of items) myReactions.set(post.id, post.myReaction)
      return {
        data: query.data === undefined || items === undefined ? undefined : { items, nextCursor: query.data.nextCursor, lacunar: false },
        isLoading: query.data === undefined && !query.isError,
        error: query.isError ? engineActionErrorCode(query.error) : null,
        retry,
      }
    },

    useRelation(personId: string): Loadable<RelationView> {
      const { networkId } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const other = personId as Id<"persons">
      const connection = useLoaded(api.modules.graph.connections.connectionWith, id ? { networkId: id, otherPersonId: other } : "skip")
      const following = useLoaded(api.modules.graph.follows.isFollowing, id ? { networkId: id, targetPersonId: other } : "skip")
      for (const loaded of [networkId, connection, following]) if (loaded.state === "error") return failed(loaded.code)
      if (connection.state !== "ready" || following.state !== "ready") return LOADING
      return ready(toRelationView(connection.value, following.value))
    },

    useMemberSearch(args: { query: string; country?: CountryCode }): Loadable<readonly MemberHitView[]> {
      const { networkId } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const term = args.query.trim()
      const searching = term.length >= MEMBER_SEARCH_MIN_LENGTH
      const hits = useLoaded(
        api.modules.diaspora.directory.searchMembers,
        id && searching ? { networkId: id, query: term, ...(args.country ? { country: args.country } : {}) } : "skip",
      )
      if (networkId.state === "error") return failed(networkId.code)
      if (!searching) return ready([])
      if (hits.state === "error") return failed(hits.code)
      return hits.state === "ready" ? ready(hits.value.map(toMemberHitView)) : LOADING
    },

    usePost(postId: string): Loadable<PostView | null> {
      const { networkId } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const post = useLoaded(api.modules.posts.posts.getPost, id ? { networkId: id, postId: postId as Id<"posts"> } : "skip")
      if (networkId.state === "error") return failed(networkId.code)
      // Introuvable, illisible ou bloqué : le moteur répond « notFound », l'écran dit « introuvable ».
      if (post.state === "error") return post.code === "not_found" ? ready(null) : failed(post.code)
      if (post.state !== "ready") return LOADING
      const view = toPostView(post.value)
      myReactions.set(view.id, view.myReaction)
      return ready(view)
    },

    useBookmarks(): Loadable<readonly BookmarkView[]> {
      const { networkId } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const page = useLoaded(api.modules.marks.marks.paginateBookmarks, id ? { networkId: id, paginationOpts: { numItems: BOOKMARKS_PAGE, cursor: null } } : "skip")
      for (const loaded of [networkId, page]) if (loaded.state === "error") return failed(loaded.code)
      return page.state === "ready" ? ready(page.value.page.map(toBookmarkView)) : LOADING
    },

    useSuggestions(): Loadable<readonly SuggestionView[]> {
      const { networkId } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const list = useLoaded(api.modules.diaspora.suggestions.forMe, id ? { networkId: id } : "skip")
      for (const loaded of [networkId, list]) if (loaded.state === "error") return failed(loaded.code)
      return list.state === "ready" ? ready(list.value.map(toSuggestionView)) : LOADING
    },

    useComments(postId: string): Loadable<readonly CommentThreadView[]> {
      const { networkId } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const page = useLoaded(
        api.modules.engagement.engagement.paginateComments,
        id ? { networkId: id, postId: postId as Id<"posts">, paginationOpts: { numItems: COMMENTS_PAGE, cursor: null } } : "skip",
      )
      for (const loaded of [networkId, page]) if (loaded.state === "error") return failed(loaded.code)
      return page.state === "ready" ? ready(page.value.page.map(toCommentThreadView)) : LOADING
    },

    useReplies(args: { postId: string; commentId: string | null }): Loadable<readonly CommentView[]> {
      const { networkId } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const page = useLoaded(
        api.modules.engagement.engagement.paginateReplies,
        id && args.commentId
          ? {
              networkId: id,
              postId: args.postId as Id<"posts">,
              commentId: args.commentId as Id<"postComments">,
              paginationOpts: { numItems: REPLIES_PAGE, cursor: null },
            }
          : "skip",
      )
      if (args.commentId === null) return ready([])
      for (const loaded of [networkId, page]) if (loaded.state === "error") return failed(loaded.code)
      return page.state === "ready" ? ready(page.value.page.map(toCommentView)) : LOADING
    },

    useNotifications(): Loadable<readonly NotificationView[]> {
      const { networkId } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const page = useLoaded(api.modules.notifications.bell.paginateNotifications, id ? { networkId: id, paginationOpts: { numItems: BELL_PAGE, cursor: null } } : "skip")
      for (const loaded of [networkId, page]) if (loaded.state === "error") return failed(loaded.code)
      return page.state === "ready" ? ready(page.value.page.map(toNotificationView)) : LOADING
    },

    useUnreadCount(): Loadable<UnreadCountView> {
      const { networkId } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const count = useLoaded(api.modules.notifications.bell.unreadCount, id ? { networkId: id } : "skip")
      for (const loaded of [networkId, count]) if (loaded.state === "error") return failed(loaded.code)
      return count.state === "ready" ? ready(count.value) : LOADING
    },

    // Les pages du réseau (officielles, associations, entreprises) : PD5. Rien n'est inventé d'ici là.
    usePage: () => failed("feature_unavailable"),

    useHandleSuggestions(displayName: string): readonly string[] {
      const auth = useStableConvexAuth()
      const name = displayName.trim()
      const suggestions = useLoaded(api.modules.people.profile.suggestHandles, auth.isAuthenticated && name.length >= 2 ? { displayName: name } : "skip")
      return suggestions.state === "ready" ? suggestions.value.filter((item) => item.available).map((item) => item.handle) : []
    },

    useSponsorDashboard(): Loadable<SponsorDashboardView> {
      const { networkId } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const dashboard = useLoaded(api.modules.diaspora.membership.sponsorDashboard, id ? { networkId: id } : "skip")
      if (networkId.state === "error") return failed(networkId.code)
      if (dashboard.state === "error") return failed(dashboard.code)
      return dashboard.state === "ready" ? ready(toSponsorDashboardView(dashboard.value)) : LOADING
    },

    useMyConsents(): Loadable<readonly ConsentView[]> {
      const { auth, networkId } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const consents = useLoaded(api.modules.diaspora.membership.myConsents, auth.isAuthenticated && id ? { networkId: id } : "skip")
      if (networkId.state === "error") return failed(networkId.code)
      if (consents.state === "error") return failed(consents.code)
      return consents.state === "ready" ? ready(toConsentViews(consents.value)) : LOADING
    },

    actions: createEngineActions(deps, myReactions),
    demo: null,
  }
}

/** Les écritures : un résultat à code fermé, jamais une exception jusqu'à l'écran. */
export function createEngineActions(deps: EngineSourceDeps, myReactions: Map<string, ReactionKind | null> = new Map()): DiasporaleActions {
  let networkId: Id<"networks"> | null = null
  /** L'adresse à laquelle le dernier code a été envoyé (la vérification la reprend). */
  let pendingEmail: string | null = null

  class Refusal extends Error {
    constructor(readonly code: ActionErrorCode) {
      super(code)
    }
  }

  async function diasporale(): Promise<Id<"networks">> {
    if (networkId) return networkId
    const network = await deps.convex.query(api.modules.networks.networks.getBySlug, { slug: DIASPORALE_NETWORK_SLUG })
    if (!network) throw new Refusal("network_unavailable")
    networkId = network._id
    return networkId
  }

  async function attempt<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
    try {
      return { ok: true, value: await work() }
    } catch (error) {
      return { ok: false, code: error instanceof Refusal ? error.code : engineActionErrorCode(error) }
    }
  }

  const unavailable = async (): Promise<ActionResult<never>> => ({ ok: false, code: "feature_unavailable" })

  return {
    // IDN entre par Better Auth avec l'identité du moteur (PA4).
    signInWithIdn: unavailable,

    async requestCode(destination) {
      // Le SMS arrive avec l'identité du moteur (PA4).
      if (destination.kind !== "email") return { ok: false, code: "feature_unavailable" }
      const email = destination.value.trim().toLowerCase()
      const sent = await deps.authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" })
      if (sent.error) return { ok: false, code: authActionErrorCode(sent.error) }
      pendingEmail = email
      // En développement LOCAL seulement (outils ouverts et backend local), le moteur rend le code ; ailleurs, `null`.
      const dev = await deps.convex.query(api.modules.platform.devTools.latestOtp, { email }).catch(() => null)
      return { ok: true, value: { demoCode: dev?.code ?? null } }
    },

    async verifyCode(code) {
      if (!pendingEmail) return { ok: false, code: "code_expired" }
      const signedIn = await deps.authClient.signIn.emailOtp({ email: pendingEmail, otp: code.trim() })
      if (signedIn.error) return { ok: false, code: authActionErrorCode(signedIn.error) }
      pendingEmail = null
      // Rechargement complet : la session amorce proprement le jeton Convex de la personne qui arrive.
      if (typeof window !== "undefined") window.location.assign(routes.welcome())
      return { ok: true, value: null }
    },

    async signOutEverywhere() {
      const result = await signOutEverywhere(deps.authClient, {
        resetLocalState: () => {
          myReactions.clear()
          networkId = null
          pendingEmail = null
          clearDiasporaleDrafts()
        },
      })
      // Navigation complète : ferme aussi les connexions de l'onglet ; l'avis survit au rechargement.
      if (typeof window !== "undefined") window.location.assign(routes.enterAfterSignOut(!result.serverRevoked || !result.localCleared))
    },

    checkHandle: (handle) => attempt(() => deps.convex.query(api.modules.people.profile.isHandleAvailable, { handle })),

    join: (input) =>
      attempt(async () => {
        if (!input.consents.social_profile) throw new Refusal("consent_social_profile_required")
        const country = parseResidenceCountry(input.facet.countryOfResidence)
        if (!country.ok) throw new Refusal(country.code)
        const id = await diasporale()
        await deps.convex.mutation(api.modules.people.profile.publishMyProfile, { handle: input.handle, displayName: input.displayName })
        await deps.convex.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
        if (input.consents.directory) {
          await deps.convex.mutation(api.modules.people.consents.recordConsent, { purpose: "directory", origin: "onboarding", networkId: id })
        }
        if (input.consents.notifications) {
          await deps.convex.mutation(api.modules.people.consents.recordConsent, { purpose: "notifications", origin: "onboarding" })
        }
        await deps.convex.mutation(api.modules.diaspora.membership.joinDiasporale, {
          networkId: id,
          facet: toFacetArgs(input.facet),
          directoryVisibility: input.consents.directory ? input.directoryVisibility : "hidden",
        })
        return { country: country.value }
      }),

    // Dépôt en deux temps (garde des fichiers du moteur) : URL de dépôt pour l'usage
    // `media_social`, puis envoi du fichier ; il n'existe pour personne tant
    // qu'une publication ne l'a pas vérifié et embarqué.
    uploadMedia: (file) =>
      attempt(async () => {
        const facts = await describeMediaFile(file)
        if (!facts.ok) throw new Refusal(facts.code)
        const networkId = await diasporale()
        const url = await deps.convex.mutation(api.modules.media.media.generateUploadUrl, { networkId, usage: "media_social" })
        let storageId: string
        try {
          const response = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file })
          if (!response.ok) throw new Refusal("media_upload_failed")
          storageId = ((await response.json()) as { storageId: string }).storageId
        } catch (error) {
          throw error instanceof Refusal ? error : new Refusal("media_upload_failed")
        }
        return { ref: storageId, ...facts.value }
      }),

    publish: (input) =>
      attempt(async () => {
        const scope = parseContentScope({ reach: input.reach, country: input.country ?? null })
        if (!scope.ok) throw new Refusal(scope.code)
        const networkId = await diasporale()
        // Relecture avant publication (invariant 10) : tant que le moteur ne retient pas un contenu
        // (PA5), un pays qui n'est pas ouvert ne reçoit pas de publication locale. Garde d'écran
        // seulement : la garde serveur viendra avec le crochet de politique de la tranche.
        if (scope.value.reach === "local") {
          const local = scope.value.country
          const open = await deps.convex.query(api.modules.diaspora.hubs.listOpenCountries, { networkId })
          if (!open.some((hub) => hub.country === local)) throw new Refusal("feature_unavailable")
        }
        await deps.convex.mutation(api.modules.posts.posts.publish, {
          networkId,
          body: input.body,
          audience: input.audience,
          reach: scope.value.reach,
          ...(scope.value.country !== undefined ? { country: scope.value.country } : {}),
          alsoOnRoot: input.alsoOnRoot && input.audience === "public",
          ...(input.media && input.media.length > 0 ? { media: input.media.map(toDeclaredMedia) } : {}),
          // Partage cité : le moteur re-garde l'original, et cite l'original d'un partage.
          ...(input.sharedPostId ? { sharedPostId: input.sharedPostId as Id<"posts"> } : {}),
          ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        })
        return { moderation: "published" as const }
      }),

    comment: (input) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.engagement.engagement.comment, {
          networkId: await diasporale(),
          postId: input.postId as Id<"posts">,
          body: input.body,
          ...(input.parentCommentId !== undefined ? { parentCommentId: input.parentCommentId as Id<"postComments"> } : {}),
        })
        return null
      }),

    removeComment: (commentId) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.engagement.engagement.removeComment, {
          networkId: await diasporale(),
          commentId: commentId as Id<"postComments">,
        })
        return null
      }),

    dismissSuggestion: (handle) =>
      attempt(async () => {
        // Le masquage GÉNÉRIQUE du moteur, par réseau : la tranche le relit pour écarter la personne.
        await deps.convex.mutation(api.modules.suggestions.suggestions.dismiss, { networkId: await diasporale(), handle })
        return null
      }),

    toggleBookmark: (postId) =>
      attempt(async () => {
        const result = await deps.convex.mutation(api.modules.marks.marks.toggleMark, {
          networkId: await diasporale(),
          postId: postId as Id<"posts">,
          kind: "bookmark",
        })
        return { bookmarked: result.marked }
      }),

    hidePost: (postId) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.marks.marks.hidePost, { networkId: await diasporale(), postId: postId as Id<"posts"> })
        return null
      }),

    muteAuthor: (personId) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.marks.marks.muteAuthor, { networkId: await diasporale(), targetPersonId: personId as Id<"persons"> })
        return null
      }),

    reportPost: (input) =>
      attempt(async () => {
        const note = input.note?.trim()
        await deps.convex.mutation(api.modules.moderation.moderation.reportPost, {
          networkId: await diasporale(),
          postId: input.postId as Id<"posts">,
          reason: input.reason,
          ...(note ? { note } : {}),
        })
        return null
      }),

    editPost: (postId, body) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.posts.posts.edit, { networkId: await diasporale(), postId: postId as Id<"posts">, body })
        return null
      }),

    removePost: (postId) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.posts.posts.remove, { networkId: await diasporale(), postId: postId as Id<"posts"> })
        return null
      }),

    react: (postId, kind) =>
      attempt(async () => {
        // Le moteur bascule une réaction : la rejouer la retire.
        const toggle = kind ?? myReactions.get(postId) ?? null
        if (toggle === null) return null
        const result = await deps.convex.mutation(api.modules.engagement.engagement.toggleReaction, {
          networkId: await diasporale(),
          postId: postId as Id<"posts">,
          kind: toggle,
        })
        myReactions.set(postId, result.mine)
        return null
      }),

    connect: (personId) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.graph.connections.requestConnection, { networkId: await diasporale(), targetPersonId: personId as Id<"persons"> })
        return null
      }),

    respondToConnection: (connectionId, accept) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.graph.connections.respondToConnection, {
          networkId: await diasporale(),
          connectionId: connectionId as Id<"connections">,
          accept,
        })
        return null
      }),

    follow: (handle) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.graph.follows.follow, { networkId: await diasporale(), handle: handle.trim().replace(/^@/, "") })
        return null
      }),

    unfollow: (personId) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.graph.follows.unfollow, { networkId: await diasporale(), targetPersonId: personId as Id<"persons"> })
        return null
      }),

    block: (personId) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.graph.connections.blockPerson, { networkId: await diasporale(), targetPersonId: personId as Id<"persons"> })
        return null
      }),

    unblock: (personId) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.graph.connections.unblockPerson, { networkId: await diasporale(), targetPersonId: personId as Id<"persons"> })
        return null
      }),

    markNotificationRead: (notificationId) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.notifications.bell.markRead, {
          networkId: await diasporale(),
          notificationId: notificationId as Id<"notifications">,
        })
        return null
      }),

    markAllNotificationsRead: () =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.notifications.bell.markAllRead, { networkId: await diasporale() })
        return null
      }),

    sponsor: (handle) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.diaspora.membership.sponsor, { networkId: await diasporale(), handle })
        return null
      }),

    revokeSponsorship: (sponsorshipId) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.diaspora.membership.revokeSponsorship, {
          networkId: await diasporale(),
          sponsorshipId: sponsorshipId as Id<"sponsorships">,
        })
        return null
      }),

    // L'attestation consulaire (DIASPORA-ATTESTATION-V1) : le geste vaut consentement (écran de
    // consentement explicite) ; la réponse de consulat.ga arrive par une action planifiée.
    requestAttestation: () =>
      attempt(async () => {
        const id = await diasporale()
        const { attestationId } = await deps.convex.mutation(api.modules.diaspora.attestation.requestConsularAttestation, {
          networkId: id,
          consent: true,
        })
        for (let poll = 0; poll < ATTESTATION_POLLS; poll += 1) {
          const { result } = await deps.convex.query(api.modules.diaspora.attestation.myAttestationRequest, { networkId: id, attestationId })
          if (result === "verified") return { outcome: "verified" as const }
          if (result === "not_confirmed") return { outcome: "not_confirmed" as const }
          if (result === "failed") throw new Refusal("attestation_unavailable")
          await (deps.sleep ?? realSleep)(ATTESTATION_POLL_MS)
        }
        throw new Refusal("attestation_unavailable")
      }),

    setConsent: (purpose, granted) =>
      attempt(async () => {
        const id = await diasporale()
        // L'annuaire est propre au réseau ; les autres finalités valent pour la personne.
        const scope = purpose === "directory" ? { networkId: id } : {}
        if (granted) {
          await deps.convex.mutation(api.modules.people.consents.recordConsent, { purpose, origin: "settings", ...scope })
          return null
        }
        await deps.convex.mutation(api.modules.people.consents.revokeConsent, { purpose, ...scope })
        // Sans consentement, l'annuaire se referme aussi dans les réglages (il ne compte déjà plus).
        if (purpose === "directory") {
          await deps.convex.mutation(api.modules.diaspora.facet.setDirectoryVisibility, { networkId: id, level: "hidden" })
        }
        return null
      }),

    updateFacet: (input) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.diaspora.facet.updateMyFacet, { networkId: await diasporale(), facet: toFacetArgs(input) })
        return null
      }),

    setDirectoryVisibility: (level) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.diaspora.facet.setDirectoryVisibility, { networkId: await diasporale(), level })
        return null
      }),

    // Export et effacement : exécutés par le moteur (PA5).
    exportMyData: unavailable,
    deleteMyAccount: unavailable,
  }
}
