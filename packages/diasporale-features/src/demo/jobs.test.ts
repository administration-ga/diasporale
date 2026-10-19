import { JOB_OFFER_CONTRACTS, LIGHT_ACCOUNT_GROUNDS } from "@diasporale/domain"
import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { JobOfferInputView } from "../data/jobs-port"
import type { Loadable } from "../data/types"
import { JOB_CONTRACTS } from "../data/types"
import { createDemoJobs, createDemoJobsSeed, DEMO_JOBS_STORAGE_KEY } from "./jobs"
import { createDemoSeed, type DemoState } from "./state"
import { DemoStore } from "./store"

/**
 * La démonstration « talents et emploi » applique les règles du domaine dans
 * l'ordre du moteur, sur des offres, candidatures et profils FICTIFS, sans
 * réseau ni latence.
 */
const NOW = Date.UTC(2026, 9, 18, 9)
const DAY = 24 * 60 * 60 * 1000

/** Les équipes de départ de la gestion des pages (miroir de `page-admin.ts`), fixées pour ces tests. */
const TEAMS = { "page-saveurs": ["p-mireille"], "page-asso-lyon": ["p-steeve"], "page-valise": ["p-nadia"] } as const

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map<string, string>(Object.entries(initial))
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

/** Un magasin principal tenu en main : un état de départ (modifiable) et une session. */
function setup(viewer: string | null, change: (state: DemoState) => DemoState = (state) => state, storage: ReturnType<typeof memoryStorage> | null = null) {
  const seed = createDemoSeed(NOW)
  const state = change({ ...seed, session: { personId: viewer } })
  const main = memoryStorage({ "diasporale:demonstration:v1": JSON.stringify(state) })
  const clock = { now: NOW }
  const store = new DemoStore(main, () => clock.now, 0)
  const jobs = createDemoJobs(store, { storage, teams: TEAMS })
  return { store, jobs, clock }
}

function data<T>(loadable: Loadable<T>): T {
  if (loadable.status !== "ready") throw new Error(`Lecture non prête : ${JSON.stringify(loadable)}`)
  return loadable.data
}

const INPUT: JobOfferInputView = {
  title: "Plongeur ou plongeuse (démo)",
  description: "Offre fictive de recette : plonge et rangement de la cuisine, le soir en semaine.",
  contract: "part_time",
  country: "FR",
  city: "Paris",
  workMode: "onsite",
  languages: ["fr"],
  payRange: null,
  closesAt: null,
}

const APPLY = { message: "Candidature fictive de recette, motivée et sans coordonnée.", shareName: true, shareTalentProfile: false, idempotencyKey: "candidature-recette-0001" }

