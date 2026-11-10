// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import { DataSourceProvider, type AidMissionCardView, type AssociationAgendaEventView, type AssociationAgendaView, type AssociationEventCalendarCapability, type AssociationEventsCapability, type DiasporaleDataSource, type Loadable, type MembershipView, type MutualAidCapability } from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useState, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CommunityShortcuts } from "@/components/community-shortcuts"
import type { IcomNetwork, IcomState } from "@/components/icom"
import { engineRoutes } from "@/lib/engine-routes"
import { routes } from "@/lib/routes"

import { AgendaScreen } from "./agenda-screen"
import { CommunitiesScreen } from "./communities-screen"

const mocks = vi.hoisted(() => ({
  member: null as MembershipView | null,
  network: null as IcomNetwork | null,
  icom: { status: "off", reason: "demo" } as IcomState,
  events: null as AssociationEventsCapability | null,
  agenda: { status: "loading" } as Loadable<AssociationAgendaView>,
  read: vi.fn<AssociationEventCalendarCapability["useAgenda"]>(),
  readPage: vi.fn<NonNullable<AssociationEventCalendarCapability["useAgendaPage"]>>(),
  export: vi.fn<AssociationEventCalendarCapability["exportIcal"]>(),
  gate: vi.fn(), island: vi.fn(), panel: vi.fn(),
}))
vi.mock("@diasporale/features/data", async (original) => ({ ...await original<typeof import("@diasporale/features/data")>(), useAssociationEvents: () => mocks.events }))
vi.mock("@/components/gate", () => ({
  Gate: (props: { require: "member"; children: (session: { membership: MembershipView | null }) => ReactNode }) => { mocks.gate(props.require); return <>{props.children({ membership: mocks.member })}</> },
  GateSkeleton: () => <div role="status" aria-label="Chargement de l’agenda moteur" />,
}))
vi.mock("@/components/app-shell", () => ({ AppShell: (props: { children: ReactNode }) => <main>{props.children}</main> }))
vi.mock("@/components/icom", () => ({
  useEngineNetwork: () => mocks.network, useIcomState: () => mocks.icom,
  IcomIsland: (props: { network: IcomNetwork; children: ReactNode }) => { mocks.island(props.network); return <>{props.children}</> },
}))
vi.mock("@antsia/social-features/reseau-personnel", async () => ({
  ...await import("@antsia/social-features/features/reseau-personnel/cursor-pages"),
  EvenementsPanel: (props: { now: number; canWrite?: boolean }) => { const [marker, setMarker] = useState(""); mocks.panel(props); return <section aria-label="Agenda réutilisé du moteur"><input aria-label="Repère du panneau moteur" value={marker} onChange={(event) => setMarker(event.target.value)} /></section> },
}))
vi.mock("./hub-screen", () => ({ HubScreen: (props: { iso: string }) => <section aria-label={`Hub ${props.iso}`} /> }))

const t = getFixedT("fr")
const NOW = Date.UTC(2026, 9, 18, 12)
const MEMBER: MembershipView = {
  personId: "person-awa", handle: "awa", displayName: "Awa OGOOUÉ", status: "declaree", badges: [],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY }, joinedAt: 1, verifiedSince: null, sponsoredBy: null,
  attestation: { outcome: "none", postSlug: null, requestedAt: null }, root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: true, rateTier: "standard", directoryVisibility: "hidden",
}
const NETWORK: IcomNetwork = { networkId: "network-diasporale" as IcomNetwork["networkId"], slug: "diasporale", personId: MEMBER.personId as IcomNetwork["personId"] }
const ASSOCIATION: AssociationAgendaEventView = { kind: "association", eventId: "event-1", pageId: "page-1", title: "Rencontre confirmée", description: "Rencontre de recette.", location: "Salle associative", startAt: NOW + 86_400_000, endAt: NOW + 90_000_000, timeZone: "Europe/Paris", status: "scheduled", cancelledAt: null, version: 1, organizer: { name: "Association de recette", handle: "association-recette" }, registration: "confirmed" }
const CALENDAR: AssociationEventCalendarCapability = { mode: "demonstration", useAgenda: mocks.read, exportIcal: mocks.export }
const LEGACY: AssociationEventsCapability = { useEvents: () => ({ status: "loading" }), useEvent: () => ({ status: "loading" }), create: async () => ({ ok: true, value: { eventId: "event-created", created: true } }), update: async () => ({ ok: true, value: null }), cancel: async () => ({ ok: true, value: null }), register: async () => ({ ok: true, value: null }), unregister: async () => ({ ok: true, value: null }), setReminder: async () => ({ ok: true, value: null }) }
function tree() { return <I18nProvider locale="fr"><AgendaScreen /></I18nProvider> }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] })
  vi.setSystemTime(NOW)
  vi.clearAllMocks()
  mocks.member = MEMBER
  mocks.network = null
  mocks.icom = { status: "off", reason: "demo" }
  mocks.events = { ...LEGACY, calendar: CALENDAR }
  mocks.agenda = { status: "ready", data: { items: [ASSOCIATION], truncated: false } }
  mocks.read.mockReset().mockImplementation(() => mocks.agenda)
  mocks.readPage.mockReset()
})
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers() })

