// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import { APPEAL_REASON_MAX, type ModerationDecisionView } from "@diasporale/features/data"
import { act, cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEngineDataRights, DATA_EXPORT_FORMAT, dataRightsErrorCode, toDecisionView, toErasureView } from "./engine-data-rights"

/**
 * L'adaptateur des droits personnels sans moteur : lectures réactives jouées par
 * un `useQueries` factice, écritures contre un client Convex factice. Aucune
 * donnée réelle (adresses en @exemple.test).
 */
type Reference = Parameters<typeof getFunctionName>[0]

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isPending: false, isUnauthenticated: false },
  respond: (() => undefined) as (name: string, args: unknown) => unknown,
  read: vi.fn(),
}))
vi.mock("@antsia/api/hooks", () => ({ useStableConvexAuth: () => mocks.auth }))
vi.mock("convex/react", () => ({
  useQueries: (queries: Record<string, { query: Reference; args?: unknown }>) => {
    if (!queries.value) return {}
    const name = getFunctionName(queries.value.query)
    mocks.read(name, queries.value.args)
    return { value: mocks.respond(name, queries.value.args) }
  },
}))

const PERSON = { _id: "person-awa", handle: "awa.recette", displayName: "Awa" }
const DIASPORALE = { _id: "network-diasporale" }
const ROOT = { _id: "network-antsia" }
const DAY = 24 * 60 * 60 * 1000

function engineError(data: Record<string, unknown>) {
  return new ConvexError(data as never)
}

type Handler = (args: Record<string, unknown>) => unknown

function setup(handlers: Record<string, Handler> = {}) {
  const calls: { kind: "query" | "mutation"; name: string; args: Record<string, unknown> }[] = []
  const call = (kind: "query" | "mutation") => vi.fn(async (reference: Reference, args: Record<string, unknown>) => {
    const name = getFunctionName(reference)
    calls.push({ kind, name, args })
    const handler = handlers[name] ?? (name === "modules/people/persons:getMyPerson" ? () => PERSON : undefined)
    if (!handler) throw new Error(`Unexpected ${kind}: ${name}`)
    return handler(args)
  })
  const convex = { query: call("query"), mutation: call("mutation") } as unknown as ConvexReactClient
  const rights = createEngineDataRights({ convex, authClient: {} as EngineAuthClient })
  return { rights, calls, writes: () => calls.filter((entry) => entry.kind === "mutation") }
}

/** Lectures du moteur par défaut : la personne de la session, les deux réseaux, rien d'autre. */
function respondWith(overrides: Record<string, unknown> = {}) {
  mocks.respond = (name, args) => {
    if (name in overrides) return overrides[name]
    if (name === "modules/people/persons:getMyPerson") return PERSON
    if (name === "modules/networks/networks:getBySlug") return (args as { slug: string }).slug === "diasporale" ? DIASPORALE : ROOT
    throw new Error(`Unexpected read: ${name}`)
  }
}

const readNames = () => [...new Set(mocks.read.mock.calls.map(([name]) => name as string))].sort()

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
  respondWith()
})
afterEach(cleanup)

