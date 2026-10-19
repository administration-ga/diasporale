import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { PageManagement } from "../data/page-admin-port"
import { createDemoPageAdmin, DEMO_PAGE_ADMIN_STORAGE_KEY, demoManagedPage } from "./page-admin"
import { createDemoSeed } from "./state"
import { DEMO_STORAGE_KEY, DemoStore } from "./store"

const NOW = Date.UTC(2026, 9, 18, 9)

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    values,
  }
}

function setup(viewer: string | null = "p-mireille", options: { storage?: ReturnType<typeof memoryStorage>; clock?: () => number } = {}) {
  const storage = options.storage ?? null
  const store = new DemoStore(storage, options.clock ?? (() => NOW), 0)
  const capability = createDemoPageAdmin(store, { storage })
  const management = capability.management as PageManagement
  return {
    store,
    capability,
    management,
    as: async (personId: string) => act(async () => { await store.switchTo(personId) }),
    ...(viewer ? { ready: act(async () => { await store.switchTo(viewer) }) } : {}),
  }
}

const pdf = (name = "statuts.pdf", type = "application/pdf", size = 4096) => new File([new Uint8Array(size)], name, { type })

describe("démonstration — mes pages et l'équipe fictive", () => {
  it("Mireille gère le traiteur parisien ; Steeve administre l'association lyonnaise", async () => {
    const demo = setup()
    await demo.ready
    const { result } = renderHook(() => demo.capability.useMyPages())
    expect(result.current).toEqual({
      status: "ready",
      data: [{ id: "page-saveurs", handle: "saveurs-okoume-demo", name: "Saveurs d'Okoumé (démo)", ownerKind: "company", role: "admin", badge: "verified", country: "FR" }],
    })
    await demo.as("p-steeve")
    expect(result.current).toMatchObject({ status: "ready", data: [{ id: "page-asso-lyon", role: "admin" }] })
  })

  it("une invitation ne donne rien tant qu'elle n'est pas acceptée", async () => {
    const demo = setup()
    await demo.ready
    const invitations = renderHook(() => demo.management.useMyInvitations())
    const pages = renderHook(() => demo.capability.useMyPages())
    expect(invitations.result.current).toMatchObject({ status: "ready", data: [{ page: { id: "page-asso-lyon", badge: "verified" }, role: "signatory" }] })
    expect(pages.result.current).toMatchObject({ data: [{ id: "page-saveurs" }] })
    await act(async () => { expect(await demo.management.respondToInvitation("page-asso-lyon", true)).toEqual({ ok: true, value: { role: "signatory" } }) })
    expect(invitations.result.current).toEqual({ status: "ready", data: [] })
    expect(pages.result.current).toMatchObject({ data: [{ id: "page-saveurs", role: "admin" }, { id: "page-asso-lyon", role: "signatory" }] })
    expect(await demo.management.respondToInvitation("page-asso-lyon", true)).toEqual({ ok: false, code: "page_invitation_gone" })
  })

  it("refuse une lecture hors session ou hors adhésion", () => {
    const demo = setup(null)
    const { result } = renderHook(() => demo.capability.useMyPages())
    expect(result.current).toEqual({ status: "error", code: "not_signed_in" })
  })
})

