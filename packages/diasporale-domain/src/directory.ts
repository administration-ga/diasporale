/**
 * Annuaire des membres, opt-in par niveau (EXF-DG-46).
 *
 * `hidden` par défaut ; `country` (les membres de mon pays) ; `network` (tout
 * DIASPORALE). Réservé aux membres actifs, sans export, sans coordonnées : le
 * contact passe par la messagerie (invariant 6).
 */
import type { CountryCode } from "./countries"
import { hasCapability, type MembershipStatus } from "./eligibility"

export const DIRECTORY_VISIBILITY_LEVELS = ["hidden", "country", "network"] as const
export type DirectoryVisibility = (typeof DIRECTORY_VISIBILITY_LEVELS)[number]
export const DEFAULT_DIRECTORY_VISIBILITY: DirectoryVisibility = "hidden"

/** Pagination stricte de l'annuaire : anti-extraction (EXF-DG-35, EXF-DG-46). */
export const DIRECTORY_PAGE_SIZE_MAX = 20

export interface DirectoryTarget {
  readonly status: MembershipStatus
  readonly visibility: DirectoryVisibility
  /** Consentement `directory` en vigueur (registre des consentements). */
  readonly consentActive: boolean
  readonly country: CountryCode
}

export interface DirectoryViewer {
  readonly status: MembershipStatus
  readonly country: CountryCode
  readonly isSelf: boolean
  /** Blocage dans un sens ou dans l'autre : il ferme aussi l'annuaire (EXF-DG-43). */
  readonly blockedWithTarget: boolean
}

/**
 * Le membre paraît-il dans l'annuaire pour ce lecteur ? Il faut QUATRE accords
 * à la fois : le choix d'un niveau, le consentement en vigueur, un statut qui
 * permet d'y figurer, et un lecteur qui a le droit de consulter.
 */
export function isListedInDirectoryFor(target: DirectoryTarget, viewer: DirectoryViewer): boolean {
  if (viewer.isSelf) return target.visibility !== "hidden" && target.consentActive
  if (viewer.blockedWithTarget) return false
  if (!hasCapability(viewer.status, "view_directory")) return false
  if (!hasCapability(target.status, "appear_in_directory")) return false
  if (!target.consentActive) return false
  switch (target.visibility) {
    case "hidden":
      return false
    case "country":
      return viewer.country === target.country
    case "network":
      return true
  }
}

/** Taille de page demandée, bornée — jamais plus que la borne, jamais moins d'une ligne. */
export function clampDirectoryPageSize(requested: number): number {
  if (!Number.isFinite(requested)) return DIRECTORY_PAGE_SIZE_MAX
  return Math.min(DIRECTORY_PAGE_SIZE_MAX, Math.max(1, Math.trunc(requested)))
}
