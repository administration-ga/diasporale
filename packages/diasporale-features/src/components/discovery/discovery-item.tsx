"use client"

import type { CountryCode } from "@diasporale/domain"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"

import type { PostView, ReactionKind } from "../../data/types"
import { useDiasporaleT } from "../../i18n/client"
import { cn } from "../../lib/cn"
import { Skeleton } from "../../primitives/surface"
import { PostCard } from "../cards/post-card"
import type { SlideRendering } from "./discovery-window"

/** Au-delà, un texte sans mise en page mesurable (rendu serveur, tests) est présumé tronqué. */
const LONG_BODY_CHARACTERS = 180
const LONG_BODY_LINES = 3

function isLongBody(body: string): boolean {
  return body.length > LONG_BODY_CHARACTERS || body.split("\n").length > LONG_BODY_LINES
}

/**
 * La carte enveloppée tient dans la diapositive : ses médias se règlent sur la
 * hauteur du conteneur de lecture (`100cqh`), sans recadrage destructif — une
 * photo verticale ou un paysage restent entiers (contain), la visionneuse les
 * montre en grand. Ce réglage ne touche que des balises (`img`, `video`) et la
 * grille à deux colonnes : la carte elle-même n'est pas modifiée.
 */
const MEDIA_FIT = cn(
  "[&_img]:max-h-[max(8rem,calc(100cqh_-_14rem))] [&_video]:max-h-[max(8rem,calc(100cqh_-_14rem))]",
  "[&_.grid-cols-2]:mx-auto [&_.grid-cols-2]:w-full [&_.grid-cols-2]:max-w-[max(12rem,calc(100cqh_-_12rem))]",
)

export interface DiscoveryItemProps {
  readonly post: PostView
  readonly now: number
  readonly hubCountry?: CountryCode
  readonly canReact: boolean
  readonly onReact: (kind: ReactionKind | null) => void
  /** `dormant` : place réservée, aucun contenu ni média (rien n'est préchargé). */
  readonly rendering: SlideRendering
  readonly active: boolean
}

/**
 * Carte de découverte (DG-017) : la carte de publication du fil, ENVELOPPÉE —
 * auteur, badges, portée, texte, médias, réactions, commentaires, partage et
 * menu restent ceux de `PostCard` (mêmes gardes, auteur neutre compris). La
 * découverte y ajoute la mise à l'échelle des médias et un texte tronqué qui se
 * déroule dans son propre panneau, sans changer de publication.
 */
export function DiscoveryItem(props: DiscoveryItemProps) {
  if (props.rendering === "dormant") return <DormantItem />
  return <FullItem {...props} />
}

function DormantItem() {
  return (
    <div aria-hidden className="flex h-full min-h-0 flex-col justify-center gap-3 px-1">
      <Skeleton className="h-12 w-2/3 rounded-lg" />
      <Skeleton className="h-[max(8rem,calc(100cqh_-_14rem))] w-full rounded-xl" />
      <Skeleton className="h-10 w-1/2 rounded-lg" />
    </div>
  )
}

function FullItem(props: DiscoveryItemProps) {
  const { t } = useDiasporaleT()
  const panelId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  // Une publication qui n'est plus active se replie : la suivante s'ouvre toujours au début.
  useEffect(() => {
    if (!props.active) setExpanded(false)
  }, [props.active])

  // Mesure du texte tronqué et du débordement ; sans mise en page, la longueur du texte en décide.
  useLayoutEffect(() => {
    const node = panel.current
    if (node === null) return
    const measure = () => {
      const body = node.querySelector<HTMLElement>("article > p")
      const laidOut = node.clientHeight > 0
      setTruncated(expanded || (laidOut ? body !== null && body.scrollHeight > body.clientHeight + 1 : isLongBody(props.post.body)))
      setOverflowing(laidOut && node.scrollHeight > node.clientHeight + 1)
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [expanded, props.post.body, props.post.media])

  // Le panneau qui défile se rejoint au clavier, sous un nom qui le dit.
  const scrollable = expanded || overflowing
  return (
    <div className="flex max-h-full min-h-0 flex-col gap-1">
      <div
        ref={panel}
        id={panelId}
        data-discovery-scroll={scrollable ? "" : undefined}
        tabIndex={scrollable ? 0 : undefined}
        role={scrollable ? "region" : undefined}
        aria-label={scrollable ? t("discovery.item.panel") : undefined}
        className={cn(
          "min-h-0 rounded-xl overflow-y-auto focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]",
          expanded ? "overscroll-contain" : "[&_article>p]:line-clamp-3",
          MEDIA_FIT,
        )}
      >
        <PostCard
          post={props.post}
          now={props.now}
          {...(props.hubCountry === undefined ? {} : { hubCountry: props.hubCountry })}
          canReact={props.canReact}
          onReact={props.onReact}
        />
      </div>
      {truncated ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-md px-3 text-sm font-semibold text-primary hover:bg-muted focus-visible:shadow-focus"
        >
          {expanded ? <ChevronUpIcon className="size-4" aria-hidden /> : <ChevronDownIcon className="size-4" aria-hidden />}
          {t(expanded ? "discovery.item.collapse" : "discovery.item.expand")}
        </button>
      ) : null}
    </div>
  )
}
