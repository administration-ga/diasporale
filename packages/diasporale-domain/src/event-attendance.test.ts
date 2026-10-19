import { describe, expect, test } from "bun:test"
import { associationEventAttendanceCode, associationEventAttendanceWindow, isAssociationEventAttendanceOpen, parseAssociationEventAttendanceCode } from "./event-attendance"

describe("association event attendance", () => {
  const event = { startAt: Date.UTC(2026, 9, 25, 10), endAt: Date.UTC(2026, 9, 25, 12) }
  test("opens one real hour before the start and excludes the exact end", () => {
    const { opensAt, closesAt } = associationEventAttendanceWindow(event)
    expect(isAssociationEventAttendanceOpen(event, opensAt - 1)).toBe(false)
    expect(isAssociationEventAttendanceOpen(event, opensAt)).toBe(true)
    expect(isAssociationEventAttendanceOpen(event, closesAt - 1)).toBe(true)
    expect(isAssociationEventAttendanceOpen(event, closesAt)).toBe(false)
  })
  test("rejects invalid event windows and clocks", () => {
    expect(isAssociationEventAttendanceOpen({ startAt: 20, endAt: 10 }, 15)).toBe(false)
    expect(isAssociationEventAttendanceOpen(event, Number.NaN)).toBe(false)
    expect(isAssociationEventAttendanceOpen({ ...event, endAt: Infinity }, event.startAt)).toBe(false)
  })
  test("accepts only the versioned opaque code, never a URL or identifier", () => {
    const code = associationEventAttendanceCode("a".repeat(64))!
    expect(parseAssociationEventAttendanceCode(` ${code}\n`)).toBe(code)
    for (const value of [null, 42, "https://example.invalid/attendance", "person-id", `${code}x`, code.toUpperCase()]) expect(parseAssociationEventAttendanceCode(value)).toBeNull()
    expect(associationEventAttendanceCode("a".repeat(63))).toBeNull()
  })
})
