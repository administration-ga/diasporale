// @vitest-environment jsdom
import { useNetwork, useRoutes } from "@antsia/api/network"
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { MembershipView } from "@diasporale/features/data"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
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
  sent: vi.fn(),
  blocked: vi.fn(),
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
  SentInvitationsSection: (props: { discover?: { href: string; label: string } }) => {
    const network = useNetwork()
    const engineRoutes = useRoutes()
    const [marker, setMarker] = useState("")
    mocks.sent({ ...props, network, profileHref: engineRoutes.profile("awa.demo") })
    return (
      <section aria-label="Demandes envoyées du moteur">
        <input aria-label="Repère des demandes envoyées" value={marker} onChange={(event) => setMarker(event.target.value)} />
        {props.discover ? <a href={props.discover.href}>{props.discover.label}</a> : null}
      </section>
    )
  },
  BlockedPeopleSection: (props: Record<string, never>) => {
    const network = useNetwork()
    const engineRoutes = useRoutes()
    const [marker, setMarker] = useState("")
    mocks.blocked({ ...props, network, profileHref: engineRoutes.profile("awa.demo") })
    return (
      <section aria-label="Personnes bloquées du moteur">
        <input aria-label="Repère des personnes bloquées" value={marker} onChange={(event) => setMarker(event.target.value)} />
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
  it("ouvre mes relations et rend les cinq destinations comme des liens nommés", () => {
    render(screenTree())

    expect(mocks.gate).toHaveBeenLastCalledWith("member")
    expect(screen.getByRole("heading", { level: 1, name: "Mes relations" })).toBeInTheDocument()
    const navigation = screen.getByRole("navigation", { name: "Relations, demandes, abonnements et blocages" })
    const accepted = within(navigation).getByRole("link", { name: "Mes relations" })
    const received = within(navigation).getByRole("link", { name: "Demandes reçues" })
    const following = within(navigation).getByRole("link", { name: "Mes abonnements" })
    const sent = within(navigation).getByRole("link", { name: "Demandes envoyées" })
    const blocked = within(navigation).getByRole("link", { name: "Personnes bloquées" })
    expect(within(navigation).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Mes relations", "Demandes reçues", "Demandes envoyées", "Mes abonnements", "Personnes bloquées",
    ])
    expect(accepted).toHaveAttribute("href", routes.relations())
    expect(accepted).toHaveAttribute("aria-current", "page")
    expect(received).toHaveAttribute("href", routes.relations("received"))
    expect(received).not.toHaveAttribute("aria-current")
    expect(following).toHaveAttribute("href", "/relations?onglet=abonnements")
    expect(following).not.toHaveAttribute("aria-current")
    expect(sent).toHaveAttribute("href", "/relations?onglet=envoyees")
    expect(sent).not.toHaveAttribute("aria-current")
    expect(blocked).toHaveAttribute("href", "/relations?onglet=blocages")
    expect(blocked).not.toHaveAttribute("aria-current")
    expect(mocks.adapter).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "accepted", canRespond: true }))
    expect(mocks.follows).not.toHaveBeenCalled()
    expect(mocks.sent).not.toHaveBeenCalled()
    expect(mocks.blocked).not.toHaveBeenCalled()
  })

  it("l'adresse des demandes sélectionne leur liste et réinitialise l'enfant en changeant d'onglet", () => {
    const { rerender } = render(screenTree())
    fireEvent.change(screen.getByRole("textbox", { name: "Repère de montage" }), { target: { value: "page suivante" } })

    mocks.search = "onglet=demandes"
    rerender(screenTree())

    const navigation = screen.getByRole("navigation", { name: "Relations, demandes, abonnements et blocages" })
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
    expect(screen.queryByRole("navigation", { name: "Relations, demandes, abonnements et blocages" })).not.toBeInTheDocument()
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
    const navigation = screen.getByRole("navigation", { name: "Relations, demandes, abonnements et blocages" })
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

  it.each(["", "onglet=demandes", "onglet=envoyees", "onglet=abonnements", "onglet=blocages"])("attend un contexte cohérent avec l'adhésion avant toute lecture privée (%s)", (search) => {
    mocks.search = search
    mocks.membership = { ...membership, personId: "persons_ali" }
    render(screenTree())
    expect(screen.getByRole("status", { name: "Chargement du réseau" })).toBeInTheDocument()
    expect(mocks.adapter).not.toHaveBeenCalled()
    expect(mocks.follows).not.toHaveBeenCalled()
    expect(mocks.sent).not.toHaveBeenCalled()
    expect(mocks.blocked).not.toHaveBeenCalled()
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
    const navigation = screen.getByRole("navigation", { name: "Connections, requests, following and blocks" })
    expect(within(navigation).getByRole("link", { name: "Following" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Meet members" })).toHaveAttribute("href", routes.members())
    expect(mocks.follows).toHaveBeenLastCalledWith(expect.objectContaining({ discover: { href: routes.members(), label: "Meet members" } }))
  })

  it.each(["inconnu", "constructor", "__proto__"])("une valeur d'onglet inconnue revient aux connexions (%s)", (tab) => {
    mocks.search = `onglet=${tab}`
    render(screenTree())
    expect(mocks.adapter).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "accepted" }))
    expect(mocks.follows).not.toHaveBeenCalled()
    expect(mocks.sent).not.toHaveBeenCalled()
    expect(mocks.blocked).not.toHaveBeenCalled()
  })
})

