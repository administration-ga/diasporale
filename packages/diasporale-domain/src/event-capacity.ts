/** DG-023 : capacité d'un événement associatif ; null signifie sans limite. */
import { ok, refuse, type Result } from "./result"

export const ASSOCIATION_EVENT_MAX_CAPACITY = 10_000
export const ASSOCIATION_EVENT_WAITLIST_BATCH_SIZE = 32
export type AssociationEventCapacityError = "association_event_capacity_invalid" | "association_event_capacity_below_confirmed"

export function parseAssociationEventCapacity(value: unknown): Result<number | null, "association_event_capacity_invalid"> {
  if (value === null || value === undefined) return ok(null)
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= ASSOCIATION_EVENT_MAX_CAPACITY
    ? ok(value) : refuse("association_event_capacity_invalid")
}

/** Une réduction ne retire jamais silencieusement une place déjà confirmée. */
export function checkAssociationEventCapacityChange(capacity: number | null, confirmedCount: number): Result<null, "association_event_capacity_below_confirmed"> {
  return capacity !== null && capacity < confirmedCount ? refuse("association_event_capacity_below_confirmed") : ok(null)
}
