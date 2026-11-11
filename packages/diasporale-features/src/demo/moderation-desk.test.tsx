// @vitest-environment jsdom
import { reportDecisionDueAt, reportLegalBasis } from "@antsia/social-domain/moderation"
import { MODERATION_POLICY_DEFAULTS, MODERATION_SURFACES } from "@antsia/social-domain/moderationPolicy"
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  DESK_BLOCKED_TERMS_MAX,
  deskCountdown,
  deskHeldContentOf,
  deskPolicyRefusal,
  deskSanctions,
  deskWindowMinutes,
  deskWindowMsOf,
  deskWindowUnit,
  isHeavyDecision,
  withoutDeadlineCases,
  type DeskCaseView,
  type DeskDeadlineLane,
  type DeskPage,
  type DeskQueueRequest,
  type Loadable,
} from "../data"
import { createDemoModerationDesk, DEMO_DESK_TEAM_ID, DEMO_DESK_WINDOW } from "./moderation-desk"
import { createDemoPageAdmin, demoManagedPage } from "./page-admin"
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
    expect(view).toMatchObject({ role: "network_admin", networkWide: true, canReviewAppeals: true, canManageTeams: true, canManagePolicy: true })
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

  it("range un groupe au pays du groupe et un message personnel sans pays, aperçu du seul texte (MC-01 du moteur)", async () => {
    const { desk } = setup()
    const group = allCases(desk, { kind: "country", country: "FR" }).find((row) => row.surface === "thematicGroup")
    const message = allCases(desk, { kind: "none" }).find((row) => row.surface === "personalMessage")
    expect(group).toMatchObject({ country: "FR", party: "group", hasAuthor: true })
    expect(message).toMatchObject({ country: null, party: null, hasAuthor: true })
    const messages = ready(renderHook(() => desk.useQueue({ personId: PERSON, zone: { kind: "all" }, surface: "personalMessage", teamId: null, cursor: null })).result.current)
    expect(messages.items.map((row) => row.reportId)).toEqual([message?.reportId])
    // La fiche du groupe a un nom ; le message n'a ni titre, ni pièce : son texte seul.
    expect(ready(renderHook(() => desk.useCasePreview({ personId: PERSON, reportId: group?.reportId ?? "" })).result.current).title).not.toBeNull()
    const preview = ready(renderHook(() => desk.useCasePreview({ personId: PERSON, reportId: message?.reportId ?? "" })).result.current)
    expect(preview).toMatchObject({ available: true, title: null, media: [] })
    expect(preview.body).not.toBeNull()
    // Qui tient le groupe ne tranche pas, comme le moteur le refuse.
    expect(await desk.decide({ personId: PERSON, reportId: group?.reportId ?? "", decision: "dismissed", reason: REASON, removal: false, personMeasure: "none", durationDays: null })).toEqual({ ok: false, code: "moderation_desk_party" })
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

describe("Guichet de démonstration — responsables du réseau (MD-01)", () => {
  const responsibles = (desk: ReturnType<typeof setup>["desk"], personId = PERSON) => renderHook(() => desk.useResponsibles(personId)).result.current
  const capacity = (desk: ReturnType<typeof setup>["desk"]) => ready(renderHook(() => desk.useDesk(PERSON)).result.current)

  it("la personne de la session administre seule au départ : personne n'est nommé d'office, et le dernier administrateur reste", async () => {
    const { desk } = setup()
    expect(ready(responsibles(desk))).toEqual({
      members: [{ personId: PERSON, role: "network_admin", handle: "prisca.abanga", displayName: "Prisca ABANGA", active: true, isMe: true }],
      more: false,
    })
    expect(await desk.setResponsibleRole({ personId: PERSON, memberPersonId: PERSON, role: "member", reason: REASON })).toEqual({ ok: false, code: "moderation_desk_last_admin" })
    expect(await desk.setResponsibleRole({ personId: PERSON, memberPersonId: PERSON, role: "network_moderator", reason: REASON })).toEqual({ ok: false, code: "moderation_desk_last_admin" })
    expect(responsibles(desk, OTHER)).toEqual({ status: "error", code: "not_found" })
    expect(await desk.setResponsibleRole({ personId: OTHER, memberPersonId: PERSON, role: "member", reason: REASON })).toEqual({ ok: false, code: "not_found" })
  })

  it("nomme un membre actif, motif exigé ; refuse une adhésion en attente ou absente ; un rôle déjà posé ne change rien", async () => {
    const seed = createDemoSeed(NOW)
    const clarisse = seed.memberships["p-clarisse"]!
    const { desk } = setup({ memberships: { ...seed.memberships, "p-clarisse": { ...clarisse, grounds: { ...clarisse.grounds, idn: null } } } })
    expect(await desk.setResponsibleRole({ personId: PERSON, memberPersonId: "p-steeve", role: "network_moderator", reason: "Court" })).toEqual({ ok: false, code: "moderation_desk_reason_length" })
    await act(async () => {
      expect(await desk.setResponsibleRole({ personId: PERSON, memberPersonId: "p-steeve", role: "network_moderator", reason: REASON })).toEqual({ ok: true, value: { role: "network_moderator", changed: true } })
    })
    expect(await desk.setResponsibleRole({ personId: PERSON, memberPersonId: "p-steeve", role: "network_moderator", reason: REASON })).toEqual({ ok: true, value: { role: "network_moderator", changed: false } })
    expect(await desk.setResponsibleRole({ personId: PERSON, memberPersonId: "p-clarisse", role: "network_moderator", reason: REASON })).toEqual({ ok: false, code: "moderation_desk_role_refused" })
    expect(await desk.setResponsibleRole({ personId: PERSON, memberPersonId: "p-inconnue", role: "network_moderator", reason: REASON })).toEqual({ ok: false, code: "moderation_desk_role_refused" })
    expect(ready(responsibles(desk)).members.map((row) => [row.personId, row.role, row.isMe])).toEqual([[PERSON, "network_admin", true], ["p-steeve", "network_moderator", false]])
    await act(async () => {
      expect(await desk.setResponsibleRole({ personId: PERSON, memberPersonId: "p-steeve", role: "network_admin", reason: REASON })).toEqual({ ok: true, value: { role: "network_admin", changed: true } })
    })
    await act(async () => {
      expect(await desk.setResponsibleRole({ personId: PERSON, memberPersonId: "p-steeve", role: "member", reason: REASON })).toEqual({ ok: true, value: { role: "member", changed: true } })
    })
    expect(ready(responsibles(desk)).members.map((row) => row.personId)).toEqual([PERSON])
  })

  it("rétrogradée, la personne de la session perd les recours et les équipes au geste suivant, et garde toute la file", async () => {
    const { desk } = setup()
    await act(async () => { await desk.setResponsibleRole({ personId: PERSON, memberPersonId: "p-steeve", role: "network_admin", reason: REASON }) })
    await act(async () => {
      expect(await desk.setResponsibleRole({ personId: PERSON, memberPersonId: PERSON, role: "network_moderator", reason: REASON })).toEqual({ ok: true, value: { role: "network_moderator", changed: true } })
    })
    expect(capacity(desk)).toMatchObject({ role: "network_moderator", networkWide: true, canReviewAppeals: false, canManageTeams: false, canManagePolicy: false })
    // MD-04 : les réglages quittent un modérateur avec le rôle d'administration.
    expect(renderHook(() => desk.useSettings(PERSON)).result.current).toEqual({ status: "error", code: "not_found" })
    expect(renderHook(() => desk.useAppeals({ personId: PERSON, zone: { kind: "all" }, surface: null, cursor: null })).result.current).toEqual({ status: "error", code: "not_found" })
    expect(responsibles(desk)).toEqual({ status: "error", code: "not_found" })
    expect(await desk.setResponsibleRole({ personId: PERSON, memberPersonId: PERSON, role: "network_admin", reason: REASON })).toEqual({ ok: false, code: "not_found" })
    expect(await desk.findMember({ personId: PERSON, handle: "steeve.ngounie" })).toEqual({ ok: false, code: "not_found" })
    expect(allCases(desk).length).toBeGreaterThan(0)
  })

  it("retirée, elle ne garde que la file de ses équipes ; sans équipe, plus de guichet", async () => {
    const { desk } = setup()
    await act(async () => { await desk.setResponsibleRole({ personId: PERSON, memberPersonId: "p-steeve", role: "network_admin", reason: REASON }) })
    await act(async () => { await desk.setResponsibleRole({ personId: PERSON, memberPersonId: PERSON, role: "member", reason: REASON }) })
    expect(capacity(desk)).toEqual({
      role: "team_member", networkWide: false, canReviewAppeals: false, canManageTeams: false, canManagePolicy: false, canReviewClaims: false,
      teams: [{ teamId: DEMO_DESK_TEAM_ID, name: "Équipe France (fictive)", scope: null, isMember: true }],
    })
    const queue = (teamId: string | null) => renderHook(() => desk.useQueue({ personId: PERSON, zone: { kind: "all" }, surface: null, teamId, cursor: null })).result.current
    expect(queue(null)).toEqual({ status: "error", code: "not_found" })
    expect(ready(queue(DEMO_DESK_TEAM_ID)).items.length).toBeGreaterThan(0)
    expect(ready(queue(DEMO_DESK_TEAM_ID)).items.every((row) => row.level === "team")).toBe(true)
    expect(renderHook(() => desk.useCase({ personId: PERSON, reportId: "demo-dossier-1" })).result.current).toEqual({ status: "error", code: "not_found" })
    expect(await desk.setTeamMember({ personId: PERSON, teamId: DEMO_DESK_TEAM_ID, memberPersonId: PERSON, active: false, reason: REASON })).toEqual({ ok: false, code: "not_found" })
  })
})

describe("Guichet de démonstration — réglages de modération (MD-04)", () => {
  const settings = (desk: ReturnType<typeof setup>["desk"], personId = PERSON) => renderHook(() => desk.useSettings(personId)).result.current
  const terms = (desk: ReturnType<typeof setup>["desk"]) => ready(renderHook(() => desk.useBlockedTerms({ personId: PERSON, cursor: null })).result.current)

  it("part d'un réseau sans réglage : les défauts et la règle sans réglage sont ceux du moteur", () => {
    const { desk } = setup()
    const view = ready(settings(desk))
    expect(view.defaults).toEqual(MODERATION_POLICY_DEFAULTS)
    expect(view.surfaces.map((row) => row.surface)).toEqual([...MODERATION_SURFACES])
    expect(view.surfaces.every((row) => row.policy === null)).toBe(true)
    const rule = (surface: string) => view.surfaces.find((row) => row.surface === surface)?.withoutPolicy
    expect(["diasporaJobOffer", "diasporaKitResource", "serviceReview", "serviceReviewReply", "event", "post", "page"].map(rule)).toEqual(["unchecked", "unchecked", "held", "held", "defaults", "defaults", "defaults"])
    expect(terms(desk)).toEqual({ items: [], continueCursor: null, isDone: true })
    expect(settings(desk, OTHER)).toEqual({ status: "error", code: "not_found" })
  })

  it("pose un réglage motivé dans les bornes du moteur, puis le change ; sans effet sur le magasin", async () => {
    const { store, desk } = setup()
    const before = store.getState()
    const values = { personId: PERSON, surface: "diasporaJobOffer" as const, preReview: true, maxLinks: 2, maxWrites: 30, windowMs: HOUR, reason: REASON }
    expect(await desk.setPolicy({ ...values, reason: "Court" })).toEqual({ ok: false, code: "moderation_desk_reason_length" })
    expect(await desk.setPolicy({ ...values, maxLinks: 21 })).toEqual({ ok: false, code: "moderation_desk_links_bounds" })
    expect(await desk.setPolicy({ ...values, maxWrites: 0 })).toEqual({ ok: false, code: "moderation_desk_writes_bounds" })
    expect(await desk.setPolicy({ ...values, windowMs: 500 })).toEqual({ ok: false, code: "moderation_desk_window_bounds" })
    expect(await desk.setPolicy({ ...values, personId: OTHER })).toEqual({ ok: false, code: "not_found" })
    await act(async () => { expect(await desk.setPolicy(values)).toEqual({ ok: true, value: null }) })
    expect(ready(settings(desk)).surfaces.find((row) => row.surface === "diasporaJobOffer")?.policy).toEqual({ preReview: true, maxLinks: 2, maxWrites: 30, windowMs: HOUR, updatedAt: NOW })
    await act(async () => { expect(await desk.setPolicy({ ...values, preReview: false })).toEqual({ ok: true, value: null }) })
    expect(ready(settings(desk)).surfaces.find((row) => row.surface === "diasporaJobOffer")?.policy?.preReview).toBe(false)
    expect(store.getState()).toBe(before)
  })

  it("bloque un mot normalisé, le débloque, et refuse un mot hors bornes ou au-delà du plafond", async () => {
    const { desk } = setup()
    expect(await desk.setBlockedTerm({ personId: PERSON, term: " é ", active: true, reason: REASON })).toEqual({ ok: false, code: "moderation_desk_term_length" })
    expect(await desk.setBlockedTerm({ personId: PERSON, term: "Ambassade", active: true, reason: "Court" })).toEqual({ ok: false, code: "moderation_desk_reason_length" })
    await act(async () => { expect(await desk.setBlockedTerm({ personId: PERSON, term: "  Ambassade ", active: true, reason: REASON })).toEqual({ ok: true, value: null }) })
    expect(terms(desk).items.map((row) => row.term)).toEqual(["ambassade"])
    await act(async () => { expect(await desk.setBlockedTerm({ personId: PERSON, term: "AMBASSADE", active: false, reason: REASON })).toEqual({ ok: true, value: null }) })
    expect(terms(desk).items).toEqual([])
    for (let n = 0; n < DESK_BLOCKED_TERMS_MAX; n += 1) {
      await act(async () => { await desk.setBlockedTerm({ personId: PERSON, term: `motfictif${n}`, active: true, reason: REASON }) })
    }
    expect(await desk.setBlockedTerm({ personId: PERSON, term: "un-de-trop", active: true, reason: REASON })).toEqual({ ok: false, code: "moderation_desk_terms_full" })
    // Débloquer reste possible au plafond.
    await act(async () => { expect(await desk.setBlockedTerm({ personId: PERSON, term: "motfictif0", active: false, reason: REASON })).toEqual({ ok: true, value: null }) })
  })
})

describe("Guichet de démonstration — pages à vérifier (AS-01)", () => {
  const evidence = [new File([new Uint8Array(16)], "statuts.pdf", { type: "application/pdf" })]
  /** Une revendication déposée par la personne de la session, comme depuis « Mon activité ». */
  async function requestClaim(store: DemoStore, pageId: string): Promise<string> {
    const management = createDemoPageAdmin(store, { storage: null }).management
    let claimId = ""
    await act(async () => {
      const result = await management?.requestClaim({ pageId, note: "Mandat déclaré : présidence.", evidence })
      if (result?.ok) claimId = result.value.claimId
    })
    return claimId
  }
  const claims = (desk: ReturnType<typeof setup>["desk"], personId: string, zone: DeskQueueRequest["zone"] = { kind: "all" }) =>
    ready(renderHook(() => desk.useClaims({ personId, zone, cursor: null })).result.current).items

  it("lit les vraies revendications de la démonstration, par pays de la page ; la demandeuse ne tranche pas la sienne", async () => {
    const { store, desk } = setup()
    expect(ready(renderHook(() => desk.useDesk(PERSON)).result.current)?.canReviewClaims).toBe(true)
    expect(claims(desk, PERSON)).toEqual([])
    const claimId = await requestClaim(store, "page-asso-bordeaux")
    expect(claims(desk, PERSON)).toMatchObject([{ claimId, country: "FR", evidenceCount: 1, party: "author", page: { id: "page-asso-bordeaux", badge: "community" } }])
    expect(claims(desk, PERSON, { kind: "country", country: "BE" })).toEqual([])
    expect(ready(renderHook(() => desk.useClaim({ personId: PERSON, claimId })).result.current)).toMatchObject({ claimant: { handle: "prisca.abanga" }, evidence: [{ url: null, withheld: null }], canDecide: false })
    expect(await desk.decideClaim({ personId: PERSON, claimId, decision: "approved", reason: REASON })).toEqual({ ok: false, code: "not_found" })
    expect(renderHook(() => desk.useClaims({ personId: OTHER, zone: { kind: "all" }, cursor: null })).result.current).toEqual({ status: "error", code: "not_found" })
  })

  it("un autre responsable tranche par une décision motivée : la page devient « Vérifié », la file se vide", async () => {
    const { store, desk } = setup()
    const claimId = await requestClaim(store, "page-asso-bordeaux")
    await act(async () => { await store.switchTo("p-steeve") })
    expect(claims(desk, "p-steeve")).toMatchObject([{ claimId, party: null }])
    expect(ready(renderHook(() => desk.useClaim({ personId: "p-steeve", claimId })).result.current).canDecide).toBe(true)
    expect(await desk.decideClaim({ personId: "p-steeve", claimId, decision: "approved", reason: "Court" })).toEqual({ ok: false, code: "moderation_desk_reason_length" })
    await act(async () => {
      expect(await desk.decideClaim({ personId: "p-steeve", claimId, decision: "approved", reason: REASON })).toEqual({ ok: true, value: { status: "approved" } })
    })
    expect(claims(desk, "p-steeve")).toEqual([])
    expect(demoManagedPage(store, "etudiants-bordeaux-demo")?.badge).toBe("verified")
    expect(await desk.decideClaim({ personId: "p-steeve", claimId, decision: "rejected", reason: REASON })).toEqual({ ok: false, code: "moderation_desk_conflict" })
  })

  it("un signataire de la page, même invité, ne tranche pas ; sans rôle de réseau, plus de file", async () => {
    const { store, desk } = setup()
    // Mireille (vérifiée) crée une page, y invite Steeve, puis en demande la vérification.
    await act(async () => { await store.switchTo("p-mireille") })
    const management = createDemoPageAdmin(store, { storage: null }).management
    let pageId = ""
    await act(async () => {
      const created = await management?.createPage({ ownerKind: "association", name: "Amicale de Lille", country: "FR" })
      if (created?.ok) pageId = created.value.pageId
    })
    await act(async () => { expect(await management?.grantRole(pageId, "steeve.ngounie", "signatory")).toMatchObject({ ok: true, value: { invited: true } }) })
    const claimId = await requestClaim(store, pageId)
    expect(claims(desk, "p-mireille")).toMatchObject([{ claimId, party: "author" }])
    // Steeve n'a pas répondu à l'invitation : sa ligne de signataire suffit à l'écarter.
    await act(async () => { await store.switchTo("p-steeve") })
    expect(claims(desk, "p-steeve")).toMatchObject([{ claimId, party: "page" }])
    expect(ready(renderHook(() => desk.useClaim({ personId: "p-steeve", claimId })).result.current).canDecide).toBe(false)
    expect(await desk.decideClaim({ personId: "p-steeve", claimId, decision: "approved", reason: REASON })).toEqual({ ok: false, code: "not_found" })

    await act(async () => { await store.switchTo(PERSON) })
    expect(claims(desk, PERSON)).toMatchObject([{ claimId, party: null }])
    await act(async () => { await desk.setResponsibleRole({ personId: PERSON, memberPersonId: "p-steeve", role: "network_admin", reason: REASON }) })
    await act(async () => { await desk.setResponsibleRole({ personId: PERSON, memberPersonId: PERSON, role: "member", reason: REASON }) })
    expect(ready(renderHook(() => desk.useDesk(PERSON)).result.current)?.canReviewClaims).toBe(false)
    expect(renderHook(() => desk.useClaims({ personId: PERSON, zone: { kind: "all" }, cursor: null })).result.current).toEqual({ status: "error", code: "not_found" })
  })
})

describe("Règles pures du port — réglages (MD-04)", () => {
  it("dit le champ hors bornes par son code et la fenêtre dans l'unité la plus ronde", () => {
    expect(deskPolicyRefusal(MODERATION_POLICY_DEFAULTS)).toBeNull()
    expect(deskPolicyRefusal({ ...MODERATION_POLICY_DEFAULTS, maxLinks: 1.5 })).toBe("moderation_desk_links_bounds")
    expect(deskPolicyRefusal({ ...MODERATION_POLICY_DEFAULTS, maxWrites: 101 })).toBe("moderation_desk_writes_bounds")
    expect(deskPolicyRefusal({ ...MODERATION_POLICY_DEFAULTS, windowMs: 2 * DAY })).toBe("moderation_desk_window_bounds")
    expect(deskWindowUnit(MINUTE)).toEqual({ unit: "minutes", count: 1 })
    expect(deskWindowUnit(2 * HOUR)).toEqual({ unit: "hours", count: 2 })
    expect(deskWindowUnit(90 * MINUTE)).toEqual({ unit: "minutes", count: 90 })
    expect(deskWindowUnit(30 * 1000)).toEqual({ unit: "seconds", count: 30 })
    expect(deskWindowMinutes(30 * 1000)).toBe(1)
    expect(deskWindowMsOf(deskWindowMinutes(MODERATION_POLICY_DEFAULTS.windowMs))).toBe(MODERATION_POLICY_DEFAULTS.windowMs)
    // Les contenus relus d'office de DIASPORALE et la rubrique qui les porte.
    expect(deskHeldContentOf("event")).toBe("associationEvents")
    expect(deskHeldContentOf("post")).toBe("eventGallery")
    expect(deskHeldContentOf("comment")).toBeNull()
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
