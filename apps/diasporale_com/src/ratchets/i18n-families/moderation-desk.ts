/**
 * Familles de clés DYNAMIQUES du chantier « modération par pays » (PD6 · G9), énumérées depuis les
 * constantes qui les pilotent. PROPRIÉTAIRE : ce chantier.
 * Une clé citée en toutes lettres n'a rien à faire ici ; les codes de refus `errors.<code>` sont
 * couverts par `ERROR_CODES`.
 */
import {
  DESK_CASE_LEVELS,
  DESK_DECISIONS,
  DESK_GROUNDS,
  DESK_HISTORY_ORIGINS,
  DESK_OPEN_STATUSES,
  DESK_PARTIES,
  DESK_ROLES,
  DESK_SANCTION_KINDS,
  DESK_SOURCES,
  DESK_SURFACES,
} from "@diasporale/features/data"

const DESK = "moderationDesk"

export const FAMILIES: readonly string[] = [
  ...DESK_SURFACES.map((surface) => `${DESK}.surface.${surface}`),
  ...DESK_GROUNDS.map((ground) => `${DESK}.ground.${ground}`),
  ...DESK_ROLES.map((role) => `${DESK}.capacity.role.${role}`),
  ...DESK_CASE_LEVELS.map((level) => `${DESK}.level.${level}`),
  ...DESK_PARTIES.map((party) => `${DESK}.party.${party}`),
  ...DESK_SANCTION_KINDS.map((kind) => `${DESK}.sanction.${kind}`),
  ...DESK_SOURCES.map((source) => `${DESK}.filters.sourceOption.${source}`),
  ...DESK_OPEN_STATUSES.map((status) => `${DESK}.filters.statusOption.${status}`),
  ...DESK_DECISIONS.flatMap((decision) => [
    `${DESK}.decision.outcome.${decision}`,
    `${DESK}.decision.outcomeHint.${decision}`,
    `${DESK}.decision.done.${decision}`,
    `${DESK}.history.status.${decision}`,
  ]),
  ...DESK_HISTORY_ORIGINS.map((origin) => `${DESK}.history.origin.${origin}`),
]
