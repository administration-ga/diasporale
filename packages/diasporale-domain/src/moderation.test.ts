import { describe, expect, test } from "bun:test"
import {
  DIRECT_PUBLICATION_MODERATOR_THRESHOLD,
  initialModerationState,
  isReadableByOthers,
  moderationScopeFor,
  publicationPolicy,
  type PublicationPolicyInput,
} from "./moderation"
import { COUNTRY_OPENING_REQUIREMENTS, canOpenCountry, countryOpeningGaps } from "./opening"

const BASE: PublicationPolicyInput = {
  scope: { reach: "local", country: "FR" },
  openCountries: ["FR"],
  countryActiveModerators: 2,
  networkActiveModerators: 2,
}

describe("ouverture d'un pays : deux associations relais et un modérateur", () => {
  test("exigences", () => {
    expect(COUNTRY_OPENING_REQUIREMENTS).toEqual({ relayAssociations: 2, activeModerators: 1 })
    expect(canOpenCountry({ relayAssociations: 2, activeModerators: 1 })).toBe(true)
    expect(countryOpeningGaps({ relayAssociations: 2, activeModerators: 1 })).toEqual([])
  })

  test("ce qui manque est dit, et seulement ce qui manque", () => {
    expect(countryOpeningGaps({ relayAssociations: 1, activeModerators: 1 })).toEqual(["relay_associations_missing"])
    expect(countryOpeningGaps({ relayAssociations: 2, activeModerators: 0 })).toEqual(["moderator_missing"])
    expect(countryOpeningGaps({ relayAssociations: 0, activeModerators: 0 })).toEqual([
      "relay_associations_missing",
      "moderator_missing",
    ])
    expect(canOpenCountry({ relayAssociations: 1, activeModerators: 3 })).toBe(false)
  })
})

describe("compétence de modération", () => {
  test("pays ouvert : l'équipe du pays ; pays fermé ou diaspora : l'équipe réseau", () => {
    expect(moderationScopeFor({ reach: "local", country: "FR" }, ["FR"])).toEqual({ kind: "country", country: "FR" })
    expect(moderationScopeFor({ reach: "local", country: "CA" }, ["FR"])).toEqual({ kind: "network" })
    expect(moderationScopeFor({ reach: "diaspora", country: "FR" }, ["FR"])).toEqual({ kind: "network" })
  })
})

describe("relecture puis publication directe (EXF-DG-42)", () => {
  test("pays ouvert avec deux modérateurs actifs : publication directe", () => {
    const policy = publicationPolicy(BASE)
    expect(policy).toEqual({ review: "direct", moderation: { kind: "country", country: "FR" } })
    expect(initialModerationState(policy)).toBe("published")
  })

  test("pays ouvert avec un seul modérateur : relecture", () => {
    const policy = publicationPolicy({ ...BASE, countryActiveModerators: DIRECT_PUBLICATION_MODERATOR_THRESHOLD - 1 })
    expect(policy.review).toBe("pending_review")
    expect(initialModerationState(policy)).toBe("pending_review")
  })

  test("pays fermé : toujours la relecture réseau, même équipe réseau au complet (R3, invariant 10)", () => {
    const policy = publicationPolicy({ ...BASE, scope: { reach: "local", country: "CA" }, networkActiveModerators: 9 })
    expect(policy).toEqual({ review: "pending_review", moderation: { kind: "network" } })
  })

  test("portée diaspora : l'équipe réseau, selon ses effectifs", () => {
    expect(publicationPolicy({ ...BASE, scope: { reach: "diaspora" } }).review).toBe("direct")
    expect(publicationPolicy({ ...BASE, scope: { reach: "diaspora" }, networkActiveModerators: 1 }).review).toBe("pending_review")
  })

  test("une surface peut imposer la relecture (lancement)", () => {
    expect(publicationPolicy({ ...BASE, surfaceForcesReview: true }).review).toBe("pending_review")
    expect(publicationPolicy({ ...BASE, surfaceForcesReview: false }).review).toBe("direct")
  })
})

describe("états de modération (P4)", () => {
  test("les autres ne voient que le publié", () => {
    expect(isReadableByOthers("published")).toBe(true)
    expect(isReadableByOthers("pending_review")).toBe(false)
    expect(isReadableByOthers("rejected")).toBe(false)
  })
})
