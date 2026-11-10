/**
 * Le réseau `diasporale` tel qu'un opérateur le crée dans la console du moteur
 * (DS-06, `docs/36_MISE_EN_PRODUCTION.md`). En production, aucune graine ne pose le
 * réseau (`seeds/foundations` le refuse par construction) : l'opérateur remplit le
 * formulaire « Créer un réseau » de la console. Ce module rend, champ par champ, ce
 * qu'il y saisit, et surtout le JSON de facette à coller dans « Schéma de facette ».
 *
 * Tout vient de la graine du domaine (`DIASPORALE_NETWORK_SEED`) : la console reçoit
 * exactement les réglages que la graine pose en local et sur la démonstration. Le
 * formulaire de la console (`apps/admin_antsia_ga/src/components/console-dashboard.tsx`)
 * relit le JSON avec un schéma STRICT (aucune clé inconnue) puis avec
 * `validateFacetSchema` du moteur ; les options absentes sont donc omises, jamais
 * écrites `null` ou vides.
 */
import {
  DIASPORALE_FACET_SCHEMA,
  DIASPORALE_NETWORK_SEED,
  DIASPORALE_SLICE,
  type EngineFacetField,
  type EngineFacetFieldKind,
  type EngineFacetVisibility,
} from "./engine"
import type { FacetField } from "./facet"

/** Un champ de facette à la forme simple que la console relit (copies modifiables, options absentes omises). */
export interface ConsoleFacetField {
  readonly key: FacetField
  readonly kind: EngineFacetFieldKind
  readonly required: boolean
  readonly defaultVisibility: EngineFacetVisibility
  readonly maxLength?: number
  readonly maxItems?: number
  readonly excludedValues?: string[]
}

/**
 * Un champ du domaine (listes figées) au format de la console, clés dans l'ordre
 * d'affichage de la console pour un réseau existant (celui de la graine de la tranche).
 */
export function toConsoleFacetField(field: EngineFacetField): ConsoleFacetField {
  return {
    key: field.key,
    kind: field.kind,
    required: field.required,
    defaultVisibility: field.defaultVisibility,
    ...(field.maxLength !== undefined ? { maxLength: field.maxLength } : {}),
    ...(field.maxItems !== undefined ? { maxItems: field.maxItems } : {}),
    ...(field.excludedValues !== undefined ? { excludedValues: [...field.excludedValues] } : {}),
  }
}

/**
 * Le JSON à coller dans le champ « Schéma de facette » de la console, indenté de deux
 * espaces comme la console affiche le schéma d'un réseau existant.
 */
export function consoleFacetSchemaJson(schema: { readonly fields: readonly EngineFacetField[] } = DIASPORALE_FACET_SCHEMA): string {
  return JSON.stringify({ fields: schema.fields.map(toConsoleFacetField) }, null, 2)
}

/** Une liste au format des champs « portées » et « pays ouverts » de la console : valeurs séparées par des virgules. */
export function consoleList(values: readonly string[]): string {
  return values.join(", ")
}

/** Les valeurs du formulaire « Créer un réseau » de la console, champ par champ, toutes en texte. */
export interface ConsoleNetworkForm {
  readonly slug: string
  readonly name: string
  readonly membershipPolicy: string
  readonly defaultVisibility: string
  readonly reachValues: string
  readonly openCountries: string
  readonly theme: string
  /** « Admission » : la tranche du moteur qui gouverne l'entrée et la facette. */
  readonly managedBy: typeof DIASPORALE_SLICE
  readonly facetSchema: string
}

/**
 * Le formulaire de création du réseau `diasporale`. La console crée toujours un réseau
 * fermé, enfant de la racine : ni le genre ni le parent ne se saisissent. Le motif
 * reste au propriétaire (il entre au journal des décisions avec son nom).
 */
export function diasporaleConsoleNetworkForm(): ConsoleNetworkForm {
  const seed = DIASPORALE_NETWORK_SEED
  return {
    slug: seed.slug,
    name: seed.name,
    membershipPolicy: seed.membershipPolicy,
    defaultVisibility: seed.defaultVisibility,
    reachValues: consoleList(seed.reachValues),
    openCountries: consoleList(seed.openCountries),
    theme: seed.theme,
    managedBy: DIASPORALE_SLICE,
    facetSchema: consoleFacetSchemaJson(seed.facetSchema),
  }
}
