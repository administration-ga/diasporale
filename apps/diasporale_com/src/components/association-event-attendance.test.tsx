// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { ActionResult, AssociationActivityPage, AssociationEventAttendanceCapability, AssociationEventAttendancePreview, AssociationEventAttendanceRow, AssociationEventAttendanceTicket, AssociationEventAttendanceView, AssociationEventsCapability, AssociationEventView, Loadable, MembershipView, SessionView } from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AssociationEventAttendance } from "./association-event-attendance"
import { AssociationEventDetail, AssociationEventsSection } from "./association-events"
import { formatServiceInstant } from "./service-request-ui"

const mocks = vi.hoisted(() => ({
  session: { status: "loading" } as Loadable<SessionView>,
  attendance: { status: "loading" } as Loadable<AssociationEventAttendanceView | null>,
  present: { status: "loading" } as Loadable<AssociationActivityPage<AssociationEventAttendanceRow>>,
  event: { status: "loading" } as Loadable<AssociationEventView | null>,
  events: null as AssociationEventsCapability | null,
  read: vi.fn<AssociationEventAttendanceCapability["useAttendance"]>(),
  readPresent: vi.fn<AssociationEventAttendanceCapability["usePresent"]>(),
  issue: vi.fn<AssociationEventAttendanceCapability["issueTicket"]>(),
  preview: vi.fn<AssociationEventAttendanceCapability["previewTicket"]>(),
  checkIn: vi.fn<AssociationEventAttendanceCapability["checkIn"]>(),
  clear: vi.fn<AssociationEventAttendanceCapability["clear"]>(),
  success: vi.fn(),
}))
vi.mock("@diasporale/features/data", async (original) => ({
  ...await original<typeof import("@diasporale/features/data")>(),
  useSession: () => mocks.session,
  useAssociationEvents: () => mocks.events,
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success } }))

const t = getFixedT("fr")
const NOW = Date.UTC(2026, 9, 26, 16, 30)
const CODE = `diasporale-attendance:v1:${"a".repeat(64)}`
const NEXT_CODE = `diasporale-attendance:v1:${"b".repeat(64)}`
const MEMBER: MembershipView = {
  personId: "person-awa", handle: "awa", displayName: "Awa OGOOUÉ", status: "declaree", badges: [],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: null, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: true, rateTier: "standard", directoryVisibility: "hidden",
}
const EVENT: AssociationEventView = {
  eventId: "event-1", pageId: "page-1", title: "Rencontre culturelle", description: "Accueil de la rencontre.", location: "Salle associative",
  startAt: NOW + 1_800_000, endAt: NOW + 9_000_000, timeZone: "Europe/Paris", audience: "association", status: "scheduled", version: 3,
  organizer: { name: "Association de recette", handle: "association-recette" }, moderation: "published", isRegistered: true, canManage: true, canRegister: false,
  capacity: 20, confirmedCount: 8, waitlistCount: 0, remainingPlaces: 12, registration: "confirmed", waitlistPosition: null,
  registrationClosesAt: null, registrationOpen: true, reminderEnabled: false, reminderAt: null, reminderState: "off",
}
const VIEW: AssociationEventAttendanceView = { eventId: EVENT.eventId, opensAt: EVENT.startAt - 3_600_000, closesAt: EVENT.endAt, isOpen: true, canIssueTicket: true, canManage: false, checkedInAt: null, version: 1, recordedCount: null }
const ROW: AssociationEventAttendanceRow = { registrationId: "registration-1", displayName: "Éloïse NDONG MBA", checkedInAt: NOW - 60_000, version: 4 }
const PREVIEW: AssociationEventAttendancePreview = { registrationId: ROW.registrationId, displayName: ROW.displayName, checkedInAt: null, version: 4, expiresAt: NOW + 60_000 }
const CAPABILITY: AssociationEventAttendanceCapability = { mode: "engine", useAttendance: mocks.read, usePresent: mocks.readPresent, issueTicket: mocks.issue, previewTicket: mocks.preview, checkIn: mocks.checkIn, clear: mocks.clear }

