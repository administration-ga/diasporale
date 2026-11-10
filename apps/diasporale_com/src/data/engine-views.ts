/**
 * Projections du moteur ANTSIA vers les vues de DIASPORALE (`@diasporale/features/data`)
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
  type FacetProjection,
  type FeedRelation,
  type FeedScope,
  type PostAudience,
  isFieldVisibility,
  isResidenceCountry,
  parseContentScope,
} from "@diasporale/domain"
import {
  type AccountView,
  type BookmarkView,
  type CommentThreadView,
  type CommentView,
  type ConsentView,
  type CountryHubView,
  maskDestination,
  type MemberHitView,
  type MembershipView,
  type OpenCountryView,
  type OwnProfileView,
  type PostMediaView,
  type PostView,
  type PublishMediaInput,
  type SharedPostView,
  COMMUNITY_NOTIFICATION_KINDS,
  CONTEXTUAL_NOTIFICATION_KINDS,
  NOTIFICATION_KINDS,
  SERVICE_NOTIFICATION_KINDS,
  type CommunityNoticeView,
  type NotificationKind,
  type NotificationView,
  type ProfileImageView,
  type ProfileView,
  type RelationView,
  type SponsorDashboardView,
  type SuggestionView,
} from "@diasporale/features/data"
import type { FunctionArgs, FunctionReturnType } from "convex/server"

type MyPerson = NonNullable<FunctionReturnType<typeof api.modules.people.persons.getMyPerson>>
type MyIdentity = NonNullable<FunctionReturnType<typeof api.modules.diaspora.membership.myIdentity>>
type MyMembership = NonNullable<FunctionReturnType<typeof api.modules.diaspora.membership.myMembership>>
type HubView = FunctionReturnType<typeof api.modules.diaspora.hubs.getCountryHub>
type FeedItem = FunctionReturnType<typeof api.modules.posts.posts.myFeed>["items"][number]
type EngineMedia = FeedItem["media"][number]
type DeclaredMedia = NonNullable<FunctionArgs<typeof api.modules.posts.posts.publish>["media"]>[number]
type SponsorDashboard = FunctionReturnType<typeof api.modules.diaspora.membership.sponsorDashboard>
type PublicProfile = NonNullable<FunctionReturnType<typeof api.modules.people.profile.getPublicProfile>>
type MemberFacet = NonNullable<FunctionReturnType<typeof api.modules.diaspora.profile.memberFacet>>
type MyConsents = FunctionReturnType<typeof api.modules.diaspora.membership.myConsents>
export type FacetArgs = FunctionArgs<typeof api.modules.diaspora.facet.updateMyFacet>["facet"]

/** La fiche personnelle reste lisible après retrait ; elle n'est jamais un DTO public. */
export function toOwnProfileView(person: MyPerson): OwnProfileView {
  return {
    personId: person._id,
    handle: person.handle ?? null,
    displayName: person.displayName ?? null,
    headline: person.headline ?? null,
    published: person.published,
    private: person.private,
  }
}

