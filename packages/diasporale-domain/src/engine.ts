/**
 * Projection de DIASPORALE dans le vocabulaire du moteur ANTSIA (PD1) : la
 * graine du réseau `diasporale` et sa facette au format `facetSchema` du
 * moteur, la correspondance des visibilités par champ, et la lecture inverse
 * (lien IDN, facette, source de vérification) dont la tranche
 * `convex/modules/diaspora` a besoin pour appliquer les règles du domaine.
 *
 * Le domaine reste SANS dépendance : les listes du moteur sont recopiées ici
 * (miroir de `@antsia/social-domain/facets` et `/network`), et le moteur
 * vérifie de son côté que cette graine passe ses validateurs (test de la
 * tranche `convex/modules/diaspora`).
 */
import { DEFAULT_OPEN_COUNTRIES, HOME_COUNTRY, isResidenceCountry } from "./countries"
import {
  deriveMembershipStatus,
  IDN_LOA_MAX,
  IDN_LOA_MIN,
  type IdnGround,
  type MembershipGrounds,
} from "./eligibility"
import {
  CITY_MAX_LENGTH,
  ASSOCIATIONS_MAX,
  DEFAULT_FACET_VISIBILITY,
  FACET_FIELDS,
  isFieldVisibility,
  type DiasporaFacet,
  type FacetField,
  type FieldVisibility,
} from "./facet"
import { DIASPORALE_NETWORK } from "./network"

/**
 * Nom de la tranche du moteur qui gouverne l'entrée dans le réseau et sa
 * facette (`convex/modules/diaspora`). Les fonctions génériques du moteur
 * (entrée, facette) ne doivent pas servir ce réseau : elles ignorent la
 * nationalité, le parrainage et l'attestation consulaire.
 */
export const DIASPORALE_SLICE = "diaspora"

/** Miroir de `FACET_FIELD_KINDS` du moteur. */
export const ENGINE_FACET_FIELD_KINDS = ["text", "country", "enum", "textList", "year", "boolean"] as const
export type EngineFacetFieldKind = (typeof ENGINE_FACET_FIELD_KINDS)[number]

/** Miroir de `FACET_VISIBILITIES` du moteur : personne, les membres du réseau, ou aussi la racine. */
export const ENGINE_FACET_VISIBILITIES = ["hidden", "network", "root"] as const
export type EngineFacetVisibility = (typeof ENGINE_FACET_VISIBILITIES)[number]

export interface EngineFacetField {
  readonly key: FacetField
  readonly kind: EngineFacetFieldKind
  readonly required: boolean
  readonly defaultVisibility: EngineFacetVisibility
  readonly maxLength?: number
  readonly maxItems?: number
  readonly excludedValues?: readonly string[]
}

/**
 * Visibilité d'un champ telle que le MOTEUR GÉNÉRIQUE l'applique. Seul « tout le
 * réseau » y devient `network` ; « moi seul », « mes relations » et « mon pays »
 * deviennent `hidden` : un lecteur générique du moteur ne voit jamais plus que la
 * règle DIASPORALE, dont la tranche `diaspora` applique elle-même les niveaux
 * fins. Jamais `root` : une facette DIASPORALE ne se lit pas depuis ANTSIA.
 */
export function toEngineFacetVisibility(level: FieldVisibility): EngineFacetVisibility {
  return level === "network" ? "network" : "hidden"
}

const FIELD_SHAPES: Readonly<Record<FacetField, Omit<EngineFacetField, "key" | "defaultVisibility">>> = {
  countryOfResidence: { kind: "country", required: true, excludedValues: [HOME_COUNTRY] },
  city: { kind: "text", required: false, maxLength: CITY_MAX_LENGTH },
  postSlug: { kind: "text", required: false, maxLength: 80 },
  associationIds: { kind: "textList", required: false, maxItems: ASSOCIATIONS_MAX },
  arrivedAt: { kind: "year", required: false },
  helpAvailable: { kind: "boolean", required: false },
}

/** La facette diaspora au format `facetSchema` du moteur, dans l'ordre du domaine. */
export const DIASPORALE_FACET_SCHEMA: { readonly fields: readonly EngineFacetField[] } = Object.freeze({
  fields: FACET_FIELDS.map((key) => ({
    key,
    ...FIELD_SHAPES[key],
    defaultVisibility: toEngineFacetVisibility(DEFAULT_FACET_VISIBILITY[key]),
  })),
})

/** La graine du réseau `diasporale` (réglages du moteur), idempotente côté moteur. */
export const DIASPORALE_NETWORK_SEED = Object.freeze({
  slug: DIASPORALE_NETWORK.slug,
  kind: DIASPORALE_NETWORK.kind,
  parentSlug: DIASPORALE_NETWORK.parentSlug,
  name: "DIASPORALE",
  membershipPolicy: DIASPORALE_NETWORK.membershipPolicy,
  defaultVisibility: DIASPORALE_NETWORK.defaultVisibility,
  facetSchema: DIASPORALE_FACET_SCHEMA,
  reachValues: [...DIASPORALE_NETWORK.reachValues],
  openCountries: [...DEFAULT_OPEN_COUNTRIES],
  theme: "diasporale",
})

