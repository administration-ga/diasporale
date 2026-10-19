/** DG-010 : groupe privé et événements d'une association, participations volontaires. */
import type { ActionResult } from "./port"
import type { Loadable } from "./types"
import type { AssociationEventReminderState } from "@diasporale/domain"
import type { AssociationEventAttendanceCapability } from "./association-attendance-port"
import type { AssociationEventGalleryCapability } from "./association-event-gallery-port"
import type { AssociationEventCalendarCapability } from "./association-event-calendar-port"

export const ASSOCIATION_ACTIVITY_PAGE_SIZE = 20
export const ASSOCIATION_EVENT_AUDIENCES = ["network", "association"] as const
export type AssociationEventAudience = (typeof ASSOCIATION_EVENT_AUDIENCES)[number]
export const ASSOCIATION_ACTIVITY_ERROR_CODES = [
  "association_group_access_required", "association_group_closed", "association_group_exists",
  "association_event_invalid", "association_event_version_changed", "association_event_cancelled",
  "association_event_schedule_locked", "association_event_access_required",
  "association_event_capacity_invalid", "association_event_capacity_below_confirmed",
  "association_event_deadline_invalid", "association_event_registration_closed", "association_event_reminder_too_late",
  "association_event_attendance_closed", "association_event_attendance_code_invalid", "association_event_attendance_changed",
  "association_event_gallery_not_open", "association_event_gallery_media_required",
] as const

export interface AssociationActivityPage<T> {
  readonly items: readonly T[]
  readonly continueCursor: string | null
  readonly isDone: boolean
}

export interface AssociationGroupView {
  readonly groupId: string
  readonly pageId: string
  readonly name: string
  readonly state: "active" | "closed"
  readonly role: "owner" | "moderator" | "member" | null
  readonly isMember: boolean
  readonly canJoin: boolean
  readonly canManage: boolean
  readonly canPublish: boolean
}

/** Mur privé, sans coordonnées, identifiant de personne ni lien vers un profil. */
export interface AssociationGroupPostView {
  readonly postId: string
  readonly body: string
  readonly author: { readonly displayName: string | null }
  readonly createdAt: number
  readonly isMine: boolean
  readonly canRemove: boolean
  readonly moderation: "published" | "pending_review" | "removed"
}

export interface AssociationGroupsCapability {
  useGroup(pageId: string): Loadable<AssociationGroupView | null>
  usePosts(input: { readonly groupId: string; readonly cursor: string | null }): Loadable<AssociationActivityPage<AssociationGroupPostView>>
  /** Crée au plus un groupe lié ; ce geste du responsable n'inscrit aucun adhérent. */
  create(input: { readonly pageId: string; readonly idempotencyKey: string }): Promise<ActionResult<{ readonly groupId: string; readonly created: boolean }>>
  join(groupId: string): Promise<ActionResult>
  leave(groupId: string): Promise<ActionResult>
  close(groupId: string): Promise<ActionResult>
  /** Texte dans le groupe seulement ; aucune audience publique ni publication racine. */
  publish(input: { readonly groupId: string; readonly body: string; readonly idempotencyKey: string }): Promise<ActionResult>
  removePost(input: { readonly groupId: string; readonly postId: string; readonly isMine: boolean }): Promise<ActionResult>
}

export interface AssociationEventInput {
  readonly pageId: string
  readonly title: string
  readonly description: string
  readonly location: string
  readonly startAt: number
  readonly endAt: number
  readonly timeZone: string
  readonly audience: AssociationEventAudience
  /** Omission : sans limite à la création, capacité conservée lors d'une édition ancienne. */
  readonly capacity?: number | null
  /** UTC ; absence conservée en édition, null clôture seulement au début de l'événement. */
  readonly registrationClosesAt?: number | null
}

export interface AssociationEventView {
  readonly eventId: string
  readonly pageId: string
  readonly title: string
  readonly description: string
  readonly location: string
  readonly startAt: number
  readonly endAt: number
  readonly timeZone: string
  readonly audience: AssociationEventAudience
  readonly status: "scheduled" | "cancelled"
  readonly version: number
  readonly organizer: { readonly name: string; readonly handle: string }
  readonly moderation: "published" | "pending_review" | "removed"
  readonly isRegistered: boolean
  readonly canManage: boolean
  readonly canRegister: boolean
  readonly capacity: number | null
  readonly confirmedCount: number
  readonly waitlistCount: number
  readonly remainingPlaces: number | null
  readonly registration: "none" | "confirmed" | "waitlisted"
  /** Mon rang uniquement ; la file et les identités d'autrui restent privées. */
  readonly waitlistPosition: number | null
  readonly registrationClosesAt: number | null
  readonly registrationOpen: boolean
  readonly reminderEnabled: boolean
  readonly reminderAt: number | null
  readonly reminderState: AssociationEventReminderState
}

export interface AssociationEventsCapability {
  readonly reminderDelivery?: "engine" | "preferences_only"
  readonly attendance?: AssociationEventAttendanceCapability
  readonly gallery?: AssociationEventGalleryCapability
  readonly calendar?: AssociationEventCalendarCapability
  useEvents(input: { readonly pageId: string; readonly cursor: string | null }): Loadable<AssociationActivityPage<AssociationEventView>>
  useEvent(eventId: string): Loadable<AssociationEventView | null>
  create(input: AssociationEventInput & { readonly idempotencyKey: string }): Promise<ActionResult<{ readonly eventId: string; readonly created: boolean }>>
  update(input: AssociationEventInput & { readonly eventId: string; readonly expectedVersion: number }): Promise<ActionResult>
  cancel(input: { readonly eventId: string; readonly expectedVersion: number }): Promise<ActionResult>
  /** Demande une place ou rejoint la file ; un rejeu garde l'ordre et reprend son traitement borné. */
  register(eventId: string): Promise<ActionResult>
  unregister(eventId: string): Promise<ActionResult>
  /** Choix personnel, désactivé par défaut ; aucune préférence d'autrui n'est exposée. */
  setReminder(input: { readonly eventId: string; readonly enabled: boolean }): Promise<ActionResult>
}
