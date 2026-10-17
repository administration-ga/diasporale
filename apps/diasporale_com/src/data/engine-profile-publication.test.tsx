// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import { cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEngineDataSource } from "./engine-source"

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isPending: false, isUnauthenticated: false },
  person: null as unknown,
  read: vi.fn(),
}))
vi.mock("@antsia/api/hooks", () => ({
  useStableConvexAuth: () => mocks.auth,
  useAuthenticatedConvexQuery: () => { throw new Error("No paginated query in own-profile settings") },
}))
vi.mock("convex/react", () => ({
  useQueries: (queries: Record<string, { query: Parameters<typeof getFunctionName>[0]; args?: unknown }>) => {
    if (!queries.value) return {}
    const { query, args } = queries.value
    const name = getFunctionName(query)
    mocks.read(name, args)
    if (name !== "modules/people/persons:getMyPerson") throw new Error(`Unexpected own-profile query: ${name}`)
    return { value: mocks.person }
  },
}))

const PERSON = {
  _id: "person-awa", handle: "awa.recette", displayName: "Alias social libre", headline: "Accroche conservée",
  published: false, private: true, badges: [], consentsInForce: ["social_profile"], avatar: null, cover: null,
}
function setup() {
  const calls: { name: string; args: unknown }[] = []
  const query = vi.fn().mockImplementation(async (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(ref)
    calls.push({ name, args })
    if (name === "modules/people/persons:getMyPerson") return PERSON
    if (name === "modules/networks/networks:getBySlug") return { _id: "network-diasporale" }
    throw new Error(`Unexpected query: ${name}`)
  })
  const mutation = vi.fn().mockImplementation(async (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    calls.push({ name: getFunctionName(ref), args })
    return null
  })
  const source = createEngineDataSource({ convex: { query, mutation } as unknown as ConvexReactClient, authClient: {} as EngineAuthClient })
  return { source, publication: source.profilePublication!, query, mutation, calls }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
  mocks.person = PERSON
})
afterEach(cleanup)

describe("Profil commun — lecture propriétaire indépendante du profil public", () => {
  it("lit le profil retiré et privé de la session sans réseau ni donnée publique supplémentaire", () => {
    const { publication } = setup()
    const { result, rerender } = renderHook(() => publication.useMyProfile())
    expect(result.current).toEqual({ status: "ready", data: {
      personId: PERSON._id, handle: PERSON.handle, displayName: PERSON.displayName, headline: PERSON.headline, published: false, private: true,
    } })
    expect(mocks.read).toHaveBeenLastCalledWith("modules/people/persons:getMyPerson", {})
    mocks.person = { _id: "new-person", published: false, private: false }
    rerender()
    expect(result.current).toEqual({ status: "ready", data: { personId: "new-person", handle: null, displayName: null, headline: null, published: false, private: false } })
  })

  it.each(["pending", "anonymous"] as const)("ne lit aucune fiche pour une session %s", (kind) => {
    mocks.auth = { isAuthenticated: false, isPending: kind === "pending", isUnauthenticated: kind === "anonymous" }
    const { publication } = setup()
    const { result } = renderHook(() => publication.useMyProfile())
    expect(result.current).toEqual(kind === "pending" ? { status: "loading" } : { status: "error", code: "not_signed_in" })
    expect(mocks.read).not.toHaveBeenCalled()
  })

  it("distingue chargement, absence et refus fermé sans inventer de fiche", () => {
    const { publication } = setup()
    mocks.person = undefined
    const { result, rerender } = renderHook(() => publication.useMyProfile())
    expect(result.current).toEqual({ status: "loading" })
    mocks.person = null
    rerender()
    expect(result.current).toEqual({ status: "ready", data: null })
    mocks.person = new ConvexError({ code: "unauthenticated", detail: "PRIVATE_DETAIL" })
    rerender()
    expect(result.current).toEqual({ status: "error", code: "not_signed_in" })
  })
})

