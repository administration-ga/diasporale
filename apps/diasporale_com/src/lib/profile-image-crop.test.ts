import { jpegHasGpsMetadata, listImageMetadata } from "@antsia/social-domain/imageMetadata"
import { IMAGE_UPLOAD_QUALITY, isPreparedImage, type ImageRuntime } from "@antsia/social-features/media-upload"
import { TEST_JPEG_BYTES, TEST_JPEG_WITH_GPS_BYTES, TEST_PNG_BYTES } from "@antsia/social-features/tests/image-runtime"
import { describe, expect, it } from "vitest"

import {
  CROP_POSITION_MAX,
  CROP_ZOOM_MAX,
  clampCrop,
  cropPosition,
  cropPreviewStyle,
  cropRect,
  INITIAL_CROP,
  moveImage,
  placeCrop,
  prepareProfileImage,
  PROFILE_IMAGE_FRAMES,
  PROFILE_IMAGE_MAX_BYTES,
  zoomCrop,
  type CropRect,
} from "./profile-image-crop"

const W = 4000
const H = 3000
const AVATAR = PROFILE_IMAGE_FRAMES.avatar.aspect
const COVER = PROFILE_IMAGE_FRAMES.cover.aspect

function file(bytes: Uint8Array, name: string, type: string): File {
  return new File([bytes as Uint8Array<ArrayBuffer>], name, { type })
}

interface Drawing {
  readonly dx: number
  readonly dy: number
  readonly dw: number
  readonly dh: number
}

/** Un décodeur et un canvas simulés qui RELÈVENT chaque dessin : on vérifie ce que le recadrage dessine. */
function recordingRuntime(options: { width?: number; height?: number; output?: { bytes: Uint8Array; type: string }; canvas?: "absent"; decodeFails?: boolean } = {}) {
  const canvases: { width: number; height: number }[] = []
  const drawings: Drawing[] = []
  const encodings: { type: string; quality: number }[] = []
  let released = 0
  const runtime: ImageRuntime = {
    async decode(blob) {
      if (options.decodeFails || !blob.type.startsWith("image/")) throw new Error("illisible")
      return { width: options.width ?? W, height: options.height ?? H, source: {} as CanvasImageSource, release: () => { released += 1 } }
    },
    createCanvas(width, height) {
      if (options.canvas === "absent") return null
      canvases.push({ width, height })
      return {
        getContext: () => ({ imageSmoothingEnabled: false, imageSmoothingQuality: "low", drawImage: (_image, dx, dy, dw, dh) => { drawings.push({ dx, dy, dw, dh }) } }),
        toBlob: (callback, type, quality) => {
          encodings.push({ type, quality })
          const output = options.output ?? (type === "image/jpeg" ? { bytes: TEST_JPEG_BYTES, type } : { bytes: TEST_PNG_BYTES, type: "image/png" })
          callback(new Blob([output.bytes as Uint8Array<ArrayBuffer>], { type: output.type }))
        },
      }
    },
  }
  return { runtime, canvases, drawings, encodings, released: () => released }
}

/** Ce que le canvas de sortie montre de l'image : la zone source dessinée dans [0, largeur] × [0, hauteur]. */
function visibleSource(drawing: Drawing, canvas: { width: number; height: number }) {
  const scaleX = drawing.dw / W
  const scaleY = drawing.dh / H
  return { x: -drawing.dx / scaleX, y: -drawing.dy / scaleY, width: canvas.width / scaleX, height: canvas.height / scaleY }
}

/** Un PNG valide au-delà de `bytes` octets : un morceau IDAT de remplissage avant IEND. */
function heavyPng(bytes: number): Uint8Array {
  const iend = TEST_PNG_BYTES.subarray(TEST_PNG_BYTES.length - 12)
  const head = TEST_PNG_BYTES.subarray(0, TEST_PNG_BYTES.length - 12)
  const chunk = new Uint8Array(12 + bytes)
  new DataView(chunk.buffer).setUint32(0, bytes)
  chunk.set([0x49, 0x44, 0x41, 0x54], 4)
  const out = new Uint8Array(head.length + chunk.length + iend.length)
  out.set(head, 0)
  out.set(chunk, head.length)
  out.set(iend, head.length + chunk.length)
  return out
}

const closeTo = (rect: CropRect, expected: CropRect) => {
  for (const key of ["x", "y", "width", "height"] as const) expect(rect[key]).toBeCloseTo(expected[key], 6)
}

