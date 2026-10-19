// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import { cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEngineMentoring } from "./engine-mentoring"

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
const CARD = {
  mentorId: "mentor-1", personId: "person-awa", displayName: "Awa OGOOUÉ", handle: "awa", badges: ["verified"], country: "FR",
  city: null, arrivedAt: null, domains: ["housing", "admin"], languages: ["fr"], acceptsRequests: true,
}
const DETAIL = { ...CARD, presentation: "J'aide les nouveaux venus à se loger.", availability: "Le soir", state: "active", isSelf: false, viewerRequest: { requestId: "request-1", status: "sent" } }
const MY_PROFILE = {
  mentorId: "mentor-1", state: "active", domains: ["housing"], presentation: "J'aide les nouveaux venus à se loger.", languages: ["fr"], country: "FR",
  city: "Paris 11e", availability: "Le soir", maxActiveMentees: 2, activeMentees: 1, pendingRequests: 3, version: 4, optedInAt: 1, updatedAt: 2,
}
const SUMMARY = {
  requestId: "request-1", status: "sent", viewerRole: "mentee", mentorId: "mentor-1", counterpart: { displayName: "Awa OGOOUÉ", handle: "awa" },
  domain: "housing", goal: "Trouver un logement", wishedSlots: [{ startAt: 10, endAt: 20 }], timeZone: "Europe/Paris", slot: null,
  deadlineAt: 30, createdAt: 1, updatedAt: 2,
}
const REQUEST_DETAIL = {
  ...SUMMARY, message: "Je cherche des conseils pour me loger.", slotVersion: 0, acceptedAt: null, closedBy: null, closedReason: null, closedAt: null, actions: ["cancel"],
}

function client() {
  const query = vi.fn(async (_reference: unknown, _args: unknown): Promise<unknown> => mocks.network)
  const mutation = vi.fn(async (_reference: unknown, _args: unknown): Promise<unknown> => null)
  return { query, mutation, convex: { query, mutation } as unknown as ConvexReactClient }
}

function capability(convex: ConvexReactClient = client().convex) {
  return createEngineMentoring({ convex, authClient: {} as EngineAuthClient })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
  mocks.network = { _id: "network-diasporale" }
  mocks.membership = { ...MEMBER }
  mocks.results.clear()
})
afterEach(cleanup)

