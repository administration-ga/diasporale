// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import type { ServiceOfferInputView, ServiceSearchRequest } from "@diasporale/features/data"
import { cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEngineServices, searchArgsOf } from "./engine-services"

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isPending: false, isUnauthenticated: false },
  network: { _id: "network-diasporale" } as unknown,
  membership: undefined as unknown,
  results: new Map<string, unknown>(),
  loaded: vi.fn(),
}))

vi.mock("@antsia/api/hooks", () => ({ useStableConvexAuth: () => mocks.auth }))
vi.mock("convex/react", () => ({
  // Les lectures de page relisent la transition réelle de session : la même que la session stable du test.
  useConvexAuth: () => ({ isAuthenticated: mocks.auth.isAuthenticated, isLoading: mocks.auth.isPending }),
  useQueries: (queries: Record<string, { query: Parameters<typeof getFunctionName>[0]; args?: unknown }>) => {
    if (!queries.value) return {}
    const name = getFunctionName(queries.value.query)
    mocks.loaded(name, queries.value.args)
    switch (name) {
      case "modules/networks/networks:getBySlug": return { value: mocks.network }
      case "modules/diaspora/membership:myMembership": return { value: mocks.membership }
      default: return { value: mocks.results.get(name) }
    }
  },
}))

const MEMBER = { status: "declaree", capabilities: ["read_network", "publish"], facet: { countryOfResidence: "FR" } }
const PAGE = { pageId: "page-1", networkId: "network-diasporale", handle: "coiffure-paris", name: "Coiffure Paris (fictif)", shortName: null, logoUrl: null, badge: "community", ownerKind: "company", country: "FR" }
const CARD = {
  offerId: "offer-1", version: 2, title: "Tresses", description: "Coiffure afro fictive.", category: "beauty", country: "FR", city: "Paris",
  delivery: "onsite", languages: ["fr"], durationMinutes: 90, pricing: { mode: "from", amountMinor: 6000, currency: "EUR" }, page: PAGE,
  budgetFit: "within", updatedAt: 10,
}
const DETAIL = { ...CARD, budgetFit: null, status: "paused", viewerCanManage: true }
const INPUT: ServiceOfferInputView = {
  title: "Tresses", description: "Coiffure afro fictive.", category: "beauty", country: "FR", city: "Paris", delivery: "onsite",
  languages: ["fr", "en"], durationMinutes: null, pricing: { mode: "quote" },
}

function source(convex: Partial<ConvexReactClient> = {}) {
  return createEngineServices({ convex: convex as ConvexReactClient, authClient: {} as EngineAuthClient })
}

function writer(mutation: ReturnType<typeof vi.fn>, network: unknown = { _id: "network-diasporale" }) {
  return source({ query: vi.fn().mockResolvedValue(network) as never, mutation: mutation as never })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
  mocks.network = { _id: "network-diasporale" }
  mocks.membership = { ...MEMBER }
  mocks.results.clear()
})
afterEach(cleanup)

