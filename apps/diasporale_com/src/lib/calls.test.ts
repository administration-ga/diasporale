import { describe, expect, it } from "vitest"

import { CALL_SWITCH_STATES, CALLS_SWITCH, callsAreOpen, isCallsSwitchOpen } from "./calls"

describe("interrupteur des appels (IM-01) — rien n'est proposé tant que les appels ne sont pas prouvés", () => {
  it("est fermé par défaut : le pilote ouvre sans appels (décision 2 du plan 04)", () => {
    expect(CALLS_SWITCH).toBe("closed")
    expect(callsAreOpen()).toBe(false)
  })

  it("deux positions seulement, et seule « open » ouvre les appels", () => {
    expect(CALL_SWITCH_STATES).toEqual(["closed", "open"])
    expect(isCallsSwitchOpen("closed")).toBe(false)
    expect(isCallsSwitchOpen("open")).toBe(true)
  })
})
