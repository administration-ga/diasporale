// @vitest-environment jsdom
/**
 * Démonstration de la capacité « pages » (DG-007) : abonnement local et
 * idempotent, annuaire filtrable sur les pages fictives, rôle du lecteur lu dans
 * la démonstration de la gestion des pages, listes du hub, mêmes refus que le
 * moteur, remise à zéro avec la démonstration.
 */
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PAGE_DIRECTORY_PAGE_SIZE, type PageDetailQuery } from "../data/pages-port"
import type { JoinInput } from "../data/port"
import { createDemoPages, DEMO_PAGE_FOLLOWS_STORAGE_KEY, demoHubPages, demoPageDetail, demoPageDirectory } from "./pages"
import { DEMO_STORAGE_KEY, DemoStore } from "./store"

const T0 = Date.UTC(2026, 9, 18, 12)

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

function demo(personId: string | null = "p-steeve") {
  const store = new DemoStore(null, () => T0, 0)
  if (personId) void store.switchTo(personId)
  const pages = createDemoPages(store, { storage: null })
  return { store, pages }
}

function detail(query: PageDetailQuery) {
  if (query.status !== "ready" || query.data === null) throw new Error("fiche attendue")
  return query.data
}

const JOIN: JoinInput = {
  facet: { countryOfResidence: "FR", city: "Lyon" },
  handle: "camille.martin",
  displayName: "Camille Martin",
  consents: { social_profile: true, directory: false, notifications: false },
  directoryVisibility: "hidden",
}

describe("fiche d'une page fictive", () => {
  it("dit le rôle VIVANT du lecteur, lu dans la gestion des pages de démonstration", () => {
    const steeve = demo("p-steeve")
    // La vue pure, sans la gestion des pages : aucun rôle n'est supposé.
    expect(detail(demoPageDetail(steeve.store.getState(), "collectif-ivindo-lyon", {}, T0)).viewer.role).toBeNull()
    const { result } = renderHook(() => steeve.pages.usePage("collectif-ivindo-lyon"))
    expect(detail(result.current)).toMatchObject({ viewer: { role: "admin", following: false }, events: expect.any(Array), morePosts: false })
    // Mireille n'a pas encore accepté l'invitation de l'association lyonnaise : aucun rôle.
    const mireille = demo("p-mireille")
    const lyon = renderHook(() => mireille.pages.usePage("collectif-ivindo-lyon"))
    expect(detail(lyon.result.current).viewer.role).toBeNull()
    const saveurs = renderHook(() => mireille.pages.usePage("saveurs-okoume-demo"))
    expect(detail(saveurs.result.current).viewer.role).toBe("admin")
  })

  it("rend la revendicabilité pour CE lecteur, comme le moteur", () => {
    const { pages } = demo("p-steeve")
    const claimable = (handle: string) => detail(renderHook(() => pages.usePage(handle)).result.current).page.claimable
    // Sans administrateur dans l'équipe fictive : revendicable.
    expect(claimable("etudiants-bordeaux-demo")).toBe(true)
    expect(claimable("amicale-montreal-demo")).toBe(true)
    // L'entreprise bruxelloise a déjà son administratrice ; vérifiée, officielle : non.
    expect(claimable("valise-solidaire-demo")).toBe(false)
    expect(claimable("collectif-ivindo-lyon")).toBe(false)
    expect(claimable("poste-demo-france")).toBe(false)
  })

  it("une adresse inconnue rend le même null qu'une page illisible", () => {
    const { pages } = demo()
    const { result } = renderHook(() => pages.usePage("page-qui-n-existe-pas"))
    expect(result.current).toEqual({ status: "ready", data: null })
  })
})