function signedIn(member: MembershipView = MEMBER): Loadable<SessionView> {
  return { status: "ready", data: { status: "signed_in", account: { id: "account-1", idn: null, local: null, nameHints: {} }, membership: member } }
}
function tree(event: AssociationEventView = EVENT, capability: AssociationEventAttendanceCapability = CAPABILITY) {
  return <I18nProvider locale="fr"><AssociationEventAttendance event={event} capability={capability} /></I18nProvider>
}
function manager() { mocks.attendance = { status: "ready", data: { ...VIEW, canManage: true, canIssueTicket: false, recordedCount: 1 } } }
function deferred<T>() {
  let finish: (value: T) => void = () => {}
  const promise = new Promise<T>((resolve) => { finish = resolve })
  return { promise, finish }
}
async function previewCode(code = CODE) {
  fireEvent.change(screen.getByLabelText(t("associationAttendance.codeField")), { target: { value: code } })
  const form = screen.getByRole("button", { name: t("associationAttendance.preview") }).closest("form")
  if (!form) throw new Error("Formulaire de fixture absent")
  await act(async () => { fireEvent.submit(form) })
}
const mediaDevicesBefore = Object.getOwnPropertyDescriptor(navigator, "mediaDevices")
const clipboardBefore = Object.getOwnPropertyDescriptor(navigator, "clipboard")
function cameraFixture(detect = vi.fn<(source: HTMLVideoElement) => Promise<readonly { rawValue: string }[]>>().mockResolvedValue([])) {
  const stop = vi.fn()
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
  const getUserMedia = vi.fn<MediaDevices["getUserMedia"]>().mockResolvedValue(stream)
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } })
  class Detector {
    static getSupportedFormats = vi.fn().mockResolvedValue(["qr_code"])
    detect = detect
  }
  vi.stubGlobal("BarcodeDetector", Detector)
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined)
  return { stop, stream, getUserMedia, Detector, detect }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval", "setTimeout", "clearTimeout"] })
  vi.setSystemTime(NOW)
  vi.clearAllMocks()
  vi.stubGlobal("BarcodeDetector", undefined)
  vi.spyOn(document, "hidden", "get").mockReturnValue(false)
  mocks.session = signedIn()
  mocks.attendance = { status: "ready", data: VIEW }
  mocks.present = { status: "ready", data: { items: [ROW], continueCursor: null, isDone: true } }
  mocks.event = { status: "ready", data: EVENT }
  mocks.read.mockReset().mockImplementation(() => mocks.attendance)
  mocks.readPresent.mockReset().mockImplementation(() => mocks.present)
  mocks.issue.mockReset().mockResolvedValue({ ok: true, value: { code: CODE, expiresAt: NOW + 60_000 } })
  mocks.preview.mockReset().mockResolvedValue({ ok: true, value: PREVIEW })
  mocks.checkIn.mockReset().mockResolvedValue({ ok: true, value: { alreadyRecorded: false } })
  mocks.clear.mockReset().mockResolvedValue({ ok: true, value: null })
  const eventPage: Loadable<AssociationActivityPage<AssociationEventView>> = { status: "ready", data: { items: [EVENT], continueCursor: null, isDone: true } }
  mocks.events = {
    attendance: CAPABILITY,
    useEvents: () => eventPage,
    useEvent: () => mocks.event,
    create: async () => ({ ok: true, value: { eventId: EVENT.eventId, created: true } }), update: async () => ({ ok: true, value: null }),
    cancel: async () => ({ ok: true, value: null }), register: async () => ({ ok: true, value: null }), unregister: async () => ({ ok: true, value: null }), setReminder: async () => ({ ok: true, value: null }),
  }
})
afterEach(() => {
  cleanup()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (mediaDevicesBefore) Object.defineProperty(navigator, "mediaDevices", mediaDevicesBefore)
  else Reflect.deleteProperty(navigator, "mediaDevices")
  if (clipboardBefore) Object.defineProperty(navigator, "clipboard", clipboardBefore)
  else Reflect.deleteProperty(navigator, "clipboard")
})

