// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import { cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEngineServiceReviews } from "./engine-service-reviews"

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
    if (name === "modules/networks/networks:getBySlug") return { value: mocks.network }
    if (name === "modules/diaspora/membership:myMembership") return { value: mocks.membership }
    return mocks.results.has(name) ? { value: mocks.results.get(name) } : {}
  },
}))

const MEMBER = { status: "declaree", capabilities: ["read_network", "publish"] }
const REVIEW = {
  reviewId: "review-1", offerId: "offer-1", pageId: "page-1", rating: 4, body: "Prestation soignée et ponctuelle.",
  proof: "booking_confirmed", version: 1, status: "active", moderation: "published",
  author: { displayName: "Membre de démonstration" }, isMine: false, canReply: true,
  reply: { replyId: "reply-1", body: "Merci pour votre retour.", version: 2, status: "active", moderation: "published", canManage: true, createdAt: 3, updatedAt: 4 },
  createdAt: 1, updatedAt: 2,
}

function client() {
  const query = vi.fn(async (_reference: unknown, _args: unknown): Promise<unknown> => mocks.network)
  const mutation = vi.fn(async (_reference: unknown, _args: unknown): Promise<unknown> => null)
  return { query, mutation, convex: { query, mutation } as unknown as ConvexReactClient }
}
function capability(convex: ConvexReactClient = client().convex) {
  return createEngineServiceReviews({ convex, authClient: {} as EngineAuthClient })
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
  mocks.network = { _id: "network-diasporale" }
  mocks.membership = { ...MEMBER }
  mocks.results.clear()
})
afterEach(cleanup)

