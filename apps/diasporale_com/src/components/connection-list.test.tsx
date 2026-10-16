// @vitest-environment jsdom
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ConnectionList, type ConnectionListLabels, type ConnectionListProps, type ConnectionListRow } from "./connection-list"

const labels: ConnectionListLabels = {
  member: "Membre indisponible",
  loading: "Chargement des relations",
  errorTitle: "Lecture interrompue",
  errorBody: "Réessayez dans un instant.",
  retry: "Réessayer",
  emptyTitle: "Aucune relation",
  emptyBody: "Votre liste est vide.",
  discover: "Découvrir des membres",
  loadMore: "Voir plus",
  loadingMore: "Chargement suivant",
  accept: "Accepter",
  decline: "Refuser",
  readOnly: "Votre adhésion ne permet pas de répondre.",
}

const awa: ConnectionListRow = {
  connectionId: "connection-awa",
  personId: "person-awa",
  displayName: "Awa Ogooué",
  handle: "awa.ogooue",
  headline: "Architecte à Lyon",
  badges: ["verified"],
  message: "Bonjour Awa",
}

function props(overrides: Partial<ConnectionListProps> = {}): ConnectionListProps {
  return {
    items: [],
    kind: "accepted",
    isLoading: false,
    isLoadingMore: false,
    isError: false,
    hasMore: false,
    canRespond: true,
    onRetry: vi.fn(),
    onMore: vi.fn(),
    onRespond: vi.fn().mockResolvedValue(undefined),
    profileHref: (handle) => `/@${handle}`,
    discoverHref: "/membres",
    labels,
    ...overrides,
  }
}

function view(value: ConnectionListProps) {
  return <I18nProvider locale="fr"><ConnectionList {...value} /></I18nProvider>
}

afterEach(cleanup)

describe("ConnectionList — relations et demandes reçues", () => {
  it("annonce le chargement initial sans afficher l'état vide", () => {
    const { container } = render(view(props({ isLoading: true })))

    expect(screen.getByRole("status")).toHaveTextContent(labels.loading)
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2)
    expect(screen.queryByText(labels.emptyTitle)).not.toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("fait passer l'erreur avant le chargement et le vide, puis permet de réessayer", () => {
    const value = props({ isError: true, isLoading: true })
    render(view(value))

    expect(screen.getByRole("alert")).toHaveTextContent(labels.errorTitle)
    expect(screen.getByRole("alert")).toHaveTextContent(labels.errorBody)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.queryByText(labels.emptyTitle)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: labels.retry }))
    expect(value.onRetry).toHaveBeenCalledOnce()
  })

  it("conserve les relations déjà lues sur erreur, avec profil et badges, sans message de demande", () => {
    render(view(props({ items: [awa], isError: true })))

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByRole("listitem")).toHaveTextContent(awa.displayName!)
    expect(screen.getByRole("link", { name: /Awa Ogooué/ })).toHaveAttribute("href", "/@awa.ogooue")
    expect(screen.getByText("@awa.ogooue")).toBeInTheDocument()
    expect(screen.getByText(awa.headline!)).toBeInTheDocument()
    expect(screen.getByText("Vérifié")).toBeInTheDocument()
    expect(screen.queryByText(awa.message!)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: labels.accept })).not.toBeInTheDocument()
    expect(screen.queryByText(labels.emptyTitle)).not.toBeInTheDocument()
  })

  it("propose la découverte lorsque la liste est réellement vide", () => {
    render(view(props()))

    expect(screen.getByRole("heading", { name: labels.emptyTitle })).toBeInTheDocument()
    expect(screen.getByText(labels.emptyBody)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: labels.discover })).toHaveAttribute("href", "/membres")
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
  })

  it("rend un nom neutre sans lien lorsque le profil n'est plus publié", () => {
    const profileHref = vi.fn()
    render(view(props({ items: [{ ...awa, displayName: null, handle: null, headline: null, badges: [] }], profileHref })))

    expect(screen.getByText(labels.member)).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.queryByText("@awa.ogooue")).not.toBeInTheDocument()
    expect(profileHref).not.toHaveBeenCalled()
  })

  it("charge la suite et bloque le bouton pendant ce chargement", () => {
    const value = props({ items: [awa], hasMore: true })
    const { rerender } = render(view(value))

    fireEvent.click(screen.getByRole("button", { name: labels.loadMore }))
    expect(value.onMore).toHaveBeenCalledOnce()
    rerender(view({ ...value, isLoadingMore: true }))
    expect(screen.getByRole("button", { name: labels.loadingMore })).toBeDisabled()
    expect(screen.getByRole("listitem")).toHaveTextContent(awa.displayName!)
    rerender(view({ ...value, hasMore: false }))
    expect(screen.queryByRole("button", { name: labels.loadMore })).not.toBeInTheDocument()
  })

  it("répond avec l'identifiant de la demande, bloque seulement sa ligne, puis la conserve après succès ou échec", async () => {
    let finish: () => void = () => {}
    const pending = new Promise<void>((resolve) => { finish = resolve })
    const onRespond = vi.fn().mockReturnValueOnce(pending).mockRejectedValueOnce(new Error("refus de l'action"))
    const other = { ...awa, connectionId: "connection-bob", personId: "person-bob", displayName: "Bob", handle: "bob", badges: [] }
    render(view(props({ items: [awa, other], kind: "received", onRespond })))

    const rows = screen.getAllByRole("listitem")
    expect(within(rows[0]!).getByText(awa.message!)).toBeInTheDocument()
    fireEvent.click(within(rows[0]!).getByRole("button", { name: labels.accept }))
    expect(onRespond).toHaveBeenLastCalledWith(awa.connectionId, true)
    expect(within(rows[0]!).getByRole("button", { name: labels.accept })).toBeDisabled()
    expect(within(rows[0]!).getByRole("button", { name: labels.decline })).toBeDisabled()
    expect(within(rows[1]!).getByRole("button", { name: labels.accept })).toBeEnabled()

    await act(async () => { finish(); await pending })
    expect(within(rows[0]!).getByRole("button", { name: labels.accept })).toBeEnabled()
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    fireEvent.click(within(rows[0]!).getByRole("button", { name: labels.decline }))
    expect(onRespond).toHaveBeenLastCalledWith(awa.connectionId, false)
    await waitFor(() => expect(within(rows[0]!).getByRole("button", { name: labels.decline })).toBeEnabled())
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
  })

  it("explique une seule fois la lecture seule et ferme les réponses de chaque demande", () => {
    const value = props({ items: [awa, { ...awa, connectionId: "connection-other" }], kind: "received", canRespond: false })
    render(view(value))

    expect(screen.getAllByText(labels.readOnly)).toHaveLength(1)
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled()
    fireEvent.click(screen.getAllByRole("button", { name: labels.accept })[0]!)
    expect(value.onRespond).not.toHaveBeenCalled()
  })
})
