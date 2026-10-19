import { DAY_MS, LIGHT_ACCOUNT_GROUNDS } from "@diasporale/domain"
import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { AidItemView, MutualAidCapability } from "../data/mutual-aid-port"
import { createDemoMutualAid, DEMO_MUTUAL_AID_STORAGE_KEY, demoMutualAidSeed } from "./mutual-aid"
import { createDemoSeed, type DemoState } from "./state"
import { DemoStore } from "./store"

/**
 * La démonstration de l'entraide joue les mêmes règles que le moteur : questions
 * par pays et ville saisie, réponse retenue par l'autrice seule, missions de
 * l'équipe VIVANTE de l'association, inscriptions consenties et places relues —
 * sur le jeu fictif, sans latence.
 */
const NOW = Date.UTC(2026, 9, 18, 9)
const LYON = "page-asso-lyon"

function memoryStorage() {
  const items = new Map<string, string>()
  return { items, getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) }
}

function setup(options: { viewer?: string | null; state?: (seed: DemoState) => DemoState; storage?: ReturnType<typeof memoryStorage> } = {}) {
  const clock = { now: NOW }
  const seed = { ...createDemoSeed(NOW), session: { personId: options.viewer === undefined ? "p-steeve" : options.viewer } }
  const state = options.state ? options.state(seed) : seed
  const store = new DemoStore({ getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }, () => clock.now, 0)
  const storage = options.storage ?? memoryStorage()
  const aid = createDemoMutualAid(store, { storage, latencyMs: 0 })
  return { clock, store, storage, aid }
}

function ready<T>(loadable: { status: string; data?: T }): T {
  if (loadable.status !== "ready") throw new Error(`Lecture non prête : ${JSON.stringify(loadable)}`)
  return loadable.data as T
}

function item(aid: MutualAidCapability, itemId: string): AidItemView | null {
  return ready(renderHook(() => aid.useItem(itemId)).result.current)
}

function questionOf(aid: MutualAidCapability, itemId: string) {
  const found = item(aid, itemId)
  if (found?.kind !== "question") throw new Error("Question fictive introuvable")
  return found.question
}

function missionOf(aid: MutualAidCapability, itemId: string) {
  const found = item(aid, itemId)
  if (found?.kind !== "mission") throw new Error("Mission fictive introuvable")
  return found.mission
}

const QUESTION = { title: "Ouvrir un compte bancaire en arrivant", detail: "", theme: "procedures" as const, country: "FR" as const, city: "Bordeaux" }
const MISSION = {
  title: "Tenir le stand d'accueil du forum", description: "Accueillir et orienter les visiteurs du forum des associations. (Mission fictive.)",
  country: "FR" as const, city: "Lyon", area: "", startsAt: NOW + 5 * DAY_MS, endsAt: null, timeZone: "Europe/Paris", places: 1,
}

