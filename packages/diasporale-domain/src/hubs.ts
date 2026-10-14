/**
 * Compteurs d'un hub pays (EXF-DG-15, EXF-DG-17).
 *
 * Les compteurs sont MATÉRIALISÉS par le moteur (cron quotidien) : jamais
 * calculés à la lecture, jamais écrits en dur. Ce module dit seulement
 * comment les PRÉSENTER sans exposer personne :
 *   · le nombre de membres opt-in sous un seuil ne s'affiche pas
 *     (anti-réidentification, dossier produit F16) ;
 *   · un hub sans aucun contenu dit « bientôt », pas une rangée de zéros (E01).
 */

export interface HubCounters {
  /** Membres ayant choisi d'apparaître dans l'annuaire du pays. */
  readonly members: number
  readonly associations: number
  readonly companies: number
  readonly upcomingEvents: number
}

/** En deçà, le nombre de membres d'un pays ne se publie pas. */
export const MEMBER_COUNTER_DISPLAY_THRESHOLD = 20

export type CounterPresentation =
  | { readonly kind: "value"; readonly value: number }
  | { readonly kind: "below_threshold"; readonly threshold: number }

export interface HubCountersPresentation {
  /** Aucun contenu : le hub est annoncé « bientôt disponible », sans compteurs. */
  readonly dormant: boolean
  readonly members: CounterPresentation
  readonly associations: CounterPresentation
  readonly companies: CounterPresentation
  readonly upcomingEvents: CounterPresentation
}

function sanitize(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0
}

export function presentMemberCounter(
  members: number,
  threshold: number = MEMBER_COUNTER_DISPLAY_THRESHOLD,
): CounterPresentation {
  const value = sanitize(members)
  return value < threshold ? { kind: "below_threshold", threshold } : { kind: "value", value }
}

export function presentHubCounters(
  counters: HubCounters,
  threshold: number = MEMBER_COUNTER_DISPLAY_THRESHOLD,
): HubCountersPresentation {
  const values = {
    members: sanitize(counters.members),
    associations: sanitize(counters.associations),
    companies: sanitize(counters.companies),
    upcomingEvents: sanitize(counters.upcomingEvents),
  }
  const dormant = values.members + values.associations + values.companies + values.upcomingEvents === 0
  return {
    dormant,
    members: presentMemberCounter(values.members, threshold),
    associations: { kind: "value", value: values.associations },
    companies: { kind: "value", value: values.companies },
    upcomingEvents: { kind: "value", value: values.upcomingEvents },
  }
}
