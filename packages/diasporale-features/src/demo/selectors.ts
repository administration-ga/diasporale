/**
 * Projections du fournisseur de démonstration — fonctions PURES de l'état.
 * Elles appliquent les mêmes règles que le moteur appliquera, prises dans
 * `@diasporale/domain` : statut dérivé des faits, badges calculés, visibilité
 * `network`, portées du fil, refus indistinct (un profil introuvable et un
 * profil inaccessible rendent la même chose : `null`).
 */
import { isProfileDiscoverable, isProfilePublished } from "@antsia/social-domain/content"
import {
  admitsInFeedScope,
  capabilitiesOf,
  countsAsHubMember,
  countsInSponsorshipWindow,
  deriveMembershipStatus,
  DIRECTORY_PAGE_SIZE_MAX,
  isCountryOpen,
  isListedInDirectoryFor,
  isReadableByOthers,
  isShownInHub,
  pageTrustLevel,
  personBadges,
  presentHubCounters,
  projectFacet,
  rankSuggestions,
  sponsorStanding,
  suggestionReasons,
  writeRateTier,
  type ConsentPurpose,
  type CountryCode,
  type FeedScope,
  type MembershipStatus,
  type TrustBadge,
} from "@diasporale/domain"
import { CONSENT_PURPOSES, CONSENT_TEXT_VERSIONS, isConsentActive } from "@diasporale/domain"

import type {
  AuthorView,
  BookmarkView,
  CommentThreadView,
  CommentView,
  ConsentView,
  CountryHubView,
  EventView,
  MemberHitView,
  MembershipView,
  OpenCountryView,
  OwnProfileView,
  PageDetailView,
  PageView,
  PostMediaView,
  PostView,
  ProfileView,
  SessionView,
  SharedPostView,
  NotificationView,
  RelationView,
  SponsorDashboardView,
  SuggestionView,
  UnreadCountView,
} from "../data/types"
import { COMMENT_REPLIES_PREVIEW, COMMENTS_PAGE, MEMBER_SEARCH_MIN_LENGTH } from "../data/types"
import { maskDestination } from "../data/mask"
import type { DemoAccountView } from "../data/port"
import type { DemoComment, DemoPage, DemoPost, DemoState } from "./state"

/** Les champs gardés pour soi ne sont jamais une projection d'acteur public. */
function publishedProfile(state: DemoState, personId: string) {
  const person = state.persons[personId]
  return person?.profile && isProfilePublished(person) ? person.profile : null
}

export function ownProfileView(state: DemoState, personId: string): OwnProfileView | null {
  const person = state.persons[personId]
  if (!person) return null
  return {
    personId,
    handle: person.profile?.handle ?? null,
    displayName: person.profile?.displayName ?? null,
    headline: person.profile?.headline ?? null,
    published: Boolean(person.profile) && isProfilePublished(person),
    private: person.privateAt !== undefined,
  }
}

export function statusOf(state: DemoState, personId: string, now: number): MembershipStatus | null {
  const membership = state.memberships[personId]
  return membership ? deriveMembershipStatus(membership.grounds, now) : null
}

export function badgesOfPerson(state: DemoState, personId: string, now: number): TrustBadge[] {
  const person = state.persons[personId]
  const membership = state.memberships[personId]
  return personBadges({
    ...(person?.idn ? { idnLoa: person.idn.loa } : {}),
    consularAttestation: membership?.grounds.consularAttestation ?? false,
    administrationLink: person?.administrationLink ?? false,
    ...(membership ? { membershipStatus: deriveMembershipStatus(membership.grounds, now) } : {}),
  })
}

export function pageView(page: DemoPage): PageView {
  const trust = pageTrustLevel({ ownerKind: page.ownerKind, source: page.source, claimValidated: page.claimValidated })
  return {
    id: page.id,
    handle: page.handle,
    name: page.name,
    ownerKind: page.ownerKind,
    trust,
    badge: trust,
    country: page.country,
    city: page.city,
    description: page.description,
    followers: page.followers,
    claimable: trust === "community" && page.ownerKind !== "institution",
    ...(page.associationType ? { associationType: page.associationType } : {}),
    ...(page.sector ? { sector: page.sector } : {}),
  }
}

