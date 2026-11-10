// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY, SERVICE_REQUEST_ACTORS, SERVICE_REQUEST_STATUSES } from "@diasporale/domain"
import type {
  ActionResult,
  Loadable,
  MembershipView,
  ServiceRequestDetailView,
  ServiceRequestsCapability,
  ServiceRequestsPageQuery,
  ServiceRequestSummaryView,
} from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ServiceInbox } from "@/components/service-inbox"
import { filledButtons } from "@/test-utils"

import { ActivityRequestScreen, MyServiceRequestScreen, MyServiceRequestsScreen } from "./service-request-screens"

const mocks = vi.hoisted(() => ({
  capability: null as unknown,
  conversations: null as unknown,
  push: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock("@/components/gate", () => ({
  Gate: (props: { children: (session: { membership: MembershipView }) => ReactNode }) => <>{props.children({ membership: MEMBER })}</>,
}))
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }))
// Les avis ont leur contrat de composant propre ; cette fixture isole les demandes.
vi.mock("@/components/service-reviews-section", () => ({ ServiceRequestReview: () => null }))
vi.mock("@diasporale/features/data", async (original) => ({
  ...await original<typeof import("@diasporale/features/data")>(),
  useServiceRequests: () => mocks.capability,
  // CC-6 : sans fournisseur de conversations, l'entrée de conversation ne s'affiche pas ; son contrat est testé à part.
  useConversations: () => mocks.conversations,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

const HOUR = 3_600_000
const DAY = 24 * HOUR
const NOW = Date.UTC(2026, 9, 18, 10)
const MEMBER: MembershipView = {
  personId: "person-awa", handle: "awa", displayName: "Awa OGOOUÉ", status: "declaree", badges: ["verified"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: null, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: true, rateTier: "standard", directoryVisibility: "hidden",
}

const SUMMARY: ServiceRequestSummaryView = {
  requestId: "request-1", status: "proposed", offerId: "offer-1", offerTitle: "Tresses africaines", offerVersion: 3,
  page: { pageId: "page-1", handle: "salon-test", name: "Salon de test", logoUrl: null }, requester: null,
  windows: [{ startAt: NOW + DAY, endAt: NOW + DAY + 4 * HOUR }], timeZone: "Europe/Paris",
  currentProposal: { version: 1, amountMinor: 4500, currency: "EUR", startAt: NOW + DAY + HOUR, endAt: NOW + DAY + 2 * HOUR, timeZone: "Europe/Paris", expiresAt: NOW + 12 * HOUR },
  booking: null, deadlineAt: NOW + 12 * HOUR, createdAt: NOW - HOUR, updatedAt: NOW - HOUR,
}

const PROPOSAL = {
  version: 1, amountMinor: 4500, currency: "EUR", durationMinutes: 60, startAt: NOW + DAY + HOUR, endAt: NOW + DAY + 2 * HOUR,
  timeZone: "Europe/Paris", location: { mode: "onsite" as const, area: "Paris 11e" }, details: "Mèches fournies.",
  cancellationTerms: "Annulation libre jusqu'à la veille.", expiresAt: NOW + 12 * HOUR, state: "current" as const, createdAt: NOW - HOUR,
}

function detail(overrides: Partial<ServiceRequestDetailView> = {}): ServiceRequestDetailView {
  return {
    ...SUMMARY, viewerRole: "requester", need: "Tresses pour un mariage.", proposals: [PROPOSAL],
    timeline: [{ status: "sent", at: NOW - 2 * HOUR, version: null }, { status: "proposed", at: NOW - HOUR, version: 1 }],
    closedBy: null, closedReason: null, actions: ["cancel", "accept"], ...overrides,
  }
}

const done = <T,>(value: T): Promise<ActionResult<T>> => Promise.resolve({ ok: true, value })

function fake(overrides: Partial<ServiceRequestsCapability> & { pages?: Record<string, ServiceRequestsPageQuery>; request?: Loadable<ServiceRequestDetailView | null> } = {}) {
  const myRequests = vi.fn((args: { cursor: string | null }) => overrides.pages?.[String(args.cursor)] ?? ({ status: "loading" } as const))
  const pageRequests = vi.fn((args: { pageId: string; status: string | null; cursor: string | null }) => overrides.pages?.[`${args.status}:${args.cursor}`] ?? ({ status: "loading" } as const))
  const capability: ServiceRequestsCapability = {
    useMyRequests: myRequests,
    usePageRequests: pageRequests,
    useRequest: () => overrides.request ?? { status: "loading" },
    send: vi.fn(),
    propose: vi.fn(() => done({ version: 1 })),
    refuse: vi.fn(() => done(null)),
    cancel: vi.fn(() => done(null)),
    accept: vi.fn(() => done({ bookingId: "booking-1" })),
    complete: vi.fn(() => done(null)),
    markNoShow: vi.fn(() => done(null)),
    ...overrides,
  }
  mocks.capability = capability
  return { capability, myRequests, pageRequests }
}

function page(items: readonly ServiceRequestSummaryView[], continueCursor: string | null = null): ServiceRequestsPageQuery {
  return { status: "ready", data: { items, continueCursor, isDone: continueCursor === null } }
}

function tree(node: ReactNode, locale: "fr" | "en" = "fr") {
  return <I18nProvider locale={locale}>{node}</I18nProvider>
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  vi.clearAllMocks()
  mocks.capability = null
  mocks.conversations = null
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("/mes-demandes", () => {
  it("liste mes demandes, page après page, sans doublon, avec l'état et l'étape suivante", () => {
    const second = { ...SUMMARY, requestId: "request-2", offerTitle: "Photographie de mariage", status: "sent" as const, currentProposal: null, deadlineAt: NOW + DAY }
    const { myRequests } = fake({ pages: { null: page([SUMMARY], "suite"), suite: page([SUMMARY, second]) } })
    render(tree(<MyServiceRequestsScreen />))
    expect(screen.getByRole("heading", { name: "Mes demandes" })).toBeTruthy()
    expect(screen.getByText("Proposition à accepter")).toBeTruthy()
    expect(screen.getByText(/Proposition à accepter avant le/)).toBeTruthy()
    expect(screen.getByRole("link", { name: "Ouvrir" }).getAttribute("href")).toBe("/mes-demandes/request-1")
    fireEvent.click(screen.getByRole("button", { name: "Voir plus de demandes" }))
    expect(myRequests).toHaveBeenCalledWith({ cursor: "suite" })
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.getByText(/Première disponibilité/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Voir plus de demandes" })).toBeNull()
  })

  it("dit l'absence de demande, la panne et l'indisponibilité", () => {
    fake({ pages: { null: page([]) } })
    const view = render(tree(<MyServiceRequestsScreen />))
    expect(screen.getByText("Aucune demande pour le moment")).toBeTruthy()
    view.unmount()
    fake({ pages: { null: { status: "error", code: "rate_limited" } } })
    const failed = render(tree(<MyServiceRequestsScreen />))
    expect(screen.getByRole("alert").textContent).toMatch(/Trop de demandes d'affilée/)
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy()
    failed.unmount()
    mocks.capability = null
    render(tree(<MyServiceRequestsScreen />))
    expect(screen.getByText("Demandes indisponibles")).toBeTruthy()
  })
})

describe("/mes-demandes/<id> — côté demandeur", () => {
  it("montre la proposition courante et l'accepte après confirmation explicite", async () => {
    const { capability } = fake({ request: { status: "ready", data: detail() } })
    render(tree(<MyServiceRequestScreen requestId="request-1" />))
    expect(screen.getByRole("heading", { name: "Tresses africaines" })).toBeTruthy()
    expect(screen.getByText("Demande adressée à Salon de test")).toBeTruthy()
    expect(screen.getAllByText(/45,00/).length).toBeGreaterThan(0)
    expect(screen.getAllByText("Paris 11e (lieu approximatif)").length).toBeGreaterThan(0)
    expect(screen.getByText(/Mise en relation seulement/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Accepter cette proposition" }))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByText("Confirmer le rendez-vous")).toBeTruthy()
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Je confirme le rendez-vous" })) })
    expect(capability.accept).toHaveBeenCalledWith({ requestId: "request-1", expectedProposalVersion: 1 })
    expect(mocks.success).toHaveBeenCalledWith("Rendez-vous confirmé")
  })

  it("R-G07 : une version changée entre-temps est refusée et le dit dans la confirmation", async () => {
    fake({ request: { status: "ready", data: detail() }, accept: vi.fn(() => Promise.resolve({ ok: false as const, code: "proposal_version_changed" as const })) })
    render(tree(<MyServiceRequestScreen requestId="request-1" />))
    fireEvent.click(screen.getByRole("button", { name: "Accepter cette proposition" }))
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Je confirme le rendez-vous" })) })
    expect(within(screen.getByRole("dialog")).getByText(/La proposition a changé entre-temps/)).toBeTruthy()
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it("R-G07 : la feuille d'accord cite la version lue, même si une nouvelle version arrive pendant la lecture", async () => {
    fake({ request: { status: "ready", data: detail() } })
    const view = render(tree(<MyServiceRequestScreen requestId="request-1" />))
    fireEvent.click(screen.getByRole("button", { name: "Accepter cette proposition" }))
    const second = { ...PROPOSAL, version: 2, amountMinor: 5000, createdAt: NOW }
    const updated = detail({ currentProposal: { ...SUMMARY.currentProposal!, version: 2, amountMinor: 5000 }, proposals: [second, { ...PROPOSAL, state: "superseded" }] })
    const { capability } = fake({ request: { status: "ready", data: updated }, accept: vi.fn(() => Promise.resolve({ ok: false as const, code: "proposal_version_changed" as const })) })
    view.rerender(tree(<MyServiceRequestScreen requestId="request-1" />))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getAllByText(/45,00/).length).toBeGreaterThan(0)
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Je confirme le rendez-vous" })) })
    expect(capability.accept).toHaveBeenCalledWith({ requestId: "request-1", expectedProposalVersion: 1 })
    expect(within(dialog).getByText(/La proposition a changé entre-temps/)).toBeTruthy()
  })

  it("constate l'expiration à l'écran : plus aucun bouton d'accord après l'échéance", () => {
    fake({ request: { status: "ready", data: detail() } })
    vi.setSystemTime(NOW + 13 * HOUR)
    render(tree(<MyServiceRequestScreen requestId="request-1" />))
    expect(screen.getByText("Expirée")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Accepter cette proposition" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Annuler la demande" })).toBeNull()
  })

  it("annule un rendez-vous convenu avec un motif obligatoire", async () => {
    const booking = { startAt: NOW + DAY + HOUR, endAt: NOW + DAY + 2 * HOUR, timeZone: "Europe/Paris", status: "confirmed" as const }
    const { capability } = fake({ request: { status: "ready", data: detail({ status: "confirmed", booking, deadlineAt: null, actions: ["cancel"] }) } })
    render(tree(<MyServiceRequestScreen requestId="request-1" />))
    expect(screen.getByText("Rendez-vous confirmé par les deux parties.")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Annuler le rendez-vous" }))
    const dialog = screen.getByRole("dialog")
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Annuler le rendez-vous" })) })
    expect(within(dialog).getByText("Indiquez un motif.")).toBeTruthy()
    fireEvent.change(within(dialog).getByLabelText("Motif"), { target: { value: "Empêchement familial" } })
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Annuler le rendez-vous" })) })
    expect(capability.cancel).toHaveBeenCalledWith({ requestId: "request-1", reason: "Empêchement familial" })
  })

  it("une demande introuvable pour moi le dit, sans rien d'autre", () => {
    fake({ request: { status: "ready", data: null } })
    render(tree(<MyServiceRequestScreen requestId="request-x" />))
    expect(screen.getByText("Demande introuvable")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Mes demandes" }).getAttribute("href")).toBe("/mes-demandes")
  })
})

describe("/mon-activite/demandes/<id> — côté page", () => {
  const sent = () => detail({
    viewerRole: "page", status: "sent", requester: { displayName: "Awa OGOOUÉ", handle: "awa" }, currentProposal: null,
    proposals: [], deadlineAt: NOW + DAY + 4 * HOUR, actions: ["propose", "refuse"], timeline: [{ status: "sent", at: NOW - HOUR, version: null }],
  })

  it("propose des conditions complètes, lues dans le fuseau choisi", async () => {
    const { capability } = fake({ request: { status: "ready", data: sent() } })
    render(tree(<ActivityRequestScreen requestId="request-1" />))
    expect(screen.getByText("Demande de Awa OGOOUÉ")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Faire une proposition" }))
    fireEvent.change(screen.getByLabelText("Montant"), { target: { value: "45,50" } })
    fireEvent.change(screen.getByLabelText("Date du rendez-vous"), { target: { value: "2026-10-20" } })
    fireEvent.change(screen.getByLabelText("Heure de début"), { target: { value: "14:30" } })
    fireEvent.change(screen.getByLabelText("Durée en minutes"), { target: { value: "90" } })
    fireEvent.change(screen.getByLabelText("Fuseau horaire"), { target: { value: "Europe/Paris" } })
    fireEvent.change(screen.getByLabelText("Ville ou quartier"), { target: { value: "Paris 11e" } })
    fireEvent.change(screen.getByLabelText("Ce que comprend la prestation"), { target: { value: "Tresses, mèches fournies." } })
    fireEvent.change(screen.getByLabelText("Conditions d’annulation"), { target: { value: "Annulation libre jusqu'à la veille." } })
    fireEvent.change(screen.getByLabelText("À accepter avant le (date)"), { target: { value: "2026-10-19" } })
    fireEvent.change(screen.getByLabelText("À accepter avant (heure)"), { target: { value: "18:00" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Envoyer la proposition" })) })
    expect(capability.propose).toHaveBeenCalledWith({
      requestId: "request-1", expectedVersion: 0, amountMinor: 4550, currency: "EUR", durationMinutes: 90,
      startAt: Date.UTC(2026, 9, 20, 12, 30), timeZone: "Europe/Paris", location: { mode: "onsite", area: "Paris 11e" },
      details: "Tresses, mèches fournies.", cancellationTerms: "Annulation libre jusqu'à la veille.", expiresAt: Date.UTC(2026, 9, 19, 16),
    })
    expect(mocks.success).toHaveBeenCalledWith("Proposition envoyée (version 1)")
  })

  it("le formulaire cite la version lue à son ouverture : la version d'un autre signataire n'est pas écrasée", async () => {
    const proposed = detail({ viewerRole: "page", requester: { displayName: "Awa OGOOUÉ", handle: "awa" }, actions: ["propose", "refuse"] })
    fake({ request: { status: "ready", data: proposed } })
    const view = render(tree(<ActivityRequestScreen requestId="request-1" />))
    fireEvent.click(screen.getByRole("button", { name: "Modifier la proposition" }))
    const updated = detail({ viewerRole: "page", requester: { displayName: "Awa OGOOUÉ", handle: "awa" }, actions: ["propose", "refuse"], currentProposal: { ...SUMMARY.currentProposal!, version: 2 } })
    const { capability } = fake({ request: { status: "ready", data: updated }, propose: vi.fn(() => Promise.resolve({ ok: false as const, code: "proposal_version_changed" as const })) })
    view.rerender(tree(<ActivityRequestScreen requestId="request-1" />))
    fireEvent.change(screen.getByLabelText("Montant"), { target: { value: "50" } })
    fireEvent.change(screen.getByLabelText("Date du rendez-vous"), { target: { value: "2026-10-21" } })
    fireEvent.change(screen.getByLabelText("Heure de début"), { target: { value: "10:00" } })
    fireEvent.change(screen.getByLabelText("Fuseau horaire"), { target: { value: "Europe/Paris" } })
    fireEvent.change(screen.getByLabelText("Ville ou quartier"), { target: { value: "Paris 11e" } })
    fireEvent.change(screen.getByLabelText("Ce que comprend la prestation"), { target: { value: "Tresses." } })
    fireEvent.change(screen.getByLabelText("Conditions d’annulation"), { target: { value: "Libre." } })
    fireEvent.change(screen.getByLabelText("À accepter avant le (date)"), { target: { value: "2026-10-20" } })
    fireEvent.change(screen.getByLabelText("À accepter avant (heure)"), { target: { value: "10:00" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Envoyer la proposition" })) })
    expect(capability.propose).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 1, amountMinor: 5000 }))
    expect(screen.getByText(/La proposition a changé entre-temps/)).toBeTruthy()
  })

  it("refuse une proposition mal formée au champ, sans l'envoyer", async () => {
    const { capability } = fake({ request: { status: "ready", data: sent() } })
    render(tree(<ActivityRequestScreen requestId="request-1" />))
    fireEvent.click(screen.getByRole("button", { name: "Faire une proposition" }))
    fireEvent.change(screen.getByLabelText("Montant"), { target: { value: "45,555" } })
    fireEvent.change(screen.getByLabelText("Ville ou quartier"), { target: { value: "8 rue Oberkampf" } })
    fireEvent.change(screen.getByLabelText("Ce que comprend la prestation"), { target: { value: "Tresses." } })
    fireEvent.change(screen.getByLabelText("Conditions d’annulation"), { target: { value: "Libre." } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Envoyer la proposition" })) })
    expect(screen.getByText(/Indiquez un montant valide/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText("Montant"), { target: { value: "45" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Envoyer la proposition" })) })
    expect(screen.getByText(/Retirez l’adresse exacte/)).toBeTruthy()
    expect(capability.propose).not.toHaveBeenCalled()
  })

  it("décline une demande, motif facultatif", async () => {
    const { capability } = fake({ request: { status: "ready", data: sent() } })
    render(tree(<ActivityRequestScreen requestId="request-1" />))
    fireEvent.click(screen.getByRole("button", { name: "Décliner la demande" }))
    await act(async () => { fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Décliner" })) })
    expect(capability.refuse).toHaveBeenCalledWith({ requestId: "request-1", reason: null })
  })

  it("après l'accord : constat de la réalisation ou de l'absence seulement après le début", async () => {
    const booking = { startAt: NOW + HOUR, endAt: NOW + 2 * HOUR, timeZone: "Europe/Paris", status: "confirmed" as const }
    const confirmed = detail({ viewerRole: "page", status: "confirmed", requester: { displayName: "Awa OGOOUÉ", handle: "awa" }, booking, deadlineAt: null, actions: ["cancel"] })
    const { capability } = fake({ request: { status: "ready", data: confirmed } })
    const before = render(tree(<ActivityRequestScreen requestId="request-1" />))
    expect(screen.queryByRole("button", { name: "Constater une absence" })).toBeNull()
    expect(screen.getByRole("button", { name: "Annuler le rendez-vous" })).toBeTruthy()
    before.unmount()
    vi.setSystemTime(NOW + HOUR)
    render(tree(<ActivityRequestScreen requestId="request-1" />))
    expect(screen.queryByRole("button", { name: "Annuler le rendez-vous" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Constater une absence" }))
    await act(async () => { fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Constater l’absence" })) })
    expect(capability.markNoShow).toHaveBeenCalledWith("request-1")
    expect(screen.getByRole("button", { name: "Prestation réalisée" })).toBeTruthy()
  })
})

describe("SV-04 — proposition préremplie depuis l'offre et ses réglages", () => {
  const requester = { displayName: "Awa OGOOUÉ", handle: "awa" }
  const settings = { timeZone: "Europe/Paris", location: { mode: "onsite" as const, area: "Paris 11e" }, cancellationTerms: "Annulation libre jusqu'à la veille.", bookingCapacity: 1 }
  const sentWith = (proposalPrefill: ServiceRequestDetailView["proposalPrefill"]) => detail({
    viewerRole: "page", status: "sent", requester, currentProposal: null, proposals: [], deadlineAt: NOW + DAY + 4 * HOUR,
    actions: ["propose", "refuse"], timeline: [{ status: "sent", at: NOW - HOUR, version: null }], proposalPrefill,
  })
  const value = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value

  it("offre à prix fixe : tout est repris, rien n'est envoyé sans validation, puis la proposition part telle quelle", async () => {
    const { capability } = fake({ request: { status: "ready", data: sentWith({ pricing: { mode: "fixed", amountMinor: 4500, currency: "EUR" }, durationMinutes: 90, delivery: "onsite", city: "Paris", settings }) } })
    render(tree(<ActivityRequestScreen requestId="request-1" />))
    fireEvent.click(screen.getByRole("button", { name: "Faire une proposition" }))
    expect(screen.getByText(/Formulaire prérempli depuis l’offre/)).toBeTruthy()
    expect(capability.propose).not.toHaveBeenCalled()
    expect([value("Montant"), value("Devise"), value("Durée en minutes"), value("Fuseau horaire")]).toEqual(["45", "EUR", "90", "Europe/Paris"])
    // La première disponibilité du demandeur (le 19 à 10 h UTC), lue à Paris ; l'échéance au plus tard au début.
    expect([value("Date du rendez-vous"), value("Heure de début"), value("À accepter avant le (date)"), value("À accepter avant (heure)")]).toEqual(["2026-10-19", "12:00", "2026-10-19", "12:00"])
    expect([value("Ville ou quartier"), value("Ce que comprend la prestation"), value("Conditions d’annulation")]).toEqual(["Paris 11e", "Tresses africaines", "Annulation libre jusqu'à la veille."])
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Envoyer la proposition" })) })
    expect(capability.propose).toHaveBeenCalledWith({
      requestId: "request-1", expectedVersion: 0, amountMinor: 4500, currency: "EUR", durationMinutes: 90, startAt: Date.UTC(2026, 9, 19, 10),
      timeZone: "Europe/Paris", location: { mode: "onsite", area: "Paris 11e" }, details: "Tresses africaines",
      cancellationTerms: "Annulation libre jusqu'à la veille.", expiresAt: Date.UTC(2026, 9, 19, 10),
    })
  })

  it("offre sur devis : montant laissé vide et refusé à l'envoi ; la ville de l'offre sert de lieu approximatif", async () => {
    const { capability } = fake({ request: { status: "ready", data: sentWith({ pricing: { mode: "quote" }, durationMinutes: null, delivery: "both", city: "Paris", settings: { timeZone: null, location: null, cancellationTerms: null, bookingCapacity: 1 } }) } })
    render(tree(<ActivityRequestScreen requestId="request-1" />))
    fireEvent.click(screen.getByRole("button", { name: "Faire une proposition" }))
    expect([value("Montant"), value("Durée en minutes"), value("Ville ou quartier"), value("Conditions d’annulation")]).toEqual(["", "60", "Paris", ""])
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Envoyer la proposition" })) })
    expect(screen.getByText(/Indiquez un montant valide/)).toBeTruthy()
    expect(capability.propose).not.toHaveBeenCalled()
  })

  it("une offre à distance seulement se propose à distance", () => {
    fake({ request: { status: "ready", data: sentWith({ pricing: { mode: "from", amountMinor: 3000, currency: "XAF" }, durationMinutes: 45, delivery: "remote", city: "Paris", settings: { timeZone: null, location: null, cancellationTerms: null, bookingCapacity: 1 } }) } })
    render(tree(<ActivityRequestScreen requestId="request-1" />))
    fireEvent.click(screen.getByRole("button", { name: "Faire une proposition" }))
    expect((screen.getByLabelText("À distance") as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByLabelText("Ville ou quartier")).toBeNull()
    expect([value("Montant"), value("Devise"), value("Durée en minutes")]).toEqual(["3000", "XAF", "45"])
  })

  it("« Reprendre la version précédente » recopie la dernière version, sans rien envoyer", () => {
    const proposed = detail({ viewerRole: "page", requester, actions: ["propose", "refuse"], proposalPrefill: { pricing: { mode: "fixed", amountMinor: 9900, currency: "EUR" }, durationMinutes: 120, delivery: "onsite", city: "Lyon", settings } })
    const { capability } = fake({ request: { status: "ready", data: proposed } })
    render(tree(<ActivityRequestScreen requestId="request-1" />))
    fireEvent.click(screen.getByRole("button", { name: "Modifier la proposition" }))
    expect(value("Montant")).toBe("99")
    fireEvent.click(screen.getByRole("button", { name: "Reprendre la version précédente (version 1)" }))
    expect([value("Montant"), value("Durée en minutes"), value("Ce que comprend la prestation"), value("Heure de début")]).toEqual(["45", "60", "Mèches fournies.", "13:00"])
    expect(capability.propose).not.toHaveBeenCalled()
  })
})

describe("SV-03 — déplacer un rendez-vous confirmé", () => {
  const requester = { displayName: "Awa OGOOUÉ", handle: "awa" }
  const booking = { startAt: NOW + DAY + HOUR, endAt: NOW + DAY + 2 * HOUR, timeZone: "Europe/Paris", status: "confirmed" as const }
  const NEW_START = Date.UTC(2026, 9, 20, 12)
  const pending = { startAt: NEW_START, endAt: NEW_START + HOUR, timeZone: "Europe/Paris", proposedBy: "page" as const, proposedAt: NOW - HOUR, expiresAt: NOW + 6 * HOUR }
  const confirmed = (overrides: Partial<ServiceRequestDetailView> = {}) => detail({ status: "confirmed", booking, deadlineAt: null, actions: ["cancel"], rescheduleActions: [], reschedule: null, ...overrides })
  const zoneName = getFixedT("fr")("serviceReschedule.title")

  it("côté demandeur : l'ancien et le nouvel horaire se lisent, l'accord cite l'horaire lu", async () => {
    const acceptReschedule = vi.fn(() => done({ version: 2 }))
    fake({ request: { status: "ready", data: confirmed({ reschedule: pending, rescheduleActions: ["accept_reschedule", "decline_reschedule"] }) }, acceptReschedule, proposeReschedule: vi.fn(), declineReschedule: vi.fn() })
    render(tree(<MyServiceRequestScreen requestId="request-1" />))
    const zone = screen.getByRole("region", { name: zoneName })
    expect(within(zone).getByText("La page propose un nouvel horaire")).toBeTruthy()
    expect(within(zone).getByText("Horaire actuel")).toBeTruthy()
    expect(within(zone).getByText(/mardi 20 octobre 2026/)).toBeTruthy()
    expect(within(zone).getByText(/Sans accord, le rendez-vous reste tel quel/)).toBeTruthy()
    const accept = within(zone).getByRole("button", { name: "Accepter le nouvel horaire" })
    expect(filledButtons(zone)).toEqual([accept])
    fireEvent.click(accept)
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByText("Nouvel horaire")).toBeTruthy()
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "J’accepte le nouvel horaire" })) })
    expect(acceptReschedule).toHaveBeenCalledWith({ requestId: "request-1", expectedProposalVersion: 1, expectedStartAt: NEW_START })
    expect(mocks.success).toHaveBeenCalledWith("Rendez-vous déplacé")
  })

  it("garder l'horaire actuel le dit à la page ; le proposant retire le sien", async () => {
    const declineReschedule = vi.fn(() => done(null))
    fake({ request: { status: "ready", data: confirmed({ reschedule: pending, rescheduleActions: ["accept_reschedule", "decline_reschedule"] }) }, declineReschedule, proposeReschedule: vi.fn(), acceptReschedule: vi.fn() })
    const view = render(tree(<MyServiceRequestScreen requestId="request-1" />))
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Garder l’horaire actuel" })) })
    expect(declineReschedule).toHaveBeenCalledWith({ requestId: "request-1" })
    expect(mocks.success).toHaveBeenCalledWith("Horaire actuel conservé")
    view.unmount()
    fake({ request: { status: "ready", data: confirmed({ viewerRole: "page", requester, reschedule: pending, rescheduleActions: ["decline_reschedule"] }) }, declineReschedule, proposeReschedule: vi.fn(), acceptReschedule: vi.fn() })
    render(tree(<ActivityRequestScreen requestId="request-1" />))
    expect(screen.getByText("Vous avez proposé un nouvel horaire")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Accepter le nouvel horaire" })).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retirer ma proposition" })) })
    expect(mocks.success).toHaveBeenCalledWith("Proposition retirée")
  })

  it("côté page : propose un autre horaire, même durée, lu dans le fuseau choisi ; le même horaire est refusé au champ", async () => {
    const proposeReschedule = vi.fn(() => done(null))
    fake({ request: { status: "ready", data: confirmed({ viewerRole: "page", requester, rescheduleActions: ["propose_reschedule"] }) }, proposeReschedule, acceptReschedule: vi.fn(), declineReschedule: vi.fn() })
    render(tree(<ActivityRequestScreen requestId="request-1" />))
    fireEvent.click(screen.getByRole("button", { name: "Proposer un autre horaire" }))
    const zone = screen.getByRole("region", { name: zoneName })
    expect(within(zone).getByText(/Même durée \(60 minutes\)/)).toBeTruthy()
    // Le formulaire part de l'horaire actuel, lu à Paris : le renvoyer tel quel est refusé sans aller-retour.
    expect((screen.getByLabelText("Nouvelle heure de début") as HTMLInputElement).value).toBe("13:00")
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Envoyer le nouvel horaire" })) })
    expect(screen.getByText(/C’est déjà l’horaire du rendez-vous/)).toBeTruthy()
    expect(proposeReschedule).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText("Nouvelle date"), { target: { value: "2026-10-20" } })
    fireEvent.change(screen.getByLabelText("Nouvelle heure de début"), { target: { value: "14:00" } })
    fireEvent.change(screen.getByLabelText("Fuseau du nouvel horaire"), { target: { value: "Europe/Paris" } })
    fireEvent.change(screen.getByLabelText("Réponse attendue avant le (date)"), { target: { value: "2026-10-18" } })
    fireEvent.change(screen.getByLabelText("Réponse attendue avant (heure)"), { target: { value: "20:00" } })
    expect(filledButtons(zone)).toEqual([within(zone).getByRole("button", { name: "Envoyer le nouvel horaire" })])
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Envoyer le nouvel horaire" })) })
    expect(proposeReschedule).toHaveBeenCalledWith({ requestId: "request-1", expectedProposalVersion: 1, startAt: NEW_START, timeZone: "Europe/Paris", expiresAt: Date.UTC(2026, 9, 18, 18) })
    expect(mocks.success).toHaveBeenCalledWith("Nouvel horaire proposé")
  })

  it("rien à déplacer sans fournisseur du geste, ni après le début du rendez-vous", () => {
    fake({ request: { status: "ready", data: confirmed({ rescheduleActions: ["propose_reschedule"] }) } })
    const view = render(tree(<MyServiceRequestScreen requestId="request-1" />))
    expect(screen.queryByRole("region", { name: zoneName })).toBeNull()
    view.unmount()
    vi.setSystemTime(NOW + DAY + HOUR)
    fake({ request: { status: "ready", data: confirmed({ rescheduleActions: ["propose_reschedule"] }) }, proposeReschedule: vi.fn(), acceptReschedule: vi.fn(), declineReschedule: vi.fn() })
    render(tree(<MyServiceRequestScreen requestId="request-1" />))
    expect(screen.queryByRole("button", { name: "Proposer un autre horaire" })).toBeNull()
  })

  it("la liste dit le nouvel horaire en attente de réponse", () => {
    fake({ pages: { null: page([{ ...SUMMARY, status: "confirmed", currentProposal: SUMMARY.currentProposal, booking, deadlineAt: null, reschedule: pending }]) } })
    render(tree(<MyServiceRequestsScreen />))
    expect(screen.getByText(/Nouvel horaire proposé, réponse attendue avant le/)).toBeTruthy()
  })
})

describe("DS-02 — « Faire une proposition » en famille commerce, un seul bouton plein par zone", () => {
  const requester = { displayName: "Awa OGOOUÉ", handle: "awa" }
  const actionsZone = getFixedT("fr")("serviceRequests.detail.actions")
  const booking = { startAt: NOW + HOUR, endAt: NOW + 2 * HOUR, timeZone: "Europe/Paris", status: "confirmed" as const }

  it("côté page : « Faire une proposition » en commerce, puis « Envoyer la proposition » en aplat des messages", () => {
    const sent = detail({ viewerRole: "page", status: "sent", requester, currentProposal: null, proposals: [], deadlineAt: NOW + DAY, actions: ["propose", "refuse"] })
    fake({ request: { status: "ready", data: sent } })
    render(tree(<ActivityRequestScreen requestId="request-1" />))
    const zone = screen.getByRole("region", { name: actionsZone })
    const propose = within(zone).getByRole("button", { name: "Faire une proposition" })
    expect(propose).toHaveClass("bg-commerce-fill")
    expect(filledButtons(zone)).toEqual([propose])

    fireEvent.click(propose)
    const submit = within(zone).getByRole("button", { name: "Envoyer la proposition" })
    expect(submit).toHaveClass("bg-message-fill")
    expect(filledButtons(zone)).toEqual([submit])
  })

  it("côté page : « Modifier la proposition » garde la famille commerce", () => {
    fake({ request: { status: "ready", data: detail({ viewerRole: "page", requester, actions: ["propose", "refuse"] }) } })
    render(tree(<ActivityRequestScreen requestId="request-1" />))
    const zone = screen.getByRole("region", { name: actionsZone })
    const update = within(zone).getByRole("button", { name: "Modifier la proposition" })
    expect(update).toHaveClass("bg-commerce-fill")
    expect(filledButtons(zone)).toEqual([update])
  })

  // Tous les rôles, tous les états, avant et après le début du rendez-vous : jamais deux gestes pleins côte à côte.
  const moments = [{ moment: "avant le rendez-vous", elapsed: 0 }, { moment: "après son début", elapsed: 2 * HOUR }] as const
  const cases = SERVICE_REQUEST_ACTORS.flatMap((viewerRole) => SERVICE_REQUEST_STATUSES.flatMap((status) => moments.map((moment) => ({ viewerRole, status, ...moment }))))
  it.each(cases)("$viewerRole · $status · $moment : au plus un bouton plein dans les gestes", ({ viewerRole, status, elapsed }) => {
    vi.setSystemTime(NOW + elapsed)
    const data = detail({ viewerRole, status, requester: viewerRole === "page" ? requester : null, booking: status === "confirmed" ? booking : null, actions: [] })
    fake({ request: { status: "ready", data } })
    render(tree(viewerRole === "page" ? <ActivityRequestScreen requestId="request-1" /> : <MyServiceRequestScreen requestId="request-1" />))
    const zone = screen.queryByRole("region", { name: actionsZone })
    expect(zone === null ? 0 : filledButtons(zone).length).toBeLessThanOrEqual(1)
  })
})

describe("boîte des demandes d'une page", () => {
  it("filtre par état et ouvre chaque demande côté page", () => {
    const inboxItem = { ...SUMMARY, requester: { displayName: "Awa OGOOUÉ", handle: "awa" } }
    const { pageRequests } = fake({ pages: { "null:null": page([inboxItem]), "sent:null": page([]) } })
    render(tree(<ServiceInbox pageId="page-1" pageHandle="salon-test" />))
    expect(screen.getByText("Awa OGOOUÉ")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Ouvrir" }).getAttribute("href")).toBe("/mon-activite/demandes/request-1")
    expect(screen.getByRole("link", { name: "Voir la page" }).getAttribute("href")).toBe("/pages/salon-test")
    fireEvent.change(screen.getByLabelText("Afficher"), { target: { value: "sent" } })
    expect(pageRequests).toHaveBeenLastCalledWith({ pageId: "page-1", status: "sent", cursor: null })
    expect(screen.getByText("Aucune demande dans cet état")).toBeTruthy()
  })

  it("dit l'indisponibilité quand le fournisseur ne sert pas les demandes", () => {
    render(tree(<ServiceInbox pageId="page-1" pageHandle="salon-test" />, "en"))
    expect(screen.getByText("Requests unavailable")).toBeTruthy()
  })
})

describe("CC-6 — la conversation de la demande", () => {
  it("une demande en cours mène à sa conversation ; une demande close sans fil ne propose pas d'écrire", () => {
    const useThreadFor = vi.fn((): Loadable<{ threadId: string; writable: boolean; unread: boolean } | null> => ({ status: "ready", data: { threadId: "fil-1", writable: true, unread: false } }))
    mocks.conversations = { useThreadFor, open: vi.fn() }
    fake({ request: { status: "ready", data: detail() } })
    const view = render(tree(<MyServiceRequestScreen requestId="request-1" />))
    expect(screen.getByRole("link", { name: "Ouvrir la conversation" }).getAttribute("href")).toBe("/messages/mise-en-relation/fil-1")
    expect(useThreadFor).toHaveBeenCalledWith({ kind: "diasporaServiceRequest", id: "request-1" })
    view.unmount()
    mocks.conversations = { useThreadFor: vi.fn((): Loadable<null> => ({ status: "ready", data: null })), open: vi.fn() }
    fake({ request: { status: "ready", data: detail({ status: "cancelled", currentProposal: null, actions: [] }) } })
    render(tree(<MyServiceRequestScreen requestId="request-1" />))
    expect(screen.queryByRole("button", { name: "Écrire" })).toBeNull()
    expect(screen.queryByRole("link", { name: /conversation/ })).toBeNull()
  })
})
