// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type {
  ActionResult,
  JobOfferCardView,
  JobOfferDetailView,
  JobsCapability,
  JobSearchRequest,
  JobsPage,
  Loadable,
  MembershipView,
  MyJobApplicationView,
  OwnTalentProfileView,
  ReceivedJobApplicationView,
  SessionView,
  TalentHitView,
} from "@diasporale/features/data"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { JobRecruiterPanel } from "@/components/job-recruiter-panel"
import { skillsOf } from "@/components/job-talent-profile"

import { JobOfferScreen, JobsScreen, MyApplicationsScreen, TalentsScreen, jobFiltersFromParams } from "./jobs-screens"

type Page<Row> = Loadable<JobsPage<Row>>

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
  jobs: null as unknown,
  session: null as unknown,
  membership: null as unknown,
  search: vi.fn(),
  searchPages: new Map<string, unknown>(),
  offer: { status: "loading" } as unknown,
  pageOffers: new Map<string, unknown>(),
  mine: new Map<string, unknown>(),
  received: new Map<string, unknown>(),
  talent: { status: "ready", data: null } as unknown,
  talentPages: new Map<string, unknown>(),
  talentSearch: vi.fn(),
  apply: vi.fn(),
  withdraw: vi.fn(),
  createOffer: vi.fn(),
  updateOffer: vi.fn(),
  setOfferStatus: vi.fn(),
  markSeen: vi.fn(),
  shortlist: vi.fn(),
  markNotSelected: vi.fn(),
  saveTalentProfile: vi.fn(),
  setTalentProfileStatus: vi.fn(),
  removeTalentProfile: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.params,
  useRouter: () => ({ replace: mocks.replace, push: mocks.replace }),
  usePathname: () => "/emploi",
}))
vi.mock("@/components/gate", () => ({
  Gate: (props: { children: (session: { membership: unknown }) => ReactNode }) => <>{props.children({ membership: mocks.membership })}</>,
}))
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock("@diasporale/features/data", async (original) => ({
  ...(await original<typeof import("@diasporale/features/data")>()),
  useJobs: () => mocks.jobs,
  // CC-6 : sans fournisseur de conversations, l'entrée « Écrire » ne s'affiche pas (testée à part).
  useConversations: () => null,
  useSession: () => mocks.session,
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

const MEMBER: MembershipView = {
  personId: "person-me", handle: "recette", displayName: "Recette", status: "verifiee", badges: ["verified"],
  facet: { countryOfResidence: "FR", city: "Paris", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: 1, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "verifiee", derivedFrom: "diasporale" }, canPublish: true, rateTier: "standard", directoryVisibility: "hidden",
}

const EMPLOYER = { id: "page-1", handle: "traiteur-paris", name: "Traiteur Paris (fictif)", ownerKind: "company" as const, badge: "verified" as const, logoUrl: null }

function card(id: string, overrides: Partial<JobOfferCardView> = {}): JobOfferCardView {
  return {
    id, version: 1, title: `Offre ${id}`, description: "Description fictive de recette, assez longue pour le domaine.", contract: "cdi",
    country: "FR", city: "Paris", workMode: "onsite", languages: ["fr"], payRange: { minMinor: 200000, maxMinor: 240000, currency: "EUR", period: "month" },
    closesAt: null, publishedAt: Date.UTC(2026, 9, 15), updatedAt: Date.UTC(2026, 9, 16), employer: EMPLOYER, ...overrides,
  }
}

function detail(id: string, overrides: Partial<JobOfferDetailView> = {}): JobOfferDetailView {
  return { ...card(id), status: "open", viewerCanManage: false, myApplication: null, ...overrides }
}

function mine(id: string, overrides: Partial<MyJobApplicationView> = {}): MyJobApplicationView {
  return {
    id, status: "seen", jobId: "job-1", offerTitle: "Cuisinier (fictif)", offerVersion: 1, offerOpen: true, employer: EMPLOYER,
    message: "Motivation fictive de recette.", sharedTalentProfile: false, createdAt: Date.UTC(2026, 9, 17), updatedAt: Date.UTC(2026, 9, 17), actions: ["withdraw"],
    ...overrides,
  }
}

function received(id: string, overrides: Partial<ReceivedJobApplicationView> = {}): ReceivedJobApplicationView {
  return {
    id, jobId: "job-1", status: "sent", offerVersion: 1, candidate: { displayName: "Mireille Ivindo", handle: "mireille.demo" },
    message: "Motivation fictive de recette.", talentProfile: null, notSelectedReason: null, createdAt: Date.UTC(2026, 9, 17), updatedAt: Date.UTC(2026, 9, 17),
    actions: ["mark_seen", "shortlist", "not_select"], ...overrides,
  }
}

const TALENT: OwnTalentProfileView = {
  id: "talent-1", title: "Comptable bilingue", skills: ["Comptabilité", "Paie"], availability: "one_month", languages: ["fr", "en"], country: "FR",
  visibility: "network", status: "active", version: 2, createdAt: 1, updatedAt: 2,
}

const HIT: TalentHitView = { id: "talent-2", shortName: "Prisca A.", title: "Juriste", skills: ["Droit des contrats"], availability: "immediate", languages: ["fr"], country: "FR", updatedAt: 3 }

function ready<Row>(items: Row[], continueCursor: string | null = null): Page<Row> {
  return { status: "ready", data: { items, isDone: continueCursor === null, continueCursor: continueCursor ?? "" } }
}

const LOADING = { status: "loading" } as const

function capability(): JobsCapability {
  return {
    useSearch: (request: JobSearchRequest) => {
      mocks.search(request)
      return (mocks.searchPages.get(request.cursor ?? "first") ?? LOADING) as Page<JobOfferCardView>
    },
    useOffer: () => mocks.offer as Loadable<JobOfferDetailView | null>,
    usePageOffers: ({ cursor }) => (mocks.pageOffers.get(cursor ?? "first") ?? LOADING) as Page<JobOfferDetailView>,
    useMyApplications: ({ cursor }) => (mocks.mine.get(cursor ?? "first") ?? LOADING) as Page<MyJobApplicationView>,
    useOfferApplications: ({ cursor }) => (mocks.received.get(cursor ?? "first") ?? LOADING) as Page<ReceivedJobApplicationView>,
    useMyTalentProfile: () => mocks.talent as Loadable<OwnTalentProfileView | null>,
    useTalentSearch: (request) => {
      mocks.talentSearch(request)
      return (mocks.talentPages.get(request.cursor ?? "first") ?? LOADING) as Page<TalentHitView>
    },
    createOffer: mocks.createOffer,
    updateOffer: mocks.updateOffer,
    setOfferStatus: mocks.setOfferStatus,
    apply: mocks.apply,
    withdraw: mocks.withdraw,
    markSeen: mocks.markSeen,
    shortlist: mocks.shortlist,
    markNotSelected: mocks.markNotSelected,
    saveTalentProfile: mocks.saveTalentProfile,
    setTalentProfileStatus: mocks.setTalentProfileStatus,
    removeTalentProfile: mocks.removeTalentProfile,
  }
}

function signedIn(membership: MembershipView | null): Loadable<SessionView> {
  return { status: "ready", data: { status: "signed_in", account: {} as never, membership } }
}

function tree(ui: ReactNode, locale: "fr" | "en" = "fr") {
  return <I18nProvider locale={locale}>{ui}</I18nProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.params = new URLSearchParams()
  mocks.membership = { ...MEMBER }
  mocks.session = signedIn({ ...MEMBER })
  mocks.jobs = capability()
  mocks.searchPages.clear()
  mocks.pageOffers.clear()
  mocks.mine.clear()
  mocks.received.clear()
  mocks.talentPages.clear()
  mocks.offer = LOADING
  mocks.talent = { status: "ready", data: null }
  mocks.apply.mockResolvedValue({ ok: true, value: { applicationId: "app-1", created: true } } satisfies ActionResult<unknown>)
  mocks.withdraw.mockResolvedValue({ ok: true, value: { status: "withdrawn" } })
  mocks.createOffer.mockResolvedValue({ ok: true, value: { jobId: "job-new", version: 1, status: "draft" } })
  mocks.setOfferStatus.mockResolvedValue({ ok: true, value: { status: "suspended", version: 2 } })
  mocks.markSeen.mockResolvedValue({ ok: true, value: { status: "seen" } })
  mocks.markNotSelected.mockResolvedValue({ ok: true, value: { status: "not_selected" } })
  mocks.saveTalentProfile.mockResolvedValue({ ok: true, value: { id: "talent-1", version: 1 } })
  mocks.setTalentProfileStatus.mockResolvedValue({ ok: true, value: { status: "hidden", version: 3 } })
  mocks.removeTalentProfile.mockResolvedValue({ ok: true, value: null })
})
afterEach(cleanup)

describe("/emploi — chercher", () => {
  it("lit le pays et la ville de l'adresse, ignore ce qui est illisible", () => {
    expect(jobFiltersFromParams(new URLSearchParams("pays=fr&ville=+Lyon+"))).toEqual({ country: "FR", city: "Lyon" })
    expect(jobFiltersFromParams(new URLSearchParams("pays=ga&ville=+"))).toEqual({})
  })

  it("cherche avec les filtres de l'adresse et montre les offres, le contrat, la rémunération annoncée et la page", () => {
    mocks.params = new URLSearchParams("pays=FR&ville=Paris")
    mocks.searchPages.set("first", ready([card("job-1", { closesAt: Date.UTC(2026, 10, 30) })]))
    render(tree(<JobsScreen />))
    expect(mocks.search).toHaveBeenLastCalledWith({ country: "FR", city: "Paris", cursor: null })
    const list = screen.getByRole("list", { name: "Offres trouvées" })
    expect(within(list).getByRole("link", { name: "Offre job-1" }).getAttribute("href")).toBe("/emploi/job-1")
    expect(within(list).getByText("CDI")).toBeTruthy()
    expect(within(list).getByText(/De 2\s000,00\s€ à 2\s400,00\s€ par mois/)).toBeTruthy()
    expect(within(list).getByText("Publiée par Traiteur Paris (fictif)")).toBeTruthy()
    expect(within(list).getByText(/Candidatures jusqu'au/)).toBeTruthy()
    expect(screen.getByRole("link", { name: "Mes candidatures" }).getAttribute("href")).toBe("/mes-candidatures")
  })

  it("met le pays et la ville dans l'adresse, garde contrat, mode et texte dans l'écran", async () => {
    mocks.searchPages.set("first", ready([card("job-1")]))
    render(tree(<JobsScreen />))
    fireEvent.change(screen.getByLabelText("Ville"), { target: { value: "Lyon" } })
    fireEvent.change(screen.getByLabelText("Contrat"), { target: { value: "internship" } })
    fireEvent.change(screen.getByLabelText("Mode de travail"), { target: { value: "remote" } })
    fireEvent.change(screen.getByLabelText("Rechercher"), { target: { value: "communication" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Rechercher" })) })
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/emploi?ville=Lyon"))
    expect(mocks.search).toHaveBeenLastCalledWith(expect.objectContaining({ query: "communication", contract: "internship", workMode: "remote" }))
  })

  it("pagine sans doublon, explique un vide filtré, dit une panne et une capacité absente", () => {
    mocks.searchPages.set("first", ready([card("a"), card("b")], "next"))
    mocks.searchPages.set("next", ready([card("b"), card("c")]))
    const view = render(tree(<JobsScreen />))
    fireEvent.click(screen.getByRole("button", { name: "Afficher plus" }))
    expect(within(screen.getByRole("list", { name: "Offres trouvées" })).getAllByRole("listitem")).toHaveLength(3)
    view.unmount()

    mocks.params = new URLSearchParams("ville=Ouagadougou")
    mocks.searchPages.set("first", ready<JobOfferCardView>([]))
    const empty = render(tree(<JobsScreen />))
    expect(screen.getByText("Aucune offre ne correspond")).toBeTruthy()
    expect(screen.getByText(/Essayez sans la ville/)).toBeTruthy()
    empty.unmount()

    mocks.searchPages.set("first", { status: "error", code: "network_unavailable" })
    const broken = render(tree(<JobsScreen />))
    expect(screen.getByRole("alert")).toBeTruthy()
    broken.unmount()

    mocks.jobs = null
    render(tree(<JobsScreen />))
    expect(screen.getByText("L'emploi n'est pas disponible ici")).toBeTruthy()
  })

  it("parle anglais avec les mêmes écrans", () => {
    mocks.searchPages.set("first", ready([card("job-1", { payRange: null, workMode: "hybrid" })]))
    render(tree(<JobsScreen />, "en"))
    expect(screen.getByRole("heading", { name: "Jobs in the diaspora" })).toBeTruthy()
    // « Hybrid » est aussi une option du filtre « Work mode » : on lit la carte de l'offre.
    const list = screen.getByRole("list", { name: "Offers found" })
    expect(within(list).getByText("Pay not disclosed")).toBeTruthy()
    expect(within(list).getByText("Hybrid")).toBeTruthy()
  })
})

describe("/emploi/<id> — la fiche et la candidature", () => {
  it("montre la page et son badge, le lieu, la rémunération annoncée, l'absence de coordonnée, puis « Candidater »", () => {
    mocks.offer = { status: "ready", data: detail("job-1", { languages: ["fr", "en"] }) }
    render(tree(<JobOfferScreen jobId="job-1" />))
    expect(screen.getByRole("heading", { level: 1, name: "Offre job-1" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Traiteur Paris (fictif)" }).getAttribute("href")).toBe("/pages/traiteur-paris")
    expect(screen.getByText(/il ne garantit pas l'offre/)).toBeTruthy()
    expect(screen.getByText(/Aucune coordonnée/)).toBeTruthy()
    expect(screen.getByText("Sans date limite")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Candidater" })).toBeTruthy()
  })

  it("au gestionnaire : l'état et le lien de gestion ; à qui a candidaté : l'état de sa candidature, jamais un second envoi", () => {
    mocks.offer = { status: "ready", data: detail("job-1", { status: "suspended", viewerCanManage: true }) }
    const view = render(tree(<JobOfferScreen jobId="job-1" />))
    expect(screen.getByText("Suspendue")).toBeTruthy()
    // L'onglet « Emplois » de la gestion de SA page : jamais la première page d'un sélecteur (docs/32 §10).
    expect(screen.getByRole("link", { name: "Gérer les emplois de la page" }).getAttribute("href")).toBe("/pages/traiteur-paris/gerer?onglet=emplois")
    expect(screen.queryByRole("button", { name: "Candidater" })).toBeNull()
    view.unmount()
    mocks.offer = { status: "ready", data: detail("job-1", { myApplication: { id: "app-1", status: "shortlisted" } }) }
    render(tree(<JobOfferScreen jobId="job-1" />))
    expect(screen.getByText(/Présélectionnée/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Candidater" })).toBeNull()
  })

  it("une offre indisponible est un état neutre ; une panne se réessaie", () => {
    mocks.offer = { status: "ready", data: null }
    const view = render(tree(<JobOfferScreen jobId="close" />))
    expect(screen.getByText("Cette offre n'est pas disponible")).toBeTruthy()
    view.unmount()
    mocks.offer = { status: "error", code: "rate_limited" }
    render(tree(<JobOfferScreen jobId="job-1" />))
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(screen.getByRole("alert")).toBeTruthy()
  })

  it("la feuille refuse sur place : message trop court, consentement absent, coordonnée ; puis envoie avec une clé stable", async () => {
    mocks.offer = { status: "ready", data: detail("job-1", { version: 4 }) }
    mocks.apply
      .mockResolvedValueOnce({ ok: false, code: "rate_limited" })
      .mockResolvedValueOnce({ ok: true, value: { applicationId: "app-9", created: true } })
    render(tree(<JobOfferScreen jobId="job-1" />))
    fireEvent.click(screen.getByRole("button", { name: "Candidater" }))
    const dialog = screen.getByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText("Votre message de motivation"), { target: { value: "Trop court." } })
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Envoyer ma candidature" })) })
    await waitFor(() => expect(within(dialog).getByText("Votre message compte au moins 20 caractères.")).toBeTruthy())
    expect(within(dialog).getByText(/Cochez la case pour accepter/)).toBeTruthy()
    expect(mocks.apply).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText("Votre message de motivation"), { target: { value: "Joignable au 06 12 34 56 78 toute la journée." } })
    fireEvent.click(within(dialog).getByLabelText(/J'accepte que l'équipe de Traiteur Paris/))
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Envoyer ma candidature" })) })
    await waitFor(() => expect(within(dialog).getByText(/Retirez téléphone/)).toBeTruthy())
    expect(mocks.apply).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText("Votre message de motivation"), { target: { value: "Cinq ans de cuisine collective, disponible tout de suite." } })
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Envoyer ma candidature" })) })
    await waitFor(() => expect(within(dialog).getByText(/Trop de demandes/)).toBeTruthy())
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Envoyer ma candidature" })) })
    expect(mocks.apply).toHaveBeenCalledTimes(2)
    expect(mocks.apply.mock.calls[0]![0]).toEqual({
      jobId: "job-1", offerVersion: 4, message: "Cinq ans de cuisine collective, disponible tout de suite.", shareName: true, shareTalentProfile: false, idempotencyKey: expect.any(String),
    })
    expect(mocks.apply.mock.calls[1]![0].idempotencyKey).toBe(mocks.apply.mock.calls[0]![0].idempotencyKey)
    expect(await screen.findByRole("status")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Mes candidatures" }).getAttribute("href")).toBe("/mes-candidatures")
    expect(mocks.success).toHaveBeenCalledWith("Candidature envoyée")
  })

  it("propose de joindre un profil de talent actif, jamais coché d'avance ; une offre close entre-temps se dit", async () => {
    mocks.offer = { status: "ready", data: detail("job-1") }
    mocks.talent = { status: "ready", data: TALENT }
    mocks.apply.mockResolvedValue({ ok: false, code: "not_found" })
    render(tree(<JobOfferScreen jobId="job-1" />))
    fireEvent.click(screen.getByRole("button", { name: "Candidater" }))
    const dialog = screen.getByRole("dialog")
    const attach = within(dialog).getByLabelText(/Joindre mon profil de talent/)
    expect(attach.getAttribute("data-state")).toBe("unchecked")
    fireEvent.click(attach)
    fireEvent.change(within(dialog).getByLabelText("Votre message de motivation"), { target: { value: "Cinq ans de cuisine collective, disponible tout de suite." } })
    fireEvent.click(within(dialog).getByLabelText(/J'accepte que l'équipe/))
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Envoyer ma candidature" })) })
    await waitFor(() => expect(within(dialog).getByText("Cette offre ne reçoit plus de candidatures.")).toBeTruthy())
    expect(mocks.apply.mock.calls[0]![0]).toMatchObject({ shareTalentProfile: true })
  })

  it("un statut insuffisant désactive la candidature et le dit", () => {
    mocks.offer = { status: "ready", data: detail("job-1") }
    mocks.session = signedIn({ ...MEMBER, status: "en_attente", canPublish: false })
    render(tree(<JobOfferScreen jobId="job-1" />))
    expect((screen.getByRole("button", { name: "Candidater" }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Votre statut ne permet pas encore de candidater/)).toBeTruthy()
  })
})

describe("/mes-candidatures", () => {
  it("liste mes candidatures, leur état, et ne propose le retrait que là où il reste ouvert", () => {
    mocks.mine.set("first", ready([mine("a"), mine("b", { status: "not_selected", actions: [], offerOpen: false })]))
    render(tree(<MyApplicationsScreen />))
    const list = screen.getByRole("list", { name: "Mes candidatures" })
    expect(within(list).getAllByRole("listitem")).toHaveLength(2)
    expect(within(list).getByText("Vue par l'équipe")).toBeTruthy()
    expect(within(list).getByText("Non retenue")).toBeTruthy()
    expect(within(list).getAllByRole("button", { name: "Retirer ma candidature" })).toHaveLength(1)
    expect(within(list).getByRole("link", { name: "Cuisinier (fictif)" }).getAttribute("href")).toBe("/emploi/job-1")
  })

  it("retirer se confirme, dit que c'est définitif, puis le dit", async () => {
    mocks.mine.set("first", ready([mine("a")]))
    render(tree(<MyApplicationsScreen />))
    fireEvent.click(screen.getByRole("button", { name: "Retirer ma candidature" }))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByText(/C'est définitif/)).toBeTruthy()
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Retirer définitivement" })) })
    expect(mocks.withdraw).toHaveBeenCalledWith("a")
    expect(mocks.success).toHaveBeenCalledWith("Candidature retirée.")
  })

  it("explique une liste vide", () => {
    mocks.mine.set("first", ready<MyJobApplicationView>([]))
    render(tree(<MyApplicationsScreen />))
    expect(screen.getByText("Aucune candidature pour l'instant")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Voir les offres" }).getAttribute("href")).toBe("/emploi")
  })
})

describe("/talents", () => {
  it("découpe les compétences saisies, une par ligne ou séparées par des virgules", () => {
    expect(skillsOf(" Paie\nComptabilité, Fiscalité ;;\n ")).toEqual(["Paie", "Comptabilité", "Fiscalité"])
  })

  it("sans profil : l'opt-in explicite, jamais coché d'avance, avant toute création", async () => {
    mocks.talentPages.set("first", ready<TalentHitView>([]))
    render(tree(<TalentsScreen />))
    fireEvent.click(screen.getByRole("button", { name: "Créer mon profil de talent" }))
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Comptable bilingue" } })
    fireEvent.change(screen.getByLabelText("Compétences"), { target: { value: "Comptabilité\nPaie" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Créer mon profil" })) })
    await waitFor(() => expect(screen.getByText(/Cochez la case pour confirmer/)).toBeTruthy())
    expect(mocks.saveTalentProfile).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText(/Je choisis de publier ce profil/))
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Créer mon profil" })) })
    await waitFor(() => expect(mocks.saveTalentProfile).toHaveBeenCalledOnce())
    expect(mocks.saveTalentProfile).toHaveBeenCalledWith({
      title: "Comptable bilingue", skills: ["Comptabilité", "Paie"], availability: "open_to_offers", languages: ["fr"], country: "FR", visibility: "network", expectedVersion: null,
    })
    expect(mocks.success).toHaveBeenCalledWith("Profil de talent créé.")
  })

  it("avec un profil : le masquer cite la version lue ; le supprimer se confirme", async () => {
    mocks.talent = { status: "ready", data: TALENT }
    mocks.talentPages.set("first", ready<TalentHitView>([]))
    render(tree(<TalentsScreen />))
    expect(screen.getByText("Comptable bilingue")).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Masquer" })) })
    expect(mocks.setTalentProfileStatus).toHaveBeenCalledWith({ status: "hidden", expectedVersion: 2 })
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))
    await act(async () => { fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Supprimer définitivement" })) })
    expect(mocks.removeTalentProfile).toHaveBeenCalledOnce()
  })

  it("cherche les talents du pays de l'adresse, sans coordonnée ni nom complet ; un refus de statut se dit", () => {
    mocks.params = new URLSearchParams("pays=BE")
    mocks.talentPages.set("first", ready([HIT]))
    const view = render(tree(<TalentsScreen />))
    expect(mocks.talentSearch).toHaveBeenLastCalledWith({ country: "BE", cursor: null })
    const list = screen.getByRole("list", { name: "Talents trouvés" })
    expect(within(list).getByText("Prisca A.")).toBeTruthy()
    expect(within(list).getByText("Droit des contrats")).toBeTruthy()
    expect(within(list).queryByRole("button")).toBeNull()
    expect(screen.getByText(/aucune liste ne se télécharge/)).toBeTruthy()
    view.unmount()
    mocks.talentPages.set("first", { status: "error", code: "status_insufficient" })
    render(tree(<TalentsScreen />))
    expect(screen.getByText(/Votre statut ne permet pas encore ce geste/)).toBeTruthy()
  })
})

describe("JobRecruiterPanel — l'espace recruteur d'une page", () => {
  it("liste les offres de la page, propose les gestes de leur état, et clore se confirme", async () => {
    mocks.pageOffers.set("first", ready([detail("o", { viewerCanManage: true }), detail("d", { status: "draft", viewerCanManage: true }), detail("c", { status: "closed", viewerCanManage: true })]))
    render(tree(<JobRecruiterPanel pageId="page-1" pageHandle="traiteur-paris" />))
    const list = screen.getByRole("list", { name: "Offres d'emploi de la page" })
    expect(within(list).getAllByRole("listitem")).toHaveLength(3)
    expect(within(list).getByRole("button", { name: "Suspendre" })).toBeTruthy()
    expect(within(list).getByRole("button", { name: "Publier" })).toBeTruthy()
    await act(async () => { fireEvent.click(within(list).getByRole("button", { name: "Suspendre" })) })
    expect(mocks.setOfferStatus).toHaveBeenCalledWith({ jobId: "o", expectedVersion: 1, status: "suspended" })
    expect(mocks.success).toHaveBeenCalledWith("Offre suspendue.")
    fireEvent.click(within(list).getAllByRole("button", { name: "Clore" })[0]!)
    mocks.setOfferStatus.mockResolvedValueOnce({ ok: true, value: { status: "closed", version: 2 } })
    await act(async () => { fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Clore définitivement" })) })
    expect(mocks.setOfferStatus).toHaveBeenLastCalledWith({ jobId: "o", expectedVersion: 1, status: "closed" })
  })

  it("crée une offre : refus sur place, puis envoi en unités mineures, sans coordonnée", async () => {
    mocks.pageOffers.set("first", ready<JobOfferDetailView>([]))
    render(tree(<JobRecruiterPanel pageId="page-1" pageHandle="traiteur-paris" />))
    fireEvent.click(screen.getByRole("button", { name: "Nouvelle offre" }))
    expect(document.activeElement).toBe(screen.getByLabelText("Intitulé du poste"))
    fireEvent.change(screen.getByLabelText("Intitulé du poste"), { target: { value: "Ab" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" })) })
    await waitFor(() => expect(screen.getByText("L'intitulé compte au moins 3 caractères.")).toBeTruthy())
    expect(mocks.createOffer).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText("Intitulé du poste"), { target: { value: "Cuisinier en traiteur" } })
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Préparer les plats du pays pour les commandes de la semaine." } })
    fireEvent.click(screen.getByLabelText("Annoncer une fourchette de rémunération"))
    fireEvent.change(screen.getByLabelText("Minimum"), { target: { value: "2000" } })
    fireEvent.change(screen.getByLabelText("Maximum"), { target: { value: "2400,50" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Publier" })) })
    await waitFor(() => expect(mocks.createOffer).toHaveBeenCalledOnce())
    expect(mocks.createOffer).toHaveBeenCalledWith({
      title: "Cuisinier en traiteur", description: "Préparer les plats du pays pour les commandes de la semaine.", contract: "cdi", country: "FR", city: null,
      workMode: "onsite", languages: ["fr"], payRange: { minMinor: 200000, maxMinor: 240050, currency: "EUR", period: "month" }, closesAt: null, pageId: "page-1", publish: true,
    })
    expect(mocks.success).toHaveBeenCalledWith("Offre publiée.")
  })

  it("lit les candidatures d'une offre et décide : vue, puis non retenue avec un motif facultatif", async () => {
    mocks.pageOffers.set("first", ready([detail("o", { viewerCanManage: true })]))
    mocks.received.set("first", ready([received("r1"), received("r2", { status: "withdrawn", candidate: null, message: null, actions: [] })]))
    render(tree(<JobRecruiterPanel pageId="page-1" pageHandle="traiteur-paris" />))
    fireEvent.click(screen.getByRole("button", { name: "Voir les candidatures" }))
    const applications = screen.getByRole("list", { name: "Candidatures reçues" })
    expect(within(applications).getByText("Mireille Ivindo")).toBeTruthy()
    expect(within(applications).getByText(/il n'en reste que l'état/)).toBeTruthy()
    await act(async () => { fireEvent.click(within(applications).getByRole("button", { name: "Marquer comme vue" })) })
    expect(mocks.markSeen).toHaveBeenCalledWith("r1")
    fireEvent.click(within(applications).getByRole("button", { name: "Ne pas retenir" }))
    const dialog = screen.getByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText("Motif (facultatif)"), { target: { value: "Profil plus junior que le poste." } })
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Ne pas retenir" })) })
    expect(mocks.markNotSelected).toHaveBeenCalledWith({ applicationId: "r1", reason: "Profil plus junior que le poste." })
  })

  it("une capacité absente le dit", () => {
    mocks.jobs = null
    render(tree(<JobRecruiterPanel pageId="page-1" pageHandle="traiteur-paris" />))
    expect(screen.getByText("L'emploi n'est pas disponible ici")).toBeTruthy()
  })
})

describe("G9 — l'état de modération, dans les seules vues de gestion", () => {
  it("l'équipe lit l'état de ses offres dans sa liste et sur la fiche ; un autre lecteur ne le lit jamais", () => {
    mocks.pageOffers.set("first", ready([
      detail("p", { viewerCanManage: true, moderation: "pending_review" }),
      detail("r", { viewerCanManage: true, moderation: "removed" }),
      detail("o", { viewerCanManage: true, moderation: "published" }),
    ]))
    const panel = render(tree(<JobRecruiterPanel pageId="page-1" pageHandle="traiteur-paris" />))
    const list = screen.getByRole("list", { name: "Offres d'emploi de la page" })
    expect(within(list).getByText(/l'offre reste invisible des membres/)).toBeTruthy()
    expect(within(list).getByText(/les membres ne voient plus l'offre/)).toBeTruthy()
    expect(within(list).getAllByText(/par la modération/)).toHaveLength(2)
    panel.unmount()

    mocks.offer = { status: "ready", data: detail("job-1", { viewerCanManage: true, moderation: "pending_review" }) }
    const managed = render(tree(<JobOfferScreen jobId="job-1" />))
    expect(screen.getByText("En relecture.")).toBeTruthy()
    managed.unmount()
    // Hors de l'équipe : même un état reçu par erreur ne se montre pas.
    mocks.offer = { status: "ready", data: detail("job-1", { moderation: "removed" }) }
    render(tree(<JobOfferScreen jobId="job-1" />))
    expect(screen.queryByText("Refusée.")).toBeNull()
    expect(screen.getByRole("button", { name: "Candidater" })).toBeTruthy()
  })

  it("la personne lit l'état de sa candidature et de son profil de talent ; publié ou absent, rien n'est dit", () => {
    mocks.mine.set("first", ready([mine("a", { moderation: "removed" }), mine("b", { moderation: "published" }), mine("c")]))
    const view = render(tree(<MyApplicationsScreen />))
    const list = screen.getByRole("list", { name: "Mes candidatures" })
    expect(within(list).getAllByText(/par la modération/)).toHaveLength(1)
    expect(within(list).getByText(/l'équipe de la page ne la voit plus/)).toBeTruthy()
    view.unmount()

    mocks.talent = { status: "ready", data: { ...TALENT, moderation: "pending_review" } }
    mocks.talentPages.set("first", ready<TalentHitView>([]))
    render(tree(<TalentsScreen />, "en"))
    expect(screen.getByText(/your profile appears neither in search nor in your applications/)).toBeTruthy()
  })
})
