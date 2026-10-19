/**
 * Publications des pages de DIASPORALE : mur paginé, parole au nom d'une page,
 * retrait par un signataire vivant. Le moteur relit l'autorité à chaque geste.
 * L'audience publique reste dans le réseau suivant la règle collective de la
 * page ; aucun choix individuel de diffusion sur ANTSIA n'est proposé ici.
 */
import type { Reach } from "@diasporale/domain"

import type { ActionErrorCode } from "./errors"
import type { ActionResult, PublishMediaInput } from "./port"
import type { FeedCursorView, FeedPageQuery, PostView } from "./types"

export const PAGE_PUBLICATIONS_PAGE_SIZE = 20
export const PAGE_PUBLICATIONS_ERROR_CODES = ["page_post_changed", "page_pin_changed"] as const
export const PAGE_MEDIA_KINDS = ["all", "image", "video"] as const
export type PageMediaKind = (typeof PAGE_MEDIA_KINDS)[number]

export interface PageMediaRequest {
  readonly handle: string
  /** Lecteur effectivement présenté par l'adhésion ; ferme tout changement de session. */
  readonly personId: string
  readonly kind: PageMediaKind
  readonly cursor: FeedCursorView | null
}

export interface PageMediaCapability {
  /** Publications lisibles contenant ce type de média ; chaque DTO garde tous ses médias. */
  useMedia(args: PageMediaRequest): FeedPageQuery
}

export interface PagePinnedQuery {
  /** Aucune référence brute n'est exposée pour une annonce devenue illisible. */
  readonly data: PostView | null | undefined
  readonly isLoading: boolean
  readonly error: ActionErrorCode | null
  readonly retry: () => void
}

export interface PagePinningCapability {
  usePinned(args: { readonly handle: string; readonly personId: string }): PagePinnedQuery
  setPinned(input: {
    readonly pageId: string
    readonly postId: string | null
    /** L'annonce lisible effectivement présentée au signataire ; null si aucune. */
    readonly expectedPinnedPostId: string | null
  }): Promise<ActionResult<{ readonly changed: boolean }>>
}

export interface PageWallRequest {
  readonly handle: string
  readonly cursor: FeedCursorView | null
}

export interface PagePublicationInput {
  readonly pageId: string
  readonly body: string
  readonly reach: Reach
  readonly audience: "public" | "followers"
  readonly media?: readonly PublishMediaInput[]
  /** Une clé par tentative logique, conservée pendant une reprise réseau. */
  readonly idempotencyKey: string
}

export interface PagePublicationsCapability {
  /** Choix collectif de la page, sous mandat vivant ; aucune audience n'est élargie. */
  readonly pinning?: PagePinningCapability
  /** Médiathèque de la page ; facultative pour les fournisseurs antérieurs. */
  readonly media?: PageMediaCapability
  /** Chaque fenêtre repasse la garde du mur de la page et du lecteur courant. */
  useWall(args: PageWallRequest): FeedPageQuery
  /** Le pays local est celui de la page, jamais celui du signataire. */
  publish(input: PagePublicationInput): Promise<ActionResult<{ readonly postId: string; readonly created: boolean }>>
  /** Tous les signataires vivants peuvent retirer une publication de leur page. */
  remove(input: { readonly pageId: string; readonly postId: string }): Promise<ActionResult>
  /** Modifier le texte sous mandat vivant ; les médias et l'audience restent ceux du post. */
  edit?(input: {
    readonly pageId: string
    readonly postId: string
    readonly body: string
    /** Texte et date d'édition de la version effectivement lue. */
    readonly expectedBody: string
    readonly expectedEditedAt: number | null
  }): Promise<ActionResult<{ readonly changed: boolean; readonly editedAt: number | null }>>
}
