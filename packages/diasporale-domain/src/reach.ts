/**
 * Portée, visibilité et portées du fil.
 *
 * Deux axes à ne JAMAIS confondre (cahier §4) :
 *
 *   · la **portée** (`reach`) dit OÙ un contenu vit DANS DIASPORALE :
 *     `local` (le hub d'un pays) ou `diaspora` (tous les hubs) ;
 *   · la **visibilité** dit si le contenu SORT de DIASPORALE : `network`
 *     (il reste dans le réseau, toujours par défaut) ou `root` (il est aussi
 *     lu dans ANTIA, le réseau racine).
 *
 * `root` n'existe que par un GESTE explicite de l'auteur, et seulement pour
 * une audience `public` (invariant 2). Rien ici ne choisit `root` à sa place.
 */
import { isResidenceCountry, normalizeCountryCode, type CountryCode } from "./countries"
import { ok, refuse, type Result } from "./result"

export const REACH_VALUES = ["local", "diaspora"] as const
export type Reach = (typeof REACH_VALUES)[number]
export const DEFAULT_REACH: Reach = "local"

export const VISIBILITY_VALUES = ["network", "root"] as const
export type Visibility = (typeof VISIBILITY_VALUES)[number]
export const DEFAULT_VISIBILITY: Visibility = "network"

/**
 * Audiences d'une publication, héritées du moteur (EXF-DG-10) : `public`
 * (tout le réseau), `connections`, `group` (le mur d'un groupe), `page`.
 */
export const POST_AUDIENCES = ["public", "connections", "group", "page"] as const
export type PostAudience = (typeof POST_AUDIENCES)[number]

export function isReach(value: string): value is Reach {
  return (REACH_VALUES as readonly string[]).includes(value)
}

/** La case « Publier aussi sur ANTIA » n'a de sens que pour une audience publique. */
export function canAlsoPublishOnRoot(audience: PostAudience): boolean {
  return audience === "public"
}

/**
 * La visibilité d'un contenu : `root` si — et seulement si — l'audience est
 * publique ET que l'auteur l'a demandé. Une case cochée sur une audience
 * restreinte est ignorée, jamais promue.
 */
export function resolveVisibility(input: {
  audience: PostAudience
  alsoOnRoot: boolean
}): Visibility {
  return input.alsoOnRoot && canAlsoPublishOnRoot(input.audience) ? "root" : "network"
}

/**
 * Le lieu d'un contenu dans DIASPORALE. Un contenu `local` porte toujours son
 * pays ; un contenu `diaspora` peut garder son pays d'ORIGINE, affiché en
 * pastille dans les autres hubs (EXF-DG-16).
 */
export type ContentScope =
  | { readonly reach: "local"; readonly country: CountryCode }
  | { readonly reach: "diaspora"; readonly country?: CountryCode }

export const SCOPE_REFUSALS = [
  "scope_reach_invalid",
  "scope_country_required",
  "scope_country_invalid",
] as const
export type ScopeRefusal = (typeof SCOPE_REFUSALS)[number]

export function parseContentScope(input: {
  reach: string
  country?: string | null
}): Result<ContentScope, ScopeRefusal> {
  if (!isReach(input.reach)) return refuse("scope_reach_invalid")
  const raw = input.country ?? ""
  const code = normalizeCountryCode(raw)
  if (code.length === 0) {
    return input.reach === "local" ? refuse("scope_country_required") : ok({ reach: "diaspora" })
  }
  if (!isResidenceCountry(code)) return refuse("scope_country_invalid")
  return ok(input.reach === "local" ? { reach: "local", country: code } : { reach: "diaspora", country: code })
}

/** La portée proposée par défaut au composeur : le pays de résidence de l'auteur. */
export function defaultScopeFor(memberCountry: CountryCode): ContentScope {
  return { reach: "local", country: memberCountry }
}

/**
 * Un contenu paraît-il dans le hub d'un pays ? Le contenu local de ce pays,
 * plus tout ce qui a la portée `diaspora` (cahier §5, invariant 7).
 */
