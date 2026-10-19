// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import type { Loadable } from "@diasporale/features/data"
import { cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEngineMutualAid } from "./engine-mutual-aid"
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
const NETWORK = "network-diasporale"
const Q = {
  questions: "modules/diaspora/mutualAid:listQuestions",
  mine: "modules/diaspora/mutualAid:myQuestions",
  item: "modules/diaspora/mutualAid:aidItem",
  answers: "modules/diaspora/mutualAid:listAnswers",
  missions: "modules/diaspora/mutualAid:listMissions",
  signups: "modules/diaspora/mutualAid:mySignups",
  pages: "modules/diaspora/mutualAid:missionPages",
  pageMissions: "modules/diaspora/mutualAid:pageMissions",
  volunteers: "modules/diaspora/mutualAid:missionVolunteers",
}

const AUTHOR = { displayName: "Personne fictive", handle: "personne.fictive" }
const QUESTION_CARD = {
  questionId: "question-1", title: "Trouver un médecin traitant", detail: "", theme: "health", country: "FR", city: "Lyon",
  status: "open", answerCount: 2, hasAcceptedAnswer: true, author: AUTHOR, isMine: false, createdAt: 10,
}
const ANSWER = {
  answerId: "answer-1", questionId: "question-1", body: "La maison de santé du quartier accepte de nouveaux patients.", version: 1,
  author: { displayName: null, handle: null }, isMine: true, isAccepted: true, createdAt: 11, editedAt: null,
}
const PAGE_CARD = {
  pageId: "page-1", networkId: NETWORK, handle: "collectif", name: "Collectif fictif", shortName: null, logoUrl: null,
  badge: "verified", ownerKind: "association", country: "FR",
}
const MISSION_CARD = {
  missionId: "mission-1", page: PAGE_CARD, title: "Accueil à la gare", description: "Orienter les nouveaux arrivants.", country: "FR",
  city: "Lyon", area: null, startsAt: 100, endsAt: null, timeZone: "Europe/Paris", places: 4, signupCount: 1, status: "open", signedUp: false,
}

function convex() {
  return {
    query: vi.fn().mockResolvedValue({ _id: NETWORK }),
    mutation: vi.fn().mockResolvedValue({ version: 2, questionId: "question-9", answerId: "answer-9", missionId: "mission-9" }),
  }
}
function capability(client = convex()) {
  return { client, aid: createEngineMutualAid({ convex: client as unknown as ConvexReactClient, authClient: {} as EngineAuthClient }) }
}
function calls(name: string) {
  return mocks.loaded.mock.calls.filter(([called]) => called === name).map(([, args]) => args)
}
function sent(client: ReturnType<typeof convex>) {
  return client.mutation.mock.calls.map(([reference, args]) => [getFunctionName(reference).split(":")[1], args])
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
  mocks.network = { _id: NETWORK }
  mocks.membership = { ...MEMBER }
  mocks.results = new Map<string, unknown>([
    [Q.questions, { page: [QUESTION_CARD], isDone: false, continueCursor: "opaque-next" }],
    [Q.mine, { page: [{ ...QUESTION_CARD, isMine: true }], isDone: true, continueCursor: "ignored-at-the-end" }],
    [Q.item, {
      kind: "question",
      question: { ...QUESTION_CARD, version: 3, updatedAt: 12, editedAt: null, acceptedAnswer: ANSWER, canAnswer: true, canEdit: false },
    }],
    [Q.answers, { page: [ANSWER], isDone: true, continueCursor: "end" }],
    [Q.missions, { page: [MISSION_CARD], isDone: true, continueCursor: "end" }],
    [Q.signups, { page: [{ ...MISSION_CARD, signedUp: true }], isDone: true, continueCursor: "end" }],
    [Q.pages, [{ pageId: "page-1", handle: "collectif", name: "Collectif fictif", country: "FR", city: null }]],
    [Q.pageMissions, { page: [MISSION_CARD], isDone: false, continueCursor: "page-next" }],
    [Q.volunteers, { page: [{ signupId: "signup-1", person: AUTHOR, signedUpAt: 50 }], isDone: true, continueCursor: "end" }],
  ])
})
afterEach(cleanup)

