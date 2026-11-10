// @vitest-environment jsdom
import { DataSourceProvider } from "@diasporale/features/data"
import { DemoStore, createDemoDataSource } from "@diasporale/features/demo"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import HomePage from "@/app/page"
import { routes } from "@/lib/routes"

import { SiteFooter } from "./site-chrome"

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => navigation }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function mount(children: ReactNode, locale: "fr" | "en" = "fr") {
  const store = new DemoStore(null, () => Date.UTC(2026, 10, 10, 12), 0)
  return render(
    <I18nProvider locale={locale}>
      <DataSourceProvider source={createDemoDataSource(store)}>{children}</DataSourceProvider>
    </I18nProvider>,
  )
}

const linksOf = (element: HTMLElement) => within(element).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])

describe("Pied de page public — les textes du site (LX-05)", () => {
  it("propose les cinq textes, puis « Mes données » et la charte", () => {
    const t = getFixedT("fr")
    mount(<SiteFooter />)
    expect(linksOf(screen.getByRole("navigation", { name: t("footer.label") }))).toEqual([
      ["Mentions légales", routes.legalNotice()],
      ["Confidentialité", routes.privacy()],
      ["Conditions d'utilisation", routes.terms()],
      ["Règles de la communauté", routes.communityRules()],
      ["Contact", routes.contact()],
      ["Mes données", routes.myData()],
      ["Charte graphique", routes.charte()],
    ])
  })

  it("parle anglais", () => {
    mount(<SiteFooter compact />, "en")
    const footer = within(screen.getByRole("navigation", { name: "Information" }))
    expect(footer.getByRole("link", { name: "Terms of use" })).toHaveAttribute("href", routes.terms())
    expect(footer.getByRole("link", { name: "Community rules" })).toHaveAttribute("href", routes.communityRules())
    expect(footer.getByRole("link", { name: "Contact" })).toHaveAttribute("href", routes.contact())
  })

  it("l'accueil public mène aux conditions d'utilisation, aux règles de la communauté et au contact", () => {
    const t = getFixedT("fr")
    mount(<HomePage />)
    const footer = within(screen.getByRole("navigation", { name: t("footer.label") }))
    expect(footer.getByRole("link", { name: t("footer.terms") })).toHaveAttribute("href", routes.terms())
    expect(footer.getByRole("link", { name: t("footer.community") })).toHaveAttribute("href", routes.communityRules())
    expect(footer.getByRole("link", { name: t("footer.contact") })).toHaveAttribute("href", routes.contact())
  })
})