/** Valeur d'un champ de facette, à la forme exacte de `personFacets.values` du moteur. */
export type EngineFacetValue = string | number | boolean | string[]

/**
 * Valeurs et visibilités d'une facette, prêtes pour `personFacets` du moteur :
 * champs vides omis, visibilités projetées par `toEngineFacetVisibility`.
 */
export function toEngineFacet(facet: DiasporaFacet): {
  values: Record<string, EngineFacetValue>
  visibilities: Record<string, EngineFacetVisibility>
} {
  const values: Record<string, EngineFacetValue> = { countryOfResidence: facet.countryOfResidence }
  if (facet.city) values.city = facet.city
  if (facet.postSlug) values.postSlug = facet.postSlug
  if (facet.associationIds.length > 0) values.associationIds = [...facet.associationIds]
  if (facet.arrivedAt !== undefined) values.arrivedAt = facet.arrivedAt
  values.helpAvailable = facet.helpAvailable
  const visibilities: Record<string, EngineFacetVisibility> = {}
  for (const field of FACET_FIELDS) visibilities[field] = toEngineFacetVisibility(facet.visibility[field])
  return { values, visibilities }
}

// ═══════════════════════════════════════════════════════════════
// Lecture inverse — des enregistrements du moteur vers les faits du domaine
// ═══════════════════════════════════════════════════════════════

/** Codes de la nationalité gabonaise qu'IDN peut rendre (ISO 3166-1 alpha-2 et alpha-3). */
export const GABONESE_NATIONALITY_CODES: readonly string[] = Object.freeze(["GA", "GAB"])

/**
 * Le lien IDN du moteur (`identityLinks`, fournisseur `idn`) lu comme fait du
 * domaine. Nationalité absente : inconnue (`null`), ce qui n'exclut pas ;
 * gabonaise : `true` ; toute autre : `false`. Un niveau de garantie absent ou
 * hors bornes vaut le plus bas : un doute ne vérifie jamais personne.
 */
export function idnGroundFromLink(link: { readonly loa?: number | undefined; readonly nationality?: string | undefined }): IdnGround {
  const { loa } = link
  const validLoa = loa !== undefined && Number.isInteger(loa) && loa >= IDN_LOA_MIN && loa <= IDN_LOA_MAX
  const nationality = link.nationality?.trim().toUpperCase() ?? ""
  return {
    loa: validLoa ? loa : IDN_LOA_MIN,
    gaboneseNationality: nationality === "" ? null : GABONESE_NATIONALITY_CODES.includes(nationality),
  }
}

/** Sources de vérification du moteur (`networkMemberships.verifiedBy`) qu'emploie DIASPORALE. */
export type EngineVerificationSource = "consulat" | "idn"

/**
 * Qui a vérifié, au vocabulaire du moteur, quand les faits vérifient :
 * l'attestation consulaire d'abord, sinon IDN (`loa ≥ 2`, avec parrainage).
 * `null` quand les faits ne vérifient pas.
 */
export function engineVerificationSource(grounds: MembershipGrounds, now: number): EngineVerificationSource | null {
  if (deriveMembershipStatus(grounds, now) !== "verifiee") return null
  return grounds.consularAttestation ? "consulat" : "idn"
}

/**
 * La facette relue depuis le moteur : les valeurs de `personFacets` et les
 * niveaux fins de visibilité que la tranche conserve à part (le moteur générique
 * ne connaît que `hidden`, `network` et `root`). Une valeur hors forme est
 * ignorée, jamais devinée ; sans pays de résidence valide, il n'y a pas de facette.
 */
export function facetFromEngine(
  values: Readonly<Record<string, EngineFacetValue | undefined>>,
  levels: Readonly<Record<string, string | undefined>> | null,
): DiasporaFacet | null {
  const country = values.countryOfResidence
  if (typeof country !== "string" || !isResidenceCountry(country)) return null
  const visibility: Record<FacetField, FieldVisibility> = { ...DEFAULT_FACET_VISIBILITY }
  for (const field of FACET_FIELDS) {
    const level = levels?.[field]
    if (level !== undefined && isFieldVisibility(level)) visibility[field] = level
  }
  const { city, postSlug, associationIds, arrivedAt, helpAvailable } = values
  return {
    countryOfResidence: country,
    ...(typeof city === "string" && city.length > 0 ? { city } : {}),
    ...(typeof postSlug === "string" && postSlug.length > 0 ? { postSlug } : {}),
    associationIds: Array.isArray(associationIds) ? associationIds.filter((id): id is string => typeof id === "string") : [],
    ...(typeof arrivedAt === "number" && Number.isInteger(arrivedAt) ? { arrivedAt } : {}),
    helpAvailable: helpAvailable === true,
    visibility,
  }
}
