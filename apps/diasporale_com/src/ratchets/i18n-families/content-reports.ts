/**
 * Familles de clés DYNAMIQUES du chantier « confiance des surfaces » (G9), énumérées depuis
 * les constantes qui les pilotent. PROPRIÉTAIRE : ce chantier.
 *
 * Le geste et sa feuille se disent par nature (bouton, titre). Les libellés des neuf natures
 * dans le guichet de modération et dans « Mes données » suivent les surfaces du moteur
 * (familles de ces chantiers) ; ils sont énumérés ici aussi depuis le contrat figé, pour
 * qu'aucune nature signalable ne reste sans son libellé. Les motifs réutilisent la famille
 * des motifs du cliquet principal ; les codes de refus sont couverts par les codes fermés.
 */
import { CONTENT_REPORT_KINDS } from "@diasporale/features/data"

export const FAMILIES: readonly string[] = CONTENT_REPORT_KINDS.flatMap((kind) => [
  `contentReports.action.${kind}`,
  `contentReports.title.${kind}`,
  `moderationDesk.surface.${kind}`,
  `settings.dataRights.decisions.surface.${kind}`,
])
