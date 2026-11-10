// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import { DEFAULT_CALL_SETTINGS } from "@diasporale/features/data"
import { cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { callSettingsErrorCode, createEngineCallSettings, toCallSettingsView, toUpdateArgs } from "./engine-call-settings"

/**
 * L'adaptateur des réglages iCom sans moteur (IM-02) : lectures réactives jouées par un
 * `useQueries` factice, écritures contre un client Convex factice. Personne fictive.
 */
type Reference = Parameters<typeof getFunctionName>[0]

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isPending: false, isUnauthenticated: false },
  respond: (() => undefined) as (name: string, args: unknown) => unknown,
  read: vi.fn(),
}))
vi.mock("@antsia/api/hooks", () => ({ useStableConvexAuth: () => mocks.auth }))
vi.mock("convex/react", () => ({
  useQueries: (queries: Record<string, { query: Reference; args?: unknown }>) => {
    if (!queries.value) return {}
    const name = getFunctionName(queries.value.query)
    mocks.read(name, queries.value.args)
    return { value: mocks.respond(name, queries.value.args) }
  },
}))

const PERSON = { _id: "person-awa", handle: "awa.recette", displayName: "Awa" }
const MINUTE = 60_000
/** Ce que `getMine` rend à quelqu'un qui n'a jamais rien réglé. */
const ENGINE_DEFAULTS = {
  dnd: null,
  ringtone: { muted: false, vibrate: true },
  callWaiting: true,
  quickReplies: null,
  voicemailEnabled: true,
  autoMeetingDnd: null,
  sharePresence: true,
  pushIncoming: true,
  outsideRelationsCalls: "silent" as const,
  readReceipts: true,
  journalSeenAt: null,
  saved: false,
}

type Handler = (args: Record<string, unknown>) => unknown

function setup(handlers: Record<string, Handler> = {}) {
  const calls: { kind: "query" | "mutation"; name: string; args: Record<string, unknown> }[] = []
  const call = (kind: "query" | "mutation") => vi.fn(async (reference: Reference, args: Record<string, unknown>) => {
    const name = getFunctionName(reference)
    calls.push({ kind, name, args })
    const handler = handlers[name] ?? (name === "modules/people/persons:getMyPerson" ? () => PERSON : undefined)
    if (!handler) throw new Error(`Unexpected ${kind}: ${name}`)
    return handler(args)
  })
  const convex = { query: call("query"), mutation: call("mutation") } as unknown as ConvexReactClient
  const settings = createEngineCallSettings({ convex, authClient: {} as EngineAuthClient })
  return { settings, writes: () => calls.filter((entry) => entry.kind === "mutation") }
}

function respondWith(overrides: Record<string, unknown> = {}) {
  mocks.respond = (name) => {
    if (name in overrides) return overrides[name]
    if (name === "modules/people/persons:getMyPerson") return PERSON
    if (name === "modules/calls/preferences:getMine") return ENGINE_DEFAULTS
    throw new Error(`Unexpected read: ${name}`)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
  respondWith()
})
afterEach(cleanup)

describe("Réglages iCom — lecture (calls/preferences:getMine)", () => {
  it("lit mes réglages avec un instant arrondi à la minute, et rend les seuls réglages montrés", () => {
    const { settings } = setup()
    const { result } = renderHook(() => settings.useMine(PERSON._id))
    expect(result.current).toEqual({
      status: "ready",
      data: { outsideRelationsCalls: "silent", dndUntil: null, readReceipts: true, voicemailEnabled: true, sharePresence: true, callWaiting: true },
    })
    // Les défauts du port (démonstration, formulaire) sont ceux que le moteur rend (IC-04).
    expect(result.current).toEqual({ status: "ready", data: DEFAULT_CALL_SETTINGS })
    const [, args] = mocks.read.mock.calls.find(([name]) => name === "modules/calls/preferences:getMine")!
    expect((args as { now: number }).now % MINUTE).toBe(0)
  })

  it("projette un silence en cours et les choix déjà faits", () => {
    expect(toCallSettingsView({ ...ENGINE_DEFAULTS, dnd: { until: 5_000, startedAt: 1_000 }, outsideRelationsCalls: "ring", readReceipts: false, voicemailEnabled: false, sharePresence: false, callWaiting: false, saved: true })).toEqual({
      outsideRelationsCalls: "ring",
      dndUntil: 5_000,
      readReceipts: false,
      voicemailEnabled: false,
      sharePresence: false,
      callWaiting: false,
    })
  })

  it.each(["pending", "anonymous"] as const)("ne lit rien pour une session %s", (kind) => {
    mocks.auth = { isAuthenticated: false, isPending: kind === "pending", isUnauthenticated: kind === "anonymous" }
    const { settings } = setup()
    const { result } = renderHook(() => settings.useMine(PERSON._id))
    expect(result.current).toEqual(kind === "pending" ? { status: "loading" } : { status: "error", code: "not_signed_in" })
    expect(mocks.read).not.toHaveBeenCalled()
  })

  it("ferme les réglages d'une autre personne et traduit un refus du serveur sans son détail", () => {
    const { settings } = setup()
    const { result, rerender } = renderHook(() => settings.useMine("ancienne-personne"))
    expect(result.current).toEqual({ status: "error", code: "not_found" })
    respondWith({ "modules/calls/preferences:getMine": new ConvexError({ code: "unauthenticated", detail: "PRIVATE_DETAIL" } as never) })
    rerender()
    expect(result.current).toEqual({ status: "error", code: "not_signed_in" })
  })
})