describe("démonstration — créer une page", () => {
  it("est réservé aux membres vérifiés et rend la page à son créateur, en « Communauté »", async () => {
    const demo = setup("p-steeve")
    await demo.ready
    expect(await demo.management.createPage({ ownerKind: "association", name: "Amicale de Lille", country: "FR" })).toEqual({ ok: false, code: "page_verified_required" })
    await demo.as("p-mireille")
    let created: Awaited<ReturnType<PageManagement["createPage"]>> | null = null
    await act(async () => { created = await demo.management.createPage({ ownerKind: "association", name: "  Amicale   de Lille ", shortName: "ADL", country: "FR" }) })
    expect(created).toEqual({ ok: true, value: { pageId: expect.stringMatching(/^page-demo-/), handle: "amicale-de-lille" } })
    const page = renderHook(() => demo.management.useManagedPage("amicale-de-lille"))
    expect(page.result.current).toMatchObject({ status: "ready", data: { name: "Amicale de Lille", shortName: "ADL", badge: "community", myRole: "admin", ownerKind: "association" } })
    expect(demoManagedPage(demo.store, "amicale-de-lille")).toMatchObject({ handle: "amicale-de-lille", badge: "community" })
  })

  it("refuse une adresse prise, une nature réservée, un nom ou un pays invalides", async () => {
    const demo = setup()
    await demo.ready
    expect(await demo.management.createPage({ ownerKind: "company", name: "Saveurs", handle: "saveurs-okoume-demo", country: "FR" })).toEqual({ ok: false, code: "page_handle_taken" })
    expect(await demo.management.createPage({ ownerKind: "institution" as never, name: "Ministère", country: "FR" })).toEqual({ ok: false, code: "page_kind_reserved" })
    expect(await demo.management.createPage({ ownerKind: "media", name: " ", country: "FR" })).toEqual({ ok: false, code: "page_name_invalid" })
    expect(await demo.management.createPage({ ownerKind: "media", name: "Radio", handle: "r!", country: "FR" })).toEqual({ ok: false, code: "page_handle_length" })
    expect(await demo.management.createPage({ ownerKind: "media", name: "Radio Diaspora", country: "ZZ" as never })).toEqual({ ok: false, code: "page_country_invalid" })
  })
})

describe("démonstration — revendiquer et instruire", () => {
  it("une revendication suit les règles du moteur, puis une décision motivée en fait un administrateur", async () => {
    const demo = setup("p-prisca")
    await demo.ready
    const mine = renderHook(() => demo.management.useMyClaims())
    const evidence = [pdf(), pdf("recepisse.png", "image/png")]
    let claimId = ""
    await act(async () => {
      const result = await demo.management.requestClaim({ pageId: "page-asso-bordeaux", note: "Mandat déclaré : présidence.", evidence })
      expect(result).toMatchObject({ ok: true })
      if (result.ok) claimId = result.value.claimId
    })
    expect(mine.result.current).toMatchObject({ status: "ready", data: [{ id: claimId, status: "pending", evidenceCount: 2, page: { id: "page-asso-bordeaux" } }] })
    expect(await demo.management.requestClaim({ pageId: "page-asso-bordeaux", evidence })).toEqual({ ok: false, code: "page_claim_pending" })
    expect(await demo.management.requestClaim({ pageId: "page-valise", evidence })).toEqual({ ok: false, code: "page_already_claimed" })
    expect(await demo.management.requestClaim({ pageId: "page-poste-fr", evidence })).toEqual({ ok: false, code: "page_not_claimable" })
    expect(await demo.management.requestClaim({ pageId: "page-asso-lyon", evidence })).toEqual({ ok: false, code: "page_already_verified" })
    expect(await demo.management.requestClaim({ pageId: "page-asso-montreal", evidence: [] })).toEqual({ ok: false, code: "page_claim_evidence_count" })
    expect(await demo.management.requestClaim({ pageId: "page-asso-montreal", evidence: [pdf("photo.gif", "image/gif")] })).toEqual({ ok: false, code: "page_claim_evidence_type" })

    // Un simple membre ne voit pas la file et ne tranche rien.
    await demo.as("p-steeve")
    const queue = renderHook(() => demo.management.useClaimQueue({ status: "pending", cursor: null }))
    expect(queue.result.current).toEqual({ status: "ready", data: null })
    expect(await demo.management.decideClaim(claimId, "approved", "Statuts conformes.")).toEqual({ ok: false, code: "not_found" })

    // La modération (Mireille en démonstration) instruit : pièces dites reçues, jamais servies.
    await demo.as("p-mireille")
    expect(queue.result.current).toMatchObject({ status: "ready", data: { items: [{ id: claimId, claimant: { handle: "prisca.abanga" } }], continueCursor: null } })
    const detail = renderHook(() => demo.management.useClaim(claimId))
    expect(detail.result.current).toMatchObject({ status: "ready", data: { evidence: [{ url: null, withheld: null }, { url: null, withheld: null }] } })
    expect(await demo.management.decideClaim(claimId, "approved", "ok")).toEqual({ ok: false, code: "page_decision_reason_length" })
    await act(async () => { expect(await demo.management.decideClaim(claimId, "approved", "Statuts et procès-verbal conformes.")).toEqual({ ok: true, value: { status: "approved" } }) })
    expect(queue.result.current).toMatchObject({ status: "ready", data: { items: [] } })
    expect(await demo.management.decideClaim(claimId, "rejected", "Trop tard pour changer.")).toEqual({ ok: false, code: "page_claim_closed" })

    await demo.as("p-prisca")
    expect(mine.result.current).toMatchObject({ data: [{ id: claimId, status: "approved", decisionReason: "Statuts et procès-verbal conformes." }] })
    const page = renderHook(() => demo.management.useManagedPage("etudiants-bordeaux-demo"))
    // Vérifiée, jamais officielle ; la demandeuse en est administratrice.
    expect(page.result.current).toMatchObject({ status: "ready", data: { badge: "verified", myRole: "admin" } })
  })

  it("retirer une demande en attente efface ce qu'on savait de ses pièces ; une demande close ne se retire plus", async () => {
    const demo = setup("p-prisca")
    await demo.ready
    let claimId = ""
    await act(async () => {
      const result = await demo.management.requestClaim({ pageId: "page-asso-montreal", evidence: [pdf()] })
      if (result.ok) claimId = result.value.claimId
    })
    await act(async () => { expect(await demo.management.withdrawClaim(claimId)).toEqual({ ok: true, value: { withdrawn: true } }) })
    const mine = renderHook(() => demo.management.useMyClaims())
    expect(mine.result.current).toMatchObject({ data: [{ id: claimId, status: "withdrawn", evidenceCount: 0 }] })
    expect(await demo.management.withdrawClaim(claimId)).toEqual({ ok: true, value: { withdrawn: false } })
    await demo.as("p-steeve")
    expect(await demo.management.withdrawClaim(claimId)).toEqual({ ok: false, code: "not_found" })
  })
})

