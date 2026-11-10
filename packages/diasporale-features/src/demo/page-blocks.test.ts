import { DAY_MS } from "@diasporale/domain"
import { describe, expect, it } from "vitest"

import type { SendServiceRequestInput } from "../data/service-requests-port"
import { createDemoAssociations } from "./associations"
import { createDemoJobs } from "./jobs"
import { createDemoMutualAid } from "./mutual-aid"
import { isPageClosedByBlocks } from "./selectors"
import { createDemoServiceRequests } from "./service-requests"
import type { DemoOfferRef } from "./services"
import { createDemoSeed, type DemoBlock, type DemoState } from "./state"
import { DemoStore } from "./store"

/**
 * RP-03 (décision 5 du plan 05), en démonstration : la règle de la tranche
 * (`isPageClosedByBlocks`) appliquée par chaque demande adressée à une page —
 * demande de service, accord, adhésion, candidature, inscription à une mission.
 * Matrice : docs/40 de DIASPORALE.
 */
const NOW = Date.UTC(2026, 9, 18, 9)
const HOUR = 60 * 60 * 1000
const LYON = "page-asso-lyon"

function blockOf(byId: string, targetId: string): DemoBlock {
  return { id: `bl-${byId}-${targetId}`, byId, targetId, createdAt: NOW }
}

/** Un magasin principal tenu en main, la session donnée, et des blocages de départ. */
function storeWith(viewer: string, blocks: readonly DemoBlock[] = []) {
  const state: DemoState = { ...createDemoSeed(NOW), session: { personId: viewer }, blocks }
  return new DemoStore({ getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }, () => NOW, 0)
}

const OFFER: DemoOfferRef = { id: "offre-coiffure", title: "Tresses (démo)", version: 2, status: "active", pageId: "page-saveurs", pageHandle: "saveurs-okoume-demo", pageName: "Saveurs d'Okoumé (démo)" }

function sendInput(idempotencyKey = "2b4a7a0e-6a52-4c8e-9a52-7f1f0b6c2d11"): SendServiceRequestInput {
  return {
    offerId: OFFER.id, offerVersion: 2, need: "Tresses africaines pour un mariage, cheveux mi-longs.",
    windows: [{ startAt: NOW + DAY_MS, endAt: NOW + DAY_MS + 4 * HOUR }], timeZone: "Europe/Paris", shareIdentityWithPage: true, idempotencyKey,
  }
}

function requests(store: DemoStore, team: readonly string[] = ["p-mireille"]) {
  return createDemoServiceRequests(store, { findOffer: (id) => (id === OFFER.id ? OFFER : null), signatoriesOf: () => team, storage: null })
}

