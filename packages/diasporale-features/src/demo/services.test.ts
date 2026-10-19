import { LIGHT_ACCOUNT_GROUNDS, SERVICE_OFFERS_PER_PAGE_MAX } from "@diasporale/domain"
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { ServiceOfferInputView, ServiceSearchRequest } from "../data/services-port"
import type { Loadable } from "../data/types"
import { demoManagedPage } from "./page-admin"
import { createDemoServices, createDemoServicesSeed, DEMO_SERVICE_TEAMS, DEMO_SERVICES_STORAGE_KEY } from "./services"
import { createDemoSeed, type DemoState } from "./state"
import { DemoStore } from "./store"

/**
 * Le catalogue de démonstration applique les règles du domaine dans l'ordre du
 * moteur : session, adhésion, capacité, page gérée, nature, règles de l'offre,
 * version — sur des offres FICTIVES, sans réseau ni latence.
 */
const NOW = Date.UTC(2026, 9, 18, 9)

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map<string, string>(Object.entries(initial))
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

/** Un magasin principal tenu en main : un état de départ (modifiable) et une session. */
function setup(viewer: string | null, change: (state: DemoState) => DemoState = (state) => state, options: Parameters<typeof createDemoServices>[1] = { storage: null }) {
  const seed = createDemoSeed(NOW)
  const state = change({ ...seed, session: { personId: viewer } })
  const main = memoryStorage({ "diasporale:demonstration:v1": JSON.stringify(state) })
  const clock = { now: NOW }
  const store = new DemoStore(main, () => clock.now, 0)
  const services = createDemoServices(store, options)
  return { store, services, capability: services.capability, clock }
}

function data<T>(loadable: Loadable<T>): T {
  if (loadable.status !== "ready") throw new Error(`Lecture non prête : ${JSON.stringify(loadable)}`)
  return loadable.data
}

const INPUT: ServiceOfferInputView = {
  title: "Coiffure enfants (démo)",
  description: "Offre fictive de recette : coiffure des enfants le samedi matin.",
  category: "beauty",
  country: "FR",
  city: "Paris",
  delivery: "onsite",
  languages: ["fr"],
  durationMinutes: 60,
  pricing: { mode: "fixed", amountMinor: 2500, currency: "EUR" },
}

