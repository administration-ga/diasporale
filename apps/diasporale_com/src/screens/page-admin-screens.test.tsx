// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type {
  ActionResult,
  Loadable,
  ManagedPageDetailView,
  ManagedPageView,
  MembershipView,
  PageAdminCapability,
  PageClaimView,
  PageManagement,
  PageSignatoryView,
} from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, getDefaultNormalizer, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MyPagesPanel } from "@/components/my-pages-panel"
import { PageAdminEntry } from "@/components/page-admin-entry"
import { routes } from "@/lib/routes"

import { NewPageScreen, PageClaimScreen, PageManageScreen } from "./page-admin-screens"

const mocks = vi.hoisted(() => ({
  membership: null as MembershipView | null,
  capability: null as PageAdminCapability | null,
  kind: "engine" as "engine" | "demo",
  jobs: null as unknown,
  push: vi.fn(),
  success: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: vi.fn() } }))
vi.mock("@/components/gate", () => ({
  Gate: (props: { children: (session: { membership: MembershipView | null }) => ReactNode }) => <>{props.children({ membership: mocks.membership })}</>,
}))
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock("@diasporale/features/data", async (original) => ({
  ...(await original<typeof import("@diasporale/features/data")>()),
  usePageAdmin: () => mocks.capability,
  useDataSource: () => ({ kind: mocks.kind }),
  // Capacités voisines des onglets (avis DG-016, décisions P16) : absentes ici, sans fournisseur de données.
  useServiceReviews: () => null,
  usePageDecisions: () => null,
  // DG-025 : le fournisseur des emplois, présent ou absent selon le test.
  useJobs: () => mocks.jobs,
}))
// Le recrutement a son contrat de composant propre ; ici, seulement son montage pour LA page gérée.
vi.mock("@/components/job-recruiter-panel", () => ({
  JobRecruiterPanel: (props: { readonly pageId: string; readonly pageHandle: string }) => <section aria-label={`Recrutement de ${props.pageHandle}`} data-page={props.pageId} />,
}))

const t = getFixedT("fr")
const normalize = getDefaultNormalizer()
/** Le texte tel que l'écran le lit (espaces insécables ramenées à l'espace simple). */
const text = (key: string, values: Record<string, unknown> = {}) => normalize(String(t(key, values)))
/** Le nom accessible garde les espaces insécables : il se compare au texte brut. */
const raw = (key: string, values: Record<string, unknown> = {}) => String(t(key, values))

