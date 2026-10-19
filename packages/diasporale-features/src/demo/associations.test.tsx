import { ASSOCIATION_REJECTION_COOLDOWN_MS, DAY_MS, LIGHT_ACCOUNT_GROUNDS } from "@diasporale/domain"
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { AssociationMembersRequest, AssociationsCapability } from "../data/associations-port"
import { createDemoAssociations, DEMO_ASSOCIATIONS_STORAGE_KEY, demoAssociationSeed, demoViewerRefusal, type DemoAssociationRow } from "./associations"
import { createDemoPageAdmin, demoPageAdminContext } from "./page-admin"
import { createDemoSeed, type DemoState } from "./state"
import { DemoStore } from "./store"

/**
 * La démonstration des associations joue les mêmes règles que le moteur :
 * demande, décision à la version lue, départ, exclusion motivée, réadmission,
 * refus indistinct hors des responsables — sur le jeu fictif, sans latence.
 */
const NOW = Date.UTC(2026, 9, 18, 9)
const LYON = "page-asso-lyon"

function memoryStorage(initial?: string) {
  const items = new Map<string, string>()
  if (initial) items.set(DEMO_ASSOCIATIONS_STORAGE_KEY, initial)
  return { items, getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) }
}

function setup(options: { viewer?: string | null; state?: (seed: DemoState) => DemoState; storage?: ReturnType<typeof memoryStorage>; latencyMs?: number } = {}) {
  const clock = { now: NOW }
  const seed = createDemoSeed(NOW)
  const state = options.state ? options.state({ ...seed, session: { personId: options.viewer === undefined ? "p-prisca" : options.viewer } }) : { ...seed, session: { personId: options.viewer === undefined ? "p-prisca" : options.viewer } }
  const store = new DemoStore({ getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }, () => clock.now, 0)
  const storage = options.storage ?? memoryStorage()
  const associations = createDemoAssociations(store, { storage, latencyMs: options.latencyMs ?? 0 })
  return { clock, store, storage, associations }
}

function members(associations: AssociationsCapability, args: AssociationMembersRequest) {
  return renderHook((request: AssociationMembersRequest) => associations.useMembers(request), { initialProps: args })
}

function ready<T>(loadable: { status: string; data?: T }): T {
  if (loadable.status !== "ready") throw new Error(`Lecture non prête : ${JSON.stringify(loadable)}`)
  return loadable.data as T
}

describe("démonstration — le jeu fictif des associations", () => {
  it("reprend l'équipe vivante de Lyon, deux adhérentes et une demande, sans accepter l'invitation de Mireille", () => {
    const seed = demoAssociationSeed(NOW)
    expect(seed.rows.map((row) => [row.personId, row.status, row.role])).toEqual([["p-nadia", "accepted", "animator"], ["p-clarisse", "accepted", "member"], ["p-rodrigue", "requested", "member"]])
    // Chaque adhésion du jeu est passée par une demande : demandée avant d'être décidée.
    for (const row of seed.rows) expect(row.requestedAt).toBeLessThanOrEqual(row.statusChangedAt)

    const { store, associations } = setup({ viewer: "p-steeve" })
    expect(demoPageAdminContext(store).signatoriesOf(LYON)).toEqual(["p-steeve"])
    expect(ready(renderHook(() => associations.useManagedAssociation("collectif-ivindo-lyon")).result.current)).toEqual({
      pageId: LYON, handle: "collectif-ivindo-lyon", name: "Collectif Ivindo de Lyon (démo)", role: "admin",
    })
    const requested = ready(members(associations, { pageId: LYON, status: "requested", cursor: null }).result.current)
    expect(requested.items.map((item) => [item.person.handle, item.requestMessage !== null])).toEqual([["rodrigue.komo", true]])
    const accepted = ready(members(associations, { pageId: LYON, status: "accepted", cursor: null }).result.current)
    expect(accepted).toMatchObject({ isDone: true, continueCursor: null })
    expect(accepted.items.map((item) => [item.person.displayName, item.role, item.requestMessage])).toEqual([["Nadia Mpassa", "animator", null], ["Clarisse Mbéi", "member", null]])
    expect(ready(members(associations, { pageId: LYON, status: "removed", cursor: null }).result.current).items).toEqual([])
  })

  it("ma situation : demander est possible au collectif, pas à une association sans équipe ; une entreprise n'est pas une association", () => {
    const { associations } = setup()
    expect(ready(renderHook(() => associations.useMyMembership(LYON)).result.current)).toEqual({
      pageId: LYON, membership: null, request: { allowed: true, refusal: null, availableAt: null }, responsibleRole: null,
    })
    expect(ready(renderHook(() => associations.useMyMembership("page-asso-bordeaux")).result.current).request.refusal).toBe("association_not_managed")
    expect(renderHook(() => associations.useMyMembership("page-saveurs")).result.current).toEqual({ status: "error", code: "not_found" })
    expect(renderHook(() => associations.useMyMembership("page-inconnue")).result.current).toEqual({ status: "error", code: "not_found" })
  })
})