describe("démonstration — le jeu fictif de l'entraide", () => {
  it("chaque question a été posée, chaque inscription consentie ; la mission complète l'est vraiment", () => {
    const seed = demoMutualAidSeed(NOW)
    expect(seed.questions.map((question) => [question.id, question.status])).toEqual([["aid-q-1", "resolved"], ["aid-q-2", "open"], ["aid-q-3", "open"], ["aid-q-4", "closed"]])
    for (const question of seed.questions) {
      expect(question.answerCount).toBe(seed.answers.filter((answer) => answer.questionId === question.id && answer.status === "published").length)
    }
    for (const mission of seed.missions) {
      expect(mission.signupCount).toBe(seed.signups.filter((signup) => signup.missionId === mission.id && signup.status === "confirmed").length)
      expect(mission.signupCount).toBeLessThanOrEqual(mission.places)
    }
    for (const signup of seed.signups) expect(signup.nameConsentAt).toBeLessThanOrEqual(signup.signedUpAt)
  })

  it("les questions d'un pays, par état et par ville saisie ; la réponse retenue se lit", () => {
    const { aid } = setup()
    const ids = (request: Parameters<MutualAidCapability["useQuestions"]>[0]) => ready(renderHook(() => aid.useQuestions(request)).result.current).items.map((row) => row.id)
    expect(ids({ country: "FR", status: "open", cursor: null })).toEqual(["aid-q-2"])
    expect(ids({ country: "FR", status: "resolved", cursor: null })).toEqual(["aid-q-1"])
    expect(ids({ country: "FR", status: "closed", cursor: null })).toEqual(["aid-q-4"])
    expect(ids({ country: "CA", status: "open", cursor: null })).toEqual(["aid-q-3"])
    expect(ids({ country: "FR", city: " PARIS ", status: "open", cursor: null })).toEqual(["aid-q-2"])
    expect(ids({ country: "FR", city: "Lyon", status: "open", cursor: null })).toEqual([])
    expect(renderHook(() => aid.useQuestions({ country: "GA", status: "open", cursor: null })).result.current).toEqual({ status: "error", code: "aid_country_is_home" })

    const resolved = questionOf(aid, "aid-q-1")
    expect(resolved).toMatchObject({ status: "resolved", hasAcceptedAnswer: true, canAnswer: true, canEdit: false, author: { displayName: "Prisca ABANGA", handle: "prisca.abanga" } })
    expect(resolved.acceptedAnswer).toMatchObject({ id: "aid-a-1", isAccepted: true, author: { displayName: "Mireille IVINDO" } })
    const answers = ready(renderHook(() => aid.useAnswers({ questionId: "aid-q-1", cursor: null })).result.current)
    expect(answers.items.map((answer) => [answer.id, answer.isAccepted, answer.isMine])).toEqual([["aid-a-1", true, false], ["aid-a-2", false, true]])
    expect(questionOf(aid, "aid-q-4")).toMatchObject({ status: "closed", canAnswer: false })
    expect(item(aid, "inconnue")).toBeNull()
  })

  it("les missions à venir de Lyon, les pages de l'équipe vivante, ses bénévoles", () => {
    const { aid } = setup()
    const upcoming = ready(renderHook(() => aid.useMissions({ country: "FR", from: 0, cursor: null })).result.current)
    // Seule la mission ouverte : la complète et la close quittent la liste.
    expect(upcoming.items.map((mission) => [mission.id, mission.status, mission.page.handle])).toEqual([["aid-m-1", "open", "collectif-ivindo-lyon"]])
    expect(ready(renderHook(() => aid.useMissions({ country: "FR", city: "Marseille", from: 0, cursor: null })).result.current).items).toEqual([])
    expect(ready(renderHook(() => aid.useMissionPages()).result.current)).toEqual([{ id: LYON, handle: "collectif-ivindo-lyon", name: "Collectif Ivindo de Lyon (démo)", country: "FR", city: "Lyon" }])
    const volunteers = ready(renderHook(() => aid.useVolunteers({ missionId: "aid-m-1", cursor: null })).result.current)
    expect(volunteers.items.map((row) => row.person.displayName)).toEqual(["Mireille IVINDO", "Clarisse MBÉI"])
    expect(missionOf(aid, "aid-m-2")).toMatchObject({ status: "full", canManage: true, signup: { allowed: false, refusal: "aid_mission_full" } })
    const team = ready(renderHook(() => aid.usePageMissions({ pageId: LYON, cursor: null })).result.current)
    expect(team.items.map((mission) => mission.id)).toEqual(["aid-m-3", "aid-m-2", "aid-m-1"])

    // L'invitation de Mireille n'est pas acceptée : ni page à proposer, ni liste de bénévoles.
    const invited = setup({ viewer: "p-mireille" }).aid
    expect(ready(renderHook(() => invited.useMissionPages()).result.current)).toEqual([])
    expect(renderHook(() => invited.useVolunteers({ missionId: "aid-m-1", cursor: null })).result.current).toEqual({ status: "error", code: "not_found" })
    expect(renderHook(() => invited.usePageMissions({ pageId: LYON, cursor: null })).result.current).toEqual({ status: "error", code: "not_found" })
    expect(ready(renderHook(() => invited.useMySignups({ cursor: null })).result.current).items.map((mission) => mission.id)).toEqual(["aid-m-1"])
  })

  it("ne modère jamais : aucune vue, celles de gestion comprises, ne porte d'état de modération", () => {
    // Steeve a posé aid-q-4, écrit aid-a-2 et gère l'association de Lyon : toutes ses vues de gestion.
    const { aid } = setup({ viewer: "p-steeve" })
    const views = [
      ...ready(renderHook(() => aid.useMyQuestions({ cursor: null })).result.current).items,
      ...ready(renderHook(() => aid.useAnswers({ questionId: "aid-q-1", cursor: null })).result.current).items,
      ...ready(renderHook(() => aid.usePageMissions({ pageId: LYON, cursor: null })).result.current).items,
      questionOf(aid, "aid-q-4"),
      missionOf(aid, "aid-m-1"),
    ]
    expect(views).toHaveLength(8)
    for (const view of views) expect(view).not.toHaveProperty("moderation")
  })
})

