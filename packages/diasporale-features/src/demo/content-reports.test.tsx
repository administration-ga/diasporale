// @vitest-environment jsdom
import { CONTENT_REPORT_REASONS } from "@antsia/social-domain/moderation"
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  CONTENT_REPORT_KINDS,
  CONTENT_REPORT_TARGET_ID_MAX,
  contentReportRefusal,
  type ContentReportInput,
  type ContentReportTarget,
} from "../data/content-reports-port"
import { REPORT_REASONS } from "../data/types"
import { createDemoContentReports, DEMO_CONTENT_REPORTS_MAX, DEMO_CONTENT_REPORTS_STORAGE_KEY, type DemoContentReportsState } from "./content-reports"
import { createDemoSeed, type DemoState } from "./state"
import { DemoStore } from "./store"

/**
 * Les signalements de DÉMONSTRATION (G9) : la cible se masque pour la seule personne
 * qui signale, dans ce navigateur ; rien n'est transmis ; un rejeu ne crée rien ; la
 * remise à zéro de la démonstration les oublie. Données fictives.
 */
const NOW = Date.UTC(2026, 9, 18, 10)
let clock = NOW

const QUESTION: ContentReportTarget = { kind: "diasporaAidQuestion", id: "aid-q-2" }
const ANSWER: ContentReportTarget = { kind: "diasporaAidAnswer", id: "aid-a-9" }

class MemoryStorage {
  readonly items = new Map<string, string>()
  getItem(key: string) { return this.items.get(key) ?? null }
  setItem(key: string, value: string) { this.items.set(key, value) }
  removeItem(key: string) { this.items.delete(key) }
}

function setup(options: { readonly state?: Partial<DemoState>; readonly storage?: MemoryStorage } = {}) {
  const seed: DemoState = { ...createDemoSeed(NOW), session: { personId: "p-prisca" }, ...options.state }
  const mainStorage = new MemoryStorage()
  mainStorage.getItem = () => JSON.stringify(seed)
  const store = new DemoStore(mainStorage, () => clock, 0)
  const storage = options.storage ?? new MemoryStorage()
  const reports = createDemoContentReports(store, { storage })
  return { store, storage, reports }
}

function stored(storage: MemoryStorage): DemoContentReportsState | null {
  return JSON.parse(storage.getItem(DEMO_CONTENT_REPORTS_STORAGE_KEY) ?? "null") as DemoContentReportsState | null
}

/** Une saisie hors contrat, telle qu'un appel mal formé la ferait arriver. */
function hostile(input: { readonly kind: string; readonly id: string; readonly reason: string }): ContentReportInput {
  return input as unknown as ContentReportInput
}

afterEach(() => {
  cleanup()
  clock = NOW
})

