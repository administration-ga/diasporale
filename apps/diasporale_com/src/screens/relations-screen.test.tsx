// @vitest-environment jsdom
import { useNetwork, useRoutes } from "@antsia/api/network"
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { MembershipView } from "@diasporale/features/data"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useState, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { IcomNetwork, IcomState } from "@/components/icom"
import type { EnginePersonalConnectionsProps } from "@/components/personal-connections"
import { routes } from "@/lib/routes"

import { RelationsScreen } from "./relations-screen"

const mocks = vi.hoisted(() => ({
  membership: null as MembershipView | null,
  network: null as IcomNetwork | null,
  icom: { status: "off", reason: "demo" } as IcomState,
  search: "",
  gate: vi.fn(),
  adapter: vi.fn(),
  follows: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({}),
  usePathname: () => "/relations",
  useSearchParams: () => new URLSearchParams(mocks.search),
  useParams: () => ({}),
}))

// La garde et le chrome sont isolés : ces tests vérifient leur branchement,
// pas l'autorisation, qui reste vérifiée par le moteur.
vi.mock("@/components/gate", () => ({
  Gate: (props: { require: "member"; children: (session: { membership: MembershipView | null }) => ReactNode }) => {
    mocks.gate(props.require)
    return <>{props.children({ membership: mocks.membership })}</>
  },
  GateSkeleton: () => <div role="status" aria-label="Chargement du réseau" />,
}))
vi.mock("@/components/app-shell", () => ({
  AppShell: (props: { children: ReactNode }) => <>{props.children}</>,
}))

// La communication n'est pas montée par cet écran ; son îlot réseau reste réel.
vi.mock("@antsia/social-features/shell", () => ({ CommunicationShell: () => null }))
vi.mock("@antsia/social-features/messagerie", () => ({
  conversationHref: vi.fn(),
  dockStore: {},
  draftKey: vi.fn(),
}))
vi.mock("@/components/icom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/icom")>()),
  useEngineNetwork: () => mocks.network,
  useIcomState: () => mocks.icom,
}))

// Le contenu moteur est remplacé par une sonde : aucun abonnement Convex réel.
// Son état local permet de constater un remontage lors d'un changement d'identité.
vi.mock("@/components/personal-connections", () => ({
  EnginePersonalConnections: (props: EnginePersonalConnectionsProps) => {
    const network = useNetwork()
    const engineRoutes = useRoutes()
    const [marker, setMarker] = useState("")
    mocks.adapter({ ...props, network, profileHref: engineRoutes.profile("awa.demo") })
    return (
      <section aria-label="Liste personnelle du moteur" data-kind={props.kind}>
        <input aria-label="Repère de montage" value={marker} onChange={(event) => setMarker(event.target.value)} />
      </section>
    )
  },
}))

vi.mock("@antsia/social-features/reseau-personnel", () => ({
  FollowsSection: (props: { discover?: { href: string; label: string } }) => {
    const network = useNetwork()
    const engineRoutes = useRoutes()
    const [marker, setMarker] = useState("")
    mocks.follows({ ...props, network, profileHref: engineRoutes.profile("awa.demo") })
    return (
      <section aria-label="Mes abonnements du moteur">
        <input aria-label="Repère des abonnements" value={marker} onChange={(event) => setMarker(event.target.value)} />
        {props.discover ? <a href={props.discover.href}>{props.discover.label}</a> : null}
      </section>
    )
  },
}))

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

const network = { networkId: "networks_diasporale", slug: "diasporale", personId: membership.personId } as IcomNetwork

function screenTree(locale: "fr" | "en" = "fr") {
  return <I18nProvider locale={locale}><RelationsScreen /></I18nProvider>
}

beforeEach(() => {
  mocks.membership = membership
  mocks.network = network
  mocks.icom = { status: "on", network }
  mocks.search = ""
  vi.clearAllMocks()
})

afterEach(cleanup)