function membership(status: MembershipView["status"] = "verifiee"): MembershipView {
  return {
    personId: "person-me",
    handle: "awa.demo",
    displayName: "Awa",
    status,
    badges: ["verified"],
    facet: { countryOfResidence: "FR", city: "Lyon", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
    joinedAt: 1,
    verifiedSince: 1,
    sponsoredBy: null,
    attestation: { outcome: "none", postSlug: null, requestedAt: null },
    root: { network: "antsia", status: "verifiee", derivedFrom: "diasporale" },
    canPublish: true,
    rateTier: "standard",
    directoryVisibility: "hidden",
  } as MembershipView
}

const PAGE: ManagedPageDetailView = {
  id: "page-1",
  handle: "amicale-lyon",
  name: "Amicale de Lyon",
  ownerKind: "association",
  badge: "community",
  country: "FR",
  shortName: null,
  description: "Accueil des nouveaux arrivants.",
  logoUrl: null,
  bannerUrl: null,
  myRole: "admin",
}

const ME: PageSignatoryView = { personId: "person-me", handle: "awa.demo", displayName: "Awa", role: "admin", accepted: true, since: 1, isMe: true }
const OTHER: PageSignatoryView = { personId: "person-2", handle: "steeve.demo", displayName: "Steeve", role: "signatory", accepted: true, since: 2, isMe: false }

const PENDING_CLAIM: PageClaimView = {
  id: "claim-1",
  page: { id: "page-1", handle: "amicale-lyon", name: "Amicale de Lyon", ownerKind: "association", badge: "community", country: "FR" },
  claimant: { personId: "person-me", handle: "awa.demo", displayName: "Awa" },
  status: "pending",
  note: "Mandat déclaré : présidence.",
  evidenceCount: 2,
  decisionReason: null,
  createdAt: Date.UTC(2026, 9, 1),
  decidedAt: null,
}

const ok = <T,>(value: T): Promise<ActionResult<T>> => Promise.resolve({ ok: true, value })
const ready = <T,>(data: T): Loadable<T> => ({ status: "ready", data })

function management(overrides: Partial<PageManagement> = {}): PageManagement {
  return {
    useManagedPage: () => ready(PAGE),
    useSignatories: () => ready([ME, OTHER]),
    useMyInvitations: () => ready([]),
    useMyClaims: () => ready([]),
    useClaimQueue: () => ready(null),
    useClaim: () => ready(null),
    createPage: vi.fn(() => ok({ pageId: "page-neuve", handle: "saveurs-de-lille" })),
    updateIdentity: vi.fn(() => ok({ changed: true })),
    grantRole: vi.fn(() => ok({ personId: "person-3", role: "signatory" as const, invited: true })),
    revokeRole: vi.fn(() => ok({ revoked: true })),
    respondToInvitation: vi.fn(() => ok({ role: "signatory" as const })),
    requestClaim: vi.fn(() => ok({ claimId: "claim-neuve" })),
    withdrawClaim: vi.fn(() => ok({ withdrawn: true })),
    decideClaim: vi.fn(() => ok({ status: "approved" as const })),
    ...overrides,
  }
}

function provide(manage: PageManagement | null, myPages: Loadable<readonly ManagedPageView[]> = ready([])) {
  mocks.capability = { useMyPages: () => myPages, ...(manage ? { management: manage } : {}) }
  return manage
}

const wrap = (ui: ReactNode) => render(<I18nProvider locale="fr">{ui}</I18nProvider>)

beforeEach(() => {
  mocks.membership = membership()
  mocks.capability = null
  mocks.kind = "engine"
  mocks.jobs = null
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("créer une page", () => {
  it("crée une page d'entreprise valide et mène à sa fiche", async () => {
    const manage = provide(management())!
    const user = userEvent.setup()
    wrap(<NewPageScreen kind="company" />)
    expect(screen.getByRole("radio", { name: new RegExp(text("pageAdmin.kind.company")) })).toBeChecked()
    await user.type(screen.getByLabelText(text("pageAdmin.create.name")), "Saveurs de Lille")
    expect(screen.getByText(text("pageAdmin.create.handlePreview", { handle: "saveurs-de-lille" }))).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: text("pageAdmin.create.submit") }))
    await waitFor(() => expect(manage.createPage).toHaveBeenCalledExactlyOnceWith({ ownerKind: "company", name: "Saveurs de Lille", country: "FR" }))
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(routes.page("saveurs-de-lille")))
  })

  it("refuse un nom vide et une adresse trop courte avant toute écriture", async () => {
    const manage = provide(management())!
    const user = userEvent.setup()
    wrap(<NewPageScreen kind={null} />)
    await user.type(screen.getByLabelText(text("pageAdmin.create.handle")), "ab")
    await user.click(screen.getByRole("button", { name: text("pageAdmin.create.submit") }))
    expect(await screen.findByText(text("errors.page_name_invalid"))).toBeInTheDocument()
    expect(screen.getByText(text("errors.page_handle_length"))).toBeInTheDocument()
    expect(manage.createPage).not.toHaveBeenCalled()
  })

  it("traduit le refus du serveur et explique comment obtenir une adhésion vérifiée", async () => {
    provide(management({ createPage: vi.fn(() => Promise.resolve({ ok: false as const, code: "page_verified_required" as const })) }))
    const user = userEvent.setup()
    wrap(<NewPageScreen kind="association" />)
    await user.type(screen.getByLabelText(text("pageAdmin.create.name")), "Amicale de Lille")
    await user.click(screen.getByRole("button", { name: text("pageAdmin.create.submit") }))
    expect(await screen.findByRole("alert")).toHaveTextContent(text("errors.page_verified_required"))
    expect(screen.getByRole("link", { name: text("pageAdmin.create.verifiedOnly.attestation") })).toHaveAttribute("href", routes.attestation())
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("un membre déclaré lit pourquoi, sans formulaire", () => {
    mocks.membership = membership("declaree")
    provide(management())
    wrap(<NewPageScreen kind="association" />)
    expect(screen.getByRole("heading", { name: text("pageAdmin.create.verifiedOnly.title") })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: text("pageAdmin.create.submit") })).not.toBeInTheDocument()
  })

  it("dit « indisponible » quand le fournisseur ne sert pas la capacité", () => {
    provide(null)
    wrap(<NewPageScreen kind="association" />)
    expect(screen.getByText(text("pageAdmin.unavailable.title"))).toBeInTheDocument()
  })
})

