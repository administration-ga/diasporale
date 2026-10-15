import { describe, expect, it } from "bun:test"

import { DEFAULT_FACET_VISIBILITY, type DiasporaFacet } from "./facet"
import { isWorthSuggesting, rankSuggestions, SUGGESTIONS_MAX, suggestionReasons, suggestionScore } from "./suggestions"

const reader: DiasporaFacet = {
  countryOfResidence: "FR",
  city: "Saint-Étienne",
  associationIds: ["asso-1", "asso-2"],
  helpAvailable: false,
  visibility: { ...DEFAULT_FACET_VISIBILITY },
}

describe("suggestions — ce qui rapproche, lu sur la facette projetée", () => {
  it("même pays, même ville (sans casse ni accents), associations communes, relations communes", () => {
    expect(suggestionReasons(reader, { countryOfResidence: "FR", city: " saint-etienne ", associationIds: ["asso-2", "asso-9"] }, 3)).toEqual({
      sameCountry: true,
      sameCity: true,
      sharedAssociations: 1,
      mutualConnections: 3,
    })
  })

  it("rien n'est déduit de ce que le lecteur ne voit pas : sans pays projeté, ni pays ni ville en commun", () => {
    expect(suggestionReasons(reader, { city: "Saint-Étienne" }, 0)).toEqual({ sameCountry: false, sameCity: false, sharedAssociations: 0, mutualConnections: 0 })
    // Une même ville dans un autre pays n'est pas la même ville.
    expect(suggestionReasons(reader, { countryOfResidence: "BE", city: "Saint-Étienne" }, 0).sameCity).toBe(false)
    // Une ville gardée pour soi : la ville du lecteur seule ne suffit pas.
    expect(suggestionReasons(reader, { countryOfResidence: "FR" }, 0).sameCity).toBe(false)
    const { city: _city, ...withoutCity } = reader
    expect(suggestionReasons(withoutCity, { countryOfResidence: "FR", city: "Lyon" }, 0).sameCity).toBe(false)
  })

  it("un compte de relations communes négatif ou fractionnaire est ramené à un entier positif", () => {
    expect(suggestionReasons(reader, {}, -2).mutualConnections).toBe(0)
    expect(suggestionReasons(reader, {}, 2.7).mutualConnections).toBe(2)
  })
})

describe("suggestions — classement", () => {
  const reasons = (overrides: Partial<Parameters<typeof suggestionScore>[0]> = {}) => ({
    sameCountry: false,
    sameCity: false,
    sharedAssociations: 0,
    mutualConnections: 0,
    ...overrides,
  })

  it("des poids bornés : une association ou une relation de plus n'écrase pas tout", () => {
    expect(suggestionScore(reasons())).toBe(0)
    expect(suggestionScore(reasons({ sameCountry: true }))).toBe(1)
    expect(suggestionScore(reasons({ sameCountry: true, sameCity: true }))).toBe(5)
    expect(suggestionScore(reasons({ sharedAssociations: 10 }))).toBe(9)
    expect(suggestionScore(reasons({ mutualConnections: 40 }))).toBe(10)
  })

  it("sans point commun visible, personne n'est suggéré", () => {
    expect(isWorthSuggesting(reasons())).toBe(false)
    expect(isWorthSuggesting(reasons({ mutualConnections: 1 }))).toBe(true)
  })

  it("les mieux classés d'abord, l'ordre du vivier à égalité, six au plus", () => {
    const pool = [
      { id: "a", reasons: reasons({ sameCountry: true }) },
      { id: "b", reasons: reasons() },
      { id: "c", reasons: reasons({ sameCountry: true, sameCity: true }) },
      { id: "d", reasons: reasons({ sameCountry: true }) },
    ]
    expect(rankSuggestions(pool).map((item) => item.id)).toEqual(["c", "a", "d"])
    expect(rankSuggestions(pool, 1).map((item) => item.id)).toEqual(["c"])
    expect(rankSuggestions(pool, -1)).toEqual([])
    const many = Array.from({ length: 10 }, (_, index) => ({ id: String(index), reasons: reasons({ sameCountry: true }) }))
    expect(rankSuggestions(many)).toHaveLength(SUGGESTIONS_MAX)
  })
})
