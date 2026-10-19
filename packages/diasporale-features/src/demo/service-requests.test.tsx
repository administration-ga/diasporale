import { LIGHT_ACCOUNT_GROUNDS } from "@diasporale/domain"
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import type { ProposeServiceInput, SendServiceRequestInput, ServiceRequestDetailView, ServiceRequestsPageView } from "../data/service-requests-port"
import type { Loadable } from "../data/types"
import { createDemoServiceRequests, DEMO_SERVICE_REQUESTS_STORAGE_KEY } from "./service-requests"
import type { DemoOfferRef } from "./services"
import { createDemoSeed, type DemoState } from "./state"
import { DemoStore } from "./store"

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const NOW = Date.UTC(2026, 9, 18, 10)
const KEY = "2b4a7a0e-6a52-4c8e-9a52-7f1f0b6c2d11"
const OTHER_KEY = "9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f"
const NEED = "Tresses africaines pour un mariage, cheveux mi-longs."
let clock = NOW

class MemoryStorage {
  readonly items = new Map<string, string>()
  getItem(key: string) { return this.items.get(key) ?? null }
  setItem(key: string, value: string) { this.items.set(key, value) }
  removeItem(key: string) { this.items.delete(key) }
}

function offerRef(id: string, overrides: Partial<DemoOfferRef> = {}): DemoOfferRef {
  return { id, title: `Tresses (démo) ${id}`, version: 2, status: "active", pageId: "page-saveurs", pageHandle: "saveurs-okoume-demo", pageName: "Saveurs d'Okoumé (démo)", ...overrides }
}

function setup(options: { readonly overrides?: Partial<DemoState>; readonly storage?: MemoryStorage } = {}) {
  const state: DemoState = { ...createDemoSeed(NOW), session: { personId: "p-prisca" }, ...options.overrides }
  const store = new DemoStore({ getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }, () => clock, 0)
  const offers = new Map<string, DemoOfferRef>([["offre-coiffure", offerRef("offre-coiffure")]])
  const storage = options.storage ?? new MemoryStorage()
  const capability = createDemoServiceRequests(store, { findOffer: (id) => offers.get(id) ?? null, storage })
  return { store, capability, offers, storage }
}

function sendInput(overrides: Partial<SendServiceRequestInput> = {}): SendServiceRequestInput {
  return {
    offerId: "offre-coiffure", offerVersion: 2, need: NEED, windows: [{ startAt: NOW + DAY, endAt: NOW + DAY + 4 * HOUR }],
    timeZone: "Europe/Paris", shareIdentityWithPage: true, idempotencyKey: KEY, ...overrides,
  }
}

function proposalInput(requestId: string, overrides: Partial<ProposeServiceInput> = {}): ProposeServiceInput {
  return {
    requestId, expectedVersion: 0, amountMinor: 4500, currency: "EUR", durationMinutes: 90, startAt: NOW + DAY + HOUR,
    timeZone: "Europe/Paris", location: { mode: "onsite", area: "Paris 11e" }, details: "Tresses, mèches fournies.",
    cancellationTerms: "Annulation libre jusqu'à la veille.", expiresAt: NOW + 12 * HOUR, ...overrides,
  }
}

function ready<T>(query: Loadable<T>): T {
  if (query.status !== "ready") throw new Error(`lecture non prête : ${JSON.stringify(query)}`)
  return query.data
}

async function as(store: DemoStore, personId: string) {
  await act(async () => { await store.switchTo(personId) })
}

async function sent(capability: ReturnType<typeof setup>["capability"], input: SendServiceRequestInput = sendInput()) {
  const result = await capability.send(input)
  if (!result.ok) throw new Error(`envoi refusé : ${result.code}`)
  return result.value.requestId
}

beforeEach(() => {
  clock = NOW
})

