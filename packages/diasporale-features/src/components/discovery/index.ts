/**
 * Découverte verticale du fil (DG-017, sous-lot G6a) : le mode, sa carte, sa
 * mémoire de position, et le point d'arrêt de la lecture pour le chantier appels
 * (voir `lib/media-viewer-lease.ts` : `suspendMediaPlayback("call")` pendant
 * l'appel, `stopAllMediaPlayback()` ou l'événement `MEDIA_PLAYBACK_STOP_EVENT`
 * pour un arrêt ponctuel).
 */
export { FeedDiscovery, type FeedDiscoveryProps } from "./feed-discovery"
export { DiscoveryItem, type DiscoveryItemProps } from "./discovery-item"
export { discoveryPositionKey, forgetDiscoveryPosition, readDiscoveryPosition } from "./discovery-position"
export { DISCOVERY_MAX_MOUNTED, DISCOVERY_WINDOW_RADIUS, discoveryWindow, slideRendering, type SlideRendering } from "./discovery-window"
export {
  isMediaPlaybackSuspended,
  MEDIA_PLAYBACK_STOP_EVENT,
  registeredMediaPlayerCount,
  stopAllMediaPlayback,
  suspendMediaPlayback,
  type MediaPlaybackSuspensionReason,
} from "../../lib/media-viewer-lease"