describe("revendiquer une page", () => {
  const claimable: ManagedPageDetailView = { ...PAGE, myRole: null }

  async function fillClaim(user: ReturnType<typeof userEvent.setup>, files: File[]) {
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(input, { target: { files } })
    await user.click(screen.getByRole("radio", { name: text("pageAdmin.claim.mandate.legal_representative") }))
    await user.type(screen.getByLabelText(text("pageAdmin.claim.details")), "Élue le 3 mai.")
  }

  it("dépose les pièces, le mandat déclaré et le consentement explicite", async () => {
    const manage = provide(management({ useManagedPage: () => ready(claimable) }))!
    const user = userEvent.setup()
    wrap(<PageClaimScreen handle="amicale-lyon" />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(text("pageAdmin.claim.title", { name: "Amicale de Lyon" }))
    const statutes = new File(["statuts"], "statuts.pdf", { type: "application/pdf" })
    await fillClaim(user, [statutes])
    expect(screen.getByRole("checkbox")).not.toBeChecked()
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: text("pageAdmin.claim.submit") }))
    await waitFor(() => expect(manage.requestClaim).toHaveBeenCalledExactlyOnceWith({
      pageId: "page-1",
      note: String(t("pageAdmin.claim.noteWithDetails", { mandate: t("pageAdmin.claim.mandate.legal_representative"), details: "Élue le 3 mai." })),
      evidence: [statutes],
    }))
    expect(mocks.success).toHaveBeenCalledWith(t("pageAdmin.claim.sent"))
  })

  it("refuse sans pièce, une pièce d'un type refusé, ou sans consentement", async () => {
    const manage = provide(management({ useManagedPage: () => ready(claimable) }))!
    const user = userEvent.setup()
    wrap(<PageClaimScreen handle="amicale-lyon" />)
    await fillClaim(user, [new File(["gif"], "photo.gif", { type: "image/gif" })])
    expect(screen.getByText(text("errors.page_claim_evidence_type"))).toBeInTheDocument()
    expect(screen.queryByText("photo.gif")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: text("pageAdmin.claim.submit") }))
    expect(await screen.findByText(text("errors.page_claim_consent_required"))).toBeInTheDocument()
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: text("pageAdmin.claim.submit") }))
    expect(await screen.findByText(text("errors.page_claim_evidence_count"))).toBeInTheDocument()
    expect(manage.requestClaim).not.toHaveBeenCalled()
  })

  it("traduit un refus du serveur (déjà administrée)", async () => {
    provide(management({ useManagedPage: () => ready(claimable), requestClaim: vi.fn(() => Promise.resolve({ ok: false as const, code: "page_already_claimed" as const })) }))
    const user = userEvent.setup()
    wrap(<PageClaimScreen handle="amicale-lyon" />)
    await fillClaim(user, [new File(["pdf"], "statuts.pdf", { type: "application/pdf" })])
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: text("pageAdmin.claim.submit") }))
    expect(await screen.findByText(text("errors.page_already_claimed"))).toBeInTheDocument()
  })

  it("une demande en attente se suit et se retire après confirmation", async () => {
    const manage = provide(management({ useManagedPage: () => ready(claimable), useMyClaims: () => ready([PENDING_CLAIM]) }))!
    const user = userEvent.setup()
    wrap(<PageClaimScreen handle="amicale-lyon" />)
    expect(screen.getByRole("heading", { name: text("pageAdmin.claim.pendingTitle") })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: text("pageAdmin.claim.submit") })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: text("pageAdmin.claim.withdraw") }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: text("pageAdmin.claim.withdraw") }))
    await waitFor(() => expect(manage.withdrawClaim).toHaveBeenCalledExactlyOnceWith("claim-1"))
  })

  it("une page officielle ne se revendique pas, et « Vérifié » n'est jamais « Officiel »", () => {
    provide(management({ useManagedPage: () => ready({ ...PAGE, badge: "official", myRole: null }) }))
    wrap(<PageClaimScreen handle="poste" />)
    expect(screen.getByText(text("pageAdmin.claim.officialPage"))).toBeInTheDocument()
    expect(screen.getByText(text("pageAdmin.claim.how.notOfficial"))).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: text("pageAdmin.claim.submit") })).not.toBeInTheDocument()
  })
})

