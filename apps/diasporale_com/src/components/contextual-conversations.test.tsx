// @vitest-environment jsdom
import type { ConversationObjectRef, ConversationsCapability, Loadable, ObjectConversationView } from "@diasporale/features/data"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { routes } from "@/lib/routes"

import { contextualObjectHref, ObjectConversationEntry, useDiasporaleContextualMessages } from "./contextual-conversations"

/**
 * CC-6 — l'entrée depuis un objet (revoir, ouvrir, écrire) et l'injection dans la messagerie du
 * moteur : nos refus traduits, l'objet rouvert de mon côté. La conversation elle-même est
 * testée dans le moteur (CC-5).
 */
const mocks = vi.hoisted(() => ({
  capability: null as unknown,
  push: vi.fn(),
  error: vi.fn(),
  options: null as unknown,
}))

vi.mock("@diasporale/features/data", async (original) => ({
  ...await original<typeof import("@diasporale/features/data")>(),
  useConversations: () => mocks.capability,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.error } }))
vi.mock("@antsia/social-features/messagerie", () => ({
  useContextualMessages: (options: unknown) => {
    mocks.options = options
    return { renderList: () => null, renderConversation: () => null }
  },
}))

const REQUEST: ConversationObjectRef = { kind: "diasporaServiceRequest", id: "demande-1" }

function capability(thread: Loadable<ObjectConversationView | null>, open: ConversationsCapability["open"] = vi.fn()): ConversationsCapability & { readonly useThreadFor: ReturnType<typeof vi.fn> } {
  return { useThreadFor: vi.fn(() => thread), open }
}

function wrapper(props: { children: ReactNode }) {
  return <I18nProvider locale="fr">{props.children}</I18nProvider>
}

function mount(phase: "not_open" | "open" | "closed", object: ConversationObjectRef = REQUEST) {
  return render(<ObjectConversationEntry object={object} phase={phase} />, { wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.capability = null
  mocks.options = null
})

afterEach(cleanup)

describe("entrée de conversation depuis un objet (CC-6)", () => {
  it("rien sans fournisseur (démonstration), ni avant la phase ouverte", () => {
    const empty = mount("open")
    expect(empty.container).toBeEmptyDOMElement()
    cleanup()
    const fake = capability({ status: "ready", data: null })
    mocks.capability = fake
    expect(mount("not_open").container).toBeEmptyDOMElement()
    expect(fake.useThreadFor).not.toHaveBeenCalled()
  })

  it("un fil ouvert mène à la conversation ; un message non lu se dit en toutes lettres", () => {
    mocks.capability = capability({ status: "ready", data: { threadId: "fil 1", writable: true, unread: true } })
    mount("open")
    const link = screen.getByRole("link", { name: /Ouvrir la conversation/ })
    expect(link).toHaveAttribute("href", routes.contextualConversation("fil 1"))
    expect(link).toHaveAttribute("href", "/messages/mise-en-relation/fil%201")
    expect(link).toHaveTextContent("Nouveau message")
  })

  it("un fil clos se revoit, en lecture seule, même quand l'objet est clos", () => {
    mocks.capability = capability({ status: "ready", data: { threadId: "fil-2", writable: false, unread: false } })
    mount("closed")
    expect(screen.getByRole("link", { name: "Revoir la conversation" })).toHaveAttribute("href", "/messages/mise-en-relation/fil-2")
    expect(screen.queryByText("Nouveau message")).not.toBeInTheDocument()
  })

  it("sans fil, en phase ouverte : « Écrire » ouvre le fil puis y mène, une seule fois", async () => {
    let settle: (value: { ok: true; value: { threadId: string } }) => void = () => undefined
    const open = vi.fn(() => new Promise<{ ok: true; value: { threadId: string } }>((resolve) => { settle = resolve }))
    mocks.capability = capability({ status: "ready", data: null }, open)
    mount("open")
    const write = screen.getByRole("button", { name: "Écrire" })
    fireEvent.click(write)
    fireEvent.click(screen.getByRole("button", { name: "Ouverture de la conversation…" }))
    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith(REQUEST)
    await act(async () => { settle({ ok: true, value: { threadId: "fil-3" } }) })
    expect(mocks.push).toHaveBeenCalledWith("/messages/mise-en-relation/fil-3")
  })

  it("un refus du moteur se dit traduit, jamais par son code", async () => {
    mocks.capability = capability({ status: "ready", data: null }, vi.fn(async () => ({ ok: false as const, code: "not_found" as const })))
    mount("open")
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Écrire" })) })
    expect(mocks.error).toHaveBeenCalledTimes(1)
    expect(mocks.error.mock.calls[0]?.[0]).not.toBe("not_found")
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("sans fil, une phase close n'offre rien ; en chargement ou en panne, l'objet reste entier", () => {
    mocks.capability = capability({ status: "ready", data: null })
    expect(mount("closed").container).toBeEmptyDOMElement()
    cleanup()
    mocks.capability = capability({ status: "loading" })
    expect(mount("open").container).toBeEmptyDOMElement()
    cleanup()
    mocks.capability = capability({ status: "error", code: "network_unavailable" })
    expect(mount("open").container).toBeEmptyDOMElement()
  })
})

describe("injection dans la messagerie du moteur (CC-6)", () => {
  type Options = {
    describeAppRule: (code: string, params: Record<string, unknown>) => string | null
    describeObject: (thread: { object: { kind: string; id: string } | null; viewer: { side: "requester" | "responder" } }) => string | null
    onOpenObject: (object: { kind: "diasporaServiceRequest" | "diasporaMentoring" | "diasporaJobApplication"; id: string }) => void
  }

  it("traduit nos codes fermés ; tout autre code garde la phrase neutre du moteur", () => {
    renderHook(() => useDiasporaleContextualMessages(), { wrapper })
    const options = mocks.options as Options
    expect(options.describeAppRule("context_address_forbidden", {})).toMatch(/adresse exacte/)
    expect(options.describeAppRule("code_inconnu", {})).toBeNull()
  })

  it("rouvre l'objet de mon côté : la candidature chez l'équipe ou chez la personne qui candidate", () => {
    renderHook(() => useDiasporaleContextualMessages(), { wrapper })
    const options = mocks.options as Options
    expect(options.describeObject({ object: { kind: "diasporaJobApplication", id: "cand-1" }, viewer: { side: "responder" } })).toBeNull()
    options.onOpenObject({ kind: "diasporaJobApplication", id: "cand-1" })
    expect(mocks.push).toHaveBeenLastCalledWith(routes.myActivity("emplois"))
    options.onOpenObject({ kind: "diasporaJobApplication", id: "cand-inconnue" })
    expect(mocks.push).toHaveBeenLastCalledWith(routes.myApplications())
  })

  it("les adresses des objets : la demande (les deux côtés), mes mentorats, la candidature", () => {
    expect(contextualObjectHref({ kind: "diasporaServiceRequest", id: "d-1" }, "responder")).toBe(routes.serviceRequest("d-1"))
    expect(contextualObjectHref({ kind: "diasporaServiceRequest", id: "d-1" }, "requester")).toBe(routes.serviceRequest("d-1"))
    expect(contextualObjectHref({ kind: "diasporaMentoring", id: "m-1" }, null)).toBe(routes.myMentoring())
    expect(contextualObjectHref({ kind: "diasporaJobApplication", id: "c-1" }, "requester")).toBe(routes.myApplications())
    expect(contextualObjectHref({ kind: "diasporaJobApplication", id: "c-1" }, "responder")).toBe(routes.myActivity("emplois"))
  })
})
