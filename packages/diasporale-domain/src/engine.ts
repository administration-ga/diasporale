/**
 * Projection de DIASPORALE dans le vocabulaire du moteur ANTIA (PD1) : la
 * graine du réseau `diasporale` et sa facette au format `facetSchema` du
 * moteur, et la correspondance des visibilités par champ.
 *
 * Le domaine reste SANS dépendance : les listes du moteur sont recopiées ici
 * (miroir de `@antia/social-domain/facets` et `/network`), et le moteur
 * vérifie de son côté que cette graine passe ses validateurs (test de la
 * tranche `convex/modules/diaspora`).
 */
import { DEFAULT_OPEN_COUNTRIES, HOME_COUNTRY } from "./countries"
import {
  CITY_MAX_LENGTH,
  ASSOCIATIONS_MAX,
  DEFAULT_FACET_VISIBILITY,
  FACET_FIELDS,
  type DiasporaFacet,
  type FacetField,
  type FieldVisibility,
} from "./facet"
import { DIASPORALE_NETWORK } from "./network"

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
 * fins. Jamais `root` : une facette DIASPORALE ne se lit pas depuis ANTIA.
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

export type EngineFacetValue = string | number | boolean | readonly string[]

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
