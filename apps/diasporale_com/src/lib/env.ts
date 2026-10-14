/**
 * Environnement PUBLIC de l'application (variables `NEXT_PUBLIC_*`, lues au
 * build). Aucune URL externe n'est écrite dans le code : identite.ga et
 * consulat.ga viennent de l'environnement ; absentes, les liens d'élévation ne
 * s'affichent pas (jamais de lien mort).
 */
export type DataSourceKind = "demo" | "engine"

export const publicEnv = {
  /** `demo` tant que le moteur n'est pas câblé ; `engine` après PD2/PD4. */
  dataSource: (process.env.NEXT_PUBLIC_DIASPORALE_DATA_SOURCE === "engine" ? "engine" : "demo") as DataSourceKind,
  /** Portail IDN (identite.ga) — « Activer mon identité numérique IDN ». */
  idnPortalUrl: process.env.NEXT_PUBLIC_IDN_PORTAL_URL ?? null,
  /** consulat.ga — « M'inscrire au consulat ». */
  consulateUrl: process.env.NEXT_PUBLIC_CONSULATE_URL ?? null,
} as const
