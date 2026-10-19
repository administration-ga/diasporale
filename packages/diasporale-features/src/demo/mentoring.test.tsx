import { LIGHT_ACCOUNT_GROUNDS, MENTORING_DOMAINS, type CountryCode, type MentoringDomain } from "@diasporale/domain"
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import type { MentoringCapability, MentoringRequestInputView, MentorProfileInputView } from "../data/mentoring-port"
import { MENTOR_DOMAINS, type Loadable } from "../data/types"
import { createDemoMentoring, DEMO_MENTORING_STORAGE_KEY, demoMentoringSeed } from "./mentoring"
import { createDemoSeed, type DemoState } from "./state"
import { DemoStore } from "./store"

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const NOW = Date.UTC(2026, 9, 18, 10)
const KEY = "2b4a7a0e-6a52-4c8e-9a52-7f1f0b6c2d11"
const OTHER_KEY = "9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f"
const THIRD_KEY = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
const MESSAGE = "Je viens d'arriver pour mes études et je cherche des conseils pour trouver un logement."
const MIREILLE = "mentor-demo-mireille"
const RODRIGUE = "mentor-demo-rodrigue"
let clock = NOW

class MemoryStorage {
  readonly items = new Map<string, string>()
  getItem(key: string) { return this.items.get(key) ?? null }
  setItem(key: string, value: string) { this.items.set(key, value) }
  removeItem(key: string) { this.items.delete(key) }
}

function setup(options: { readonly overrides?: Partial<DemoState>; readonly storage?: MemoryStorage | null; readonly personId?: string } = {}) {
  const state: DemoState = { ...createDemoSeed(NOW), session: { personId: options.personId ?? "p-prisca" }, ...options.overrides }
  const store = new DemoStore({ getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }, () => clock, 0)
  const storage = options.storage === undefined ? new MemoryStorage() : options.storage
  const capability = createDemoMentoring(store, { storage })
  return { store, capability, storage }
}

function requestInput(mentorId: string, overrides: Partial<MentoringRequestInputView> = {}): MentoringRequestInputView {
  return {
    mentorId, domain: "housing", goal: "Trouver un logement étudiant", message: MESSAGE,
    wishedSlots: [{ startAt: NOW + DAY, endAt: NOW + DAY + HOUR }], timeZone: "Europe/Paris", shareWithMentor: true, idempotencyKey: KEY, ...overrides,
  }
}

function profileInput(overrides: Partial<MentorProfileInputView> = {}): MentorProfileInputView {
  return {
    domains: ["studies"], presentation: "Étudiante en droit à Bordeaux (démo), je conseille les nouveaux étudiants pour leur rentrée.",
    languages: ["fr"], country: "FR", city: "Bordeaux", availability: "Le mercredi après-midi", maxActiveMentees: 1, ...overrides,
  }
}

function ready<T>(query: Loadable<T>): T {
  if (query.status !== "ready") throw new Error(`lecture non prête : ${JSON.stringify(query)}`)
  return query.data
}

async function as(store: DemoStore, personId: string) {
  await act(async () => { await store.switchTo(personId) })
}

async function sent(capability: MentoringCapability, input: MentoringRequestInputView): Promise<string> {
  let requestId = ""
  await act(async () => {
    const result = await capability.request(input)
    if (!result.ok) throw new Error(`demande refusée : ${result.code}`)
    requestId = result.value.requestId
  })
  return requestId
}

beforeEach(() => {
  clock = NOW
})