const removalViews = [
  {
    kind: "sent",
    search: "onglet=envoyees",
    frenchLabel: "Demandes envoyées",
    englishLabel: "Sent requests",
    region: "Demandes envoyées du moteur",
    marker: "Repère des demandes envoyées",
  },
  {
    kind: "blocked",
    search: "onglet=blocages",
    frenchLabel: "Personnes bloquées",
    englishLabel: "Blocked people",
    region: "Personnes bloquées du moteur",
    marker: "Repère des personnes bloquées",
  },
] as const

function expectNoEngineLists() {
  expect(screen.queryByRole("region")).not.toBeInTheDocument()
  expect(mocks.adapter).not.toHaveBeenCalled()
  expect(mocks.follows).not.toHaveBeenCalled()
  expect(mocks.sent).not.toHaveBeenCalled()
  expect(mocks.blocked).not.toHaveBeenCalled()
}

describe.each(removalViews)("/relations — $frenchLabel", (view) => {
  beforeEach(() => { mocks.search = view.search })

  it("sélectionne son adresse parmi cinq liens et monte seulement sa surface avec le réseau de lecture", () => {
    render(screenTree())

    expect(mocks.gate).toHaveBeenLastCalledWith("member")
    const navigation = screen.getByRole("navigation", { name: "Relations, demandes, abonnements et blocages" })
    const links = within(navigation).getAllByRole("link")
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      routes.relations(), routes.relations("received"), routes.relations("sent"), routes.relations("following"), routes.relations("blocked"),
    ])
    const selected = within(navigation).getByRole("link", { name: view.frenchLabel })
    expect(selected).toHaveAttribute("href", `/relations?${view.search}`)
    expect(selected).toHaveAttribute("aria-current", "page")
    expect(links.filter((link) => link.getAttribute("aria-current") === "page")).toEqual([selected])
    expect(screen.getAllByRole("region")).toHaveLength(1)
    expect(screen.getByRole("region", { name: view.region })).toBeInTheDocument()
    expect(mocks.adapter).not.toHaveBeenCalled()
    expect(mocks.follows).not.toHaveBeenCalled()
    expect(mocks[view.kind === "sent" ? "blocked" : "sent"]).not.toHaveBeenCalled()
    expect(mocks[view.kind]).toHaveBeenLastCalledWith({
      ...(view.kind === "sent" ? { discover: { href: routes.members(), label: "Rencontrer des membres" } } : {}),
      profileHref: routes.profile("awa.demo"),
      network: expect.objectContaining({
        networkId: network.networkId, personId: membership.personId,
        slug: "diasporale", charte: "diasporale", storagePrefix: "antsia:diasporale:",
      }),
    })
    if (view.kind === "sent") {
      expect(screen.getByRole("link", { name: "Rencontrer des membres" })).toHaveAttribute("href", routes.members())
    } else {
      expect(screen.queryByRole("link", { name: "Rencontrer des membres" })).not.toBeInTheDocument()
    }
  })

  it("reste ouverte au membre en attente sans lui imposer un contexte de communication", () => {
    mocks.membership = { ...membership, status: "en_attente", canPublish: false }
    mocks.icom = { status: "off", reason: "not_allowed" }
    render(screenTree())

    expect(screen.getByRole("region", { name: view.region })).toBeInTheDocument()
    expect(mocks[view.kind]).toHaveBeenLastCalledWith(expect.objectContaining({
      network: expect.objectContaining({ networkId: network.networkId, personId: membership.personId }),
    }))
    expect(mocks.adapter).not.toHaveBeenCalled()
    expect(mocks.follows).not.toHaveBeenCalled()
    expect(mocks[view.kind === "sent" ? "blocked" : "sent"]).not.toHaveBeenCalled()
  })

  it("préserve son état ordinaire puis le purge au changement de réseau, lecteur et onglet", () => {
    const { rerender } = render(screenTree())
    const marker = () => screen.getByRole("textbox", { name: view.marker })
    fireEvent.change(marker(), { target: { value: "page suivante" } })
    rerender(screenTree())
    expect(marker()).toHaveValue("page suivante")

    mocks.network = { ...network, networkId: "networks_autre" as IcomNetwork["networkId"] }
    rerender(screenTree())
    expect(marker()).toHaveValue("")
    expect(mocks[view.kind]).toHaveBeenLastCalledWith(expect.objectContaining({ network: expect.objectContaining({ networkId: "networks_autre" }) }))

    fireEvent.change(marker(), { target: { value: "pages d'Awa" } })
    mocks.network = { ...mocks.network, personId: "persons_ali" as IcomNetwork["personId"] }
    mocks.membership = { ...membership, personId: "persons_ali" }
    rerender(screenTree())
    expect(marker()).toHaveValue("")
    expect(mocks[view.kind]).toHaveBeenLastCalledWith(expect.objectContaining({ network: expect.objectContaining({ personId: "persons_ali" }) }))

    fireEvent.change(marker(), { target: { value: "pages d'Ali" } })
    mocks.search = "onglet=abonnements"
    rerender(screenTree())
    expect(screen.queryByRole("region", { name: view.region })).not.toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Mes abonnements du moteur" })).toBeInTheDocument()
    mocks.search = view.search
    rerender(screenTree())
    expect(marker()).toHaveValue("")
    expect(screen.queryByRole("region", { name: "Mes abonnements du moteur" })).not.toBeInTheDocument()
  })

  it("retire l'ancienne liste privée avant la résolution du nouveau lecteur", () => {
    const { rerender } = render(screenTree())
    fireEvent.change(screen.getByRole("textbox", { name: view.marker }), { target: { value: "pagination privée d'Awa" } })
    mocks[view.kind].mockClear()

    mocks.membership = { ...membership, personId: "persons_ali" }
    rerender(screenTree())
    expectNoEngineLists()
    expect(screen.getByRole("status", { name: "Chargement du réseau" })).toBeInTheDocument()

    mocks.network = { ...network, personId: "persons_ali" as IcomNetwork["personId"] }
    rerender(screenTree())
    expect(screen.getByRole("textbox", { name: view.marker })).toHaveValue("")
    expect(mocks[view.kind]).toHaveBeenLastCalledWith(expect.objectContaining({ network: expect.objectContaining({ personId: "persons_ali" }) }))
  })

  it.each(["demo", "not_allowed", "loading"] as const)("ne monte aucune liste sans réseau de lecture (%s)", (state) => {
    mocks.network = null
    mocks.icom = state === "loading" ? { status: "loading" } : { status: "off", reason: state }
    render(screenTree())

    expectNoEngineLists()
    expect(screen.queryByRole("navigation", { name: "Relations, demandes, abonnements et blocages" })).not.toBeInTheDocument()
    if (state === "loading") {
      expect(screen.getByRole("status", { name: "Chargement du réseau" })).toBeInTheDocument()
      expect(screen.queryByText("Les relations sont indisponibles ici")).not.toBeInTheDocument()
    } else {
      expect(screen.getByText("Les relations sont indisponibles ici")).toBeInTheDocument()
    }
  })

  it("ne monte pas la surface tant que la garde ne fournit aucune adhésion", () => {
    mocks.membership = null
    const { container } = render(screenTree())

    expect(container).toBeEmptyDOMElement()
    expectNoEngineLists()
  })

  it("traduit les cinq destinations et conserve la découverte propre à cette vue en anglais", () => {
    render(screenTree("en"))

    const navigation = screen.getByRole("navigation", { name: "Connections, requests, following and blocks" })
    const links = within(navigation).getAllByRole("link")
    expect(links.map((link) => link.textContent)).toEqual([
      "My connections", "Received requests", "Sent requests", "Following", "Blocked people",
    ])
    expect(within(navigation).getByRole("link", { name: view.englishLabel })).toHaveAttribute("aria-current", "page")
    expect(mocks.adapter).not.toHaveBeenCalled()
    expect(mocks.follows).not.toHaveBeenCalled()
    expect(mocks[view.kind === "sent" ? "blocked" : "sent"]).not.toHaveBeenCalled()
    if (view.kind === "sent") {
      expect(screen.getByRole("link", { name: "Meet members" })).toHaveAttribute("href", routes.members())
      expect(mocks.sent).toHaveBeenLastCalledWith(expect.objectContaining({ discover: { href: routes.members(), label: "Meet members" } }))
    } else {
      expect(screen.queryByRole("link", { name: "Meet members" })).not.toBeInTheDocument()
      expect(mocks.blocked).toHaveBeenLastCalledWith({
        profileHref: routes.profile("awa.demo"),
        network: expect.objectContaining({ networkId: network.networkId, personId: membership.personId }),
      })
    }
  })
})