describe("démonstration de l'emploi — offres fictives", () => {
  it("garde la liste des contrats des cartes d'emploi de l'interface", () => {
    expect([...JOB_OFFER_CONTRACTS]).toEqual([...JOB_CONTRACTS])
  })

  it("chaque donnée de départ passe la règle du domaine et se dit fictive", () => {
    const seed = createDemoJobsSeed(NOW)
    expect(seed.offers).toHaveLength(6)
    for (const offer of seed.offers) {
      expect(offer.title).toContain("(démo)")
      expect(offer.createdAt).toBeLessThan(NOW)
      expect(Object.keys(TEAMS)).toContain(offer.pageId)
    }
    expect(seed.talents.map((talent) => talent.personId)).toEqual(["p-prisca", "p-steeve", "p-rodrigue", "p-nadia"])
    for (const talent of seed.talents) expect(talent.title).toContain("(démo)")
    expect(seed.applications.map((application) => [application.candidateId, application.offerId, application.status])).toEqual([
      ["p-steeve", "job-demo-livraison", "sent"],
      ["p-prisca", "job-demo-stage-lyon", "seen"],
    ])
  })

  it("la recherche ne montre que les offres ouvertes, les plus récentes d'abord, sans aucun contact ni identifiant de personne", () => {
    const { jobs } = setup("p-rodrigue")
    const { result } = renderHook(() => jobs.useSearch({ cursor: null }))
    const page = data(result.current)
    expect(page.items.map((item) => item.id)).toEqual(["job-demo-livraison", "job-demo-cuisine", "job-demo-stage-lyon", "job-demo-logistique"])
    expect(page.isDone).toBe(true)
    expect(page.items[0]).toMatchObject({ employer: { handle: "saveurs-okoume-demo", ownerKind: "company", logoUrl: null }, contract: "part_time" })
    expect(JSON.stringify(page)).not.toMatch(/@|p-mireille|p-steeve|p-nadia/)
  })

  it.each([
    [{ city: " PARIS " }, ["job-demo-livraison", "job-demo-cuisine"]],
    [{ country: "BE" as const }, ["job-demo-logistique"]],
    [{ contract: "internship" as const }, ["job-demo-stage-lyon"]],
    [{ workMode: "remote" as const }, ["job-demo-logistique"]],
    [{ query: "communication" }, ["job-demo-stage-lyon"]],
    [{ query: "x" }, ["job-demo-livraison", "job-demo-cuisine", "job-demo-stage-lyon", "job-demo-logistique"]],
  ])("filtre %o", (filters, ids) => {
    const { jobs } = setup("p-rodrigue")
    const { result } = renderHook(() => jobs.useSearch({ ...filters, cursor: null }))
    expect(data(result.current).items.map((item) => item.id)).toEqual(ids)
  })

  it("refuse un filtre illisible et une lecture hors session", () => {
    const { jobs } = setup("p-rodrigue")
    expect(renderHook(() => jobs.useSearch({ city: "x".repeat(81), cursor: null })).result.current).toEqual({ status: "error", code: "job_city_too_long" })
    expect(renderHook(() => jobs.useSearch({ cursor: "ailleurs" })).result.current).toEqual({ status: "error", code: "unknown" })
    const anonymous = setup(null)
    expect(renderHook(() => anonymous.jobs.useSearch({ cursor: null })).result.current).toEqual({ status: "error", code: "not_signed_in" })
  })

  it("la fiche : ouverte pour tous, tous états pour l'équipe, rien pour une offre suspendue lue par un membre", () => {
    const reader = setup("p-rodrigue")
    expect(data(renderHook(() => reader.jobs.useOffer("job-demo-cuisine")).result.current)).toMatchObject({ status: "open", viewerCanManage: false, myApplication: null })
    expect(data(renderHook(() => reader.jobs.useOffer("job-demo-accueil-bxl")).result.current)).toBeNull()
    expect(data(renderHook(() => reader.jobs.useOffer("inconnue")).result.current)).toBeNull()
    const team = setup("p-nadia")
    expect(data(renderHook(() => team.jobs.useOffer("job-demo-accueil-bxl")).result.current)).toMatchObject({ status: "suspended", viewerCanManage: true })
    const steeve = setup("p-steeve")
    expect(data(renderHook(() => steeve.jobs.useOffer("job-demo-livraison")).result.current)).toMatchObject({ myApplication: { id: "application-demo-steeve", status: "sent" } })
  })

  it("l'équipe crée, modifie à la version lue, suspend et clôt ; close est terminale", async () => {
    const { jobs } = setup("p-mireille")
    const created = await jobs.createOffer({ ...INPUT, pageId: "page-saveurs", publish: false })
    expect(created).toEqual({ ok: true, value: { jobId: "job-demo-1", version: 1, status: "draft" } })
    expect(await jobs.createOffer({ ...INPUT, pageId: "page-asso-lyon", publish: true })).toEqual({ ok: false, code: "not_found" })
    expect(await jobs.createOffer({ ...INPUT, description: "Appelez le 06 12 34 56 78 pour la plonge du soir.", pageId: "page-saveurs", publish: true })).toEqual({ ok: false, code: "job_contact_details_forbidden" })
    expect(await jobs.updateOffer({ ...INPUT, title: "Plonge du soir (démo)", jobId: "job-demo-1", expectedVersion: 1 })).toEqual({ ok: true, value: { version: 2 } })
    expect(await jobs.updateOffer({ ...INPUT, jobId: "job-demo-1", expectedVersion: 1 })).toEqual({ ok: false, code: "job_offer_version_conflict" })
    expect(await jobs.setOfferStatus({ jobId: "job-demo-1", expectedVersion: 2, status: "suspended" })).toEqual({ ok: false, code: "job_offer_transition_invalid" })
    expect(await jobs.setOfferStatus({ jobId: "job-demo-1", expectedVersion: 2, status: "open" })).toEqual({ ok: true, value: { status: "open", version: 3 } })
    expect(await jobs.setOfferStatus({ jobId: "job-demo-1", expectedVersion: 1, status: "open" })).toEqual({ ok: true, value: { status: "open", version: 3 } })
    expect(await jobs.setOfferStatus({ jobId: "job-demo-1", expectedVersion: 3, status: "closed" })).toEqual({ ok: true, value: { status: "closed", version: 4 } })
    expect(await jobs.setOfferStatus({ jobId: "job-demo-1", expectedVersion: 4, status: "open" })).toEqual({ ok: false, code: "job_offer_closed" })
    expect(await jobs.updateOffer({ ...INPUT, jobId: "job-demo-1", expectedVersion: 4 })).toEqual({ ok: false, code: "job_offer_closed" })
    const managed = data(renderHook(() => jobs.usePageOffers({ pageId: "page-saveurs", cursor: null })).result.current)
    expect(managed.items.map((item) => [item.id, item.status])).toEqual([["job-demo-livraison", "open"], ["job-demo-cuisine", "open"], ["job-demo-1", "closed"]])
    expect(data(renderHook(() => jobs.usePageOffers({ pageId: "page-saveurs", status: "closed", cursor: null })).result.current).items.map((item) => item.id)).toEqual(["job-demo-1"])
    expect(renderHook(() => jobs.usePageOffers({ pageId: "page-valise", cursor: null })).result.current).toEqual({ status: "error", code: "not_found" })
  })

  it("une date limite atteinte vaut clôture : hors recherche, close pour l'équipe", async () => {
    const { jobs, clock } = setup("p-mireille")
    await jobs.createOffer({ ...INPUT, pageId: "page-saveurs", publish: true, closesAt: NOW + DAY })
    clock.now = NOW + 2 * DAY
    expect(data(renderHook(() => jobs.useSearch({ cursor: null })).result.current).items.map((item) => item.id)).not.toContain("job-demo-1")
    expect(data(renderHook(() => jobs.useOffer("job-demo-1")).result.current)).toMatchObject({ status: "closed" })
  })
})