describe("Droits personnels — état de l'effacement", () => {
  it("lit aucune demande, la grâce puis l'effacement engagé, sans aucune lecture d'adhésion", () => {
    respondWith({ "modules/people/erasure:myErasure": null })
    const { rights } = setup()
    const { result, rerender } = renderHook(() => rights.useErasure(PERSON._id))
    expect(result.current).toEqual({ status: "ready", data: { state: "none" } })
    respondWith({ "modules/people/erasure:myErasure": { requestedAt: 1_000, dueAt: 1_000 + 30 * DAY, canCancel: true } })
    rerender()
    expect(result.current).toEqual({ status: "ready", data: { state: "grace", requestedAt: 1_000, dueAt: 1_000 + 30 * DAY } })
    respondWith({ "modules/people/erasure:myErasure": { requestedAt: 1_000, dueAt: 1_000 + 30 * DAY, canCancel: false } })
    rerender()
    expect(result.current).toEqual({ status: "ready", data: { state: "processing", requestedAt: 1_000, dueAt: 1_000 + 30 * DAY } })
    // Un membre suspendu exerce ses droits : la porte ne regarde que la session.
    expect(readNames()).toEqual(["modules/people/erasure:myErasure", "modules/people/persons:getMyPerson"])
    expect(mocks.read).toHaveBeenCalledWith("modules/people/erasure:myErasure", {})
  })

  it.each(["pending", "anonymous"] as const)("ne lit rien pour une session %s", (kind) => {
    mocks.auth = { isAuthenticated: false, isPending: kind === "pending", isUnauthenticated: kind === "anonymous" }
    const { rights } = setup()
    const { result } = renderHook(() => rights.useErasure(PERSON._id))
    expect(result.current).toEqual(kind === "pending" ? { status: "loading" } : { status: "error", code: "not_signed_in" })
    expect(mocks.read).not.toHaveBeenCalled()
  })

  it("ferme l'état d'une autre personne et traduit un refus du serveur sans son détail", () => {
    respondWith({ "modules/people/erasure:myErasure": null })
    const { rights } = setup()
    const { result, rerender } = renderHook(() => rights.useErasure("ancienne-personne"))
    expect(result.current).toEqual({ status: "error", code: "not_found" })
    respondWith({ "modules/people/erasure:myErasure": engineError({ code: "unauthenticated", detail: "PRIVATE_DETAIL" }) })
    rerender()
    expect(result.current).toEqual({ status: "error", code: "not_signed_in" })
  })

  it("projette l'état minimal du moteur", () => {
    expect(toErasureView(null)).toEqual({ state: "none" })
    expect(toErasureView({ requestedAt: 1, dueAt: 2, canCancel: true })).toEqual({ state: "grace", requestedAt: 1, dueAt: 2 })
    expect(toErasureView({ requestedAt: 1, dueAt: 2, canCancel: false })).toEqual({ state: "processing", requestedAt: 1, dueAt: 2 })
  })
})

describe("Droits personnels — demande et annulation de l'effacement", () => {
  it("relit la personne, envoie la confirmation littérale du moteur et rend son échéance", async () => {
    const { rights, calls } = setup({ "modules/people/erasure:requestErasure": () => ({ dueAt: 42 }) })
    expect(await rights.requestErasure(PERSON._id)).toEqual({ ok: true, value: { dueAt: 42 } })
    expect(calls.map(({ kind, name, args }) => [kind, name, args])).toEqual([
      ["query", "modules/people/persons:getMyPerson", {}],
      ["mutation", "modules/people/erasure:requestErasure", { confirmation: "DELETE_MY_ANTSIA_ACCOUNT" }],
    ])
  })

  it("n'écrit rien pour une autre personne de session ni sans session", async () => {
    const other = setup({ "modules/people/persons:getMyPerson": () => ({ ...PERSON, _id: "autre-personne" }) })
    expect(await other.rights.requestErasure(PERSON._id)).toEqual({ ok: false, code: "not_found" })
    expect(await other.rights.cancelErasure(PERSON._id)).toEqual({ ok: false, code: "not_found" })
    expect(other.writes()).toEqual([])
    const anonymous = setup({ "modules/people/persons:getMyPerson": () => null })
    expect(await anonymous.rights.requestErasure(PERSON._id)).toEqual({ ok: false, code: "not_signed_in" })
    expect(anonymous.writes()).toEqual([])
  })

  it("annule pendant la grâce, et dit l'annulation impossible une fois la grâce passée", async () => {
    const open = setup({ "modules/people/erasure:cancelErasure": () => null })
    expect(await open.rights.cancelErasure(PERSON._id)).toEqual({ ok: true, value: null })
    expect(open.writes().map(({ name, args }) => [name, args])).toEqual([["modules/people/erasure:cancelErasure", {}]])
    const late = setup({ "modules/people/erasure:cancelErasure": () => { throw engineError({ code: "invalidArgument", field: "erasurePhase" }) } })
    expect(await late.rights.cancelErasure(PERSON._id)).toEqual({ ok: false, code: "erasure_not_cancellable" })
  })

  it("traduit le débit du moteur sans phrase du serveur", async () => {
    const { rights } = setup({ "modules/people/erasure:requestErasure": () => { throw engineError({ code: "rateLimited", retryAfterMs: 60_000 }) } })
    expect(await rights.requestErasure(PERSON._id)).toEqual({ ok: false, code: "rate_limited" })
  })
})

