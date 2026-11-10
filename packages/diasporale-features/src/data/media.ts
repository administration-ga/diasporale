/**
 * Les médias d'une publication (EXF-DG-10), côté écran : LES règles du moteur
 * (`@antsia/social-domain/content` : mêmes types, mêmes poids, vidéo seule, texte
 * alternatif borné), dites en codes fermés ; et ce que le navigateur sait mesurer
 * d'un fichier avant de l'envoyer (dimensions, durée). Aucune règle n'est
 * réécrite ici : l'écran refuse exactement ce que le moteur refuserait.
 *
 * Une PHOTO ne part jamais telle qu'elle a été choisie (FD-01, décision du
 * 9/11/2026) : elle passe par le module partagé du moteur
 * (`@antsia/social-features/media-upload`, lot SD-02) — ré-encodée, réduite à
 * 2 048 px de plus grand côté, débarrassée de toute métadonnée (position GPS,
 * appareil). Un échec refuse la photo par un code fermé ; l'original n'est
 * jamais rendu. Le type, le poids et les dimensions déclarés sont ceux du
 * fichier PRÉPARÉ.
 *
 * Une VIDÉO (FD-02, lot SD-03 du moteur) : MP4 ou WebM seulement, la liste
 * d'envoi du moteur (`POST_VIDEO_UPLOAD_MIME_TYPES`) — le .mov de l'iPhone ne se
 * lit pas partout. Il est refusé AVANT tout envoi, avec la marche à suivre
 * (`media_video_format`) ; aucune conversion n'est promise : celle du moteur
 * (`prepareVideoForUpload`) joue la vidéo en temps réel, onglet visible, avec
 * progression et annulation, et rend ses refus en phrases — DIASPORALE ne la
 * branchera qu'avec cet écran. La durée mesurée est jugée par la règle du
 * moteur (`assertPostVideoDuration`), puis déclarée avec la vidéo.
 */
import {
  assertPostMedia,
  assertPostVideoDuration,
  POST_IMAGE_MIME_TYPES,
  POST_MEDIA_ALT_MAX_LENGTH,
  POST_MEDIA_MAX_COUNT,
  POST_VIDEO_UPLOAD_MIME_TYPES,
  type PostMediaInput,
  type PostMediaKind,
} from "@antsia/social-domain/content"
import { isDomainViolation } from "@antsia/social-domain/violation"
import { isVideoCandidateType } from "@antsia/social-features/features/video-upload/video-upload-policy"
import {
  IMAGE_UPLOAD_MAX_DIMENSION,
  IMAGE_UPLOAD_QUALITY,
  imageUploadPlan,
  isPreparableImageType,
  isPreparedImage,
  prepareImageForUpload,
  reencodeImage,
  type ImagePreparation,
  type ImagePreparationRefusal,
  type ImageRuntime,
  type PrepareImage,
} from "@antsia/social-features/media-upload"

import type { ActionErrorCode } from "./errors"
import type { ActionResult } from "./port"

export { POST_MEDIA_ALT_MAX_LENGTH, POST_MEDIA_MAX_COUNT }
export type { PostMediaInput, PostMediaKind }

/** Les types qu'accepte le sélecteur de fichiers du composeur : les photos, et les vidéos de la liste d'envoi du moteur. */
export const POST_MEDIA_ACCEPT = [...POST_IMAGE_MIME_TYPES, ...POST_VIDEO_UPLOAD_MIME_TYPES].join(",")

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
  POST_VIDEO_TOO_LONG: "media_video_too_long",
  UPLOAD_TYPE_NOT_ALLOWED: "media_type_invalid",
  UPLOAD_SIZE_OUT_OF_RANGE: "media_too_large",
  UPLOAD_MISMATCH: "media_upload_failed",
}

