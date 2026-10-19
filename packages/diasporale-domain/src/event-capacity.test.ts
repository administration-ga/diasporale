import { describe, expect, test } from "bun:test"

import { ASSOCIATION_EVENT_MAX_CAPACITY, checkAssociationEventCapacityChange, parseAssociationEventCapacity } from "./event-capacity"

describe("capacité des événements associatifs", () => {
  test("une capacité absente conserve le mode sans limite historique", () => {
    expect(parseAssociationEventCapacity(undefined)).toEqual({ ok: true, value: null })
    expect(parseAssociationEventCapacity(null)).toEqual({ ok: true, value: null })
  })
  test("les bornes sont des nombres entiers explicites", () => {
    expect(parseAssociationEventCapacity(1)).toEqual({ ok: true, value: 1 })
    expect(parseAssociationEventCapacity(ASSOCIATION_EVENT_MAX_CAPACITY)).toEqual({ ok: true, value: ASSOCIATION_EVENT_MAX_CAPACITY })
  })
  test("refuse les valeurs ambiguës, non finies, fractionnaires ou hors borne", () => {
    for (const value of [0, -1, 1.5, NaN, Infinity, -Infinity, ASSOCIATION_EVENT_MAX_CAPACITY + 1, "12", "", false, {}, []]) {
      expect(parseAssociationEventCapacity(value)).toEqual({ ok: false, code: "association_event_capacity_invalid" })
    }
  })
  test("ne déclasse aucun participant confirmé lors d'une réduction", () => {
    expect(checkAssociationEventCapacityChange(2, 3)).toEqual({ ok: false, code: "association_event_capacity_below_confirmed" })
    expect(checkAssociationEventCapacityChange(3, 3)).toEqual({ ok: true, value: null })
    expect(checkAssociationEventCapacityChange(4, 3)).toEqual({ ok: true, value: null })
    expect(checkAssociationEventCapacityChange(null, 30_000)).toEqual({ ok: true, value: null })
  })
})
