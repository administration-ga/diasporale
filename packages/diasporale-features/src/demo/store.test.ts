// @vitest-environment node
import { DAY_MS, HOUR_MS, type OnboardingConsentChoices } from "@diasporale/domain"
import { describe, expect, it } from "vitest"

import type { JoinInput } from "../data/port"
import { feedView, hubCounters, membershipView, sessionView } from "./selectors"
import { DEMO_STORAGE_KEY, DemoStore } from "./store"

/**
 * Le fournisseur de démonstration joue les parcours de recette R1, R2 et R3
 * de bout en bout, avec les règles de `@diasporale/domain` — sans réseau,
 * sans latence, à horloge maîtrisée.
 */

const T0 = Date.UTC(2026, 9, 14, 12)

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

function demo() {
  let clock = T0
  const storage = memoryStorage()
  const store = new DemoStore(storage, () => clock, 0)
  return {
    store,
    storage,
    advance: (ms: number) => {
      clock += ms
    },
    me: () => {
      const id = store.getState().session.personId
      if (!id) throw new Error("aucune session")
      return id
    },
  }
}

const AWA = { firstName: "Awa", lastName: "Ogooué", loa: 2, gaboneseNationality: true }
const ONLY_PROFILE: OnboardingConsentChoices = { social_profile: true, directory: false, notifications: false }

function joinInput(overrides: Partial<JoinInput> = {}): JoinInput {
  return {
    facet: { countryOfResidence: "FR", city: "Lyon" },
    handle: "awa.ogooue",
    displayName: "Awa Ogooué",
    consents: ONLY_PROFILE,
    directoryVisibility: "country",
    ...overrides,
  }
}

describe("R1 — une personne inscrite entre par IDN", () => {
  it("l'entrée ne crée aucun profil ; l'onboarding crée une adhésion déclarée, badge Vérifié, adhésion ANTIA dérivée", async () => {
    const { store, me } = demo()
    expect(await store.signInWithIdn(AWA)).toEqual({ ok: true, value: null })
    const id = me()
    expect(store.getState().persons[id]?.profile).toBeNull()
    expect(store.getState().memberships[id]).toBeUndefined()
    expect(sessionView(store.getState(), T0)).toMatchObject({ status: "signed_in", membership: null })

    expect(await store.join(joinInput())).toEqual({ ok: true, value: { country: "FR" } })
    const view = membershipView(store.getState(), id, T0)
    expect(view).toMatchObject({
      handle: "awa.ogooue",
      status: "declaree",
      canPublish: true,
      // Même personne, deux politiques : ANTIA (ouvert) reconnaît l'IDN de niveau 2,
      // DIASPORALE (fermé) attend un parrainage ou l'attestation consulaire.
      root: { network: "antia", status: "verifiee", derivedFrom: "diasporale" },
      // Annuaire non consenti : masqué, quel que soit le niveau demandé.
      directoryVisibility: "hidden",
    })
    expect(view?.badges).toContain("verified")
  })

  it("trace chaque consentement de l'onboarding, accordé ou non, horodaté", async () => {
    const { store, me } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    const mine = store.getState().consents.filter((record) => record.personId === me())
    expect(mine.map((record) => [record.purpose, record.granted])).toEqual([
      ["social_profile", true],
      ["directory", false],
      ["notifications", false],
    ])
    expect(mine.every((record) => record.recordedAt === T0)).toBe(true)
  })

  it("refuse l'adhésion sans le consentement au profil social", async () => {
    const { store } = demo()
    await store.signInWithIdn(AWA)
    const refused = await store.join(joinInput({ consents: { ...ONLY_PROFILE, social_profile: false } }))
    expect(refused).toEqual({ ok: false, code: "consent_social_profile_required" })
  })

  it("refuse le Gabon comme pays de résidence, un handle pris, un nom affiché trop court", async () => {
    const { store } = demo()
    await store.signInWithIdn(AWA)
    expect(await store.join(joinInput({ facet: { countryOfResidence: "GA" } }))).toEqual({ ok: false, code: "country_is_home" })
    expect(await store.join(joinInput({ handle: "mireille.ivindo" }))).toEqual({ ok: false, code: "handle_taken" })
    expect(await store.join(joinInput({ handle: "a" }))).toEqual({ ok: false, code: "handle_length" })
    expect(await store.join(joinInput({ displayName: " A " }))).toEqual({ ok: false, code: "display_name_invalid" })
  })

  it("une identité IDN de nationalité non gabonaise ne fonde rien : le compte reste en attente", async () => {
    const { store, me } = demo()
    await store.signInWithIdn({ firstName: "Camille", lastName: "Martin", loa: 2, gaboneseNationality: false })
    await store.join(joinInput({ handle: "camille.martin", displayName: "Camille Martin" }))
    expect(store.statusOf(me())).toBe("en_attente")
    expect(membershipView(store.getState(), me(), T0)?.canPublish).toBe(false)
  })

  it("une seconde entrée IDN retrouve la même personne", async () => {
    const { store, me } = demo()
    await store.signInWithIdn(AWA)
    const first = me()
    await store.signOutEverywhere()
    expect(store.getState().session.personId).toBeNull()
    await store.signInWithIdn(AWA)
    expect(me()).toBe(first)
  })
})

