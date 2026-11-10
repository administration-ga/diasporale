// @vitest-environment jsdom
/**
 * ET-09 — l'entraide là où l'on passe : les prochaines missions d'une association sur sa
 * fiche, mes inscriptions dans l'agenda, les dernières questions du hub ; branchés sur la
 * vraie démonstration. Aucune section vide n'est affichée comme active.
 */
import { DataSourceProvider, type DiasporaleDataSource } from "@diasporale/features/data"
import { createDemoDataSource, createDemoSeed, DemoStore } from "@diasporale/features/demo"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { routes } from "@/lib/routes"

import { AgendaMissionsSection, HubMutualAidBlock, PageMissionsSection } from "./aid-on-the-way"

const NOW = Date.UTC(2026, 9, 18, 9)

function mount(viewer: string, node: ReactNode, source?: DiasporaleDataSource) {
  const state = { ...createDemoSeed(NOW), session: { personId: viewer } }
  const store = new DemoStore({ getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }, () => NOW, 0)
  render(
    <I18nProvider locale="fr">
      <DataSourceProvider source={source ?? createDemoDataSource(store)}>{node}</DataSourceProvider>
    </I18nProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("ET-09 — l'entraide là où l'on passe", () => {
  it("la fiche d'une association montre ses prochaines missions ouvertes ; complète ou close, absente", async () => {
    mount("p-mireille", <PageMissionsSection pageId="page-asso-lyon" />)
    const section = await screen.findByRole("region", { name: "Missions bénévoles" })
    expect(within(section).getByRole("link", { name: "Accueillir les nouveaux arrivants à la gare" })).toHaveAttribute("href", routes.mutualAidItem("aid-m-1"))
    expect(within(section).getByText("Inscription confirmée")).toBeInTheDocument()
    expect(within(section).queryByRole("link", { name: "Préparer le repas de la soirée culturelle" })).not.toBeInTheDocument()
    expect(within(section).queryByRole("link", { name: "Collecter des vêtements d'hiver" })).not.toBeInTheDocument()
  })

  it("une association sans mission ouverte, ou un fournisseur sans entraide : aucune section", () => {
    mount("p-mireille", <PageMissionsSection pageId="page-asso-bordeaux" />)
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
    cleanup()
    mount("p-mireille", <PageMissionsSection pageId="page-asso-lyon" />, { kind: "demo" } as DiasporaleDataSource)
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })

  it("l'agenda montre mes inscriptions à venir et renvoie à toutes ; sans inscription à venir, rien", async () => {
    mount("p-prisca", <AgendaMissionsSection />)
    const section = await screen.findByRole("region", { name: "Mes missions bénévoles" })
    expect(within(section).getByRole("link", { name: "Préparer le repas de la soirée culturelle" })).toHaveAttribute("href", routes.mutualAidItem("aid-m-2"))
    expect(within(section).getByText("Proposée par Collectif Ivindo de Lyon (démo)")).toBeInTheDocument()
    expect(within(section).getByRole("link", { name: "Toutes mes inscriptions" })).toHaveAttribute("href", routes.mutualAid(undefined, undefined, { tab: "missions", view: "mine" }))
    cleanup()
    mount("p-steeve", <AgendaMissionsSection />)
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })

  it("le hub d'un pays montre ses dernières questions ouvertes et renvoie à l'entraide du pays ; sans question ouverte, rien", async () => {
    mount("p-steeve", <HubMutualAidBlock country="FR" countryLabel="France" />)
    const block = await screen.findByRole("region", { name: /Entraide.*France/ })
    expect(within(block).getByRole("link", { name: /Renouveler un titre de séjour/ })).toHaveAttribute("href", routes.mutualAidItem("aid-q-2"))
    expect(within(block).getByRole("link", { name: "Voir toute l'entraide" })).toHaveAttribute("href", routes.mutualAid("FR"))
    cleanup()
    mount("p-steeve", <HubMutualAidBlock country="BE" countryLabel="Belgique" />)
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })
})