describe("avis — fournisseur moteur", () => {
  it("borne la lecture à DIASPORALE et vingt avis, conserve sa projection et suit le curseur", () => {
    mocks.results.set("modules/diaspora/serviceReviews:offerReviews", { items: [REVIEW], continueCursor: "suite", isDone: false })
    const data = capability()
    const { result, rerender } = renderHook((props: { offerId: string; cursor: string | null }) => data.useOfferReviews(props), { initialProps: { offerId: "offer-1", cursor: null as string | null } })
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/diaspora/serviceReviews:offerReviews", { networkId: "network-diasporale", offerId: "offer-1", paginationOpts: { cursor: null, numItems: 20 } })
    const first = result.current
    expect(first).toEqual({ status: "ready", data: { items: [REVIEW], continueCursor: "suite", isDone: false } })
    rerender({ offerId: "offer-1", cursor: null })
    expect(result.current).toBe(first)
    rerender({ offerId: "offer-2", cursor: "suite" })
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/diaspora/serviceReviews:offerReviews", { networkId: "network-diasporale", offerId: "offer-2", paginationOpts: { cursor: "suite", numItems: 20 } })
    mocks.results.set("modules/diaspora/serviceReviews:offerReviews", { items: [], continueCursor: "fin", isDone: true })
    rerender({ offerId: "offer-2", cursor: "suite" })
    expect(result.current).toEqual({ status: "ready", data: { items: [], continueCursor: null, isDone: true } })
  })

  it("recopie seulement les champs du port, sans identifiants de demande, de rendez-vous, de profil ni données privées", () => {
    mocks.results.set("modules/diaspora/serviceReviews:offerReviews", { items: [{ ...REVIEW, requestId: "private-request", bookingId: "private-booking", authorPersonId: "private-person", author: { ...REVIEW.author, handle: "private-handle" }, reply: { ...REVIEW.reply, authorPersonId: "private-signatory" } }], continueCursor: "", isDone: true })
    const { result } = renderHook(() => capability().useOfferReviews({ offerId: "offer-1", cursor: null }))
    expect(result.current).toEqual({ status: "ready", data: { items: [REVIEW], continueCursor: null, isDone: true } })
    expect(JSON.stringify(result.current)).not.toContain("private-")
  })

  it.each([
    { label: "sans session", setup: () => { mocks.auth = { isAuthenticated: false, isPending: false, isUnauthenticated: true } }, code: "not_signed_in" },
    { label: "sans adhésion", setup: () => { mocks.membership = null }, code: "not_member" },
    { label: "suspendue", setup: () => { mocks.membership = { status: "suspendue", capabilities: [] } }, code: "suspended" },
    { label: "sans réseau", setup: () => { mocks.network = null }, code: "network_unavailable" },
  ])("ferme les deux lectures $label sans interroger les avis", ({ setup, code }) => {
    setup()
    const publicRead = renderHook(() => capability().useOfferReviews({ offerId: "offer-1", cursor: null }))
    const privateRead = renderHook(() => capability().useMyReview({ requestId: "request-1" }))
    expect(publicRead.result.current).toEqual({ status: "error", code })
    expect(privateRead.result.current).toEqual({ status: "error", code })
    expect(mocks.loaded.mock.calls.some(([name]) => String(name).startsWith("modules/diaspora/serviceReviews:"))).toBe(false)
  })

  it("attend l'adhésion avant d'abonner les avis et retire les données lors d'un refus", () => {
    mocks.membership = undefined
    const data = capability()
    const { result, rerender } = renderHook(() => data.useOfferReviews({ offerId: "offer-1", cursor: null }))
    expect(result.current).toEqual({ status: "loading" })
    expect(mocks.loaded.mock.calls.some(([name]) => String(name).startsWith("modules/diaspora/serviceReviews:"))).toBe(false)
    mocks.membership = MEMBER
    mocks.results.set("modules/diaspora/serviceReviews:offerReviews", { items: [REVIEW], continueCursor: "", isDone: true })
    rerender()
    expect(result.current.status).toBe("ready")
    mocks.results.set("modules/diaspora/serviceReviews:offerReviews", new ConvexError({ code: "notFound" }))
    rerender()
    expect(result.current).toEqual({ status: "error", code: "not_found" })
    mocks.auth = { isAuthenticated: false, isPending: false, isUnauthenticated: true }
    rerender()
    expect(result.current).toEqual({ status: "error", code: "not_signed_in" })
  })

  it("lit ma seule demande, conserve le refus métier, ou rend null sans exposer la demande d'autrui", () => {
    const mine = { canCreate: false, refusal: "review_booking_not_finished", proof: null, review: null }
    mocks.results.set("modules/diaspora/serviceReviews:myReviewForRequest", mine)
    const data = capability()
    const { result, rerender } = renderHook(() => data.useMyReview({ requestId: "request-1" }))
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/diaspora/serviceReviews:myReviewForRequest", { networkId: "network-diasporale", requestId: "request-1" })
    expect(result.current).toEqual({ status: "ready", data: mine })
    mocks.results.set("modules/diaspora/serviceReviews:myReviewForRequest", { canCreate: false, refusal: "review_already_exists", proof: "booking_confirmed", review: { ...REVIEW, isMine: true }, requestId: "private-request" })
    rerender()
    expect(result.current).toEqual({ status: "ready", data: { canCreate: false, refusal: "review_already_exists", proof: "booking_confirmed", review: { ...REVIEW, isMine: true } } })
    mocks.results.set("modules/diaspora/serviceReviews:myReviewForRequest", null)
    rerender()
    expect(result.current).toEqual({ status: "ready", data: null })
  })

  it("transmet toutes les écritures avec version et consentement au réseau résolu, puis les vrais identifiants de signalement", async () => {
    const { convex, mutation } = client()
    const data = capability(convex)
    mutation.mockResolvedValueOnce({ reviewId: "review-1", created: true })
    expect(await data.publish({ requestId: "request-1", rating: 4, body: REVIEW.body, consentToPublish: true })).toEqual({ ok: true, value: { reviewId: "review-1", created: true } })
    expect(await data.update({ reviewId: "review-1", expectedVersion: 1, rating: 5, body: REVIEW.body })).toEqual({ ok: true, value: null })
    await data.withdraw({ reviewId: "review-1", expectedVersion: 2 })
    await data.reply({ reviewId: "review-1", expectedVersion: null, body: REVIEW.reply.body })
    await data.reply({ reviewId: "review-1", expectedVersion: 1, body: REVIEW.reply.body })
    await data.withdrawReply({ reviewId: "review-1", expectedVersion: 2 })
    await data.report({ target: { kind: "review", id: "review-1" }, reason: "fraud" })
    await data.report({ target: { kind: "reply", id: "real-reply-7" }, reason: "harassment" })
    const networkId = "network-diasporale"
    expect(mutation.mock.calls.map(([reference, args]) => [getFunctionName(reference as never), args])).toEqual([
      ["modules/diaspora/serviceReviews:createReview", { networkId, requestId: "request-1", rating: 4, body: REVIEW.body, consentToPublish: true }],
      ["modules/diaspora/serviceReviews:updateReview", { networkId, reviewId: "review-1", expectedVersion: 1, rating: 5, body: REVIEW.body }],
      ["modules/diaspora/serviceReviews:withdrawReview", { networkId, reviewId: "review-1", expectedVersion: 2 }],
      ["modules/diaspora/serviceReviews:replyToReview", { networkId, reviewId: "review-1", expectedVersion: null, body: REVIEW.reply.body }],
      ["modules/diaspora/serviceReviews:replyToReview", { networkId, reviewId: "review-1", expectedVersion: 1, body: REVIEW.reply.body }],
      ["modules/diaspora/serviceReviews:withdrawReviewReply", { networkId, reviewId: "review-1", expectedVersion: 2 }],
      ["modules/moderation/cases:report", { networkId, target: { kind: "serviceReview", id: "review-1" }, reason: "fraud" }],
      ["modules/moderation/cases:report", { networkId, target: { kind: "serviceReviewReply", id: "real-reply-7" }, reason: "harassment" }],
    ])
  })

  it("rend des codes fermés pour les refus de règles, versions, débit, réseau et erreurs inattendues", async () => {
    const { convex, query, mutation } = client()
    const data = capability(convex)
    const input = { reviewId: "review-1", expectedVersion: 1 }
    mutation.mockRejectedValueOnce(new ConvexError({ code: "conflict", appRule: "review_version_changed", appParams: {} }))
    expect(await data.withdraw(input)).toEqual({ ok: false, code: "review_version_changed" })
    mutation.mockRejectedValueOnce(new ConvexError({ code: "policyRefused", appRule: "review_own_page", appParams: {} }))
    expect(await data.withdraw(input)).toEqual({ ok: false, code: "review_own_page" })
    mutation.mockRejectedValueOnce(new ConvexError({ code: "rateLimited", retryAfterMs: 1000 }))
    expect(await data.withdraw(input)).toEqual({ ok: false, code: "rate_limited" })
    mutation.mockRejectedValueOnce(new Error("texte privé du serveur"))
    expect(await data.withdraw(input)).toEqual({ ok: false, code: "unknown" })
    query.mockResolvedValueOnce(null)
    expect(await data.withdraw(input)).toEqual({ ok: false, code: "network_unavailable" })
  })
})
