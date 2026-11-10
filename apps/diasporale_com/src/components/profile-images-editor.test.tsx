// @vitest-environment jsdom
import type { ActionResult, ProfileImageView, ProfileImagesActions } from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProfileImagesEditor, type ProfileImagesEditorProps } from "./profile-images-editor"

const t = getFixedT("fr")
const served: ProfileImageView = { url: "/photo-servie.png", withheld: null }
const absent: ProfileImageView = { url: null, withheld: null }
const mocks = {
  set: vi.fn<ProfileImagesActions["set"]>(),
  clear: vi.fn<ProfileImagesActions["clear"]>(),
}

function tree(overrides: Partial<ProfileImagesEditorProps> = {}, locale: "fr" | "en" = "fr") {
  return <I18nProvider locale={locale}><ProfileImagesEditor avatar={null} cover={null} actions={mocks} {...overrides} /></I18nProvider>
}

function inputFor(usage: "avatar" | "cover") {
  return screen.getByLabelText(t(usage === "avatar" ? "profile.images.chooseAvatar" : "profile.images.chooseCover")) as HTMLInputElement
}

function formFor(usage: "avatar" | "cover") {
  return screen.getByRole("form", { name: t(`profile.images.${usage}`) })
}

function saveFor(usage: "avatar" | "cover") {
  return within(formFor(usage)).getByRole("button", { name: t(usage === "avatar" ? "profile.images.saveAvatar" : "profile.images.saveCover") })
}

function imageFile(name = "photo.png", type = "image/png", size?: number) {
  const file = new File(["image de recette"], name, { type })
  if (size !== undefined) Object.defineProperty(file, "size", { value: size })
  return file
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.set.mockResolvedValue({ ok: true, value: served })
  mocks.clear.mockResolvedValue({ ok: true, value: absent })
})

afterEach(cleanup)

