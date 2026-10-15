import { describe, expect, it } from "vitest"

import { ACTION_ERROR_CODES } from "./errors"
import { describeMediaFile, MEDIA_RULE_CODES, POST_MEDIA_ACCEPT, postMediaKindOf, postMediaRefusal } from "./media"

describe("médias d'une publication — les règles du moteur, dites par DIASPORALE", () => {
  it("le type dit la nature du média : photo, vidéo, ou refus", () => {
    expect(postMediaKindOf("image/webp")).toBe("image")
    expect(postMediaKindOf("video/quicktime")).toBe("video")
    expect(postMediaKindOf("application/pdf")).toBeNull()
    expect(POST_MEDIA_ACCEPT.split(",")).toEqual(expect.arrayContaining(["image/jpeg", "image/gif", "video/mp4"]))
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
