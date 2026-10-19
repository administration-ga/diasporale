/**
 * Activités associatives FICTIVES (DG-010), locales à ce navigateur. Les équipes
 * et adhésions viennent de leurs magasins partagés. Aucun adhérent n'est inscrit
 * automatiquement au groupe ni à un événement. Textes et événements nouveaux
 * attendent la modération ; aucun faux modérateur ne les approuve ici.
 * Le choix de rappel est conservé sans scheduler ni notification : sans reçu
 * historique, l'échéance atteinte devient « expired » dans cette démo.
 */
import { isProfilePublished, PERSONAL_POST_MAX_LENGTH } from "@antsia/social-domain/content"
import { assertPersonalEventDescription, assertPersonalEventLocation, assertPersonalEventTimeZone, assertPersonalEventTitle, assertPersonalEventWindow } from "@antsia/social-domain/events"
import { THEMATIC_GROUP_NAME_MAX_LENGTH } from "@antsia/social-domain/thematicGroups"
import { serializeCalendarEvent } from "@antsia/social-domain/icalendar"
import { ASSOCIATION_EVENT_ATTENDANCE_TICKET_TTL_MS, ASSOCIATION_EVENT_WAITLIST_BATCH_SIZE, associationEventAttendanceCode, associationEventAttendanceWindow, associationEventReminderAt, checkAssociationEventCapacityChange, isAssociationEventAttendanceOpen, isAssociationEventGalleryOpen, isAssociationEventRegistrationOpen, parseAssociationEventAttendanceCode, parseAssociationEventCapacity, parseAssociationEventDeadline } from "@diasporale/domain"
import { useMemo, useSyncExternalStore } from "react"

import {
  ASSOCIATION_ACTIVITY_PAGE_SIZE,
  type AssociationActivityPage,
  type AssociationEventInput,
  type AssociationEventsCapability,
  type AssociationEventView,
  type AssociationGroupsCapability,
  type AssociationGroupPostView,
  type AssociationGroupView,
} from "../data/association-activities-port"
import type { AssociationEventAttendanceCapability, AssociationEventAttendancePreview, AssociationEventAttendanceRow, AssociationEventAttendanceView } from "../data/association-attendance-port"
import type { AssociationEventGalleryCapability, AssociationEventGalleryItem, AssociationEventGalleryState } from "../data/association-event-gallery-port"
import type { AssociationAgendaEventView, AssociationAgendaView, AssociationEventCalendarCapability } from "../data/association-event-calendar-port"
import type { ActionErrorCode } from "../data/errors"
import { postMediaRefusal } from "../data/media"
import type { ActionResult, PublishMediaInput } from "../data/port"
import type { Loadable, PostView } from "../data/types"
import { demoViewerRefusal, type DemoAssociationsContext } from "./associations"
import { demoManagedPage, demoPageAdminContext } from "./page-admin"
import { statusOf } from "./selectors"
import type { DemoMedia } from "./state"
import type { DemoStore } from "./store"

