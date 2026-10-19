// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { ActionResult, AssociationActivityPage, AssociationEventCalendarCapability, AssociationEventCalendarFile, AssociationEventsCapability, AssociationEventView, Loadable, MembershipView, SessionView } from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { routes } from "@/lib/routes"

import { AssociationEventCalendar } from "./association-event-calendar"
import { AssociationEventDetail, AssociationEventsSection } from "./association-events"

const mocks = vi.hoisted(() => ({
  session: { status: "loading" } as Loadable<SessionView>,
  event: { status: "loading" } as Loadable<AssociationEventView | null>,
  events: null as AssociationEventsCapability | null,
  export: vi.fn<AssociationEventCalendarCapability["exportIcal"]>(),
  agenda: vi.fn<AssociationEventCalendarCapability["useAgenda"]>(),
  success: vi.fn(),
}))
vi.mock("@diasporale/features/data", async (original) => ({ ...await original<typeof import("@diasporale/features/data")>(), useSession: () => mocks.session, useAssociationEvents: () => mocks.events }))
vi.mock("sonner", () => ({ toast: { success: mocks.success } }))

const t = getFixedT("fr")
const NOW = Date.UTC(2026, 9, 18, 12)
const MEMBER: MembershipView = {
  personId: "person-awa", handle: "awa", displayName: "Awa OGOOUÉ", status: "declaree", badges: [],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY }, joinedAt: 1, verifiedSince: null, sponsoredBy: null,
  attestation: { outcome: "none", postSlug: null, requestedAt: null }, root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: true, rateTier: "standard", directoryVisibility: "hidden",
}
const EVENT: AssociationEventView = {
  eventId: "event-1", pageId: "page-1", title: "Rencontre culturelle", description: "La rencontre de recette.", location: "Salle associative", startAt: NOW + 86_400_000, endAt: NOW + 90_000_000,
  timeZone: "Europe/Paris", audience: "association", status: "scheduled", version: 3, organizer: { name: "Association de recette", handle: "association-recette" }, moderation: "published",
  isRegistered: false, canManage: false, canRegister: true, capacity: null, confirmedCount: 4, waitlistCount: 0, remainingPlaces: null, registration: "none", waitlistPosition: null,
  registrationClosesAt: null, registrationOpen: true, reminderEnabled: false, reminderAt: null, reminderState: "off",
}
const FILE: AssociationEventCalendarFile = { filename: "diasporale-event.ics", content: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n", mediaType: "text/calendar;charset=utf-8" }
const CAPABILITY: AssociationEventCalendarCapability = { mode: "engine", useAgenda: mocks.agenda, exportIcal: mocks.export }
const PAGE: Loadable<AssociationActivityPage<AssociationEventView>> = { status: "ready", data: { items: [EVENT], continueCursor: null, isDone: true } }
const LEGACY_EVENTS: AssociationEventsCapability = {
  useEvents: () => PAGE, useEvent: () => mocks.event, create: async () => ({ ok: true, value: { eventId: EVENT.eventId, created: true } }), update: async () => ({ ok: true, value: null }), cancel: async () => ({ ok: true, value: null }), register: async () => ({ ok: true, value: null }), unregister: async () => ({ ok: true, value: null }), setReminder: async () => ({ ok: true, value: null }),
}
function signedIn(member = MEMBER): Loadable<SessionView> { return { status: "ready", data: { status: "signed_in", account: { id: member.personId, idn: null, local: null, nameHints: {} }, membership: member } } }
function tree(event = EVENT, capability: AssociationEventCalendarCapability | null = CAPABILITY) { return <I18nProvider locale="fr"><AssociationEventCalendar event={event} capability={capability} /></I18nProvider> }
function deferred<T>() {
  let finish: (value: T) => void = () => {}
  const promise = new Promise<T>((resolve) => { finish = resolve })
  return { promise, finish }
}
const created = vi.fn<(blob: Blob) => string>()
const revoked = vi.fn<(url: string) => void>()
let clicked: { readonly href: string; readonly download: string }[] = []

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })
  vi.setSystemTime(NOW)
  vi.clearAllMocks()
  mocks.session = signedIn()
  mocks.event = { status: "ready", data: EVENT }
  mocks.events = { ...LEGACY_EVENTS, calendar: CAPABILITY }
  mocks.export.mockReset().mockResolvedValue({ ok: true, value: FILE })
  created.mockReset().mockReturnValue("blob:calendar-local")
  revoked.mockReset()
  clicked = []
  vi.stubGlobal("URL", class extends URL { static override createObjectURL = created; static override revokeObjectURL = revoked })
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { clicked.push({ href: this.href, download: this.download }) })
})
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe("DG-023 — téléchargement iCal volontaire et contexte de lecture", () => {
  it("reste facultatif et se monte au détail, avant même la fin de l'événement", () => {
    const view = render(<I18nProvider locale="fr"><AssociationEventsSection pageId={EVENT.pageId} handle={EVENT.organizer.handle} canManage={false} /></I18nProvider>)
    expect(screen.queryByRole("button", { name: t("eventCalendar.download") })).not.toBeInTheDocument()
    view.rerender(<I18nProvider locale="fr"><AssociationEventDetail pageId={EVENT.pageId} handle={EVENT.organizer.handle} eventId={EVENT.eventId} /></I18nProvider>)
    expect(screen.getByRole("button", { name: t("eventCalendar.download") })).toBeEnabled()
    expect(screen.getByRole("link", { name: t("eventCalendar.agendaTitle") })).toHaveAttribute("href", routes.agenda())
    expect(mocks.export).not.toHaveBeenCalled()
    mocks.events = LEGACY_EVENTS
    view.rerender(<I18nProvider locale="fr"><AssociationEventDetail pageId={EVENT.pageId} handle={EVENT.organizer.handle} eventId={EVENT.eventId} /></I18nProvider>)
    expect(screen.queryByRole("button", { name: t("eventCalendar.download") })).not.toBeInTheDocument()
  })

  it("permet la lecture en attente sans inscription, prépare un Blob au clic et révoque son URL", async () => {
    mocks.session = signedIn({ ...MEMBER, status: "en_attente", canPublish: false })
    const pending = deferred<ActionResult<AssociationEventCalendarFile>>()
    mocks.export.mockReturnValueOnce(pending.promise)
    render(tree())
    expect(screen.getByText(t("eventCalendar.exportHint"))).toBeVisible()
    const button = screen.getByRole("button", { name: t("eventCalendar.download") })
    await act(async () => { fireEvent.click(button); fireEvent.click(button) })
    expect(mocks.export).toHaveBeenCalledExactlyOnceWith(EVENT.eventId)
    expect(created).not.toHaveBeenCalled()
    await act(async () => { pending.finish({ ok: true, value: FILE }); await pending.promise })
    expect(clicked).toEqual([{ href: "blob:calendar-local", download: "diasporale-event.ics" }])
    expect(created.mock.calls[0]?.[0].type).toBe("text/calendar;charset=utf-8")
    expect(document.querySelector("a[download]")).not.toBeInTheDocument()
    expect(screen.queryByText(FILE.content)).not.toBeInTheDocument()
    expect(mocks.agenda).not.toHaveBeenCalled()
    expect(revoked).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(1_000) })
    expect(revoked).toHaveBeenCalledExactlyOnceWith("blob:calendar-local")
  })

  it("explique les fichiers provisoires ou annulés et ne fabrique aucun téléchargement après refus", async () => {
    mocks.export.mockResolvedValueOnce({ ok: false, code: "association_event_access_required" })
    const view = render(tree({ ...EVENT, registration: "waitlisted" }))
    expect(screen.getByText(t("eventCalendar.waitlistExport"))).toBeVisible()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("eventCalendar.download") })) })
    expect(screen.getByRole("alert")).toHaveTextContent(t("errors.association_event_access_required"))
    expect(created).not.toHaveBeenCalled()
    view.rerender(tree({ ...EVENT, status: "cancelled", registration: "waitlisted", version: 4 }))
    expect(screen.getByText(t("eventCalendar.cancelledExport"))).toBeVisible()
    expect(screen.queryByText(t("eventCalendar.waitlistExport"))).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: t("eventCalendar.download") })).toBeEnabled()
  })

  it("refuse un nom de fichier arbitraire et libère aussi les URL au démontage", async () => {
    mocks.export.mockResolvedValueOnce({ ok: true, value: { ...FILE, filename: "../autre.ics" } })
    const view = render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("eventCalendar.download") })) })
    expect(screen.getByRole("alert")).toHaveTextContent(t("eventCalendar.downloadFailed"))
    expect(created).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("eventCalendar.download") })) })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    view.unmount()
    expect(revoked).toHaveBeenCalledWith("blob:calendar-local")
    await act(async () => { vi.advanceTimersByTime(1_000) })
    expect(revoked).toHaveBeenCalledOnce()
  })

  it.each(["version", "audience", "event", "reader", "suspended", "unmount"] as const)("ignore une réponse tardive après changement de %s", async (change) => {
    const pending = deferred<ActionResult<AssociationEventCalendarFile>>()
    mocks.export.mockReturnValueOnce(pending.promise)
    const view = render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("eventCalendar.download") })) })
    if (change === "unmount") view.unmount()
    else if (change === "reader" || change === "suspended") {
      mocks.session = signedIn(change === "reader" ? { ...MEMBER, personId: "person-autre", displayName: "Jean MBA" } : { ...MEMBER, status: "suspendue", canPublish: false })
      view.rerender(tree())
    } else view.rerender(tree(change === "version" ? { ...EVENT, version: 4 } : change === "audience" ? { ...EVENT, audience: "network" } : { ...EVENT, eventId: "event-2" }))
    await act(async () => { pending.finish({ ok: true, value: FILE }); await pending.promise })
    expect(created).not.toHaveBeenCalled()
    expect(clicked).toEqual([])
    expect(mocks.success).not.toHaveBeenCalled()
  })
})
