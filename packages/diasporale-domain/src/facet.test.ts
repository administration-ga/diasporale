import { describe, expect, test } from "bun:test"
import {
  ASSOCIATIONS_MAX,
  CITY_MAX_LENGTH,
  DEFAULT_FACET_VISIBILITY,
  FIELD_VISIBILITY_LEVELS,
  applyAttestationToFacet,
  isFieldVisibleTo,
  parseFacetInput,
  projectFacet,
  type DiasporaFacet,
  type FacetViewer,
} from "./facet"

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)

const SELF: FacetViewer = { isSelf: true, isConnection: false, isSameCountryMember: false, isActiveMember: true }
const CONNECTION: FacetViewer = { isSelf: false, isConnection: true, isSameCountryMember: false, isActiveMember: true }
const COMPATRIOT: FacetViewer = { isSelf: false, isConnection: false, isSameCountryMember: true, isActiveMember: true }
const MEMBER: FacetViewer = { isSelf: false, isConnection: false, isSameCountryMember: false, isActiveMember: true }
const OUTSIDER: FacetViewer = { isSelf: false, isConnection: false, isSameCountryMember: false, isActiveMember: false }

describe("parseFacetInput — la saisie de la facette", () => {
  test("R1 : « France, Lyon » donne une facette normalisée, visibilités par défaut", () => {
    const result = parseFacetInput({ countryOfResidence: "fr", city: "  Lyon  " }, NOW)
    expect(result).toEqual({
      ok: true,
      value: {
        countryOfResidence: "FR",
        city: "Lyon",
        associationIds: [],
        helpAvailable: false,
        visibility: DEFAULT_FACET_VISIBILITY,
      },
    })
  })

  test("le pays est obligatoire et ne peut pas être le Gabon", () => {
    expect(parseFacetInput({ countryOfResidence: "" }, NOW)).toEqual({ ok: false, code: "country_required" })
    expect(parseFacetInput({ countryOfResidence: "GA" }, NOW)).toEqual({ ok: false, code: "country_is_home" })
    expect(parseFacetInput({ countryOfResidence: "ZZ" }, NOW)).toEqual({ ok: false, code: "country_unknown" })
  })

  test("ville : espaces normalisés, vide = absente, bornée, une seule ligne", () => {
    const ok = parseFacetInput({ countryOfResidence: "CA", city: "Montréal   Nord" }, NOW)
    expect(ok.ok && ok.value.city).toBe("Montréal Nord")
    const blank = parseFacetInput({ countryOfResidence: "CA", city: "   " }, NOW)
    expect(blank.ok && "city" in blank.value).toBe(false)
    const nullCity = parseFacetInput({ countryOfResidence: "CA", city: null }, NOW)
    expect(nullCity.ok).toBe(true)
    expect(parseFacetInput({ countryOfResidence: "CA", city: "x".repeat(CITY_MAX_LENGTH + 1) }, NOW)).toEqual({
      ok: false,
      code: "city_too_long",
    })
    expect(parseFacetInput({ countryOfResidence: "CA", city: "Lyon\nParis" }, NOW)).toEqual({ ok: false, code: "city_invalid" })
  })

  test("année d'arrivée : entière, entre 1950 et l'année en cours", () => {
    expect(parseFacetInput({ countryOfResidence: "BE", arrivedAt: 2019 }, NOW).ok).toBe(true)
    expect(parseFacetInput({ countryOfResidence: "BE", arrivedAt: 2026 }, NOW).ok).toBe(true)
    expect(parseFacetInput({ countryOfResidence: "BE", arrivedAt: null }, NOW).ok).toBe(true)
    for (const arrivedAt of [1949, 2027, 2019.5]) {
      expect(parseFacetInput({ countryOfResidence: "BE", arrivedAt }, NOW)).toEqual({ ok: false, code: "arrived_at_out_of_range" })
    }
  })

  test("associations : dédoublonnées, bornées, jamais vides", () => {
    const ok = parseFacetInput({ countryOfResidence: "FR", associationIds: ["a1", " a1 ", "a2"] }, NOW)
    expect(ok.ok && ok.value.associationIds).toEqual(["a1", "a2"])
    const many = Array.from({ length: ASSOCIATIONS_MAX + 1 }, (_, i) => `a${i}`)
    expect(parseFacetInput({ countryOfResidence: "FR", associationIds: many }, NOW)).toEqual({
      ok: false,
      code: "too_many_associations",
    })
    expect(parseFacetInput({ countryOfResidence: "FR", associationIds: ["  "] }, NOW)).toEqual({
      ok: false,
      code: "association_id_invalid",
    })
  })

  test("visibilités : niveaux connus seulement ; le reste garde le défaut", () => {
    const ok = parseFacetInput({ countryOfResidence: "FR", visibility: { city: "network", arrivedAt: "country" } }, NOW)
    expect(ok.ok && ok.value.visibility).toEqual({ ...DEFAULT_FACET_VISIBILITY, city: "network", arrivedAt: "country" })
    expect(parseFacetInput({ countryOfResidence: "FR", visibility: { city: "public" } }, NOW)).toEqual({
      ok: false,
      code: "visibility_invalid",
    })
  })

  test("le poste de rattachement ne se saisit pas : il est conservé depuis l'attestation", () => {
    const kept = parseFacetInput({ countryOfResidence: "FR", helpAvailable: true }, NOW, { postSlug: "poste-demo-paris" })
    expect(kept.ok && kept.value.postSlug).toBe("poste-demo-paris")
    expect(kept.ok && kept.value.helpAvailable).toBe(true)
    const none = parseFacetInput({ countryOfResidence: "FR" }, NOW, {})
    expect(none.ok && "postSlug" in none.value).toBe(false)
  })
})