describe("démonstration — gestes de la personne et des responsables", () => {
  it("demander avec un mot, accepter à la version lue, quitter", async () => {
    const { store, associations } = setup()
    const mine = renderHook(() => associations.useMyMembership(LYON))
    expect(await associations.request({ pageId: LYON, message: "a".repeat(501) })).toEqual({ ok: false, code: "association_message_too_long" })
    await act(async () => { expect(await associations.request({ pageId: LYON, message: "  Bonjour, je viens d'arriver.  " })).toEqual({ ok: true, value: null }) })
    expect(ready(mine.result.current).membership).toMatchObject({ status: "requested", requestMessage: "Bonjour, je viens d'arriver." })
    expect(await associations.request({ pageId: LYON, message: "" })).toEqual({ ok: false, code: "association_request_pending" })

    await act(async () => { await store.switchTo("p-steeve") })
    const list = members(associations, { pageId: LYON, status: "requested", cursor: null })
    const prisca = ready(list.result.current).items.find((item) => item.person.handle === "prisca.abanga")!
    expect(await associations.decide({ membershipId: prisca.membershipId, decision: "accept", expectedVersion: prisca.version - 1, reason: "" })).toEqual({ ok: false, code: "association_version_conflict" })
    await act(async () => { expect(await associations.decide({ membershipId: prisca.membershipId, decision: "accept", expectedVersion: prisca.version, reason: "" })).toEqual({ ok: true, value: null }) })
    expect(ready(list.result.current).items.map((item) => item.person.handle)).toEqual(["rodrigue.komo"])

    await act(async () => { await store.switchTo("p-prisca") })
    expect(ready(mine.result.current).membership).toMatchObject({ status: "accepted", role: "member" })
    expect(ready(mine.result.current).request.refusal).toBe("association_already_member")
    expect(await associations.cancelRequest(LYON)).toEqual({ ok: false, code: "association_not_pending" })
    await act(async () => { expect(await associations.leave(LYON)).toEqual({ ok: true, value: null }) })
    expect(ready(mine.result.current).membership?.status).toBe("left")
    expect(await associations.leave(LYON)).toEqual({ ok: false, code: "association_not_member" })
    expect(await associations.cancelRequest("page-asso-bordeaux")).toEqual({ ok: false, code: "association_not_pending" })
  })

  it("refus motivé, puis sept jours d'attente ; annuler sa demande rouvre tout de suite", async () => {
    const { clock, store, associations } = setup()
    await associations.request({ pageId: LYON, message: "" })
    await store.switchTo("p-steeve")
    const row = ready(members(associations, { pageId: LYON, status: "requested", cursor: null }).result.current).items.find((item) => item.person.handle === "prisca.abanga")!
    expect(await associations.decide({ membershipId: row.membershipId, decision: "reject", expectedVersion: row.version, reason: "x".repeat(501) })).toEqual({ ok: false, code: "association_reason_too_long" })
    expect(await associations.decide({ membershipId: row.membershipId, decision: "reject", expectedVersion: row.version, reason: "  Effectif complet  " })).toEqual({ ok: true, value: null })

    await store.switchTo("p-prisca")
    const mine = renderHook(() => associations.useMyMembership(LYON))
    expect(ready(mine.result.current)).toMatchObject({
      membership: { status: "rejected", decisionReason: "Effectif complet" },
      request: { allowed: false, refusal: "association_request_too_soon", availableAt: NOW + ASSOCIATION_REJECTION_COOLDOWN_MS },
    })
    expect(await associations.request({ pageId: LYON, message: "" })).toEqual({ ok: false, code: "association_request_too_soon" })
    clock.now = NOW + ASSOCIATION_REJECTION_COOLDOWN_MS
    expect(await associations.request({ pageId: LYON, message: "" })).toEqual({ ok: true, value: null })
    expect(await associations.cancelRequest(LYON)).toEqual({ ok: true, value: null })
    expect(await associations.request({ pageId: LYON, message: "" })).toEqual({ ok: true, value: null })
  })

  it("exclusion motivée par l'administrateur, puis nouvelle demande seulement après sa décision", async () => {
    const { store, associations } = setup({ viewer: "p-mireille" })
    const pages = createDemoPageAdmin(store, { storage: null })
    await pages.management!.respondToInvitation(LYON, true)
    const accepted = members(associations, { pageId: LYON, status: "accepted", cursor: null })
    const nadia = ready(accepted.result.current).items.find((item) => item.person.handle === "nadia.mpassa")!
    expect(await associations.remove({ membershipId: nadia.membershipId, expectedVersion: nadia.version, reason: "Propos injurieux répétés" })).toEqual({ ok: false, code: "association_admin_required" })
    expect(await associations.setRole({ membershipId: nadia.membershipId, expectedVersion: nadia.version, role: "member" })).toEqual({ ok: false, code: "association_admin_required" })

    await act(async () => { await store.switchTo("p-steeve") })
    expect(await associations.remove({ membershipId: nadia.membershipId, expectedVersion: nadia.version, reason: "bref" })).toEqual({ ok: false, code: "association_reason_required" })
    await act(async () => { expect(await associations.remove({ membershipId: nadia.membershipId, expectedVersion: nadia.version, reason: "Propos injurieux répétés" })).toEqual({ ok: true, value: null }) })
    const removed = ready(members(associations, { pageId: LYON, status: "removed", cursor: null }).result.current).items
    expect(removed).toEqual([expect.objectContaining({ membershipId: nadia.membershipId, decisionReason: "Propos injurieux répétés", readmissionAllowed: false, role: "member" })])

    await act(async () => { await store.switchTo("p-nadia") })
    expect(ready(renderHook(() => associations.useMyMembership(LYON)).result.current)).toMatchObject({
      membership: { status: "removed", decisionReason: "Propos injurieux répétés" },
      request: { allowed: false, refusal: "association_rejoin_blocked", availableAt: null },
    })
    expect(await associations.request({ pageId: LYON, message: "" })).toEqual({ ok: false, code: "association_rejoin_blocked" })

    await store.switchTo("p-steeve")
    const target = removed[0]!
    expect(await associations.allowReadmission({ membershipId: target.membershipId, expectedVersion: target.version })).toEqual({ ok: true, value: null })
    // Rejouer l'autorisation ne change rien (même version, aucune inscription).
    expect(await associations.allowReadmission({ membershipId: target.membershipId, expectedVersion: target.version + 1 })).toEqual({ ok: true, value: null })
    expect(ready(members(associations, { pageId: LYON, status: "removed", cursor: null }).result.current).items[0]).toMatchObject({ readmissionAllowed: true, version: target.version + 1 })
    expect(ready(members(associations, { pageId: LYON, status: "accepted", cursor: null }).result.current).items.map((item) => item.person.handle)).toEqual(["clarisse.mbei"])

    await store.switchTo("p-nadia")
    expect(await associations.request({ pageId: LYON, message: "" })).toEqual({ ok: true, value: null })
  })

  it("nommer une animatrice, la repasser membre ; on ne s'exclut pas soi-même", async () => {
    const { store, associations } = setup({ viewer: "p-steeve" })
    const accepted = members(associations, { pageId: LYON, status: "accepted", cursor: null })
    const clarisse = ready(accepted.result.current).items.find((item) => item.person.handle === "clarisse.mbei")!
    await act(async () => { expect(await associations.setRole({ membershipId: clarisse.membershipId, expectedVersion: clarisse.version, role: "animator" })).toEqual({ ok: true, value: null }) })
    const named = ready(accepted.result.current).items.find((item) => item.person.handle === "clarisse.mbei")!
    expect(named).toMatchObject({ role: "animator", version: clarisse.version + 1 })
    // Le même rôle rejoué ne fait rien.
    expect(await associations.setRole({ membershipId: named.membershipId, expectedVersion: named.version, role: "animator" })).toEqual({ ok: true, value: null })
    expect(ready(accepted.result.current).items.find((item) => item.person.handle === "clarisse.mbei")!.version).toBe(named.version)

    // L'administrateur adhère lui-même (sa demande, sa décision), puis ne peut que quitter.
    await associations.request({ pageId: LYON, message: "" })
    const own = ready(members(associations, { pageId: LYON, status: "requested", cursor: null }).result.current).items.find((item) => item.person.handle === store.getState().persons["p-steeve"]!.profile!.handle)!
    await associations.decide({ membershipId: own.membershipId, decision: "accept", expectedVersion: own.version, reason: "" })
    expect(await associations.remove({ membershipId: own.membershipId, expectedVersion: own.version + 1, reason: "Je me retire du bureau" })).toEqual({ ok: false, code: "association_self_removal" })
    expect(await associations.allowReadmission({ membershipId: own.membershipId, expectedVersion: own.version + 1 })).toEqual({ ok: false, code: "association_not_removed" })
    void store
  })
})

