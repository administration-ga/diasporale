import { DAY_MS, LIGHT_ACCOUNT_GROUNDS } from "@diasporale/domain"
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { ArrivalKitListRequest, ArrivalKitResourceInputView } from "../data/arrival-kit-port"
import { createDemoArrivalKit, DEMO_ARRIVAL_KIT_STORAGE_KEY, demoArrivalKitSeed } from "./arrival-kit"
import { createDemoSeed, type DemoState } from "./state"
import { DemoStore } from "./store"

/**
 * La démonstration du kit d'arrivée joue les mêmes règles que le moteur : relecture par
 * une autre personne habilitée, ancienneté et signalements → « à revoir », signalement
 * unique par version, versions attendues, retrait terminal, refus indistinct — sur le
 * jeu fictif (Paris, Lyon, Montréal), sans latence.
 */
const NOW = Date.UTC(2026, 9, 18, 9)

function memoryStorage(initial?: string) {
  const items = new Map<string, string>()
  if (initial) items.set(DEMO_ARRIVAL_KIT_STORAGE_KEY, initial)
  return { items, getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) }
}

function setup(options: { viewer?: string | null; state?: (seed: DemoState) => DemoState; storage?: ReturnType<typeof memoryStorage>; latencyMs?: number } = {}) {
  const seed = createDemoSeed(NOW)
  const base: DemoState = { ...seed, session: { personId: options.viewer === undefined ? "p-prisca" : options.viewer } }
  const state = options.state ? options.state(base) : base
  const store = new DemoStore({ getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }, () => NOW, 0)
  const storage = options.storage ?? memoryStorage()
  const kit = createDemoArrivalKit(store, { storage, latencyMs: options.latencyMs ?? 0 })
  return { store, storage, kit }
}

function ready<T>(loadable: { status: string; data?: T }): T {
  if (loadable.status !== "ready") throw new Error(`Lecture non prête : ${JSON.stringify(loadable)}`)
  return loadable.data as T
}

const request = (overrides: Partial<ArrivalKitListRequest> = {}): ArrivalKitListRequest => ({
  country: "FR", city: null, nationalOnly: false, category: null, cursor: null, ...overrides,
})

/** Une ressource fictive complète et valide pour Montréal. */
const INPUT: ArrivalKitResourceInputView = {
  title: "Ouvrir un compte bancaire à Montréal (démo)",
  summary: "Les pièces demandées et les délais constatés pour un premier compte.",
  body: "Exemple de démonstration : prenez rendez-vous avec une pièce d'identité et votre permis d'études ou de travail. Ces indications sont fictives.",
  category: "banking",
  country: "CA",
  city: "Montréal",
  sourceName: "Portail public d'information bancaire (source fictive)",
  sourceUrl: "https://www.exemple-public.ca/compte?utm_campaign=accueil",
  lastVerifiedAt: NOW - 2 * DAY_MS,
}

function ids(page: { items: readonly { id: string }[] }) {
  return page.items.map((item) => item.id)
}