describe("démonstration — l'équipe d'une page", () => {
  it("le dernier administrateur ne part pas ; un signataire retiré perd l'accès aussitôt", async () => {
    const demo = setup("p-steeve")
    await demo.ready
    expect(await demo.management.revokeRole("page-asso-lyon", "p-steeve")).toEqual({ ok: false, code: "page_last_admin" })
    expect(await demo.management.grantRole("page-asso-lyon", "steeve.ngounie", "admin")).toEqual({ ok: false, code: "page_signatory_self" })
    expect(await demo.management.grantRole("page-asso-lyon", "personne.inconnue", "admin")).toEqual({ ok: false, code: "page_member_not_found" })
    await act(async () => { expect(await demo.management.grantRole("page-asso-lyon", "@Prisca.Abanga", "signatory")).toMatchObject({ ok: true, value: { role: "signatory", invited: true } }) })

    await demo.as("p-prisca")
    const team = renderHook(() => demo.management.useSignatories("page-asso-lyon"))
    // Une invitation en attente n'ouvre pas l'équipe.
    expect(team.result.current).toEqual({ status: "error", code: "page_role_required" })
    await act(async () => { await demo.management.respondToInvitation("page-asso-lyon", true) })
    expect(team.result.current).toMatchObject({ status: "ready", data: expect.arrayContaining([expect.objectContaining({ personId: "p-prisca", role: "signatory", accepted: true, isMe: true })]) })
    expect(await demo.management.grantRole("page-asso-lyon", "mireille.ivindo", "admin")).toEqual({ ok: false, code: "page_role_required" })
    expect(await demo.management.updateIdentity("page-asso-lyon", { name: "Autre nom", shortName: null, description: null, country: "FR" })).toEqual({ ok: false, code: "page_role_required" })

    await demo.as("p-steeve")
    await act(async () => { expect(await demo.management.revokeRole("page-asso-lyon", "p-prisca")).toEqual({ ok: true, value: { revoked: true } }) })
    await demo.as("p-prisca")
    expect(team.result.current).toEqual({ status: "error", code: "page_role_required" })
    const page = renderHook(() => demo.management.useManagedPage("collectif-ivindo-lyon"))
    expect(page.result.current).toMatchObject({ status: "ready", data: { myRole: null } })
  })

  it("un second administrateur accepté permet au premier de partir", async () => {
    const demo = setup("p-steeve")
    await demo.ready
    await act(async () => { await demo.management.grantRole("page-asso-lyon", "mireille.ivindo", "admin") })
    await demo.as("p-mireille")
    await act(async () => { await demo.management.respondToInvitation("page-asso-lyon", true) })
    await demo.as("p-steeve")
    await act(async () => { expect(await demo.management.revokeRole("page-asso-lyon", "p-steeve")).toEqual({ ok: true, value: { revoked: true } }) })
    const pages = renderHook(() => demo.capability.useMyPages())
    expect(pages.result.current).toEqual({ status: "ready", data: [] })
  })

  it("seul un administrateur modifie l'identité ; un appel sans changement n'écrit rien", async () => {
    const demo = setup("p-steeve")
    await demo.ready
    const page = renderHook(() => demo.management.useManagedPage("collectif-ivindo-lyon"))
    const before = page.result.current
    if (before.status !== "ready" || !before.data) throw new Error("page attendue")
    const same = { name: before.data.name, shortName: before.data.shortName, description: before.data.description, country: before.data.country }
    expect(await demo.management.updateIdentity("page-asso-lyon", same)).toEqual({ ok: true, value: { changed: false } })
    await act(async () => { expect(await demo.management.updateIdentity("page-asso-lyon", { ...same, shortName: "CIL" })).toEqual({ ok: true, value: { changed: true } }) })
    expect(page.result.current).toMatchObject({ data: { shortName: "CIL", badge: "verified" } })
    expect(await demo.management.updateIdentity("page-asso-lyon", { ...same, name: "" })).toEqual({ ok: false, code: "page_name_invalid" })
  })
})

