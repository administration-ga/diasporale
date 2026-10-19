// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import { cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEngineServiceRequests } from "./engine-service-requests"

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isPending: false, isUnauthenticated: false },
  network: { _id: "network-diasporale" } as unknown,
  membership: undefined as unknown,
  results: new Map<string, unknown>(),
  loaded: vi.fn(),
}))

vi.mock("@antsia/api/hooks", () => ({
  useStableConvexAuth: () => mocks.auth,
}))

vi.mock("convex/react", () => ({
  useQueries: (queries: Record<string, { query: Parameters<typeof getFunctionName>[0]; args?: unknown }>) => {
    if (!queries.value) return {}
    const name = getFunctionName(queries.value.query)
    mocks.loaded(name, queries.value.args)
    switch (name) {
      case "modules/networks/networks:getBySlug": return { value: mocks.network }
      case "modules/diaspora/membership:myMembership": return { value: mocks.membership }
      default: return mocks.results.has(name) ? { value: mocks.results.get(name) } : {}
    }
  },
}))

const MEMBER = { status: "declaree", capabilities: ["read_network", "publish"], facet: { countryOfResidence: "FR" } }
const SUMMARY = {
  requestId: "request-1", status: "proposed", offerId: "offer-1", offerTitle: "Tresses africaines", offerVersion: 3,
  page: { pageId: "page-1", handle: "salon-test", name: "Salon de test", logoUrl: null },
  requester: null, windows: [{ startAt: 10, endAt: 20 }], timeZone: "Europe/Paris",
  currentProposal: { version: 1, amountMinor: 4500, currency: "EUR", startAt: 30, endAt: 40, timeZone: "Europe/Paris", expiresAt: 25 },
  booking: null, deadlineAt: 25, createdAt: 1, updatedAt: 2,
}
const DETAIL = {
  ...SUMMARY, viewerRole: "requester", need: "Tresses pour un mariage.",
  proposals: [{ version: 1, amountMinor: 4500, currency: "EUR", durationMinutes: 90, startAt: 30, endAt: 40, timeZone: "Europe/Paris", location: { mode: "onsite", area: "Paris 11e" }, details: "Mèches fournies.", cancellationTerms: "Libre jusqu'à la veille.", expiresAt: 25, state: "current", createdAt: 3 }],
  timeline: [{ status: "sent", at: 1, version: null }, { status: "proposed", at: 3, version: 1 }],
  closedBy: null, closedReason: null, actions: ["cancel", "accept"],
  // DG-015 : le moteur sert toujours la contestation d'une absence (aucune ici) et le droit de la déposer.
  noShowContest: null, canContestNoShow: false,
}

function client() {
  const query = vi.fn(async (_reference: unknown, _args: unknown): Promise<unknown> => mocks.network)
  const mutation = vi.fn(async (_reference: unknown, _args: unknown): Promise<unknown> => null)
  return { query, mutation, convex: { query, mutation } as unknown as ConvexReactClient }
}

function capability(convex: ConvexReactClient = client().convex) {
  return createEngineServiceRequests({ convex, authClient: {} as EngineAuthClient })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
  mocks.network = { _id: "network-diasporale" }
  mocks.membership = { ...MEMBER }
  mocks.results.clear()
})
afterEach(cleanup)

