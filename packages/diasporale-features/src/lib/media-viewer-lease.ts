/**
 * Bail d'interface pris à l'action, jamais pendant un rendu. Une seule surface
 * immersive s'ouvre à la fois ; aucune URL ni donnée personnelle n'est retenue.
 */
let owner: symbol | null = null

/**
 * Abonnés aux changements du bail et du lecteur unique (DG-017) : la découverte
 * verticale relit ainsi, sans sondage, si une visionneuse est ouverte ou si la
 * lecture est suspendue.
 */
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of [...listeners]) listener()
}

export function claimMediaViewer(token: symbol): boolean {
  if (owner !== null && owner !== token) return false
  if (owner !== token) {
    owner = token
    notify()
  }
  return true
}

export function ownsMediaViewer(token: symbol): boolean {
  return owner === token
}

export function releaseMediaViewer(token: symbol): void {
  if (owner === token) {
    owner = null
    notify()
  }
}

/** Une visionneuse est-elle ouverte ? Aucune lecture automatique ne reprend derrière elle. */
export function isMediaViewerOpen(): boolean {
  return owner !== null
}

// ═══════════════════════════════════════════════════════════════════════════
// Lecteur unique (DG-017) — un seul média joue à la fois dans l'onglet
// ═══════════════════════════════════════════════════════════════════════════
//
// Chaque `<video>` rendue par les médias d'une publication s'inscrit ici
// (`registerMediaPlayer`) ; son événement `play` réclame la lecture
// (`claimMediaPlayback`), ce qui met en pause toute autre lecture inscrite. Le
// registre ne garde que des éléments montés : il se vide à leur démontage, son
// effectif reste donc borné par ce que l'écran monte (`registeredMediaPlayerCount`).
//
// POINT D'ARRÊT POUR LE CHANTIER APPELS (R-G02, « arrêt pendant l'appel ») :
//   · `suspendMediaPlayback("call")` à l'ouverture de l'appel (sonnerie
//     acceptée ou appel lancé) : toute lecture s'arrête, aucune ne peut
//     reprendre — ni automatique (découverte), ni d'un geste — tant que la
//     fonction rendue n'a pas été appelée ;
//   · appeler la fonction rendue à la fin de l'appel (raccroché, refusé,
//     échoué) ; la découverte reprend alors d'elle-même l'élément actif (avec
//     le choix de son de la personne), sauf si elle l'avait mis en pause ;
//   · `stopAllMediaPlayback()` coupe une fois, sans rien interdire ensuite ;
//   · hors de ce paquet (module d'appel du moteur), le même arrêt ponctuel
//     s'obtient par l'événement DOM `MEDIA_PLAYBACK_STOP_EVENT` :
//     `window.dispatchEvent(new Event("diasporale:media-playback-stop"))`.

/** Pourquoi la lecture est suspendue ; une seule cause suffit à tout arrêter. */
export type MediaPlaybackSuspensionReason = "call" | "external"

/** Événement DOM d'arrêt ponctuel de toute lecture (écouté tant qu'un lecteur est monté). */
export const MEDIA_PLAYBACK_STOP_EVENT = "diasporale:media-playback-stop"

const players = new Map<symbol, HTMLMediaElement>()
const suspensions = new Map<symbol, MediaPlaybackSuspensionReason>()
let stopListener: (() => void) | null = null

function pauseElement(element: HTMLMediaElement): void {
  if (!element.paused) element.pause()
}

function listenForStopEvent(): void {
  if (stopListener !== null || typeof window === "undefined") return
  stopListener = () => stopAllMediaPlayback()
  window.addEventListener(MEDIA_PLAYBACK_STOP_EVENT, stopListener)
}

function forgetStopEventWhenIdle(): void {
  if (players.size > 0 || stopListener === null || typeof window === "undefined") return
  window.removeEventListener(MEDIA_PLAYBACK_STOP_EVENT, stopListener)
  stopListener = null
}

/** Inscrit un élément monté ; la fonction rendue le désinscrit (démontage). */
export function registerMediaPlayer(token: symbol, element: HTMLMediaElement): () => void {
  players.set(token, element)
  if (suspensions.size > 0) pauseElement(element)
  listenForStopEvent()
  return () => {
    if (players.get(token) === element) players.delete(token)
    forgetStopEventWhenIdle()
  }
}

/**
 * À l'événement `play` d'un lecteur inscrit : il devient le seul à jouer.
 * Pendant une suspension, la lecture est refusée (le lecteur est remis en pause).
 */
export function claimMediaPlayback(token: symbol): boolean {
  const element = players.get(token)
  if (suspensions.size > 0) {
    if (element) pauseElement(element)
    return false
  }
  for (const [other, otherElement] of players) {
    if (other !== token) pauseElement(otherElement)
  }
  return true
}

/** Met en pause toute lecture en cours (ouverture d'une visionneuse, appel, sortie). */
export function stopAllMediaPlayback(): void {
  for (const element of players.values()) pauseElement(element)
}

/** Arrête toute lecture et l'interdit jusqu'à l'appel de la fonction rendue. */
export function suspendMediaPlayback(reason: MediaPlaybackSuspensionReason): () => void {
  const token = Symbol(reason)
  suspensions.set(token, reason)
  stopAllMediaPlayback()
  notify()
  return () => {
    if (suspensions.delete(token)) notify()
  }
}

export function isMediaPlaybackSuspended(): boolean {
  return suspensions.size > 0
}

/** Abonnement aux changements (visionneuse, suspension) — forme de `useSyncExternalStore`. */
export function subscribeMediaPlayback(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Lecteurs montés et inscrits : la mesure du plafond tenu par la découverte (R-G02). */
export function registeredMediaPlayerCount(): number {
  return players.size
}