describe("R2 — vérifier une inscription consulaire", () => {
  it("l'attestation confirmée rend le compte vérifié et pose le poste, sans autre donnée consulaire", async () => {
    const { store, me } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    expect(await store.requestAttestation()).toEqual({ ok: true, value: { outcome: "verified" } })
    const view = membershipView(store.getState(), me(), T0)
    expect(view).toMatchObject({ status: "verifiee", verifiedSince: T0, attestation: { outcome: "verified", postSlug: "poste-demo-france" } })
    expect(view?.facet.postSlug).toBe("poste-demo-france")
    // Le consentement est tracé AVANT la requête, avec sa finalité propre.
    expect(store.getState().consents.some((record) => record.personId === me() && record.purpose === "consular_attestation" && record.granted)).toBe(true)
    // Plus rien à vérifier.
    expect(await store.requestAttestation()).toEqual({ ok: false, code: "attestation_not_needed" })
  })

  it("une inscription expirée n'est pas confirmée, et la demande suivante attend 24 heures", async () => {
    const { store, advance } = demo()
    await store.signInWithIdn({ firstName: "Yannick", lastName: "Nyanga", loa: 1, gaboneseNationality: true })
    await store.join(joinInput({ handle: "yannick.nyanga", displayName: "Yannick Nyanga" }))
    expect(await store.requestAttestation()).toEqual({ ok: true, value: { outcome: "not_confirmed" } })
    advance(23 * HOUR_MS)
    expect(await store.requestAttestation()).toEqual({ ok: false, code: "attestation_too_soon" })
    advance(HOUR_MS)
    expect(await store.requestAttestation()).toEqual({ ok: true, value: { outcome: "not_confirmed" } })
  })

  it("un compte léger par téléphone n'a pas d'identifiant à présenter au consulat", async () => {
    const { store } = demo()
    const sent = await store.requestCode({ kind: "phone", value: "+33 6 39 98 12 34" })
    if (!sent.ok || !sent.value.demoCode) throw new Error("code non émis")
    await store.verifyCode(sent.value.demoCode)
    await store.join(joinInput({ handle: "telephone.demo", displayName: "Compte Démo" }))
    expect(await store.requestAttestation()).toEqual({ ok: false, code: "attestation_unavailable" })
  })
})

describe("R3 — un compte léger se fait parrainer", () => {
  it("en attente puis lecture seule ; parrainé par un membre vérifié depuis plus de 30 jours, il publie (relu, pays fermé)", async () => {
    const { store, me } = demo()
    const sent = await store.requestCode({ kind: "email", value: "nouvelle@example.com" })
    if (!sent.ok || !sent.value.demoCode) throw new Error("code non émis")
    expect(await store.verifyCode("000000")).toEqual({ ok: false, code: "code_invalid" })
    expect(await store.verifyCode(sent.value.demoCode)).toEqual({ ok: true, value: null })
    const newcomer = me()
    await store.join(joinInput({ facet: { countryOfResidence: "CA", city: "Montréal" }, handle: "nouvelle.venue", displayName: "Nouvelle Venue" }))
    expect(store.statusOf(newcomer)).toBe("en_attente")

    const post = { body: "Bonjour Montréal", reach: "local" as const, audience: "public" as const, alsoOnRoot: false }
    expect(await store.publish(post)).toEqual({ ok: false, code: "publish_not_allowed" })
    expect(await store.react("post-1", "like")).toEqual({ ok: false, code: "publish_not_allowed" })
    // Lecture : le hub et le fil restent ouverts.
    expect(feedView(store.getState(), newcomer, "recents", T0).length).toBeGreaterThan(0)

    await store.switchTo("p-mireille")
    expect(await store.sponsor("@nouvelle.venue")).toEqual({ ok: true, value: null })
    await store.switchTo(newcomer)
    expect(store.statusOf(newcomer)).toBe("declaree")
    expect(membershipView(store.getState(), newcomer, T0)?.sponsoredBy).toEqual({ handle: "mireille.ivindo", displayName: "Mireille Ivindo" })
    expect(await store.publish(post)).toEqual({ ok: true, value: { moderation: "pending_review" } })
  })

  it("un pays ouvert avec deux modérateurs publie directement", async () => {
    const { store } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    const published = await store.publish({ body: "Bonjour Lyon", reach: "local", audience: "public", alsoOnRoot: true })
    expect(published).toEqual({ ok: true, value: { moderation: "published" } })
    expect(store.getState().posts[0]).toMatchObject({ visibility: "root", scope: { reach: "local", country: "FR" } })
  })

  it("« publier aussi sur ANTIA » est ignoré hors audience publique : la visibilité reste au réseau", async () => {
    const { store } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    await store.publish({ body: "Entre nous", reach: "local", audience: "connections", alsoOnRoot: true })
    expect(store.getState().posts[0]?.visibility).toBe("network")
  })

  it("refus indistinct : une cible introuvable ou déjà vérifiée", async () => {
    const { store } = demo()
    await store.switchTo("p-mireille")
    expect(await store.sponsor("personne.inconnue")).toEqual({ ok: false, code: "target_not_eligible" })
    expect(await store.sponsor("nadia.mpassa")).toEqual({ ok: false, code: "target_not_eligible" })
  })

  it("un membre vérifié depuis moins de 30 jours ne parraine pas encore", async () => {
    const { store, me } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    await store.requestAttestation()
    expect(store.statusOf(me())).toBe("verifiee")
    expect(await store.sponsor("steeve.ngounie")).toEqual({ ok: false, code: "sponsor_too_recent" })
  })

  it("retirer un parrainage fait retomber le filleul selon ses faits restants", async () => {
    const { store } = demo()
    await store.switchTo("p-nadia")
    expect(store.statusOf("p-rodrigue")).toBe("declaree")
    expect(await store.revokeSponsorship("s-2")).toEqual({ ok: true, value: null })
    expect(store.statusOf("p-rodrigue")).toBe("en_attente")
    expect(await store.revokeSponsorship("s-2")).toEqual({ ok: false, code: "already_revoked" })
  })
})

