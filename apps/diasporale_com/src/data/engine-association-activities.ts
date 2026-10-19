"use client"

/** Activités des associations (DG-010) : lectures réactives privées et écritures du moteur courant. */
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  ASSOCIATION_ACTIVITY_PAGE_SIZE,
  type ActionErrorCode,
  type AssociationActivityPage,
  type AssociationEventInput,
  type AssociationEventAttendanceView,
  type AssociationEventAttendanceRow,
  type AssociationEventGalleryState,
  type AssociationEventGalleryItem,
  type AssociationAgendaView,
  type AssociationAgendaEventView,
  type AssociationEventsCapability,
  type AssociationEventView,
  type AssociationGroupsCapability,
  type AssociationGroupPostView,
  type AssociationGroupView,
  type Loadable,
} from "@diasporale/features/data"
import type { FunctionReturnType } from "convex/server"
import { useMemo } from "react"

import { attemptAction, failed, LOADING, memberReadError, ready, Refusal, resolveDiasporaleNetworkId, useEngineMember, useLoaded, type EngineSourceDeps, type Loaded } from "./engine-kit"
import { toDeclaredMedia, toPostView } from "./engine-views"

const GROUPS = api.modules.thematicGroups.thematicGroups
const ASSOCIATIONS = api.modules.diaspora.associationGroups
const EVENTS = api.modules.events.pageEvents
const REMINDERS = api.modules.events.pageEventReminders
const ATTENDANCE = api.modules.events.pageEventAttendance
const GALLERY = api.modules.events.pageEventGallery
const CALENDAR = api.modules.events.pageEventCalendar
type GroupDto = NonNullable<FunctionReturnType<typeof ASSOCIATIONS.groupForPage>>
type EventDto = NonNullable<FunctionReturnType<typeof EVENTS.get>>
type PostDto = FunctionReturnType<typeof ASSOCIATIONS.posts>["items"][number]
type AttendanceDto = NonNullable<FunctionReturnType<typeof ATTENDANCE.get>>
type PresentDto = FunctionReturnType<typeof ATTENDANCE.listPresent>["items"][number]

