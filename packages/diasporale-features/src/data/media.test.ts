import { POST_VIDEO_MAX_BYTES, POST_VIDEO_MAX_DURATION_MS } from "@antsia/social-domain/content"
import { jpegHasGpsMetadata, listImageMetadata } from "@antsia/social-domain/imageMetadata"
import { IMAGE_UPLOAD_QUALITY, isPreparedImage, type PrepareImage } from "@antsia/social-features/media-upload"
import { fakeImageRuntime, TEST_JPEG_WITH_GPS_BYTES, testPrepareImage } from "@antsia/social-features/tests/image-runtime"
import { afterEach, describe, expect, it, vi } from "vitest"

import { getFixedT } from "../i18n"
import { ACTION_ERROR_CODES } from "./errors"
import {
  describeMediaFile,
  downscaleImage,
  fileForDeposit,
  IMAGE_PREPARATION_CODES,
  MEDIA_RULE_CODES,
  POST_MEDIA_ACCEPT,
  postMediaKindOf,
  postMediaRefusal,
  prepareImageFile,
  prepareMediaFile,
  postVideoDurationRefusal,
  unsupportedMediaRefusal,
} from "./media"

function file(bytes: Uint8Array, name: string, type: string): File {
  return new File([bytes as Uint8Array<ArrayBuffer>], name, { type })
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

/** Une photo de téléphone FICTIVE, avec sa position GPS (valeurs inventées). */
const phonePhoto = () => file(TEST_JPEG_WITH_GPS_BYTES, "IMG_0001.jpg", "image/jpeg")
/** Le pire encodeur : il recopierait le bloc EXIF de la source. Le module ne s'y fie pas. */
const leakyEncoder = { output: { bytes: TEST_JPEG_WITH_GPS_BYTES, type: "image/jpeg" } } as const

/** Un GIF 1×1 réel, animé d'une boucle, avec un commentaire et un paquet XMP (même forme que le test du moteur). */
function gifWithMetadata(): Uint8Array {
  const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0))
  return Uint8Array.from([
    ...ascii("GIF89a"), 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00,
    0x21, 0xff, 0x0b, ...ascii("NETSCAPE2.0"), 0x03, 0x01, 0x00, 0x00, 0x00,
    0x21, 0xfe, 0x0a, ...ascii("Libreville"), 0x00,
    0x21, 0xff, 0x0b, ...ascii("XMP DataXMP"), 0x05, ...ascii("<x:x>"), 0x00,
    0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00,
    0x3b,
  ])
}

/** La mesure d'une vidéo attend ses métadonnées (5 s au plus) : `jsdom` ne les donne jamais, l'horloge est avancée. */
async function measuredVideo<T>(work: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(5000)
  return await work
}

afterEach(() => {
  vi.useRealTimers()
})

describe("médias d'une publication — les règles du moteur, dites par DIASPORALE", () => {
  it("le type dit la nature du média : photo, vidéo, ou refus", () => {
    expect(postMediaKindOf("image/webp")).toBe("image")
    expect(postMediaKindOf("video/mp4")).toBe("video")
    expect(postMediaKindOf("video/webm")).toBe("video")
    // FD-02 (SD-03 du moteur) : une nouvelle publication n'accepte plus le .mov.
    expect(postMediaKindOf("video/quicktime")).toBeNull()
    expect(postMediaKindOf("application/pdf")).toBeNull()
    expect(POST_MEDIA_ACCEPT.split(",")).toEqual(expect.arrayContaining(["image/jpeg", "image/gif", "video/mp4", "video/webm"]))
    expect(POST_MEDIA_ACCEPT.split(",")).not.toContain("video/quicktime")
  })

  it("quatre photos au plus, une vidéo seule, un texte alternatif borné : chaque refus a son code", () => {
    const photo = { kind: "image" as const, mimeType: "image/jpeg", sizeBytes: 1000 }
    const video = { kind: "video" as const, mimeType: "video/mp4", sizeBytes: 1000 }
    expect(postMediaRefusal([photo, photo, photo, photo])).toBeNull()
    expect(postMediaRefusal([video])).toBeNull()
    expect(postMediaRefusal([photo, photo, photo, photo, photo])).toBe("media_too_many")
    expect(postMediaRefusal([video, photo])).toBe("media_video_alone")
    expect(postMediaRefusal([{ ...photo, mimeType: "image/bmp" }])).toBe("media_type_invalid")
    expect(postMediaRefusal([{ ...photo, sizeBytes: 21 * 1024 * 1024 }])).toBe("media_too_large")
    expect(postMediaRefusal([{ ...photo, altText: "x".repeat(301) }])).toBe("media_alt_too_long")
  })

  it("la table des règles ne rend que des codes fermés de DIASPORALE", () => {
    for (const code of Object.values(MEDIA_RULE_CODES)) expect(ACTION_ERROR_CODES).toContain(code)
  })

  it("un fichier se juge avant l'envoi ; sans mesure possible, il passe sans dimensions", async () => {
    expect(await describeMediaFile(new File(["%PDF"], "dossier.pdf", { type: "application/pdf" }))).toEqual({ ok: false, code: "media_type_invalid" })
    const heavy = new File(["x"], "lourde.jpg", { type: "image/jpeg" })
    Object.defineProperty(heavy, "size", { value: 21 * 1024 * 1024 })
    expect(await describeMediaFile(heavy)).toEqual({ ok: false, code: "media_too_large" })
    expect(await describeMediaFile(new File(["png"], "photo.png", { type: "image/png" }))).toEqual({
      ok: true,
      value: { kind: "image", mimeType: "image/png", sizeBytes: 3 },
    })
  })
})

