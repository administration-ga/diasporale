// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import type { ArrivalKitListRequest } from "@diasporale/features/data"
import { cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEngineArrivalKit, listArgsOf, resourceArgsOf } from "./engine-arrival-kit"
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
  useConvexAuth: () => ({ isAuthenticated: mocks.auth.isAuthenticated, isLoading: false }),
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
  standing: "modules/diaspora/arrivalKit:myKitStanding",
  list: "modules/diaspora/arrivalKit:listResources",
  detail: "modules/diaspora/arrivalKit:getResource",
  mine: "modules/diaspora/arrivalKit:myResources",
  queue: "modules/diaspora/arrivalKit:reviewQueue",
}
const PAGE_CARD = {
  pageId: "page-1", networkId: "network-diasporale", handle: "poste-fictif", name: "Poste fictif (démo)", shortName: null, logoUrl: null,
  badge: "official", ownerKind: "institution", country: "FR",
}
const PAGE_VIEW = { id: "page-1", handle: "poste-fictif", name: "Poste fictif (démo)", badge: "official", ownerKind: "institution" }
const CARD = {
  resourceId: "resource-1", version: 2, revision: 1, title: "Ressource fictive", summary: "Un résumé fictif de la ressource.", category: "procedures",
  country: "FR", city: null, status: "published", reviewCause: null, lastVerifiedAt: 10, reviewDueAt: 20, revisedAt: 5, reviewedAt: 6,
  carrier: { kind: "page", page: PAGE_CARD }, official: true,
}
const CARD_VIEW = {
  id: "resource-1", version: 2, revision: 1, title: "Ressource fictive", summary: "Un résumé fictif de la ressource.", category: "procedures",
  country: "FR", city: null, status: "published", reviewCause: null, lastVerifiedAt: 10, reviewDueAt: 20, revisedAt: 5, reviewedAt: 6,
  carrier: { kind: "page", page: PAGE_VIEW }, official: true,
}
const PERSON_CARRIER = { kind: "person", person: { displayName: "Personne fictive", handle: "personne.fictive" } }
const DETAIL = {
  ...CARD, carrier: PERSON_CARRIER, official: false, body: "Un contenu fictif.", sourceName: "Source fictive", sourceUrl: "https://www.exemple-public.fr/",
  createdAt: 1, submittedAt: 4, reviewer: { displayName: null, handle: null }, statusReason: null, outdatedFlags: null,
  viewer: { canManage: false, canReview: false, canFlag: true, hasFlagged: false },
}
const REQUEST: ArrivalKitListRequest = { country: "FR", city: null, nationalOnly: false, category: null, cursor: null }
const INPUT = {
  title: "Ressource fictive", summary: "Un résumé fictif de la ressource.", body: "Un contenu fictif.", category: "procedures" as const,
  country: "FR" as const, city: "", sourceName: "Source fictive", sourceUrl: "https://www.exemple-public.fr/", lastVerifiedAt: 10,
}

function convex() {
  return {
    query: vi.fn().mockResolvedValue({ _id: "network-diasporale" }),
    mutation: vi.fn().mockResolvedValue({ resourceId: "resource-9", version: 1, revision: 1, status: "submitted" }),
  }
}
function capability(client = convex()) {
  return { client, kit: createEngineArrivalKit({ convex: client as unknown as ConvexReactClient, authClient: {} as EngineAuthClient }) }
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
    [Q.standing, { canPropose: true, canReview: false, carrierPages: [PAGE_CARD] }],
    [Q.list, { page: [CARD], isDone: false, continueCursor: "opaque-next" }],
    [Q.detail, DETAIL],
    [Q.mine, { page: [{ ...CARD, status: "draft", statusReason: "Motif fictif du renvoi.", outdatedFlags: 0 }], isDone: true, continueCursor: "ignored-at-the-end" }],
    [Q.queue, { page: [{ ...CARD, status: "submitted", submittedAt: 7 }], isDone: true, continueCursor: "ignored" }],
  ])
})
afterEach(cleanup)