describe("démonstration — le jeu fictif du kit d'arrivée", () => {
  it("couvre Paris, Lyon et Montréal ; tout est marqué démonstration, aucune source n'a d'adresse, chaque relecture est celle d'une autre personne", () => {
    const seed = demoArrivalKitSeed(NOW)
    expect([...new Set(seed.resources.flatMap((row) => (row.city === null ? [] : [row.city])))].sort()).toEqual(["Bordeaux", "Lyon", "Montréal", "Paris"])
    for (const row of seed.resources) {
      expect(row.title).toContain("(démo)")
      expect(row.sourceName).toContain("(source fictive)")
      expect(row.sourceUrl).toBeNull()
      if (row.reviewedById !== null) expect([row.authorId, row.proposedById, row.revisedById]).not.toContain(row.reviewedById)
    }
    expect(seed.flags.map((flag) => [flag.resourceId, flag.personId])).toEqual([["kit-4", "p-clarisse"], ["kit-4", "p-rodrigue"]])
  })

  it("le kit de France : les plus récemment vérifiées d'abord ; l'ancienneté se dit ; soumises et brouillons n'y sont pas", () => {
    const { kit } = setup()
    const france = ready(renderHook(() => kit.useResources(request())).result.current)
    expect(france.items.map((item) => [item.id, item.status, item.reviewCause])).toEqual([
      ["kit-8", "published", null],
      ["kit-1", "published", null],
      ["kit-2", "published", null],
      ["kit-4", "published", null],
      ["kit-3", "needs_review", "age"],
    ])
    expect(france).toMatchObject({ isDone: true, continueCursor: null })
    // Seule la page officielle FICTIVE du poste fait dire « officielle » à sa ressource.
    expect(france.items.filter((item) => item.official).map((item) => [item.id, item.carrier])).toEqual([
      ["kit-1", { kind: "page", page: { id: "page-poste-fr", handle: "poste-demo-france", name: "Poste consulaire de démonstration — France", badge: "official", ownerKind: "institution" } }],
    ])
    expect(france.items.find((item) => item.id === "kit-2")?.carrier).toEqual({ kind: "person", person: { displayName: "Mireille IVINDO", handle: "mireille.ivindo" } })
    expect(ids(ready(renderHook(() => kit.useResources(request({ city: " paris " }))).result.current))).toEqual(["kit-2", "kit-3"])
    expect(ids(ready(renderHook(() => kit.useResources(request({ nationalOnly: true }))).result.current))).toEqual(["kit-8", "kit-1"])
    expect(ids(ready(renderHook(() => kit.useResources(request({ category: "health" }))).result.current))).toEqual(["kit-3"])
    const montreal = ready(renderHook(() => kit.useResources(request({ country: "CA", city: "Montreal" }))).result.current)
    expect(montreal.items.map((item) => [item.id, item.status, item.reviewCause])).toEqual([["kit-6", "published", null], ["kit-7", "needs_review", "reviewer"]])
  })

  it("une lecture refusée se dit par un code fermé ; un curseur étranger est refusé", () => {
    const anonymous = setup({ viewer: null }).kit
    expect(renderHook(() => anonymous.useResources(request())).result.current).toEqual({ status: "error", code: "not_signed_in" })
    const { kit } = setup()
    expect(renderHook(() => kit.useResources(request({ country: "GA" as never }))).result.current).toEqual({ status: "error", code: "arrival_kit_country_is_home" })
    expect(renderHook(() => kit.useResources(request({ cursor: "pas-un-curseur" }))).result.current).toEqual({ status: "error", code: "unknown" })
    expect(renderHook(() => kit.useResources(request({ cursor: JSON.stringify(["demo-arrival-kit", "autre", 20]) }))).result.current).toEqual({ status: "error", code: "unknown" })
  })
})

