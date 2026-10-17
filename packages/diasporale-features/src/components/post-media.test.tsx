import { act, cleanup, fireEvent, getDefaultNormalizer, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import { DataSourceProvider } from "../data/context"
import type { DiasporaleDataSource } from "../data/port"
import type { Loadable, MembershipView, PostMediaView, SessionView } from "../data/types"
import { getFixedT } from "../i18n"
import { I18nProvider } from "../i18n/client"
import { PostMediaGrid } from "./post-media"

const member: MembershipView = {
  personId: "person-reader", handle: "lecteur.recette", displayName: "Lecteur de recette", status: "declaree", badges: [],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: null, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: true, rateTier: "reinforced", directoryVisibility: "hidden",
}
function signedIn(membership: MembershipView = member): Loadable<SessionView> {
  return { status: "ready", data: { status: "signed_in", account: { id: membership.personId, idn: null, local: null, nameHints: {} }, membership } }
}
let session: Loadable<SessionView>
// Le lecteur ne consomme que la session ; toutes les autres opérations du port restent hors de ce test.
const source = { kind: "engine", useSession: () => session } as DiasporaleDataSource
const photo: PostMediaView = { kind: "image", url: "/recette-photo-1.png", withheld: null, altText: "La photo de recette", width: 800, height: 600 }
const photos = Array.from({ length: 4 }, (_, index) => ({ ...photo, url: `/recette-photo-${index + 1}.png`, altText: `Photo ${index + 1}` }))
const t = getFixedT("fr")
const normalize = getDefaultNormalizer()

function tree(media: readonly PostMediaView[] = [photo], provider: DiasporaleDataSource | null = source, locale: "fr" | "en" = "fr", other?: readonly PostMediaView[]) {
  const grids = <><PostMediaGrid media={media} />{other ? <PostMediaGrid media={other} /> : null}</>
  return <I18nProvider key={locale} locale={locale}>{provider ? <DataSourceProvider source={provider}>{grids}</DataSourceProvider> : grids}</I18nProvider>
}

function openImage(position = 1, total = 1) {
  const button = screen.getByRole("button", { name: t("post.media.openImage", { position, total }) })
  button.focus()
  fireEvent.click(button)
  return button
}

beforeEach(() => { session = signedIn() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe("PostMediaGrid — lecteur des DTO vivants", () => {
  it("sans fournisseur, garde la grille historique et ses proportions sans ouvrir de lecteur", () => {
    render(tree([photo], null))
    const image = screen.getByRole("img", { name: photo.altText ?? "" })
    expect(image).toHaveAttribute("src", photo.url)
    expect(image).toHaveAttribute("width", "800")
    expect(image).toHaveAttribute("height", "600")
    expect(image).toHaveAttribute("loading", "lazy")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it.each(["fr", "en"] as const)("ouvre une photo seule au clavier en %s, puis ferme par Échap et rend le focus", async (locale) => {
    const translate = getFixedT(locale)
    const user = userEvent.setup()
    render(tree([photo], source, locale))
    const trigger = screen.getByRole("button", { name: translate("post.media.openImage", { position: 1, total: 1 }) })
    trigger.focus()
    await user.keyboard("{Enter}")

    const dialog = await screen.findByRole("dialog", { name: translate("post.media.viewer.title") })
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(within(dialog).getByRole("img", { name: photo.altText ?? "" })).toHaveAttribute("src", photo.url)
    expect(within(dialog).getByRole("img")).toHaveAttribute("width", "800")
    expect(within(dialog).getByRole("status")).toHaveTextContent(normalize(translate("post.media.viewer.position", { position: 1, total: 1 })))
    expect(within(dialog).queryByRole("button", { name: translate("post.media.viewer.next") })).not.toBeInTheDocument()
    const close = within(dialog).getByRole("button", { name: translate("common.close") })
    await waitFor(() => expect(close).toHaveFocus())
    await user.keyboard("{Escape}")

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it("parcourt quatre images avec les boutons et les flèches, annonce la position et respecte les bornes", async () => {
    const user = userEvent.setup()
    render(tree(photos))
    openImage(1, 4)
    const dialog = await screen.findByRole("dialog")
    const previous = within(dialog).getByRole("button", { name: t("post.media.viewer.previous") })
    const next = within(dialog).getByRole("button", { name: t("post.media.viewer.next") })
    expect(previous).toBeDisabled()
    await user.click(next)
    expect(within(dialog).getByRole("img", { name: "Photo 2" })).toHaveAttribute("src", photos[1]?.url)
    const close = within(dialog).getByRole("button", { name: t("common.close") })
    close.focus()
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}")
    expect(within(dialog).getByRole("img", { name: "Photo 4" })).toBeInTheDocument()
    expect(next).toBeDisabled()
    expect(within(dialog).getByRole("status")).toHaveTextContent(normalize(t("post.media.viewer.position", { position: 4, total: 4 })))
    await user.keyboard("{ArrowLeft}")
    expect(within(dialog).getByRole("img", { name: "Photo 3" })).toBeInTheDocument()
    await user.click(previous)
    expect(within(dialog).getByRole("img", { name: "Photo 2" })).toBeInTheDocument()
  })

  it("agrandit la vidéo par un bouton séparé, met la grille en pause et conserve les commandes natives sans autoplay", async () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {})
    const clip: PostMediaView = { ...photo, kind: "video", url: "/recette-video.mp4", altText: "La vidéo de recette" }
    const { container } = render(tree([clip]))
    const gridVideo = container.querySelector("video")
    const trigger = screen.getByRole("button", { name: t("post.media.expandVideo") })
    expect(trigger.closest("video")).toBeNull()
    expect(gridVideo).toHaveAttribute("controls")
    expect(gridVideo).not.toHaveAttribute("autoplay")
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = await screen.findByRole("dialog")
    const video = within(dialog).getByLabelText(clip.altText ?? "")
    expect(video).toHaveAttribute("src", clip.url)
    expect(video).toHaveAttribute("controls")
    expect(video).toHaveAttribute("playsinline")
    expect(video).toHaveAttribute("preload", "metadata")
    expect(video).not.toHaveAttribute("autoplay")
    expect(pause).toHaveBeenCalledOnce()
  })

  it.each([
    { kind: "image" as const, withheld: "scan_pending" as const },
    { kind: "image" as const, withheld: "quarantined" as const },
    { kind: "video" as const, withheld: "scan_pending" as const },
    { kind: "video" as const, withheld: "quarantined" as const },
  ])("la retenue $withheld domine une URL de $kind incohérente dans la grille", ({ kind, withheld }) => {
    const { container } = render(tree([{ ...photo, kind, withheld, url: "/ne-jamais-delivrer" }]))
    const label = t(withheld === "scan_pending" ? "post.media.scanPending" : "post.media.quarantined")
    expect(screen.getByRole("img", { name: label })).toBeInTheDocument()
    expect(container.querySelector("img,video")).toBeNull()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("referme immédiatement le lecteur si une image ouverte est retenue et ne conserve aucune ancienne URL", async () => {
    const view = render(tree())
    openImage()
    await screen.findByRole("dialog")
    view.rerender(tree([{ ...photo, withheld: "quarantined" }]))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(document.querySelector(`img[src="${photo.url}"]`)).toBeNull()
    expect(screen.getByRole("img", { name: t("post.media.quarantined") })).toBeInTheDocument()
    view.rerender(tree())
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    openImage()
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })

  it("ne monte jamais l'URL retenue lorsque la navigation atteint sa place dans la galerie", async () => {
    render(tree([photo, { ...photo, url: "/retenue-au-milieu.png", withheld: "scan_pending" }]))
    openImage(1, 2)
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: t("post.media.viewer.next") }))

    expect(within(dialog).getByRole("img", { name: t("post.media.scanPending") })).toBeInTheDocument()
    expect(dialog.querySelector("img,video")).toBeNull()
    expect(document.querySelector('[src="/retenue-au-milieu.png"]')).toBeNull()
  })

  it("un changement de source ou de personne ferme la lecture et l'ouverture suivante repart du média choisi", async () => {
    const view = render(tree(photos))
    openImage(3, 4)
    await screen.findByRole("dialog")
    const replacement = { ...source }
    view.rerender(tree(photos, replacement))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    openImage(2, 4)
    await screen.findByRole("dialog")
    session = signedIn({ ...member, personId: "person-other" })
    view.rerender(tree(photos, replacement))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    openImage(1, 4)
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("img", { name: "Photo 1" })).toBeInTheDocument()
  })

  it("le changement de droit ferme le lecteur tout en conservant la lecture autorisée en attente", async () => {
    const view = render(tree())
    openImage()
    await screen.findByRole("dialog")
    session = signedIn({ ...member, status: "en_attente", canPublish: false })
    view.rerender(tree())
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    openImage()
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })

  it.each(["anonymous", "loading", "error", "suspended", "root_suspended", "membership_missing", "reader_mismatch"] as const)("ferme les sources et le lecteur si le contexte devient %s", async (state) => {
    const view = render(tree())
    openImage()
    await screen.findByRole("dialog")
    if (state === "anonymous") session = { status: "ready", data: { status: "anonymous" } }
    else if (state === "loading") session = { status: "loading" }
    else if (state === "error") session = { status: "error", code: "not_signed_in" }
    else if (state === "suspended") session = signedIn({ ...member, status: "suspendue", canPublish: false })
    else if (state === "root_suspended") session = signedIn({ ...member, root: { ...member.root, status: "suspendue" } })
    else session = { status: "ready", data: { status: "signed_in", account: { id: "person-other", idn: null, local: null, nameHints: {} }, membership: state === "membership_missing" ? null : member } }
    view.rerender(tree())

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(document.querySelector("img[src],video[src]")).toBeNull()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("retirer les médias du DTO ferme également la lecture", async () => {
    const view = render(tree())
    openImage()
    await screen.findByRole("dialog")
    view.rerender(tree([]))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(document.querySelector("img[src],video[src]")).toBeNull()
  })

  it("un seul lecteur peut s'ouvrir même avec deux déclencheurs actionnés avant le rendu suivant", async () => {
    render(tree([photo], source, "fr", [{ ...photo, url: "/autre-grille.png", altText: "Autre grille" }]))
    const triggers = screen.getAllByRole("button", { name: t("post.media.openImage", { position: 1, total: 1 }) })
    const first = triggers[0]!
    const second = triggers[1]!
    first.focus()
    act(() => { fireEvent.click(first); fireEvent.click(second) })

    const dialog = await screen.findByRole("dialog")
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    expect(within(dialog).getByRole("img", { name: photo.altText ?? "" })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: t("common.close") }))
    second.focus()
    fireEvent.click(second)
    expect(within(await screen.findByRole("dialog")).getByRole("img", { name: "Autre grille" })).toBeInTheDocument()
  })
})

it("garde les médias en aperçu non interactif dans une feuille de création", () => {
  render(<I18nProvider locale="fr"><DataSourceProvider source={source}><PostMediaGrid media={[photo]} interactive={false} /></DataSourceProvider></I18nProvider>)
  expect(screen.getByRole("img", { name: photo.altText! })).toHaveAttribute("src", photo.url)
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})
