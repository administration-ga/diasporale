// @vitest-environment jsdom
import { useNetwork, useRoutes } from "@antsia/api/network"
import type { AlbumComposerProps, AlbumsSectionProps } from "@antsia/social-features/albums"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { IcomNetwork } from "@/components/icom"
import { routes } from "@/lib/routes"

import { ProfileAlbums } from "./profile-albums"

const mocks = vi.hoisted(() => ({
  network: null as IcomNetwork | null,
  push: vi.fn(),
  replace: vi.fn(),
  section: vi.fn(),
  composer: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  usePathname: () => "/profil/awa.demo",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

// Les hôtes de communication ne participent pas à cet îlot de lecture : les
// isoler évite de charger leurs médias et feuilles LiveKit dans ce test.
vi.mock("@antsia/social-features/shell", () => ({ CommunicationShell: () => null }))
vi.mock("@antsia/social-features/messagerie", () => ({
  conversationHref: vi.fn(),
  dockStore: {},
  draftKey: vi.fn(),
}))

// L'îlot reste réel : ces surfaces doivent recevoir le réseau de lecture,
// la charte et les routes DIASPORALE, même sans droit de publication.
vi.mock("@/components/icom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/icom")>()),
  useEngineNetwork: () => mocks.network,
}))

vi.mock("@antsia/social-features/albums", () => ({
  AlbumsSection: (props: AlbumsSectionProps) => {
    const network = useNetwork()
    const engineRoutes = useRoutes()
    mocks.section({ ...props, network, profileHref: engineRoutes.profile(props.handle) })
    return (
      <div role="group" aria-label="Albums du moteur">
        {props.onCreate ? (
          <button type="button" onClick={props.onCreate}>Créer un album</button>
        ) : null}
      </div>
    )
  },
  AlbumComposer: (props: AlbumComposerProps) => {
    const network = useNetwork()
    mocks.composer({ ...props, network })
    return (
      <div role="group" aria-label="Composeur du moteur">
        <button type="button" onClick={props.onCancel}>Annuler</button>
        <button type="button" onClick={() => props.onPublished?.("album publié/1")}>Publier</button>
      </div>
    )
  },
}))

const profile: ComponentProps<typeof ProfileAlbums> = {
  handle: "awa.demo",
  isSelf: true,
  canPublish: true,
  preview: false,
  variant: "albums",
  create: false,
}

beforeEach(() => {
  mocks.network = {
    networkId: "networks_diasporale",
    slug: "diasporale",
    personId: "persons_awa",
  } as IcomNetwork
  vi.clearAllMocks()
})

afterEach(cleanup)

describe("ProfileAlbums — les albums du moteur dans le profil diaspora", () => {
  it("un membre en attente lit les albums dans DIASPORALE sans entrée de création", () => {
    render(<ProfileAlbums {...profile} canPublish={false} />)

    expect(screen.getByRole("group", { name: "Albums du moteur" })).toBeInTheDocument()
    expect(mocks.section).toHaveBeenLastCalledWith({
      handle: profile.handle,
      isSelf: true,
      variant: "albums",
      onCreate: undefined,
      profileHref: routes.profile(profile.handle),
      network: expect.objectContaining({
        networkId: "networks_diasporale",
        slug: "diasporale",
        personId: "persons_awa",
        charte: "diasporale",
        storagePrefix: "antsia:diasporale:",
      }),
    })
    expect(screen.queryByRole("button", { name: "Créer un album" })).not.toBeInTheDocument()
    expect(mocks.composer).not.toHaveBeenCalled()
  })

  it("la création sur son onglet Albums ouvre l'adresse du composeur", () => {
    render(<ProfileAlbums {...profile} />)

    fireEvent.click(screen.getByRole("button", { name: "Créer un album" }))

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(routes.newAlbum(profile.handle), { scroll: false })
    expect(mocks.composer).not.toHaveBeenCalled()
  })

  it.each([
    { name: "chez autrui", changes: { isSelf: false }, renderedSelf: false },
    { name: "dans Photos", changes: { variant: "photos" as const }, renderedSelf: true },
    { name: "sans droit de publier", changes: { canPublish: false }, renderedSelf: true },
  ])("refuse la création $name même si l'adresse la demande", ({ changes, renderedSelf }) => {
    render(<ProfileAlbums {...profile} {...changes} create />)

    expect(screen.getByRole("group", { name: "Albums du moteur" })).toBeInTheDocument()
    expect(mocks.section).toHaveBeenLastCalledWith(expect.objectContaining({
      isSelf: renderedSelf,
      onCreate: undefined,
    }))
    expect(screen.queryByRole("button", { name: "Créer un album" })).not.toBeInTheDocument()
    expect(mocks.composer).not.toHaveBeenCalled()
  })

  it("ne monte aucune surface moteur en aperçu même si l'adresse demande une création", () => {
    const { container } = render(<ProfileAlbums {...profile} preview create />)

    expect(container).toBeEmptyDOMElement()
    expect(mocks.section).not.toHaveBeenCalled()
    expect(mocks.composer).not.toHaveBeenCalled()
  })

  it.each([false, true])("ne monte aucune surface moteur en démonstration (création : %s)", (create) => {
    mocks.network = null
    const { container } = render(<ProfileAlbums {...profile} create={create} />)

    expect(container).toBeEmptyDOMElement()
    expect(mocks.section).not.toHaveBeenCalled()
    expect(mocks.composer).not.toHaveBeenCalled()
  })

  it("l'intention de l'adresse pilote le composeur après navigation sur le même profil", () => {
    const { rerender } = render(<ProfileAlbums {...profile} />)
    expect(screen.queryByRole("group", { name: "Composeur du moteur" })).not.toBeInTheDocument()

    rerender(<ProfileAlbums {...profile} create />)
    expect(screen.getByRole("group", { name: "Composeur du moteur" })).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Albums du moteur" })).not.toBeInTheDocument()
    expect(mocks.composer).toHaveBeenLastCalledWith(expect.objectContaining({
      handle: profile.handle,
      network: expect.objectContaining({ networkId: "networks_diasporale", slug: "diasporale" }),
    }))

    rerender(<ProfileAlbums {...profile} />)
    expect(screen.getByRole("group", { name: "Albums du moteur" })).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Composeur du moteur" })).not.toBeInTheDocument()
  })

  it("annuler revient à l'adresse de son onglet Albums sans déplacer le défilement", () => {
    render(<ProfileAlbums {...profile} create />)

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))

    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(routes.profileTab(profile.handle, "albums"), { scroll: false })
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("publier ouvre la galerie de l'album avec l'identifiant échappé", () => {
    render(<ProfileAlbums {...profile} create />)

    fireEvent.click(screen.getByRole("button", { name: "Publier" }))

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(routes.album(profile.handle, "album publié/1"))
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})
