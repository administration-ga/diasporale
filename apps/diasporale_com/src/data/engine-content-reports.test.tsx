// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import { CONTENT_REPORT_KINDS, type ContentReportInput, type ContentReportTarget } from "@diasporale/features/data"
import { act, cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEngineContentReports } from "./engine-content-reports"

/**
 * Les signalements de la vague H — fournisseur moteur (G9) : la porte unique
 * `moderation/cases` reçoit exactement le réseau, la cible typée et le motif ; la
 * garde commune juge avant tout appel ; les refus deviennent des codes fermés ; le
 * masque de l'onglet ne vaut que pour la personne qui a signalé. Données fictives.
 */
const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isPending: false, isUnauthenticated: false },
  person: { _id: "person-awa" } as unknown,
  loaded: vi.fn(),
}))
vi.mock("@antsia/api/hooks", () => ({ useStableConvexAuth: () => mocks.auth }))
vi.mock("convex/react", () => ({
  useQueries: (queries: Record<string, { query: Parameters<typeof getFunctionName>[0]; args?: unknown }>) => {
    if (!queries.value) return {}
    const name = getFunctionName(queries.value.query)
    mocks.loaded(name, queries.value.args)
    return name === "modules/people/persons:getMyPerson" ? { value: mocks.person } : {}
  },
}))

const MY_PERSON = "modules/people/persons:getMyPerson"
const NETWORK = { _id: "network-diasporale" }
const QUESTION: ContentReportTarget = { kind: "diasporaAidQuestion", id: "question-1" }
const ANSWER: ContentReportTarget = { kind: "diasporaAidAnswer", id: "answer-1" }

function client() {
  const query = vi.fn(async (reference: unknown, _args: unknown): Promise<unknown> => (getFunctionName(reference as never) === MY_PERSON ? mocks.person : NETWORK))
  const mutation = vi.fn(async (_reference: unknown, _args: unknown): Promise<unknown> => ({ reportId: "report-1", created: true, hidden: true }))
  return { query, mutation, convex: { query, mutation } as unknown as ConvexReactClient }
}
function capability(convex: ConvexReactClient = client().convex) {
  return createEngineContentReports({ convex, authClient: {} as EngineAuthClient })
}
/** Une saisie hors contrat, telle qu'un appel mal formé la ferait arriver. */
function hostile(input: { readonly kind: string; readonly id: string; readonly reason: string }): ContentReportInput {
  return input as unknown as ContentReportInput
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
  mocks.person = { _id: "person-awa" }
})
afterEach(cleanup)

