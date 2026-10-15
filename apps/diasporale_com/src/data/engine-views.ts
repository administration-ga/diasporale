/**
 * Projections du moteur ANTIA vers les vues de DIASPORALE (`@diasporale/features/data`)
 * — fonctions PURES, testées sans moteur. Le serveur a déjà allowlisté ce qu'il
 * rend ; ici, on ne fait que changer de forme, et une valeur hors forme (un pays
 * inconnu, une facette absente) fait retomber la vue au plus prudent.
 */
import type { api } from "@convex/_generated/api"
import {
  admitsInFeedScope,
  type ContentScope,
  type CountryCode,
  type DiasporaFacet,
  type FacetField,
  type FacetInput,
  type FeedScope,
  isFieldVisibility,
  isResidenceCountry,
} from "@diasporale/domain"
import {
  type AccountView,
  type ConsentView,
  type CountryHubView,
  maskDestination,
  type MembershipView,
  type OpenCountryView,
  type PostView,
  type SponsorDashboardView,
} from "@diasporale/features/data"
import type { FunctionArgs, FunctionReturnType } from "convex/server"

type MyPerson = NonNullable<FunctionReturnType<typeof api.modules.people.persons.getMyPerson>>
type MyIdentity = NonNullable<FunctionReturnType<typeof api.modules.diaspora.membership.myIdentity>>
type MyMembership = NonNullable<FunctionReturnType<typeof api.modules.diaspora.membership.myMembership>>
type HubView = FunctionReturnType<typeof api.modules.diaspora.hubs.getCountryHub>
type FeedItem = FunctionReturnType<typeof api.modules.posts.posts.feed>["page"][number]
type SponsorDashboard = FunctionReturnType<typeof api.modules.diaspora.membership.sponsorDashboard>
type MyConsents = FunctionReturnType<typeof api.modules.diaspora.membership.myConsents>
export type FacetArgs = FunctionArgs<typeof api.modules.diaspora.facet.updateMyFacet>["facet"]

/** Le compte de la session : la porte d'entrée (IDN et sa garantie, ou compte léger à adresse masquée). */
export function toAccountView(person: MyPerson, identity: MyIdentity, email: string | null): AccountView {
  return {
    id: person._id,
    idn: identity.idn ? { loa: identity.idn.loa } : null,
    local: identity.idn === null && email ? { kind: "email", masked: maskDestination("email", email) } : null,
    // Les prénom et nom d'IDN arrivent avec l'identité du moteur (PA4) ; jamais recopiés d'office.
    nameHints: {},
  }
}

function toFacet(facet: MyMembership["facet"]): DiasporaFacet | null {
  if (!facet || !isResidenceCountry(facet.countryOfResidence)) return null
  return {
    countryOfResidence: facet.countryOfResidence,
    ...(facet.city !== undefined ? { city: facet.city } : {}),
    ...(facet.postSlug !== undefined ? { postSlug: facet.postSlug } : {}),
    associationIds: facet.associationIds,
    ...(facet.arrivedAt !== undefined ? { arrivedAt: facet.arrivedAt } : {}),
    helpAvailable: facet.helpAvailable,
    visibility: facet.visibility,
  }
}

/** L'adhésion de la session. Sans facette lisible, pas d'adhésion à montrer : l'accueil reprend la main. */
export function toMembershipView(person: MyPerson, membership: MyMembership): MembershipView | null {
  const facet = toFacet(membership.facet)
  if (!facet || !person.handle || !person.displayName) return null
  return {
    personId: person._id,
    handle: person.handle,
    displayName: person.displayName,
    status: membership.status,
    badges: membership.badges,
    facet,
    joinedAt: membership.joinedAt,
    verifiedSince: membership.verifiedSince,
    sponsoredBy: membership.sponsoredBy,
    attestation: membership.attestation,
    root: { network: "antia", status: membership.root.status ?? "partie", derivedFrom: "diasporale" },
    canPublish: membership.capabilities.includes("publish"),
    rateTier: membership.rateTier,
    directoryVisibility: membership.directoryVisibility,
  }
}

