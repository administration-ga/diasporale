// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import { isSigningOutEverywhere } from "@antsia/api/sign-out-everywhere"
import type { ReactionKind } from "@diasporale/features/data"
import type { ConvexReactClient } from "convex/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createEngineActions } from "./engine-source"

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    values,
    get length() { return values.size },
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: vi.fn((key: string) => { values.delete(key) }),
  }
}

function setup(options: { revoked?: boolean; revokeThrows?: boolean; signOutError?: boolean; storageError?: boolean } = {}) {
  const events: string[] = []
  const local = storage({ "diasporale:brouillon:p1": "texte privé", "antsia:diasporale:conversation": "texte privé", theme: "dark", "diasporale:hubs:recents": "FR" })
  const session = storage({ "diasporale:brouillon:p2": "texte privé", "autre-produit:session": "conservé" })
  if (options.storageError) local.removeItem.mockImplementation(() => { throw new Error("stockage refusé") })
  const assign = vi.fn(() => { events.push(isSigningOutEverywhere() ? "navigateLocked" : "navigateUnlocked") })
  vi.stubGlobal("window", new Proxy(window, {
    get(target, property) {
      if (property === "location") return { assign }
      if (property === "localStorage") return local
      if (property === "sessionStorage") return session
      return Reflect.get(target, property, target)
    },
  }))
  const atomSet = vi.fn()
  const revokeSessions = vi.fn(async () => {
    events.push("revoke")
    if (options.revokeThrows) throw new Error("réseau indisponible")
    return { data: { status: options.revoked !== false }, error: null }
  })
  const signOut = vi.fn(async () => {
    events.push("signOut")
    return options.signOutError ? { error: { code: "SESSION_ABSENTE" } } : { data: { success: true }, error: null }
  })
  const client = { revokeSessions, signOut, $store: { atoms: { session: { get: () => ({ data: { user: {} } }), set: atomSet } } } } as unknown as EngineAuthClient
  const reactions = new Map<string, ReactionKind | null>([["post", "like"]])
  const actions = createEngineActions({ authClient: client, convex: {} as ConvexReactClient }, reactions)
  return { actions, assign, events, local, session, reactions, revokeSessions, signOut, atomSet }
}

afterEach(() => {
  vi.unstubAllGlobals()
  // Le navigateur remplace le document après assign ; jsdom doit simuler
  // cette frontière pour ne pas conserver le verrou du scénario précédent.
  Reflect.deleteProperty(globalThis, Symbol.for("antsia.signOutActivity"))
})

describe("déconnexion DIASPORALE — contrat PA4 commun réel", () => {
  it("révoque avant de quitter, purge les états personnels et recharge complètement l'entrée", async () => {
    const test = setup()
    await test.actions.signOutEverywhere()
    expect(test.events).toEqual(["revoke", "signOut", "navigateLocked"])
    expect(test.revokeSessions).toHaveBeenCalledOnce()
    expect(test.signOut).toHaveBeenCalledOnce()
    expect(test.reactions.size).toBe(0)
    expect([...test.local.values]).toEqual([["theme", "dark"], ["diasporale:hubs:recents", "FR"]])
    expect([...test.session.values]).toEqual([["autre-produit:session", "conservé"]])
    expect(test.atomSet).toHaveBeenCalledWith(expect.objectContaining({ data: null, error: null, isPending: false }))
    expect(test.assign).toHaveBeenCalledExactlyOnceWith("/entrer")
  })

  it.each([{ revoked: false }, { revokeThrows: true }])("conserve un avis après rechargement lorsque la révocation n'est pas prouvée : %j", async (options) => {
    const test = setup(options)
    await test.actions.signOutEverywhere()
    expect(test.events).toEqual(["revoke", "signOut", "navigateLocked"])
    expect(test.local.values.has("diasporale:brouillon:p1")).toBe(false)
    expect(test.assign).toHaveBeenCalledExactlyOnceWith("/entrer?deconnexion=incomplete")
  })

  it("ne transforme pas le 401 attendu après révocation en faux échec global", async () => {
    const test = setup({ signOutError: true })
    await test.actions.signOutEverywhere()
    expect(test.assign).toHaveBeenCalledExactlyOnceWith("/entrer")
  })

  it("annonce aussi une purge locale incomplète et poursuit les autres nettoyages", async () => {
    const test = setup({ storageError: true })
    await test.actions.signOutEverywhere()
    expect(test.reactions.size).toBe(0)
    expect(test.session.values.has("diasporale:brouillon:p2")).toBe(false)
    expect(test.assign).toHaveBeenCalledExactlyOnceWith("/entrer?deconnexion=incomplete")
  })
})
