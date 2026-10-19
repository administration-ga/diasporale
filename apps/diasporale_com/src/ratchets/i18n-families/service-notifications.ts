/**
 * Familles de clés DYNAMIQUES du chantier « notifications de mise en relation » (DG-010,
 * DG-015, DG-016), énumérées depuis les constantes qui les pilotent. PROPRIÉTAIRE : ce
 * chantier. Les phrases des genres (`bell.system.<genre>`) sont déjà couvertes par
 * `BELL_SYSTEM_KINDS` dans le cliquet commun ; ici, le libellé du lien selon l'interlocuteur.
 */
import { SERVICE_NOTICE_AUDIENCES } from "@diasporale/features/data"

export const FAMILIES: readonly string[] = SERVICE_NOTICE_AUDIENCES.map((audience) => `bell.serviceLink.${audience}`)