describe("RP-01 — la géométrie du cadre", () => {
  it("le cadrage initial est le plus grand cadre centré : un carré pour la photo, un bandeau 4:1 pour la couverture", () => {
    closeTo(cropRect(INITIAL_CROP, AVATAR, W, H)!, { x: 500, y: 0, width: 3000, height: 3000 })
    closeTo(cropRect(INITIAL_CROP, COVER, W, H)!, { x: 0, y: 1000, width: 4000, height: 1000 })
    // Une photo en hauteur : le rond prend toute la largeur.
    closeTo(cropRect(INITIAL_CROP, AVATAR, H, W)!, { x: 0, y: 500, width: 3000, height: 3000 })
    expect(cropRect(INITIAL_CROP, AVATAR, 0, H)).toBeNull()
  })

  it("le zoom resserre le cadre autour de son centre ; il reste borné", () => {
    closeTo(cropRect(zoomCrop(INITIAL_CROP, AVATAR, W, H, 2), AVATAR, W, H)!, { x: 1250, y: 750, width: 1500, height: 1500 })
    expect(zoomCrop(INITIAL_CROP, AVATAR, W, H, 99).zoom).toBe(CROP_ZOOM_MAX)
    expect(zoomCrop(INITIAL_CROP, AVATAR, W, H, 0.2).zoom).toBe(1)
  })

  it("le cadre ne sort jamais de l'image, même demandé au-delà du bord", () => {
    const clamped = clampCrop({ zoom: 1, centerX: 0, centerY: 2 }, AVATAR, W, H)
    closeTo(cropRect(clamped, AVATAR, W, H)!, { x: 0, y: 0, width: 3000, height: 3000 })
    const far = clampCrop({ zoom: 2, centerX: Number.NaN, centerY: 1 }, AVATAR, W, H)
    const rect = cropRect(far, AVATAR, W, H)!
    expect(rect.x + rect.width / 2).toBeCloseTo(W / 2, 6)
    expect(rect.y + rect.height).toBeCloseTo(H, 6)
  })

  it("glisser l'image vers la droite emmène le cadre vers la gauche, d'autant que le glissé", () => {
    const zoomed = zoomCrop(INITIAL_CROP, AVATAR, W, H, 2)
    // Un quart de la largeur du cadre (1 500 px de l'image) : 375 px.
    closeTo(cropRect(moveImage(zoomed, AVATAR, W, H, 0.25, 0), AVATAR, W, H)!, { x: 875, y: 750, width: 1500, height: 1500 })
    // Au-delà du bord : arrêté au bord.
    closeTo(cropRect(moveImage(zoomed, AVATAR, W, H, 5, -5), AVATAR, W, H)!, { x: 0, y: 1500, width: 1500, height: 1500 })
  })

  it("les curseurs de position vont d'un bord à l'autre ; sans marge, le curseur n'a rien à régler", () => {
    const zoomed = zoomCrop(INITIAL_CROP, AVATAR, W, H, 2)
    expect(cropPosition(zoomed, AVATAR, W, H, "x")).toBe(CROP_POSITION_MAX / 2)
    closeTo(cropRect(placeCrop(zoomed, AVATAR, W, H, "x", 0), AVATAR, W, H)!, { x: 0, y: 750, width: 1500, height: 1500 })
    const right = cropRect(placeCrop(zoomed, AVATAR, W, H, "x", CROP_POSITION_MAX), AVATAR, W, H)!
    expect(right.x + right.width).toBeCloseTo(W, 6)
    expect(cropPosition(placeCrop(zoomed, AVATAR, W, H, "y", 30), AVATAR, W, H, "y")).toBe(30)
    // Le rond au zoom 1 prend toute la hauteur d'une photo en largeur : aucune marge verticale.
    expect(cropPosition(INITIAL_CROP, AVATAR, W, H, "y")).toBeNull()
    expect(cropPosition(INITIAL_CROP, AVATAR, W, H, "x")).toBe(CROP_POSITION_MAX / 2)
  })

  it("l'aperçu place l'image pour que le cadre montre exactement le rectangle recadré", () => {
    expect(cropPreviewStyle(cropRect(INITIAL_CROP, AVATAR, W, H)!, W, H)).toEqual({ width: "133.3333%", height: "100%", left: "-16.6667%", top: "0%" })
    for (const state of [{ zoom: 2.3, centerX: 0.31, centerY: 0.62 }, { zoom: 1.4, centerX: 0.9, centerY: 0.1 }]) {
      for (const aspect of [AVATAR, COVER]) {
        const rect = cropRect(state, aspect, W, H)!
        const style = cropPreviewStyle(rect, W, H)
        const left = Number.parseFloat(style.left) / 100
        const width = Number.parseFloat(style.width) / 100
        const top = Number.parseFloat(style.top) / 100
        const height = Number.parseFloat(style.height) / 100
        // Le bord gauche du cadre (0) et le bord droit (1) tombent sur le rectangle, à 1/10 000 près.
        expect(left + width * (rect.x / W)).toBeCloseTo(0, 3)
        expect(left + width * ((rect.x + rect.width) / W)).toBeCloseTo(1, 3)
        expect(top + height * (rect.y / H)).toBeCloseTo(0, 3)
        expect(top + height * ((rect.y + rect.height) / H)).toBeCloseTo(1, 3)
      }
    }
  })
})

