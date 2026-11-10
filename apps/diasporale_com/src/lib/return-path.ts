/**
 * La page demandée avant la connexion (UX-02, MO-03) : un lien reçu (évènement, page, offre)
 * mène à sa page une fois la personne entrée, au lieu du fil.
 *
 *  · Une fonction PURE (`parseReturnPath`) n'accepte qu'un chemin interne connu de la table des
 *    routes : aucune adresse complète, aucun schéma, ni double barre ni barre inverse, aucun
 *    segment hors charte. Seuls les paramètres de filtre de la table survivent : un jeton, un code
 *    ou un traceur sont retirés. Une valeur inconnue ne rend rien, et la sortie mène au fil.
 *  · La mémoire vit dans l'onglet (`sessionStorage`), jamais dans l'adresse, avec une échéance.
 *    Elle survit à un rechargement et à un aller-retour par un fournisseur d'identité. Préfixe
 *    `antsia:` : la déconnexion de partout du moteur la purge aussi.
 *  · Les sorties la LISENT (`peekReturnPath`) et y mènent toutes de la même façon : la porte, le
 *    code, IDN, la fin de l'accueil. L'arrivée sur une page de membre l'efface : elle sert une fois.
 */
import { hasCapability, type CountryCode, type MemberCapability, type MembershipStatus } from "@diasporale/domain"

import { ROUTE_FILTER_KEYS, routes } from "./routes"

/** Ce qu'une page demande pour s'afficher : une capacité de membre, ou une personne connectée seulement. */
export type ReturnNeed = MemberCapability | "person"

export interface ReturnDestination {
  /** Le chemin interne, normalisé : chemin de la table, filtres connus, ancre. */
  readonly path: string
  readonly needs: ReturnNeed
}

/** La personne qui sort de l'entrée avec une adhésion vivante : son statut et le pays de son hub. */
export interface EntryMember {
  readonly status: MembershipStatus
  readonly country: CountryCode
}

/** Une adresse de plus n'est plus un lien partagé : au-delà, rien n'est retenu. */
const MAX_PATH_LENGTH = 512
const MAX_SEGMENT_LENGTH = 160
const MAX_FILTER_LENGTH = 200
/** Sous-adresses d'une base qui en a (messagerie : conversation, composeur). */
const MAX_SUBPATH_SEGMENTS = 3
const SAFE_SEGMENT = /^[A-Za-z0-9._~@%-]+$/
const SAFE_ANCHOR = /^[a-z0-9-]{1,64}$/

/**
 * Un segment variable des adresses de la table (identifiant, pays) : il tient la place de la valeur.
 * Typé `string` : il passe aussi pour un code pays, le temps de composer l'adresse du hub.
 */
const SEGMENT: string = "segment"

interface DestinationRule {
  readonly segments: readonly string[]
  readonly needs: ReturnNeed
  readonly subpaths: boolean
}

