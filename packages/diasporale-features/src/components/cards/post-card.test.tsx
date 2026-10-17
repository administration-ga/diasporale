import { screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { PostView } from "../../data/types"
import { getFixedT } from "../../i18n"
import { RoutingProvider, type FeatureRoutes } from "../../routing"
import { renderWithI18n } from "../../test-utils"
import { PostCard } from "./post-card"

const mocks = vi.hoisted(() => ({ menu: vi.fn() }))

// Le menu a son propre contrat de données ; la carte lui transmet aussi l'identité neutralisée.
vi.mock("../post-menu", () => ({ PostMenu: (props: { post: PostView }) => { mocks.menu(props.post); return null } }))

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

function mount(value = post, locale: "fr" | "en" = "fr") {
  return renderWithI18n(
    <RoutingProvider routes={routes} Link={Link}><PostCard post={value} now={now} canReact={false} /></RoutingProvider>,
    locale,
  )
}

beforeEach(() => { vi.clearAllMocks() })

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