describe("DG-023 — billet personnel et contexte vivant", () => {
  it("ne lit aucune présence sur les cartes de liste, puis monte le lecteur au détail", () => {
    const view = render(<I18nProvider locale="fr"><AssociationEventsSection pageId="page-1" handle="association-recette" canManage /></I18nProvider>)
    expect(mocks.read).not.toHaveBeenCalled()
    expect(mocks.readPresent).not.toHaveBeenCalled()
    view.rerender(<I18nProvider locale="fr"><AssociationEventDetail pageId="page-1" handle="association-recette" eventId={EVENT.eventId} /></I18nProvider>)
    expect(mocks.read).toHaveBeenCalledWith(EVENT.eventId)
    expect(screen.getByRole("button", { name: t("associationAttendance.issue") })).toBeVisible()
    expect(mocks.issue).not.toHaveBeenCalled()
  })

  it("émet sur demande, conserve le QR après la nouvelle version de présence puis renouvelle et expire en mémoire", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    const view = render(tree())
    expect(screen.queryByTitle(t("associationAttendance.qrTitle"))).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationAttendance.issue") })) })
    expect(screen.getByTitle(t("associationAttendance.qrTitle"))).toBeInTheDocument()
    mocks.attendance = { status: "ready", data: { ...VIEW, version: 2 } }
    view.rerender(tree())
    expect(screen.getByTitle(t("associationAttendance.qrTitle"))).toBeInTheDocument()
    mocks.issue.mockResolvedValueOnce({ ok: true, value: { code: NEXT_CODE, expiresAt: NOW + 60_000 } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationAttendance.renew") })) })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationAttendance.copy") })) })
    expect(writeText).toHaveBeenCalledExactlyOnceWith(NEXT_CODE)
    expect(mocks.issue).toHaveBeenCalledTimes(2)
    await act(async () => { vi.advanceTimersByTime(60_000) })
    expect(screen.queryByTitle(t("associationAttendance.qrTitle"))).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("associationAttendance.copy") })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: t("associationAttendance.issue") })).toBeEnabled()
  })

  it.each(["waitlisted", "none"] as const)("retire le billet lorsque l'inscription devient %s", async (registration) => {
    const view = render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationAttendance.issue") })) })
    view.rerender(tree({ ...EVENT, registration, isRegistered: false }))
    expect(screen.queryByTitle(t("associationAttendance.qrTitle"))).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("associationAttendance.issue") })).not.toBeInTheDocument()
  })

  it("permet d'afficher le code lisible si la copie échoue, puis le retire à l'expiration", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockRejectedValue(new Error("Copie indisponible"))
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationAttendance.issue") })) })
    expect(screen.getByText(CODE)).not.toBeVisible()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationAttendance.copy") })) })
    expect(screen.getByText(t("associationAttendance.copyFailed"))).toBeVisible()
    fireEvent.click(screen.getByText(t("associationAttendance.showCode")))
    expect(screen.getByText(CODE)).toBeVisible()
    await act(async () => { vi.advanceTimersByTime(60_000) })
    expect(screen.queryByText(CODE)).not.toBeInTheDocument()
    expect(screen.queryByText(t("associationAttendance.showCode"))).not.toBeInTheDocument()
  })

  it("retire un billet dès confirmation, refus d'accès ou suspension, et ne le restaure pas", async () => {
    const view = render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationAttendance.issue") })) })
    mocks.attendance = { status: "ready", data: { ...VIEW, checkedInAt: NOW, version: 3 } }
    view.rerender(tree())
    expect(screen.queryByTitle(t("associationAttendance.qrTitle"))).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(t("associationAttendance.ownRecorded", { date: formatServiceInstant(NOW, EVENT.timeZone, "fr") }))
    mocks.attendance = { status: "error", code: "association_event_access_required" }
    view.rerender(tree())
    expect(screen.getByRole("alert")).toHaveTextContent(t("errors.association_event_access_required"))
    mocks.attendance = { status: "ready", data: VIEW }
    mocks.session = signedIn({ ...MEMBER, status: "suspendue", canPublish: false })
    view.rerender(tree())
    expect(screen.queryByRole("heading", { name: t("associationAttendance.title") })).not.toBeInTheDocument()
    mocks.session = signedIn()
    view.rerender(tree())
    expect(screen.queryByTitle(t("associationAttendance.qrTitle"))).not.toBeInTheDocument()
  })

  it("ignore un billet tardif après changement de lecteur et étiquette la démonstration", async () => {
    const pending = deferred<ActionResult<AssociationEventAttendanceTicket>>()
    mocks.issue.mockReturnValueOnce(pending.promise)
    const view = render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationAttendance.issue") })) })
    mocks.session = signedIn({ ...MEMBER, personId: "person-autre", handle: "autre", displayName: "Jean MBA" })
    view.rerender(tree(EVENT, { ...CAPABILITY, mode: "demonstration" }))
    await act(async () => { pending.finish({ ok: true, value: { code: CODE, expiresAt: NOW + 60_000 } }); await pending.promise })
    expect(screen.getByText(t("associationAttendance.demo"), { normalizer: (text) => text })).toBeVisible()
    expect(screen.queryByTitle(t("associationAttendance.qrTitle"))).not.toBeInTheDocument()
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it("laisse un membre en attente avec une place confirmée obtenir son billet sans liste d'autrui", async () => {
    mocks.session = signedIn({ ...MEMBER, status: "en_attente", canPublish: false })
    render(tree({ ...EVENT, canManage: false }))
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationAttendance.issue") })) })
    expect(screen.getByTitle(t("associationAttendance.qrTitle"))).toBeInTheDocument()
    expect(mocks.issue).toHaveBeenCalledExactlyOnceWith(EVENT.eventId)
    expect(mocks.readPresent).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(t("associationAttendance.codeField"))).not.toBeInTheDocument()
    expect(screen.queryByText(ROW.displayName!)).not.toBeInTheDocument()
  })

  it("ferme le QR à la fin exclusive ou après annulation malgré une projection serveur encore ouverte", async () => {
    const view = render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationAttendance.issue") })) })
    view.rerender(tree({ ...EVENT, status: "cancelled" }))
    expect(screen.queryByTitle(t("associationAttendance.qrTitle"))).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("associationAttendance.issue") })).not.toBeInTheDocument()
    view.rerender(tree({ ...EVENT, endAt: NOW }))
    expect(screen.getByText(t("associationAttendance.closed"))).toBeVisible()
    expect(screen.queryByRole("button", { name: t("associationAttendance.issue") })).not.toBeInTheDocument()
  })
})

