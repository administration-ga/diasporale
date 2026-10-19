// @vitest-environment jsdom
import { webcrypto } from "node:crypto"
import { ASSOCIATION_EVENT_WAITLIST_BATCH_SIZE, LIGHT_ACCOUNT_GROUNDS } from "@diasporale/domain"
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AssociationEventInput } from "../data/association-activities-port"
import type { Loadable } from "../data/types"
import { createDemoAssociationActivities, DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, type DemoAssociationActivitiesState } from "./association-activities"
import { createDemoAssociationsContext } from "./associations"
import { createDemoPageAdmin, demoPageAdminContext } from "./page-admin"
import { createDemoSeed, type DemoState } from "./state"
import { DemoStore } from "./store"

const NOW = Date.UTC(2026, 9, 18, 10)
const HOUR = 3_600_000
const PAGE = "page-asso-lyon"
let clock = NOW
class MemoryStorage {
  readonly items = new Map<string, string>()
  getItem(key: string) { return this.items.get(key) ?? null }
  setItem(key: string, value: string) { this.items.set(key, value) }
  removeItem(key: string) { this.items.delete(key) }
}
function setup(options: { readonly state?: Partial<DemoState> } = {}) {
  const seed = { ...createDemoSeed(NOW), session: { personId: "p-steeve" }, ...options.state }
  const store = new DemoStore({ getItem: () => JSON.stringify(seed), setItem: () => undefined, removeItem: () => undefined }, () => clock, 0)
  const storage = new MemoryStorage()
  const associations = createDemoAssociationsContext(store, { storage: new MemoryStorage(), latencyMs: 0 })
  const teams = demoPageAdminContext(store)
  const deps = { associations, teams, storage }
  return { store, storage, associations, deps, ...createDemoAssociationActivities(store, deps) }
}
type Setup = ReturnType<typeof setup>
type Activities = ReturnType<typeof createDemoAssociationActivities>
function ready<T>(query: Loadable<T>): T {
  if (query.status !== "ready") throw new Error(JSON.stringify(query))
  return query.data
}
async function as(store: DemoStore, personId: string) { await act(async () => { await store.switchTo(personId) }) }
async function group(context: Setup) {
  const result = await context.groups.create({ pageId: PAGE, idempotencyKey: "group-demo-key" })
  if (!result.ok) throw new Error(result.code)
  return result.value.groupId
}
function eventInput(overrides: Partial<AssociationEventInput> = {}): AssociationEventInput {
  return { pageId: PAGE, title: "Rencontre de l'association (démo)", description: "Rencontre fictive des membres.", location: "Salle de démonstration", startAt: NOW + 24 * HOUR, endAt: NOW + 26 * HOUR, timeZone: "Europe/Paris", audience: "association", ...overrides }
}
async function event(context: Setup, overrides: Partial<AssociationEventInput> = {}, key = "event-demo-key") {
  const result = await context.events.create({ ...eventInput(overrides), idempotencyKey: key })
  if (!result.ok) throw new Error(result.code)
  return result.value.eventId
}
function stored(context: Setup): DemoAssociationActivitiesState {
  return JSON.parse(context.storage.getItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY) ?? "null") as DemoAssociationActivitiesState
}
/** Approbation de fixture seulement : le fournisseur ne contient aucun faux modérateur. */
function publishedFixture(context: Setup) {
  const state = stored(context)
  context.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify({ ...state, posts: state.posts.map((row) => ({ ...row, moderation: "published" })), events: state.events.map((row) => ({ ...row, moderation: "published" })), gallery: (state.gallery ?? []).map((row) => ({ ...row, moderation: "published" })) }))
  return createDemoAssociationActivities(context.store, context.deps)
}
async function requestPlace(context: Setup, activities: Activities, eventId: string, personId: string) {
  await as(context.store, personId)
  await act(async () => {
    const result = await activities.events.register(eventId)
    if (!result.ok) throw new Error(result.code)
  })
}
async function withdrawPlace(context: Setup, activities: Activities, eventId: string, personId: string) {
  await as(context.store, personId)
  await act(async () => {
    const result = await activities.events.unregister(eventId)
    if (!result.ok) throw new Error(result.code)
  })
}
function eventView(activities: Activities, eventId: string) {
  return ready(renderHook(() => activities.events.useEvent(eventId)).result.current)
}
function attendanceOf(activities: Activities) {
  if (!activities.events.attendance) throw new Error("Capacité de présence absente")
  return activities.events.attendance
}
async function issue(context: Setup, activities: Activities, eventId: string, personId = "p-nadia") {
  await as(context.store, personId)
  const result = await act(async () => attendanceOf(activities).issueTicket(eventId))
  if (!result.ok) throw new Error(result.code)
  return result.value
}
function attendanceView(activities: Activities, eventId: string) {
  return ready(renderHook(() => attendanceOf(activities).useAttendance(eventId)).result.current)
}
function galleryOf(activities: Activities) {
  if (!activities.events.gallery) throw new Error("Capacité de galerie absente")
  return activities.events.gallery
}
function calendarOf(activities: Activities) {
  if (!activities.events.calendar) throw new Error("Capacité de calendrier absente")
  return activities.events.calendar
}
function photo(context: Setup, altText = "Photo fictive de l'événement") {
  return { upload: context.store.stageMedia({ kind: "image", url: `data:image/jpeg;base64,${"A".repeat(40)}`, width: 10, height: 10 }), altText }
}
beforeEach(() => { clock = NOW })
afterEach(cleanup)

describe("activités associatives — groupe privé de démonstration", () => {
  it("utilise le handle de l'association si son nom de page n'a que deux lettres", async () => {
    const seed = createDemoSeed(NOW)
    const context = setup({ state: { pages: { ...seed.pages, [PAGE]: { ...seed.pages[PAGE]!, name: "AB" } } } })
    await group(context)
    expect(stored(context).groups[0]?.name).toBe(seed.pages[PAGE]!.handle)
  })

  it("crée un seul groupe par page, inscrit seulement le créateur et ne rouvre pas un groupe fermé", async () => {
    const context = setup()
    const groupId = await group(context)
    expect(stored(context).members).toEqual([{ groupId, personId: "p-steeve", leftAt: null }])
    expect(await context.groups.create({ pageId: PAGE, idempotencyKey: "autre-cle" })).toEqual({ ok: true, value: { groupId, created: false } })
    const view = renderHook(() => context.groups.useGroup(PAGE))
    expect(ready(view.result.current)).toMatchObject({ groupId, role: "owner", isMember: true, canManage: true, canPublish: true })
    await act(async () => { await context.groups.close(groupId) })
    expect(ready(view.result.current)).toMatchObject({ state: "closed", isMember: true, canPublish: false, canJoin: false })
    expect(await context.groups.create({ pageId: PAGE, idempotencyKey: "encore" })).toEqual({ ok: true, value: { groupId, created: false } })
    expect(stored(context).groups).toHaveLength(1)
    expect(renderHook(() => context.groups.usePosts({ groupId, cursor: null })).result.current).toEqual({ status: "error", code: "not_found" })
  })

  it("réserve l'adhésion volontaire aux membres acceptés ; demandé ou simple abonné ne suffit pas", async () => {
    const context = setup()
    const groupId = await group(context)
    await as(context.store, "p-nadia")
    const view = renderHook(() => context.groups.useGroup(PAGE))
    expect(ready(view.result.current)).toMatchObject({ role: null, isMember: false, canJoin: true })
    expect(renderHook(() => context.groups.usePosts({ groupId, cursor: null })).result.current).toEqual({ status: "error", code: "not_found" })
    await act(async () => { await context.groups.join(groupId) })
    expect(ready(view.result.current)).toMatchObject({ role: "moderator", isMember: true, canPublish: true })
    expect(await context.groups.join(groupId)).toEqual({ ok: true, value: null })
    expect(stored(context).members).toHaveLength(2)
    await as(context.store, "p-rodrigue")
    expect(ready(view.result.current)).toMatchObject({ isMember: false, canJoin: false })
    expect(await context.groups.join(groupId)).toEqual({ ok: false, code: "not_found" })
    await as(context.store, "p-prisca")
    expect(await context.groups.join(groupId)).toEqual({ ok: false, code: "not_found" })
  })

  it("publie un texte privé en attente, visible à son auteur uniquement, sans toucher au fil général", async () => {
    const context = setup()
    const groupId = await group(context)
    const initialPosts = context.store.getState().posts
    await as(context.store, "p-nadia")
    await context.groups.join(groupId)
    const posts = renderHook(() => context.groups.usePosts({ groupId, cursor: null }))
    await act(async () => { expect(await context.groups.publish({ groupId, body: "  Bonjour au groupe.  ", idempotencyKey: "post-demo-key" })).toEqual({ ok: true, value: null }) })
    expect(ready(posts.result.current).items[0]).toMatchObject({ body: "Bonjour au groupe.", isMine: true, moderation: "pending_review" })
    expect(ready(posts.result.current).items[0]?.author).not.toHaveProperty("personId")
    expect(ready(posts.result.current).items[0]?.author).not.toHaveProperty("handle")
    expect(context.store.getState().posts).toBe(initialPosts)
    expect(await context.groups.publish({ groupId, body: "Autre corps rejoué.", idempotencyKey: "post-demo-key" })).toEqual({ ok: true, value: null })
    expect(stored(context).posts).toHaveLength(1)
    await as(context.store, "p-steeve")
    expect(ready(posts.result.current).items).toEqual([])
  })

  it("referme immédiatement le mur à l'ancien adhérent, même auteur de ses publications", async () => {
    const context = setup()
    const groupId = await group(context)
    await as(context.store, "p-nadia")
    await context.groups.join(groupId)
    await context.groups.publish({ groupId, body: "Publication à retirer.", idempotencyKey: "private-post-key" })
    const posts = renderHook(() => context.groups.usePosts({ groupId, cursor: null }))
    const postId = ready(posts.result.current).items[0]!.postId
    await act(async () => { await context.associations.capability.leave(PAGE) })
    expect(posts.result.current).toEqual({ status: "error", code: "not_found" })
    expect(await context.groups.removePost({ groupId, postId, isMine: true })).toEqual({ ok: false, code: "not_found" })
    expect(await context.groups.join(groupId)).toEqual({ ok: false, code: "not_found" })
  })

  it("relit les rôles effectifs et ne croit pas isMine pour retirer la publication d'autrui", async () => {
    const context = setup()
    const groupId = await group(context)
    await context.groups.publish({ groupId, body: "Publication de la page responsable.", idempotencyKey: "owner-post-key" })
    const activities = publishedFixture(context)
    await as(context.store, "p-clarisse")
    await activities.groups.join(groupId)
    const posts = renderHook(() => activities.groups.usePosts({ groupId, cursor: null }))
    const postId = ready(posts.result.current).items[0]!.postId
    expect(ready(posts.result.current).items[0]?.canRemove).toBe(false)
    expect(await activities.groups.removePost({ groupId, postId, isMine: true })).toEqual({ ok: false, code: "not_found" })
    await as(context.store, "p-nadia")
    await activities.groups.join(groupId)
    expect(ready(posts.result.current).items[0]?.canRemove).toBe(true)
    await act(async () => { await activities.groups.removePost({ groupId, postId, isMine: false }) })
    expect(ready(posts.result.current).items).toEqual([])
  })

  it("un administrateur peut quitter explicitement son groupe puis le gérer sans en lire le mur", async () => {
    const context = setup()
    const groupId = await group(context)
    await context.groups.leave(groupId)
    expect(ready(renderHook(() => context.groups.useGroup(PAGE)).result.current)).toMatchObject({ isMember: false, canManage: true, canJoin: true })
    expect(renderHook(() => context.groups.usePosts({ groupId, cursor: null })).result.current).toEqual({ status: "error", code: "not_found" })
    expect(await context.groups.close(groupId)).toEqual({ ok: true, value: null })
  })

  it("une ligne d'adhésion non acceptée ferme aussi les pouvoirs de l'administrateur", async () => {
    const context = setup()
    const groupId = await group(context)
    const view = renderHook(() => context.groups.useGroup(PAGE))
    await act(async () => { await context.associations.capability.request({ pageId: PAGE, message: "Demande volontaire de démonstration." }) })
    expect(ready(view.result.current)).toMatchObject({ role: null, isMember: false, canManage: false, canPublish: false, canJoin: false })
    expect(await context.groups.close(groupId)).toEqual({ ok: false, code: "not_found" })
  })

  it("relit les rôles de page sans en conserver une copie", async () => {
    const context = setup()
    const admin = createDemoPageAdmin(context.store, { storage: null })
    const groupId = await group(context)
    // L'invitation de Mireille sur Lyon existe déjà dans le magasin commun des pages.
    await as(context.store, "p-mireille")
    await admin.management!.respondToInvitation(PAGE, true)
    await context.groups.join(groupId)
    const view = renderHook(() => context.groups.useGroup(PAGE))
    expect(ready(view.result.current)?.role).toBe("moderator")
    await act(async () => { await admin.management!.revokeRole(PAGE, "p-mireille") })
    expect(ready(view.result.current)).toMatchObject({ role: null, isMember: false, canPublish: false })
  })

  it("pagine le mur par vingt lignes sans perdre les publications au même instant", async () => {
    const context = setup()
    const groupId = await group(context)
    for (let i = 0; i < 21; i += 1) await context.groups.publish({ groupId, body: `Publication fictive ${i}.`, idempotencyKey: `post-key-${i}` })
    const list = renderHook((props: { cursor: string | null }) => context.groups.usePosts({ groupId, ...props }), { initialProps: { cursor: null as string | null } })
    const first = ready(list.result.current)
    expect(first.items).toHaveLength(20)
    list.rerender({ cursor: first.continueCursor })
    const last = ready(list.result.current)
    expect(last.items).toHaveLength(1)
    expect(last.isDone).toBe(true)
    expect(new Set([...first.items, ...last.items].map((row) => row.postId)).size).toBe(21)
  })
})

