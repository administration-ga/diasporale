"use client"

import { ImmersiveOverlay } from "@antsia/ui/overlay"
import { ChevronLeftIcon, ChevronRightIcon, ImageOffIcon, LoaderCircleIcon, Maximize2Icon, ShieldAlertIcon, XIcon } from "lucide-react"
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"

import { useOptionalDataSource } from "../data/context"
import type { DiasporaleDataSource } from "../data/port"
import type { PostMediaView } from "../data/types"
import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"
import { claimMediaViewer, ownsMediaViewer, releaseMediaViewer } from "../lib/media-viewer-lease"

/**
 * Les médias d'une publication (EXF-DG-10). Une photo seule garde ses
 * proportions ; deux à quatre se rangent en carrés (la première d'un trio prend
 * toute la largeur). Un média que la garde des fichiers retient garde sa place
 * et dit pourquoi : analyse en cours, ou bloqué. La mise en page ne saute pas :
 * la photo seule déclare sa taille, la grille ses carrés.
 */
type GridProps = { media: readonly PostMediaView[]; className?: string; interactive?: boolean }
type ViewerScope = {
  readonly source: DiasporaleDataSource | null
  readonly contextKey: string
  readonly canDisplay: boolean
  readonly canOpen: boolean
  readonly signature: string
  readonly token: symbol
}

export function PostMediaGrid(props: GridProps) {
  const source = useOptionalDataSource()
  return source
    ? <SessionMediaGrid key={source.kind} {...props} source={source} />
    : <MediaGrid {...props} source={null} contextKey="legacy" canDisplay canOpen={false} />
}

function SessionMediaGrid(props: GridProps & { source: DiasporaleDataSource }) {
  const session = props.source.useSession()
  const signedIn = session.status === "ready" && session.data.status === "signed_in" ? session.data : null
  const membership = signedIn?.membership
  const activeStatus = (status: string | undefined) => status === "en_attente" || status === "declaree" || status === "verifiee"
  const readable = Boolean(signedIn && membership && signedIn.account.id === membership.personId && activeStatus(membership.status) && activeStatus(membership.root.status))
  const contextKey = JSON.stringify([
    session.status, signedIn?.account.id ?? null, membership?.personId ?? null,
    membership?.status ?? null, membership?.root.status ?? null, membership?.canPublish ?? null,
  ])
  return <MediaGrid key={contextKey} media={props.media} className={props.className} source={props.source} contextKey={contextKey} canDisplay={readable} canOpen={readable && props.interactive !== false} />
}

function isDelivered(item: PostMediaView) {
  return item.withheld === null && item.url !== null && item.url.trim().length > 0
}

