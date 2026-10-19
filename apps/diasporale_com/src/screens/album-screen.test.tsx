// @vitest-environment jsdom
import { useNetwork, useRoutes } from "@antsia/api/network"
import type { AlbumComposerProps, AlbumPageProps } from "@antsia/social-features/albums"
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { MembershipView } from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { IcomNetwork } from "@/components/icom"
import { routes } from "@/lib/routes"

import { AlbumScreen } from "./album-screen"

const mocks = vi.hoisted(() => ({
  membership: null as MembershipView | null,
  network: null as IcomNetwork | null,
  search: "",
  push: vi.fn(),
  replace: vi.fn(),
  gate: vi.fn(),
  shell: vi.fn(),
  page: vi.fn(),
  composer: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  usePathname: () => "/profil/awa.demo/albums/album_1",
  useSearchParams: () => new URLSearchParams(mocks.search),
  useParams: () => ({}),
}))

vi.mock("@/components/gate", () => ({
  Gate: (props: { require: "member"; children: (session: { membership: MembershipView | null }) => ReactNode }) => {
    mocks.gate(props.require)
    return <>{props.children({ membership: mocks.membership })}</>
  },
}))

vi.mock("@/components/app-shell", () => ({
  AppShell: (props: { membership: MembershipView; children: ReactNode }) => {
    mocks.shell(props.membership)
    return <>{props.children}</>
  },
}))

vi.mock("@antsia/social-features/shell", () => ({ CommunicationShell: () => null }))
vi.mock("@antsia/social-features/messagerie", () => ({
  conversationHref: vi.fn(),
  dockStore: {},
  draftKey: vi.fn(),
}))

// L'îlot réel garantit aux deux feuilles le réseau et les routes du produit.
vi.mock("@/components/icom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/icom")>()),
  useEngineNetwork: () => mocks.network,
}))

vi.mock("@antsia/social-features/albums", () => ({
  AlbumPage: (props: AlbumPageProps) => {
    const network = useNetwork()
    const engineRoutes = useRoutes()
    mocks.page({ ...props, network, profileHref: engineRoutes.profile(props.handle) })
    return (
      <section aria-label="Galerie du moteur">
        {props.canEdit && props.onEdit ? (
          <button type="button" onClick={() => props.onEdit?.(props.albumId)}>Modifier</button>
        ) : null}
      </section>
    )
  },
  AlbumComposer: (props: AlbumComposerProps) => {
    const network = useNetwork()
    const engineRoutes = useRoutes()
    mocks.composer({ ...props, network, profileHref: engineRoutes.profile(props.handle) })
    return (
      <section aria-label="Composeur du moteur">
        <button type="button" onClick={props.onCancel}>Annuler</button>
        <button type="button" onClick={() => props.onPublished?.(props.albumId ?? "album_1")}>Publier</button>
      </section>
    )
  },
}))

const t = getFixedT("fr")
const membership: MembershipView = {
  personId: "persons_awa",
  handle: "awa.demo",
  displayName: "Awa",
  status: "declaree",
  badges: ["community"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1,
  verifiedSince: null,
  sponsoredBy: null,
  attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" },
  canPublish: true,
  rateTier: "reinforced",
  directoryVisibility: "hidden",
}

function tree(handle = "awa.demo", albumId = "album publié/1") {
  return <I18nProvider locale="fr"><AlbumScreen handle={handle} albumId={albumId} /></I18nProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.membership = membership
  mocks.network = { networkId: "networks_diasporale", slug: "diasporale", personId: membership.personId } as IcomNetwork
  mocks.search = ""
})

afterEach(cleanup)