/** Le chemin d'une adresse de la table, sans requête ni ancre. */
function pathOf(href: string): string {
  const end = href.search(/[?#]/)
  return end === -1 ? href : href.slice(0, end)
}

function rule(href: string, needs: ReturnNeed, subpaths = false): DestinationRule {
  return { segments: pathOf(href).split("/").slice(1), needs, subpaths }
}

/**
 * Les pages qu'une connexion peut rendre : celles que garde la session (membre ou personne),
 * composées par la table elle-même. L'entrée, l'accueil et les pages publiques n'y sont pas.
 * La capacité ne sert qu'au compte en attente : sans elle, il arrive sur son hub.
 */
const DESTINATIONS: readonly DestinationRule[] = [
  rule(routes.feed(), "read_network"),
  rule(routes.hub(SEGMENT as CountryCode), "read_network"),
  rule(routes.profile(SEGMENT), "read_network"),
  rule(routes.album(SEGMENT, SEGMENT), "read_network"),
  rule(routes.post(SEGMENT), "read_network"),
  rule(routes.pages(), "read_network"),
  rule(routes.page(SEGMENT), "read_network"),
  rule(routes.pageManage(SEGMENT), "read_network"),
  rule(routes.pageClaim(SEGMENT), "read_network"),
  rule(routes.associationMembers(SEGMENT), "read_network"),
  rule(routes.associationGroup(SEGMENT), "read_network"),
  rule(routes.associationEvent(SEGMENT, SEGMENT), "read_network"),
  rule(routes.bookmarks(), "read_network"),
  rule(routes.members(), "view_directory"),
  rule(routes.relations(), "read_network"),
  rule(routes.messages(), "communicate", true),
  rule(routes.newStory(), "publish"),
  rule(routes.stories(), "read_network"),
  rule(routes.explore(), "read_network"),
  rule(routes.communities(), "read_network"),
  rule(routes.agenda(), "read_network"),
  rule(routes.services(), "read_network"),
  rule(routes.serviceOffer(SEGMENT), "read_network"),
  rule(routes.myActivity(), "read_network"),
  rule(routes.activityRequest(SEGMENT), "read_network"),
  rule(routes.myServiceRequests(), "read_network"),
  rule(routes.serviceRequest(SEGMENT), "read_network"),
  rule(routes.newPage(), "create_page"),
  rule(routes.myAssociations(), "read_network"),
  rule(routes.mutualAid(), "read_network"),
  rule(routes.mutualAidItem(SEGMENT), "read_network"),
  rule(routes.arrivalKit(), "read_network"),
  rule(routes.arrivalKitResource(SEGMENT), "read_network"),
  rule(routes.mentoring(), "read_network"),
  rule(routes.mentorProfile(SEGMENT), "read_network"),
  rule(routes.myMentoring(), "read_network"),
  rule(routes.jobs(), "read_network"),
  rule(routes.jobOffer(SEGMENT), "read_network"),
  rule(routes.myApplications(), "read_network"),
  rule(routes.talents(), "read_network"),
  rule(routes.moderationDesk(), "read_network"),
  rule(routes.pilotDashboard(), "read_network"),
  rule(routes.settings(), "read_network"),
  rule(routes.sponsor(), "sponsor"),
  rule(routes.attestation(), "read_network"),
  rule(routes.myData(), "person"),
]

/** Hors de l'ASCII imprimable (blancs et caractères de contrôle compris) : rien ne passe. */
function hasUnprintable(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 0x21 || code > 0x7e) return true
  }
  return false
}

/** Un caractère de contrôle, une fois la valeur décodée. */
function hasControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/** Un segment variable : charte des identifiants, aucun « . » ni « .. », ni barre ni blanc une fois décodé. */
function isSafeValue(segment: string): boolean {
  if (segment.length === 0 || segment.length > MAX_SEGMENT_LENGTH || !SAFE_SEGMENT.test(segment)) return false
  if (segment === "." || segment === "..") return false
  try {
    const decoded = decodeURIComponent(segment)
    return decoded.length > 0 && !/[\s/\\]/.test(decoded) && !hasControl(decoded)
  } catch {
    return false
  }
}

function segmentMatches(expected: string, actual: string): boolean {
  const at = expected.indexOf(SEGMENT)
  if (at === -1) return expected === actual
  const prefix = expected.slice(0, at)
  const suffix = expected.slice(at + SEGMENT.length)
  if (!actual.startsWith(prefix) || !actual.endsWith(suffix) || actual.length <= prefix.length + suffix.length) return false
  return isSafeValue(actual.slice(prefix.length, actual.length - suffix.length))
}

function ruleMatches(candidate: DestinationRule, segments: readonly string[]): boolean {
  const base = candidate.segments.length
  const extra = segments.length - base
  if (extra < 0 || extra > (candidate.subpaths ? MAX_SUBPATH_SEGMENTS : 0)) return false
  if (!candidate.segments.every((expected, index) => segmentMatches(expected, segments[index] ?? ""))) return false
  return segments.slice(base).every(isSafeValue)
}

/**
 * Le chemin interne retenu d'une page demandée, ou `null`. Refuse toute adresse externe, double
 * barre, barre inverse, schéma, blanc ou chemin inconnu de la table ; ne garde que les filtres de
 * la table (les autres paramètres, jetons compris, sont retirés) et une ancre simple.
 */
export function parseReturnPath(raw: unknown): ReturnDestination | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_PATH_LENGTH) return null
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || hasUnprintable(raw)) return null

  const hashAt = raw.indexOf("#")
  const beforeHash = hashAt === -1 ? raw : raw.slice(0, hashAt)
  const anchor = hashAt === -1 ? "" : raw.slice(hashAt + 1)
  const queryAt = beforeHash.indexOf("?")
  const pathname = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt)
  const search = queryAt === -1 ? "" : beforeHash.slice(queryAt + 1)

  const segments = pathname.split("/").slice(1)
  // Une barre finale (`/fil/`) désigne la même page.
  if (segments.length > 1 && segments.at(-1) === "") segments.pop()
  const matched = DESTINATIONS.find((candidate) => ruleMatches(candidate, segments))
  if (!matched) return null

  const filters = new URLSearchParams()
  for (const [key, value] of new URLSearchParams(search)) {
    if (!(ROUTE_FILTER_KEYS as readonly string[]).includes(key)) continue
    if (value.length > MAX_FILTER_LENGTH || hasControl(value)) continue
    filters.append(key, value)
  }
  const query = filters.toString()
  const path = `/${segments.join("/")}${query ? `?${query}` : ""}${SAFE_ANCHOR.test(anchor) ? `#${anchor}` : ""}`
  return { path, needs: matched.needs }
}

