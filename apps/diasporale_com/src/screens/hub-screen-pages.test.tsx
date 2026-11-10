// @vitest-environment jsdom
/** Le hub pays et ses pages réelles (DG-007) : listes bornées par nature, vides, erreurs et suite annoncée. */
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { AssociationEventsCapability, CountryEventsPage, CountryEventsRequest, CountryEventView, CountryHubView, HubPagesQuery, Loadable, MembershipView, PagesCapability, PageView } from "@diasporale/features/data"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { HubScreen } from "./hub-screen"

const mocks = vi.hoisted(() => ({
  membership: null as MembershipView | null,
  hub: { status: "loading" } as Loadable<CountryHubView>,
  pages: { status: "loading" } as HubPagesQuery,
  capability: null as PagesCapability | null,
  hubPagesCalls: [] as string[],
  associationEvents: null as Pick<AssociationEventsCapability, "useCountryEvents"> | null,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@diasporale/features/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diasporale/features/data")>()),
  useCountryHub: () => mocks.hub,
  useOpenCountries: () => ({ status: "ready", data: [] }),
  useOptionalDataSource: () =>
    mocks.capability || mocks.associationEvents
      ? { ...(mocks.capability ? { pages: mocks.capability } : {}), ...(mocks.associationEvents ? { associationEvents: mocks.associationEvents } : {}) }
      : null,
}))
vi.mock("@diasporale/features", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diasporale/features")>()),
  AssociationCard: (props: { page: PageView }) => <article aria-label={`association ${props.page.name}`} />,
  CompanyCard: (props: { page: PageView }) => <article aria-label={`entreprise ${props.page.name}`} />,
  OfficialPageCard: (props: { page: PageView }) => <article aria-label={`officielle ${props.page.name}`} />,
}))
vi.mock("@/components/gate", () => ({
  Gate: (props: { children: (session: { membership: MembershipView | null }) => ReactNode }) => <>{props.children({ membership: mocks.membership })}</>,
}))
vi.mock("@/components/app-shell", () => ({
  AppShell: (props: { children: ReactNode }) => <>{props.children}</>,
  useComposer: () => ({ canPublish: true, open: vi.fn() }),
}))
vi.mock("@/components/status-banner", () => ({ StatusBanner: () => null }))
vi.mock("@/components/feed-pages", () => ({ FeedPages: () => <section aria-label="Publications paginées du hub" /> }))

