// @vitest-environment jsdom
import { DataSourceProvider, type DiasporaleDataSource } from "@diasporale/features/data"
import { createDemoDataSource, createDemoSeed, DemoStore } from "@diasporale/features/demo"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { routes } from "@/lib/routes"

import { AssociationMembershipEntry } from "./association-membership-entry"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/pages/collectif-ivindo-lyon",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

const NOW = Date.UTC(2026, 9, 18, 9)
const LYON = { pageId: "page-asso-lyon", handle: "collectif-ivindo-lyon", ownerKind: "association" as const }

function mount(viewer: string, options: { locale?: "fr" | "en"; page?: typeof LYON | { pageId: string; handle: string; ownerKind: "association" | "company" }; withCapability?: boolean } = {}) {
  const state = { ...createDemoSeed(NOW), session: { personId: viewer } }
  const store = new DemoStore({ getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }, () => NOW, 0)
  // La vraie source de démonstration (registre des adhésions compris), dans les textes réels.
  const source = options.withCapability === false ? ({} as DiasporaleDataSource) : createDemoDataSource(store)
  const page = options.page ?? LYON
  const view = render(
    <I18nProvider locale={options.locale ?? "fr"}>
      <DataSourceProvider source={source}>
        <AssociationMembershipEntry pageId={page.pageId} handle={page.handle} ownerKind={page.ownerKind} />
      </DataSourceProvider>
    </I18nProvider>,
  )
  return { store, view }
}

/** Un stockage de navigateur en mémoire, neuf à chaque test : le registre de démonstration y vit. */
function memoryStorage(): Storage {
  const items = new Map<string, string>()
  return {
    get length() { return items.size },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  }
}
beforeEach(() => {
  Object.defineProperty(window, "localStorage", { value: memoryStorage(), configurable: true })
})
afterEach(cleanup)

describe("« Devenir adhérent » sur la fiche d'une association", () => {
  it("ne rend rien pour une page qui n'est pas une association", () => {
    const { view } = mount("p-prisca", { page: { pageId: "page-saveurs", handle: "saveurs-okoume-demo", ownerKind: "company" } })
    expect(view.container).toBeEmptyDOMElement()
  })

  it("dit l'indisponibilité quand le fournisseur ne sert pas les associations", () => {
    mount("p-prisca", { withCapability: false })
    expect(screen.getByRole("heading", { name: "Adhésion" })).toBeInTheDocument()
    expect(screen.getByText("L'adhésion aux associations n'est pas encore disponible ici.")).toBeInTheDocument()
  })

  it("demander avec un mot borné, voir la demande en attente, l'annuler", async () => {
    mount("p-prisca")
    expect(screen.getByText(/Suivre la page vous donne son actualité/)).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Gérer les adhérents" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Devenir adhérent" }))
    const sheet = await screen.findByRole("dialog", { name: "Devenir adhérent" })
    expect(within(sheet).getByText(/n'ouvre aucun accès payant au réseau/)).toBeInTheDocument()
    const field = within(sheet).getByLabelText("Un mot pour les responsables (facultatif)")
    fireEvent.change(field, { target: { value: "a".repeat(501) } })
    await act(async () => { fireEvent.click(within(sheet).getByRole("button", { name: "Envoyer ma demande" })) })
    expect(await within(sheet).findByText("Votre mot est trop long.")).toBeInTheDocument()

    fireEvent.change(field, { target: { value: "Je viens d'arriver à Lyon." } })
    await act(async () => { fireEvent.click(within(sheet).getByRole("button", { name: "Envoyer ma demande" })) })
    expect(await screen.findByRole("status")).toHaveTextContent("Votre demande est envoyée aux responsables.")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByText(/^Demande envoyée le /)).toBeInTheDocument()
    expect(screen.getByText("Votre mot : Je viens d'arriver à Lyon.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Mes associations" })).toHaveAttribute("href", routes.myAssociations())

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Annuler ma demande" })) })
    expect(await screen.findByText("Votre demande est annulée.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Devenir adhérent" })).toBeInTheDocument()
  })

  it("une adhérente voit son rôle et quitte après confirmation", async () => {
    mount("p-nadia")
    expect(screen.getByText(/^Vous faites partie des adhérents depuis le /)).toBeInTheDocument()
    expect(screen.getByText("Votre rôle : Animateur")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Quitter l'association" }))
    const sheet = await screen.findByRole("dialog", { name: "Quitter l'association\u00a0?" })
    // Le focus va d'abord sur le geste sans effet.
    expect(within(sheet).getByRole("button", { name: "Annuler" })).toHaveFocus()
    await act(async () => { fireEvent.click(within(sheet).getByRole("button", { name: "Quitter" })) })
    expect(await screen.findByText("Vous avez quitté l'association.")).toBeInTheDocument()
    expect(screen.getByText("Vous avez quitté cette association.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Devenir adhérent" })).toBeInTheDocument()
  })

  it("le responsable vivant trouve le lien de gestion, pas une invitée ; une association sans équipe ne reçoit aucune demande", () => {
    // Steeve administre le collectif (jeu fictif des pages).
    mount("p-steeve")
    expect(screen.getByRole("link", { name: "Gérer les adhérents" })).toHaveAttribute("href", routes.associationMembers("collectif-ivindo-lyon"))
    cleanup()
    // Mireille n'y est qu'invitée : une invitation non acceptée ne donne aucun lien de gestion.
    mount("p-mireille")
    expect(screen.getByRole("button", { name: "Devenir adhérent" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Gérer les adhérents" })).not.toBeInTheDocument()
    cleanup()
    mount("p-prisca", { page: { pageId: "page-asso-bordeaux", handle: "etudiants-bordeaux-demo", ownerKind: "association" } })
    expect(screen.getByText(/n'a pas encore d'équipe sur DIASPORALE/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Devenir adhérent" })).not.toBeInTheDocument()
  })

  it("parle anglais avec les mêmes gestes", () => {
    mount("p-prisca", { locale: "en" })
    expect(screen.getByRole("heading", { name: "Membership" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Become a member" })).toBeInTheDocument()
  })

  it("une page inconnue rend le refus traduit, jamais un écran blanc", () => {
    mount("p-prisca", { page: { pageId: "page-inconnue", handle: "inconnue", ownerKind: "association" } })
    expect(screen.getByRole("alert")).toHaveTextContent(/.+/)
  })
})