describe("visibilités cumulatives", () => {
  test("table complète niveau × lecteur", () => {
    const expected = {
      only_me: [true, false, false, false, false],
      connections: [true, true, false, false, false],
      country: [true, true, true, false, false],
      network: [true, true, true, true, false],
    } as const
    const viewers = [SELF, CONNECTION, COMPATRIOT, MEMBER, OUTSIDER]
    for (const level of FIELD_VISIBILITY_LEVELS) {
      expect(viewers.map((viewer) => isFieldVisibleTo(level, viewer))).toEqual([...expected[level]])
    }
  })
})

describe("projectFacet — projection allowlistée", () => {
  const FACET: DiasporaFacet = {
    countryOfResidence: "FR",
    city: "Lyon",
    postSlug: "poste-demo-paris",
    associationIds: ["asso-1"],
    arrivedAt: 2015,
    helpAvailable: true,
    visibility: DEFAULT_FACET_VISIBILITY,
  }

  test("soi : tout", () => {
    expect(projectFacet(FACET, SELF)).toEqual({
      countryOfResidence: "FR",
      city: "Lyon",
      postSlug: "poste-demo-paris",
      associationIds: ["asso-1"],
      arrivedAt: 2015,
      helpAvailable: true,
    })
  })

  test("une connexion : pays, ville, entraide (défauts)", () => {
    expect(projectFacet(FACET, CONNECTION)).toEqual({ countryOfResidence: "FR", city: "Lyon", helpAvailable: true })
  })

  test("un membre quelconque : pays et entraide seulement", () => {
    expect(projectFacet(FACET, MEMBER)).toEqual({ countryOfResidence: "FR", helpAvailable: true })
  })

  test("hors réseau actif : rien", () => {
    expect(projectFacet(FACET, OUTSIDER)).toEqual({})
  })

  test("les champs vides ne s'affichent jamais, même visibles", () => {
    const sparse: DiasporaFacet = { ...FACET, associationIds: [], helpAvailable: false }
    delete (sparse as { city?: string }).city
    expect(projectFacet(sparse, CONNECTION)).toEqual({ countryOfResidence: "FR" })
  })
})

describe("applyAttestationToFacet (PD3)", () => {
  test("sans facette : le pays attesté et le poste", () => {
    expect(applyAttestationToFacet(null, { postSlug: "poste-demo-paris", countryOfResidence: "FR" })).toEqual({
      countryOfResidence: "FR",
      postSlug: "poste-demo-paris",
      associationIds: [],
      helpAvailable: false,
      visibility: DEFAULT_FACET_VISIBILITY,
    })
  })

  test("avec facette : le poste seul — le pays déclaré reste celui de la personne", () => {
    const facet: DiasporaFacet = {
      countryOfResidence: "BE",
      associationIds: [],
      helpAvailable: false,
      visibility: DEFAULT_FACET_VISIBILITY,
    }
    expect(applyAttestationToFacet(facet, { postSlug: "poste-demo-paris", countryOfResidence: "FR" })).toEqual({
      ...facet,
      postSlug: "poste-demo-paris",
    })
  })
})