describe("consentements, annuaire, départ et effacement", () => {
  it("l'annuaire exige son consentement ; le retirer masque la fiche", async () => {
    const { store, me, advance } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    expect(await store.setDirectoryVisibility("network")).toEqual({ ok: false, code: "consent_directory_required" })
    // À horodatage égal, le refus l'emporte (règle du domaine) : le geste suivant vient après.
    advance(1000)
    await store.setConsent("directory", true)
    expect(await store.setDirectoryVisibility("network")).toEqual({ ok: true, value: null })
    await store.setConsent("directory", false)
    expect(membershipView(store.getState(), me(), T0)?.directoryVisibility).toBe("hidden")
  })

  it("retirer le consentement au profil social, c'est quitter DIASPORALE", async () => {
    const { store, me } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    await store.setConsent("social_profile", false)
    expect(store.statusOf(me())).toBe("partie")
  })

  it("l'effacement purge la personne, ses traces et ses parrainages donnés", async () => {
    const { store } = demo()
    await store.switchTo("p-mireille")
    expect(store.statusOf("p-prisca")).toBe("verifiee")
    expect(await store.deleteMyAccount()).toEqual({ ok: true, value: null })
    const state = store.getState()
    expect(state.persons["p-mireille"]).toBeUndefined()
    expect(state.memberships["p-mireille"]).toBeUndefined()
    expect(state.consents.some((record) => record.personId === "p-mireille")).toBe(false)
    expect(state.sponsorships.some((item) => item.sponsorId === "p-mireille")).toBe(false)
    expect(state.posts.some((post) => post.author.kind === "person" && post.author.id === "p-mireille")).toBe(false)
    expect(state.session.personId).toBeNull()
    // Prisca garde son IDN de niveau 2 mais perd son parrainage : déclarée.
    expect(store.statusOf("p-prisca")).toBe("declaree")
  })

  it("l'export rend les données de la personne, marquées comme démonstration", async () => {
    const { store } = demo()
    await store.switchTo("p-steeve")
    const exported = await store.exportMyData()
    if (!exported.ok) throw new Error(exported.code)
    expect(JSON.parse(exported.value)).toMatchObject({ demonstration: true, person: { id: "p-steeve" } })
  })
})

describe("compteurs de hub et persistance", () => {
  it("les membres visibles sous le seuil de 20 ne sont jamais chiffrés", () => {
    const { store } = demo()
    expect(hubCounters(store.getState(), "FR", T0).members).toEqual({ kind: "below_threshold", threshold: 20 })
  })

  it("persiste dans le stockage local, recharge, et se remet à zéro", async () => {
    const { store, storage } = demo()
    await store.switchTo("p-steeve")
    expect(storage.items.has(DEMO_STORAGE_KEY)).toBe(true)
    const reloaded = new DemoStore(storage, () => T0, 0)
    expect(reloaded.getState().session.personId).toBe("p-steeve")
    await reloaded.reset()
    expect(reloaded.getState().session.personId).toBeNull()
  })

  it("un stockage illisible repart du jeu de démonstration", () => {
    const storage = memoryStorage()
    storage.setItem(DEMO_STORAGE_KEY, "{pas du json")
    const store = new DemoStore(storage, () => T0 + DAY_MS, 0)
    expect(Object.keys(store.getState().persons)).toContain("p-mireille")
  })
})