function MediaGrid(props: GridProps & { source: DiasporaleDataSource | null; contextKey: string; canDisplay: boolean; canOpen: boolean }) {
  const { t } = useDiasporaleT()
  const count = props.media.length
  const signature = JSON.stringify(props.media.map((item) => [item.kind, item.url, item.withheld, item.altText, item.width, item.height]))
  const scope = useMemo<ViewerScope>(() => ({ source: props.source, contextKey: props.contextKey, canDisplay: props.canDisplay, canOpen: props.canOpen, signature, token: Symbol() }), [props.source, props.contextKey, props.canDisplay, props.canOpen, signature])
  const live = useRef<ViewerScope | null>(null)
  const [selection, setSelection] = useState<{ scope: ViewerScope; index: number } | null>(null)
  const selected = selection?.scope === scope ? selection.index : 0
  const item = props.media[selected]
  const open = props.canOpen && selection?.scope === scope && item !== undefined

  useLayoutEffect(() => {
    live.current = scope
    return () => {
      if (live.current === scope) live.current = null
      releaseMediaViewer(scope.token)
    }
  }, [scope])

  const close = useCallback(() => {
    releaseMediaViewer(scope.token)
    if (live.current === scope) setSelection((current) => current?.scope === scope ? null : current)
  }, [scope])

  const openMedia = (index: number) => {
    const current = props.media[index]
    if (live.current !== scope || !props.canOpen || !props.canDisplay || !current || !isDelivered(current)) return
    if (!claimMediaViewer(scope.token)) return
    setSelection({ scope, index })
  }

  const move = (offset: number) => {
    if (live.current !== scope || !ownsMediaViewer(scope.token) || !props.canOpen) return
    setSelection((current) => current?.scope === scope
      ? { scope, index: Math.min(Math.max(current.index + offset, 0), count - 1) }
      : current)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || count < 2 || (event.target instanceof Element && event.target.closest("video"))) return
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault()
      move(event.key === "ArrowLeft" ? -1 : 1)
    }
  }

  if (count === 0) return null
  return (
    <>
      <div className={cn("grid gap-1", count === 1 ? "grid-cols-1" : "grid-cols-2", props.className)}>
        {props.media.map((media, index) => (
          <MediaTile
            key={index}
            item={media}
            single={count === 1}
            wide={count === 3 && index === 0}
            canDisplay={props.canDisplay}
            openLabel={t("post.media.openImage", { position: index + 1, total: count })}
            onOpen={props.canOpen ? () => openMedia(index) : undefined}
          />
        ))}
      </div>
      <ImmersiveOverlay open={open} onClose={close} label={t("post.media.viewer.title")}>
        {open && item ? (
          <div role="group" tabIndex={-1} aria-label={t("post.media.viewer.title")} onKeyDown={onKeyDown} className="flex h-full min-h-0 flex-col bg-background text-foreground">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
              <p role="status" aria-live="polite" aria-atomic="true" className="text-sm font-medium">
                {t("post.media.viewer.position", { position: selected + 1, total: count })}
              </p>
              <button type="button" onClick={close} aria-label={t("common.close")} className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-muted focus-visible:shadow-focus">
                <XIcon className="size-5" aria-hidden />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
              <ViewerMedia key={selected} item={item} canDisplay={props.canDisplay} />
            </div>
            {count > 1 ? (
              <div className="flex shrink-0 justify-between gap-3 border-t border-border px-4 py-2">
                <button type="button" onClick={() => move(-1)} disabled={selected === 0} aria-label={t("post.media.viewer.previous")} className="grid size-11 place-items-center rounded-md hover:bg-muted focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-55">
                  <ChevronLeftIcon className="size-5" aria-hidden />
                </button>
                <button type="button" onClick={() => move(1)} disabled={selected === count - 1} aria-label={t("post.media.viewer.next")} className="grid size-11 place-items-center rounded-md hover:bg-muted focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-55">
                  <ChevronRightIcon className="size-5" aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </ImmersiveOverlay>
    </>
  )
}

function MediaUnavailable(props: { item: PostMediaView; className?: string }) {
  const { t } = useDiasporaleT()
  const label = props.item.withheld === "scan_pending" ? t("post.media.scanPending") : props.item.withheld === "quarantined" ? t("post.media.quarantined") : t("post.media.unavailable")
  const Icon = props.item.withheld === "scan_pending" ? LoaderCircleIcon : props.item.withheld === "quarantined" ? ShieldAlertIcon : ImageOffIcon
  return (
    <div role="img" aria-label={label} className={cn("flex min-h-32 flex-col items-center justify-center gap-2 rounded-md bg-muted p-4 text-center text-[13px] text-muted-foreground", props.className)}>
      <Icon className={cn("size-5", props.item.withheld === "scan_pending" && "animate-spin motion-reduce:animate-none")} aria-hidden />
      <span aria-hidden>{label}</span>
    </div>
  )
}

function ViewerMedia(props: { item: PostMediaView; canDisplay: boolean }) {
  const { t } = useDiasporaleT()
  const { item } = props
  if (!props.canDisplay || !isDelivered(item)) return <MediaUnavailable item={item} className="w-full max-w-xl" />
  const size = item.width && item.height ? { width: item.width, height: item.height } : {}
  return item.kind === "video" ? (
    <video src={item.url ?? undefined} controls tabIndex={0} preload="metadata" playsInline aria-label={item.altText ?? t("post.media.video")} className="max-h-full max-w-full object-contain" {...size} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- URL délivrée par la garde, sans copie ni optimiseur
    <img src={item.url ?? undefined} alt={item.altText ?? t("post.media.photo")} decoding="async" className="max-h-full max-w-full object-contain" {...size} />
  )
}

function MediaTile(props: { item: PostMediaView; single: boolean; wide: boolean; canDisplay: boolean; openLabel: string; onOpen?: () => void }) {
  const { t } = useDiasporaleT()
  const video = useRef<HTMLVideoElement>(null)
  const { item } = props
  const size = item.width && item.height ? { width: item.width, height: item.height } : null
  // Une photo seule déclare sa taille ; sans dimensions connues, elle réserve un cadre 16:9 (pas de saut au chargement).
  const reserved = props.single && size === null
  const frame = cn(
    "overflow-hidden rounded-md bg-muted",
    props.wide && "col-span-2",
    props.single ? (reserved ? "aspect-video" : "") : props.wide ? "aspect-[2/1]" : "aspect-square",
  )

  if (!props.canDisplay || !isDelivered(item)) return <MediaUnavailable item={item} className={cn(frame, props.single && "aspect-video")} />

  if (item.kind === "video") {
    return (
      <div className={cn("min-w-0", props.wide && "col-span-2")}>
        <div className={frame}>
          <video
            ref={video}
            src={item.url ?? undefined}
            controls
            preload="metadata"
            playsInline
            aria-label={item.altText ?? t("post.media.video")}
            className={props.single && !reserved ? "max-h-[32rem] w-full" : "size-full object-cover"}
            {...(size ?? {})}
          />
        </div>
        {props.onOpen ? (
          <button type="button" onClick={() => { video.current?.pause(); props.onOpen?.() }} className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm hover:bg-muted focus-visible:shadow-focus">
            <Maximize2Icon className="size-4" aria-hidden />{t("post.media.expandVideo")}
          </button>
        ) : null}
      </div>
    )
  }

  const image = (
    <>
      {/* Fichier délivré par la garde du moteur (URL signée, durée bornée) : pas d'optimiseur d'images entre les deux. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- URL de la garde des fichiers, jamais réécrite */}
      <img
        src={item.url ?? undefined}
        alt={item.altText ?? t("post.media.photo")}
        loading="lazy"
        decoding="async"
        className={props.single && !reserved ? "h-auto max-h-[32rem] w-full object-contain" : reserved ? "size-full object-contain" : "size-full object-cover"}
        {...(size ?? {})}
      />
    </>
  )
  return props.onOpen ? (
    <button type="button" onClick={props.onOpen} aria-label={props.openLabel} className={cn(frame, "relative block min-w-0 focus-visible:shadow-focus")}>
      {image}
      <span aria-hidden className="absolute bottom-2 right-2 grid size-8 place-items-center rounded-full bg-card/90 text-foreground"><Maximize2Icon className="size-4" /></span>
    </button>
  ) : <div className={frame}>{image}</div>
}
