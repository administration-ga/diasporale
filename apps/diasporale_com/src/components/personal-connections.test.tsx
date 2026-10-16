// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { routes } from "@/lib/routes"

import type { ConnectionListProps } from "./connection-list"
import { EnginePersonalConnections } from "./personal-connections"

const mocks = vi.hoisted(() => ({
  accepted: vi.fn(),
  received: vi.fn(),
  list: vi.fn<(props: ConnectionListProps) => void>(),
  respond: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock("@antsia/social-features/features/reseau-personnel/use-dual-connection-pagination", () => ({
  usePersonalConnections: mocks.accepted,
  usePersonalPendingConnections: mocks.received,
}))

vi.mock("@diasporale/features/data", () => ({ useActions: () => ({ respondToConnection: mocks.respond }) }))
vi.mock("@diasporale/features/i18n/client", () => ({ useDiasporaleT: () => ({ t: (key: string) => key }) }))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

vi.mock("./connection-list", () => ({
  ConnectionList: (props: ConnectionListProps) => {
    mocks.list(props)
    return null
  },
}))

const raw = {
  connectionId: "connection-awa",
  otherPersonId: "person-awa",
  displayName: "Awa Ogooué",
  handle: "awa.ogooue",
  headline: "Architecte à Lyon",
  avatarUrl: null,
  badges: ["official", "verified", "public_agent", "community"],
  at: 123,
  message: "Bonjour",
}

function makeList(overrides = {}) {
  return {
    items: [raw],
    isLoading: false,
    isLoadingMore: false,
    isError: false,
    hasMore: false,
    loadMore: vi.fn(),
    retry: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  }
}

function shown(): ConnectionListProps {
  const props = mocks.list.mock.lastCall?.[0]
  if (!props) throw new Error("Liste non montée")
  return props
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.accepted.mockReturnValue(makeList())
  mocks.received.mockReturnValue(makeList())
  mocks.respond.mockResolvedValue({ ok: true, value: null })
})

afterEach(cleanup)

describe("EnginePersonalConnections — adaptateur des listes personnelles du moteur", () => {
  it.each([
    { kind: "accepted" as const, pageSize: 12 },
    { kind: "received" as const, pageSize: 10 },
  ])("monte seulement le hook $kind avec sa taille de page", ({ kind, pageSize }) => {
    render(<EnginePersonalConnections kind={kind} canRespond />)

    const selected = kind === "accepted" ? mocks.accepted : mocks.received
    const other = kind === "accepted" ? mocks.received : mocks.accepted
    expect(selected).toHaveBeenCalledExactlyOnceWith({ pageSize })
    expect(other).not.toHaveBeenCalled()
    expect(shown().kind).toBe(kind)
    expect(shown().labels.emptyTitle).toBe(kind === "accepted" ? "relations.emptyAcceptedTitle" : "relations.emptyReceivedTitle")
    expect(shown().labels.emptyBody).toBe(kind === "accepted" ? "relations.emptyAcceptedBody" : "relations.emptyReceivedBody")
  })

  it("projette le DTO et chacun de ses badges sans inventer de profil ni perdre le message", () => {
    const list = makeList({ items: [raw, { ...raw, connectionId: "connection-hidden", displayName: null, handle: null, headline: null, badges: [] }] })
    mocks.received.mockReturnValue(list)
    render(<EnginePersonalConnections kind="received" canRespond />)

    expect(shown().items).toEqual([
      {
        connectionId: raw.connectionId,
        personId: raw.otherPersonId,
        displayName: raw.displayName,
        handle: raw.handle,
        headline: raw.headline,
        badges: raw.badges,
        message: raw.message,
      },
      { connectionId: "connection-hidden", personId: raw.otherPersonId, displayName: null, handle: null, headline: null, badges: [], message: raw.message },
    ])
    expect(shown().profileHref(raw.handle)).toBe(routes.profile(raw.handle))
    expect(shown().discoverHref).toBe(routes.members())
    expect(shown().labels.member).toBe("relations.member")
  })

  it("transmet les états et délègue pagination et reprise au hook actif", () => {
    const list = makeList({ isLoading: true, isLoadingMore: true, isError: true, hasMore: true })
    mocks.accepted.mockReturnValue(list)
    render(<EnginePersonalConnections kind="accepted" canRespond />)

    expect(shown()).toMatchObject({ isLoading: true, isLoadingMore: true, isError: true, hasMore: true })
    shown().onMore()
    shown().onRetry()
    expect(list.loadMore).toHaveBeenCalledOnce()
    expect(list.retry).toHaveBeenCalledOnce()
  })

  it.each([true, false])("ne retire une demande qu'après une réponse réussie (acceptation : %s)", async (accept) => {
    const list = makeList()
    mocks.received.mockReturnValue(list)
    render(<EnginePersonalConnections kind="received" canRespond />)

    await shown().onRespond(raw.connectionId, accept)

    expect(mocks.respond).toHaveBeenCalledExactlyOnceWith(raw.connectionId, accept)
    expect(list.remove).toHaveBeenCalledExactlyOnceWith(raw.connectionId)
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith(accept ? "relations.accepted" : "relations.declined")
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it("traduit le refus de l'action et conserve la demande", async () => {
    const list = makeList()
    mocks.received.mockReturnValue(list)
    mocks.respond.mockResolvedValue({ ok: false, code: "status_insufficient" })
    render(<EnginePersonalConnections kind="received" canRespond />)

    await shown().onRespond(raw.connectionId, true)

    expect(mocks.error).toHaveBeenCalledExactlyOnceWith("errors.status_insufficient")
    expect(list.remove).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it("traduit une exception inattendue avec la clé générique existante et conserve la demande", async () => {
    const list = makeList()
    mocks.received.mockReturnValue(list)
    mocks.respond.mockRejectedValue(new Error("connexion perdue"))
    render(<EnginePersonalConnections kind="received" canRespond />)

    await shown().onRespond(raw.connectionId, false)

    expect(mocks.error).toHaveBeenCalledExactlyOnceWith("errors.unknown")
    expect(list.remove).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it("ferme aussi le callback métier en lecture seule", async () => {
    const list = makeList()
    mocks.received.mockReturnValue(list)
    render(<EnginePersonalConnections kind="received" canRespond={false} />)

    expect(shown().canRespond).toBe(false)
    await shown().onRespond(raw.connectionId, true)

    expect(mocks.respond).not.toHaveBeenCalled()
    expect(list.remove).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })
})