describe("gérer une page — équipe", () => {
  it("le dernier administrateur ne peut pas partir et le sait", () => {
    provide(management({ useSignatories: () => ready([ME, OTHER]) }))
    wrap(<PageManageScreen handle="amicale-lyon" tab="equipe" />)
    expect(screen.getByRole("button", { name: text("pageAdmin.team.leave") })).toBeDisabled()
    expect(screen.getByText(text("pageAdmin.team.lastAdmin"))).toBeInTheDocument()
  })

  it("traduit le refus du dernier administrateur rendu par le serveur", async () => {
    const SECOND: PageSignatoryView = { ...OTHER, role: "admin" }
    provide(management({
      useSignatories: () => ready([ME, SECOND]),
      revokeRole: vi.fn(() => Promise.resolve({ ok: false as const, code: "page_last_admin" as const })),
    }))
    const user = userEvent.setup()
    wrap(<PageManageScreen handle="amicale-lyon" tab="equipe" />)
    await user.click(screen.getByRole("button", { name: text("pageAdmin.team.leave") }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: text("pageAdmin.team.leave") }))
    expect(await screen.findByText(text("errors.page_last_admin"))).toBeInTheDocument()
  })

  it("retire un signataire après confirmation", async () => {
    const manage = provide(management())!
    const user = userEvent.setup()
    wrap(<PageManageScreen handle="amicale-lyon" tab="equipe" />)
    await user.click(screen.getByRole("button", { name: text("pageAdmin.team.removeLabel", { name: "Steeve" }) }))
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveTextContent(text("pageAdmin.team.removeConfirmTitle", { name: "Steeve" }))
    await user.click(within(dialog).getByRole("button", { name: text("pageAdmin.team.remove") }))
    await waitFor(() => expect(manage.revokeRole).toHaveBeenCalledExactlyOnceWith("page-1", "person-2"))
    expect(mocks.success).toHaveBeenCalledWith(t("pageAdmin.team.removed"))
  })

  it("invite par identifiant ; un identifiant invalide est refusé avant le serveur", async () => {
    const manage = provide(management())!
    const user = userEvent.setup()
    wrap(<PageManageScreen handle="amicale-lyon" tab="equipe" />)
    const handle = screen.getByLabelText(text("pageAdmin.team.handle"))
    await user.type(handle, "a")
    await user.click(screen.getByRole("button", { name: text("pageAdmin.team.invite") }))
    expect(await screen.findByText(text("errors.handle_length"))).toBeInTheDocument()
    expect(manage.grantRole).not.toHaveBeenCalled()
    await user.clear(handle)
    await user.type(handle, "@Prisca.Abanga")
    await user.click(screen.getByRole("button", { name: text("pageAdmin.team.invite") }))
    await waitFor(() => expect(manage.grantRole).toHaveBeenCalledExactlyOnceWith("page-1", "prisca.abanga", "signatory"))
    expect(mocks.success).toHaveBeenCalledWith(t("pageAdmin.team.invitedToast"))
  })

  it("un rôle retiré ferme l'équipe (refus réactif) puis la gestion", () => {
    const manage = management({ useSignatories: () => ({ status: "error", code: "page_role_required" }) })
    provide(manage)
    const view = wrap(<PageManageScreen handle="amicale-lyon" tab="equipe" />)
    expect(screen.getByRole("alert")).toHaveTextContent(text("errors.page_role_required"))
    // La lecture de la page dit aussitôt qu'aucun rôle ne reste : l'écran se ferme.
    provide({ ...manage, useManagedPage: () => ready({ ...PAGE, myRole: null }) })
    view.rerender(<I18nProvider locale="fr"><PageManageScreen handle="amicale-lyon" tab="equipe" /></I18nProvider>)
    expect(screen.getByText(text("pageAdmin.manage.notManager.title"))).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: text("pageAdmin.team.invite") })).not.toBeInTheDocument()
  })

  it("un signataire voit l'équipe sans pouvoir la changer", () => {
    provide(management({ useManagedPage: () => ready({ ...PAGE, myRole: "signatory" }), useSignatories: () => ready([{ ...ME, role: "signatory" }, { ...OTHER, role: "admin" }]) }))
    wrap(<PageManageScreen handle="amicale-lyon" tab="equipe" />)
    expect(screen.getByText(text("pageAdmin.team.readOnly"))).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: text("pageAdmin.team.removeLabel", { name: "Steeve" }) })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: text("pageAdmin.team.leave") })).toBeEnabled()
  })
})

