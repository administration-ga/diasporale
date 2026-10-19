// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { deskSanctions, isHeavyDecision, type DeskCaseView, type DeskPage, type Loadable } from "../data"
import { createDemoModerationDesk, DEMO_DESK_TEAM_ID, DEMO_DESK_WINDOW } from "./moderation-desk"
import { createDemoSeed, type DemoState } from "./state"
import { DEMO_STORAGE_KEY, DemoStore } from "./store"

/**
 * Guichet de modération de démonstration : dossiers fictifs, décisions gardées
 * dans la page, sans effet sur le magasin ; mêmes règles que le moteur (motif,
 * mesures, partie au dossier, refus pour une autre session).
 */
const NOW = Date.UTC(2026, 9, 18, 12)
const DAY = 24 * 60 * 60 * 1000
const PERSON = "p-prisca"
const OTHER = "p-nadia"
const REASON = "Propos insultants répétés (motif de démonstration)."

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
  const desk = createDemoModerationDesk(store)
  return { store, desk, advance: (ms: number) => { now += ms } }
}

const ready = <T,>(loadable: Loadable<T>): T => {
  if (loadable.status !== "ready") throw new Error(`Lecture non prête : ${loadable.status}`)
  return loadable.data
}

/** Toute la file fictive, fenêtre après fenêtre. */
function allCases(desk: ReturnType<typeof setup>["desk"], zone: Parameters<ReturnType<typeof setup>["desk"]["useQueue"]>[0]["zone"] = { kind: "all" }): DeskCaseView[] {
  const rows: DeskCaseView[] = []
  let cursor: string | null = null
  for (let turn = 0; turn < 10; turn += 1) {
    const current: string | null = cursor
    const { result } = renderHook(() => desk.useQueue({ personId: PERSON, zone, surface: null, teamId: null, cursor: current }))
    const page: DeskPage<DeskCaseView> = ready(result.current)
    rows.push(...page.items)
    if (page.isDone) break
    cursor = page.continueCursor
  }
  return rows
}

afterEach(cleanup)

describe("Guichet de démonstration — capacité et file fictives", () => {
  it("ouvre un rôle fictif d'administration à la personne de la session, et à elle seule", () => {
    const { desk } = setup()
    expect(desk.demonstration).toBe(true)
    const view = ready(renderHook(() => desk.useDesk(PERSON)).result.current)
    expect(view).toMatchObject({ role: "network_admin", networkWide: true, canReviewAppeals: true, canManageTeams: true })
    expect(view?.teams).toEqual([{ teamId: DEMO_DESK_TEAM_ID, name: "Équipe France (fictive)", scope: null, isMember: true }])
    expect(renderHook(() => desk.useDesk(OTHER)).result.current).toEqual({ status: "error", code: "not_found" })
  })

  it("refuse le guichet sans session", () => {
    const { desk } = setup({ session: { personId: null } })
    expect(renderHook(() => desk.useDesk(PERSON)).result.current).toEqual({ status: "error", code: "not_signed_in" })
  })

  it("filtre la file par pays de la cible, par fenêtres courtes, sans rien compter", () => {
    const { desk } = setup()
    const first = ready(renderHook(() => desk.useQueue({ personId: PERSON, zone: { kind: "all" }, surface: null, teamId: null, cursor: null })).result.current)
    expect(first.items).toHaveLength(DEMO_DESK_WINDOW)
    expect(first.isDone).toBe(false)
    expect(first.continueCursor).not.toBeNull()
    const everything = allCases(desk)
    expect(everything.length).toBeGreaterThan(DEMO_DESK_WINDOW)
    expect(allCases(desk, { kind: "country", country: "FR" }).every((row) => row.country === "FR")).toBe(true)
    expect(allCases(desk, { kind: "none" }).every((row) => row.country === null)).toBe(true)
    expect(allCases(desk, { kind: "country", country: "BE" }).map((row) => row.surface)).toEqual(["serviceReviewReply"])
    const pages = ready(renderHook(() => desk.useQueue({ personId: PERSON, zone: { kind: "all" }, surface: "page", teamId: null, cursor: null })).result.current)
    expect(pages.items.map((row) => row.surface)).toEqual(["page"])
    const team = ready(renderHook(() => desk.useQueue({ personId: PERSON, zone: { kind: "all" }, surface: null, teamId: DEMO_DESK_TEAM_ID, cursor: null })).result.current)
    expect(team.items.every((row) => row.level === "team")).toBe(true)
    expect(renderHook(() => desk.useQueue({ personId: PERSON, zone: { kind: "all" }, surface: null, teamId: "equipe-inconnue", cursor: null })).result.current).toEqual({ status: "error", code: "not_found" })
    expect(renderHook(() => desk.useQueue({ personId: PERSON, zone: { kind: "all" }, surface: null, teamId: null, cursor: "curseur-etranger" })).result.current).toEqual({ status: "error", code: "not_found" })
  })
})

