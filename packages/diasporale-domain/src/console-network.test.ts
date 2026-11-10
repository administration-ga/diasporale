import { describe, expect, it } from "bun:test"

import { consoleFacetSchemaJson, consoleList, diasporaleConsoleNetworkForm, toConsoleFacetField } from "./console-network"
import {
  DIASPORALE_FACET_SCHEMA,
  DIASPORALE_NETWORK_SEED,
  ENGINE_FACET_FIELD_KINDS,
  ENGINE_FACET_VISIBILITIES,
  type EngineFacetField,
} from "./engine"
import { FACET_FIELDS } from "./facet"

/**
 * Le schéma STRICT du formulaire de la console (`facetShape`, console-dashboard.tsx) :
 * ces clés seulement, au plus 24 champs, 20 000 caractères. Recopié ici, comme les
 * listes du moteur dans `engine.ts` : le domaine reste sans dépendance.
 */
const CONSOLE_FIELD_KEYS = ["key", "kind", "required", "defaultVisibility", "maxLength", "maxItems", "enumValues", "excludedValues"]
const CONSOLE_MAX_FIELDS = 24
const CONSOLE_MAX_JSON_LENGTH = 20_000

type ParsedField = Record<string, unknown>

function parsedFields(json: string): ParsedField[] {
  const value = JSON.parse(json) as { fields: ParsedField[] }
  expect(Object.keys(value)).toEqual(["fields"])
  return value.fields
}

describe("JSON de facette à coller dans la console", () => {
  it("se relit tel quel : la graine du domaine, champ par champ, dans l'ordre", () => {
    const fields = parsedFields(consoleFacetSchemaJson())
    expect(fields.map((field) => field.key)).toEqual([...FACET_FIELDS])
    expect(fields).toEqual(DIASPORALE_FACET_SCHEMA.fields.map((field) => ({ ...field, ...(field.excludedValues ? { excludedValues: [...field.excludedValues] } : {}) })))
  })

  it("passe le schéma strict de la console : clés connues seulement, aucune valeur nulle, bornes tenues", () => {
    const json = consoleFacetSchemaJson()
    const fields = parsedFields(json)
    expect(json.length).toBeLessThanOrEqual(CONSOLE_MAX_JSON_LENGTH)
    expect(fields.length).toBeLessThanOrEqual(CONSOLE_MAX_FIELDS)
    for (const field of fields) {
      for (const [key, value] of Object.entries(field)) {
        expect(CONSOLE_FIELD_KEYS).toContain(key)
        expect(value).not.toBeNull()
      }
      expect(ENGINE_FACET_FIELD_KINDS).toContain(field.kind as never)
      expect(ENGINE_FACET_VISIBILITIES).toContain(field.defaultVisibility as never)
      expect(typeof field.required).toBe("boolean")
    }
  })

  it("garde les règles de la diaspora : pays obligatoire sans le Gabon, rien de lisible depuis la racine", () => {
    const fields = parsedFields(consoleFacetSchemaJson())
    expect(fields[0]).toEqual({ key: "countryOfResidence", kind: "country", required: true, defaultVisibility: "network", excludedValues: ["GA"] })
    expect(fields.map((field) => field.defaultVisibility)).not.toContain("root")
    expect(fields.filter((field) => field.defaultVisibility === "network").map((field) => field.key)).toEqual(["countryOfResidence", "helpAvailable"])
  })

  it("s'indente de deux espaces, comme la console affiche le schéma d'un réseau existant", () => {
    expect(consoleFacetSchemaJson()).toBe(JSON.stringify(JSON.parse(consoleFacetSchemaJson()), null, 2))
    expect(consoleFacetSchemaJson().startsWith('{\n  "fields": [\n    {\n      "key": "countryOfResidence",')).toBe(true)
  })

  it("rend un autre schéma qu'on lui passe, sans le modifier", () => {
    const field: EngineFacetField = { key: "city", kind: "text", required: false, defaultVisibility: "hidden", maxLength: 12 }
    expect(JSON.parse(consoleFacetSchemaJson({ fields: [field] }))).toEqual({ fields: [field] })
  })
})

describe("un champ au format de la console", () => {
  it("omet les options absentes et copie les listes figées", () => {
    const frozen = Object.freeze(["GA"])
    const field = toConsoleFacetField({ key: "countryOfResidence", kind: "country", required: true, defaultVisibility: "network", excludedValues: frozen })
    expect(field).toEqual({ key: "countryOfResidence", kind: "country", required: true, defaultVisibility: "network", excludedValues: ["GA"] })
    expect(field.excludedValues).not.toBe(frozen)
    expect(Object.isFrozen(field.excludedValues)).toBe(false)
    expect(Object.keys(toConsoleFacetField({ key: "helpAvailable", kind: "boolean", required: false, defaultVisibility: "network" }))).toEqual([
      "key",
      "kind",
      "required",
      "defaultVisibility",
    ])
  })

  it("garde les bornes de longueur et de nombre", () => {
    expect(toConsoleFacetField({ key: "associationIds", kind: "textList", required: false, defaultVisibility: "hidden", maxItems: 20 })).toEqual({
      key: "associationIds",
      kind: "textList",
      required: false,
      defaultVisibility: "hidden",
      maxItems: 20,
    })
    expect(toConsoleFacetField({ key: "city", kind: "text", required: false, defaultVisibility: "hidden", maxLength: 80 }).maxLength).toBe(80)
  })
})

describe("formulaire « Créer un réseau » de la console", () => {
  it("donne les réglages de la graine : fermé gouverné par la tranche, déclaré ou vérifié, réseau, France, thème", () => {
    expect(diasporaleConsoleNetworkForm()).toEqual({
      slug: "diasporale",
      name: "DIASPORALE",
      membershipPolicy: "declared_or_verified",
      defaultVisibility: "network",
      reachValues: "local, diaspora",
      openCountries: "FR",
      theme: "diasporale",
      managedBy: "diaspora",
      facetSchema: consoleFacetSchemaJson(),
    })
  })

  it("suit la graine : un pays ouvert ou une portée ajoutés au domaine changent le formulaire", () => {
    const form = diasporaleConsoleNetworkForm()
    expect(form.openCountries.split(", ")).toEqual([...DIASPORALE_NETWORK_SEED.openCountries])
    expect(form.reachValues.split(", ")).toEqual([...DIASPORALE_NETWORK_SEED.reachValues])
  })

  it("sépare une liste par des virgules, comme la console la relit", () => {
    expect(consoleList(["FR", "BE", "CA"])).toBe("FR, BE, CA")
    expect(consoleList([])).toBe("")
  })
})
