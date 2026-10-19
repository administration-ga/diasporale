// @vitest-environment jsdom
import { useNetwork, useRoutes } from "@antsia/api/network"
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { Loadable, MembershipView, SessionView } from "@diasporale/features/data"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { IcomNetwork } from "@/components/icom"
import { routes } from "@/lib/routes"

import { FeedStories } from "./feed-stories"

const mocks = vi.hoisted(() => ({
  network: null as IcomNetwork | null,
  session: { status: "loading" } as Loadable<SessionView>,
  me: null as { published: boolean; handle: string | null; avatar: { url: string | null } | null } | null,
  push: vi.fn(),
  query: vi.fn(),
  tray: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => "/fil",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

// Le bandeau ne monte pas la communication : ses paquets lourds (et leur CSS)
// restent hors de ce test, sans remplacer le véritable îlot réseau.
vi.mock("@antsia/social-features/shell", () => ({ CommunicationShell: () => null }))
vi.mock("@antsia/social-features/messagerie", () => ({
  conversationHref: vi.fn(),
  dockStore: { openDraft: vi.fn(), detach: vi.fn() },
  draftKey: vi.fn(),
}))

// L'îlot réel garde NetworkProvider et l'adaptateur Next ; seule la résolution
// du réseau de lecture est contrôlée, sans ouvrir de session ni appeler Convex.
vi.mock("@/components/icom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/icom")>()),
  useEngineNetwork: () => mocks.network,
}))

vi.mock("@diasporale/features/data", () => ({ useSession: () => mocks.session }))

vi.mock("@antsia/api/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@antsia/api/hooks")>()),
  useAuthenticatedConvexQuery: (...args: unknown[]) => {
    mocks.query(...args)
    return { data: mocks.me, isError: false }
  },
}))

vi.mock("@antsia/social-features/stories", () => ({
  StoriesStyles: () => <style data-testid="stories-styles" />,
  StoriesTray: (props: {
    myHandle: string | null
    myAvatarUrl?: string | null
    now: number
    canCreate?: boolean
    onOpen: (handle: string | null) => void
    onCreate: () => void
  }) => {
    const network = useNetwork()
    const engineRoutes = useRoutes()
    const [marker, setMarker] = useState("")
    mocks.tray({ network, storiesHref: engineRoutes.stories(), myHandle: props.myHandle, myAvatarUrl: props.myAvatarUrl, now: props.now, canCreate: props.canCreate })
    return (
      <div role="group" aria-label="Bandeau moteur">
        <button type="button" onClick={() => props.onOpen("awa.demo")}>
          Ouvrir Awa
        </button>
        <button type="button" onClick={() => props.onOpen(null)}>
          Ouvrir sans auteur
        </button>
        <input aria-label="Repère du bandeau" value={marker} onChange={(event) => setMarker(event.target.value)} />
        {props.canCreate ? (
          <button type="button" onClick={props.onCreate}>Créer une actu</button>
        ) : null}
      </div>
    )
  },
}))

const network = { networkId: "networks_diasporale", slug: "diasporale", personId: "persons_awa" } as IcomNetwork

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

function memberSession(member: MembershipView | null): Loadable<SessionView> {
  return {
    status: "ready",
    data: {
      status: "signed_in",
      account: { id: "account_awa", idn: null, local: null, nameHints: {} },
      membership: member,
    },
  }
}