describe("/relations — mes liens dans le réseau DIASPORALE", () => {
  it("ouvre mes relations et rend les trois destinations comme des liens nommés", () => {
    render(screenTree())

    expect(mocks.gate).toHaveBeenLastCalledWith("member")
    expect(screen.getByRole("heading", { level: 1, name: "Mes relations" })).toBeInTheDocument()
    const navigation = screen.getByRole("navigation", { name: "Relations, demandes et abonnements" })
    const accepted = within(navigation).getByRole("link", { name: "Mes relations" })
    const received = within(navigation).getByRole("link", { name: "Demandes reçues" })
    const following = within(navigation).getByRole("link", { name: "Mes abonnements" })
    expect(accepted).toHaveAttribute("href", routes.relations())
    expect(accepted).toHaveAttribute("aria-current", "page")
    expect(received).toHaveAttribute("href", routes.relations("received"))
    expect(received).not.toHaveAttribute("aria-current")
    expect(following).toHaveAttribute("href", "/relations?onglet=abonnements")
    expect(following).not.toHaveAttribute("aria-current")
    expect(mocks.adapter).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "accepted", canRespond: true }))
    expect(mocks.follows).not.toHaveBeenCalled()
  })

  it("l'adresse des demandes sélectionne leur liste et réinitialise l'enfant en changeant d'onglet", () => {
    const { rerender } = render(screenTree())
    fireEvent.change(screen.getByRole("textbox", { name: "Repère de montage" }), { target: { value: "page suivante" } })

    mocks.search = "onglet=demandes"
    rerender(screenTree())

    const navigation = screen.getByRole("navigation", { name: "Relations, demandes et abonnements" })
    expect(within(navigation).getByRole("link", { name: "Demandes reçues" })).toHaveAttribute("aria-current", "page")
    expect(within(navigation).getByRole("link", { name: "Mes relations" })).not.toHaveAttribute("aria-current")
    expect(screen.getByRole("region", { name: "Liste personnelle du moteur" })).toHaveAttribute("data-kind", "received")
    expect(screen.getByRole("textbox", { name: "Repère de montage" })).toHaveValue("")
    expect(mocks.adapter).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "received" }))
  })

  it("monte la lecture des demandes d'un membre en attente dans le réseau et la charte, sans droit de répondre", () => {
    mocks.membership = { ...membership, status: "en_attente", canPublish: false }
    mocks.icom = { status: "off", reason: "not_allowed" }
    mocks.search = "onglet=demandes"
    render(screenTree())

    expect(screen.getByRole("region", { name: "Liste personnelle du moteur" })).toBeInTheDocument()
    expect(mocks.adapter).toHaveBeenLastCalledWith({
      kind: "received",
      canRespond: false,
      profileHref: routes.profile("awa.demo"),
      network: expect.objectContaining({
        networkId: network.networkId,
        personId: network.personId,
        slug: "diasporale",
        charte: "diasporale",
        storagePrefix: "antsia:diasporale:",
      }),
    })
  })

  it("réinitialise l'enfant quand le réseau ou la personne change, et conserve son état sinon", () => {
    const { rerender } = render(screenTree())
    fireEvent.change(screen.getByRole("textbox", { name: "Repère de montage" }), { target: { value: "ancienne pagination" } })
    rerender(screenTree())
    expect(screen.getByRole("textbox", { name: "Repère de montage" })).toHaveValue("ancienne pagination")

    mocks.network = { ...network, networkId: "networks_autre" as IcomNetwork["networkId"] }
    rerender(screenTree())
    expect(screen.getByRole("textbox", { name: "Repère de montage" })).toHaveValue("")
    expect(mocks.adapter).toHaveBeenLastCalledWith(expect.objectContaining({
      network: expect.objectContaining({ networkId: "networks_autre", personId: network.personId }),
    }))

    fireEvent.change(screen.getByRole("textbox", { name: "Repère de montage" }), { target: { value: "pagination d'Awa" } })
    mocks.network = { ...mocks.network, personId: "persons_ali" as IcomNetwork["personId"] }
    mocks.membership = { ...membership, personId: "persons_ali" }
    rerender(screenTree())
    expect(screen.getByRole("textbox", { name: "Repère de montage" })).toHaveValue("")
    expect(mocks.adapter).toHaveBeenLastCalledWith(expect.objectContaining({
      network: expect.objectContaining({ networkId: "networks_autre", personId: "persons_ali" }),
    }))
  })

  it("explique la limite de la démonstration sans monter l'adaptateur et ses requêtes moteur", () => {
    mocks.network = null
    mocks.icom = { status: "off", reason: "demo" }
    render(screenTree())

    expect(screen.getByText("Les relations sont indisponibles ici")).toBeInTheDocument()
    expect(screen.getByText("Cette liste est réservée aux membres actifs de DIASPORALE. En démonstration, explorez les gestes de relation depuis les profils.")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Liste personnelle du moteur" })).not.toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: "Relations, demandes et abonnements" })).not.toBeInTheDocument()
    expect(mocks.adapter).not.toHaveBeenCalled()
  })

  it("attend la résolution du réseau sans annoncer une liste vide ou indisponible", () => {
    mocks.network = null
    mocks.icom = { status: "loading" }
    render(screenTree())

    expect(screen.getByRole("status", { name: "Chargement du réseau" })).toBeInTheDocument()
    expect(screen.queryByText("Les relations sont indisponibles ici")).not.toBeInTheDocument()
    expect(screen.queryByText("Vous n’avez pas encore de relation")).not.toBeInTheDocument()
    expect(screen.queryByText("Aucune demande en attente")).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Liste personnelle du moteur" })).not.toBeInTheDocument()
    expect(mocks.adapter).not.toHaveBeenCalled()
  })
})