/** Une préparation de trois tables : deux pages pour la première, une table vide, une dernière table. */
function exportHandlers(overrides: Record<string, Handler> = {}): Record<string, Handler> {
  const pages: Record<string, unknown> = {
    "0:": { table: "consents", json: JSON.stringify([{ _id: "consent-1", purpose: "social_profile" }]), nextTableIndex: 0, cursor: "curseur-1", done: false },
    "0:curseur-1": { table: "consents", json: JSON.stringify([{ _id: "consent-2", purpose: "directory" }]), nextTableIndex: 1, cursor: null, done: false },
    "1:": { table: "dataExports", json: "[]", nextTableIndex: 2, cursor: null, done: false },
    "2:": { table: "posts", json: JSON.stringify([{ _id: "post-1", body: "Bonjour" }]), nextTableIndex: 3, cursor: null, done: true },
  }
  return {
    "modules/people/erasure:exportMyData": () => ({
      exportId: "export-1",
      expiresAt: 99,
      tableCount: 3,
      accountJson: JSON.stringify({ account: { email: "awa@exemple.test" }, identityProofs: [{ loa: 2 }] }),
    }),
    "modules/people/erasure:exportMyDataPage": (args) => {
      const page = pages[`${String(args.tableIndex)}:${(args.cursor as string | null) ?? ""}`]
      if (!page) throw new Error("page inattendue")
      return page
    },
    ...overrides,
  }
}