describe("démonstration — persistance", () => {
  it("persiste avec la démonstration et repart avec sa remise à zéro", async () => {
    let now = NOW
    const clock = () => now
    const storage = memoryStorage()
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(createDemoSeed(NOW)))
    const first = setup("p-mireille", { storage, clock })
    await first.ready
    await act(async () => { await first.management.createPage({ ownerKind: "community", name: "Cercle de Nantes", country: "FR" }) })
    expect(storage.getItem(DEMO_PAGE_ADMIN_STORAGE_KEY)).toContain("cercle-de-nantes")

    // Un nouvel onglet relit le même état.
    const second = setup("p-mireille", { storage, clock })
    await second.ready
    expect(renderHook(() => second.management.useManagedPage("cercle-de-nantes")).result.current).toMatchObject({ data: { myRole: "admin" } })

    // La remise à zéro change le jeu fictif : les pages créées disparaissent avec lui.
    now = NOW + 60_000
    await act(async () => { await second.store.reset() })
    await second.as("p-mireille")
    expect(renderHook(() => second.management.useManagedPage("cercle-de-nantes")).result.current).toEqual({ status: "ready", data: null })
  })

  it("un magasin tenu en mémoire seule (rendu serveur, tests) n'écrit rien dans le navigateur", async () => {
    const storage = memoryStorage()
    const store = new DemoStore(null, () => NOW, 0)
    const management = createDemoPageAdmin(store, { storage }).management as PageManagement
    await act(async () => { await store.switchTo("p-mireille") })
    await act(async () => { expect(await management.createPage({ ownerKind: "community", name: "Cercle de Rennes", country: "FR" })).toMatchObject({ ok: true }) })
    expect(storage.values.size).toBe(0)
  })
})