describe("activités associatives — événements de démonstration", () => {
  it("crée au nom de la page, sans inscrit automatique, en attente visible aux seuls responsables", async () => {
    const context = setup()
    const eventId = await event(context)
    const detail = renderHook(() => context.events.useEvent(eventId))
    expect(ready(detail.result.current)).toMatchObject({ eventId, moderation: "pending_review", canManage: true, isRegistered: false, canRegister: false, organizer: { handle: "collectif-ivindo-lyon" } })
    expect(stored(context).registrations).toEqual([])
    await as(context.store, "p-nadia")
    expect(ready(detail.result.current)).toBeNull()
    expect(await context.events.register(eventId)).toEqual({ ok: false, code: "not_found" })
    expect(await context.events.create({ ...eventInput(), idempotencyKey: "other" })).toEqual({ ok: false, code: "association_event_access_required" })
  })

  it("sépare l'audience du réseau de celle des adhérents et inscrit seulement sur geste personnel", async () => {
    const context = setup()
    const privateId = await event(context)
    const publicId = await event(context, { audience: "network" }, "network-event-key")
    const activities = publishedFixture(context)
    await as(context.store, "p-prisca")
    expect(ready(renderHook(() => activities.events.useEvent(privateId)).result.current)).toBeNull()
    const detail = renderHook(() => activities.events.useEvent(publicId))
    expect(ready(detail.result.current)).toMatchObject({ isRegistered: false, canRegister: true, canManage: false })
    await act(async () => { await activities.events.register(publicId) })
    expect(ready(detail.result.current)).toMatchObject({ isRegistered: true, canRegister: false })
    expect(await activities.events.register(publicId)).toEqual({ ok: true, value: null })
    expect(stored(context).registrations).toEqual([{ eventId: publicId, personId: "p-prisca", status: "accepted", reminderEnabled: false }])
    await as(context.store, "p-nadia")
    expect(ready(renderHook(() => activities.events.useEvent(privateId)).result.current)?.canRegister).toBe(true)
    expect(stored(context).registrations).toHaveLength(1)
  })

  it("ferme un événement privé après départ de l'association, en conservant le retrait de sa présence", async () => {
    const context = setup()
    const eventId = await event(context)
    const activities = publishedFixture(context)
    await as(context.store, "p-nadia")
    await activities.events.register(eventId)
    const detail = renderHook(() => activities.events.useEvent(eventId))
    await act(async () => { await context.associations.capability.leave(PAGE) })
    expect(ready(detail.result.current)).toBeNull()
    expect(await activities.events.unregister(eventId)).toEqual({ ok: true, value: null })
    expect(stored(context).registrations).toEqual([{ eventId, personId: "p-nadia", status: "declined", reminderEnabled: false, attendanceVersion: 1 }])
    expect(await activities.events.unregister(eventId)).toEqual({ ok: true, value: null })
    await as(context.store, "p-clarisse")
    expect(await activities.events.unregister(eventId)).toEqual({ ok: false, code: "not_found" })
  })

  it("gère versions et annulation idempotente, sans effacer les participations", async () => {
    const context = setup()
    const eventId = await event(context)
    const activities = publishedFixture(context)
    await as(context.store, "p-nadia")
    await activities.events.register(eventId)
    await as(context.store, "p-steeve")
    expect(await activities.events.update({ ...eventInput(), eventId, expectedVersion: 9 })).toEqual({ ok: false, code: "association_event_version_changed" })
    expect(await activities.events.update({ ...eventInput({ title: "Titre modifié (démo)" }), eventId, expectedVersion: 1 })).toEqual({ ok: true, value: null })
    expect(stored(context).events[0]).toMatchObject({ version: 2, moderation: "pending_review" })
    expect(await activities.events.cancel({ eventId, expectedVersion: 1 })).toEqual({ ok: false, code: "association_event_version_changed" })
    expect(await activities.events.cancel({ eventId, expectedVersion: 2 })).toEqual({ ok: true, value: null })
    expect(stored(context).events[0]).toMatchObject({ version: 3, status: "cancelled" })
    expect(await activities.events.cancel({ eventId, expectedVersion: 3 })).toEqual({ ok: true, value: null })
    expect(stored(context).events[0]?.version).toBe(3)
    expect(stored(context).registrations).toHaveLength(1)
    expect(await activities.events.update({ ...eventInput(), eventId, expectedVersion: 3 })).toEqual({ ok: false, code: "association_event_cancelled" })
  })

  it("fige dates et fuseau dès la première inscription, même retirée", async () => {
    const context = setup()
    const eventId = await event(context)
    const activities = publishedFixture(context)
    await as(context.store, "p-nadia")
    await activities.events.register(eventId)
    await activities.events.unregister(eventId)
    await as(context.store, "p-steeve")
    expect(await activities.events.update({ ...eventInput({ startAt: NOW + 25 * HOUR }), eventId, expectedVersion: 1 })).toEqual({ ok: false, code: "association_event_schedule_locked" })
    expect(await activities.events.update({ ...eventInput({ timeZone: "Africa/Libreville" }), eventId, expectedVersion: 1 })).toEqual({ ok: false, code: "association_event_schedule_locked" })
  })

  it("valide les saisies et rejoue une clé sans recréer ni revalider le futur", async () => {
    const context = setup()
    expect(await context.events.create({ ...eventInput({ title: "x" }), idempotencyKey: "invalid-title" })).toEqual({ ok: false, code: "association_event_invalid" })
    expect(await context.events.create({ ...eventInput({ endAt: NOW }), idempotencyKey: "invalid-window" })).toEqual({ ok: false, code: "association_event_invalid" })
    expect(await context.events.create({ ...eventInput({ timeZone: "Mars/Test" }), idempotencyKey: "invalid-zone" })).toEqual({ ok: false, code: "association_event_invalid" })
    const eventId = await event(context)
    clock += 48 * HOUR
    expect(await context.events.create({ ...eventInput({ title: "Autre corps" }), idempotencyKey: "event-demo-key" })).toEqual({ ok: false, code: "association_event_version_changed" })
    expect(await context.events.create({ ...eventInput({ title: `  ${eventInput().title}  ` }), idempotencyKey: "event-demo-key" })).toEqual({ ok: true, value: { eventId, created: false } })
    expect(stored(context).events).toHaveLength(1)
  })

  it("pagine vingt événements dans l'ordre des dates et rejette un curseur d'une autre page", async () => {
    const context = setup()
    for (let i = 0; i < 21; i += 1) await event(context, { startAt: NOW + (24 + i) * HOUR, endAt: NOW + (25 + i) * HOUR }, `event-key-${i}`)
    const activities = publishedFixture(context)
    const list = renderHook((props: { cursor: string | null }) => activities.events.useEvents({ pageId: PAGE, ...props }), { initialProps: { cursor: null as string | null } })
    const first = ready(list.result.current)
    expect(first.items).toHaveLength(20)
    expect(first.items[0]?.startAt).toBe(NOW + 24 * HOUR)
    list.rerender({ cursor: first.continueCursor })
    const last = ready(list.result.current)
    expect(last.items).toHaveLength(1)
    expect(new Set([...first.items, ...last.items].map((row) => row.eventId)).size).toBe(21)
    list.rerender({ cursor: JSON.stringify(["demo-association-activities", "events:other", NOW, "event"]) })
    expect(list.result.current).toEqual({ status: "error", code: "unknown" })
  })

  it("en attente, lit un événement réseau publié et retire sa présence sans pouvoir s'inscrire", async () => {
    const context = setup()
    const eventId = await event(context, { audience: "network" })
    const state = stored(context)
    const seed = context.store.getState()
    const pending = setup({ state: { ...seed, session: { personId: "p-nadia" }, memberships: { ...seed.memberships, "p-nadia": { ...seed.memberships["p-nadia"]!, grounds: LIGHT_ACCOUNT_GROUNDS } } } })
    pending.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify({ ...state, events: state.events.map((row) => ({ ...row, moderation: "published" })), registrations: [{ eventId, personId: "p-nadia", status: "accepted" }] }))
    const activities = createDemoAssociationActivities(pending.store, pending.deps)
    expect(ready(renderHook(() => activities.events.useEvent(eventId)).result.current)).toMatchObject({ canManage: false, canRegister: false, isRegistered: true })
    expect(await activities.events.register(eventId)).toEqual({ ok: false, code: "status_insufficient" })
    expect(await activities.events.unregister(eventId)).toEqual({ ok: true, value: null })
  })

  it("persiste à part, ferme les lectures après déconnexion et suit la remise à zéro", async () => {
    const context = setup()
    const groupId = await group(context)
    const eventId = await event(context)
    const restored = createDemoAssociationActivities(context.store, context.deps)
    const detail = renderHook(() => restored.events.useEvent(eventId))
    expect(ready(detail.result.current)?.eventId).toBe(eventId)
    await act(async () => { await context.store.signOutEverywhere() })
    expect(detail.result.current).toEqual({ status: "error", code: "not_signed_in" })
    clock += HOUR
    await act(async () => { await context.store.reset() })
    expect(detail.result.current).toEqual({ status: "error", code: "not_signed_in" })
    expect(context.storage.getItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY)).toBeNull()
    await as(context.store, "p-steeve")
    expect(ready(detail.result.current)).toBeNull()
    expect(ready(renderHook(() => restored.groups.useGroup(PAGE)).result.current)).toBeNull()
    expect(await restored.groups.join(groupId)).toEqual({ ok: false, code: "not_found" })
  })

  it("continue en mémoire si le stockage est bloqué", async () => {
    const context = setup()
    const activities = createDemoAssociationActivities(context.store, { ...context.deps, storage: { getItem: () => { throw new Error("bloqué") }, setItem: () => { throw new Error("bloqué") }, removeItem: () => { throw new Error("bloqué") } } })
    const created = await activities.events.create({ ...eventInput(), idempotencyKey: "memory-event" })
    if (!created.ok) throw new Error(created.code)
    const detail = renderHook(() => activities.events.useEvent(created.value.eventId))
    expect(ready(detail.result.current)).toMatchObject({ moderation: "pending_review" })
    clock += HOUR
    await act(async () => { await context.store.reset() })
    expect(detail.result.current).toEqual({ status: "error", code: "not_signed_in" })
  })
})