/** L'adhésion vivante d'une session (un départ n'en est plus une), réduite à ce que la sortie lit. */
export function liveMember(
  membership: { readonly status: MembershipStatus; readonly facet: { readonly countryOfResidence: CountryCode } } | null,
): EntryMember | null {
  if (membership === null || membership.status === "partie") return null
  return { status: membership.status, country: membership.facet.countryOfResidence }
}

/** La page demandée pour une adhésion vivante, ou `null` quand un compte en attente ne peut pas la lire. */
function landingFor(destination: ReturnDestination, member: EntryMember): string | null {
  if (member.status !== "en_attente" || destination.needs === "person") return destination.path
  return hasCapability("en_attente", destination.needs) ? destination.path : null
}

/**
 * La sortie de la porte (code, IDN, session déjà ouverte). Un membre va à la page demandée, ou à
 * son fil ; un compte en attente qui ne peut pas la lire, à son hub. Sans adhésion, l'accueil
 * d'abord — sauf pour ses droits personnels (« Mes données »), ouverts hors adhésion.
 */
export function entryExit(member: EntryMember | null, destination: ReturnDestination | null): string {
  if (member === null) return destination?.needs === "person" ? destination.path : routes.welcome()
  if (destination === null) return routes.feed()
  return landingFor(destination, member) ?? routes.hub(member.country)
}

/** La fin de l'accueil d'un nouveau membre : la page demandée s'il peut la lire, sinon son hub et l'avis de bienvenue. */
export function welcomeExit(member: EntryMember, destination: ReturnDestination | null): string {
  return (destination === null ? null : landingFor(destination, member)) ?? routes.hubWelcome(member.country)
}

// ═══════════════════════════════════════════════════════════════
// La mémoire de l'onglet
// ═══════════════════════════════════════════════════════════════

/** Préfixe `antsia:` : la déconnexion de partout du moteur purge aussi cette clé. */
export const RETURN_PATH_KEY = "antsia:diasporale:return-path"
/** Le temps d'entrer, de lire son code ou de passer par IDN ; au-delà, la sortie mène au fil. */
export const RETURN_PATH_TTL_MS = 30 * 60 * 1000

export type TabStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

function tabStorage(): TabStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage
  } catch {
    return null
  }
}

/**
 * Retient la page où la garde a arrêté la personne. Une page que la table ne connaît pas n'est
 * pas retenue, et ne remplace pas la précédente.
 */
export function rememberReturnPath(
  location: { readonly pathname: string; readonly search: string; readonly hash: string },
  now: number = Date.now(),
  storage: TabStorage | null = tabStorage(),
): void {
  const destination = parseReturnPath(`${location.pathname}${location.search}${location.hash}`)
  if (destination === null) return
  try {
    storage?.setItem(RETURN_PATH_KEY, JSON.stringify({ path: destination.path, at: now }))
  } catch {
    // Stockage refusé : la sortie mène au fil, seul le confort est perdu.
  }
}

/** La page demandée, relue et revalidée ; `null` si absente, échue ou altérée. */
export function peekReturnPath(now: number = Date.now(), storage: TabStorage | null = tabStorage()): ReturnDestination | null {
  try {
    const raw = storage?.getItem(RETURN_PATH_KEY)
    if (!raw) return null
    const stored: unknown = JSON.parse(raw)
    if (typeof stored !== "object" || stored === null) return null
    const { path, at } = stored as { readonly path?: unknown; readonly at?: unknown }
    if (typeof at !== "number" || at > now || now - at > RETURN_PATH_TTL_MS) return null
    return parseReturnPath(path)
  } catch {
    return null
  }
}

/** Oublie la page demandée : à l'arrivée, et à la déconnexion. */
export function forgetReturnPath(storage: TabStorage | null = tabStorage()): void {
  try {
    storage?.removeItem(RETURN_PATH_KEY)
  } catch {
    // Rien à oublier.
  }
}
