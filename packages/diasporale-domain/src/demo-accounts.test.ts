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
      // Sans entrée dans le réseau, aucun statut : le nouvel arrivant, l'utilisateur extérieur.
      if (spec.profile === null || spec.outsider) {
        expect(spec.expectedStatus, actor).toBeNull()
        continue
      }
      const derived = deriveMembershipStatus(
        {
          idn: spec.grounds.idn,
          sponsored: spec.grounds.sponsored,
          consularAttestation: spec.grounds.consularAttestation,
          // Une suspension de la racine vaut partout : dans DIASPORALE, elle se lit comme une suspension.
          suspension: spec.grounds.suspended || spec.grounds.suspendedAtRoot ? { until: null, readAccess: "read_only" } : null,
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

  test("accès restreints : un bloqueur qui agit dans le réseau, une suspension de la racine, un extérieur sans rien dans DIASPORALE", () => {
    for (const actor of DIASPORALE_DEMO_ACTORS) {
      const spec = DIASPORALE_DEMO_ACTOR_SPECS[actor]
      const restricted = spec.outsider || spec.blockedBy !== null || spec.grounds.suspended || spec.grounds.suspendedAtRoot
      expect(spec.group === "access", actor).toBe(restricted)
      if (spec.blockedBy !== null) {
        // Un blocage lie deux personnes qui ont un profil ; le bloqueur agit dans le réseau, sans restriction lui-même.
        const blocker = DIASPORALE_DEMO_ACTOR_SPECS[spec.blockedBy]
        expect(spec.blockedBy, actor).not.toBe(actor)
        expect(spec.profile, actor).not.toBeNull()
        expect(blocker.profile, actor).not.toBeNull()
        expect(blocker.outsider || blocker.blockedBy !== null || blocker.grounds.suspended || blocker.grounds.suspendedAtRoot, actor).toBe(false)
      }
      // La suspension de la racine frappe un membre entré dans DIASPORALE.
      if (spec.grounds.suspendedAtRoot) expect(spec.outsider, actor).toBe(false)
      if (spec.outsider) {
        // Rien dans DIASPORALE : ni fait, ni rôle, ni équipe, ni page, ni geste, ni blocage.
        expect(spec.profile, actor).not.toBeNull()
        expect(spec.grounds, actor).toEqual({ idn: null, sponsored: false, consularAttestation: false, suspended: false, suspendedAtRoot: false })
        expect([spec.role, spec.moderationTeam, spec.page, spec.gestures, spec.canSponsor, spec.blockedBy], actor).toEqual(["member", false, null, [], false, null])
      }
    }
    // Un acteur par accès restreint, le bloqué l'étant par le membre vérifié.
    expect(DIASPORALE_DEMO_ACTORS.filter((actor) => DIASPORALE_DEMO_ACTOR_SPECS[actor].grounds.suspended)).toEqual(["suspendu"])
    expect(DIASPORALE_DEMO_ACTORS.filter((actor) => DIASPORALE_DEMO_ACTOR_SPECS[actor].grounds.suspendedAtRoot)).toEqual(["suspendu-racine"])
    expect(DIASPORALE_DEMO_ACTORS.filter((actor) => DIASPORALE_DEMO_ACTOR_SPECS[actor].blockedBy !== null)).toEqual(["bloque"])
    expect(DIASPORALE_DEMO_ACTORS.filter((actor) => DIASPORALE_DEMO_ACTOR_SPECS[actor].outsider)).toEqual(["exterieur"])
    expect(DIASPORALE_DEMO_ACTOR_SPECS.bloque.blockedBy).toBe("verifie")
  })
})