function groupView(row: GroupDto): AssociationGroupView {
  return { groupId: row.groupId, pageId: row.pageId, name: row.name, state: row.state, role: row.role, isMember: row.isMember, canJoin: row.canJoin, canManage: row.canManage, canPublish: row.canPublish }
}
function eventView(row: EventDto): AssociationEventView {
  return {
    eventId: row.eventId, pageId: row.pageId, title: row.title, description: row.description, location: row.location,
    startAt: row.startAt, endAt: row.endAt, timeZone: row.timeZone, audience: row.audience, status: row.status, version: row.version,
    organizer: { name: row.organizer.name, handle: row.organizer.handle }, moderation: row.moderation,
    isRegistered: row.isRegistered, canManage: row.canManage, canRegister: row.canRegister,
    capacity: row.capacity, confirmedCount: row.confirmedCount, waitlistCount: row.waitlistCount,
    remainingPlaces: row.remainingPlaces, registration: row.registration, waitlistPosition: row.waitlistPosition,
    registrationClosesAt: row.registrationClosesAt, registrationOpen: row.registrationOpen,
    reminderEnabled: row.reminderEnabled, reminderAt: row.reminderAt, reminderState: row.reminderState,
  }
}
function postView(row: PostDto): AssociationGroupPostView {
  return { postId: row.postId, body: row.body, author: { displayName: row.author.displayName }, createdAt: row.createdAt, isMine: row.isMine, canRemove: row.canRemove, moderation: row.moderation }
}
function attendanceView(row: AttendanceDto): AssociationEventAttendanceView {
  return { eventId: row.eventId, opensAt: row.opensAt, closesAt: row.closesAt, isOpen: row.isOpen, canIssueTicket: row.canIssueTicket, canManage: row.canManage, checkedInAt: row.checkedInAt, version: row.version, recordedCount: row.recordedCount }
}
function presentView(row: PresentDto): AssociationEventAttendanceRow {
  return { registrationId: row.registrationId, displayName: row.displayName, checkedInAt: row.checkedInAt, version: row.version }
}
function useReader() {
  const member = useEngineMember()
  const error = memberReadError(member)
  const canRead = error === null && member.auth.isAuthenticated && member.membership.state === "ready" && member.membership.value !== null
  return { networkId: canRead && member.networkId.state === "ready" ? member.networkId.value : null, error }
}
function useAttendanceReader() {
  const reader = useReader()
  const person = useLoaded(api.modules.people.persons.getMyPerson, reader.networkId ? {} : "skip")
  const personId = person.state === "ready" ? person.value?._id ?? null : null
  return { networkId: reader.networkId, personId, error: reader.error ?? (person.state === "error" ? person.code : null) }
}
function useStableLoaded<T, V>(error: ActionErrorCode | null, loaded: Loaded<T>, project: (row: T) => V): Loadable<V> {
  const value = loaded.state === "ready" ? loaded.value : undefined
  const code = loaded.state === "error" ? loaded.code : null
  return useMemo(() => {
    if (error !== null) return failed<V>(error)
    if (loaded.state === "loading") return LOADING
    if (loaded.state === "error") return failed<V>(loaded.code)
    return ready(project(loaded.value))
    // La projection ne dépend que de sa réponse et des refus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, loaded.state, value, code])
}
function eventInput(input: AssociationEventInput) {
  return { pageId: input.pageId as Id<"pages">, title: input.title, description: input.description, location: input.location, startAt: input.startAt, endAt: input.endAt, timeZone: input.timeZone, audience: input.audience, ...(input.capacity === undefined ? {} : { capacity: input.capacity }), ...(input.registrationClosesAt === undefined ? {} : { registrationClosesAt: input.registrationClosesAt }) }
}

export function createEngineAssociationActivities(deps: EngineSourceDeps): { readonly groups: AssociationGroupsCapability; readonly events: AssociationEventsCapability } {
  const networkOf = () => resolveDiasporaleNetworkId(deps.convex)
  return {
    groups: {
      useGroup(pageId) {
        const reader = useReader()
        const loaded = useLoaded(ASSOCIATIONS.groupForPage, reader.networkId ? { networkId: reader.networkId, pageId: pageId as Id<"pages"> } : "skip")
        return useStableLoaded(reader.error, loaded, (row): AssociationGroupView | null => row ? groupView(row) : null)
      },
      usePosts({ groupId, cursor }) {
        const reader = useReader()
        const loaded = useLoaded(ASSOCIATIONS.posts, reader.networkId
          ? { networkId: reader.networkId, groupId: groupId as Id<"thematicGroups">, paginationOpts: { cursor, numItems: ASSOCIATION_ACTIVITY_PAGE_SIZE } }
          : "skip")
        return useStableLoaded(reader.error, loaded, (row): AssociationActivityPage<AssociationGroupPostView> => ({ items: row.items.map(postView), continueCursor: row.isDone ? null : row.continueCursor, isDone: row.isDone }))
      },
      create: ({ pageId, idempotencyKey }) => attemptAction(async () => {
        const row = await deps.convex.mutation(ASSOCIATIONS.createGroupForPage, { networkId: await networkOf(), pageId: pageId as Id<"pages">, idempotencyKey })
        return { groupId: row.groupId as string, created: row.created }
      }),
      join: (groupId) => attemptAction(async () => { await deps.convex.mutation(GROUPS.join, { networkId: await networkOf(), groupId: groupId as Id<"thematicGroups"> }); return null }),
      leave: (groupId) => attemptAction(async () => { await deps.convex.mutation(GROUPS.leave, { networkId: await networkOf(), groupId: groupId as Id<"thematicGroups"> }); return null }),
      close: (groupId) => attemptAction(async () => { await deps.convex.mutation(GROUPS.closeGroup, { networkId: await networkOf(), groupId: groupId as Id<"thematicGroups"> }); return null }),
      publish: ({ groupId, body, idempotencyKey }) => attemptAction(async () => {
        await deps.convex.mutation(api.modules.posts.posts.publish, { networkId: await networkOf(), groupId: groupId as Id<"thematicGroups">, body, idempotencyKey, audience: "group", reach: "diaspora", alsoOnRoot: false })
        return null
      }),
      removePost: ({ postId, isMine }) => attemptAction(async () => {
        await deps.convex.mutation(isMine ? api.modules.posts.posts.remove : GROUPS.removeGroupPost, { networkId: await networkOf(), postId: postId as Id<"posts"> })
        return null
      }),
    },
    events: {
      reminderDelivery: "engine",
      calendar: {
        mode: "engine",
        useAgendaPage({ anchor, period, cursor, readerPersonId }) {
          const reader = useAttendanceReader()
          const mismatch = reader.personId !== null && reader.personId !== readerPersonId
          const loaded = useLoaded(api.modules.events.events.paginateMyAgenda, reader.networkId && reader.personId && !mismatch
            ? { networkId: reader.networkId, source: "participations", period, anchor, expectedReaderPersonId: reader.personId, paginationOpts: { numItems: ASSOCIATION_ACTIVITY_PAGE_SIZE, cursor } } : "skip")
          return useStableLoaded(reader.error ?? (mismatch ? "not_found" : null), loaded, (row): AssociationActivityPage<AssociationAgendaEventView> => ({
            items: row.page.flatMap((entry): AssociationAgendaEventView[] => entry.kind !== "association" ? [] : [{ kind: "association", eventId: entry.event.eventId, pageId: entry.event.pageId, title: entry.event.title, description: entry.event.description, location: entry.event.location, startAt: entry.event.startAt, endAt: entry.event.endAt, timeZone: entry.event.timeZone, status: entry.event.status, cancelledAt: entry.event.cancelledAt, version: entry.event.version, organizer: { name: entry.event.organizer.name, handle: entry.event.organizer.handle }, registration: entry.event.registration }]),
            continueCursor: row.isDone ? null : row.continueCursor, isDone: row.isDone,
          }))
        },
        useAgenda({ now, from, to }) {
          const reader = useAttendanceReader()
          const loaded = useLoaded(api.modules.events.events.myAgenda, reader.networkId && reader.personId
            ? { networkId: reader.networkId, expectedReaderPersonId: reader.personId, now, ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }) } : "skip")
          return useStableLoaded(reader.error, loaded, (row): AssociationAgendaView => ({
            items: (row.associationItems ?? []).map((item) => ({ kind: "association", eventId: item.eventId, pageId: item.pageId, title: item.title, description: item.description, location: item.location, startAt: item.startAt, endAt: item.endAt, timeZone: item.timeZone, status: item.status, cancelledAt: item.cancelledAt, version: item.version, organizer: { name: item.organizer.name, handle: item.organizer.handle }, registration: item.registration })),
            truncated: row.truncated,
          }))
        },
        exportIcal: (eventId) => attemptAction(async () => {
          const networkId = await networkOf()
          const reader = await deps.convex.query(api.modules.people.persons.getMyPerson, {})
          if (!reader) throw new Refusal("not_found")
          const file = await deps.convex.query(CALENDAR.exportIcal, { networkId, eventId: eventId as Id<"events">, expectedReaderPersonId: reader._id })
          const currentReader = await deps.convex.query(api.modules.people.persons.getMyPerson, {})
          if (!currentReader || currentReader._id !== reader._id) throw new Refusal("not_found")
          return { filename: file.filename, content: file.content, mediaType: file.mediaType }
        }),
      },
      attendance: {
        mode: "engine",
        useAttendance(eventId) {
          const reader = useAttendanceReader()
          const loaded = useLoaded(ATTENDANCE.get, reader.networkId && reader.personId
            ? { networkId: reader.networkId, eventId: eventId as Id<"events">, expectedReaderPersonId: reader.personId } : "skip")
          return useStableLoaded(reader.error, loaded, (row): AssociationEventAttendanceView | null => row ? attendanceView(row) : null)
        },
        usePresent({ eventId, cursor }) {
          const reader = useAttendanceReader()
          const loaded = useLoaded(ATTENDANCE.listPresent, reader.networkId && reader.personId
            ? { networkId: reader.networkId, eventId: eventId as Id<"events">, expectedReaderPersonId: reader.personId, paginationOpts: { cursor, numItems: ASSOCIATION_ACTIVITY_PAGE_SIZE } } : "skip")
          return useStableLoaded(reader.error, loaded, (row): AssociationActivityPage<AssociationEventAttendanceRow> => ({ items: row.items.map(presentView), continueCursor: row.isDone ? null : row.continueCursor, isDone: row.isDone }))
        },
        issueTicket: (eventId) => attemptAction(async () => {
          const ticket = await deps.convex.mutation(ATTENDANCE.issueTicket, { networkId: await networkOf(), eventId: eventId as Id<"events"> })
          return { code: ticket.code, expiresAt: ticket.expiresAt }
        }),
        previewTicket: ({ eventId, code }) => attemptAction(async () => {
          const row = await deps.convex.mutation(ATTENDANCE.previewTicket, { networkId: await networkOf(), eventId: eventId as Id<"events">, code })
          return { registrationId: row.registrationId, displayName: row.displayName, checkedInAt: row.checkedInAt, version: row.version, expiresAt: row.expiresAt }
        }),
        checkIn: ({ eventId, code, expectedVersion }) => attemptAction(async () => {
          const row = await deps.convex.mutation(ATTENDANCE.checkIn, { networkId: await networkOf(), eventId: eventId as Id<"events">, code, expectedVersion })
          return { alreadyRecorded: row.alreadyRecorded }
        }),
        clear: ({ eventId, registrationId, expectedVersion }) => attemptAction(async () => { await deps.convex.mutation(ATTENDANCE.clear, { networkId: await networkOf(), eventId: eventId as Id<"events">, registrationId: registrationId as Id<"eventParticipants">, expectedVersion }); return null }),
      },
      gallery: {
        mode: "engine",
        useGallery(eventId, refreshKey) {
          const reader = useAttendanceReader()
          const loaded = useLoaded(GALLERY.get, reader.networkId && reader.personId
            ? { networkId: reader.networkId, eventId: eventId as Id<"events">, expectedReaderPersonId: reader.personId, ...(refreshKey === undefined ? {} : { refreshKey }) } : "skip")
          return useStableLoaded(reader.error, loaded, (row): AssociationEventGalleryState | null => row ? { eventId: row.eventId, available: row.available, canPublish: row.canPublish, audience: row.audience } : null)
        },
        useItems({ eventId, cursor }) {
          const reader = useAttendanceReader()
          const loaded = useLoaded(GALLERY.list, reader.networkId && reader.personId
            ? { networkId: reader.networkId, eventId: eventId as Id<"events">, expectedReaderPersonId: reader.personId, paginationOpts: { cursor, numItems: ASSOCIATION_ACTIVITY_PAGE_SIZE } } : "skip")
          return useStableLoaded(reader.error, loaded, (row): AssociationActivityPage<AssociationEventGalleryItem> => ({ items: row.items.map((item) => ({ post: toPostView(item.post), canRemove: item.canRemove })), continueCursor: row.isDone ? null : row.continueCursor, isDone: row.isDone }))
        },
        publish: ({ eventId, body, media, idempotencyKey }) => attemptAction(async () => {
          const row = await deps.convex.mutation(GALLERY.publish, { networkId: await networkOf(), eventId: eventId as Id<"events">, body, media: media.map(toDeclaredMedia), idempotencyKey })
          return { postId: row.postId as string, created: row.created }
        }),
        remove: ({ eventId, postId }) => attemptAction(async () => { await deps.convex.mutation(GALLERY.remove, { networkId: await networkOf(), eventId: eventId as Id<"events">, postId: postId as Id<"posts"> }); return null }),
      },
      useEvents({ pageId, cursor }) {
        const reader = useReader()
        const loaded = useLoaded(EVENTS.listForPage, reader.networkId ? { networkId: reader.networkId, pageId: pageId as Id<"pages">, paginationOpts: { cursor, numItems: ASSOCIATION_ACTIVITY_PAGE_SIZE } } : "skip")
        return useStableLoaded(reader.error, loaded, (row): AssociationActivityPage<AssociationEventView> => ({ items: row.items.map(eventView), continueCursor: row.isDone ? null : row.continueCursor, isDone: row.isDone }))
      },
      useEvent(eventId) {
        const reader = useReader()
        const loaded = useLoaded(EVENTS.get, reader.networkId ? { networkId: reader.networkId, eventId: eventId as Id<"events"> } : "skip")
        return useStableLoaded(reader.error, loaded, (row): AssociationEventView | null => row ? eventView(row) : null)
      },
      create: (input) => attemptAction(async () => {
        const row = await deps.convex.mutation(EVENTS.create, { networkId: await networkOf(), ...eventInput(input), idempotencyKey: input.idempotencyKey })
        return { eventId: row.eventId as string, created: row.created }
      }),
      update: (input) => attemptAction(async () => { await deps.convex.mutation(EVENTS.update, { networkId: await networkOf(), ...eventInput(input), eventId: input.eventId as Id<"events">, expectedVersion: input.expectedVersion }); return null }),
      cancel: ({ eventId, expectedVersion }) => attemptAction(async () => { await deps.convex.mutation(EVENTS.cancel, { networkId: await networkOf(), eventId: eventId as Id<"events">, expectedVersion }); return null }),
      register: (eventId) => attemptAction(async () => { await deps.convex.mutation(EVENTS.register, { networkId: await networkOf(), eventId: eventId as Id<"events"> }); return null }),
      unregister: (eventId) => attemptAction(async () => { await deps.convex.mutation(EVENTS.unregister, { networkId: await networkOf(), eventId: eventId as Id<"events"> }); return null }),
      setReminder: ({ eventId, enabled }) => attemptAction(async () => { await deps.convex.mutation(REMINDERS.setReminder, { networkId: await networkOf(), eventId: eventId as Id<"events">, enabled }); return null }),
    },
  }
}
