// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_CALL_SETTINGS, DND_DURATION_MS, dndUntilFor } from "../data/call-settings-port"
import { createDemoCallSettings } from "./call-settings"
import { createDemoSeed, type DemoState } from "./state"
import { DEMO_STORAGE_KEY, DemoStore } from "./store"

/**
 * Réglages iCom de démonstration (IM-02) : les règles de `calls/preferences` du moteur,
 * sur des comptes fictifs, pour la seule personne de la session.
 */
const NOW = Date.UTC(2026, 10, 10, 12)
const HOUR = 60 * 60 * 1000
const PERSON = "p-prisca"
const OTHER = "p-nadia"

function setup(personId: string | null = PERSON) {
  let now = NOW
  const state: DemoState = { ...createDemoSeed(NOW), session: { personId } }
  const stored = new Map([[DEMO_STORAGE_KEY, JSON.stringify(state)]])
  const storage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value) },
    removeItem: vi.fn((key: string) => { stored.delete(key) }),
  }
  const store = new DemoStore(storage, () => now, 0)
  return { store, settings: createDemoCallSettings(store), advance: (ms: number) => { now += ms } }
}

afterEach(cleanup)

describe("Réglages iCom de démonstration", () => {
  it("lit les défauts du moteur sans rien écrire, et rend le même instantané tant que rien ne change", () => {
    const { settings } = setup()
    const { result, rerender } = renderHook(() => settings.useMine(PERSON))
    expect(result.current).toEqual({ status: "ready", data: DEFAULT_CALL_SETTINGS })
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it.each([
    ["qui peut m'appeler", { outsideRelationsCalls: "silent" }],
    ["messagerie vocale", { voicemailEnabled: false }],
    ["présence", { sharePresence: false }],
    ["double appel", { callWaiting: false }],
  ] as const)("« %s » : seule la valeur fournie change", async (_label, patch) => {
    const { settings } = setup()
    const { result } = renderHook(() => settings.useMine(PERSON))
    await act(async () => { expect(await settings.update(PERSON, patch)).toEqual({ ok: true, value: null }) })
    expect(result.current).toEqual({ status: "ready", data: { ...DEFAULT_CALL_SETTINGS, ...patch } })
  })

  it("pose « Ne pas déranger », le lève, et lit une échéance passée comme absente", async () => {
    const { settings, advance } = setup()
    const { result, rerender } = renderHook(() => settings.useMine(PERSON))
    const until = dndUntilFor("oneHour", NOW)
    await act(async () => { expect(await settings.setDoNotDisturb(PERSON, until)).toEqual({ ok: true, value: { dndUntil: until } }) })
    expect(result.current).toEqual({ status: "ready", data: { ...DEFAULT_CALL_SETTINGS, dndUntil: NOW + HOUR } })
    await act(async () => { expect(await settings.setDoNotDisturb(PERSON, null)).toEqual({ ok: true, value: { dndUntil: null } }) })
    expect(result.current).toEqual({ status: "ready", data: DEFAULT_CALL_SETTINGS })

    await act(async () => { await settings.setDoNotDisturb(PERSON, until) })
    advance(2 * HOUR)
    // Un autre réglage relit la ligne : le silence échu n'est plus montré.
    await act(async () => { await settings.update(PERSON, { callWaiting: false }) })
    rerender()
    expect(result.current).toEqual({ status: "ready", data: { ...DEFAULT_CALL_SETTINGS, callWaiting: false } })
  })

  it("refuse un silence passé ou de plus de sept jours, comme le moteur, et accepte la plus longue durée proposée", async () => {
    const { settings } = setup()
    expect(await settings.setDoNotDisturb(PERSON, NOW)).toEqual({ ok: false, code: "call_dnd_past" })
    expect(await settings.setDoNotDisturb(PERSON, NOW + 7 * 24 * HOUR + 1)).toEqual({ ok: false, code: "call_dnd_too_long" })
    expect(DND_DURATION_MS.sevenDays).toBeLessThan(7 * 24 * HOUR)
    expect(await settings.setDoNotDisturb(PERSON, dndUntilFor("sevenDays", NOW))).toEqual({ ok: true, value: { dndUntil: dndUntilFor("sevenDays", NOW) } })
  })

  it("ne règle jamais une autre personne, ni sans session", async () => {
    const { settings } = setup()
    expect(await settings.update(OTHER, { callWaiting: false })).toEqual({ ok: false, code: "not_found" })
    expect(await settings.setDoNotDisturb(OTHER, null)).toEqual({ ok: false, code: "not_found" })
    const { result } = renderHook(() => settings.useMine(OTHER))
    expect(result.current).toEqual({ status: "error", code: "not_found" })

    const anonymous = setup(null)
    expect(await anonymous.settings.update(PERSON, { callWaiting: false })).toEqual({ ok: false, code: "not_signed_in" })
    expect(renderHook(() => anonymous.settings.useMine(PERSON)).result.current).toEqual({ status: "error", code: "not_signed_in" })
  })

  it("chaque compte de démonstration garde ses propres réglages", async () => {
    const { store, settings } = setup()
    await settings.update(PERSON, { outsideRelationsCalls: "silent" })
    await act(async () => { await store.switchTo(OTHER) })
    const { result } = renderHook(() => settings.useMine(OTHER))
    expect(result.current).toEqual({ status: "ready", data: DEFAULT_CALL_SETTINGS })
  })
})