describe("/agenda — panneau moteur existant et démonstration honnête", () => {
  it("réutilise le panneau moteur dans son îlot réseau, avec lecture en attente et sans écritures", () => {
    mocks.member = { ...MEMBER, status: "en_attente", canPublish: false }
    mocks.events = { ...LEGACY, calendar: { ...CALENDAR, mode: "engine" } }
    mocks.network = NETWORK
    mocks.icom = { status: "off", reason: "not_allowed" }
    render(tree())
    expect(mocks.gate).toHaveBeenCalledWith("member")
    expect(mocks.island).toHaveBeenCalledWith(NETWORK)
    expect(mocks.panel).toHaveBeenCalledWith({ now: NOW, canWrite: false })
    expect(screen.getByRole("region", { name: "Agenda réutilisé du moteur" })).toBeVisible()
    expect(mocks.read).not.toHaveBeenCalled()
    expect(mocks.export).not.toHaveBeenCalled()
  })

  it("ne réutilise jamais le réseau du lecteur précédent et remonte le panneau à la nouvelle identité", () => {
    mocks.events = LEGACY
    mocks.network = NETWORK
    const view = render(tree())
    fireEvent.change(screen.getByLabelText("Repère du panneau moteur"), { target: { value: "État du premier lecteur" } })
    mocks.member = { ...MEMBER, personId: "person-autre", displayName: "Jean MBA" }
    view.rerender(tree())
    expect(screen.queryByLabelText("Repère du panneau moteur")).not.toBeInTheDocument()
    mocks.network = { ...NETWORK, personId: "person-autre" as IcomNetwork["personId"] }
    view.rerender(tree())
    expect(screen.getByLabelText("Repère du panneau moteur")).toHaveValue("")
    expect(engineRoutes.agenda?.()).toBe(routes.agenda())
    expect(engineRoutes.associationEvent?.("association-recette", "event-1")).toBe(routes.associationEvent("association-recette", "event-1"))
  })

  it("affiche seulement les inscriptions associatives fictives et distingue attente, confirmation, annulation et lacune", async () => {
    mocks.agenda = { status: "ready", data: { items: [ASSOCIATION, { ...ASSOCIATION, eventId: "event-wait", title: "Rencontre en attente", registration: "waitlisted" }, { ...ASSOCIATION, eventId: "event-cancel", title: "Rencontre annulée", status: "cancelled", cancelledAt: NOW }], truncated: true } }
    render(tree())
    expect(screen.getByText(t("eventCalendar.demoAgenda"))).toBeVisible()
    expect(screen.getByText(t("eventCalendar.waitlisted"), { normalizer: (text) => text })).toBeVisible()
    expect(screen.getByText(t("eventCalendar.confirmed"))).toBeVisible()
    expect(screen.getByText(t("eventCalendar.cancelled"))).toBeVisible()
    expect(screen.getByText(t("eventCalendar.truncated"))).toBeVisible()
    expect(screen.getByRole("link", { name: "Rencontre en attente" })).toHaveAttribute("href", routes.associationEvent(ASSOCIATION.organizer.handle, "event-wait"))
    expect(mocks.read).toHaveBeenLastCalledWith({ now: NOW })
    await act(async () => { vi.advanceTimersByTime(60_000) })
    expect(mocks.read).toHaveBeenLastCalledWith({ now: NOW + 60_000 })
    expect(mocks.panel).not.toHaveBeenCalled()
    expect(mocks.export).not.toHaveBeenCalled()
  })

  it("un refus ou une suspension ferme immédiatement les anciennes lignes de démonstration", () => {
    const view = render(tree())
    expect(screen.getByRole("link", { name: ASSOCIATION.title })).toBeVisible()
    mocks.agenda = { status: "error", code: "association_event_access_required" }
    view.rerender(tree())
    expect(screen.getByRole("alert")).toHaveTextContent(t("errors.association_event_access_required"))
    expect(screen.queryByRole("link", { name: ASSOCIATION.title })).not.toBeInTheDocument()
    mocks.agenda = { status: "ready", data: { items: [ASSOCIATION], truncated: false } }
    mocks.member = { ...MEMBER, status: "suspendue", canPublish: false }
    view.rerender(tree())
    expect(screen.queryByRole("link", { name: ASSOCIATION.title })).not.toBeInTheDocument()
  })

  it("distingue chargement, vide et absence de capacité sans inventer d'événement personnel", () => {
    mocks.agenda = { status: "loading" }
    const view = render(tree())
    expect(screen.queryByText(t("eventCalendar.empty"))).not.toBeInTheDocument()
    mocks.agenda = { status: "ready", data: { items: [], truncated: false } }
    view.rerender(tree())
    expect(screen.getByText(t("eventCalendar.empty"))).toBeVisible()
    mocks.events = LEGACY
    view.rerender(tree())
    expect(screen.getByText(t("errors.feature_unavailable"))).toBeVisible()
    expect(screen.queryByText(t("eventCalendar.empty"))).not.toBeInTheDocument()
    expect(mocks.panel).not.toHaveBeenCalled()
  })

  it("garde le point d'entrée Mon agenda dans les rubriques du hub, sans pays, et le hub de Communautés inchangé", () => {
    render(<I18nProvider locale="fr"><CommunitiesScreen /></I18nProvider>)
    expect(screen.getByRole("region", { name: "Hub FR" })).toBeVisible()
    cleanup()
    // Le hub pose ces rubriques sur tout pays (HB-04) : l'agenda, personnel, ne suit pas le pays consulté.
    render(<I18nProvider locale="fr"><CommunityShortcuts country="CA" /></I18nProvider>)
    expect(screen.getByRole("link", { name: t("eventCalendar.agendaTitle") })).toHaveAttribute("href", routes.agenda())
  })

  it("continue une page vide, conserve les curseurs malgré le tic de l'horloge et dédoublonne les événements", async () => {
    const first = { status: "ready", data: { items: [], continueCursor: "agenda-next", isDone: false } } as const
    const second = { status: "ready", data: { items: [ASSOCIATION, ASSOCIATION], continueCursor: null, isDone: true } } as const
    const history = { status: "ready", data: { items: [], continueCursor: null, isDone: true } } as const
    mocks.readPage.mockImplementation((input) => input.period === "history" ? history : input.cursor === null ? first : second)
    mocks.events = { ...LEGACY, calendar: { ...CALENDAR, useAgendaPage: mocks.readPage } }
    render(tree())
    const upcoming = screen.getByRole("region", { name: t("eventCalendar.upcoming") })
    expect(within(upcoming).queryByText(t("eventCalendar.emptyUpcoming"))).not.toBeInTheDocument()
    expect(screen.getByText(t("eventCalendar.emptyHistory"))).toBeVisible()
    expect(mocks.read).not.toHaveBeenCalled()
    fireEvent.click(within(upcoming).getByRole("button", { name: t("services.results.loadMore") }))
    expect(within(upcoming).getAllByRole("link", { name: ASSOCIATION.title })).toHaveLength(1)
    expect(within(upcoming).queryByRole("button", { name: t("services.results.loadMore") })).not.toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(60_000) })
    expect(mocks.readPage.mock.calls.every(([input]) => input.anchor === NOW)).toBe(true)
    expect(mocks.readPage).toHaveBeenCalledWith({ anchor: NOW, period: "upcoming", readerPersonId: MEMBER.personId, cursor: "agenda-next" })
    expect(within(upcoming).getByRole("link", { name: ASSOCIATION.title })).toBeVisible()
  })

  it("retire les anciennes pages sur refus, attend une reprise explicite et remonte à un changement de lecteur", () => {
    const first = { status: "ready", data: { items: [ASSOCIATION], continueCursor: "old-reader-next", isDone: false } } as const
    const empty = { status: "ready", data: { items: [], continueCursor: null, isDone: true } } as const
    const denied = { status: "error", code: "not_found" } as const
    let refused = false
    mocks.readPage.mockImplementation((input) => refused ? denied : input.readerPersonId !== MEMBER.personId || input.period === "history" ? empty : first)
    mocks.events = { ...LEGACY, calendar: { ...CALENDAR, useAgendaPage: mocks.readPage } }
    const view = render(tree())
    expect(screen.getByRole("link", { name: ASSOCIATION.title })).toBeVisible()
    refused = true
    view.rerender(tree())
    expect(screen.queryByRole("link", { name: ASSOCIATION.title })).not.toBeInTheDocument()
    expect(screen.getAllByRole("alert")).toHaveLength(2)
    refused = false
    view.rerender(tree())
    expect(screen.queryByRole("link", { name: ASSOCIATION.title })).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole("button", { name: t("services.results.retry") })[0]!)
    expect(screen.getByRole("link", { name: ASSOCIATION.title })).toBeVisible()
    mocks.member = { ...MEMBER, personId: "person-suivante" }
    mocks.readPage.mockClear()
    view.rerender(tree())
    expect(screen.queryByRole("link", { name: ASSOCIATION.title })).not.toBeInTheDocument()
    expect(mocks.readPage.mock.calls.every(([input]) => input.readerPersonId === "person-suivante" && input.cursor === null)).toBe(true)
  })
})