export function toOpenCountries(hubs: readonly HubView[]): OpenCountryView[] {
  return hubs.flatMap((hub) =>
    isResidenceCountry(hub.country) ? [{ country: hub.country, counters: hub.counters, countersSource: "materialized" as const }] : [],
  )
}

/** Le hub d'un pays : compteurs matérialisés ; pages, associations, entreprises et évènements arrivent avec PD5 et PD7. */
export function toCountryHubView(hub: HubView, country: CountryCode): CountryHubView {
  return {
    country,
    open: hub.open,
    counters: hub.counters,
    countersSource: "materialized",
    officialPages: [],
    associations: [],
    companies: [],
    events: [],
  }
}

/**
 * Une publication du moteur. Sans pays ni portée posés à la publication (ils
 * arrivent avec PD4), elle est de portée `diaspora` — c'est exactement ce que dit
 * le domaine d'un contenu sans pays.
 */
export const ENGINE_POST_SCOPE: ContentScope = Object.freeze({ reach: "diaspora" })

export function toPostView(item: FeedItem): PostView {
  return {
    id: item._id,
    author: {
      kind: "person",
      id: item.author.personId,
      handle: item.author.handle ?? "",
      displayName: item.author.displayName ?? "",
      badges: item.author.badges,
    },
    body: item.body,
    scope: ENGINE_POST_SCOPE,
    audience: item.audience,
    visibility: item.visibility,
    moderation: "published",
    createdAt: item.publishedAt,
    reactionCount: item.reactions.total,
    commentCount: 0,
    myReaction: item.reactions.mine,
    isMine: item.isMine,
  }
}

/** Le fil d'une portée : ce que le moteur rend au lecteur, ordonné par la règle du domaine. */
export function toFeed(items: readonly FeedItem[], scope: FeedScope, viewerCountry: CountryCode): PostView[] {
  return items
    .map(toPostView)
    .filter((post) =>
      admitsInFeedScope(
        scope,
        {
          scope: post.scope,
          relation: { own: post.isMine, connection: false, follow: false, followedPage: false, memberGroup: false },
        },
        viewerCountry,
      ),
    )
}

export function toSponsorDashboardView(dashboard: SponsorDashboard): SponsorDashboardView {
  return {
    eligible: dashboard.eligible,
    refusal: dashboard.refusal,
    remaining: dashboard.remaining,
    windowDays: dashboard.windowDays,
    seniorityReachedAt: dashboard.seniorityReachedAt,
    given: dashboard.given.map((row) => ({
      id: row._id,
      sponsored: row.sponsored,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
    })),
  }
}

export function toConsentViews(consents: MyConsents): ConsentView[] {
  return consents.map((consent) => ({
    purpose: consent.purpose,
    granted: consent.granted,
    recordedAt: consent.recordedAt,
    textVersion: consent.textVersion,
  }))
}

/** La saisie de facette au format des arguments du moteur : listes copiées, niveaux inconnus écartés. */
export function toFacetArgs(input: FacetInput): FacetArgs {
  const visibility: NonNullable<FacetArgs["visibility"]> = {}
  for (const [field, level] of Object.entries(input.visibility ?? {})) {
    if (level !== undefined && isFieldVisibility(level)) visibility[field as FacetField] = level
  }
  return {
    countryOfResidence: input.countryOfResidence,
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.associationIds !== undefined ? { associationIds: [...input.associationIds] } : {}),
    ...(input.arrivedAt !== undefined ? { arrivedAt: input.arrivedAt } : {}),
    ...(input.helpAvailable !== undefined ? { helpAvailable: input.helpAvailable } : {}),
    ...(Object.keys(visibility).length > 0 ? { visibility } : {}),
  }
}