describe("/relations — abonnements du moteur", () => {
  beforeEach(() => { mocks.search = "onglet=abonnements" })

  it("sélectionne l'adresse des abonnements seule et envoie la découverte vers l'annuaire opt-in", () => {
    render(screenTree())
    const navigation = screen.getByRole("navigation", { name: "Relations, demandes et abonnements" })
    expect(within(navigation).getByRole("link", { name: "Mes abonnements" })).toHaveAttribute("aria-current", "page")
    expect(within(navigation).getByRole("link", { name: "Mes relations" })).not.toHaveAttribute("aria-current")
    expect(mocks.adapter).not.toHaveBeenCalled()
    expect(mocks.follows).toHaveBeenLastCalledWith({
      discover: { href: routes.members(), label: "Rencontrer des membres" },
      profileHref: routes.profile("awa.demo"),
      network: expect.objectContaining({
        networkId: network.networkId, personId: membership.personId,
        slug: "diasporale", charte: "diasporale", storagePrefix: "antsia:diasporale:",
      }),
    })
    expect(screen.getByRole("link", { name: "Rencontrer des membres" })).toHaveAttribute("href", routes.members())
  })

  it("monte la lecture des abonnements en attente même sans contexte de communication", () => {
    mocks.membership = { ...membership, status: "en_attente", canPublish: false }
    mocks.icom = { status: "off", reason: "not_allowed" }
    render(screenTree())
    expect(screen.getByRole("region", { name: "Mes abonnements du moteur" })).toBeInTheDocument()
    expect(mocks.follows).toHaveBeenCalledOnce()
    expect(mocks.adapter).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: /suivre/i })).not.toBeInTheDocument()
  })

  it("réinitialise les pages au changement de lecteur, de réseau et d'onglet", () => {
    const { rerender } = render(screenTree())
    const marker = () => screen.getByRole("textbox", { name: "Repère des abonnements" })
    fireEvent.change(marker(), { target: { value: "page 2" } })
    rerender(screenTree())
    expect(marker()).toHaveValue("page 2")

    mocks.network = { ...network, networkId: "networks_autre" as IcomNetwork["networkId"] }
    rerender(screenTree())
    expect(marker()).toHaveValue("")
    fireEvent.change(marker(), { target: { value: "Awa" } })
    mocks.network = { ...mocks.network, personId: "persons_ali" as IcomNetwork["personId"] }
    mocks.membership = { ...membership, personId: "persons_ali" }
    rerender(screenTree())
    expect(marker()).toHaveValue("")

    fireEvent.change(marker(), { target: { value: "Ali" } })
    mocks.search = "onglet=demandes"
    rerender(screenTree())
    expect(screen.queryByRole("region", { name: "Mes abonnements du moteur" })).not.toBeInTheDocument()
    mocks.search = "onglet=abonnements"
    rerender(screenTree())
    expect(marker()).toHaveValue("")
  })

  it.each(["", "onglet=demandes", "onglet=abonnements"])("attend un contexte cohérent avec l'adhésion avant toute lecture privée (%s)", (search) => {
    mocks.search = search
    mocks.membership = { ...membership, personId: "persons_ali" }
    render(screenTree())
    expect(screen.getByRole("status", { name: "Chargement du réseau" })).toBeInTheDocument()
    expect(mocks.adapter).not.toHaveBeenCalled()
    expect(mocks.follows).not.toHaveBeenCalled()
  })

  it("retire immédiatement la liste précédente pendant la résolution d'un nouveau lecteur", () => {
    const { rerender } = render(screenTree())
    fireEvent.change(screen.getByRole("textbox", { name: "Repère des abonnements" }), { target: { value: "pages d'Awa" } })
    mocks.follows.mockClear()

    mocks.membership = { ...membership, personId: "persons_ali" }
    rerender(screenTree())
    expect(screen.queryByRole("region", { name: "Mes abonnements du moteur" })).not.toBeInTheDocument()
    expect(screen.getByRole("status", { name: "Chargement du réseau" })).toBeInTheDocument()
    expect(mocks.follows).not.toHaveBeenCalled()

    mocks.network = { ...network, personId: "persons_ali" as IcomNetwork["personId"] }
    rerender(screenTree())
    expect(screen.getByRole("textbox", { name: "Repère des abonnements" })).toHaveValue("")
    expect(mocks.follows).toHaveBeenLastCalledWith(expect.objectContaining({ network: expect.objectContaining({ personId: "persons_ali" }) }))
  })

  it.each(["demo", "not_allowed"] as const)("ne monte aucune lecture sans réseau (%s)", (reason) => {
    mocks.network = null
    mocks.icom = { status: "off", reason }
    render(screenTree())
    expect(screen.getByText("Les relations sont indisponibles ici")).toBeInTheDocument()
    expect(mocks.follows).not.toHaveBeenCalled()
    expect(mocks.adapter).not.toHaveBeenCalled()
  })

  it("traduit l'onglet, sa navigation et la destination de découverte en anglais", () => {
    render(screenTree("en"))
    const navigation = screen.getByRole("navigation", { name: "Connections, requests and following" })
    expect(within(navigation).getByRole("link", { name: "Following" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Meet members" })).toHaveAttribute("href", routes.members())
    expect(mocks.follows).toHaveBeenLastCalledWith(expect.objectContaining({ discover: { href: routes.members(), label: "Meet members" } }))
  })

  it("une valeur d'onglet inconnue revient aux connexions", () => {
    mocks.search = "onglet=inconnu"
    render(screenTree())
    expect(mocks.adapter).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "accepted" }))
    expect(mocks.follows).not.toHaveBeenCalled()
  })
})
