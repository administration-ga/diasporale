"use client"

import { ImageOffIcon, LoaderCircleIcon, ShieldAlertIcon } from "lucide-react"

import type { PostMediaView } from "../data/types"
import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"

/**
 * Les médias d'une publication (EXF-DG-10). Une photo seule garde ses
 * proportions ; deux à quatre se rangent en carrés (la première d'un trio prend
 * toute la largeur). Un média que la garde des fichiers retient garde sa place
 * et dit pourquoi : analyse en cours, ou bloqué. La mise en page ne saute pas :
 * la photo seule déclare sa taille, la grille ses carrés.
 */
export function PostMediaGrid(props: { media: readonly PostMediaView[]; className?: string }) {
  const count = props.media.length
  if (count === 0) return null
  return (
    <div className={cn("grid gap-1", count === 1 ? "grid-cols-1" : "grid-cols-2", props.className)}>
      {props.media.map((item, index) => (
        <MediaTile key={index} item={item} single={count === 1} wide={count === 3 && index === 0} />
      ))}
    </div>
  )
}

function MediaTile(props: { item: PostMediaView; single: boolean; wide: boolean }) {
  const { t } = useDiasporaleT()
  const { item } = props
  const size = item.width && item.height ? { width: item.width, height: item.height } : null
  // Une photo seule déclare sa taille ; sans dimensions connues, elle réserve un cadre 16:9 (pas de saut au chargement).
  const reserved = props.single && size === null
  const frame = cn(
    "overflow-hidden rounded-md bg-muted",
    props.wide && "col-span-2",
    props.single ? (reserved ? "aspect-video" : "") : props.wide ? "aspect-[2/1]" : "aspect-square",
  )

  if (item.url === null) {
    const label =
      item.withheld === "scan_pending" ? t("post.media.scanPending") : item.withheld === "quarantined" ? t("post.media.quarantined") : t("post.media.unavailable")
    const Icon = item.withheld === "scan_pending" ? LoaderCircleIcon : item.withheld === "quarantined" ? ShieldAlertIcon : ImageOffIcon
    return (
      <div
        role="img"
        aria-label={label}
        className={cn(frame, "flex min-h-32 flex-col items-center justify-center gap-2 p-4 text-center text-[13px] text-muted-foreground", props.single && "aspect-video")}
      >
        <Icon className={cn("size-5", item.withheld === "scan_pending" && "animate-spin motion-reduce:animate-none")} aria-hidden />
        <span aria-hidden>{label}</span>
      </div>
    )
  }

  if (item.kind === "video") {
    return (
      <div className={frame}>
        <video
          src={item.url}
          controls
          preload="metadata"
          playsInline
          aria-label={item.altText ?? t("post.media.video")}
          className={props.single && !reserved ? "max-h-[32rem] w-full" : "size-full object-cover"}
          {...(size ?? {})}
        />
      </div>
    )
  }

  return (
    <div className={frame}>
      {/* Fichier délivré par la garde du moteur (URL signée, durée bornée) : pas d'optimiseur d'images entre les deux. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- URL de la garde des fichiers, jamais réécrite */}
      <img
        src={item.url}
        alt={item.altText ?? t("post.media.photo")}
        loading="lazy"
        decoding="async"
        className={props.single && !reserved ? "h-auto max-h-[32rem] w-full object-contain" : reserved ? "size-full object-contain" : "size-full object-cover"}
        {...(size ?? {})}
      />
    </div>
  )
}