describe("FD-01 — une photo part nettoyée et allégée, jamais telle qu'elle a été choisie", () => {
  it("un JPEG portant un bloc GPS sort sans segment EXIF ; type, poids et dimensions déclarés sont ceux du fichier préparé", async () => {
    const source = phonePhoto()
    expect(jpegHasGpsMetadata(TEST_JPEG_WITH_GPS_BYTES)).toBe(true)
    const prepare = testPrepareImage({ width: 4032, height: 3024, ...leakyEncoder })

    const result = await prepareMediaFile(source, prepare)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const sent = result.value.file
    expect(sent).not.toBe(source)
    expect(isPreparedImage(sent)).toBe(true)
    const bytes = await bytesOf(sent)
    expect(jpegHasGpsMetadata(bytes)).toBe(false)
    expect(listImageMetadata(bytes, "image/jpeg")).toEqual([])
    // SOI puis l'en-tête JFIF : plus aucun APP1 (EXIF) entre eux.
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0xff, 0xd8, 0xff, 0xe0])
    expect(prepare.runtime.canvases).toEqual([{ width: 2048, height: 1536 }])
    expect(prepare.runtime.encodings).toEqual([{ type: "image/jpeg", quality: IMAGE_UPLOAD_QUALITY }])
    expect(result.value.facts).toEqual({ kind: "image", mimeType: "image/jpeg", sizeBytes: sent.size, width: 2048, height: 1536 })
    expect(result.value.facts.sizeBytes).toBeLessThan(source.size)
  })

  it("refus si le canvas manque : un code fermé, aucun fichier rendu", async () => {
    expect(await prepareMediaFile(phonePhoto(), testPrepareImage({ canvas: "absent" }))).toEqual({ ok: false, code: "media_preparation_unavailable" })
    expect(await prepareMediaFile(phonePhoto(), testPrepareImage({ canvas: "no-context" }))).toEqual({ ok: false, code: "media_preparation_unavailable" })
  })

  it("un fichier illisible est refusé avec une phrase traduite, en français comme en anglais", async () => {
    const result = await prepareMediaFile(phonePhoto(), testPrepareImage({ decodeFails: true }))
    expect(result).toEqual({ ok: false, code: "media_unreadable" })
    for (const locale of ["fr", "en"] as const) {
      const t = getFixedT(locale)
      for (const code of Object.values(IMAGE_PREPARATION_CODES)) {
        expect(ACTION_ERROR_CODES).toContain(code)
        expect(t(`errors.${code}`)).not.toBe(`errors.${code}`)
      }
    }
    expect(getFixedT("fr")("errors.media_unreadable")).toMatch(/ne sera pas envoyée/)
  })

  it("un encodeur muet ou une préparation qui lève refusent la photo : l'original ne part jamais", async () => {
    expect(await prepareMediaFile(phonePhoto(), testPrepareImage({ output: null }))).toEqual({ ok: false, code: "media_preparation_failed" })
    const throwing: PrepareImage = () => Promise.reject(new Error("panne"))
    expect(await prepareImageFile(phonePhoto(), throwing)).toEqual({ ok: false, code: "media_unreadable" })
  })

  it("une image déjà sortie du module n'est pas ré-encodée une seconde fois", async () => {
    const first = await prepareImageFile(phonePhoto(), testPrepareImage())
    if (!first.ok) throw new Error("préparation refusée")
    const again = vi.fn<PrepareImage>()
    expect(await prepareImageFile(first.value.file, again)).toEqual({ ok: true, value: { file: first.value.file } })
    expect(again).not.toHaveBeenCalled()
  })

  it("le GIF animé suit la règle du module : animation intacte, métadonnées retirées, aucun canvas", async () => {
    const gif = gifWithMetadata()
    expect(listImageMetadata(gif, "image/gif")?.length).toBeGreaterThan(0)
    const prepare = testPrepareImage()
    const result = await prepareMediaFile(file(gif, "anime.gif", "image/gif"), prepare)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.facts.mimeType).toBe("image/gif")
    expect(listImageMetadata(await bytesOf(result.value.file), "image/gif")).toEqual([])
    expect(prepare.runtime.canvases).toEqual([])
  })

  it("une vidéo part telle quelle, jugée sur le fichier choisi", async () => {
    vi.useFakeTimers()
    const clip = new File(["clip"], "clip.mp4", { type: "video/mp4" })
    const prepare = vi.fn<PrepareImage>()
    const result = await measuredVideo(prepareMediaFile(clip, prepare))
    expect(result).toEqual({ ok: true, value: { file: clip, facts: { kind: "video", mimeType: "video/mp4", sizeBytes: 4 } } })
    expect(prepare).not.toHaveBeenCalled()
    expect(await prepareMediaFile(new File(["%PDF"], "dossier.pdf", { type: "application/pdf" }), prepare)).toEqual({ ok: false, code: "media_type_invalid" })
  })

  it("au dépôt d'une pièce : un document part tel quel, une photo part préparée", async () => {
    const pdf = new File(["%PDF"], "statuts.pdf", { type: "application/pdf" })
    expect(await fileForDeposit(pdf, testPrepareImage())).toEqual({ ok: true, value: pdf })
    const photo = await fileForDeposit(phonePhoto(), testPrepareImage(leakyEncoder))
    expect(photo.ok && isPreparedImage(photo.value)).toBe(true)
    expect(await fileForDeposit(phonePhoto(), testPrepareImage({ canvas: "absent" }))).toEqual({ ok: false, code: "media_preparation_unavailable" })
  })

  it("la démonstration converge sur la même règle : module du moteur, JPEG sans métadonnées, refus fermés, aucun dépôt", async () => {
    const runtime = fakeImageRuntime({ width: 4032, height: 3024, ...leakyEncoder })
    const result = await downscaleImage(phonePhoto(), 1280, runtime)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ width: 1280, height: 960 })
    expect(runtime.canvases).toEqual([{ width: 1280, height: 960 }])
    expect(runtime.encodings).toEqual([{ type: "image/jpeg", quality: IMAGE_UPLOAD_QUALITY }])
    const [prefix, payload] = result.value.dataUrl.split(",")
    expect(prefix).toBe("data:image/jpeg;base64")
    const stored = Uint8Array.from(atob(payload ?? ""), (char) => char.charCodeAt(0))
    expect(jpegHasGpsMetadata(stored)).toBe(false)
    expect(listImageMetadata(stored, "image/jpeg")).toEqual([])
    expect(await downscaleImage(phonePhoto(), 1280, fakeImageRuntime({ canvas: "absent" }))).toEqual({ ok: false, code: "media_preparation_unavailable" })
    expect(await downscaleImage(phonePhoto(), 1280, fakeImageRuntime({ decodeFails: true }))).toEqual({ ok: false, code: "media_unreadable" })
    expect(await downscaleImage(new File(["%PDF"], "dossier.pdf", { type: "application/pdf" }), 1280, runtime)).toEqual({ ok: false, code: "media_type_invalid" })
  })
})