describe("signalements — démonstration", () => {
  it("masque la cible pour la seule personne qui signale, dans ce navigateur", async () => {
    const { store, storage, reports } = setup()
    expect(reports.demonstration).toBe(true)
    const hook = renderHook((target: ContentReportTarget) => reports.useReported(target), { initialProps: QUESTION })
    expect(hook.result.current).toBe(false)

    let result: Awaited<ReturnType<typeof reports.report>> | undefined
    await act(async () => { result = await reports.report({ ...QUESTION, reason: "harassment" }) })
    expect(result).toEqual({ ok: true, value: { created: true } })
    expect(hook.result.current).toBe(true)

    // Une autre cible n'est pas touchée ; une autre personne de la session ne voit rien de masqué.
    hook.rerender(ANSWER)
    expect(hook.result.current).toBe(false)
    hook.rerender(QUESTION)
    await act(async () => { await store.switchTo("p-mireille") })
    expect(hook.result.current).toBe(false)
    await act(async () => { await store.switchTo("p-prisca") })
    expect(hook.result.current).toBe(true)

    expect(stored(storage)?.reports).toEqual([{ reporterId: "p-prisca", kind: "diasporaAidQuestion", targetId: "aid-q-2", reason: "harassment", createdAt: NOW }])
  })

  it("rejoué, rend « déjà signalé » sans rien recréer ni changer le motif", async () => {
    const { storage, reports } = setup()
    expect(await reports.report({ ...ANSWER, reason: "hate" })).toEqual({ ok: true, value: { created: true } })
    expect(await reports.report({ ...ANSWER, reason: "violence" })).toEqual({ ok: true, value: { created: false } })
    expect(stored(storage)?.reports).toHaveLength(1)
    expect(stored(storage)?.reports[0]?.reason).toBe("hate")
  })

  it("garde les signalements d'un rechargement à l'autre, et les oublie avec la démonstration remise à zéro", async () => {
    const storage = new MemoryStorage()
    await setup({ storage }).reports.report({ ...ANSWER, reason: "other" })

    const reloaded = setup({ storage })
    const hook = renderHook(() => reloaded.reports.useReported(ANSWER))
    expect(hook.result.current).toBe(true)

    clock = NOW + 60_000
    await act(async () => { await reloaded.store.reset() })
    await act(async () => { await reloaded.store.switchTo("p-prisca") })
    expect(hook.result.current).toBe(false)
    expect(storage.getItem(DEMO_CONTENT_REPORTS_STORAGE_KEY)).toBeNull()
  })

  it("refuse hors session, hors adhésion ou suspendue, sans rien garder", async () => {
    const seed = createDemoSeed(NOW)
    const prisca = seed.memberships["p-prisca"]
    if (!prisca) throw new Error("adhésion de démonstration absente")

    const anonymous = setup({ state: { session: { personId: null } } })
    expect(await anonymous.reports.report({ ...QUESTION, reason: "other" })).toEqual({ ok: false, code: "not_signed_in" })

    const outside = setup({ state: { memberships: Object.fromEntries(Object.entries(seed.memberships).filter(([personId]) => personId !== "p-prisca")) } })
    expect(await outside.reports.report({ ...QUESTION, reason: "other" })).toEqual({ ok: false, code: "not_member" })

    const suspended = setup({
      state: { memberships: { ...seed.memberships, "p-prisca": { ...prisca, grounds: { ...prisca.grounds, suspension: { until: null, readAccess: "none" } } } } },
    })
    expect(await suspended.reports.report({ ...QUESTION, reason: "other" })).toEqual({ ok: false, code: "suspended" })

    for (const context of [anonymous, outside, suspended]) expect(context.storage.getItem(DEMO_CONTENT_REPORTS_STORAGE_KEY)).toBeNull()
  })

  it("juge la cible et le motif avant tout : une nature hors contrat, un identifiant illisible, un motif inconnu", async () => {
    const { storage, reports } = setup()
    expect(await reports.report(hostile({ kind: "post", id: "post-1", reason: "other" }))).toEqual({ ok: false, code: "content_report_target_invalid" })
    expect(await reports.report(hostile({ kind: "diasporaJobOffer", id: "", reason: "other" }))).toEqual({ ok: false, code: "content_report_target_invalid" })
    expect(await reports.report(hostile({ kind: "diasporaJobOffer", id: " job-1", reason: "other" }))).toEqual({ ok: false, code: "content_report_target_invalid" })
    expect(await reports.report(hostile({ kind: "diasporaJobOffer", id: "x".repeat(CONTENT_REPORT_TARGET_ID_MAX + 1), reason: "other" }))).toEqual({ ok: false, code: "content_report_target_invalid" })
    expect(await reports.report(hostile({ kind: "diasporaJobOffer", id: "job-1", reason: "spam" }))).toEqual({ ok: false, code: "report_reason_required" })
    expect(storage.getItem(DEMO_CONTENT_REPORTS_STORAGE_KEY)).toBeNull()
  })

  it("la garde commune admet les neuf natures du contrat et tous les motifs du moteur, dans son ordre (SU01d)", () => {
    expect(REPORT_REASONS).toEqual(CONTENT_REPORT_REASONS)
    for (const kind of CONTENT_REPORT_KINDS) {
      for (const reason of REPORT_REASONS) expect(contentReportRefusal({ kind, id: "cible-1", reason })).toBeNull()
    }
    expect(CONTENT_REPORT_KINDS).toHaveLength(9)
  })

  it("un stockage illisible, ou celui d'une autre démonstration, n'est jamais relu", () => {
    const unreadable = new MemoryStorage()
    unreadable.setItem(DEMO_CONTENT_REPORTS_STORAGE_KEY, "{pas du json")
    const first = setup({ storage: unreadable })
    expect(renderHook(() => first.reports.useReported(QUESTION)).result.current).toBe(false)

    const foreign = new MemoryStorage()
    const otherSeed: DemoContentReportsState = {
      version: 1,
      seedCreatedAt: NOW - 1,
      reports: [{ reporterId: "p-prisca", kind: "diasporaAidQuestion", targetId: "aid-q-2", reason: "other", createdAt: 1 }],
    }
    foreign.setItem(DEMO_CONTENT_REPORTS_STORAGE_KEY, JSON.stringify(otherSeed))
    const second = setup({ storage: foreign })
    expect(renderHook(() => second.reports.useReported(QUESTION)).result.current).toBe(false)
  })

  it("borne ce qu'il garde : au-delà de la limite, les plus anciens tombent", async () => {
    const { storage, reports } = setup()
    for (let index = 0; index <= DEMO_CONTENT_REPORTS_MAX; index += 1) {
      await reports.report({ kind: "diasporaJobOffer", id: `offre-${index}`, reason: "other" })
    }
    const kept = stored(storage)?.reports ?? []
    expect(kept).toHaveLength(DEMO_CONTENT_REPORTS_MAX)
    expect(kept[0]?.targetId).toBe("offre-1")
  })
})