describe("DG-023 — capacité et file d'attente de démonstration", () => {
  it("réserve la dernière place une seule fois au double clic et place la demande suivante en attente", async () => {
    const context = setup()
    const eventId = await event(context, { capacity: 1 })
    const activities = publishedFixture(context)
    await as(context.store, "p-nadia")
    await act(async () => {
      expect(await Promise.all([activities.events.register(eventId), activities.events.register(eventId)])).toEqual([{ ok: true, value: null }, { ok: true, value: null }])
    })
    expect(eventView(activities, eventId)).toMatchObject({ capacity: 1, confirmedCount: 1, waitlistCount: 0, remainingPlaces: 0, registration: "confirmed", isRegistered: true, waitlistPosition: null, canRegister: false })
    await requestPlace(context, activities, eventId, "p-clarisse")
    expect(eventView(activities, eventId)).toMatchObject({ confirmedCount: 1, waitlistCount: 1, registration: "waitlisted", waitlistPosition: 1, isRegistered: false, canRegister: false })
    expect(stored(context).registrations).toHaveLength(2)
  })

  it("ordonne deux demandes au même instant, garde le rang au rejeu et remet une réinscription en fin de file", async () => {
    const context = setup()
    const eventId = await event(context, { capacity: 1 })
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-steeve")
    await requestPlace(context, activities, eventId, "p-nadia")
    const firstSequence = stored(context).registrations.find((row) => row.personId === "p-nadia")!.sequence
    await requestPlace(context, activities, eventId, "p-clarisse")
    expect(eventView(activities, eventId)?.waitlistPosition).toBe(2)
    await requestPlace(context, activities, eventId, "p-nadia")
    expect(eventView(activities, eventId)?.waitlistPosition).toBe(1)
    expect(stored(context).registrations.find((row) => row.personId === "p-nadia")?.sequence).toBe(firstSequence)
    await withdrawPlace(context, activities, eventId, "p-nadia")
    expect(eventView(activities, eventId)).toMatchObject({ registration: "none", waitlistPosition: null, waitlistCount: 1 })
    await requestPlace(context, activities, eventId, "p-nadia")
    expect(eventView(activities, eventId)?.waitlistPosition).toBe(2)
    expect(stored(context).registrations.find((row) => row.personId === "p-nadia")!.sequence!).toBeGreaterThan(firstSequence!)
    await withdrawPlace(context, activities, eventId, "p-steeve")
    await as(context.store, "p-clarisse")
    expect(eventView(activities, eventId)).toMatchObject({ registration: "confirmed", confirmedCount: 1, waitlistCount: 1 })
    await withdrawPlace(context, activities, eventId, "p-clarisse")
    await as(context.store, "p-nadia")
    expect(eventView(activities, eventId)).toMatchObject({ registration: "confirmed", waitlistCount: 0 })
  })

  it("refuse de retirer des places confirmées et promeut lors d'une hausse ou du passage sans limite", async () => {
    const context = setup()
    const eventId = await event(context, { capacity: 2, audience: "network" })
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-steeve")
    await requestPlace(context, activities, eventId, "p-nadia")
    await requestPlace(context, activities, eventId, "p-clarisse")
    await as(context.store, "p-steeve")
    expect(await activities.events.update({ ...eventInput({ audience: "network", capacity: 1 }), eventId, expectedVersion: 1 })).toEqual({ ok: false, code: "association_event_capacity_below_confirmed" })
    await act(async () => { expect(await activities.events.update({ ...eventInput({ audience: "network", capacity: 3 }), eventId, expectedVersion: 1 })).toEqual({ ok: true, value: null }) })
    expect(eventView(activities, eventId)).toMatchObject({ capacity: 3, confirmedCount: 3, waitlistCount: 0, remainingPlaces: 0, moderation: "published", version: 2 })
    await requestPlace(context, activities, eventId, "p-prisca")
    expect(eventView(activities, eventId)?.registration).toBe("waitlisted")
    await as(context.store, "p-steeve")
    await act(async () => { await activities.events.update({ ...eventInput({ audience: "network", capacity: null }), eventId, expectedVersion: 2 }) })
    expect(eventView(activities, eventId)).toMatchObject({ capacity: null, confirmedCount: 4, waitlistCount: 0, remainingPlaces: null, moderation: "published" })
    await as(context.store, "p-prisca")
    expect(eventView(activities, eventId)?.registration).toBe("confirmed")
  })

  it("conserve la capacité omise à l'édition et ne réapprouve pas un contenu modifié", async () => {
    const context = setup()
    const eventId = await event(context, { capacity: 1 })
    const activities = publishedFixture(context)
    await activities.events.update({ ...eventInput({ title: "Nouveau titre (démo)" }), eventId, expectedVersion: 1 })
    expect(eventView(activities, eventId)).toMatchObject({ capacity: 1, moderation: "pending_review", version: 2 })
    await act(async () => { await activities.events.update({ ...eventInput({ title: "Nouveau titre (démo)", capacity: null }), eventId, expectedVersion: 2 }) })
    expect(eventView(activities, eventId)).toMatchObject({ capacity: null, moderation: "pending_review", version: 3 })
  })

  it.each([0, -1, 1.5, 10_001, Infinity])("refuse la capacité invalide %s à la création et à l'édition", async (capacity) => {
    const context = setup()
    expect(await context.events.create({ ...eventInput({ capacity }), idempotencyKey: "invalid-capacity" })).toEqual({ ok: false, code: "association_event_capacity_invalid" })
    const eventId = await event(context)
    expect(await context.events.update({ ...eventInput({ capacity }), eventId, expectedVersion: 1 })).toEqual({ ok: false, code: "association_event_capacity_invalid" })
  })

  it("inclut la capacité dans le corps d'idempotence et distingue omission et limitation à la création", async () => {
    const context = setup()
    const eventId = await event(context, { capacity: 1 })
    expect(await context.events.create({ ...eventInput(), idempotencyKey: "event-demo-key" })).toEqual({ ok: false, code: "association_event_version_changed" })
    clock = NOW + 48 * HOUR
    expect(await context.events.create({ ...eventInput({ capacity: 1 }), idempotencyKey: "event-demo-key" })).toEqual({ ok: true, value: { eventId, created: false } })
  })

  it.each(["left", "removed"] as const)("ne promeut pas un candidat dont l'adhésion est %s et relit les droits sans écrire pendant une query", async (status) => {
    const context = setup()
    const eventId = await event(context, { capacity: 1 })
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-steeve")
    await requestPlace(context, activities, eventId, "p-nadia")
    await requestPlace(context, activities, eventId, "p-clarisse")
    if (status === "left") {
      await as(context.store, "p-nadia")
      await act(async () => { await context.associations.capability.leave(PAGE) })
    } else {
      await as(context.store, "p-steeve")
      await act(async () => { await context.associations.capability.remove({ membershipId: "assoc-1", expectedVersion: 2, reason: "Exclusion de démonstration motivée." }) })
      await as(context.store, "p-nadia")
    }
    const beforeRead = context.storage.getItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY)
    expect(eventView(activities, eventId)).toBeNull()
    expect(context.storage.getItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY)).toBe(beforeRead)
    await as(context.store, "p-steeve")
    expect(eventView(activities, eventId)).toMatchObject({ waitlistCount: 2, confirmedCount: 1 })
    await act(async () => { await activities.events.update({ ...eventInput({ capacity: 1 }), eventId, expectedVersion: 1 }) })
    // Quand toutes les places sont réservées, même un geste ne nettoie pas la file.
    expect(stored(context).registrations.find((row) => row.personId === "p-nadia")?.status).toBe("pending")
    await withdrawPlace(context, activities, eventId, "p-steeve")
    expect(stored(context).registrations.find((row) => row.personId === "p-nadia")?.status).toBe("declined")
    await as(context.store, "p-clarisse")
    expect(eventView(activities, eventId)?.registration).toBe("confirmed")
  })

  it.each(["suspended", "pending"] as const)("écarte au traitement un candidat devenu %s dans le réseau", async (status) => {
    const context = setup()
    const eventId = await event(context, { capacity: 1 })
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-steeve")
    await requestPlace(context, activities, eventId, "p-nadia")
    await requestPlace(context, activities, eventId, "p-clarisse")
    const seed = context.store.getState()
    const membership = seed.memberships["p-nadia"]!
    const changed = setup({ state: { ...seed, session: { personId: "p-steeve" }, memberships: { ...seed.memberships, "p-nadia": { ...membership, grounds: status === "pending" ? LIGHT_ACCOUNT_GROUNDS : { ...membership.grounds, suspension: { until: null, readAccess: "none" } } } } } })
    changed.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify(stored(context)))
    const resumed = createDemoAssociationActivities(changed.store, changed.deps)
    await withdrawPlace(changed, resumed, eventId, "p-steeve")
    expect(stored(changed).registrations.find((row) => row.personId === "p-nadia")?.status).toBe("declined")
    await as(changed.store, "p-clarisse")
    expect(eventView(resumed, eventId)?.registration).toBe("confirmed")
  })

  it("ne déclasse pas silencieusement une place confirmée après perte d'adhésion", async () => {
    const context = setup()
    const eventId = await event(context, { capacity: 1 })
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-nadia")
    await requestPlace(context, activities, eventId, "p-clarisse")
    await as(context.store, "p-nadia")
    await act(async () => { await context.associations.capability.leave(PAGE) })
    await as(context.store, "p-steeve")
    expect(eventView(activities, eventId)).toMatchObject({ confirmedCount: 1, waitlistCount: 1, remainingPlaces: 0 })
    expect(await activities.events.update({ ...eventInput({ capacity: 1 }), eventId, expectedVersion: 1 })).toEqual({ ok: true, value: null })
    expect(stored(context).registrations.find((row) => row.personId === "p-nadia")?.status).toBe("accepted")
    await withdrawPlace(context, activities, eventId, "p-nadia")
    await as(context.store, "p-clarisse")
    expect(eventView(activities, eventId)?.registration).toBe("confirmed")
  })

  it("conserve un profil retiré mais efface les références du compte supprimé sous watcher et reprend la file", async () => {
    const context = setup()
    const eventId = await event(context, { capacity: 1 })
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-steeve")
    await requestPlace(context, activities, eventId, "p-nadia")
    renderHook(() => activities.events.useEvent(eventId))
    await act(async () => { await context.store.withdrawProfile("p-nadia") })
    expect(stored(context).registrations.find((row) => row.personId === "p-nadia")?.status).toBe("pending")
    await withdrawPlace(context, activities, eventId, "p-steeve")
    await as(context.store, "p-nadia")
    expect(eventView(activities, eventId)?.registration).toBe("confirmed")
    await requestPlace(context, activities, eventId, "p-clarisse")
    await as(context.store, "p-nadia")
    await act(async () => { await context.store.deleteMyAccount() })
    expect(context.store.getState().persons["p-nadia"]).toBeUndefined()
    expect(stored(context).registrations.some((row) => row.personId === "p-nadia")).toBe(false)
    expect(stored(context).registrations.find((row) => row.personId === "p-clarisse")?.status).toBe("accepted")
    await as(context.store, "p-steeve")
    const beforeRead = context.storage.getItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY)
    expect(eventView(activities, eventId)).toMatchObject({ confirmedCount: 1, waitlistCount: 0, remainingPlaces: 0 })
    expect(context.storage.getItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY)).toBe(beforeRead)
  })

  it.each(["subscription", "register"] as const)("réconcilie le stockage froid via %s sans toucher aux groupes et publications", async (resume) => {
    const context = setup()
    await group(context)
    await context.groups.publish({ groupId: stored(context).groups[0]!.id, body: "Historique du groupe à conserver.", idempotencyKey: "history-post" })
    const eventId = await event(context, { capacity: 1 })
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-nadia")
    await requestPlace(context, activities, eventId, "p-clarisse")
    await act(async () => { await context.store.withdrawProfile("p-clarisse") })
    await as(context.store, "p-nadia")
    await act(async () => { await context.store.deleteMyAccount() })
    const before = stored(context)
    // Aucun hook n'était monté : l'ancienne référence reste à réconcilier.
    expect(before.registrations.some((row) => row.personId === "p-nadia")).toBe(true)
    const restored = createDemoAssociationActivities(context.store, context.deps)
    expect(stored(context)).toEqual(before)
    if (resume === "subscription") renderHook(() => restored.events.useEvent(eventId))
    else await requestPlace(context, restored, eventId, "p-clarisse")
    const after = stored(context)
    expect(after.registrations.some((row) => row.personId === "p-nadia")).toBe(false)
    expect(after.registrations.find((row) => row.personId === "p-clarisse")?.status).toBe("accepted")
    expect(after.groups).toEqual(before.groups)
    expect(after.members).toEqual(before.members)
    expect(after.posts).toEqual(before.posts)
  })

  it.each(["pending_review", "cancelled", "past"] as const)("ne promeut personne lorsque l'événement est %s", async (state) => {
    const context = setup()
    const eventId = await event(context, { capacity: 1 })
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-steeve")
    await requestPlace(context, activities, eventId, "p-nadia")
    await as(context.store, "p-steeve")
    if (state === "pending_review") await activities.events.update({ ...eventInput({ title: "Programme modifié (démo)", capacity: 1 }), eventId, expectedVersion: 1 })
    else if (state === "cancelled") await activities.events.cancel({ eventId, expectedVersion: 1 })
    else clock = NOW + 25 * HOUR
    await withdrawPlace(context, activities, eventId, "p-steeve")
    expect(stored(context).registrations.find((row) => row.personId === "p-nadia")?.status).toBe("pending")
    expect(eventView(activities, eventId)).toMatchObject({ confirmedCount: 0, waitlistCount: 1 })
  })

  it.each(["register", "update"] as const)("borne le traitement à 32 candidats puis reprend par %s sans dépasser la personne qui attend", async (resume) => {
    const seed = createDemoSeed(NOW)
    const ineligibleIds = Array.from({ length: ASSOCIATION_EVENT_WAITLIST_BATCH_SIZE + 1 }, (_, index) => `ineligible-demo-${index}`)
    // Comptes fictifs présents, sans adhésion réseau : ils restent dans la file jusqu'au traitement borné.
    const persons = { ...seed.persons, ...Object.fromEntries(ineligibleIds.map((id) => [id, { ...seed.persons["p-rodrigue"]!, id, idn: null, local: null, profile: null, demoAccountKey: null }])) }
    const context = setup({ state: { persons } })
    const eventId = await event(context, { capacity: 1 })
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-steeve")
    const fixture = stored(context)
    const ineligible = ineligibleIds.map((personId, index) => ({ eventId, personId, status: "pending", sequence: fixture.sequence + index }))
    const sequence = fixture.sequence + ineligible.length
    context.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify({ ...fixture, sequence: sequence + 1, registrations: [...fixture.registrations, ...ineligible, { eventId, personId: "p-nadia", status: "pending", sequence }] }))
    const resumed = createDemoAssociationActivities(context.store, context.deps)
    await withdrawPlace(context, resumed, eventId, "p-steeve")
    expect(stored(context).registrations.filter((row) => row.personId.startsWith("ineligible-demo-") && row.status === "declined")).toHaveLength(ASSOCIATION_EVENT_WAITLIST_BATCH_SIZE)
    await as(context.store, "p-nadia")
    expect(eventView(resumed, eventId)).toMatchObject({ registration: "waitlisted", waitlistPosition: 2, remainingPlaces: 1 })
    if (resume === "register") await requestPlace(context, resumed, eventId, "p-nadia")
    else {
      await as(context.store, "p-steeve")
      await act(async () => { await resumed.events.update({ ...eventInput({ capacity: 1 }), eventId, expectedVersion: 1 }) })
      await as(context.store, "p-nadia")
    }
    expect(eventView(resumed, eventId)).toMatchObject({ registration: "confirmed", waitlistPosition: null, waitlistCount: 0 })
    expect(stored(context).registrations.find((row) => row.personId === "p-nadia")?.sequence).toBe(sequence)
  })

  it("migre le stockage v1 sans capacité ni séquence en conservant activités et historique", async () => {
    const context = setup()
    const groupId = await group(context)
    const eventId = await event(context)
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-nadia")
    const fixture = stored(context)
    const { gallery, ...withoutGallery } = fixture
    void gallery
    const legacy = {
      ...withoutGallery,
      events: fixture.events.map(({ capacity, registrationClosesAt, ...row }) => { void capacity; void registrationClosesAt; return row }),
      registrations: [...fixture.registrations.map(({ reminderEnabled, reminderRecordedForStartAt, ...row }) => { void reminderEnabled; void reminderRecordedForStartAt; return row }), { eventId, personId: "p-clarisse", status: "declined" }],
    }
    context.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify(legacy))
    const beforeRead = context.storage.getItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY)
    const restored = createDemoAssociationActivities(context.store, context.deps)
    expect(eventView(restored, eventId)).toMatchObject({ capacity: null, confirmedCount: 1, waitlistCount: 0, registration: "confirmed", remainingPlaces: null, registrationClosesAt: null, reminderEnabled: false, reminderAt: null, reminderState: "off" })
    expect(attendanceView(restored, eventId)).toMatchObject({ version: 0, checkedInAt: null, recordedCount: null })
    expect(context.storage.getItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY)).toBe(beforeRead)
    await as(context.store, "p-steeve")
    expect(ready(renderHook(() => restored.groups.useGroup(PAGE)).result.current)?.groupId).toBe(groupId)
    await act(async () => { await restored.events.cancel({ eventId, expectedVersion: 1 }) })
    expect(stored(context).events[0]).toMatchObject({ id: eventId, capacity: null })
    expect(stored(context).groups).toEqual(fixture.groups)
    expect(stored(context).registrations).toEqual(legacy.registrations)
    expect(stored(context).gallery).toEqual([])
  })
})

