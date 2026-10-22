/**
 * Familles de clés DYNAMIQUES de « Mes signalements » (SU01d du moteur, 21/10/2026),
 * énumérées depuis les constantes du moteur que le port reprend. La surface et le motif
 * réutilisent les familles des décisions (`settings.dataRights.decisions.surface.<surface>`,
 * `report.reason.<motif>`).
 */
import { PERSONAL_REPORT_LEGAL_BASES, PERSONAL_REPORT_OUTCOMES } from "@diasporale/features/data"

const REPORTS = "settings.dataRights.reports"

export const FAMILIES: readonly string[] = [
  ...PERSONAL_REPORT_OUTCOMES.map((outcome) => `${REPORTS}.outcome.${outcome}`),
  ...PERSONAL_REPORT_LEGAL_BASES.map((basis) => `${REPORTS}.basis.${basis}`),
]
