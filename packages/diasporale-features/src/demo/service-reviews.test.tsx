// @vitest-environment jsdom
import { LIGHT_ACCOUNT_GROUNDS } from "@diasporale/domain"
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { SendServiceRequestInput } from "../data/service-requests-port"
import type { Loadable } from "../data/types"
import { demoPageAdminContext } from "./page-admin"
import { createDemoServiceRequestsContext } from "./service-requests"
import { createDemoServiceReviews, DEMO_SERVICE_REVIEWS_STORAGE_KEY, type DemoServiceReviewsState } from "./service-reviews"
import type { DemoOfferRef } from "./services"
import { createDemoSeed, type DemoState } from "./state"
import { DemoStore } from "./store"

const HOUR = 60 * 60_000
const DAY = 24 * HOUR
const NOW = Date.UTC(2026, 9, 18, 10)
const START = NOW + DAY + HOUR
const END = START + HOUR
const BODY = "La prestation correspondait à la proposition convenue."
const REPLY = "Merci pour votre retour détaillé."
let clock = NOW

class MemoryStorage {
  readonly items = new Map<string, string>()
  getItem(key: string) { return this.items.get(key) ?? null }
  setItem(key: string, value: string) { this.items.set(key, value) }
  removeItem(key: string) { this.items.delete(key) }
}
function ready<T>(query: Loadable<T>): T {
  if (query.status !== "ready") throw new Error(`lecture non prête : ${JSON.stringify(query)}`)
  return query.data
}
async function as(store: DemoStore, personId: string) {
  await act(async () => { await store.switchTo(personId) })
}
function setup(options: { readonly state?: Partial<DemoState>; readonly storage?: MemoryStorage; readonly requestsStorage?: MemoryStorage } = {}) {
  const seed: DemoState = { ...createDemoSeed(NOW), session: { personId: "p-prisca" }, ...options.state }
  const mainStorage = new MemoryStorage()
  mainStorage.getItem = () => JSON.stringify(seed)
  const store = new DemoStore(mainStorage, () => clock, 0)
  const offers = new Map<string, DemoOfferRef>([["offer-test", { id: "offer-test", title: "Prestation (démo)", version: 1, status: "active", pageId: "page-saveurs", pageHandle: "saveurs-okoume-demo", pageName: "Saveurs d'Okoumé (démo)" }]])
  const findOffer = (id: string) => offers.get(id) ?? null
  const requestsStorage = options.requestsStorage ?? new MemoryStorage()
  const storage = options.storage ?? new MemoryStorage()
  const teams = demoPageAdminContext(store)
  const requests = createDemoServiceRequestsContext(store, { findOffer, storage: requestsStorage, signatoriesOf: teams.signatoriesOf, subscribeSignatories: teams.subscribe, getSignatoriesVersion: teams.getVersion })
  const deps = { requests, teams, findOffer, storage }
  const reviews = createDemoServiceReviews(store, deps)
  return { store, requests, reviews, storage, requestsStorage, deps, offers }
}
type Setup = ReturnType<typeof setup>
function sendInput(iteration = 0): SendServiceRequestInput {
  return { offerId: "offer-test", offerVersion: 1, need: "Une prestation pour notre rencontre associative.", windows: [{ startAt: clock + DAY, endAt: clock + DAY + 4 * HOUR }], timeZone: "Europe/Paris", shareIdentityWithPage: true, idempotencyKey: `2b4a7a0e-6a52-4c8e-9a52-${String(iteration).padStart(12, "0")}` }
}
async function requestSent(context: Setup, iteration = 0) {
  const result = await context.requests.capability.send(sendInput(iteration))
  if (!result.ok) throw new Error(result.code)
  return result.value.requestId
}
async function booking(context: Setup, completed = false, iteration = 0) {
  const startAt = clock + DAY + HOUR
  const expiresAt = clock + 12 * HOUR
  const requestId = await requestSent(context, iteration)
  await as(context.store, "p-mireille")
  const proposed = await context.requests.capability.propose({ requestId, expectedVersion: 0, amountMinor: 4500, currency: "EUR", durationMinutes: 60, startAt, timeZone: "Europe/Paris", location: { mode: "remote" }, details: "Prestation à distance.", cancellationTerms: "Annulation libre la veille.", expiresAt })
  if (!proposed.ok) throw new Error(proposed.code)
  await as(context.store, "p-prisca")
  const accepted = await context.requests.capability.accept({ requestId, expectedProposalVersion: 1 })
  if (!accepted.ok) throw new Error(accepted.code)
  if (completed) {
    clock = startAt + HOUR
    await as(context.store, "p-mireille")
    const result = await context.requests.capability.complete(requestId)
    if (!result.ok) throw new Error(result.code)
    await as(context.store, "p-prisca")
  }
  return requestId
}
async function publish(context: Setup, requestId: string) {
  const result = await context.reviews.publish({ requestId, rating: 4, body: BODY, consentToPublish: true })
  if (!result.ok) throw new Error(result.code)
  return result.value.reviewId
}
function stored(context: Setup): DemoServiceReviewsState {
  return JSON.parse(context.storage.getItem(DEMO_SERVICE_REVIEWS_STORAGE_KEY) ?? "null") as DemoServiceReviewsState
}
/** Jeu de test publié : aucune fonction d'approbation n'existe dans le fournisseur de démonstration. */
function publishedFixture(context: Setup) {
  const state = stored(context)
  context.storage.setItem(DEMO_SERVICE_REVIEWS_STORAGE_KEY, JSON.stringify({ ...state, reviews: state.reviews.map((row) => ({ ...row, moderation: "published" })) }))
  return createDemoServiceReviews(context.store, context.deps)
}
beforeEach(() => { clock = NOW })
afterEach(cleanup)