describe("services — lectures du moteur", () => {
  it("cherche dans le réseau avec les seuls filtres posés, une fenêtre de douze", () => {
    mocks.results.set("modules/diaspora/services:searchOffers", { page: [CARD], isDone: false, continueCursor: "suite" })
    const request: ServiceSearchRequest = { query: "tresses", city: "Paris", delivery: "onsite", budget: { amountMinor: 5000, currency: "EUR" }, cursor: null }
    const { result } = renderHook(() => source().useSearch(request))
    expect(mocks.loaded).toHaveBeenCalledWith("modules/diaspora/services:searchOffers", {
      networkId: "network-diasporale", query: "tresses", city: "Paris", delivery: "onsite", maxBudgetMinor: 5000, currency: "EUR",
      paginationOpts: { numItems: 12, cursor: null },
    })
    expect(result.current).toEqual({
      status: "ready",
      data: {
        items: [{
          id: "offer-1", version: 2, title: "Tresses", description: "Coiffure afro fictive.", category: "beauty", country: "FR", city: "Paris",
          delivery: "onsite", languages: ["fr"], durationMinutes: 90, pricing: { mode: "from", amountMinor: 6000, currency: "EUR" },
          provider: { id: "page-1", handle: "coiffure-paris", name: "Coiffure Paris (fictif)", ownerKind: "company", badge: "community", logoUrl: null },
          budgetFit: "within", updatedAt: 10,
        }],
        isDone: false,
        continueCursor: "suite",
      },
    })
  })

  it("n'envoie aucun filtre vide et garde la même référence tant que le moteur ne rend rien de neuf", () => {
    expect(searchArgsOf({ query: "  ", city: "", cursor: null })).toEqual({})
    expect(searchArgsOf({ country: "BE", category: "translation", cursor: "x" })).toEqual({ country: "BE", category: "translation" })
    mocks.results.set("modules/diaspora/services:searchOffers", { page: [CARD], isDone: true, continueCursor: "" })
    const data = source()
    const { result, rerender } = renderHook(() => data.useSearch({ cursor: null }))
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it.each([
    { name: "sans session", setup: () => { mocks.auth = { isAuthenticated: false, isPending: false, isUnauthenticated: true } }, code: "not_signed_in" },
    { name: "sans adhésion", setup: () => { mocks.membership = null }, code: "not_member" },
    { name: "suspendu", setup: () => { mocks.membership = { status: "suspendue", capabilities: [] } }, code: "suspended" },
    { name: "réseau absent", setup: () => { mocks.network = null }, code: "network_unavailable" },
  ])("$name : le refus standard, sans interroger le catalogue", ({ setup, code }) => {
    setup()
    const { result } = renderHook(() => source().useSearch({ cursor: null }))
    expect(result.current).toEqual({ status: "error", code })
    expect(mocks.loaded).not.toHaveBeenCalledWith("modules/diaspora/services:searchOffers", expect.anything())
  })

  it("un refus du domaine arrive avec son code fermé", () => {
    mocks.results.set("modules/diaspora/services:searchOffers", new ConvexError({ code: "invalidArgument", appRule: "service_country_is_home" }))
    const { result } = renderHook(() => source().useSearch({ cursor: null }))
    expect(result.current).toEqual({ status: "error", code: "service_country_is_home" })
  })

  it("attend la réponse du moteur avant de rien montrer", () => {
    const { result } = renderHook(() => source().useOffer("offer-1"))
    expect(result.current).toEqual({ status: "loading" })
  })

  it("la fiche d'une offre : indisponible, ou gérée par le lecteur", () => {
    mocks.results.set("modules/diaspora/services:getOffer", null)
    const data = source()
    const { result, rerender } = renderHook(() => data.useOffer("offer-1"))
    expect(mocks.loaded).toHaveBeenCalledWith("modules/diaspora/services:getOffer", { networkId: "network-diasporale", offerId: "offer-1" })
    expect(result.current).toEqual({ status: "ready", data: null })
    mocks.results.set("modules/diaspora/services:getOffer", DETAIL)
    rerender()
    expect(result.current).toMatchObject({ status: "ready", data: { id: "offer-1", status: "paused", viewerCanManage: true, budgetFit: null } })
  })

  it("les offres d'une page : page illisible, le refus indistinct ; sinon ses offres actives", () => {
    mocks.results.set("modules/diaspora/services:pageOffers", null)
    const data = source()
    const { result, rerender } = renderHook(() => data.usePageOffers({ pageHandle: "coiffure-paris", cursor: null }))
    expect(mocks.loaded).toHaveBeenCalledWith("modules/diaspora/services:pageOffers", { networkId: "network-diasporale", handle: "coiffure-paris", paginationOpts: { numItems: 12, cursor: null } })
    expect(result.current).toEqual({ status: "error", code: "not_found" })
    mocks.results.set("modules/diaspora/services:pageOffers", { page: [CARD], isDone: true, continueCursor: "" })
    rerender()
    expect(result.current).toMatchObject({ status: "ready", data: { items: [{ id: "offer-1" }], isDone: true } })
  })

  it("mes offres : tous les états d'une page gérée, par fenêtres de vingt", () => {
    mocks.results.set("modules/diaspora/services:myPageOffers", { page: [DETAIL], isDone: true, continueCursor: "" })
    const { result } = renderHook(() => source().useMyPageOffers({ pageId: "page-1", cursor: "curseur" }))
    expect(mocks.loaded).toHaveBeenCalledWith("modules/diaspora/services:myPageOffers", { networkId: "network-diasporale", pageId: "page-1", paginationOpts: { numItems: 20, cursor: "curseur" } })
    expect(result.current).toMatchObject({ status: "ready", data: { items: [{ id: "offer-1", status: "paused", viewerCanManage: true }] } })
  })
})

describe("services — écritures du moteur", () => {
  it("crée une offre dans le réseau DIASPORALE, langues copiées, publication explicite", async () => {
    const mutation = vi.fn().mockResolvedValue({ offerId: "offer-9", version: 1, status: "draft" })
    const result = await writer(mutation).createOffer({ ...INPUT, pageId: "page-1", publish: false })
    expect(result).toEqual({ ok: true, value: { offerId: "offer-9", version: 1, status: "draft" } })
    expect(getFunctionName(mutation.mock.calls[0]![0])).toBe("modules/diaspora/services:createOffer")
    expect(mutation.mock.calls[0]![1]).toEqual({
      networkId: "network-diasporale", pageId: "page-1", title: "Tresses", description: "Coiffure afro fictive.", category: "beauty", country: "FR",
      city: "Paris", delivery: "onsite", languages: ["fr", "en"], durationMinutes: null, pricing: { mode: "quote" }, publish: false,
    })
  })

  it("une version périmée rend le conflit fermé ; un réseau absent, son refus", async () => {
    const conflict = vi.fn().mockRejectedValue(new ConvexError({ code: "conflict", appRule: "service_offer_version_conflict", appParams: { current: 3 } }))
    expect(await writer(conflict).updateOffer({ ...INPUT, offerId: "offer-1", expectedVersion: 2 })).toEqual({ ok: false, code: "service_offer_version_conflict" })
    expect(conflict.mock.calls[0]![1]).toMatchObject({ offerId: "offer-1", expectedVersion: 2, networkId: "network-diasporale" })
    const never = vi.fn()
    expect(await writer(never, null).setOfferStatus({ offerId: "offer-1", expectedVersion: 2, status: "paused" })).toEqual({ ok: false, code: "network_unavailable" })
    expect(never).not.toHaveBeenCalled()
  })

  it("change l'état d'une offre en citant la version lue", async () => {
    const mutation = vi.fn().mockResolvedValue({ status: "withdrawn", version: 4 })
    expect(await writer(mutation).setOfferStatus({ offerId: "offer-1", expectedVersion: 3, status: "withdrawn" })).toEqual({ ok: true, value: { status: "withdrawn", version: 4 } })
    expect(getFunctionName(mutation.mock.calls[0]![0])).toBe("modules/diaspora/services:setOfferStatus")
    expect(mutation.mock.calls[0]![1]).toEqual({ networkId: "network-diasporale", offerId: "offer-1", expectedVersion: 3, status: "withdrawn" })
    const unknown = vi.fn().mockRejectedValue(new Error("trace privée"))
    expect(await writer(unknown).setOfferStatus({ offerId: "offer-1", expectedVersion: 3, status: "paused" })).toEqual({ ok: false, code: "unknown" })
  })
})