describe("Guichet de démonstration — décisions sans effet", () => {
  it("tranche un dossier : il quitte la file, le magasin reste intact", async () => {
    const { store, desk } = setup()
    const before = store.getState()
    const target = allCases(desk).find((row) => row.party === null && row.hasAuthor)
    expect(target).toBeDefined()
    const reportId = target?.reportId ?? ""
    const detail = renderHook(() => desk.useCase({ personId: PERSON, reportId }))
    expect(ready(detail.result.current).case.reportId).toBe(reportId)
    let decided: Awaited<ReturnType<typeof desk.decide>> | undefined
    await act(async () => {
      decided = await desk.decide({ personId: PERSON, reportId, decision: "actioned", reason: REASON, removal: true, personMeasure: "warning", durationDays: null })
    })
    expect(decided).toEqual({ ok: true, value: { status: "actioned" } })
    expect(detail.result.current).toEqual({ status: "error", code: "not_found" })
    expect(allCases(desk).some((row) => row.reportId === reportId)).toBe(false)
    expect(store.getState()).toBe(before)
  })

  it("applique les règles du moteur : motif, mesure, durée, personne visée, partie au dossier", async () => {
    const { desk } = setup()
    const rows = allCases(desk)
    const open = rows.find((row) => row.party === null && row.hasAuthor)?.reportId ?? ""
    const withoutAuthor = rows.find((row) => row.party === null && !row.hasAuthor)?.reportId ?? ""
    const party = rows.find((row) => row.party !== null)?.reportId ?? ""
    const base = { personId: PERSON, reason: REASON, removal: false, personMeasure: "none" as const, durationDays: null }
    expect(await desk.decide({ ...base, reportId: open, decision: "actioned", reason: "  Court  " })).toEqual({ ok: false, code: "moderation_desk_reason_length" })
    expect(await desk.decide({ ...base, reportId: open, decision: "actioned" })).toEqual({ ok: false, code: "moderation_desk_measure_required" })
    expect(await desk.decide({ ...base, reportId: open, decision: "actioned", personMeasure: "mute" })).toEqual({ ok: false, code: "moderation_desk_duration_required" })
    expect(await desk.decide({ ...base, reportId: withoutAuthor, decision: "actioned", personMeasure: "warning" })).toEqual({ ok: false, code: "moderation_desk_measure_refused" })
    expect(await desk.decide({ ...base, reportId: party, decision: "dismissed" })).toEqual({ ok: false, code: "moderation_desk_party" })
    expect(await desk.decide({ ...base, personId: OTHER, reportId: open, decision: "dismissed" })).toEqual({ ok: false, code: "not_found" })
    expect(await desk.decide({ ...base, reportId: "dossier-inconnu", decision: "dismissed" })).toEqual({ ok: false, code: "not_found" })
  })

  it("tranche la relecture préalable et les recours, l'ancien décideur excepté", async () => {
    const { desk } = setup()
    const pending = ready(renderHook(() => desk.usePending({ personId: PERSON, zone: { kind: "country", country: "FR" }, surface: null, teamId: null, cursor: null })).result.current)
    expect(pending.items.map((row) => row.targetKind)).toEqual(["page", "event"])
    const page = pending.items[0]
    expect(page).toBeDefined()
    if (!page) return
    expect(ready(renderHook(() => desk.usePendingPreview({ personId: PERSON, targetKind: page.targetKind, targetId: page.targetId })).result.current).available).toBe(true)
    await act(async () => {
      expect(await desk.reviewPending({ personId: PERSON, targetKind: page.targetKind, targetId: page.targetId, approve: true, reason: REASON })).toEqual({ ok: true, value: null })
    })
    expect(ready(renderHook(() => desk.usePending({ personId: PERSON, zone: { kind: "all" }, surface: null, teamId: null, cursor: null })).result.current).items.map((row) => row.targetKind)).toEqual(["event"])

    const appeals = ready(renderHook(() => desk.useAppeals({ personId: PERSON, zone: { kind: "all" }, surface: null, cursor: null })).result.current)
    const free = appeals.items.find((row) => row.party === null)
    const decider = appeals.items.find((row) => row.party === "decider")
    expect(free).toBeDefined()
    expect(decider).toBeDefined()
    expect(await desk.decideAppeal({ personId: PERSON, appealId: decider?.appealId ?? "", overturn: true, reason: REASON })).toEqual({ ok: false, code: "moderation_desk_party" })
    await act(async () => {
      expect(await desk.decideAppeal({ personId: PERSON, appealId: free?.appealId ?? "", overturn: false, reason: REASON })).toEqual({ ok: true, value: null })
    })
    expect(ready(renderHook(() => desk.useAppeals({ personId: PERSON, zone: { kind: "all" }, surface: null, cursor: null })).result.current).items.map((row) => row.appealId)).toEqual([decider?.appealId])
  })

  it("une remise à zéro du jeu repart des exemples fictifs", async () => {
    const { store, desk, advance } = setup()
    const reportId = allCases(desk).find((row) => row.party === null)?.reportId ?? ""
    await act(async () => {
      await desk.decide({ personId: PERSON, reportId, decision: "dismissed", reason: REASON, removal: false, personMeasure: "none", durationDays: null })
    })
    expect(allCases(desk).some((row) => row.reportId === reportId)).toBe(false)
    // Un nouveau jeu naît à un autre instant : son guichet est neuf.
    advance(1)
    await act(async () => { await store.reset() })
    await act(async () => { await store.switchTo(PERSON) })
    expect(allCases(desk).some((row) => row.reportId === reportId)).toBe(true)
  })
})

