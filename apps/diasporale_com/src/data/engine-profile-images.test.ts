import { jpegHasGpsMetadata, listImageMetadata } from "@antsia/social-domain/imageMetadata"
import { isPreparedImage, prepareImageForUpload, type ImagePreparation, type PrepareImage } from "@antsia/social-features/media-upload"
import { fakeImageRuntime, TEST_JPEG_WITH_GPS_BYTES, testPrepareImage } from "@antsia/social-features/tests/image-runtime"
import type { ProfileImageView } from "@diasporale/features/data"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { describe, expect, it, vi } from "vitest"

import { createEngineProfileImagesActions } from "./engine-profile-images"

const UPLOAD_URL = "https://depot.exemple.test/image-neuve"
const SERVED: ProfileImageView = { url: "https://images.exemple.test/image.png", withheld: null }
const USAGES = [
  ["avatar", "setMyAvatar"],
  ["cover", "setMyCover"],
] as const

/**
 * Une préparation de recette : un fichier NEUF du même type, pour suivre ce
 * que l'adaptateur envoie. La vraie préparation du moteur est éprouvée plus bas.
 */
function recordingPrepare() {
  const prepared: File[] = []
  const prepare = vi.fn<PrepareImage>(async (file): Promise<ImagePreparation> => {
    const output = new File(["image préparée"], file.name, { type: file.type })
    prepared.push(output)
    return { ok: true, file: output, width: 4, height: 4, originalBytes: file.size, preparedBytes: output.size }
  })
  return { prepare, prepared }
}

function source(image: ProfileImageView = SERVED, prepareImage?: PrepareImage) {
  const events: string[] = []
  const mutation = vi.fn(async (reference: Parameters<typeof getFunctionName>[0], _args: unknown): Promise<unknown> => {
    const name = getFunctionName(reference)
    events.push(name)
    if (name === "modules/people/profile:generateProfileUploadUrl") return UPLOAD_URL
    if (name === "modules/people/profile:setMyAvatar" || name === "modules/people/profile:setMyCover") return image
    throw new Error(`Mutation inattendue dans le contrat des images : ${name}`)
  })
  const deposit = vi.fn<typeof fetch>().mockImplementation(async () => {
    events.push("POST image")
    return new Response(JSON.stringify({ storageId: "storage-neuf" }), { status: 200 })
  })
  const recorded = recordingPrepare()
  const actions = createEngineProfileImagesActions({
    convex: { mutation } as unknown as Pick<ConvexReactClient, "mutation">,
    fetch: deposit,
    prepareImage: prepareImage ?? recorded.prepare,
  })
  const calls = () => mutation.mock.calls.map(([reference, args]) => ({ name: getFunctionName(reference), args }))
  return { actions, mutation, deposit, calls, events, prepared: recorded.prepared, prepare: recorded.prepare }
}

function photo(type = "image/png") {
  return new File(["image fictive de recette"], "recette.png", { type })
}