describe("/relations — piste des onglets au redimensionnement", () => {
  it("révèle Blocages sans nouveau rendu, sans déplacer la page ou le focus, puis retire son listener", () => {
    mocks.search = "onglet=blocages"
    const added = vi.spyOn(window, "addEventListener")
    const removed = vi.spyOn(window, "removeEventListener")
    const scrollPage = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    const pageTop = document.documentElement.scrollTop
    const pageLeft = document.documentElement.scrollLeft
    try {
      const { unmount } = render(screenTree())
      const navigation = screen.getByRole("navigation", { name: "Relations, demandes, abonnements et blocages" })
      const selected = within(navigation).getByRole("link", { name: "Personnes bloquées" })
      const track = selected.parentElement!
      const trackRect = new DOMRect(0, 0, 1280, 40)
      const itemRect = new DOMRect(900, 0, 140, 40)
      const measureTrack = vi.spyOn(track, "getBoundingClientRect").mockImplementation(() => trackRect)
      const measureItem = vi.spyOn(selected, "getBoundingClientRect").mockImplementation(() => itemRect)
      const resizeListener = added.mock.calls.find(([event]) => event === "resize")?.[1]
      expect(resizeListener).toBeTypeOf("function")
      track.scrollLeft = 0
      document.documentElement.scrollTop = 214
      document.documentElement.scrollLeft = 13
      const focused = screen.getByRole("textbox", { name: "Repère des personnes bloquées" })
      focused.focus()
      mocks.blocked.mockClear()

      act(() => { window.dispatchEvent(new Event("resize")) })
      expect(track.scrollLeft).toBe(0)
      trackRect.width = 375
      act(() => { window.dispatchEvent(new Event("resize")) })

      expect(track.scrollLeft).toBe(665)
      expect(document.documentElement.scrollTop).toBe(214)
      expect(document.documentElement.scrollLeft).toBe(13)
      expect(scrollPage).not.toHaveBeenCalled()
      expect(document.activeElement).toBe(focused)
      expect(mocks.blocked).not.toHaveBeenCalled()

      unmount()
      expect(removed).toHaveBeenCalledWith("resize", resizeListener)
      measureTrack.mockClear()
      measureItem.mockClear()
      trackRect.width = 100
      act(() => { window.dispatchEvent(new Event("resize")) })
      expect(measureTrack).not.toHaveBeenCalled()
      expect(measureItem).not.toHaveBeenCalled()
      expect(track.scrollLeft).toBe(665)
      measureTrack.mockRestore()
      measureItem.mockRestore()
    } finally {
      document.documentElement.scrollTop = pageTop
      document.documentElement.scrollLeft = pageLeft
      added.mockRestore()
      removed.mockRestore()
      scrollPage.mockRestore()
    }
  })
})
