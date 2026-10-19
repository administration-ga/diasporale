// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import { cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEnginePilotMetrics, toPilotMetricsView } from "./engine-pilot-metrics"

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isPending: false, isUnauthenticated: false },
  network: { _id: "network-diasporale" } as unknown,
  membership: undefined as unknown,
  results: new Map<string, unknown>(),
  loaded: vi.fn(),
}))
vi.mock("@antsia/api/hooks", () => ({ useStableConvexAuth: () => mocks.auth }))
vi.mock("convex/react", () => ({
  useQueries: (queries: Record<string, { query: Parameters<typeof getFunctionName>[0]; args?: unknown }>) => {
    if (!queries.value) return {}
    const name = getFunctionName(queries.value.query)
    mocks.loaded(name, queries.value.args)
    if (name === "modules/networks/networks:getBySlug") return { value: mocks.network }
    if (name === "modules/diaspora/membership:myMembership") return { value: mocks.membership }
    return mocks.results.has(name) ? { value: mocks.results.get(name) } : {}
  },
}))

const ACCESS = "modules/diaspora/pilotMetrics:pilotMetricsAccess"
const METRICS = "modules/diaspora/pilotMetrics:pilotMetrics"
const MEMBER = { status: "declaree", capabilities: ["read_network", "publish"] }
const INDICATORS = [
  { id: "offers_active", group: "services", kind: "snapshot", value: { kind: "value", value: 6 } },
  { id: "requests_sent", group: "services", kind: "count", value: { kind: "value", value: 12 } },
  {
    id: "requests_answered", group: "services", kind: "ratio", value: { kind: "value", value: 7 }, denominatorId: "requests_sent",
    denominator: { kind: "value", value: 12 }, rate: { kind: "value", percent: 58 },
  },
  {
    id: "requests_confirmed", group: "services", kind: "ratio", value: { kind: "complement_below_threshold", threshold: 5 }, denominatorId: "requests_sent",
    denominator: { kind: "value", value: 12 }, rate: { kind: "withheld" },
  },
  {
    id: "first_response_hours", group: "services", kind: "duration", sample: { kind: "value", value: 7 },
    median: { kind: "at_most", hours: 6 }, p75: { kind: "above", hours: 720 },
  },
  { id: "reviews_published", group: "reviews", kind: "count", value: { kind: "below_threshold", threshold: 5 } },
]
const MEASURED = {
  measured: true, country: "FR", days: 7, threshold: 5, windowStartAt: 1_000, windowEndAt: 2_000, computedAt: 1_500, daysMeasured: 7, indicators: INDICATORS,
}

function capability() {
  const convex = { query: vi.fn(), mutation: vi.fn() } as unknown as ConvexReactClient
  return createEnginePilotMetrics({ convex, authClient: {} as EngineAuthClient })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
  mocks.network = { _id: "network-diasporale" }
  mocks.membership = { ...MEMBER }
  mocks.results.clear()
})
afterEach(cleanup)

describe("mesure du pilote — fournisseur moteur", () => {
  it("lit le rôle du lecteur dans DIASPORALE, sans rien supposer", () => {
    mocks.results.set(ACCESS, { allowed: true })
    const data = capability()
    const { result, rerender } = renderHook(() => data.useAccess())
    expect(mocks.loaded).toHaveBeenLastCalledWith(ACCESS, { networkId: "network-diasporale" })
    expect(result.current).toEqual({ status: "ready", data: { allowed: true } })
    mocks.results.set(ACCESS, { allowed: false })
    rerender()
    expect(result.current).toEqual({ status: "ready", data: { allowed: false } })
  })

  it("borne la mesure au réseau, transmet portée et période, et recopie seulement les champs du port", () => {
    mocks.results.set(METRICS, { ...MEASURED, rows: [{ personId: "private-person" }], indicators: INDICATORS.map((row) => ({ ...row, requesterPersonId: "private-requester" })) })
    const data = capability()
    const { result, rerender } = renderHook((props: { country: "FR" | null; days: 7 | 30 | 90 }) => data.useMetrics(props), { initialProps: { country: "FR" as "FR" | null, days: 7 as 7 | 30 | 90 } })
    expect(mocks.loaded).toHaveBeenLastCalledWith(METRICS, { networkId: "network-diasporale", country: "FR", days: 7 })
    expect(result.current).toEqual({ status: "ready", data: { ...MEASURED, indicators: INDICATORS, fictional: false } })
    expect(JSON.stringify(result.current)).not.toContain("private-")
    const first = result.current
    rerender({ country: "FR", days: 7 })
    expect(result.current).toBe(first)
    rerender({ country: null, days: 90 })
    expect(mocks.loaded).toHaveBeenLastCalledWith(METRICS, { networkId: "network-diasporale", country: null, days: 90 })
  })

  it("dit « non mesurée » avant le premier passage, et ramène une portée ou une période illisible à ses valeurs sûres", () => {
    expect(toPilotMetricsView({ measured: false, country: null, days: 30, threshold: 5 })).toEqual({ measured: false, country: null, days: 30, threshold: 5, fictional: false })
    expect(toPilotMetricsView({ measured: false, country: "GA", days: 14, threshold: 5 })).toEqual({ measured: false, country: null, days: 30, threshold: 5, fictional: false })
  })

  it.each([
    { label: "sans session", setup: () => { mocks.auth = { isAuthenticated: false, isPending: false, isUnauthenticated: true } }, code: "not_signed_in" },
    { label: "sans adhésion", setup: () => { mocks.membership = null }, code: "not_member" },
    { label: "suspendue", setup: () => { mocks.membership = { status: "suspendue", capabilities: [] } }, code: "suspended" },
    { label: "sans réseau", setup: () => { mocks.network = null }, code: "network_unavailable" },
  ])("ferme les deux lectures $label sans interroger la mesure", ({ setup, code }) => {
    setup()
    const data = capability()
    expect(renderHook(() => data.useAccess()).result.current).toEqual({ status: "error", code })
    expect(renderHook(() => data.useMetrics({ country: null, days: 30 })).result.current).toEqual({ status: "error", code })
    expect(mocks.loaded.mock.calls.some(([name]) => String(name).startsWith("modules/diaspora/pilotMetrics:"))).toBe(false)
  })

  it("attend l'adhésion, puis rend le refus indistinct ou le refus fermé du moteur, sans rien garder à l'écran", () => {
    mocks.membership = undefined
    const data = capability()
    const { result, rerender } = renderHook(() => data.useMetrics({ country: null, days: 30 }))
    expect(result.current).toEqual({ status: "loading" })
    mocks.membership = MEMBER
    mocks.results.set(METRICS, MEASURED)
    rerender()
    expect(result.current.status).toBe("ready")
    mocks.results.set(METRICS, new ConvexError({ code: "notFound" }))
    rerender()
    expect(result.current).toEqual({ status: "error", code: "not_found" })
    mocks.results.set(METRICS, new ConvexError({ code: "invalidArgument", appRule: "pilot_metrics_window_invalid", appParams: {} }))
    rerender()
    expect(result.current).toEqual({ status: "error", code: "pilot_metrics_window_invalid" })
  })
})
