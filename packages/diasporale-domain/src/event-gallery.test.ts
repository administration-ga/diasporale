import { expect, test } from "bun:test"
import { isAssociationEventGalleryOpen } from "./event-gallery"

test("gallery opens at the exact end, never on cancellation or an invalid clock", () => {
  const event = { endAt: Date.UTC(2026, 9, 25, 12), status: "scheduled" as const }
  expect(isAssociationEventGalleryOpen(event, event.endAt - 1)).toBe(false)
  expect(isAssociationEventGalleryOpen(event, event.endAt)).toBe(true)
  expect(isAssociationEventGalleryOpen({ ...event, status: "cancelled" }, event.endAt + 1)).toBe(false)
  expect(isAssociationEventGalleryOpen(event, Number.NaN)).toBe(false)
  expect(isAssociationEventGalleryOpen({ ...event, endAt: Infinity }, event.endAt)).toBe(false)
})
