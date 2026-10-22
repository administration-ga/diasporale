/**
 * Familles de clés DYNAMIQUES de la voie « Délais légaux » du guichet de modération (SU01d du
 * moteur, ordonnance n° 0011/PR/2026), énumérées depuis les constantes du moteur que le port
 * reprend. La nature, le motif et le niveau réutilisent les familles du guichet.
 */
import { DESK_LEGAL_BASES } from "@diasporale/features/data"

const DEADLINES = "moderationDesk.deadlines"

export const FAMILIES: readonly string[] = DESK_LEGAL_BASES.map((basis) => `${DEADLINES}.basis.${basis}`)