export const DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY = "diasporale:demonstration:activites-associations:v1"
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">
type Moderation = AssociationGroupPostView["moderation"]
interface GroupRow { readonly id: string; readonly pageId: string; readonly name: string; readonly createdById: string; readonly idempotencyKey: string; readonly closedAt: number | null; readonly createdAt: number }
interface GroupMemberRow { readonly groupId: string; readonly personId: string; readonly leftAt: number | null }
interface PostRow { readonly id: string; readonly groupId: string; readonly authorId: string; readonly body: string; readonly idempotencyKey: string; readonly moderation: Moderation; readonly createdAt: number; readonly removedAt: number | null }
interface EventRow extends AssociationEventInput { readonly id: string; readonly idempotencyKey: string; readonly status: "scheduled" | "cancelled"; readonly version: number; readonly moderation: Moderation; readonly createdAt: number; readonly updatedAt?: number; readonly cancelledAt?: number | null; readonly capacity: number | null; readonly registrationClosesAt: number | null }
interface GalleryRow { readonly id: string; readonly eventId: string; readonly body: string; readonly media: readonly DemoMedia[]; readonly mediaKey: string; readonly createdAt: number; readonly idempotencyKey: string; readonly removedAt?: number | null; readonly moderation: Moderation }
/** La séquence appartient à une demande en attente ; les anciennes confirmations n'en ont pas. */
interface RegistrationRow {
  readonly eventId: string
  readonly personId: string
  readonly status: "accepted" | "declined" | "pending"
  readonly sequence?: number
  readonly reminderEnabled?: boolean
  /** Reçu conservé s'il existait ; la démo n'en fabrique jamais ni ne livre de rappel. */
  readonly reminderRecordedForStartAt?: number
  readonly registrationId?: string
  readonly attendanceVersion?: number
  readonly checkedInAt?: number
  /** Nonce privé de démonstration : aucune lecture ne rend ce champ. */
  readonly attendanceNonce?: string
  readonly attendanceExpiresAt?: number
}
export interface DemoAssociationActivitiesState {
  readonly version: 1
  readonly seedCreatedAt: number
  readonly sequence: number
  readonly groups: readonly GroupRow[]
  readonly members: readonly GroupMemberRow[]
  readonly posts: readonly PostRow[]
  readonly events: readonly EventRow[]
  readonly registrations: readonly RegistrationRow[]
  readonly gallery: readonly GalleryRow[]
}
export interface DemoAssociationActivitiesDeps {
  readonly associations: Pick<DemoAssociationsContext, "membershipOf" | "subscribe" | "getVersion">
  readonly teams?: ReturnType<typeof demoPageAdminContext>
  readonly storage?: StorageLike | null
}
type StoredActivitiesState = Omit<DemoAssociationActivitiesState, "events" | "gallery"> & { readonly events: readonly (Omit<EventRow, "capacity" | "registrationClosesAt"> & { readonly capacity?: number | null; readonly registrationClosesAt?: number | null })[]; readonly gallery?: readonly GalleryRow[] }
const OK: ActionResult = { ok: true, value: null }
const LOADING = { status: "loading" } as const
const fail = (code: ActionErrorCode): ActionResult<never> => ({ ok: false, code })
const failed = <T,>(code: ActionErrorCode): Loadable<T> => ({ status: "error", code })
const ready = <T,>(data: T): Loadable<T> => ({ status: "ready", data })
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const moderation = (value: unknown): value is Moderation => value === "published" || value === "pending_review" || value === "removed"
function isState(value: unknown): value is StoredActivitiesState {
  if (!record(value) || value.version !== 1 || typeof value.seedCreatedAt !== "number" || !Number.isFinite(value.seedCreatedAt) || !Number.isSafeInteger(value.sequence) || (value.sequence as number) < 1) return false
  return Array.isArray(value.groups) && value.groups.every((row: unknown) => record(row) && typeof row.id === "string" && typeof row.pageId === "string" && typeof row.name === "string" && typeof row.createdById === "string" && typeof row.idempotencyKey === "string" && (row.closedAt === null || typeof row.closedAt === "number") && typeof row.createdAt === "number")
    && Array.isArray(value.members) && value.members.every((row: unknown) => record(row) && typeof row.groupId === "string" && typeof row.personId === "string" && (row.leftAt === null || typeof row.leftAt === "number"))
    && Array.isArray(value.posts) && value.posts.every((row: unknown) => record(row) && typeof row.id === "string" && typeof row.groupId === "string" && typeof row.authorId === "string" && typeof row.body === "string" && typeof row.idempotencyKey === "string" && moderation(row.moderation) && typeof row.createdAt === "number" && (row.removedAt === null || typeof row.removedAt === "number"))
    && Array.isArray(value.events) && value.events.every((row: unknown) => record(row) && typeof row.id === "string" && typeof row.pageId === "string" && typeof row.title === "string" && typeof row.description === "string" && typeof row.location === "string" && typeof row.startAt === "number" && typeof row.endAt === "number" && typeof row.timeZone === "string" && (row.audience === "network" || row.audience === "association") && (row.status === "scheduled" || row.status === "cancelled") && typeof row.idempotencyKey === "string" && Number.isSafeInteger(row.version) && (row.version as number) > 0 && moderation(row.moderation) && typeof row.createdAt === "number" && parseAssociationEventCapacity(row.capacity).ok && parseAssociationEventDeadline(row.registrationClosesAt, row.startAt).ok)
    && value.events.every((row: unknown) => record(row) && (row.updatedAt === undefined || Number.isSafeInteger(row.updatedAt)) && (row.cancelledAt === undefined || row.cancelledAt === null || Number.isSafeInteger(row.cancelledAt)))
    && Array.isArray(value.registrations) && value.registrations.every((row: unknown) => record(row) && typeof row.eventId === "string" && typeof row.personId === "string"
      && (row.status === "accepted" || row.status === "declined" || row.status === "pending")
      && (row.sequence === undefined ? row.status !== "pending" : Number.isSafeInteger(row.sequence) && (row.sequence as number) > 0)
      && (row.reminderEnabled === undefined || typeof row.reminderEnabled === "boolean")
      && (row.reminderRecordedForStartAt === undefined || Number.isSafeInteger(row.reminderRecordedForStartAt))
      && (row.registrationId === undefined || typeof row.registrationId === "string")
      && (row.attendanceVersion === undefined || Number.isSafeInteger(row.attendanceVersion) && (row.attendanceVersion as number) >= 0)
      && (row.checkedInAt === undefined || Number.isSafeInteger(row.checkedInAt))
      && (row.attendanceNonce === undefined || typeof row.attendanceNonce === "string" && /^[0-9a-f]{64}$/.test(row.attendanceNonce))
      && (row.attendanceExpiresAt === undefined || Number.isSafeInteger(row.attendanceExpiresAt)))
    && (value.gallery === undefined || Array.isArray(value.gallery) && value.gallery.every((row: unknown) => record(row) && typeof row.id === "string" && typeof row.eventId === "string" && typeof row.body === "string" && typeof row.mediaKey === "string" && typeof row.idempotencyKey === "string" && Number.isSafeInteger(row.createdAt) && moderation(row.moderation) && (row.removedAt === undefined || row.removedAt === null || Number.isSafeInteger(row.removedAt))
      && Array.isArray(row.media) && row.media.every((item: unknown) => record(item) && item.kind === "image" && typeof item.url === "string" && (item.altText === null || typeof item.altText === "string") && typeof item.width === "number" && typeof item.height === "number")))
}
/** Migration v1 en mémoire : conserver toutes les activités et les anciennes participations. */
function migrateState(value: StoredActivitiesState): DemoAssociationActivitiesState {
  const sequence = value.registrations.reduce((next, row) => Math.max(next, (row.sequence ?? 0) + 1), value.sequence)
  return { ...value, sequence, gallery: value.gallery ?? [], events: value.events.map((row) => ({ ...row, updatedAt: row.updatedAt ?? row.createdAt, cancelledAt: row.cancelledAt ?? null, capacity: row.capacity ?? null, registrationClosesAt: row.registrationClosesAt ?? null })) }
}
function defaultStorage(): StorageLike | null {
  try { return typeof window === "undefined" ? null : window.localStorage } catch { return null }
}
function parsedEvent(input: AssociationEventInput): AssociationEventInput | null {
  try {
    if (input.audience !== "network" && input.audience !== "association") return null
    assertPersonalEventWindow(input)
    return { pageId: input.pageId, title: assertPersonalEventTitle(input.title), description: assertPersonalEventDescription(input.description) ?? "", location: assertPersonalEventLocation(input.location) ?? "", startAt: input.startAt, endAt: input.endAt, timeZone: assertPersonalEventTimeZone(input.timeZone), audience: input.audience }
  } catch { return null }
}
function invalidateAttendance(row: RegistrationRow): RegistrationRow {
  const { checkedInAt, attendanceNonce, attendanceExpiresAt, ...rest } = row
  void checkedInAt; void attendanceNonce; void attendanceExpiresAt
  return { ...rest, attendanceVersion: (row.attendanceVersion ?? 0) + 1 }
}
function galleryMediaKey(media: readonly PublishMediaInput[]): string {
  return JSON.stringify(media.map(({ upload, altText }) => ({ ref: upload.ref, kind: upload.kind, mimeType: upload.mimeType, sizeBytes: upload.sizeBytes, width: upload.width, height: upload.height, durationMs: upload.durationMs, altText: altText.trim() })))
}