describe("DG-023 — clôture et choix personnel de rappel de démonstration", () => {
  const later = { startAt: NOW + 48 * HOUR, endAt: NOW + 50 * HOUR }

  it("ferme à l'instant exact, conserve les rejeux et retraits, puis reprend la file à la réouverture", async () => {
    const context = setup()
    const input = eventInput({ ...later, audience: "network", capacity: 1, registrationClosesAt: NOW + HOUR })
    const eventId = await event(context, input)
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-steeve")
    await requestPlace(context, activities, eventId, "p-nadia")
    clock = NOW + HOUR - 1
    expect(eventView(activities, eventId)?.registrationOpen).toBe(true)
    clock += 1
    await as(context.store, "p-clarisse")
    expect(eventView(activities, eventId)).toMatchObject({ registrationOpen: false, canRegister: false })
    expect(await activities.events.register(eventId)).toEqual({ ok: false, code: "association_event_registration_closed" })
    await requestPlace(context, activities, eventId, "p-nadia")
    expect(eventView(activities, eventId)?.registration).toBe("waitlisted")
    await requestPlace(context, activities, eventId, "p-steeve")
    await withdrawPlace(context, activities, eventId, "p-steeve")
    expect(stored(context).registrations.find((row) => row.personId === "p-nadia")?.status).toBe("pending")
    const { registrationClosesAt, ...withoutDeadline } = input
    void registrationClosesAt
    await act(async () => { await activities.events.update({ ...withoutDeadline, capacity: 2, eventId, expectedVersion: 1 }) })
    expect(eventView(activities, eventId)).toMatchObject({ registrationClosesAt: NOW + HOUR, registrationOpen: false, moderation: "published", version: 2, waitlistCount: 1 })
    await act(async () => { await activities.events.update({ ...withoutDeadline, capacity: 2, registrationClosesAt: null, eventId, expectedVersion: 2 }) })
    expect(eventView(activities, eventId)).toMatchObject({ registrationClosesAt: null, registrationOpen: true, moderation: "published", version: 3, confirmedCount: 1, waitlistCount: 0 })
    await as(context.store, "p-nadia")
    expect(eventView(activities, eventId)?.registration).toBe("confirmed")
  })

  it("autorise une clôture passée, inclut la clôture dans l'idempotence et ferme au début sans date explicite", async () => {
    const context = setup()
    const closedId = await event(context, { ...later, registrationClosesAt: NOW - 1 }, "already-closed")
    expect(await context.events.create({ ...eventInput({ ...later }), idempotencyKey: "already-closed" })).toEqual({ ok: false, code: "association_event_version_changed" })
    const openId = await event(context, { ...later }, "without-deadline")
    expect(await context.events.create({ ...eventInput({ ...later, registrationClosesAt: null }), idempotencyKey: "without-deadline" })).toEqual({ ok: true, value: { eventId: openId, created: false } })
    const activities = publishedFixture(context)
    expect(eventView(activities, closedId)).toMatchObject({ registrationClosesAt: NOW - 1, registrationOpen: false })
    await requestPlace(context, activities, openId, "p-nadia")
    clock = later.startAt
    await requestPlace(context, activities, openId, "p-nadia")
    await as(context.store, "p-clarisse")
    expect(await activities.events.register(openId)).toEqual({ ok: false, code: "association_event_registration_closed" })
    expect(eventView(activities, openId)?.registrationOpen).toBe(false)
  })

  it.each([NOW + 48 * HOUR + 1, NOW + 0.5, Infinity, NaN])("refuse la clôture invalide %s sans changer l'événement", async (registrationClosesAt) => {
    const context = setup()
    expect(await context.events.create({ ...eventInput({ ...later, registrationClosesAt }), idempotencyKey: "invalid-deadline" })).toEqual({ ok: false, code: "association_event_deadline_invalid" })
    const eventId = await event(context, later)
    const before = stored(context)
    expect(await context.events.update({ ...eventInput({ ...later, registrationClosesAt }), eventId, expectedVersion: 1 })).toEqual({ ok: false, code: "association_event_deadline_invalid" })
    expect(stored(context)).toEqual(before)
  })

  it("garde le rappel désactivé par défaut, distingue attente et confirmation et ne fabrique aucune notification", async () => {
    const context = setup()
    const eventId = await event(context, { ...later, capacity: 1 })
    const activities = publishedFixture(context)
    const notifications = context.store.getState().notifications
    await requestPlace(context, activities, eventId, "p-nadia")
    expect(eventView(activities, eventId)).toMatchObject({ reminderEnabled: false, reminderAt: null, reminderState: "off" })
    await act(async () => { expect(await activities.events.setReminder({ eventId, enabled: true })).toEqual({ ok: true, value: null }) })
    expect(eventView(activities, eventId)).toMatchObject({ reminderEnabled: true, reminderAt: NOW + 24 * HOUR, reminderState: "scheduled" })
    await requestPlace(context, activities, eventId, "p-clarisse")
    await act(async () => { await activities.events.setReminder({ eventId, enabled: true }) })
    expect(eventView(activities, eventId)).toMatchObject({ registration: "waitlisted", reminderEnabled: true, reminderState: "waiting_confirmation" })
    await withdrawPlace(context, activities, eventId, "p-nadia")
    expect(eventView(activities, eventId)).toMatchObject({ registration: "none", reminderEnabled: false, reminderAt: null, reminderState: "off" })
    await as(context.store, "p-clarisse")
    expect(eventView(activities, eventId)).toMatchObject({ registration: "confirmed", reminderEnabled: true, reminderState: "scheduled" })
    await requestPlace(context, activities, eventId, "p-nadia")
    expect(eventView(activities, eventId)).toMatchObject({ reminderEnabled: false, reminderState: "off" })
    expect(context.store.getState().notifications).toBe(notifications)
    expect(stored(context).registrations.every((row) => row.reminderRecordedForStartAt === undefined)).toBe(true)
  })

  it("expire à J-1 sans reçu et conserve le choix expiré lorsqu'une personne est promue après l'échéance", async () => {
    const context = setup()
    const eventId = await event(context, { ...later, capacity: 1 })
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-nadia")
    await requestPlace(context, activities, eventId, "p-clarisse")
    await activities.events.setReminder({ eventId, enabled: true })
    clock = NOW + 24 * HOUR
    expect(await activities.events.setReminder({ eventId, enabled: true })).toEqual({ ok: false, code: "association_event_reminder_too_late" })
    const before = context.storage.getItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY)
    expect(eventView(activities, eventId)).toMatchObject({ registration: "waitlisted", reminderEnabled: true, reminderState: "expired", reminderAt: clock })
    expect(context.storage.getItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY)).toBe(before)
    await withdrawPlace(context, activities, eventId, "p-nadia")
    await as(context.store, "p-clarisse")
    expect(eventView(activities, eventId)).toMatchObject({ registration: "confirmed", reminderEnabled: true, reminderState: "expired" })
    await act(async () => { await activities.events.setReminder({ eventId, enabled: false }) })
    expect(eventView(activities, eventId)).toMatchObject({ reminderEnabled: false, reminderAt: null, reminderState: "off" })
  })

  it("ne projette que le choix du compte courant et autorise sa désactivation après perte d'accès", async () => {
    const context = setup()
    const eventId = await event(context, later)
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-nadia")
    await activities.events.setReminder({ eventId, enabled: true })
    const detail = renderHook(() => activities.events.useEvent(eventId))
    expect(ready(detail.result.current)).toMatchObject({ reminderEnabled: true, reminderState: "scheduled" })
    await as(context.store, "p-clarisse")
    expect(ready(detail.result.current)).toMatchObject({ reminderEnabled: false, reminderAt: null, reminderState: "off" })
    expect(await activities.events.setReminder({ eventId, enabled: true })).toEqual({ ok: false, code: "not_found" })
    await as(context.store, "p-nadia")
    await act(async () => { await context.associations.capability.leave(PAGE) })
    expect(ready(detail.result.current)).toBeNull()
    expect(await activities.events.setReminder({ eventId, enabled: true })).toEqual({ ok: false, code: "not_found" })
    await act(async () => { expect(await activities.events.setReminder({ eventId, enabled: false })).toEqual({ ok: true, value: null }) })
    expect(stored(context).registrations.find((row) => row.personId === "p-nadia")?.reminderEnabled).toBe(false)
  })

  it("permet au membre réseau en attente de gérer un choix existant sans nouvelle admission", async () => {
    const context = setup()
    const eventId = await event(context, { ...later, audience: "network" })
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-nadia")
    const seed = context.store.getState()
    const changed = setup({ state: { ...seed, memberships: { ...seed.memberships, "p-nadia": { ...seed.memberships["p-nadia"]!, grounds: LIGHT_ACCOUNT_GROUNDS } } } })
    changed.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify(stored(context)))
    const restored = createDemoAssociationActivities(changed.store, changed.deps)
    expect(await restored.events.setReminder({ eventId, enabled: true })).toEqual({ ok: true, value: null })
    expect(eventView(restored, eventId)).toMatchObject({ canRegister: false, reminderEnabled: true, reminderState: "scheduled" })
    expect(await restored.events.register(eventId)).toMatchObject({ ok: false })
    expect(await restored.events.setReminder({ eventId, enabled: false })).toEqual({ ok: true, value: null })
  })

  it.each(["cancelled", "pending_review"] as const)("conserve le choix mais ne programme pas de rappel pour un événement %s", async (state) => {
    const context = setup()
    const eventId = await event(context, later)
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-steeve")
    await activities.events.setReminder({ eventId, enabled: true })
    if (state === "cancelled") await activities.events.cancel({ eventId, expectedVersion: 1 })
    else await activities.events.update({ ...eventInput({ ...later, title: "Programme modifié de démonstration" }), eventId, expectedVersion: 1 })
    expect(eventView(activities, eventId)).toMatchObject({ registrationOpen: false, reminderEnabled: true, reminderState: "expired", reminderAt: NOW + 24 * HOUR })
    expect(await activities.events.setReminder({ eventId, enabled: true })).toEqual({ ok: false, code: "not_found" })
    expect(await activities.events.setReminder({ eventId, enabled: false })).toEqual({ ok: true, value: null })
  })

  it("conserve un reçu de fixture sans le réémettre après off, retrait ou réinscription au même début", async () => {
    const context = setup()
    const eventId = await event(context, later)
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-nadia")
    const fixture = stored(context)
    context.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify({ ...fixture, registrations: fixture.registrations.map((row) => ({ ...row, reminderEnabled: true, reminderRecordedForStartAt: later.startAt })) }))
    const restored = createDemoAssociationActivities(context.store, context.deps)
    expect(eventView(restored, eventId)).toMatchObject({ reminderEnabled: true, reminderState: "recorded" })
    await restored.events.setReminder({ eventId, enabled: false })
    expect(eventView(restored, eventId)).toMatchObject({ reminderEnabled: false, reminderState: "off", reminderAt: null })
    await restored.events.setReminder({ eventId, enabled: true })
    expect(eventView(restored, eventId)?.reminderState).toBe("recorded")
    await withdrawPlace(context, restored, eventId, "p-nadia")
    await requestPlace(context, restored, eventId, "p-nadia")
    expect(eventView(restored, eventId)).toMatchObject({ reminderEnabled: false, reminderState: "off" })
    await restored.events.setReminder({ eventId, enabled: true })
    clock = NOW + 24 * HOUR
    expect(eventView(restored, eventId)?.reminderState).toBe("recorded")
    await restored.events.setReminder({ eventId, enabled: false })
    expect(await restored.events.setReminder({ eventId, enabled: true })).toEqual({ ok: true, value: null })
    expect(eventView(restored, eventId)?.reminderState).toBe("recorded")
    expect(stored(context).registrations[0]?.reminderRecordedForStartAt).toBe(later.startAt)
    expect(eventView(restored, eventId)).not.toHaveProperty("reminderRecordedForStartAt")
    clock = later.startAt
    expect(await restored.events.setReminder({ eventId, enabled: true })).toEqual({ ok: false, code: "not_found" })
    expect(await restored.events.setReminder({ eventId, enabled: false })).toEqual({ ok: true, value: null })
  })
})

