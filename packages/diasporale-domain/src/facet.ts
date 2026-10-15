/**
 * La facette diaspora d'une personne (cahier §7 et EXF-DG-08).
 *
 * Une facette n'est pas une seconde personne : ce sont les attributs propres
 * au réseau `diasporale` (pays et ville de résidence, poste de rattachement,
 * associations, année d'arrivée, disponibilité pour l'entraide), chacun avec
 * sa visibilité. Le handle, le nom affiché et l'avatar restent ceux de la
 * personne dans le moteur (une personne, un handle).
 *
 * Protection par défaut (RGPD art. 25) : seul le pays est visible du réseau
 * par défaut ; la ville des seules connexions ; le reste de soi seul.
 */
import { parseResidenceCountry, type CountryCode, type ResidenceCountryRefusal } from "./countries"
import { ok, refuse, type Result } from "./result"
import { utcYear } from "./time"

export const FACET_FIELDS = [
  "countryOfResidence",
  "city",
  "postSlug",
  "associationIds",
  "arrivedAt",
  "helpAvailable",
] as const
export type FacetField = (typeof FACET_FIELDS)[number]

/**
 * Visibilité d'un champ, CUMULATIVE : chaque niveau inclut les précédents.
 * `only_me` ⊂ `connections` ⊂ `country` ⊂ `network`. Rien ne sort du réseau :
 * une facette n'est jamais lue depuis ANTIA.
 */
export const FIELD_VISIBILITY_LEVELS = ["only_me", "connections", "country", "network"] as const
export type FieldVisibility = (typeof FIELD_VISIBILITY_LEVELS)[number]

export type FacetVisibility = Readonly<Record<FacetField, FieldVisibility>>

export const DEFAULT_FACET_VISIBILITY: FacetVisibility = Object.freeze({
  countryOfResidence: "network",
  city: "connections",
  postSlug: "only_me",
  associationIds: "only_me",
  arrivedAt: "only_me",
  helpAvailable: "network",
})

export const CITY_MAX_LENGTH = 80
export const ASSOCIATIONS_MAX = 20
/** Borne basse de l'année d'arrivée : au-delà, la saisie est une erreur, pas une histoire. */
export const ARRIVED_AT_MIN_YEAR = 1950

/** La facette telle que le moteur la conserve. */
export interface DiasporaFacet {
  readonly countryOfResidence: CountryCode
  readonly city?: string
  /**
   * Poste consulaire de rattachement. Posé UNIQUEMENT par l'attestation
   * consulaire (contrat `DIASPORA-ATTESTATION-V1`) : jamais saisi.
   */
  readonly postSlug?: string
  readonly associationIds: readonly string[]
  readonly arrivedAt?: number
  readonly helpAvailable: boolean
  readonly visibility: FacetVisibility
}

/** Ce que la personne peut SAISIR — `postSlug` n'y figure pas, par construction. */
export interface FacetInput {
  readonly countryOfResidence: string
  readonly city?: string | null
  readonly associationIds?: readonly string[]
  readonly arrivedAt?: number | null
  readonly helpAvailable?: boolean
  readonly visibility?: Partial<Record<FacetField, string>>
}

export const FACET_REFUSALS = [
  "country_required",
  "country_unknown",
  "country_is_home",
  "city_too_long",
  "city_invalid",
  "arrived_at_out_of_range",
  "too_many_associations",
  "association_id_invalid",
  "visibility_invalid",
] as const
export type FacetRefusal = (typeof FACET_REFUSALS)[number]

export function isFieldVisibility(value: string): value is FieldVisibility {
  return (FIELD_VISIBILITY_LEVELS as readonly string[]).includes(value)
}

// Caractères de contrôle (dont retours à la ligne) : une ville tient sur une ligne.
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]")

function parseCity(raw: string | null | undefined): Result<string | undefined, FacetRefusal> {
  if (raw === null || raw === undefined) return ok(undefined)
  const city = raw.trim().replace(/\s+/g, " ")
  if (city.length === 0) return ok(undefined)
  if (CONTROL_CHARS.test(raw)) return refuse("city_invalid")
  if (city.length > CITY_MAX_LENGTH) return refuse("city_too_long")
  return ok(city)
}

function parseArrivedAt(raw: number | null | undefined, now: number): Result<number | undefined, FacetRefusal> {
  if (raw === null || raw === undefined) return ok(undefined)
  if (!Number.isInteger(raw) || raw < ARRIVED_AT_MIN_YEAR || raw > utcYear(now)) {
    return refuse("arrived_at_out_of_range")
  }
  return ok(raw)
}

function parseAssociationIds(raw: readonly string[] | undefined): Result<string[], FacetRefusal> {
  const ids = [...new Set((raw ?? []).map((id) => id.trim()))]
  if (ids.length > ASSOCIATIONS_MAX) return refuse("too_many_associations")
  if (ids.some((id) => id.length === 0)) return refuse("association_id_invalid")
  return ok(ids)
}