describe("FD-02 — une vidéo trop lourde est refusée avant l'envoi, à la borne du moteur", () => {
  it("la borne est celle du domaine : à la limite, recevable ; un octet de plus, refusée", async () => {
    vi.useFakeTimers()
    const atLimit = new File(["v"], "limite.mp4", { type: "video/mp4" })
    Object.defineProperty(atLimit, "size", { value: POST_VIDEO_MAX_BYTES })
    const heavy = new File(["v"], "lourde.mp4", { type: "video/mp4" })
    Object.defineProperty(heavy, "size", { value: POST_VIDEO_MAX_BYTES + 1 })
    expect(postMediaRefusal([{ kind: "video", mimeType: "video/mp4", sizeBytes: POST_VIDEO_MAX_BYTES }])).toBeNull()
    expect(await prepareMediaFile(heavy)).toEqual({ ok: false, code: "media_too_large" })
    expect((await measuredVideo(prepareMediaFile(atLimit))).ok).toBe(true)
  })
})

/**
 * Un navigateur qui sait lire les métadonnées d'une vidéo : jsdom n'a pas de
 * décodeur ; on donne à l'élément `<video>` la durée voulue, et l'évènement
 * `loadedmetadata` arrive dès que la source est posée.
 */
function fakeVideoMetadata(durationSeconds: number): () => void {
  const urlStatics = URL as unknown as { createObjectURL?: (blob: Blob) => string; revokeObjectURL?: (url: string) => void }
  const original = { create: urlStatics.createObjectURL, revoke: urlStatics.revokeObjectURL }
  Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: () => "blob:video-de-test" })
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: () => undefined })
  const create = document.createElement.bind(document)
  const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string, options?: ElementCreationOptions) => {
    const element = create(tag, options)
    if (element instanceof HTMLVideoElement) {
      Object.defineProperty(element, "duration", { value: durationSeconds })
      Object.defineProperty(element, "videoWidth", { value: 1280 })
      Object.defineProperty(element, "videoHeight", { value: 720 })
      Object.defineProperty(element, "src", {
        configurable: true,
        get: () => "",
        set: () => queueMicrotask(() => element.onloadedmetadata?.call(element, new Event("loadedmetadata"))),
      })
    }
    return element
  })
  return () => {
    spy.mockRestore()
    Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: original.create })
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: original.revoke })
  }
}

