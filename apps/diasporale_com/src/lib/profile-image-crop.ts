/**
 * Le recadrage de la photo et de la couverture du profil (RP-01), hors de tout
 * écran : la géométrie du cadre, la position de l'aperçu, et la préparation du
 * fichier envoyé.
 *
 * ⚠️ FIDÉLITÉ : l'aperçu et le fichier envoyé sortent de la MÊME fonction
 * (`cropRect`), appliquée aux dimensions affichées de l'image (orientation de
 * l'appareil comprise — `<img>` pour l'aperçu, le décodeur du moteur pour la
 * sortie). Ce que la personne voit dans le cadre est ce qui part.
 *
 * La préparation est celle du module partagé du moteur
 * (`@antsia/social-features/media-upload`, lot SD-02) : `reencodeImage` sous le
 * plan de `prepareImageForUpload` (`imageUploadPlan` : format gardé dans sa
 * famille, qualité, aucune métadonnée, échec fermé). Le recadrage est appliqué
 * par le décodeur INJECTÉ (`croppingRuntime`) : l'image n'est encodée qu'une
 * fois, et le fichier rendu est inscrit au registre des images préparées.
 * Le moteur n'exporte pas encore de recadreur (lot PF-03) : celui-ci est local.
 */
import { AVATAR_MIME_TYPES, POST_IMAGE_MAX_BYTES } from "@antsia/social-domain/content"
import { UPLOAD_USAGES } from "@antsia/social-domain/uploadPolicy"
import {
  browserImageRuntime,
  IMAGE_UPLOAD_MAX_DIMENSION,
  imageUploadPlan,
  reencodeImage,
  type ImagePreparation,
  type ImagePreparationRefusal,
  type ImageRuntime,
} from "@antsia/social-features/media-upload"

export type ProfileImageFrameUsage = "avatar" | "cover"

/**
 * Le cadre de chaque image : un rond pour la photo, un bandeau pour la
 * couverture (affichée centrée, `background-size: cover`, sur toute la largeur
 * de la fiche). Le plus grand côté envoyé reste sous les 2 048 px de la
 * décision du 9/11/2026 ; la photo s'arrête à 1 024 px : elle s'affiche dans un
 * rond de 160 px au plus, et une photo PNG de 2 048 px dépasserait la borne de
 * l'usage `avatar` du moteur.
 */
export const PROFILE_IMAGE_FRAMES = {
  avatar: { aspect: 1, maxDimension: 1024 },
  cover: { aspect: 4, maxDimension: IMAGE_UPLOAD_MAX_DIMENSION },
} as const satisfies Record<ProfileImageFrameUsage, { aspect: number; maxDimension: number }>

/** Les types admis : ceux des usages `avatar` et `cover` du moteur (JPEG, PNG, WebP). */
export const PROFILE_IMAGE_MIME_TYPES: Readonly<Record<ProfileImageFrameUsage, readonly string[]>> = {
  avatar: AVATAR_MIME_TYPES,
  cover: UPLOAD_USAGES.cover.mimeTypes,
}

/**
 * Le poids du fichier CHOISI : la borne d'une photo du moteur
 * (`POST_IMAGE_MAX_BYTES`), comme le composeur. Le fichier ENVOYÉ, recadré et
 * allégé, est jugé ensuite à la borne de son usage.
 */
export const PROFILE_IMAGE_INPUT_MAX_BYTES = POST_IMAGE_MAX_BYTES

/** Le poids du fichier envoyé : la borne de l'usage du moteur (5 Mo la photo, 10 Mo la couverture). */
export const PROFILE_IMAGE_MAX_BYTES: Readonly<Record<ProfileImageFrameUsage, number>> = {
  avatar: UPLOAD_USAGES.avatar.maxBytes,
  cover: UPLOAD_USAGES.cover.maxBytes,
}

export const CROP_ZOOM_MIN = 1
export const CROP_ZOOM_MAX = 4
export const CROP_ZOOM_STEP = 0.1
/** Les curseurs de position vont de 0 (bord gauche ou haut) à 100 (bord droit ou bas). */
export const CROP_POSITION_MAX = 100

/**
 * Le cadrage : le zoom (1 = le plus grand cadre contenu dans l'image) et le
 * centre du cadre, en fraction de la largeur et de la hauteur de l'image.
 */
export interface CropState {
  readonly zoom: number
  readonly centerX: number
  readonly centerY: number
}

/** Le cadrage d'une image qu'on vient de choisir : tout le cadre possible, centré. */
export const INITIAL_CROP: CropState = { zoom: 1, centerX: 0.5, centerY: 0.5 }