describe("signalements — fournisseur moteur", () => {
  it("transmet exactement le réseau DIASPORALE, la cible typée et le motif, pour chacune des neuf natures", async () => {
    const { convex, mutation } = client()
    const data = capability(convex)
    expect(data.demonstration).toBe(false)
    for (const kind of CONTENT_REPORT_KINDS) {
      expect(await data.report({ kind, id: `${kind}-1`, reason: "misinformation" })).toEqual({ ok: true, value: { created: true } })
    }
    expect(mutation.mock.calls.map(([reference, args]) => [getFunctionName(reference as never), args])).toEqual(
      CONTENT_REPORT_KINDS.map((kind) => ["modules/moderation/cases:report", { networkId: "network-diasporale", target: { kind, id: `${kind}-1` }, reason: "misinformation" }]),
    )
  })

  it("un rejeu rend « déjà signalé » (created: false), tel que le moteur le dit", async () => {
    const { convex, mutation } = client()
    mutation.mockResolvedValueOnce({ reportId: "report-1", created: false, hidden: true })
    expect(await capability(convex).report({ ...QUESTION, reason: "other" })).toEqual({ ok: true, value: { created: false } })
  })

  it("juge la nature, l'identifiant et le motif avant tout appel au moteur", async () => {
    const { convex, query, mutation } = client()
    const data = capability(convex)
    expect(await data.report(hostile({ kind: "post", id: "post-1", reason: "other" }))).toEqual({ ok: false, code: "content_report_target_invalid" })
    expect(await data.report(hostile({ kind: "diasporaJobOffer", id: "", reason: "other" }))).toEqual({ ok: false, code: "content_report_target_invalid" })
    expect(await data.report(hostile({ kind: "diasporaJobOffer", id: "job-1", reason: "spam" }))).toEqual({ ok: false, code: "report_reason_required" })
    expect(query).not.toHaveBeenCalled()
    expect(mutation).not.toHaveBeenCalled()
  })

  it("traduit les refus du moteur en codes fermés, sans jamais montrer une phrase du serveur", async () => {
    const { convex, query, mutation } = client()
    const data = capability(convex)
    const input: ContentReportInput = { ...QUESTION, reason: "hate" }
    mutation.mockRejectedValueOnce(new ConvexError({ code: "notFound" }))
    expect(await data.report(input)).toEqual({ ok: false, code: "not_found" })
    mutation.mockRejectedValueOnce(new ConvexError({ code: "rateLimited", retryAfterMs: 1000 }))
    expect(await data.report(input)).toEqual({ ok: false, code: "rate_limited" })
    mutation.mockRejectedValueOnce(new ConvexError({ code: "membershipSuspended" }))
    expect(await data.report(input)).toEqual({ ok: false, code: "suspended" })
    mutation.mockRejectedValueOnce(new ConvexError({ code: "policyRefused" }))
    expect(await data.report(input)).toEqual({ ok: false, code: "content_report_unavailable" })
    mutation.mockRejectedValueOnce(new ConvexError({ code: "invalidArgument", field: "reason" }))
    expect(await data.report(input)).toEqual({ ok: false, code: "report_reason_required" })
    mutation.mockRejectedValueOnce(new Error("texte privé du serveur"))
    expect(await data.report(input)).toEqual({ ok: false, code: "unknown" })

    // Sans personne de session, ou sans réseau DIASPORALE : rien n'est envoyé.
    mutation.mockClear()
    mocks.person = null
    expect(await data.report(input)).toEqual({ ok: false, code: "not_signed_in" })
    mocks.person = { _id: "person-awa" }
    query.mockImplementation(async (reference: unknown) => (getFunctionName(reference as never) === MY_PERSON ? mocks.person : null))
    expect(await data.report(input)).toEqual({ ok: false, code: "network_unavailable" })
    expect(mutation).not.toHaveBeenCalled()
  })

  it("masque dans cet onglet, pour la seule personne qui a signalé, et jamais après un refus", async () => {
    const { convex, mutation } = client()
    const data = capability(convex)
    const hook = renderHook((target: ContentReportTarget) => data.useReported(target), { initialProps: QUESTION })
    expect(hook.result.current).toBe(false)
    expect(mocks.loaded).toHaveBeenCalledWith(MY_PERSON, {})

    await act(async () => { await data.report({ ...QUESTION, reason: "violence" }) })
    expect(hook.result.current).toBe(true)

    // Une autre cible, une autre personne de session, une session fermée : rien n'est masqué.
    hook.rerender(ANSWER)
    expect(hook.result.current).toBe(false)
    mocks.person = { _id: "person-bob" }
    hook.rerender(QUESTION)
    expect(hook.result.current).toBe(false)
    mocks.person = { _id: "person-awa" }
    mocks.auth = { isAuthenticated: false, isPending: false, isUnauthenticated: true }
    hook.rerender(QUESTION)
    expect(hook.result.current).toBe(false)

    mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
    mutation.mockRejectedValueOnce(new ConvexError({ code: "notFound" }))
    await act(async () => { await data.report({ ...ANSWER, reason: "other" }) })
    hook.rerender(ANSWER)
    expect(hook.result.current).toBe(false)
    hook.rerender(QUESTION)
    expect(hook.result.current).toBe(true)
  })
})