describe("avis — fournisseur de démonstration", () => {
  it("relit le véritable rendez-vous démo et refuse avant sa fin, sans inventer de prestation", async () => {
    const context = setup()
    const requestId = await requestSent(context)
    const mine = renderHook(() => context.reviews.useMyReview({ requestId }))
    expect(ready(mine.result.current)).toMatchObject({ canCreate: false, refusal: "review_booking_required", proof: null, review: null })
    expect(await context.reviews.publish({ requestId, rating: 4, body: BODY, consentToPublish: true })).toEqual({ ok: false, code: "review_booking_required" })
    const another = setup()
    const confirmed = await booking(another)
    const personal = renderHook(() => another.reviews.useMyReview({ requestId: confirmed }))
    expect(ready(personal.result.current)).toMatchObject({ canCreate: false, refusal: "review_booking_not_finished" })
    expect(await another.reviews.publish({ requestId: confirmed, rating: 4, body: BODY, consentToPublish: true })).toEqual({ ok: false, code: "review_booking_not_finished" })
    clock = END
    await as(another.store, "p-prisca")
    expect(ready(personal.result.current)).toMatchObject({ canCreate: true, refusal: null, proof: "booking_confirmed" })
    expect(another.requests.findReviewRequest(confirmed)?.status).toBe("confirmed")
  })

  it("garde l'avis consenti en attente et privé à l'auteur, avec une projection sans références privées", async () => {
    const context = setup()
    const requestId = await booking(context, true)
    const mine = renderHook(() => context.reviews.useMyReview({ requestId }))
    const list = renderHook(() => context.reviews.useOfferReviews({ offerId: "offer-test", cursor: null }))
    let reviewId = ""
    await act(async () => { reviewId = await publish(context, requestId) })
    expect(ready(mine.result.current)).toMatchObject({ canCreate: false, refusal: "review_already_exists", proof: "completion_declared", review: { reviewId, body: BODY, rating: 4, version: 1, status: "active", moderation: "pending_review", isMine: true } })
    expect(ready(list.result.current).items).toEqual([])
    const projection = ready(mine.result.current)?.review
    expect(projection).not.toHaveProperty("requestId")
    expect(projection).not.toHaveProperty("bookingId")
    expect(projection).not.toHaveProperty("authorId")
    expect(projection?.author).not.toHaveProperty("handle")
    expect(stored(context).reviews[0]?.consentToPublishAt).toBe(END)
    await as(context.store, "p-mireille")
    expect(ready(mine.result.current)).toBeNull()
    expect(ready(list.result.current).items).toEqual([])
    expect(await context.reviews.reply({ reviewId, expectedVersion: null, body: REPLY })).toEqual({ ok: false, code: "not_found" })
    await as(context.store, "p-steeve")
    expect(await context.reviews.publish({ requestId, rating: 5, body: BODY, consentToPublish: true })).toEqual({ ok: false, code: "not_found" })
  })

  it("rejoue un avis identique normalisé, refuse un deuxième corps, et ne recrée jamais un avis retiré", async () => {
    const context = setup()
    const requestId = await booking(context, true)
    const reviewId = await publish(context, requestId)
    expect(await context.reviews.publish({ requestId, rating: 4, body: `  ${BODY}\n`, consentToPublish: true })).toEqual({ ok: true, value: { reviewId, created: false } })
    expect(await context.reviews.publish({ requestId, rating: 5, body: BODY, consentToPublish: true })).toEqual({ ok: false, code: "review_already_exists" })
    expect(await context.reviews.withdraw({ reviewId, expectedVersion: 1 })).toEqual({ ok: true, value: null })
    expect(await context.reviews.publish({ requestId, rating: 4, body: BODY, consentToPublish: true })).toEqual({ ok: false, code: "review_withdrawn" })
    const mine = renderHook(() => context.reviews.useMyReview({ requestId }))
    expect(ready(mine.result.current)).toMatchObject({ refusal: "review_withdrawn", canCreate: false, review: { body: "", status: "withdrawn", version: 2, author: { displayName: null } } })
    expect(stored(context).reviews).toHaveLength(1)
  })

  it("valide consentement, note, commentaire et coordonnées avec les mêmes règles du domaine", async () => {
    const context = setup()
    const requestId = await booking(context, true)
    const input = { requestId, rating: 4, body: BODY, consentToPublish: true }
    expect(await context.reviews.publish({ ...input, consentToPublish: false })).toEqual({ ok: false, code: "review_consent_required" })
    expect(await context.reviews.publish({ ...input, rating: 1.5 })).toEqual({ ok: false, code: "review_rating_invalid" })
    expect(await context.reviews.publish({ ...input, body: "court" })).toEqual({ ok: false, code: "review_body_too_short" })
    expect(await context.reviews.publish({ ...input, body: `${BODY} 06 12 34 56 78` })).toEqual({ ok: false, code: "review_contact_forbidden" })
    expect(await context.reviews.publish({ ...input, body: `${BODY} 12 rue des Fleurs` })).toEqual({ ok: false, code: "review_address_forbidden" })
  })

  it("réserve édition et retrait à l'auteur, cite la version et replace une édition en attente", async () => {
    const context = setup()
    const requestId = await booking(context, true)
    const reviewId = await publish(context, requestId)
    const reviews = publishedFixture(context)
    await as(context.store, "p-steeve")
    expect(await reviews.update({ reviewId, expectedVersion: 1, rating: 5, body: BODY })).toEqual({ ok: false, code: "not_found" })
    expect(await reviews.withdraw({ reviewId, expectedVersion: 1 })).toEqual({ ok: false, code: "not_found" })
    await as(context.store, "p-prisca")
    expect(await reviews.update({ reviewId, expectedVersion: 2, rating: 5, body: BODY })).toEqual({ ok: false, code: "review_version_changed" })
    expect(await reviews.update({ reviewId, expectedVersion: 1, rating: 5, body: BODY })).toEqual({ ok: true, value: null })
    expect(stored(context).reviews[0]).toMatchObject({ version: 2, moderation: "pending_review", rating: 5 })
    expect(await reviews.withdraw({ reviewId, expectedVersion: 1 })).toEqual({ ok: false, code: "review_version_changed" })
    expect(await reviews.withdraw({ reviewId, expectedVersion: 2 })).toEqual({ ok: true, value: null })
    expect(await reviews.update({ reviewId, expectedVersion: 3, rating: 4, body: BODY })).toEqual({ ok: false, code: "review_withdrawn" })
  })

  it("n'accorde la réponse qu'à l'équipe vivante ; la réponse en attente ne parvient pas au demandeur", async () => {
    const context = setup()
    const requestId = await booking(context, true)
    const reviewId = await publish(context, requestId)
    const reviews = publishedFixture(context)
    const list = renderHook(() => reviews.useOfferReviews({ offerId: "offer-test", cursor: null }))
    expect(await reviews.reply({ reviewId, expectedVersion: null, body: REPLY })).toEqual({ ok: false, code: "not_found" })
    await as(context.store, "p-mireille")
    expect(ready(list.result.current).items[0]?.canReply).toBe(true)
    expect(await reviews.reply({ reviewId, expectedVersion: 1, body: REPLY })).toEqual({ ok: false, code: "review_version_changed" })
    await act(async () => { expect(await reviews.reply({ reviewId, expectedVersion: null, body: REPLY })).toEqual({ ok: true, value: null }) })
    expect(ready(list.result.current).items[0]).toMatchObject({ canReply: true, reply: { body: REPLY, moderation: "pending_review", canManage: true, version: 1 } })
    await as(context.store, "p-prisca")
    const mine = renderHook(() => reviews.useMyReview({ requestId }))
    expect(ready(list.result.current).items[0]?.reply).toBeNull()
    expect(ready(mine.result.current)?.review?.reply).toBeNull()
    await as(context.store, "p-steeve")
    expect(await reviews.reply({ reviewId, expectedVersion: 1, body: REPLY })).toEqual({ ok: false, code: "not_found" })
    await as(context.store, "p-mireille")
    expect(await reviews.reply({ reviewId, expectedVersion: 9, body: REPLY })).toEqual({ ok: false, code: "review_version_changed" })
    await act(async () => { await reviews.reply({ reviewId, expectedVersion: 1, body: `${REPLY} À bientôt.` }) })
    expect(ready(list.result.current).items[0]).toMatchObject({ canReply: true, reply: { version: 2, canManage: true } })
    expect(await reviews.withdrawReply({ reviewId, expectedVersion: 1 })).toEqual({ ok: false, code: "review_version_changed" })
    await act(async () => { await reviews.withdrawReply({ reviewId, expectedVersion: 2 }) })
    expect(ready(list.result.current).items[0]).toMatchObject({ canReply: false, reply: { body: "", status: "withdrawn", version: 3, canManage: false } })
    expect(await reviews.reply({ reviewId, expectedVersion: null, body: REPLY })).toEqual({ ok: false, code: "review_version_changed" })
    expect(await reviews.reply({ reviewId, expectedVersion: 3, body: REPLY })).toEqual({ ok: false, code: "review_reply_unavailable" })
  })

  it.each(["withdrawn", "removed"] as const)("ne livre ni nom ni réponse pour un avis %s, même dans la lecture personnelle", async (state) => {
    const context = setup()
    const requestId = await booking(context, true)
    const reviewId = await publish(context, requestId)
    const reviews = publishedFixture(context)
    await as(context.store, "p-mireille")
    await reviews.reply({ reviewId, expectedVersion: null, body: REPLY })
    const fixture = stored(context)
    context.storage.setItem(DEMO_SERVICE_REVIEWS_STORAGE_KEY, JSON.stringify({
      ...fixture,
      reviews: fixture.reviews.map((row) => ({ ...row, status: state === "withdrawn" ? "withdrawn" : "active", moderation: state === "removed" ? "removed" : "published" })),
      replies: fixture.replies.map((row) => ({ ...row, moderation: "published" })),
    }))
    const redacted = createDemoServiceReviews(context.store, context.deps)
    await as(context.store, "p-prisca")
    const mine = renderHook(() => redacted.useMyReview({ requestId }))
    expect(ready(mine.result.current)?.review).toMatchObject({ body: "", author: { displayName: null }, reply: null, canReply: false })
    const list = renderHook(() => redacted.useOfferReviews({ offerId: "offer-test", cursor: null }))
    expect(ready(list.result.current).items).toEqual([])
  })

  it("n'accorde ni édition ni nouvelle réponse après retrait par la modération", async () => {
    const context = setup()
    const requestId = await booking(context, true)
    const reviewId = await publish(context, requestId)
    const reviews = publishedFixture(context)
    await as(context.store, "p-mireille")
    await reviews.reply({ reviewId, expectedVersion: null, body: REPLY })
    const fixture = stored(context)
    context.storage.setItem(DEMO_SERVICE_REVIEWS_STORAGE_KEY, JSON.stringify({ ...fixture, replies: fixture.replies.map((row) => ({ ...row, moderation: "removed" })) }))
    const removed = createDemoServiceReviews(context.store, context.deps)
    const list = renderHook(() => removed.useOfferReviews({ offerId: "offer-test", cursor: null }))
    expect(ready(list.result.current).items[0]).toMatchObject({ canReply: false, reply: null })
    expect(await removed.reply({ reviewId, expectedVersion: 1, body: REPLY })).toEqual({ ok: false, code: "review_not_published" })
    expect(await removed.reply({ reviewId, expectedVersion: null, body: REPLY })).toEqual({ ok: false, code: "review_version_changed" })
  })

  it.each(["draft", "paused", "withdrawn"] as const)("ferme la liste des avis d'une offre %s", async (status) => {
    const context = setup()
    const requestId = await booking(context, true)
    await publish(context, requestId)
    const reviews = publishedFixture(context)
    const list = renderHook(() => reviews.useOfferReviews({ offerId: "offer-test", cursor: null }))
    expect(ready(list.result.current).items).toHaveLength(1)
    context.offers.set("offer-test", { ...context.offers.get("offer-test")!, status })
    await as(context.store, "p-prisca")
    expect(list.result.current).toEqual({ status: "error", code: "not_found" })
    const mine = renderHook(() => reviews.useMyReview({ requestId }))
    expect(ready(mine.result.current)?.review).not.toBeNull()
  })

  it("réagit au retrait du rôle de page sans changer de compte ni conserver un droit de réponse", async () => {
    const context = setup()
    const requestId = await booking(context, true)
    const reviewId = await publish(context, requestId)
    publishedFixture(context)
    let members = ["p-mireille"]
    let teamVersion = 0
    const subscribers = new Set<() => void>()
    const live = createDemoServiceReviews(context.store, { ...context.deps, teams: { signatoriesOf: () => members, getVersion: () => teamVersion, subscribe: (listener) => { subscribers.add(listener); return () => { subscribers.delete(listener) } } } })
    await as(context.store, "p-mireille")
    const list = renderHook(() => live.useOfferReviews({ offerId: "offer-test", cursor: null }))
    expect(ready(list.result.current).items[0]?.canReply).toBe(true)
    act(() => { members = []; teamVersion += 1; subscribers.forEach((listener) => listener()) })
    expect(ready(list.result.current).items[0]?.canReply).toBe(false)
    expect(await live.reply({ reviewId, expectedVersion: null, body: REPLY })).toEqual({ ok: false, code: "not_found" })
  })

  it("refuse l'auto-avis même quand le demandeur est devenu signataire de la page", async () => {
    const context = setup()
    const requestId = await booking(context, true)
    const reviews = createDemoServiceReviews(context.store, { ...context.deps, teams: { ...context.deps.teams, signatoriesOf: () => ["p-prisca", "p-mireille"] } })
    expect(await reviews.publish({ requestId, rating: 5, body: BODY, consentToPublish: true })).toEqual({ ok: false, code: "review_own_page" })
    const mine = renderHook(() => reviews.useMyReview({ requestId }))
    expect(ready(mine.result.current)).toMatchObject({ canCreate: false, refusal: "review_own_page" })
  })

  it("persiste à part, relit après recréation du fournisseur et efface l'overlay avec la remise à zéro", async () => {
    const context = setup()
    const requestId = await booking(context, true)
    const reviewId = await publish(context, requestId)
    const restored = createDemoServiceReviews(context.store, context.deps)
    const mine = renderHook(() => restored.useMyReview({ requestId }))
    expect(ready(mine.result.current)?.review?.reviewId).toBe(reviewId)
    clock += DAY
    await act(async () => { await context.store.reset() })
    expect(mine.result.current).toEqual({ status: "error", code: "not_signed_in" })
    expect(context.storage.getItem(DEMO_SERVICE_REVIEWS_STORAGE_KEY)).toBeNull()
    expect(context.requestsStorage.items.size).toBeGreaterThan(0)
  })

  it("ferme toute donnée après déconnexion et relit seulement la demande du nouveau compte", async () => {
    const context = setup()
    const requestId = await booking(context, true)
    await publish(context, requestId)
    const mine = renderHook(() => context.reviews.useMyReview({ requestId }))
    await as(context.store, "p-steeve")
    expect(ready(mine.result.current)).toBeNull()
    await as(context.store, "p-prisca")
    expect(ready(mine.result.current)?.review?.body).toBe(BODY)
    await act(async () => { await context.store.signOutEverywhere() })
    expect(mine.result.current).toEqual({ status: "error", code: "not_signed_in" })
  })

  it("permet à un compte en attente de lire et retirer, sans le laisser publier", async () => {
    const initial = setup()
    const requestId = await booking(initial, true)
    const seed = initial.store.getState()
    const member = seed.memberships["p-prisca"]!
    const state = { ...seed, memberships: { ...seed.memberships, "p-prisca": { ...member, grounds: LIGHT_ACCOUNT_GROUNDS } } }
    const context = setup({ state, requestsStorage: initial.requestsStorage })
    expect(await context.reviews.publish({ requestId: "missing", rating: 4, body: BODY, consentToPublish: true })).toEqual({ ok: false, code: "status_insufficient" })
    const mine = renderHook(() => context.reviews.useMyReview({ requestId }))
    expect(ready(mine.result.current)).toMatchObject({ canCreate: false, proof: "completion_declared", review: null })
    const list = renderHook(() => context.reviews.useOfferReviews({ offerId: "offer-test", cursor: null }))
    expect(ready(list.result.current).items).toEqual([])
    const reviewId = await publish(initial, requestId)
    const pendingWithReview = setup({ state, storage: initial.storage, requestsStorage: initial.requestsStorage })
    expect(await pendingWithReview.reviews.withdraw({ reviewId, expectedVersion: 1 })).toEqual({ ok: true, value: null })
  })

  it("masque un avis signalé pour ce seul membre et conserve l'attente de modération de la démonstration", async () => {
    const context = setup()
    const requestId = await booking(context, true)
    const reviewId = await publish(context, requestId)
    const reviews = publishedFixture(context)
    expect(await reviews.report({ target: { kind: "review", id: reviewId }, reason: "fraud" })).toEqual({ ok: false, code: "not_found" })
    await as(context.store, "p-steeve")
    const list = renderHook(() => reviews.useOfferReviews({ offerId: "offer-test", cursor: null }))
    expect(ready(list.result.current).items).toHaveLength(1)
    await act(async () => { expect(await reviews.report({ target: { kind: "review", id: reviewId }, reason: "fraud" })).toEqual({ ok: true, value: null }) })
    expect(ready(list.result.current).items).toEqual([])
    expect(await reviews.report({ target: { kind: "review", id: reviewId }, reason: "spam" })).toEqual({ ok: true, value: null })
    expect(stored(context).reports).toHaveLength(1)
    expect(stored(context).reviews[0]?.moderation).toBe("published")
    await as(context.store, "p-mireille")
    expect(ready(list.result.current).items).toHaveLength(1)
  })

  it("signale le véritable identifiant d'une réponse publiée et masque seulement cette réponse", async () => {
    const context = setup()
    const requestId = await booking(context, true)
    const reviewId = await publish(context, requestId)
    const reviews = publishedFixture(context)
    await as(context.store, "p-mireille")
    await reviews.reply({ reviewId, expectedVersion: null, body: REPLY })
    const state = stored(context)
    const replyId = state.replies[0]!.id
    await as(context.store, "p-prisca")
    expect(await reviews.report({ target: { kind: "reply", id: replyId }, reason: "spam" })).toEqual({ ok: false, code: "not_found" })
    context.storage.setItem(DEMO_SERVICE_REVIEWS_STORAGE_KEY, JSON.stringify({ ...state, replies: state.replies.map((row) => ({ ...row, moderation: "published" })) }))
    const published = createDemoServiceReviews(context.store, context.deps)
    const list = renderHook(() => published.useOfferReviews({ offerId: "offer-test", cursor: null }))
    expect(ready(list.result.current).items[0]?.reply?.replyId).toBe(replyId)
    await act(async () => { expect(await published.report({ target: { kind: "reply", id: replyId }, reason: "harassment" })).toEqual({ ok: true, value: null }) })
    expect(ready(list.result.current).items).toHaveLength(1)
    expect(ready(list.result.current).items[0]?.reply).toBeNull()
    expect(stored(context).reports[0]?.target).toEqual({ kind: "reply", id: replyId })
    await as(context.store, "p-steeve")
    expect(ready(list.result.current).items[0]?.reply?.replyId).toBe(replyId)
    expect(await published.report({ target: { kind: "reply", id: reviewId }, reason: "spam" })).toEqual({ ok: false, code: "not_found" })
  })

  it("retire aussitôt de la liste l'avis d'une personne bloquée", async () => {
    const context = setup()
    const requestId = await booking(context, true)
    await publish(context, requestId)
    const reviews = publishedFixture(context)
    await as(context.store, "p-steeve")
    const list = renderHook(() => reviews.useOfferReviews({ offerId: "offer-test", cursor: null }))
    expect(ready(list.result.current).items).toHaveLength(1)
    await act(async () => { await context.store.block("p-prisca") })
    expect(ready(list.result.current).items).toEqual([])
  })

  it("relit le nom social vivant et rend un nom neutre après retrait du profil", async () => {
    const context = setup()
    const requestId = await booking(context, true)
    await publish(context, requestId)
    const reviews = publishedFixture(context)
    const list = renderHook(() => reviews.useOfferReviews({ offerId: "offer-test", cursor: null }))
    expect(ready(list.result.current).items[0]?.author.displayName).toBe(context.store.getState().persons["p-prisca"]?.profile?.displayName)
    await act(async () => { await context.store.withdrawProfile("p-prisca") })
    expect(ready(list.result.current).items[0]?.author.displayName).toBeNull()
  })

  it("pagine vingt lignes sans doublons et rejette un curseur d'une autre offre", async () => {
    const context = setup()
    for (let iteration = 0; iteration < 21; iteration += 1) {
      const requestId = await booking(context, true, iteration)
      await publish(context, requestId)
    }
    const reviews = publishedFixture(context)
    const list = renderHook((props: { cursor: string | null }) => reviews.useOfferReviews({ offerId: "offer-test", ...props }), { initialProps: { cursor: null as string | null } })
    const first = ready(list.result.current)
    expect(first.items).toHaveLength(20)
    expect(first.isDone).toBe(false)
    list.rerender({ cursor: first.continueCursor })
    const last = ready(list.result.current)
    expect(last.items).toHaveLength(1)
    expect(last.isDone).toBe(true)
    expect(new Set([...first.items, ...last.items].map((row) => row.reviewId)).size).toBe(21)
    list.rerender({ cursor: JSON.stringify(["demo-service-reviews", "foreign-offer", END, "avis-0"]) })
    expect(list.result.current).toEqual({ status: "error", code: "unknown" })
  })

  it("repart vide si le stockage est invalide ou bloqué et conserve les nouvelles écritures en mémoire", async () => {
    const context = setup()
    const requestId = await booking(context, true)
    context.storage.setItem(DEMO_SERVICE_REVIEWS_STORAGE_KEY, "{broken")
    const invalid = createDemoServiceReviews(context.store, context.deps)
    expect(ready(renderHook(() => invalid.useOfferReviews({ offerId: "offer-test", cursor: null })).result.current).items).toEqual([])
    const blocked = createDemoServiceReviews(context.store, { ...context.deps, storage: { getItem: () => { throw new Error("bloqué") }, setItem: () => { throw new Error("bloqué") }, removeItem: () => { throw new Error("bloqué") } } })
    expect(ready(renderHook(() => blocked.useOfferReviews({ offerId: "offer-test", cursor: null })).result.current).items).toEqual([])
    expect((await blocked.publish({ requestId, rating: 4, body: BODY, consentToPublish: true })).ok).toBe(true)
    const mine = renderHook(() => blocked.useMyReview({ requestId }))
    expect(ready(mine.result.current)?.review).toMatchObject({ body: BODY, moderation: "pending_review" })
    clock += DAY
    await act(async () => { await context.store.reset() })
    expect(mine.result.current).toEqual({ status: "error", code: "not_signed_in" })
  })
})
