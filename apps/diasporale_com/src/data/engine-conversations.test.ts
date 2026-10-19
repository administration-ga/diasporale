import type { Id } from "@convex/_generated/dataModel"
import type { ConvexReactClient } from "convex/react"
import { describe, expect, it, vi } from "vitest"

import { createEngineConversations, toEngineContext, toObjectConversationView } from "./engine-conversations"
import type { EngineSourceDeps } from "./engine-kit"
import { toNotificationView } from "./engine-views"

/**
 * CC-6 — l'adaptateur moteur de l'entrée de conversation : l'objet dans le vocabulaire du
 * moteur, le fil vu de moi, l'ouverture idempotente, et l'avis contextuel de la cloche.
 */
type Thread = Parameters<typeof toObjectConversationView>[0]

const thread = (overrides: Record<string, unknown> = {}): Thread => ({
  threadId: "fil-1",
  state: { kind: "open" },
  unread: false,
  ...overrides,
}) as unknown as Thread

describe("conversations de mise en relation — adaptateur moteur", () => {
  it("l'objet dans le vocabulaire du moteur ; un identifiant vide n'est jamais envoyé", () => {
    expect(toEngineContext({ kind: "diasporaServiceRequest", id: " demande-1 " })).toEqual({ kind: "diasporaServiceRequest", id: "demande-1" })
    expect(toEngineContext({ kind: "diasporaMentoring", id: "mentorat-1" })).toEqual({ kind: "diasporaMentoring", id: "mentorat-1" })
    expect(toEngineContext({ kind: "diasporaJobApplication", id: "candidature-1" })).toEqual({ kind: "diasporaJobApplication", id: "candidature-1" })
    expect(toEngineContext({ kind: "diasporaServiceRequest", id: "   " })).toBeNull()
  })

  it("le fil vu de moi : écriture ouverte ou lecture seule, et le non-lu", () => {
    expect(toObjectConversationView(thread())).toEqual({ threadId: "fil-1", writable: true, unread: false })
    expect(toObjectConversationView(thread({ state: { kind: "read_only", reason: "closed" }, unread: true }))).toEqual({ threadId: "fil-1", writable: false, unread: true })
    expect(toObjectConversationView(thread({ state: { kind: "read_only", reason: "unavailable" } })).writable).toBe(false)
  })

  it("ouvre le fil dans le réseau DIASPORALE et rend son identifiant ; sans objet, refus sans appel", async () => {
    const mutation = vi.fn(async () => ({ threadId: "fil-3", created: false }))
    const query = vi.fn(async () => ({ _id: "reseau-diasporale" }))
    const deps = { convex: { query, mutation } as unknown as ConvexReactClient } as EngineSourceDeps
    const capability = createEngineConversations(deps)
    expect(await capability.open({ kind: "diasporaMentoring", id: "mentorat-1" })).toEqual({ ok: true, value: { threadId: "fil-3" } })
    expect(mutation).toHaveBeenCalledWith(expect.anything(), { networkId: "reseau-diasporale", context: { kind: "diasporaMentoring", id: "mentorat-1" } })
    mutation.mockClear()
    expect(await capability.open({ kind: "diasporaMentoring", id: "" })).toEqual({ ok: false, code: "not_found" })
    expect(mutation).not.toHaveBeenCalled()
  })
})

/** L'avis contextuel de la cloche : le fil relu pour le destinataire, rien d'autre. */
type Notice = Parameters<typeof toNotificationView>[0]

const contextualNotice = (kind: string, subject: Notice["subject"]): Notice => ({
  notificationId: "avis-contexte" as Id<"notifications">,
  kind, subject,
  createdAt: 7, readAt: null, resolution: null, inviteState: null,
  fileScanStatus: null, actor: null, page: null,
}) as unknown as Notice

describe("avis de conversation de mise en relation dans la cloche (CC-6)", () => {
  it("un message reçu mène au fil, sans acteur ni contenu", () => {
    const view = toNotificationView(contextualNotice("contextual_message", { kind: "contextualThread", id: "fil-9" } as Notice["subject"]))
    expect(view).toEqual({
      id: "avis-contexte", kind: "contextual_message", actor: null,
      createdAt: 7, read: false, pendingConnectionId: null, inviteOutcome: null, postId: null,
      contextualThreadId: "fil-9",
    })
  })

  it("un fil qui ne se lit plus : l'avis garde sa phrase, sans lien", () => {
    const view = toNotificationView(contextualNotice("contextual_closed", null))
    expect(view.kind).toBe("contextual_closed")
    expect(view.contextualThreadId).toBeNull()
  })
})
