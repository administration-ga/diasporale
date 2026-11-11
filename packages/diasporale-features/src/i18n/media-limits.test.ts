// @vitest-environment node
import { POST_IMAGE_MAX_BYTES, POST_IMAGE_MIME_TYPES, POST_VIDEO_MAX_BYTES, POST_VIDEO_MAX_DURATION_MS, POST_VIDEO_UPLOAD_MIME_TYPES } from "@antsia/social-domain/content"
import { UPLOAD_USAGES } from "@antsia/social-domain/uploadPolicy"
import { describe, expect, it } from "vitest"

import { getFixedT } from "./index"
import { formatNames, MEDIA_LIMIT_VARIABLES, megabytes, minutes } from "./media-limits"
import { DIASPORALE_LOCALES } from "./resources"

/**
 * FD-02 — aucun message ne cite une limite fausse : les bornes et les formats
 * des médias viennent des constantes du domaine du moteur, jamais d'un chiffre
 * écrit dans une locale.
 */
type Tree = { readonly [key: string]: string | Tree }

function phrase(locale: "fr" | "en", path: string): string {
  const value = path.split(".").reduce<string | Tree | undefined>((node, key) => (typeof node === "object" ? node[key] : undefined), DIASPORALE_LOCALES[locale] as Tree)
  if (typeof value !== "string") throw new Error(`phrase absente : ${path}`)
  return value
}

/** Les phrases qui disent une borne ou des formats de médias. */
const LIMIT_PHRASES = [
  "errors.media_too_large",
  "errors.media_type_invalid",
  "errors.media_video_format",
  "errors.media_video_too_long",
  "profile.images.requirements",
  "profile.images.format",
  "profile.images.inputTooLarge",
  "profile.images.tooLargeAvatar",
  "profile.images.tooLargeCover",
] as const

describe("FD-02 — les bornes des médias suivent le moteur", () => {
  it("les variables sont tirées des constantes du domaine", () => {
    expect(MEDIA_LIMIT_VARIABLES.postImageMaxMegabytes).toBe(String(POST_IMAGE_MAX_BYTES / (1024 * 1024)))
    expect(MEDIA_LIMIT_VARIABLES.postVideoMaxMegabytes).toBe(String(POST_VIDEO_MAX_BYTES / (1024 * 1024)))
    expect(MEDIA_LIMIT_VARIABLES.postImageFormats).toBe(formatNames(POST_IMAGE_MIME_TYPES))
    // La liste d'ENVOI du moteur (SD-03) : le .mov n'en est plus.
    expect(MEDIA_LIMIT_VARIABLES.postVideoFormats).toBe(formatNames(POST_VIDEO_UPLOAD_MIME_TYPES))
    expect(MEDIA_LIMIT_VARIABLES.postVideoFormats).not.toContain("MOV")
    expect(MEDIA_LIMIT_VARIABLES.postVideoMaxMinutes).toBe(String(POST_VIDEO_MAX_DURATION_MS / 60_000))
    expect(MEDIA_LIMIT_VARIABLES.profileAvatarMaxMegabytes).toBe(megabytes(UPLOAD_USAGES.avatar.maxBytes))
    expect(MEDIA_LIMIT_VARIABLES.profileCoverMaxMegabytes).toBe(megabytes(UPLOAD_USAGES.cover.maxBytes))
    // Une borne qui ne tombe pas sur un mébioctet entier est dite par défaut, jamais par excès.
    expect(megabytes(2.5 * 1024 * 1024)).toBe("2")
    expect(formatNames(["image/jpeg", "image/avif"])).toBe("JPEG, AVIF")
    // Une durée qui ne tombe pas sur une minute entière est dite par défaut, jamais par excès.
    expect(minutes(90_000)).toBe("1")
  })

  it("la borne de durée du moteur se dit en minutes entières : si elle change de forme, la phrase doit suivre", () => {
    expect(POST_VIDEO_MAX_DURATION_MS % 60_000).toBe(0)
    expect(POST_VIDEO_MAX_DURATION_MS).toBeGreaterThanOrEqual(60_000)
  })

  it.each(["fr", "en"] as const)("aucune phrase de borne n'écrit un chiffre en dur (%s)", (locale) => {
    for (const path of LIMIT_PHRASES) expect(phrase(locale, path), path).not.toMatch(/\d/)
  })

  it.each(["fr", "en"] as const)("le texte d'erreur dit la vraie borne de la vidéo et de la photo (%s)", (locale) => {
    const t = getFixedT(locale)
    const tooLarge = t("errors.media_too_large")
    expect(tooLarge).toContain(megabytes(POST_VIDEO_MAX_BYTES))
    expect(tooLarge).toContain(megabytes(POST_IMAGE_MAX_BYTES))
    // L'ancienne phrase disait « 100 Mo » alors que le moteur borne la vidéo à 60 Mio.
    expect(tooLarge).not.toContain("100")
    const typeInvalid = t("errors.media_type_invalid")
    for (const name of formatNames([...POST_IMAGE_MIME_TYPES, ...POST_VIDEO_UPLOAD_MIME_TYPES]).split(", ")) expect(typeInvalid).toContain(name)
    // Le .mov ne s'envoie plus : aucun texte ne le cite comme accepté.
    expect(typeInvalid).not.toContain("MOV")
    const format = t("errors.media_video_format")
    for (const name of formatNames(POST_VIDEO_UPLOAD_MIME_TYPES).split(", ")) expect(format).toContain(name)
    expect(format).not.toContain("MOV")
    // La durée dite est celle de la constante du moteur, jamais une valeur écrite.
    expect(t("errors.media_video_too_long")).toContain(minutes(POST_VIDEO_MAX_DURATION_MS))
    for (const path of LIMIT_PHRASES) expect(t(path), path).not.toMatch(/\{\{|\}\}/)
  })

  it("la phrase française garde l'espace insécable entre le nombre et l'unité", () => {
    expect(getFixedT("fr")("errors.media_too_large")).toContain(`${megabytes(POST_VIDEO_MAX_BYTES)} Mo`)
    expect(getFixedT("fr")("errors.media_video_too_long")).toContain(`${minutes(POST_VIDEO_MAX_DURATION_MS)} min`)
  })
})
