// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import { cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEngineAssociationActivities } from "./engine-association-activities"

const mocks = vi.hoisted(() => ({ auth: { isAuthenticated: true, isPending: false, isUnauthenticated: false }, network: { _id: "network-diasporale" } as unknown, membership: undefined as unknown, person: undefined as unknown, rows: new Map<string, unknown>(), loaded: vi.fn() }))
vi.mock("@antsia/api/hooks", () => ({ useStableConvexAuth: () => mocks.auth }))
vi.mock("convex/react", () => ({
  useQueries: (queries: Record<string, { query: Parameters<typeof getFunctionName>[0]; args: unknown }>) => {
    if (!queries.value) return {}
    const name = getFunctionName(queries.value.query)
    mocks.loaded(name, queries.value.args)
    if (name === "modules/networks/networks:getBySlug") return { value: mocks.network }
    if (name === "modules/diaspora/membership:myMembership") return { value: mocks.membership }
    if (name === "modules/people/persons:getMyPerson") return { value: mocks.person }
    return mocks.rows.has(name) ? { value: mocks.rows.get(name) } : {}
  },
}))
const MEMBER = { status: "declaree", capabilities: ["read_network", "publish"] }
const GROUP = { groupId: "group-1", pageId: "page-1", name: "Association de démonstration", state: "active", role: "moderator", isMember: true, canJoin: false, canManage: false, canPublish: true }
const EVENT_INPUT = { pageId: "page-1", title: "Rencontre de démonstration", description: "Programme de démonstration.", location: "Salle de démonstration", startAt: 1_800_000_000_000, endAt: 1_800_003_600_000, timeZone: "Europe/Paris", audience: "association" as const }
const EVENT = { ...EVENT_INPUT, eventId: "event-1", status: "scheduled", version: 2, organizer: { name: "Association de démonstration", handle: "association-demo" }, moderation: "published", isRegistered: false, canManage: true, canRegister: true, capacity: null, confirmedCount: 0, waitlistCount: 0, remainingPlaces: null, registration: "none", waitlistPosition: null, registrationClosesAt: null, registrationOpen: true, reminderEnabled: false, reminderAt: null, reminderState: "off" }
const POST = { postId: "post-1", body: "Texte dans le groupe.", author: { displayName: "Membre de démonstration" }, createdAt: 10, isMine: false, canRemove: true, moderation: "published" }
function setup() {
  const query = vi.fn(async (_ref: unknown, _args: unknown): Promise<unknown> => mocks.network)
  const mutation = vi.fn(async (_ref: unknown, _args: unknown): Promise<unknown> => null)
  const convex = { query, mutation } as unknown as ConvexReactClient
  return { query, mutation, ...createEngineAssociationActivities({ convex, authClient: {} as EngineAuthClient }) }
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
  mocks.network = { _id: "network-diasporale" }
  mocks.membership = { ...MEMBER }
  mocks.person = { _id: "person-reader" }
  mocks.rows.clear()
})
afterEach(cleanup)

