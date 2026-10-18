import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DataSourceProvider } from "../data/context"
import type { ActionResult, DiasporaleDataSource, PublishInput, UploadedMedia } from "../data/port"
import { getFixedT } from "../i18n"
import { I18nProvider } from "../i18n/client"
import { PostComposerSheet } from "./composer"

const t = getFixedT("fr")
const publish = vi.fn<(input: PublishInput) => Promise<ActionResult<{ moderation: "published" }>>>()
const uploadMedia = vi.fn<(file: File) => Promise<ActionResult<UploadedMedia>>>()
const onClose = vi.fn()
const source = { kind: "engine", actions: { publish, uploadMedia } } as unknown as DiasporaleDataSource

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function uploaded(file: File): ActionResult<UploadedMedia> {
  return { ok: true, value: { ref: `stored-${file.name}`, kind: file.type.startsWith("video/") ? "video" : "image", mimeType: file.type, sizeBytes: file.size } }
}

function Composer() {
  const [open, setOpen] = useState(true)
  return <I18nProvider locale="fr"><DataSourceProvider source={source}>
    <button onClick={() => setOpen(true)}>Reprendre</button>
    <PostComposerSheet open={open} onOpenChange={(next) => { setOpen(next); if (!next) onClose() }} memberCountry="FR" openCountries={["FR"]} draftKey="recette:composeur" />
  </DataSourceProvider></I18nProvider>
}

function choose(files: File[]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error("Sélecteur absent")
  fireEvent.change(input, { target: { files } })
}

beforeEach(() => {
  publish.mockReset().mockResolvedValue({ ok: true, value: { moderation: "published" } })
  uploadMedia.mockReset().mockImplementation(async (file) => uploaded(file))
  onClose.mockClear()
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal("URL", class extends URL {
    static override createObjectURL = vi.fn((file: File) => `blob:recette-${file.name}`)
    static override revokeObjectURL = vi.fn()
  })
})
afterEach(() => { vi.unstubAllGlobals() })