describe("démonstration — demandes de service", () => {
  it("parcours à deux comptes : Prisca demande, Mireille propose, Prisca accepte, Mireille constate après le début", async () => {
    const { store, capability } = setup()
    const mine = renderHook(() => capability.useMyRequests({ cursor: null }))
    expect(ready(mine.result.current).items).toEqual([])
    let requestId = ""
    await act(async () => { requestId = await sent(capability, sendInput({ need: `  ${NEED}  ` })) })
    expect(ready(mine.result.current).items).toEqual([expect.objectContaining({ requestId, status: "sent", requester: null, page: expect.objectContaining({ name: "Saveurs d'Okoumé (démo)" }) })])

    await as(store, "p-mireille")
    const inbox = renderHook(() => capability.usePageRequests({ pageId: "page-saveurs", status: null, cursor: null }))
    expect(ready(inbox.result.current).items[0]).toMatchObject({ requestId, requester: { displayName: "Prisca ABANGA", handle: "prisca.abanga" }, deadlineAt: NOW + DAY + 4 * HOUR })
    const detail = renderHook(() => capability.useRequest(requestId))
    expect(ready(detail.result.current)).toMatchObject({ viewerRole: "page", need: NEED, actions: ["propose", "refuse"] })
    await act(async () => { expect(await capability.propose(proposalInput(requestId))).toEqual({ ok: true, value: { version: 1 } }) })

    await as(store, "p-prisca")
    expect(ready(detail.result.current)).toMatchObject({ viewerRole: "requester", status: "proposed", actions: ["cancel", "accept"], currentProposal: { version: 1, amountMinor: 4500 } })
    await act(async () => { expect((await capability.accept({ requestId, expectedProposalVersion: 1 })).ok).toBe(true) })
    expect(ready(detail.result.current)).toMatchObject({ status: "confirmed", booking: { status: "confirmed", startAt: NOW + DAY + HOUR } })

    await as(store, "p-mireille")
    expect(await capability.complete(requestId)).toEqual({ ok: false, code: "booking_not_started" })
    clock = NOW + DAY + HOUR
    await act(async () => { expect(await capability.complete(requestId)).toEqual({ ok: true, value: null }) })
    const done = ready(detail.result.current) as ServiceRequestDetailView
    expect(done).toMatchObject({ status: "completed", closedBy: "page", actions: [], booking: { status: "completed" } })
    expect(done.timeline.map((event) => event.status)).toEqual(["sent", "proposed", "confirmed", "completed"])
  })

  it("R-G05 : un double envoi rend la même demande, un autre corps sous la même clé est un conflit", async () => {
    const { capability, offers } = setup()
    const first = await sent(capability)
    expect(await capability.send(sendInput({ need: `\n${NEED}\n` }))).toEqual({ ok: true, value: { requestId: first, created: false } })
    expect(await capability.send(sendInput({ need: `${NEED} Merci.` }))).toEqual({ ok: false, code: "request_idempotency_conflict" })
    expect(await capability.send(sendInput({ idempotencyKey: OTHER_KEY }))).toEqual({ ok: false, code: "request_already_open" })
    offers.set("offre-coiffure", offerRef("offre-coiffure", { status: "paused" }))
    clock = NOW + 2 * DAY
    expect(await capability.send(sendInput())).toEqual({ ok: true, value: { requestId: first, created: false } })
    expect(await capability.send(sendInput({ idempotencyKey: "court" }))).toEqual({ ok: false, code: "unknown" })
  })

  it("refuse le consentement absent, une version périmée, sa propre page, une offre inactive et un besoin porteur de coordonnées", async () => {
    const { store, capability, offers } = setup()
    expect(await capability.send(sendInput({ shareIdentityWithPage: false }))).toEqual({ ok: false, code: "request_consent_required" })
    expect(await capability.send(sendInput({ offerVersion: 1 }))).toEqual({ ok: false, code: "request_offer_changed" })
    expect(await capability.send(sendInput({ offerId: "inconnue" }))).toEqual({ ok: false, code: "not_found" })
    expect(await capability.send(sendInput({ need: `${NEED} 06 12 34 56 78` }))).toEqual({ ok: false, code: "request_contact_forbidden" })
    expect(await capability.send(sendInput({ windows: [{ startAt: NOW - HOUR, endAt: NOW + HOUR }] }))).toEqual({ ok: false, code: "request_window_past" })
    offers.set("offre-coiffure", offerRef("offre-coiffure", { status: "withdrawn" }))
    expect(await capability.send(sendInput())).toEqual({ ok: false, code: "not_found" })
    offers.set("offre-coiffure", offerRef("offre-coiffure"))
    await as(store, "p-mireille")
    expect(await capability.send(sendInput())).toEqual({ ok: false, code: "request_own_page" })
  })

  it("une demande d'autrui est introuvable ; la boîte d'une page est réservée à son équipe", async () => {
    const { store, capability } = setup()
    const requestId = await sent(capability)
    await as(store, "p-steeve")
    const detail = renderHook(() => capability.useRequest(requestId))
    expect(detail.result.current).toEqual({ status: "ready", data: null })
    const inbox = renderHook(() => capability.usePageRequests({ pageId: "page-saveurs", status: null, cursor: null }))
    expect(inbox.result.current).toEqual({ status: "error", code: "not_found" })
    expect(await capability.propose(proposalInput(requestId))).toEqual({ ok: false, code: "not_found" })
    expect(await capability.cancel({ requestId, reason: null })).toEqual({ ok: false, code: "not_found" })
    expect(await capability.accept({ requestId, expectedProposalVersion: 0 })).toEqual({ ok: false, code: "not_found" })
    expect(await capability.refuse({ requestId, reason: null })).toEqual({ ok: false, code: "not_found" })
    expect(await capability.markNoShow(requestId)).toEqual({ ok: false, code: "not_found" })
    await as(store, "p-prisca")
    expect(await capability.propose(proposalInput(requestId))).toEqual({ ok: false, code: "not_found" })
    expect(await capability.complete(requestId)).toEqual({ ok: false, code: "not_found" })
  })

  it("R-G07 et R-G06 : l'ancienne version est refusée ; le créneau réservé ne se reprend pas", async () => {
    const { store, capability, offers } = setup()
    offers.set("offre-photo", offerRef("offre-photo"))
    const first = await sent(capability)
    await as(store, "p-steeve")
    const second = await sent(capability, sendInput({ offerId: "offre-photo", idempotencyKey: OTHER_KEY }))
    await as(store, "p-mireille")
    await capability.propose(proposalInput(first))
    expect(await capability.propose(proposalInput(first, { expectedVersion: 1, amountMinor: 5000 }))).toEqual({ ok: true, value: { version: 2 } })
    expect(await capability.propose(proposalInput(first, { expectedVersion: 1 }))).toEqual({ ok: false, code: "proposal_version_changed" })
    expect(await capability.propose(proposalInput(second))).toEqual({ ok: true, value: { version: 1 } })
    await as(store, "p-prisca")
    expect(await capability.accept({ requestId: first, expectedProposalVersion: 1 })).toEqual({ ok: false, code: "proposal_version_changed" })
    const detail = renderHook(() => capability.useRequest(first))
    expect((ready(detail.result.current) as ServiceRequestDetailView).proposals.map((proposal) => [proposal.version, proposal.state, proposal.amountMinor])).toEqual([[2, "current", 5000], [1, "superseded", 4500]])
    expect((await capability.accept({ requestId: first, expectedProposalVersion: 2 })).ok).toBe(true)
    await as(store, "p-steeve")
    expect(await capability.accept({ requestId: second, expectedProposalVersion: 1 })).toEqual({ ok: false, code: "booking_slot_unavailable" })
    await as(store, "p-mireille")
    expect(await capability.propose(proposalInput(second, { expectedVersion: 1, startAt: NOW + DAY + 2 * HOUR }))).toEqual({ ok: false, code: "booking_slot_unavailable" })
    expect(await capability.propose(proposalInput(second, { expectedVersion: 1, startAt: NOW + DAY + HOUR + 90 * MINUTE }))).toEqual({ ok: true, value: { version: 2 } })
    await as(store, "p-steeve")
    expect((await capability.accept({ requestId: second, expectedProposalVersion: 2 })).ok).toBe(true)
    expect(await capability.propose(proposalInput(second, { expectedVersion: 2 }))).toEqual({ ok: false, code: "not_found" })
  })

  it("refus, annulation motivée après l'accord, absence constatée après le début", async () => {
    const { store, capability, offers } = setup()
    offers.set("offre-b", offerRef("offre-b"))
    offers.set("offre-c", offerRef("offre-c"))
    const declined = await sent(capability)
    const booked = await sent(capability, sendInput({ offerId: "offre-b", idempotencyKey: OTHER_KEY }))
    const missed = await sent(capability, sendInput({ offerId: "offre-c", idempotencyKey: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d" }))
    await as(store, "p-mireille")
    expect(await capability.cancel({ requestId: declined, reason: null })).toEqual({ ok: false, code: "request_action_forbidden" })
    expect(await capability.refuse({ requestId: declined, reason: "x".repeat(501) })).toEqual({ ok: false, code: "request_reason_too_long" })
    expect(await capability.refuse({ requestId: declined, reason: " Complet  ce jour-là " })).toEqual({ ok: true, value: null })
    await capability.propose(proposalInput(booked))
    await capability.propose(proposalInput(missed, { startAt: NOW + 2 * DAY, expiresAt: NOW + DAY }))
    await as(store, "p-prisca")
    const declinedView = renderHook(() => capability.useRequest(declined))
    expect(ready(declinedView.result.current)).toMatchObject({ status: "refused", closedReason: "Complet ce jour-là", closedBy: "page" })
    expect(await capability.cancel({ requestId: declined, reason: null })).toEqual({ ok: false, code: "request_closed" })
    await capability.accept({ requestId: booked, expectedProposalVersion: 1 })
    await capability.accept({ requestId: missed, expectedProposalVersion: 1 })
    expect(await capability.cancel({ requestId: booked, reason: null })).toEqual({ ok: false, code: "request_reason_required" })
    expect(await capability.cancel({ requestId: booked, reason: "Empêchement" })).toEqual({ ok: true, value: null })
    const bookedView = renderHook(() => capability.useRequest(booked))
    expect(ready(bookedView.result.current)).toMatchObject({ status: "cancelled", closedBy: "requester", closedReason: "Empêchement", booking: { status: "cancelled" } })
    await as(store, "p-mireille")
    expect(await capability.markNoShow(missed)).toEqual({ ok: false, code: "booking_not_started" })
    clock = NOW + 2 * DAY
    expect(await capability.markNoShow(missed)).toEqual({ ok: true, value: null })
    expect(await capability.cancel({ requestId: missed, reason: "Trop tard" })).toEqual({ ok: false, code: "request_closed" })
    const missedView = renderHook(() => capability.useRequest(missed))
    expect(ready(missedView.result.current)).toMatchObject({ status: "no_show", booking: { status: "no_show" } })
  })

  it("constate l'expiration à la lecture, au geste et dans les filtres", async () => {
    const { store, capability } = setup()
    const requestId = await sent(capability)
    clock = NOW + DAY + 4 * HOUR
    await as(store, "p-mireille")
    const detail = renderHook(() => capability.useRequest(requestId))
    expect(ready(detail.result.current)).toMatchObject({ status: "expired", actions: [], deadlineAt: null })
    expect(await capability.propose(proposalInput(requestId, { startAt: NOW + 2 * DAY, expiresAt: NOW + 2 * DAY - HOUR }))).toEqual({ ok: false, code: "request_expired" })
    const sentFilter = renderHook(() => capability.usePageRequests({ pageId: "page-saveurs", status: "sent", cursor: null }))
    expect(ready(sentFilter.result.current).items).toEqual([])
    const expiredFilter = renderHook(() => capability.usePageRequests({ pageId: "page-saveurs", status: "expired", cursor: null }))
    expect(ready(expiredFilter.result.current).items.map((item) => item.requestId)).toEqual([requestId])
    await as(store, "p-prisca")
    // Une demande échue n'empêche pas d'en envoyer une nouvelle.
    expect((await capability.send(sendInput({ idempotencyKey: OTHER_KEY, windows: [{ startAt: NOW + 2 * DAY, endAt: NOW + 2 * DAY + HOUR }] }))).ok).toBe(true)
  })

  it("pagine mes demandes par vingt, curseur opaque compris", async () => {
    const { capability, offers } = setup()
    for (let index = 0; index < 21; index += 1) {
      offers.set(`offre-${index}`, offerRef(`offre-${index}`))
      clock = NOW + index
      await sent(capability, sendInput({ offerId: `offre-${index}`, idempotencyKey: `cle-de-demonstration-${String(index).padStart(4, "0")}` }))
    }
    const page = renderHook((props: { cursor: string | null }) => capability.useMyRequests(props), { initialProps: { cursor: null as string | null } })
    const first = ready(page.result.current) as ServiceRequestsPageView
    expect(first.items).toHaveLength(20)
    expect(first.items[0]!.offerId).toBe("offre-20")
    expect(first.isDone).toBe(false)
    page.rerender({ cursor: first.continueCursor })
    expect(ready(page.result.current)).toMatchObject({ items: [expect.objectContaining({ offerId: "offre-0" })], isDone: true, continueCursor: null })
    page.rerender({ cursor: "pas-un-curseur" })
    expect(page.result.current).toEqual({ status: "error", code: "unknown" })
    page.rerender({ cursor: JSON.stringify(["autre", 1, "x"]) })
    expect(page.result.current).toEqual({ status: "error", code: "unknown" })
  })

  it("garde ses demandes dans ce navigateur et les oublie à la remise à zéro", async () => {
    const storage = new MemoryStorage()
    const first = setup({ storage })
    const requestId = await sent(first.capability)
    expect(JSON.parse(storage.getItem(DEMO_SERVICE_REQUESTS_STORAGE_KEY) ?? "null")).toMatchObject({ version: 1, seedCreatedAt: NOW })
    const reloaded = setup({ storage })
    const mine = renderHook(() => reloaded.capability.useMyRequests({ cursor: null }))
    expect(ready(mine.result.current).items.map((item) => item.requestId)).toEqual([requestId])
    clock = NOW + DAY
    await act(async () => { await reloaded.store.reset() })
    await as(reloaded.store, "p-prisca")
    expect(ready(mine.result.current).items).toEqual([])
    storage.setItem(DEMO_SERVICE_REQUESTS_STORAGE_KEY, "{pas du json")
    const broken = setup({ storage })
    const brokenMine = renderHook(() => broken.capability.useMyRequests({ cursor: null }))
    expect(ready(brokenMine.result.current).items).toEqual([])
  })

  it("lit et écrit selon la session : anonyme, non membre, suspendue, en attente", async () => {
    const anonymous = setup({ overrides: { session: { personId: null } } })
    const read = renderHook(() => anonymous.capability.useMyRequests({ cursor: null }))
    expect(read.result.current).toEqual({ status: "error", code: "not_signed_in" })
    expect(await anonymous.capability.send(sendInput())).toEqual({ ok: false, code: "not_signed_in" })
    const seed = createDemoSeed(NOW)
    const outsider = setup({ overrides: { session: { personId: "p-prisca" }, memberships: Object.fromEntries(Object.entries(seed.memberships).filter(([id]) => id !== "p-prisca")) } })
    expect(renderHook(() => outsider.capability.useRequest("x")).result.current).toEqual({ status: "error", code: "not_member" })
    const suspended = setup({ overrides: { memberships: { ...seed.memberships, "p-prisca": { ...seed.memberships["p-prisca"]!, grounds: { ...seed.memberships["p-prisca"]!.grounds, suspension: { until: null, readAccess: "none" } } } } } })
    expect(await suspended.capability.send(sendInput())).toEqual({ ok: false, code: "suspended" })
    const pending = setup({ overrides: { memberships: { ...seed.memberships, "p-prisca": { ...seed.memberships["p-prisca"]!, grounds: LIGHT_ACCOUNT_GROUNDS } } } })
    expect(await pending.capability.send(sendInput())).toEqual({ ok: false, code: "status_insufficient" })
    expect(ready(renderHook(() => pending.capability.useMyRequests({ cursor: null })).result.current).items).toEqual([])
  })
})
