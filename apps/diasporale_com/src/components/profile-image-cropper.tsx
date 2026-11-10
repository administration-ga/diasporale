"use client"

import { Button, cn } from "@diasporale/features"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { RotateCcwIcon } from "lucide-react"
import { type PointerEvent, useId, useRef } from "react"

import {
  CROP_POSITION_MAX,
  CROP_ZOOM_MAX,
  CROP_ZOOM_MIN,
  CROP_ZOOM_STEP,
  cropPosition,
  cropPreviewStyle,
  cropRect,
  INITIAL_CROP,
  moveImage,
  placeCrop,
  PROFILE_IMAGE_FRAMES,
  zoomCrop,
  type CropState,
  type ImageSize,
  type ProfileImageFrameUsage,
} from "@/lib/profile-image-crop"

/** Le zoom se règle en pourcentage : 100 % = tout le cadre possible dans l'image. */
const PERCENT = 100
/** Un curseur de position sans marge (l'image remplit déjà le cadre sur cet axe) reste au milieu. */
const CENTERED = CROP_POSITION_MAX / 2

export interface ProfileImageCropperProps {
  readonly usage: ProfileImageFrameUsage
  /** L'adresse locale de l'image choisie (aperçu seulement : rien ne part d'ici). */
  readonly src: string | null
  readonly crop: CropState
  /** Dimensions affichées de l'image, connues une fois l'aperçu chargé. */
  readonly size: ImageSize | null
  /** L'aperçu n'a pas pu être lu par le navigateur. */
  readonly failed: boolean
  readonly disabled: boolean
  readonly onSize: (size: ImageSize) => void
  readonly onFailed: () => void
  readonly onChange: (crop: CropState) => void
}

/**
 * Le recadreur d'une image du profil (RP-01) : un rond pour la photo, un
 * bandeau pour la couverture. À la souris ou au doigt, on fait glisser l'image
 * dans le cadre ; au clavier, trois curseurs natifs (zoom, position
 * horizontale, position verticale) et « Recentrer ». Le cadre EST l'aperçu :
 * sa proportion et la place de l'image viennent des fonctions qui recadrent le
 * fichier envoyé (`@/lib/profile-image-crop`).
 */
export function ProfileImageCropper(props: ProfileImageCropperProps) {
  const { t } = useDiasporaleT()
  const id = useId()
  const drag = useRef<{ readonly pointerId: number; readonly x: number; readonly y: number; readonly crop: CropState } | null>(null)
  const frame = PROFILE_IMAGE_FRAMES[props.usage]
  const isAvatar = props.usage === "avatar"
  const size = props.size
  const rect = size === null ? null : cropRect(props.crop, frame.aspect, size.width, size.height)
  const ready = size !== null && rect !== null && !props.disabled && !props.failed
  const horizontal = size === null ? null : cropPosition(props.crop, frame.aspect, size.width, size.height, "x")
  const vertical = size === null ? null : cropPosition(props.crop, frame.aspect, size.width, size.height, "y")
  const hintId = `${id}-aide`

  const change = (next: (current: ImageSize) => CropState) => {
    if (size !== null && ready) props.onChange(next(size))
  }

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!ready) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, crop: props.crop }
  }
  const followDrag = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (start === null || start.pointerId !== event.pointerId) return
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width <= 0 || box.height <= 0) return
    change((current) => moveImage(start.crop, frame.aspect, current.width, current.height, (event.clientX - start.x) / box.width, (event.clientY - start.y) / box.height))
  }
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        role="img"
        aria-label={t(isAvatar ? "profile.images.crop.previewAvatar" : "profile.images.crop.previewCover")}
        aria-describedby={hintId}
        className={cn(
          "relative w-full touch-none select-none overflow-hidden bg-muted",
          isAvatar ? "max-w-64 self-center rounded-full" : "rounded-xl",
          ready ? "cursor-grab active:cursor-grabbing" : null,
        )}
        // La proportion vient de la constante qui recadre le fichier envoyé : l'aperçu ne peut pas s'en écarter.
        style={{ aspectRatio: frame.aspect }}
        onPointerDown={startDrag}
        onPointerMove={followDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {props.src !== null && !props.failed ? (
          <img
            src={props.src}
            alt=""
            draggable={false}
            onLoad={(event) => props.onSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            onError={props.onFailed}
            // Avant le chargement, `object-cover` centré EST le cadrage initial ; ensuite, la géométrie de la sortie.
            className={rect !== null && size !== null ? "pointer-events-none absolute max-w-none" : "pointer-events-none size-full object-cover"}
            style={rect !== null && size !== null ? cropPreviewStyle(rect, size.width, size.height) : undefined}
          />
        ) : null}
      </div>
      {props.failed ? <p role="alert" className="text-sm text-destructive">{t("errors.media_unreadable")}</p> : null}
      <p id={hintId} className="text-[13px] leading-snug text-muted-foreground">
        {t(isAvatar ? "profile.images.crop.hintAvatar" : "profile.images.crop.hintCover")}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <CropSlider
          id={`${id}-zoom`}
          label={t("profile.images.crop.zoom")}
          min={CROP_ZOOM_MIN * PERCENT}
          max={CROP_ZOOM_MAX * PERCENT}
          step={CROP_ZOOM_STEP * PERCENT}
          value={Math.round(props.crop.zoom * PERCENT)}
          disabled={!ready}
          onChange={(value) => change((current) => zoomCrop(props.crop, frame.aspect, current.width, current.height, value / PERCENT))}
        />
        <CropSlider
          id={`${id}-horizontal`}
          label={t("profile.images.crop.horizontal")}
          min={0}
          max={CROP_POSITION_MAX}
          step={1}
          value={horizontal ?? CENTERED}
          disabled={!ready || horizontal === null}
          onChange={(value) => change((current) => placeCrop(props.crop, frame.aspect, current.width, current.height, "x", value))}
        />
        <CropSlider
          id={`${id}-vertical`}
          label={t("profile.images.crop.vertical")}
          min={0}
          max={CROP_POSITION_MAX}
          step={1}
          value={vertical ?? CENTERED}
          disabled={!ready || vertical === null}
          onChange={(value) => change((current) => placeCrop(props.crop, frame.aspect, current.width, current.height, "y", value))}
        />
      </div>
      <Button type="button" variant="ghost" size="sm" className="self-start" disabled={!ready} onClick={() => props.onChange(INITIAL_CROP)}>
        <RotateCcwIcon aria-hidden />
        {t("profile.images.crop.reset")}
      </Button>
    </div>
  )
}

function CropSlider(props: {
  readonly id: string
  readonly label: string
  readonly min: number
  readonly max: number
  readonly step: number
  readonly value: number
  readonly disabled: boolean
  readonly onChange: (value: number) => void
}) {
  const { t } = useDiasporaleT()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={props.id} className="text-sm font-medium text-foreground">{props.label}</label>
      <input
        id={props.id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        disabled={props.disabled}
        aria-valuetext={t("profile.images.crop.percent", { value: props.value })}
        onChange={(event) => props.onChange(Number(event.currentTarget.value))}
        className="h-11 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-55"
      />
    </div>
  )
}
