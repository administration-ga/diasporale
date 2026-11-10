// @vitest-environment node
import { DAY_MS } from "@diasporale/domain"
import { describe, expect, it } from "vitest"

import { membershipView, sponsorDashboardView } from "./selectors"
import { createDemoSeed, type DemoState } from "./state"

/**
 * EA-01 dans le fournisseur de démonstration : une admission fondatrice dans les
 * faits d'un membre le rend « vérifiée » avec le badge, et la dispense, si elle est
 * accordée, lui ouvre le parrainage sans attendre 30 jours — la même règle que le
 * moteur (`@diasporale/domain`). Le quota, lui, ne change pas.
 */

const T0 = Date.UTC(2026, 10, 10, 12)

/** Le jeu de démonstration où Steeve (IDN de niveau 1, « déclarée ») est admis fondateur à l'instant. */
function withFounder(seniorityWaiver: boolean): DemoState {
  const seed = createDemoSeed(T0)
  const steeve = seed.memberships["p-steeve"]!
  return {
    ...seed,
    memberships: { ...seed.memberships, "p-steeve": { ...steeve, grounds: { ...steeve.grounds, foundingAdmission: { seniorityWaiver } }, verifiedSince: T0 } },
  }
}

describe("membres fondateurs dans la démonstration (EA-01)", () => {
  it("l'admission fondatrice vérifie : statut et badge suivent", () => {
    expect(membershipView(createDemoSeed(T0), "p-steeve", T0)).toMatchObject({ status: "declaree" })
    expect(membershipView(withFounder(false), "p-steeve", T0)).toMatchObject({ status: "verifiee", badges: expect.arrayContaining(["verified"]) })
  })

  it("avec dispense, le parrainage s'ouvre aussitôt ; sans elle, l'ancienneté reste exigée", () => {
    expect(sponsorDashboardView(withFounder(true), "p-steeve", T0)).toMatchObject({ eligible: true, refusal: null, seniorityReachedAt: T0 })
    expect(sponsorDashboardView(withFounder(false), "p-steeve", T0)).toMatchObject({ eligible: false, refusal: "sponsor_too_recent", seniorityReachedAt: T0 + 30 * DAY_MS })
  })
})