describe("RP-03 en démonstration — une page dont toute l'équipe vivante a bloqué la personne", () => {
  it("la règle : au moins un signataire vivant, tous en blocage, dans un sens ou dans l'autre ; jamais la personne elle-même", () => {
    const state: DemoState = { ...createDemoSeed(NOW), blocks: [blockOf("p-mireille", "p-prisca"), blockOf("p-prisca", "p-steeve")] }
    expect(isPageClosedByBlocks(state, ["p-mireille"], "p-prisca")).toBe(true)
    expect(isPageClosedByBlocks(state, ["p-mireille", "p-steeve"], "p-prisca")).toBe(true)
    expect(isPageClosedByBlocks(state, ["p-mireille", "p-nadia"], "p-prisca")).toBe(false)
    expect(isPageClosedByBlocks(state, [], "p-prisca")).toBe(false)
    expect(isPageClosedByBlocks(state, ["p-prisca", "p-mireille"], "p-prisca")).toBe(false)
  })

  it("demande de service : refus indistinct ; avec un second signataire hors blocage, elle passe", async () => {
    expect(await requests(storeWith("p-prisca", [blockOf("p-mireille", "p-prisca")])).send(sendInput())).toEqual({ ok: false, code: "not_found" })
    expect(await requests(storeWith("p-prisca", [blockOf("p-mireille", "p-prisca")]), ["p-mireille", "p-steeve"]).send(sendInput()))
      .toEqual({ ok: true, value: { requestId: expect.any(String), created: true } })
  })

  it("accord sur une proposition : refusé indistinctement après le blocage", async () => {
    const store = storeWith("p-prisca")
    const capability = requests(store)
    const sent = await capability.send(sendInput())
    if (!sent.ok) throw new Error(`envoi refusé : ${sent.code}`)
    await store.switchTo("p-mireille")
    const proposed = await capability.propose({
      requestId: sent.value.requestId, expectedVersion: 0, amountMinor: 4500, currency: "EUR", durationMinutes: 90, startAt: NOW + DAY_MS + HOUR,
      timeZone: "Europe/Paris", location: { mode: "onsite", area: "Paris 11e" }, details: "Tresses, mèches fournies.",
      cancellationTerms: "Annulation libre jusqu'à la veille.", expiresAt: NOW + 12 * HOUR,
    })
    expect(proposed.ok).toBe(true)
    expect(await store.block("p-prisca")).toEqual({ ok: true, value: null })
    await store.switchTo("p-prisca")
    expect(await capability.accept({ requestId: sent.value.requestId, expectedProposalVersion: 1 })).toEqual({ ok: false, code: "not_found" })
  })

  it("demande d'adhésion : l'association dont le seul responsable vivant a bloqué la personne se tait", async () => {
    const closed = createDemoAssociations(storeWith("p-prisca", [blockOf("p-steeve", "p-prisca")]), { storage: null, latencyMs: 0 })
    expect(await closed.request({ pageId: LYON, message: "Bonjour, je souhaite rejoindre votre association." })).toEqual({ ok: false, code: "not_found" })
    const open = createDemoAssociations(storeWith("p-prisca"), { storage: null, latencyMs: 0 })
    expect(await open.request({ pageId: LYON, message: "Bonjour, je souhaite rejoindre votre association." })).toMatchObject({ ok: true })
  })

  it("candidature : l'offre d'une page dont toute l'équipe a bloqué la personne se tait", async () => {
    const teams = { "page-saveurs": ["p-mireille"] }
    const apply = { jobId: "job-demo-cuisine", offerVersion: 1, message: "Candidature fictive de recette, motivée et sans coordonnée.", shareName: true, shareTalentProfile: false, idempotencyKey: "candidature-recette-0001" }
    expect(await createDemoJobs(storeWith("p-rodrigue", [blockOf("p-mireille", "p-rodrigue")]), { storage: null, teams }).apply(apply)).toEqual({ ok: false, code: "not_found" })
    expect(await createDemoJobs(storeWith("p-rodrigue"), { storage: null, teams }).apply(apply)).toMatchObject({ ok: true })
  })

  it("inscription à une mission : refus indistinct quand toute l'équipe vivante a bloqué la personne", async () => {
    const store = storeWith("p-steeve", [blockOf("p-steeve", "p-prisca")])
    const aid = createDemoMutualAid(store, { storage: null, latencyMs: 0 })
    const created = await aid.createMission({
      title: "Tenir le stand d'accueil du forum", description: "Accueillir et orienter les visiteurs du forum des associations. (Mission fictive.)",
      country: "FR", city: "Lyon", area: "", startsAt: NOW + 5 * DAY_MS, endsAt: null, timeZone: "Europe/Paris", places: 2, pageId: LYON,
    })
    if (!created.ok) throw new Error(`mission refusée : ${created.code}`)
    await store.switchTo("p-prisca")
    expect(await aid.signUp({ missionId: created.value.missionId, shareNameWithTeam: true })).toEqual({ ok: false, code: "not_found" })
    await store.switchTo("p-nadia")
    expect(await aid.signUp({ missionId: created.value.missionId, shareNameWithTeam: true })).toEqual({ ok: true, value: null })
  })
})
