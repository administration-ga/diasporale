/**
 * Bail d'interface pris à l'action, jamais pendant un rendu. Une seule surface
 * immersive s'ouvre à la fois ; aucune URL ni donnée personnelle n'est retenue.
 */
let owner: symbol | null = null

export function claimMediaViewer(token: symbol): boolean {
  if (owner !== null && owner !== token) return false
  owner = token
  return true
}

export function ownsMediaViewer(token: symbol): boolean {
  return owner === token
}

export function releaseMediaViewer(token: symbol): void {
  if (owner === token) owner = null
}
