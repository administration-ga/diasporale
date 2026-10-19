import { describe, expect, test } from "bun:test"
import { associationEventReminderAt, isAssociationEventRegistrationOpen, parseAssociationEventDeadline } from "./event-timing"

const START = Date.UTC(2026, 9, 26, 17)
describe("dates limites des événements associatifs", () => {
  test("l'absence clôture au début et accepte une fermeture volontaire passée", () => {
    expect(parseAssociationEventDeadline(undefined, START)).toEqual({ ok: true, value: null })
    expect(parseAssociationEventDeadline(null, START)).toEqual({ ok: true, value: null })
    expect(parseAssociationEventDeadline(START, START)).toEqual({ ok: true, value: START })
    expect(parseAssociationEventDeadline(START - 86_400_000, START)).toEqual({ ok: true, value: START - 86_400_000 })
  })
  test("refuse les instants ambigus ou postérieurs au début", () => {
    for (const value of [START + 1, NaN, Infinity, 1.5, "2026-10-26", false, {}]) {
      expect(parseAssociationEventDeadline(value, START)).toEqual({ ok: false, code: "association_event_deadline_invalid" })
    }
  })
  test("la borne est exclusive, y compris à l'instant exact de la clôture", () => {
    const registrationClosesAt = START - 1000
    expect(isAssociationEventRegistrationOpen({ startAt: START, registrationClosesAt }, registrationClosesAt - 1)).toBe(true)
    expect(isAssociationEventRegistrationOpen({ startAt: START, registrationClosesAt }, registrationClosesAt)).toBe(false)
    expect(isAssociationEventRegistrationOpen({ startAt: START }, START)).toBe(false)
    expect(isAssociationEventRegistrationOpen({ startAt: START }, NaN)).toBe(false)
  })
  test("le rappel est 24 heures réelles avant l'instant, indépendamment du changement d'heure", () => {
    expect(associationEventReminderAt(START)).toBe(Date.UTC(2026, 9, 25, 17))
  })
})