describe("DG-023 — lecture, confirmation et correction réservées au responsable", () => {
  it("refuse une URL par le formulaire, prévisualise un code sans pointer et verrouille la confirmation", async () => {
    manager()
    const pending = deferred<ActionResult<{ readonly alreadyRecorded: boolean }>>()
    mocks.checkIn.mockReturnValueOnce(pending.promise)
    render(tree())
    await previewCode("https://example.test/billet")
    expect(screen.getByText(t("errors.association_event_attendance_code_invalid"))).toBeVisible()
    expect(mocks.preview).not.toHaveBeenCalled()
    await previewCode()
    expect(mocks.preview).toHaveBeenCalledExactlyOnceWith({ eventId: EVENT.eventId, code: CODE })
    expect(screen.getByText(t("associationAttendance.previewHint"))).toBeVisible()
    expect(screen.getByText(t("associationAttendance.neutralName"))).toBeVisible()
    expect(mocks.checkIn).not.toHaveBeenCalled()
    const confirm = screen.getByRole("button", { name: t("associationAttendance.confirm") })
    await act(async () => { fireEvent.click(confirm); fireEvent.click(confirm) })
    expect(mocks.checkIn).toHaveBeenCalledExactlyOnceWith({ eventId: EVENT.eventId, code: CODE, expectedVersion: 4 })
    await act(async () => { pending.finish({ ok: true, value: { alreadyRecorded: false } }); await pending.promise })
    expect(screen.queryByRole("button", { name: t("associationAttendance.confirm") })).not.toBeInTheDocument()
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith(t("associationAttendance.recorded"))
    expect(screen.getByText(t("associationAttendance.count", { total: "1" }), { normalizer: (text) => text })).toBeVisible()
  })

  it("signale un billet déjà pointé sans seconde confirmation et efface une prévisualisation expirée", async () => {
    manager()
    mocks.preview.mockResolvedValueOnce({ ok: true, value: { ...PREVIEW, displayName: null, checkedInAt: NOW } })
    render(tree())
    await previewCode()
    expect(screen.getByText(t("associationAttendance.alreadyRecorded"))).toBeVisible()
    expect(screen.getByText(t("associationAttendance.neutralName"))).toBeVisible()
    expect(screen.queryByRole("button", { name: t("associationAttendance.confirm") })).not.toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(60_000) })
    expect(screen.queryByText(t("associationAttendance.previewHint"))).not.toBeInTheDocument()
    expect(screen.getByLabelText(t("associationAttendance.codeField"))).toHaveValue("")
    expect(mocks.checkIn).not.toHaveBeenCalled()
  })

  it("un conflit invalide la prévisualisation et exige une nouvelle lecture", async () => {
    manager()
    mocks.checkIn.mockResolvedValueOnce({ ok: false, code: "association_event_attendance_changed" })
    render(tree())
    await previewCode()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationAttendance.confirm") })) })
    expect(screen.getByRole("alert")).toHaveTextContent(t("errors.association_event_attendance_changed"))
    expect(screen.queryByRole("button", { name: t("associationAttendance.confirm") })).not.toBeInTheDocument()
    expect(screen.getByLabelText(t("associationAttendance.codeField"))).toHaveValue("")
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it("corrige la ligne confirmée avec sa version figée après l'annulation, sans retirer l'inscription", async () => {
    manager()
    mocks.clear.mockResolvedValueOnce({ ok: false, code: "association_event_attendance_changed" })
    mocks.present = { status: "ready", data: { items: [ROW, { ...ROW, registrationId: "registration-2", displayName: null }], continueCursor: null, isDone: true } }
    const event: AssociationEventView = { ...EVENT, status: "cancelled" }
    const view = render(tree(event))
    expect(screen.queryByLabelText(t("associationAttendance.codeField"))).not.toBeInTheDocument()
    const row = screen.getByText(ROW.displayName!).closest("li")
    if (!row) throw new Error("Ligne de fixture absente")
    fireEvent.click(within(row).getByRole("button", { name: t("associationAttendance.correct") }))
    const dialog = screen.getByRole("dialog", { name: t("associationAttendance.correctTitle") })
    expect(dialog).toHaveTextContent(ROW.displayName!)
    expect(dialog).toHaveTextContent(t("associationAttendance.correctHint"))
    expect(mocks.clear).not.toHaveBeenCalled()
    mocks.present = { status: "ready", data: { items: [{ ...ROW, version: 9 }], continueCursor: null, isDone: true } }
    view.rerender(tree(event))
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: t("associationAttendance.confirmCorrection") })) })
    expect(mocks.clear).toHaveBeenCalledExactlyOnceWith({ eventId: EVENT.eventId, registrationId: ROW.registrationId, expectedVersion: 4 })
    expect(within(dialog).getByRole("alert")).toHaveTextContent(t("errors.association_event_attendance_changed"))
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it("démonte liste et code lors d'un refus, et ignore une prévisualisation arrivée après changement d'événement", async () => {
    manager()
    const pending = deferred<ActionResult<AssociationEventAttendancePreview>>()
    mocks.preview.mockReturnValueOnce(pending.promise)
    const view = render(tree())
    await previewCode()
    mocks.attendance = { status: "error", code: "association_event_access_required" }
    view.rerender(tree())
    expect(screen.queryByText(ROW.displayName!)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(t("associationAttendance.codeField"))).not.toBeInTheDocument()
    mocks.attendance = { status: "ready", data: { ...VIEW, eventId: "event-2", canManage: true, canIssueTicket: false, recordedCount: 0 } }
    mocks.present = { status: "ready", data: { items: [], continueCursor: null, isDone: true } }
    view.rerender(tree({ ...EVENT, eventId: "event-2" }))
    await act(async () => { pending.finish({ ok: true, value: PREVIEW }); await pending.promise })
    expect(screen.queryByText(t("associationAttendance.previewHint"))).not.toBeInTheDocument()
    expect(screen.getByLabelText(t("associationAttendance.codeField"))).toHaveValue("")
    expect(mocks.checkIn).not.toHaveBeenCalled()
  })

  it("cache les outils, la liste et le compteur quand le droit de responsable disparaît", () => {
    manager()
    const view = render(tree())
    expect(screen.getByText(ROW.displayName!)).toBeVisible()
    mocks.attendance = { status: "ready", data: VIEW }
    mocks.readPresent.mockClear()
    view.rerender(tree({ ...EVENT, canManage: false }))
    expect(screen.queryByText(ROW.displayName!)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(t("associationAttendance.codeField"))).not.toBeInTheDocument()
    expect(screen.queryByText(t("associationAttendance.count", { total: "1" }), { normalizer: (text) => text })).not.toBeInTheDocument()
    expect(mocks.readPresent).not.toHaveBeenCalled()
  })

  it("relit le nom dans le dialogue de correction et ferme celui-ci si la ligne disparaît", () => {
    manager()
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: t("associationAttendance.correct") }))
    expect(screen.getByRole("dialog", { name: t("associationAttendance.correctTitle") })).toHaveTextContent(ROW.displayName!)
    mocks.present = { status: "ready", data: { items: [{ ...ROW, displayName: null }], continueCursor: null, isDone: true } }
    view.rerender(tree())
    expect(screen.getByRole("dialog", { name: t("associationAttendance.correctTitle") })).toHaveTextContent(t("associationAttendance.neutralName"))
    expect(screen.queryByText(ROW.displayName!)).not.toBeInTheDocument()
    mocks.present = { status: "ready", data: { items: [], continueCursor: null, isDone: true } }
    view.rerender(tree())
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("associationAttendance.confirmCorrection") })).not.toBeInTheDocument()
    expect(mocks.clear).not.toHaveBeenCalled()
  })
})

