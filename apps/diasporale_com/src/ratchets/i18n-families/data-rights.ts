/**
 * Familles de clés DYNAMIQUES du chantier « droits personnels (DG-026) » (ex. `services.category.${slug}`),
 * énumérées depuis les constantes qui les pilotent. PROPRIÉTAIRE : ce chantier.
 * Une clé citée en toutes lettres n'a rien à faire ici.
 *
 * Les motifs connus d'un dossier réutilisent `report.reason.<motif>` (famille du cliquet
 * principal) ; les codes de refus `errors.<code>` sont couverts par `ERROR_CODES`.
 */
import {
  DECISION_APPEAL_LEVELS,
  DECISION_APPEAL_STATUSES,
  DECISION_SANCTION_KINDS,
  DECISION_SANCTION_STATUSES,
  DECISION_STATUSES,
  DECISION_SURFACES,
} from "@diasporale/features/data"

const DECISIONS = "settings.dataRights.decisions"

export const FAMILIES: readonly string[] = [
  ...DECISION_SURFACES.map((surface) => `${DECISIONS}.surface.${surface}`),
  ...DECISION_STATUSES.map((status) => `${DECISIONS}.status.${status}`),
  ...DECISION_SANCTION_KINDS.map((kind) => `${DECISIONS}.sanction.${kind}`),
  ...DECISION_SANCTION_STATUSES.map((status) => `${DECISIONS}.sanctionStatus.${status}`),
  ...DECISION_APPEAL_LEVELS.flatMap((level) => [`${DECISIONS}.appealLevel.${level}`, `${DECISIONS}.appealHint.${level}`]),
  ...DECISION_APPEAL_STATUSES.map((status) => `${DECISIONS}.appealStatus.${status}`),
]