const membership: MembershipView = {
  personId: "persons_awa",
  handle: "awa.demo",
  displayName: "Awa",
  status: "declaree",
  badges: ["community"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1,
  verifiedSince: null,
  sponsoredBy: null,
  attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" },
  canPublish: true,
  rateTier: "reinforced",
  directoryVisibility: "hidden",
}

const HUB: CountryHubView = {
  country: "CA",
  open: true,
  counters: {
    dormant: false,
    members: { kind: "below_threshold", threshold: 20 },
    associations: { kind: "value", value: 2 },
    companies: { kind: "value", value: 0 },
    upcomingEvents: { kind: "value", value: 0 },
  },
  countersSource: "materialized",
  countersComputedAt: Date.UTC(2026, 10, 9, 2, 30),
  officialPages: [],
  associations: [],
  companies: [],
  events: [],
  eventsSource: "unmeasured",
}

function page(id: string, name: string, extra: Partial<PageView> = {}): PageView {
  return {
    id, handle: id, name, ownerKind: "association", trust: "community", badge: "community", country: "CA", city: null,
    description: "", followers: 0, claimable: false, ...extra,
  }
}

const NOTHING_MORE = { officialPages: false, associations: false, companies: false }

function capability(): PagesCapability {
  return {
    usePage: () => ({ status: "loading" }),
    useDirectory: () => ({ status: "loading" }),
    useHubPages: (country) => {
      mocks.hubPagesCalls.push(country)
      return mocks.pages
    },
    follow: vi.fn(),
    unfollow: vi.fn(),
  }
}

function tree() {
  return <I18nProvider locale="fr"><HubScreen iso="ca" /></I18nProvider>
}

function openTab(name: string) {
  act(() => {
    fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.membership = membership
  mocks.hub = { status: "ready", data: HUB }
  mocks.pages = { status: "loading" }
  mocks.capability = capability()
  mocks.hubPagesCalls.length = 0
  mocks.associationEvents = null
})

afterEach(cleanup)

describe("HubScreen — pages réelles du pays", () => {
  it("lit les pages du pays consulté et montre les compteurs matérialisés", () => {
    render(tree())
    expect(mocks.hubPagesCalls).toContain("CA")
    expect(screen.getByText("Associations", { selector: "p, span, dt, dd, div" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Pages officielles" })).not.toBeInTheDocument()
  })

  it("chargement : un état d'attente dans la liste, sans alerte", () => {
    const { container } = render(tree())
    openTab("Associations")
    const panel = screen.getByRole("tabpanel")
    expect(within(panel).getByRole("status")).toHaveTextContent("Un instant…")
    expect(container.querySelector('[role="tabpanel"] [data-slot="skeleton"]')).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("erreur : message traduit et reprise, jamais un faux vide", async () => {
    const retry = vi.fn().mockResolvedValue(undefined)
    mocks.pages = { status: "error", code: "rate_limited", retry }
    render(tree())
    openTab("Entreprises")
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Les pages de ce pays n'ont pas pu être chargées.")
    expect(screen.queryByText(/Aucune entreprise inscrite/)).not.toBeInTheDocument()
    await act(async () => {
      fireEvent.click(within(alert).getByRole("button", { name: "Réessayer" }))
    })
    expect(retry).toHaveBeenCalledOnce()
  })

  it("succès : pages officielles en tête, associations par nature, suite annoncée vers l'annuaire de leur type et de leur pays", () => {
    mocks.pages = {
      status: "ready",
      data: {
        country: "CA",
        officialPages: [page("poste", "Poste de Montréal", { ownerKind: "institution", trust: "official", badge: "official" })],
        associations: [page("amicale", "Amicale de Montréal")],
        companies: [],
        more: { ...NOTHING_MORE, associations: true },
      },
    }
    render(tree())
    expect(screen.getByRole("article", { name: "officielle Poste de Montréal" })).toBeInTheDocument()
    openTab("Associations")
    const panel = screen.getByRole("tabpanel")
    expect(within(panel).getByRole("article", { name: "association Amicale de Montréal" })).toBeInTheDocument()
    // La liste bornée du hub renvoie à l'annuaire filtré par nature et par pays consulté.
    expect(within(panel).getByRole("link", { name: "Toutes les pages dans l'annuaire" })).toHaveAttribute("href", "/pages?type=association&pays=CA")
  })

  it("vide réel : l'état vide du pays ; vide d'une fenêtre bornée : renvoi vers l'annuaire", () => {
    mocks.pages = { status: "ready", data: { country: "CA", officialPages: [], associations: [], companies: [], more: { ...NOTHING_MORE, companies: true } } }
    render(tree())
    openTab("Associations")
    expect(within(screen.getByRole("tabpanel")).getByText(/Aucune association inscrite/)).toBeInTheDocument()
    openTab("Entreprises")
    const panel = screen.getByRole("tabpanel")
    expect(within(panel).getByText("D'autres pages de ce pays se trouvent dans l'annuaire des pages.")).toBeInTheDocument()
    expect(within(panel).queryByText(/Aucune entreprise inscrite/)).not.toBeInTheDocument()
  })

  it("évènements non mesurés (moteur) : aucun nombre, l'onglet renvoie aux associations du pays et à l'agenda (EV-02)", () => {
    render(tree())
    // Les trois compteurs mesurés restent ; celui des évènements, écrit à zéro sans rien compter, disparaît.
    expect(screen.getByText("Membres visibles")).toBeInTheDocument()
    expect(screen.queryByText("Évènements à venir")).not.toBeInTheDocument()
    openTab("Évènements")
    const panel = screen.getByRole("tabpanel")
    expect(within(panel).getByText("Les évènements ne sont pas encore réunis dans le hub.")).toBeInTheDocument()
    expect(panel).not.toHaveTextContent(/Aucun évènement/)
    expect(panel).not.toHaveTextContent(/\b0\b/)
    expect(within(panel).getByRole("link", { name: "Voir les associations du pays" })).toHaveAttribute("href", "/pages?type=association&pays=CA")
    expect(within(panel).getByRole("link", { name: "Mon agenda" })).toHaveAttribute("href", "/agenda")
  })

  it("démonstration : les évènements comptés sur les données fictives gardent leur compteur et leur liste", () => {
    mocks.hub = { status: "ready", data: { ...HUB, countersSource: "demo", eventsSource: "demo", counters: { ...HUB.counters, upcomingEvents: { kind: "value", value: 0 } } } }
    render(tree())
    expect(screen.getByText("Évènements à venir")).toBeInTheDocument()
    openTab("Évènements")
    expect(within(screen.getByRole("tabpanel")).getByText(/Aucun évènement prévu/)).toBeInTheDocument()
    expect(screen.queryByText("Les évènements ne sont pas encore réunis dans le hub.")).not.toBeInTheDocument()
  })

  it("sans aucune page, le hub ne promet ni import public, ni évènement de poste, ni rien au futur (VC-01)", () => {
    mocks.pages = { status: "ready", data: { country: "CA", officialPages: [], associations: [], companies: [], more: NOTHING_MORE } }
    render(tree())
    for (const tab of ["Évènements", "Associations", "Entreprises"]) {
      openTab(tab)
      const panel = screen.getByRole("tabpanel")
      expect(panel).not.toHaveTextContent(/import|postes|apparaîtront|arrivent|pourront/i)
    }
    openTab("Associations")
    expect(within(screen.getByRole("tabpanel")).getByText("Une association de la diaspora peut créer sa page.")).toBeInTheDocument()
    openTab("Entreprises")
    expect(within(screen.getByRole("tabpanel")).getByText("Une entreprise de la diaspora peut créer sa page.")).toBeInTheDocument()
  })

  it("démonstration sans évènement : le vide dit ce qui existe, sans promettre les évènements des postes", () => {
    mocks.hub = { status: "ready", data: { ...HUB, countersSource: "demo", eventsSource: "demo" } }
    render(tree())
    openTab("Évènements")
    const panel = screen.getByRole("tabpanel")
    expect(within(panel).getByText("Les associations publient leurs évènements sur leur page.")).toBeInTheDocument()
    expect(panel).not.toHaveTextContent(/postes|apparaîtront/)
  })

  it("sans capacité « pages », les listes jointes au hub restent la source", () => {
    mocks.capability = null
    mocks.hub = { status: "ready", data: { ...HUB, associations: [page("cercle", "Cercle de Québec")] } }
    render(tree())
    openTab("Associations")
    expect(within(screen.getByRole("tabpanel")).getByRole("article", { name: "association Cercle de Québec" })).toBeInTheDocument()
  })
})

describe("HubScreen — évènements du pays lus par fenêtres (HB-02)", () => {
  const DAY = 86_400_000
  const START = Date.UTC(2030, 5, 12, 17)
  function countryEvent(id: string, title: string, extra: Partial<CountryEventView> = {}): CountryEventView {
    return {
      eventId: id, pageId: "page-cercle", title, location: "Salle municipale, Montréal", startAt: START, endAt: START + 2 * 3_600_000,
      timeZone: "America/Toronto", organizer: { name: "Cercle de Montréal", handle: "cercle-montreal" }, ...extra,
    }
  }
  function serve(pages: Record<string, Loadable<CountryEventsPage>>) {
    const requests: CountryEventsRequest[] = []
    mocks.associationEvents = {
      useCountryEvents: (request) => {
        requests.push(request)
        return pages[request.cursor ?? "premiere"] ?? { status: "loading" }
      },
    }
    return requests
  }

  it("moteur : les cartes mènent à la fiche de l'évènement et à son association ; le compteur non mesuré reste caché", () => {
    const requests = serve({
      premiere: { status: "ready", data: { items: [countryEvent("evt-1", "Fête de l'indépendance"), countryEvent("evt-2", "Tournoi de football", { startAt: START + DAY, location: "" })], continueCursor: null, isDone: true, partial: false } },
    })
    render(tree())
    expect(screen.queryByText("Évènements à venir")).not.toBeInTheDocument()
    openTab("Évènements")
    const panel = screen.getByRole("tabpanel")
    expect(within(panel).getByRole("link", { name: "Fête de l'indépendance" })).toHaveAttribute("href", "/pages/cercle-montreal/evenements/evt-1")
    expect(within(panel).getByRole("link", { name: "Tournoi de football" })).toHaveAttribute("href", "/pages/cercle-montreal/evenements/evt-2")
    expect(within(panel).getAllByRole("link", { name: "Cercle de Montréal" })[0]).toHaveAttribute("href", "/pages/cercle-montreal")
    expect(within(panel).getByText("Salle municipale, Montréal")).toBeInTheDocument()
    expect(within(panel).getByRole("list", { name: "Prochains évènements\u00a0— Canada" })).toBeInTheDocument()
    // Plus de renvoi « pas encore réunis » : la vraie liste le remplace.
    expect(panel).not.toHaveTextContent("Les évènements ne sont pas encore réunis dans le hub.")
    expect(within(panel).getByRole("link", { name: "Voir les associations du pays" })).toHaveAttribute("href", "/pages?type=association&pays=CA")
    expect(within(panel).getByRole("link", { name: "Mon agenda" })).toHaveAttribute("href", "/agenda")
    // Le pays consulté, à partir d'un instant fixé par l'écran, première fenêtre sans curseur.
    expect(requests[0]).toMatchObject({ country: "CA", cursor: null })
    expect(Number.isFinite(requests[0]!.anchor)).toBe(true)
    expect(new Set(requests.map((request) => request.anchor)).size).toBe(1)
  })

  it("un compteur mesuré par le passage nocturne s'affiche à côté des autres", () => {
    serve({ premiere: { status: "ready", data: { items: [], continueCursor: null, isDone: true, partial: false } } })
    mocks.hub = { status: "ready", data: { ...HUB, eventsSource: "materialized", counters: { ...HUB.counters, upcomingEvents: { kind: "value", value: 3 } } } }
    render(tree())
    expect(screen.getByText("Évènements à venir")).toBeInTheDocument()
  })

  it("vide : le hub le dit sans rien promettre, et renvoie aux associations et à l'agenda", () => {
    serve({ premiere: { status: "ready", data: { items: [], continueCursor: null, isDone: true, partial: false } } })
    render(tree())
    openTab("Évènements")
    const panel = screen.getByRole("tabpanel")
    expect(within(panel).getByText("Aucun évènement à venir ouvert au réseau — Canada.")).toBeInTheDocument()
    expect(within(panel).getByText(/Les évènements réservés aux adhérents restent sur la page de chaque association/)).toBeInTheDocument()
    expect(panel).not.toHaveTextContent(/apparaîtront|bientôt|\b0\b/)
  })

  it("une lecture qui n'a parcouru qu'une partie des pages du pays le dit", () => {
    serve({ premiere: { status: "ready", data: { items: [countryEvent("evt-1", "Fête de l'indépendance")], continueCursor: null, isDone: true, partial: true } } })
    render(tree())
    openTab("Évènements")
    expect(within(screen.getByRole("tabpanel")).getByRole("note")).toHaveTextContent("les évènements de certaines associations peuvent manquer ici")
  })

  it("« Afficher plus » monte la fenêtre suivante par son curseur opaque, sans doublon", () => {
    const requests = serve({
      premiere: { status: "ready", data: { items: [countryEvent("evt-1", "Fête de l'indépendance")], continueCursor: "suite-1", isDone: false, partial: false } },
      "suite-1": { status: "ready", data: { items: [countryEvent("evt-1", "Fête de l'indépendance"), countryEvent("evt-3", "Gala solidaire", { startAt: START + 2 * DAY })], continueCursor: null, isDone: true, partial: false } },
    })
    render(tree())
    openTab("Évènements")
    act(() => {
      fireEvent.click(within(screen.getByRole("tabpanel")).getByRole("button", { name: "Afficher plus" }))
    })
    const panel = screen.getByRole("tabpanel")
    expect(within(panel).getAllByRole("link", { name: "Fête de l'indépendance" })).toHaveLength(1)
    expect(within(panel).getByRole("link", { name: "Gala solidaire" })).toBeInTheDocument()
    expect(requests.some((request) => request.cursor === "suite-1")).toBe(true)
    expect(within(panel).queryByRole("button", { name: "Afficher plus" })).not.toBeInTheDocument()
  })

  it("une lecture refusée se dit telle quelle, jamais « aucun évènement »", () => {
    serve({ premiere: { status: "error", code: "suspended" } })
    render(tree())
    openTab("Évènements")
    const panel = screen.getByRole("tabpanel")
    expect(within(panel).getByRole("alert")).toBeInTheDocument()
    expect(panel).not.toHaveTextContent("Aucun évènement à venir")
  })

  it("démonstration : les évènements fictifs joints au hub restent la source de l'onglet", () => {
    serve({ premiere: { status: "ready", data: { items: [countryEvent("evt-1", "Fête de l'indépendance")], continueCursor: null, isDone: true, partial: false } } })
    mocks.hub = { status: "ready", data: { ...HUB, countersSource: "demo", eventsSource: "demo" } }
    render(tree())
    openTab("Évènements")
    const panel = screen.getByRole("tabpanel")
    expect(within(panel).getByText("Les associations publient leurs évènements sur leur page.")).toBeInTheDocument()
    expect(within(panel).queryByRole("link", { name: "Fête de l'indépendance" })).not.toBeInTheDocument()
  })
})