describe("RP-01 — l'image envoyée est le cadre, préparée par le module du moteur", () => {
  it("la photo : un carré du cadre choisi, 1 024 px au plus, ré-encodée une seule fois, inscrite au registre", async () => {
    const recording = recordingRuntime()
    const crop = { zoom: 2, centerX: 0.3, centerY: 0.5 }
    const result = await prepareProfileImage(file(TEST_JPEG_BYTES, "portrait.jpg", "image/jpeg"), "avatar", crop, recording.runtime)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(isPreparedImage(result.file)).toBe(true)
    expect(result.file.type).toBe("image/jpeg")
    expect(recording.canvases).toEqual([{ width: 1024, height: 1024 }])
    expect(recording.encodings).toEqual([{ type: "image/jpeg", quality: IMAGE_UPLOAD_QUALITY }])
    expect(recording.drawings).toHaveLength(1)
    // Le dessin ne montre QUE le cadre : la même zone que l'aperçu.
    closeTo(visibleSource(recording.drawings[0]!, recording.canvases[0]!), cropRect(crop, AVATAR, W, H)!)
    expect(recording.released()).toBe(1)
  })

  it("la couverture : le bandeau 4:1, 2 048 px de large au plus", async () => {
    const recording = recordingRuntime()
    const result = await prepareProfileImage(file(TEST_PNG_BYTES, "paysage.png", "image/png"), "cover", INITIAL_CROP, recording.runtime)

    expect(result.ok && result.file.type).toBe("image/png")
    expect(recording.canvases).toEqual([{ width: 2048, height: 512 }])
    closeTo(visibleSource(recording.drawings[0]!, recording.canvases[0]!), { x: 0, y: 1000, width: 4000, height: 1000 })
  })

  it("une image porteuse de coordonnées GPS ressort sans aucune métadonnée", async () => {
    const recording = recordingRuntime({ output: { bytes: TEST_JPEG_WITH_GPS_BYTES, type: "image/jpeg" } })
    const result = await prepareProfileImage(file(TEST_JPEG_WITH_GPS_BYTES, "IMG_0001.jpg", "image/jpeg"), "avatar", INITIAL_CROP, recording.runtime)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const bytes = new Uint8Array(await result.file.arrayBuffer())
    expect(jpegHasGpsMetadata(bytes)).toBe(false)
    expect(listImageMetadata(bytes, "image/jpeg")).toEqual([])
  })

  it("refus fermés : canvas absent, image illisible, type non admis, fichier préparé encore trop lourd — jamais l'original", async () => {
    const photo = file(TEST_JPEG_BYTES, "portrait.jpg", "image/jpeg")
    expect(await prepareProfileImage(photo, "avatar", INITIAL_CROP, recordingRuntime({ canvas: "absent" }).runtime)).toEqual({ ok: false, refusal: "canvas-unavailable" })
    expect(await prepareProfileImage(photo, "cover", INITIAL_CROP, recordingRuntime({ decodeFails: true }).runtime)).toEqual({ ok: false, refusal: "unreadable" })
    expect(await prepareProfileImage(file(TEST_JPEG_BYTES, "anime.gif", "image/gif"), "avatar", INITIAL_CROP, recordingRuntime().runtime)).toEqual({ ok: false, refusal: "unsupported-type" })
    const heavy = recordingRuntime({ output: { bytes: heavyPng(PROFILE_IMAGE_MAX_BYTES.avatar + 1), type: "image/png" } })
    expect(await prepareProfileImage(file(TEST_PNG_BYTES, "lourde.png", "image/png"), "avatar", INITIAL_CROP, heavy.runtime)).toEqual({ ok: false, refusal: "too-large" })
  })
})
