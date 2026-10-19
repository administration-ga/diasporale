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
 *   (PA4) — jamais une donnée inventée. L'attestation consulaire (PD3) rend
 *   `attestation_unavailable` tant que le déploiement n'a pas sa clé de service.
 * - Les capacités du plan global (docs/14 : pages, gestion des pages, services,
 *   demandes, droits personnels, associations, avis) vivent chacune dans son
 *   fichier `engine-<capacité>.ts`, sur les briques communes de `engine-kit.ts`.
 */
import type { EngineAuthClient } from "@antsia/api/auth-client"
import { signOutEverywhere } from "@antsia/api/sign-out-everywhere"
import { isMemberThemeId } from "@antsia/social-contracts/appearance"
import { isSupportedLocale } from "@diasporale/features/i18n"
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
  BookmarksPageQuery,
  BookmarksPageRequest,
  BookmarksPageView,
  CommentThreadView,
  CommentView,
  ConsentView,
  ContentPreferenceItem,
  ContentPreferencesPage,
  ContentPreferencesQuery,
  ContentPreferencesRequest,
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
import { BOOKMARKS_PAGE_SIZE, COMMENTS_PAGE, describeMediaFile, MEMBER_SEARCH_MIN_LENGTH } from "@diasporale/features/data"
import { type ConvexReactClient, type RequestForQueries, useQueries } from "convex/react"
import { type FunctionArgs, type FunctionReference, type FunctionReturnType, getFunctionName, makeFunctionReference } from "convex/server"
import { convexToJson, jsonToConvex, type Value } from "convex/values"
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"

import { routes } from "@/lib/routes"
import { clearDiasporaleDrafts } from "@/lib/sign-out-state"

import { authActionErrorCode, engineActionErrorCode } from "./engine-errors"
import {
  type EngineSourceDeps,
  failed,
  LOADING,
  type Loaded,
  PAGE_ACCESS_ERRORS,
  ready,
  Refusal,
  useEngineMember,
  useLoaded,
  useNetworkId,
  useReadablePostsQuery,
} from "./engine-kit"
import { createEngineAssociations } from "./engine-associations"
import { createEngineDataRights } from "./engine-data-rights"
import { createEnginePageAdmin } from "./engine-page-admin"
import { createEnginePages, useEnginePage } from "./engine-pages"
import { createEnginePagePublications } from "./engine-page-publications"
import { createEngineProfileImagesActions } from "./engine-profile-images"
import { createEngineServiceRequests } from "./engine-service-requests"
import { createEngineServiceReviews } from "./engine-service-reviews"
import { createEngineAssociationActivities } from "./engine-association-activities"
import { createEngineServices } from "./engine-services"
import { createEngineContentReports } from "./engine-content-reports"
import { createEngineMutualAid } from "./engine-mutual-aid"
import { createEngineArrivalKit } from "./engine-arrival-kit"
import { createEngineMentoring } from "./engine-mentoring"
import { createEngineJobs } from "./engine-jobs"
import { createEngineModerationDesk } from "./engine-moderation-desk"
import { createEnginePilotMetrics } from "./engine-pilot-metrics"
import { createEngineConversations } from "./engine-conversations"
import { createEngineDemoAccounts } from "./engine-demo-accounts"
import { createEnginePageDecisions } from "./engine-page-decisions"
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
  toOwnProfileView,
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
const BOOKMARKS_PAGE = BOOKMARKS_PAGE_SIZE

/** L'issue d'une attestation se lit au plus quinze secondes : au-delà, elle est tenue pour indisponible. */
export const ATTESTATION_POLL_MS = 750
export const ATTESTATION_POLLS = 20

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export type { EngineSourceDeps } from "./engine-kit"

