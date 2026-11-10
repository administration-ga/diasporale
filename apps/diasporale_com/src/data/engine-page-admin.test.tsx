// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import type { PageManagement } from "@diasporale/features/data"
import { cleanup, renderHook } from "@testing-library/react"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createEnginePageAdmin, pageAdminErrorCode } from "./engine-page-admin"

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isPending: false, isUnauthenticated: false },
  results: {} as Record<string, unknown>,
  loaded: vi.fn(),
}))

vi.mock("@antsia/api/hooks", () => ({ useStableConvexAuth: () => mocks.auth }))
vi.mock("convex/react", () => ({
  useQueries: (queries: Record<string, { query: Parameters<typeof getFunctionName>[0]; args?: unknown }>) => {
    if (!queries.value) return {}
    const name = getFunctionName(queries.value.query)
    mocks.loaded(name, queries.value.args)
    if (!(name in mocks.results)) throw new Error(`Lecture inattendue : ${name}`)
    return { value: mocks.results[name] }
  },
}))

const NETWORK = { _id: "network-diasporale" }
const MEMBER = { status: "declaree", role: "member", capabilities: ["read_network", "publish"] }
const CARD = {
  pageId: "page-1",
  networkId: "network-diasporale",
  handle: "amicale-lyon",
  name: "Amicale de Lyon",
  shortName: null,
  logoUrl: null,
  badge: "community",
  ownerKind: "association",
  country: "FR",
}
const CLAIM = {
  claimId: "claim-1",
  page: CARD,
  claimant: { personId: "person-me", handle: "awa.demo", displayName: "Awa", avatarUrl: "https://images.exemple.test/a.png" },
  status: "pending",
  note: "Mandat déclaré : présidence.",
  evidenceCount: 2,
  decisionReason: null,
  createdAt: 10,
  decidedAt: null,
}

function results(extra: Record<string, unknown> = {}) {
  mocks.results = {
    "modules/networks/networks:getBySlug": NETWORK,
    "modules/diaspora/membership:myMembership": MEMBER,
    "modules/people/persons:getMyPerson": { _id: "person-me" },
    ...extra,
  }
}

function source(options: { mutation?: (name: string, args: unknown) => unknown; fetch?: typeof fetch } = {}) {
  const calls: { name: string; args: unknown }[] = []
  const mutation = vi.fn(async (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(reference)
    calls.push({ name, args })
    return options.mutation ? options.mutation(name, args) : null
  })
  const query = vi.fn(async (reference: Parameters<typeof getFunctionName>[0]) => {
    if (getFunctionName(reference) === "modules/networks/networks:getBySlug") return NETWORK
    throw new Error("Lecture ponctuelle inattendue")
  })
  const capability = createEnginePageAdmin(
    { convex: { mutation, query } as unknown as ConvexReactClient, authClient: {} as EngineAuthClient },
    options.fetch ? { fetch: options.fetch } : {},
  )
  return { capability, management: capability.management as PageManagement, calls, mutation }
}

function pdf(name = "statuts.pdf", type = "application/pdf", size = 2048) {
  return new File([new Uint8Array(size)], name, { type })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth = { isAuthenticated: true, isPending: false, isUnauthenticated: false }
  results()
})
afterEach(cleanup)

