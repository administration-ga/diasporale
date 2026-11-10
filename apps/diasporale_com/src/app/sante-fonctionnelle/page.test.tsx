// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/** La langue de la requête et le client HTTP de Convex, remplacés pour les tests. */
const mocks = vi.hoisted(() => ({
  locale: "fr" as "fr" | "en",
  query: vi.fn<() => Promise<unknown>>(),
}))

vi.mock("@/i18n/server", async () => {
  const { getFixedT } = await import("@diasporale/features/i18n")
  return {
    getAppT: async () => {
      const t = getFixedT(mocks.locale)
      return { locale: mocks.locale, t: (key: string) => t(key) }
    },
  }
})

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query() {
      return mocks.query()
    }
  },
}))

import { GET } from "../api/sante-fonctionnelle/route"

import HealthPage, { dynamic } from "./page"

const ENGINE_URL = "https://moteur-fictif.example"

function stubSource(env: { dataSource?: string; convexUrl?: string; buildSha?: string }) {
  vi.stubEnv("NEXT_PUBLIC_DIASPORALE_DATA_SOURCE", env.dataSource)
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", env.convexUrl)
  vi.stubEnv("NEXT_PUBLIC_BUILD_SHA", env.buildSha)
}

/** La valeur affichée en face d'un libellé de la liste d'état. */
function valueOf(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: "dt" })
  const value = term.nextElementSibling
  if (!(value instanceof HTMLElement)) throw new Error(`pas de valeur pour ${label}`)
  return value
}

beforeEach(() => {
  mocks.locale = "fr"
  mocks.query.mockReset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe("/sante-fonctionnelle — la page dit ce que dit la sonde", () => {
  it("n'est jamais figée à la construction", () => {
    expect(dynamic).toBe("force-dynamic")
  })

  it("moteur joint : en service, source moteur, version construite", async () => {
    stubSource({ dataSource: "engine", convexUrl: ENGINE_URL, buildSha: "abc1234" })
    mocks.query.mockResolvedValue({ status: "ok" })
    render(await HealthPage())
    expect(screen.getByRole("heading", { level: 1, name: "Santé fonctionnelle" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("diasporale.com répond et joint le moteur ANTSIA.")
    expect(valueOf("État")).toHaveTextContent("En service")
    expect(valueOf("Source de données")).toHaveTextContent("Moteur ANTSIA")
    expect(valueOf("Liaison avec le moteur")).toHaveTextContent("Établie")
    expect(valueOf("Adresse du moteur")).toHaveTextContent("Configurée")
    expect(valueOf("Version")).toHaveTextContent("abc1234")
    expect(document.body.textContent).not.toContain("moteur-fictif")
  })

  it("moteur injoignable : la page et la sonde disent le même état (503 pour la sonde)", async () => {
    stubSource({ dataSource: "engine", convexUrl: ENGINE_URL, buildSha: "abc1234" })
    mocks.query.mockRejectedValue(new Error(`fetch failed: ${ENGINE_URL}`))
    const response = await GET()
    const body = (await response.json()) as Record<string, string>
    render(await HealthPage())
    expect(response.status).toBe(503)
    expect(screen.getByRole("status")).toHaveTextContent("Le moteur ANTSIA ne répond pas.")
    expect(valueOf("État")).toHaveAttribute("data-status", body.status)
    expect(valueOf("Source de données")).toHaveAttribute("data-source", body.dataSource)
    expect(valueOf("Liaison avec le moteur")).toHaveAttribute("data-engine", body.engine)
    expect(valueOf("Adresse du moteur")).toHaveAttribute("data-backend", body.backend)
    expect(valueOf("Liaison avec le moteur")).toHaveTextContent("Sans réponse")
    expect(valueOf("Version")).toHaveTextContent(body.version!)
    expect(document.body.textContent).not.toContain("fetch failed")
  })

  it("adresse du moteur absente : dégradé, la page le dit", async () => {
    stubSource({ dataSource: "engine", buildSha: "abc1234" })
    render(await HealthPage())
    expect(screen.getByRole("status")).toHaveTextContent("L’adresse du moteur ANTSIA manque.")
    expect(valueOf("État")).toHaveTextContent("Dégradé")
    expect(valueOf("Adresse du moteur")).toHaveTextContent("Absente")
    expect(valueOf("Liaison avec le moteur")).toHaveTextContent("Non vérifiée")
  })

  it("en anglais, source de démonstration et version non déclarée", async () => {
    mocks.locale = "en"
    stubSource({ dataSource: "demo" })
    render(await HealthPage())
    expect(screen.getByRole("heading", { level: 1, name: "Functional health" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("diasporale.com is responding with its demonstration data, which is fictitious.")
    expect(valueOf("Data source")).toHaveTextContent("Demonstration (fictitious data)")
    expect(valueOf("Engine connection")).toHaveTextContent("Not checked")
    expect(valueOf("Version")).toHaveTextContent("dev · version not declared at build time")
    expect(mocks.query).not.toHaveBeenCalled()
  })
})