describe("entraide — lectures du moteur", () => {
  it("est la capacité servie par la source moteur", () => {
    const source = createEngineDataSource({ convex: {} as ConvexReactClient, authClient: {} as EngineAuthClient })
    expect(Object.keys(source.mutualAid ?? {}).sort()).toEqual([
      "acceptAnswer", "answer", "askQuestion", "cancelMission", "closeMission", "closeQuestion", "createMission", "signUp",
      "unacceptAnswer", "updateAnswer", "updateMission", "updateQuestion", "useAnswers", "useItem", "useMissionPages", "useMissions",
      "useMyQuestions", "useMySignups", "usePageMissions", "useQuestions", "useVolunteers", "withdrawAnswer", "withdrawQuestion", "withdrawSignup",
    ])
  })

  it("les questions d'un pays : bornées au réseau, ville vide non envoyée, page traduite et stable", () => {
    const { aid } = capability()
    const { result, rerender } = renderHook(() => aid.useQuestions({ country: "FR", city: "  ", status: "open", cursor: null }))
    expect(calls(Q.questions)).toContainEqual({ networkId: NETWORK, country: "FR", status: "open", paginationOpts: { cursor: null, numItems: 20 } })
    expect(result.current).toEqual({
      status: "ready",
      data: {
        items: [{
          id: "question-1", title: "Trouver un médecin traitant", detail: "", theme: "health", country: "FR", city: "Lyon",
          status: "open", answerCount: 2, hasAcceptedAnswer: true, author: AUTHOR, isMine: false, createdAt: 10,
        }],
        continueCursor: "opaque-next",
        isDone: false,
      },
    })
    const first = result.current.status === "ready" ? result.current.data : null
    rerender()
    expect(result.current.status === "ready" ? result.current.data : undefined).toBe(first)

    renderHook(() => aid.useQuestions({ country: "BE", city: " Liège ", status: "resolved", cursor: "opaque-next" }))
    expect(calls(Q.questions)).toContainEqual({ networkId: NETWORK, country: "BE", city: "Liège", status: "resolved", paginationOpts: { cursor: "opaque-next", numItems: 20 } })
    const mine = renderHook(() => aid.useMyQuestions({ cursor: null })).result.current
    expect(mine).toMatchObject({ status: "ready", data: { continueCursor: null, isDone: true, items: [{ id: "question-1", isMine: true }] } })
  })

  it("même réponse, même objet : chaque lecture garde sa référence d'un rendu à l'autre, refus compris", () => {
    // Le paginateur des listes compare la référence : un objet neuf à chaque rendu le faisait
    // boucler sans fin sur /entraide (recette à deux comptes du 19/10).
    const { aid } = capability()
    const reads: ReadonlyArray<() => Loadable<unknown>> = [
      () => aid.useQuestions({ country: "FR", status: "open", cursor: null }),
      () => aid.useMyQuestions({ cursor: null }),
      () => aid.useItem("question-1"),
      () => aid.useAnswers({ questionId: "question-1", cursor: null }),
      () => aid.useMissions({ country: "FR", from: 0, cursor: null }),
      () => aid.useMySignups({ cursor: null }),
      () => aid.useMissionPages(),
      () => aid.usePageMissions({ pageId: "page-1", cursor: null }),
      () => aid.useVolunteers({ missionId: "mission-1", cursor: null }),
    ]
    for (const read of reads) {
      const { result, rerender } = renderHook(read)
      const first = result.current
      expect(first.status).toBe("ready")
      rerender()
      expect(result.current).toBe(first)
    }
    mocks.results.set(Q.questions, new ConvexError({ code: "invalidArgument", appRule: "aid_country_is_home", appParams: {} }))
    const refused = renderHook(() => aid.useQuestions({ country: "FR", status: "open", cursor: null }))
    const first = refused.result.current
    expect(first).toEqual({ status: "error", code: "aid_country_is_home" })
    refused.rerender()
    expect(refused.result.current).toBe(first)
  })

  it("n'interroge rien tant que l'adhésion du lecteur n'est pas connue, ni sans identifiant", () => {
    mocks.membership = undefined
    const { aid } = capability()
    expect(renderHook(() => aid.useItem("question-1")).result.current).toEqual({ status: "loading" })
    mocks.membership = { ...MEMBER }
    expect(renderHook(() => aid.useItem("")).result.current).toEqual({ status: "loading" })
    expect(renderHook(() => aid.useAnswers({ questionId: "", cursor: null })).result.current).toEqual({ status: "loading" })
    expect(renderHook(() => aid.useVolunteers({ missionId: "", cursor: null })).result.current).toEqual({ status: "loading" })
    expect(renderHook(() => aid.usePageMissions({ pageId: "", cursor: null })).result.current).toEqual({ status: "loading" })
    expect(calls(Q.item)).toEqual([])
    expect(calls(Q.answers)).toEqual([])
  })

  it.each([
    { membership: null, code: "not_member" },
    { membership: { ...MEMBER, status: "suspendue", capabilities: [] }, code: "suspended" },
    { membership: new ConvexError({ code: "membershipSuspended" }), code: "suspended" },
  ])("refuse sans interroger : $code", ({ membership, code }) => {
    mocks.membership = membership
    const { aid } = capability()
    expect(renderHook(() => aid.useMissions({ country: "FR", from: 0, cursor: null })).result.current).toEqual({ status: "error", code })
    expect(calls(Q.missions)).toEqual([])
  })

  it("une entraide : la question et sa réponse retenue, une mission, ou `null` ; un refus du serveur devient un code fermé", () => {
    const { aid } = capability()
    const question = renderHook(() => aid.useItem("question-1")).result.current
    expect(calls(Q.item)).toContainEqual({ networkId: NETWORK, itemId: "question-1" })
    expect(question).toMatchObject({
      status: "ready",
      data: { kind: "question", question: { id: "question-1", version: 3, canAnswer: true, canEdit: false, acceptedAnswer: { id: "answer-1", isAccepted: true, author: { displayName: null } } } },
    })

    mocks.results.set(Q.item, {
      kind: "mission",
      mission: { ...MISSION_CARD, version: 2, cancelReason: null, signup: { allowed: false, refusal: "status_insufficient" }, canManage: true, createdAt: 1, updatedAt: 2 },
    })
    expect(renderHook(() => aid.useItem("mission-1")).result.current).toEqual({
      status: "ready",
      data: {
        kind: "mission",
        mission: {
          id: "mission-1", page: { id: "page-1", handle: "collectif", name: "Collectif fictif", badge: "verified" }, title: "Accueil à la gare",
          description: "Orienter les nouveaux arrivants.", country: "FR", city: "Lyon", area: null, startsAt: 100, endsAt: null, timeZone: "Europe/Paris",
          places: 4, signupCount: 1, status: "open", signedUp: false, version: 2, cancelReason: null,
          signup: { allowed: false, refusal: "status_insufficient" }, canManage: true, createdAt: 1, updatedAt: 2,
        },
      },
    })

    mocks.results.set(Q.item, null)
    expect(renderHook(() => aid.useItem("inconnue")).result.current).toEqual({ status: "ready", data: null })
    mocks.results.set(Q.volunteers, new ConvexError({ code: "notFound" }))
    expect(renderHook(() => aid.useVolunteers({ missionId: "mission-1", cursor: null })).result.current).toEqual({ status: "error", code: "not_found" })
    mocks.results.set(Q.questions, new ConvexError({ code: "invalidArgument", appRule: "aid_country_is_home", appParams: {} }))
    expect(renderHook(() => aid.useQuestions({ country: "FR", status: "open", cursor: null })).result.current).toEqual({ status: "error", code: "aid_country_is_home" })
    mocks.auth = { isAuthenticated: false, isPending: false, isUnauthenticated: true }
    expect(renderHook(() => aid.useMySignups({ cursor: null })).result.current).toEqual({ status: "error", code: "not_signed_in" })
  })

  it("réponses, missions, inscriptions, pages, bénévoles : arguments transmis, fenêtres traduites", () => {
    const { aid } = capability()
    expect(renderHook(() => aid.useAnswers({ questionId: "question-1", cursor: "c1" })).result.current).toMatchObject({ status: "ready", data: { items: [{ id: "answer-1" }], continueCursor: null } })
    expect(calls(Q.answers)).toContainEqual({ networkId: NETWORK, questionId: "question-1", paginationOpts: { cursor: "c1", numItems: 20 } })

    expect(renderHook(() => aid.useMissions({ country: "FR", city: "Lyon", from: 99, cursor: null })).result.current).toMatchObject({ status: "ready", data: { items: [{ id: "mission-1", page: { id: "page-1" } }] } })
    expect(calls(Q.missions)).toContainEqual({ networkId: NETWORK, country: "FR", city: "Lyon", from: 99, paginationOpts: { cursor: null, numItems: 20 } })
    expect(renderHook(() => aid.useMySignups({ cursor: null })).result.current).toMatchObject({ status: "ready", data: { items: [{ signedUp: true }] } })
    expect(renderHook(() => aid.useMissionPages()).result.current).toEqual({ status: "ready", data: [{ id: "page-1", handle: "collectif", name: "Collectif fictif", country: "FR", city: null }] })
    expect(renderHook(() => aid.usePageMissions({ pageId: "page-1", cursor: null })).result.current).toMatchObject({ status: "ready", data: { continueCursor: "page-next", isDone: false } })
    expect(calls(Q.pageMissions)).toContainEqual({ networkId: NETWORK, pageId: "page-1", paginationOpts: { cursor: null, numItems: 20 } })
    expect(renderHook(() => aid.useVolunteers({ missionId: "mission-1", cursor: null })).result.current).toEqual({
      status: "ready", data: { items: [{ id: "signup-1", person: AUTHOR, signedUpAt: 50 }], continueCursor: null, isDone: true },
    })
  })
})