describe("suivre une page fictive — abonnement local", () => {
  it("suivre, puis suivre encore, ne compte qu'une fois ; la fiche se met à jour d'elle-même", async () => {
    const { pages } = demo("p-steeve")
    const { result } = renderHook(() => pages.usePage("etudiants-bordeaux-demo"))
    expect(detail(result.current)).toMatchObject({ viewer: { following: false }, page: { followers: 0 } })
    await act(async () => {
      expect(await pages.follow("etudiants-bordeaux-demo")).toEqual({ ok: true, value: { following: true } })
      expect(await pages.follow("@Etudiants-Bordeaux-Demo")).toEqual({ ok: true, value: { following: true } })
    })
    expect(detail(result.current)).toMatchObject({ viewer: { following: true }, page: { followers: 1 } })
    await act(async () => {
      expect(await pages.unfollow("etudiants-bordeaux-demo")).toEqual({ ok: true, value: { following: false } })
      expect(await pages.unfollow("etudiants-bordeaux-demo")).toEqual({ ok: true, value: { following: false } })
    })
    expect(detail(result.current)).toMatchObject({ viewer: { following: false }, page: { followers: 0 } })
  })

  it("l'abonnement d'une personne ne se voit pas comme celui d'une autre, mais compte pour la page", async () => {
    const { store, pages } = demo("p-steeve")
    await pages.follow("amicale-montreal-demo")
    await store.switchTo("p-prisca")
    const view = detail(demoPageDetail(store.getState(), "amicale-montreal-demo", { follows: new Set(["p-steeve|page-asso-montreal"]) }, T0))
    expect(view).toMatchObject({ viewer: { following: false }, page: { followers: 1 } })
    const { result } = renderHook(() => pages.usePage("amicale-montreal-demo"))
    expect(detail(result.current)).toMatchObject({ viewer: { following: false }, page: { followers: 1 } })
  })

  it("mêmes refus que le moteur : session, adhésion, statut, page lisible", async () => {
    const anonymous = demo(null)
    expect(await anonymous.pages.follow("etudiants-bordeaux-demo")).toEqual({ ok: false, code: "not_signed_in" })

    const visitor = demo(null)
    await visitor.store.signInWithIdn({ firstName: "Camille", lastName: "Martin", loa: 2, gaboneseNationality: false })
    expect(await visitor.pages.follow("etudiants-bordeaux-demo")).toEqual({ ok: false, code: "not_member" })
    await visitor.store.join(JOIN)
    expect(visitor.store.statusOf(visitor.store.getState().session.personId ?? "")).toBe("en_attente")
    // Un compte en attente lit tout ; il ne suit pas encore (écriture « déclarée » du moteur).
    expect(await visitor.pages.follow("etudiants-bordeaux-demo")).toEqual({ ok: false, code: "status_insufficient" })
    expect(await visitor.pages.unfollow("etudiants-bordeaux-demo")).toEqual({ ok: true, value: { following: false } })

    const { pages } = demo("p-steeve")
    expect(await pages.follow("page-inconnue")).toEqual({ ok: false, code: "not_found" })
    const { result } = renderHook(() => anonymous.pages.usePage("etudiants-bordeaux-demo"))
    expect(result.current).toEqual({ status: "error", code: "not_signed_in" })
  })

  it("persiste avec la démonstration et repart à zéro avec elle", async () => {
    const storage = memoryStorage()
    let clock = T0
    const store = new DemoStore(storage, () => clock, 0)
    await store.switchTo("p-steeve")
    expect(storage.items.has(DEMO_STORAGE_KEY)).toBe(true)
    const pages = createDemoPages(store, { storage })
    await pages.follow("etudiants-bordeaux-demo")
    expect(JSON.parse(storage.items.get(DEMO_PAGE_FOLLOWS_STORAGE_KEY) ?? "{}")).toMatchObject({ follows: ["p-steeve|page-asso-bordeaux"] })

    // Un nouvel onglet relit les abonnements de la même démonstration.
    const reopened = new DemoStore(storage, () => clock, 0)
    const again = createDemoPages(reopened, { storage })
    expect(detail(renderHook(() => again.usePage("etudiants-bordeaux-demo")).result.current).viewer.following).toBe(true)

    // La remise à zéro, plus tard, change le jeu fictif : plus aucun abonnement.
    clock += 60_000
    await act(async () => {
      await reopened.reset()
    })
    await reopened.switchTo("p-steeve")
    expect(detail(renderHook(() => again.usePage("etudiants-bordeaux-demo")).result.current).viewer.following).toBe(false)
  })
})