describe("démonstration — questions, réponses et réponse retenue", () => {
  it("poser, répondre, retenir par l'autrice seule, ne plus retenir", async () => {
    const { store, aid } = setup({ viewer: "p-prisca" })
    expect(await aid.askQuestion({ ...QUESTION, detail: "Appelez-moi au 06 12 34 56 78" })).toEqual({ ok: false, code: "aid_contact_forbidden" })
    expect(await aid.askQuestion({ ...QUESTION, country: "GA" as never })).toEqual({ ok: false, code: "aid_country_is_home" })
    expect(await aid.askQuestion(QUESTION)).toEqual({ ok: true, value: { questionId: "aid-q-20" } })
    expect(questionOf(aid, "aid-q-20")).toMatchObject({ status: "open", version: 1, isMine: true, canEdit: true, city: "Bordeaux" })

    await store.switchTo("p-steeve")
    expect(await aid.answer({ questionId: "aid-q-20", body: "Écris-moi : moi@exemple.fr" })).toEqual({ ok: false, code: "aid_contact_forbidden" })
    expect(await aid.answer({ questionId: "aid-q-20", body: "Une banque en ligne accepte une attestation d'hébergement. (Réponse fictive.)" })).toEqual({ ok: true, value: { answerId: "aid-a-21" } })
    expect(await aid.acceptAnswer({ questionId: "aid-q-20", answerId: "aid-a-21", expectedVersion: 1 })).toEqual({ ok: false, code: "aid_not_author" })

    await store.switchTo("p-prisca")
    expect(questionOf(aid, "aid-q-20").answerCount).toBe(1)
    expect(await aid.acceptAnswer({ questionId: "aid-q-20", answerId: "aid-a-1", expectedVersion: 1 })).toEqual({ ok: false, code: "aid_answer_unavailable" })
    expect(await aid.acceptAnswer({ questionId: "aid-q-20", answerId: "aid-a-21", expectedVersion: 1 })).toEqual({ ok: true, value: null })
    expect(questionOf(aid, "aid-q-20")).toMatchObject({ status: "resolved", version: 2, acceptedAnswer: { id: "aid-a-21" } })
    expect(await aid.acceptAnswer({ questionId: "aid-q-20", answerId: "aid-a-21", expectedVersion: 1 })).toEqual({ ok: false, code: "aid_version_conflict" })
    expect(await aid.unacceptAnswer({ questionId: "aid-q-20", expectedVersion: 2 })).toEqual({ ok: true, value: null })
    expect(questionOf(aid, "aid-q-20")).toMatchObject({ status: "open", version: 3, acceptedAnswer: null })
    expect(await aid.unacceptAnswer({ questionId: "aid-q-20", expectedVersion: 3 })).toEqual({ ok: false, code: "aid_question_not_resolved" })
  })

  it("modifier, clore, retirer sa question ; la réponse retenue retirée rouvre la question", async () => {
    const { store, aid, storage } = setup({ viewer: "p-steeve" })
    // Steeve a écrit la réponse aid-a-2, non retenue : il la modifie puis la retire.
    expect(await aid.updateAnswer({ answerId: "aid-a-2", expectedVersion: 1, body: "Demandez la liste des résidences au service logement. (Réponse fictive.)" })).toEqual({ ok: true, value: null })
    expect(await aid.updateAnswer({ answerId: "aid-a-1", expectedVersion: 1, body: "Réécriture par un tiers." })).toEqual({ ok: false, code: "aid_not_author" })
    expect(await aid.withdrawAnswer({ answerId: "aid-a-2", expectedVersion: 2 })).toEqual({ ok: true, value: null })
    expect(questionOf(aid, "aid-q-1").answerCount).toBe(1)

    await store.switchTo("p-mireille")
    expect(await aid.updateAnswer({ answerId: "aid-a-1", expectedVersion: 1, body: "Texte changé après coup." })).toEqual({ ok: false, code: "aid_answer_locked" })
    expect(await aid.withdrawAnswer({ answerId: "aid-a-1", expectedVersion: 1 })).toEqual({ ok: true, value: null })
    expect(questionOf(aid, "aid-q-1")).toMatchObject({ status: "open", acceptedAnswer: null, answerCount: 0, version: 2 })

    await store.switchTo("p-prisca")
    const edit = { questionId: "aid-q-1", title: "Trouver une colocation à Talence", detail: "", theme: "housing" as const, city: "" }
    expect(await aid.updateQuestion({ ...edit, expectedVersion: 1 })).toEqual({ ok: false, code: "aid_version_conflict" })
    expect(await aid.updateQuestion({ ...edit, expectedVersion: 2 })).toEqual({ ok: true, value: null })
    expect(questionOf(aid, "aid-q-1")).toMatchObject({ title: "Trouver une colocation à Talence", city: null, version: 3 })
    expect(await aid.closeQuestion({ questionId: "aid-q-1", expectedVersion: 3 })).toEqual({ ok: true, value: null })
    expect(await aid.answer({ questionId: "aid-q-1", body: "Une réponse tardive." })).toEqual({ ok: false, code: "aid_question_closed" })
    expect(await aid.withdrawQuestion({ questionId: "aid-q-1", expectedVersion: 4 })).toEqual({ ok: true, value: null })
    expect(item(aid, "aid-q-1")).toBeNull()
    expect(ready(renderHook(() => aid.useMyQuestions({ cursor: null })).result.current).items).toEqual([])
    // Le registre se garde dans ce navigateur, à côté du jeu fictif.
    expect(storage.items.has(DEMO_MUTUAL_AID_STORAGE_KEY)).toBe(true)
  })
})

