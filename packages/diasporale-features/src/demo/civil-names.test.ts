// @vitest-environment node
import { describe, expect, it, vi } from "vitest"

import type { IdnSignInInput } from "../data/port"
import { sessionView } from "./selectors"
import { createDemoSeed, DEMO_IDN_IDENTITIES, type DemoState } from "./state"
import { DEMO_STORAGE_KEY, DemoStore } from "./store"

const NOW = Date.UTC(2026, 9, 17, 12)
const IDENTITY = { firstName: "Awa", lastName: "Ogooué", loa: 2, gaboneseNationality: true }

function memoryStorage(snapshot?: unknown) {
  const values = new Map<string, string>()
  if (snapshot !== undefined) values.set(DEMO_STORAGE_KEY, JSON.stringify(snapshot))
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
    removeItem: vi.fn((key: string) => { values.delete(key) }),
  }
}

function legacyState() {
  const seed = createDemoSeed(NOW)
  const steeve = seed.persons["p-steeve"]!
  const person = {
    ...steeve,
    idn: { ...steeve.idn!, firstName: " \tsTEEVE ", lastName: "ngOUNié\n", sub: "opaque-existing-sub" },
    profile: { ...steeve.profile!, displayName: "mon Alias LIBRE", headline: "Présentation choisie" },
  }
  const state = {
    ...seed,
    persons: { ...seed.persons, "p-steeve": person },
    session: { personId: "p-steeve" },
    pendingCode: { kind: "email" as const, value: "fictif@example.test", code: "123456", expiresAt: NOW + 1000 },
    marks: [{ personId: "p-steeve", postId: "post-2", kind: "bookmark" as const, createdAt: NOW }],
    sequence: 678,
    unrelatedExtension: { label: "État voisin à conserver" },
  }
  const canonical = {
    ...state,
    persons: { ...state.persons, "p-steeve": { ...person, idn: { ...person.idn, firstName: "Steeve", lastName: "NGOUNIÉ" } } },
  }
  return { state, canonical }
}