describe("Profil commun — gestes globaux relus à l'acte", () => {
  it("change seulement le mode privé après relecture de la personne attendue", async () => {
    const { publication, calls } = setup()
    expect(await publication.setPrivacy(PERSON._id, false)).toEqual({ ok: true, value: null })
    expect(calls).toEqual([
      { name: "modules/people/persons:getMyPerson", args: {} },
      { name: "modules/people/profile:setMyProfilePrivacy", args: { private: false } },
    ])
  })

  it("retire uniquement le profil, sans réseau, départ, consentement ou effacement", async () => {
    const { publication, query, calls } = setup()
    query.mockResolvedValueOnce({ ...PERSON, published: true })
    expect(await publication.withdraw(PERSON._id)).toEqual({ ok: true, value: null })
    expect(calls).toEqual([{ name: "modules/people/profile:withdrawMyProfile", args: {} }])
    expect(query).toHaveBeenCalledOnce()
  })

  it("republie les noms et l'accroche actuels plutôt que la fiche précédemment affichée", async () => {
    const { publication, query, calls } = setup()
    renderHook(() => publication.useMyProfile())
    query.mockResolvedValueOnce({ ...PERSON, handle: "identifiant.actuel", displayName: "Nom actuel", headline: "Accroche actuelle" })
    expect(await publication.republish(PERSON._id)).toEqual({ ok: true, value: null })
    expect(calls).toEqual([{ name: "modules/people/profile:publishMyProfile", args: {
      handle: "identifiant.actuel", displayName: "Nom actuel", headline: "Accroche actuelle",
    } }])
    expect(calls[0]?.args).not.toHaveProperty("private")
    expect(calls[0]?.args).not.toHaveProperty("networkId")
  })

  it("ne réécrit pas une republication déjà accomplie", async () => {
    const { publication, query, mutation } = setup()
    query.mockResolvedValueOnce({ ...PERSON, published: true })
    expect(await publication.republish(PERSON._id)).toEqual({ ok: true, value: null })
    expect(mutation).not.toHaveBeenCalled()
  })

  it("ferme aussi une panne technique inconnue sans exposer son détail", async () => {
    const { publication, query, mutation } = setup()
    query.mockRejectedValueOnce(new Error("PRIVATE_SERVER_DETAIL"))
    expect(await publication.withdraw(PERSON._id)).toEqual({ ok: false, code: "unknown" })
    expect(mutation).not.toHaveBeenCalled()
  })

  it.each(["privacy", "withdraw", "republish"] as const)("refuse le changement de lecteur avant le geste %s", async (kind) => {
    const { publication, mutation } = setup()
    const result = kind === "privacy" ? await publication.setPrivacy("former-person", false) : await publication[kind]("former-person")
    expect(result).toEqual({ ok: false, code: "not_found" })
    expect(mutation).not.toHaveBeenCalled()
  })

  it.each(["privacy", "withdraw", "republish"] as const)("ferme le geste %s lorsque la personne n'est plus authentifiée", async (kind) => {
    const { publication, query, mutation } = setup()
    query.mockResolvedValueOnce(null)
    const result = kind === "privacy" ? await publication.setPrivacy(PERSON._id, false) : await publication[kind](PERSON._id)
    expect(result).toEqual({ ok: false, code: "not_signed_in" })
    expect(mutation).not.toHaveBeenCalled()
  })

  it("ne fabrique pas une identité à republier et permet de réessayer un refus traduit", async () => {
    const { publication, query, mutation } = setup()
    query.mockResolvedValueOnce({ ...PERSON, handle: undefined })
    expect(await publication.republish(PERSON._id)).toEqual({ ok: false, code: "not_member" })
    expect(mutation).not.toHaveBeenCalled()
    mutation.mockRejectedValueOnce(new ConvexError({ code: "rateLimited", message: "PRIVATE_DETAIL" }))
    expect(await publication.republish(PERSON._id)).toEqual({ ok: false, code: "rate_limited" })
    expect(await publication.republish(PERSON._id)).toEqual({ ok: true, value: null })
  })
})

describe("Quitter DIASPORALE — geste distinct du profil et des consentements", () => {
  it("relit le lecteur et appelle seulement le départ dans le réseau diaspora", async () => {
    const { source, calls } = setup()
    expect(await source.actions.leaveDiasporale()).toEqual({ ok: true, value: null })
    expect(calls).toEqual([
      { name: "modules/people/persons:getMyPerson", args: {} },
      { name: "modules/networks/networks:getBySlug", args: { slug: "diasporale" } },
      { name: "modules/people/persons:getMyPerson", args: {} },
      { name: "modules/diaspora/membership:leaveDiasporale", args: { networkId: "network-diasporale" } },
    ])
  })

  it("refuse le départ si la session change durant sa préparation", async () => {
    const { source, query, mutation } = setup()
    query.mockResolvedValueOnce(PERSON).mockResolvedValueOnce({ _id: "network-diasporale" }).mockResolvedValueOnce({ ...PERSON, _id: "other-person" })
    expect(await source.actions.leaveDiasporale()).toEqual({ ok: false, code: "not_found" })
    expect(mutation).not.toHaveBeenCalled()
  })

  it("révoquer le consentement social n'appelle ni départ ni retrait", async () => {
    const { source, calls } = setup()
    expect(await source.actions.setConsent("social_profile", false)).toEqual({ ok: true, value: null })
    expect(calls).toEqual([
      { name: "modules/networks/networks:getBySlug", args: { slug: "diasporale" } },
      { name: "modules/people/consents:revokeConsent", args: { purpose: "social_profile" } },
    ])
  })
})