describe("Guichet de démonstration — équipes", () => {
  it("cherche un membre du jeu, l'ajoute puis le retire, motif exigé", async () => {
    const { desk } = setup()
    expect(await desk.findMember({ personId: PERSON, handle: " " })).toEqual({ ok: false, code: "moderation_desk_handle_required" })
    expect(await desk.findMember({ personId: PERSON, handle: "inconnu.demo" })).toEqual({ ok: true, value: null })
    const found = await desk.findMember({ personId: PERSON, handle: "@steeve.ngounie" })
    expect(found).toEqual({ ok: true, value: { personId: "p-steeve", handle: "steeve.ngounie", displayName: "Steeve NGOUNIÉ" } })
    expect(await desk.setTeamMember({ personId: PERSON, teamId: DEMO_DESK_TEAM_ID, memberPersonId: "p-steeve", active: true, reason: "Court" })).toEqual({ ok: false, code: "moderation_desk_reason_length" })
    await act(async () => {
      expect(await desk.setTeamMember({ personId: PERSON, teamId: DEMO_DESK_TEAM_ID, memberPersonId: "p-steeve", active: true, reason: REASON })).toEqual({ ok: true, value: null })
    })
    const roster = ready(renderHook(() => desk.useRoster({ personId: PERSON, teamId: DEMO_DESK_TEAM_ID })).result.current)
    expect(roster.members.map((member) => [member.personId, member.isMe])).toEqual([[PERSON, true], ["demo-moderatrice-fictive", false], ["p-steeve", false]])
    await act(async () => {
      await desk.setTeamMember({ personId: PERSON, teamId: DEMO_DESK_TEAM_ID, memberPersonId: PERSON, active: false, reason: REASON })
    })
    expect(ready(renderHook(() => desk.useDesk(PERSON)).result.current)?.teams[0]?.isMember).toBe(false)
  })

  it("crée une équipe fictive, nom borné", async () => {
    const { desk } = setup()
    expect(await desk.createTeam({ personId: PERSON, name: "X", scope: null, reason: REASON })).toEqual({ ok: false, code: "moderation_desk_team_name_length" })
    let created: Awaited<ReturnType<typeof desk.createTeam>> | undefined
    await act(async () => { created = await desk.createTeam({ personId: PERSON, name: " Avis (fictive) ", scope: "serviceReview", reason: REASON }) })
    expect(created?.ok).toBe(true)
    const teams = ready(renderHook(() => desk.useDesk(PERSON)).result.current)?.teams ?? []
    expect(teams.map((team) => [team.name, team.scope, team.isMember])).toEqual([["Équipe France (fictive)", null, true], ["Avis (fictive)", "serviceReview", false]])
  })
})

describe("Règles pures du port — mesures", () => {
  it("date les mesures temporaires et confirme les seules mesures lourdes", () => {
    expect(deskSanctions({ decision: "actioned", removal: true, personMeasure: "mute", durationDays: 7 }, NOW)).toEqual({ ok: true, value: [{ kind: "removal" }, { kind: "mute", until: NOW + 7 * DAY }] })
    expect(deskSanctions({ decision: "actioned", removal: false, personMeasure: "exclusion", durationDays: null }, NOW)).toEqual({ ok: true, value: [{ kind: "exclusion" }] })
    expect(deskSanctions({ decision: "dismissed", removal: true, personMeasure: "suspension", durationDays: 30 }, NOW)).toEqual({ ok: true, value: [] })
    expect(isHeavyDecision({ decision: "actioned", removal: false, personMeasure: "suspension", durationDays: 7 }, "post")).toBe(true)
    expect(isHeavyDecision({ decision: "actioned", removal: true, personMeasure: "none", durationDays: null }, "page")).toBe(true)
    expect(isHeavyDecision({ decision: "actioned", removal: true, personMeasure: "warning", durationDays: null }, "post")).toBe(false)
    expect(isHeavyDecision({ decision: "dismissed", removal: true, personMeasure: "exclusion", durationDays: null }, "person")).toBe(false)
  })
})
