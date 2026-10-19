/**
 * Démonstration de la capacité « mesure du pilote » (DG-027 · G11). PROPRIÉTAIRE : ce chantier.
 *
 * Agrégats FICTIFS, signalés comme tels (`fictional: true`) : des journées
 * types inventées et déterministes pour la France, la Belgique et le Canada,
 * présentées par LES règles du domaine (seuil « moins de 5 », bases, parts
 * masquées, classes de délai), exactement comme le moteur présente ses
 * agrégats matérialisés. Rien n'est lu du jeu de démonstration : aucune
 * personne, aucune demande, aucun texte n'entre dans ces comptes.
 *
 * Comme dans le moteur, seuls les responsables du réseau ouvrent le tableau :
 * ici deux personnes fictives (`DEMO_PILOT_RESPONSIBLES`) ; tout autre membre
 * reçoit le refus indistinct.
 */
import {
  DAY_MS,
  emptyPilotDay,
  PILOT_DISPLAY_THRESHOLD,
  pilotUtcDayStart,
  pilotWindow,
  presentPilotIndicators,
  sumPilotDays,
  tallyPilotDay,
  type CountryCode,
  type PilotDailyCounter,
  type PilotDayTotals,
  type PilotWindowDays,
} from "@diasporale/domain"
import { useMemo, useSyncExternalStore } from "react"

import type { ActionErrorCode } from "../data/errors"
import type { PilotMetricsAccessView, PilotMetricsCapability, PilotMetricsView } from "../data/pilot-metrics-port"
import type { Loadable } from "../data/types"
import { sessionView } from "./selectors"
import type { DemoStore } from "./store"

/** Les responsables FICTIFS du réseau de démonstration : seules ces personnes ouvrent le tableau. */
export const DEMO_PILOT_RESPONSIBLES: readonly string[] = ["p-mireille", "p-nadia"]

/** L'activité inventée par pays : un poids de journée type et des offres actives. */
const DEMO_ACTIVITY: readonly { readonly country: CountryCode; readonly weight: number; readonly offers: number }[] = [
  { country: "FR", weight: 3, offers: 14 },
  { country: "BE", weight: 1, offers: 3 },
  { country: "CA", weight: 1, offers: 2 },
]

const LOADING = { status: "loading" } as const

type DemoAccess = { readonly ok: true; readonly allowed: boolean } | { readonly ok: false; readonly code: ActionErrorCode }

/** Le lecteur de la démonstration : session, adhésion, puis rôle fictif de responsable. */
function demoAccess(store: DemoStore): DemoAccess {
  const session = sessionView(store.getState(), store.now())
  if (session.status === "anonymous") return { ok: false, code: "not_signed_in" }
  const membership = session.membership
  if (membership === null || membership.status === "partie") return { ok: false, code: "not_member" }
  if (membership.status === "suspendue") return { ok: false, code: "suspended" }
  return { ok: true, allowed: DEMO_PILOT_RESPONSIBLES.includes(membership.personId) }
}

/** Une journée type inventée pour un pays, d'après le rang du jour : rien d'aléatoire, rien de réel. */
function demoCountryDay(dayStartAt: number, weight: number): PilotDayTotals {
  const index = Math.floor(dayStartAt / DAY_MS)
  let day = emptyPilotDay()
  const requests = weight * ((index % 3) + 1)
  for (let rank = 0; rank < requests; rank += 1) {
    const pattern = (index + rank) % 10
    const counters: PilotDailyCounter[] = ["requestsSent"]
    if (pattern < 7) counters.push("requestsAnswered")
    if (pattern < 4) counters.push("requestsConfirmed")
    if (pattern < 2) counters.push("requestsCompleted")
    if (pattern === 3) counters.push("requestsCancelled")
    if (pattern >= 8) counters.push("requestsExpired")
    day = tallyPilotDay(day, counters, pattern < 7 ? (index + rank) % 9 : null)
  }
  if (index % 2 === 0) day = tallyPilotDay(day, weight > 1 ? ["membershipsRequested", "membershipsAccepted"] : ["membershipsRequested"])
  if (index % 7 === 0) {
    for (let seat = 0; seat < 4 * weight; seat += 1) day = tallyPilotDay(day, seat % 4 === 0 ? ["eventRegistrations"] : ["eventRegistrations", "eventAttendances"])
  }
  if (index % 3 === 0) day = tallyPilotDay(day, ["reviewsPublished"])
  return day
}

function demoScopeDay(dayStartAt: number, scopes: typeof DEMO_ACTIVITY): PilotDayTotals {
  return sumPilotDays(scopes.map((scope) => demoCountryDay(dayStartAt, scope.weight)))
}

/**
 * La mesure FICTIVE d'une portée sur une période : un passage inventé à minuit
 * UTC, des journées types jusqu'à la veille, présentées par le domaine. Un pays
 * sans activité inventée est mesuré à zéro (tout s'y dit « moins de 5 »).
 */
export function demoPilotMetricsView(now: number, country: CountryCode | null, days: PilotWindowDays): PilotMetricsView {
  const computedAt = pilotUtcDayStart(now)
  const window = pilotWindow(computedAt - DAY_MS, days)
  const scopes = DEMO_ACTIVITY.filter((scope) => country === null || scope.country === country)
  const rows: PilotDayTotals[] = []
  for (let dayStartAt = window.startAt; dayStartAt < window.endAt; dayStartAt += DAY_MS) rows.push(demoScopeDay(dayStartAt, scopes))
  return {
    measured: true,
    country,
    days,
    threshold: PILOT_DISPLAY_THRESHOLD,
    windowStartAt: window.startAt,
    windowEndAt: window.endAt,
    computedAt,
    daysMeasured: days,
    indicators: presentPilotIndicators({ days: rows, offersActive: scopes.reduce((sum, scope) => sum + scope.offers, 0) }),
    fictional: true,
  }
}

export function createDemoPilotMetrics(store: DemoStore): PilotMetricsCapability {
  const useVersion = () => useSyncExternalStore(store.subscribe, store.getVersion, () => -1)
  return {
    useAccess() {
      const version = useVersion()
      return useMemo((): Loadable<PilotMetricsAccessView> => {
        if (version < 0) return LOADING
        const access = demoAccess(store)
        return access.ok ? { status: "ready", data: { allowed: access.allowed } } : { status: "error", code: access.code }
      }, [version])
    },

    useMetrics({ country, days }) {
      const version = useVersion()
      return useMemo((): Loadable<PilotMetricsView> => {
        if (version < 0) return LOADING
        const access = demoAccess(store)
        if (!access.ok) return { status: "error", code: access.code }
        // Comme le moteur : un lecteur sans rôle de responsable reçoit le refus indistinct.
        if (!access.allowed) return { status: "error", code: "not_found" }
        return { status: "ready", data: demoPilotMetricsView(store.now(), country, days) }
      }, [version, country, days])
    },
  }
}