describe("Droits personnels — export page à page", () => {
  it("prépare l'export puis assemble chaque table, curseur après curseur, sans rien ajouter", async () => {
    const { rights, calls } = setup(exportHandlers())
    const progress: string[] = []
    const result = await rights.prepareExport(PERSON._id, { onProgress: ({ done, total }) => progress.push(`${done}/${total}`) })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const document = JSON.parse(result.value.json) as Record<string, unknown>
    expect(document).toEqual({
      format: DATA_EXPORT_FORMAT,
      exportedAt: new Date(result.value.exportedAt).toISOString(),
      account: { email: "awa@exemple.test" },
      identityProofs: [{ loa: 2 }],
      tables: {
        consents: [{ _id: "consent-1", purpose: "social_profile" }, { _id: "consent-2", purpose: "directory" }],
        posts: [{ _id: "post-1", body: "Bonjour" }],
      },
    })
    expect(progress).toEqual(["0/3", "0/3", "1/3", "2/3", "3/3"])
    expect(calls.map(({ name, args }) => [name, args])).toEqual([
      ["modules/people/persons:getMyPerson", {}],
      ["modules/people/erasure:exportMyData", {}],
      ["modules/people/erasure:exportMyDataPage", { exportId: "export-1", tableIndex: 0, cursor: null }],
      ["modules/people/erasure:exportMyDataPage", { exportId: "export-1", tableIndex: 0, cursor: "curseur-1" }],
      ["modules/people/erasure:exportMyDataPage", { exportId: "export-1", tableIndex: 1, cursor: null }],
      ["modules/people/erasure:exportMyDataPage", { exportId: "export-1", tableIndex: 2, cursor: null }],
    ])
  })

  it("retient le dernier export de la personne dans l'onglet, jamais son contenu", async () => {
    const { rights } = setup(exportHandlers())
    const { result } = renderHook(() => ({ mine: rights.useLastExport(PERSON._id), other: rights.useLastExport("autre-personne") }))
    expect(result.current).toEqual({ mine: null, other: null })
    let exportedAt = 0
    await act(async () => {
      const prepared = await rights.prepareExport(PERSON._id)
      if (prepared.ok) exportedAt = prepared.value.exportedAt
    })
    expect(result.current).toEqual({ mine: { exportedAt }, other: null })
  })

  it("une préparation échue en cours d'assemblage ne rend aucun fichier partiel", async () => {
    let pages = 0
    const { rights } = setup(exportHandlers({
      "modules/people/erasure:exportMyDataPage": () => {
        pages += 1
        if (pages === 2) throw engineError({ code: "notFound" })
        return { table: "consents", json: "[]", nextTableIndex: 0, cursor: `curseur-${pages}`, done: false }
      },
    }))
    expect(await rights.prepareExport(PERSON._id)).toEqual({ ok: false, code: "export_expired" })
    const { result } = renderHook(() => rights.useLastExport(PERSON._id))
    expect(result.current).toBeNull()
  })

  it("s'arrête au geste de la personne : plus aucune page n'est lue", async () => {
    const { rights, calls } = setup(exportHandlers())
    const controller = new AbortController()
    const result = await rights.prepareExport(PERSON._id, {
      signal: controller.signal,
      onProgress: ({ done }) => { if (done === 0 && calls.length > 2) controller.abort() },
    })
    expect(result).toEqual({ ok: false, code: "export_cancelled" })
    expect(calls.filter(({ name }) => name === "modules/people/erasure:exportMyDataPage")).toHaveLength(1)
  })

  it("une interruption avant la préparation n'écrit rien", async () => {
    const { rights, calls } = setup(exportHandlers())
    const controller = new AbortController()
    controller.abort()
    expect(await rights.prepareExport(PERSON._id, { signal: controller.signal })).toEqual({ ok: false, code: "export_cancelled" })
    expect(calls).toEqual([])
  })

  it("refuse une pagination qui n'avance plus, ou une page illisible", async () => {
    const stuck = setup(exportHandlers({
      "modules/people/erasure:exportMyDataPage": () => ({ table: "consents", json: "[]", nextTableIndex: 0, cursor: "toujours-le-meme", done: false }),
    }))
    expect(await stuck.rights.prepareExport(PERSON._id)).toEqual({ ok: false, code: "export_interrupted" })
    expect(stuck.calls.filter(({ name }) => name === "modules/people/erasure:exportMyDataPage")).toHaveLength(2)
    const broken = setup(exportHandlers({
      "modules/people/erasure:exportMyDataPage": () => ({ table: "consents", json: "{pas du json", nextTableIndex: 1, cursor: null, done: false }),
    }))
    expect(await broken.rights.prepareExport(PERSON._id)).toEqual({ ok: false, code: "export_interrupted" })
    const failing = setup(exportHandlers({
      "modules/people/erasure:exportMyDataPage": () => { throw new Error("PRIVATE_SERVER_DETAIL") },
    }))
    expect(await failing.rights.prepareExport(PERSON._id)).toEqual({ ok: false, code: "export_interrupted" })
  })

  it("dit l'export indisponible quand l'inventaire du moteur est incomplet, et une session fermée", async () => {
    const inventory = setup(exportHandlers({
      "modules/people/erasure:exportMyData": () => { throw engineError({ code: "invalidArgument", field: "dataInventory" }) },
    }))
    expect(await inventory.rights.prepareExport(PERSON._id)).toEqual({ ok: false, code: "export_unavailable" })
    const revoked = setup(exportHandlers({
      "modules/people/erasure:exportMyDataPage": () => { throw engineError({ code: "unauthenticated" }) },
    }))
    expect(await revoked.rights.prepareExport(PERSON._id)).toEqual({ ok: false, code: "not_signed_in" })
    const other = setup({ ...exportHandlers(), "modules/people/persons:getMyPerson": () => ({ ...PERSON, _id: "autre-personne" }) })
    expect(await other.rights.prepareExport(PERSON._id)).toEqual({ ok: false, code: "not_found" })
    expect(other.writes()).toEqual([])
  })
})

const DECISION_ROW = {
  reportId: "report-1",
  networkId: DIASPORALE._id,
  target: { kind: "post", id: "post-secret" },
  teamId: "team-france",
  level: "team",
  reason: "harassment",
  status: "actioned",
  createdAt: 10,
  decisionReason: "Propos insultants répétés.",
  sanctions: [{ sanctionId: "sanction-1", kind: "suspension", status: "active", until: 20, reason: "Propos insultants répétés." }],
  appeals: [],
} as const