describe("images du profil — adaptateur du moteur", () => {
  it.each(USAGES)("dépose le fichier PRÉPARÉ puis attache %s par la mutation publique", async (usage, setter) => {
    const { actions, deposit, calls, events, prepared } = source()
    const file = photo("image/webp")

    expect(await actions.set(usage, file)).toEqual({ ok: true, value: SERVED })
    expect(prepared).toHaveLength(1)
    expect(prepared[0]).not.toBe(file)
    expect(deposit).toHaveBeenCalledExactlyOnceWith(UPLOAD_URL, {
      method: "POST", headers: { "Content-Type": "image/webp" }, body: prepared[0],
    })
    expect(calls()).toEqual([
      { name: "modules/people/profile:generateProfileUploadUrl", args: { usage } },
      { name: `modules/people/profile:${setter}`, args: { storageId: "storage-neuf", mimeType: "image/webp" } },
    ])
    expect(events).toEqual(["modules/people/profile:generateProfileUploadUrl", "POST image", `modules/people/profile:${setter}`])
  })

  it("ne réutilise ni le dépôt ni la référence d'un fichier lors du remplacement", async () => {
    const { actions, deposit, calls, prepared } = source()
    deposit.mockResolvedValueOnce(new Response(JSON.stringify({ storageId: "storage-premier" })))
    deposit.mockResolvedValueOnce(new Response(JSON.stringify({ storageId: "storage-remplacement" })))
    const first = photo("image/jpeg")
    const replacement = photo("image/webp")

    await actions.set("avatar", first)
    await actions.set("avatar", replacement)

    expect(deposit.mock.calls.map(([, init]) => init?.body)).toEqual(prepared)
    expect(prepared).toHaveLength(2)
    expect(calls()).toEqual([
      { name: "modules/people/profile:generateProfileUploadUrl", args: { usage: "avatar" } },
      { name: "modules/people/profile:setMyAvatar", args: { storageId: "storage-premier", mimeType: "image/jpeg" } },
      { name: "modules/people/profile:generateProfileUploadUrl", args: { usage: "avatar" } },
      { name: "modules/people/profile:setMyAvatar", args: { storageId: "storage-remplacement", mimeType: "image/webp" } },
    ])
  })

  it("refuse un statut HTTP en erreur sans attacher la référence contenue dans sa réponse", async () => {
    const { actions, deposit, calls } = source()
    deposit.mockResolvedValueOnce(new Response(JSON.stringify({ storageId: "storage-non-admis" }), { status: 500 }))

    expect(await actions.set("cover", photo())).toEqual({ ok: false, code: "media_upload_failed" })
    expect(calls()).toEqual([{ name: "modules/people/profile:generateProfileUploadUrl", args: { usage: "cover" } }])
  })

  it.each([
    { name: "null", uploaded: null },
    { name: "un objet sans référence", uploaded: {} },
    { name: "une référence numérique", uploaded: { storageId: 42 } },
    { name: "une chaîne seule", uploaded: "storage-invalide" },
    { name: "un tableau", uploaded: [] },
  ])("ne pose aucune image après une réponse JSON contenant $name", async ({ uploaded }) => {
    const { actions, deposit, calls } = source()
    deposit.mockResolvedValueOnce(new Response(JSON.stringify(uploaded), { status: 200 }))

    expect(await actions.set("avatar", photo())).toEqual({ ok: false, code: "media_upload_failed" })
    expect(calls()).toHaveLength(1)
  })

  it("ferme une réponse non JSON sans attachement ni détail de la réponse", async () => {
    const { actions, deposit, calls } = source()
    deposit.mockResolvedValueOnce(new Response("réponse interne illisible", { status: 200 }))

    expect(await actions.set("avatar", photo())).toEqual({ ok: false, code: "unknown" })
    expect(calls()).toHaveLength(1)
  })

  it("ferme une panne de transfert sans poser une image ni exposer son message", async () => {
    const { actions, deposit, calls } = source()
    deposit.mockRejectedValueOnce(new Error("diagnostic interne du transfert"))

    expect(await actions.set("cover", photo())).toEqual({ ok: false, code: "unknown" })
    expect(calls()).toHaveLength(1)
  })

  it.each([
    { name: "suspension", error: new ConvexError({ code: "membershipSuspended" }), code: "suspended" },
    { name: "erreur inconnue", error: new Error("détail interne du serveur"), code: "unknown" },
  ])("ferme une $name avant le transfert", async ({ error, code }) => {
    const { actions, mutation, deposit } = source()
    mutation.mockRejectedValueOnce(error)

    expect(await actions.set("avatar", photo())).toEqual({ ok: false, code })
    expect(deposit).not.toHaveBeenCalled()
    expect(mutation).toHaveBeenCalledOnce()
  })

  it("rend le refus fermé de l'attachement après un transfert réussi", async () => {
    const { actions, mutation, deposit, calls } = source()
    mutation.mockResolvedValueOnce(UPLOAD_URL).mockRejectedValueOnce(new ConvexError({ code: "membershipSuspended" }))

    expect(await actions.set("cover", photo())).toEqual({ ok: false, code: "suspended" })
    expect(deposit).toHaveBeenCalledOnce()
    expect(calls()[1]).toEqual({ name: "modules/people/profile:setMyCover", args: { storageId: "storage-neuf", mimeType: "image/png" } })
  })

  it.each(["fileScanPending", "fileScanUnavailable", "fileQuarantined"] as const)("masque l'URL renvoyée avec une retenue %s", async (withheld) => {
    const { actions } = source({ url: "https://images.exemple.test/image-retenue.png", withheld })

    expect(await actions.set("avatar", photo())).toEqual({ ok: true, value: { url: null, withheld } })
  })

  it.each(USAGES)("retire seulement la référence de %s, sans dépôt ni suppression du fichier", async (usage, setter) => {
    const { actions, deposit, calls } = source({ url: null, withheld: null })

    expect(await actions.clear(usage)).toEqual({ ok: true, value: { url: null, withheld: null } })
    expect(deposit).not.toHaveBeenCalled()
    expect(calls()).toEqual([{ name: `modules/people/profile:${setter}`, args: { storageId: null } }])
  })

  it.each([
    { error: new ConvexError({ code: "membershipSuspended" }), code: "suspended" },
    { error: new Error("diagnostic interne du retrait"), code: "unknown" },
  ])("rend le code fermé $code si le retrait est refusé", async ({ error, code }) => {
    const { actions, mutation, deposit, calls } = source()
    mutation.mockRejectedValueOnce(error)

    expect(await actions.clear("cover")).toEqual({ ok: false, code })
    expect(deposit).not.toHaveBeenCalled()
    expect(calls()).toEqual([{ name: "modules/people/profile:setMyCover", args: { storageId: null } }])
  })

  it("RP-01 : une image porteuse de coordonnées GPS ressort sans métadonnées sur le fichier déposé", async () => {
    // Pire cas : l'encodeur recopierait le bloc EXIF de la source ; le module du moteur le retire quand même.
    const prepareImage = testPrepareImage({ width: 4032, height: 3024, output: { bytes: TEST_JPEG_WITH_GPS_BYTES, type: "image/jpeg" } })
    const { actions, deposit, calls } = source(SERVED, prepareImage)
    const original = new File([TEST_JPEG_WITH_GPS_BYTES as Uint8Array<ArrayBuffer>], "portrait.jpg", { type: "image/jpeg" })

    expect(await actions.set("avatar", original)).toEqual({ ok: true, value: SERVED })
    const sent = deposit.mock.calls[0]?.[1]?.body as File
    expect(sent).not.toBe(original)
    const bytes = new Uint8Array(await sent.arrayBuffer())
    expect(jpegHasGpsMetadata(bytes)).toBe(false)
    expect(listImageMetadata(bytes, "image/jpeg")).toEqual([])
    expect(calls()[1]).toEqual({ name: "modules/people/profile:setMyAvatar", args: { storageId: "storage-neuf", mimeType: "image/jpeg" } })
  })

  it("RP-01 : une image déjà recadrée et préparée par l'éditeur part telle quelle, sans second ré-encodage", async () => {
    const cropped = await prepareImageForUpload(photo("image/jpeg"), fakeImageRuntime({ width: 800, height: 800 }))
    if (!cropped.ok) throw new Error("préparation refusée")
    expect(isPreparedImage(cropped.file)).toBe(true)
    const { actions, deposit, prepare } = source()

    expect(await actions.set("avatar", cropped.file)).toEqual({ ok: true, value: SERVED })
    expect(prepare).not.toHaveBeenCalled()
    expect(deposit.mock.calls[0]?.[1]?.body).toBe(cropped.file)
  })

  it.each([
    { name: "canvas absent", options: { canvas: "absent" as const }, code: "media_preparation_unavailable" },
    { name: "image illisible", options: { decodeFails: true }, code: "media_unreadable" },
  ])("RP-01 : $name — refus fermé avant toute URL de dépôt, jamais l'original", async ({ options, code }) => {
    const { actions, deposit, mutation } = source(SERVED, testPrepareImage(options))

    expect(await actions.set("cover", photo("image/jpeg"))).toEqual({ ok: false, code })
    expect(mutation).not.toHaveBeenCalled()
    expect(deposit).not.toHaveBeenCalled()
  })
})
