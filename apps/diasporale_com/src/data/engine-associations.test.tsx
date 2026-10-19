// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import type { AssociationMembersRequest } from "@diasporale/features/data"
import { cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEngineAssociations } from "./engine-associations"
import { createEngineDataSource } from "./engine-source"

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isPending: false, isUnauthenticated: false },
  network: { _id: "network-diasporale" } as unknown,
  membership: undefined as unknown,
  results: new Map<string, unknown>(),
  loaded: vi.fn(),
}))
vi.mock("@antsia/api/hooks", () => ({
  useStableConvexAuth: () => mocks.auth,
  useAuthenticatedConvexQuery: () => ({ data: undefined, isError: false, isSuccess: false, isFetching: true, dataUpdatedAt: 0, error: null, refetch: vi.fn() }),
}))
vi.mock("convex/react", () => ({
  useQueries: (queries: Record<string, { query: Parameters<typeof getFunctionName>[0]; args?: unknown }>) => {
    if (!queries.value) return {}
    const name = getFunctionName(queries.value.query)
    mocks.loaded(name, queries.value.args)
    if (name === "modules/networks/networks:getBySlug") return { value: mocks.network }
    if (name === "modules/diaspora/membership:myMembership") return { value: mocks.membership }
    return { value: mocks.results.get(name) }
  },
}))

const MEMBER = { status: "declaree", capabilities: ["read_network", "publish"], facet: { countryOfResidence: "FR" } }
const Q = {
  mine: "modules/diaspora/associations:myAssociationMembership",
  myList: "modules/diaspora/associations:myAssociations",
  managed: "modules/diaspora/associations:managedAssociation",
  members: "modules/diaspora/associations:associationMembers",
}
const MEMBERSHIP_DTO = {
  pageId: "page-1",
  membership: {
    membershipId: "membership-1", status: "requested", role: "member", requestMessage: "Bonjour", decisionReason: null,
    requestedAt: 10, statusChangedAt: 10, readmissionAllowed: false,
  },
  request: { allowed: false, refusal: "association_request_pending", availableAt: null },
  responsibleRole: null,
}
const MEMBER_ROW = {
  membershipId: "membership-2", status: "requested", role: "member",
  person: { displayName: "Personne fictive", handle: "personne.fictive", avatarUrl: null },
  requestMessage: "Mot", decisionReason: null, requestedAt: 5, statusChangedAt: 5, readmissionAllowed: false, version: 1,
}

function convex() {
  return {
    query: vi.fn().mockResolvedValue({ _id: "network-diasporale" }),
    mutation: vi.fn().mockResolvedValue({ version: 2 }),
  }
}
function capability(client = convex()) {
  return { client, associations: createEngineAssociations({ convex: client as unknown as ConvexReactClient, authClient: {} as EngineAuthClient }) }
}
function calls(name: string) {
  return mocks.loaded.mock.calls.filter(([called]) => called === name).map(([, args]) => args)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
  mocks.network = { _id: "network-diasporale" }
  mocks.membership = { ...MEMBER }
  mocks.results = new Map<string, unknown>([
    [Q.mine, MEMBERSHIP_DTO],
    [Q.myList, { page: [{ membershipId: "membership-1", status: "accepted", role: "animator", decisionReason: null, statusChangedAt: 3, page: { pageId: "page-1", handle: "collectif", name: "Collectif fictif" } }], isDone: false, continueCursor: "opaque-next" }],
    [Q.managed, { pageId: "page-1", handle: "collectif", name: "Collectif fictif", role: "signatory" }],
    [Q.members, { page: [MEMBER_ROW], isDone: true, continueCursor: "ignored-at-the-end" }],
  ])
})
afterEach(cleanup)

