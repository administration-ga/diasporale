// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import type { JobOfferInputView } from "@diasporale/features/data"
import { cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEngineJobs, jobSearchArgsOf } from "./engine-jobs"

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isPending: false, isUnauthenticated: false },
  network: { _id: "network-diasporale" } as unknown,
  membership: undefined as unknown,
  results: new Map<string, unknown>(),
  loaded: vi.fn(),
}))

vi.mock("@antsia/api/hooks", () => ({ useStableConvexAuth: () => mocks.auth }))
vi.mock("convex/react", () => ({
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

const MEMBER = { status: "declaree", capabilities: ["read_network", "publish", "view_directory", "appear_in_directory"], facet: { countryOfResidence: "FR" } }
const PAGE = { pageId: "page-1", networkId: "network-diasporale", handle: "traiteur-paris", name: "Traiteur Paris (fictif)", shortName: null, logoUrl: null, badge: "community", ownerKind: "company", country: "FR" }
const CARD = {
  jobId: "job-1", version: 2, title: "Cuisinier", description: "Offre fictive de recette.", contract: "cdi", country: "FR", city: "Paris",
  workMode: "onsite", languages: ["fr"], payRange: { minMinor: 200000, maxMinor: 240000, currency: "EUR", period: "month" }, closesAt: null,
  publishedAt: 5, updatedAt: 10, page: PAGE,
}
const DETAIL = { ...CARD, status: "open", viewerCanManage: false, myApplication: { applicationId: "app-1", status: "seen" } }
const MINE = {
  applicationId: "app-1", status: "seen", jobId: "job-1", offerTitle: "Cuisinier", offerVersion: 2, offerOpen: true, page: PAGE,
  message: "Motivation fictive de recette.", sharedTalentProfile: true, createdAt: 1, updatedAt: 2, actions: ["withdraw"],
}
const RECEIVED = {
  applicationId: "app-1", jobId: "job-1", status: "sent", offerVersion: 2, candidate: { displayName: "Mireille Ivindo", handle: "mireille.demo" },
  message: "Motivation fictive de recette.", talentProfile: { title: "Comptable", skills: ["Paie"], availability: "immediate", languages: ["fr"], country: "FR" },
  notSelectedReason: null, createdAt: 1, updatedAt: 1, actions: ["mark_seen", "shortlist", "not_select"],
}
const TALENT = { talentId: "talent-1", title: "Comptable", skills: ["Paie"], availability: "one_month", languages: ["fr"], country: "BE", visibility: "network", status: "active", version: 3, createdAt: 1, updatedAt: 4 }
const HIT = { talentId: "talent-2", shortName: "Prisca A.", title: "Juriste", skills: ["Droit des contrats"], availability: "immediate", languages: ["fr", "en"], country: "FR", updatedAt: 7 }
const INPUT: JobOfferInputView = {
  title: "Cuisinier", description: "Offre fictive de recette, assez longue pour le domaine.", contract: "cdi", country: "FR", city: null,
  workMode: "hybrid", languages: ["fr", "en"], payRange: { minMinor: 1000, maxMinor: 2000, currency: "EUR", period: "hour" }, closesAt: 99,
}

function source(convex: Partial<ConvexReactClient> = {}) {
  return createEngineJobs({ convex: convex as ConvexReactClient, authClient: {} as EngineAuthClient })
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

describe("emploi — lectures du moteur", () => {
  it("cherche les offres avec les seuls filtres posés, une fenêtre de douze, et projette l'employeur", () => {
    mocks.results.set("modules/diaspora/jobs:searchJobOffers", { page: [CARD], isDone: false, continueCursor: "suite" })
    const { result } = renderHook(() => source().useSearch({ query: "cuisine", city: "Paris", contract: "cdi", workMode: "onsite", cursor: null }))
    expect(mocks.loaded).toHaveBeenCalledWith("modules/diaspora/jobs:searchJobOffers", {
      networkId: "network-diasporale", query: "cuisine", city: "Paris", contract: "cdi", workMode: "onsite", paginationOpts: { numItems: 12, cursor: null },
    })
    expect(result.current).toEqual({
      status: "ready",
      data: {
        items: [{
          id: "job-1", version: 2, title: "Cuisinier", description: "Offre fictive de recette.", contract: "cdi", country: "FR", city: "Paris",
          workMode: "onsite", languages: ["fr"], payRange: { minMinor: 200000, maxMinor: 240000, currency: "EUR", period: "month" }, closesAt: null,
          publishedAt: 5, updatedAt: 10,
          employer: { id: "page-1", handle: "traiteur-paris", name: "Traiteur Paris (fictif)", ownerKind: "company", badge: "community", logoUrl: null },
        }],
        isDone: false,
        continueCursor: "suite",
      },
    })
  })

  it("n'envoie aucun filtre vide et garde la même référence tant que le moteur ne rend rien de neuf", () => {
    expect(jobSearchArgsOf({ query: "  ", city: "", cursor: null })).toEqual({})
    expect(jobSearchArgsOf({ country: "BE", workMode: "remote", cursor: "x" })).toEqual({ country: "BE", workMode: "remote" })
    mocks.results.set("modules/diaspora/jobs:searchJobOffers", { page: [CARD], isDone: true, continueCursor: "" })
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
  ])("$name : le refus standard, sans interroger le moteur", ({ setup, code }) => {
    setup()
    const { result } = renderHook(() => source().useSearch({ cursor: null }))
    expect(result.current).toEqual({ status: "error", code })
    expect(mocks.loaded).not.toHaveBeenCalledWith("modules/diaspora/jobs:searchJobOffers", expect.anything())
  })

  it("un refus du domaine arrive avec son code fermé", () => {
    mocks.results.set("modules/diaspora/jobs:searchJobOffers", new ConvexError({ code: "invalidArgument", appRule: "job_country_is_home" }))
    const { result } = renderHook(() => source().useSearch({ cursor: null }))
    expect(result.current).toEqual({ status: "error", code: "job_country_is_home" })
  })

  it("la fiche d'une offre : indisponible, ou lue avec ma candidature", () => {
    mocks.results.set("modules/diaspora/jobs:getJobOffer", null)
    const data = source()
    const { result, rerender } = renderHook(() => data.useOffer("job-1"))
    expect(mocks.loaded).toHaveBeenCalledWith("modules/diaspora/jobs:getJobOffer", { networkId: "network-diasporale", jobId: "job-1" })
    expect(result.current).toEqual({ status: "ready", data: null })
    mocks.results.set("modules/diaspora/jobs:getJobOffer", DETAIL)
    rerender()
    expect(result.current).toMatchObject({ status: "ready", data: { id: "job-1", status: "open", viewerCanManage: false, myApplication: { id: "app-1", status: "seen" } } })
  })

  it("les offres gérées d'une page, par état, par fenêtres de vingt", () => {
    mocks.results.set("modules/diaspora/jobs:pageJobOffers", { page: [{ ...DETAIL, viewerCanManage: true, myApplication: null }], isDone: true, continueCursor: "" })
    const { result } = renderHook(() => source().usePageOffers({ pageId: "page-1", status: "open", cursor: "curseur" }))
    expect(mocks.loaded).toHaveBeenCalledWith("modules/diaspora/jobs:pageJobOffers", { networkId: "network-diasporale", pageId: "page-1", status: "open", paginationOpts: { numItems: 20, cursor: "curseur" } })
    expect(result.current).toMatchObject({ status: "ready", data: { items: [{ id: "job-1", viewerCanManage: true, myApplication: null }] } })
  })

  it("mes candidatures et les candidatures reçues : jamais le motif côté personne, le nom consenti côté page", () => {
    mocks.results.set("modules/diaspora/jobs:myJobApplications", { page: [MINE], isDone: true, continueCursor: "" })
    mocks.results.set("modules/diaspora/jobs:jobOfferApplications", { page: [RECEIVED], isDone: true, continueCursor: "" })
    const mine = renderHook(() => source().useMyApplications({ cursor: null }))
    expect(mocks.loaded).toHaveBeenCalledWith("modules/diaspora/jobs:myJobApplications", { networkId: "network-diasporale", paginationOpts: { numItems: 20, cursor: null } })
    expect(mine.result.current).toMatchObject({ status: "ready", data: { items: [{ id: "app-1", status: "seen", employer: { id: "page-1" }, offerOpen: true, actions: ["withdraw"] }] } })
    const received = renderHook(() => source().useOfferApplications({ jobId: "job-1", status: "sent", cursor: null }))
    expect(mocks.loaded).toHaveBeenCalledWith("modules/diaspora/jobs:jobOfferApplications", { networkId: "network-diasporale", jobId: "job-1", status: "sent", paginationOpts: { numItems: 20, cursor: null } })
    expect(received.result.current).toMatchObject({
      status: "ready",
      data: { items: [{ id: "app-1", candidate: { displayName: "Mireille Ivindo" }, talentProfile: { title: "Comptable", country: "FR" }, notSelectedReason: null }] },
    })
  })

  it("mon profil de talent et la recherche des talents, qui exige le droit à l'annuaire", () => {
    mocks.results.set("modules/diaspora/jobs:myTalentProfile", TALENT)
    mocks.results.set("modules/diaspora/jobs:searchTalents", { page: [HIT], isDone: false, continueCursor: "suite" })
    const own = renderHook(() => source().useMyTalentProfile())
    expect(own.result.current).toEqual({ status: "ready", data: { ...TALENT, id: "talent-1", talentId: undefined } })
    const found = renderHook(() => source().useTalentSearch({ country: "FR", skill: "  ", cursor: null }))
    expect(mocks.loaded).toHaveBeenCalledWith("modules/diaspora/jobs:searchTalents", { networkId: "network-diasporale", country: "FR", paginationOpts: { numItems: 12, cursor: null } })
    expect(found.result.current).toMatchObject({ status: "ready", data: { items: [{ id: "talent-2", shortName: "Prisca A." }], isDone: false } })
    mocks.loaded.mockClear()
    mocks.membership = { ...MEMBER, capabilities: ["read_network"] }
    const refused = renderHook(() => source().useTalentSearch({ country: "FR", skill: "paie", cursor: null }))
    expect(refused.result.current).toEqual({ status: "error", code: "status_insufficient" })
    expect(mocks.loaded).not.toHaveBeenCalledWith("modules/diaspora/jobs:searchTalents", expect.anything())
  })
})

describe("emploi — écritures du moteur", () => {
  it("crée, modifie et change l'état d'une offre dans le réseau diasporale", async () => {
    const mutation = vi.fn()
      .mockResolvedValueOnce({ jobId: "job-9", version: 1, status: "draft" })
      .mockResolvedValueOnce({ version: 2 })
      .mockResolvedValueOnce({ status: "open", version: 3 })
    const data = writer(mutation)
    expect(await data.createOffer({ ...INPUT, pageId: "page-1", publish: false })).toEqual({ ok: true, value: { jobId: "job-9", version: 1, status: "draft" } })
    expect(getFunctionName(mutation.mock.calls[0]![0])).toBe("modules/diaspora/jobs:createJobOffer")
    expect(mutation.mock.calls[0]![1]).toEqual({ networkId: "network-diasporale", pageId: "page-1", ...INPUT, languages: ["fr", "en"], publish: false })
    expect(await data.updateOffer({ ...INPUT, jobId: "job-9", expectedVersion: 1 })).toEqual({ ok: true, value: { version: 2 } })
    expect(mutation.mock.calls[1]![1]).toMatchObject({ jobId: "job-9", expectedVersion: 1, city: null, closesAt: 99 })
    expect(await data.setOfferStatus({ jobId: "job-9", expectedVersion: 2, status: "open" })).toEqual({ ok: true, value: { status: "open", version: 3 } })
    expect(getFunctionName(mutation.mock.calls[2]![0])).toBe("modules/diaspora/jobs:setJobOfferStatus")
  })

  it("candidate, retire et décide ; un motif absent n'est pas envoyé", async () => {
    const mutation = vi.fn()
      .mockResolvedValueOnce({ applicationId: "app-7", created: true })
      .mockResolvedValueOnce({ status: "withdrawn" })
      .mockResolvedValueOnce({ status: "seen" })
      .mockResolvedValueOnce({ status: "shortlisted" })
      .mockResolvedValueOnce({ status: "not_selected" })
      .mockResolvedValueOnce({ status: "not_selected" })
    const data = writer(mutation)
    const apply = { jobId: "job-1", offerVersion: 2, message: "Motivation fictive de recette.", shareName: true, shareTalentProfile: false, idempotencyKey: "candidature-0123456789" }
    expect(await data.apply(apply)).toEqual({ ok: true, value: { applicationId: "app-7", created: true } })
    expect(mutation.mock.calls[0]![1]).toEqual({ networkId: "network-diasporale", ...apply })
    expect(await data.withdraw("app-7")).toEqual({ ok: true, value: { status: "withdrawn" } })
    expect(await data.markSeen("app-1")).toEqual({ ok: true, value: { status: "seen" } })
    expect(await data.shortlist("app-1")).toEqual({ ok: true, value: { status: "shortlisted" } })
    await data.markNotSelected({ applicationId: "app-1", reason: null })
    expect(mutation.mock.calls[4]![1]).toEqual({ networkId: "network-diasporale", applicationId: "app-1" })
    await data.markNotSelected({ applicationId: "app-1", reason: "Profil plus junior." })
    expect(mutation.mock.calls[5]![1]).toEqual({ networkId: "network-diasporale", applicationId: "app-1", reason: "Profil plus junior." })
    expect(mutation.mock.calls.map((call) => getFunctionName(call[0]))).toEqual([
      "modules/diaspora/jobs:applyToJobOffer",
      "modules/diaspora/jobs:withdrawJobApplication",
      "modules/diaspora/jobs:markJobApplicationSeen",
      "modules/diaspora/jobs:shortlistJobApplication",
      "modules/diaspora/jobs:markJobApplicationNotSelected",
      "modules/diaspora/jobs:markJobApplicationNotSelected",
    ])
  })

  it("enregistre, masque et supprime mon profil de talent", async () => {
    const mutation = vi.fn()
      .mockResolvedValueOnce({ talentId: "talent-1", version: 1 })
      .mockResolvedValueOnce({ status: "hidden", version: 2 })
      .mockResolvedValueOnce(null)
    const data = writer(mutation)
    const input = { title: "Comptable", skills: ["Paie"], availability: "immediate" as const, languages: ["fr" as const], country: "FR" as const, visibility: "unlisted" as const, expectedVersion: null }
    expect(await data.saveTalentProfile(input)).toEqual({ ok: true, value: { id: "talent-1", version: 1 } })
    expect(mutation.mock.calls[0]![1]).toEqual({ networkId: "network-diasporale", ...input })
    expect(await data.setTalentProfileStatus({ status: "hidden", expectedVersion: 1 })).toEqual({ ok: true, value: { status: "hidden", version: 2 } })
    expect(await data.removeTalentProfile()).toEqual({ ok: true, value: null })
    expect(getFunctionName(mutation.mock.calls[2]![0])).toBe("modules/diaspora/jobs:removeMyTalentProfile")
  })

  it("un refus du moteur devient un code fermé ; un réseau absent aussi", async () => {
    const refusing = writer(vi.fn().mockRejectedValue(new ConvexError({ code: "conflict", appRule: "job_application_already_exists" })))
    expect(await refusing.apply({ jobId: "job-1", offerVersion: 1, message: "Motivation fictive.", shareName: true, shareTalentProfile: false, idempotencyKey: "candidature-0123456789" }))
      .toEqual({ ok: false, code: "job_application_already_exists" })
    const hidden = writer(vi.fn().mockRejectedValue(new ConvexError({ code: "notFound" })))
    expect(await hidden.markSeen("app-1")).toEqual({ ok: false, code: "not_found" })
    const offline = writer(vi.fn(), null)
    expect(await offline.withdraw("app-1")).toEqual({ ok: false, code: "network_unavailable" })
  })
})
