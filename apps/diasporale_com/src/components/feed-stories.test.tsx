// @vitest-environment jsdom
import { useNetwork, useRoutes } from "@antia/api/network"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { IcomNetwork } from "@/components/icom"
import { routes } from "@/lib/routes"

import { FeedStories } from "./feed-stories"

const mocks = vi.hoisted(() => ({
  network: null as IcomNetwork | null,
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
vi.mock("@antia/social-features/shell", () => ({ CommunicationShell: () => null }))
vi.mock("@antia/social-features/messagerie", () => ({
  conversationHref: vi.fn(),
  dockStore: { openDraft: vi.fn(), detach: vi.fn() },
  draftKey: vi.fn(),
}))

// L'îlot réel garde NetworkProvider et l'adaptateur Next ; seule la résolution
// du droit iCom est contrôlée, sans ouvrir de session ni appeler Convex.
vi.mock("@/components/icom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/icom")>()),
  useIcomNetwork: () => mocks.network,
}))

vi.mock("@antia/api/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@antia/api/hooks")>()),
  useAuthenticatedConvexQuery: (...args: unknown[]) => {
    mocks.query(...args)
    return { data: mocks.me, isError: false }
  },
}))

vi.mock("@antia/social-features/stories", () => ({
  StoriesStyles: () => <style data-testid="stories-styles" />,
  StoriesTray: (props: {
    myHandle: string | null
    myAvatarUrl?: string | null
    now: number
    onOpen: (handle: string | null) => void
    onCreate: () => void
  }) => {
    const network = useNetwork()
    const engineRoutes = useRoutes()
    mocks.tray({ network, storiesHref: engineRoutes.stories(), myHandle: props.myHandle, myAvatarUrl: props.myAvatarUrl, now: props.now })
    return (
      <div role="group" aria-label="Bandeau moteur">
        <button type="button" onClick={() => props.onOpen("awa.demo")}>
          Ouvrir Awa
        </button>
        <button type="button" onClick={() => props.onOpen(null)}>
          Ouvrir sans auteur
        </button>
        <button type="button" onClick={props.onCreate}>
          Créer une actu
        </button>
      </div>
    )
  },
}))

const network = { networkId: "networks_diasporale", slug: "diasporale", personId: "persons_awa" } as IcomNetwork

beforeEach(() => {
  mocks.network = null
  mocks.me = { published: true, handle: "awa.demo", avatar: { url: "portrait.jpg" } }
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("FeedStories — le bandeau des actus du moteur dans le fil", () => {
  it.each(["demo", "en_attente"] as const)("ne monte aucune surface moteur sans réseau iCom (%s)", () => {
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
        storagePrefix: "antia:diasporale:",
      }),
      storiesHref: routes.stories(),
      myHandle: "awa.demo",
      myAvatarUrl: "portrait.jpg",
      now: 123_000,
    })
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
})