export function isShownInHub(scope: ContentScope, hubCountry: CountryCode): boolean {
  return scope.reach === "diaspora" || scope.country === hubCountry
}

/**
 * Le pays d'origine à afficher en pastille dans un hub : seulement pour un
 * contenu `diaspora` venu d'AILLEURS. Dans son propre hub, la pastille serait
 * du bruit.
 */
export function originCountryBadge(
  scope: ContentScope,
  hubCountry: CountryCode,
): CountryCode | null {
  if (scope.reach !== "diaspora" || scope.country === undefined) return null
  return scope.country === hubCountry ? null : scope.country
}

// ═══════════════════════════════════════════════════════════════
// Portées du fil (EXF-DG-13)
// ═══════════════════════════════════════════════════════════════

/**
 * Les quatre portées du fil, dans l'ordre d'affichage :
 *
 *   · `mon_pays` (défaut) : le contenu local de mon pays + la portée `diaspora` ;
 *   · `diaspora` : la couche commune, les seuls contenus de portée `diaspora` ;
 *   · `recents` : tout ce que j'ai le droit de lire dans le réseau, du plus récent ;
 *   · `pour_vous` : mes connexions, mes suivis, mes pages et mes groupes.
 */
export const FEED_SCOPES = ["mon_pays", "diaspora", "recents", "pour_vous"] as const
export type FeedScope = (typeof FEED_SCOPES)[number]
export const DEFAULT_FEED_SCOPE: FeedScope = "mon_pays"

/** Paramètre d'URL des portées, distinct de `tab` (les volets) — comme dans le socle. */
export const FEED_SCOPE_PARAM = "scope"

const FEED_SCOPE_ALIASES: Readonly<Record<string, FeedScope>> = Object.freeze({
  pays: "mon_pays",
  "mon-pays": "mon_pays",
  country: "mon_pays",
  "toute-la-diaspora": "diaspora",
  global: "diaspora",
  recent: "recents",
  pourvous: "pour_vous",
  "pour-vous": "pour_vous",
  foryou: "pour_vous",
})

/** La portée désignée par une valeur d'URL — jamais une valeur morte : l'inconnu rend le défaut. */
export function parseFeedScope(raw: string | null | undefined): FeedScope {
  if (raw === null || raw === undefined) return DEFAULT_FEED_SCOPE
  const key = raw.trim().toLowerCase()
  if ((FEED_SCOPES as readonly string[]).includes(key)) return key as FeedScope
  return FEED_SCOPE_ALIASES[key] ?? DEFAULT_FEED_SCOPE
}

/**
 * Les liens qui font entrer un contenu dans « Pour vous ». Un abonnement n'ouvre
 * aucun contenu restreint (règle du socle) : ces faits ne disent que l'ORDRE du
 * fil, la visibilité reste jugée par le moteur.
 */
export interface FeedRelation {
  readonly own: boolean
  readonly connection: boolean
  readonly follow: boolean
  readonly followedPage: boolean
  readonly memberGroup: boolean
}

/** Un seul lien choisi suffit à faire entrer un contenu dans « Pour vous ». */
export function isChosenRelation(relation: FeedRelation): boolean {
  return relation.own || relation.connection || relation.follow || relation.followedPage || relation.memberGroup
}

/**
 * Un contenu DÉJÀ VISIBLE par le lecteur entre-t-il dans la portée demandée ?
 * Ce prédicat ordonne le fil ; il n'accorde jamais un droit de lecture.
 */
export function admitsInFeedScope(
  feedScope: FeedScope,
  content: { readonly scope: ContentScope; readonly relation: FeedRelation },
  viewerCountry: CountryCode,
): boolean {
  switch (feedScope) {
    case "mon_pays":
      return isShownInHub(content.scope, viewerCountry)
    case "diaspora":
      return content.scope.reach === "diaspora"
    case "recents":
      return true
    case "pour_vous":
      return isChosenRelation(content.relation)
  }
}
