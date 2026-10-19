// Dupliqué de ANTSIA/apps/antsia_ga/src/lib/messages-route.test.ts @ f1eed7f — adaptations : segment contextuel `mise-en-relation` accepté (CC-6), conversation commerciale toujours refusée ; en-tête de provenance.
import { describe, expect, it } from "vitest"

import { parseMessagesSegments } from "./messages-route"

describe("parseMessagesSegments — l'adresse de la messagerie vers son aiguillage", () => {
  it("la liste, les deux composeurs et une conversation", () => {
    expect(parseMessagesSegments([])).toEqual({})
    expect(parseMessagesSegments(["nouveau"])).toEqual({ compose: "personne" })
    expect(parseMessagesSegments(["nouveau-groupe"])).toEqual({ compose: "groupe" })
    expect(parseMessagesSegments(["chat", "abc123"])).toEqual({ kind: "chat", id: "abc123" })
    expect(parseMessagesSegments(["a", "awa.demo"])).toEqual({ kind: "a", id: "awa.demo" })
  })

  it("décode les segments une fois", () => {
    expect(parseMessagesSegments(["groupe", "x%20y"])).toEqual({ kind: "groupe", id: "x y" })
  })

  it("CC-6 : une conversation de mise en relation, décodée une fois ; la commerciale reste refusée", () => {
    expect(parseMessagesSegments(["mise-en-relation", "fil%201"])).toEqual({ kind: "mise-en-relation", id: "fil 1" })
    expect(parseMessagesSegments(["mise-en-relation"])).toBeNull()
    expect(parseMessagesSegments(["commerce", "x"])).toBeNull()
  })

  it("refuse toute autre forme (introuvable)", () => {
    expect(parseMessagesSegments(["inconnu"])).toBeNull()
    expect(parseMessagesSegments(["poste", "x"])).toBeNull()
    expect(parseMessagesSegments(["chat", "x", "y"])).toBeNull()
  })
})
