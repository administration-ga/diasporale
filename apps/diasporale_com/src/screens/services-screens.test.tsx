// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type {
  ActionResult,
  Loadable,
  ManagedPageView,
  MembershipView,
  PageAdminCapability,
  ServiceOfferCardView,
  ServiceOfferDetailView,
  ServiceOffersPage,
  ServicesCapability,
  ServiceSearchRequest,
  SessionView,
} from "@diasporale/features/data"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PageServicesSection } from "@/components/page-services-section"

import { MyActivityScreen, ServiceOfferScreen, ServicesScreen, filtersFromParams } from "./services-screens"

type Page<Row> = Loadable<ServiceOffersPage<Row>>

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
  services: null as unknown,
  pageAdmin: null as unknown,
  membership: null as unknown,
  session: null as unknown,
  search: vi.fn(),
  searchPages: new Map<string, unknown>(),
  offer: { status: "loading" } as unknown,
  myPages: new Map<string, unknown>(),
  pageOffers: new Map<string, unknown>(),
  create: vi.fn(),
  update: vi.fn(),
  setStatus: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  requestEntry: vi.fn(),
  inbox: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.params,
  useRouter: () => ({ replace: mocks.replace, push: mocks.replace }),
  usePathname: () => "/services",
}))
vi.mock("@/components/gate", () => ({
  Gate: (props: { children: (session: { membership: unknown }) => ReactNode }) => <>{props.children({ membership: mocks.membership })}</>,
}))
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock("@/components/service-request-entry", () => ({
  ServiceRequestEntry: (props: Record<string, unknown>) => {
    mocks.requestEntry(props)
    return <p>demande-structurée</p>
  },
}))
vi.mock("@/components/service-inbox", () => ({
  ServiceInbox: (props: Record<string, unknown>) => {
    mocks.inbox(props)
    return <p>demandes-reçues</p>
  },
}))
vi.mock("@/components/my-pages-panel", () => ({ MyPagesPanel: () => <p>mes-pages</p> }))
// Les avis ont leur contrat de composant propre ; cette fixture isole le catalogue.
vi.mock("@/components/service-reviews-section", () => ({ ServiceOfferReviews: () => null }))
vi.mock("@diasporale/features/data", async (original) => ({
  ...(await original<typeof import("@diasporale/features/data")>()),
  useServices: () => mocks.services,
  usePageAdmin: () => mocks.pageAdmin,
  // La gestion des offres et la section d'une page relisent la source et la session : la personne de l'écran.
  useDataSource: () => ({ kind: "demo" }),
  useSession: () => mocks.session,
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

const MEMBER: MembershipView = {
  personId: "person-me", handle: "recette", displayName: "Recette", status: "verifiee", badges: ["verified"],
  facet: { countryOfResidence: "FR", city: "Paris", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: 1, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "verifiee", derivedFrom: "diasporale" }, canPublish: true, rateTier: "standard", directoryVisibility: "hidden",
}

function signedIn(membership: MembershipView): Loadable<SessionView> {
  return { status: "ready", data: { status: "signed_in", account: { id: "account-me", idn: null, local: null, nameHints: {} }, membership } }
}

function card(id: string, overrides: Partial<ServiceOfferCardView> = {}): ServiceOfferCardView {
  return {
    id, version: 1, title: `Offre ${id}`, description: "Description fictive de recette.", category: "beauty", country: "FR", city: "Paris",
    delivery: "onsite", languages: ["fr"], durationMinutes: 90, pricing: { mode: "from", amountMinor: 6000, currency: "EUR" },
    provider: { id: "page-1", handle: "coiffure-paris", name: "Coiffure Paris (fictif)", ownerKind: "company", badge: "verified", logoUrl: null },
    budgetFit: null, updatedAt: Date.UTC(2026, 9, 17), ...overrides,
  }
}

function detail(id: string, overrides: Partial<ServiceOfferDetailView> = {}): ServiceOfferDetailView {
  return { ...card(id), status: "active", viewerCanManage: false, ...overrides }
}

function ready<Row>(items: Row[], continueCursor: string | null = null): Page<Row> {
  return { status: "ready", data: { items, isDone: continueCursor === null, continueCursor: continueCursor ?? "" } }
}

const LOADING = { status: "loading" } as const

function capability(): ServicesCapability {
  return {
    useSearch: (request: ServiceSearchRequest) => {
      mocks.search(request)
      return (mocks.searchPages.get(request.cursor ?? "first") ?? LOADING) as Page<ServiceOfferCardView>
    },
    useOffer: () => mocks.offer as Loadable<ServiceOfferDetailView | null>,
    usePageOffers: ({ cursor }) => (mocks.pageOffers.get(cursor ?? "first") ?? LOADING) as Page<ServiceOfferCardView>,
    useMyPageOffers: ({ cursor }) => (mocks.myPages.get(cursor ?? "first") ?? LOADING) as Page<ServiceOfferDetailView>,
    createOffer: mocks.create,
    updateOffer: mocks.update,
    setOfferStatus: mocks.setStatus,
  }
}

const COMPANY: ManagedPageView = { id: "page-1", handle: "coiffure-paris", name: "Coiffure Paris (fictif)", ownerKind: "company", role: "admin" }
const INSTITUTION: ManagedPageView = { id: "page-2", handle: "poste-demo", name: "Poste fictif", ownerKind: "institution", role: "admin" }

function pageAdmin(pages: Loadable<readonly ManagedPageView[]>): PageAdminCapability {
  return { useMyPages: () => pages } as PageAdminCapability
}

function tree(ui: ReactNode, locale: "fr" | "en" = "fr") {
  return <I18nProvider locale={locale}>{ui}</I18nProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.params = new URLSearchParams()
  mocks.membership = { ...MEMBER }
  mocks.session = signedIn({ ...MEMBER })
  mocks.services = capability()
  mocks.pageAdmin = pageAdmin({ status: "ready", data: [COMPANY, INSTITUTION] })
  mocks.searchPages.clear()
  mocks.myPages.clear()
  mocks.pageOffers.clear()
  mocks.offer = LOADING
  mocks.create.mockResolvedValue({ ok: true, value: { offerId: "offer-new", version: 1, status: "draft" } } satisfies ActionResult<unknown>)
  mocks.update.mockResolvedValue({ ok: true, value: { version: 2 } })
  mocks.setStatus.mockResolvedValue({ ok: true, value: { status: "paused", version: 2 } })
})
afterEach(cleanup)

describe("/services — le catalogue", () => {
  it("lit les filtres de l'adresse, ignore ce qui est illisible", () => {
    expect(filtersFromParams(new URLSearchParams("q=+tresses+&pays=fr&ville=Paris&categorie=beauty&mode=onsite"))).toEqual({ q: "tresses", country: "FR", city: "Paris", category: "beauty", delivery: "onsite" })
    expect(filtersFromParams(new URLSearchParams("pays=ga&categorie=sante&mode=partout&ville=+"))).toEqual({})
  })

  it("cherche avec les filtres de l'adresse et montre les offres, le tarif annoncé et la page", () => {
    mocks.params = new URLSearchParams("q=tresses&ville=Paris&mode=onsite")
    mocks.searchPages.set("first", ready([card("o1")]))
    render(tree(<ServicesScreen />))
    expect(mocks.search).toHaveBeenLastCalledWith({ query: "tresses", city: "Paris", delivery: "onsite", cursor: null })
    const list = screen.getByRole("list", { name: "Offres trouvées" })
    expect(within(list).getByRole("link", { name: "Offre o1" }).getAttribute("href")).toBe("/services/o1")
    expect(within(list).getByText(/À partir de 60,00/)).toBeTruthy()
    expect(within(list).getByText("Proposé par Coiffure Paris (fictif)")).toBeTruthy()
    expect((screen.getByLabelText("Ville") as HTMLInputElement).value).toBe("Paris")
  })

  it("met les filtres dans l'adresse et garde le budget dans l'écran", async () => {
    mocks.searchPages.set("first", ready([card("o1", { budgetFit: "quote", pricing: { mode: "quote" } })]))
    render(tree(<ServicesScreen />))
    fireEvent.change(screen.getByLabelText("Ville"), { target: { value: "Lyon" } })
    fireEvent.change(screen.getByLabelText("Catégorie"), { target: { value: "translation" } })
    fireEvent.click(screen.getByLabelText("À distance"))
    fireEvent.change(screen.getByLabelText("Budget maximal"), { target: { value: "50" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Rechercher" })) })
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/services?ville=Lyon&categorie=translation&mode=remote"))
    expect(mocks.search).toHaveBeenLastCalledWith(expect.objectContaining({ budget: { amountMinor: 5000, currency: "EUR" } }))
    expect(screen.getByText(/Budget appliqué/)).toBeTruthy()
    expect(screen.getByText(/prix non comparé à votre budget/)).toBeTruthy()
  })

  it("refuse un budget illisible sans rien chercher", async () => {
    render(tree(<ServicesScreen />))
    fireEvent.change(screen.getByLabelText("Budget maximal"), { target: { value: "45,555" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Rechercher" })) })
    await waitFor(() => expect(screen.getByText(/montant valide/)).toBeTruthy())
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("pagine : « Afficher plus » lit la fenêtre suivante, sans doublon", () => {
    mocks.searchPages.set("first", ready([card("o1"), card("o2")], "next"))
    mocks.searchPages.set("next", ready([card("o2"), card("o3")]))
    render(tree(<ServicesScreen />))
    fireEvent.click(screen.getByRole("button", { name: "Afficher plus" }))
    const list = screen.getByRole("list", { name: "Offres trouvées" })
    expect(within(list).getAllByRole("listitem")).toHaveLength(3)
    expect(screen.queryByRole("button", { name: "Afficher plus" })).toBeNull()
  })

  it("explique un résultat vide, filtres compris", () => {
    mocks.params = new URLSearchParams("ville=Ouagadougou")
    mocks.searchPages.set("first", ready<ServiceOfferCardView>([]))
    render(tree(<ServicesScreen />))
    expect(screen.getByText("Aucune offre ne correspond")).toBeTruthy()
    expect(screen.getByText(/un service à distance est rangé au pays du professionnel/)).toBeTruthy()
  })

  it("dit une panne et propose de réessayer ; un fournisseur sans services le dit aussi", () => {
    mocks.searchPages.set("first", { status: "error", code: "network_unavailable" })
    const view = render(tree(<ServicesScreen />))
    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy()
    view.unmount()
    mocks.services = null
    render(tree(<ServicesScreen />))
    expect(screen.getByText("Le catalogue des services n'est pas disponible ici")).toBeTruthy()
  })

  it("parle anglais avec les mêmes écrans", () => {
    mocks.searchPages.set("first", ready([card("o1", { pricing: { mode: "fixed", amountMinor: 0, currency: "EUR" } })]))
    render(tree(<ServicesScreen />, "en"))
    expect(screen.getByRole("heading", { name: "Diaspora services" })).toBeTruthy()
    expect(screen.getByText("Free")).toBeTruthy()
  })
})

describe("/services/<id> — la fiche", () => {
  it("montre la page et son badge, le tarif annoncé, l'absence de paiement, puis la demande", () => {
    mocks.offer = { status: "ready", data: detail("o1", { durationMinutes: 90, languages: ["fr", "en"] }) }
    render(tree(<ServiceOfferScreen offerId="o1" />))
    expect(screen.getByRole("heading", { level: 1, name: "Offre o1" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Coiffure Paris (fictif)" }).getAttribute("href")).toBe("/pages/coiffure-paris")
    expect(screen.getByText("Tarif annoncé par le professionnel")).toBeTruthy()
    expect(screen.getByText(/Aucun paiement sur DIASPORALE/)).toBeTruthy()
    expect(screen.getByText(/ne garantit pas la qualité/)).toBeTruthy()
    expect(screen.getByText("1 h 30")).toBeTruthy()
    expect(mocks.requestEntry).toHaveBeenCalledWith({ offerId: "o1", offerVersion: 1, offerTitle: "Offre o1", pageName: "Coiffure Paris (fictif)" })
  })

  it("au gestionnaire : l'état de l'offre et le lien de gestion, jamais la demande", () => {
    mocks.offer = { status: "ready", data: detail("o1", { status: "paused", viewerCanManage: true }) }
    render(tree(<ServiceOfferScreen offerId="o1" />))
    expect(screen.getByText(/En pause : les membres ne la voient plus/)).toBeTruthy()
    // Le lien ouvre directement les services de la page prestataire, sans passer par le sélecteur de « Mon activité » (docs/21).
    expect(screen.getByRole("link", { name: "Gérer les services de la page" }).getAttribute("href")).toBe("/pages/coiffure-paris/gerer?onglet=services")
    expect(mocks.requestEntry).not.toHaveBeenCalled()
  })

  it("une offre indisponible est un état neutre ; une panne se réessaie", () => {
    mocks.offer = { status: "ready", data: null }
    const view = render(tree(<ServiceOfferScreen offerId="retiree" />))
    expect(screen.getByText("Cette offre n'est pas disponible")).toBeTruthy()
    expect(mocks.requestEntry).not.toHaveBeenCalled()
    view.unmount()
    mocks.offer = { status: "error", code: "rate_limited" }
    render(tree(<ServiceOfferScreen offerId="o1" />))
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(screen.getByRole("alert")).toBeTruthy()
  })
})

describe("/mon-activite", () => {
  it("liste les offres de la seule page d'entreprise ou d'association, tous états", () => {
    mocks.myPages.set("first", ready([detail("a", { status: "active" }), detail("d", { status: "draft" }), detail("w", { status: "withdrawn" })]))
    render(tree(<MyActivityScreen />))
    expect(screen.getByRole("navigation", { name: "Sections de Mon activité" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Offres de Coiffure Paris (fictif)" })).toBeTruthy()
    // Une institution ne propose pas de services : aucun choix de page à faire.
    expect(screen.queryByLabelText("Page")).toBeNull()
    const list = screen.getByRole("list", { name: "Offres de la page" })
    expect(within(list).getAllByRole("listitem")).toHaveLength(3)
    expect(within(list).getByText("Brouillon")).toBeTruthy()
    expect(within(list).getByText("Retirée")).toBeTruthy()
    expect(within(list).getByRole("button", { name: "Publier" })).toBeTruthy()
    expect(within(list).getByRole("button", { name: "Mettre en pause" })).toBeTruthy()
  })

  it("crée une offre : formulaire invalide refusé sur place, valide envoyé en unités mineures", async () => {
    mocks.myPages.set("first", ready<ServiceOfferDetailView>([]))
    render(tree(<MyActivityScreen />))
    fireEvent.click(screen.getByRole("button", { name: "Nouvelle offre" }))
    // Le formulaire s'ouvre sur son premier champ.
    expect(document.activeElement).toBe(screen.getByLabelText("Titre"))
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Ab" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" })) })
    await waitFor(() => expect(screen.getByText("Le titre compte au moins 3 caractères.")).toBeTruthy())
    expect(mocks.create).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Tresses enfants" } })
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Appelez le 06 12 34 56 78 pour réserver." } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" })) })
    await waitFor(() => expect(screen.getByText(/Retirez téléphone, adresse e-mail et lien/)).toBeTruthy())
    expect(mocks.create).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Tresses et nattes pour enfants, le samedi." } })
    fireEvent.click(screen.getByLabelText("Prix fixe"))
    fireEvent.change(screen.getByLabelText("Montant"), { target: { value: "45,50" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Publier" })) })
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce())
    expect(mocks.create).toHaveBeenCalledWith({
      title: "Tresses enfants", description: "Tresses et nattes pour enfants, le samedi.", category: "beauty", country: "FR", city: "Paris",
      delivery: "onsite", languages: ["fr"], durationMinutes: null, pricing: { mode: "fixed", amountMinor: 4550, currency: "EUR" }, pageId: "page-1", publish: true,
    })
    expect(mocks.success).toHaveBeenCalledWith("Offre publiée.")
    // Le formulaire fermé, le focus revient au titre de la section.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Offres de Coiffure Paris (fictif)" })))
  })

  it("une modification sur une version périmée dit le conflit et propose la dernière version", async () => {
    mocks.myPages.set("first", ready([detail("a", { version: 3 })]))
    mocks.update.mockResolvedValue({ ok: false, code: "service_offer_version_conflict" })
    render(tree(<MyActivityScreen />))
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }))
    expect((screen.getByLabelText("Titre") as HTMLInputElement).value).toBe("Offre a")
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Enregistrer les modifications" })) })
    await waitFor(() => expect(screen.getByText("L'offre a changé entre-temps")).toBeTruthy())
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ offerId: "a", expectedVersion: 3 }))
    fireEvent.click(screen.getByRole("button", { name: "Recharger la dernière version" }))
    expect(screen.queryByText("L'offre a changé entre-temps")).toBeNull()
    expect((screen.getByLabelText("Titre") as HTMLInputElement).value).toBe("Offre a")
  })

  it("retirer demande confirmation, cite la version lue, puis le dit", async () => {
    mocks.myPages.set("first", ready([detail("a", { version: 4 })]))
    mocks.setStatus.mockResolvedValue({ ok: true, value: { status: "withdrawn", version: 5 } })
    render(tree(<MyActivityScreen />))
    fireEvent.click(screen.getByRole("button", { name: "Retirer" }))
    expect(mocks.setStatus).not.toHaveBeenCalled()
    expect(screen.getByText(/Retirer « Offre a »/)).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retirer définitivement" })) })
    expect(mocks.setStatus).toHaveBeenCalledWith({ offerId: "a", expectedVersion: 4, status: "withdrawn" })
    expect(mocks.success).toHaveBeenCalledWith("Offre retirée.")
  })

  it("un refus du fournisseur se dit sans rien changer", async () => {
    mocks.myPages.set("first", ready([detail("a")]))
    mocks.setStatus.mockResolvedValue({ ok: false, code: "service_offer_version_conflict" })
    render(tree(<MyActivityScreen />))
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Mettre en pause" })) })
    expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/a changé entre-temps/))
  })

  it("sans droit de publier : la gestion est fermée et le dit", () => {
    mocks.membership = { ...MEMBER, canPublish: false }
    mocks.myPages.set("first", ready([detail("a")]))
    render(tree(<MyActivityScreen />))
    expect((screen.getByRole("button", { name: "Nouvelle offre" }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole("button", { name: "Mettre en pause" }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/après un parrainage/)).toBeTruthy()
  })

  it("plusieurs pages : on choisit ; aucune : on est guidé vers ses pages", () => {
    mocks.pageAdmin = pageAdmin({ status: "ready", data: [COMPANY, { ...COMPANY, id: "page-3", handle: "collectif", name: "Collectif fictif", ownerKind: "association" }] })
    mocks.myPages.set("first", ready<ServiceOfferDetailView>([]))
    const view = render(tree(<MyActivityScreen />))
    fireEvent.change(screen.getByLabelText("Page"), { target: { value: "page-3" } })
    expect(screen.getByRole("heading", { name: "Offres de Collectif fictif" })).toBeTruthy()
    view.unmount()
    mocks.pageAdmin = pageAdmin({ status: "ready", data: [INSTITUTION] })
    render(tree(<MyActivityScreen />))
    expect(screen.getByText("Aucune entreprise ni association à votre nom")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Voir mes pages" }).getAttribute("href")).toBe("/mon-activite?onglet=pages")
  })

  it("monte les demandes reçues et mes pages dans leurs onglets ; la gestion des pages absente se dit", () => {
    mocks.params = new URLSearchParams("onglet=demandes")
    const first = render(tree(<MyActivityScreen />))
    expect(mocks.inbox).toHaveBeenCalledWith({ pageId: "page-1", pageHandle: "coiffure-paris" })
    first.unmount()
    mocks.params = new URLSearchParams("onglet=pages")
    const second = render(tree(<MyActivityScreen />))
    expect(screen.getByText("mes-pages")).toBeTruthy()
    second.unmount()
    mocks.params = new URLSearchParams("onglet=offres")
    mocks.pageAdmin = null
    render(tree(<MyActivityScreen />))
    expect(screen.getByText("La gestion des pages n'est pas disponible ici")).toBeTruthy()
  })
})

describe("la fiche d'une page — ses services", () => {
  it("montre les offres actives, sans répéter la page ; rien pour une page sans offre", () => {
    mocks.pageOffers.set("first", ready([card("o1")]))
    const view = render(tree(<PageServicesSection pageId="page-1" pageHandle="coiffure-paris" />))
    expect(screen.getByRole("heading", { name: "Services proposés" })).toBeTruthy()
    expect(screen.queryByText("Proposé par Coiffure Paris (fictif)")).toBeNull()
    view.unmount()
    mocks.pageOffers.set("first", ready<ServiceOfferCardView>([]))
    const empty = render(tree(<PageServicesSection pageId="page-1" pageHandle="coiffure-paris" />))
    expect(empty.container.textContent).toBe("")
    empty.unmount()
    mocks.pageOffers.set("first", { status: "error", code: "not_found" })
    const hidden = render(tree(<PageServicesSection pageId="page-1" pageHandle="poste-demo" />))
    expect(hidden.container.textContent).toBe("")
  })
})
