import { describe, expect, test } from "bun:test"
import {
  MEMBER_CREATABLE_PAGE_KINDS,
  PAGE_OWNER_KINDS,
  PAGE_SOURCES,
  canMemberCreatePageKind,
  contentBadges,
  isPageClaimable,
  pageBadge,
  pageTrustLevel,
  personBadges,
  type PersonTrustFacts,
} from "./badges"

const NOBODY: PersonTrustFacts = { consularAttestation: false, administrationLink: false }

describe("badges d'une personne — calculés, jamais déclaratifs", () => {
  test("Communauté quand aucune preuve", () => {
    expect(personBadges(NOBODY)).toEqual(["community"])
    expect(personBadges({ ...NOBODY, idnLoa: 1 })).toEqual(["community"])
    expect(personBadges({ ...NOBODY, membershipStatus: "declaree" })).toEqual(["community"])
  })

  test("Vérifié : IDN loa ≥ 2, attestation consulaire, ou adhésion vérifiée", () => {
    expect(personBadges({ ...NOBODY, idnLoa: 2 })).toEqual(["verified"])
    expect(personBadges({ ...NOBODY, idnLoa: 3 })).toEqual(["verified"])
    expect(personBadges({ ...NOBODY, consularAttestation: true })).toEqual(["verified"])
    expect(personBadges({ ...NOBODY, membershipStatus: "verifiee" })).toEqual(["verified"])
  })

  test("Agent public : lien administration vivant ; il coexiste avec Vérifié", () => {
    expect(personBadges({ ...NOBODY, administrationLink: true })).toEqual(["public_agent"])
    expect(personBadges({ ...NOBODY, administrationLink: true, idnLoa: 2 })).toEqual(["verified", "public_agent"])
  })
})

describe("badges et confiance d'une page", () => {
  test("Officiel : une institution reçue par import contractuel, fédération ou création tracée", () => {
    for (const source of ["consular_import", "federation", "platform_manual"] as const) {
      expect(pageTrustLevel({ ownerKind: "institution", source, claimValidated: false })).toBe("official")
    }
  })

  test("une institution d'une autre origine n'est jamais Officiel", () => {
    expect(pageTrustLevel({ ownerKind: "institution", source: "member_created", claimValidated: false })).toBe("community")
    expect(pageTrustLevel({ ownerKind: "institution", source: "community_import", claimValidated: false })).toBe("community")
  })

  test("une association ou une entreprise n'est jamais Officiel, même importée", () => {
    for (const ownerKind of ["association", "company", "media", "community"] as const) {
      for (const source of PAGE_SOURCES) {
        expect(pageTrustLevel({ ownerKind, source, claimValidated: false })).toBe("community")
      }
    }
  })

  test("Vérifié : revendication ou vérification validée (R6)", () => {
    expect(pageTrustLevel({ ownerKind: "association", source: "community_import", claimValidated: true })).toBe("verified")
    expect(pageBadge({ ownerKind: "company", source: "member_created", claimValidated: true })).toBe("verified")
  })

  test("revendication : jamais d'une page Officiel ni d'une institution ; jamais deux fois", () => {
    expect(isPageClaimable({ ownerKind: "institution", source: "consular_import", claimValidated: false })).toBe(false)
    expect(isPageClaimable({ ownerKind: "institution", source: "member_created", claimValidated: false })).toBe(false)
    expect(isPageClaimable({ ownerKind: "association", source: "community_import", claimValidated: false })).toBe(true)
    expect(isPageClaimable({ ownerKind: "association", source: "community_import", claimValidated: true })).toBe(false)
  })

  test("un membre ne crée jamais une institution", () => {
    expect(MEMBER_CREATABLE_PAGE_KINDS).not.toContain("institution")
    for (const kind of PAGE_OWNER_KINDS) {
      expect(canMemberCreatePageKind(kind)).toBe(kind !== "institution")
    }
  })
})

describe("badges d'un contenu", () => {
  test("publication de page : le badge de la page ; d'une personne : les siens", () => {
    expect(contentBadges({ kind: "page", facts: { ownerKind: "institution", source: "consular_import", claimValidated: false } })).toEqual([
      "official",
    ])
    expect(contentBadges({ kind: "person", facts: { ...NOBODY, idnLoa: 2 } })).toEqual(["verified"])
  })
})
