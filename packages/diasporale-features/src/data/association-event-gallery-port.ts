/** DG-023 : médias sous l'identité et l'audience vivante de l'événement. */
import type { ActionResult, PublishMediaInput } from "./port"
import type { Loadable, PostView } from "./types"
import type { AssociationActivityPage, AssociationEventAudience } from "./association-activities-port"

export interface AssociationEventGalleryState {
  readonly eventId: string
  readonly available: boolean
  readonly canPublish: boolean
  readonly audience: AssociationEventAudience
}

export interface AssociationEventGalleryItem {
  readonly post: PostView
  readonly canRemove: boolean
}

export interface AssociationEventGalleryCapability {
  readonly mode: "engine" | "demonstration"
  /** Clé de relecture facultative ; ne donne aucun droit et ne remplace pas l'heure serveur. */
  useGallery(eventId: string, refreshKey?: number): Loadable<AssociationEventGalleryState | null>
  useItems(input: { readonly eventId: string; readonly cursor: string | null }): Loadable<AssociationActivityPage<AssociationEventGalleryItem>>
  publish(input: { readonly eventId: string; readonly body: string; readonly media: readonly PublishMediaInput[]; readonly idempotencyKey: string }): Promise<ActionResult<{ readonly postId: string; readonly created: boolean }>>
  remove(input: { readonly eventId: string; readonly postId: string }): Promise<ActionResult>
}