function authorOf(state: DemoState, author: DemoPost["author"], now: number): AuthorView {
  if (author.kind === "page") {
    const page = state.pages[author.id]
    const view = page ? pageView(page) : null
    return {
      kind: "page",
      id: author.id,
      handle: view?.handle ?? "",
      displayName: view?.name ?? "",
      badges: view ? [view.badge] : ["community"],
    }
  }
  const profile = publishedProfile(state, author.id)
  return {
    kind: "person",
    id: author.id,
    handle: profile?.handle ?? "",
    displayName: profile?.displayName ?? "",
    badges: profile ? badgesOfPerson(state, author.id, now) : [],
  }
}

/** Identifiant stable d'un lien établi (la paire, dans l'ordre). */
export function connectionKey(a: string, b: string): string {
  return a < b ? `${a}~${b}` : `${b}~${a}`
}

/**
 * Ma relation avec une personne. Le blocage posé par l'AUTRE ne se voit pas :
 * pour le bloqué, il n'y a « rien » — ni lien, ni demande, ni abonnement.
 */
export function relationView(state: DemoState, viewerId: string, otherId: string): RelationView {
  const myBlock = state.blocks.find((block) => block.byId === viewerId && block.targetId === otherId)
  if (myBlock) return { connection: "blocked_by_me", connectionId: myBlock.id, following: false }
  if (state.blocks.some((block) => block.byId === otherId && block.targetId === viewerId)) {
    return { connection: "none", connectionId: null, following: false }
  }
  const following = state.follows.some(([follower, target]) => follower === viewerId && target === otherId)
  if (isConnected(state, viewerId, otherId)) return { connection: "connected", connectionId: connectionKey(viewerId, otherId), following }
  const mine = state.connectionRequests.find((request) => request.fromId === viewerId && request.toId === otherId)
  if (mine) return { connection: "requested_by_me", connectionId: mine.id, following }
  const theirs = state.connectionRequests.find((request) => request.fromId === otherId && request.toId === viewerId)
  if (theirs) return { connection: "requested_by_them", connectionId: theirs.id, following }
  return { connection: "none", connectionId: null, following }
}

/** La cloche : mes avis, du plus récent, et l'état vivant d'une demande de relation reçue. */
export function notificationsView(state: DemoState, viewerId: string): NotificationView[] {
  return state.notifications
    .filter((item) => item.recipientId === viewerId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, NOTIFICATIONS_PAGE)
    .map((item) => {
      const actor = item.actorId ? publishedProfile(state, item.actorId) : null
      const request = item.connectionRequestId ? state.connectionRequests.find((candidate) => candidate.id === item.connectionRequestId) : undefined
      const isRequest = item.kind === "connection_request"
      return {
        id: item.id,
        kind: item.kind,
        actor: actor ? { handle: actor.handle, displayName: actor.displayName } : null,
        createdAt: item.createdAt,
        read: item.readAt !== null,
        pendingConnectionId: isRequest && request && request.toId === viewerId ? request.id : null,
        // Une demande tranchée : refusée par moi, acceptée (le lien existe), sinon disparue (retirée, défaite).
        inviteOutcome: !isRequest || request ? null : item.inviteDeclined ? "declined" : item.actorId && isConnected(state, viewerId, item.actorId) ? "accepted" : "gone",
        postId: item.postId,
      }
    })
}

/** Les avis de la première page de la cloche. */
export const NOTIFICATIONS_PAGE = 30

export function unreadCountView(state: DemoState, viewerId: string): UnreadCountView {
  const count = state.notifications.filter((item) => item.recipientId === viewerId && item.readAt === null).length
  return { count: Math.min(count, 99), capped: count > 99 }
}

/** Repli sans accents et en minuscules, comme la recherche du moteur. */
function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
}

