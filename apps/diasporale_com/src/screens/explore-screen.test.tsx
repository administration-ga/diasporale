// @vitest-environment jsdom
import { DataSourceProvider, type DiasporaleDataSource, type Loadable, type OpenCountryView } from "@diasporale/features/data"
import { DemoStore, createDemoDataSource, createDemoSeed } from "@diasporale/features/demo"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ExploreScreen } from "./explore-screen"

const mocks = vi.hoisted(() => ({ directory: vi.fn(), replace: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mocks.replace, refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/explorer",
  useSearchParams: () => new URLSearchParams(),
}))

// La coque a ses propres tests ; l'annuaire des pages appartient au chantier « pages ».
vi.mock("@/components/app-shell", () => ({ AppShell: (props: { children: ReactNode }) => <>{props.children}</> }))
vi.mock("@/components/page-directory", () => ({
  PageDirectory: (props: { country?: string }) => {
    mocks.directory(props)
    return <section aria-label="Annuaire des pages" />
  },
}))

const NOW = Date.UTC(2026, 9, 18, 12)

/** Le fournisseur de DÉMONSTRATION, session ouverte au nom d'une personne du jeu d'essai. */
function demoSource(personId: string | null, overrides: Partial<DiasporaleDataSource> = {}): DiasporaleDataSource {
  const state = { ...createDemoSeed(NOW), session: { personId } }
  const storage = { getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }
  return { ...createDemoDataSource(new DemoStore(storage, () => NOW, 0)), ...overrides }
}

function renderExplore(source: DiasporaleDataSource, locale: "fr" | "en" = "fr") {
  return render(
    <I18nProvider locale={locale}>
      <DataSourceProvider source={source}>
        <ExploreScreen />
      </DataSourceProvider>
    </I18nProvider>,
  )
}

function countries(): HTMLElement {
  return screen.getByRole("region", { name: "Pays ouverts" })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

describe("/explorer — les rubriques communautaires de la vague H", () => {
  it("mène à l'entraide, au kit d'arrivée, au mentorat et à l'emploi, filtrés au départ par le pays de résidence", () => {
    renderExplore(demoSource("p-mireille"))

    const expected = [
      ["Entraide", "Ouvrir l'entraide", "/entraide?pays=FR"],
      ["Kit d'arrivée", "Consulter le kit d'arrivée", "/kit-arrivee?pays=FR"],
      ["Mentorat", "Trouver un mentor", "/mentorat?pays=FR"],
      ["Emploi", "Voir les offres d'emploi", "/emploi?pays=FR"],
    ] as const
    for (const [region, action, href] of expected) {
      const section = screen.getByRole("region", { name: region })
      expect(within(section).getByRole("link", { name: action })).toHaveAttribute("href", href)
    }
  })
})

describe("/explorer — le point d'entrée de la découverte", () => {
  it("monte, pour un membre de la démonstration, la recherche de membres, les services, l'annuaire des pages et les pays ouverts", () => {
    renderExplore(demoSource("p-mireille"))

    expect(screen.getByRole("heading", { level: 1, name: "Explorer" })).toBeInTheDocument()
    const members = screen.getByRole("region", { name: "Membres" })
    expect(within(members).getByRole("link", { name: "Chercher un membre" })).toHaveAttribute("href", "/membres")
    const services = screen.getByRole("region", { name: "Services" })
    expect(within(services).getByRole("link", { name: "Parcourir les services" })).toHaveAttribute("href", "/services")
    expect(screen.getByRole("region", { name: "Annuaire des pages" })).toBeInTheDocument()
    // L'annuaire part du pays de résidence de la personne, filtre qu'elle peut ôter.
    expect(mocks.directory).toHaveBeenCalledWith({ country: "FR" })

    // Le jeu d'essai n'ouvre que la France : son hub, marqué comme le pays de la personne.
    const links = within(countries()).getAllByRole("link")
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute("href", "/pays/fr")
    expect(links[0]).toHaveTextContent("France")
    expect(links[0]).toHaveTextContent("mon pays")
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("ne marque « mon pays » que sur le pays de résidence", () => {
    // Rodrigue réside au Canada, qui n'est pas ouvert dans la démonstration.
    renderExplore(demoSource("p-rodrigue"))
    const [france] = within(countries()).getAllByRole("link")
    expect(france).toHaveAttribute("href", "/pays/fr")
    expect(france).not.toHaveTextContent("mon pays")
  })

  it("place son pays en tête, puis l'ordre alphabétique de la langue", () => {
    const ready: Loadable<readonly OpenCountryView[]> = {
      status: "ready",
      data: (["SN", "BE", "FR", "CA"] as const).map((country) => ({
        country,
        counters: { dormant: true, members: { kind: "value", value: 0 }, associations: { kind: "value", value: 0 }, companies: { kind: "value", value: 0 }, upcomingEvents: { kind: "value", value: 0 } },
        countersSource: "materialized",
      })),
    }
    renderExplore(demoSource("p-rodrigue", { useOpenCountries: () => ready }))
    expect(within(countries()).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/pays/ca", "/pays/be", "/pays/fr", "/pays/sn"])
  })

  it("parle anglais", () => {
    renderExplore(demoSource("p-mireille"), "en")
    expect(screen.getByRole("heading", { level: 1, name: "Explore" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Search for a member" })).toHaveAttribute("href", "/membres")
    expect(screen.getByRole("link", { name: "Browse services" })).toHaveAttribute("href", "/services")
    expect(within(screen.getByRole("region", { name: "Open countries" })).getByRole("link")).toHaveTextContent("my country")
  })

  it("distingue le chargement des pays, sans alerte", () => {
    const { container } = renderExplore(demoSource("p-mireille", { useOpenCountries: () => ({ status: "loading" }) }))
    expect(countries()).toHaveAttribute("aria-busy", "true")
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("remplace une erreur par une alerte traduite, sans code interne", () => {
    renderExplore(demoSource("p-mireille", { useOpenCountries: () => ({ status: "error", code: "PRIVATE_BACKEND_FAILURE" }) }))
    const alert = within(countries()).getByRole("alert")
    expect(within(alert).getByRole("heading", { name: "La liste des pays n'est pas disponible." })).toBeInTheDocument()
    expect(within(alert).getByRole("button", { name: "Recharger la page" })).toBeInTheDocument()
    expect(screen.queryByText("PRIVATE_BACKEND_FAILURE")).toBeNull()
  })

  it("dit qu'aucun pays n'est ouvert et mène à sa communauté", () => {
    renderExplore(demoSource("p-mireille", { useOpenCountries: () => ({ status: "ready", data: [] }) }))
    expect(within(countries()).getByText("Aucun pays n'est encore ouvert.")).toBeInTheDocument()
    expect(within(countries()).getByRole("link", { name: "Voir ma communauté" })).toHaveAttribute("href", "/communautes")
  })

  it("sans session, ne montre rien et renvoie vers l'entrée", () => {
    renderExplore(demoSource(null))
    expect(screen.queryByRole("heading", { name: "Explorer" })).toBeNull()
    expect(mocks.replace).toHaveBeenCalledWith("/entrer")
  })
})
