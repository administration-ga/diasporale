/** Unités de temps du domaine — toutes les dates sont des millisecondes UTC. */
export const MINUTE_MS = 60_000
export const HOUR_MS = 60 * MINUTE_MS
export const DAY_MS = 24 * HOUR_MS

/** Année civile UTC d'un instant — la facette ne porte qu'une année d'arrivée. */
export function utcYear(now: number): number {
  return new Date(now).getUTCFullYear()
}