describe("kit d'arrivée — lectures du moteur", () => {
  it("est la capacité servie par la source moteur", () => {
    const source = createEngineDataSource({ convex: {} as ConvexReactClient, authClient: {} as EngineAuthClient })
    expect(Object.keys(source.arrivalKit ?? {}).sort()).toEqual([
      "flagOutdated", "markForReview", "propose", "review", "submit", "update",
      "useMyResources", "useResource", "useResources", "useReviewQueue", "useStanding", "withdraw",
    ])
  })

  it("le kit public : borné au réseau, fenêtre de vingt, ville vide non envoyée, projection stable entre deux rendus", () => {
    const { kit } = capability()
    const { result, rerender } = renderHook((request: ArrivalKitListRequest) => kit.useResources(request), { initialProps: REQUEST })
    expect(calls(Q.list)).toContainEqual({ networkId: "network-diasporale", country: "FR", paginationOpts: { numItems: 20, cursor: null } })
    expect(result.current).toEqual({ status: "ready", data: { items: [CARD_VIEW], continueCursor: "opaque-next", isDone: false } })
    const first = result.current.status === "ready" ? result.current.data : null
    rerender(REQUEST)
    expect(result.current.status === "ready" ? result.current.data : undefined).toBe(first)
    rerender({ ...REQUEST, city: " Lyon ", category: "housing", cursor: "opaque-next" })
    expect(calls(Q.list)).toContainEqual({ networkId: "network-diasporale", country: "FR", city: "Lyon", category: "housing", paginationOpts: { numItems: 20, cursor: "opaque-next" } })
  })

  it("les arguments de lecture : « national » seulement sans ville ; une ville l'emporte", () => {
    expect(listArgsOf({ ...REQUEST, nationalOnly: true })).toEqual({ country: "FR", nationalOnly: true })
    expect(listArgsOf({ ...REQUEST, city: "Paris", nationalOnly: true })).toEqual({ country: "FR", city: "Paris" })
    expect(listArgsOf({ ...REQUEST, city: "   ", category: "health" })).toEqual({ country: "FR", category: "health" })
  })

  it("n'interroge rien tant que l'adhésion du lecteur n'est pas connue, ni sans identifiant de ressource", () => {
    mocks.membership = undefined
    const { kit } = capability()
    expect(renderHook(() => kit.useResources(REQUEST)).result.current).toEqual({ status: "loading" })
    mocks.membership = { ...MEMBER }
    expect(renderHook(() => kit.useResource("")).result.current).toEqual({ status: "loading" })
    expect(calls(Q.list)).toEqual([])
    expect(calls(Q.detail)).toEqual([])
  })

  it.each([
    { membership: null, code: "not_member" },
    { membership: { ...MEMBER, status: "suspendue", capabilities: [] }, code: "suspended" },
    { membership: new ConvexError({ code: "membershipSuspended" }), code: "suspended" },
  ])("refuse sans interroger : $code", ({ membership, code }) => {
    mocks.membership = membership
    const { kit } = capability()
    expect(renderHook(() => kit.useReviewQueue({ country: "FR", cursor: null })).result.current).toEqual({ status: "error", code })
    expect(calls(Q.queue)).toEqual([])
  })

  it("un refus du serveur devient un code fermé : refus indistinct ou règle du kit", () => {
    mocks.results.set(Q.queue, new ConvexError({ code: "policyRefused", appRule: "arrival_kit_reviewer_not_eligible", appParams: {} }))
    mocks.results.set(Q.list, new ConvexError({ code: "notFound" }))
    const { kit } = capability()
    expect(renderHook(() => kit.useReviewQueue({ country: "FR", cursor: null })).result.current).toEqual({ status: "error", code: "arrival_kit_reviewer_not_eligible" })
    expect(renderHook(() => kit.useResources(REQUEST)).result.current).toEqual({ status: "error", code: "not_found" })
    mocks.auth = { isAuthenticated: false, isPending: false, isUnauthenticated: true }
    expect(renderHook(() => kit.useStanding()).result.current).toEqual({ status: "error", code: "not_signed_in" })
  })

  it("la fiche : source, relecteur et droits traduits ; `null` reste un état neutre", () => {
    const { kit } = capability()
    expect(renderHook(() => kit.useResource("resource-1")).result.current).toEqual({
      status: "ready",
      data: {
        ...CARD_VIEW,
        carrier: PERSON_CARRIER,
        official: false,
        body: "Un contenu fictif.",
        source: { name: "Source fictive", url: "https://www.exemple-public.fr/" },
        createdAt: 1,
        submittedAt: 4,
        reviewer: { displayName: null, handle: null },
        statusReason: null,
        outdatedFlags: null,
        viewer: { canManage: false, canReview: false, canFlag: true, hasFlagged: false },
      },
    })
    expect(calls(Q.detail)).toContainEqual({ networkId: "network-diasporale", resourceId: "resource-1" })
    mocks.results.set(Q.detail, null)
    expect(renderHook(() => kit.useResource("resource-1")).result.current).toEqual({ status: "ready", data: null })
  })

  it("mes propositions, file de relecture et situation : curseur transmis, aucune suite après la dernière fenêtre", () => {
    const { kit } = capability()
    expect(renderHook(() => kit.useMyResources({ cursor: "opaque" })).result.current).toEqual({
      status: "ready",
      data: { items: [{ ...CARD_VIEW, status: "draft", statusReason: "Motif fictif du renvoi.", outdatedFlags: 0 }], continueCursor: null, isDone: true },
    })
    expect(calls(Q.mine)).toContainEqual({ networkId: "network-diasporale", paginationOpts: { numItems: 20, cursor: "opaque" } })
    expect(renderHook(() => kit.useReviewQueue({ country: "CA", cursor: null })).result.current).toEqual({
      status: "ready",
      data: { items: [{ ...CARD_VIEW, status: "submitted", submittedAt: 7 }], continueCursor: null, isDone: true },
    })
    expect(calls(Q.queue)).toContainEqual({ networkId: "network-diasporale", country: "CA", paginationOpts: { numItems: 20, cursor: null } })
    expect(renderHook(() => kit.useStanding()).result.current).toEqual({ status: "ready", data: { canPropose: true, canReview: false, carrierPages: [PAGE_VIEW] } })
    expect(calls(Q.standing)).toContainEqual({ networkId: "network-diasporale" })
  })
})