describe("Réglages iCom — un interrupteur, un appel au moteur (calls/preferences:update)", () => {
  it.each([
    ["qui peut m'appeler", { outsideRelationsCalls: "ring" }],
    ["accusés de lecture", { readReceipts: false }],
    ["messagerie vocale", { voicemailEnabled: false }],
    ["présence", { sharePresence: false }],
    ["double appel", { callWaiting: false }],
  ] as const)("« %s » : la personne est relue, puis le seul réglage fourni part au moteur", async (_label, patch) => {
    const { settings, writes } = setup({ "modules/calls/preferences:update": () => ({ saved: true }) })
    expect(await settings.update(PERSON._id, patch)).toEqual({ ok: true, value: null })
    expect(writes()).toEqual([{ kind: "mutation", name: "modules/calls/preferences:update", args: patch }])
  })

  it("n'envoie jamais un champ absent : il reste inchangé dans le moteur", () => {
    expect(toUpdateArgs({ callWaiting: false, voicemailEnabled: undefined })).toEqual({ callWaiting: false })
    expect(toUpdateArgs({ readReceipts: false, outsideRelationsCalls: undefined })).toEqual({ readReceipts: false })
    expect(Object.keys(toUpdateArgs({}))).toEqual([])
  })

  it("une autre session ferme le geste avant toute écriture ; un débit dépassé se dit", async () => {
    const { settings, writes } = setup({ "modules/calls/preferences:update": () => { throw new ConvexError({ code: "rateLimited" } as never) } })
    expect(await settings.update("ancienne-personne", { callWaiting: false })).toEqual({ ok: false, code: "not_found" })
    expect(writes()).toEqual([])
    expect(await settings.update(PERSON._id, { callWaiting: false })).toEqual({ ok: false, code: "rate_limited" })
  })
})

describe("Réglages iCom — « Ne pas déranger » (calls/preferences:setDnd)", () => {
  it("pose puis lève le silence par la fonction du moteur", async () => {
    const { settings, writes } = setup({
      "modules/calls/preferences:setDnd": (args) => ({ dnd: args.until === null ? null : { until: args.until, startedAt: 1_000 } }),
    })
    expect(await settings.setDoNotDisturb(PERSON._id, 9_000)).toEqual({ ok: true, value: { dndUntil: 9_000 } })
    expect(await settings.setDoNotDisturb(PERSON._id, null)).toEqual({ ok: true, value: { dndUntil: null } })
    expect(writes().map((entry) => entry.args)).toEqual([{ until: 9_000 }, { until: null }])
  })

  it.each([
    ["CALL_DND_PAST", "call_dnd_past"],
    ["CALL_DND_TOO_LONG", "call_dnd_too_long"],
  ] as const)("le refus %s devient le code fermé %s", async (rule, code) => {
    const error = new ConvexError({ code: "invalidArgument", rule } as never)
    const { settings } = setup({ "modules/calls/preferences:setDnd": () => { throw error } })
    expect(await settings.setDoNotDisturb(PERSON._id, 9_000)).toEqual({ ok: false, code })
    expect(callSettingsErrorCode(error)).toBe(code)
  })
})