describe("agenda — ET-09 : mes inscriptions bénévoles", () => {
  const mission = (id: string, startsAt: number, status: AidMissionCardView["status"] = "open"): AidMissionCardView => ({
    id, page: { id: "page-1", handle: "association-recette", name: "Association de recette", badge: "community" }, title: `Mission ${id}`, description: "Mission fictive.",
    country: "FR", city: "Lyon", area: null, startsAt, endsAt: null, timeZone: "Europe/Paris", places: 3, signupCount: 1, status, signedUp: true,
  })

  it("les missions à venir où je suis inscrit, des plus proches aux plus lointaines ; une passée n'y est plus ; une annulée le dit", () => {
    const signups = { status: "ready" as const, data: { items: [mission("loin", NOW + 9 * 86_400_000), mission("passee", NOW - 86_400_000), mission("proche", NOW + 86_400_000, "cancelled")], continueCursor: null, isDone: true } }
    const source = { kind: "demo", mutualAid: { useMySignups: () => signups } as unknown as MutualAidCapability } as unknown as DiasporaleDataSource
    render(<DataSourceProvider source={source}>{tree()}</DataSourceProvider>)
    const section = screen.getByRole("region", { name: "Mes missions bénévoles" })
    expect(within(section).getAllByRole("link").map((link) => link.textContent)).toEqual(["Mission proche", "Mission loin", t("aidOnTheWay.agenda.all")])
    expect(within(section).getByText(t("mutualAid.missionStatus.cancelled"))).toBeInTheDocument()
    expect(within(section).getByRole("link", { name: t("aidOnTheWay.agenda.all") })).toHaveAttribute("href", routes.mutualAid(undefined, undefined, { tab: "missions", view: "mine" }))
  })

  it("sans inscription à venir : aucune section", () => {
    const empty = { status: "ready" as const, data: { items: [], continueCursor: null, isDone: true } }
    const source = { kind: "demo", mutualAid: { useMySignups: () => empty } as unknown as MutualAidCapability } as unknown as DiasporaleDataSource
    render(<DataSourceProvider source={source}>{tree()}</DataSourceProvider>)
    expect(screen.queryByRole("region", { name: "Mes missions bénévoles" })).not.toBeInTheDocument()
  })
})