describe("associations — lectures du moteur", () => {
  it("est la capacité servie par la source moteur", () => {
    const source = createEngineDataSource({ convex: {} as ConvexReactClient, authClient: {} as EngineAuthClient })
    expect(Object.keys(source.associations ?? {}).sort()).toEqual([
      "allowReadmission", "cancelRequest", "decide", "leave", "remove", "request", "setRole",
      "useManagedAssociation", "useMembers", "useMyAssociations", "useMyMembership",
    ])
  })

  it("ma situation : bornée au réseau, projection stable entre deux rendus", () => {
    const { associations } = capability()
    const { result, rerender } = renderHook(() => associations.useMyMembership("page-1"))
    expect(calls(Q.mine)).toContainEqual({ networkId: "network-diasporale", pageId: "page-1" })
    expect(result.current).toEqual({ status: "ready", data: MEMBERSHIP_DTO })
    const first = result.current.status === "ready" ? result.current.data : null
    rerender()
    expect(result.current.status === "ready" ? result.current.data : undefined).toBe(first)
  })

  it("n'interroge rien tant que l'adhésion du lecteur n'est pas connue, ni sans page", () => {
    mocks.membership = undefined
    const { associations } = capability()
    expect(renderHook(() => associations.useMyMembership("page-1")).result.current).toEqual({ status: "loading" })
    mocks.membership = { ...MEMBER }
    expect(renderHook(() => associations.useMyMembership("")).result.current).toEqual({ status: "loading" })
    expect(calls(Q.mine)).toEqual([])
  })

  it.each([
    { membership: null, code: "not_member" },
    { membership: { ...MEMBER, status: "suspendue", capabilities: [] }, code: "suspended" },
    { membership: new ConvexError({ code: "membershipSuspended" }), code: "suspended" },
  ])("refuse sans interroger : $code", ({ membership, code }) => {
    mocks.membership = membership
    const { associations } = capability()
    expect(renderHook(() => associations.useMembers({ pageId: "page-1", status: "accepted", cursor: null })).result.current).toEqual({ status: "error", code })
    expect(calls(Q.members)).toEqual([])
  })

  it("un refus du serveur devient un code fermé : refus indistinct ou règle de l'adhésion", () => {
    mocks.results.set(Q.managed, new ConvexError({ code: "notFound" }))
    mocks.results.set(Q.mine, new ConvexError({ code: "policyRefused", appRule: "association_not_managed", appParams: {} }))
    const { associations } = capability()
    expect(renderHook(() => associations.useManagedAssociation("collectif")).result.current).toEqual({ status: "error", code: "not_found" })
    expect(renderHook(() => associations.useMyMembership("page-1")).result.current).toEqual({ status: "error", code: "association_not_managed" })
    mocks.auth = { isAuthenticated: false, isPending: false, isUnauthenticated: true }
    expect(renderHook(() => associations.useMyAssociations({ cursor: null })).result.current).toEqual({ status: "error", code: "not_signed_in" })
  })

  it("mes associations : fenêtre de vingt, curseur opaque transmis, page traduite", () => {
    const { associations } = capability()
    const { result, rerender } = renderHook((args: { cursor: string | null }) => associations.useMyAssociations(args), { initialProps: { cursor: null as string | null } })
    expect(calls(Q.myList)).toContainEqual({ networkId: "network-diasporale", paginationOpts: { cursor: null, numItems: 20 } })
    expect(result.current).toEqual({
      status: "ready",
      data: {
        items: [{ membershipId: "membership-1", status: "accepted", role: "animator", decisionReason: null, statusChangedAt: 3, page: { id: "page-1", handle: "collectif", name: "Collectif fictif" } }],
        continueCursor: "opaque-next",
        isDone: false,
      },
    })
    rerender({ cursor: "opaque-next" })
    expect(calls(Q.myList)).toContainEqual({ networkId: "network-diasporale", paginationOpts: { cursor: "opaque-next", numItems: 20 } })
  })

  it("les listes des responsables : statut et curseur transmis, aucune suite après la dernière fenêtre", () => {
    const { associations } = capability()
    const request: AssociationMembersRequest = { pageId: "page-1", status: "requested", cursor: null }
    const { result } = renderHook(() => associations.useMembers(request))
    expect(calls(Q.members)).toContainEqual({ networkId: "network-diasporale", pageId: "page-1", status: "requested", paginationOpts: { cursor: null, numItems: 20 } })
    expect(result.current).toEqual({ status: "ready", data: { items: [MEMBER_ROW], continueCursor: null, isDone: true } })
    expect(renderHook(() => associations.useManagedAssociation("collectif")).result.current).toEqual({ status: "ready", data: { pageId: "page-1", handle: "collectif", name: "Collectif fictif", role: "signatory" } })
    expect(calls(Q.managed)).toContainEqual({ networkId: "network-diasporale", handle: "collectif" })
    expect(renderHook(() => associations.useManagedAssociation("")).result.current).toEqual({ status: "loading" })
  })
})