/** Chaque mot cherché commence un mot du nom affiché ou de l'identifiant. */
function matchesMember(query: string, displayName: string, handle: string): boolean {
  const words = fold(`${displayName} ${handle} ${handle.replace(/[._-]+/g, " ")}`).split(/\s+/)
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => words.some((word) => word.startsWith(term)))
}

/**
 * L'annuaire opt-in, rendu comme par la tranche du moteur : chaque personne est
 * jugée par LA règle du domaine (niveau choisi, consentement en vigueur, statut,
 * pays du lecteur, blocage dans la paire) ; la facette est projetée pour le
 * lecteur ; vingt au plus. Le filtre de pays restreint, il n'ouvre rien.
 */
/**
 * LA règle de l'annuaire pour un candidat, comme dans la tranche du moteur :
 * niveau choisi, consentement en vigueur, statut, pays du lecteur, blocage —
 * puis la vue du membre, facette projetée pour le lecteur. `null` : absent.
 */
function listedMemberView(state: DemoState, viewerId: string, personId: string, now: number): MemberHitView | null {
  const person = state.persons[personId]
  const membership = state.memberships[personId]
  const viewerMembership = state.memberships[viewerId]
  const viewerStatus = statusOf(state, viewerId, now)
  if (!person?.profile || !isProfileDiscoverable(person) || !membership || !viewerMembership || !viewerStatus) return null
  const facet = membership.facet
  const viewerCountry = viewerMembership.facet.countryOfResidence
  const isSelf = personId === viewerId
  const listed = isListedInDirectoryFor(
    {
      status: deriveMembershipStatus(membership.grounds, now),
      visibility: membership.directoryVisibility,
      consentActive: isConsentActive(
        state.consents.filter((record) => record.personId === personId),
        "directory",
      ),
      country: facet.countryOfResidence,
    },
    { status: viewerStatus, country: viewerCountry, isSelf, blockedWithTarget: !isSelf && blockedBetween(state, viewerId, personId) },
  )
  if (!listed) return null
  return {
    personId,
    handle: person.profile.handle,
    displayName: person.profile.displayName,
    headline: person.profile.headline,
    badges: badgesOfPerson(state, personId, now),
    facet: projectFacet(facet, {
      isSelf,
      isConnection: isConnected(state, personId, viewerId),
      isSameCountryMember: viewerCountry === facet.countryOfResidence,
      isActiveMember: true,
    }),
  }
}

export function memberSearchView(state: DemoState, viewerId: string, query: string, country: CountryCode | undefined, now: number): MemberHitView[] {
  const term = query.trim().replace(/^@/, "")
  if (term.length < MEMBER_SEARCH_MIN_LENGTH) return []
  const hits: MemberHitView[] = []
  for (const person of Object.values(state.persons)) {
    if (!person.profile || !matchesMember(term, person.profile.displayName, person.profile.handle)) continue
    const hit = listedMemberView(state, viewerId, person.id, now)
    if (!hit || (country !== undefined && hit.facet.countryOfResidence !== country)) continue
    hits.push(hit)
  }
  return hits.sort((a, b) => a.displayName.localeCompare(b.displayName, "fr")).slice(0, DIRECTORY_PAGE_SIZE_MAX)
}

/**
 * Des membres à rencontrer, comme la tranche les rend : l'annuaire opt-in, le
 * classement du domaine sur la facette projetée (pays, ville, associations,
 * relations communes). Jamais soi, une relation, une demande, un blocage, ni
 * une personne écartée.
 */