describe("entraide — écritures du moteur", () => {
  it("poser, modifier, répondre, retenir : chaque fonction de la tranche ; une ville vide n'est pas envoyée", async () => {
    const { client, aid } = capability()
    expect(await aid.askQuestion({ title: "Trouver un médecin", detail: "", theme: "health", country: "FR", city: " " })).toEqual({ ok: true, value: { questionId: "question-9" } })
    expect(getFunctionName(client.query.mock.calls[0]![0])).toBe("modules/networks/networks:getBySlug")
    await aid.updateQuestion({ questionId: "q-1", expectedVersion: 2, title: "Trouver un médecin à Lyon", detail: "Détail", theme: "health", city: "Lyon" })
    await aid.closeQuestion({ questionId: "q-1", expectedVersion: 3 })
    await aid.withdrawQuestion({ questionId: "q-1", expectedVersion: 4 })
    expect(await aid.answer({ questionId: "q-1", body: "Une réponse fictive." })).toEqual({ ok: true, value: { answerId: "answer-9" } })
    await aid.updateAnswer({ answerId: "a-1", expectedVersion: 1, body: "Corrigée." })
    await aid.withdrawAnswer({ answerId: "a-1", expectedVersion: 2 })
    await aid.acceptAnswer({ questionId: "q-1", answerId: "a-2", expectedVersion: 5 })
    await aid.unacceptAnswer({ questionId: "q-1", expectedVersion: 6 })
    const networkId = NETWORK
    expect(sent(client)).toEqual([
      ["askQuestion", { networkId, title: "Trouver un médecin", detail: "", theme: "health", country: "FR" }],
      ["updateQuestion", { networkId, questionId: "q-1", expectedVersion: 2, title: "Trouver un médecin à Lyon", detail: "Détail", theme: "health", city: "Lyon" }],
      ["closeQuestion", { networkId, questionId: "q-1", expectedVersion: 3 }],
      ["withdrawQuestion", { networkId, questionId: "q-1", expectedVersion: 4 }],
      ["answerQuestion", { networkId, questionId: "q-1", body: "Une réponse fictive." }],
      ["updateAnswer", { networkId, answerId: "a-1", expectedVersion: 1, body: "Corrigée." }],
      ["withdrawAnswer", { networkId, answerId: "a-1", expectedVersion: 2 }],
      ["acceptAnswer", { networkId, questionId: "q-1", answerId: "a-2", expectedVersion: 5 }],
      ["unacceptAnswer", { networkId, questionId: "q-1", expectedVersion: 6 }],
    ])
  })

  it("missions et inscriptions : lieu approximatif et fin facultatifs omis, motif vide omis, consentement transmis", async () => {
    const { client, aid } = capability()
    const mission = { title: "Accueil à la gare", description: "Orienter les nouveaux arrivants.", country: "FR" as const, city: "Lyon", area: "", startsAt: 100, endsAt: null, timeZone: "Europe/Paris", places: 4 }
    expect(await aid.createMission({ ...mission, pageId: "page-1" })).toEqual({ ok: true, value: { missionId: "mission-9" } })
    await aid.updateMission({ ...mission, area: "Près de la gare", endsAt: 200, missionId: "m-1", expectedVersion: 1 })
    await aid.closeMission({ missionId: "m-1", expectedVersion: 2 })
    await aid.cancelMission({ missionId: "m-1", expectedVersion: 3, reason: "  " })
    await aid.cancelMission({ missionId: "m-1", expectedVersion: 3, reason: "Salle indisponible" })
    await aid.signUp({ missionId: "m-1", shareNameWithTeam: true })
    await aid.withdrawSignup("m-1")
    const networkId = NETWORK
    const fields = { title: mission.title, description: mission.description, country: "FR", city: "Lyon", startsAt: 100, timeZone: "Europe/Paris", places: 4 }
    expect(sent(client)).toEqual([
      ["createMission", { networkId, pageId: "page-1", ...fields }],
      ["updateMission", { networkId, missionId: "m-1", expectedVersion: 1, ...fields, area: "Près de la gare", endsAt: 200 }],
      ["closeMission", { networkId, missionId: "m-1", expectedVersion: 2 }],
      ["cancelMission", { networkId, missionId: "m-1", expectedVersion: 3 }],
      ["cancelMission", { networkId, missionId: "m-1", expectedVersion: 3, reason: "Salle indisponible" }],
      ["signUpForMission", { networkId, missionId: "m-1", shareNameWithTeam: true }],
      ["withdrawFromMission", { networkId, missionId: "m-1" }],
    ])
  })

  it("un refus rend un code fermé, jamais une exception jusqu'à l'écran", async () => {
    const client = convex()
    client.mutation
      .mockRejectedValueOnce(new ConvexError({ code: "conflict", appRule: "aid_mission_full", appParams: {} }))
      .mockRejectedValueOnce(new ConvexError({ code: "policyRefused", appRule: "aid_not_author", appParams: {} }))
      .mockRejectedValueOnce(new ConvexError({ code: "statusInsufficient" }))
      .mockRejectedValueOnce(new ConvexError({ code: "notFound" }))
      .mockRejectedValueOnce(new Error("trace privée"))
    const { aid } = capability(client)
    expect(await aid.signUp({ missionId: "m-1", shareNameWithTeam: true })).toEqual({ ok: false, code: "aid_mission_full" })
    expect(await aid.acceptAnswer({ questionId: "q-1", answerId: "a-1", expectedVersion: 1 })).toEqual({ ok: false, code: "aid_not_author" })
    expect(await aid.askQuestion({ title: "Une question", detail: "", theme: "transport", country: "FR", city: "" })).toEqual({ ok: false, code: "status_insufficient" })
    expect(await aid.withdrawSignup("m-1")).toEqual({ ok: false, code: "not_found" })
    expect(await aid.answer({ questionId: "q-1", body: "Texte" })).toEqual({ ok: false, code: "unknown" })
    client.query.mockResolvedValueOnce(null)
    expect(await aid.closeQuestion({ questionId: "q-1", expectedVersion: 1 })).toEqual({ ok: false, code: "network_unavailable" })
  })
})
