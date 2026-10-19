import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { act, type ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { PostView } from "../../data/types"
import { getFixedT } from "../../i18n"
import { RoutingProvider, type FeatureRoutes } from "../../routing"
import { renderWithI18n } from "../../test-utils"
import { PostCard } from "./post-card"
import { PostShareProvider } from "../post-share"

const mocks = vi.hoisted(() => ({ menu: vi.fn(), copied: vi.fn() }))

// Le menu a son propre contrat de données ; la carte lui transmet aussi l'identité neutralisée.
vi.mock("../post-menu", () => ({ PostMenu: (props: { post: PostView }) => { mocks.menu(props.post); return null } }))
vi.mock("sonner", () => ({ toast: { success: mocks.copied, error: vi.fn() } }))

const routes: FeatureRoutes = {
  profile: vi.fn((handle: string) => `/@${handle}`),
  post: (id) => `/publication/${id}`,
  page: vi.fn((handle: string) => `/pages/${handle}`),
  hub: (country) => `/pays/${country}`,
  feed: () => "/fil",
  sponsor: () => "/parrainer",
  settings: () => "/parametres",
  attestation: () => "/attestation",
  enter: () => "/entrer",
}
const now = Date.UTC(2026, 9, 17, 12)
const post: PostView = {
  id: "post-conserve",
  author: { kind: "person", id: "person-retiree", handle: "", displayName: "", badges: [] },
  body: "Le contenu de cette publication est conservé.",
  media: [],
  share: null,
  shareCount: 0,
  scope: { reach: "diaspora" },
  audience: "public",
  visibility: "network",
  moderation: "published",
  createdAt: now - 60_000,
  reactionCount: 2,
  commentCount: 1,
  myReaction: null,
  isMine: false,
  bookmarked: false,
  edited: false,
}

function Link(props: ComponentProps<"a">) { return <a {...props} /> }

function mount(value = post, locale: "fr" | "en" = "fr", share: ((value: PostView) => void) | null = null) {
  return renderWithI18n(
    <RoutingProvider routes={routes} Link={Link}><PostShareProvider value={share}><PostCard post={value} now={now} canReact={false} /></PostShareProvider></RoutingProvider>,
    locale,
  )
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { vi.restoreAllMocks() })

describe("PostCard — auteur retiré et contenu conservé", () => {
  it.each(["fr", "en"] as const)("rend un auteur neutre traduit en %s sans lien de profil ni badges", (locale) => {
    const someone = getFixedT(locale)("bell.someone")
    const { container } = mount(post, locale)

    expect(screen.getByRole("article", { name: someone })).toBeInTheDocument()
    expect(screen.getByText(someone).tagName).toBe("SPAN")
    expect(screen.queryByRole("link", { name: someone })).not.toBeInTheDocument()
    expect(routes.profile).not.toHaveBeenCalled()
    expect(container.querySelector('[data-slot="trust-badge"]')).toBeNull()
    const avatar = container.querySelector('[data-slot="avatar"]')
    expect(avatar).toHaveAttribute("aria-hidden", "true")
    expect(avatar).toHaveClass("bg-muted", "text-muted-foreground", "rounded-full")
    expect(screen.getByText(post.body)).toBeInTheDocument()
    expect(container.querySelector('a[href="/publication/post-conserve"]')).toBeInTheDocument()
  })

  it("ignore un nom et des badges retenus quand l'adresse du profil a disparu, y compris dans les actions", () => {
    const inconsistent: PostView = { ...post, author: { ...post.author, displayName: "Nom retenu à masquer", badges: ["verified", "public_agent"] } }
    const { container } = mount(inconsistent)

    expect(screen.queryByText("Nom retenu à masquer")).not.toBeInTheDocument()
    expect(screen.getByRole("article", { name: getFixedT("fr")("bell.someone") })).toBeInTheDocument()
    expect(container.querySelector('[data-slot="trust-badge"]')).toBeNull()
    expect(routes.profile).not.toHaveBeenCalled()
    expect(mocks.menu).toHaveBeenLastCalledWith(expect.objectContaining({
      id: post.id,
      author: { ...post.author, displayName: getFixedT("fr")("bell.someone"), badges: [] },
    }))
    expect(inconsistent.author.displayName).toBe("Nom retenu à masquer")
    expect(screen.getByText(post.body)).toBeInTheDocument()
  })

  it("conserve le nom, le lien de page, l'avatar carré, les badges et le lien de publication d'une page normale", () => {
    const page: PostView = { ...post, author: { kind: "page", id: "page-association", handle: "association.demo", displayName: "Association de recette", badges: ["official"] } }
    const { container } = mount(page)

    expect(screen.getByRole("link", { name: page.author.displayName })).toHaveAttribute("href", "/pages/association.demo")
    expect(routes.page).toHaveBeenCalledWith(page.author.handle)
    expect(routes.profile).not.toHaveBeenCalled()
    expect(container.querySelector('[data-slot="avatar"]')).toHaveClass("rounded-lg")
    expect(container.querySelector('[data-badge="official"]')).toBeInTheDocument()
    expect(screen.getByText(post.body)).toBeInTheDocument()
    expect(container.querySelector('a[href="/publication/post-conserve"]')).toBeInTheDocument()
    expect(mocks.menu).toHaveBeenLastCalledWith(page)
  })
})

describe("PostCard — partage accessible en lecture seule", () => {
  it.each(["fr", "en"] as const)("copie le lien courant en %s sans donner de droit de citation et rend le focus au bouton", async (locale) => {
    const user = userEvent.setup()
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined)
    const t = getFixedT(locale)
    mount(post, locale)
    const trigger = screen.getByRole("button", { name: t("post.share") })
    expect(screen.getByRole("button", { name: t("post.react") })).toBeDisabled()
    await user.click(trigger)

    const link = screen.getByRole("textbox", { name: t("post.shareActions.link") })
    const expected = new URL(routes.post(post.id), window.location.origin).href
    expect(link).toHaveValue(expected)
    expect(link).toHaveAttribute("readonly")
    expect(link).toHaveFocus()
    expect(screen.queryByRole("button", { name: t("post.shareActions.quote") })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: t("post.shareActions.copyLink") }))
    expect(write).toHaveBeenCalledWith(expected)
    expect(mocks.copied).toHaveBeenCalledWith(t("post.shareActions.copied"))

    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it("un refus du presse-papiers garde le lien sélectionné et ne prétend pas l'avoir copié", async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new DOMException("denied", "NotAllowedError"))
    const t = getFixedT("fr")
    mount()
    await user.click(screen.getByRole("button", { name: t("post.share") }))
    await user.click(screen.getByRole("button", { name: t("post.shareActions.copyLink") }))
    const link = screen.getByRole("textbox", { name: t("post.shareActions.link") }) as HTMLInputElement
    // Le texte brut conserve l’espace insécable française, normalisée par les requêtes textuelles.
    expect((await screen.findByRole("alert")).textContent).toBe(t("post.shareActions.copyFailed"))
    expect(link).toHaveFocus()
    expect(link.selectionStart).toBe(0)
    expect(link.selectionEnd).toBe(link.value.length)
    expect(mocks.copied).not.toHaveBeenCalled()
  })

  it("conserve le focus et une seule copie tant que le presse-papiers n'a pas répondu", async () => {
    const user = userEvent.setup()
    let complete: () => void = () => undefined
    const write = vi.spyOn(navigator.clipboard, "writeText").mockImplementation(() => new Promise<void>((resolve) => { complete = resolve }))
    const t = getFixedT("fr")
    mount()
    await user.click(screen.getByRole("button", { name: t("post.share") }))
    const copy = screen.getByRole("button", { name: t("post.shareActions.copyLink") })
    await user.click(copy)
    expect(copy).not.toBeDisabled()
    expect(copy).toHaveAttribute("aria-disabled", "true")
    expect(copy).toHaveFocus()
    await user.click(copy)
    expect(write).toHaveBeenCalledTimes(1)
    await act(async () => complete())
    expect(copy).toHaveAttribute("aria-disabled", "false")
    expect(copy).toHaveFocus()
  })

  it("conserve le partage cité existant pour un membre autorisé", async () => {
    const user = userEvent.setup(), share = vi.fn()
    const value: PostView = { ...post, author: { ...post.author, handle: "recette", displayName: "Recette" } }
    const t = getFixedT("fr")
    mount(value, "fr", share)
    await user.click(screen.getByRole("button", { name: t("post.share") }))
    await user.click(screen.getByRole("button", { name: t("post.shareActions.quote") }))
    expect(share).toHaveBeenCalledExactlyOnceWith(value)
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("une audience limitée permet de copier l'adresse mais ne propose pas de citation", async () => {
    const user = userEvent.setup(), share = vi.fn()
    const t = getFixedT("fr")
    mount({ ...post, audience: "connections" }, "fr", share)
    await user.click(screen.getByRole("button", { name: t("post.share") }))
    expect(screen.getByRole("textbox", { name: t("post.shareActions.link") })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("post.shareActions.quote") })).not.toBeInTheDocument()
    expect(share).not.toHaveBeenCalled()
  })

  it("ne propose pas de partager une publication encore en relecture", () => {
    const t = getFixedT("fr")
    mount({ ...post, moderation: "pending_review", isMine: true }, "fr", vi.fn())
    expect(screen.queryByRole("button", { name: t("post.share") })).not.toBeInTheDocument()
  })
})
