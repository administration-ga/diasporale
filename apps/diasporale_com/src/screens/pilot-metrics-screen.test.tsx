// @vitest-environment jsdom
import { DataSourceProvider, type DiasporaleDataSource, type PilotMetricsCapability } from "@diasporale/features/data"
import { DemoStore, createDemoDataSource, createDemoSeed } from "@diasporale/features/demo"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PilotMetricsScreen } from "./pilot-metrics-screen"

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace, refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/pilote",
  useSearchParams: () => new URLSearchParams(),
}))
// Une seule coque : l'écran la pose ; la sonde la rend visible dans le DOM.
vi.mock("@/components/app-shell", () => ({
  AppShell: (props: { children: ReactNode }) => <div data-slot="coque-sonde">{props.children}</div>,
}))

const NOW = Date.UTC(2026, 9, 18, 12)

/** Le jeu de démonstration, la personne connectée choisie (p-mireille est une responsable fictive). */
function demo(personId: string | null): DiasporaleDataSource {
  const state = { ...createDemoSeed(NOW), session: { personId } }
  const storage = { getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }
  return createDemoDataSource(new DemoStore(storage, () => NOW, 0))
}

function renderPilot(source: DiasporaleDataSource, locale: "fr" | "en" = "fr") {
  return render(
    <I18nProvider locale={locale}>
      <DataSourceProvider source={source}>
        <PilotMetricsScreen />
      </DataSourceProvider>
    </I18nProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(cleanup)

describe("/pilote — la mesure du pilote", () => {
  it("un responsable lit les agrégats, groupés par tableau, avec la mention « sans contenu privé » et le signal de données fictives", () => {
    const { container } = renderPilot(demo("p-mireille"))
    expect(screen.getByRole("heading", { level: 1, name: "Mesure du pilote" })).toBeInTheDocument()
    expect(screen.getByText("Mesures du pilote, sans contenu privé")).toBeInTheDocument()
    expect(screen.getByText("Données fictives de démonstration")).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="coque-sonde"]')).toHaveLength(1)
    for (const name of ["Services et demandes", "Associations", "Évènements de page", "Avis"]) {
      expect(screen.getByRole("table", { name })).toBeInTheDocument()
    }
    const services = screen.getByRole("table", { name: "Services et demandes" })
    const sent = within(services).getByRole("row", { name: /Demandes envoyées/ })
    // Tout le réseau sur trente jours : un compte publié, au-dessus du seuil.
    expect(within(sent).getByRole("cell").textContent).toMatch(/^\d/)
    // Un taux garde sa base : « sur N demandes envoyées ».
    expect(within(services).getByRole("row", { name: /Demandes répondues/ }).textContent).toMatch(/sur .+ demandes envoyées/)
    expect(screen.getByText(/Portée\s:\sTout le réseau/)).toBeInTheDocument()
    expect(screen.getByText(/Dernier passage\s:/)).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2, name: "Ce que cette mesure ne fait pas" })).toBeInTheDocument()
  })

  it("sur sept jours en France, un compte sous le seuil se dit « moins de 5 » et une part trop proche de sa base est masquée", async () => {
    const user = userEvent.setup()
    renderPilot(demo("p-mireille"))
    await user.selectOptions(screen.getByRole("combobox", { name: "Pays" }), "FR")
    await user.click(screen.getByRole("radio", { name: "7 jours" }))
    expect(screen.getByRole("radio", { name: "7 jours" })).toBeChecked()
    expect(screen.getByText(/Portée\s:\sFrance/)).toBeInTheDocument()
    const associations = screen.getByRole("table", { name: "Associations" })
    expect(within(associations).getAllByText("moins de 5").length).toBeGreaterThan(0)
    const events = screen.getByRole("table", { name: "Évènements de page" })
    expect(within(events).getByRole("row", { name: /Présences aux évènements/ }).textContent).toContain("masqué")
    // Aucun chiffre sous le seuil n'apparaît dans les cellules de valeur.
    for (const cell of screen.getAllByRole("cell")) {
      const value = Number((cell.textContent ?? "").replace(/\s/g, ""))
      if (Number.isFinite(value) && (cell.textContent ?? "").trim() !== "") expect(value).toBeGreaterThanOrEqual(5)
    }
  })

  it("se mène au clavier : le pays, puis la période aux flèches et à la barre d'espace", async () => {
    const user = userEvent.setup()
    renderPilot(demo("p-mireille"))
    await user.tab()
    expect(screen.getByRole("combobox", { name: "Pays" })).toHaveFocus()
    await user.tab()
    // Le groupe de périodes n'a qu'un arrêt de tabulation : la période choisie.
    expect(screen.getByRole("radio", { name: "30 jours" })).toHaveFocus()
    await user.keyboard("{ArrowRight}")
    await waitFor(() => expect(screen.getByRole("radio", { name: "90 jours" })).toHaveFocus())
    await user.keyboard(" ")
    expect(screen.getByRole("radio", { name: "90 jours" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "30 jours" })).not.toBeChecked()
  })

  it("un membre sans rôle de responsable voit que le tableau leur est réservé, sans aucun compte", () => {
    renderPilot(demo("p-steeve"))
    expect(screen.getByText("Réservé aux responsables du réseau")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })

  it("un fournisseur sans la capacité le dit, au lieu d'inventer des chiffres", () => {
    renderPilot({ ...demo("p-mireille"), pilotMetrics: undefined })
    expect(screen.getByText("Mesure indisponible")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("avant le premier passage, la mesure se dit non faite ; une erreur du moteur se traduit", () => {
    const notMeasured: PilotMetricsCapability = {
      useAccess: () => ({ status: "ready", data: { allowed: true } }),
      useMetrics: ({ country, days }) => ({ status: "ready", data: { measured: false, country, days, threshold: 5, fictional: false } }),
    }
    const first = renderPilot({ ...demo("p-mireille"), pilotMetrics: notMeasured })
    expect(screen.getByText("Aucun passage de mesure pour l’instant")).toBeInTheDocument()
    expect(screen.queryByText("Données fictives de démonstration")).not.toBeInTheDocument()
    first.unmount()
    const failing: PilotMetricsCapability = {
      useAccess: () => ({ status: "ready", data: { allowed: true } }),
      useMetrics: () => ({ status: "error", code: "pilot_metrics_window_invalid" }),
    }
    renderPilot({ ...demo("p-mireille"), pilotMetrics: failing })
    expect(screen.getByRole("alert")).toHaveTextContent("Cette période n’est pas proposée.")
  })

  it("parle anglais avec les mêmes tableaux", () => {
    renderPilot(demo("p-mireille"), "en")
    expect(screen.getByRole("heading", { level: 1, name: "Pilot measurement" })).toBeInTheDocument()
    expect(screen.getByText("Fictional demo data")).toBeInTheDocument()
    expect(screen.getByRole("table", { name: "Services and requests" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "30 days" })).toBeChecked()
  })
})
