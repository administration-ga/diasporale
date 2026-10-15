/**
 * Projections du fournisseur de démonstration — fonctions PURES de l'état.
 * Elles appliquent les mêmes règles que le moteur appliquera, prises dans
 * `@diasporale/domain` : statut dérivé des faits, badges calculés, visibilité
 * `network`, portées du fil, refus indistinct (un profil introuvable et un
 * profil inaccessible rendent la même chose : `null`).
 */
import {
  admitsInFeedScope,
  capabilitiesOf,
  countsAsHubMember,
  countsInSponsorshipWindow,
  deriveMembershipStatus,
  isCountryOpen,
  isReadableByOthers,
  isShownInHub,
  pageTrustLevel,
  personBadges,
  presentHubCounters,
  projectFacet,
  sponsorStanding,
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
  ConsentView,
  CountryHubView,
  EventView,
  MembershipView,
  OpenCountryView,
  PageDetailView,
  PageView,
  PostView,
  ProfileView,
  SessionView,
  SponsorDashboardView,
} from "../data/types"
import { maskDestination } from "../data/mask"
import type { DemoAccountView } from "../data/port"
import type { DemoPage, DemoPost, DemoState } from "./state"

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
  const person = state.persons[author.id]
  return {
    kind: "person",
    id: author.id,
    handle: person?.profile?.handle ?? "",
    displayName: person?.profile?.displayName ?? "",
    badges: badgesOfPerson(state, author.id, now),
  }
}

export function isConnected(state: DemoState, a: string, b: string): boolean {
  return state.connections.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

/**
 * Lecture d'un contenu `network` : il faut être membre de DIASPORALE avec un
 * droit de lecture (un suspendu sans lecture ne lit rien). Puis l'audience
 * héritée tranche ; un contenu non publié n'existe que pour son auteur.
 */
function canRead(state: DemoState, post: DemoPost, viewerId: string, now: number): boolean {
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

export function postView(state: DemoState, post: DemoPost, viewerId: string, now: number): PostView {
  const reactionsByOthers = Object.entries(post.reactions).filter(([personId]) => personId !== viewerId).length
  const mine = post.reactions[viewerId] ?? null
  return {
    id: post.id,
    author: authorOf(state, post.author, now),
    body: post.body,
    scope: post.scope,
    audience: post.audience,
    visibility: post.visibility,
    moderation: post.moderation,
    createdAt: post.createdAt,
    reactionCount: post.baseReactions + reactionsByOthers + (mine ? 1 : 0),
    commentCount: post.commentCount,
    myReaction: mine,
    isMine: post.author.kind === "person" && post.author.id === viewerId,
  }
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
    .filter((post) => canRead(state, post, viewerId, now))
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
    ([personId, membership]) =>
      membership.facet.countryOfResidence === country &&
      countsAsHubMember({
        status: deriveMembershipStatus(membership.grounds, now),
        directoryVisibility: membership.directoryVisibility,
        directoryConsent: isConsentActive(
          state.consents.filter((record) => record.personId === personId),
          "directory",
        ),
      }),
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
  const sponsor = sponsorship ? state.persons[sponsorship.sponsorId] : undefined
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
    sponsoredBy: sponsor?.profile ? { handle: sponsor.profile.handle, displayName: sponsor.profile.displayName } : null,
    attestation: membership.attestation,
    // Politique `open` du réseau racine (cahier ANTIA §6.2) : déclarée d'emblée,
    // vérifiée avec une preuve forte ; une suspension racine se lit partout.
    root: {
      network: "antia",
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
export function profileView(state: DemoState, handle: string, viewerId: string | null, now: number): ProfileView | null {
  const person = Object.values(state.persons).find((candidate) => candidate.profile?.handle === handle)
  const membership = person ? state.memberships[person.id] : undefined
  if (!person?.profile || !membership || viewerId === null) return null
  const viewerStatus = statusOf(state, viewerId, now)
  if (viewerStatus === null) return null
  const isSelf = person.id === viewerId
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
    badges: badgesOfPerson(state, person.id, now),
    facet,
    publicFacet,
    postName: postPage?.name ?? null,
    isSelf,
    posts: state.posts
      .filter((post) => post.author.kind === "person" && post.author.id === person.id)
      .filter((post) => canRead(state, post, viewerId, now))
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
        const sponsored = state.persons[item.sponsoredId]?.profile
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