export function createEngineDataSource(deps: EngineSourceDeps): DiasporaleDataSource {
  /** Réactions connues du lecteur, relevées par le fil : « retirer ma réaction » rejoue la même. */
  const myReactions = new Map<string, ReactionKind | null>()

  async function ownPerson(personId: string) {
    const person = await deps.convex.query(api.modules.people.persons.getMyPerson, {})
    if (!person) throw new Refusal("not_signed_in")
    if (person._id !== personId) throw new Refusal("not_found")
    return person
  }

  async function profileCommand(work: () => Promise<void>): Promise<ActionResult> {
    try {
      await work()
      return { ok: true, value: null }
    } catch (error) {
      return { ok: false, code: error instanceof Refusal ? error.code : engineActionErrorCode(error) }
    }
  }

  const useMember = useEngineMember
  const associationActivities = createEngineAssociationActivities(deps)

  return {
    kind: "engine",
    profileImages: createEngineProfileImagesActions({ convex: deps.convex }),
    // Capacités des chantiers du plan global (docs/14), chacune dans son fichier.
    // Les publications lues dans une fiche de page alimentent aussi « retirer ma réaction ».
    pages: createEnginePages(deps, { onPosts: (posts) => { for (const post of posts) myReactions.set(post.id, post.myReaction) } }),
    pagePublications: createEnginePagePublications(deps, { onPosts: (posts) => { for (const post of posts) myReactions.set(post.id, post.myReaction) } }),
    pageAdmin: createEnginePageAdmin(deps),
    services: createEngineServices(deps),
    serviceRequests: createEngineServiceRequests(deps),
    dataRights: createEngineDataRights(deps),
    associations: createEngineAssociations(deps),
    associationGroups: associationActivities.groups,
    associationEvents: associationActivities.events,
    serviceReviews: createEngineServiceReviews(deps),
    contentReports: createEngineContentReports(deps),
    // Vague H du plan global (entraide, kit d'arrivée, mentorat, emploi, modération, mesure).
    mutualAid: createEngineMutualAid(deps),
    arrivalKit: createEngineArrivalKit(deps),
    mentoring: createEngineMentoring(deps),
    jobs: createEngineJobs(deps),
    moderationDesk: createEngineModerationDesk(deps),
    pilotMetrics: createEnginePilotMetrics(deps),
    // P16 · G9 : décisions qui ont retiré un contenu porté par une page, et leur recours.
    pageDecisions: createEnginePageDecisions(deps),
    conversations: createEngineConversations(deps),
    // Comptes de démonstration par acteur : développement local du moteur seulement.
    demoAccounts: createEngineDemoAccounts(deps),
    contentPreferences: {
      usePage(args: ContentPreferencesRequest): ContentPreferencesQuery {
        const { auth, networkId, membership } = useMember()
        const id = networkId.state === "ready" ? networkId.value : null
        const member = membership.state === "ready" ? membership.value : null
        const canRead = auth.isAuthenticated && id !== null && member?.capabilities.includes("read_network") === true
        const reference = args.kind === "hiddenPosts"
          ? api.modules.diaspora.contentPreferences.paginateHiddenPosts
          : api.modules.diaspora.contentPreferences.paginateMutedAuthors
        const query = useAuthenticatedConvexQuery(reference, canRead && id ? {
          networkId: id,
          expectedPersonId: args.personId as Id<"persons">,
          paginationOpts: { cursor: args.cursor, numItems: 20 },
        } : "skip")
        let error: ActionErrorCode | null = query.isError ? engineActionErrorCode(query.error) : null
        if (auth.isUnauthenticated) error = "not_signed_in"
        else if (networkId.state === "error") error = networkId.code
        else if (membership.state === "error") error = membership.code
        else if (networkId.state === "ready" && id === null) error = "network_unavailable"
        else if (membership.state === "ready" && !member) error = "not_member"
        else if (member && !member.capabilities.includes("read_network")) error = member.status === "suspendue" ? "suspended" : "not_member"
        const requestKey = JSON.stringify([id, args.personId, args.kind, args.cursor, canRead])
        // Le cache d'un ancien lecteur ou d'une page refusée ne réautorise jamais la lecture.
        const readable = useReadablePostsQuery<{ page: ContentPreferenceItem[]; continueCursor: string; isDone: boolean }>(query, requestKey, canRead, error)
        const retry = async () => { readable.retry() }
        if (readable.error) return { ...failed<ContentPreferencesPage>(readable.error), retry }
        if (readable.data === undefined) return { ...LOADING, retry }
        return {
          status: "ready",
          data: {
            items: readable.data.page.map((row) => ({
              choiceId: row.choiceId,
              at: row.at,
              postId: row.postId,
              body: row.body,
              author: row.author,
            })),
            continueCursor: readable.data.isDone ? null : readable.data.continueCursor,
            isDone: readable.data.isDone,
          },
          retry,
        }
      },
      async restore({ personId, kind, choiceId }) {
        try {
          await ownPerson(personId)
          const network = await deps.convex.query(api.modules.networks.networks.getBySlug, { slug: DIASPORALE_NETWORK_SLUG })
          if (!network) throw new Refusal("network_unavailable")
          const result = kind === "hiddenPosts"
            ? await deps.convex.mutation(api.modules.diaspora.contentPreferences.restoreHiddenPost, {
              networkId: network._id,
              expectedPersonId: personId as Id<"persons">,
              choiceId: choiceId as Id<"postMarks">,
            })
            : await deps.convex.mutation(api.modules.diaspora.contentPreferences.restoreMutedAuthor, {
              networkId: network._id,
              expectedPersonId: personId as Id<"persons">,
              choiceId: choiceId as Id<"mutes">,
            })
          return { ok: true, value: result }
        } catch (error) {
          return { ok: false, code: error instanceof Refusal ? error.code : engineActionErrorCode(error) }
        }
      },
    },
    profilePublication: {
      updateIdentity: (personId, input) => profileCommand(async () => {
        const person = await ownPerson(personId)
        if (!person.handle || !person.displayName) throw new Refusal("not_member")
        await deps.convex.mutation(api.modules.people.profile.updateMyProfile, {
          expectedPersonId: personId as Id<"persons">,
          displayName: input.displayName,
          headline: input.headline,
        })
      }),
      useMyProfile() {
        const auth = useStableConvexAuth()
        const person = useLoaded(api.modules.people.persons.getMyPerson, auth.isAuthenticated ? {} : "skip")
        if (auth.isPending) return LOADING
        if (!auth.isAuthenticated) return failed("not_signed_in")
        if (person.state === "error") return failed(person.code)
        return person.state === "ready" ? ready(person.value ? toOwnProfileView(person.value) : null) : LOADING
      },
      setPrivacy: (personId, isPrivate) => profileCommand(async () => {
        const person = await ownPerson(personId)
        if (!person.handle || !person.displayName) throw new Refusal("not_member")
        if (person.private !== isPrivate) await deps.convex.mutation(api.modules.people.profile.setMyProfilePrivacy, { private: isPrivate })
      }),
      withdraw: (personId) => profileCommand(async () => {
        const person = await ownPerson(personId)
        if (person.published) await deps.convex.mutation(api.modules.people.profile.withdrawMyProfile, {})
      }),
      republish: (personId) => profileCommand(async () => {
        const person = await ownPerson(personId)
        if (person.published) return
        if (!person.handle || !person.displayName) throw new Refusal("not_member")
        await deps.convex.mutation(api.modules.people.profile.publishMyProfile, {
          handle: person.handle,
          displayName: person.displayName,
          ...(person.headline === undefined ? {} : { headline: person.headline }),
        })
      }),
    },

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
      const tag = args.tag?.trim().toLowerCase() || undefined
      const canRead = auth.isAuthenticated && id !== null && country !== null && member?.capabilities.includes("read_network") === true
      const query = useAuthenticatedConvexQuery(
        api.modules.posts.posts.myFeed,
        canRead && id && country ? {
          networkId: id,
          limit: FEED_PAGE,
          ...feedRequest(args.scope, country),
          ...(tag === undefined ? {} : { tag }),
          ...(args.cursor ? { cursor: { publishedAt: args.cursor.publishedAt, postId: args.cursor.postId as Id<"posts"> } } : {}),
        } : "skip",
      )
      let error: ActionErrorCode | null = query.isError ? engineActionErrorCode(query.error) : null
      if (auth.isUnauthenticated) error = "not_signed_in"
      else if (networkId.state === "error") error = networkId.code
      else if (membership.state === "error") error = membership.code
      else if (networkId.state === "ready" && id === null) error = "network_unavailable"
      else if (membership.state === "ready" && (!member || country === null)) error = "not_member"
      else if (member && !member.capabilities.includes("read_network")) error = member.status === "suspendue" ? "suspended" : "not_member"
      const page = useReadablePostsQuery(query, JSON.stringify(["feed", id, args.scope, country, tag ?? null, args.cursor ?? null]), canRead, error)
      const items = page.data === undefined ? undefined : toFeed(page.data.items, args.scope, country as CountryCode)
      if (items) for (const post of items) myReactions.set(post.id, post.myReaction)
      return {
        ...page,
        data: page.data === undefined || items === undefined ? undefined : { items, nextCursor: page.data.nextCursor, lacunar: page.data.lacunar },
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
      const handle = args.handle.trim().replace(/^@/, "").toLowerCase()
      const query = useAuthenticatedConvexQuery(
        api.modules.posts.posts.personPosts,
        canRead && id ? {
          networkId: id,
          handle,
          limit: FEED_PAGE,
          ...(args.cursor ? { cursor: { publishedAt: args.cursor.publishedAt, postId: args.cursor.postId as Id<"posts"> } } : {}),
        } : "skip",
      )
      let error: ActionErrorCode | null = query.isError ? engineActionErrorCode(query.error) : null
      if (auth.isUnauthenticated) error = "not_signed_in"
      else if (networkId.state === "error") error = networkId.code
      else if (membership.state === "error") error = membership.code
      else if (networkId.state === "ready" && id === null) error = "network_unavailable"
      else if (membership.state === "ready" && !member) error = "not_member"
      else if (member && !member.capabilities.includes("read_network")) error = member.status === "suspendue" ? "suspended" : "not_member"
      const page = useReadablePostsQuery(query, JSON.stringify(["profile", id, handle, args.cursor ?? null]), canRead, error)
      const items = page.data === undefined ? undefined : toWall({ items: page.data.items, pinned: args.cursor ? null : page.data.pinned })
      if (items) for (const post of items) myReactions.set(post.id, post.myReaction)
      return {
        ...page,
        data: page.data === undefined || items === undefined ? undefined : { items, nextCursor: page.data.nextCursor, lacunar: false },
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

    useBookmarksPage(args: BookmarksPageRequest): BookmarksPageQuery {
      const { auth, networkId, membership } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const member = membership.state === "ready" ? membership.value : null
      const canRead = auth.isAuthenticated && id !== null && member?.capabilities.includes("read_network") === true
      const query = useAuthenticatedConvexQuery(api.modules.marks.marks.paginateBookmarks,
        canRead && id ? { networkId: id, paginationOpts: { numItems: BOOKMARKS_PAGE_SIZE, cursor: args.cursor ?? null } } : "skip",
      )
      const requestKey = JSON.stringify([id, args.cursor ?? null, canRead])
      const generation = useMemo(() => Symbol(requestKey), [requestKey])
      const activeGeneration = useRef<symbol | null>(null)
      useLayoutEffect(() => {
        activeGeneration.current = generation
        return () => { if (activeGeneration.current === generation) activeGeneration.current = null }
      }, [generation])
      const [denial, setDenial] = useState<{ key: string; code: ActionErrorCode; dataUpdatedAt: number } | null>(null)
      let error: ActionErrorCode | null = query.isError ? engineActionErrorCode(query.error) : null
      if (auth.isUnauthenticated) error = "not_signed_in"
      else if (networkId.state === "error") error = networkId.code
      else if (membership.state === "error") error = membership.code
      else if (networkId.state === "ready" && id === null) error = "network_unavailable"
      else if (membership.state === "ready" && !member) error = "not_member"
      else if (member && !member.capabilities.includes("read_network")) error = member.status === "suspendue" ? "suspended" : "not_member"
      const denied = error !== null && PAGE_ACCESS_ERRORS.has(error)
      const blocked = denial?.key === requestKey ? denial : null
      const fresh = query.isSuccess && !query.isFetching && query.data !== undefined
        && blocked !== null && query.dataUpdatedAt > blocked.dataUpdatedAt
      useLayoutEffect(() => {
        if (denied && error !== null) {
          const code = error
          setDenial((previous) => previous?.key === requestKey && previous.code === code && previous.dataUpdatedAt === query.dataUpdatedAt
            ? previous : { key: requestKey, code, dataUpdatedAt: query.dataUpdatedAt })
        } else if (fresh || (denial !== null && denial.key !== requestKey)) setDenial(null)
      }, [denied, error, requestKey, query.dataUpdatedAt, fresh, denial])
      const refetch = query.refetch
      const retry = useCallback(async (): Promise<BookmarksPageView | undefined> => {
        if (!canRead || activeGeneration.current !== generation) return undefined
        try {
          const result = await refetch()
          if (activeGeneration.current !== generation || !result.isSuccess || result.isError || result.isFetching || result.data === undefined) return undefined
          setDenial((previous) => previous?.key === requestKey ? null : previous)
          return { items: result.data.page.map(toBookmarkView), continueCursor: result.data.continueCursor, isDone: result.data.isDone }
        } catch { return undefined }
      }, [canRead, refetch, requestKey, generation])
      const data = useMemo(() => query.data === undefined ? undefined : {
        items: query.data.page.map(toBookmarkView),
        continueCursor: query.data.continueCursor,
        isDone: query.data.isDone,
      }, [query.data])
      if (denied || (blocked !== null && !fresh)) return { data: undefined, isLoading: query.isFetching === true, error: denied ? error : blocked!.code, retry }
      if (!canRead && error !== null) return { data: undefined, isLoading: false, error, retry }
      if (!canRead) return { data: undefined, isLoading: true, error: null, retry }
      return { data, isLoading: query.isFetching === true || (data === undefined && !query.isError), error, retry }
    },

    useSuggestions(): Loadable<readonly SuggestionView[]> {
      const { auth, networkId, membership } = useMember()
      const id = networkId.state === "ready" ? networkId.value : null
      const member = membership.state === "ready" ? membership.value : null
      const canPublish = auth.isAuthenticated && member?.capabilities.includes("publish") === true
      const list = useLoaded(api.modules.diaspora.suggestions.forMe, id && canPublish ? { networkId: id } : "skip")
      if (auth.isUnauthenticated) return failed("not_signed_in")
      for (const loaded of [networkId, membership]) if (loaded.state === "error") return failed(loaded.code)
      if (auth.isPending || networkId.state !== "ready" || membership.state !== "ready") return LOADING
      if (id === null) return failed("network_unavailable")
      if (!member) return failed("not_member")
      if (!member.capabilities.includes("read_network")) return failed(member.status === "suspendue" ? "suspended" : "not_member")
      if (!canPublish) return ready([])
      if (list.state === "error") return failed(list.code)
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

    // Les pages du réseau (officielles, associations, entreprises) : DG-007, `engine-pages.ts`.
    usePage: useEnginePage,

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
      await signOutEverywhere(deps.authClient, {
        resetLocalState: () => {
          myReactions.clear()
          networkId = null
          pendingEmail = null
          clearDiasporaleDrafts()
        },
        // La navigation reste sous le verrou du moteur, pour préserver l'avis
        // même lorsque la garde de session observe la révocation en parallèle.
        navigate: (result) => {
          if (typeof window !== "undefined") window.location.assign(routes.enterAfterSignOut(!result.serverRevoked || !result.localCleared))
        },
      })
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

    editComment: (commentId, body) =>
      attempt(async () => {
        await deps.convex.mutation(api.modules.engagement.engagement.editComment, {
          networkId: await diasporale(),
          commentId: commentId as Id<"postComments">,
          body,
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

    // Le thème du compte, commun aux réseaux du moteur (ADR-0026) : seul un thème du contrat commun s'y enregistre.
    saveAccountTheme: (theme) =>
      attempt(async () => {
        if (!isMemberThemeId(theme)) throw new Refusal("feature_unavailable")
        await deps.convex.mutation(api.modules.people.preferences.setMyPreferences, { theme })
        return null
      }),

    saveAccountLocale: (locale) =>
      attempt(async () => {
        if (!isSupportedLocale(locale)) throw new Refusal("feature_unavailable")
        await deps.convex.mutation(api.modules.people.preferences.setMyPreferences, { locale })
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

    leaveDiasporale: () => attempt(async () => {
      const expected = await deps.convex.query(api.modules.people.persons.getMyPerson, {})
      if (!expected) throw new Refusal("not_signed_in")
      const id = await diasporale()
      const current = await deps.convex.query(api.modules.people.persons.getMyPerson, {})
      if (!current || current._id !== expected._id) throw new Refusal("not_found")
      await deps.convex.mutation(api.modules.diaspora.membership.leaveDiasporale, { networkId: id })
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
    exportMyData: () => createEngineDataRights(deps).exportMyData(),
    deleteMyAccount: () => createEngineDataRights(deps).deleteMyAccount(),
  }
}
