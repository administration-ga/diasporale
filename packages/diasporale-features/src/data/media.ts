/**
 * Les médias d'une publication (EXF-DG-10), côté écran : LES règles du moteur
 * (`@antsia/social-domain/content` : mêmes types, mêmes poids, vidéo seule, texte
 * alternatif borné), dites en codes fermés ; et ce que le navigateur sait mesurer
 * d'un fichier avant de l'envoyer (dimensions, durée). Aucune règle n'est
 * réécrite ici : l'écran refuse exactement ce que le moteur refuserait.
 */
import {
  assertPostMedia,
  POST_IMAGE_MIME_TYPES,
  POST_MEDIA_ALT_MAX_LENGTH,
  POST_MEDIA_MAX_COUNT,
  POST_VIDEO_MIME_TYPES,
  type PostMediaInput,
  type PostMediaKind,
} from "@antsia/social-domain/content"
import { isDomainViolation } from "@antsia/social-domain/violation"

import type { ActionErrorCode } from "./errors"
import type { ActionResult } from "./port"

export { POST_MEDIA_ALT_MAX_LENGTH, POST_MEDIA_MAX_COUNT }
export type { PostMediaInput, PostMediaKind }

/** Les types qu'accepte le sélecteur de fichiers du composeur. */
export const POST_MEDIA_ACCEPT = [...POST_IMAGE_MIME_TYPES, ...POST_VIDEO_MIME_TYPES].join(",")

/**
 * Les règles des médias du moteur, et de son dépôt de fichiers, dites par
 * DIASPORALE : une seule table, lue par l'écran et par la traduction des refus
 * du moteur.
 */
export const MEDIA_RULE_CODES: Readonly<Record<string, ActionErrorCode>> = {
  POST_MEDIA_TOO_MANY: "media_too_many",
  POST_VIDEO_MUST_BE_ALONE: "media_video_alone",
  POST_MEDIA_MIME_INVALID: "media_type_invalid",
  POST_MEDIA_TOO_LARGE: "media_too_large",
  POST_MEDIA_ALT_TOO_LONG: "media_alt_too_long",
  UPLOAD_TYPE_NOT_ALLOWED: "media_type_invalid",
  UPLOAD_SIZE_OUT_OF_RANGE: "media_too_large",
  UPLOAD_MISMATCH: "media_upload_failed",
}

export function postMediaKindOf(mimeType: string): PostMediaKind | null {
  if ((POST_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return "image"
  if ((POST_VIDEO_MIME_TYPES as readonly string[]).includes(mimeType)) return "video"
  return null
}

/** Le refus des médias d'une publication, jugés ENSEMBLE par la règle du moteur ; `null` : recevables. */
export function postMediaRefusal(media: readonly PostMediaInput[]): ActionErrorCode | null {
  try {
    assertPostMedia(media)
    return null
  } catch (error) {
    if (isDomainViolation(error)) return MEDIA_RULE_CODES[error.code] ?? "unknown"
    throw error
  }
}

/** Ce qu'un fichier choisi dit de lui-même avant l'envoi. */
export interface MediaFileFacts {
  readonly kind: PostMediaKind
  readonly mimeType: string
  readonly sizeBytes: number
  readonly width?: number
  readonly height?: number
  readonly durationMs?: number
}

/**
 * Juge un fichier seul (type, poids), puis mesure ce que le navigateur sait en
 * dire. Une mesure impossible n'empêche rien : le moteur ne l'exige pas.
 */
export async function describeMediaFile(file: File): Promise<ActionResult<MediaFileFacts>> {
  const kind = postMediaKindOf(file.type)
  if (!kind) return { ok: false, code: "media_type_invalid" }
  const refusal = postMediaRefusal([{ kind, mimeType: file.type, sizeBytes: file.size }])
  if (refusal) return { ok: false, code: refusal }
  const measured = kind === "image" ? await measureImage(file) : await measureVideo(file)
  return { ok: true, value: { kind, mimeType: file.type, sizeBytes: file.size, ...measured } }
}

async function measureImage(file: File): Promise<{ width?: number; height?: number }> {
  if (typeof createImageBitmap !== "function") return {}
  try {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return {}
  }
}

/** Attente maximale des métadonnées d'une vidéo. */
const VIDEO_METADATA_TIMEOUT_MS = 5000

async function measureVideo(file: File): Promise<{ width?: number; height?: number; durationMs?: number }> {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return {}
  const url = URL.createObjectURL(file)
  const video = document.createElement("video")
  try {
    const loaded = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), VIDEO_METADATA_TIMEOUT_MS)
      video.preload = "metadata"
      video.onloadedmetadata = () => {
        clearTimeout(timer)
        resolve(true)
      }
      video.onerror = () => {
        clearTimeout(timer)
        resolve(false)
      }
      video.src = url
    })
    if (!loaded) return {}
    return {
      ...(video.videoWidth > 0 ? { width: video.videoWidth, height: video.videoHeight } : {}),
      ...(Number.isFinite(video.duration) ? { durationMs: Math.round(video.duration * 1000) } : {}),
    }
  } finally {
    video.removeAttribute("src")
    URL.revokeObjectURL(url)
  }
}

/**
 * Une image réduite à `maxSide` px au plus (JPEG), pour la démonstration, qui
 * garde ses données dans le stockage du navigateur. `null` : réduction impossible.
 */
export async function downscaleImage(file: File, maxSide: number): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) {
      bitmap.close()
      return null
    }
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.82), width, height }
  } catch {
    return null
  }
}