export function createDemoAssociationActivities(store: DemoStore, deps: DemoAssociationActivitiesDeps): { readonly groups: AssociationGroupsCapability; readonly events: AssociationEventsCapability } {
  const teams = deps.teams ?? demoPageAdminContext(store)
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage
  let state: DemoAssociationActivitiesState | null = null
  let version = 0
  const listeners = new Set<() => void>()
  const empty = (seedCreatedAt: number): DemoAssociationActivitiesState => ({ version: 1, seedCreatedAt, sequence: 1, groups: [], members: [], posts: [], events: [], registrations: [], gallery: [] })
  function current(): DemoAssociationActivitiesState {
    const seed = store.getState().createdAt
    if (state !== null) {
      if (state.seedCreatedAt !== seed) {
        state = empty(seed)
        try { storage?.removeItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY) } catch { /* L'état en mémoire suffit. */ }
      }
      return state
    }
    try {
      const raw = storage?.getItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : null
      if (isState(parsed) && parsed.seedCreatedAt === seed) return state = migrateState(parsed)
    } catch { /* Stockage illisible ou bloqué : aucune activité inventée. */ }
    return state = empty(seed)
  }
  function commit(next: DemoAssociationActivitiesState): void {
    state = next
    version += 1
    try { storage?.setItem(DEMO_ASSOCIATION_ACTIVITIES_STORAGE_KEY, JSON.stringify(next)) } catch { /* La démonstration continue en mémoire. */ }
    for (const listener of listeners) listener()
  }
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    const subscriptions = [store.subscribe(() => { reconcileErasedRegistrations(); listener() }), teams.subscribe(listener), deps.associations.subscribe(listener)]
    // Une ancienne trace peut être chargée sans qu'aucun watcher ait assisté à l'effacement.
    reconcileErasedRegistrations()
    return () => { listeners.delete(listener); subscriptions.forEach((unsubscribe) => unsubscribe()) }
  }
  const snapshot = () => `${store.getVersion()}:${version}:${teams.getVersion()}:${deps.associations.getVersion()}`
  const useSnapshot = () => useSyncExternalStore(subscribe, snapshot, () => "")
  const refusal = (write = false) => demoViewerRefusal(store.getState(), store.now(), write ? "publish" : "read_network")
  const viewerId = () => store.getState().session.personId as string
  function pageOf(pageId: string) {
    const page = teams.pagesOf(store.getState())[pageId]
    return page?.ownerKind === "association" ? page : null
  }
  function pageRole(pageId: string) {
    const page = pageOf(pageId)
    return page ? demoManagedPage(store, page.handle)?.myRole ?? null : null
  }
  function eligible(pageId: string, personId: string): boolean {
    const status = statusOf(store.getState(), personId, store.now())
    if (status === null || status === "partie" || status === "suspendue" || !pageOf(pageId)) return false
    const membership = deps.associations.membershipOf(pageId, personId)
    return membership ? membership.status === "accepted" : teams.isSignatory(pageId, personId)
  }
  function groupRole(group: GroupRow): AssociationGroupView["role"] {
    const me = viewerId()
    if (!eligible(group.pageId, me) || !current().members.some((row) => row.groupId === group.id && row.personId === me && row.leftAt === null)) return null
    const role = pageRole(group.pageId)
    if (role === "admin") return "owner"
    if (role === "signatory") return "moderator"
    return deps.associations.membershipOf(group.pageId, me)?.role === "animator" ? "moderator" : "member"
  }
  function groupView(group: GroupRow): AssociationGroupView {
    const role = groupRole(group)
    const active = group.closedAt === null
    return { groupId: group.id, pageId: group.pageId, name: group.name, state: active ? "active" : "closed", role, isMember: role !== null, canJoin: active && role === null && eligible(group.pageId, viewerId()) && refusal(true) === null, canManage: pageRole(group.pageId) === "admin" && eligible(group.pageId, viewerId()), canPublish: active && role !== null && refusal(true) === null }
  }
  function blocked(a: string, b: string): boolean {
    return store.getState().blocks.some((row) => (row.byId === a && row.targetId === b) || (row.byId === b && row.targetId === a))
  }
  function postView(post: PostRow, role: AssociationGroupView["role"]): AssociationGroupPostView {
    const person = store.getState().persons[post.authorId]
    const isMine = post.authorId === viewerId()
    return { postId: post.id, body: post.body, author: { displayName: person?.withdrawnAt === undefined ? person?.profile?.displayName ?? null : null }, createdAt: post.createdAt, isMine, canRemove: isMine || (refusal(true) === null && (role === "owner" || role === "moderator")), moderation: post.moderation }
  }
  function canReadEvent(event: EventRow): boolean {
    if (!pageOf(event.pageId) || event.moderation === "removed") return false
    const manager = eventManager(event.pageId)
    if (event.moderation === "pending_review") return manager
    return manager || event.audience === "network" || deps.associations.membershipOf(event.pageId, viewerId())?.status === "accepted"
  }
  function eventManager(pageId: string): boolean {
    return pageRole(pageId) !== null && refusal(true) === null
  }
  const personExists = (personId: string) => store.getState().persons[personId] !== undefined
  function withoutErasedRegistrations(data: DemoAssociationActivitiesState): DemoAssociationActivitiesState {
    const registrations = data.registrations.filter((row) => personExists(row.personId))
    return registrations.length === data.registrations.length ? data : { ...data, registrations }
  }
  /** Hors lectures : effacer les références, puis reprendre les événements touchés. */
  function reconcileErasedRegistrations(): void {
    const data = current()
    let next = withoutErasedRegistrations(data)
    if (next === data) return
    const affected = new Set(data.registrations.filter((row) => !personExists(row.personId)).map((row) => row.eventId))
    for (const event of next.events) if (affected.has(event.id)) next = resumeWaitlist(next, event)
    commit(next)
  }
  function confirmedCount(data: DemoAssociationActivitiesState, eventId: string): number {
    // Une perte de droit ne révoque pas une place ; un compte effacé ne la réserve plus.
    return data.registrations.filter((row) => row.eventId === eventId && row.status === "accepted" && personExists(row.personId)).length
  }
  function waiting(data: DemoAssociationActivitiesState, eventId: string, includeErased = false): readonly RegistrationRow[] {
    return data.registrations.filter((row) => row.eventId === eventId && row.status === "pending" && (includeErased || personExists(row.personId)))
      .sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0) || (left.personId === right.personId ? 0 : left.personId < right.personId ? -1 : 1))
  }
  function candidateEligible(event: EventRow, personId: string): boolean {
    if (!personExists(personId) || !pageOf(event.pageId)) return false
    const status = statusOf(store.getState(), personId, store.now())
    if (status !== "declaree" && status !== "verifiee") return false
    return event.audience === "network" || teams.isSignatory(event.pageId, personId) || deps.associations.membershipOf(event.pageId, personId)?.status === "accepted"
  }
  /**
   * Après un geste ou un effacement : 32 candidats au plus, sans dépasser un candidat
   * antérieur admissible. La démo n'a pas de scheduler ; register rejoué reprend
   * une file longue, avec le même rang et sans nouveau consentement inventé.
   */
  function resumeWaitlist(data: DemoAssociationActivitiesState, event: EventRow): DemoAssociationActivitiesState {
    // La disparition du compte retire aussi ses anciennes lignes, même si la file est figée.
    data = withoutErasedRegistrations(data)
    if (event.status !== "scheduled" || event.moderation !== "published" || !isAssociationEventRegistrationOpen(event, store.now()) || !pageOf(event.pageId)) return data
    let remaining = event.capacity === null ? Infinity : Math.max(0, event.capacity - confirmedCount(data, event.id))
    if (remaining === 0) return data
    let changed = false
    const registrations = [...data.registrations]
    const candidates = waiting({ ...data, registrations }, event.id, true).slice(0, ASSOCIATION_EVENT_WAITLIST_BATCH_SIZE)
    for (const row of candidates) {
      if (remaining === 0) break
      const index = registrations.indexOf(row)
      if (!candidateEligible(event, row.personId)) {
        registrations[index] = { ...invalidateAttendance(row), status: "declined", reminderEnabled: false }
        changed = true
      } else {
        registrations[index] = { ...row, status: "accepted" }
        changed = true
        remaining -= 1
      }
    }
    return changed ? { ...data, registrations } : data
  }
  function eventView(event: EventRow): AssociationEventView {
    const page = pageOf(event.pageId)!
    const data = current()
    const mine = data.registrations.find((row) => row.eventId === event.id && row.personId === viewerId())
    const registration = mine?.status === "accepted" ? "confirmed" as const : mine?.status === "pending" ? "waitlisted" as const : "none" as const
    const count = confirmedCount(data, event.id)
    const queue = waiting(data, event.id)
    const registrationOpen = event.status === "scheduled" && event.moderation === "published" && isAssociationEventRegistrationOpen(event, store.now())
    const reminderEnabled = mine?.reminderEnabled === true && registration !== "none"
    const due = associationEventReminderAt(event.startAt)
    const reminderAt = reminderEnabled ? due : null
    const reminderState: AssociationEventView["reminderState"] = !reminderEnabled ? "off"
      : mine?.reminderRecordedForStartAt === event.startAt ? "recorded"
      : event.status !== "scheduled" || event.moderation !== "published" || due <= store.now() ? "expired"
      : registration === "waitlisted" ? "waiting_confirmation" : "scheduled"
    return {
      eventId: event.id, pageId: event.pageId, title: event.title, description: event.description, location: event.location,
      startAt: event.startAt, endAt: event.endAt, timeZone: event.timeZone, audience: event.audience, status: event.status, version: event.version,
      organizer: { name: page.name, handle: page.handle }, moderation: event.moderation,
      isRegistered: registration === "confirmed", canManage: eventManager(event.pageId),
      canRegister: refusal(true) === null && registrationOpen && registration === "none",
      capacity: event.capacity, confirmedCount: count, waitlistCount: queue.length,
      remainingPlaces: event.capacity === null ? null : Math.max(0, event.capacity - count), registration,
      waitlistPosition: registration === "waitlisted" && mine ? queue.indexOf(mine) + 1 : null,
      registrationClosesAt: event.registrationClosesAt, registrationOpen, reminderEnabled, reminderAt, reminderState,
    }
  }
  function attendanceCandidateEligible(event: EventRow, personId: string): boolean {
    const status = statusOf(store.getState(), personId, store.now())
    if (!personExists(personId) || !pageOf(event.pageId) || (status !== "en_attente" && status !== "declaree" && status !== "verifiee")) return false
    return event.audience === "network" || teams.isSignatory(event.pageId, personId) || deps.associations.membershipOf(event.pageId, personId)?.status === "accepted"
  }
  function attendanceName(event: EventRow, row: RegistrationRow): string | null {
    const person = store.getState().persons[row.personId]
    return row.status === "accepted" && attendanceCandidateEligible(event, row.personId) && person && isProfilePublished(person) ? person.profile?.displayName ?? null : null
  }
  const attendanceOpen = (event: EventRow) => event.status === "scheduled" && event.moderation === "published" && isAssociationEventAttendanceOpen(event, store.now())
  function attendanceView(event: EventRow): AssociationEventAttendanceView {
    const data = current()
    const mine = data.registrations.find((row) => row.eventId === event.id && row.personId === viewerId())
    const canManage = eventManager(event.pageId)
    const isOpen = attendanceOpen(event)
    return {
      eventId: event.id, ...associationEventAttendanceWindow(event), isOpen,
      canIssueTicket: isOpen && mine?.status === "accepted" && attendanceCandidateEligible(event, viewerId()),
      canManage, checkedInAt: mine?.checkedInAt ?? null, version: mine?.attendanceVersion ?? 0,
      recordedCount: canManage ? data.registrations.filter((row) => row.eventId === event.id && row.checkedInAt !== undefined && personExists(row.personId)).length : null,
    }
  }
  function managedAttendanceEvent(eventId: string): EventRow | null {
    const event = current().events.find((row) => row.id === eventId)
    return event && event.moderation === "published" && canReadEvent(event) && eventManager(event.pageId) ? event : null
  }
  function ticketRegistration(event: EventRow, code: string): RegistrationRow | null {
    return current().registrations.find((row) => row.eventId === event.id && row.status === "accepted" && row.registrationId !== undefined
      && row.attendanceNonce !== undefined && associationEventAttendanceCode(row.attendanceNonce) === code
      && row.attendanceExpiresAt !== undefined && store.now() < row.attendanceExpiresAt && attendanceCandidateEligible(event, row.personId)) ?? null
  }
  function previewView(event: EventRow, row: RegistrationRow): AssociationEventAttendancePreview {
    return { registrationId: row.registrationId!, displayName: attendanceName(event, row), checkedInAt: row.checkedInAt ?? null, version: row.attendanceVersion ?? 0, expiresAt: row.attendanceExpiresAt! }
  }
  const attendance: AssociationEventAttendanceCapability = {
    mode: "demonstration",
    useAttendance(eventId) {
      const tick = useSnapshot()
      return useMemo(() => {
        if (tick === "") return LOADING
        const code = refusal()
        if (code) return failed<AssociationEventAttendanceView | null>(code)
        const event = current().events.find((row) => row.id === eventId)
        return ready(event && event.moderation === "published" && canReadEvent(event) ? attendanceView(event) : null)
      }, [tick, eventId])
    },
    usePresent({ eventId, cursor }) {
      const tick = useSnapshot()
      return useMemo<Loadable<AssociationActivityPage<AssociationEventAttendanceRow>>>(() => {
        if (tick === "") return LOADING
        const code = refusal()
        if (code) return failed(code)
        const event = managedAttendanceEvent(eventId)
        if (!event) return failed("not_found")
        // Paginer les traces avant le filtre d'effacement : conserver le curseur même si une page devient vide.
        const rows = current().registrations.filter((row) => row.eventId === eventId && row.checkedInAt !== undefined && row.registrationId !== undefined)
          .map((row) => ({ ...row, id: row.registrationId! }))
        const result = page(rows, cursor, `attendance:${eventId}`, (row) => row.checkedInAt!)
        return result.status === "ready" ? ready({ ...result.data, items: result.data.items.filter((row) => personExists(row.personId)).map((row): AssociationEventAttendanceRow => ({ registrationId: row.id, displayName: attendanceName(event, row), checkedInAt: row.checkedInAt!, version: row.attendanceVersion ?? 0 })) }) : result
      }, [tick, eventId, cursor])
    },
    async issueTicket(eventId) {
      const code = refusal()
      if (code) return fail(code)
      const data = current()
      const event = data.events.find((row) => row.id === eventId)
      const mine = data.registrations.find((row) => row.eventId === eventId && row.personId === viewerId())
      if (!event || event.moderation !== "published" || !canReadEvent(event) || mine?.status !== "accepted" || !attendanceCandidateEligible(event, viewerId())) return fail("not_found")
      if (!attendanceOpen(event)) return fail("association_event_attendance_closed")
      let nonce: string
      try { nonce = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("") } catch { return fail("unknown") }
      const raw = associationEventAttendanceCode(nonce)
      if (!raw) return fail("unknown")
      const expiresAt = Math.min(store.now() + ASSOCIATION_EVENT_ATTENDANCE_TICKET_TTL_MS, event.endAt)
      const row: RegistrationRow = { ...mine, registrationId: mine.registrationId ?? `presence-association-demo-${data.sequence}`, attendanceVersion: (mine.attendanceVersion ?? 0) + 1, attendanceNonce: nonce, attendanceExpiresAt: expiresAt }
      const reconciled = withoutErasedRegistrations(data)
      commit({ ...reconciled, sequence: data.sequence + (mine.registrationId === undefined ? 1 : 0), registrations: reconciled.registrations.map((candidate) => candidate === mine ? row : candidate) })
      return { ok: true, value: { code: raw, expiresAt } }
    },
    async previewTicket({ eventId, code }) {
      const refusalCode = refusal(true)
      if (refusalCode) return fail(refusalCode)
      const event = managedAttendanceEvent(eventId)
      if (!event) return fail("not_found")
      if (!attendanceOpen(event)) return fail("association_event_attendance_closed")
      const parsed = parseAssociationEventAttendanceCode(code)
      if (!parsed) return fail("not_found")
      const row = ticketRegistration(event, parsed)
      return row ? { ok: true, value: previewView(event, row) } : fail("not_found")
    },
    async checkIn({ eventId, code, expectedVersion }) {
      const refusalCode = refusal(true)
      if (refusalCode) return fail(refusalCode)
      const event = managedAttendanceEvent(eventId)
      if (!event) return fail("not_found")
      if (!attendanceOpen(event)) return fail("association_event_attendance_closed")
      const parsed = parseAssociationEventAttendanceCode(code)
      if (!parsed) return fail("not_found")
      const row = ticketRegistration(event, parsed)
      if (!row) return fail("not_found")
      if (row.checkedInAt !== undefined) return { ok: true, value: { alreadyRecorded: true } }
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== (row.attendanceVersion ?? 0)) return fail("association_event_attendance_changed")
      const data = withoutErasedRegistrations(current())
      commit({ ...data, registrations: data.registrations.map((candidate) => candidate === row ? { ...row, checkedInAt: store.now(), attendanceVersion: (row.attendanceVersion ?? 0) + 1 } : candidate) })
      return { ok: true, value: { alreadyRecorded: false } }
    },
    async clear({ eventId, registrationId, expectedVersion }) {
      const code = refusal(true)
      if (code) return fail(code)
      if (!managedAttendanceEvent(eventId)) return fail("not_found")
      const data = withoutErasedRegistrations(current())
      const row = data.registrations.find((candidate) => candidate.eventId === eventId && candidate.registrationId === registrationId)
      if (!row) return fail("not_found")
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== (row.attendanceVersion ?? 0)) return fail("association_event_attendance_changed")
      commit({ ...data, registrations: data.registrations.map((candidate) => candidate === row ? invalidateAttendance(row) : candidate) })
      return OK
    },
  }
  function galleryEvent(eventId: string, allowCancelled = false): EventRow | null {
    const event = current().events.find((row) => row.id === eventId)
    return event && (allowCancelled || event.status === "scheduled") && event.moderation === "published" && canReadEvent(event) ? event : null
  }
  function galleryPost(event: EventRow, row: GalleryRow): PostView {
    const identity = pageOf(event.pageId)!
    return {
      id: row.id, eventGalleryId: event.id,
      author: { kind: "page", id: identity.id, handle: identity.handle, displayName: identity.name, badges: [] },
      body: row.body,
      media: row.media.map((item) => ({ kind: item.kind, url: item.url, withheld: null, altText: item.altText, width: item.width, height: item.height })),
      share: null, shareCount: 0, scope: { reach: "diaspora" }, audience: "public", visibility: "network", moderation: "published", createdAt: row.createdAt,
      reactionCount: 0, commentCount: 0, myReaction: null, isMine: false, bookmarked: false, edited: false, editedAt: null,
    }
  }
  const gallery: AssociationEventGalleryCapability = {
    mode: "demonstration",
    useGallery(eventId, refreshKey) {
      const tick = useSnapshot()
      return useMemo<Loadable<AssociationEventGalleryState | null>>(() => {
        if (tick === "") return LOADING
        const code = refusal()
        if (code) return failed(code)
        const event = galleryEvent(eventId)
        if (!event) return ready(null)
        const available = isAssociationEventGalleryOpen(event, store.now())
        return ready({ eventId, available, canPublish: available && eventManager(event.pageId), audience: event.audience })
      }, [tick, eventId, refreshKey])
    },
    useItems({ eventId, cursor }) {
      const tick = useSnapshot()
      return useMemo<Loadable<AssociationActivityPage<AssociationEventGalleryItem>>>(() => {
        if (tick === "") return LOADING
        const code = refusal()
        if (code) return failed(code)
        const event = galleryEvent(eventId)
        if (!event) return failed("not_found")
        if (!isAssociationEventGalleryOpen(event, store.now())) return failed("association_event_gallery_not_open")
        // La politique est explicite : aucun ajout en attente n'est annoncé comme publié.
        const result = page(current().gallery.filter((row) => row.eventId === eventId && (row.removedAt === undefined || row.removedAt === null) && row.moderation !== "removed"), cursor, `gallery:${eventId}`, (row) => row.createdAt)
        return result.status === "ready" ? ready({ ...result.data, items: result.data.items.filter((row) => row.moderation === "published").map((row) => ({ post: galleryPost(event, row), canRemove: eventManager(event.pageId) })) }) : result
      }, [tick, eventId, cursor])
    },
    async publish({ eventId, body, media, idempotencyKey }) {
      const code = refusal(true)
      if (code) return fail(code)
      const event = galleryEvent(eventId)
      if (!event || !eventManager(event.pageId)) return fail("not_found")
      if (!isAssociationEventGalleryOpen(event, store.now())) return fail("association_event_gallery_not_open")
      const key = idempotencyKey.trim()
      if (!key || key.length > 128) return fail("unknown")
      if (media.length === 0) return fail("association_event_gallery_media_required")
      const mediaRefusal = postMediaRefusal(media.map((item) => ({ kind: item.upload.kind, mimeType: item.upload.mimeType, sizeBytes: item.upload.sizeBytes, altText: item.altText.trim() })))
      if (mediaRefusal) return fail(mediaRefusal)
      const text = body.trim()
      if (text.length > PERSONAL_POST_MAX_LENGTH) return fail("post_too_long")
      const mediaKey = galleryMediaKey(media)
      const data = current()
      const existing = data.gallery.find((row) => row.eventId === eventId && row.idempotencyKey === key)
      if (existing) return existing.body === text && existing.mediaKey === mediaKey ? { ok: true, value: { postId: existing.id, created: false } } : fail("unknown")
      // La chaîne de dépôt de démonstration garde des images réduites ; aucun serveur vidéo simulé.
      if (media.some((item) => item.upload.kind === "video")) return fail("feature_unavailable")
      const admitted = store.consumeStagedMedia(media)
      if (!admitted.ok) return admitted
      const postId = `galerie-association-demo-${data.sequence}`
      const row: GalleryRow = { id: postId, eventId, body: text, media: admitted.value.map((item) => ({ kind: item.kind, url: item.url, altText: item.altText, width: item.width, height: item.height })), mediaKey, createdAt: store.now(), idempotencyKey: key, removedAt: null, moderation: "pending_review" }
      commit({ ...data, sequence: data.sequence + 1, gallery: [...data.gallery, row] })
      return { ok: true, value: { postId, created: true } }
    },
    async remove({ eventId, postId }) {
      const code = refusal(true)
      if (code) return fail(code)
      const event = galleryEvent(eventId, true)
      if (!event || !eventManager(event.pageId)) return fail("not_found")
      const data = current()
      const row = data.gallery.find((candidate) => candidate.id === postId && candidate.eventId === eventId)
      if (!row) return fail("not_found")
      if (row.removedAt === undefined || row.removedAt === null) commit({ ...data, gallery: data.gallery.map((candidate) => candidate === row ? { ...candidate, removedAt: store.now(), moderation: "removed" } : candidate) })
      return OK
    },
  }
  const calendar: AssociationEventCalendarCapability = {
    mode: "demonstration",
    useAgendaPage({ anchor, period, cursor, readerPersonId }) {
      const tick = useSnapshot()
      return useMemo<Loadable<AssociationActivityPage<AssociationAgendaEventView>>>(() => {
        if (tick === "") return LOADING
        const code = refusal()
        if (code) return failed(code)
        if (viewerId() !== readerPersonId) return failed("not_found")
        if (!Number.isFinite(anchor) || (period !== "upcoming" && period !== "history")) return failed("unknown")
        const data = current()
        let boundary: { readonly at: number; readonly id: string } | null = null
        if (cursor !== null) {
          try {
            const value: unknown = JSON.parse(cursor)
            if (!Array.isArray(value) || value.length !== 8 || value[0] !== "demo-association-agenda" || value[1] !== 1 || typeof value[2] !== "string" || typeof value[3] !== "number" || (value[4] !== "upcoming" && value[4] !== "history") || typeof value[5] !== "number" || typeof value[6] !== "number" || !Number.isFinite(value[6]) || typeof value[7] !== "string" || value[7].length === 0) return failed("unknown")
            if (value[2] !== readerPersonId || value[3] !== data.seedCreatedAt || value[4] !== period || value[5] !== anchor) return failed("not_found")
            if (period === "upcoming" ? value[6] < anchor : value[6] >= anchor) return failed("unknown")
            boundary = { at: value[6], id: value[7] }
          } catch { return failed("unknown") }
        }
        // Une inscription est unique pour lecteur+événement : cette clé v1 reste stable après émission d'un QR.
        const direction = period === "upcoming" ? 1 : -1
        const own = data.registrations.filter((row) => row.personId === readerPersonId).flatMap((row) => {
          const event = data.events.find((candidate) => candidate.id === row.eventId)
          return event && Number.isFinite(event.startAt) && (period === "upcoming" ? event.startAt >= anchor : event.startAt < anchor) ? [{ row, event, id: event.id }] : []
        }).sort((a, b) => direction * (a.event.startAt - b.event.startAt || (a.id === b.id ? 0 : a.id < b.id ? -1 : 1)))
        const after = boundary
        const remaining = own.filter(({ event, id }) => after === null || direction * (event.startAt - after.at) > 0 || (event.startAt === after.at && (direction === 1 ? id > after.id : id < after.id)))
        const raw = remaining.slice(0, ASSOCIATION_ACTIVITY_PAGE_SIZE)
        const isDone = remaining.length <= ASSOCIATION_ACTIVITY_PAGE_SIZE
        const last = raw[raw.length - 1]
        const continueCursor = !isDone && last ? JSON.stringify(["demo-association-agenda", 1, readerPersonId, data.seedCreatedAt, period, anchor, last.event.startAt, last.id]) : null
        const items: AssociationAgendaEventView[] = []
        for (const { row, event } of raw) {
          if ((row.status !== "accepted" && !(row.status === "pending" && Number.isSafeInteger(row.sequence) && (row.sequence ?? 0) > 0)) || !Number.isFinite(event.endAt) || event.endAt <= event.startAt || event.moderation !== "published" || !canReadEvent(event)) continue
          const organizer = pageOf(event.pageId)!
          items.push({ kind: "association", eventId: event.id, pageId: event.pageId, title: event.title, description: event.description || null, location: event.location || null, startAt: event.startAt, endAt: event.endAt, timeZone: event.timeZone, status: event.status, cancelledAt: event.cancelledAt ?? null, version: event.version, organizer: { name: organizer.name, handle: organizer.handle }, registration: row.status === "accepted" ? "confirmed" : "waitlisted" })
        }
        return ready({ items, continueCursor, isDone })
      }, [tick, anchor, period, cursor, readerPersonId])
    },
    useAgenda({ now, from, to }) {
      const tick = useSnapshot()
      return useMemo<Loadable<AssociationAgendaView>>(() => {
        if (tick === "") return LOADING
        const code = refusal()
        if (code) return failed(code)
        if (!Number.isFinite(now) || (from !== undefined && !Number.isFinite(from)) || (to !== undefined && !Number.isFinite(to)) || (from !== undefined && to !== undefined && from > to)) return failed("unknown")
        const data = current()
        const own = data.registrations.filter((row) => row.personId === viewerId()).flatMap((row) => {
          const event = data.events.find((candidate) => candidate.id === row.eventId)
          return event ? [{ row, event }] : []
        })
        const ascending = (a: typeof own[number], b: typeof own[number]) => a.event.startAt - b.event.startAt || a.event.id.localeCompare(b.event.id)
        const bounded = from !== undefined || to !== undefined
        const upcoming = own.filter(({ event }) => bounded ? (from === undefined || event.startAt >= from) && (to === undefined || event.startAt <= to) : event.startAt >= now).sort(ascending).slice(0, 200)
        const history = !bounded && upcoming.length < 200 ? own.filter(({ event }) => event.startAt < now).sort((a, b) => -ascending(a, b)).slice(0, 200 - upcoming.length) : []
        const scanned = [...upcoming, ...history]
        const seen = new Set<string>()
        const items: AssociationAgendaEventView[] = []
        for (const { row, event } of scanned) {
          if (seen.has(event.id) || (row.status !== "accepted" && !(row.status === "pending" && Number.isSafeInteger(row.sequence) && (row.sequence ?? 0) > 0)) || event.moderation !== "published" || !canReadEvent(event)) continue
          seen.add(event.id)
          const organizer = pageOf(event.pageId)!
          items.push({ kind: "association", eventId: event.id, pageId: event.pageId, title: event.title, description: event.description || null, location: event.location || null, startAt: event.startAt, endAt: event.endAt, timeZone: event.timeZone, status: event.status, cancelledAt: event.cancelledAt ?? null, version: event.version, organizer: { name: organizer.name, handle: organizer.handle }, registration: row.status === "accepted" ? "confirmed" : "waitlisted" })
        }
        items.sort((a, b) => a.startAt - b.startAt || a.eventId.localeCompare(b.eventId))
        return ready({ items, truncated: scanned.length >= 200 })
      }, [tick, now, from, to])
    },
    async exportIcal(eventId) {
      const code = refusal()
      if (code) return fail(code)
      const initial = current()
      const personId = viewerId()
      const event = initial.events.find((row) => row.id === eventId)
      if (!event || event.moderation !== "published" || !canReadEvent(event)) return fail("not_found")
      let uid: string
      try {
        const hash = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(`diasporale:demonstration:association-calendar:v1:${initial.seedCreatedAt}:${eventId}`))
        uid = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")
      } catch { return fail("unknown") }
      if (viewerId() !== personId || current().seedCreatedAt !== initial.seedCreatedAt) return fail("not_found")
      const currentCode = refusal()
      if (currentCode) return fail(currentCode)
      const fresh = current().events.find((row) => row.id === eventId)
      if (!fresh || fresh.moderation !== "published" || !canReadEvent(fresh)) return fail("not_found")
      const mine = current().registrations.find((row) => row.eventId === eventId && row.personId === personId)
      let content: string
      try { content = serializeCalendarEvent({ uid, title: fresh.title, description: fresh.description || undefined, location: fresh.location || undefined, startAt: fresh.startAt, endAt: fresh.endAt, createdAt: fresh.createdAt, updatedAt: fresh.updatedAt ?? fresh.createdAt, sequence: fresh.version, status: fresh.status === "cancelled" ? "cancelled" : mine?.status === "accepted" ? "confirmed" : "tentative" }) } catch { return fail("not_found") }
      return { ok: true, value: { filename: "diasporale-event.ics", content, mediaType: "text/calendar;charset=utf-8" } }
    },
  }
  /** Curseurs composites liés à leur liste : aucune pagination par index mutable. */
  function page<T extends { readonly id: string }>(rows: readonly T[], cursor: string | null, scope: string, instant: (row: T) => number, direction: -1 | 1 = -1): Loadable<AssociationActivityPage<T>> {
    let boundary: { readonly at: number; readonly id: string } | null = null
    if (cursor !== null) {
      try {
        const parsed: unknown = JSON.parse(cursor)
        if (!Array.isArray(parsed) || parsed.length !== 4 || parsed[0] !== "demo-association-activities" || parsed[1] !== scope || typeof parsed[2] !== "number" || !Number.isFinite(parsed[2]) || typeof parsed[3] !== "string") return failed("unknown")
        boundary = { at: parsed[2], id: parsed[3] }
      } catch { return failed("unknown") }
    }
    const after = boundary
    const remaining = [...rows].sort((a, b) => direction * (instant(a) - instant(b) || (a.id === b.id ? 0 : a.id < b.id ? -1 : 1)))
      .filter((row) => after === null || direction * (instant(row) - after.at) > 0 || (instant(row) === after.at && (direction === 1 ? row.id > after.id : row.id < after.id)))
    const items = remaining.slice(0, ASSOCIATION_ACTIVITY_PAGE_SIZE)
    const last = items[items.length - 1]
    const isDone = remaining.length <= ASSOCIATION_ACTIVITY_PAGE_SIZE
    return ready({ items, isDone, continueCursor: !isDone && last ? JSON.stringify(["demo-association-activities", scope, instant(last), last.id]) : null })
  }
  function managedEvent(eventId: string): EventRow | null {
    const event = current().events.find((row) => row.id === eventId)
    return event && eventManager(event.pageId) && canReadEvent(event) ? event : null
  }
  const versionMatches = (expected: number, actual: number) => Number.isSafeInteger(expected) && expected > 0 && expected === actual
  const replaceEvent = (event: EventRow) => current().events.map((row) => row.id === event.id ? event : row)

  return {
    groups: {
      useGroup(pageId) {
        const tick = useSnapshot()
        return useMemo<Loadable<AssociationGroupView | null>>(() => {
          if (tick === "") return LOADING
          const data = current()
          const code = refusal()
          if (code) return failed(code)
          if (!pageOf(pageId)) return ready(null)
          const group = data.groups.find((row) => row.pageId === pageId)
          return ready(group ? groupView(group) : null)
        }, [tick, pageId])
      },
      usePosts({ groupId, cursor }) {
        const tick = useSnapshot()
        return useMemo<Loadable<AssociationActivityPage<AssociationGroupPostView>>>(() => {
          if (tick === "") return LOADING
          const data = current()
          const code = refusal()
          if (code) return failed(code)
          const group = data.groups.find((row) => row.id === groupId)
          if (!group || group.closedAt !== null) return failed("not_found")
          if (!eligible(group.pageId, viewerId())) return failed("not_found")
          const role = groupRole(group)
          if (role === null) return failed("not_found")
          const result = page(data.posts.filter((row) => row.groupId === groupId), cursor, `posts:${groupId}`, (row) => row.createdAt)
          return result.status === "ready" ? ready({ ...result.data, items: result.data.items.filter((row) => row.removedAt === null && (row.moderation === "published" || (row.moderation === "pending_review" && row.authorId === viewerId())) && !blocked(viewerId(), row.authorId)).map((row) => postView(row, role)) }) : result
        }, [tick, groupId, cursor])
      },
      async create({ pageId, idempotencyKey }) {
        const code = refusal(true)
        if (code) return fail(code)
        if (!pageOf(pageId) || pageRole(pageId) !== "admin" || !eligible(pageId, viewerId())) return fail("not_found")
        const data = current()
        const existing = data.groups.find((row) => row.pageId === pageId)
        if (existing) return { ok: true, value: { groupId: existing.id, created: false } }
        if (!idempotencyKey.trim() || idempotencyKey.length > 200 || data.groups.some((row) => row.createdById === viewerId() && row.idempotencyKey === idempotencyKey)) return fail("unknown")
        const page = pageOf(pageId)!
        const label = page.name.trim().length < 3 ? page.handle : page.name.trim()
        let name = ""
        for (const character of label) {
          if (name.length + character.length > THEMATIC_GROUP_NAME_MAX_LENGTH) break
          name += character
        }
        if (name.length < 3 || name.length > THEMATIC_GROUP_NAME_MAX_LENGTH) return fail("unknown")
        const groupId = `groupe-association-demo-${data.sequence}`
        commit({ ...data, sequence: data.sequence + 1, groups: [...data.groups, { id: groupId, pageId, name, createdById: viewerId(), idempotencyKey, closedAt: null, createdAt: store.now() }], members: [...data.members, { groupId, personId: viewerId(), leftAt: null }] })
        return { ok: true, value: { groupId, created: true } }
      },
      async join(groupId) {
        const code = refusal(true)
        if (code) return fail(code)
        const data = current()
        const group = data.groups.find((row) => row.id === groupId)
        if (!group || group.closedAt !== null || !eligible(group.pageId, viewerId())) return fail("not_found")
        if (groupRole(group) !== null) return OK
        const existing = data.members.find((row) => row.groupId === groupId && row.personId === viewerId())
        commit({ ...data, members: existing ? data.members.map((row) => row === existing ? { ...row, leftAt: null } : row) : [...data.members, { groupId, personId: viewerId(), leftAt: null }] })
        return OK
      },
      async leave(groupId) {
        const code = refusal()
        if (code) return fail(code)
        const data = current()
        const group = data.groups.find((row) => row.id === groupId)
        if (!group || group.closedAt !== null || groupRole(group) === null) return fail("not_found")
        commit({ ...data, members: data.members.map((row) => row.groupId === groupId && row.personId === viewerId() ? { ...row, leftAt: store.now() } : row) })
        return OK
      },
      async close(groupId) {
        const code = refusal(true)
        if (code) return fail(code)
        const data = current()
        const group = data.groups.find((row) => row.id === groupId)
        if (!group || pageRole(group.pageId) !== "admin" || !eligible(group.pageId, viewerId())) return fail("not_found")
        if (group.closedAt === null) commit({ ...data, groups: data.groups.map((row) => row.id === groupId ? { ...row, closedAt: store.now() } : row) })
        return OK
      },
      async publish({ groupId, body, idempotencyKey }) {
        const code = refusal(true)
        if (code) return fail(code)
        const data = current()
        const group = data.groups.find((row) => row.id === groupId)
        if (!group || group.closedAt !== null || groupRole(group) === null) return fail("not_found")
        if (data.posts.some((row) => row.authorId === viewerId() && row.idempotencyKey === idempotencyKey)) return OK
        const text = body.trim()
        if (!text) return fail("post_empty")
        if (text.length > PERSONAL_POST_MAX_LENGTH) return fail("post_too_long")
        if (!idempotencyKey.trim() || idempotencyKey.length > 200) return fail("unknown")
        commit({ ...data, sequence: data.sequence + 1, posts: [...data.posts, { id: `publication-association-demo-${data.sequence}`, groupId, authorId: viewerId(), body: text, idempotencyKey, moderation: "pending_review", createdAt: store.now(), removedAt: null }] })
        return OK
      },
      async removePost({ groupId, postId }) {
        const code = refusal()
        if (code) return fail(code)
        const data = current()
        const group = data.groups.find((row) => row.id === groupId)
        const post = data.posts.find((row) => row.id === postId && row.groupId === groupId)
        const role = group ? groupRole(group) : null
        if (!group || group.closedAt !== null || role === null || !post) return fail("not_found")
        if (post.authorId !== viewerId() && role !== "owner" && role !== "moderator") return fail("not_found")
        if (post.authorId !== viewerId()) { const writeRefusal = refusal(true); if (writeRefusal) return fail(writeRefusal) }
        if (post.removedAt === null) commit({ ...data, posts: data.posts.map((row) => row.id === postId ? { ...row, removedAt: store.now(), moderation: "removed" } : row) })
        return OK
      },
    },
    events: {
      reminderDelivery: "preferences_only",
      attendance,
      gallery,
      calendar,
      useEvents({ pageId, cursor }) {
        const tick = useSnapshot()
        return useMemo<Loadable<AssociationActivityPage<AssociationEventView>>>(() => {
          if (tick === "") return LOADING
          const data = current()
          const code = refusal()
          if (code) return failed(code)
          if (!pageOf(pageId)) return failed("not_found")
          const result = page(data.events.filter((row) => row.pageId === pageId), cursor, `events:${pageId}`, (row) => row.startAt, 1)
          return result.status === "ready" ? ready({ ...result.data, items: result.data.items.filter(canReadEvent).map(eventView) }) : result
        }, [tick, pageId, cursor])
      },
      useEvent(eventId) {
        const tick = useSnapshot()
        return useMemo<Loadable<AssociationEventView | null>>(() => {
          if (tick === "") return LOADING
          const data = current()
          const code = refusal()
          if (code) return failed(code)
          const event = data.events.find((row) => row.id === eventId)
          return ready(event && canReadEvent(event) ? eventView(event) : null)
        }, [tick, eventId])
      },
      async create(input) {
        const code = refusal(true)
        if (code) return fail(code)
        if (!pageOf(input.pageId)) return fail("not_found")
        if (!eventManager(input.pageId)) return fail("association_event_access_required")
        const key = input.idempotencyKey.trim()
        if (!key || key.length > 128) return fail("association_event_invalid")
        const parsed = parsedEvent(input)
        if (!parsed) return fail("association_event_invalid")
        const capacity = parseAssociationEventCapacity(input.capacity)
        if (!capacity.ok) return fail(capacity.code)
        const deadline = parseAssociationEventDeadline(input.registrationClosesAt, parsed.startAt)
        if (!deadline.ok) return fail(deadline.code)
        const data = current()
        const existing = data.events.find((row) => row.pageId === input.pageId && row.idempotencyKey === key)
        if (existing) return JSON.stringify({ ...parsedEvent(existing), capacity: existing.capacity, registrationClosesAt: existing.registrationClosesAt }) === JSON.stringify({ ...parsed, capacity: capacity.value, registrationClosesAt: deadline.value })
          ? { ok: true, value: { eventId: existing.id, created: false } } : fail("association_event_version_changed")
        if (parsed.startAt <= store.now()) return fail("association_event_invalid")
        const eventId = `evenement-association-demo-${data.sequence}`
        commit({ ...data, sequence: data.sequence + 1, events: [...data.events, { ...parsed, capacity: capacity.value, registrationClosesAt: deadline.value, id: eventId, idempotencyKey: key, version: 1, status: "scheduled", moderation: "pending_review", createdAt: store.now(), updatedAt: store.now(), cancelledAt: null }] })
        return { ok: true, value: { eventId, created: true } }
      },
      async update(input) {
        const code = refusal(true)
        if (code) return fail(code)
        const event = managedEvent(input.eventId)
        if (!event || event.pageId !== input.pageId) return fail("not_found")
        if (!versionMatches(input.expectedVersion, event.version)) return fail("association_event_version_changed")
        if (event.status === "cancelled") return fail("association_event_cancelled")
        const parsed = parsedEvent(input)
        if (!parsed) return fail("association_event_invalid")
        const capacity = parseAssociationEventCapacity(input.capacity === undefined ? event.capacity : input.capacity)
        if (!capacity.ok) return fail(capacity.code)
        const deadline = parseAssociationEventDeadline(input.registrationClosesAt === undefined ? event.registrationClosesAt : input.registrationClosesAt, parsed.startAt)
        if (!deadline.ok) return fail(deadline.code)
        const capacityChange = checkAssociationEventCapacityChange(capacity.value, confirmedCount(current(), event.id))
        if (!capacityChange.ok) return fail(capacityChange.code)
        const rescheduled = parsed.startAt !== event.startAt || parsed.endAt !== event.endAt || parsed.timeZone !== event.timeZone
        if (rescheduled && current().registrations.some((row) => row.eventId === event.id)) return fail("association_event_schedule_locked")
        if (rescheduled && parsed.startAt <= store.now()) return fail("association_event_invalid")
        const contentChanged = JSON.stringify(parsedEvent(event)) !== JSON.stringify(parsed)
        const nextEvent: EventRow = { ...event, ...parsed, capacity: capacity.value, registrationClosesAt: deadline.value, updatedAt: store.now(), version: event.version + 1, moderation: contentChanged ? "pending_review" : event.moderation }
        const next = { ...current(), events: replaceEvent(nextEvent) }
        commit(resumeWaitlist(next, nextEvent))
        return OK
      },
      async cancel({ eventId, expectedVersion }) {
        const code = refusal(true)
        if (code) return fail(code)
        const event = managedEvent(eventId)
        if (!event) return fail("not_found")
        if (!versionMatches(expectedVersion, event.version)) return fail("association_event_version_changed")
        if (event.status !== "cancelled") commit({ ...current(), events: replaceEvent({ ...event, status: "cancelled", updatedAt: store.now(), cancelledAt: store.now(), version: event.version + 1 }) })
        return OK
      },
      async register(eventId) {
        const code = refusal(true)
        if (code) return fail(code)
        const data = current()
        const event = data.events.find((row) => row.id === eventId)
        if (!event || !canReadEvent(event) || event.moderation !== "published") return fail("not_found")
        const mine = data.registrations.find((row) => row.eventId === eventId && row.personId === viewerId())
        if (!isAssociationEventRegistrationOpen(event, store.now())) {
          if (!mine || mine.status === "declined") return fail("association_event_registration_closed")
          const reconciled = withoutErasedRegistrations(data)
          if (reconciled !== data) commit(reconciled)
          return OK
        }
        if (event.status === "cancelled") return fail("association_event_cancelled")
        let next = data
        if (!mine || mine.status === "declined") {
          const queuesAhead = waiting(data, event.id, true).length > 0
          const placeAvailable = event.capacity === null || confirmedCount(data, event.id) < event.capacity
          const queued = queuesAhead || !placeAvailable
          const row: RegistrationRow = { ...(mine ? invalidateAttendance(mine) : { eventId, personId: viewerId() }), status: queued ? "pending" : "accepted", reminderEnabled: false, ...(queued ? { sequence: data.sequence } : {}) }
          next = { ...data, sequence: data.sequence + (queued ? 1 : 0), registrations: mine ? data.registrations.map((candidate) => candidate === mine ? row : candidate) : [...data.registrations, row] }
        }
        next = resumeWaitlist(next, event)
        if (next !== data) commit(next)
        return OK
      },
      async unregister(eventId) {
        const code = refusal()
        if (code) return fail(code)
        const data = current()
        if (!data.events.some((row) => row.id === eventId)) return fail("not_found")
        const mine = data.registrations.find((row) => row.eventId === eventId && row.personId === viewerId())
        if (!mine) return fail("not_found")
        const event = data.events.find((row) => row.id === eventId)!
        const withdrawn = mine.status !== "declined" || mine.reminderEnabled === true ? { ...data, registrations: data.registrations.map((row): RegistrationRow => row === mine ? { ...invalidateAttendance(row), status: "declined", reminderEnabled: false } : row) } : data
        const next = resumeWaitlist(withdrawn, event)
        if (next !== data) commit(next)
        return OK
      },
      async setReminder({ eventId, enabled }) {
        const code = refusal()
        if (code) return fail(code)
        const data = current()
        const event = data.events.find((row) => row.id === eventId)
        const mine = data.registrations.find((row) => row.eventId === eventId && row.personId === viewerId())
        if (!event || !mine) return fail("not_found")
        if (enabled) {
          if (!canReadEvent(event) || event.moderation !== "published" || event.status !== "scheduled" || event.startAt <= store.now() || mine.status === "declined") return fail("not_found")
          if (associationEventReminderAt(event.startAt) <= store.now() && mine.reminderRecordedForStartAt !== event.startAt) return fail("association_event_reminder_too_late")
        }
        const reconciled = withoutErasedRegistrations(data)
        if ((mine.reminderEnabled ?? false) !== enabled || reconciled !== data) commit({ ...reconciled, registrations: reconciled.registrations.map((row) => row === mine ? { ...row, reminderEnabled: enabled } : row) })
        return OK
      },
    },
  }
}