describe("démonstration — fiche, file de relecture et situation", () => {
  it("la fiche : source sans lien, relecteur nommé, droits jugés pour CE lecteur", () => {
    const prisca = setup()
    const detail = ready(renderHook(() => prisca.kit.useResource("kit-2")).result.current)
    expect(detail).toMatchObject({
      id: "kit-2",
      source: { name: "Portail public d'information bancaire (source fictive)", url: null },
      reviewer: { displayName: "Prisca ABANGA", handle: "prisca.abanga" },
      statusReason: null,
      outdatedFlags: 0,
      viewer: { canManage: false, canReview: true, canFlag: true, hasFlagged: false },
    })
    // Un lecteur sans droit de relire ne voit ni motif ni compte de signalements.
    const rodrigue = setup({ viewer: "p-rodrigue" })
    expect(ready(renderHook(() => rodrigue.kit.useResource("kit-2")).result.current)).toMatchObject({ outdatedFlags: null, viewer: { canReview: false, canFlag: true } })
    // Soumise : invisible pour lui, visible pour une relectrice étrangère.
    expect(ready(renderHook(() => rodrigue.kit.useResource("kit-5")).result.current)).toBeNull()
    expect(ready(renderHook(() => prisca.kit.useResource("kit-5")).result.current)).toMatchObject({ status: "submitted", viewer: { canReview: true, canManage: false } })
    expect(ready(renderHook(() => prisca.kit.useResource("kit-inconnu")).result.current)).toBeNull()
    // L'auteur lit ses signalements ; l'équipe de la page gère sans relire.
    const steeve = setup({ viewer: "p-steeve" })
    expect(ready(renderHook(() => steeve.kit.useResource("kit-4")).result.current)).toMatchObject({ outdatedFlags: 2, viewer: { canManage: true, canFlag: false } })
    expect(ready(renderHook(() => steeve.kit.useResource("kit-5")).result.current)).toMatchObject({ viewer: { canManage: true, canReview: false } })
    // Le brouillon renvoyé : son autrice lit le motif, personne d'autre ne le lit.
    expect(ready(renderHook(() => prisca.kit.useResource("kit-9")).result.current)).toMatchObject({ status: "draft", statusReason: expect.stringContaining("motif fictif"), reviewer: null })
    expect(ready(renderHook(() => rodrigue.kit.useResource("kit-9")).result.current)).toBeNull()
  })

  it("l'état de modération : « publiée » pour qui gère (la démonstration ne modère jamais), aucun état pour un autre lecteur", () => {
    const steeve = setup({ viewer: "p-steeve" }).kit
    // L'auteur de la ressource lyonnaise, et l'équipe du collectif qui porte la soumise.
    expect(ready(renderHook(() => steeve.useResource("kit-4")).result.current)?.moderation).toBe("published")
    expect(ready(renderHook(() => steeve.useResource("kit-5")).result.current)?.moderation).toBe("published")
    expect(ready(renderHook(() => steeve.useMyResources({ cursor: null })).result.current).items.map((item) => [item.id, item.moderation])).toEqual([["kit-5", "published"], ["kit-4", "published"]])
    // Un lecteur, ou une relectrice étrangère à la ressource : le champ est absent.
    const rodrigue = setup({ viewer: "p-rodrigue" }).kit
    const prisca = setup().kit
    expect(ready(renderHook(() => rodrigue.useResource("kit-4")).result.current)).not.toHaveProperty("moderation")
    expect(ready(renderHook(() => prisca.useResource("kit-5")).result.current)).not.toHaveProperty("moderation")
  })

  it("la file de relecture : une relectrice habilitée et étrangère ; ni l'équipe de la page, ni un membre sans droit", () => {
    const prisca = setup().kit
    const steeve = setup({ viewer: "p-steeve" }).kit
    const rodrigue = setup({ viewer: "p-rodrigue" }).kit
    expect(ids(ready(renderHook(() => prisca.useReviewQueue({ country: "FR", cursor: null })).result.current))).toEqual(["kit-5"])
    expect(ready(renderHook(() => steeve.useReviewQueue({ country: "FR", cursor: null })).result.current).items).toEqual([])
    expect(renderHook(() => rodrigue.useReviewQueue({ country: "FR", cursor: null })).result.current).toEqual({ status: "error", code: "arrival_kit_reviewer_not_eligible" })
    expect(renderHook(() => prisca.useReviewQueue({ country: "GA" as never, cursor: null })).result.current).toEqual({ status: "error", code: "arrival_kit_country_is_home" })
  })

  it("ma situation : proposer et relire ; les pages au nom desquelles je peux proposer", () => {
    const standingOf = (viewer: string) => {
      const { kit } = setup({ viewer })
      return ready(renderHook(() => kit.useStanding()).result.current)
    }
    expect(standingOf("p-prisca")).toEqual({ canPropose: true, canReview: true, carrierPages: [] })
    expect(standingOf("p-steeve")).toEqual({
      canPropose: true,
      canReview: true,
      carrierPages: [{ id: "page-asso-lyon", handle: "collectif-ivindo-lyon", name: "Collectif Ivindo de Lyon (démo)", badge: "verified", ownerKind: "association" }],
    })
    // Mireille administre une entreprise : elle relit (vérifiée), mais n'y porte aucune ressource.
    expect(standingOf("p-mireille")).toEqual({ canPropose: true, canReview: true, carrierPages: [] })
    expect(standingOf("p-rodrigue")).toEqual({ canPropose: true, canReview: false, carrierPages: [] })
  })
})