describe("associations — écritures du moteur", () => {
  it("demander : le mot vide n'est pas envoyé, le réseau est résolu d'abord", async () => {
    const { client, associations } = capability()
    expect(await associations.request({ pageId: "page-1", message: "   " })).toEqual({ ok: true, value: null })
    expect(await associations.request({ pageId: "page-1", message: "Bonjour" })).toEqual({ ok: true, value: null })
    expect(getFunctionName(client.query.mock.calls[0]![0])).toBe("modules/networks/networks:getBySlug")
    const sent = client.mutation.mock.calls.map(([reference, args]) => [getFunctionName(reference), args])
    expect(sent).toEqual([
      ["modules/diaspora/associations:requestAssociationMembership", { networkId: "network-diasporale", pageId: "page-1" }],
      ["modules/diaspora/associations:requestAssociationMembership", { networkId: "network-diasporale", pageId: "page-1", message: "Bonjour" }],
    ])
  })

  it("annuler, quitter, décider, exclure, nommer, réadmettre : chaque fonction de la tranche, avec la version lue", async () => {
    const { client, associations } = capability()
    await associations.cancelRequest("page-1")
    await associations.leave("page-1")
    await associations.decide({ membershipId: "m-1", decision: "accept", expectedVersion: 3, reason: "ignoré" })
    await associations.decide({ membershipId: "m-1", decision: "reject", expectedVersion: 3, reason: "  " })
    await associations.decide({ membershipId: "m-1", decision: "reject", expectedVersion: 3, reason: "Complet" })
    await associations.remove({ membershipId: "m-1", expectedVersion: 4, reason: "Propos injurieux répétés" })
    await associations.setRole({ membershipId: "m-1", expectedVersion: 5, role: "animator" })
    await associations.allowReadmission({ membershipId: "m-1", expectedVersion: 6 })
    const networkId = "network-diasporale"
    expect(client.mutation.mock.calls.map(([reference, args]) => [getFunctionName(reference).split(":")[1], args])).toEqual([
      ["cancelAssociationMembershipRequest", { networkId, pageId: "page-1" }],
      ["leaveAssociation", { networkId, pageId: "page-1" }],
      ["decideAssociationMembership", { networkId, membershipId: "m-1", decision: "accept", expectedVersion: 3 }],
      ["decideAssociationMembership", { networkId, membershipId: "m-1", decision: "reject", expectedVersion: 3 }],
      ["decideAssociationMembership", { networkId, membershipId: "m-1", decision: "reject", expectedVersion: 3, reason: "Complet" }],
      ["removeAssociationMember", { networkId, membershipId: "m-1", expectedVersion: 4, reason: "Propos injurieux répétés" }],
      ["setAssociationMemberRole", { networkId, membershipId: "m-1", expectedVersion: 5, role: "animator" }],
      ["allowAssociationReadmission", { networkId, membershipId: "m-1", expectedVersion: 6 }],
    ])
  })

  it("un refus rend un code fermé, jamais une exception jusqu'à l'écran", async () => {
    const client = convex()
    client.mutation
      .mockRejectedValueOnce(new ConvexError({ code: "conflict", appRule: "association_version_conflict", appParams: {} }))
      .mockRejectedValueOnce(new ConvexError({ code: "notFound" }))
      .mockRejectedValueOnce(new ConvexError({ code: "statusInsufficient" }))
      .mockRejectedValueOnce(new Error("trace privée"))
    const { associations } = capability(client)
    expect(await associations.decide({ membershipId: "m-1", decision: "accept", expectedVersion: 1, reason: "" })).toEqual({ ok: false, code: "association_version_conflict" })
    expect(await associations.remove({ membershipId: "m-1", expectedVersion: 1, reason: "Motif assez long" })).toEqual({ ok: false, code: "not_found" })
    expect(await associations.request({ pageId: "page-1", message: "" })).toEqual({ ok: false, code: "status_insufficient" })
    expect(await associations.leave("page-1")).toEqual({ ok: false, code: "unknown" })
    client.query.mockResolvedValueOnce(null)
    expect(await associations.cancelRequest("page-1")).toEqual({ ok: false, code: "network_unavailable" })
  })
})