describe("Droits personnels — décisions et recours", () => {
  it("projette mes décisions sans cible, équipe ni réseau en clair, et calcule le niveau du recours", () => {
    respondWith({ "modules/moderation/cases:myDecisions": { page: [DECISION_ROW], isDone: false, continueCursor: "suite" } })
    const { rights } = setup()
    const { result } = renderHook(() => rights.useDecisions({ personId: PERSON._id, cursor: null }))
    expect(result.current).toEqual({
      status: "ready",
      data: {
        items: [{
          reportId: "report-1",
          network: "diasporale",
          surface: "post",
          ground: "harassment",
          status: "actioned",
          level: "team",
          createdAt: 10,
          decisionReason: "Propos insultants répétés.",
          sanctions: [{ kind: "suspension", status: "active", until: 20, reason: "Propos insultants répétés." }],
          appeals: [],
          appealLevel: "network",
        }],
        continueCursor: "suite",
        isDone: false,
      },
    })
    expect(JSON.stringify(result.current)).not.toMatch(/post-secret|team-france|network-diasporale/)
    expect(mocks.read).toHaveBeenCalledWith("modules/moderation/cases:myDecisions", { paginationOpts: { cursor: null, numItems: 10 } })
    expect(readNames()).not.toContain("modules/diaspora/membership:myMembership")
  })

  it("passe le curseur de page et dit la fin de liste", () => {
    respondWith({ "modules/moderation/cases:myDecisions": { page: [], isDone: true, continueCursor: "fin" } })
    const { rights } = setup()
    const { result } = renderHook(() => rights.useDecisions({ personId: PERSON._id, cursor: "suite" }))
    expect(result.current).toEqual({ status: "ready", data: { items: [], continueCursor: null, isDone: true } })
    expect(mocks.read).toHaveBeenCalledWith("modules/moderation/cases:myDecisions", { paginationOpts: { cursor: "suite", numItems: 10 } })
  })

  it("ferme les décisions d'une autre personne et sans session", () => {
    respondWith({ "modules/moderation/cases:myDecisions": { page: [DECISION_ROW], isDone: true, continueCursor: "" } })
    const { rights } = setup()
    expect(renderHook(() => rights.useDecisions({ personId: "ancienne-personne", cursor: null })).result.current).toEqual({ status: "error", code: "not_found" })
    mocks.auth = { isAuthenticated: false, isPending: false, isUnauthenticated: true }
    expect(renderHook(() => rights.useDecisions({ personId: PERSON._id, cursor: null })).result.current).toEqual({ status: "error", code: "not_signed_in" })
  })

  it("nomme la racine, un autre réseau, un motif inconnu, et suit la règle des niveaux de recours", () => {
    const networks = { diasporale: DIASPORALE._id, root: ROOT._id }
    const base = { ...DECISION_ROW, sanctions: [], appeals: [] } as unknown as Parameters<typeof toDecisionView>[0]
    const view = (row: Record<string, unknown>): ModerationDecisionView => toDecisionView({ ...base, ...row } as unknown as Parameters<typeof toDecisionView>[0], networks)
    expect(view({ networkId: ROOT._id }).network).toBe("antsia")
    expect(view({ networkId: "network-ailleurs" }).network).toBe("other")
    expect(toDecisionView(base, { diasporale: null, root: null }).network).toBe("other")
    expect(view({ reason: "pre_review" }).ground).toBe("pre_review")
    expect(view({ reason: "motif_inconnu" }).ground).toBe("unspecified")
    expect(view({ status: "dismissed" }).appealLevel).toBeNull()
    expect(view({ appeals: [{ appealId: "a", level: "network", status: "open", decisionReason: null }] }).appealLevel).toBeNull()
    expect(view({ appeals: [{ appealId: "a", level: "network", status: "upheld", decisionReason: "Maintenue." }] }).appealLevel).toBe("platform")
    expect(view({ level: "network" }).appealLevel).toBe("platform")
    expect(view({ level: "network", appeals: [{ appealId: "b", level: "platform", status: "open", decisionReason: null }] }).appealLevel).toBeNull()
  })

  it("borne le motif avant tout appel, le rogne, et rend un recours déjà posé", async () => {
    const { rights, calls } = setup({ "modules/moderation/cases:fileAppeal": () => ({ appealId: "appeal-1", created: false }) })
    expect(await rights.fileAppeal({ personId: PERSON._id, reportId: "report-1", reason: "  a " })).toEqual({ ok: false, code: "appeal_reason_length" })
    expect(await rights.fileAppeal({ personId: PERSON._id, reportId: "report-1", reason: "x".repeat(APPEAL_REASON_MAX + 1) })).toEqual({ ok: false, code: "appeal_reason_length" })
    expect(calls).toEqual([])
    expect(await rights.fileAppeal({ personId: PERSON._id, reportId: "report-1", reason: "  Le contexte a été mal lu.  " })).toEqual({ ok: true, value: { created: false } })
    expect(calls.map(({ name, args }) => [name, args])).toEqual([
      ["modules/people/persons:getMyPerson", {}],
      ["modules/moderation/cases:fileAppeal", { reportId: "report-1", reason: "Le contexte a été mal lu." }],
    ])
  })

  it("traduit les refus du recours : décision introuvable, règle du moteur", async () => {
    const missing = setup({ "modules/moderation/cases:fileAppeal": () => { throw engineError({ code: "notFound" }) } })
    expect(await missing.rights.fileAppeal({ personId: PERSON._id, reportId: "report-1", reason: "Contestation." })).toEqual({ ok: false, code: "not_found" })
    const rule = setup({ "modules/moderation/cases:fileAppeal": () => { throw engineError({ code: "invalidArgument", rule: "DECISION_REASON_LENGTH", params: { min: 3, max: 500 } }) } })
    expect(await rule.rights.fileAppeal({ personId: PERSON._id, reportId: "report-1", reason: "Contestation." })).toEqual({ ok: false, code: "appeal_reason_length" })
  })
})