describe("démonstration — noms civils structurés", () => {
  it("normalise les chaînes composées avant de les persister, avec leurs accents et séparateurs", async () => {
    const storage = memoryStorage()
    const store = new DemoStore(storage, () => NOW, 0)
    expect(await store.signInWithIdn({
      firstName: "  aNNE-maRIE\t éLoDIE  ", lastName: " n'zÉ\u00a0 d’iVInDo-MbÉI ", loa: 2, gaboneseNationality: true,
    })).toEqual({ ok: true, value: null })
    const person = store.getState().persons[store.getState().session.personId!]!
    expect(person.idn).toEqual({
      firstName: "Anne-Marie Élodie", lastName: "N'ZÉ D’IVINDO-MBÉI", sub: "idn-demo-annemarieelodie-nzedivindombei", loa: 2, gaboneseNationality: true,
    })
    expect(person.profile).toBeNull()
    const persisted = JSON.parse(storage.values.get(DEMO_STORAGE_KEY)!) as DemoState
    expect(persisted.persons[person.id]!.idn).toEqual(person.idn)
    expect(sessionView(store.getState(), NOW)).toMatchObject({
      status: "signed_in", account: { nameHints: { firstName: "Anne-Marie Élodie", lastName: "N'ZÉ D’IVINDO-MBÉI" } },
    })
  })

  it("garde la même personne après persistance, rechargement et reconnexion avec une autre casse", async () => {
    const storage = memoryStorage()
    const store = new DemoStore(storage, () => NOW, 0)
    await store.signInWithIdn({ ...IDENTITY, firstName: " aWA ", lastName: " ogoOUÉ " })
    const id = store.getState().session.personId!
    const original = store.getState().persons[id]!
    const restored = new DemoStore(storage, () => NOW, 0)
    expect(restored.getState().session.personId).toBe(id)
    expect(restored.getState().persons[id]).toEqual(original)
    await restored.signOutEverywhere()
    expect(await restored.signInWithIdn({ ...IDENTITY, firstName: "AWA", lastName: "OGOOUÉ" })).toEqual({ ok: true, value: null })
    expect(restored.getState().session.personId).toBe(id)
    expect(restored.getState().persons[id]).toEqual(original)
    expect(sessionView(restored.getState(), NOW)).toMatchObject({ account: { nameHints: { firstName: "Awa", lastName: "OGOOUÉ" } } })
  })

  it("canonicalise le snapshot existant sans perdre la session, le profil social ni les données voisines", () => {
    const { state, canonical } = legacyState()
    const storage = memoryStorage(state)
    const store = new DemoStore(storage, () => NOW, 0)
    expect(store.getState()).toEqual(canonical)
    expect(JSON.parse(storage.values.get(DEMO_STORAGE_KEY)!)).toEqual(canonical)
    expect(storage.setItem).toHaveBeenCalledOnce()
    expect(storage.removeItem).not.toHaveBeenCalled()
    expect(sessionView(store.getState(), NOW)).toMatchObject({
      account: { id: "p-steeve", nameHints: { firstName: "Steeve", lastName: "NGOUNIÉ" } },
      membership: { displayName: "mon Alias LIBRE", handle: "steeve.ngounie" },
    })
    expect(new DemoStore(storage, () => NOW, 0).getState()).toEqual(canonical)
    expect(storage.setItem).toHaveBeenCalledOnce()
  })

  it("écrit les noms sociaux d'un jeu enregistré avant le 19/10 en « Prénom NOM », sans toucher un alias choisi", () => {
    const seed = createDemoSeed(NOW)
    const mireille = seed.persons["p-mireille"]!
    const prisca = seed.persons["p-prisca"]!
    const legacy = {
      ...seed,
      persons: {
        ...seed.persons,
        "p-mireille": { ...mireille, profile: { ...mireille.profile!, displayName: "Mireille Ivindo" } },
        "p-prisca": { ...prisca, profile: { ...prisca.profile!, displayName: "Prisca, alias choisi" } },
      },
    }
    const storage = memoryStorage(legacy)
    const store = new DemoStore(storage, () => NOW, 0)
    expect(store.getState().persons["p-mireille"]!.profile?.displayName).toBe("Mireille IVINDO")
    expect(store.getState().persons["p-prisca"]!.profile?.displayName).toBe("Prisca, alias choisi")
    expect((JSON.parse(storage.values.get(DEMO_STORAGE_KEY)!) as DemoState).persons["p-mireille"]!.profile?.displayName).toBe("Mireille IVINDO")
    expect(storage.setItem).toHaveBeenCalledOnce()
  })

  it("conserve le snapshot et sa session en mémoire si la correction ne peut pas être persistée", () => {
    const { state, canonical } = legacyState()
    const storage = memoryStorage(state)
    storage.setItem.mockImplementation(() => { throw new Error("Storage unavailable") })
    const store = new DemoStore(storage, () => NOW, 0)
    expect(store.getState()).toEqual(canonical)
    expect(JSON.parse(storage.values.get(DEMO_STORAGE_KEY)!)).toEqual(state)
    expect(storage.removeItem).not.toHaveBeenCalled()
  })

  it("une collision du sujet démo conserve les noms et claims existants ainsi que l'alias social", async () => {
    const storage = memoryStorage()
    const store = new DemoStore(storage, () => NOW, 0)
    await store.signInWithIdn({ ...IDENTITY, firstName: "éLOÏSE", lastName: "n'zÉ" })
    await store.join({
      handle: "courant.libre", displayName: "un Alias social LIBRE", facet: { countryOfResidence: "FR", city: "Lyon" },
      consents: { social_profile: true, directory: false, notifications: false }, directoryVisibility: "hidden",
    })
    const id = store.getState().session.personId!
    const before = store.getState()
    await store.signOutEverywhere()
    expect(await store.signInWithIdn({ firstName: "Eloise", lastName: "Nze", loa: 4, gaboneseNationality: false })).toEqual({ ok: true, value: null })
    expect(store.getState()).toEqual(before)
    expect(store.getState().session.personId).toBe(id)
    expect(store.getState().persons[id]!.idn).toMatchObject({ firstName: "Éloïse", lastName: "N'ZÉ", loa: 2, gaboneseNationality: true })
    expect(store.getState().persons[id]!.profile?.displayName).toBe("un Alias social LIBRE")
  })

  it("ne réécrit pas le sujet historique quand une capitale Unicode s'étend", async () => {
    const storage = memoryStorage()
    const store = new DemoStore(storage, () => NOW, 0)
    await store.signInWithIdn({ ...IDENTITY, firstName: "Sarah", lastName: "straße" })
    const id = store.getState().session.personId!
    expect(store.getState().persons[id]!.idn).toMatchObject({ firstName: "Sarah", lastName: "STRASSE", sub: "idn-demo-sarah-strae" })
    expect(new DemoStore(storage, () => NOW, 0).getState().persons[id]!.idn).toEqual(store.getState().persons[id]!.idn)
  })

  it.each([undefined, null, 123, {}, ["Awa"], "", " \t\n\u00a0 "])("refuse les champs civils absents ou invalides (%j) sans écriture", async (value) => {
    const storage = memoryStorage()
    const store = new DemoStore(storage, () => NOW, 0)
    const before = store.getState()
    for (const field of ["firstName", "lastName"] as const) {
      // Le contrat typé n'empêche pas une valeur invalide à une frontière d'exécution.
      const input = { ...IDENTITY, [field]: value } as unknown as IdnSignInInput
      expect(await store.signInWithIdn(input)).toEqual({ ok: false, code: "idn_invalid" })
    }
    expect(store.getState()).toBe(before)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it("ne transforme pas en nom un objet provenant d'un snapshot invalide", () => {
    const { state } = legacyState()
    const person = state.persons["p-steeve"]!
    const invalid = { ...state, persons: { ...state.persons, "p-steeve": { ...person, idn: { ...person.idn, firstName: { value: "Steeve" } } } } }
    const storage = memoryStorage(invalid)
    expect(new DemoStore(storage, () => NOW, 0).getState()).toEqual(invalid)
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(storage.removeItem).not.toHaveBeenCalled()
  })

  it("définit explicitement les quatre identités civiles et conserve les noms sociaux choisis", () => {
    const { persons } = createDemoSeed(NOW)
    expect(Object.values(persons).filter((person) => person.idn !== null).map((person) => [person.id, person.idn, person.profile?.displayName])).toEqual([
      ["p-prisca", { sub: "idn-p-prisca", firstName: "Prisca", lastName: "ABANGA", loa: 2, gaboneseNationality: true }, "Prisca ABANGA"],
      ["p-steeve", { sub: "idn-p-steeve", firstName: "Steeve", lastName: "NGOUNIÉ", loa: 1, gaboneseNationality: true }, "Steeve NGOUNIÉ"],
      ["p-nadia", { sub: "idn-p-nadia", firstName: "Nadia", lastName: "MPASSA", loa: 2, gaboneseNationality: true }, "Nadia MPASSA"],
      ["p-clarisse", { sub: "idn-p-clarisse", firstName: "Clarisse", lastName: "MBÉI", loa: 3, gaboneseNationality: true }, "Clarisse MBÉI"],
    ])
  })

  it("fournit les presets civils canoniques sans changer leurs autres claims", () => {
    expect(DEMO_IDN_IDENTITIES).toEqual([
      { key: "awa", firstName: "Awa", lastName: "OGOOUÉ", loa: 2, gaboneseNationality: true },
      { key: "yannick", firstName: "Yannick", lastName: "NYANGA", loa: 1, gaboneseNationality: true },
      { key: "foreign", firstName: "Camille", lastName: "MARTIN", loa: 2, gaboneseNationality: false },
    ])
  })
})