beforeEach(() => {
  mocks.network = null
  mocks.session = memberSession(membership)
  mocks.me = { published: true, handle: "awa.demo", avatar: { url: "portrait.jpg" } }
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("FeedStories — le bandeau des actus du moteur dans le fil", () => {
  it.each(["demo", "suspendue"] as const)("ne monte aucune surface moteur sans réseau de lecture (%s)", (status) => {
    if (status === "suspendue") mocks.session = memberSession({ ...membership, status, canPublish: false })
    const { container } = render(<FeedStories now={123_000} />)

    expect(container).toBeEmptyDOMElement()
    expect(mocks.tray).not.toHaveBeenCalled()
    expect(mocks.query).not.toHaveBeenCalled()
    expect(screen.queryByTestId("stories-styles")).not.toBeInTheDocument()
  })

  it("transmet au bandeau le réseau DIASPORALE, sa charte, ses routes et l'horloge du fil", () => {
    mocks.network = network
    render(<FeedStories now={123_000} />)

    expect(screen.getByRole("group", { name: "Bandeau moteur" })).toBeInTheDocument()
    expect(screen.getByTestId("stories-styles")).toBeInTheDocument()
    expect(mocks.tray).toHaveBeenLastCalledWith({
      network: expect.objectContaining({
        networkId: "networks_diasporale",
        slug: "diasporale",
        personId: network.personId,
        charte: "diasporale",
        storagePrefix: "antsia:diasporale:",
      }),
      storiesHref: routes.stories(),
      myHandle: "awa.demo",
      myAvatarUrl: "portrait.jpg",
      now: 123_000,
      canCreate: true,
    })
  })

  it("laisse le membre en attente ouvrir une série sans créer d'actu", () => {
    mocks.network = network
    mocks.session = memberSession({ ...membership, status: "en_attente", canPublish: false })
    render(<FeedStories now={123_000} />)

    expect(screen.getByRole("group", { name: "Bandeau moteur" })).toBeInTheDocument()
    expect(mocks.tray).toHaveBeenLastCalledWith(expect.objectContaining({ canCreate: false }))
    expect(screen.queryByRole("button", { name: "Créer une actu" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir Awa" }))
    expect(mocks.push).toHaveBeenLastCalledWith("/actus?auteur=awa.demo")
  })

  it("ne désigne aucune série personnelle quand le handle choisi n'est pas publié", () => {
    mocks.network = network
    mocks.me = { published: false, handle: "awa.demo", avatar: null }
    render(<FeedStories now={123_000} />)

    expect(mocks.tray).toHaveBeenLastCalledWith(expect.objectContaining({ myHandle: null, myAvatarUrl: null }))
  })

  it("rafraîchit l'horloge du bandeau à la minute", () => {
    vi.useFakeTimers()
    vi.setSystemTime(123_000)
    mocks.network = network
    render(<FeedStories now={123_000} />)

    act(() => vi.advanceTimersByTime(60_000))

    expect(mocks.tray).toHaveBeenLastCalledWith(expect.objectContaining({ now: 183_000 }))
  })

  it("ouvre l'auteur par le paramètre du lecteur et la création par le segment nouvelle", () => {
    mocks.network = network
    render(<FeedStories now={123_000} />)

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir Awa" }))
    expect(mocks.push).toHaveBeenLastCalledWith("/actus?auteur=awa.demo")
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir sans auteur" }))
    expect(mocks.push).toHaveBeenLastCalledWith(routes.stories())
    fireEvent.click(screen.getByRole("button", { name: "Créer une actu" }))
    expect(mocks.push).toHaveBeenLastCalledWith("/actus/nouvelle")
  })

  it.each(["personne", "droit", "réseau"] as const)("réinitialise le bandeau au changement de %s", (change) => {
    mocks.network = network
    const { rerender } = render(<FeedStories now={123_000} />)
    fireEvent.change(screen.getByRole("textbox", { name: "Repère du bandeau" }), { target: { value: "ancien plateau" } })

    if (change === "personne") {
      mocks.network = { ...network, personId: "persons_bob" as IcomNetwork["personId"] }
      mocks.session = memberSession({ ...membership, personId: "persons_bob" })
    } else if (change === "réseau") mocks.network = { ...network, networkId: "networks_other" as IcomNetwork["networkId"] }
    else mocks.session = memberSession({ ...membership, status: "en_attente", canPublish: false })
    rerender(<FeedStories now={123_000} />)

    expect(screen.getByRole("textbox", { name: "Repère du bandeau" })).toHaveValue("")
  })

  it("ne monte aucun bandeau tant que le réseau et la personne de la session diffèrent", () => {
    mocks.network = network
    const { rerender } = render(<FeedStories now={123_000} />)
    mocks.session = memberSession({ ...membership, personId: "persons_bob" })
    rerender(<FeedStories now={123_000} />)

    expect(screen.queryByRole("group", { name: "Bandeau moteur" })).not.toBeInTheDocument()

    mocks.network = { ...network, personId: "persons_bob" as IcomNetwork["personId"] }
    rerender(<FeedStories now={123_000} />)
    expect(screen.getByRole("group", { name: "Bandeau moteur" })).toBeInTheDocument()
  })

  it.each(["loading", "anonymous", "non_membre", "suspendue", "partie"] as const)("ne monte rien avec un contexte réseau ancien pendant l'état %s", (state) => {
    mocks.network = network
    if (state === "loading") mocks.session = { status: "loading" }
    else if (state === "anonymous") mocks.session = { status: "ready", data: { status: "anonymous" } }
    else if (state === "non_membre") mocks.session = memberSession(null)
    else mocks.session = memberSession({ ...membership, status: state, canPublish: false })
    render(<FeedStories now={123_000} />)

    expect(screen.queryByRole("group", { name: "Bandeau moteur" })).not.toBeInTheDocument()
    expect(mocks.query).not.toHaveBeenCalled()
  })

  it("démonte le bandeau quand le fournisseur revient à la démonstration", () => {
    mocks.network = network
    const { rerender } = render(<FeedStories now={123_000} />)
    mocks.network = null
    rerender(<FeedStories now={123_000} />)

    expect(screen.queryByRole("group", { name: "Bandeau moteur" })).not.toBeInTheDocument()
  })
})
