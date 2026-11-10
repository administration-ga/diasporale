// @vitest-environment node
import { DAY_MS, type OnboardingConsentChoices } from "@diasporale/domain"
import { describe, expect, it } from "vitest"

import type { JoinInput } from "../data/port"
import { membershipView, ownProfileView } from "./selectors"
import { createDemoSeed, type DemoPerson, type DemoState } from "./state"
import { DEMO_STORAGE_KEY, DemoStore } from "./store"

/**
 * EA-04 au fournisseur de démonstration, comme au moteur : entrer dans DIASPORALE avec un
 * profil commun déjà publié ne le redemande ni ne le réécrit ; un profil retiré se republie
 * d'abord, par le geste de la personne ; un retour après un départ garde le profil.
 */

const T0 = Date.UTC(2026, 10, 10, 12)
const ONLY_PROFILE: OnboardingConsentChoices = { social_profile: true, directory: false, notifications: false }
/** L'acteur `exterieur` : un compte ANTSIA à profil publié, sans adhésion à DIASPORALE (fictif). */
const OUTSIDER_PROFILE = { handle: "demo.exterieur", displayName: "Brice MOUNDOUNGA", headline: "Membre d'ANTSIA, hors de DIASPORALE (démonstration)" }

function storageWith(state: DemoState) {
  const items = new Map<string, string>([[DEMO_STORAGE_KEY, JSON.stringify(state)]])
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

function outsiderStore(person: Partial<DemoPerson> = {}) {
  const seed = createDemoSeed(T0)
  const outsider: DemoPerson = {
    id: "p-exterieur",
    idn: null,
    local: { kind: "email", value: "exterieur@example.com" },
    profile: { ...OUTSIDER_PROFILE },
    administrationLink: false,
    createdAt: T0 - 30 * DAY_MS,
    demoAccountKey: null,
    ...person,
  }
  const state: DemoState = { ...seed, persons: { ...seed.persons, [outsider.id]: outsider }, session: { personId: outsider.id } }
  return new DemoStore(storageWith(state), () => T0, 0)
}

/** Ce que l'écran envoie pour un profil déjà là : aucun nom, aucun identifiant. */
const KEEP: JoinInput = { facet: { countryOfResidence: "FR", city: "Paris" }, consents: ONLY_PROFILE, directoryVisibility: "hidden" }

describe("Démonstration — entrer avec un profil existant (EA-04)", () => {
  it("l'acteur `exterieur` entre : identifiant, nom affiché et accroche identiques avant et après", async () => {
    const store = outsiderStore()
    const before = ownProfileView(store.getState(), "p-exterieur")
    expect(before).toMatchObject({ ...OUTSIDER_PROFILE, published: true })

    // Même un nom et un identifiant envoyés par erreur ne remplacent pas le profil publié.
    expect(await store.join({ ...KEEP, handle: "autre.identifiant", displayName: "Autre Nom" })).toEqual({ ok: true, value: { country: "FR", status: "en_attente" } })

    expect(ownProfileView(store.getState(), "p-exterieur")).toEqual(before)
    expect(membershipView(store.getState(), "p-exterieur", T0)).toMatchObject({ handle: OUTSIDER_PROFILE.handle, displayName: OUTSIDER_PROFILE.displayName, status: "en_attente" })
    // Un autre membre peut toujours prendre l'identifiant qui n'a pas été écrit.
    expect(await store.checkHandle("autre.identifiant")).toEqual({ ok: true, value: { available: true } })
  })

  it("un profil retiré n'entre pas tant que la personne ne l'a pas republié ; la republication garde l'accroche", async () => {
    const store = outsiderStore({ withdrawnAt: T0 - DAY_MS })
    expect(await store.join(KEEP)).toEqual({ ok: false, code: "profile_republish_required" })
    expect(store.getState().memberships["p-exterieur"]).toBeUndefined()

    expect(await store.republishProfile("p-exterieur")).toEqual({ ok: true, value: null })
    expect(await store.join(KEEP)).toMatchObject({ ok: true })
    expect(ownProfileView(store.getState(), "p-exterieur")).toMatchObject({ ...OUTSIDER_PROFILE, published: true })
  })

  it("un compte neuf choisit toujours son nom et son identifiant ; sans identifiant, rien n'est créé", async () => {
    const store = outsiderStore({ profile: null })
    expect(await store.join(KEEP)).toEqual({ ok: false, code: "handle_required" })
    expect(await store.join({ ...KEEP, handle: "brice.m", displayName: "Brice M" })).toMatchObject({ ok: true })
    expect(ownProfileView(store.getState(), "p-exterieur")).toMatchObject({ handle: "brice.m", displayName: "Brice M", headline: null, published: true })
  })

  it("un retour après un départ garde le profil et son accroche", async () => {
    const seed = createDemoSeed(T0)
    const store = new DemoStore(storageWith({ ...seed, session: { personId: "p-mireille" } }), () => T0, 0)
    const before = ownProfileView(store.getState(), "p-mireille")
    expect(before?.headline).toBe("Infirmière à Paris, bénévole associative")

    expect(await store.leaveDiasporale()).toEqual({ ok: true, value: null })
    expect(await store.join(KEEP)).toMatchObject({ ok: true, value: { country: "FR" } })
    expect(ownProfileView(store.getState(), "p-mireille")).toEqual(before)
  })
})