describe("kit d'arrivée — écritures du moteur", () => {
  it("proposer : la ville vide et la page absente ne sont pas envoyées ; le réseau est résolu d'abord", async () => {
    const { client, kit } = capability()
    expect(await kit.propose({ ...INPUT, pageId: null, submit: true })).toEqual({ ok: true, value: { resourceId: "resource-9" } })
    expect(await kit.propose({ ...INPUT, city: "Lyon", pageId: "page-1", submit: false })).toEqual({ ok: true, value: { resourceId: "resource-9" } })
    expect(getFunctionName(client.query.mock.calls[0]![0])).toBe("modules/networks/networks:getBySlug")
    const fields = resourceArgsOf(INPUT)
    expect(fields).not.toHaveProperty("city")
    expect(client.mutation.mock.calls.map(([reference, args]) => [getFunctionName(reference), args])).toEqual([
      ["modules/diaspora/arrivalKit:proposeResource", { networkId: "network-diasporale", ...fields, submit: true }],
      ["modules/diaspora/arrivalKit:proposeResource", { networkId: "network-diasporale", ...fields, city: "Lyon", pageId: "page-1", submit: false }],
    ])
  })

  it("modifier, soumettre, retirer, relire, marquer, signaler : chaque fonction de la tranche, avec la version lue", async () => {
    const { client, kit } = capability()
    await kit.update({ ...INPUT, resourceId: "r-1", expectedVersion: 2, submit: true })
    await kit.submit({ resourceId: "r-1", expectedVersion: 3 })
    await kit.withdraw({ resourceId: "r-1", expectedVersion: 4 })
    await kit.review({ resourceId: "r-1", expectedVersion: 5, decision: "publish", reason: "ignoré" })
    await kit.review({ resourceId: "r-1", expectedVersion: 5, decision: "return", reason: "  " })
    await kit.review({ resourceId: "r-1", expectedVersion: 5, decision: "return", reason: "Précisez la source." })
    await kit.markForReview({ resourceId: "r-1", expectedVersion: 6, reason: "Les tarifs ont changé." })
    await kit.flagOutdated({ resourceId: "r-1", revision: 2, reason: "link_broken" })
    const networkId = "network-diasporale"
    expect(client.mutation.mock.calls.map(([reference, args]) => [getFunctionName(reference).split(":")[1], args])).toEqual([
      ["updateResource", { networkId, resourceId: "r-1", expectedVersion: 2, ...resourceArgsOf(INPUT), submit: true }],
      ["submitResource", { networkId, resourceId: "r-1", expectedVersion: 3 }],
      ["withdrawResource", { networkId, resourceId: "r-1", expectedVersion: 4 }],
      ["reviewResource", { networkId, resourceId: "r-1", expectedVersion: 5, decision: "publish" }],
      ["reviewResource", { networkId, resourceId: "r-1", expectedVersion: 5, decision: "return" }],
      ["reviewResource", { networkId, resourceId: "r-1", expectedVersion: 5, decision: "return", reason: "Précisez la source." }],
      ["markResourceForReview", { networkId, resourceId: "r-1", expectedVersion: 6, reason: "Les tarifs ont changé." }],
      ["flagResourceOutdated", { networkId, resourceId: "r-1", revision: 2, reason: "link_broken" }],
    ])
  })

  it("un refus rend un code fermé, jamais une exception jusqu'à l'écran", async () => {
    const client = convex()
    client.mutation
      .mockRejectedValueOnce(new ConvexError({ code: "conflict", appRule: "arrival_kit_already_flagged", appParams: {} }))
      .mockRejectedValueOnce(new ConvexError({ code: "invalidArgument", appRule: "arrival_kit_source_url_not_https", appParams: {} }))
      .mockRejectedValueOnce(new ConvexError({ code: "notFound" }))
      .mockRejectedValueOnce(new ConvexError({ code: "statusInsufficient" }))
      .mockRejectedValueOnce(new Error("trace privée"))
    const { kit } = capability(client)
    expect(await kit.flagOutdated({ resourceId: "r-1", revision: 1, reason: "other" })).toEqual({ ok: false, code: "arrival_kit_already_flagged" })
    expect(await kit.propose({ ...INPUT, pageId: null, submit: true })).toEqual({ ok: false, code: "arrival_kit_source_url_not_https" })
    expect(await kit.withdraw({ resourceId: "r-1", expectedVersion: 1 })).toEqual({ ok: false, code: "not_found" })
    expect(await kit.submit({ resourceId: "r-1", expectedVersion: 1 })).toEqual({ ok: false, code: "status_insufficient" })
    expect(await kit.markForReview({ resourceId: "r-1", expectedVersion: 1, reason: "Motif suffisant." })).toEqual({ ok: false, code: "unknown" })
    client.query.mockResolvedValueOnce(null)
    expect(await kit.review({ resourceId: "r-1", expectedVersion: 1, decision: "publish", reason: "" })).toEqual({ ok: false, code: "network_unavailable" })
  })
})