describe("démonstration — gestes", () => {
  it("relire : publier à la version lue ; l'équipe de la page ne relit pas, un membre sans droit ne voit rien", async () => {
    const { store, kit } = setup()
    expect(await kit.review({ resourceId: "kit-5", expectedVersion: 0, decision: "publish", reason: "" })).toEqual({ ok: false, code: "arrival_kit_version_conflict" })
    await act(async () => { await store.switchTo("p-steeve") })
    expect(await kit.review({ resourceId: "kit-5", expectedVersion: 1, decision: "publish", reason: "" })).toEqual({ ok: false, code: "arrival_kit_review_own_resource" })
    await act(async () => { await store.switchTo("p-rodrigue") })
    expect(await kit.review({ resourceId: "kit-5", expectedVersion: 1, decision: "publish", reason: "" })).toEqual({ ok: false, code: "not_found" })
    await act(async () => { await store.switchTo("p-prisca") })
    const lyon = renderHook(() => kit.useResources(request({ city: "Lyon" })))
    expect(ids(ready(lyon.result.current))).toEqual(["kit-4"])
    await act(async () => { expect(await kit.review({ resourceId: "kit-5", expectedVersion: 1, decision: "publish", reason: "" })).toEqual({ ok: true, value: null }) })
    expect(ids(ready(lyon.result.current))).toEqual(["kit-5", "kit-4"])
    expect(ready(renderHook(() => kit.useResource("kit-5")).result.current)).toMatchObject({ status: "published", reviewedAt: NOW, reviewer: { handle: "prisca.abanga" }, version: 2 })
  })

  it("renvoyer exige un motif ; le brouillon renvoyé revient à son auteur", async () => {
    const { store, kit } = setup()
    expect(await kit.review({ resourceId: "kit-5", expectedVersion: 1, decision: "return", reason: "court" })).toEqual({ ok: false, code: "arrival_kit_reason_too_short" })
    await act(async () => { expect(await kit.review({ resourceId: "kit-5", expectedVersion: 1, decision: "return", reason: "Précisez les réductions pour les étudiants." })).toEqual({ ok: true, value: null }) })
    // Redevenue un brouillon : la relectrice ne la voit plus ; l'équipe du collectif lit le motif, sans nom de relectrice.
    expect(ready(renderHook(() => kit.useResource("kit-5")).result.current)).toBeNull()
    await act(async () => { await store.switchTo("p-steeve") })
    expect(ready(renderHook(() => kit.useResource("kit-5")).result.current)).toMatchObject({
      status: "draft", statusReason: "Précisez les réductions pour les étudiants.", reviewer: null, version: 2, viewer: { canManage: true },
    })
  })

  it("signaler : une fois par version, jamais la sienne ; au seuil, la ressource se lit « à revoir »", async () => {
    const { store, kit } = setup({ viewer: "p-rodrigue" })
    expect(await kit.flagOutdated({ resourceId: "kit-2", revision: 1, reason: "link_broken" })).toEqual({ ok: true, value: null })
    expect(await kit.flagOutdated({ resourceId: "kit-2", revision: 1, reason: "other" })).toEqual({ ok: false, code: "arrival_kit_already_flagged" })
    expect(await kit.flagOutdated({ resourceId: "kit-2", revision: 2, reason: "other" })).toEqual({ ok: false, code: "arrival_kit_version_conflict" })
    expect(await kit.flagOutdated({ resourceId: "kit-5", revision: 1, reason: "other" })).toEqual({ ok: false, code: "not_found" })
    expect(ready(renderHook(() => kit.useResource("kit-2")).result.current)).toMatchObject({ viewer: { canFlag: false, hasFlagged: true } })
    await act(async () => { await store.switchTo("p-mireille") })
    expect(await kit.flagOutdated({ resourceId: "kit-2", revision: 1, reason: "other" })).toEqual({ ok: false, code: "arrival_kit_flag_own_resource" })
    expect(await kit.flagOutdated({ resourceId: "kit-4", revision: 1, reason: "spam" as never })).toEqual({ ok: false, code: "arrival_kit_outdated_reason_invalid" })
    const lyon = renderHook(() => kit.useResources(request({ city: "Lyon" })))
    await act(async () => { expect(await kit.flagOutdated({ resourceId: "kit-4", revision: 1, reason: "service_closed" })).toEqual({ ok: true, value: null }) })
    expect(ready(lyon.result.current).items.map((item) => [item.id, item.status, item.reviewCause])).toEqual([["kit-4", "needs_review", "flags"]])
  })

  it("proposer : la règle du domaine, en son nom ou au nom d'une page qu'on signe ; jamais au nom d'une entreprise", async () => {
    const { store, kit } = setup({ viewer: "p-rodrigue" })
    expect(await kit.propose({ ...INPUT, sourceUrl: "http://www.exemple-public.ca/compte", pageId: null, submit: true })).toEqual({ ok: false, code: "arrival_kit_source_url_not_https" })
    const mine = renderHook(() => kit.useMyResources({ cursor: null }))
    await act(async () => { expect(await kit.propose({ ...INPUT, pageId: null, submit: true })).toEqual({ ok: true, value: { resourceId: "kit-20" } }) })
    expect(ready(mine.result.current).items.map((item) => [item.id, item.status])).toEqual([["kit-20", "submitted"], ["kit-7", "needs_review"], ["kit-6", "published"]])
    expect(ready(renderHook(() => kit.useResource("kit-20")).result.current)).toMatchObject({
      city: "Montréal",
      source: { url: "https://www.exemple-public.ca/compte" },
      carrier: { kind: "person", person: { handle: "rodrigue.komo" } },
      viewer: { canManage: true, canReview: false },
    })
    // Pas encore relue : absente du kit public.
    expect(ids(ready(renderHook(() => kit.useResources(request({ country: "CA" }))).result.current))).toEqual(["kit-6", "kit-7"])
    expect(await kit.propose({ ...INPUT, pageId: "page-asso-lyon", submit: false })).toEqual({ ok: false, code: "not_found" })

    await act(async () => { await store.switchTo("p-steeve") })
    expect(await kit.propose({ ...INPUT, country: "FR", city: "Lyon", pageId: "page-asso-lyon", submit: false })).toEqual({ ok: true, value: { resourceId: "kit-21" } })
    expect(ready(renderHook(() => kit.useResource("kit-21")).result.current)).toMatchObject({ status: "draft", carrier: { kind: "page", page: { id: "page-asso-lyon" } }, official: false })
    await act(async () => { await store.switchTo("p-mireille") })
    expect(await kit.propose({ ...INPUT, pageId: "page-saveurs", submit: true })).toEqual({ ok: false, code: "arrival_kit_page_kind_not_allowed" })
  })

  it("un membre en attente lit le kit, mais ne propose ni ne signale", async () => {
    const { kit } = setup({
      viewer: "p-rodrigue",
      state: (seed) => ({ ...seed, memberships: { ...seed.memberships, "p-rodrigue": { ...seed.memberships["p-rodrigue"]!, grounds: LIGHT_ACCOUNT_GROUNDS } } }),
    })
    expect(ids(ready(renderHook(() => kit.useResources(request())).result.current))).toContain("kit-2")
    expect(ready(renderHook(() => kit.useStanding()).result.current)).toEqual({ canPropose: false, canReview: false, carrierPages: [] })
    expect(await kit.propose({ ...INPUT, pageId: null, submit: true })).toEqual({ ok: false, code: "status_insufficient" })
    expect(await kit.flagOutdated({ resourceId: "kit-2", revision: 1, reason: "other" })).toEqual({ ok: false, code: "status_insufficient" })
  })

  it("modifier crée une nouvelle version qui repasse par la relecture ; retirer est terminal ; autrui ne touche à rien", async () => {
    const { store, kit } = setup()
    expect(await kit.update({ ...INPUT, resourceId: "kit-9", expectedVersion: 1, submit: true })).toEqual({ ok: false, code: "arrival_kit_version_conflict" })
    await act(async () => { expect(await kit.update({ ...INPUT, country: "FR", city: "Bordeaux", resourceId: "kit-9", expectedVersion: 2, submit: true })).toEqual({ ok: true, value: null }) })
    expect(ready(renderHook(() => kit.useResource("kit-9")).result.current)).toMatchObject({ status: "submitted", version: 3, revision: 2, statusReason: null, submittedAt: NOW })
    await act(async () => { await store.switchTo("p-mireille") })
    expect(await kit.withdraw({ resourceId: "kit-9", expectedVersion: 3 })).toEqual({ ok: false, code: "not_found" })
    await act(async () => { await store.switchTo("p-prisca") })
    await act(async () => { expect(await kit.withdraw({ resourceId: "kit-9", expectedVersion: 3 })).toEqual({ ok: true, value: null }) })
    expect(ready(renderHook(() => kit.useResource("kit-9")).result.current)).toMatchObject({ status: "archived", viewer: { canManage: false } })
    expect(await kit.update({ ...INPUT, resourceId: "kit-9", expectedVersion: 4, submit: false })).toEqual({ ok: false, code: "arrival_kit_archived" })
    expect(await kit.submit({ resourceId: "kit-9", expectedVersion: 4 })).toEqual({ ok: false, code: "arrival_kit_archived" })
  })

  it("soumettre un brouillon tel quel, à la version lue ; marquer « à revoir » avec un motif", async () => {
    const { store, kit } = setup()
    await act(async () => { expect(await kit.submit({ resourceId: "kit-9", expectedVersion: 2 })).toEqual({ ok: true, value: null }) })
    expect(await kit.submit({ resourceId: "kit-9", expectedVersion: 3 })).toEqual({ ok: false, code: "arrival_kit_transition_invalid" })
    expect(await kit.markForReview({ resourceId: "kit-8", expectedVersion: 2, reason: "bref" })).toEqual({ ok: false, code: "arrival_kit_reason_too_short" })
    await act(async () => { expect(await kit.markForReview({ resourceId: "kit-8", expectedVersion: 2, reason: "Vérifier la liste auprès de la source (motif fictif)." })).toEqual({ ok: true, value: null }) })
    expect(ready(renderHook(() => kit.useResource("kit-8")).result.current)).toMatchObject({ status: "needs_review", reviewCause: "reviewer" })
    await act(async () => { await store.switchTo("p-mireille") })
    expect(ready(renderHook(() => kit.useResource("kit-8")).result.current)).toMatchObject({ statusReason: "Vérifier la liste auprès de la source (motif fictif)." })
  })

  it("une écriture appartient à la session qui l'a lancée ; le registre se garde dans ce navigateur et suit le jeu fictif", async () => {
    const storage = memoryStorage()
    const first = setup({ storage, latencyMs: 1 })
    const pending = first.kit.flagOutdated({ resourceId: "kit-2", revision: 1, reason: "other" })
    await first.store.switchTo("p-rodrigue")
    expect(await pending).toEqual({ ok: false, code: "not_signed_in" })

    const second = setup({ storage })
    await act(async () => { expect(await second.kit.review({ resourceId: "kit-5", expectedVersion: 1, decision: "publish", reason: "" })).toEqual({ ok: true, value: null }) })
    expect(storage.items.has(DEMO_ARRIVAL_KIT_STORAGE_KEY)).toBe(true)
    // Relue depuis ce navigateur : la publication est gardée.
    const reloaded = setup({ storage })
    expect(ready(renderHook(() => reloaded.kit.useResource("kit-5")).result.current)).toMatchObject({ status: "published" })
    // Un registre illisible, ou d'un autre jeu fictif, repart du jeu fictif.
    expect(ready(renderHook(() => setup({ storage: memoryStorage("{illisible") }).kit.useResource("kit-5")).result.current)).toMatchObject({ status: "submitted" })
    const stale = JSON.stringify({ ...demoArrivalKitSeed(NOW - DAY_MS), resources: [] })
    expect(ready(renderHook(() => setup({ storage: memoryStorage(stale) }).kit.useResource("kit-5")).result.current)).toMatchObject({ status: "submitted" })
  })
})