describe("démonstration — gardes et refus indistincts", () => {
  it("une révocation de page ferme aussitôt les listes privées et toute décision sur une demande", async () => {
    const { store, associations, storage } = setup({ viewer: "p-mireille" })
    const pages = createDemoPageAdmin(store, { storage: null })
    await pages.management!.respondToInvitation(LYON, true)
    const list = members(associations, { pageId: LYON, status: "requested", cursor: null })
    const managed = renderHook(() => associations.useManagedAssociation("collectif-ivindo-lyon"))
    const request = ready(list.result.current).items[0]!
    expect(ready(managed.result.current).role).toBe("signatory")
    await act(async () => { await pages.management!.revokeRole(LYON, "p-mireille") })
    expect(list.result.current).toEqual({ status: "error", code: "not_found" })
    expect(managed.result.current).toEqual({ status: "error", code: "not_found" })
    expect(await associations.decide({ membershipId: request.membershipId, decision: "accept", expectedVersion: request.version, reason: "" })).toEqual({ ok: false, code: "not_found" })
    expect(storage.items.has(DEMO_ASSOCIATIONS_STORAGE_KEY)).toBe(false)
  })
  it("R-G14 : la liste n'existe ni pour une adhérente (même animatrice), ni pour un autre membre", () => {
    for (const viewer of ["p-nadia", "p-prisca", "p-clarisse"]) {
      const { associations } = setup({ viewer })
      expect(members(associations, { pageId: LYON, status: "accepted", cursor: null }).result.current).toEqual({ status: "error", code: "not_found" })
      expect(renderHook(() => associations.useManagedAssociation("collectif-ivindo-lyon")).result.current).toEqual({ status: "error", code: "not_found" })
    }
    const { associations } = setup({ viewer: "p-mireille" })
    expect(members(associations, { pageId: "page-saveurs", status: "accepted", cursor: null }).result.current).toEqual({ status: "error", code: "not_found" })
    expect(renderHook(() => associations.useManagedAssociation("saveurs-okoume-demo")).result.current).toEqual({ status: "error", code: "not_found" })
  })

  it("un geste de gestion hors de ses associations, ou sur une personne inconnue, rend le même refus", async () => {
    const { associations } = setup({ viewer: "p-prisca" })
    expect(await associations.decide({ membershipId: "assoc-3", decision: "accept", expectedVersion: 1, reason: "" })).toEqual({ ok: false, code: "not_found" })
    expect(await associations.remove({ membershipId: "inconnue", expectedVersion: 1, reason: "Motif suffisamment long" })).toEqual({ ok: false, code: "not_found" })
  })

  it("non connecté, en attente, suspendu : la lecture et l'écriture refusent dans l'ordre du moteur", async () => {
    const anonymous = setup({ viewer: null })
    expect(renderHook(() => anonymous.associations.useMyMembership(LYON)).result.current).toEqual({ status: "error", code: "not_signed_in" })
    expect(renderHook(() => anonymous.associations.useMyAssociations({ cursor: null })).result.current).toEqual({ status: "error", code: "not_signed_in" })
    expect(await anonymous.associations.request({ pageId: LYON, message: "" })).toEqual({ ok: false, code: "not_signed_in" })

    const pending = setup({ state: (seed) => ({ ...seed, memberships: { ...seed.memberships, "p-prisca": { ...seed.memberships["p-prisca"]!, grounds: LIGHT_ACCOUNT_GROUNDS } } }) })
    expect(ready(renderHook(() => pending.associations.useMyMembership(LYON)).result.current).request).toEqual({ allowed: false, refusal: "status_insufficient", availableAt: null })
    expect(await pending.associations.request({ pageId: LYON, message: "" })).toEqual({ ok: false, code: "status_insufficient" })

    const suspended = setup({ state: (seed) => ({ ...seed, memberships: { ...seed.memberships, "p-prisca": { ...seed.memberships["p-prisca"]!, grounds: { ...seed.memberships["p-prisca"]!.grounds, suspension: { until: null, readAccess: "none" } } } } }) })
    expect(renderHook(() => suspended.associations.useMyMembership(LYON)).result.current).toEqual({ status: "error", code: "suspended" })
    expect(await suspended.associations.cancelRequest(LYON)).toEqual({ ok: false, code: "suspended" })

    const departed = setup({ state: (seed) => ({ ...seed, memberships: { ...seed.memberships, "p-prisca": { ...seed.memberships["p-prisca"]!, grounds: { ...seed.memberships["p-prisca"]!.grounds, leftAt: NOW - DAY_MS } } } }) })
    expect(renderHook(() => departed.associations.useMembers({ pageId: LYON, status: "accepted", cursor: null })).result.current).toEqual({ status: "error", code: "not_member" })
    expect(demoViewerRefusal({ ...createDemoSeed(NOW), session: { personId: "p-inconnue" } }, NOW)).toBe("not_signed_in")
  })

  it("une écriture lancée par une session ne s'applique jamais à la suivante", async () => {
    const { store, associations } = setup({ latencyMs: 5 })
    const pending = associations.request({ pageId: LYON, message: "" })
    await store.switchTo("p-clarisse")
    expect(await pending).toEqual({ ok: false, code: "not_signed_in" })
    await store.switchTo("p-prisca")
    expect(ready(renderHook(() => associations.useMyMembership(LYON)).result.current).membership).toBeNull()
  })
})

