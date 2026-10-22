// @vitest-environment jsdom
import { reportDecisionDueAt, reportLegalBasis } from "@antsia/social-domain/moderation"
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  deskCountdown,
  deskSanctions,
  isHeavyDecision,
  withoutDeadlineCases,
  type DeskCaseView,
  type DeskDeadlineLane,
  type DeskPage,
  type DeskQueueRequest,
  type Loadable,
} from "../data"
import { createDemoModerationDesk, DEMO_DESK_TEAM_ID, DEMO_DESK_WINDOW } from "./moderation-desk"
import { createDemoSeed, type DemoState } from "./state"
import { DEMO_STORAGE_KEY, DemoStore } from "./store"

/**
 * Guichet de modération de démonstration : dossiers fictifs, décisions gardées
 * dans la page, sans effet sur le magasin ; mêmes règles que le moteur (motif,
 * mesures, partie au dossier, délais légaux, refus pour une autre session).
 */
const NOW = Date.UTC(2026, 9, 18, 12)
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
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

/** Toute la file fictive, fenêtre après fenêtre ; la file ordinaire avec `lane`. */
function allCases(desk: ReturnType<typeof setup>["desk"], zone: DeskQueueRequest["zone"] = { kind: "all" }, lane?: DeskQueueRequest["lane"]): DeskCaseView[] {
  const rows: DeskCaseView[] = []
  let cursor: string | null = null
  for (let turn = 0; turn < 10; turn += 1) {
    const current: string | null = cursor
    const { result } = renderHook(() => desk.useQueue({ personId: PERSON, zone, surface: null, teamId: null, lane, cursor: current }))
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

describe("Guichet de démonstration — délais légaux (SU01d du moteur)", () => {
  const lane = (desk: ReturnType<typeof setup>["desk"], teamId: string | null = null): DeskDeadlineLane =>
    ready(renderHook(() => desk.useDeadlines({ personId: PERSON, teamId })).result.current)

  it("pose les délais par la règle du moteur, l'échéance la plus proche d'abord, accusé à la transmission", () => {
    const { desk } = setup()
    const { items, truncated } = lane(desk)
    expect(truncated).toBe(false)
    // Un hypertrucage (24 h) passe avant les harcèlements (72 h), quel que soit leur âge.
    expect(items.map((row) => [row.ground, row.basis])).toEqual([["deepfake_of_me", "art33"], ["harassment", "art24"], ["harassment", "art24"], ["harassment", "art24"]])
    expect(items[0]?.dueAt).toBe(NOW + 3 * HOUR)
    for (const row of items) {
      expect(row.dueAt).toBe(reportDecisionDueAt(row.ground, row.createdAt))
      expect(row.acknowledgedAt).toBe(row.createdAt)
    }
    expect(items.map((row) => row.dueAt)).toEqual(items.map((row) => row.dueAt).sort((a, b) => a - b))
    // Exactement les dossiers dont le motif porte un délai : ni le pays ni la nature ne comptent.
    const withDeadline = allCases(desk).filter((row) => reportLegalBasis(row.ground) !== null).map((row) => row.reportId)
    expect(items.map((row) => row.reportId).sort()).toEqual(withDeadline.sort())
    expect(new Set(allCases(desk).filter((row) => withDeadline.includes(row.reportId)).map((row) => row.country))).toEqual(new Set(["FR", "BE", null]))
  })

  it("suit l'équipe choisie et refuse une équipe inconnue, une autre personne ou l'absence de session", () => {
    const { desk } = setup()
    expect(lane(desk, DEMO_DESK_TEAM_ID).items.map((row) => [row.reportId, row.level, row.teamId])).toEqual([["demo-dossier-9", "team", DEMO_DESK_TEAM_ID]])
    expect(renderHook(() => desk.useDeadlines({ personId: PERSON, teamId: "equipe-inconnue" })).result.current).toEqual({ status: "error", code: "not_found" })
    expect(renderHook(() => desk.useDeadlines({ personId: OTHER, teamId: null })).result.current).toEqual({ status: "error", code: "not_found" })
    const signedOut = setup({ session: { personId: null } })
    expect(renderHook(() => signedOut.desk.useDeadlines({ personId: PERSON, teamId: null })).result.current).toEqual({ status: "error", code: "not_signed_in" })
  })

  it("la file ordinaire ne reprend pas la voie ; un dossier tranché quitte la voie", async () => {
    const { desk } = setup()
    const shown = new Set(lane(desk).items.map((row) => row.reportId))
    const ordinary = allCases(desk, { kind: "all" }, "ordinary")
    expect(ordinary.some((row) => shown.has(row.reportId))).toBe(false)
    expect(ordinary.length + shown.size).toBe(allCases(desk).length)
    // Les filtres de la file ordinaire restent ceux de la file entière.
    expect(allCases(desk, { kind: "country", country: "BE" }, "ordinary")).toEqual([])
    await act(async () => {
      expect(await desk.decide({ personId: PERSON, reportId: "demo-dossier-1", decision: "dismissed", reason: REASON, removal: false, personMeasure: "none", durationDays: null })).toEqual({ ok: true, value: { status: "dismissed" } })
    })
    expect(lane(desk).items.map((row) => row.reportId)).not.toContain("demo-dossier-1")
    expect(allCases(desk, { kind: "all" }, "ordinary").map((row) => row.reportId)).not.toContain("demo-dossier-1")
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

describe("Règles pures du port — délais légaux", () => {
  it("dit le reste à la minute inférieure et le retard à la minute supérieure ; l'échéance même n'est pas un retard", () => {
    const due = NOW + 3 * HOUR
    expect(deskCountdown(due, NOW)).toEqual({ overdue: false, hours: 3, minutes: 0 })
    expect(deskCountdown(due, NOW + 1)).toEqual({ overdue: false, hours: 2, minutes: 59 })
    expect(deskCountdown(due, due - MINUTE - 1)).toEqual({ overdue: false, hours: 0, minutes: 1 })
    expect(deskCountdown(due, due)).toEqual({ overdue: false, hours: 0, minutes: 0 })
    expect(deskCountdown(due, due + 1)).toEqual({ overdue: true, hours: 0, minutes: 1 })
    expect(deskCountdown(due, due + 65 * MINUTE)).toEqual({ overdue: true, hours: 1, minutes: 5 })
  })

  it("n'écarte de la file ordinaire que les dossiers que la voie montre, sans nouvelle fenêtre s'il n'y a rien à écarter", () => {
    const row = (reportId: string): DeskCaseView => ({
      reportId, surface: "post", country: "FR", ground: "harassment", status: "open", level: "network", teamName: null, createdAt: NOW, hasAuthor: true, party: null,
    })
    const page: DeskPage<DeskCaseView> = { items: [row("a"), row("b")], continueCursor: "suite", isDone: false }
    const deadline = { surface: "post", ground: "harassment", status: "open", level: "network", teamId: null, createdAt: NOW, basis: "art24", dueAt: NOW + 3 * DAY, acknowledgedAt: NOW } as const
    expect(withoutDeadlineCases(page, { items: [{ ...deadline, reportId: "a" }], truncated: false })).toEqual({ items: [row("b")], continueCursor: "suite", isDone: false })
    expect(withoutDeadlineCases(page, { items: [{ ...deadline, reportId: "z" }], truncated: true })).toBe(page)
    expect(withoutDeadlineCases(page, { items: [], truncated: false })).toBe(page)
  })
})