describe("Droits personnels — écritures historiques du port principal", () => {
  it("exportMyData rend le document complet ; deleteMyAccount DEMANDE l'effacement avec sa grâce", async () => {
    const { rights, writes } = setup({ ...exportHandlers(), "modules/people/erasure:requestErasure": () => ({ dueAt: 42 }) })
    const exported = await rights.exportMyData()
    expect(exported.ok && (JSON.parse(exported.value) as { format: string }).format).toBe(DATA_EXPORT_FORMAT)
    expect(await rights.deleteMyAccount()).toEqual({ ok: true, value: null })
    expect(writes().map(({ name }) => name)).toEqual(["modules/people/erasure:exportMyData", "modules/people/erasure:requestErasure"])
  })

  it("sans session, aucune écriture", async () => {
    const { rights, writes } = setup({ "modules/people/persons:getMyPerson": () => null })
    expect(await rights.exportMyData()).toEqual({ ok: false, code: "not_signed_in" })
    expect(await rights.deleteMyAccount()).toEqual({ ok: false, code: "not_signed_in" })
    expect(writes()).toEqual([])
  })
})

describe("Droits personnels — table des refus", () => {
  it("les champs et règles propres aux droits, puis la table commune du moteur", () => {
    expect(dataRightsErrorCode(engineError({ code: "invalidArgument", field: "erasurePhase" }))).toBe("erasure_not_cancellable")
    expect(dataRightsErrorCode(engineError({ code: "invalidArgument", field: "dataInventory" }))).toBe("export_unavailable")
    expect(dataRightsErrorCode(engineError({ code: "invalidArgument", rule: "DECISION_REASON_LENGTH" }))).toBe("appeal_reason_length")
    expect(dataRightsErrorCode(engineError({ code: "invalidArgument", field: "autre" }))).toBe("unknown")
    expect(dataRightsErrorCode(engineError({ code: "membershipSuspended" }))).toBe("suspended")
    expect(dataRightsErrorCode(new Error("PRIVATE_SERVER_DETAIL"))).toBe("unknown")
  })
})