describe("AlbumScreen — reprise d'un album dans DIASPORALE", () => {
  it("compose une adresse de reprise avec l'identifiant échappé une seule fois", () => {
    expect(routes.editAlbum("awa.demo", "album publié/1?x=%"))
      .toBe("/@awa.demo/albums/album%20publi%C3%A9%2F1%3Fx%3D%25?modifier=1")
  })

  it("monte la galerie propriétaire avec le réseau, la charte et les routes DIASPORALE", () => {
    render(tree())

    expect(mocks.gate).toHaveBeenLastCalledWith("member")
    expect(mocks.shell).toHaveBeenLastCalledWith(membership)
    expect(screen.getByRole("region", { name: "Galerie du moteur" })).toBeInTheDocument()
    expect(mocks.page).toHaveBeenLastCalledWith(expect.objectContaining({
      handle: membership.handle,
      albumId: "album publié/1",
      canEdit: true,
      onEdit: expect.any(Function),
      profileHref: routes.profile(membership.handle),
      network: expect.objectContaining({
        networkId: "networks_diasporale",
        slug: "diasporale",
        personId: membership.personId,
        charte: "diasporale",
        storagePrefix: "antsia:diasporale:",
      }),
    }))
    expect(mocks.composer).not.toHaveBeenCalled()
  })

  it("la commande de galerie ouvre la reprise sur l'adresse du même album", () => {
    render(tree())

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }))

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(routes.editAlbum(membership.handle, "album publié/1"), { scroll: false })
  })

  it("modifier=1 reprend le même album dans le composeur sous le réseau du lecteur", () => {
    mocks.search = "modifier=1"
    render(tree("@AWA.DEMO"))

    expect(screen.getByRole("region", { name: "Composeur du moteur" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Galerie du moteur" })).not.toBeInTheDocument()
    expect(mocks.composer).toHaveBeenLastCalledWith(expect.objectContaining({
      handle: membership.handle,
      albumId: "album publié/1",
      canPublish: true,
      profileHref: routes.profile(membership.handle),
      network: expect.objectContaining({ networkId: "networks_diasporale", personId: membership.personId, slug: "diasporale", charte: "diasporale" }),
    }))
    expect(mocks.page).not.toHaveBeenCalled()
  })

  it("annuler remplace l'adresse de reprise par celle de la galerie", () => {
    mocks.search = "modifier=1"
    render(tree())

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))

    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(routes.album(membership.handle, "album publié/1"), { scroll: false })
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("publier retourne à la galerie avec l'identifiant conservé", () => {
    mocks.search = "modifier=1"
    render(tree())

    fireEvent.click(screen.getByRole("button", { name: "Publier" }))

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(routes.album(membership.handle, "album publié/1"))
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("la navigation sur la même page alterne galerie et reprise", () => {
    const { rerender } = render(tree())
    mocks.search = "modifier=1"
    rerender(tree())
    expect(screen.getByRole("region", { name: "Composeur du moteur" })).toBeInTheDocument()

    mocks.search = ""
    rerender(tree())
    expect(screen.getByRole("region", { name: "Galerie du moteur" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Composeur du moteur" })).not.toBeInTheDocument()
  })

  it.each(["", "modifier=0", "modifier=true"])("conserve la galerie sans l'intention exacte de reprise (%s)", (search) => {
    mocks.search = search
    render(tree())

    expect(screen.getByRole("region", { name: "Galerie du moteur" })).toBeInTheDocument()
    expect(mocks.composer).not.toHaveBeenCalled()
  })

  it("un tiers ne monte jamais le composeur même avec modifier=1", () => {
    mocks.search = "modifier=1"
    render(tree("autre.membre"))

    expect(screen.getByRole("region", { name: "Galerie du moteur" })).toBeInTheDocument()
    expect(mocks.page).toHaveBeenLastCalledWith(expect.objectContaining({ handle: "autre.membre", canEdit: false, onEdit: undefined }))
    expect(screen.queryByRole("button", { name: "Modifier" })).not.toBeInTheDocument()
    expect(mocks.composer).not.toHaveBeenCalled()
  })

  it("un membre en attente lit la galerie sans commande d'édition ni composeur", () => {
    mocks.membership = { ...membership, status: "en_attente", canPublish: false }
    mocks.search = "modifier=1"
    render(tree())

    expect(screen.getByRole("region", { name: "Galerie du moteur" })).toBeInTheDocument()
    expect(mocks.page).toHaveBeenLastCalledWith(expect.objectContaining({ canEdit: false, onEdit: undefined }))
    expect(screen.queryByRole("button", { name: "Modifier" })).not.toBeInTheDocument()
    expect(mocks.composer).not.toHaveBeenCalled()
  })

  it("retire le composeur si le droit de publier disparaît", () => {
    mocks.search = "modifier=1"
    const { rerender } = render(tree())
    expect(screen.getByRole("region", { name: "Composeur du moteur" })).toBeInTheDocument()

    mocks.membership = { ...membership, status: "en_attente", canPublish: false }
    rerender(tree())

    expect(screen.getByRole("region", { name: "Galerie du moteur" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Composeur du moteur" })).not.toBeInTheDocument()
    expect(mocks.page).toHaveBeenLastCalledWith(expect.objectContaining({ canEdit: false, onEdit: undefined }))
  })

  it.each(["apercu=1", "apercu=1&modifier=1"])("masque toute surface d'album dans l'aperçu (%s)", (search) => {
    mocks.search = search
    render(tree())

    expect(screen.getByText(t("albums.previewUnavailableBody"))).toBeInTheDocument()
    expect(mocks.page).not.toHaveBeenCalled()
    expect(mocks.composer).not.toHaveBeenCalled()
  })

  it("ne monte aucune surface moteur en démonstration, même avec modifier=1", () => {
    mocks.network = null
    mocks.search = "modifier=1"
    render(tree())

    expect(screen.getByText(t("albums.unavailableBody"))).toBeInTheDocument()
    expect(mocks.page).not.toHaveBeenCalled()
    expect(mocks.composer).not.toHaveBeenCalled()
  })

  it("ne monte pas une galerie ou un composeur sous le réseau d'une ancienne session", () => {
    mocks.network = { networkId: "networks_diasporale", slug: "diasporale", personId: "persons_autre" } as IcomNetwork
    mocks.search = "modifier=1"
    render(tree())

    expect(screen.getByText(t("albums.unavailableTitle"))).toBeInTheDocument()
    expect(mocks.page).not.toHaveBeenCalled()
    expect(mocks.composer).not.toHaveBeenCalled()
  })

  it("ne décode pas une seconde fois le handle ou l'identifiant transmis par Next", () => {
    mocks.membership = { ...membership, handle: "a%25" }
    mocks.search = "modifier=1"
    render(tree("@A%25", "album%25"))

    expect(mocks.composer).toHaveBeenLastCalledWith(expect.objectContaining({ handle: "a%25", albumId: "album%25" }))
  })

  it("ne monte rien tant que la garde ne fournit aucune adhésion", () => {
    mocks.membership = null
    mocks.search = "modifier=1"
    const { container } = render(tree())

    expect(container).toBeEmptyDOMElement()
    expect(mocks.page).not.toHaveBeenCalled()
    expect(mocks.composer).not.toHaveBeenCalled()
  })
})