describe("DG-023 — présences QR de démonstration", () => {
  it("borne la fenêtre et le TTL, renouvelle le billet sans rendre son secret dans les lectures", async () => {
    const context = setup()
    const eventId = await event(context)
    const activities = publishedFixture(context)
    const attendance = attendanceOf(activities)
    expect(attendance.mode).toBe("demonstration")
    await requestPlace(context, activities, eventId, "p-nadia")
    expect(await attendance.issueTicket(eventId)).toEqual({ ok: false, code: "association_event_attendance_closed" })
    clock = NOW + 23 * HOUR
    const first = await issue(context, activities, eventId)
    expect(first.code).toMatch(/^diasporale-attendance:v1:[0-9a-f]{64}$/)
    expect(first.expiresAt).toBe(clock + 15 * 60_000)
    expect(attendanceView(activities, eventId)).toMatchObject({ opensAt: clock, closesAt: NOW + 26 * HOUR, isOpen: true, canIssueTicket: true, checkedInAt: null, version: 1, recordedCount: null })
    const second = await issue(context, activities, eventId)
    expect(second.code).not.toBe(first.code)
    expect(attendanceView(activities, eventId)?.version).toBe(2)
    await as(context.store, "p-steeve")
    expect(await attendance.previewTicket({ eventId, code: first.code })).toEqual({ ok: false, code: "not_found" })
    expect((await attendance.previewTicket({ eventId, code: second.code })).ok).toBe(true)
    expect(JSON.stringify(attendanceView(activities, eventId))).not.toContain(second.code.slice("diasporale-attendance:v1:".length))
    expect(JSON.stringify(eventView(activities, eventId))).not.toContain("attendanceNonce")
    clock = second.expiresAt
    expect(await attendance.previewTicket({ eventId, code: second.code })).toEqual({ ok: false, code: "not_found" })
    expect(await attendance.previewTicket({ eventId, code: "https://unrelated.invalid/qr" })).toEqual({ ok: false, code: "not_found" })
    clock = NOW + 26 * HOUR - 5 * 60_000
    const last = await issue(context, activities, eventId)
    expect(last.expiresAt).toBe(NOW + 26 * HOUR)
    clock = last.expiresAt
    expect(await attendance.issueTicket(eventId)).toEqual({ ok: false, code: "association_event_attendance_closed" })
  })

  it("prévisualise sans pointer, confirme une fois, puis corrige avec CAS sans retirer l'inscription", async () => {
    const context = setup()
    const eventId = await event(context)
    const activities = publishedFixture(context)
    const attendance = attendanceOf(activities)
    await requestPlace(context, activities, eventId, "p-nadia")
    clock = NOW + 23 * HOUR
    const ticket = await issue(context, activities, eventId)
    await as(context.store, "p-steeve")
    const preview = await attendance.previewTicket({ eventId, code: ticket.code })
    if (!preview.ok) throw new Error(preview.code)
    expect(preview.value).toMatchObject({ checkedInAt: null, version: 1, expiresAt: ticket.expiresAt })
    expect(preview.value.registrationId).not.toContain("p-nadia")
    expect(preview.value).not.toHaveProperty("personId")
    expect(preview.value).not.toHaveProperty("attendanceNonce")
    expect(attendanceView(activities, eventId)?.recordedCount).toBe(0)
    expect(await attendance.checkIn({ eventId, code: ticket.code, expectedVersion: 0 })).toEqual({ ok: false, code: "association_event_attendance_changed" })
    await act(async () => { expect(await attendance.checkIn({ eventId, code: ticket.code, expectedVersion: preview.value.version })).toEqual({ ok: true, value: { alreadyRecorded: false } }) })
    const recorded = stored(context)
    expect(attendanceView(activities, eventId)).toMatchObject({ recordedCount: 1, checkedInAt: null, version: 0 })
    clock += 1
    expect(await attendance.checkIn({ eventId, code: ticket.code, expectedVersion: preview.value.version })).toEqual({ ok: true, value: { alreadyRecorded: true } })
    expect(stored(context)).toEqual(recorded)
    await as(context.store, "p-nadia")
    expect(attendanceView(activities, eventId)).toMatchObject({ checkedInAt: NOW + 23 * HOUR, version: 2, recordedCount: null })
    expect(renderHook(() => attendance.usePresent({ eventId, cursor: null })).result.current).toEqual({ status: "error", code: "not_found" })
    await as(context.store, "p-steeve")
    const present = ready(renderHook(() => attendance.usePresent({ eventId, cursor: null })).result.current).items[0]!
    expect(await attendance.clear({ eventId, registrationId: present.registrationId, expectedVersion: 1 })).toEqual({ ok: false, code: "association_event_attendance_changed" })
    await act(async () => { expect(await attendance.clear({ eventId, registrationId: present.registrationId, expectedVersion: 2 })).toEqual({ ok: true, value: null }) })
    expect(attendanceView(activities, eventId)?.recordedCount).toBe(0)
    expect(stored(context).registrations[0]).toMatchObject({ status: "accepted", attendanceVersion: 3 })
    expect(stored(context).registrations[0]).not.toHaveProperty("attendanceNonce")
    expect(stored(context).registrations[0]).not.toHaveProperty("checkedInAt")
    expect(await attendance.previewTicket({ eventId, code: ticket.code })).toEqual({ ok: false, code: "not_found" })
  })

  it("relit le rôle d'accueil et ferme les billets d'une ancienne adhérente tout en permettant la correction neutre", async () => {
    const context = setup()
    const eventId = await event(context)
    const activities = publishedFixture(context)
    const attendance = attendanceOf(activities)
    const admin = createDemoPageAdmin(context.store, { storage: null })
    await requestPlace(context, activities, eventId, "p-nadia")
    clock = NOW + 23 * HOUR
    const ticket = await issue(context, activities, eventId)
    await as(context.store, "p-clarisse")
    expect(await attendance.previewTicket({ eventId, code: ticket.code })).toEqual({ ok: false, code: "not_found" })
    await as(context.store, "p-mireille")
    await admin.management!.respondToInvitation(PAGE, true)
    const preview = await attendance.previewTicket({ eventId, code: ticket.code })
    if (!preview.ok) throw new Error(preview.code)
    await act(async () => { await admin.management!.revokeRole(PAGE, "p-mireille") })
    expect(await attendance.checkIn({ eventId, code: ticket.code, expectedVersion: preview.value.version })).toEqual({ ok: false, code: "not_found" })
    await as(context.store, "p-steeve")
    await attendance.checkIn({ eventId, code: ticket.code, expectedVersion: preview.value.version })
    await as(context.store, "p-nadia")
    await act(async () => { await context.associations.capability.leave(PAGE) })
    expect(attendanceView(activities, eventId)).toBeNull()
    await as(context.store, "p-steeve")
    expect(await attendance.previewTicket({ eventId, code: ticket.code })).toEqual({ ok: false, code: "not_found" })
    const row = ready(renderHook(() => attendance.usePresent({ eventId, cursor: null })).result.current).items[0]!
    expect(row).toMatchObject({ registrationId: preview.value.registrationId, displayName: null, version: 2 })
    await act(async () => { await attendance.clear({ eventId, registrationId: row.registrationId, expectedVersion: row.version }) })
    expect(attendanceView(activities, eventId)?.recordedCount).toBe(0)
  })

  it("autorise un confirmé réseau en attente mais ne transforme jamais la file en admission", async () => {
    const context = setup()
    const eventId = await event(context, { capacity: 1, audience: "network" })
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-nadia")
    await requestPlace(context, activities, eventId, "p-clarisse")
    const seed = context.store.getState()
    const pending = setup({ state: { ...seed, session: { personId: "p-nadia" }, memberships: { ...seed.memberships, "p-nadia": { ...seed.memberships["p-nadia"]!, grounds: LIGHT_ACCOUNT_GROUNDS } } } })
    pending.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify(stored(context)))
    const restored = createDemoAssociationActivities(pending.store, pending.deps)
    clock = NOW + 23 * HOUR
    const ticket = await issue(pending, restored, eventId)
    expect(ticket.code).toMatch(/^diasporale-attendance:v1:[0-9a-f]{64}$/)
    expect(await restored.events.register(eventId)).toEqual({ ok: false, code: "status_insufficient" })
    await as(pending.store, "p-steeve")
    expect(await attendanceOf(restored).checkIn({ eventId, code: ticket.code, expectedVersion: 1 })).toEqual({ ok: true, value: { alreadyRecorded: false } })
    await as(pending.store, "p-clarisse")
    expect(await attendanceOf(restored).issueTicket(eventId)).toEqual({ ok: false, code: "not_found" })
    expect(attendanceView(restored, eventId)).toMatchObject({ canIssueTicket: false, checkedInAt: null, recordedCount: null })
  })

  it("renouvelle un billet déjà pointé sans changer la date et ferme les accès d'un réseau suspendu", async () => {
    const context = setup()
    const eventId = await event(context, { audience: "network" })
    const activities = publishedFixture(context)
    const attendance = attendanceOf(activities)
    await requestPlace(context, activities, eventId, "p-nadia")
    clock = NOW + 23 * HOUR
    const ticket = await issue(context, activities, eventId)
    await as(context.store, "p-steeve")
    await attendance.checkIn({ eventId, code: ticket.code, expectedVersion: 1 })
    const rotated = await issue(context, activities, eventId)
    expect(attendanceView(activities, eventId)).toMatchObject({ checkedInAt: clock, version: 3 })
    await as(context.store, "p-steeve")
    expect(await attendance.previewTicket({ eventId, code: ticket.code })).toEqual({ ok: false, code: "not_found" })
    expect(await attendance.checkIn({ eventId, code: rotated.code, expectedVersion: 0 })).toEqual({ ok: true, value: { alreadyRecorded: true } })
    const seed = context.store.getState()
    const suspended = setup({ state: { ...seed, memberships: { ...seed.memberships, "p-nadia": { ...seed.memberships["p-nadia"]!, grounds: { ...seed.memberships["p-nadia"]!.grounds, suspension: { until: null, readAccess: "none" } } } } } })
    suspended.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify(stored(context)))
    const resumed = createDemoAssociationActivities(suspended.store, suspended.deps)
    expect(await attendanceOf(resumed).previewTicket({ eventId, code: rotated.code })).toEqual({ ok: false, code: "not_found" })
    const row = ready(renderHook(() => attendanceOf(resumed).usePresent({ eventId, cursor: null })).result.current).items[0]!
    expect(row).toMatchObject({ displayName: null, checkedInAt: clock, version: 3 })
    await as(suspended.store, "p-nadia")
    expect(renderHook(() => attendanceOf(resumed).useAttendance(eventId)).result.current).toEqual({ status: "error", code: "suspended" })
    expect(await attendanceOf(resumed).issueTicket(eventId)).toEqual({ ok: false, code: "suspended" })
  })

  it("garde un nom neutre après retrait du profil et invalide présence et QR au retrait puis à la réinscription", async () => {
    const context = setup()
    const eventId = await event(context)
    const activities = publishedFixture(context)
    const attendance = attendanceOf(activities)
    await requestPlace(context, activities, eventId, "p-nadia")
    await act(async () => { await context.store.withdrawProfile("p-nadia") })
    clock = NOW + 23 * HOUR
    const ticket = await issue(context, activities, eventId)
    await as(context.store, "p-steeve")
    const preview = await attendance.previewTicket({ eventId, code: ticket.code })
    if (!preview.ok) throw new Error(preview.code)
    expect(preview.value.displayName).toBeNull()
    await attendance.checkIn({ eventId, code: ticket.code, expectedVersion: preview.value.version })
    await withdrawPlace(context, activities, eventId, "p-nadia")
    expect(attendanceView(activities, eventId)).toMatchObject({ checkedInAt: null, canIssueTicket: false, version: 3 })
    await requestPlace(context, activities, eventId, "p-nadia")
    expect(attendanceView(activities, eventId)).toMatchObject({ checkedInAt: null, canIssueTicket: true, version: 4 })
    await as(context.store, "p-steeve")
    expect(attendanceView(activities, eventId)?.recordedCount).toBe(0)
    expect(await attendance.previewTicket({ eventId, code: ticket.code })).toEqual({ ok: false, code: "not_found" })
  })

  it("la correction reste possible après la fin ou l'annulation ; un billet d'un autre événement ne passe pas", async () => {
    const context = setup()
    const eventId = await event(context)
    const otherId = await event(context, {}, "other-attendance-event")
    const activities = publishedFixture(context)
    const attendance = attendanceOf(activities)
    await requestPlace(context, activities, eventId, "p-nadia")
    clock = NOW + 23 * HOUR
    const ticket = await issue(context, activities, eventId)
    await as(context.store, "p-steeve")
    expect(await attendance.previewTicket({ eventId: otherId, code: ticket.code })).toEqual({ ok: false, code: "not_found" })
    const preview = await attendance.previewTicket({ eventId, code: ticket.code })
    if (!preview.ok) throw new Error(preview.code)
    await attendance.checkIn({ eventId, code: ticket.code, expectedVersion: preview.value.version })
    await activities.events.cancel({ eventId, expectedVersion: 1 })
    clock = NOW + 27 * HOUR
    expect(await attendance.checkIn({ eventId, code: ticket.code, expectedVersion: 1 })).toEqual({ ok: false, code: "association_event_attendance_closed" })
    expect(await attendance.clear({ eventId, registrationId: preview.value.registrationId, expectedVersion: 2 })).toEqual({ ok: true, value: null })
    expect(attendanceView(activities, eventId)).toMatchObject({ isOpen: false, recordedCount: 0 })
  })

  it("pagine les présences au même instant par timestamp/id malgré une correction de la première page", async () => {
    const seed = createDemoSeed(NOW)
    const ids = Array.from({ length: 22 }, (_, index) => `attendance-fixture-${index}`)
    const persons = { ...seed.persons, ...Object.fromEntries(ids.map((id) => [id, { ...seed.persons["p-nadia"]!, id, idn: null, local: null, profile: null, demoAccountKey: null }])) }
    const memberships = { ...seed.memberships, ...Object.fromEntries(ids.map((id) => [id, { ...seed.memberships["p-nadia"]!, personId: id }])) }
    const context = setup({ state: { persons, memberships } })
    const eventId = await event(context, { audience: "network" })
    const fixture = stored(context)
    context.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify({ ...fixture, events: fixture.events.map((row) => ({ ...row, moderation: "published" })), registrations: ids.map((personId, index) => ({ eventId, personId, status: "accepted", registrationId: `presence-fixture-${index}`, checkedInAt: NOW + 23 * HOUR, attendanceVersion: 2 })) }))
    const activities = createDemoAssociationActivities(context.store, context.deps)
    const attendance = attendanceOf(activities)
    clock = NOW + 23 * HOUR
    const list = renderHook((props: { cursor: string | null }) => attendance.usePresent({ eventId, ...props }), { initialProps: { cursor: null as string | null } })
    const first = ready(list.result.current)
    expect(first.items).toHaveLength(20)
    expect(first.isDone).toBe(false)
    const row = first.items[0]!
    await act(async () => { await attendance.clear({ eventId, registrationId: row.registrationId, expectedVersion: row.version }) })
    list.rerender({ cursor: first.continueCursor })
    const second = ready(list.result.current)
    expect(second.items).toHaveLength(2)
    expect(second.isDone).toBe(true)
    expect(new Set([...first.items, ...second.items].map((item) => item.registrationId)).size).toBe(22)
    expect(JSON.stringify(second)).not.toContain("personId")
    list.rerender({ cursor: JSON.stringify(["demo-association-activities", "attendance:other", NOW, "other"]) })
    expect(list.result.current).toEqual({ status: "error", code: "unknown" })
  })

  it("purge les références, le nonce et la présence d'un compte réellement effacé sous watcher", async () => {
    const context = setup()
    const eventId = await event(context)
    const activities = publishedFixture(context)
    const attendance = attendanceOf(activities)
    await requestPlace(context, activities, eventId, "p-nadia")
    clock = NOW + 23 * HOUR
    const ticket = await issue(context, activities, eventId)
    await as(context.store, "p-steeve")
    const preview = await attendance.previewTicket({ eventId, code: ticket.code })
    if (!preview.ok) throw new Error(preview.code)
    await attendance.checkIn({ eventId, code: ticket.code, expectedVersion: preview.value.version })
    renderHook(() => attendance.useAttendance(eventId))
    await as(context.store, "p-nadia")
    await act(async () => { await context.store.deleteMyAccount() })
    expect(stored(context).registrations.some((row) => row.personId === "p-nadia")).toBe(false)
    expect(context.storage.getItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY)).not.toContain(ticket.code.slice("diasporale-attendance:v1:".length))
    await as(context.store, "p-steeve")
    expect(attendanceView(activities, eventId)?.recordedCount).toBe(0)
    expect(ready(renderHook(() => attendance.usePresent({ eventId, cursor: null })).result.current).items).toEqual([])
    expect(await attendance.previewTicket({ eventId, code: ticket.code })).toEqual({ ok: false, code: "not_found" })
  })
})

