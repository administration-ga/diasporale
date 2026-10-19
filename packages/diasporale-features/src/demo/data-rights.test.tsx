// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ERASURE_GRACE_MS } from "../data/data-rights-port"
import { createDemoDataRights } from "./data-rights"
import { createDemoSeed, type DemoState } from "./state"
import { DEMO_STORAGE_KEY, DemoStore } from "./store"

/**
 * Droits personnels de démonstration : données fictives, grâce du moteur,
 * effacement du magasin à l'échéance — jamais celui d'une autre personne.
 */
const NOW = Date.UTC(2026, 9, 17, 12)
const DAY = 24 * 60 * 60 * 1000
const PERSON = "p-prisca"
const OTHER = "p-nadia"

function setup(extra: Partial<DemoState> = {}) {
  let now = NOW
  const seed = createDemoSeed(NOW)
  const state: DemoState = { ...seed, session: { personId: PERSON }, ...extra }
  const stored = new Map([[DEMO_STORAGE_KEY, JSON.stringify(state)]])
  const storage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value) },
    removeItem: vi.fn((key: string) => { stored.delete(key) }),
  }
  const store = new DemoStore(storage, () => now, 0)
  const rights = createDemoDataRights(store)
  return { store, rights, advance: (ms: number) => { now += ms } }
}

afterEach(cleanup)

describe("Droits de démonstration — effacement avec grâce", () => {
  it("demande l'effacement avec la grâce du moteur, rejouée à l'identique, puis l'annule sans rien effacer", async () => {
    const { store, rights } = setup()
    const before = store.getState()
    const { result } = renderHook(() => rights.useErasure(PERSON))
    expect(result.current).toEqual({ status: "ready", data: { state: "none" } })
    let first: Awaited<ReturnType<typeof rights.requestErasure>> | undefined
    await act(async () => { first = await rights.requestErasure(PERSON) })
    expect(first).toEqual({ ok: true, value: { dueAt: NOW + ERASURE_GRACE_MS } })
    expect(ERASURE_GRACE_MS).toBe(30 * DAY)
    expect(result.current).toEqual({ status: "ready", data: { state: "grace", requestedAt: NOW, dueAt: NOW + 30 * DAY } })
    expect(await rights.requestErasure(PERSON)).toEqual({ ok: true, value: { dueAt: NOW + 30 * DAY } })
    await act(async () => { expect(await rights.cancelErasure(PERSON)).toEqual({ ok: true, value: null }) })
    expect(result.current).toEqual({ status: "ready", data: { state: "none" } })
    // Annuler sans demande ne fait rien ; le magasin n'a jamais été touché.
    expect(await rights.cancelErasure(PERSON)).toEqual({ ok: true, value: null })
    expect(store.getState()).toBe(before)
  })

  it("à l'échéance : annulation refusée, effacement du magasin, session fermée", async () => {
    const { store, rights, advance } = setup()
    await rights.requestErasure(PERSON)
    advance(30 * DAY)
    expect(await rights.cancelErasure(PERSON)).toEqual({ ok: false, code: "erasure_not_cancellable" })
    renderHook(() => rights.useErasure(PERSON))
    await waitFor(() => expect(store.getState().persons[PERSON]).toBeUndefined())
    expect(store.getState().session.personId).toBeNull()
    expect(store.getState().memberships[PERSON]).toBeUndefined()
    expect(store.getState().persons[OTHER]).toBeDefined()
  })

  it("ne règle jamais l'échéance d'une autre personne que celle de la session, ni ne la lui montre", async () => {
    const { store, rights, advance } = setup()
    await rights.requestErasure(PERSON)
    await store.switchTo(OTHER)
    advance(31 * DAY)
    const theirs = renderHook(() => rights.useErasure(PERSON))
    expect(theirs.result.current).toEqual({ status: "error", code: "not_found" })
    const mine = renderHook(() => rights.useErasure(OTHER))
    expect(mine.result.current).toEqual({ status: "ready", data: { state: "none" } })
    expect(await rights.requestErasure(PERSON)).toEqual({ ok: false, code: "not_found" })
    expect(await rights.cancelErasure(PERSON)).toEqual({ ok: false, code: "not_found" })
    await act(async () => { await Promise.resolve() })
    expect(store.getState().persons[PERSON]).toBeDefined()
    expect(store.getState().session.personId).toBe(OTHER)
  })

  it("une remise à zéro du jeu de démonstration efface la demande en cours", async () => {
    const { store, rights, advance } = setup()
    await rights.requestErasure(PERSON)
    advance(DAY)
    await store.reset()
    await store.switchTo(PERSON)
    const { result } = renderHook(() => rights.useErasure(PERSON))
    expect(result.current).toEqual({ status: "ready", data: { state: "none" } })
  })

  it("sans session, aucun geste", async () => {
    const { rights } = setup({ session: { personId: null } })
    expect(renderHook(() => rights.useErasure(PERSON)).result.current).toEqual({ status: "error", code: "not_signed_in" })
    expect(await rights.requestErasure(PERSON)).toEqual({ ok: false, code: "not_signed_in" })
    expect(await rights.prepareExport(PERSON)).toEqual({ ok: false, code: "not_signed_in" })
  })
})

describe("Droits de démonstration — export", () => {
  it("rend le fichier fictif du magasin, sa progression, et retient le dernier export de la personne", async () => {
    const { rights, store } = setup()
    const last = renderHook(() => rights.useLastExport(PERSON))
    expect(last.result.current).toBeNull()
    const progress: string[] = []
    let exported: Awaited<ReturnType<typeof rights.prepareExport>> | undefined
    await act(async () => { exported = await rights.prepareExport(PERSON, { onProgress: ({ done, total }) => progress.push(`${done}/${total}`) }) })
    expect(exported?.ok).toBe(true)
    if (!exported?.ok) return
    const document = JSON.parse(exported.value.json) as { demonstration: boolean; person: { id: string }; posts: { author: { id: string } }[] }
    expect(document.demonstration).toBe(true)
    expect(document.person.id).toBe(PERSON)
    expect(document.posts.every((post) => post.author.id === PERSON)).toBe(true)
    expect(exported.value.exportedAt).toBe(NOW)
    expect(progress).toEqual(["0/1", "1/1"])
    expect(last.result.current).toEqual({ exportedAt: NOW })
    await act(async () => { await store.switchTo(OTHER) })
    expect(last.result.current).toBeNull()
  })

  it("refuse l'export d'une autre personne et s'arrête au geste de la personne", async () => {
    const { rights } = setup()
    expect(await rights.prepareExport(OTHER)).toEqual({ ok: false, code: "not_found" })
    const controller = new AbortController()
    controller.abort()
    expect(await rights.prepareExport(PERSON, { signal: controller.signal })).toEqual({ ok: false, code: "export_cancelled" })
    expect(renderHook(() => rights.useLastExport(PERSON)).result.current).toBeNull()
  })
})

describe("Droits de démonstration — décisions et recours", () => {
  it("aucune décision n'est prise en démonstration ; un recours est introuvable", async () => {
    const { rights } = setup()
    expect(renderHook(() => rights.useDecisions({ personId: PERSON, cursor: null })).result.current).toEqual({
      status: "ready",
      data: { items: [], continueCursor: null, isDone: true },
    })
    expect(renderHook(() => rights.useDecisions({ personId: OTHER, cursor: null })).result.current).toEqual({ status: "error", code: "not_found" })
    expect(await rights.fileAppeal({ personId: PERSON, reportId: "report-fictif", reason: "Contestation fictive." })).toEqual({ ok: false, code: "not_found" })
  })
})
