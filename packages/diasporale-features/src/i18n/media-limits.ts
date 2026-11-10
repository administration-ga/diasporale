/**
 * Les bornes des médias dites par les textes (FD-02) : tirées des constantes
 * du domaine du moteur, jamais écrites dans une locale. Elles entrent comme
 * variables PAR DÉFAUT de l'instance i18n (`{{postVideoMaxMegabytes}}`…) : le
 * moteur change une borne, chaque phrase suit, sans une ligne de traduction.
 *
 * Des valeurs indépendantes de la langue (un nombre entier de mébioctets, des
 * noms de formats) : l'instance change de langue sans être recréée, et l'unité
 * (« Mo », « MB ») est dans la phrase de chaque langue.
 */
import { POST_IMAGE_MAX_BYTES, POST_IMAGE_MIME_TYPES, POST_VIDEO_MAX_BYTES, POST_VIDEO_MAX_DURATION_MS, POST_VIDEO_UPLOAD_MIME_TYPES } from "@antsia/social-domain/content"
import { UPLOAD_USAGES } from "@antsia/social-domain/uploadPolicy"

/** Base 1 024, comme les bornes du moteur (« 20 Mo » = 20 × 1 024 × 1 024 octets). */
const MEBIBYTE = 1024 * 1024

/** Le nom usuel d'un format ; à défaut, son sous-type en capitales. */
const FORMAT_NAMES: Readonly<Record<string, string>> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/gif": "GIF",
  "video/mp4": "MP4",
  "video/webm": "WebM",
  "video/quicktime": "MOV",
}

/** Les formats d'une liste de types, dans leur ordre : « JPEG, PNG, WebP ». */
export function formatNames(mimeTypes: readonly string[]): string {
  return mimeTypes.map((type) => FORMAT_NAMES[type] ?? (type.split("/")[1] ?? type).toUpperCase()).join(", ")
}

/** Un poids en mébioctets entiers, arrondi vers le bas : jamais une borne plus large que celle du moteur. */
export function megabytes(bytes: number): string {
  return String(Math.floor(bytes / MEBIBYTE))
}

/** Une durée en minutes entières, arrondie vers le bas : jamais une borne plus large que celle du moteur. */
export function minutes(durationMs: number): string {
  return String(Math.floor(durationMs / 60_000))
}

/** Les variables par défaut des textes de DIASPORALE qui disent une borne ou des formats. */
export const MEDIA_LIMIT_VARIABLES = {
  postImageMaxMegabytes: megabytes(POST_IMAGE_MAX_BYTES),
  postVideoMaxMegabytes: megabytes(POST_VIDEO_MAX_BYTES),
  postImageFormats: formatNames(POST_IMAGE_MIME_TYPES),
  // FD-02 : la liste d'ENVOI (MP4, WebM) ; le .mov des publications anciennes se lit encore, il ne s'envoie plus.
  postVideoFormats: formatNames(POST_VIDEO_UPLOAD_MIME_TYPES),
  // FD-02 : la durée maximale d'une vidéo de publication, proposée par le moteur (SD-03), à valider par le propriétaire.
  postVideoMaxMinutes: minutes(POST_VIDEO_MAX_DURATION_MS),
  profileImageFormats: formatNames(UPLOAD_USAGES.avatar.mimeTypes),
  profileAvatarMaxMegabytes: megabytes(UPLOAD_USAGES.avatar.maxBytes),
  profileCoverMaxMegabytes: megabytes(UPLOAD_USAGES.cover.maxBytes),
} as const satisfies Record<string, string>
