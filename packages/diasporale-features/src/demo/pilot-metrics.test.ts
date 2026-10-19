import { DAY_MS, PILOT_DISPLAY_THRESHOLD, PILOT_METRIC_IDS, PILOT_WINDOW_DAYS, type PilotIndicator, type PilotPart } from "@diasporale/domain"
import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { PilotMetricsView } from "../data/pilot-metrics-port"
import type { Loadable } from "../data/types"
import { createDemoPilotMetrics, DEMO_PILOT_RESPONSIBLES, demoPilotMetricsView } from "./pilot-metrics"
import { createDemoSeed, type DemoState } from "./state"
import { DemoStore } from "./store"

/**
 * La mesure de démonstration : des agrégats FICTIFS, signalés, présentés par les
 * règles du domaine ; le tableau n'ouvre qu'aux responsables fictifs, comme le
 * moteur ne l'ouvre qu'aux responsables du réseau.
 */
const NOW = Date.UTC(2026, 9, 18, 9)
const TODAY = Date.UTC(2026, 9, 18)

function setup(viewer: string | null, change: (state: DemoState) => DemoState = (state) => state) {
  const state = change({ ...createDemoSeed(NOW), session: { personId: viewer } })
  const storage = { getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }
  const store = new DemoStore(storage, () => NOW, 0)
  return { store, capability: createDemoPilotMetrics(store) }
}

function ready<T>(loadable: Loadable<T>): T {
  if (loadable.status !== "ready") throw new Error(`Lecture non prête : ${JSON.stringify(loadable)}`)
  return loadable.data
}

function measuredView(view: PilotMetricsView) {
  if (!view.measured) throw new Error("Mesure fictive attendue")
  return view
}

/** Chaque compte publié atteint le seuil ; sous le seuil, aucun chiffre n'apparaît. */
function publishedCountsReachThreshold(indicators: readonly PilotIndicator[]): boolean {
  return indicators.every((indicator) => {
    const counts: readonly PilotPart[] = indicator.kind === "duration" ? [indicator.sample] : indicator.kind === "ratio" ? [indicator.value, indicator.denominator] : [indicator.value]
    return counts.every((count) => count.kind !== "value" || count.value >= PILOT_DISPLAY_THRESHOLD)
  })
}

describe("démonstration de la mesure du pilote", () => {
  it("un responsable fictif ouvre le tableau : agrégats signalés comme fictifs, période jusqu'à la veille", () => {
    const { capability } = setup("p-mireille")
    expect(DEMO_PILOT_RESPONSIBLES).toContain("p-mireille")
    expect(ready(renderHook(() => capability.useAccess()).result.current)).toEqual({ allowed: true })
    const view = measuredView(ready(renderHook(() => capability.useMetrics({ country: null, days: 30 })).result.current))
    expect(view).toMatchObject({ fictional: true, country: null, days: 30, threshold: PILOT_DISPLAY_THRESHOLD, computedAt: TODAY, windowStartAt: TODAY - 30 * DAY_MS, windowEndAt: TODAY, daysMeasured: 30 })
    expect(view.indicators.map((indicator) => indicator.id)).toEqual([...PILOT_METRIC_IDS])
    expect(publishedCountsReachThreshold(view.indicators)).toBe(true)
  })

  it("un autre membre lit son rôle, puis reçoit le refus indistinct ; une personne anonyme, l'invitation à entrer", () => {
    const member = setup("p-steeve").capability
    expect(ready(renderHook(() => member.useAccess()).result.current)).toEqual({ allowed: false })
    expect(renderHook(() => member.useMetrics({ country: "FR", days: 7 })).result.current).toEqual({ status: "error", code: "not_found" })
    const anonymous = setup(null).capability
    expect(renderHook(() => anonymous.useAccess()).result.current).toEqual({ status: "error", code: "not_signed_in" })
    expect(renderHook(() => anonymous.useMetrics({ country: null, days: 30 })).result.current).toEqual({ status: "error", code: "not_signed_in" })
  })

  it("des journées types déterministes : même entrée, même mesure ; le réseau englobe chaque pays", () => {
    const first = measuredView(demoPilotMetricsView(NOW, "FR", 30))
    expect(measuredView(demoPilotMetricsView(NOW + 3_600_000, "FR", 30))).toEqual(first)
    const network = measuredView(demoPilotMetricsView(NOW, null, 30))
    const sent = (view: typeof first) => view.indicators.find((indicator) => indicator.id === "requests_sent")
    const france = sent(first)
    const all = sent(network)
    expect(france?.kind === "count" && france.value.kind === "value" ? france.value.value : 0).toBeGreaterThan(0)
    expect(all?.kind === "count" && all.value.kind === "value" && france?.kind === "count" && france.value.kind === "value" ? all.value.value - france.value.value : -1).toBeGreaterThan(0)
  })

  it("chaque période proposée finit la veille ; un pays sans activité inventée est mesuré sous le seuil", () => {
    for (const days of PILOT_WINDOW_DAYS) {
      const view = measuredView(demoPilotMetricsView(NOW, "FR", days))
      expect(view).toMatchObject({ windowStartAt: TODAY - days * DAY_MS, windowEndAt: TODAY, daysMeasured: days })
      expect(publishedCountsReachThreshold(view.indicators)).toBe(true)
    }
    const quiet = measuredView(demoPilotMetricsView(NOW, "SN", 90))
    expect(quiet.indicators.every((indicator) => (indicator.kind === "duration" ? indicator.sample : indicator.value).kind === "below_threshold")).toBe(true)
    // Sur une semaine, la France fictive a trop peu d'adhésions : elles se disent « moins de 5 ».
    const week = measuredView(demoPilotMetricsView(NOW, "FR", 7))
    expect(week.indicators.find((indicator) => indicator.id === "memberships_requested")).toMatchObject({ value: { kind: "below_threshold", threshold: PILOT_DISPLAY_THRESHOLD } })
  })

  it("aucune personne ni aucun texte du jeu de démonstration n'entre dans la mesure", () => {
    const json = JSON.stringify(demoPilotMetricsView(NOW, null, 90))
    for (const forbidden of ["p-mireille", "p-prisca", "p-steeve", "Mireille", "Paris"]) expect(json).not.toContain(forbidden)
  })
})