function parseVisibility(raw: FacetInput["visibility"]): Result<FacetVisibility, FacetRefusal> {
  const visibility: Record<FacetField, FieldVisibility> = { ...DEFAULT_FACET_VISIBILITY }
  for (const field of FACET_FIELDS) {
    const value = raw?.[field]
    if (value === undefined) continue
    if (!isFieldVisibility(value)) return refuse("visibility_invalid")
    visibility[field] = value
  }
  return ok(visibility)
}

/**
 * Valide la saisie d'une facette et rend la facette normalisée. Le poste de
 * rattachement existant est conservé tel quel (il ne vient que de l'attestation).
 */
export function parseFacetInput(
  input: FacetInput,
  now: number,
  current?: Pick<DiasporaFacet, "postSlug">,
): Result<DiasporaFacet, FacetRefusal | ResidenceCountryRefusal> {
  const country = parseResidenceCountry(input.countryOfResidence)
  if (!country.ok) return country
  const city = parseCity(input.city)
  if (!city.ok) return city
  const arrivedAt = parseArrivedAt(input.arrivedAt, now)
  if (!arrivedAt.ok) return arrivedAt
  const associationIds = parseAssociationIds(input.associationIds)
  if (!associationIds.ok) return associationIds
  const visibility = parseVisibility(input.visibility)
  if (!visibility.ok) return visibility
  return ok({
    countryOfResidence: country.value,
    ...(city.value !== undefined ? { city: city.value } : {}),
    ...(current?.postSlug !== undefined ? { postSlug: current.postSlug } : {}),
    associationIds: associationIds.value,
    ...(arrivedAt.value !== undefined ? { arrivedAt: arrivedAt.value } : {}),
    helpAvailable: input.helpAvailable ?? false,
    visibility: visibility.value,
  })
}

// ═══════════════════════════════════════════════════════════════
// Projection — ce qu'un lecteur voit de la facette
// ═══════════════════════════════════════════════════════════════

/** Ce que le serveur sait du lecteur au moment de projeter. */
export interface FacetViewer {
  readonly isSelf: boolean
  readonly isConnection: boolean
  /** Membre actif du réseau (`declaree` ou `verifiee`) résidant dans le MÊME pays. */
  readonly isSameCountryMember: boolean
  /** Membre actif du réseau (`declaree` ou `verifiee`). */
  readonly isActiveMember: boolean
}

export function isFieldVisibleTo(level: FieldVisibility, viewer: FacetViewer): boolean {
  if (viewer.isSelf) return true
  switch (level) {
    case "only_me":
      return false
    case "connections":
      return viewer.isConnection
    case "country":
      return viewer.isConnection || viewer.isSameCountryMember
    case "network":
      return viewer.isConnection || viewer.isSameCountryMember || viewer.isActiveMember
  }
}

/** Projection allowlistée : seuls les champs visibles du lecteur, jamais l'enregistrement source. */
export interface FacetProjection {
  countryOfResidence?: CountryCode
  city?: string
  postSlug?: string
  associationIds?: readonly string[]
  arrivedAt?: number
  helpAvailable?: boolean
}

export function projectFacet(facet: DiasporaFacet, viewer: FacetViewer): FacetProjection {
  const projection: FacetProjection = {}
  const visible = (field: FacetField) => isFieldVisibleTo(facet.visibility[field], viewer)
  if (visible("countryOfResidence")) projection.countryOfResidence = facet.countryOfResidence
  if (facet.city !== undefined && visible("city")) projection.city = facet.city
  if (facet.postSlug !== undefined && visible("postSlug")) projection.postSlug = facet.postSlug
  if (facet.associationIds.length > 0 && visible("associationIds")) projection.associationIds = facet.associationIds
  if (facet.arrivedAt !== undefined && visible("arrivedAt")) projection.arrivedAt = facet.arrivedAt
  if (facet.helpAvailable && visible("helpAvailable")) projection.helpAvailable = true
  return projection
}

/**
 * L'attestation consulaire pose le poste de rattachement et, si la facette
 * n'en avait pas, le pays attesté (PD3, point 4). Elle ne remplace jamais un
 * pays déjà déclaré : la personne reste maîtresse de sa déclaration.
 */
export function applyAttestationToFacet(
  facet: DiasporaFacet | null,
  attested: { readonly postSlug: string; readonly countryOfResidence: CountryCode },
): DiasporaFacet {
  if (facet === null) {
    return {
      countryOfResidence: attested.countryOfResidence,
      postSlug: attested.postSlug,
      associationIds: [],
      helpAvailable: false,
      visibility: DEFAULT_FACET_VISIBILITY,
    }
  }
  return { ...facet, postSlug: attested.postSlug }
}