describe("annuaire des pages fictives", () => {
  it("suit l'ordre du moteur (confiance d'abord) et pagine par fenêtres", () => {
    const { store } = demo("p-steeve")
    const page = demoPageDirectory(store.getState(), { query: "", cursor: null }, {}, T0)
    if (page.status !== "ready") throw new Error("annuaire attendu")
    expect(page.data.items[0]).toMatchObject({ handle: "poste-demo-france", trust: "official" })
    expect(page.data.items.map((item) => item.trust)).toEqual([...page.data.items.map((item) => item.trust)].sort((a, b) => ["official", "verified", "community"].indexOf(a) - ["official", "verified", "community"].indexOf(b)))
    expect(page.data.items.length).toBeLessThanOrEqual(PAGE_DIRECTORY_PAGE_SIZE)
    expect(page.data).toMatchObject({ isDone: true, continueCursor: null })
  })

  it("cherche sans accents à partir de deux caractères ; un caractère ne cherche pas", () => {
    const { store } = demo("p-steeve")
    const names = (query: string, country?: "FR" | "BE" | "CA") => {
      const page = demoPageDirectory(store.getState(), { query, cursor: null, ...(country ? { country } : {}) }, {}, T0)
      if (page.status !== "ready") throw new Error("annuaire attendu")
      return page.data.items.map((item) => item.handle)
    }
    expect(names("ivindo")).toEqual(["collectif-ivindo-lyon"])
    expect(names("ETUDIANTS")).toEqual(["etudiants-bordeaux-demo"])
    expect(names("étudiants")).toEqual(["etudiants-bordeaux-demo"])
    expect(names("i")).toHaveLength(names("").length)
    // Le pays restreint, il n'ouvre rien.
    expect(names("", "BE")).toEqual(["valise-solidaire-demo"])
    expect(names("ivindo", "BE")).toEqual([])
  })

  it("dit qui suit quoi, et refuse un curseur venu d'une autre recherche", async () => {
    const { store, pages } = demo("p-steeve")
    await pages.follow("amicale-montreal-demo")
    const { result } = renderHook(() => pages.useDirectory({ query: "amicale", cursor: null }))
    expect(result.current).toMatchObject({ status: "ready", data: { items: [{ handle: "amicale-montreal-demo", following: true, followers: 1 }] } })
    const foreign = JSON.stringify(["demo-pages", JSON.stringify(["autre", null]), 20])
    expect(demoPageDirectory(store.getState(), { query: "amicale", cursor: foreign }, {}, T0)).toEqual({ status: "error", code: "unknown" })
  })
})

describe("listes du hub fictif", () => {
  it("par nature, du pays seulement", () => {
    const { store } = demo("p-steeve")
    const hub = demoHubPages(store.getState(), "FR", {}, T0)
    if (hub.status !== "ready") throw new Error("hub attendu")
    expect(hub.data.officialPages.map((page) => page.handle)).toEqual(["poste-demo-france"])
    expect(hub.data.associations.map((page) => page.handle).sort()).toEqual(["collectif-ivindo-lyon", "etudiants-bordeaux-demo"])
    expect(hub.data.companies.map((page) => page.handle)).toEqual(["saveurs-okoume-demo"])
    expect(hub.data.more).toEqual({ officialPages: false, associations: false, companies: false })
    expect(demoHubPages(demo(null).store.getState(), "FR", {}, T0)).toEqual({ status: "error", code: "not_signed_in" })
  })
})