export function suggestionsView(state: DemoState, viewerId: string, now: number): SuggestionView[] {
  const reader = state.memberships[viewerId]
  if (!reader) return []
  const myConnections = new Set(
    state.connections.flatMap(([a, b]) => (a === viewerId ? [b] : b === viewerId ? [a] : [])),
  )
  const asked = new Set(
    state.connectionRequests.flatMap((request) => (request.fromId === viewerId ? [request.toId] : request.toId === viewerId ? [request.fromId] : [])),
  )
  const dismissed = new Set(state.suggestionDismissals.flatMap(([by, target]) => (by === viewerId ? [target] : [])))
  const pool = Object.values(state.persons)
    .sort((a, b) => b.createdAt - a.createdAt)
    .flatMap((person) => {
      if (person.id === viewerId || myConnections.has(person.id) || asked.has(person.id) || dismissed.has(person.id)) return []
      const hit = listedMemberView(state, viewerId, person.id, now)
      if (!hit) return []
      const mutual = state.connections.filter(([a, b]) => (a === person.id && myConnections.has(b)) || (b === person.id && myConnections.has(a))).length
      return [{ ...hit, reasons: suggestionReasons(reader.facet, hit.facet, mutual) }]
    })
  return rankSuggestions(pool)
}

export function isConnected(state: DemoState, a: string, b: string): boolean {
  return state.connections.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

/**
 * Lecture d'un contenu `network` : il faut être membre de DIASPORALE avec un
 * droit de lecture (un suspendu sans lecture ne lit rien). Puis l'audience
 * héritée tranche ; un contenu non publié n'existe que pour son auteur.
 */
export function canRead(state: DemoState, post: DemoPost, viewerId: string, now: number): boolean {
  const isMine = post.author.kind === "person" && post.author.id === viewerId
  if (!isReadableByOthers(post.moderation) && !isMine) return false
  const status = statusOf(state, viewerId, now)
  if (status === null) return false
  const readAccess = state.memberships[viewerId]?.grounds.suspension?.readAccess ?? "none"
  if (!capabilitiesOf(status, { suspensionReadAccess: readAccess }).has("read_network")) return false
  if (isMine) return true
  if (post.audience === "connections") return post.author.kind === "person" && isConnected(state, post.author.id, viewerId)
  return post.audience === "public"
}

function mediaViews(post: DemoPost): PostMediaView[] {
  return (post.media ?? []).map((item) => ({ kind: item.kind, url: item.url, withheld: null, altText: item.altText, width: item.width, height: item.height }))
}

/** L'original cité, re-gardé pour CE lecteur : retiré ou hors de sa portée, il est « indisponible ». */
function sharedPostView(state: DemoState, postId: string, viewerId: string, now: number): SharedPostView {
  const original = state.posts.find((item) => item.id === postId)
  if (!original || !canRead(state, original, viewerId, now)) return { available: false }
  const author = authorOf(state, original.author, now)
  return {
    available: true,
    postId: original.id,
    author: { kind: author.kind, handle: author.handle || null, displayName: author.displayName || null },
    body: original.body,
    media: mediaViews(original),
    publishedAt: original.createdAt,
  }
}

export function postView(state: DemoState, post: DemoPost, viewerId: string, now: number): PostView {
  const reactionsByOthers = Object.entries(post.reactions).filter(([personId]) => personId !== viewerId).length
  const mine = post.reactions[viewerId] ?? null
  return {
    id: post.id,
    author: authorOf(state, post.author, now),
    body: post.body,
    media: mediaViews(post),
    share: post.sharedPostId === undefined ? null : sharedPostView(state, post.sharedPostId, viewerId, now),
    shareCount: state.posts.filter((item) => item.sharedPostId === post.id).length,
    scope: post.scope,
    audience: post.audience,
    visibility: post.visibility,
    moderation: post.moderation,
    createdAt: post.createdAt,
    reactionCount: post.baseReactions + reactionsByOthers + (mine ? 1 : 0),
    commentCount: liveComments(state, post.id, viewerId).length,
    myReaction: mine,
    isMine: post.author.kind === "person" && post.author.id === viewerId,
    bookmarked: state.marks.some((mark) => mark.personId === viewerId && mark.postId === post.id && mark.kind === "bookmark"),
    edited: post.editedAt !== null,
  }
}

/** Une publication seule, pour ce lecteur ; `null` : introuvable, illisible ou écartée (même réponse). */
export function postDetailView(state: DemoState, postId: string, viewerId: string, now: number): PostView | null {
  const post = state.posts.find((candidate) => candidate.id === postId)
  if (!post || !canRead(state, post, viewerId, now) || setAside(state, post, viewerId, false)) return null
  return postView(state, post, viewerId, now)
}

/** Mes signets, du plus récent ; une publication devenue illisible disparaît. */
export function bookmarksView(state: DemoState, viewerId: string, now: number): BookmarkView[] {
  return state.marks
    .filter((mark) => mark.personId === viewerId && mark.kind === "bookmark")
    .flatMap((mark) => {
      const post = state.posts.find((candidate) => candidate.id === mark.postId)
      if (!post || !canRead(state, post, viewerId, now) || setAside(state, post, viewerId, false)) return []
      const author = authorOf(state, post.author, now)
      return [
        {
          postId: post.id,
          author: { kind: author.kind, handle: author.handle, displayName: author.displayName },
          body: post.body,
          publishedAt: post.createdAt,
          markedAt: mark.createdAt,
        },
      ]
    })
    .sort((a, b) => b.markedAt - a.markedAt)
}

/** Un blocage, dans un sens ou dans l'autre, entre deux personnes. */
function blockedBetween(state: DemoState, a: string, b: string): boolean {
  return state.blocks.some((block) => (block.byId === a && block.targetId === b) || (block.byId === b && block.targetId === a))
}

/**
 * Ce que le lecteur a écarté, comme le moteur l'écarte : une publication
 * masquée (ou signalée) par lui, un blocage dans la paire, et — dans les fils
 * seulement — un auteur en sourdine.
 */
function setAside(state: DemoState, post: DemoPost, viewerId: string, inFeed: boolean): boolean {
  if (state.marks.some((mark) => mark.personId === viewerId && mark.postId === post.id && mark.kind === "hidden")) return true
  if (post.author.kind !== "person" || post.author.id === viewerId) return false
  const authorId = post.author.id
  if (inFeed && state.mutes.some(([by, target]) => by === viewerId && target === authorId)) return true
  return blockedBetween(state, viewerId, authorId)
}

/**
 * Les commentaires vivants d'une publication pour ce lecteur, comme le moteur
 * les rend : retirés écartés, réponses d'une racine retirée écartées, auteurs
 * bloqués (dans un sens ou dans l'autre) écartés.
 */
function liveComments(state: DemoState, postId: string, viewerId: string): DemoComment[] {
  const blocked = (personId: string) =>
    personId !== viewerId &&
    state.blocks.some((block) => (block.byId === viewerId && block.targetId === personId) || (block.byId === personId && block.targetId === viewerId))
  const live = state.comments.filter((item) => item.postId === postId && item.removedAt === null && !blocked(item.authorId))
  const liveRoots = new Set(live.filter((item) => item.parentId === null).map((item) => item.id))
  return live.filter((item) => item.parentId === null || liveRoots.has(item.parentId))
}

function commentView(state: DemoState, item: DemoComment, viewerId: string): CommentView {
  const profile = publishedProfile(state, item.authorId)
  return {
    id: item.id,
    author: { personId: item.authorId, handle: profile?.handle ?? null, displayName: profile?.displayName ?? null },
    body: item.body,
    createdAt: item.createdAt,
    edited: false,
    isMine: item.authorId === viewerId,
  }
}

const byAge = (a: DemoComment, b: DemoComment) => a.createdAt - b.createdAt

/** Les commentaires d'une publication lisible : racines des plus anciennes, trois réponses au plus en aperçu. */
export function commentsView(state: DemoState, postId: string, viewerId: string, now: number): CommentThreadView[] | null {
  const post = state.posts.find((candidate) => candidate.id === postId)
  if (!post || !canRead(state, post, viewerId, now)) return null
  const live = liveComments(state, postId, viewerId)
  return live
    .filter((item) => item.parentId === null)
    .sort(byAge)
    .slice(0, COMMENTS_PAGE)
    .map((root) => {
      const replies = live.filter((item) => item.parentId === root.id).sort(byAge)
      return {
        ...commentView(state, root, viewerId),
        replyCount: replies.length,
        replies: replies.slice(0, COMMENT_REPLIES_PREVIEW).map((reply) => commentView(state, reply, viewerId)),
      }
    })
}

/** Toutes les réponses d'une racine vivante, des plus anciennes aux plus récentes. */
export function repliesView(state: DemoState, postId: string, commentId: string, viewerId: string, now: number): CommentView[] | null {
  const post = state.posts.find((candidate) => candidate.id === postId)
  if (!post || !canRead(state, post, viewerId, now)) return null
  const live = liveComments(state, postId, viewerId)
  if (!live.some((item) => item.id === commentId && item.parentId === null)) return null
  return live
    .filter((item) => item.parentId === commentId)
    .sort(byAge)
    .map((reply) => commentView(state, reply, viewerId))
}

export function feedView(
  state: DemoState,
  viewerId: string,
  scope: FeedScope,
  now: number,
  hubCountry?: CountryCode,
): PostView[] {
  const membership = state.memberships[viewerId]
  if (!membership) return []
  const viewerCountry = hubCountry ?? membership.facet.countryOfResidence
  const followsPage = new Set<string>()
  return state.posts
    .filter((post) => canRead(state, post, viewerId, now) && !setAside(state, post, viewerId, true))
    .filter((post) =>
      hubCountry !== undefined
        ? isShownInHub(post.scope, hubCountry)
        : admitsInFeedScope(
            scope,
            {
              scope: post.scope,
              relation: {
                own: post.author.kind === "person" && post.author.id === viewerId,
                connection: post.author.kind === "person" && isConnected(state, post.author.id, viewerId),
                follow: false,
                followedPage: post.author.kind === "page" && followsPage.has(post.author.id),
                memberGroup: false,
              },
            },
            viewerCountry,
          ),
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((post) => postView(state, post, viewerId, now))
}

function eventView(state: DemoState, event: DemoState["events"][number], now: number): EventView {
  return {
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    city: event.city,
    scope: event.scope,
    category: event.category,
    organizer: authorOf(state, { kind: "page", id: event.organizerPageId }, now),
    capacity: event.capacity,
    registered: event.registered,
    moderation: event.moderation,
  }
}

/** Compteurs « matérialisés » du hub — recalculés depuis l'état, comme le ferait le cron quotidien. */
export function hubCounters(state: DemoState, country: CountryCode, now: number) {
  const members = Object.entries(state.memberships).filter(
    ([personId, membership]) => {
      const person = state.persons[personId]
      return !!person?.profile && isProfileDiscoverable(person) && membership.facet.countryOfResidence === country && countsAsHubMember({
        status: deriveMembershipStatus(membership.grounds, now),
        directoryVisibility: membership.directoryVisibility,
        directoryConsent: isConsentActive(
          state.consents.filter((record) => record.personId === personId),
          "directory",
        ),
      })
    },
  ).length
  const pages = Object.values(state.pages).filter((page) => page.country === country)
  return presentHubCounters({
    members,
    associations: pages.filter((page) => page.ownerKind === "association").length,
    companies: pages.filter((page) => page.ownerKind === "company").length,
    upcomingEvents: state.events.filter(
      (event) => event.startsAt > now && event.moderation === "published" && isShownInHub(event.scope, country),
    ).length,
  })
}

export function countryHubView(state: DemoState, country: CountryCode, now: number): CountryHubView {
  const pages = Object.values(state.pages)
    .filter((page) => page.country === country)
    .map(pageView)
  return {
    country,
    open: isCountryOpen(country, state.openCountries),
    counters: hubCounters(state, country, now),
    countersSource: "demo",
    officialPages: pages.filter((page) => page.trust === "official"),
    associations: pages.filter((page) => page.ownerKind === "association"),
    companies: pages.filter((page) => page.ownerKind === "company"),
    events: state.events
      .filter((event) => event.startsAt > now && event.moderation === "published" && isShownInHub(event.scope, country))
      .sort((a, b) => a.startsAt - b.startsAt)
      .map((event) => eventView(state, event, now)),
  }
}

export function openCountriesView(state: DemoState, now: number): OpenCountryView[] {
  return state.openCountries.map((country) => ({
    country,
    counters: hubCounters(state, country, now),
    countersSource: "demo" as const,
  }))
}

export function membershipView(state: DemoState, personId: string, now: number): MembershipView | null {
  const membership = state.memberships[personId]
  const person = state.persons[personId]
  if (!membership || !person?.profile) return null
  const status = deriveMembershipStatus(membership.grounds, now)
  const badges = badgesOfPerson(state, personId, now)
  const sponsorship = state.sponsorships.find((item) => item.sponsoredId === personId && item.revokedAt === null)
  const sponsor = sponsorship ? publishedProfile(state, sponsorship.sponsorId) : null
  const rootVerified = badges.includes("verified")
  return {
    personId,
    handle: person.profile.handle,
    displayName: person.profile.displayName,
    status,
    badges,
    facet: membership.facet,
    joinedAt: membership.joinedAt,
    verifiedSince: membership.verifiedSince,
    sponsoredBy: sponsor ? { handle: sponsor.handle, displayName: sponsor.displayName } : null,
    attestation: membership.attestation,
    // Politique `open` du réseau racine (cahier ANTSIA §6.2) : déclarée d'emblée,
    // vérifiée avec une preuve forte ; une suspension racine se lit partout.
    root: {
      network: "antsia",
      status: status === "partie" ? "declaree" : status === "suspendue" ? "suspendue" : rootVerified ? "verifiee" : "declaree",
      derivedFrom: "diasporale",
    },
    canPublish: capabilitiesOf(status).has("publish"),
    rateTier: writeRateTier(status, badges),
    directoryVisibility: membership.directoryVisibility,
  }
}

export function sessionView(state: DemoState, now: number): SessionView {
  const personId = state.session.personId
  const person = personId ? state.persons[personId] : undefined
  if (!personId || !person) return { status: "anonymous" }
  const local = person.local
  return {
    status: "signed_in",
    account: {
      id: person.id,
      idn: person.idn ? { loa: person.idn.loa } : null,
      local: local ? { kind: local.kind, masked: maskDestination(local.kind, local.value) } : null,
      nameHints: person.idn ? { firstName: person.idn.firstName, lastName: person.idn.lastName } : {},
    },
    membership: membershipView(state, personId, now),
  }
}

/** `awa@example.com` → `a…@example.com` ; `+33 6 12 34 56 78` → `…5678`. Jamais l'adresse entière à l'écran. */
export function profileView(state: DemoState, handle: string, viewerId: string | null, now: number, options: { readonly includePosts?: boolean } = {}): ProfileView | null {
  const person = Object.values(state.persons).find((candidate) => candidate.profile?.handle === handle)
  const membership = person ? state.memberships[person.id] : undefined
  if (!person?.profile || !isProfilePublished(person) || !membership || viewerId === null) return null
  if (deriveMembershipStatus(membership.grounds, now) === "partie") return null
  const viewerStatus = statusOf(state, viewerId, now)
  const readAccess = state.memberships[viewerId]?.grounds.suspension?.readAccess ?? "none"
  if (viewerStatus === null || !capabilitiesOf(viewerStatus, { suspensionReadAccess: readAccess }).has("read_network")) return null
  const isSelf = person.id === viewerId
  // Un blocage dans la paire : le même « introuvable » qu'un identifiant inconnu.
  if (!isSelf && blockedBetween(state, viewerId, person.id)) return null
  const viewerMembership = state.memberships[viewerId]
  const activeViewer = viewerStatus === "declaree" || viewerStatus === "verifiee"
  const facet = projectFacet(membership.facet, {
    isSelf,
    isConnection: isConnected(state, person.id, viewerId),
    isSameCountryMember: activeViewer && viewerMembership?.facet.countryOfResidence === membership.facet.countryOfResidence,
    isActiveMember: activeViewer,
  })
  const publicFacet = projectFacet(membership.facet, {
    isSelf: false,
    isConnection: false,
    isSameCountryMember: false,
    isActiveMember: true,
  })
  const postSlug = facet.postSlug
  const postPage = postSlug ? Object.values(state.pages).find((page) => page.handle === postSlug) : undefined
  return {
    personId: person.id,
    handle: person.profile.handle,
    displayName: person.profile.displayName,
    headline: person.profile.headline,
    avatar: null,
    cover: null,
    badges: badgesOfPerson(state, person.id, now),
    facet,
    publicFacet,
    postName: postPage?.name ?? null,
    isSelf,
    posts: options.includePosts === false ? [] : state.posts
      .filter((post) => post.author.kind === "person" && post.author.id === person.id)
      .filter((post) => canRead(state, post, viewerId, now) && !setAside(state, post, viewerId, false))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((post) => postView(state, post, viewerId, now)),
  }
}

export function sponsorFacts(state: DemoState, sponsorId: string, now: number) {
  const membership = state.memberships[sponsorId]
  const status = membership ? deriveMembershipStatus(membership.grounds, now) : "partie"
  return {
    status,
    ...(status === "verifiee" && membership?.verifiedSince != null ? { verifiedSince: membership.verifiedSince } : {}),
    sponsorshipsInWindow: state.sponsorships.filter(
      (item) => item.sponsorId === sponsorId && countsInSponsorshipWindow(item.createdAt, now),
    ).length,
  }
}

export function sponsorDashboardView(state: DemoState, viewerId: string, now: number): SponsorDashboardView {
  return {
    ...sponsorStanding(sponsorFacts(state, viewerId, now), now),
    given: state.sponsorships
      .filter((item) => item.sponsorId === viewerId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((item) => {
        const sponsored = publishedProfile(state, item.sponsoredId)
        return {
          id: item.id,
          sponsored: { handle: sponsored?.handle ?? "", displayName: sponsored?.displayName ?? "" },
          createdAt: item.createdAt,
          revokedAt: item.revokedAt,
        }
      }),
  }
}

export function consentsView(state: DemoState, personId: string): ConsentView[] {
  const records = state.consents.filter((record) => record.personId === personId)
  return CONSENT_PURPOSES.map((purpose: ConsentPurpose) => {
    const latest = records
      .filter((record) => record.purpose === purpose)
      .sort((a, b) => b.recordedAt - a.recordedAt)[0]
    return {
      purpose,
      granted: isConsentActive(records, purpose),
      recordedAt: latest?.recordedAt ?? null,
      textVersion: latest?.textVersion ?? CONSENT_TEXT_VERSIONS[purpose],
    }
  })
}

export function demoAccountsView(state: DemoState): DemoAccountView[] {
  return Object.values(state.persons)
    .filter((person) => person.demoAccountKey !== null || person.id === state.session.personId)
    .map((person) => ({
      personId: person.id,
      displayName: person.profile?.displayName ?? person.idn?.firstName ?? person.local?.value ?? person.id,
      handle: person.profile?.handle ?? null,
      descriptionKey: person.demoAccountKey ?? "demo.accounts.mine",
      current: person.id === state.session.personId,
    }))
}

/** Fiche d'une page (institution, association, entreprise) : identité propre, publications, évènements. */
export function pageDetailView(state: DemoState, handle: string, viewerId: string | null, now: number): PageDetailView | null {
  const page = Object.values(state.pages).find((candidate) => candidate.handle === handle)
  if (!page || viewerId === null || statusOf(state, viewerId, now) === null) return null
  return {
    page: pageView(page),
    posts: state.posts
      .filter((post) => post.author.kind === "page" && post.author.id === page.id)
      .filter((post) => canRead(state, post, viewerId, now))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((post) => postView(state, post, viewerId, now)),
    events: state.events
      .filter((event) => event.organizerPageId === page.id && event.startsAt > now && event.moderation === "published")
      .sort((a, b) => a.startsAt - b.startsAt)
      .map((event) => eventView(state, event, now)),
  }
}