describe("gérer une page — emplois (DG-025)", () => {
  it("l'onglet n'existe qu'avec le fournisseur des emplois, et monte le recrutement de CETTE page", () => {
    provide(management())
    const view = wrap(<PageManageScreen handle="amicale-lyon" tab="identite" />)
    expect(screen.queryByRole("link", { name: "Emplois" })).toBeNull()
    view.unmount()
    mocks.jobs = {}
    wrap(<PageManageScreen handle="amicale-lyon" tab="emplois" />)
    expect(screen.getByRole("link", { name: "Emplois" })).toHaveAttribute("href", routes.pageManage("amicale-lyon", "emplois"))
    expect(screen.getByRole("region", { name: "Recrutement de amicale-lyon" })).toHaveAttribute("data-page", "page-1")
  })
})

describe("gérer une page — identité et vérification", () => {
  it("enregistre l'identité ; un nom vide est refusé avant le serveur", async () => {
    const manage = provide(management())!
    const user = userEvent.setup()
    wrap(<PageManageScreen handle="amicale-lyon" tab="identite" />)
    const name = screen.getByLabelText(text("pageAdmin.create.name"))
    await user.clear(name)
    await user.click(screen.getByRole("button", { name: text("pageAdmin.identity.save") }))
    expect(await screen.findByText(text("errors.page_name_invalid"))).toBeInTheDocument()
    expect(manage.updateIdentity).not.toHaveBeenCalled()
    await user.type(name, "Amicale gabonaise de Lyon")
    await user.type(screen.getByLabelText(text("pageAdmin.create.shortName")), "AGL")
    await user.click(screen.getByRole("button", { name: text("pageAdmin.identity.save") }))
    await waitFor(() => expect(manage.updateIdentity).toHaveBeenCalledExactlyOnceWith("page-1", {
      name: "Amicale gabonaise de Lyon",
      shortName: "AGL",
      description: "Accueil des nouveaux arrivants.",
      country: "FR",
    }))
  })

  it("pose le logo par la garde des fichiers ; une image refusée ne part pas", async () => {
    const setImage = vi.fn(() => ok({ url: null, withheld: "fileScanPending" as const }))
    provide(management({ setImage }))
    wrap(<PageManageScreen handle="amicale-lyon" tab="identite" />)
    const logo = screen.getByLabelText(text("pageAdmin.images.chooseLogo"))
    fireEvent.change(logo, { target: { files: [new File(["gif"], "logo.gif", { type: "image/gif" })] } })
    expect(await screen.findByText(text("errors.page_image_type_invalid"))).toBeInTheDocument()
    expect(setImage).not.toHaveBeenCalled()
    const png = new File(["png"], "logo.png", { type: "image/png" })
    fireEvent.change(logo, { target: { files: [png] } })
    await waitFor(() => expect(setImage).toHaveBeenCalledExactlyOnceWith("page-1", "logo", png))
    expect(await screen.findByText(text("pageAdmin.images.pending"))).toBeInTheDocument()
  })

  it("sans dépôt de fichier chez le fournisseur (démonstration), aucune commande d'image n'est promise", () => {
    provide(management())
    wrap(<PageManageScreen handle="amicale-lyon" tab="identite" />)
    expect(screen.queryByText(text("pageAdmin.images.title"))).not.toBeInTheDocument()
  })

  it("un signataire lit l'identité sans pouvoir la modifier", () => {
    provide(management({ useManagedPage: () => ready({ ...PAGE, myRole: "signatory" }) }))
    wrap(<PageManageScreen handle="amicale-lyon" tab="identite" />)
    expect(screen.getByText(text("pageAdmin.identity.adminOnly"))).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: text("pageAdmin.identity.save") })).not.toBeInTheDocument()
  })

  it("dit la confiance sans ambiguïté et propose la vérification à l'administrateur", () => {
    provide(management())
    wrap(<PageManageScreen handle="amicale-lyon" tab="revendications" />)
    expect(screen.getByText(text("pageAdmin.verification.state.community"))).toBeInTheDocument()
    expect(screen.getByRole("link", { name: text("pageAdmin.verification.request") })).toHaveAttribute("href", routes.pageClaim("amicale-lyon"))
  })

  it("une page illisible rend le même écran qu'une page inconnue", () => {
    provide(management({ useManagedPage: () => ready(null) }))
    wrap(<PageManageScreen handle="inconnue" tab="identite" />)
    expect(screen.getByText(text("page.unavailableTitle"))).toBeInTheDocument()
  })
})