describe("DG-023 — galerie collective après événement de démonstration", () => {
  it("s'ouvre à la fin exacte sur rafraîchissement et n'expose que la modération explicitement publiée", async () => {
    const context = setup()
    const eventId = await event(context)
    const activities = publishedFixture(context)
    const gallery = galleryOf(activities)
    expect(gallery.mode).toBe("demonstration")
    const state = renderHook((props: { refreshKey: number }) => gallery.useGallery(eventId, props.refreshKey), { initialProps: { refreshKey: 0 } })
    const media = [photo(context)]
    const originalPosts = context.store.getState().posts
    const notifications = context.store.getState().notifications
    expect(ready(state.result.current)).toMatchObject({ available: false, canPublish: false, audience: "association" })
    expect(await gallery.publish({ eventId, body: "", media, idempotencyKey: "gallery-first" })).toEqual({ ok: false, code: "association_event_gallery_not_open" })
    clock = NOW + 26 * HOUR
    state.rerender({ refreshKey: 1 })
    expect(ready(state.result.current)).toMatchObject({ available: true, canPublish: true })
    const created = await gallery.publish({ eventId, body: "  ", media, idempotencyKey: "gallery-first" })
    if (!created.ok) throw new Error(created.code)
    expect(stored(context).gallery[0]).toMatchObject({ eventId, body: "", moderation: "pending_review" })
    expect(stored(context).gallery[0]).not.toHaveProperty("authorId")
    expect(ready(renderHook(() => gallery.useItems({ eventId, cursor: null })).result.current).items).toEqual([])
    const approved = publishedFixture(context)
    const rows = ready(renderHook(() => galleryOf(approved).useItems({ eventId, cursor: null })).result.current)
    expect(rows.items[0]).toMatchObject({ canRemove: true, post: { id: created.value.postId, eventGalleryId: eventId, author: { kind: "page", id: PAGE }, body: "", moderation: "published", visibility: "network", reactionCount: 0, commentCount: 0, isMine: false, share: null } })
    expect(rows.items[0]?.post.media[0]).toMatchObject({ kind: "image", altText: media[0]!.altText, withheld: null })
    expect(rows.items[0]?.post.media[0]).not.toHaveProperty("upload")
    expect(context.store.getState().posts).toBe(originalPosts)
    expect(context.store.getState().notifications).toBe(notifications)
  })

  it("valide tout le lot avant consommation, rejoue le même corps et interdit la réutilisation des images ailleurs", async () => {
    const context = setup()
    const eventId = await event(context)
    const activities = publishedFixture(context)
    const gallery = galleryOf(activities)
    clock = NOW + 26 * HOUR
    const first = photo(context, "  Vue fictive  ")
    const second = photo(context)
    const tooMany = Array.from({ length: 5 }, () => photo(context))
    expect(await gallery.publish({ eventId, body: "", media: [], idempotencyKey: "empty" })).toEqual({ ok: false, code: "association_event_gallery_media_required" })
    expect(await gallery.publish({ eventId, body: "", media: tooMany, idempotencyKey: "too-many" })).toEqual({ ok: false, code: "media_too_many" })
    expect(await gallery.publish({ eventId, body: "", media: [first, first], idempotencyKey: "duplicate" })).toEqual({ ok: false, code: "media_upload_failed" })
    expect(await gallery.publish({ eventId, body: "", media: [first, { ...second, upload: { ...second.upload, sizeBytes: second.upload.sizeBytes + 1 } }], idempotencyKey: "malformed" })).toEqual({ ok: false, code: "media_upload_failed" })
    const input = { eventId, body: "  Souvenir fictif  ", media: [first, second], idempotencyKey: "gallery-pair" }
    const created = await gallery.publish(input)
    if (!created.ok) throw new Error(created.code)
    expect(await gallery.publish({ ...input, body: "Souvenir fictif", media: [{ ...first, altText: "Vue fictive" }, second] })).toEqual({ ok: true, value: { postId: created.value.postId, created: false } })
    const fresh = tooMany[0]!
    expect(await gallery.publish({ ...input, body: "Autre légende", media: [fresh] })).toEqual({ ok: false, code: "unknown" })
    expect(await gallery.publish({ eventId, body: "", media: [fresh], idempotencyKey: "fresh-after-conflict" })).toMatchObject({ ok: true, value: { created: true } })
    expect(context.store.publishPage({ pageId: PAGE, body: "Copie interdite", reach: "diaspora", audience: "public", media: [first], idempotencyKey: "ordinary-page-copy" })).toEqual({ ok: false, code: "media_upload_failed" })
    expect(await gallery.publish({ eventId, body: "", media: [{ upload: { ref: "video-not-simulated", kind: "video", mimeType: "video/mp4", sizeBytes: 100 }, altText: "" }], idempotencyKey: "video" })).toEqual({ ok: false, code: "feature_unavailable" })
    expect(stored(context).gallery).toHaveLength(2)
  })

  it("relit les droits d'association et de responsable, même lors d'un rejeu", async () => {
    const context = setup()
    const eventId = await event(context)
    const activities = publishedFixture(context)
    clock = NOW + 26 * HOUR
    await galleryOf(activities).publish({ eventId, body: "Souvenir", media: [photo(context)], idempotencyKey: "private-gallery" })
    const approved = publishedFixture(context)
    const gallery = galleryOf(approved)
    await as(context.store, "p-nadia")
    const rows = renderHook(() => gallery.useItems({ eventId, cursor: null }))
    expect(ready(rows.result.current).items[0]?.canRemove).toBe(false)
    const media = [photo(context)]
    expect(await gallery.publish({ eventId, body: "", media, idempotencyKey: "member-denied" })).toEqual({ ok: false, code: "not_found" })
    await act(async () => { await context.associations.capability.leave(PAGE) })
    expect(rows.result.current).toEqual({ status: "error", code: "not_found" })
    expect(ready(renderHook(() => gallery.useGallery(eventId)).result.current)).toBeNull()
    const admin = createDemoPageAdmin(context.store, { storage: null })
    await as(context.store, "p-mireille")
    await admin.management!.respondToInvitation(PAGE, true)
    const input = { eventId, body: "L'équipe", media: [photo(context)], idempotencyKey: "live-team" }
    expect(await gallery.publish(input)).toMatchObject({ ok: true, value: { created: true } })
    await act(async () => { await admin.management!.revokeRole(PAGE, "p-mireille") })
    expect(await gallery.publish(input)).toEqual({ ok: false, code: "not_found" })
  })

  it("autorise la lecture réseau en attente, puis retire une ligne liée sans changer les inscriptions, même après annulation", async () => {
    const context = setup()
    const eventId = await event(context, { audience: "network" })
    const otherId = await event(context, { audience: "network" }, "other-gallery")
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-nadia")
    await as(context.store, "p-steeve")
    clock = NOW + 26 * HOUR
    const added = await galleryOf(activities).publish({ eventId, body: "", media: [photo(context)], idempotencyKey: "published-gallery" })
    if (!added.ok) throw new Error(added.code)
    const approved = publishedFixture(context)
    const seed = context.store.getState()
    const pending = setup({ state: { ...seed, session: { personId: "p-nadia" }, memberships: { ...seed.memberships, "p-nadia": { ...seed.memberships["p-nadia"]!, grounds: LIGHT_ACCOUNT_GROUNDS } } } })
    pending.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify(stored(context)))
    const reader = createDemoAssociationActivities(pending.store, pending.deps)
    expect(ready(renderHook(() => galleryOf(reader).useItems({ eventId, cursor: null })).result.current).items).toHaveLength(1)
    expect(await galleryOf(reader).publish({ eventId, body: "", media: [photo(pending)], idempotencyKey: "no-admission" })).toEqual({ ok: false, code: "status_insufficient" })
    const before = stored(context).registrations
    expect(await galleryOf(approved).remove({ eventId: otherId, postId: added.value.postId })).toEqual({ ok: false, code: "not_found" })
    await approved.events.cancel({ eventId, expectedVersion: 1 })
    expect(ready(renderHook(() => galleryOf(approved).useGallery(eventId)).result.current)).toBeNull()
    expect(await galleryOf(approved).remove({ eventId, postId: added.value.postId })).toEqual({ ok: true, value: null })
    expect(stored(context).gallery[0]).toMatchObject({ removedAt: clock, moderation: "removed" })
    expect(stored(context).registrations).toEqual(before)
  })

  it("garde les curseurs des pages filtrées et la propriété collective après effacement du déposant", async () => {
    const context = setup()
    const eventId = await event(context)
    const activities = publishedFixture(context)
    clock = NOW + 26 * HOUR
    await galleryOf(activities).publish({ eventId, body: "Souvenir collectif", media: [photo(context)], idempotencyKey: "collective" })
    const fixture = stored(context)
    const initial = fixture.gallery[0]!
    context.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify({ ...fixture, gallery: Array.from({ length: 21 }, (_, index) => ({ ...initial, id: `gallery-fixture-${index}`, idempotencyKey: `fixture-${index}` })) }))
    const queued = createDemoAssociationActivities(context.store, context.deps)
    const first = ready(renderHook(() => galleryOf(queued).useItems({ eventId, cursor: null })).result.current)
    expect(first).toMatchObject({ items: [], isDone: false })
    expect(first.continueCursor).not.toBeNull()
    const approved = publishedFixture(context)
    const list = renderHook((props: { cursor: string | null }) => galleryOf(approved).useItems({ eventId, ...props }), { initialProps: { cursor: null as string | null } })
    const published = ready(list.result.current)
    expect(published.items).toHaveLength(20)
    list.rerender({ cursor: published.continueCursor })
    expect(ready(list.result.current).items).toHaveLength(1)
    await act(async () => { await context.store.deleteMyAccount() })
    expect(stored(context).gallery).toHaveLength(21)
    expect(stored(context).gallery.every((row) => !("authorId" in row) && !("authorPersonId" in row))).toBe(true)
    await as(context.store, "p-nadia")
    const collective = ready(renderHook(() => galleryOf(approved).useItems({ eventId, cursor: null })).result.current)
    expect(collective.items).toHaveLength(20)
    expect(collective.items[0]?.post.author).toMatchObject({ kind: "page", id: PAGE })
    expect(collective.items[0]?.canRemove).toBe(false)
  })
})