describe("DG-023 — caméra facultative et arrêt des ressources locales", () => {
  it("ne demande la caméra qu'au clic, remplit le code puis arrête les pistes sans pointer", async () => {
    manager()
    const camera = cameraFixture(vi.fn().mockResolvedValue([{ rawValue: CODE }]))
    render(tree())
    expect(camera.getUserMedia).not.toHaveBeenCalled()
    Object.defineProperty(screen.getByLabelText(t("associationAttendance.videoLabel")), "readyState", { configurable: true, value: 2 })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationAttendance.startCamera") })) })
    expect(camera.getUserMedia).toHaveBeenCalledExactlyOnceWith({ audio: false, video: { facingMode: { ideal: "environment" } } })
    expect(camera.stop).toHaveBeenCalledOnce()
    expect(screen.getByLabelText(t("associationAttendance.codeField"))).toHaveValue(CODE)
    expect(screen.getByText(t("associationAttendance.scanned"))).toBeVisible()
    expect(mocks.preview).not.toHaveBeenCalled()
    expect(mocks.checkIn).not.toHaveBeenCalled()
  })

  it("arrête une permission caméra encore en vol et ignore le flux reçu après fermeture", async () => {
    manager()
    const camera = cameraFixture()
    const pending = deferred<MediaStream>()
    camera.getUserMedia.mockReturnValueOnce(pending.promise)
    render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationAttendance.startCamera") })) })
    fireEvent.click(screen.getByRole("button", { name: t("associationAttendance.stopCamera") }))
    await act(async () => { pending.finish(camera.stream); await pending.promise })
    expect(camera.stop).toHaveBeenCalledOnce()
    expect(screen.getByLabelText(t("associationAttendance.videoLabel"))).toHaveProperty("srcObject", null)
    expect(screen.getByLabelText(t("associationAttendance.codeField"))).toHaveValue("")
    expect(mocks.preview).not.toHaveBeenCalled()
  })

  it.each(["hidden", "pagehide", "unmount"] as const)("arrête le flux sur %s et ignore une détection tardive", async (exit) => {
    manager()
    const pending = deferred<readonly { rawValue: string }[]>()
    const camera = cameraFixture(vi.fn().mockReturnValue(pending.promise))
    const view = render(tree())
    Object.defineProperty(screen.getByLabelText(t("associationAttendance.videoLabel")), "readyState", { configurable: true, value: 2 })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationAttendance.startCamera") })) })
    if (exit === "hidden") {
      vi.spyOn(document, "hidden", "get").mockReturnValue(true)
      fireEvent(document, new Event("visibilitychange"))
    } else if (exit === "pagehide") fireEvent(window, new Event("pagehide"))
    else view.unmount()
    await act(async () => { pending.finish([{ rawValue: CODE }]); await pending.promise })
    expect(camera.stop).toHaveBeenCalledOnce()
    if (exit !== "unmount") expect(screen.getByLabelText(t("associationAttendance.codeField"))).toHaveValue("")
    expect(mocks.preview).not.toHaveBeenCalled()
    expect(mocks.checkIn).not.toHaveBeenCalled()
  })

  it.each(["unsupported", "denied"] as const)("garde la saisie accessible si la caméra est %s", async (reason) => {
    manager()
    const camera = cameraFixture()
    if (reason === "unsupported") camera.Detector.getSupportedFormats.mockResolvedValueOnce(["code_128"])
    else { const error = new Error("Caméra refusée"); error.name = "NotAllowedError"; camera.getUserMedia.mockRejectedValueOnce(error) }
    render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationAttendance.startCamera") })) })
    expect(screen.getByRole("alert")).toHaveTextContent(t(reason === "unsupported" ? "associationAttendance.cameraUnavailable" : "associationAttendance.cameraDenied"))
    expect(screen.getByLabelText(t("associationAttendance.codeField"))).toBeEnabled()
    if (reason === "unsupported") expect(camera.getUserMedia).not.toHaveBeenCalled()
    await previewCode()
    expect(mocks.preview).toHaveBeenCalledExactlyOnceWith({ eventId: EVENT.eventId, code: CODE })
    expect(mocks.checkIn).not.toHaveBeenCalled()
  })
})