describe("mentorat — adaptateur moteur", () => {
  it("cherche dans DIASPORALE par pays, puis par domaine, douze par page, et recopie la projection", () => {
    mocks.results.set("modules/diaspora/mentoring:searchMentors", { page: [CARD], isDone: false, continueCursor: "suite" })
    const { result, rerender } = renderHook((props: { domain: "housing" | null; cursor: string | null }) => capability().useSearch({ country: "FR", ...props }), {
      initialProps: { domain: null as "housing" | null, cursor: null as string | null },
    })
    expect(mocks.loaded).toHaveBeenCalledWith("modules/diaspora/mentoring:searchMentors", { networkId: "network-diasporale", country: "FR", paginationOpts: { cursor: null, numItems: 12 } })
    expect(result.current).toEqual({ status: "ready", data: { items: [CARD], continueCursor: "suite", isDone: false } })
    rerender({ domain: "housing", cursor: "suite" })
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/diaspora/mentoring:searchMentors", { networkId: "network-diasporale", country: "FR", domain: "housing", paginationOpts: { cursor: "suite", numItems: 12 } })
  })

  it("rend la même projection tant que le moteur ne répond pas autre chose ; une fin de liste n'a pas de curseur", () => {
    mocks.results.set("modules/diaspora/mentoring:menteeMentoringRequests", { page: [SUMMARY], isDone: true, continueCursor: "fin" })
    const data = capability()
    const { result, rerender } = renderHook(() => data.useMenteeRequests({ cursor: null }))
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
    expect(first).toEqual({ status: "ready", data: { items: [SUMMARY], continueCursor: null, isDone: true } })
    expect(mocks.loaded).toHaveBeenCalledWith("modules/diaspora/mentoring:menteeMentoringRequests", { networkId: "network-diasporale", paginationOpts: { cursor: null, numItems: 20 } })
  })

  it.each([
    { label: "sans session", setup: () => { mocks.auth = { isAuthenticated: false, isPending: false, isUnauthenticated: true } }, code: "not_signed_in" },
    { label: "sans adhésion", setup: () => { mocks.membership = null }, code: "not_member" },
    { label: "suspendue", setup: () => { mocks.membership = { ...MEMBER, status: "suspendue", capabilities: [] } }, code: "suspended" },
    { label: "sans réseau", setup: () => { mocks.network = null }, code: "network_unavailable" },
  ])("refuse la lecture $label sans interroger le mentorat", ({ setup, code }) => {
    setup()
    const { result } = renderHook(() => capability().useSearch({ country: "FR", domain: null, cursor: null }))
    expect(result.current).toEqual({ status: "error", code })
    expect(mocks.loaded).not.toHaveBeenCalledWith("modules/diaspora/mentoring:searchMentors", expect.anything())
  })

  it("lit mon profil, une fiche de mentor et une demande, ou `null` ; traduit un refus indistinct", () => {
    const data = capability()
    const mine = renderHook(() => data.useMyProfile())
    expect(mine.result.current).toEqual({ status: "loading" })
    mocks.results.set("modules/diaspora/mentoring:myMentorProfile", MY_PROFILE)
    mine.rerender()
    expect(mine.result.current).toEqual({ status: "ready", data: MY_PROFILE })
    mocks.results.set("modules/diaspora/mentoring:myMentorProfile", null)
    mine.rerender()
    expect(mine.result.current).toEqual({ status: "ready", data: null })

    mocks.results.set("modules/diaspora/mentoring:getMentorProfile", DETAIL)
    const profile = renderHook(() => data.useMentor("mentor-1"))
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/diaspora/mentoring:getMentorProfile", { networkId: "network-diasporale", mentorId: "mentor-1" })
    expect(profile.result.current).toEqual({ status: "ready", data: DETAIL })
    mocks.results.set("modules/diaspora/mentoring:getMentorProfile", { ...DETAIL, viewerRequest: null })
    profile.rerender()
    expect(profile.result.current.status === "ready" && profile.result.current.data?.viewerRequest).toBeNull()

    mocks.results.set("modules/diaspora/mentoring:getMentoringRequest", { ...REQUEST_DETAIL, slot: { startAt: 40, endAt: 50, timeZone: "Europe/Paris", proposedAt: 5 } })
    const request = renderHook(() => data.useRequest("request-1"))
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/diaspora/mentoring:getMentoringRequest", { networkId: "network-diasporale", requestId: "request-1" })
    expect(request.result.current).toEqual({ status: "ready", data: { ...REQUEST_DETAIL, slot: { startAt: 40, endAt: 50, timeZone: "Europe/Paris", proposedAt: 5 } } })
    mocks.results.set("modules/diaspora/mentoring:getMentoringRequest", new ConvexError({ code: "notFound" }))
    request.rerender()
    expect(request.result.current).toEqual({ status: "error", code: "not_found" })
  })

  it("filtre les demandes reçues par état seulement quand un état est choisi", () => {
    mocks.results.set("modules/diaspora/mentoring:mentorMentoringRequests", { page: [{ ...SUMMARY, viewerRole: "mentor" }], isDone: true, continueCursor: "" })
    const { result, rerender } = renderHook((props: { status: "sent" | null }) => capability().useMentorRequests({ ...props, cursor: null }), { initialProps: { status: null as "sent" | null } })
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/diaspora/mentoring:mentorMentoringRequests", { networkId: "network-diasporale", paginationOpts: { cursor: null, numItems: 20 } })
    expect(result.current.status === "ready" && result.current.data.items[0]?.viewerRole).toBe("mentor")
    rerender({ status: "sent" })
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/diaspora/mentoring:mentorMentoringRequests", { networkId: "network-diasporale", status: "sent", paginationOpts: { cursor: null, numItems: 20 } })
  })

  it("écrit le profil de mentor dans DIASPORALE et rend un code fermé en cas de refus", async () => {
    const { convex, query, mutation } = client()
    const data = capability(convex)
    const profile = { domains: ["housing" as const], presentation: "J'aide les nouveaux venus à se loger.", languages: ["fr"], country: "FR" as const, city: null, availability: "Le soir", maxActiveMentees: 2 }
    mutation.mockResolvedValueOnce({ mentorId: "mentor-9", version: 1 })
    expect(await data.becomeMentor({ ...profile, consent: true })).toEqual({ ok: true, value: { mentorId: "mentor-9", version: 1 } })
    expect(getFunctionName(query.mock.calls[0]![0] as never)).toBe("modules/networks/networks:getBySlug")
    expect(getFunctionName(mutation.mock.calls[0]![0] as never)).toBe("modules/diaspora/mentoring:becomeMentor")
    expect(mutation.mock.calls[0]![1]).toEqual({ networkId: "network-diasporale", ...profile, consent: true })
    mutation.mockResolvedValueOnce({ version: 5 })
    expect(await data.updateProfile({ ...profile, expectedVersion: 4 })).toEqual({ ok: true, value: { version: 5 } })
    expect(mutation.mock.calls[1]![1]).toEqual({ networkId: "network-diasporale", expectedVersion: 4, ...profile })
    mutation.mockResolvedValueOnce({ state: "paused", version: 6 })
    expect(await data.setState({ expectedVersion: 5, state: "paused" })).toEqual({ ok: true, value: { state: "paused", version: 6 } })
    expect(getFunctionName(mutation.mock.calls[2]![0] as never)).toBe("modules/diaspora/mentoring:setMentorState")
    mutation.mockRejectedValueOnce(new ConvexError({ code: "conflict", appRule: "mentor_profile_version_changed", appParams: {} }))
    expect(await data.setState({ expectedVersion: 5, state: "active" })).toEqual({ ok: false, code: "mentor_profile_version_changed" })
    mutation.mockRejectedValueOnce(new ConvexError({ code: "statusInsufficient" }))
    expect(await data.becomeMentor({ ...profile, consent: true })).toEqual({ ok: false, code: "status_insufficient" })
    query.mockResolvedValueOnce(null)
    expect(await data.becomeMentor({ ...profile, consent: true })).toEqual({ ok: false, code: "network_unavailable" })
  })

  it("demande, retire, accepte, décline, propose un créneau et clôt par les fonctions de la tranche, motif facultatif omis", async () => {
    const { convex, mutation } = client()
    const data = capability(convex)
    const calls = () => mutation.mock.calls.map(([reference, args]) => [getFunctionName(reference as never), args])
    const input = {
      mentorId: "mentor-1", domain: "housing" as const, goal: "Trouver un logement", message: "Je cherche des conseils pour me loger.",
      wishedSlots: [{ startAt: 10, endAt: 20 }], timeZone: "Europe/Paris", shareWithMentor: true, idempotencyKey: "cle-de-test-000001",
    }
    mutation.mockResolvedValueOnce({ requestId: "request-9", created: true })
    expect(await data.request(input)).toEqual({ ok: true, value: { requestId: "request-9", created: true } })
    expect(await data.cancel({ requestId: "request-9", reason: null })).toEqual({ ok: true, value: null })
    mutation.mockResolvedValueOnce({ slotVersion: 1 })
    expect(await data.accept({ requestId: "request-1", slot: { startAt: 40, endAt: 50, timeZone: "Europe/Paris" } })).toEqual({ ok: true, value: { slotVersion: 1 } })
    mutation.mockResolvedValueOnce({ slotVersion: 0 })
    await data.accept({ requestId: "request-2", slot: null })
    expect(await data.decline({ requestId: "request-3", reason: "Indisponible" })).toEqual({ ok: true, value: null })
    mutation.mockResolvedValueOnce({ slotVersion: 2 })
    expect(await data.proposeSlot({ requestId: "request-1", expectedSlotVersion: 1, slot: { startAt: 60, endAt: 70, timeZone: "America/Toronto" } })).toEqual({ ok: true, value: { slotVersion: 2 } })
    expect(await data.close({ requestId: "request-1", reason: "Merci" })).toEqual({ ok: true, value: null })
    const networkId = "network-diasporale"
    expect(calls()).toEqual([
      ["modules/diaspora/mentoring:requestMentoring", { networkId, ...input }],
      ["modules/diaspora/mentoring:cancelMentoringRequest", { networkId, requestId: "request-9" }],
      ["modules/diaspora/mentoring:acceptMentoringRequest", { networkId, requestId: "request-1", slot: { startAt: 40, endAt: 50, timeZone: "Europe/Paris" } }],
      ["modules/diaspora/mentoring:acceptMentoringRequest", { networkId, requestId: "request-2" }],
      ["modules/diaspora/mentoring:declineMentoringRequest", { networkId, requestId: "request-3", reason: "Indisponible" }],
      ["modules/diaspora/mentoring:proposeMentoringSlot", { networkId, requestId: "request-1", expectedSlotVersion: 1, startAt: 60, endAt: 70, timeZone: "America/Toronto" }],
      ["modules/diaspora/mentoring:closeMentorship", { networkId, requestId: "request-1", reason: "Merci" }],
    ])
    mutation.mockRejectedValueOnce(new ConvexError({ code: "conflict", appRule: "mentoring_capacity_reached", appParams: {} }))
    expect(await data.accept({ requestId: "request-4", slot: null })).toEqual({ ok: false, code: "mentoring_capacity_reached" })
    mutation.mockRejectedValueOnce(new ConvexError({ code: "invalidArgument", appRule: "mentoring_consent_required", appParams: {} }))
    expect(await data.request({ ...input, shareWithMentor: false })).toEqual({ ok: false, code: "mentoring_consent_required" })
    mutation.mockRejectedValueOnce(new ConvexError({ code: "rateLimited", retryAfterMs: 1000 }))
    expect(await data.request(input)).toEqual({ ok: false, code: "rate_limited" })
  })
})
