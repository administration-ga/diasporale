/**
 * Environnement PUBLIC de l'application (variables `NEXT_PUBLIC_*`, lues au
 * build). Aucune URL externe n'est écrite dans le code : identite.ga et
 * consulat.ga viennent de l'environnement ; absentes, les liens d'élévation ne
 * s'affichent pas (jamais de lien mort).
 */
import { resolveDataSource, type DataSourceKind } from "./data-source"

export type { DataSourceKind }

export const publicEnv = {
  /**
   * `demo` (données fictives, ce navigateur) ou `engine` (le moteur ANTSIA, PD2). Sans
   * déclaration, `demo` en développement seulement : une construction de production sans
   * source déclarée échoue (garde de construction appelée par `next.config.ts`).
   */
  dataSource: resolveDataSource(process.env.NEXT_PUBLIC_DIASPORALE_DATA_SOURCE),
  /** Déploiement Convex du moteur (inscrit par la configuration Next commune, ou l'ARG du Dockerfile). */
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL ?? null,
  /** Portail IDN (identite.ga) — « Activer mon identité numérique IDN ». */
  idnPortalUrl: process.env.NEXT_PUBLIC_IDN_PORTAL_URL ?? null,
  /** consulat.ga — « M'inscrire au consulat ». */
  consulateUrl: process.env.NEXT_PUBLIC_CONSULATE_URL ?? null,
} as const