describe("démonstration — mentorat", () => {
  it("la liste fermée des domaines est celle des cartes ; les mentors fictifs se cherchent par pays et domaine, la ville selon la facette", async () => {
    expect([...MENTORING_DOMAINS]).toEqual([...MENTOR_DOMAINS])
    const { store, capability } = setup()
    const search = renderHook((props: { country: CountryCode; domain: MentoringDomain | null }) => capability.useSearch({ ...props, cursor: null }), {
      initialProps: { country: "FR" as CountryCode, domain: null as MentoringDomain | null },
    })
    // Prisca est une relation de Mireille : la ville, réservée aux relations, lui est montrée ; Clarisse est en pause.
    expect(ready(search.result.current)).toEqual({
      items: [expect.objectContaining({ mentorId: MIREILLE, displayName: "Mireille Ivindo", handle: "mireille.ivindo", city: "Paris", country: "FR", domains: ["housing", "family", "admin"], acceptsRequests: true })],
      isDone: true,
      continueCursor: null,
    })
    search.rerender({ country: "FR", domain: "studies" })
    expect(ready(search.result.current).items).toEqual([])
    search.rerender({ country: "CA", domain: "studies" })
    expect(ready(search.result.current).items).toEqual([expect.objectContaining({ mentorId: RODRIGUE, city: null, languages: ["fr", "en"] })])
    search.rerender({ country: "FR", domain: null })
    await as(store, "p-steeve")
    expect(ready(search.result.current).items).toEqual([expect.objectContaining({ mentorId: MIREILLE, city: null })])
  })

  it("parcours à deux comptes : Prisca demande, Mireille accepte avec un créneau, en propose un autre, Prisca clôt", async () => {
    const { store, capability } = setup()
    const profile = renderHook(() => capability.useMentor(MIREILLE))
    expect(ready(profile.result.current)).toMatchObject({ isSelf: false, state: "active", viewerRequest: null, availability: "Le soir en semaine et le samedi matin" })
    const requestId = await sent(capability, requestInput(MIREILLE, { goal: "  Trouver  un logement étudiant " }))
    expect(ready(profile.result.current)?.viewerRequest).toEqual({ requestId, status: "sent" })
    const mine = renderHook(() => capability.useMenteeRequests({ cursor: null }))
    expect(ready(mine.result.current).items).toEqual([expect.objectContaining({
      requestId, status: "sent", viewerRole: "mentee", goal: "Trouver un logement étudiant",
      counterpart: { displayName: "Mireille Ivindo", handle: "mireille.ivindo" }, deadlineAt: NOW + 14 * DAY, slot: null, moderation: "published",
    })])

    await as(store, "p-mireille")
    const inbox = renderHook(() => capability.useMentorRequests({ status: "sent", cursor: null }))
    expect(ready(inbox.result.current).items.map((item) => [item.requestId, item.counterpart.displayName])).toEqual([[requestId, "Prisca Abanga"], ["mentorat-demo-steeve", "Steeve Ngounié"]])
    // G9, comme le moteur : l'état de modération d'une demande ne va jamais à son mentor.
    expect(ready(inbox.result.current).items.some((item) => "moderation" in item)).toBe(false)
    const detail = renderHook(() => capability.useRequest(requestId))
    expect(ready(detail.result.current)).toMatchObject({ viewerRole: "mentor", message: MESSAGE, actions: ["accept", "decline"] })
    expect(ready(detail.result.current)).not.toHaveProperty("moderation")
    const slot = { startAt: NOW + 2 * DAY, endAt: NOW + 2 * DAY + HOUR, timeZone: "Europe/Paris" }
    await act(async () => { expect(await capability.accept({ requestId, slot })).toEqual({ ok: true, value: { slotVersion: 1 } }) })
    expect(ready(detail.result.current)).toMatchObject({ status: "accepted", acceptedAt: NOW, slotVersion: 1, slot: { ...slot, proposedAt: NOW }, actions: ["propose_slot", "close"] })
    const later = { ...slot, startAt: slot.startAt + DAY, endAt: slot.endAt + DAY }
    await act(async () => { expect(await capability.proposeSlot({ requestId, expectedSlotVersion: 1, slot: later })).toEqual({ ok: true, value: { slotVersion: 2 } }) })
    expect(await capability.proposeSlot({ requestId, expectedSlotVersion: 1, slot })).toEqual({ ok: false, code: "mentoring_slot_version_changed" })
    expect(await capability.proposeSlot({ requestId, expectedSlotVersion: 2, slot: { ...slot, startAt: NOW - HOUR, endAt: NOW } })).toEqual({ ok: false, code: "mentoring_slot_past" })
    const myProfile = renderHook(() => capability.useMyProfile())
    expect(ready(myProfile.result.current)).toMatchObject({ mentorId: MIREILLE, activeMentees: 1, pendingRequests: 1, maxActiveMentees: 3, version: 1, moderation: "published" })

    await as(store, "p-prisca")
    expect(ready(detail.result.current)).toMatchObject({ viewerRole: "mentee", slot: { startAt: later.startAt }, actions: ["close"], moderation: "published" })
    expect(await capability.accept({ requestId, slot: null })).toEqual({ ok: false, code: "not_found" })
    await act(async () => { expect(await capability.close({ requestId, reason: "  Merci  beaucoup " })).toEqual({ ok: true, value: null }) })
    expect(ready(detail.result.current)).toMatchObject({ status: "closed", closedBy: "mentee", closedReason: "Merci beaucoup", closedAt: NOW, actions: [] })
    expect(await capability.close({ requestId, reason: null })).toEqual({ ok: false, code: "mentoring_request_closed" })
  })

  it("on ne se mentore pas soi-même ; un mentor en pause, inconnu ou bloqué est introuvable, une demande d'autrui aussi", async () => {
    const { store, capability } = setup({ personId: "p-mireille" })
    expect(await capability.request(requestInput(MIREILLE))).toEqual({ ok: false, code: "mentoring_self_request" })
    await as(store, "p-prisca")
    expect(renderHook(() => capability.useMentor("mentor-demo-clarisse")).result.current).toEqual({ status: "ready", data: null })
    expect(await capability.request(requestInput("mentor-demo-clarisse", { domain: "admin" }))).toEqual({ ok: false, code: "not_found" })
    expect(await capability.request(requestInput("inconnu"))).toEqual({ ok: false, code: "not_found" })
    expect(renderHook(() => capability.useRequest("mentorat-demo-steeve")).result.current).toEqual({ status: "ready", data: null })
    expect(await capability.accept({ requestId: "mentorat-demo-steeve", slot: null })).toEqual({ ok: false, code: "not_found" })
    expect(await capability.cancel({ requestId: "mentorat-demo-steeve", reason: null })).toEqual({ ok: false, code: "not_found" })
    const search = renderHook(() => capability.useSearch({ country: "FR", domain: null, cursor: null }))
    await act(async () => { await store.block("p-mireille") })
    expect(ready(search.result.current).items).toEqual([])
    expect(await capability.request(requestInput(MIREILLE))).toEqual({ ok: false, code: "not_found" })
    await as(store, "p-clarisse")
    expect(ready(renderHook(() => capability.useMentor("mentor-demo-clarisse")).result.current)).toMatchObject({ isSelf: true, state: "paused" })
  })

  it("plafond, paire unique, idempotence, domaine proposé et consentement", async () => {
    const { store, capability } = setup()
    const input = requestInput(RODRIGUE, { domain: "studies" })
    const first = await sent(capability, input)
    expect(await capability.request({ ...input, message: `\n${MESSAGE}\n` })).toEqual({ ok: true, value: { requestId: first, created: false } })
    expect(await capability.request({ ...input, goal: "Un autre objectif" })).toEqual({ ok: false, code: "mentoring_idempotency_conflict" })
    expect(await capability.request({ ...input, idempotencyKey: OTHER_KEY })).toEqual({ ok: false, code: "mentoring_pair_open" })
    expect(await capability.request({ ...input, idempotencyKey: "court" })).toEqual({ ok: false, code: "unknown" })
    await as(store, "p-steeve")
    expect(await capability.request(requestInput(RODRIGUE, { domain: "housing", idempotencyKey: OTHER_KEY }))).toEqual({ ok: false, code: "mentoring_domain_not_offered" })
    expect(await capability.request(requestInput(RODRIGUE, { domain: "work", idempotencyKey: OTHER_KEY, shareWithMentor: false }))).toEqual({ ok: false, code: "mentoring_consent_required" })
    const second = await sent(capability, requestInput(RODRIGUE, { domain: "work", idempotencyKey: OTHER_KEY }))
    await as(store, "p-mireille")
    const third = await sent(capability, requestInput(RODRIGUE, { domain: "work", idempotencyKey: THIRD_KEY, wishedSlots: [] }))

    await as(store, "p-rodrigue")
    await act(async () => {
      expect(await capability.accept({ requestId: first, slot: null })).toEqual({ ok: true, value: { slotVersion: 0 } })
      expect(await capability.accept({ requestId: second, slot: null })).toEqual({ ok: true, value: { slotVersion: 0 } })
    })
    expect(await capability.accept({ requestId: third, slot: null })).toEqual({ ok: false, code: "mentoring_capacity_reached" })
    const rodrigueProfile = { domains: ["studies", "work"] as MentoringDomain[], presentation: "Ingénieur à Montréal (démo), je réponds sur les études et l'emploi.", languages: ["fr", "en"], country: "CA" as CountryCode, city: "Montréal", availability: "Le week-end", maxActiveMentees: 1 }
    expect(await capability.updateProfile({ ...rodrigueProfile, expectedVersion: 1 })).toEqual({ ok: false, code: "mentor_capacity_below_active" })
    expect(await capability.updateProfile({ ...rodrigueProfile, maxActiveMentees: 3, expectedVersion: 2 })).toEqual({ ok: false, code: "mentor_profile_version_changed" })

    await as(store, "p-nadia")
    expect(ready(renderHook(() => capability.useSearch({ country: "CA", domain: null, cursor: null })).result.current).items).toEqual([expect.objectContaining({ mentorId: RODRIGUE, acceptsRequests: false })])
    expect(await capability.request(requestInput(RODRIGUE, { domain: "work" }))).toEqual({ ok: false, code: "mentoring_mentor_full" })
  })

  it("un compte léger trouve les mentors sans pouvoir leur écrire ni devenir mentor", async () => {
    const seed = createDemoSeed(NOW)
    const { capability } = setup({ overrides: { memberships: { ...seed.memberships, "p-prisca": { ...seed.memberships["p-prisca"]!, grounds: LIGHT_ACCOUNT_GROUNDS } } } })
    expect(ready(renderHook(() => capability.useSearch({ country: "FR", domain: null, cursor: null })).result.current).items).toHaveLength(1)
    expect(await capability.request(requestInput(MIREILLE))).toEqual({ ok: false, code: "status_insufficient" })
    expect(await capability.becomeMentor({ ...profileInput(), consent: true })).toEqual({ ok: false, code: "status_insufficient" })
    const anonymous = setup({ overrides: { session: { personId: null } } })
    expect(renderHook(() => anonymous.capability.useMyProfile()).result.current).toEqual({ status: "error", code: "not_signed_in" })
    expect(await anonymous.capability.request(requestInput(MIREILLE))).toEqual({ ok: false, code: "not_signed_in" })
  })

  it("devenir mentor par un opt-in explicite, modifier, mettre en pause, retirer puis revenir", async () => {
    const { store, capability } = setup()
    const mine = renderHook(() => capability.useMyProfile())
    expect(mine.result.current).toEqual({ status: "ready", data: null })
    expect(await capability.becomeMentor({ ...profileInput(), consent: false })).toEqual({ ok: false, code: "mentor_consent_required" })
    expect(await capability.becomeMentor({ ...profileInput({ country: "GA" as CountryCode }), consent: true })).toEqual({ ok: false, code: "mentor_country_invalid" })
    let mentorId = ""
    await act(async () => {
      const result = await capability.becomeMentor({ ...profileInput(), consent: true })
      if (!result.ok) throw new Error(result.code)
      mentorId = result.value.mentorId
      expect(result.value.version).toBe(1)
    })
    expect(ready(mine.result.current)).toMatchObject({ mentorId, state: "active", domains: ["studies"], city: "Bordeaux", activeMentees: 0, pendingRequests: 0, optedInAt: NOW })
    expect(await capability.becomeMentor({ ...profileInput(), consent: true })).toEqual({ ok: false, code: "mentor_profile_exists" })
    await act(async () => { expect(await capability.updateProfile({ ...profileInput({ domains: ["studies", "admin"], city: null }), expectedVersion: 1 })).toEqual({ ok: true, value: { version: 2 } }) })
    expect(ready(mine.result.current)).toMatchObject({ domains: ["studies", "admin"], city: null, version: 2 })

    // Steeve trouve Prisca, mentore d'études en France, et lui écrit.
    await as(store, "p-steeve")
    expect(ready(renderHook(() => capability.useSearch({ country: "FR", domain: "studies", cursor: null })).result.current).items.map((card) => card.mentorId)).toEqual([mentorId])
    const pending = await sent(capability, requestInput(mentorId, { domain: "studies" }))

    await as(store, "p-prisca")
    await act(async () => { expect(await capability.setState({ expectedVersion: 2, state: "paused" })).toEqual({ ok: true, value: { state: "paused", version: 3 } }) })
    expect(await capability.setState({ expectedVersion: 1, state: "paused" })).toEqual({ ok: true, value: { state: "paused", version: 3 } })
    await act(async () => { expect(await capability.setState({ expectedVersion: 3, state: "retired" })).toEqual({ ok: true, value: { state: "retired", version: 4 } }) })
    expect(ready(renderHook(() => capability.useMentorRequests({ status: null, cursor: null })).result.current).items).toEqual([expect.objectContaining({ requestId: pending, status: "declined" })])
    expect(await capability.setState({ expectedVersion: 4, state: "active" })).toEqual({ ok: false, code: "mentor_profile_retired" })
    expect(await capability.updateProfile({ ...profileInput(), expectedVersion: 4 })).toEqual({ ok: false, code: "mentor_profile_retired" })
    clock = NOW + HOUR
    await act(async () => { expect(await capability.becomeMentor({ ...profileInput(), consent: true })).toEqual({ ok: true, value: { mentorId, version: 5 } }) })
    expect(ready(mine.result.current)).toMatchObject({ state: "active", optedInAt: NOW + HOUR, version: 5 })
  })

  it("le retrait de Mireille décline la demande de Steeve ; l'échéance de quatorze jours se constate à la lecture", async () => {
    const { store, capability } = setup({ personId: "p-steeve" })
    const detail = renderHook(() => capability.useRequest("mentorat-demo-steeve"))
    expect(ready(detail.result.current)).toMatchObject({ status: "sent", viewerRole: "mentee", deadlineAt: NOW + 13 * DAY, actions: ["cancel"] })
    clock = NOW + 13 * DAY
    await as(store, "p-steeve")
    expect(ready(detail.result.current)).toMatchObject({ status: "expired", deadlineAt: null, actions: [] })
    expect(await capability.cancel({ requestId: "mentorat-demo-steeve", reason: null })).toEqual({ ok: false, code: "mentoring_request_expired" })

    clock = NOW
    const fresh = setup({ personId: "p-mireille" })
    await act(async () => { expect(await fresh.capability.setState({ expectedVersion: 1, state: "retired" })).toEqual({ ok: true, value: { state: "retired", version: 2 } }) })
    await as(fresh.store, "p-steeve")
    expect(ready(renderHook(() => fresh.capability.useRequest("mentorat-demo-steeve")).result.current)).toMatchObject({ status: "declined", closedBy: "mentor" })
    expect(ready(renderHook(() => fresh.capability.useSearch({ country: "FR", domain: null, cursor: null })).result.current).items).toEqual([])
  })

  it("garde le mentorat dans son propre stockage, relu tant que la démonstration n'est pas remise à zéro", async () => {
    const storage = new MemoryStorage()
    const first = setup({ storage })
    const requestId = await sent(first.capability, requestInput(MIREILLE))
    expect(storage.items.get(DEMO_MENTORING_STORAGE_KEY)).toContain(requestId)
    const again = setup({ storage })
    expect(ready(renderHook(() => again.capability.useMenteeRequests({ cursor: null })).result.current).items.map((item) => item.requestId)).toEqual([requestId])
    storage.setItem(DEMO_MENTORING_STORAGE_KEY, "{pas du json")
    const broken = setup({ storage })
    expect(ready(renderHook(() => broken.capability.useMenteeRequests({ cursor: null })).result.current).items).toEqual([])
    const memoryOnly = setup({ storage: null })
    expect(ready(renderHook(() => memoryOnly.capability.useMyProfile()).result.current)).toBeNull()
    expect(demoMentoringSeed(NOW).mentors.map((mentor) => [mentor.personId, mentor.state])).toEqual([
      ["p-mireille", "active"], ["p-nadia", "active"], ["p-rodrigue", "active"], ["p-clarisse", "paused"],
    ])
    expect(renderHook(() => first.capability.useMenteeRequests({ cursor: "curseur illisible" })).result.current).toEqual({ status: "error", code: "unknown" })
  })
})
