import { describe, expect, it } from "bun:test"

import { LIGHT_ACCOUNT_GROUNDS, type MembershipGrounds } from "./eligibility"
import {
  DIASPORALE_FACET_SCHEMA,
  DIASPORALE_NETWORK_SEED,
  DIASPORALE_SLICE,
  ENGINE_FACET_FIELD_KINDS,
  ENGINE_FACET_VISIBILITIES,
  engineVerificationSource,
  facetFromEngine,
  GABONESE_NATIONALITY_CODES,
  idnGroundFromLink,
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

describe("la tranche qui gouverne le réseau", () => {
  it("porte un nom stable, celui du dossier convex/modules/diaspora", () => {
    expect(DIASPORALE_SLICE).toBe("diaspora")
  })
})

describe("idnGroundFromLink — le lien IDN du moteur lu comme fait du domaine", () => {
  it("garde le niveau de garantie et lit la nationalité gabonaise (alpha-2 ou alpha-3, casse indifférente)", () => {
    expect(GABONESE_NATIONALITY_CODES).toEqual(["GA", "GAB"])
    expect(idnGroundFromLink({ loa: 2, nationality: "GA" })).toEqual({ loa: 2, gaboneseNationality: true })
    expect(idnGroundFromLink({ loa: 3, nationality: " gab " })).toEqual({ loa: 3, gaboneseNationality: true })
  })

  it("une nationalité étrangère exclut ; une nationalité absente reste inconnue", () => {
    expect(idnGroundFromLink({ loa: 3, nationality: "FR" }).gaboneseNationality).toBe(false)
    expect(idnGroundFromLink({ loa: 3 }).gaboneseNationality).toBeNull()
    expect(idnGroundFromLink({ loa: 3, nationality: "  " }).gaboneseNationality).toBeNull()
  })

  it("un niveau absent ou hors bornes vaut le plus bas : le doute ne vérifie pas", () => {
    expect(idnGroundFromLink({}).loa).toBe(0)
    expect(idnGroundFromLink({ loa: 7 }).loa).toBe(0)
    expect(idnGroundFromLink({ loa: -1 }).loa).toBe(0)
    expect(idnGroundFromLink({ loa: 2.5 }).loa).toBe(0)
    expect(idnGroundFromLink({ loa: 4 }).loa).toBe(4)
  })
})

describe("engineVerificationSource — qui a vérifié, au vocabulaire du moteur", () => {
  const NOW = Date.UTC(2026, 9, 15)
  const idn = (loa: number): MembershipGrounds["idn"] => ({ loa, gaboneseNationality: true })

  it("l'attestation consulaire d'abord", () => {
    expect(engineVerificationSource({ ...LIGHT_ACCOUNT_GROUNDS, consularAttestation: true }, NOW)).toBe("consulat")
    expect(engineVerificationSource({ ...LIGHT_ACCOUNT_GROUNDS, idn: idn(3), sponsored: true, consularAttestation: true }, NOW)).toBe(
      "consulat",
    )
  })

  it("sinon IDN de garantie ≥ 2 avec parrainage", () => {
    expect(engineVerificationSource({ ...LIGHT_ACCOUNT_GROUNDS, idn: idn(2), sponsored: true }, NOW)).toBe("idn")
  })

  it("rien quand les faits ne vérifient pas", () => {
    expect(engineVerificationSource(LIGHT_ACCOUNT_GROUNDS, NOW)).toBeNull()
    expect(engineVerificationSource({ ...LIGHT_ACCOUNT_GROUNDS, idn: idn(3) }, NOW)).toBeNull()
    expect(engineVerificationSource({ ...LIGHT_ACCOUNT_GROUNDS, consularAttestation: true, leftAt: NOW - 1 }, NOW)).toBeNull()
  })
})

describe("facetFromEngine — la facette relue depuis le moteur", () => {
  it("rend la facette du domaine à partir des valeurs et des niveaux fins conservés par la tranche", () => {
    const facet: DiasporaFacet = {
      countryOfResidence: "FR",
      city: "Lyon",
      postSlug: "consulat-general-paris",
      associationIds: ["asso-1"],
      arrivedAt: 2016,
      helpAvailable: true,
      visibility: { ...DEFAULT_FACET_VISIBILITY, city: "network", arrivedAt: "country" },
    }
    expect(facetFromEngine(toEngineFacet(facet).values, facet.visibility)).toEqual(facet)
  })

  it("sans niveaux fins : la protection par défaut", () => {
    expect(facetFromEngine({ countryOfResidence: "BE", helpAvailable: false }, null)).toEqual({
      countryOfResidence: "BE",
      associationIds: [],
      helpAvailable: false,
      visibility: DEFAULT_FACET_VISIBILITY,
    })
  })

  it("sans pays de résidence valide, pas de facette", () => {
    expect(facetFromEngine({}, null)).toBeNull()
    expect(facetFromEngine({ countryOfResidence: "GA" }, null)).toBeNull()
    expect(facetFromEngine({ countryOfResidence: "ZZ" }, null)).toBeNull()
    expect(facetFromEngine({ countryOfResidence: 33 }, null)).toBeNull()
  })

  it("une valeur ou un niveau hors forme est ignoré, jamais deviné", () => {
    const facet = facetFromEngine(
      {
        countryOfResidence: "CA",
        city: "",
        postSlug: 12,
        associationIds: "asso-1",
        arrivedAt: 2016.5,
        helpAvailable: "oui",
      },
      { city: "tout le monde", arrivedAt: undefined, helpAvailable: "only_me" },
    )
    expect(facet).toEqual({
      countryOfResidence: "CA",
      associationIds: [],
      helpAvailable: false,
      visibility: { ...DEFAULT_FACET_VISIBILITY, helpAvailable: "only_me" },
    })
  })
})
