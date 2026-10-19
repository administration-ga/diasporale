import { DIASPORALE_NETWORK_SLUG } from "@diasporale/domain"

/**
 * L'apparence de diasporale.com (19/10/2026, demande du propriétaire) : le mode
 * (Système, Clair, Sombre) et le thème, au choix du membre. Deux thèmes :
 *   - « Sable », la charte de DIASPORALE (`data-charte="diasporale"`), premier de la
 *     liste, donc thème par défaut ;
 *   - « Gaboma », le thème du réseau ANTSIA, sur la structure de DIASPORALE
 *     (`data-charte="diasporale-gaboma"`, couleurs seulement).
 * Une seule configuration pour le fournisseur d'apparence du moteur
 * (`components/providers.tsx`) et son script d'amorçage
 * (`components/appearance-boot-script.tsx`) : l'un relit exactement ce que l'autre a
 * posé, sous le préfixe du réseau (`antsia:diasporale:`, celui des magasins de la
 * coque). Le choix reste sur l'appareil, comme le mode.
 *
 * Module serveur autant que client : aucune dépendance React.
 */
export const DIASPORALE_THEME_IDS = ["sable", "gaboma"] as const
export type DiasporaleThemeId = (typeof DIASPORALE_THEME_IDS)[number]

/** La charte (`data-charte`) de chaque thème ; les deux fichiers vivent dans `@antsia/ui/themes`. */
const CHARTES = {
  sable: "diasporale",
  gaboma: "diasporale-gaboma",
} as const satisfies Record<DiasporaleThemeId, string>

export const APPEARANCE = {
  storagePrefix: `antsia:${DIASPORALE_NETWORK_SLUG}:`,
  themes: DIASPORALE_THEME_IDS.map((id) => ({ id, charte: CHARTES[id] })),
} as const

/** La charte de Sable, celle que la mise en page sert avant toute préférence. */
export const DEFAULT_CHARTE = CHARTES.sable

export function isDiasporaleThemeId(value: unknown): value is DiasporaleThemeId {
  return typeof value === "string" && (DIASPORALE_THEME_IDS as readonly string[]).includes(value)
}
