/**
 * Familles de clés DYNAMIQUES du chantier « mentorat » (DG-024 c), énumérées depuis les
 * constantes qui les pilotent. PROPRIÉTAIRE : ce chantier. Une clé citée en toutes lettres
 * n'a rien à faire ici ; les `errors.<code>` sont couverts par les codes fermés
 * (`MENTORING_ERROR_CODES`) et `mentor.domain.<domaine>` par la famille des cartes.
 */
import { MENTOR_PROFILE_STATES, MENTORING_CLOSERS, MENTORING_REQUEST_STATUSES } from "@diasporale/domain"

export const FAMILIES: readonly string[] = [
  ...MENTORING_REQUEST_STATUSES.map((status) => `mentoring.status.${status}`),
  ...MENTOR_PROFILE_STATES.map((state) => `mentoring.state.${state}`),
  ...MENTORING_CLOSERS.map((closer) => `mentoring.closedBy.${closer}`),
]