describe("gestion des pages — lectures du moteur", () => {
  it("projette mes pages (rôle vivant), bornées au réseau diasporale, badge et pays relus", () => {
    results({ "modules/pages/pages:myPages": [{ ...CARD, role: "admin" }, { ...CARD, pageId: "page-2", badge: "public_agent", country: "XX", role: "signatory" }] })
    const { capability } = source()
    const { result } = renderHook(() => capability.useMyPages())
    expect(mocks.loaded).toHaveBeenCalledWith("modules/pages/pages:myPages", { networkId: "network-diasporale" })
    expect(result.current).toEqual({
      status: "ready",
      data: [
        { id: "page-1", handle: "amicale-lyon", name: "Amicale de Lyon", ownerKind: "association", badge: "community", country: "FR", role: "admin" },
        // Un badge de personne n'a pas de sens pour une page ; un pays inconnu n'est pas inventé.
        { id: "page-2", handle: "amicale-lyon", name: "Amicale de Lyon", ownerKind: "association", badge: "community", country: null, role: "signatory" },
      ],
    })
  })

  it("garde la même projection tant que le moteur ne répond rien de neuf", () => {
    results({ "modules/pages/pages:myPages": [{ ...CARD, role: "admin" }] })
    const { capability } = source()
    const { result, rerender } = renderHook(() => capability.useMyPages())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it.each([
    { name: "sans session", setup: () => { mocks.auth = { isAuthenticated: false, isPending: false, isUnauthenticated: true } }, code: "not_signed_in" },
    { name: "sans adhésion", setup: () => results({ "modules/diaspora/membership:myMembership": null }), code: "not_member" },
    { name: "suspendu", setup: () => results({ "modules/diaspora/membership:myMembership": { ...MEMBER, status: "suspendue", capabilities: [] } }), code: "suspended" },
  ])("refuse $name sans interroger les pages", ({ setup, code }) => {
    setup()
    const { capability } = source()
    const { result } = renderHook(() => capability.useMyPages())
    expect(result.current).toEqual({ status: "error", code })
    expect(mocks.loaded).not.toHaveBeenCalledWith("modules/pages/pages:myPages", expect.anything())
  })

  it("lit la page gérée et MON rôle vivant ; une page illisible rend le même null", () => {
    results({ "modules/pages/pages:getPage": { ...CARD, description: "Accueil", bannerUrl: null, visibility: "network", followerCount: 3, postCount: 1, createdAt: 1, viewer: { following: false, role: "admin" } } })
    const { management } = source()
    const { result } = renderHook(() => management.useManagedPage("amicale-lyon"))
    expect(mocks.loaded).toHaveBeenCalledWith("modules/pages/pages:getPage", { networkId: "network-diasporale", handle: "amicale-lyon" })
    expect(result.current).toEqual({
      status: "ready",
      // Présentation facultative (ville, type, secteur) : absente du moteur, elle se lit `null`, jamais inventée.
      data: {
        id: "page-1", handle: "amicale-lyon", name: "Amicale de Lyon", ownerKind: "association", badge: "community", country: "FR", shortName: null, description: "Accueil",
        city: null, associationType: null, sector: null, logoUrl: null, bannerUrl: null, myRole: "admin",
      },
    })
    results({ "modules/pages/pages:getPage": null })
    expect(renderHook(() => management.useManagedPage("inconnue")).result.current).toEqual({ status: "ready", data: null })
  })

  it("ferme l'équipe dès que le rôle est retiré (refus réactif `pageRoleRequired`)", () => {
    results({
      "modules/pages/signatories:listPageSignatories": [
        { personId: "person-me", handle: "awa.demo", displayName: "Awa", avatarUrl: null, role: "admin", accepted: true, since: 5 },
        { personId: "person-2", handle: null, displayName: null, avatarUrl: null, role: "signatory", accepted: false, since: 6 },
      ],
    })
    const { management } = source()
    const { result, rerender } = renderHook(() => management.useSignatories("page-1"))
    expect(result.current).toEqual({
      status: "ready",
      data: [
        { personId: "person-me", handle: "awa.demo", displayName: "Awa", role: "admin", accepted: true, since: 5, isMe: true },
        { personId: "person-2", handle: null, displayName: null, role: "signatory", accepted: false, since: 6, isMe: false },
      ],
    })
    mocks.results["modules/pages/signatories:listPageSignatories"] = new ConvexError({ code: "pageRoleRequired" })
    rerender()
    expect(result.current).toEqual({ status: "error", code: "page_role_required" })
  })

  it("lit mes revendications (première page du moteur) sans exposer l'avatar ni d'identifiant de stockage", () => {
    results({ "modules/pages/claims:paginateMyPageClaims": { page: [CLAIM], isDone: true, continueCursor: "fin" } })
    const { management } = source()
    const { result } = renderHook(() => management.useMyClaims())
    expect(mocks.loaded).toHaveBeenCalledWith("modules/pages/claims:paginateMyPageClaims", { networkId: "network-diasporale", paginationOpts: { numItems: 50, cursor: null } })
    expect(result.current).toEqual({
      status: "ready",
      data: [{
        id: "claim-1",
        page: { id: "page-1", handle: "amicale-lyon", name: "Amicale de Lyon", ownerKind: "association", badge: "community", country: "FR" },
        claimant: { personId: "person-me", handle: "awa.demo", displayName: "Awa" },
        status: "pending",
        note: "Mandat déclaré : présidence.",
        evidenceCount: 2,
        decisionReason: null,
        createdAt: 10,
        decidedAt: null,
      }],
    })
  })

  it("n'interroge pas la file d'instruction pour un simple membre", () => {
    const { management } = source()
    const { result } = renderHook(() => management.useClaimQueue({ status: "pending", cursor: null }))
    expect(result.current).toEqual({ status: "ready", data: null })
    expect(mocks.loaded).not.toHaveBeenCalledWith("modules/pages/claims:paginatePageClaims", expect.anything())
  })

  it("sert la file à la modération du réseau, curseur compris", () => {
    results({
      "modules/diaspora/membership:myMembership": { ...MEMBER, role: "network_moderator" },
      "modules/pages/claims:paginatePageClaims": { page: [CLAIM], isDone: false, continueCursor: "suite" },
    })
    const { management } = source()
    const { result } = renderHook(() => management.useClaimQueue({ status: "pending", cursor: "debut" }))
    expect(mocks.loaded).toHaveBeenCalledWith("modules/pages/claims:paginatePageClaims", { networkId: "network-diasporale", status: "pending", paginationOpts: { numItems: 20, cursor: "debut" } })
    expect(result.current).toMatchObject({ status: "ready", data: { continueCursor: "suite", items: [{ id: "claim-1" }] } })
  })

  it.each(["fileScanPending", "fileScanUnavailable", "fileQuarantined"] as const)("une pièce retenue par la garde (%s) n'a jamais d'adresse", (withheld) => {
    results({
      "modules/pages/claims:getPageClaim": { ...CLAIM, evidence: [{ url: "https://depot.exemple.test/1", withheld: null }, { url: "https://depot.exemple.test/2", withheld }] },
    })
    const { management } = source()
    const { result } = renderHook(() => management.useClaim("claim-1"))
    expect(result.current).toMatchObject({ status: "ready", data: { evidence: [{ url: "https://depot.exemple.test/1", withheld: null }, { url: null, withheld }] } })
    expect(renderHook(() => management.useClaim(null)).result.current).toEqual({ status: "ready", data: null })
  })
})

describe("gestion des pages — écritures du moteur", () => {
  it("crée une page dans DIASPORALE avec les seuls champs saisis", async () => {
    const { management, calls } = source({ mutation: () => ({ pageId: "page-neuve", handle: "collectif-lille" }) })
    const result = await management.createPage({ ownerKind: "association", name: "Collectif de Lille", shortName: " CDL ", description: "", country: "FR" })
    expect(result).toEqual({ ok: true, value: { pageId: "page-neuve", handle: "collectif-lille" } })
    expect(calls).toEqual([{ name: "modules/pages/pages:createPage", args: { networkId: "network-diasporale", name: "Collectif de Lille", ownerKind: "association", shortName: "CDL", country: "FR" } }])
  })

  it.each([
    { name: "statut insuffisant", error: new ConvexError({ code: "statusInsufficient" }), code: "page_verified_required" },
    { name: "adresse prise", error: new ConvexError({ code: "handleUnavailable" }), code: "page_handle_taken" },
    { name: "règle d'adresse", error: new ConvexError({ code: "invalidArgument", rule: "PAGE_HANDLE_LENGTH", params: { min: 3, max: 60 } }), code: "page_handle_length" },
    { name: "pays refusé", error: new ConvexError({ code: "invalidArgument", rule: "POST_COUNTRY_INVALID" }), code: "page_country_invalid" },
    { name: "débit", error: new ConvexError({ code: "rateLimited", retryAfterMs: 1000 }), code: "rate_limited" },
    { name: "panne inconnue", error: new Error("trace interne"), code: "unknown" },
  ])("traduit le refus « $name » de la création", async ({ error, code }) => {
    const { management } = source({ mutation: () => { throw error } })
    expect(await management.createPage({ ownerKind: "company", name: "Saveurs", country: "FR" })).toEqual({ ok: false, code })
  })

  it("refuse avant le moteur une nature réservée ou un nom vide", async () => {
    const { management, mutation } = source()
    expect(await management.createPage({ ownerKind: "institution" as never, name: "Ministère", country: "FR" })).toEqual({ ok: false, code: "page_kind_reserved" })
    expect(await management.createPage({ ownerKind: "association", name: "   ", country: "FR" })).toEqual({ ok: false, code: "page_name_invalid" })
    expect(mutation).not.toHaveBeenCalled()
  })

  it("dépose chaque pièce NEUVE par la garde des fichiers, puis la demande les admet", async () => {
    let upload = 0
    const deposit = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ storageId: `stockage-${++upload}` }), { status: 200 }))
    const { management, calls } = source({
      fetch: deposit,
      mutation: (name) => (name === "modules/pages/claims:generateClaimEvidenceUploadUrl" ? `https://depot.exemple.test/${upload + 1}` : { claimId: "claim-neuve" }),
    })
    const statutes = pdf("statuts.pdf")
    const receipt = pdf("recepisse.png", "image/png")
    const result = await management.requestClaim({ pageId: "page-1", note: " Mandat déclaré : présidence. ", evidence: [statutes, receipt] })
    expect(result).toEqual({ ok: true, value: { claimId: "claim-neuve" } })
    expect(deposit.mock.calls.map(([url, init]) => [url, init?.body, (init?.headers as Record<string, string>)["Content-Type"]])).toEqual([
      ["https://depot.exemple.test/1", statutes, "application/pdf"],
      ["https://depot.exemple.test/2", receipt, "image/png"],
    ])
    expect(calls).toEqual([
      { name: "modules/pages/claims:generateClaimEvidenceUploadUrl", args: { networkId: "network-diasporale" } },
      { name: "modules/pages/claims:generateClaimEvidenceUploadUrl", args: { networkId: "network-diasporale" } },
      {
        name: "modules/pages/claims:requestPageClaim",
        args: {
          networkId: "network-diasporale",
          pageId: "page-1",
          note: "Mandat déclaré : présidence.",
          evidence: [{ storageId: "stockage-1", mimeType: "application/pdf" }, { storageId: "stockage-2", mimeType: "image/png" }],
        },
      },
    ])
  })

  it("une pièce refusée ne quitte pas le navigateur", async () => {
    const deposit = vi.fn<typeof fetch>()
    const { management, mutation } = source({ fetch: deposit })
    expect(await management.requestClaim({ pageId: "page-1", evidence: [pdf("photo.gif", "image/gif")] })).toEqual({ ok: false, code: "page_claim_evidence_type" })
    expect(await management.requestClaim({ pageId: "page-1", evidence: [] })).toEqual({ ok: false, code: "page_claim_evidence_count" })
    expect(await management.requestClaim({ pageId: "page-1", evidence: [pdf("lourd.pdf", "application/pdf", 11 * 1024 * 1024)] })).toEqual({ ok: false, code: "page_claim_evidence_too_large" })
    expect(mutation).not.toHaveBeenCalled()
    expect(deposit).not.toHaveBeenCalled()
  })

  it("un dépôt en échec n'ouvre aucune demande", async () => {
    const deposit = vi.fn<typeof fetch>(async () => new Response("{}", { status: 500 }))
    const { management, calls } = source({ fetch: deposit, mutation: () => "https://depot.exemple.test/1" })
    expect(await management.requestClaim({ pageId: "page-1", evidence: [pdf()] })).toEqual({ ok: false, code: "media_upload_failed" })
    expect(calls.map((call) => call.name)).toEqual(["modules/pages/claims:generateClaimEvidenceUploadUrl"])
  })

  it.each([
    { rule: "PAGE_CLAIM_PENDING", code: "page_claim_pending" },
    { rule: "PAGE_ALREADY_CLAIMED", code: "page_already_claimed" },
    { rule: "UPLOAD_TYPE_NOT_ALLOWED", code: "page_claim_evidence_type" },
    { rule: "UPLOAD_SIZE_OUT_OF_RANGE", code: "page_claim_evidence_too_large" },
  ])("traduit la règle $rule de la revendication", async ({ rule, code }) => {
    const deposit = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ storageId: "stockage-1" })))
    const { management } = source({
      fetch: deposit,
      mutation: (name) => {
        if (name === "modules/pages/claims:generateClaimEvidenceUploadUrl") return "https://depot.exemple.test/1"
        throw new ConvexError({ code: "invalidArgument", rule })
      },
    })
    expect(await management.requestClaim({ pageId: "page-1", evidence: [pdf()] })).toEqual({ ok: false, code })
  })

  it("habilite par identifiant replié et traduit les refus de l'équipe", async () => {
    const { management, calls } = source({ mutation: () => ({ personId: "person-2", role: "signatory", invited: true }) })
    expect(await management.grantRole("page-1", " @Awa.Demo ", "signatory")).toEqual({ ok: true, value: { personId: "person-2", role: "signatory", invited: true } })
    expect(calls).toEqual([{ name: "modules/pages/signatories:grantPageRole", args: { networkId: "network-diasporale", pageId: "page-1", handle: "awa.demo", role: "signatory" } }])
    for (const [error, code] of [
      [new ConvexError({ code: "notFound" }), "page_member_not_found"],
      [new ConvexError({ code: "invalidArgument", field: "handle" }), "page_signatory_self"],
      [new ConvexError({ code: "invalidArgument", rule: "PAGE_LAST_ADMIN" }), "page_last_admin"],
      [new ConvexError({ code: "pageRoleRequired" }), "page_role_required"],
    ] as const) {
      const failing = source({ mutation: () => { throw error } })
      expect(await failing.management.grantRole("page-1", "awa.demo", "admin")).toEqual({ ok: false, code })
    }
  })

  it("le dernier administrateur ne part pas ; un rôle perdu ne retire plus personne", async () => {
    const last = source({ mutation: () => { throw new ConvexError({ code: "invalidArgument", rule: "PAGE_LAST_ADMIN" }) } })
    expect(await last.management.revokeRole("page-1", "person-me")).toEqual({ ok: false, code: "page_last_admin" })
    const lost = source({ mutation: () => { throw new ConvexError({ code: "pageRoleRequired" }) } })
    expect(await lost.management.revokeRole("page-1", "person-2")).toEqual({ ok: false, code: "page_role_required" })
    const done = source({ mutation: () => ({ revoked: true }) })
    expect(await done.management.revokeRole("page-1", "person-2")).toEqual({ ok: true, value: { revoked: true } })
    expect(done.calls).toEqual([{ name: "modules/pages/signatories:revokePageRole", args: { networkId: "network-diasporale", pageId: "page-1", personId: "person-2" } }])
  })

  it("répond à une invitation ; une invitation disparue se dit", async () => {
    const accepted = source({ mutation: () => ({ role: "signatory" }) })
    expect(await accepted.management.respondToInvitation("page-1", true)).toEqual({ ok: true, value: { role: "signatory" } })
    const gone = source({ mutation: () => { throw new ConvexError({ code: "notFound" }) } })
    expect(await gone.management.respondToInvitation("page-1", false)).toEqual({ ok: false, code: "page_invitation_gone" })
  })

  it("tranche par une décision motivée ; une décision close se dit", async () => {
    const { management, calls } = source({ mutation: () => ({ status: "approved" }) })
    expect(await management.decideClaim("claim-1", "approved", "  Statuts et procès-verbal conformes.  ")).toEqual({ ok: true, value: { status: "approved" } })
    expect(calls).toEqual([{ name: "modules/pages/claims:decidePageClaim", args: { networkId: "network-diasporale", claimId: "claim-1", decision: "approved", reason: "Statuts et procès-verbal conformes." } }])
    expect(await management.decideClaim("claim-1", "rejected", " a ")).toEqual({ ok: false, code: "page_decision_reason_length" })
    const closed = source({ mutation: () => { throw new ConvexError({ code: "conflict" }) } })
    expect(await closed.management.decideClaim("claim-1", "rejected", "Pièces illisibles.")).toEqual({ ok: false, code: "page_claim_closed" })
  })

  it("retire ma demande ; une demande tranchée rend `withdrawn: false`", async () => {
    const { management } = source({ mutation: () => ({ withdrawn: false }) })
    expect(await management.withdrawClaim("claim-1")).toEqual({ ok: true, value: { withdrawn: false } })
  })

  it.each(["fileScanPending", "fileScanUnavailable", "fileQuarantined"] as const)("pose le logo par un dépôt neuf ; la retenue %s masque l'adresse", async (withheld) => {
    const deposit = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ storageId: "logo-neuf" })))
    const { management, calls } = source({
      fetch: deposit,
      mutation: (name) => (name === "modules/pages/identity:generatePageImageUploadUrl" ? "https://depot.exemple.test/logo" : { url: "https://images.exemple.test/logo.png", withheld }),
    })
    const logo = pdf("logo.png", "image/png")
    expect(await management.setImage!("page-1", "logo", logo)).toEqual({ ok: true, value: { url: null, withheld } })
    expect(calls).toEqual([
      { name: "modules/pages/identity:generatePageImageUploadUrl", args: { networkId: "network-diasporale", slot: "logo" } },
      { name: "modules/pages/identity:setPageImage", args: { networkId: "network-diasporale", pageId: "page-1", slot: "logo", storageId: "logo-neuf", mimeType: "image/png" } },
    ])
    expect(await management.setImage!("page-1", "banner", pdf("bannière.gif", "image/gif"))).toEqual({ ok: false, code: "page_image_type_invalid" })
  })

  it("met à jour l'identité : un champ vidé est effacé (`null`), jamais inventé", async () => {
    const { management, calls } = source({ mutation: () => ({ changed: true }) })
    expect(await management.updateIdentity("page-1", { name: "Amicale de Lyon", shortName: "  ", description: null, country: "FR" })).toEqual({ ok: true, value: { changed: true } })
    expect(calls).toEqual([{ name: "modules/pages/identity:updatePageIdentity", args: { networkId: "network-diasporale", pageId: "page-1", name: "Amicale de Lyon", shortName: null, description: null, country: "FR" } }])
  })
})

describe("gestion des pages — refus lus dans leur contexte", () => {
  it("une règle connue du contexte l'emporte, sinon la table commune", () => {
    const upload = new ConvexError({ code: "invalidArgument", rule: "UPLOAD_TYPE_NOT_ALLOWED" })
    expect(pageAdminErrorCode(upload)).toBe("media_type_invalid")
    expect(pageAdminErrorCode(upload, { rules: { UPLOAD_TYPE_NOT_ALLOWED: "page_image_type_invalid" } })).toBe("page_image_type_invalid")
    expect(pageAdminErrorCode(new ConvexError({ code: "invalidArgument", rule: "PAGE_NAME_LENGTH" }))).toBe("page_name_invalid")
    expect(pageAdminErrorCode(new ConvexError({ code: "pageRoleRequired" }))).toBe("page_role_required")
  })
})