/** Les dimensions affichées d'une image (orientation de l'appareil appliquée). */
export interface ImageSize {
  readonly width: number
  readonly height: number
}

/** Un rectangle en pixels de l'image (dimensions affichées). */
export interface CropRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const finiteOr = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)
const validSize = (width: number, height: number) => Number.isFinite(width) && Number.isFinite(height) && width >= 1 && height >= 1

/** Le plus grand cadre de proportion `aspect` contenu dans l'image (zoom 1). */
function largestFrame(aspect: number, width: number, height: number): { width: number; height: number } {
  return width / height > aspect ? { width: height * aspect, height } : { width, height: width / aspect }
}

/** La demi-taille du cadre, en fraction de l'image : les bornes du centre. */
function halfExtent(zoom: number, aspect: number, width: number, height: number): { x: number; y: number } {
  const frame = largestFrame(aspect, width, height)
  return { x: frame.width / zoom / 2 / width, y: frame.height / zoom / 2 / height }
}

/** Le cadrage ramené dans ses bornes : zoom permis, cadre tout entier dans l'image. */
export function clampCrop(state: CropState, aspect: number, width: number, height: number): CropState {
  const zoom = clamp(finiteOr(state.zoom, CROP_ZOOM_MIN), CROP_ZOOM_MIN, CROP_ZOOM_MAX)
  if (!validSize(width, height)) return { zoom, centerX: 0.5, centerY: 0.5 }
  const half = halfExtent(zoom, aspect, width, height)
  return {
    zoom,
    centerX: clamp(finiteOr(state.centerX, 0.5), half.x, 1 - half.x),
    centerY: clamp(finiteOr(state.centerY, 0.5), half.y, 1 - half.y),
  }
}

/** Le rectangle recadré, en pixels de l'image ; `null` : dimensions invalides. */
export function cropRect(state: CropState, aspect: number, width: number, height: number): CropRect | null {
  if (!validSize(width, height)) return null
  const crop = clampCrop(state, aspect, width, height)
  const frame = largestFrame(aspect, width, height)
  const cropWidth = frame.width / crop.zoom
  const cropHeight = frame.height / crop.zoom
  return { x: crop.centerX * width - cropWidth / 2, y: crop.centerY * height - cropHeight / 2, width: cropWidth, height: cropHeight }
}

/**
 * Déplace l'IMAGE dans le cadre, d'une fraction de la taille du cadre (un
 * glissé de la largeur du cadre vers la droite vaut `dx = 1`) : le cadre, lui,
 * part dans l'autre sens.
 */
export function moveImage(state: CropState, aspect: number, width: number, height: number, dx: number, dy: number): CropState {
  const rect = cropRect(state, aspect, width, height)
  if (rect === null) return state
  const crop = clampCrop(state, aspect, width, height)
  return clampCrop(
    { zoom: crop.zoom, centerX: crop.centerX - (dx * rect.width) / width, centerY: crop.centerY - (dy * rect.height) / height },
    aspect,
    width,
    height,
  )
}

/** Change le zoom en gardant le centre du cadre (ramené dans ses bornes). */
export function zoomCrop(state: CropState, aspect: number, width: number, height: number, zoom: number): CropState {
  return clampCrop({ ...state, zoom }, aspect, width, height)
}

/**
 * La position du cadre sur un axe, de 0 à `CROP_POSITION_MAX` dans la marge
 * qui lui reste ; `null` : l'image ne laisse aucune marge sur cet axe (le
 * curseur se désactive).
 */
export function cropPosition(state: CropState, aspect: number, width: number, height: number, axis: "x" | "y"): number | null {
  if (!validSize(width, height)) return null
  const crop = clampCrop(state, aspect, width, height)
  const half = halfExtent(crop.zoom, aspect, width, height)[axis]
  const room = 1 - 2 * half
  if (room <= 1e-6) return null
  const center = axis === "x" ? crop.centerX : crop.centerY
  return Math.round(((center - half) / room) * CROP_POSITION_MAX)
}

/** Place le cadre sur un axe, d'après la position d'un curseur (0 à `CROP_POSITION_MAX`). */
export function placeCrop(state: CropState, aspect: number, width: number, height: number, axis: "x" | "y", position: number): CropState {
  if (!validSize(width, height)) return state
  const crop = clampCrop(state, aspect, width, height)
  const half = halfExtent(crop.zoom, aspect, width, height)[axis]
  const center = half + (clamp(finiteOr(position, 50), 0, CROP_POSITION_MAX) / CROP_POSITION_MAX) * (1 - 2 * half)
  return clampCrop(axis === "x" ? { ...crop, centerX: center } : { ...crop, centerY: center }, aspect, width, height)
}

