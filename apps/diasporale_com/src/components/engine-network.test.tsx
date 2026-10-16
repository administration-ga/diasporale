// @vitest-environment jsdom
import { useNetwork } from "@antsia/api/network"
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { Loadable, MembershipView, SessionView } from "@diasporale/features/data"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EngineIcom, useEngineNetwork, useIcomState } from "./icom"

const mocks = vi.hoisted(() => ({
  session: { status: "loading" } as Loadable<SessionView>,
  network: undefined as { _id: string } | null | undefined,
  query: vi.fn(),
  probe: vi.fn(),
}))

// Seule la référence de la query est nécessaire : aucun module backend ne se charge.
vi.mock("@convex/_generated/api", () => ({
  api: { modules: { networks: { networks: { getBySlug: "networkBySlug" } } } },
}))

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => {
    mocks.query(...args)
    return mocks.network
  },
}))

vi.mock("@diasporale/features/data", () => ({ useSession: () => mocks.session }))

vi.mock("@antsia/social-features/messagerie", () => ({
  conversationHref: vi.fn(),
  dockStore: { openDraft: vi.fn(), detach: vi.fn() },
  draftKey: vi.fn(),
}))

vi.mock("@antsia/ui/overlay", () => ({ useIsReseauMobile: () => false }))

vi.mock("@antsia/social-features/shell", () => ({
  CommunicationShell: () => {
    const network = useNetwork()
    return <div data-testid="communication-shell" data-network-id={network.networkId} data-charte={network.charte} />
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({}),
  usePathname: () => "/fil",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
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

const expectedNetwork = { networkId: "networks_diasporale", slug: "diasporale", personId: "persons_awa" }
const forbiddenIcom = { status: "off", reason: "not_allowed" }

function memberSession(status: MembershipView["status"]): Loadable<SessionView> {
  return {
    status: "ready",
    data: {
      status: "signed_in",
      account: { id: "account_awa", idn: null, local: null, nameHints: {} },
      membership: { ...membership, status, canPublish: status === "declaree" || status === "verifiee" },
    },
  }
}

function Probe() {
  mocks.probe({ readingNetwork: useEngineNetwork(), icom: useIcomState() })
  return null
}

function renderEngine() {
  return render(
    <EngineIcom>
      <Probe />
    </EngineIcom>,
  )
}

beforeEach(() => {
  mocks.session = memberSession("declaree")
  mocks.network = { _id: expectedNetwork.networkId }
  vi.clearAllMocks()
})

afterEach(cleanup)

describe("EngineIcom — accès de lecture au réseau distinct du droit de communiquer", () => {
  it("donne le réseau de lecture au membre en attente et garde iCom fermé", () => {
    mocks.session = memberSession("en_attente")
    renderEngine()

    expect(mocks.query).toHaveBeenLastCalledWith("networkBySlug", { slug: "diasporale" })
    expect(mocks.probe).toHaveBeenLastCalledWith({ readingNetwork: expectedNetwork, icom: forbiddenIcom })
    expect(screen.queryByTestId("communication-shell")).not.toBeInTheDocument()
  })

  it("ouvre la lecture et iCom au membre déclaré, dans la charte et le réseau DIASPORALE", () => {
    renderEngine()

    expect(mocks.probe).toHaveBeenLastCalledWith({ readingNetwork: expectedNetwork, icom: { status: "on", network: expectedNetwork } })
    const communication = screen.getByTestId("communication-shell")
    expect(communication).toHaveAttribute("data-network-id", expectedNetwork.networkId)
    expect(communication).toHaveAttribute("data-charte", "diasporale")
  })

  it.each(["suspendue", "partie"] as const)("ne donne aucun réseau de lecture à une adhésion %s", (status) => {
    mocks.session = memberSession(status)
    renderEngine()

    expect(mocks.probe).toHaveBeenLastCalledWith({ readingNetwork: null, icom: forbiddenIcom })
    expect(screen.queryByTestId("communication-shell")).not.toBeInTheDocument()
  })

  it("ne donne aucun réseau de lecture à une session anonyme", () => {
    mocks.session = { status: "ready", data: { status: "anonymous" } }
    renderEngine()

    expect(mocks.probe).toHaveBeenLastCalledWith({ readingNetwork: null, icom: forbiddenIcom })
    expect(screen.queryByTestId("communication-shell")).not.toBeInTheDocument()
  })

  it("attend le réseau avant de donner la lecture ou de monter la communication", () => {
    mocks.network = undefined
    renderEngine()

    expect(mocks.probe).toHaveBeenLastCalledWith({ readingNetwork: null, icom: { status: "loading" } })
    expect(screen.queryByTestId("communication-shell")).not.toBeInTheDocument()
  })
})
