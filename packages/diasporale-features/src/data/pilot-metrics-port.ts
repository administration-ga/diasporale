/**
 * Capacité « mesure du pilote » du port (DG-027 · G11, plan global DIASPORALE). PROPRIÉTAIRE :
 * ce chantier. Facultative : un fournisseur qui ne la sert pas la laisse absente,
 * et l'écran le dit au lieu d'inventer.
 *
 * Elle ne transporte que des PRÉSENTATIONS (`@diasporale/domain`, pilot-metrics) :
 * un compte sous le seuil y est « moins de 5 », jamais le chiffre ; un taux y
 * garde sa base ; une part trop proche de sa base y est masquée. Aucune ligne
 * source, aucun identifiant de personne, aucun texte. Les agrégats sont
 * matérialisés par le passage nocturne du moteur ; la démonstration sert des
 * agrégats FICTIFS, signalés comme tels (`fictional`).
 */
import { PILOT_METRICS_REFUSALS, type CountryCode, type PilotIndicator, type PilotWindowDays } from "@diasporale/domain"

import type { Loadable } from "./types"

/** Codes de refus propres au chantier, traduits par errors.<code> dans son fragment. */
export const PILOT_METRICS_ERROR_CODES = PILOT_METRICS_REFUSALS

/** Le lecteur peut-il ouvrir la mesure ? Seuls les responsables du réseau le peuvent. */
export interface PilotMetricsAccessView {
  readonly allowed: boolean
}

/** La portée et la période demandées : `country: null` pour tout le réseau. */
export interface PilotMetricsRequest {
  readonly country: CountryCode | null
  readonly days: PilotWindowDays
}

interface PilotMetricsViewBase {
  readonly country: CountryCode | null
  readonly days: PilotWindowDays
  /** Le seuil de publication des comptes (5). */
  readonly threshold: number
  /** Démonstration : agrégats FICTIFS, jamais une mesure. */
  readonly fictional: boolean
}

/** La mesure d'une portée sur une période ; `measured: false` tant qu'aucun passage n'a écrit. */
export type PilotMetricsView =
  | (PilotMetricsViewBase & { readonly measured: false })
  | (PilotMetricsViewBase & {
      readonly measured: true
      /** Jours UTC de la période : début inclus, fin exclue. */
      readonly windowStartAt: number
      readonly windowEndAt: number
      /** Le plus ancien passage parmi les jours lus. */
      readonly computedAt: number
      /** Jours effectivement mesurés dans la période (moins que `days` : mesure partielle). */
      readonly daysMeasured: number
      /** Dans l'ordre fermé des indicateurs du domaine. */
      readonly indicators: readonly PilotIndicator[]
    })

export interface PilotMetricsCapability {
  /** Le rôle du lecteur, lu par le serveur : l'entrée du menu et l'écran s'y fient, le serveur rejuge chaque lecture. */
  useAccess(): Loadable<PilotMetricsAccessView>
  /** Réservée aux responsables : tout autre lecteur reçoit le refus indistinct (`not_found`). */
  useMetrics(request: PilotMetricsRequest): Loadable<PilotMetricsView>
}