describe("demandes de service — adaptateur moteur", () => {
  it("DG-015 : conteste une absence dans DIASPORALE, motif transmis tel quel, et rend la date et la création ; une panne reste un refus fermé", async () => {
    const { mutation, convex } = client()
    mutation.mockResolvedValueOnce({ contestedAt: 1234, created: true })
    const requests = capability(convex)
    expect(await requests.contestNoShow!({ requestId: "request-1", reason: "J'étais présente à l'heure dite." })).toEqual({ ok: true, value: { contestedAt: 1234, created: true } })
    expect(mutation).toHaveBeenCalledWith(expect.anything(), { networkId: "network-diasporale", requestId: "request-1", reason: "J'étais présente à l'heure dite." })
    mutation.mockRejectedValueOnce(new Error("panne"))
    const failed = await requests.contestNoShow!({ requestId: "request-1", reason: "J'étais présente à l'heure dite." })
    expect(failed.ok).toBe(false)
  })

  it("lit mes demandes dans DIASPORALE, vingt par page, et recopie la projection", () => {
    mocks.results.set("modules/diaspora/serviceRequests:myServiceRequests", { page: [SUMMARY], isDone: false, continueCursor: "suite" })
    const { result, rerender } = renderHook((props: { cursor: string | null }) => capability().useMyRequests(props), { initialProps: { cursor: null as string | null } })
    expect(mocks.loaded).toHaveBeenCalledWith("modules/diaspora/serviceRequests:myServiceRequests", { networkId: "network-diasporale", paginationOpts: { cursor: null, numItems: 20 } })
    expect(result.current).toEqual({ status: "ready", data: { items: [SUMMARY], continueCursor: "suite", isDone: false } })
    rerender({ cursor: "suite" })
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/diaspora/serviceRequests:myServiceRequests", { networkId: "network-diasporale", paginationOpts: { cursor: "suite", numItems: 20 } })
  })

  it("rend la même projection tant que le moteur ne répond pas autre chose ; une fin de liste n'a pas de curseur", () => {
    mocks.results.set("modules/diaspora/serviceRequests:myServiceRequests", { page: [], isDone: true, continueCursor: "fin" })
    const data = capability()
    const { result, rerender } = renderHook(() => data.useMyRequests({ cursor: null }))
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
    expect(first).toEqual({ status: "ready", data: { items: [], continueCursor: null, isDone: true } })
  })

  it.each([
    { label: "sans session", setup: () => { mocks.auth = { isAuthenticated: false, isPending: false, isUnauthenticated: true } }, code: "not_signed_in" },
    { label: "sans adhésion", setup: () => { mocks.membership = null }, code: "not_member" },
    { label: "suspendue", setup: () => { mocks.membership = { ...MEMBER, status: "suspendue", capabilities: [] } }, code: "suspended" },
    { label: "sans réseau", setup: () => { mocks.network = null }, code: "network_unavailable" },
  ])("refuse la lecture $label sans interroger les demandes", ({ setup, code }) => {
    setup()
    const { result } = renderHook(() => capability().useMyRequests({ cursor: null }))
    expect(result.current).toEqual({ status: "error", code })
    expect(mocks.loaded).not.toHaveBeenCalledWith("modules/diaspora/serviceRequests:myServiceRequests", expect.anything())
  })

  it("attend le moteur, puis traduit un refus indistinct en code fermé", () => {
    const data = capability()
    const { result, rerender } = renderHook(() => data.usePageRequests({ pageId: "page-1", status: null, cursor: null }))
    expect(result.current).toEqual({ status: "loading" })
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/diaspora/serviceRequests:pageServiceRequests", { networkId: "network-diasporale", pageId: "page-1", paginationOpts: { cursor: null, numItems: 20 } })
    mocks.results.set("modules/diaspora/serviceRequests:pageServiceRequests", new ConvexError({ code: "notFound" }))
    rerender()
    expect(result.current).toEqual({ status: "error", code: "not_found" })
  })

  it("filtre la boîte d'une page par état seulement quand un état est choisi", () => {
    mocks.results.set("modules/diaspora/serviceRequests:pageServiceRequests", { page: [{ ...SUMMARY, requester: { displayName: "Awa OGOOUÉ", handle: "awa" } }], isDone: true, continueCursor: "" })
    const { result } = renderHook(() => capability().usePageRequests({ pageId: "page-1", status: "sent", cursor: "c" }))
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/diaspora/serviceRequests:pageServiceRequests", { networkId: "network-diasporale", pageId: "page-1", status: "sent", paginationOpts: { cursor: "c", numItems: 20 } })
    expect(result.current.status === "ready" && result.current.data.items[0]?.requester).toEqual({ displayName: "Awa OGOOUÉ", handle: "awa" })
  })

  it("lit une demande, détail complet, ou `null` quand elle n'est pas pour moi", () => {
    mocks.results.set("modules/diaspora/serviceRequests:getServiceRequest", DETAIL)
    const data = capability()
    const { result, rerender } = renderHook(() => data.useRequest("request-1"))
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/diaspora/serviceRequests:getServiceRequest", { networkId: "network-diasporale", requestId: "request-1" })
    expect(result.current).toEqual({ status: "ready", data: DETAIL })
    mocks.results.set("modules/diaspora/serviceRequests:getServiceRequest", { ...DETAIL, proposals: [{ ...DETAIL.proposals[0], location: { mode: "remote" } }] })
    rerender()
    expect(result.current.status === "ready" && result.current.data?.proposals[0]?.location).toEqual({ mode: "remote" })
    mocks.results.set("modules/diaspora/serviceRequests:getServiceRequest", { ...DETAIL, status: "no_show", actions: [], noShowContest: { at: 50, reason: "J'étais présente à l'heure dite." } })
    rerender()
    expect(result.current.status === "ready" && result.current.data?.noShowContest).toEqual({ at: 50, reason: "J'étais présente à l'heure dite." })
    mocks.results.set("modules/diaspora/serviceRequests:getServiceRequest", null)
    rerender()
    expect(result.current).toEqual({ status: "ready", data: null })
    mocks.membership = null
    rerender()
    expect(result.current).toEqual({ status: "error", code: "not_member" })
  })

  it("envoie la demande au réseau DIASPORALE et rend un code fermé en cas de refus", async () => {
    const { convex, query, mutation } = client()
    mutation.mockResolvedValueOnce({ requestId: "request-9", created: true })
    const data = capability(convex)
    const input = { offerId: "offer-1", offerVersion: 3, need: "Tresses pour un mariage.", windows: [{ startAt: 10, endAt: 20 }], timeZone: "Europe/Paris", shareIdentityWithPage: true, idempotencyKey: "cle-0000-0000-0000" }
    expect(await data.send(input)).toEqual({ ok: true, value: { requestId: "request-9", created: true } })
    expect(getFunctionName(query.mock.calls[0]![0] as never)).toBe("modules/networks/networks:getBySlug")
    expect(getFunctionName(mutation.mock.calls[0]![0] as never)).toBe("modules/diaspora/serviceRequests:createServiceRequest")
    expect(mutation.mock.calls[0]![1]).toEqual({ networkId: "network-diasporale", ...input })
    mutation.mockRejectedValueOnce(new ConvexError({ code: "conflict", appRule: "request_idempotency_conflict", appParams: {} }))
    expect(await data.send(input)).toEqual({ ok: false, code: "request_idempotency_conflict" })
    mutation.mockRejectedValueOnce(new ConvexError({ code: "rateLimited", retryAfterMs: 1000 }))
    expect(await data.send(input)).toEqual({ ok: false, code: "rate_limited" })
    query.mockResolvedValueOnce(null)
    expect(await data.send(input)).toEqual({ ok: false, code: "network_unavailable" })
  })

  it("propose, décline, annule, accepte et constate par les fonctions de la tranche, motif facultatif omis", async () => {
    const { convex, mutation } = client()
    const data = capability(convex)
    const calls = () => mutation.mock.calls.map(([reference, args]) => [getFunctionName(reference as never), args])
    mutation.mockResolvedValueOnce({ version: 2 })
    const proposal = { requestId: "request-1", expectedVersion: 1, amountMinor: 5000, currency: "EUR", durationMinutes: 60, startAt: 30, timeZone: "Europe/Paris", location: { mode: "onsite" as const, area: "Paris 11e" }, details: "Mèches fournies.", cancellationTerms: "Libre.", expiresAt: 25 }
    expect(await data.propose(proposal)).toEqual({ ok: true, value: { version: 2 } })
    mutation.mockResolvedValueOnce({ version: 3 })
    await data.propose({ ...proposal, location: { mode: "remote" } })
    expect(await data.refuse({ requestId: "request-1", reason: null })).toEqual({ ok: true, value: null })
    expect(await data.cancel({ requestId: "request-1", reason: "Empêchement" })).toEqual({ ok: true, value: null })
    await data.cancel({ requestId: "request-1", reason: null })
    await data.refuse({ requestId: "request-1", reason: "Complet" })
    mutation.mockResolvedValueOnce({ bookingId: "booking-1" })
    expect(await data.accept({ requestId: "request-1", expectedProposalVersion: 2 })).toEqual({ ok: true, value: { bookingId: "booking-1" } })
    expect(await data.complete("request-1")).toEqual({ ok: true, value: null })
    expect(await data.markNoShow("request-1")).toEqual({ ok: true, value: null })
    const networkId = "network-diasporale"
    expect(calls()).toEqual([
      ["modules/diaspora/serviceRequests:proposeService", { networkId, ...proposal }],
      ["modules/diaspora/serviceRequests:proposeService", { networkId, ...proposal, location: { mode: "remote" } }],
      ["modules/diaspora/serviceRequests:refuseServiceRequest", { networkId, requestId: "request-1" }],
      ["modules/diaspora/serviceRequests:cancelServiceRequest", { networkId, requestId: "request-1", reason: "Empêchement" }],
      ["modules/diaspora/serviceRequests:cancelServiceRequest", { networkId, requestId: "request-1" }],
      ["modules/diaspora/serviceRequests:refuseServiceRequest", { networkId, requestId: "request-1", reason: "Complet" }],
      ["modules/diaspora/serviceRequests:acceptServiceProposal", { networkId, requestId: "request-1", expectedProposalVersion: 2 }],
      ["modules/diaspora/serviceRequests:completeServiceBooking", { networkId, requestId: "request-1" }],
      ["modules/diaspora/serviceRequests:markServiceNoShow", { networkId, requestId: "request-1" }],
    ])
    mutation.mockRejectedValueOnce(new ConvexError({ code: "conflict", appRule: "proposal_version_changed", appParams: {} }))
    expect(await data.accept({ requestId: "request-1", expectedProposalVersion: 1 })).toEqual({ ok: false, code: "proposal_version_changed" })
    mutation.mockRejectedValueOnce(new ConvexError({ code: "policyRefused", appRule: "booking_not_started", appParams: {} }))
    expect(await data.complete("request-1")).toEqual({ ok: false, code: "booking_not_started" })
  })
})
