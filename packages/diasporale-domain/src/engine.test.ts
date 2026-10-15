import { describe, expect, it } from "bun:test"

import {
  DIASPORALE_FACET_SCHEMA,
  DIASPORALE_NETWORK_SEED,
  ENGINE_FACET_FIELD_KINDS,
  ENGINE_FACET_VISIBILITIES,
  toEngineFacet,
  toEngineFacetVisibility,
} from "./engine"
import { DEFAULT_FACET_VISIBILITY, FACET_FIELDS, type DiasporaFacet } from "./facet"

describe("projection des visibilités vers le moteur", () => {
  it("seul « tout le réseau » reste lisible par le moteur générique ; jamais la racine", () => {
    expect(toEngineFacetVisibility("network")).toBe("network")
    expect(toEngineFacetVisibility("country")).toBe("hidden")
    expect(toEngineFacetVisibility("connections")).toBe("hidden")
    expect(toEngineFacetVisibility("only_me")).toBe("hidden")
  })
})

describe("facette diaspora au format du moteur", () => {
  it("couvre chaque champ du domaine, dans l'ordre, avec des types et visibilités connus du moteur", () => {
    expect(DIASPORALE_FACET_SCHEMA.fields.map((field) => field.key)).toEqual([...FACET_FIELDS])
    for (const field of DIASPORALE_FACET_SCHEMA.fields) {
      expect(ENGINE_FACET_FIELD_KINDS).toContain(field.kind)
      expect(ENGINE_FACET_VISIBILITIES).toContain(field.defaultVisibility)
      expect(field.defaultVisibility).toBe(toEngineFacetVisibility(DEFAULT_FACET_VISIBILITY[field.key]))
    }
  })

  it("le pays de résidence est obligatoire et ne peut pas être le Gabon", () => {
    const country = DIASPORALE_FACET_SCHEMA.fields.find((field) => field.key === "countryOfResidence")
    expect(country).toMatchObject({ kind: "country", required: true, excludedValues: ["GA"] })
    expect(DIASPORALE_FACET_SCHEMA.fields.filter((field) => field.required).map((field) => field.key)).toEqual(["countryOfResidence"])
  })
})

describe("graine du réseau diasporale", () => {
  it("réseau fermé, enfant d'ANTIA, politique déclaré-ou-vérifié, visibilité réseau, France ouverte", () => {
    expect(DIASPORALE_NETWORK_SEED).toMatchObject({
      slug: "diasporale",
      kind: "closed",
      parentSlug: "antia",
      membershipPolicy: "declared_or_verified",
      defaultVisibility: "network",
      reachValues: ["local", "diaspora"],
      openCountries: ["FR"],
      theme: "diasporale",
    })
    expect(DIASPORALE_NETWORK_SEED.facetSchema).toBe(DIASPORALE_FACET_SCHEMA)
  })
})

describe("toEngineFacet", () => {
  const minimal: DiasporaFacet = {
    countryOfResidence: "FR",
    associationIds: [],
    helpAvailable: false,
    visibility: DEFAULT_FACET_VISIBILITY,
  }

  it("omet les champs vides et projette les visibilités", () => {
    expect(toEngineFacet(minimal)).toEqual({
      values: { countryOfResidence: "FR", helpAvailable: false },
      visibilities: {
        countryOfResidence: "network",
        city: "hidden",
        postSlug: "hidden",
        associationIds: "hidden",
        arrivedAt: "hidden",
        helpAvailable: "network",
      },
    })
  })

  it("recopie chaque champ renseigné", () => {
    const full: DiasporaFacet = {
      ...minimal,
      city: "Lyon",
      postSlug: "consulat-general-paris",
      associationIds: ["asso-1", "asso-2"],
      arrivedAt: 2016,
      helpAvailable: true,
      visibility: { ...DEFAULT_FACET_VISIBILITY, city: "network" },
    }
    const engine = toEngineFacet(full)
    expect(engine.values).toEqual({
      countryOfResidence: "FR",
      city: "Lyon",
      postSlug: "consulat-general-paris",
      associationIds: ["asso-1", "asso-2"],
      arrivedAt: 2016,
      helpAvailable: true,
    })
    expect(engine.visibilities.city).toBe("network")
    // Copie défensive : le moteur ne reçoit jamais la référence du domaine.
    expect(engine.values.associationIds).not.toBe(full.associationIds)
  })
})