describe("démonstration de l'emploi — candidatures privées", () => {
  it("candidater exige le consentement ; même clé et même corps rejouent ; une seule par offre ; jamais sur sa propre page", async () => {
    const { jobs } = setup("p-rodrigue")
    expect(await jobs.apply({ ...APPLY, jobId: "job-demo-cuisine", offerVersion: 1, shareName: false })).toEqual({ ok: false, code: "job_application_consent_required" })
    const first = await jobs.apply({ ...APPLY, jobId: "job-demo-cuisine", offerVersion: 1 })
    expect(first).toMatchObject({ ok: true, value: { created: true } })
    const id = first.ok ? first.value.applicationId : ""
    expect(await jobs.apply({ ...APPLY, jobId: "job-demo-cuisine", offerVersion: 1 })).toEqual({ ok: true, value: { applicationId: id, created: false } })
    expect(await jobs.apply({ ...APPLY, jobId: "job-demo-cuisine", offerVersion: 1, message: `${APPLY.message} Autre corps.` })).toEqual({ ok: false, code: "job_application_idempotency_conflict" })
    expect(await jobs.apply({ ...APPLY, jobId: "job-demo-cuisine", offerVersion: 1, idempotencyKey: "candidature-recette-0002" })).toEqual({ ok: false, code: "job_application_already_exists" })
    expect(await jobs.apply({ ...APPLY, jobId: "job-demo-accueil-bxl", offerVersion: 1, idempotencyKey: "candidature-recette-0003" })).toEqual({ ok: false, code: "not_found" })
    expect(await jobs.apply({ ...APPLY, jobId: "job-demo-logistique", offerVersion: 9, idempotencyKey: "candidature-recette-0004" })).toEqual({ ok: false, code: "job_offer_changed" })
    expect(await jobs.apply({ ...APPLY, jobId: "job-demo-logistique", offerVersion: 1, shareTalentProfile: true, idempotencyKey: "candidature-recette-0005" })).toMatchObject({ ok: true })
    const own = setup("p-mireille")
    expect(await own.jobs.apply({ ...APPLY, jobId: "job-demo-cuisine", offerVersion: 1 })).toEqual({ ok: false, code: "job_application_own_page" })
  })

  it("la candidature est privée : la personne et l'équipe seulement ; le motif reste à l'équipe", async () => {
    const team = setup("p-mireille")
    expect(await team.jobs.markSeen("application-demo-steeve")).toEqual({ ok: true, value: { status: "seen" } })
    expect(await team.jobs.markNotSelected({ applicationId: "application-demo-steeve", reason: "Rappeler au 06 12 34 56 78" })).toEqual({ ok: false, code: "job_contact_details_forbidden" })
    expect(await team.jobs.markNotSelected({ applicationId: "application-demo-steeve", reason: "Disponibilités trop courtes." })).toEqual({ ok: true, value: { status: "not_selected" } })
    expect(await team.jobs.shortlist("application-demo-steeve")).toEqual({ ok: false, code: "job_application_transition_invalid" })
    const received = data(renderHook(() => team.jobs.useOfferApplications({ jobId: "job-demo-livraison", cursor: null })).result.current)
    expect(received.items).toEqual([expect.objectContaining({
      id: "application-demo-steeve", status: "not_selected", candidate: { displayName: "Steeve NGOUNIÉ", handle: "steeve.ngounie" },
      notSelectedReason: "Disponibilités trop courtes.", talentProfile: expect.objectContaining({ title: "Développeur web (démo)" }), actions: [],
    })])
    expect(await team.jobs.shortlist("application-demo-prisca")).toEqual({ ok: false, code: "not_found" })

    const candidate = setup("p-steeve")
    expect(renderHook(() => candidate.jobs.useOfferApplications({ jobId: "job-demo-livraison", cursor: null })).result.current).toEqual({ status: "error", code: "not_found" })
    const outsider = setup("p-rodrigue")
    expect(await outsider.jobs.withdraw("application-demo-steeve")).toEqual({ ok: false, code: "not_found" })
    expect(data(renderHook(() => outsider.jobs.useMyApplications({ cursor: null })).result.current).items).toEqual([])
  })

  it("mes candidatures : l'état, les gestes ouverts ; retirer est définitif et ne laisse que l'état à l'équipe", async () => {
    const { store, jobs } = setup("p-prisca")
    const mine = data(renderHook(() => jobs.useMyApplications({ cursor: null })).result.current)
    expect(mine.items).toEqual([expect.objectContaining({ id: "application-demo-prisca", status: "seen", offerOpen: true, actions: ["withdraw"], employer: expect.objectContaining({ handle: "collectif-ivindo-lyon" }) })])
    expect(JSON.stringify(mine)).not.toContain("notSelectedReason")
    expect(await jobs.withdraw("application-demo-prisca")).toEqual({ ok: true, value: { status: "withdrawn" } })
    expect(await jobs.withdraw("application-demo-prisca")).toEqual({ ok: true, value: { status: "withdrawn" } })
    await store.switchTo("p-steeve")
    const received = data(renderHook(() => jobs.useOfferApplications({ jobId: "job-demo-stage-lyon", cursor: null })).result.current)
    expect(received.items).toEqual([expect.objectContaining({ id: "application-demo-prisca", status: "withdrawn", candidate: null, message: null, talentProfile: null, actions: [] })])
  })
})