describe("FD-02 — une vidéo lisible partout et bornée, refusée avant l'envoi", () => {
  it("un .mov (ou tout autre conteneur vidéo) reçoit la marche à suivre ; un autre fichier, le refus de type", async () => {
    expect(unsupportedMediaRefusal("video/quicktime")).toBe("media_video_format")
    expect(unsupportedMediaRefusal("video/x-msvideo")).toBe("media_video_format")
    expect(unsupportedMediaRefusal("application/pdf")).toBe("media_type_invalid")
    const mov = new File(["mov"], "IMG_0412.MOV", { type: "video/quicktime" })
    const prepare = vi.fn<PrepareImage>()
    // Refusé avant tout envoi, au dépôt (moteur) comme à la démonstration : aucune préparation, aucun dépôt.
    expect(await prepareMediaFile(mov, prepare)).toEqual({ ok: false, code: "media_video_format" })
    expect(await describeMediaFile(mov)).toEqual({ ok: false, code: "media_video_format" })
    expect(prepare).not.toHaveBeenCalled()
  })

  it("la durée est jugée par la règle du moteur : à la borne, recevable ; au-delà, refusée ; inconnue, elle passe", () => {
    expect(postVideoDurationRefusal(POST_VIDEO_MAX_DURATION_MS)).toBeNull()
    expect(postVideoDurationRefusal(POST_VIDEO_MAX_DURATION_MS + 1)).toBe("media_video_too_long")
    expect(postVideoDurationRefusal(undefined)).toBeNull()
    // Le refus du serveur (POST_VIDEO_TOO_LONG) se dit par le même code fermé.
    expect(MEDIA_RULE_CODES.POST_VIDEO_TOO_LONG).toBe("media_video_too_long")
    expect(ACTION_ERROR_CODES).toContain("media_video_too_long")
    expect(ACTION_ERROR_CODES).toContain("media_video_format")
  })

  it("une vidéo mesurée au-delà de la borne de durée est refusée avant le dépôt ; à la borne, elle part avec sa durée", async () => {
    const tooLong = fakeVideoMetadata(POST_VIDEO_MAX_DURATION_MS / 1000 + 1)
    try {
      const clip = new File(["clip"], "longue.mp4", { type: "video/mp4" })
      expect(await describeMediaFile(clip)).toEqual({ ok: false, code: "media_video_too_long" })
      expect(await prepareMediaFile(clip)).toEqual({ ok: false, code: "media_video_too_long" })
    } finally {
      tooLong()
    }
    const atLimit = fakeVideoMetadata(POST_VIDEO_MAX_DURATION_MS / 1000)
    try {
      const clip = new File(["clip"], "limite.webm", { type: "video/webm" })
      expect(await describeMediaFile(clip)).toEqual({
        ok: true,
        value: { kind: "video", mimeType: "video/webm", sizeBytes: 4, width: 1280, height: 720, durationMs: POST_VIDEO_MAX_DURATION_MS },
      })
    } finally {
      atLimit()
    }
  })

  it("les textes suivent la liste d'envoi et la borne du moteur, jamais une valeur écrite", () => {
    for (const locale of ["fr", "en"] as const) {
      const t = getFixedT(locale)
      expect(t("errors.media_video_format")).toContain("MP4")
      expect(t("errors.media_video_format")).toContain("WebM")
      expect(t("errors.media_video_format")).not.toContain("MOV")
      expect(t("errors.media_video_too_long")).toContain(String(POST_VIDEO_MAX_DURATION_MS / 60_000))
    }
  })
})