describe("gestes depuis la fiche et « Mon activité »", () => {
  it("propose « Gérer » au signataire vivant et « Demander la vérification » à l'administrateur", () => {
    provide(management())
    wrap(<PageAdminEntry pageId="page-1" handle="amicale-lyon" viewerRole="admin" claimable />)
    expect(screen.getByRole("link", { name: text("pageAdmin.entry.manage") })).toHaveAttribute("href", routes.pageManage("amicale-lyon"))
    expect(screen.getByRole("link", { name: text("pageAdmin.entry.verify") })).toHaveAttribute("href", routes.pageClaim("amicale-lyon"))
  })

  it("propose « Revendiquer » à un lecteur sur une page revendicable, rien à un signataire", () => {
    provide(management())
    const view = wrap(<PageAdminEntry pageId="page-1" handle="amicale-lyon" viewerRole={null} claimable />)
    expect(screen.getByRole("link", { name: text("pageAdmin.entry.claim") })).toHaveAttribute("href", routes.pageClaim("amicale-lyon"))
    view.rerender(<I18nProvider locale="fr"><PageAdminEntry pageId="page-1" handle="amicale-lyon" viewerRole="signatory" claimable /></I18nProvider>)
    expect(screen.queryByRole("link", { name: text("pageAdmin.entry.claim") })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: text("pageAdmin.entry.manage") })).toBeInTheDocument()
  })

  it("dit l'état de ma revendication en cours au lieu de proposer une seconde demande", () => {
    provide(management({ useMyClaims: () => ready([PENDING_CLAIM]) }))
    wrap(<PageAdminEntry pageId="page-1" handle="amicale-lyon" viewerRole={null} claimable />)
    expect(screen.getByRole("status")).toHaveTextContent(text("pageAdmin.entry.pending"))
    expect(screen.queryByRole("link", { name: text("pageAdmin.entry.claim") })).not.toBeInTheDocument()
  })

  it("ne promet rien sans la capacité", () => {
    mocks.capability = null
    const view = wrap(<PageAdminEntry pageId="page-1" handle="amicale-lyon" viewerRole={null} claimable />)
    expect(view.container).toBeEmptyDOMElement()
  })

  it("liste mes pages et mes invitations ; accepter répond au moteur", async () => {
    const manage = provide(
      management({ useMyInvitations: () => ready([{ page: { ...PENDING_CLAIM.page, id: "page-9", name: "Saveurs (démo)" }, role: "signatory" as const, invitedAt: 1 }]) }),
      ready([{ id: "page-1", handle: "amicale-lyon", name: "Amicale de Lyon", ownerKind: "association", role: "admin", badge: "community" }]),
    )!
    const user = userEvent.setup()
    wrap(<MyPagesPanel />)
    expect(screen.getByRole("link", { name: text("pageAdmin.myPages.manageLabel", { name: "Amicale de Lyon" }) })).toHaveAttribute("href", routes.pageManage("amicale-lyon"))
    expect(screen.getByRole("link", { name: text("pageAdmin.myPages.createAssociation") })).toHaveAttribute("href", routes.newPage("association"))
    await user.click(screen.getByRole("button", { name: text("pageAdmin.invitations.accept") }))
    await waitFor(() => expect(manage.respondToInvitation).toHaveBeenCalledExactlyOnceWith("page-9", true))
  })

  it("montre la file d'instruction à la seule modération et y tranche par une décision motivée", async () => {
    const decideClaim = vi.fn(() => ok({ status: "approved" as const }))
    provide(management({
      useClaimQueue: () => ready({ items: [PENDING_CLAIM], continueCursor: null }),
      useClaim: () => ready({ ...PENDING_CLAIM, evidence: [{ url: null, withheld: "fileScanPending" as const }, { url: "https://depot.exemple.test/piece", withheld: null }] }),
      decideClaim,
    }))
    const user = userEvent.setup()
    wrap(<MyPagesPanel />)
    await user.click(screen.getByRole("button", { name: text("pageAdmin.review.open") }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(text("pageAdmin.review.evidencePending", { index: 1 }))).toBeInTheDocument()
    expect(within(dialog).getByRole("link", { name: text("pageAdmin.review.evidenceOpen", { index: 2 }) })).toHaveAttribute("href", "https://depot.exemple.test/piece")
    await user.click(within(dialog).getByRole("button", { name: text("pageAdmin.review.submit") }))
    expect(await within(dialog).findByText(text("errors.page_decision_required"))).toBeInTheDocument()
    await user.click(within(dialog).getByRole("radio", { name: raw("pageAdmin.review.decision.approved") }))
    await user.type(within(dialog).getByLabelText(text("pageAdmin.review.reason")), "ok")
    await user.click(within(dialog).getByRole("button", { name: text("pageAdmin.review.submit") }))
    expect(await within(dialog).findByText(text("errors.page_decision_reason_length"))).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(text("pageAdmin.review.reason")), " : statuts conformes")
    await act(async () => {
      await user.click(within(dialog).getByRole("button", { name: text("pageAdmin.review.submit") }))
    })
    await waitFor(() => expect(decideClaim).toHaveBeenCalledExactlyOnceWith("claim-1", "approved", "ok : statuts conformes"))
  })

  it("aucune file pour qui ne modère pas", () => {
    provide(management())
    wrap(<MyPagesPanel />)
    expect(screen.queryByText(text("pageAdmin.review.title"))).not.toBeInTheDocument()
    expect(screen.getByText(text("pageAdmin.myPages.emptyTitle"))).toBeInTheDocument()
  })
})
