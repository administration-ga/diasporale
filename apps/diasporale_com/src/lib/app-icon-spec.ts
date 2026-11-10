/**
 * Géométrie des icônes de DIASPORALE (MO-02). Aucune identité nouvelle : le motif est l'ŒILLET du
 * mot-symbole (charte §8 et `components/wordmark.tsx` : disque de la couleur du fond, anneau
 * d'encre de 2 px autour d'un disque de 10 px), agrandi et centré sur le fond de page. Ce motif
 * reste PROVISOIRE : l'icône de l'application revient au propriétaire (plan 16, décision 3).
 *
 * Proportions reprises du mot-symbole : diamètre intérieur = 10/14 du diamètre extérieur.
 */

/** Les icônes déclarées par le manifeste (routes `appIcon`). */
export const APP_ICON_FORMATS = ["192", "512", "masquable"] as const
export type AppIconFormat = (typeof APP_ICON_FORMATS)[number]

export interface AppIconSpec {
  /** Côté de l'image, en pixels. */
  readonly size: number
  /** Diamètre de l'anneau d'encre. */
  readonly outer: number
  /** Diamètre du disque de l'œillet. */
  readonly inner: number
}

/** Part du côté occupée par l'anneau : icône ordinaire, ou masquable (zone sûre de 80 % du côté). */
const OUTER_SHARE = { any: 0.6, maskable: 0.46 } as const
const INNER_SHARE = 10 / 14

export function appIconSpec(size: number, purpose: "any" | "maskable" = "any"): AppIconSpec {
  const outer = Math.round(size * OUTER_SHARE[purpose])
  return { size, outer, inner: Math.round(outer * INNER_SHARE) }
}

/** Les formats du manifeste : taille et usage déclarés. */
export const MANIFEST_ICONS: Readonly<Record<AppIconFormat, { readonly size: number; readonly purpose: "any" | "maskable" }>> = {
  "192": { size: 192, purpose: "any" },
  "512": { size: 512, purpose: "any" },
  masquable: { size: 512, purpose: "maskable" },
}

export function isAppIconFormat(value: string): value is AppIconFormat {
  return (APP_ICON_FORMATS as readonly string[]).includes(value)
}

/** Icône d'onglet (`app/icon.tsx`) et icône Apple (`app/apple-icon.tsx`). */
export const TAB_ICON_SIZE = 32
export const APPLE_ICON_SIZE = 180