describe("activités associatives — fournisseur moteur", () => {
  it("lit la seule projection du groupe de la page et garde une référence stable", () => {
    mocks.rows.set("modules/diaspora/associationGroups:groupForPage", { ...GROUP, members: ["private-member"] })
    const { groups } = setup()
    const { result, rerender } = renderHook(() => groups.useGroup("page-1"))
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/diaspora/associationGroups:groupForPage", { networkId: "network-diasporale", pageId: "page-1" })
    expect(result.current).toEqual({ status: "ready", data: GROUP })
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
    mocks.rows.set("modules/diaspora/associationGroups:groupForPage", null)
    rerender()
    expect(result.current).toEqual({ status: "ready", data: null })
  })

  it("lit vingt publications privées par curseur opaque, sans identifiants ni lien de profil", () => {
    mocks.rows.set("modules/diaspora/associationGroups:posts", { items: [{ ...POST, authorId: "private-person", author: { ...POST.author, personId: "private-person", handle: "private-handle" } }], continueCursor: "opaque-next", isDone: false })
    const { groups } = setup()
    const { result, rerender } = renderHook((props: { cursor: string | null }) => groups.usePosts({ groupId: "group-1", ...props }), { initialProps: { cursor: null as string | null } })
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/diaspora/associationGroups:posts", { networkId: "network-diasporale", groupId: "group-1", paginationOpts: { cursor: null, numItems: 20 } })
    expect(result.current).toEqual({ status: "ready", data: { items: [POST], continueCursor: "opaque-next", isDone: false } })
    expect(JSON.stringify(result.current)).not.toContain("private-")
    rerender({ cursor: "opaque-next" })
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/diaspora/associationGroups:posts", { networkId: "network-diasporale", groupId: "group-1", paginationOpts: { cursor: "opaque-next", numItems: 20 } })
    mocks.rows.set("modules/diaspora/associationGroups:posts", { items: [{ ...POST, canRemove: false, moderation: "pending_review", isMine: true }], continueCursor: "fin", isDone: true })
    rerender({ cursor: null })
    expect(result.current.status === "ready" && result.current.data.items[0]?.canRemove).toBe(false)
    expect(result.current.status === "ready" && result.current.data.items[0]?.moderation).toBe("pending_review")
    mocks.rows.set("modules/diaspora/associationGroups:posts", new ConvexError({ code: "notFound" }))
    rerender({ cursor: null })
    expect(result.current).toEqual({ status: "error", code: "not_found" })
  })

  it("laisse le serveur valider le curseur et ferme une autorisation retirée", () => {
    mocks.rows.set("modules/diaspora/associationGroups:posts", new ConvexError({ code: "invalidArgument" }))
    const { groups } = setup()
    const { result, rerender } = renderHook((props: { cursor: string | null }) => groups.usePosts({ groupId: "group-1", ...props }), { initialProps: { cursor: "[broken" as string | null } })
    expect(result.current).toEqual({ status: "error", code: "unknown" })
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/diaspora/associationGroups:posts", { networkId: "network-diasporale", groupId: "group-1", paginationOpts: { cursor: "[broken", numItems: 20 } })
    mocks.rows.set("modules/diaspora/associationGroups:posts", new ConvexError({ code: "notFound" }))
    rerender({ cursor: null })
    expect(result.current).toEqual({ status: "error", code: "not_found" })
  })

  it.each([
    { label: "sans session", setup: () => { mocks.auth = { isAuthenticated: false, isPending: false, isUnauthenticated: true } }, code: "not_signed_in" },
    { label: "sans adhésion", setup: () => { mocks.membership = null }, code: "not_member" },
    { label: "suspendue", setup: () => { mocks.membership = { status: "suspendue", capabilities: [] } }, code: "suspended" },
  ])("refuse les lectures $label avant toute activité", ({ setup: refuse, code }) => {
    refuse()
    const { groups, events } = setup()
    expect(renderHook(() => groups.useGroup("page-1")).result.current).toEqual({ status: "error", code })
    expect(renderHook(() => events.useEvents({ pageId: "page-1", cursor: null })).result.current).toEqual({ status: "error", code })
    expect(renderHook(() => events.useEvent("event-1")).result.current).toEqual({ status: "error", code })
    expect(mocks.loaded.mock.calls.some(([name]) => String(name).includes("pageEvents:") || String(name).includes("associationGroups:"))).toBe(false)
  })

  it("permet au membre en attente les lectures réactives des événements avec projection allowlistée", () => {
    mocks.membership = { status: "en_attente", capabilities: ["read_network"] }
    mocks.rows.set("modules/events/pageEvents:listForPage", { items: [{ ...EVENT, participants: ["private-person"], organizer: { ...EVENT.organizer, email: "private-email" } }], continueCursor: "fin", isDone: true })
    mocks.rows.set("modules/events/pageEvents:get", EVENT)
    const { events } = setup()
    expect(renderHook(() => events.useEvents({ pageId: "page-1", cursor: "suite" })).result.current).toEqual({ status: "ready", data: { items: [EVENT], continueCursor: null, isDone: true } })
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/events/pageEvents:listForPage", { networkId: "network-diasporale", pageId: "page-1", paginationOpts: { cursor: "suite", numItems: 20 } })
    const { result, rerender } = renderHook(() => events.useEvent("event-1"))
    expect(result.current).toEqual({ status: "ready", data: EVENT })
    mocks.rows.set("modules/events/pageEvents:get", null)
    rerender()
    expect(result.current).toEqual({ status: "ready", data: null })
  })

  it("borne les gestes de groupe au réseau et publie uniquement dans le groupe sans racine", async () => {
    const { groups, mutation } = setup()
    mutation.mockResolvedValueOnce({ groupId: "group-1", created: true })
    expect(await groups.create({ pageId: "page-1", idempotencyKey: "group-key" })).toEqual({ ok: true, value: { groupId: "group-1", created: true } })
    await groups.join("group-1")
    await groups.leave("group-1")
    await groups.close("group-1")
    await groups.publish({ groupId: "group-1", body: POST.body, idempotencyKey: "post-key" })
    await groups.removePost({ groupId: "group-1", postId: "post-1", isMine: true })
    await groups.removePost({ groupId: "group-1", postId: "post-2", isMine: false })
    const networkId = "network-diasporale"
    expect(mutation.mock.calls.map(([ref, args]) => [getFunctionName(ref as never), args])).toEqual([
      ["modules/diaspora/associationGroups:createGroupForPage", { networkId, pageId: "page-1", idempotencyKey: "group-key" }],
      ["modules/thematicGroups/thematicGroups:join", { networkId, groupId: "group-1" }],
      ["modules/thematicGroups/thematicGroups:leave", { networkId, groupId: "group-1" }],
      ["modules/thematicGroups/thematicGroups:closeGroup", { networkId, groupId: "group-1" }],
      ["modules/posts/posts:publish", { networkId, groupId: "group-1", body: POST.body, idempotencyKey: "post-key", audience: "group", reach: "diaspora", alsoOnRoot: false }],
      ["modules/posts/posts:remove", { networkId, postId: "post-1" }],
      ["modules/thematicGroups/thematicGroups:removeGroupPost", { networkId, postId: "post-2" }],
    ])
  })

  it("transmet les versions et audiences aux seules API d'événements de page", async () => {
    const { events, mutation } = setup()
    mutation.mockResolvedValueOnce({ eventId: "event-1", created: false })
    expect(await events.create({ ...EVENT_INPUT, idempotencyKey: "event-key" })).toEqual({ ok: true, value: { eventId: "event-1", created: false } })
    await events.update({ ...EVENT_INPUT, eventId: "event-1", expectedVersion: 2 })
    await events.cancel({ eventId: "event-1", expectedVersion: 3 })
    await events.register("event-1")
    await events.unregister("event-1")
    const networkId = "network-diasporale"
    expect(mutation.mock.calls.map(([ref, args]) => [getFunctionName(ref as never), args])).toEqual([
      ["modules/events/pageEvents:create", { networkId, ...EVENT_INPUT, idempotencyKey: "event-key" }],
      ["modules/events/pageEvents:update", { networkId, ...EVENT_INPUT, eventId: "event-1", expectedVersion: 2 }],
      ["modules/events/pageEvents:cancel", { networkId, eventId: "event-1", expectedVersion: 3 }],
      ["modules/events/pageEvents:register", { networkId, eventId: "event-1" }],
      ["modules/events/pageEvents:unregister", { networkId, eventId: "event-1" }],
    ])
  })

  it("projette les compteurs et mon seul rang, sans exposer la file ni les identités", () => {
    const waiting = { ...EVENT, capacity: 2, confirmedCount: 2, waitlistCount: 3, remainingPlaces: 0, registration: "waitlisted", waitlistPosition: 2, canRegister: false }
    mocks.rows.set("modules/events/pageEvents:get", { ...waiting, queue: [{ personId: "private-person", handle: "private-handle" }] })
    mocks.rows.set("modules/events/pageEvents:listForPage", { items: [{ ...waiting, participants: ["private-person"] }], continueCursor: "fin", isDone: true })
    const { events } = setup()
    const detail = renderHook(() => events.useEvent("event-1"))
    expect(detail.result.current).toEqual({ status: "ready", data: waiting })
    const list = renderHook(() => events.useEvents({ pageId: "page-1", cursor: null }))
    expect(list.result.current).toEqual({ status: "ready", data: { items: [waiting], continueCursor: null, isDone: true } })
    expect(JSON.stringify(detail.result.current)).not.toContain("private-")
  })

  it("transmet une capacité définie, préserve null explicite et omet une capacité absente", async () => {
    const { events, mutation } = setup()
    mutation.mockResolvedValueOnce({ eventId: "event-1", created: true })
    await events.create({ ...EVENT_INPUT, capacity: 2, idempotencyKey: "capacity-key" })
    await events.update({ ...EVENT_INPUT, capacity: null, eventId: "event-1", expectedVersion: 2 })
    await events.update({ ...EVENT_INPUT, eventId: "event-1", expectedVersion: 3 })
    expect(mutation.mock.calls[0]![1]).toMatchObject({ capacity: 2 })
    expect(mutation.mock.calls[1]![1]).toHaveProperty("capacity", null)
    expect(mutation.mock.calls[2]![1]).not.toHaveProperty("capacity")
  })

  it.each(["association_event_capacity_invalid", "association_event_capacity_below_confirmed"])("traduit le refus %s", async (appRule) => {
    const { events, mutation } = setup()
    mutation.mockRejectedValueOnce(new ConvexError({ code: "policyRefused", appRule, appParams: {} }))
    expect(await events.update({ ...EVENT_INPUT, eventId: "event-1", expectedVersion: 2, capacity: 1 })).toEqual({ ok: false, code: appRule })
  })

  it("transmet la clôture définie ou nulle et conserve son omission", async () => {
    const { events, mutation } = setup()
    mutation.mockResolvedValueOnce({ eventId: "event-1", created: true })
    await events.create({ ...EVENT_INPUT, registrationClosesAt: EVENT_INPUT.startAt - 1, idempotencyKey: "deadline-key" })
    await events.update({ ...EVENT_INPUT, registrationClosesAt: null, eventId: "event-1", expectedVersion: 2 })
    await events.update({ ...EVENT_INPUT, eventId: "event-1", expectedVersion: 3 })
    expect(mutation.mock.calls[0]![1]).toHaveProperty("registrationClosesAt", EVENT_INPUT.startAt - 1)
    expect(mutation.mock.calls[1]![1]).toHaveProperty("registrationClosesAt", null)
    expect(mutation.mock.calls[2]![1]).not.toHaveProperty("registrationClosesAt")
  })

  it("projette seulement mon choix de rappel et l'envoie à l'API personnelle dédiée", async () => {
    const view = { ...EVENT, registrationClosesAt: EVENT_INPUT.startAt - 10, registrationOpen: false, reminderEnabled: true, reminderAt: EVENT_INPUT.startAt - 86_400_000, reminderState: "waiting_confirmation" }
    mocks.rows.set("modules/events/pageEvents:get", { ...view, reminderPersonId: "private-person", receipts: ["private-receipt"] })
    mocks.rows.set("modules/events/pageEvents:listForPage", { items: [view], continueCursor: "fin", isDone: true })
    const { events, mutation } = setup()
    const { result, rerender } = renderHook(() => events.useEvent("event-1"))
    expect(result.current).toEqual({ status: "ready", data: view })
    expect(renderHook(() => events.useEvents({ pageId: "page-1", cursor: null })).result.current).toEqual({ status: "ready", data: { items: [view], continueCursor: null, isDone: true } })
    await events.setReminder({ eventId: "event-1", enabled: true })
    await events.setReminder({ eventId: "event-1", enabled: false })
    expect(mutation.mock.calls.map(([ref, args]) => [getFunctionName(ref as never), args])).toEqual([
      ["modules/events/pageEventReminders:setReminder", { networkId: "network-diasporale", eventId: "event-1", enabled: true }],
      ["modules/events/pageEventReminders:setReminder", { networkId: "network-diasporale", eventId: "event-1", enabled: false }],
    ])
    mocks.rows.set("modules/events/pageEvents:get", EVENT)
    rerender()
    expect(result.current).toEqual({ status: "ready", data: EVENT })
  })

  it.each(["association_event_deadline_invalid", "association_event_registration_closed", "association_event_reminder_too_late"])("traduit le refus de délai %s", async (appRule) => {
    const { events, mutation } = setup()
    mutation.mockRejectedValueOnce(new ConvexError({ code: "policyRefused", appRule, appParams: {} }))
    const result = appRule === "association_event_deadline_invalid"
      ? await events.update({ ...EVENT_INPUT, eventId: "event-1", expectedVersion: 2, registrationClosesAt: EVENT_INPUT.startAt + 1 })
      : appRule === "association_event_registration_closed" ? await events.register("event-1") : await events.setReminder({ eventId: "event-1", enabled: true })
    expect(result).toEqual({ ok: false, code: appRule })
  })

  it("traduit les refus de version, d'accès et de réseau sans exposer une exception", async () => {
    const { events, groups, mutation, query } = setup()
    mutation.mockRejectedValueOnce(new ConvexError({ code: "policyRefused", appRule: "association_event_version_changed", appParams: {} }))
    expect(await events.cancel({ eventId: "event-1", expectedVersion: 1 })).toEqual({ ok: false, code: "association_event_version_changed" })
    mutation.mockRejectedValueOnce(new ConvexError({ code: "notFound" }))
    expect(await groups.join("group-1")).toEqual({ ok: false, code: "not_found" })
    query.mockResolvedValueOnce(null)
    expect(await groups.join("group-1")).toEqual({ ok: false, code: "network_unavailable" })
  })
})

describe("présences associatives — fournisseur moteur", () => {
  const VIEW = { eventId: "event-1", opensAt: 10, closesAt: 100, isOpen: true, canIssueTicket: true, canManage: false, checkedInAt: null, version: 0, recordedCount: null }
  const ROW = { registrationId: "registration-1", displayName: null, checkedInAt: 20, version: 2 }
  const CODE = `diasporale-attendance:v1:${"a".repeat(64)}`

  it("attend le lecteur courant, lie les queries à son identité et n'expose aucun secret", () => {
    mocks.person = undefined
    mocks.rows.set("modules/events/pageEventAttendance:get", { ...VIEW, nonce: "private-nonce", hash: "private-hash" })
    mocks.rows.set("modules/events/pageEventAttendance:listPresent", { items: [{ ...ROW, personId: "private-person", handle: "private-handle", hash: "private-hash" }], continueCursor: "next", isDone: false })
    const capability = setup().events.attendance!
    expect(capability.mode).toBe("engine")
    const detail = renderHook(() => capability.useAttendance("event-1"))
    const list = renderHook(() => capability.usePresent({ eventId: "event-1", cursor: null }))
    expect(detail.result.current).toEqual({ status: "loading" })
    expect(list.result.current).toEqual({ status: "loading" })
    expect(mocks.loaded.mock.calls.some(([name]) => String(name).includes("pageEventAttendance:"))).toBe(false)
    mocks.person = null
    detail.rerender()
    expect(detail.result.current).toEqual({ status: "loading" })
    mocks.person = { _id: "person-reader" }
    detail.rerender(); list.rerender()
    expect(detail.result.current).toEqual({ status: "ready", data: VIEW })
    expect(list.result.current).toEqual({ status: "ready", data: { items: [ROW], continueCursor: "next", isDone: false } })
    expect(mocks.loaded).toHaveBeenCalledWith("modules/events/pageEventAttendance:get", { networkId: "network-diasporale", eventId: "event-1", expectedReaderPersonId: "person-reader" })
    expect(mocks.loaded).toHaveBeenCalledWith("modules/events/pageEventAttendance:listPresent", { networkId: "network-diasporale", eventId: "event-1", expectedReaderPersonId: "person-reader", paginationOpts: { cursor: null, numItems: 20 } })
    expect(JSON.stringify([detail.result.current, list.result.current])).not.toContain("private-")
    const first = detail.result.current
    detail.rerender()
    expect(detail.result.current).toBe(first)
    mocks.person = { _id: "second-reader" }
    mocks.rows.set("modules/events/pageEventAttendance:get", { ...VIEW, canIssueTicket: false })
    detail.rerender()
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/events/pageEventAttendance:get", { networkId: "network-diasporale", eventId: "event-1", expectedReaderPersonId: "second-reader" })
    expect(detail.result.current).toEqual({ status: "ready", data: { ...VIEW, canIssueTicket: false } })
  })

  it("conserve le curseur d'une page filtrée vide et referme les refus du lecteur", () => {
    mocks.rows.set("modules/events/pageEventAttendance:listPresent", { items: [], continueCursor: "opaque-empty-next", isDone: false })
    const capability = setup().events.attendance!
    const list = renderHook(() => capability.usePresent({ eventId: "event-1", cursor: "previous" }))
    expect(list.result.current).toEqual({ status: "ready", data: { items: [], continueCursor: "opaque-empty-next", isDone: false } })
    mocks.person = new ConvexError({ code: "notFound" })
    list.rerender()
    expect(list.result.current).toEqual({ status: "error", code: "not_found" })
    mocks.auth = { isAuthenticated: false, isPending: false, isUnauthenticated: true }
    mocks.loaded.mockClear()
    list.rerender()
    expect(list.result.current).toEqual({ status: "error", code: "not_signed_in" })
    expect(mocks.loaded.mock.calls.some(([name]) => String(name).includes("pageEventAttendance:"))).toBe(false)
  })

  it("transmet les gestes à leur API, sans mettre le QR dans une lecture réactive", async () => {
    const { events, mutation } = setup()
    const capability = events.attendance!
    mutation.mockResolvedValueOnce({ code: CODE, expiresAt: 100, hash: "private-hash" })
    expect(await capability.issueTicket("event-1")).toEqual({ ok: true, value: { code: CODE, expiresAt: 100 } })
    mutation.mockResolvedValueOnce({ ...ROW, checkedInAt: null, version: 1, expiresAt: 100, personId: "private-person", hash: "private-hash" })
    expect(await capability.previewTicket({ eventId: "event-1", code: CODE })).toEqual({ ok: true, value: { ...ROW, checkedInAt: null, version: 1, expiresAt: 100 } })
    mutation.mockResolvedValueOnce({ alreadyRecorded: true, hash: "private-hash" })
    expect(await capability.checkIn({ eventId: "event-1", code: CODE, expectedVersion: 1 })).toEqual({ ok: true, value: { alreadyRecorded: true } })
    expect(await capability.clear({ eventId: "event-1", registrationId: "registration-1", expectedVersion: 2 })).toEqual({ ok: true, value: null })
    const networkId = "network-diasporale"
    expect(mutation.mock.calls.map(([ref, args]) => [getFunctionName(ref as never), args])).toEqual([
      ["modules/events/pageEventAttendance:issueTicket", { networkId, eventId: "event-1" }],
      ["modules/events/pageEventAttendance:previewTicket", { networkId, eventId: "event-1", code: CODE }],
      ["modules/events/pageEventAttendance:checkIn", { networkId, eventId: "event-1", code: CODE, expectedVersion: 1 }],
      ["modules/events/pageEventAttendance:clear", { networkId, eventId: "event-1", registrationId: "registration-1", expectedVersion: 2 }],
    ])
  })

  it.each(["association_event_attendance_closed", "association_event_attendance_code_invalid", "association_event_attendance_changed"])("traduit le refus %s", async (appRule) => {
    const { events, mutation } = setup()
    mutation.mockRejectedValueOnce(new ConvexError({ code: "policyRefused", appRule, appParams: {} }))
    expect(await events.attendance!.checkIn({ eventId: "event-1", code: CODE, expectedVersion: 1 })).toEqual({ ok: false, code: appRule })
  })
})

describe("galerie après événement — fournisseur moteur", () => {
  const STATE = { eventId: "event-1", available: true, canPublish: true, audience: "association" }
  const FEED_POST = {
    _id: "gallery-post-1", eventGalleryId: "event-1", body: "Souvenir collectif", media: [{ kind: "image", url: "https://media.invalid/photo", withheld: null, altText: "Photo collective", width: 10, height: 10 }],
    page: { pageId: "page-1", handle: "association-demo", name: "Association (démo)", badge: "community" },
    author: { personId: "private-person", handle: "private-handle", displayName: "private-name", badges: [] },
    share: null, shareCount: 0, audience: "public", visibility: "network", reach: "diaspora", publishedAt: 100, editedAt: null,
    isMine: false, reason: "page", reactions: { total: 0, mine: null }, commentCount: 0, viewer: { bookmarked: false },
  }

  it("attend le lecteur, transmet refreshKey et projette un post collectif marqué sans identité déposante", () => {
    mocks.person = undefined
    mocks.rows.set("modules/events/pageEventGallery:get", { ...STATE, privateToken: "private-token" })
    mocks.rows.set("modules/events/pageEventGallery:list", { items: [{ post: FEED_POST, canRemove: true, privateId: "private-row" }], continueCursor: "next", isDone: false })
    const gallery = setup().events.gallery!
    expect(gallery.mode).toBe("engine")
    const state = renderHook((props: { refreshKey: number }) => gallery.useGallery("event-1", props.refreshKey), { initialProps: { refreshKey: 0 } })
    const list = renderHook(() => gallery.useItems({ eventId: "event-1", cursor: null }))
    expect(state.result.current).toEqual({ status: "loading" })
    expect(mocks.loaded.mock.calls.some(([name]) => String(name).includes("pageEventGallery:"))).toBe(false)
    mocks.person = { _id: "person-reader" }
    state.rerender({ refreshKey: 1 }); list.rerender()
    expect(state.result.current).toEqual({ status: "ready", data: STATE })
    expect(mocks.loaded).toHaveBeenCalledWith("modules/events/pageEventGallery:get", { networkId: "network-diasporale", eventId: "event-1", expectedReaderPersonId: "person-reader", refreshKey: 1 })
    expect(mocks.loaded).toHaveBeenCalledWith("modules/events/pageEventGallery:list", { networkId: "network-diasporale", eventId: "event-1", expectedReaderPersonId: "person-reader", paginationOpts: { cursor: null, numItems: 20 } })
    expect(list.result.current).toMatchObject({ status: "ready", data: { items: [{ post: { id: "gallery-post-1", eventGalleryId: "event-1", author: { kind: "page", id: "page-1", displayName: "Association (démo)" }, moderation: "published" }, canRemove: true }], continueCursor: "next", isDone: false } })
    expect(JSON.stringify([state.result.current, list.result.current])).not.toContain("private-")
    mocks.person = { _id: "another-reader" }
    mocks.rows.set("modules/events/pageEventGallery:get", null)
    state.rerender({ refreshKey: 2 })
    expect(state.result.current).toEqual({ status: "ready", data: null })
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/events/pageEventGallery:get", { networkId: "network-diasporale", eventId: "event-1", expectedReaderPersonId: "another-reader", refreshKey: 2 })
    mocks.rows.set("modules/events/pageEventGallery:list", { items: [], continueCursor: "empty-next", isDone: false })
    list.rerender()
    expect(list.result.current).toEqual({ status: "ready", data: { items: [], continueCursor: "empty-next", isDone: false } })
  })

  it("n'envoie aucun choix d'audience, racine ou pays au dépôt atomique de galerie", async () => {
    const { events, mutation } = setup()
    const input = { eventId: "event-1", body: "Légende", media: [{ upload: { ref: "storage-1", kind: "image" as const, mimeType: "image/jpeg", sizeBytes: 30, width: 10, height: 10 }, altText: "  Photo  " }], idempotencyKey: "gallery-key", audience: "public", alsoOnRoot: true, country: "FR" }
    mutation.mockResolvedValueOnce({ postId: "gallery-post-1", created: false, authorPersonId: "private-person" })
    expect(await events.gallery!.publish(input)).toEqual({ ok: true, value: { postId: "gallery-post-1", created: false } })
    await events.gallery!.remove({ eventId: "event-1", postId: "gallery-post-1" })
    expect(mutation.mock.calls.map(([ref, args]) => [getFunctionName(ref as never), args])).toEqual([
      ["modules/events/pageEventGallery:publish", { networkId: "network-diasporale", eventId: "event-1", body: "Légende", media: [{ storageId: "storage-1", kind: "image", mimeType: "image/jpeg", sizeBytes: 30, width: 10, height: 10, altText: "Photo" }], idempotencyKey: "gallery-key" }],
      ["modules/events/pageEventGallery:remove", { networkId: "network-diasporale", eventId: "event-1", postId: "gallery-post-1" }],
    ])
  })

  it.each(["association_event_gallery_not_open", "association_event_gallery_media_required"])("traduit le refus %s", async (appRule) => {
    const { events, mutation } = setup()
    mutation.mockRejectedValueOnce(new ConvexError({ code: "policyRefused", appRule, appParams: {} }))
    expect(await events.gallery!.publish({ eventId: "event-1", body: "", media: [], idempotencyKey: "key" })).toEqual({ ok: false, code: appRule })
  })
})

describe("calendrier associatif — fournisseur moteur", () => {
  const AGENDA = { kind: "association", eventId: "event-1", pageId: "page-1", title: "Rencontre", description: null, location: null, startAt: 100, endAt: 200, timeZone: "Europe/Paris", status: "scheduled", cancelledAt: null, version: 1, organizer: { name: "Association (démo)", handle: "association-demo" }, registration: "waitlisted" }
  const FILE = { filename: "diasporale-event.ics", content: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", mediaType: "text/calendar;charset=utf-8" }

  it("attend l'identité, transmet now et la fenêtre, et ne recopie jamais les événements personnels", () => {
    mocks.person = undefined
    mocks.membership = { status: "en_attente", capabilities: ["read_network"] }
    mocks.rows.set("modules/events/events:myAgenda", { items: [{ privatePersonalId: "private-personal" }], associationItems: [{ ...AGENDA, participants: ["private-person"], organizer: { ...AGENDA.organizer, personId: "private-organizer" } }], truncated: true })
    const calendar = setup().events.calendar!
    expect(calendar.mode).toBe("engine")
    const agenda = renderHook(() => calendar.useAgenda({ now: 80, from: 50, to: 150 }))
    expect(agenda.result.current).toEqual({ status: "loading" })
    expect(mocks.loaded.mock.calls.some(([name]) => name === "modules/events/events:myAgenda")).toBe(false)
    mocks.person = { _id: "person-reader" }
    agenda.rerender()
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/events/events:myAgenda", { networkId: "network-diasporale", expectedReaderPersonId: "person-reader", now: 80, from: 50, to: 150 })
    expect(agenda.result.current).toEqual({ status: "ready", data: { items: [AGENDA], truncated: true } })
    expect(JSON.stringify(agenda.result.current)).not.toContain("private-")
    mocks.person = { _id: "another-reader" }
    mocks.rows.set("modules/events/events:myAgenda", { items: [{ personalEvent: "private-personal" }], truncated: false })
    agenda.rerender()
    expect(agenda.result.current).toEqual({ status: "ready", data: { items: [], truncated: false } })
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/events/events:myAgenda", { networkId: "network-diasporale", expectedReaderPersonId: "another-reader", now: 80, from: 50, to: 150 })
  })

  it("exporte par query fraîche avec lecteur attendu, puis contrôle encore l'identité", async () => {
    const { events, query, mutation } = setup()
    query.mockImplementation(async (ref) => {
      const name = getFunctionName(ref as never)
      return name === "modules/networks/networks:getBySlug" ? mocks.network : name === "modules/people/persons:getMyPerson" ? mocks.person : { ...FILE, privateToken: "private-token" }
    })
    expect(await events.calendar!.exportIcal("event-1")).toEqual({ ok: true, value: FILE })
    expect(query.mock.calls.map(([ref, args]) => [getFunctionName(ref as never), args])).toEqual([
      ["modules/networks/networks:getBySlug", { slug: "diasporale" }],
      ["modules/people/persons:getMyPerson", {}],
      ["modules/events/pageEventCalendar:exportIcal", { networkId: "network-diasporale", eventId: "event-1", expectedReaderPersonId: "person-reader" }],
      ["modules/people/persons:getMyPerson", {}],
    ])
    expect(mutation).not.toHaveBeenCalled()
  })

  it("pagine seulement les associations, lie le lecteur UI et conserve le curseur d'une page personnelle vide", () => {
    mocks.person = undefined
    const response = { page: [{ kind: "personal", event: { privatePersonalId: "private-personal" } }, { kind: "association", event: { ...AGENDA, privatePersonId: "private-person", organizer: { ...AGENDA.organizer, personId: "private-organizer" } } }], continueCursor: "native-next", isDone: false, splitCursor: "private-native" }
    mocks.rows.set("modules/events/events:paginateMyAgenda", response)
    const calendar = setup().events.calendar!
    const page = renderHook((input: { anchor: number; period: "upcoming" | "history"; cursor: string | null; readerPersonId: string }) => calendar.useAgendaPage!(input), { initialProps: { anchor: 80, period: "upcoming" as "upcoming" | "history", cursor: null as string | null, readerPersonId: "person-reader" } })
    expect(page.result.current).toEqual({ status: "loading" })
    expect(mocks.loaded.mock.calls.some(([name]) => name === "modules/events/events:paginateMyAgenda")).toBe(false)
    mocks.person = { _id: "person-reader" }
    page.rerender({ anchor: 80, period: "upcoming", cursor: null, readerPersonId: "person-reader" })
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/events/events:paginateMyAgenda", { networkId: "network-diasporale", source: "participations", period: "upcoming", anchor: 80, expectedReaderPersonId: "person-reader", paginationOpts: { numItems: 20, cursor: null } })
    expect(page.result.current).toEqual({ status: "ready", data: { items: [AGENDA], continueCursor: "native-next", isDone: false } })
    expect(JSON.stringify(page.result.current)).not.toContain("private-")
    const first = page.result.current
    page.rerender({ anchor: 80, period: "upcoming", cursor: null, readerPersonId: "person-reader" })
    expect(page.result.current).toBe(first)
    mocks.rows.set("modules/events/events:paginateMyAgenda", { page: [{ kind: "personal", event: { privatePersonalId: "private-personal" } }], continueCursor: "empty-native-next", isDone: false })
    page.rerender({ anchor: 80, period: "history", cursor: "native-next", readerPersonId: "person-reader" })
    expect(page.result.current).toEqual({ status: "ready", data: { items: [], continueCursor: "empty-native-next", isDone: false } })
    expect(mocks.loaded).toHaveBeenLastCalledWith("modules/events/events:paginateMyAgenda", { networkId: "network-diasporale", source: "participations", period: "history", anchor: 80, expectedReaderPersonId: "person-reader", paginationOpts: { numItems: 20, cursor: "native-next" } })
    mocks.loaded.mockClear()
    mocks.person = { _id: "another-reader" }
    page.rerender({ anchor: 80, period: "history", cursor: "native-next", readerPersonId: "person-reader" })
    expect(page.result.current).toEqual({ status: "error", code: "not_found" })
    expect(mocks.loaded.mock.calls.some(([name]) => name === "modules/events/events:paginateMyAgenda")).toBe(false)
    mocks.rows.set("modules/events/events:paginateMyAgenda", new ConvexError({ code: "notFound" }))
    page.rerender({ anchor: 80, period: "history", cursor: "native-next", readerPersonId: "another-reader" })
    expect(page.result.current).toEqual({ status: "error", code: "not_found" })
  })

  it.each(["absent", "changed", "denied"] as const)("refuse l'export si le lecteur est %s", async (state) => {
    const { events, query } = setup()
    let identityReads = 0
    query.mockImplementation(async (ref) => {
      const name = getFunctionName(ref as never)
      if (name === "modules/networks/networks:getBySlug") return mocks.network
      if (name === "modules/people/persons:getMyPerson") {
        identityReads += 1
        return state === "absent" ? null : { _id: state === "changed" && identityReads > 1 ? "another-reader" : "person-reader" }
      }
      if (state === "denied") throw new ConvexError({ code: "notFound" })
      return FILE
    })
    expect(await events.calendar!.exportIcal("event-1")).toEqual({ ok: false, code: "not_found" })
    if (state === "absent") expect(query.mock.calls.some(([ref]) => getFunctionName(ref as never) === "modules/events/pageEventCalendar:exportIcal")).toBe(false)
  })
})
