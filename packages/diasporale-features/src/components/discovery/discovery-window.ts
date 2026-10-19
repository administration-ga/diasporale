/**
 * La fenêtre de recyclage de la découverte verticale (DG-017), décidée hors
 * composant et testée seule.
 *
 * Quel que soit le nombre de publications parcourues, au plus
 * `DISCOVERY_MAX_MOUNTED` diapositives sont montées autour de l'active ; le
 * reste n'est que de l'espace réservé (deux intercalaires), si bien que le DOM,
 * la mémoire des cartes et le nombre de lecteurs restent bornés (R-G02).
 *
 * Parmi les diapositives montées, seules l'active, la suivante (préchargement
 * des seules métadonnées) et une précédente DÉJÀ VUE rendent leurs médias : rien
 * n'est préchargé au-delà de la suivante, et rien qui n'ait été admis par la
 * même lecture que le fil en liste. Les autres restent en veille, sans média.
 */

export const DISCOVERY_WINDOW_RADIUS = 2
export const DISCOVERY_MAX_MOUNTED = DISCOVERY_WINDOW_RADIUS * 2 + 1
/** Identifiants récemment vus retenus pour rendre la précédente sans la recharger. */
export const DISCOVERY_SEEN_LIMIT = 8
/** À cette distance de la fin des publications chargées, la page suivante est demandée. */
export const DISCOVERY_PREFETCH_DISTANCE = 3

/** Indices montés : `start` inclus, `end` exclu. */
export interface DiscoveryWindow {
  readonly start: number
  readonly end: number
}

export function discoveryWindow(active: number, count: number, radius: number = DISCOVERY_WINDOW_RADIUS): DiscoveryWindow {
  if (count <= 0) return { start: 0, end: 0 }
  const clamped = Math.min(Math.max(active, 0), count - 1)
  return { start: Math.max(0, clamped - radius), end: Math.min(count, clamped + radius + 1) }
}

/** `full` : la carte et ses médias ; `dormant` : une place réservée, sans contenu ni média. */
export type SlideRendering = "full" | "dormant"

export interface SlideRenderingContext {
  readonly active: number
  /** La précédente ne rend ses médias que déjà vue : aucun préchargement vers l'arrière. */
  readonly wasSeen: (index: number) => boolean
  /** Économie de données demandée : pas même la suivante n'est préchargée. */
  readonly preloadNext: boolean
}

export function slideRendering(index: number, context: SlideRenderingContext): SlideRendering {
  if (index === context.active) return "full"
  if (index === context.active + 1) return context.preloadNext ? "full" : "dormant"
  if (index === context.active - 1) return context.wasSeen(index) ? "full" : "dormant"
  return "dormant"
}

/** Mémoire bornée des publications vues, la plus récente en dernier. */
export function rememberSeen(seen: readonly string[], id: string, limit: number = DISCOVERY_SEEN_LIMIT): readonly string[] {
  if (seen[seen.length - 1] === id) return seen
  const next = [...seen.filter((value) => value !== id), id]
  return next.length > limit ? next.slice(next.length - limit) : next
}
