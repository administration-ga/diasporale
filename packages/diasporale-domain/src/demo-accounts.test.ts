import { describe, expect, test } from "bun:test"

import {
  DIASPORALE_DEMO_ACTORS,
  DIASPORALE_DEMO_ACTOR_SPECS,
  DIASPORALE_DEMO_COUNTRIES,
  DIASPORALE_DEMO_EMAIL_DOMAIN,
  diasporaleDemoActorOfEmail,
  diasporaleDemoDisplayName,
  diasporaleDemoEmailOf,
} from "./demo-accounts"
import { deriveMembershipStatus } from "./eligibility"

const NOW = Date.UTC(2026, 9, 19, 12)
const HANDLE = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/

describe("comptes de démonstration de DIASPORALE", () => {
  test("chaque acteur a sa fiche, sous son propre nom", () => {
    expect(Object.keys(DIASPORALE_DEMO_ACTOR_SPECS).sort()).toEqual([...DIASPORALE_DEMO_ACTORS].sort())
    for (const actor of DIASPORALE_DEMO_ACTORS) expect(DIASPORALE_DEMO_ACTOR_SPECS[actor].actor).toBe(actor)
  })

  test("le statut attendu découle des faits par la règle officielle, sans exception", () => {
    for (const actor of DIASPORALE_DEMO_ACTORS) {
      const spec = DIASPORALE_DEMO_ACTOR_SPECS[actor]
      if (spec.profile === null) {
        expect(spec.expectedStatus, actor).toBeNull()
        continue
      }
      const derived = deriveMembershipStatus(
        {
          idn: spec.grounds.idn,
          sponsored: spec.grounds.sponsored,
          consularAttestation: spec.grounds.consularAttestation,
          suspension: spec.grounds.suspended ? { until: null, readAccess: "read_only" } : null,
          leftAt: null,
        },
        NOW,
      )
      expect(derived, actor).toBe(spec.expectedStatus!)
    }
  })

  test("adresses réservées : aller et retour, casse et espaces ignorés, rien hors du domaine", () => {
    for (const actor of DIASPORALE_DEMO_ACTORS) {
      const email = diasporaleDemoEmailOf(actor)
      expect(email.endsWith(`@${DIASPORALE_DEMO_EMAIL_DOMAIN}`)).toBe(true)
      expect(diasporaleDemoActorOfEmail(` ${email.toUpperCase()} `)).toBe(actor)
    }
    expect(diasporaleDemoActorOfEmail("verifie@demo.antsia.test")).toBeNull()
    expect(diasporaleDemoActorOfEmail("inconnu@demo.diasporale.test")).toBeNull()
  })

  test("profils : identifiants valides et uniques, noms « Prénom NOM »", () => {
    const handles = new Set<string>()
    for (const actor of DIASPORALE_DEMO_ACTORS) {
      const profile = DIASPORALE_DEMO_ACTOR_SPECS[actor].profile
      if (profile === null) {
        expect(diasporaleDemoDisplayName(actor)).toBeNull()
        continue
      }
      expect(profile.handle, actor).toMatch(HANDLE)
      expect(handles.has(profile.handle), actor).toBe(false)
      handles.add(profile.handle)
      expect(profile.familyName, actor).toBe(profile.familyName.toUpperCase())
      expect(profile.givenNames.charAt(0), actor).toBe(profile.givenNames.charAt(0).toUpperCase())
      expect(diasporaleDemoDisplayName(actor)).toBe(`${profile.givenNames} ${profile.familyName}`)
    }
  })

  test("pages : adresse valide et unique, confiance officielle aux seules institutions, type et secteur à leur nature", () => {
    const handles = new Set<string>()
    for (const actor of DIASPORALE_DEMO_ACTORS) {
      const spec = DIASPORALE_DEMO_ACTOR_SPECS[actor]
      const page = spec.page
      if (page === null) continue
      expect(spec.group, actor).toBe("pages")
      expect(page.handle.length).toBeGreaterThanOrEqual(3)
      expect(page.handle.length).toBeLessThanOrEqual(60)
      expect(page.handle, actor).toMatch(HANDLE)
      expect(handles.has(page.handle), actor).toBe(false)
      handles.add(page.handle)
      expect(page.trust === "official", actor).toBe(page.kind === "institution")
      expect(page.associationType !== null, actor).toBe(page.kind === "association")
      expect(page.sector !== null, actor).toBe(page.kind === "company")
      // Une page officielle exige un signataire à l'identité forte (IDN de niveau 2 au moins).
      if (page.kind === "institution") expect(spec.grounds.idn?.loa ?? 0).toBeGreaterThanOrEqual(2)
    }
  })

  test("gestes et rôles cohérents : offres et missions sur une page qui le permet, une équipe pour le modérateur", () => {
    for (const actor of DIASPORALE_DEMO_ACTORS) {
      const spec = DIASPORALE_DEMO_ACTOR_SPECS[actor]
      if (spec.gestures.includes("mission")) expect(spec.page?.kind).toBe("association")
      if (spec.gestures.includes("service") || spec.gestures.includes("job")) expect(spec.page?.kind).toBe("company")
      if (spec.moderationTeam) expect(spec.role).not.toBe("member")
      if (spec.canSponsor) expect(spec.expectedStatus).toBe("verifiee")
      expect(DIASPORALE_DEMO_COUNTRIES as readonly string[]).toContain(spec.country)
    }
    // Le parrain du compte parrainé existe et peut parrainer.
    expect(DIASPORALE_DEMO_ACTOR_SPECS.verifie.canSponsor).toBe(true)
    expect(DIASPORALE_DEMO_ACTORS.filter((actor) => DIASPORALE_DEMO_ACTOR_SPECS[actor].grounds.sponsored)).toEqual(["parraine"])
  })
})
