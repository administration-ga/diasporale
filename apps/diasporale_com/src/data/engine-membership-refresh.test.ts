import type { EngineAuthClient } from "@antsia/api/auth-client"
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { describe, expect, it } from "vitest"

import { createEngineActions } from "./engine-source"
import { toMembershipView } from "./engine-views"

/**
 * EA-03 côté moteur : l'adhésion lue porte l'écart que dit la tranche
 * (`statusOutdated`), et la relecture appelle `refreshMyMembership` pour le réseau
 * diasporale ; un refus du moteur arrive à l'écran avec son code fermé.
 */

function fakeConvex(handlers: Record<string, (args: Record<string, unknown>) => unknown>) {
  const calls: { name: string; args: Record<string, unknown> }[] = []
  const run = async (reference: unknown, args: Record<string, unknown> = {}) => {
    const name = getFunctionName(reference as never)
    calls.push({ name, args })
    const handler = handlers[name]
    if (!handler) throw new Error(`fonction non prévue par le test : ${name}`)
    return handler(args)
  }
  return { convex: { query: run, mutation: run } as unknown as ConvexReactClient, calls }
}

const NETWORK = { "modules/networks/networks:getBySlug": () => ({ _id: "n-diasporale", slug: "diasporale" }) }
const AUTH = {} as EngineAuthClient

const PERSON = { _id: "p1", handle: "ada", displayName: "Ada MOUSSAVOU", published: true, private: false, badges: [], consentsInForce: [] } as never

const MEMBERSHIP = {
  status: "en_attente",
  role: "member",
  joinedAt: 1,
  verifiedSince: null,
  facet: { countryOfResidence: "FR", city: "Lyon", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  directoryVisibility: "hidden",
  sponsoredBy: null,
  attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { status: "declaree" },
  badges: ["community"],
  capabilities: ["read_network"],
  rateTier: "none",
  statusOutdated: false,
} as const

describe("relecture du statut par la source « moteur » (EA-03)", () => {
  it("l'écart de la tranche passe dans la vue de l'adhésion, et seulement quand il existe", () => {
    expect(toMembershipView(PERSON, { ...MEMBERSHIP, statusOutdated: true } as never)).toMatchObject({ status: "en_attente", statusOutdated: true })
    expect(toMembershipView(PERSON, MEMBERSHIP as never)).not.toHaveProperty("statusOutdated")
  })

  it("relire appelle la tranche pour le réseau diasporale et rend si le statut a changé", async () => {
    const { convex, calls } = fakeConvex({ ...NETWORK, "modules/diaspora/membership:refreshMyMembership": () => ({ status: "declaree", changed: true }) })
    const actions = createEngineActions({ convex, authClient: AUTH })
    expect(await actions.refreshMembership?.()).toEqual({ ok: true, value: { changed: true } })
    expect(calls).toEqual([
      { name: "modules/networks/networks:getBySlug", args: { slug: "diasporale" } },
      { name: "modules/diaspora/membership:refreshMyMembership", args: { networkId: "n-diasporale" } },
    ])
  })

  it("un refus du moteur (débit, adhésion suspendue ou quittée) se dit avec son code", async () => {
    const { convex } = fakeConvex({
      ...NETWORK,
      "modules/diaspora/membership:refreshMyMembership": () => {
        throw new ConvexError({ code: "rateLimited", retryAfterMs: 1000 } as never)
      },
    })
    const actions = createEngineActions({ convex, authClient: AUTH })
    expect(await actions.refreshMembership?.()).toEqual({ ok: false, code: "rate_limited" })
  })
})