describe("démonstration — mes associations, pagination et persistance", () => {
  it("mes seules lignes, les plus récentes d'abord", async () => {
    const { clock, associations } = setup({ viewer: "p-nadia" })
    const mine = renderHook(() => associations.useMyAssociations({ cursor: null }))
    expect(ready(mine.result.current).items).toEqual([{
      membershipId: "assoc-1", status: "accepted", role: "animator", decisionReason: null, statusChangedAt: NOW - 60 * DAY_MS,
      page: { id: LYON, handle: "collectif-ivindo-lyon", name: "Collectif Ivindo de Lyon (démo)" },
    }])
    clock.now = NOW + 1000
    await act(async () => { await associations.leave(LYON) })
    expect(ready(mine.result.current).items[0]).toMatchObject({ status: "left", statusChangedAt: NOW + 1000 })
  })

  it("une fenêtre de vingt, un curseur opaque validé, une liste d'un autre écran refusée", () => {
    const rows: DemoAssociationRow[] = Array.from({ length: 25 }, (_, index) => ({
      id: `assoc-${100 + index}`, pageId: LYON, personId: "p-nadia", status: "requested", role: "member", requestMessage: null, decisionReason: null,
      requestedAt: NOW - index, statusChangedAt: NOW - 100 + index, decidedAt: null, decidedById: null, readmissionAllowedAt: null, version: 1,
    }))
    const storage = memoryStorage(JSON.stringify({ seedCreatedAt: NOW, sequence: 200, rows }))
    const { associations } = setup({ viewer: "p-steeve", storage })
    const list = members(associations, { pageId: LYON, status: "requested", cursor: null })
    const first = ready(list.result.current)
    expect(first.items).toHaveLength(20)
    expect(first.items[0]!.membershipId).toBe("assoc-100")
    expect(first.isDone).toBe(false)
    list.rerender({ pageId: LYON, status: "requested", cursor: first.continueCursor })
    expect(ready(list.result.current)).toMatchObject({ isDone: true, continueCursor: null })
    expect(ready(list.result.current).items.map((item) => item.membershipId)).toEqual(["assoc-120", "assoc-121", "assoc-122", "assoc-123", "assoc-124"])
    list.rerender({ pageId: LYON, status: "accepted", cursor: first.continueCursor })
    expect(list.result.current).toEqual({ status: "error", code: "unknown" })
    list.rerender({ pageId: LYON, status: "requested", cursor: "{pas du json" })
    expect(list.result.current).toEqual({ status: "error", code: "unknown" })
    list.rerender({ pageId: LYON, status: "requested", cursor: JSON.stringify(["demo-associations", `${LYON}:requested`, -1]) })
    expect(list.result.current).toEqual({ status: "error", code: "unknown" })
  })

  it("le registre est relu pour le même jeu fictif, et oublié après une remise à zéro", async () => {
    const storage = memoryStorage()
    const first = setup({ storage })
    await first.associations.request({ pageId: LYON, message: "Bonjour" })
    expect(JSON.parse(storage.items.get(DEMO_ASSOCIATIONS_STORAGE_KEY)!).rows).toHaveLength(4)

    const again = setup({ storage })
    expect(ready(renderHook(() => again.associations.useMyMembership(LYON)).result.current).membership?.status).toBe("requested")

    again.clock.now = NOW + DAY_MS
    await again.store.reset()
    await again.store.switchTo("p-prisca")
    expect(ready(renderHook(() => again.associations.useMyMembership(LYON)).result.current).membership).toBeNull()

    const broken = setup({ storage: memoryStorage("{illisible") })
    expect(ready(renderHook(() => broken.associations.useMyMembership(LYON)).result.current).membership).toBeNull()
    const blocked = createDemoAssociations(first.store, {
      storage: { getItem: () => { throw new Error("bloqué") }, setItem: () => { throw new Error("plein") } },
      latencyMs: 0,
    })
    // Stockage illisible et plein : le jeu fictif repart en mémoire, l'écriture aboutit quand même.
    expect(await blocked.request({ pageId: LYON, message: "" })).toEqual({ ok: true, value: null })
  })
})