describe("DG-023 — agenda associatif et copie iCalendar de démonstration", () => {
  beforeEach(() => { vi.stubGlobal("crypto", webcrypto) })
  afterEach(() => { vi.unstubAllGlobals() })

  it("montre seulement mes confirmations ou attentes, conserve l'annulation et relit retrait et audience", async () => {
    const context = setup()
    const eventId = await event(context, { capacity: 1 })
    const activities = publishedFixture(context)
    const calendar = calendarOf(activities)
    expect(calendar.mode).toBe("demonstration")
    expect(ready(renderHook(() => calendar.useAgenda({ now: NOW })).result.current)).toEqual({ items: [], truncated: false })
    await requestPlace(context, activities, eventId, "p-nadia")
    await requestPlace(context, activities, eventId, "p-clarisse")
    const agenda = renderHook(() => calendar.useAgenda({ now: NOW }))
    expect(ready(agenda.result.current).items).toMatchObject([{ kind: "association", eventId, pageId: PAGE, registration: "waitlisted", organizer: { name: context.store.getState().pages[PAGE]!.name, handle: context.store.getState().pages[PAGE]!.handle } }])
    expect(ready(agenda.result.current).items[0]).not.toHaveProperty("organizerPersonId")
    const waitingCopy = await calendar.exportIcal(eventId)
    if (!waitingCopy.ok) throw new Error(waitingCopy.code)
    expect(waitingCopy.value.content).toContain("STATUS:TENTATIVE\r\n")
    await as(context.store, "p-steeve")
    await act(async () => { await activities.events.cancel({ eventId, expectedVersion: 1 }) })
    await as(context.store, "p-clarisse")
    expect(ready(agenda.result.current).items[0]).toMatchObject({ status: "cancelled", cancelledAt: NOW, registration: "waitlisted" })
    await withdrawPlace(context, activities, eventId, "p-clarisse")
    expect(ready(agenda.result.current).items).toEqual([])
    await as(context.store, "p-nadia")
    expect(ready(agenda.result.current).items[0]?.registration).toBe("confirmed")
    await act(async () => { await context.associations.capability.leave(PAGE) })
    expect(ready(agenda.result.current).items).toEqual([])
    expect(await calendar.exportIcal(eventId)).toEqual({ ok: false, code: "not_found" })
  })

  it("respecte les bornes inclusives et actualise now/from/to sans changer les droits", async () => {
    const context = setup()
    const first = await event(context, { startAt: NOW + HOUR, endAt: NOW + 2 * HOUR }, "calendar-first")
    const second = await event(context, { startAt: NOW + 3 * HOUR, endAt: NOW + 4 * HOUR }, "calendar-second")
    const activities = publishedFixture(context)
    await requestPlace(context, activities, first, "p-nadia")
    await requestPlace(context, activities, second, "p-nadia")
    const calendar = calendarOf(activities)
    const initialProps: { now: number; from?: number; to?: number } = { now: NOW, from: NOW + HOUR, to: NOW + HOUR }
    const agenda = renderHook((input: { now: number; from?: number; to?: number }) => calendar.useAgenda(input), { initialProps })
    expect(ready(agenda.result.current).items.map((row) => row.eventId)).toEqual([first])
    agenda.rerender({ now: NOW, from: NOW + 3 * HOUR })
    expect(ready(agenda.result.current).items.map((row) => row.eventId)).toEqual([second])
    agenda.rerender({ now: NOW + 5 * HOUR })
    expect(ready(agenda.result.current).items.map((row) => row.eventId)).toEqual([first, second])
    agenda.rerender({ now: NOW, from: NOW + HOUR, to: NOW })
    expect(agenda.result.current).toEqual({ status: "error", code: "unknown" })
  })

  it("réserve le budget brut de 200 aux prochains puis à l'historique, déduplique et signale la lacune", async () => {
    const context = setup()
    await event(context, { audience: "network" })
    const base = stored(context)
    const original = base.events[0]!
    const future = { ...original, id: "calendar-future", moderation: "published" }
    const past = Array.from({ length: 201 }, (_, index) => ({ ...original, id: `calendar-past-${index}`, startAt: NOW - (index + 2) * HOUR, endAt: NOW - (index + 1) * HOUR, moderation: "published" }))
    const events = [future, ...past]
    const registrations = [{ eventId: future.id, personId: "p-nadia", status: "accepted" }, { eventId: future.id, personId: "p-nadia", status: "accepted" }, ...past.map((row, index) => ({ eventId: row.id, personId: "p-nadia", status: index === 0 ? "declined" : "accepted" }))]
    context.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify({ ...base, events, registrations }))
    const activities = createDemoAssociationActivities(context.store, context.deps)
    await as(context.store, "p-nadia")
    const agenda = ready(renderHook(() => calendarOf(activities).useAgenda({ now: NOW })).result.current)
    expect(agenda.truncated).toBe(true)
    expect(agenda.items.some((row) => row.eventId === future.id)).toBe(true)
    expect(agenda.items.some((row) => row.eventId === past[0]!.id)).toBe(false)
    expect(new Set(agenda.items.map((row) => row.eventId)).size).toBe(agenda.items.length)
    expect(agenda.items.length).toBeLessThan(200)
    expect(agenda.items.some((row) => row.eventId === past[200]!.id)).toBe(false)
    context.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify({ ...base, events: past.slice(0, 200), registrations: past.slice(0, 200).map((row) => ({ eventId: row.id, personId: "p-nadia", status: "accepted" })) }))
    const exact = createDemoAssociationActivities(context.store, context.deps)
    expect(ready(renderHook(() => calendarOf(exact).useAgenda({ now: NOW })).result.current)).toMatchObject({ truncated: true, items: expect.any(Array) })
  })

  it("exporte à tout lecteur actuel, garde l'UID entre versions et ne crée ni présence ni notification", async () => {
    const context = setup()
    const eventId = await event(context, { audience: "network" })
    expect(await calendarOf(context).exportIcal(eventId)).toEqual({ ok: false, code: "not_found" })
    const activities = publishedFixture(context)
    const calendar = calendarOf(activities)
    const before = context.storage.getItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY)
    const posts = context.store.getState().posts
    const notifications = context.store.getState().notifications
    const first = await calendar.exportIcal(eventId)
    if (!first.ok) throw new Error(first.code)
    expect(first.value).toMatchObject({ filename: "diasporale-event.ics", mediaType: "text/calendar;charset=utf-8" })
    expect(first.value.content).toContain("STATUS:TENTATIVE\r\n")
    const uid = first.value.content.split("\r\n").find((line) => line.startsWith("UID:"))!
    expect(uid).toMatch(/^UID:[0-9a-f]{64}$/)
    expect(first.value.content).not.toMatch(/ATTENDEE:|ORGANIZER:|URL:|VALARM|diasporale-attendance|p-steeve|p-nadia/)
    expect(context.storage.getItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY)).toBe(before)
    await requestPlace(context, activities, eventId, "p-nadia")
    const confirmed = await calendar.exportIcal(eventId)
    if (!confirmed.ok) throw new Error(confirmed.code)
    expect(confirmed.value.content).toContain(uid)
    expect(confirmed.value.content).toContain("STATUS:CONFIRMED\r\n")
    await as(context.store, "p-steeve")
    clock += 1000
    await activities.events.update({ ...eventInput({ audience: "network", capacity: 3 }), eventId, expectedVersion: 1 })
    await activities.events.cancel({ eventId, expectedVersion: 2 })
    const cancelled = await calendar.exportIcal(eventId)
    if (!cancelled.ok) throw new Error(cancelled.code)
    expect(cancelled.value.content).toContain(uid)
    expect(cancelled.value.content).toContain("STATUS:CANCELLED\r\n")
    expect(cancelled.value.content).toContain("SEQUENCE:3\r\n")
    expect(context.store.getState().posts).toBe(posts)
    expect(context.store.getState().notifications).toBe(notifications)
    expect(stored(context).registrations).toHaveLength(1)
  })

  it("lit et exporte en attente, migre les anciens timestamps sans écrire et garde le calendrier d'un autre lecteur privé", async () => {
    const context = setup()
    const eventId = await event(context, { audience: "network" })
    const activities = publishedFixture(context)
    await requestPlace(context, activities, eventId, "p-nadia")
    const state = stored(context)
    const seed = context.store.getState()
    const pending = setup({ state: { ...seed, memberships: { ...seed.memberships, "p-nadia": { ...seed.memberships["p-nadia"]!, grounds: LIGHT_ACCOUNT_GROUNDS } } } })
    const legacy = { ...state, events: state.events.map(({ updatedAt, cancelledAt, ...row }) => { void updatedAt; void cancelledAt; return row }) }
    pending.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify(legacy))
    const restored = createDemoAssociationActivities(pending.store, pending.deps)
    const before = pending.storage.getItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY)
    const agenda = renderHook(() => calendarOf(restored).useAgenda({ now: NOW }))
    expect(ready(agenda.result.current).items[0]?.eventId).toBe(eventId)
    const file = await calendarOf(restored).exportIcal(eventId)
    if (!file.ok) throw new Error(file.code)
    expect(file.value.content).toContain("STATUS:CONFIRMED\r\n")
    expect(file.value.content).toContain("LAST-MODIFIED:20261018T100000Z\r\n")
    expect(pending.storage.getItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY)).toBe(before)
    await as(pending.store, "p-clarisse")
    expect(ready(agenda.result.current).items).toEqual([])
    const copy = await calendarOf(restored).exportIcal(eventId)
    if (!copy.ok) throw new Error(copy.code)
    expect(copy.value.content).toContain("STATUS:TENTATIVE\r\n")
    expect(copy.value.content.match(/UID:[^\r]+/)?.[0]).toBe(file.value.content.match(/UID:[^\r]+/)?.[0])
  })

  it("abandonne un export si le compte change pendant le calcul de son UID", async () => {
    const context = setup()
    const eventId = await event(context, { audience: "network" })
    const activities = publishedFixture(context)
    let release: (value: ArrayBuffer) => void = () => { throw new Error("Calcul non démarré") }
    vi.stubGlobal("crypto", { subtle: { digest: () => new Promise<ArrayBuffer>((resolve) => { release = resolve }) } })
    const pending = calendarOf(activities).exportIcal(eventId)
    await as(context.store, "p-clarisse")
    release(new ArrayBuffer(32))
    expect(await pending).toEqual({ ok: false, code: "not_found" })
  })
})

