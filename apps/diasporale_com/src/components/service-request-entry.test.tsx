// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY, zonedWallTimeToUtc } from "@diasporale/domain"
import type { Loadable, MembershipView, ServiceRequestsCapability, SessionView } from "@diasporale/features/data"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ServiceRequestEntry } from "./service-request-entry"
import { browserTimeZone } from "./service-request-ui"

const mocks = vi.hoisted(() => ({
  capability: null as unknown,
  session: null as unknown,
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock("@diasporale/features/data", async (original) => ({
  ...await original<typeof import("@diasporale/features/data")>(),
  useServiceRequests: () => mocks.capability,
  useSession: () => mocks.session,
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

const NOW = Date.UTC(2026, 9, 18, 10)
const MEMBER: MembershipView = {
  personId: "person-awa", handle: "awa", displayName: "Awa OGOOUÉ", status: "declaree", badges: ["verified"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: null, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: true, rateTier: "standard", directoryVisibility: "hidden",
}

function signedIn(membership: MembershipView | null): Loadable<SessionView> {
  return { status: "ready", data: { status: "signed_in", account: {} as never, membership } }
}

function capability(send: ServiceRequestsCapability["send"]): ServiceRequestsCapability {
  const unused = () => { throw new Error("geste inattendu") }
  return {
    useMyRequests: unused, usePageRequests: unused, useRequest: unused, send,
    propose: unused, refuse: unused, cancel: unused, accept: unused, complete: unused, markNoShow: unused,
  }
}

function tree(locale: "fr" | "en" = "fr") {
  return (
    <I18nProvider locale={locale}>
      <ServiceRequestEntry offerId="offer-1" offerVersion={3} offerTitle="Tresses africaines" pageName="Salon de test" />
    </I18nProvider>
  )
}

function fillValid() {
  fireEvent.change(screen.getByLabelText("Votre besoin"), { target: { value: "Tresses africaines pour un mariage." } })
  fireEvent.change(screen.getAllByLabelText("Date")[0]!, { target: { value: "2026-10-20" } })
  fireEvent.change(screen.getAllByLabelText("De")[0]!, { target: { value: "10:00" } })
  fireEvent.change(screen.getAllByLabelText("À")[0]!, { target: { value: "12:00" } })
  fireEvent.click(screen.getByRole("checkbox"))
}

async function submit() {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Envoyer la demande" })) })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  vi.clearAllMocks()
  mocks.session = signedIn(MEMBER)
  mocks.capability = capability(vi.fn())
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("« Demander ce service »", () => {
  it("dit l'indisponibilité quand le fournisseur ne sert pas les demandes", () => {
    mocks.capability = null
    render(tree())
    expect((screen.getByRole("button", { name: "Demander ce service" }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText("Les demandes de service ne sont pas disponibles pour le moment.")).toBeTruthy()
  })

  it("invite à se connecter, et explique pourquoi un membre en attente ne peut pas encore demander", () => {
    mocks.session = { status: "ready", data: { status: "anonymous" } }
    const view = render(tree())
    expect(screen.getByRole("link", { name: "Se connecter pour demander ce service" }).getAttribute("href")).toBe("/entrer")
    view.unmount()
    mocks.session = signedIn({ ...MEMBER, status: "en_attente", canPublish: false })
    render(tree())
    expect((screen.getByRole("button", { name: "Demander ce service" }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText("Votre adhésion doit être déclarée pour envoyer une demande.")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Suivre mes demandes" }).getAttribute("href")).toBe("/mes-demandes")
  })

  it("envoie une demande valide en instants UTC du fuseau du navigateur, avec une clé stable pour le renvoi", async () => {
    const send = vi.fn<ServiceRequestsCapability["send"]>()
      .mockResolvedValueOnce({ ok: false, code: "rate_limited" })
      .mockResolvedValueOnce({ ok: true, value: { requestId: "request-9", created: true } })
    mocks.capability = capability(send)
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: "Demander ce service" }))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByText("Demander « Tresses africaines »")).toBeTruthy()
    expect(within(dialog).getByText(/Aucun paiement ne passe par DIASPORALE et aucune adresse exacte/)).toBeTruthy()
    fillValid()
    await submit()
    expect(screen.getByText(/Trop de demandes d'affilée/)).toBeTruthy()
    await submit()
    const zone = browserTimeZone()
    const startAt = zonedWallTimeToUtc({ date: "2026-10-20", time: "10:00" }, zone)
    const endAt = zonedWallTimeToUtc({ date: "2026-10-20", time: "12:00" }, zone)
    if (!startAt.ok || !endAt.ok) throw new Error("conversion de fixture refusée")
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0]![0]).toEqual({
      offerId: "offer-1", offerVersion: 3, need: "Tresses africaines pour un mariage.", windows: [{ startAt: startAt.value, endAt: endAt.value }],
      timeZone: zone, shareIdentityWithPage: true, idempotencyKey: expect.any(String),
    })
    expect(send.mock.calls[1]![0].idempotencyKey).toBe(send.mock.calls[0]![0].idempotencyKey)
    expect(await screen.findByRole("status")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Voir ma demande" }).getAttribute("href")).toBe("/mes-demandes/request-9")
    expect(mocks.success).toHaveBeenCalledWith("Demande envoyée")
  })

  it("refuse une feuille invalide sans rien envoyer : besoin trop court, consentement absent, fin avant le début", async () => {
    const send = vi.fn<ServiceRequestsCapability["send"]>()
    mocks.capability = capability(send)
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: "Demander ce service" }))
    fireEvent.change(screen.getByLabelText("Votre besoin"), { target: { value: "Coiffure" } })
    await submit()
    expect(screen.getByText("Décrivez votre besoin en 10 caractères au moins.")).toBeTruthy()
    expect(screen.getByText("Cochez la case pour que l’équipe de la page puisse voir votre nom.")).toBeTruthy()
    fillValid()
    fireEvent.change(screen.getAllByLabelText("À")[0]!, { target: { value: "09:00" } })
    await submit()
    expect(screen.getByText(/l’heure de fin suit l’heure de début/)).toBeTruthy()
    fireEvent.change(screen.getAllByLabelText("À")[0]!, { target: { value: "12:00" } })
    fireEvent.change(screen.getByLabelText("Votre besoin"), { target: { value: "Tresses, appelez le 06 12 34 56 78" } })
    await submit()
    expect(screen.getByText(/Retirez le numéro de téléphone/)).toBeTruthy()
    expect(send).not.toHaveBeenCalled()
  })

  it("une clé en conflit repart neuve ; une demande déjà ouverte mène à « Mes demandes »", async () => {
    const send = vi.fn<ServiceRequestsCapability["send"]>()
      .mockResolvedValueOnce({ ok: false, code: "request_idempotency_conflict" })
      .mockResolvedValueOnce({ ok: false, code: "request_already_open" })
    mocks.capability = capability(send)
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: "Demander ce service" }))
    fillValid()
    await submit()
    expect(screen.getByText(/Une autre demande a déjà été envoyée depuis cette feuille/)).toBeTruthy()
    await submit()
    expect(send.mock.calls[1]![0].idempotencyKey).not.toBe(send.mock.calls[0]![0].idempotencyKey)
    const alert = screen.getByText("Vous avez déjà une demande en cours pour cette offre.").closest("[role=alert]") as HTMLElement
    expect(within(alert).getByRole("link", { name: "Suivre mes demandes" }).getAttribute("href")).toBe("/mes-demandes")
  })

  it("propose une à trois disponibilités, chacune retirable", async () => {
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: "Demander ce service" }))
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une disponibilité" }))
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une disponibilité" }))
    expect(screen.getAllByLabelText("Date")).toHaveLength(3)
    expect(screen.queryByRole("button", { name: "Ajouter une disponibilité" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Retirer la disponibilité 2" }))
    await waitFor(() => expect(screen.getAllByLabelText("Date")).toHaveLength(2))
  })

  it("parle anglais avec les mêmes gestes", () => {
    render(tree("en"))
    fireEvent.click(screen.getByRole("button", { name: "Request this service" }))
    expect(screen.getByText("Request “Tresses africaines”")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Send request" })).toBeTruthy()
  })
})