/**
 * La place de l'image dans le cadre d'aperçu, en pourcentages du cadre : la
 * même géométrie que le fichier envoyé (`cropRect`).
 */
export function cropPreviewStyle(rect: CropRect, width: number, height: number): { width: string; height: string; left: string; top: string } {
  const percent = (value: number) => `${Number(value.toFixed(4))}%`
  return {
    width: percent((100 * width) / rect.width),
    height: percent((100 * height) / rect.height),
    left: percent((-100 * rect.x) / rect.width),
    top: percent((-100 * rect.y) / rect.height),
  }
}

/**
 * Le décodeur du moteur, recadré : l'image décodée se présente avec les
 * dimensions du CADRE, et le dessin sur le canvas de sortie n'en garde que le
 * cadre (l'image entière est dessinée décalée et mise à l'échelle ; le canvas
 * coupe le reste). Un seul canvas, à la taille de sortie ; un canvas ou un
 * contexte absent reste un refus du module (`canvas-unavailable`).
 */
export function croppingRuntime(state: CropState, aspect: number, base: ImageRuntime = browserImageRuntime): ImageRuntime {
  let placement: { readonly rect: CropRect; readonly width: number; readonly height: number } | null = null
  return {
    async decode(file) {
      const decoded = await base.decode(file)
      const rect = cropRect(state, aspect, decoded.width, decoded.height)
      if (rect === null) {
        decoded.release()
        throw new Error("crop outside image")
      }
      placement = { rect, width: decoded.width, height: decoded.height }
      return { width: rect.width, height: rect.height, source: decoded.source, release: () => decoded.release() }
    },
    createCanvas(width, height) {
      const current = placement
      // Échec fermé : sans cadrage connu, aucun canvas — jamais une image non recadrée.
      if (current === null) return null
      const canvas = base.createCanvas(width, height)
      if (canvas === null) return null
      return {
        getContext(contextId) {
          const context = canvas.getContext(contextId)
          if (context === null) return null
          return {
            get imageSmoothingEnabled() {
              return context.imageSmoothingEnabled
            },
            set imageSmoothingEnabled(value: boolean) {
              context.imageSmoothingEnabled = value
            },
            get imageSmoothingQuality() {
              return context.imageSmoothingQuality
            },
            set imageSmoothingQuality(value: ImageSmoothingQuality) {
              context.imageSmoothingQuality = value
            },
            drawImage(image, dx, dy, dw, dh) {
              const scaleX = dw / current.rect.width
              const scaleY = dh / current.rect.height
              context.drawImage(image, dx - current.rect.x * scaleX, dy - current.rect.y * scaleY, current.width * scaleX, current.height * scaleY)
            },
          }
        },
        toBlob: (callback, type, quality) => canvas.toBlob(callback, type, quality),
      }
    },
  }
}

/** Le refus d'une image du profil : celui du module du moteur, ou un fichier préparé encore trop lourd. */
export type ProfileImageRefusal = ImagePreparationRefusal | "too-large"

export type ProfileImagePreparation = { readonly ok: true; readonly file: File } | { readonly ok: false; readonly refusal: ProfileImageRefusal }

/**
 * Recadre et prépare une image du profil : un fichier NEUF, sans métadonnées,
 * inscrit au registre des images préparées — jamais l'original. Échec fermé.
 */
export async function prepareProfileImage(
  file: File,
  usage: ProfileImageFrameUsage,
  state: CropState,
  base: ImageRuntime = browserImageRuntime,
): Promise<ProfileImagePreparation> {
  if (!PROFILE_IMAGE_MIME_TYPES[usage].includes(file.type)) return { ok: false, refusal: "unsupported-type" }
  const decision = imageUploadPlan(file.type)
  if (decision.action !== "reencode") return { ok: false, refusal: "unsupported-type" }
  const frame = PROFILE_IMAGE_FRAMES[usage]
  const plan = { ...decision.plan, maxDimension: Math.min(decision.plan.maxDimension ?? IMAGE_UPLOAD_MAX_DIMENSION, frame.maxDimension) }
  let result: ImagePreparation
  try {
    result = await reencodeImage(file, plan, croppingRuntime(state, frame.aspect, base))
  } catch {
    result = { ok: false, refusal: "unreadable" }
  }
  if (!result.ok) return result
  if (result.file.size > PROFILE_IMAGE_MAX_BYTES[usage]) return { ok: false, refusal: "too-large" }
  return { ok: true, file: result.file }
}
