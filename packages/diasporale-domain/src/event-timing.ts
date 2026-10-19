/** DG-023 : clôture des inscriptions et rappel personnel la veille (instants UTC). */
import { ok, refuse, type Result } from "./result"

export const ASSOCIATION_EVENT_REMINDER_LEAD_MS = 24 * 60 * 60 * 1000
export const ASSOCIATION_EVENT_REMINDER_STATES = ["off", "waiting_confirmation", "scheduled", "recorded", "expired"] as const
export type AssociationEventReminderState = (typeof ASSOCIATION_EVENT_REMINDER_STATES)[number]

export function parseAssociationEventDeadline(value: unknown, startAt: number): Result<number | null, "association_event_deadline_invalid"> {
  if (value === undefined || value === null) return ok(null)
  return typeof value === "number" && Number.isSafeInteger(value) && Number.isFinite(startAt) && value <= startAt
    ? ok(value) : refuse("association_event_deadline_invalid")
}

export function isAssociationEventRegistrationOpen(event: { readonly startAt: number; readonly registrationClosesAt?: number | null }, now: number): boolean {
  return Number.isFinite(now) && now < event.startAt && now < (event.registrationClosesAt ?? event.startAt)
}

export const associationEventReminderAt = (startAt: number): number => startAt - ASSOCIATION_EVENT_REMINDER_LEAD_MS