describe("ProfileImagesEditor — les deux images du profil", () => {
  it("annonce les formats et la limite pour deux champs distincts, sans commande globale", () => {
    render(tree())

    expect(inputFor("avatar")).not.toBe(inputFor("cover"))
    for (const input of [inputFor("avatar"), inputFor("cover")]) {
      expect(input).toHaveAttribute("type", "file")
      expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp")
      expect(input).toHaveAccessibleDescription(t("profile.images.requirements"))
    }
    expect(screen.getAllByRole("form")).toHaveLength(2)
    expect(screen.getAllByRole("button")).toHaveLength(2)
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /hors connexion|retirer du réseau|publier mon profil|modifier mon profil/i })).not.toBeInTheDocument()
  })

  it("refuse un envoi sans fichier avant d'appeler le port", async () => {
    const user = userEvent.setup()
    render(tree())
    await user.click(saveFor("avatar"))

    expect(await screen.findByRole("alert")).toHaveTextContent(t("profile.images.required"))
    expect(inputFor("avatar")).toHaveAttribute("aria-invalid", "true")
    expect(mocks.set).not.toHaveBeenCalled()
  })

  it.each([
    { name: "GIF", file: () => imageFile("photo.gif", "image/gif"), expected: /Formats/ },
    { name: "plus de cinq Mio", file: () => imageFile("trop-grande.png", "image/png", 5 * 1024 * 1024 + 1), expected: /5 Mo/ },
    { name: "fichier vide", file: () => imageFile("vide.png", "image/png", 0), expected: null },
  ])("refuse $name sans téléversement, avec le fichier conservé", async ({ file: makeFile, expected }) => {
    const user = userEvent.setup({ applyAccept: false })
    render(tree())
    const file = makeFile()
    await user.upload(inputFor("cover"), file)
    await user.click(saveFor("cover"))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(expected ?? t("profile.images.required"))
    expect(inputFor("cover").files?.[0]).toBe(file)
    expect(mocks.set).not.toHaveBeenCalled()
    expect(mocks.clear).not.toHaveBeenCalled()
  })

  it.each(["avatar", "cover"] as const)("dépose ou remplace %s puis réinitialise seulement son champ", async (usage) => {
    const user = userEvent.setup()
    render(tree({ avatar: served, cover: served }))
    const file = imageFile(`${usage}.webp`, "image/webp")
    const otherUsage = usage === "avatar" ? "cover" : "avatar"
    const otherFile = imageFile("autre-choix.jpg", "image/jpeg")
    await user.upload(inputFor(otherUsage), otherFile)
    await user.upload(inputFor(usage), file)
    await user.click(saveFor(usage))

    await waitFor(() => expect(mocks.set).toHaveBeenCalledExactlyOnceWith(usage, file))
    expect(await screen.findByText(t("profile.images.updated"))).toBeInTheDocument()
    expect(inputFor(usage).files).toHaveLength(0)
    expect(inputFor(otherUsage).files?.[0]).toBe(otherFile)
    expect(mocks.clear).not.toHaveBeenCalled()
  })

  it("accepte la limite annoncée de cinq Mio", async () => {
    const user = userEvent.setup()
    render(tree())
    const file = imageFile("limite.jpg", "image/jpeg", 5 * 1024 * 1024)
    await user.upload(inputFor("avatar"), file)
    await user.click(saveFor("avatar"))

    await waitFor(() => expect(mocks.set).toHaveBeenCalledExactlyOnceWith("avatar", file))
  })

  it.each([
    { withheld: "fileScanPending" as const, key: "pending", role: "status" },
    { withheld: "fileQuarantined" as const, key: "blocked", role: "alert" },
  ])("annonce le retour $withheld sans rendre son URL retenue", async ({ withheld, key, role }) => {
    const user = userEvent.setup()
    mocks.set.mockResolvedValue({ ok: true, value: { url: "/url-retenue-interdite.png", withheld } })
    const { container } = render(tree())
    await user.upload(inputFor("avatar"), imageFile())
    await user.click(saveFor("avatar"))

    expect(await screen.findByRole(role)).toHaveTextContent(t(`profile.images.${key}`))
    expect(screen.queryByText(t("profile.images.updated"))).not.toBeInTheDocument()
    expect(container.querySelector('img[src="/url-retenue-interdite.png"]')).not.toBeInTheDocument()
    expect(inputFor("avatar").files).toHaveLength(0)
  })

  it.each(["fr", "en"] as const)("dit l'analyse indisponible au chargement et après dépôt sans annoncer de succès (%s)", async (locale) => {
    const translated = getFixedT(locale)
    const user = userEvent.setup()
    const unavailable: ProfileImageView = { url: "/analyse-non-terminee.png", withheld: "fileScanUnavailable" }
    mocks.set.mockResolvedValue({ ok: true, value: unavailable })
    const view = render(tree({ cover: unavailable }, locale))
    const notice = translated("errors:fileScanUnavailable")
    expect(screen.getByRole("alert")).toHaveTextContent(notice)
    const input = screen.getByLabelText(translated("profile.images.chooseAvatar")) as HTMLInputElement
    await user.upload(input, imageFile())
    await user.click(screen.getByRole("button", { name: translated("profile.images.saveAvatar") }))
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2))
    for (const alert of screen.getAllByRole("alert")) expect(alert).toHaveTextContent(notice)
    expect(screen.queryByText(translated("profile.images.updated"))).not.toBeInTheDocument()
    expect(view.container.innerHTML).not.toContain(unavailable.url)
    expect(input.files).toHaveLength(0)
  })

  it("dit l'état courant gardé puis remplace l'attente quand le moteur délivre l'image", async () => {
    const user = userEvent.setup()
    const pending: ProfileImageView = { url: "/url-retenue-interdite.png", withheld: "fileScanPending" }
    mocks.set.mockResolvedValue({ ok: true, value: pending })
    const view = render(tree({ cover: { url: "/couverture-bloquee.png", withheld: "fileQuarantined" } }))

    expect(screen.getByRole("alert")).toHaveTextContent(t("profile.images.blocked"))
    expect(view.container.querySelector("img")).not.toBeInTheDocument()
    await user.upload(inputFor("avatar"), imageFile())
    await user.click(saveFor("avatar"))
    expect(await screen.findByRole("status")).toHaveTextContent(t("profile.images.pending"))

    view.rerender(tree({ avatar: pending }))
    expect(view.container.querySelector("img")).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(t("profile.images.pending"))

    view.rerender(tree({ avatar: served }))
    expect(screen.queryByText(t("profile.images.pending"))).not.toBeInTheDocument()
    expect(view.container.querySelector('img[src="/photo-servie.png"]')).toBeInTheDocument()
  })

  it("traduit un échec fermé, conserve le choix et permet de renvoyer le même fichier", async () => {
    const user = userEvent.setup()
    mocks.set.mockResolvedValueOnce({ ok: false, code: "status_insufficient" })
    render(tree())
    const file = imageFile()
    await user.upload(inputFor("avatar"), file)
    await user.click(saveFor("avatar"))

    expect((await screen.findByRole("alert")).textContent).toBe(t("errors.status_insufficient"))
    expect(inputFor("avatar").files?.[0]).toBe(file)
    expect(inputFor("avatar")).toBeEnabled()
    await user.click(saveFor("avatar"))

    await waitFor(() => expect(mocks.set).toHaveBeenCalledTimes(2))
    expect(mocks.set).toHaveBeenNthCalledWith(2, "avatar", file)
    expect(await screen.findByText(t("profile.images.updated"))).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(inputFor("avatar").files).toHaveLength(0)
  })

  it("traduit aussi une exception sans exposer son message ni effacer le fichier", async () => {
    const user = userEvent.setup()
    mocks.set.mockRejectedValueOnce(new Error("PRIVATE_UPLOAD_FAILURE"))
    render(tree())
    const file = imageFile()
    await user.upload(inputFor("cover"), file)
    await user.click(saveFor("cover"))

    expect(await screen.findByRole("alert")).toHaveTextContent(t("errors.unknown"))
    expect(screen.queryByText("PRIVATE_UPLOAD_FAILURE")).not.toBeInTheDocument()
    expect(inputFor("cover").files?.[0]).toBe(file)
    expect(inputFor("cover")).toBeEnabled()
  })

  it("désactive uniquement les champs et gestes de l'image en cours d'envoi", async () => {
    const user = userEvent.setup()
    let finish!: (result: ActionResult<ProfileImageView>) => void
    mocks.set.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    render(tree({ avatar: served }))
    await user.upload(inputFor("avatar"), imageFile())
    await user.click(saveFor("avatar"))

    await waitFor(() => expect(mocks.set).toHaveBeenCalledOnce())
    expect(inputFor("avatar")).toBeDisabled()
    expect(within(formFor("avatar")).getByRole("button", { name: t("profile.images.saving") })).toBeDisabled()
    expect(screen.getByRole("button", { name: t("profile.images.removeAvatar") })).toBeDisabled()
    expect(inputFor("cover")).toBeEnabled()
    expect(saveFor("cover")).toBeEnabled()
    fireEvent.submit(formFor("avatar"))
    expect(mocks.set).toHaveBeenCalledOnce()

    await act(async () => { finish({ ok: true, value: served }) })
    expect(inputFor("avatar")).toBeEnabled()
  })

  it.each(["avatar", "cover"] as const)("demande une confirmation inline avant de retirer %s", async (usage) => {
    const user = userEvent.setup()
    render(tree({ avatar: served, cover: served }))
    const removeLabel = t(usage === "avatar" ? "profile.images.removeAvatar" : "profile.images.removeCover")
    await user.click(screen.getByRole("button", { name: removeLabel }))

    const confirmation = screen.getByRole("group", { name: t("profile.images.confirmRemove") })
    expect(mocks.clear).not.toHaveBeenCalled()
    await user.click(within(confirmation).getByRole("button", { name: t("profile.images.cancel") }))
    expect(screen.queryByRole("group")).not.toBeInTheDocument()
    expect(mocks.clear).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: removeLabel }))
    await user.click(within(screen.getByRole("group", { name: t("profile.images.confirmRemove") })).getByRole("button", { name: removeLabel }))

    await waitFor(() => expect(mocks.clear).toHaveBeenCalledExactlyOnceWith(usage))
    expect(await screen.findByText(t("profile.images.removed"))).toBeInTheDocument()
    expect(screen.queryByRole("group")).not.toBeInTheDocument()
    expect(mocks.set).not.toHaveBeenCalled()
  })

  it("garde la confirmation et le fichier après l'échec d'un retrait, puis permet de le reprendre", async () => {
    const user = userEvent.setup()
    mocks.clear.mockResolvedValueOnce({ ok: false, code: "status_insufficient" })
    render(tree({ avatar: served }))
    const file = imageFile("remplacement.png")
    await user.upload(inputFor("avatar"), file)
    const label = t("profile.images.removeAvatar")
    await user.click(screen.getByRole("button", { name: label }))
    await user.click(within(screen.getByRole("group")).getByRole("button", { name: label }))

    expect((await screen.findByRole("alert")).textContent).toBe(t("errors.status_insufficient"))
    expect(screen.getByRole("group")).toBeInTheDocument()
    expect(inputFor("avatar").files?.[0]).toBe(file)
    await user.click(within(screen.getByRole("group")).getByRole("button", { name: label }))

    await waitFor(() => expect(mocks.clear).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(t("profile.images.removed"))).toBeInTheDocument()
    expect(inputFor("avatar").files).toHaveLength(0)
  })
})