/** Le compte de la session : la porte d'entrée (IDN et sa garantie, ou compte léger à adresse masquée). */
export function toAccountView(person: MyPerson, identity: MyIdentity, email: string | null): AccountView {
  return {
    id: person._id,
    idn: identity.idn ? { loa: identity.idn.loa } : null,
    local: identity.idn === null && email ? { kind: "email", masked: maskDestination("email", email) } : null,
    // Les prénom et nom d'IDN arrivent avec l'identité du moteur (PA4) ; jamais recopiés d'office.
    nameHints: {},
    // Le thème du compte, s'il en a un (le moteur ne rend qu'un thème courant du contrat commun).
    ...(person.theme !== undefined ? { theme: person.theme } : {}),
    // La langue du compte, si la personne en a choisi une.
    ...(person.locale !== undefined ? { locale: person.locale } : {}),
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
    root: { network: "antsia", status: membership.root.status ?? "partie", derivedFrom: "diasporale" },
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

/**
 * Le hub d'un pays : ses compteurs MATÉRIALISÉS par le passage nocturne (membres
 * sous seuil, associations et entreprises actives du pays — DG-007), jamais
 * comptés à la lecture. Ses pages se lisent par la capacité « pages »
 * (`diaspora.hubPages.listCountryPages`, bornée par nature, `toHubPagesView`) :
 * les listes du hub restent vides ici plutôt que recopiées ; les évènements
 * arrivent avec PD7.
 */
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
 * Le lieu d'une publication sans portée lisible (publiée avant que le moteur
 * porte pays et portée) : `diaspora` — c'est exactement ce que dit le domaine
 * d'un contenu sans pays.
 */
export const ENGINE_POST_SCOPE: ContentScope = Object.freeze({ reach: "diaspora" })

/** Portée et pays d'une publication, relus par la règle du domaine (le moteur les a déjà validés à l'écriture). */
function scopeOf(item: FeedItem): ContentScope {
  const scope = parseContentScope({ reach: item.reach ?? ENGINE_POST_SCOPE.reach, country: item.country })
  return scope.ok ? scope.value : ENGINE_POST_SCOPE
}

/** Pourquoi la ligne est dans MON fil, dit par le moteur : l'ordre de « Pour vous », jamais un droit de lecture. */
function relationOf(item: FeedItem): FeedRelation {
  return {
    own: item.isMine || item.reason === "own",
    connection: item.reason === "connection",
    follow: item.reason === "follow",
    followedPage: item.reason === "page",
    memberGroup: item.reason === "group",
  }
}

/**
 * L'audience du moteur dans les mots du domaine : les abonnés d'une page
 * (`followers`, lot des pages du moteur) sont l'audience `page`. Une audience
 * inconnue se dit restreinte, jamais publique.
 */
const ENGINE_AUDIENCES: Readonly<Record<string, PostAudience>> = Object.freeze({
  public: "public",
  connections: "connections",
  group: "group",
  followers: "page",
})

function audienceOf(audience: string): PostAudience {
  return ENGINE_AUDIENCES[audience] ?? "connections"
}

/**
 * Qui parle : une page (sa carte, son badge calculé — l'auteur est alors le
 * SIGNATAIRE, PD5) ou une personne par son profil publié.
 */
function authorOf(item: FeedItem): PostView["author"] {
  if (item.page) {
    return { kind: "page", id: item.page.pageId, handle: item.page.handle, displayName: item.page.name, badges: [item.page.badge] }
  }
  return {
    kind: "person",
    id: item.author.personId ?? "",
    handle: item.author.handle ?? "",
    displayName: item.author.displayName ?? "",
    badges: item.author.badges,
  }
}

/** Un média tel que la garde des fichiers le délivre : son URL, ou la raison de sa retenue. */
export function toPostMediaView(media: EngineMedia): PostMediaView {
  return {
    kind: media.kind,
    url: media.withheld === null ? media.url : null,
    withheld: media.withheld === "fileScanPending" ? "scan_pending" : media.withheld === "fileScanUnavailable" ? "scan_unavailable" : media.withheld === "fileQuarantined" ? "quarantined" : null,
    altText: media.altText ?? null,
    width: media.width ?? null,
    height: media.height ?? null,
  }
}

/** Un média déposé, déclaré à la publication ; le moteur confronte la déclaration au fichier stocké. */
export function toDeclaredMedia(item: PublishMediaInput): DeclaredMedia {
  const altText = item.altText.trim()
  return {
    storageId: item.upload.ref as DeclaredMedia["storageId"],
    kind: item.upload.kind,
    mimeType: item.upload.mimeType,
    sizeBytes: item.upload.sizeBytes,
    ...(item.upload.width !== undefined ? { width: item.upload.width } : {}),
    ...(item.upload.height !== undefined ? { height: item.upload.height } : {}),
    ...(item.upload.durationMs !== undefined ? { durationMs: item.upload.durationMs } : {}),
    ...(altText ? { altText } : {}),
  }
}

/** L'original cité, re-gardé par le moteur pour CE lecteur : une page parle en son nom, sinon la personne. */
export function toSharedPostView(share: NonNullable<FeedItem["share"]>): SharedPostView {
  if (!share.available) return { available: false }
  return {
    available: true,
    postId: share.postId,
    author: share.page
      ? { kind: "page", handle: share.page.handle, displayName: share.page.name }
      : { kind: "person", handle: share.author.handle, displayName: share.author.displayName },
    body: share.body,
    media: share.media.map(toPostMediaView),
    publishedAt: share.publishedAt,
  }
}

export function toPostView(item: FeedItem): PostView {
  return {
    id: item._id,
    ...(item.eventGalleryId === undefined ? {} : { eventGalleryId: item.eventGalleryId }),
    author: authorOf(item),
    body: item.body,
    media: item.media.map(toPostMediaView),
    share: item.share ? toSharedPostView(item.share) : null,
    shareCount: item.shareCount,
    scope: scopeOf(item),
    audience: audienceOf(item.audience),
    visibility: item.visibility,
    // Le moteur ne rend au lecteur que du publié ; la relecture avant publication viendra avec PD6.
    moderation: "published",
    createdAt: item.publishedAt,
    reactionCount: item.reactions.total,
    commentCount: item.commentCount,
    myReaction: item.reactions.mine,
    isMine: item.isMine,
    bookmarked: item.viewer.bookmarked,
    edited: item.editedAt !== null,
    editedAt: item.editedAt,
  }
}

/** Le fil d'une portée : ce que le moteur rend au lecteur, trié par la règle du domaine (`admitsInFeedScope`). */
export function toFeed(items: readonly FeedItem[], scope: FeedScope, viewerCountry: CountryCode): PostView[] {
  return items.filter((item) => admitsInFeedScope(scope, { scope: scopeOf(item), relation: relationOf(item) }, viewerCountry)).map(toPostView)
}

/** Le mur d'un auteur : l'épinglée d'abord, jamais deux fois. */
export function toWall(wall: { readonly items: readonly FeedItem[]; readonly pinned: FeedItem | null }): PostView[] {
  const pinned = wall.pinned
  return [...(pinned ? [pinned] : []), ...wall.items.filter((item) => item._id !== pinned?._id)].map(toPostView)
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

/** Une projection de facette reçue du moteur : un pays inconnu est écarté, jamais deviné. */
function toFacetProjection(projection: Omit<FacetProjection, "countryOfResidence"> & { readonly countryOfResidence?: string }): FacetProjection {
  const { countryOfResidence, ...rest } = projection
  return { ...rest, ...(countryOfResidence !== undefined && isResidenceCountry(countryOfResidence) ? { countryOfResidence } : {}) }
}

/**
 * Le profil d'un membre : identité publique du moteur (`getPublicProfile`),
 * facette projetée pour le lecteur (`memberFacet`) et mur de l'auteur
 * (`personPosts`). Le nom du poste arrive avec les pages (PD5).
 */
function toProfileImage(image: PublicProfile["avatar"] | undefined): ProfileImageView | null {
  if (!image || (image.url === null && image.withheld === null)) return null
  return { url: image.withheld === null ? image.url : null, withheld: image.withheld }
}

export function toProfileView(profile: PublicProfile, member: MemberFacet, posts: readonly PostView[] = []): ProfileView {
  const facet = toFacetProjection(member.facet)
  return {
    personId: profile.personId,
    handle: profile.handle,
    displayName: profile.displayName,
    headline: profile.headline,
    avatar: toProfileImage(profile.avatar),
    cover: toProfileImage(profile.cover),
    badges: profile.badges,
    facet,
    publicFacet: member.preview ? toFacetProjection(member.preview) : facet,
    postName: null,
    isSelf: profile.isMe,
    posts,
  }
}

type DirectoryHit = FunctionReturnType<typeof api.modules.diaspora.directory.searchMembers>[number]

/** Un membre trouvé dans l'annuaire de la tranche : la facette déjà projetée pour le lecteur, un pays inconnu écarté. */
export function toMemberHitView(hit: DirectoryHit): MemberHitView {
  return {
    personId: hit.personId,
    handle: hit.handle,
    displayName: hit.displayName,
    headline: hit.headline,
    badges: hit.badges,
    facet: toFacetProjection(hit.facet),
  }
}

type EngineSuggestion = FunctionReturnType<typeof api.modules.diaspora.suggestions.forMe>[number]

/** Une suggestion de la tranche : la facette déjà projetée pour le lecteur, et ce qui rapproche. */
export function toSuggestionView(item: EngineSuggestion): SuggestionView {
  return { ...toMemberHitView(item), reasons: item.reasons }
}

type ConnectionWith = FunctionReturnType<typeof api.modules.graph.connections.connectionWith>

/**
 * Ma relation avec une personne, depuis le graphe du moteur. Une demande refusée
 * se lit « aucune relation » : le moteur permet de redemander. Un blocage posé
 * par l'autre est déjà rendu « none » par le moteur.
 */
export function toRelationView(connection: ConnectionWith, following: boolean): RelationView {
  switch (connection.state) {
    case "none":
    case "declined":
      return { connection: "none", connectionId: null, following }
    case "blocked_by_me":
      return { connection: "blocked_by_me", connectionId: connection.connectionId, following: false }
    default:
      return { connection: connection.state, connectionId: connection.connectionId, following }
  }
}

type EngineNotification = FunctionReturnType<typeof api.modules.notifications.bell.paginateNotifications>["page"][number]

const SPOKEN_KINDS: ReadonlySet<string> = new Set(NOTIFICATION_KINDS)

type ServiceNoticeView = import("@diasporale/features/data").ServiceNoticeView

/** Les avis de mise en relation (DG-010, DG-015, DG-016) : leur cible vient du moteur, relue avec les droits du lecteur. */
const SERVICE_NOTICE_KINDS: ReadonlySet<string> = new Set(SERVICE_NOTIFICATION_KINDS)

/** La cible d'un avis de mise en relation, telle que le moteur l'a relue : un interlocuteur et des références, jamais un contenu. */
function toServiceNoticeView(notice: EngineNotification["serviceNotice"]): ServiceNoticeView | null {
  return notice ? { audience: notice.audience, requestId: notice.requestId, pageHandle: notice.pageHandle } : null
}

/** Les avis de la vie communautaire (vague H) : l'objet qu'ils ouvrent, relu par le moteur avec les droits du lecteur. */
const COMMUNITY_NOTICE_KINDS: ReadonlySet<string> = new Set(COMMUNITY_NOTIFICATION_KINDS)

/** Les avis d'une conversation de mise en relation (CC-2b) : le fil est leur seul sujet. */
const CONTEXTUAL_NOTICE_KINDS: ReadonlySet<string> = new Set(CONTEXTUAL_NOTIFICATION_KINDS)

function toCommunityNoticeView(notice: EngineNotification["communityNotice"]): CommunityNoticeView | null {
  return notice ? { audience: notice.audience, opens: notice.opens, objectId: notice.objectId, pageHandle: notice.pageHandle } : null
}

/**
 * Un avis de la cloche du moteur. Un genre que DIASPORALE ne sait pas dire se dit
 * « nouvelle activité » ; une demande de relation porte son état VIVANT (encore à
 * trancher par moi, acceptée, refusée, ou disparue).
 */
export function toNotificationView(item: EngineNotification): NotificationView {
  const kind = (SPOKEN_KINDS.has(item.kind) ? item.kind : "other") as NotificationKind
  const invite = item.inviteState
  const subject = item.subject
  const pendingConnectionId =
    item.kind === "connection_request" && invite?.status === "requested" && invite.iAmRecipient && subject?.kind === "connection" ? subject.id : null
  const inviteOutcome =
    item.kind !== "connection_request" || !invite || invite.status === "requested"
      ? null
      : invite.status === "accepted"
        ? "accepted"
        : invite.status === "declined"
          ? "declined"
          : "gone"
  return {
    id: item.notificationId,
    kind,
    actor: item.kind !== "association_event_reminder" && item.actor?.handle && item.actor.displayName ? { handle: item.actor.handle, displayName: item.actor.displayName } : null,
    createdAt: item.createdAt,
    read: item.readAt !== null,
    pendingConnectionId,
    inviteOutcome,
    postId: subject?.kind === "post" ? subject.id : null,
    ...(item.kind === "association_event_reminder" ? { associationEvent: subject?.kind === "event" && item.associationEvent?.eventId === subject.id ? { eventId: item.associationEvent.eventId, pageHandle: item.associationEvent.pageHandle } : null } : {}),
    ...(SERVICE_NOTICE_KINDS.has(item.kind) ? { serviceNotice: toServiceNoticeView(item.serviceNotice) } : {}),
    ...(COMMUNITY_NOTICE_KINDS.has(item.kind) ? { communityNotice: toCommunityNoticeView(item.communityNotice) } : {}),
    // P16 · G9 : la carte de la page porteuse n'est servie qu'au signataire vivant d'un dossier de page ; sinon « Mes données ».
    ...(item.kind === "moderation_decision" ? { moderationDecision: { pageHandle: item.page?.handle ?? null } } : {}),
    // CC-6 : le fil d'une conversation de mise en relation, relu pour le destinataire par le moteur.
    ...(CONTEXTUAL_NOTICE_KINDS.has(item.kind) ? { contextualThreadId: subject?.kind === "contextualThread" ? subject.id : null } : {}),
  }
}

type EngineComment = FunctionReturnType<typeof api.modules.engagement.engagement.paginateComments>["page"][number]
type EngineReply = EngineComment["replies"][number]

/** Un commentaire du moteur : l'auteur par son profil publié (nom neutre s'il est retiré), jamais un corps relu ailleurs. */
export function toCommentView(item: EngineReply): CommentView {
  return {
    id: item.commentId,
    author: { personId: item.author.personId, handle: item.author.handle, displayName: item.author.displayName },
    body: item.body,
    createdAt: item.createdAt,
    edited: item.editedAt !== null,
    isMine: item.isMine,
  }
}

export function toCommentThreadView(item: EngineComment): CommentThreadView {
  return { ...toCommentView(item), replyCount: item.replyCount, replies: item.replies.map(toCommentView) }
}

type EngineBookmark = FunctionReturnType<typeof api.modules.marks.marks.paginateBookmarks>["page"][number]

/** Un signet du moteur : la page quand elle parle, sinon la personne par son profil publié. */
export function toBookmarkView(item: EngineBookmark): BookmarkView {
  return {
    postId: item.postId,
    author: item.page
      ? { kind: "page", handle: item.page.handle, displayName: item.page.name }
      : { kind: "person", handle: item.author.handle, displayName: item.author.displayName },
    body: item.body,
    publishedAt: item.publishedAt,
    markedAt: item.markedAt,
  }
}

// ═══════════════════════════════════════════════════════════════
// Pages (DG-007, chantier « pages ») — fiche, annuaire, listes du hub
// ═══════════════════════════════════════════════════════════════

type PageView = import("@diasporale/features/data").PageView
type PageDetailView = import("@diasporale/features/data").PageDetailView
type PageDirectoryEntry = import("@diasporale/features/data").PageDirectoryEntry
type PageDirectoryPage = import("@diasporale/features/data").PageDirectoryPage
type HubPagesView = import("@diasporale/features/data").HubPagesView
type EngineTrustBadge = import("@diasporale/domain").TrustBadge
type EnginePageTrust = import("@diasporale/domain").PageTrustLevel

type EnginePage = NonNullable<FunctionReturnType<typeof api.modules.pages.pages.getPage>>
type EnginePageWall = FunctionReturnType<typeof api.modules.pages.pages.pagePosts>
type EnginePageSummary = FunctionReturnType<typeof api.modules.pages.pages.paginateDiscover>["page"][number]
type EngineHubPages = FunctionReturnType<typeof api.modules.diaspora.hubPages.listCountryPages>
type EngineHubPage = EngineHubPages["associations"][number]
type EnginePageStanding = FunctionReturnType<typeof api.modules.diaspora.hubPages.pageStanding>
type EnginePageCard = Pick<EnginePage, "pageId" | "handle" | "name" | "shortName" | "logoUrl" | "badge" | "ownerKind" | "country">
  & { readonly city?: EnginePage["city"] | undefined; readonly associationType?: EnginePage["associationType"] | undefined; readonly sector?: EnginePage["sector"] | undefined }

/** La confiance d'une page se lit dans son badge, calculé par le moteur depuis elle (jamais déclaré). */
function pageTrustOf(badge: EngineTrustBadge): EnginePageTrust {
  return badge === "official" || badge === "verified" ? badge : "community"
}

/**
 * La carte allowlistée d'une page du moteur, dans les mots de DIASPORALE : le
 * logo tel que la garde des fichiers le délivre, un pays hors diaspora écarté
 * (jamais deviné), la ville et la catégorie déclarées par la page quand elles existent.
 */
function toEnginePageView(card: EnginePageCard, extra: { readonly description: string | null; readonly followerCount: number; readonly claimable: boolean }): PageView {
  return {
    id: card.pageId,
    handle: card.handle,
    name: card.name,
    ownerKind: card.ownerKind,
    trust: pageTrustOf(card.badge),
    badge: card.badge,
    country: card.country !== null && isResidenceCountry(card.country) ? card.country : null,
    city: card.city ?? null,
    ...(card.associationType != null ? { associationType: card.associationType } : {}),
    ...(card.sector != null ? { sector: card.sector } : {}),
    description: extra.description ?? "",
    followers: extra.followerCount,
    claimable: extra.claimable,
    shortName: card.shortName,
    logoUrl: card.logoUrl,
  }
}

/**
 * La fiche d'une page : la projection de `getPage` (compteurs de l'agrégat,
 * bannière par la garde des fichiers, rôle VIVANT et abonnement du lecteur), la
 * première fenêtre du mur projetée comme le fil, et la revendicabilité jugée par
 * la tranche. Le moteur n'a pas d'organisateur « page » : aucun évènement inventé.
 */
export function toPageDetailView(page: EnginePage, wall: EnginePageWall, standing: EnginePageStanding): PageDetailView {
  return {
    page: toEnginePageView(page, { description: page.description, followerCount: page.followerCount, claimable: standing?.claimable ?? false }),
    bannerUrl: page.bannerUrl,
    postCount: page.postCount,
    posts: wall.items.map(toPostView),
    morePosts: wall.nextCursor !== null,
    events: [],
    viewer: { role: page.viewer.role, following: page.viewer.following },
  }
}

/** Une ligne de l'annuaire du moteur ; il ne dit pas la revendicabilité (la fiche la dit). */
export function toPageDirectoryEntry(row: EnginePageSummary): PageDirectoryEntry {
  return { ...toEnginePageView(row, { description: row.description, followerCount: row.followerCount, claimable: false }), following: row.following }
}

/** Une fenêtre de l'annuaire : la fin se lit dans `isDone`, jamais dans une fenêtre vide. */
export function toPageDirectoryPage(result: { readonly page: readonly EnginePageSummary[]; readonly isDone: boolean; readonly continueCursor: string }): PageDirectoryPage {
  return { items: result.page.map(toPageDirectoryEntry), isDone: result.isDone, continueCursor: result.isDone ? null : result.continueCursor }
}

/** Les pages publiées et lisibles d'un pays (tranche `diaspora`), par nature, bornées. */
export function toHubPagesView(hub: EngineHubPages, country: CountryCode): HubPagesView {
  const view = (row: EngineHubPage) => toEnginePageView(row, row)
  return {
    country,
    officialPages: hub.officialPages.map(view),
    associations: hub.associations.map(view),
    companies: hub.companies.map(view),
    more: hub.more,
  }
}
