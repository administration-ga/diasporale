// @vitest-environment jsdom
/** L'annuaire des pages (DG-007) : recherche, filtre pays, « Afficher plus », états vide et erreur, cartes. */
import { DataSourceProvider, type DiasporaleDataSource, type PageDirectoryEntry, type PageDirectoryQuery, type PageDirectoryRequest, type PagesCapability } from "@diasporale/features/data"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PageDirectory } from "./page-directory"

const mocks = vi.hoisted(() => ({
  calls: [] as PageDirectoryRequest[],
  answer: vi.fn(),
}))

function entry(id: string, name: string, extra: Partial<PageDirectoryEntry> = {}): PageDirectoryEntry {
  return {
    id, handle: id, name, ownerKind: "association", trust: "community", badge: "community", country: "FR", city: null,
    description: "", followers: 0, claimable: false, following: false, ...extra,
  }
}

function capability(): PagesCapability {
  return {
    usePage: () => ({ status: "loading" }),
    useHubPages: () => ({ status: "loading" }),
    useDirectory: (args) => {
      mocks.calls.push(args)
      return mocks.answer(args) as PageDirectoryQuery
    },
    follow: vi.fn(),
    unfollow: vi.fn(),
  }
}

// Lecteur anonyme : l'annuaire lit la session pour repartir de zéro quand le lecteur change.
function source(): DiasporaleDataSource {
  return {
    kind: "engine",
    pages: capability(),
    useOpenCountries: () => ({ status: "ready", data: [] }),
    useSession: () => ({ status: "ready", data: { status: "anonymous" } }),
  } as unknown as DiasporaleDataSource
}

function tree(props: { country?: "FR" } = {}, withSource = true) {
  const directory = <PageDirectory {...props} />
  return <I18nProvider locale="fr">{withSource ? <DataSourceProvider source={source()}>{directory}</DataSourceProvider> : directory}</I18nProvider>
}

function ready(items: PageDirectoryEntry[], continueCursor: string | null = null): PageDirectoryQuery {
  return { status: "ready", data: { items, isDone: continueCursor === null, continueCursor } }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.calls.length = 0
  mocks.answer.mockImplementation(() => ready([]))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("PageDirectory", () => {
  it("sans capacité « pages », l'annuaire se dit indisponible", () => {
    render(tree({}, false))
    expect(screen.getByText("L'annuaire des pages n'est pas disponible ici.")).toBeInTheDocument()
  })

  it("montre des cartes à badge calculé, menant à la fiche, et dit ce que le lecteur suit", () => {
    mocks.answer.mockImplementation(() => ready([
      entry("collectif-lyon", "Collectif de Lyon", { trust: "verified", badge: "verified", following: true, description: "Accueil des nouveaux arrivants." }),
      entry("radio-diaspora", "Radio Diaspora", { ownerKind: "media" }),
    ]))
    render(tree())
    const list = screen.getByRole("list", { name: "Pages trouvées" })
    const cards = within(list).getAllByRole("listitem")
    expect(cards).toHaveLength(2)
    expect(within(cards[0]!).getByRole("heading", { name: "Collectif de Lyon" })).toBeInTheDocument()
    expect(within(cards[0]!).getByText("Association")).toBeInTheDocument()
    expect(within(cards[0]!).getByText("Suivie")).toBeInTheDocument()
    expect(within(cards[0]!).getByText("Accueil des nouveaux arrivants.")).toBeInTheDocument()
    expect(within(cards[0]!).getByRole("link", { name: /Voir la page/ })).toHaveAttribute("href", "/pages/collectif-lyon")
    expect(within(cards[1]!).getByText("Média")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Afficher plus" })).not.toBeInTheDocument()
  })

  it("« Afficher plus » lit la fenêtre suivante par son curseur et garde les premières", () => {
    mocks.answer.mockImplementation((args: PageDirectoryRequest) =>
      args.cursor === null ? ready([entry("a", "Association A")], "curseur-1") : ready([entry("b", "Association B")]),
    )
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: "Afficher plus" }))
    expect(mocks.calls.some((call) => call.cursor === "curseur-1")).toBe(true)
    expect(within(screen.getByRole("list", { name: "Pages trouvées" })).getAllByRole("listitem")).toHaveLength(2)
    expect(screen.queryByRole("button", { name: "Afficher plus" })).not.toBeInTheDocument()
  })

  it("cherche après la frappe, à partir de deux caractères, et le dit quand rien ne correspond", () => {
    vi.useFakeTimers()
    render(tree())
    fireEvent.change(screen.getByRole("searchbox", { name: "Chercher une page" }), { target: { value: " lyon " } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(mocks.calls.at(-1)).toEqual({ query: "lyon", cursor: null })
    expect(screen.getByText(/Aucune page ne correspond à/)).toHaveTextContent("lyon")
  })

  it("le pays donné est le filtre de départ ; « Tous les pays » l'ôte", () => {
    render(tree({ country: "FR" }))
    expect(mocks.calls.at(-1)).toEqual({ query: "", cursor: null, country: "FR" })
    expect(screen.getByRole("button", { name: "France" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "Tous les pays" }))
    expect(mocks.calls.at(-1)).toEqual({ query: "", cursor: null })
    expect(screen.getByText("Aucune page pour l'instant.")).toBeInTheDocument()
  })

  it("une erreur se dit par un code traduit, avec reprise si le fournisseur en a une", async () => {
    const retry = vi.fn().mockResolvedValue(undefined)
    mocks.answer.mockImplementation(() => ({ status: "error", code: "rate_limited", retry }))
    render(tree())
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("L'annuaire des pages n'a pas pu être chargé.")
    expect(alert).toHaveTextContent(/Trop de demandes/)
    await act(async () => {
      fireEvent.click(within(alert).getByRole("button", { name: "Réessayer" }))
    })
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.queryByText("Aucune page pour l'instant.")).not.toBeInTheDocument()
  })
})