describe("Composeur — les fichiers choisis rejoignent réellement la publication", () => {
  it("attend les deux dépôts puis transmet les photos dans l’ordre choisi, même si le second finit avant le premier", async () => {
    const first = deferred<ActionResult<UploadedMedia>>()
    const second = deferred<ActionResult<UploadedMedia>>()
    uploadMedia.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise)
    const user = userEvent.setup()
    render(<Composer />)
    const photos = [new File(["photo 1"], "premiere.png", { type: "image/png" }), new File(["photo 2"], "seconde.png", { type: "image/png" })]
    await user.type(screen.getByRole("textbox", { name: t("composer.bodyLabel") }), "Deux photos de recette")
    choose(photos)
    const submit = screen.getByRole("button", { name: t("composer.publish") })
    expect(screen.getAllByRole("textbox", { name: t("composer.mediaAltLabel") })).toHaveLength(2)
    expect(submit).toBeDisabled()
    await act(async () => { second.resolve(uploaded(photos[1]!)) })
    expect(submit).toBeDisabled()
    expect(publish).not.toHaveBeenCalled()
    await act(async () => { first.resolve(uploaded(photos[0]!)) })
    const descriptions = screen.getAllByRole("textbox", { name: t("composer.mediaAltLabel") })
    await user.type(descriptions[0]!, "Première mire")
    await user.type(descriptions[1]!, "Deuxième mire")
    await user.click(submit)
    await waitFor(() => expect(publish).toHaveBeenCalledOnce())
    expect(publish.mock.calls[0]?.[0].media).toEqual(photos.map((file, index) => ({ upload: (uploaded(file) as { ok: true; value: UploadedMedia }).value, altText: index === 0 ? "Première mire" : "Deuxième mire" })))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("conserve les photos en fermant puis rouvrant la feuille sans recharger la page", async () => {
    const user = userEvent.setup()
    render(<Composer />)
    choose([new File(["photo"], "gardee.png", { type: "image/png" })])
    await waitFor(() => expect(screen.getByRole("button", { name: t("composer.publish") })).toBeEnabled())
    await user.click(screen.getByRole("button", { name: t("common.cancel") }))
    await user.click(screen.getByRole("button", { name: "Reprendre" }))
    expect(screen.getAllByRole("textbox", { name: t("composer.mediaAltLabel") })).toHaveLength(1)
    await user.click(screen.getByRole("button", { name: t("composer.publish") }))
    await waitFor(() => expect(publish).toHaveBeenCalledOnce())
    expect(publish.mock.calls[0]?.[0].media).toHaveLength(1)
  })

  it("un dépôt refusé ne devient jamais une publication de texte seule", async () => {
    uploadMedia.mockResolvedValueOnce({ ok: false, code: "media_upload_failed" })
    const user = userEvent.setup()
    render(<Composer />)
    await user.type(screen.getByRole("textbox", { name: t("composer.bodyLabel") }), "Texte à garder avec sa photo")
    choose([new File(["photo"], "refusee.png", { type: "image/png" })])
    await waitFor(() => expect(screen.getByRole("button", { name: t("composer.publish") })).toBeEnabled())
    await user.click(screen.getByRole("button", { name: t("composer.publish") }))
    expect(await screen.findAllByRole("alert")).not.toHaveLength(0)
    expect(publish).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("ne laisse pas ajouter des photos à un envoi de texte déjà parti : son succès effacerait des pièces jamais envoyées", async () => {
    const result = deferred<ActionResult<{ moderation: "published" }>>()
    publish.mockImplementationOnce(() => result.promise)
    const user = userEvent.setup()
    render(<Composer />)
    await user.type(screen.getByRole("textbox", { name: t("composer.bodyLabel") }), "Publication en cours")
    await user.click(screen.getByRole("button", { name: t("composer.publish") }))
    await waitFor(() => expect(publish).toHaveBeenCalledOnce())
    expect(publish.mock.calls[0]?.[0].media).toBeUndefined()
    choose([new File(["photo"], "trop-tard.png", { type: "image/png" })])
    expect(uploadMedia).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: t("composer.mediaAdd") })).toBeDisabled()
    const form = document.querySelector("form")
    if (!form) throw new Error("Formulaire absent")
    await act(async () => { fireEvent.submit(form) })
    expect(publish).toHaveBeenCalledOnce()
    await act(async () => { result.resolve({ ok: true, value: { moderation: "published" } }) })
  })

  it("une vidéo seule sans texte est transmise et garde son type", async () => {
    const user = userEvent.setup()
    render(<Composer />)
    choose([new File(["video fictive"], "recette.mp4", { type: "video/mp4" })])
    await waitFor(() => expect(screen.getByRole("button", { name: t("composer.publish") })).toBeEnabled())
    await user.click(screen.getByRole("button", { name: t("composer.publish") }))
    await waitFor(() => expect(publish).toHaveBeenCalledOnce())
    expect(publish.mock.calls[0]?.[0]).toMatchObject({ body: "", media: [{ upload: { ref: "stored-recette.mp4", kind: "video", mimeType: "video/mp4" } }] })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("un refus de publication rend les contrôles et conserve les deux dépôts pour réessayer avec la même clé", async () => {
    publish.mockResolvedValueOnce({ ok: false, code: "unknown" })
    const user = userEvent.setup()
    render(<Composer />)
    choose([new File(["1"], "une.png", { type: "image/png" }), new File(["2"], "deux.png", { type: "image/png" })])
    await waitFor(() => expect(screen.getByRole("button", { name: t("composer.publish") })).toBeEnabled())
    await user.click(screen.getByRole("button", { name: t("composer.publish") }))
    await waitFor(() => expect(publish).toHaveBeenCalledOnce())
    expect(screen.getByRole("button", { name: t("composer.mediaAdd") })).toBeEnabled()
    expect(screen.getAllByRole("textbox", { name: t("composer.mediaAltLabel") })).toHaveLength(2)
    expect(onClose).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: t("composer.publish") }))
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(2))
    expect(publish.mock.calls[1]?.[0]).toEqual(publish.mock.calls[0]?.[0])
    expect(uploadMedia).toHaveBeenCalledTimes(2)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("une validation refusée libère le verrou et permet de joindre puis publier une photo", async () => {
    const user = userEvent.setup()
    render(<Composer />)
    await user.click(screen.getByRole("button", { name: t("composer.publish") }))
    expect(await screen.findByRole("alert")).toHaveTextContent(t("errors.post_empty"))
    expect(publish).not.toHaveBeenCalled()
    choose([new File(["photo"], "apres-validation.png", { type: "image/png" })])
    await waitFor(() => expect(screen.getByRole("button", { name: t("composer.publish") })).toBeEnabled())
    await user.click(screen.getByRole("button", { name: t("composer.publish") }))
    await waitFor(() => expect(publish).toHaveBeenCalledOnce())
    expect(publish.mock.calls[0]?.[0].media).toHaveLength(1)
  })
})
