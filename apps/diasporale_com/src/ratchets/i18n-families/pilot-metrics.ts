/**
 * Familles de clés DYNAMIQUES du chantier « mesure du pilote » (DG-027 · G11), énumérées depuis les
 * constantes qui les pilotent. PROPRIÉTAIRE : ce chantier.
 *
 * Les groupes et les indicateurs viennent de la liste fermée du domaine ; le délai de première
 * réponse a ses deux lignes en toutes lettres ; les bases des taux se disent une fois par
 * dénominateur, avec ou sans chiffre publié. Les refus appartiennent au catalogue fermé des erreurs.
 */
import { PILOT_METRIC_GROUPS, PILOT_METRICS } from "@diasporale/domain"

/** Les indicateurs à libellé propre (tous sauf le délai de première réponse). */
const LABELLED = PILOT_METRICS.filter((metric) => metric.kind !== "duration").map((metric) => metric.id)

/** Les bases des taux : chaque dénominateur, une seule fois. */
const BASES = [...new Set(PILOT_METRICS.flatMap((metric) => (metric.kind === "ratio" ? [metric.denominatorId] : [])))]

export const FAMILIES: readonly string[] = [
  ...PILOT_METRIC_GROUPS.map((group) => `pilotMetrics.group.${group}`),
  ...LABELLED.flatMap((id) => [`pilotMetrics.indicator.${id}.label`, `pilotMetrics.indicator.${id}.hint`]),
  ...BASES.flatMap((id) => [`pilotMetrics.base.${id}`, `pilotMetrics.baseBelow.${id}`]),
]