describe("démonstration des services — offres fictives", () => {
  it("tient le contrat de la démonstration des demandes : findOffer et ses champs", () => {
    const { services } = setup("p-prisca")
    expect(services.findOffer("offer-demo-coiffure")).toEqual({
      id: "offer-demo-coiffure",
      title: "Tresses et coiffure afro (démo)",
      version: 1,
      status: "active",
      pageId: "page-saveurs",
      pageHandle: "saveurs-okoume-demo",
      pageName: "Saveurs d'Okoumé (démo)",
    })
    expect(services.findOffer("offer-demo-photo")?.status).toBe("paused")
    expect(services.findOffer("inconnue")).toBeNull()
  })

  it("les équipes de départ sont celles de la démonstration de la gestion des pages", async () => {
    const { store } = setup(null)
    for (const [pageId, people] of Object.entries(DEMO_SERVICE_TEAMS)) {
      for (const personId of people) {
        await store.switchTo(personId)
        expect(demoManagedPage(store, store.getState().pages[pageId]!.handle)?.myRole, `${personId} → ${pageId}`).not.toBeNull()
      }
    }
  })

  it("relit le rôle vivant dans la gestion des pages : sans rôle, rien à gérer", async () => {
    const { store, capability } = setup("p-prisca")
    expect(await capability.createOffer({ ...INPUT, pageId: "page-saveurs", publish: true })).toEqual({ ok: false, code: "not_found" })
    await store.switchTo("p-mireille")
    expect(await capability.createOffer({ ...INPUT, pageId: "page-saveurs", publish: true })).toMatchObject({ ok: true })
    expect(await capability.createOffer({ ...INPUT, pageId: "page-inconnue", publish: true })).toEqual({ ok: false, code: "not_found" })
  })

  it("chaque offre de départ passe la règle du domaine et se dit fictive", () => {
    const seed = createDemoServicesSeed(NOW)
    expect(seed.offers).toHaveLength(6)
    for (const offer of seed.offers) {
      expect(offer.title).toContain("(démo)")
      expect(offer.createdAt).toBeLessThan(NOW)
      expect(Object.keys(DEMO_SERVICE_TEAMS)).toContain(offer.pageId)
    }
  })

  it("le catalogue ne montre que les offres actives, les plus récentes d'abord, sans aucun contact", () => {
    const { capability } = setup("p-prisca")
    const { result } = renderHook(() => capability.useSearch({ cursor: null }))
    const page = data(result.current)
    expect(page.items.map((item) => item.id)).toEqual(["offer-demo-traduction", "offer-demo-coiffure", "offer-demo-bruxelles", "offer-demo-accueil-lyon"])
    expect(page.isDone).toBe(true)
    expect(page.items[1]).toMatchObject({ provider: { handle: "saveurs-okoume-demo", badge: "verified", ownerKind: "company", logoUrl: null }, budgetFit: null })
    expect(JSON.stringify(page)).not.toMatch(/@|p-mireille|p-steeve/)
  })

  it.each([
    [{ city: " PARIS " }, ["offer-demo-coiffure"]],
    [{ country: "BE" }, ["offer-demo-bruxelles"]],
    [{ category: "translation" }, ["offer-demo-traduction"]],
    [{ delivery: "remote" }, ["offer-demo-traduction", "offer-demo-bruxelles", "offer-demo-accueil-lyon"]],
    [{ delivery: "onsite" }, ["offer-demo-coiffure", "offer-demo-bruxelles", "offer-demo-accueil-lyon"]],
    [{ query: "tresses" }, ["offer-demo-coiffure"]],
    [{ query: "nouveaux arrivants" }, ["offer-demo-accueil-lyon"]],
    [{ query: "x" }, ["offer-demo-traduction", "offer-demo-coiffure", "offer-demo-bruxelles", "offer-demo-accueil-lyon"]],
  ] as const)("filtre %o", (filters, ids) => {
    const { capability } = setup("p-prisca")
    const { result } = renderHook(() => capability.useSearch({ ...filters, cursor: null } as ServiceSearchRequest))
    expect(data(result.current).items.map((item) => item.id)).toEqual(ids)
  })

  it("le budget écarte ce qui le dépasse et garde, signalé, ce qui ne se compare pas", () => {
    const { capability } = setup("p-prisca")
    const { result } = renderHook(() => capability.useSearch({ budget: { amountMinor: 5000, currency: "EUR" }, cursor: null }))
    expect(data(result.current).items.map((item) => [item.id, item.budgetFit])).toEqual([
      ["offer-demo-traduction", "quote"],
      ["offer-demo-bruxelles", "within"],
      ["offer-demo-accueil-lyon", "within"],
    ])
  })

  it("rend un code fermé pour un filtre refusé ou un curseur d'une autre recherche", () => {
    const { capability } = setup("p-prisca")
    const { result, rerender } = renderHook((request: ServiceSearchRequest) => capability.useSearch(request), { initialProps: { country: "GA", cursor: null } as ServiceSearchRequest })
    expect(result.current).toEqual({ status: "error", code: "service_country_is_home" })
    rerender({ cursor: "pas-un-curseur" })
    expect(result.current).toEqual({ status: "error", code: "unknown" })
  })

  it("garde la même référence tant que rien ne change", () => {
    const { capability } = setup("p-prisca")
    const { result, rerender } = renderHook(() => capability.useSearch({ city: "Lyon", cursor: null }))
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it("pagine par fenêtres de douze, sans doublon, la suite annoncée", async () => {
    const { capability } = setup("p-mireille")
    for (let index = 0; index < 10; index += 1) {
      expect(await capability.createOffer({ ...INPUT, title: `Coiffure ${index} (démo)`, pageId: "page-saveurs", publish: true })).toMatchObject({ ok: true })
    }
    const { result, rerender } = renderHook((request: ServiceSearchRequest) => capability.useSearch(request), { initialProps: { cursor: null } as ServiceSearchRequest })
    const first = data(result.current)
    expect(first.items).toHaveLength(12)
    expect(first.isDone).toBe(false)
    rerender({ cursor: first.continueCursor })
    const second = data(result.current)
    expect(second.items).toHaveLength(2)
    expect(second.isDone).toBe(true)
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(14)
  })

  it.each([
    [null, (state: DemoState) => state, "not_signed_in"],
    ["p-prisca", (state: DemoState) => ({ ...state, memberships: Object.fromEntries(Object.entries(state.memberships).filter(([id]) => id !== "p-prisca")) }), "not_member"],
    ["p-prisca", (state: DemoState) => ({ ...state, memberships: { ...state.memberships, "p-prisca": { ...state.memberships["p-prisca"]!, grounds: { ...state.memberships["p-prisca"]!.grounds, suspension: { until: null, readAccess: "read_only" as const } } } } }), "suspended"],
  ] as const)("refuse la lecture à %s (%#)", (viewer, change, code) => {
    const { capability } = setup(viewer, change)
    expect(renderHook(() => capability.useSearch({ cursor: null })).result.current).toEqual({ status: "error", code })
    expect(renderHook(() => capability.useOffer("offer-demo-coiffure")).result.current).toEqual({ status: "error", code })
    expect(renderHook(() => capability.usePageOffers({ pageHandle: "saveurs-okoume-demo", cursor: null })).result.current).toEqual({ status: "error", code })
    expect(renderHook(() => capability.useMyPageOffers({ pageId: "page-saveurs", cursor: null })).result.current).toEqual({ status: "error", code })
  })
})

describe("démonstration des services — fiche et page", () => {
  it("une offre en pause ou en brouillon n'existe que pour l'équipe de sa page", () => {
    const reader = setup("p-prisca").capability
    expect(data(renderHook(() => reader.useOffer("offer-demo-coiffure")).result.current)).toMatchObject({ status: "active", viewerCanManage: false })
    expect(data(renderHook(() => reader.useOffer("offer-demo-photo")).result.current)).toBeNull()
    expect(data(renderHook(() => reader.useOffer("offer-demo-affiches")).result.current)).toBeNull()
    expect(data(renderHook(() => reader.useOffer("inconnue")).result.current)).toBeNull()
    const team = setup("p-mireille").capability
    expect(data(renderHook(() => team.useOffer("offer-demo-photo")).result.current)).toMatchObject({ status: "paused", viewerCanManage: true })
  })

  it("la fiche d'une page liste ses seules offres actives ; une page sans services rend le refus indistinct", () => {
    const { capability } = setup("p-prisca")
    const { result, rerender } = renderHook((handle: string) => capability.usePageOffers({ pageHandle: handle, cursor: null }), { initialProps: "collectif-ivindo-lyon" })
    expect(data(result.current).items.map((item) => item.id)).toEqual(["offer-demo-traduction", "offer-demo-accueil-lyon"])
    rerender("poste-demo-france")
    expect(result.current).toEqual({ status: "error", code: "not_found" })
    rerender("inconnue")
    expect(result.current).toEqual({ status: "error", code: "not_found" })
    expect(renderHook(() => capability.usePageOffers({ pageHandle: "collectif-ivindo-lyon", cursor: "faux" })).result.current).toEqual({ status: "error", code: "unknown" })
  })

  it("« mes offres » : tous les états, groupés comme le moteur, réservés à l'équipe", () => {
    const team = setup("p-steeve").capability
    const mine = data(renderHook(() => team.useMyPageOffers({ pageId: "page-asso-lyon", cursor: null })).result.current)
    expect(mine.items.map((item) => [item.id, item.status, item.viewerCanManage])).toEqual([
      ["offer-demo-accueil-lyon", "active", true],
      ["offer-demo-traduction", "active", true],
      ["offer-demo-affiches", "draft", true],
    ])
    expect(renderHook(() => team.useMyPageOffers({ pageId: "page-saveurs", cursor: null })).result.current).toEqual({ status: "error", code: "not_found" })
    expect(renderHook(() => team.useMyPageOffers({ pageId: "page-asso-lyon", cursor: "faux" })).result.current).toEqual({ status: "error", code: "unknown" })
  })
})

describe("démonstration des services — gérer une offre", () => {
  it("publier, mettre en pause, reprendre, retirer : version exigée, retirée terminale", async () => {
    const { capability, services } = setup("p-mireille")
    const created = await capability.createOffer({ ...INPUT, pageId: "page-saveurs", publish: false })
    expect(created).toEqual({ ok: true, value: { offerId: "offer-demo-1", version: 1, status: "draft" } })
    const offerId = "offer-demo-1"
    const { result } = renderHook(() => capability.useMyPageOffers({ pageId: "page-saveurs", cursor: null }))
    expect(data(result.current).items.map((item) => item.id)).toContain(offerId)

    expect(await capability.setOfferStatus({ offerId, expectedVersion: 1, status: "paused" })).toEqual({ ok: false, code: "service_offer_transition_invalid" })
    expect(await capability.setOfferStatus({ offerId, expectedVersion: 1, status: "active" })).toEqual({ ok: true, value: { status: "active", version: 2 } })
    expect(await capability.updateOffer({ ...INPUT, offerId, expectedVersion: 1, title: "Écrasement tardif (démo)" })).toEqual({ ok: false, code: "service_offer_version_conflict" })
    expect(await capability.updateOffer({ ...INPUT, offerId, expectedVersion: 2, title: "Coiffure des enfants (démo)" })).toEqual({ ok: true, value: { version: 3 } })
    expect(services.findOffer(offerId)).toMatchObject({ title: "Coiffure des enfants (démo)", version: 3, status: "active" })
    expect(await capability.setOfferStatus({ offerId, expectedVersion: 3, status: "paused" })).toEqual({ ok: true, value: { status: "paused", version: 4 } })
    // Redemander l'état courant : rien ne change, même avec une version ancienne.
    expect(await capability.setOfferStatus({ offerId, expectedVersion: 1, status: "paused" })).toEqual({ ok: true, value: { status: "paused", version: 4 } })
    expect(await capability.setOfferStatus({ offerId, expectedVersion: 1, status: "withdrawn" })).toEqual({ ok: false, code: "service_offer_version_conflict" })
    expect(await capability.setOfferStatus({ offerId, expectedVersion: 4, status: "withdrawn" })).toEqual({ ok: true, value: { status: "withdrawn", version: 5 } })
    expect(await capability.setOfferStatus({ offerId, expectedVersion: 5, status: "active" })).toEqual({ ok: false, code: "service_offer_withdrawn" })
    expect(await capability.updateOffer({ ...INPUT, offerId, expectedVersion: 5 })).toEqual({ ok: false, code: "service_offer_withdrawn" })
    // Le lien conservé vers une offre retirée ne mène plus à rien pour un lecteur.
    expect(services.findOffer(offerId)?.status).toBe("withdrawn")
  })

  it("refuse hors équipe, sous le statut requis, pour une nature non admise et contre les règles du domaine", async () => {
    const reader = setup("p-prisca").capability
    expect(await reader.createOffer({ ...INPUT, pageId: "page-saveurs", publish: true })).toEqual({ ok: false, code: "not_found" })
    expect(await reader.updateOffer({ ...INPUT, offerId: "offer-demo-coiffure", expectedVersion: 1 })).toEqual({ ok: false, code: "not_found" })
    expect(await reader.setOfferStatus({ offerId: "offer-demo-coiffure", expectedVersion: 1, status: "paused" })).toEqual({ ok: false, code: "not_found" })
    expect(await reader.updateOffer({ ...INPUT, offerId: "inconnue", expectedVersion: 1 })).toEqual({ ok: false, code: "not_found" })

    const pending = setup("p-steeve", (state) => ({ ...state, memberships: { ...state.memberships, "p-steeve": { ...state.memberships["p-steeve"]!, grounds: LIGHT_ACCOUNT_GROUNDS } } })).capability
    expect(await pending.createOffer({ ...INPUT, pageId: "page-asso-lyon", publish: true })).toEqual({ ok: false, code: "status_insufficient" })
    expect(await pending.updateOffer({ ...INPUT, offerId: "inconnue", expectedVersion: 1 })).toEqual({ ok: false, code: "status_insufficient" })

    const institution = setup("p-mireille", (state) => state, { storage: null, teams: { "page-poste-fr": ["p-mireille"] } }).capability
    expect(await institution.createOffer({ ...INPUT, pageId: "page-poste-fr", publish: true })).toEqual({ ok: false, code: "service_page_kind_not_allowed" })
    expect(renderHook(() => institution.useMyPageOffers({ pageId: "page-poste-fr", cursor: null })).result.current).toEqual({ status: "error", code: "service_page_kind_not_allowed" })

    const team = setup("p-mireille").capability
    expect(await team.createOffer({ ...INPUT, title: "Ab", pageId: "page-saveurs", publish: true })).toEqual({ ok: false, code: "service_title_too_short" })
    expect(await team.createOffer({ ...INPUT, description: "Réservez au 06 12 34 56 78, merci.", pageId: "page-saveurs", publish: true })).toEqual({ ok: false, code: "service_contact_details_forbidden" })
    expect(await team.updateOffer({ ...INPUT, city: "", offerId: "offer-demo-coiffure", expectedVersion: 1 })).toEqual({ ok: false, code: "service_city_required" })
  })

  it("plafonne les offres non retirées d'une page", async () => {
    const { capability } = setup("p-steeve")
    // Trois offres non retirées au départ sur la page du collectif.
    for (let index = 3; index < SERVICE_OFFERS_PER_PAGE_MAX; index += 1) {
      expect(await capability.createOffer({ ...INPUT, title: `Offre ${index} (démo)`, pageId: "page-asso-lyon", publish: false })).toMatchObject({ ok: true })
    }
    expect(await capability.createOffer({ ...INPUT, pageId: "page-asso-lyon", publish: false })).toEqual({ ok: false, code: "service_offer_limit_reached" })
  })

  it("garde les offres d'une visite à l'autre et les remet à zéro avec la démonstration", async () => {
    const storage = memoryStorage()
    const { store, capability, clock } = setup("p-mireille", (state) => state, { storage })
    await capability.createOffer({ ...INPUT, pageId: "page-saveurs", publish: true })
    expect(JSON.parse(storage.items.get(DEMO_SERVICES_STORAGE_KEY)!).offers).toHaveLength(7)
    const again = createDemoServices(store, { storage })
    expect(again.findOffer("offer-demo-1")?.title).toBe(INPUT.title)
    // Un stockage illisible ou d'une autre démonstration est ignoré.
    storage.items.set(DEMO_SERVICES_STORAGE_KEY, "{pas du json")
    expect(createDemoServices(store, { storage }).findOffer("offer-demo-1")).toBeNull()
    // La remise à zéro survient plus tard que le premier chargement : un nouvel état principal.
    clock.now += 60_000
    await act(async () => { await store.reset() })
    expect(again.findOffer("offer-demo-1")).toBeNull()
    expect(again.findOffer("offer-demo-coiffure")?.version).toBe(1)
  })

  it("prévient les lecteurs abonnés à chaque écriture", async () => {
    const { capability } = setup("p-mireille")
    const { result } = renderHook(() => capability.useSearch({ city: "Paris", cursor: null }))
    expect(data(result.current).items).toHaveLength(1)
    await act(async () => { await capability.createOffer({ ...INPUT, pageId: "page-saveurs", publish: true }) })
    expect(data(result.current).items).toHaveLength(2)
  })
})