/** Le genre d'un fichier qu'une NOUVELLE publication peut porter ; `null` : refusé (le .mov compris). */
export function postMediaKindOf(mimeType: string): PostMediaKind | null {
  if ((POST_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return "image"
  if ((POST_VIDEO_UPLOAD_MIME_TYPES as readonly string[]).includes(mimeType)) return "video"
  return null
}

/**
 * Le refus d'un fichier hors des types admis : une vidéo d'un autre conteneur
 * (le .mov de l'iPhone, un .avi…) reçoit la marche à suivre
 * (`media_video_format`) ; tout autre fichier, le refus de type.
 */
export function unsupportedMediaRefusal(mimeType: string): ActionErrorCode {
  return isVideoCandidateType(mimeType) ? "media_video_format" : "media_type_invalid"
}

/** La durée d'une vidéo, jugée par la règle du moteur (`assertPostVideoDuration`) ; `null` : dans la borne, ou inconnue. */
export function postVideoDurationRefusal(durationMs: number | undefined): ActionErrorCode | null {
  try {
    assertPostVideoDuration([{ kind: "video", durationMs }])
    return null
  } catch (error) {
    if (isDomainViolation(error)) return MEDIA_RULE_CODES[error.code] ?? "unknown"
    throw error
  }
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
 * dire. Une mesure impossible n'empêche rien : le moteur ne l'exige pas. Une
 * vidéo mesurée au-delà de la borne de durée est refusée ici, avant tout envoi.
 */
export async function describeMediaFile(file: File): Promise<ActionResult<MediaFileFacts>> {
  const kind = postMediaKindOf(file.type)
  if (!kind) return { ok: false, code: unsupportedMediaRefusal(file.type) }
  const refusal = postMediaRefusal([{ kind, mimeType: file.type, sizeBytes: file.size }])
  if (refusal) return { ok: false, code: refusal }
  if (kind === "image") return { ok: true, value: { kind, mimeType: file.type, sizeBytes: file.size, ...(await measureImage(file)) } }
  const video = await measureVideo(file)
  const tooLong = postVideoDurationRefusal(video.durationMs)
  if (tooLong) return { ok: false, code: tooLong }
  return { ok: true, value: { kind, mimeType: file.type, sizeBytes: file.size, ...video } }
}

/**
 * Les refus de la préparation d'une photo (module du moteur), dits par les
 * codes fermés de DIASPORALE. Chacun veut dire : la photo n'est PAS envoyée.
 */
export const IMAGE_PREPARATION_CODES: Readonly<Record<ImagePreparationRefusal, ActionErrorCode>> = {
  "unsupported-type": "media_type_invalid",
  unreadable: "media_unreadable",
  "canvas-unavailable": "media_preparation_unavailable",
  "encoder-failed": "media_preparation_failed",
  "metadata-remaining": "media_metadata_remaining",
  "not-croppable": "media_not_croppable",
}

/** Une photo préparée : le fichier NEUF, et ses dimensions quand le module les connaît. */
export interface PreparedImageFile {
  readonly file: File
  readonly width?: number
  readonly height?: number
}

/**
 * Prépare une photo avant son dépôt, par le module partagé du moteur
 * (`prepareImageForUpload` par défaut, injectable pour les tests). Une photo
 * DÉJÀ sortie du module (`isPreparedImage` : recadrée par l'éditeur du profil,
 * par exemple) n'est pas ré-encodée une seconde fois. Échec fermé : le refus
 * rend un code, jamais l'original.
 */
export async function prepareImageFile(file: File, prepare: PrepareImage = prepareImageForUpload): Promise<ActionResult<PreparedImageFile>> {
  if (isPreparedImage(file)) return { ok: true, value: { file } }
  let result: ImagePreparation
  try {
    result = await prepare(file)
  } catch {
    result = { ok: false, refusal: "unreadable" }
  }
  if (!result.ok) return { ok: false, code: IMAGE_PREPARATION_CODES[result.refusal] }
  return {
    ok: true,
    value: {
      file: result.file,
      ...(result.width !== null && result.height !== null ? { width: result.width, height: result.height } : {}),
    },
  }
}

/**
 * Ce qui part au dépôt : une photo PRÉPARÉE, tout autre fichier (document,
 * vidéo) tel quel. Sert les envois qui mêlent pièces et photos (revendication
 * d'une page) et ceux d'une image seule (logo, bannière).
 */
export async function fileForDeposit(file: File, prepare?: PrepareImage): Promise<ActionResult<File>> {
  if (!isPreparableImageType(file.type)) return { ok: true, value: file }
  const prepared = await prepareImageFile(file, prepare)
  return prepared.ok ? { ok: true, value: prepared.value.file } : prepared
}

/**
 * Le fichier à déposer pour une publication, et ce qu'il dit de lui-même.
 *
 *   · une PHOTO est préparée (`prepareImageFile`) ; les règles du moteur sont
 *     jugées sur le fichier PRÉPARÉ, celui que le serveur recevra et relira ;
 *     ses dimensions sont celles de la sortie (mesurées, pour un GIF animé
 *     laissé tel quel) ;
 *   · une VIDÉO MP4 ou WebM part telle quelle (`describeMediaFile` : type,
 *     poids, durée mesurée et bornée) ; un autre conteneur est refusé avec la
 *     marche à suivre, sans conversion (voir l'en-tête).
 *
 * Le poids du fichier CHOISI est jugé avant, par le composeur (règles du
 * moteur sur l'ensemble des médias, avant tout envoi).
 */
export async function prepareMediaFile(
  file: File,
  prepare?: PrepareImage,
): Promise<ActionResult<{ readonly file: File; readonly facts: MediaFileFacts }>> {
  const kind = postMediaKindOf(file.type)
  if (!kind) return { ok: false, code: unsupportedMediaRefusal(file.type) }
  if (kind === "video") {
    const facts = await describeMediaFile(file)
    return facts.ok ? { ok: true, value: { file, facts: facts.value } } : facts
  }
  const prepared = await prepareImageFile(file, prepare)
  if (!prepared.ok) return prepared
  const output = prepared.value.file
  const outputKind = postMediaKindOf(output.type)
  if (outputKind !== "image") return { ok: false, code: "media_preparation_failed" }
  const refusal = postMediaRefusal([{ kind: outputKind, mimeType: output.type, sizeBytes: output.size }])
  if (refusal) return { ok: false, code: refusal }
  const size = prepared.value.width !== undefined && prepared.value.height !== undefined
    ? { width: prepared.value.width, height: prepared.value.height }
    : await measureImage(output)
  return { ok: true, value: { file: output, facts: { kind: outputKind, mimeType: output.type, sizeBytes: output.size, ...size } } }
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
 * Une photo pour la démonstration, qui la garde dans le stockage du navigateur
 * (aucun dépôt, aucun serveur) : la MÊME règle que le moteur — mêmes types
 * admis, même module de ré-encodage (`reencodeImage`, lot SD-02), même retrait
 * des métadonnées, mêmes refus, échec fermé —, sous un plan propre à ce
 * stockage de quelques Mo : JPEG, `maxSide` px au plus (jamais au-delà des
 * 2 048 px de la décision du 9/11). Une image animée y est figée sur sa
 * première image.
 */
export async function downscaleImage(
  file: File,
  maxSide: number,
  runtime?: ImageRuntime,
): Promise<ActionResult<{ readonly dataUrl: string; readonly width: number; readonly height: number }>> {
  if (imageUploadPlan(file.type).action === "refuse") return { ok: false, code: "media_type_invalid" }
  const plan = { targetType: "image/jpeg", maxDimension: Math.min(maxSide, IMAGE_UPLOAD_MAX_DIMENSION), quality: IMAGE_UPLOAD_QUALITY } as const
  let result: ImagePreparation
  try {
    result = await reencodeImage(file, plan, runtime)
  } catch {
    result = { ok: false, refusal: "unreadable" }
  }
  if (!result.ok) return { ok: false, code: IMAGE_PREPARATION_CODES[result.refusal] }
  const dataUrl = await dataUrlOf(result.file)
  if (dataUrl === null || result.width === null || result.height === null) return { ok: false, code: "media_upload_failed" }
  return { ok: true, value: { dataUrl, width: result.width, height: result.height } }
}

function dataUrlOf(file: Blob): Promise<string | null> {
  if (typeof FileReader === "undefined") return Promise.resolve(null)
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}