describe("démonstration — missions et inscriptions", () => {
  it("proposer au nom de l'association ; une entreprise ou une page non gérée est refusée", async () => {
    const { store, aid } = setup({ viewer: "p-steeve" })
    expect(await aid.createMission({ ...MISSION, pageId: LYON, startsAt: NOW - 1 })).toEqual({ ok: false, code: "aid_mission_start_past" })
    expect(await aid.createMission({ ...MISSION, pageId: LYON, area: "Au 5 rue de la République" })).toEqual({ ok: false, code: "aid_address_forbidden" })
    expect(await aid.createMission({ ...MISSION, pageId: LYON })).toEqual({ ok: true, value: { missionId: "aid-m-20" } })
    expect(await aid.createMission({ ...MISSION, pageId: "page-saveurs" })).toEqual({ ok: false, code: "not_found" })
    await store.switchTo("p-mireille")
    expect(await aid.createMission({ ...MISSION, pageId: "page-saveurs" })).toEqual({ ok: false, code: "aid_page_kind_not_allowed" })
    expect(await aid.createMission({ ...MISSION, pageId: LYON })).toEqual({ ok: false, code: "not_found" })
  })

  it("s'inscrire avec consentement, une fois ; complète ; un retrait rouvre la place ; l'équipe lit ses bénévoles", async () => {
    const { store, aid } = setup({ viewer: "p-steeve" })
    await aid.createMission({ ...MISSION, pageId: LYON })
    await store.switchTo("p-prisca")
    expect(await aid.signUp({ missionId: "aid-m-20", shareNameWithTeam: false })).toEqual({ ok: false, code: "aid_signup_consent_required" })
    expect(await aid.signUp({ missionId: "aid-m-20", shareNameWithTeam: true })).toEqual({ ok: true, value: null })
    expect(await aid.signUp({ missionId: "aid-m-20", shareNameWithTeam: true })).toEqual({ ok: false, code: "aid_signup_exists" })
    expect(missionOf(aid, "aid-m-20")).toMatchObject({ status: "full", signupCount: 1, signedUp: true })

    await store.switchTo("p-nadia")
    expect(await aid.signUp({ missionId: "aid-m-20", shareNameWithTeam: true })).toEqual({ ok: false, code: "aid_mission_full" })
    await store.switchTo("p-prisca")
    expect(await aid.withdrawSignup("aid-m-20")).toEqual({ ok: true, value: null })
    expect(await aid.withdrawSignup("aid-m-20")).toEqual({ ok: false, code: "aid_signup_missing" })
    await store.switchTo("p-nadia")
    expect(await aid.signUp({ missionId: "aid-m-20", shareNameWithTeam: true })).toEqual({ ok: true, value: null })

    await store.switchTo("p-steeve")
    expect(ready(renderHook(() => aid.useVolunteers({ missionId: "aid-m-20", cursor: null })).result.current).items.map((row) => row.person.displayName)).toEqual(["Nadia MPASSA"])
    const mission = missionOf(aid, "aid-m-20")
    expect(await aid.updateMission({ ...MISSION, places: 0, missionId: "aid-m-20", expectedVersion: mission.version })).toEqual({ ok: false, code: "aid_mission_places_invalid" })
    expect(await aid.updateMission({ ...MISSION, places: 3, missionId: "aid-m-20", expectedVersion: mission.version })).toEqual({ ok: true, value: null })
    expect(missionOf(aid, "aid-m-20")).toMatchObject({ status: "open", places: 3, version: 2 })
    expect(await aid.closeMission({ missionId: "aid-m-20", expectedVersion: 2 })).toEqual({ ok: true, value: null })
    expect(await aid.cancelMission({ missionId: "aid-m-20", expectedVersion: 3, reason: " Salle indisponible " })).toEqual({ ok: true, value: null })
    expect(missionOf(aid, "aid-m-20")).toMatchObject({ status: "cancelled", cancelReason: "Salle indisponible" })
    expect(await aid.closeMission({ missionId: "aid-m-20", expectedVersion: 4 })).toEqual({ ok: false, code: "aid_mission_cancelled" })
  })

  it("gardes : sans session, en attente, mission commencée", async () => {
    const anonymous = setup({ viewer: null })
    expect(renderHook(() => anonymous.aid.useQuestions({ country: "FR", status: "open", cursor: null })).result.current).toEqual({ status: "error", code: "not_signed_in" })
    expect(await anonymous.aid.askQuestion(QUESTION)).toEqual({ ok: false, code: "not_signed_in" })

    const light = setup({
      viewer: "p-rodrigue",
      state: (seed) => ({ ...seed, memberships: { ...seed.memberships, "p-rodrigue": { ...seed.memberships["p-rodrigue"]!, grounds: LIGHT_ACCOUNT_GROUNDS } } }),
    })
    expect(ready(renderHook(() => light.aid.useQuestions({ country: "CA", status: "open", cursor: null })).result.current).items.map((row) => row.id)).toEqual(["aid-q-3"])
    expect(questionOf(light.aid, "aid-q-3")).toMatchObject({ canAnswer: false, canEdit: false, isMine: true })
    expect(missionOf(light.aid, "aid-m-1").signup).toEqual({ allowed: false, refusal: "status_insufficient" })
    expect(await light.aid.askQuestion(QUESTION)).toEqual({ ok: false, code: "status_insufficient" })
    expect(await light.aid.signUp({ missionId: "aid-m-1", shareNameWithTeam: true })).toEqual({ ok: false, code: "status_insufficient" })
    // Retirer sa propre question reste possible en attente.
    expect(await light.aid.withdrawQuestion({ questionId: "aid-q-3", expectedVersion: 1 })).toEqual({ ok: true, value: null })

    const started = setup({ viewer: "p-prisca" })
    started.clock.now = NOW + 13 * DAY_MS
    expect(await started.aid.signUp({ missionId: "aid-m-1", shareNameWithTeam: true })).toEqual({ ok: false, code: "aid_mission_started" })
    expect(ready(renderHook(() => started.aid.useMissions({ country: "FR", from: 0, cursor: null })).result.current).items).toEqual([])
    await started.store.switchTo("p-mireille")
    expect(await started.aid.withdrawSignup("aid-m-1")).toEqual({ ok: false, code: "aid_mission_started" })
  })
})
