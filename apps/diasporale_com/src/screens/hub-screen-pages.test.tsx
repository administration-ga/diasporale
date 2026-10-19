// @vitest-environment jsdom
/** Le hub pays et ses pages réelles (DG-007) : listes bornées par nature, vides, erreurs et suite annoncée. */
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { CountryHubView, HubPagesQuery, Loadable, MembershipView, PagesCapability, PageView } from "@diasporale/features/data"
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
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@diasporale/features/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diasporale/features/data")>()),
  useCountryHub: () => mocks.hub,
  useOpenCountries: () => ({ status: "ready", data: [] }),
  useOptionalDataSource: () => (mocks.capability ? { pages: mocks.capability } : null),
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
  officialPages: [],
  associations: [],
  companies: [],
  events: [],
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

  it("sans capacité « pages », les listes jointes au hub restent la source", () => {
    mocks.capability = null
    mocks.hub = { status: "ready", data: { ...HUB, associations: [page("cercle", "Cercle de Québec")] } }
    render(tree())
    openTab("Associations")
    expect(within(screen.getByRole("tabpanel")).getByRole("article", { name: "association Cercle de Québec" })).toBeInTheDocument()
  })
})