describe("démonstration de l'emploi — profils de talent", () => {
  it("la recherche : actifs et visibles du pays, nom court, sans soi-même ni coordonnée", () => {
    const { jobs } = setup("p-mireille")
    const found = data(renderHook(() => jobs.useTalentSearch({ country: "FR", cursor: null })).result.current)
    expect(found.items.map((item) => [item.id, item.shortName])).toEqual([["talent-demo-b", "Steeve N."], ["talent-demo-a", "Prisca A."]])
    expect(JSON.stringify(found)).not.toMatch(/p-steeve|p-prisca|Ngounié|Abanga|steeve\.ngounie/)
    expect(data(renderHook(() => jobs.useTalentSearch({ country: "FR", skill: "contrats", cursor: null })).result.current).items.map((item) => item.id)).toEqual(["talent-demo-a"])
    // Masqué de la recherche (Canada) ou masqué tout court (Belgique) : introuvables.
    expect(data(renderHook(() => jobs.useTalentSearch({ country: "CA", cursor: null })).result.current).items).toEqual([])
    expect(data(renderHook(() => jobs.useTalentSearch({ country: "BE", cursor: null })).result.current).items).toEqual([])
    expect(renderHook(() => jobs.useTalentSearch({ country: "GA" as "FR", cursor: null })).result.current).toEqual({ status: "error", code: "job_country_is_home" })
    const steeve = setup("p-steeve")
    expect(data(renderHook(() => steeve.jobs.useTalentSearch({ country: "FR", cursor: null })).result.current).items.map((item) => item.id)).toEqual(["talent-demo-a"])
  })

  it("un compte en attente ne cherche pas de talents et n'en publie pas", async () => {
    const { jobs } = setup("p-rodrigue", (state) => ({
      ...state,
      memberships: { ...state.memberships, "p-rodrigue": { ...state.memberships["p-rodrigue"]!, grounds: LIGHT_ACCOUNT_GROUNDS } },
    }))
    expect(renderHook(() => jobs.useTalentSearch({ country: "FR", cursor: null })).result.current).toEqual({ status: "error", code: "status_insufficient" })
    expect(await jobs.saveTalentProfile({ title: "Ingénieur", skills: ["Calcul"], availability: "immediate", languages: ["fr"], country: "CA", visibility: "network", expectedVersion: null }))
      .toEqual({ ok: false, code: "status_insufficient" })
    // Masquer son profil reste ouvert : reprendre ses données ne demande aucun droit de publier.
    expect(await jobs.setTalentProfileStatus({ status: "hidden", expectedVersion: 1 })).toEqual({ ok: true, value: { status: "hidden", version: 2 } })
  })

  it("opt-in révocable : créer, modifier à la version lue, masquer, supprimer", async () => {
    const { jobs } = setup("p-mireille")
    expect(data(renderHook(() => jobs.useMyTalentProfile()).result.current)).toBeNull()
    const input = { title: "Infirmière, accompagnement", skills: ["Soins", "Prévention"], availability: "one_month" as const, languages: ["fr" as const], country: "FR" as const, visibility: "network" as const }
    const created = await jobs.saveTalentProfile({ ...input, expectedVersion: null })
    expect(created).toMatchObject({ ok: true, value: { version: 1 } })
    expect(await jobs.saveTalentProfile({ ...input, expectedVersion: null })).toEqual({ ok: false, code: "talent_profile_version_conflict" })
    expect(await jobs.saveTalentProfile({ ...input, title: "Infirmière coordinatrice", expectedVersion: 1 })).toMatchObject({ ok: true, value: { version: 2 } })
    expect(data(renderHook(() => jobs.useMyTalentProfile()).result.current)).toMatchObject({ title: "Infirmière coordinatrice", status: "active", version: 2 })
    expect(await jobs.setTalentProfileStatus({ status: "hidden", expectedVersion: 2 })).toEqual({ ok: true, value: { status: "hidden", version: 3 } })
    expect(await jobs.setTalentProfileStatus({ status: "active", expectedVersion: 2 })).toEqual({ ok: false, code: "talent_profile_version_conflict" })
    expect(await jobs.removeTalentProfile()).toEqual({ ok: true, value: null })
    expect(data(renderHook(() => jobs.useMyTalentProfile()).result.current)).toBeNull()
    expect(await jobs.setTalentProfileStatus({ status: "active", expectedVersion: 3 })).toEqual({ ok: false, code: "not_found" })
  })

  it("se garde dans ce navigateur et repart du jeu fictif à la remise à zéro de l'état principal", async () => {
    const storage = memoryStorage()
    const { store, jobs, clock } = setup("p-mireille", (state) => state, storage)
    await jobs.createOffer({ ...INPUT, pageId: "page-saveurs", publish: true })
    expect(storage.items.has(DEMO_JOBS_STORAGE_KEY)).toBe(true)
    const again = createDemoJobs(store, { storage, teams: TEAMS })
    expect(data(renderHook(() => again.useOffer("job-demo-1")).result.current)).toMatchObject({ status: "open" })
    // La remise à zéro date un nouveau jeu principal : les données de l'emploi repartent avec lui.
    clock.now = NOW + 1000
    await store.reset()
    await store.switchTo("p-mireille")
    expect(data(renderHook(() => again.useOffer("job-demo-1")).result.current)).toBeNull()
  })
})