describe("DG-023 — pagination de l'agenda associatif de démonstration", () => {
  async function fixture(count: number, options: { readonly privateAudience?: boolean; readonly pendingNetwork?: boolean } = {}) {
    const seed = createDemoSeed(NOW)
    const context = setup(options.pendingNetwork ? { state: { memberships: { ...seed.memberships, "p-nadia": { ...seed.memberships["p-nadia"]!, grounds: LIGHT_ACCOUNT_GROUNDS } } } } : {})
    await event(context, { audience: options.privateAudience ? "association" : "network" })
    const data = stored(context)
    const original = data.events[0]!
    const events = Array.from({ length: count }, (_, index) => ({ ...original, id: `agenda-page-${String(index).padStart(3, "0")}`, idempotencyKey: `agenda-key-${index}`, moderation: "published" }))
    context.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify({ ...data, events, registrations: events.map((row) => ({ eventId: row.id, personId: "p-nadia", status: "accepted" })) }))
    const activities = createDemoAssociationActivities(context.store, context.deps)
    await as(context.store, "p-nadia")
    return { context, activities, events }
  }
  const firstInput = { anchor: NOW, period: "upcoming" as "upcoming" | "history", cursor: null as string | null, readerPersonId: "p-nadia" }

  it("parcourt plus de 200 dates identiques sans saut et garde la frontière après émission d'un QR", async () => {
    const { context, activities } = await fixture(225)
    const calendar = calendarOf(activities)
    const page = renderHook((input: typeof firstInput) => calendar.useAgendaPage!(input), { initialProps: firstInput })
    const first = ready(page.result.current)
    expect(first.items).toHaveLength(20)
    expect(first.isDone).toBe(false)
    const stable = page.result.current
    page.rerender(firstInput)
    expect(page.result.current).toBe(stable)
    clock = NOW + 23 * HOUR
    await issue(context, activities, first.items[19]!.eventId)
    const ids = first.items.map((row) => row.eventId)
    let cursor = first.continueCursor
    for (let count = 0; cursor !== null && count < 20; count += 1) {
      page.rerender({ ...firstInput, cursor })
      const next = ready(page.result.current)
      ids.push(...next.items.map((row) => row.eventId))
      cursor = next.continueCursor
      if (next.isDone) expect(cursor).toBeNull()
    }
    expect(cursor).toBeNull()
    expect(ids).toHaveLength(225)
    expect(new Set(ids).size).toBe(225)
    expect(ids[0]).toBe("agenda-page-000")
    expect(ids[224]).toBe("agenda-page-224")
  })

  it("conserve une page brute vide, filtre les fenêtres invalides et garde attentes et annulations lisibles", async () => {
    const { context, activities } = await fixture(45)
    const data = stored(context)
    context.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify({ ...data,
      events: data.events.map((row, index) => index >= 10 && index < 20 ? { ...row, moderation: "pending_review" } : index === 21 ? { ...row, status: "cancelled", cancelledAt: NOW } : index === 22 ? { ...row, endAt: row.startAt } : row),
      registrations: data.registrations.map((row, index) => index < 10 ? { ...row, status: "declined" } : index === 20 ? { ...row, status: "pending", sequence: 1 } : row),
    }))
    const calendar = calendarOf(activities)
    const page = renderHook((input: typeof firstInput) => calendar.useAgendaPage!(input), { initialProps: firstInput })
    const first = ready(page.result.current)
    expect(first).toMatchObject({ items: [], isDone: false })
    expect(first.continueCursor).not.toBeNull()
    page.rerender({ ...firstInput, cursor: first.continueCursor })
    const second = ready(page.result.current)
    expect(second.items).toHaveLength(19)
    expect(second.items[0]).toMatchObject({ eventId: "agenda-page-020", registration: "waitlisted" })
    expect(second.items[1]).toMatchObject({ eventId: "agenda-page-021", status: "cancelled", cancelledAt: NOW })
    expect(second.items.some((row) => row.eventId === "agenda-page-022")).toBe(false)
    expect(second.isDone).toBe(false)
    page.rerender({ ...firstInput, cursor: second.continueCursor })
    expect(ready(page.result.current)).toMatchObject({ items: expect.any(Array), isDone: true, continueCursor: null })
    expect(ready(page.result.current).items).toHaveLength(5)
  })

  it.each(["reader", "seed", "anchor", "period", "malformed", "version"] as const)("refuse un curseur hors contexte %s", async (changed) => {
    const { activities } = await fixture(25)
    const calendar = calendarOf(activities)
    const page = renderHook((input: typeof firstInput) => calendar.useAgendaPage!(input), { initialProps: firstInput })
    const cursor = ready(page.result.current).continueCursor!
    const parsed = JSON.parse(cursor) as unknown[]
    if (changed === "seed") parsed[3] = NOW - 1
    if (changed === "version") parsed[1] = 2
    page.rerender({ ...firstInput,
      readerPersonId: changed === "reader" ? "p-clarisse" : "p-nadia",
      anchor: changed === "anchor" ? NOW + 1 : NOW,
      period: changed === "period" ? "history" : "upcoming",
      cursor: changed === "malformed" ? "{invalid" : JSON.stringify(parsed),
    })
    expect(page.result.current).toEqual({ status: "error", code: changed === "malformed" || changed === "version" ? "unknown" : "not_found" })
  })

  it("relit le lecteur et les droits à chaque page, sans confondre une page cachée avec la fin", async () => {
    const { context, activities } = await fixture(45, { privateAudience: true, pendingNetwork: true })
    const calendar = calendarOf(activities)
    const page = renderHook((input: typeof firstInput) => calendar.useAgendaPage!(input), { initialProps: firstInput })
    const cursor = ready(page.result.current).continueCursor
    expect(ready(page.result.current).items).toHaveLength(20)
    await as(context.store, "p-clarisse")
    expect(page.result.current).toEqual({ status: "error", code: "not_found" })
    page.rerender({ ...firstInput, readerPersonId: "p-clarisse", cursor })
    expect(page.result.current).toEqual({ status: "error", code: "not_found" })
    page.rerender({ ...firstInput, readerPersonId: "p-clarisse" })
    expect(ready(page.result.current)).toEqual({ items: [], isDone: true, continueCursor: null })
    await as(context.store, "p-nadia")
    // Le retrait de l'association est permis en lecture, même pour un membre réseau en attente.
    await act(async () => { await context.associations.capability.leave(PAGE) })
    page.rerender({ ...firstInput, cursor })
    const hidden = ready(page.result.current)
    expect(hidden.items).toEqual([])
    expect(hidden.isDone).toBe(false)
    expect(hidden.continueCursor).not.toBeNull()
  })

  it("sépare la frontière fixe upcoming inclusive de l'historique décroissant exclusif", async () => {
    const { context, activities } = await fixture(5)
    const data = stored(context)
    context.storage.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify({ ...data, events: data.events.map((row, index) => ({ ...row, startAt: NOW + (index - 2) * HOUR, endAt: NOW + (index - 1) * HOUR })) }))
    const calendar = calendarOf(activities)
    const page = renderHook((input: typeof firstInput) => calendar.useAgendaPage!(input), { initialProps: firstInput })
    expect(ready(page.result.current).items.map((row) => row.eventId)).toEqual(["agenda-page-002", "agenda-page-003", "agenda-page-004"])
    page.rerender({ ...firstInput, period: "history" })
    expect(ready(page.result.current).items.map((row) => row.eventId)).toEqual(["agenda-page-001", "agenda-page-000"])
    expect(ready(page.result.current)).toMatchObject({ isDone: true, continueCursor: null })
  })
})
