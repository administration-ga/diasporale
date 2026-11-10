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

function source(image: ProfileImageView = SERVED) {
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
  const actions = createEngineProfileImagesActions({
    convex: { mutation } as unknown as Pick<ConvexReactClient, "mutation">,
    fetch: deposit,
  })
  const calls = () => mutation.mock.calls.map(([reference, args]) => ({ name: getFunctionName(reference), args }))
  return { actions, mutation, deposit, calls, events }
}

function photo(type = "image/png") {
  return new File(["image fictive de recette"], "recette.png", { type })
}

describe("images du profil — adaptateur du moteur", () => {
  it.each(USAGES)("dépose le fichier neuf puis attache %s par la mutation publique", async (usage, setter) => {
    const { actions, deposit, calls, events } = source()
    const file = photo("image/webp")

    expect(await actions.set(usage, file)).toEqual({ ok: true, value: SERVED })
    expect(deposit).toHaveBeenCalledExactlyOnceWith(UPLOAD_URL, {
      method: "POST", headers: { "Content-Type": "image/webp" }, body: file,
    })
    expect(calls()).toEqual([
      { name: "modules/people/profile:generateProfileUploadUrl", args: { usage } },
      { name: `modules/people/profile:${setter}`, args: { storageId: "storage-neuf", mimeType: "image/webp" } },
    ])
    expect(events).toEqual(["modules/people/profile:generateProfileUploadUrl", "POST image", `modules/people/profile:${setter}`])
  })

  it("ne réutilise ni le dépôt ni la référence d'un fichier lors du remplacement", async () => {
    const { actions, deposit, calls } = source()
    deposit.mockResolvedValueOnce(new Response(JSON.stringify({ storageId: "storage-premier" })))
    deposit.mockResolvedValueOnce(new Response(JSON.stringify({ storageId: "storage-remplacement" })))
    const first = photo("image/jpeg")
    const replacement = photo("image/webp")

    await actions.set("avatar", first)
    await actions.set("avatar", replacement)

    expect(deposit.mock.calls.map(([, init]) => init?.body)).toEqual([first, replacement])
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
})
