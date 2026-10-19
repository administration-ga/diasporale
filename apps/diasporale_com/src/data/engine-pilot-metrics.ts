"use client"

/**
 * Adaptateur moteur de la capacité « mesure du pilote » (DG-027 · G11).
 * PROPRIÉTAIRE : ce chantier.
 *
 * Deux lectures du moteur (module `pilotMetrics` de la tranche diaspora), bornées
 * par le réseau `diasporale` et l'adhésion du lecteur, recopiées champ par champ dans les
 * formes du port : aucune donnée hors projection ne traverse l'adaptateur. Les
 * agrégats sont matérialisés par le passage nocturne ; rien n'est compté ici.
 */
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  isResidenceCountry,
  parsePilotWindowDays,
  PILOT_DEFAULT_WINDOW_DAYS,
  type PilotCount,
  type PilotHours,
  type PilotIndicator,
  type PilotPart,
} from "@diasporale/domain"
import type { ActionErrorCode, Loadable, PilotMetricsAccessView, PilotMetricsCapability, PilotMetricsView } from "@diasporale/features/data"
import type { FunctionReturnType } from "convex/server"
import { useMemo } from "react"

import { failed, LOADING, memberReadError, ready, useEngineMember, useLoaded, type EngineSourceDeps, type Loaded } from "./engine-kit"

const PILOT = api.modules.diaspora.pilotMetrics
type PilotMetricsDto = FunctionReturnType<typeof PILOT.pilotMetrics>
type IndicatorDto = Extract<PilotMetricsDto, { measured: true }>["indicators"][number]

type CountDto = { readonly kind: "value"; readonly value: number } | { readonly kind: "below_threshold"; readonly threshold: number }
type PartDto = CountDto | { readonly kind: "complement_below_threshold"; readonly threshold: number }
type HoursDto = { readonly kind: "at_most"; readonly hours: number } | { readonly kind: "above"; readonly hours: number } | { readonly kind: "withheld" }

function toCount(count: CountDto): PilotCount {
  return count.kind === "value" ? { kind: "value", value: count.value } : { kind: "below_threshold", threshold: count.threshold }
}

function toPart(part: PartDto): PilotPart {
  return part.kind === "complement_below_threshold" ? { kind: "complement_below_threshold", threshold: part.threshold } : toCount(part)
}

function toHours(hours: HoursDto): PilotHours {
  switch (hours.kind) {
    case "at_most":
      return { kind: "at_most", hours: hours.hours }
    case "above":
      return { kind: "above", hours: hours.hours }
    case "withheld":
      return { kind: "withheld" }
  }
}

/** Un indicateur du moteur, recopié dans la forme fermée du domaine. */
export function toPilotIndicator(row: IndicatorDto): PilotIndicator {
  switch (row.kind) {
    case "snapshot":
      return { id: row.id, group: row.group, kind: "snapshot", value: toCount(row.value) }
    case "count":
      return { id: row.id, group: row.group, kind: "count", value: toCount(row.value) }
    case "ratio":
      return {
        id: row.id,
        group: row.group,
        kind: "ratio",
        value: toPart(row.value),
        denominatorId: row.denominatorId,
        denominator: toCount(row.denominator),
        rate: row.rate.kind === "value" ? { kind: "value", percent: row.rate.percent } : { kind: "withheld" },
      }
    case "duration":
      return { id: row.id, group: row.group, kind: "duration", sample: toCount(row.sample), median: toHours(row.median), p75: toHours(row.p75) }
  }
}

/** La mesure du moteur dans la forme du port ; jamais fictive. */
export function toPilotMetricsView(dto: PilotMetricsDto): PilotMetricsView {
  const country = dto.country !== null && isResidenceCountry(dto.country) ? dto.country : null
  const parsed = parsePilotWindowDays(dto.days)
  const days = parsed.ok ? parsed.value : PILOT_DEFAULT_WINDOW_DAYS
  if (!dto.measured) return { measured: false, country, days, threshold: dto.threshold, fictional: false }
  return {
    measured: true,
    country,
    days,
    threshold: dto.threshold,
    windowStartAt: dto.windowStartAt,
    windowEndAt: dto.windowEndAt,
    computedAt: dto.computedAt,
    daysMeasured: dto.daysMeasured,
    indicators: dto.indicators.map(toPilotIndicator),
    fictional: false,
  }
}

/** Le réseau du lecteur quand il peut lire en membre ; sinon le refus standard, sans abonnement. */
function useReader(): { readonly networkId: Id<"networks"> | null; readonly error: ActionErrorCode | null } {
  const member = useEngineMember()
  const error = memberReadError(member)
  const networkId = member.networkId.state === "ready" ? member.networkId.value : null
  const canRead = error === null && member.auth.isAuthenticated && member.membership.state === "ready" && member.membership.value !== null
  return { networkId: canRead ? networkId : null, error }
}

/** Une réponse identique garde la même projection ; un refus ne laisse rien à l'écran. */
function useProjected<T, V>(error: ActionErrorCode | null, loaded: Loaded<T>, project: (value: T) => V): Loadable<V> {
  const value = loaded.state === "ready" ? loaded.value : undefined
  const code = loaded.state === "error" ? loaded.code : null
  return useMemo(
    (): Loadable<V> => {
      if (error !== null) return failed<V>(error)
      if (loaded.state === "loading") return LOADING
      if (loaded.state === "error") return failed<V>(loaded.code)
      return ready(project(loaded.value))
    },
    // La projection est constante ; seuls la réponse et les refus comptent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [error, loaded.state, value, code],
  )
}

export function createEnginePilotMetrics(deps: EngineSourceDeps): PilotMetricsCapability {
  // Deux lectures réactives seulement : aucune écriture, aucune requête ponctuelle.
  void deps
  return {
    useAccess() {
      const reader = useReader()
      const loaded = useLoaded(PILOT.pilotMetricsAccess, reader.networkId ? { networkId: reader.networkId } : "skip")
      return useProjected(reader.error, loaded, (dto): PilotMetricsAccessView => ({ allowed: dto.allowed === true }))
    },

    useMetrics({ country, days }) {
      const reader = useReader()
      const loaded = useLoaded(PILOT.pilotMetrics, reader.networkId ? { networkId: reader.networkId, country, days } : "skip")
      return useProjected(reader.error, loaded, toPilotMetricsView)
    },
  }
}
