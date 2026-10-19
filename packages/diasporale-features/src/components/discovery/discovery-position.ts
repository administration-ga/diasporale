/**
 * La position de retour de la découverte (DG-017) : en mémoire de l'onglet
 * seulement, jamais dans le stockage du navigateur.
 *
 * Une seule entrée, pour un seul contexte de lecture (source, personne, portée,
 * pays, filtre) : revenir d'un profil ou d'une publication rouvre la découverte
 * sur la même publication et les mêmes pages ; la liste peut y revenir aussi.
 * Lire depuis un AUTRE contexte efface l'entrée : rien du compte précédent ni
 * d'une autre portée ne se retrouve ailleurs (R-G17).
 */
import type { CountryCode, FeedScope } from "@diasporale/domain"

import type { DiscoverySnapshot } from "./discovery-state"

let entry: { readonly key: string; readonly snapshot: DiscoverySnapshot } | null = null

export function discoveryPositionKey(parts: {
  readonly source: string
  readonly personId: string
  readonly scope: FeedScope
  readonly country: CountryCode
  readonly tag?: string
}): string {
  return JSON.stringify([parts.source, parts.personId, parts.scope, parts.country, parts.tag?.trim().toLowerCase() || null])
}

export function readDiscoveryPosition(key: string): DiscoverySnapshot | null {
  if (entry === null) return null
  if (entry.key === key) return entry.snapshot
  entry = null
  return null
}

export function rememberDiscoveryPosition(key: string, snapshot: DiscoverySnapshot): void {
  entry = { key, snapshot }
}

/** Oublie toute position (sortie de session, tests). */
export function forgetDiscoveryPosition(): void {
  entry = null
}
