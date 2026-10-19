// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type {
  ActionResult,
  AssociationActivityPage,
  AssociationEventView,
  AssociationEventsCapability,
  AssociationGroupPostView,
  AssociationGroupView,
  AssociationGroupsCapability,
  Loadable,
  MembershipView,
  SessionView,
} from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AssociationEventDetail, AssociationEventsSection } from "./association-events"
import { AssociationGroupContent } from "./association-group"
import { formatServiceInstant } from "./service-request-ui"

const mocks = vi.hoisted(() => ({
  groups: null as AssociationGroupsCapability | null,
  events: null as AssociationEventsCapability | null,
  session: { status: "loading" } as Loadable<SessionView>,
  group: { status: "loading" } as Loadable<AssociationGroupView | null>,
  posts: { status: "loading" } as Loadable<AssociationActivityPage<AssociationGroupPostView>>,
  eventPage: { status: "loading" } as Loadable<AssociationActivityPage<AssociationEventView>>,
  event: { status: "loading" } as Loadable<AssociationEventView | null>,
  readGroup: vi.fn<AssociationGroupsCapability["useGroup"]>(),
  readPosts: vi.fn<AssociationGroupsCapability["usePosts"]>(),
  groupCreate: vi.fn<AssociationGroupsCapability["create"]>(),
  groupJoin: vi.fn<AssociationGroupsCapability["join"]>(),
  groupLeave: vi.fn<AssociationGroupsCapability["leave"]>(),
  groupClose: vi.fn<AssociationGroupsCapability["close"]>(),
  groupPublish: vi.fn<AssociationGroupsCapability["publish"]>(),
  groupRemove: vi.fn<AssociationGroupsCapability["removePost"]>(),
  readEvents: vi.fn<AssociationEventsCapability["useEvents"]>(),
  readEvent: vi.fn<AssociationEventsCapability["useEvent"]>(),
  eventCreate: vi.fn<AssociationEventsCapability["create"]>(),
  eventUpdate: vi.fn<AssociationEventsCapability["update"]>(),
  eventCancel: vi.fn<AssociationEventsCapability["cancel"]>(),
  eventRegister: vi.fn<AssociationEventsCapability["register"]>(),
  eventUnregister: vi.fn<AssociationEventsCapability["unregister"]>(),
  eventSetReminder: vi.fn<AssociationEventsCapability["setReminder"]>(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock("@diasporale/features/data", async (original) => ({
  ...await original<typeof import("@diasporale/features/data")>(),
  useAssociationGroups: () => mocks.groups,
  useAssociationEvents: () => mocks.events,
  useSession: () => mocks.session,
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

const t = getFixedT("fr")
/**
 * Le texte tel que Testing Library relit le DOM (texte, libellé, contenu) : espaces
 * normalisés, insécables comprises (U+00A0 avant « : ; ? ! »). Les noms accessibles
 * (`getByRole(…, { name })`) et les messages transmis se comparent tels quels.
 */
const plain = (value: string) => value.replace(/\s+/g, " ").trim()
const NOW = Date.UTC(2026, 9, 18, 10)
const MEMBER: MembershipView = {
  personId: "person-awa", handle: "awa", displayName: "Awa OGOOUÉ", status: "declaree", badges: ["verified"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: null, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: true, rateTier: "standard", directoryVisibility: "hidden",
}
const GROUP: AssociationGroupView = {
  groupId: "group-1", pageId: "page-1", name: "Groupe privé de recette", state: "active", role: "member",
  isMember: true, canJoin: false, canManage: false, canPublish: true,
}
const POST: AssociationGroupPostView = {
  postId: "post-1", body: "Un échange réservé au groupe autorisé.", author: { displayName: "Éloïse NDONG MBA" },
  createdAt: NOW, isMine: false, canRemove: false, moderation: "published",
}
const EVENT: AssociationEventView = {
  eventId: "event-1", pageId: "page-1", title: "Rencontre culturelle", description: "Présentation de la rencontre.", location: "Salle associative",
  startAt: Date.UTC(2026, 9, 26, 17), endAt: Date.UTC(2026, 9, 26, 19), timeZone: "Europe/Paris", audience: "association",
  status: "scheduled", version: 7, organizer: { name: "Association de recette", handle: "association-recette" },
  moderation: "published", isRegistered: false, canManage: true, canRegister: false,
  capacity: null, confirmedCount: 0, waitlistCount: 0, remainingPlaces: null, registration: "none", waitlistPosition: null,
  registrationClosesAt: null, registrationOpen: true, reminderEnabled: false, reminderAt: null, reminderState: "off",
}
const WAITLISTED: AssociationEventView = {
  ...EVENT, capacity: 2, confirmedCount: 2, waitlistCount: 3, remainingPlaces: 0,
  registration: "waitlisted", waitlistPosition: 2, isRegistered: false, canRegister: false, canManage: false,
}
const GROUPS: AssociationGroupsCapability = {
  useGroup: mocks.readGroup, usePosts: mocks.readPosts, create: mocks.groupCreate, join: mocks.groupJoin,
  leave: mocks.groupLeave, close: mocks.groupClose, publish: mocks.groupPublish, removePost: mocks.groupRemove,
}
const EVENTS: AssociationEventsCapability = {
  useEvents: mocks.readEvents, useEvent: mocks.readEvent, create: mocks.eventCreate, update: mocks.eventUpdate,
  cancel: mocks.eventCancel, register: mocks.eventRegister, unregister: mocks.eventUnregister, setReminder: mocks.eventSetReminder,
}

function signedIn(membership: MembershipView = MEMBER): Loadable<SessionView> {
  return { status: "ready", data: { status: "signed_in", account: { id: "account-1", idn: null, local: null, nameHints: {} }, membership } }
}
function groupTree() {
  return <I18nProvider locale="fr"><AssociationGroupContent pageId="page-1" /></I18nProvider>
}
function eventsTree() {
  return <I18nProvider locale="fr"><AssociationEventsSection pageId="page-1" handle="association-recette" canManage /></I18nProvider>
}
function detailTree() {
  return <I18nProvider locale="fr"><AssociationEventDetail pageId="page-1" handle="association-recette" eventId="event-1" /></I18nProvider>
}
async function submit(label: string) {
  const form = screen.getByRole("button", { name: label }).closest("form")
  if (!form) throw new Error("Formulaire de fixture absent")
  await act(async () => { fireEvent.submit(form) })
}
function fillEvent() {
  fireEvent.change(screen.getByLabelText(t("associationActivities.event.titleField")), { target: { value: "Rencontre culturelle" } })
  fireEvent.change(screen.getByLabelText(t("associationActivities.event.descriptionField")), { target: { value: "Présentation de la rencontre." } })
  fireEvent.change(screen.getByLabelText(t("associationActivities.event.locationField")), { target: { value: "Salle associative" } })
  fireEvent.change(screen.getByLabelText(t("associationActivities.event.timeZone")), { target: { value: "Europe/Paris" } })
  fireEvent.change(screen.getByLabelText(t("associationActivities.event.startDate")), { target: { value: "2026-10-26" } })
  fireEvent.change(screen.getByLabelText(t("associationActivities.event.startTime")), { target: { value: "18:00" } })
  fireEvent.change(screen.getByLabelText(t("associationActivities.event.endDate")), { target: { value: "2026-10-26" } })
  fireEvent.change(screen.getByLabelText(t("associationActivities.event.endTime")), { target: { value: "20:00" } })
}
function pendingPublication() {
  let finish: (result: ActionResult) => void = () => {}
  const promise = new Promise<ActionResult>((resolve) => { finish = resolve })
  return { promise, finish }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  vi.clearAllMocks()
  mocks.groups = GROUPS
  mocks.events = EVENTS
  mocks.session = signedIn()
  mocks.group = { status: "ready", data: GROUP }
  mocks.posts = { status: "ready", data: { items: [POST], continueCursor: null, isDone: true } }
  mocks.eventPage = { status: "ready", data: { items: [], continueCursor: null, isDone: true } }
  mocks.event = { status: "ready", data: EVENT }
  mocks.readGroup.mockReset().mockImplementation(() => mocks.group)
  mocks.readPosts.mockReset().mockImplementation(() => mocks.posts)
  mocks.readEvents.mockReset().mockImplementation(() => mocks.eventPage)
  mocks.readEvent.mockReset().mockImplementation(() => mocks.event)
  mocks.groupCreate.mockReset().mockResolvedValue({ ok: true, value: { groupId: "group-created", created: true } })
  mocks.groupJoin.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.groupLeave.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.groupClose.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.groupPublish.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.groupRemove.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.eventCreate.mockReset().mockResolvedValue({ ok: true, value: { eventId: "event-created", created: true } })
  mocks.eventUpdate.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.eventCancel.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.eventRegister.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.eventUnregister.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.eventSetReminder.mockReset().mockResolvedValue({ ok: true, value: null })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe("activités associatives — gestes volontaires et droits vivants", () => {
  it("ne monte ni ne lit le mur du groupe pour une personne non admise", () => {
    mocks.group = { status: "ready", data: { ...GROUP, role: null, isMember: false, canJoin: false, canPublish: false } }
    render(groupTree())
    expect(screen.getByText(t("associationActivities.group.eligibility"))).toBeVisible()
    expect(screen.queryByRole("heading", { name: t("associationActivities.group.wall") })).not.toBeInTheDocument()
    expect(screen.queryByText(POST.body)).not.toBeInTheDocument()
    expect(mocks.readPosts).not.toHaveBeenCalled()
    expect(mocks.groupJoin).not.toHaveBeenCalled()
  })

  it("demande un geste d'entrée explicite et attend la confirmation de lecture avant de monter le mur", async () => {
    mocks.group = { status: "ready", data: { ...GROUP, role: null, isMember: false, canJoin: true, canPublish: false } }
    const view = render(groupTree())
    expect(mocks.groupJoin).not.toHaveBeenCalled()
    expect(mocks.readPosts).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationActivities.group.join") })) })
    expect(mocks.groupJoin).toHaveBeenCalledExactlyOnceWith("group-1")
    expect(mocks.readPosts).not.toHaveBeenCalled()

    mocks.group = { status: "ready", data: GROUP }
    view.rerender(groupTree())
    expect(screen.getByRole("heading", { name: t("associationActivities.group.wall") })).toBeVisible()
    expect(screen.getByText(POST.body)).toBeVisible()
    expect(mocks.readPosts).toHaveBeenCalledWith({ groupId: "group-1", cursor: null })
    expect(mocks.groupPublish).not.toHaveBeenCalled()
  })

  it("confirme le départ puis retire le mur et son formulaire dès que les droits se ferment", async () => {
    const view = render(groupTree())
    expect(screen.getByText(POST.body)).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: t("associationActivities.group.leave") }))
    const dialog = screen.getByRole("dialog", { name: t("associationActivities.group.leaveTitle") })
    expect(dialog).toHaveTextContent(t("associationActivities.group.leaveDescription"))
    expect(mocks.groupLeave).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: t("associationActivities.group.leave") })) })
    expect(mocks.groupLeave).toHaveBeenCalledExactlyOnceWith("group-1")

    mocks.readPosts.mockClear()
    mocks.group = { status: "error", code: "association_group_access_required" }
    view.rerender(groupTree())
    expect(screen.getByRole("alert")).toHaveTextContent(t("errors.association_group_access_required"))
    expect(screen.queryByText(POST.body)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(t("associationActivities.group.body"))).not.toBeInTheDocument()
    expect(mocks.readPosts).not.toHaveBeenCalled()
    expect(mocks.groupClose).not.toHaveBeenCalled()
  })

  it("crée par défaut pour les adhérents, convertit les heures IANA et n'inscrit personne automatiquement", async () => {
    render(eventsTree())
    fireEvent.click(screen.getByRole("button", { name: t("associationActivities.event.create") }))
    const dialog = screen.getByRole("dialog", { name: t("associationActivities.event.create") })
    expect(dialog).toHaveTextContent(t("associationActivities.event.editorLead"))
    expect(screen.getByLabelText(plain(t("associationActivities.event.audience")))).toHaveValue("association")
    expect(screen.getByLabelText(t("associationActivities.event.capacityField"))).toHaveValue(null)
    expect(screen.getByLabelText(t("associationActivities.event.registrationCloseDate"))).toHaveValue("")
    expect(screen.getByLabelText(t("associationActivities.event.registrationCloseTime"))).toHaveValue("")
    fillEvent()
    await submit(t("associationActivities.event.save"))

    // Le 26 octobre à Paris, 18 h est 17 h UTC (après le retour à l'heure d'hiver).
    expect(mocks.eventCreate).toHaveBeenCalledExactlyOnceWith({
      pageId: "page-1", title: "Rencontre culturelle", description: "Présentation de la rencontre.", location: "Salle associative",
      timeZone: "Europe/Paris", audience: "association", capacity: null, registrationClosesAt: null, startAt: Date.UTC(2026, 9, 26, 17), endAt: Date.UTC(2026, 9, 26, 19),
      idempotencyKey: expect.any(String),
    })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(mocks.eventRegister).not.toHaveBeenCalled()
    expect(mocks.groupJoin).not.toHaveBeenCalled()
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith(t("associationActivities.event.saved"))
  })

  it("l'édition conserve sa version ouverte et le brouillon après un conflit, malgré une nouvelle lecture", async () => {
    mocks.event = { status: "ready", data: { ...EVENT, capacity: 20, confirmedCount: 3, remainingPlaces: 17 } }
    mocks.eventUpdate.mockResolvedValueOnce({ ok: false, code: "association_event_version_changed" })
    const view = render(detailTree())
    fireEvent.click(screen.getByRole("button", { name: t("associationActivities.event.edit") }))
    fireEvent.change(screen.getByLabelText(t("associationActivities.event.titleField")), { target: { value: "Mon titre corrigé reste dans la feuille" } })
    fireEvent.change(screen.getByLabelText(t("associationActivities.event.capacityField")), { target: { value: "15" } })
    fireEvent.change(screen.getByLabelText(t("associationActivities.event.registrationCloseDate")), { target: { value: "2026-10-25" } })
    fireEvent.change(screen.getByLabelText(t("associationActivities.event.registrationCloseTime")), { target: { value: "18:00" } })
    mocks.event = { status: "ready", data: { ...EVENT, version: 8, title: "Titre reçu d'une autre fenêtre", capacity: 30, confirmedCount: 3, remainingPlaces: 27, registrationClosesAt: Date.UTC(2026, 9, 24, 16) } }
    view.rerender(detailTree())
    await submit(t("associationActivities.event.save"))

    expect(mocks.eventUpdate).toHaveBeenCalledExactlyOnceWith({
      eventId: "event-1", expectedVersion: 7, pageId: "page-1", title: "Mon titre corrigé reste dans la feuille",
      description: EVENT.description, location: EVENT.location, startAt: EVENT.startAt, endAt: EVENT.endAt, timeZone: EVENT.timeZone, audience: "association", capacity: 15, registrationClosesAt: Date.UTC(2026, 9, 25, 17),
    })
    expect(screen.getByRole("alert")).toHaveTextContent(t("errors.association_event_version_changed"))
    expect(screen.getByRole("dialog", { name: t("associationActivities.event.edit") })).toBeVisible()
    expect(screen.getByLabelText(t("associationActivities.event.titleField"))).toHaveValue("Mon titre corrigé reste dans la feuille")
    expect(screen.getByLabelText(t("associationActivities.event.capacityField"))).toHaveValue(15)
    expect(screen.getByLabelText(t("associationActivities.event.registrationCloseDate"))).toHaveValue("2026-10-25")
    expect(screen.getByLabelText(t("associationActivities.event.registrationCloseTime"))).toHaveValue("18:00")
    expect(screen.getByLabelText(t("associationActivities.event.startDate"))).toHaveValue("2026-10-26")
    expect(mocks.eventCreate).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it("l'annulation se confirme avec la version figée avant une lecture plus récente", async () => {
    const view = render(detailTree())
    fireEvent.click(screen.getByRole("button", { name: t("associationActivities.event.cancelEvent") }))
    const dialog = screen.getByRole("dialog", { name: t("associationActivities.event.cancelEvent") })
    expect(dialog).toHaveTextContent(plain(t("associationActivities.event.cancelDescription")))
    expect(mocks.eventCancel).not.toHaveBeenCalled()
    mocks.event = { status: "ready", data: { ...EVENT, version: 8 } }
    view.rerender(detailTree())
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: t("associationActivities.event.cancelEvent") })) })

    expect(mocks.eventCancel).toHaveBeenCalledExactlyOnceWith({ eventId: "event-1", expectedVersion: 7 })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(mocks.eventUpdate).not.toHaveBeenCalled()
    expect(mocks.eventUnregister).not.toHaveBeenCalled()
  })

  it("ignore une publication tardive de l'ancienne personne sans effacer le nouveau brouillon ni émettre de toast", async () => {
    const pending = pendingPublication()
    mocks.groupPublish.mockReturnValueOnce(pending.promise)
    const view = render(groupTree())
    fireEvent.change(screen.getByLabelText(t("associationActivities.group.body")), { target: { value: "Message de la première personne." } })
    await submit(t("associationActivities.group.publish"))
    expect(mocks.groupPublish).toHaveBeenCalledTimes(1)

    mocks.session = signedIn({ ...MEMBER, personId: "person-autre", handle: "autre", displayName: "Jean MBA" })
    view.rerender(groupTree())
    expect(screen.getByLabelText(t("associationActivities.group.body"))).toHaveValue("")
    fireEvent.change(screen.getByLabelText(t("associationActivities.group.body")), { target: { value: "Brouillon propre à la nouvelle personne." } })
    await act(async () => { pending.finish({ ok: true, value: null }); await pending.promise })

    expect(screen.getByLabelText(t("associationActivities.group.body"))).toHaveValue("Brouillon propre à la nouvelle personne.")
    expect(screen.getByRole("button", { name: t("associationActivities.group.publish") })).toBeEnabled()
    expect(mocks.groupPublish).toHaveBeenCalledExactlyOnceWith({ groupId: "group-1", body: "Message de la première personne.", idempotencyKey: expect.any(String) })
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it("une lecture de détail devenue nulle ferme le contenu et toute feuille d'édition ouverte", () => {
    const view = render(detailTree())
    expect(screen.getByText(EVENT.description)).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: t("associationActivities.event.edit") }))
    fireEvent.change(screen.getByLabelText(t("associationActivities.event.titleField")), { target: { value: "Brouillon désormais inaccessible" } })
    mocks.event = { status: "ready", data: null }
    view.rerender(detailTree())

    expect(screen.getByText(t("errors.not_found"))).toBeVisible()
    expect(screen.queryByText(EVENT.title)).not.toBeInTheDocument()
    expect(screen.queryByText(EVENT.description)).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("associationActivities.event.edit") })).not.toBeInTheDocument()
    expect(mocks.eventUpdate).not.toHaveBeenCalled()
    expect(mocks.eventRegister).not.toHaveBeenCalled()
  })
})

describe("DG-023 — capacité et demande de place", () => {
  it.each([1, 10_000])("transmet la capacité entière %s avec les mêmes dates et sans inscription automatique", async (capacity) => {
    render(eventsTree())
    fireEvent.click(screen.getByRole("button", { name: t("associationActivities.event.create") }))
    fillEvent()
    const field = screen.getByLabelText(t("associationActivities.event.capacityField"))
    expect(field).toHaveAttribute("min", "1")
    expect(field).toHaveAttribute("max", "10000")
    fireEvent.change(field, { target: { value: String(capacity) } })
    await submit(t("associationActivities.event.save"))
    expect(mocks.eventCreate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ capacity, audience: "association", startAt: EVENT.startAt, endAt: EVENT.endAt }))
    expect(mocks.eventRegister).not.toHaveBeenCalled()
  })

  it("refuse zéro, une fraction ou une capacité excessive sans perdre le brouillon", async () => {
    render(eventsTree())
    fireEvent.click(screen.getByRole("button", { name: t("associationActivities.event.create") }))
    fillEvent()
    for (const capacity of [0, 1.5, 10_001]) {
      fireEvent.change(screen.getByLabelText(t("associationActivities.event.capacityField")), { target: { value: String(capacity) } })
      await submit(t("associationActivities.event.save"))
      expect(screen.getByText(t("errors.association_event_capacity_invalid"))).toBeVisible()
      expect(screen.getByLabelText(t("associationActivities.event.capacityField"))).toHaveValue(capacity)
      expect(screen.getByLabelText(t("associationActivities.event.titleField"))).toHaveValue(EVENT.title)
    }
    expect(mocks.eventCreate).not.toHaveBeenCalled()
  })

  it("conserve la capacité initiale et permet de revenir explicitement à sans limite", async () => {
    mocks.event = { status: "ready", data: { ...EVENT, capacity: 25, confirmedCount: 3, remainingPlaces: 22 } }
    render(detailTree())
    fireEvent.click(screen.getByRole("button", { name: t("associationActivities.event.edit") }))
    expect(screen.getByLabelText(t("associationActivities.event.capacityField"))).toHaveValue(25)
    expect(screen.getByText(t("associationActivities.event.capacityChangeHint"))).toBeVisible()
    fireEvent.change(screen.getByLabelText(t("associationActivities.event.capacityField")), { target: { value: "" } })
    await submit(t("associationActivities.event.save"))
    expect(mocks.eventUpdate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ eventId: "event-1", expectedVersion: 7, capacity: null }))
  })

  it("garde la capacité et le texte si une réduction devient inférieure aux confirmations relues par le serveur", async () => {
    mocks.event = { status: "ready", data: { ...EVENT, capacity: 10, confirmedCount: 3, remainingPlaces: 7 } }
    mocks.eventUpdate.mockResolvedValueOnce({ ok: false, code: "association_event_capacity_below_confirmed" })
    const view = render(detailTree())
    fireEvent.click(screen.getByRole("button", { name: t("associationActivities.event.edit") }))
    fireEvent.change(screen.getByLabelText(t("associationActivities.event.titleField")), { target: { value: "Titre conservé pendant la réduction" } })
    fireEvent.change(screen.getByLabelText(t("associationActivities.event.capacityField")), { target: { value: "2" } })
    await submit(t("associationActivities.event.save"))
    expect(mocks.eventUpdate).not.toHaveBeenCalled()
    expect(screen.getByText(t("errors.association_event_capacity_below_confirmed"))).toBeVisible()

    fireEvent.change(screen.getByLabelText(t("associationActivities.event.capacityField")), { target: { value: "3" } })
    mocks.event = { status: "ready", data: { ...EVENT, capacity: 10, confirmedCount: 5, remainingPlaces: 5 } }
    view.rerender(detailTree())
    await submit(t("associationActivities.event.save"))
    expect(mocks.eventUpdate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ expectedVersion: 7, capacity: 3, title: "Titre conservé pendant la réduction" }))
    expect(screen.getByRole("dialog", { name: t("associationActivities.event.edit") })).toBeVisible()
    expect(screen.getByLabelText(t("associationActivities.event.capacityField"))).toHaveValue(3)
    expect(screen.getByLabelText(t("associationActivities.event.titleField"))).toHaveValue("Titre conservé pendant la réduction")
    expect(screen.getByText(t("errors.association_event_capacity_below_confirmed"))).toBeVisible()
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it("un événement complet explique la file et la promotion avant le geste, puis attend le DTO pour afficher le rang", async () => {
    mocks.event = { status: "ready", data: { ...WAITLISTED, registration: "none", waitlistPosition: null, canRegister: true } }
    const view = render(detailTree())
    const join = screen.getByRole("button", { name: t("associationActivities.event.joinWaitlist") })
    expect(join).toHaveAccessibleDescription(t("associationActivities.event.placeRequestConsent"))
    expect(screen.getByText(t("associationActivities.event.placeRequestConsent"))).toBeVisible()
    expect(within(screen.getByText(t("associationActivities.event.capacityLabel")).parentElement!).getByText("2")).toBeVisible()
    expect(within(screen.getByText(t("associationActivities.event.confirmedLabel")).parentElement!).getByText("2")).toBeVisible()
    expect(within(screen.getByText(t("associationActivities.event.remainingLabel")).parentElement!).getByText("0")).toBeVisible()
    expect(within(screen.getByText(t("associationActivities.event.waitlistLabel")).parentElement!).getByText("3")).toBeVisible()
    expect(mocks.eventRegister).not.toHaveBeenCalled()

    await act(async () => { fireEvent.click(join) })
    expect(mocks.eventRegister).toHaveBeenCalledExactlyOnceWith("event-1")
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith(t("associationActivities.event.requestSaved"))
    expect(screen.queryByText(t("associationActivities.event.registered"))).not.toBeInTheDocument()
    expect(screen.queryByText(t("associationActivities.event.waitlistPosition", { position: "4" }))).not.toBeInTheDocument()

    mocks.event = { status: "ready", data: { ...WAITLISTED, waitlistCount: 4, waitlistPosition: 4 } }
    view.rerender(detailTree())
    expect(screen.getByRole("status")).toHaveTextContent(t("associationActivities.event.waitlistPosition", { position: "4" }))
    expect(screen.queryByRole("button", { name: t("associationActivities.event.joinWaitlist") })).not.toBeInTheDocument()
    expect(screen.queryByText(t("associationActivities.event.registered"))).not.toBeInTheDocument()
  })

  it("actualise par la même commande et attend la lecture pour afficher une confirmation", async () => {
    mocks.event = { status: "ready", data: WAITLISTED }
    const view = render(detailTree())
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationActivities.event.refreshPlace") })) })
      expect(screen.getByRole("status")).toHaveTextContent(t("associationActivities.event.waitlistPosition", { position: "2" }))
    }
    expect(mocks.eventRegister).toHaveBeenNthCalledWith(1, "event-1")
    expect(mocks.eventRegister).toHaveBeenNthCalledWith(2, "event-1")
    expect(mocks.eventRegister).toHaveBeenCalledTimes(2)
    expect(mocks.success).toHaveBeenCalledTimes(2)
    expect(mocks.success).toHaveBeenLastCalledWith(t("associationActivities.event.requestSaved"))
    expect(mocks.success).not.toHaveBeenCalledWith(t("associationActivities.event.registered"))

    mocks.event = { status: "ready", data: { ...WAITLISTED, registration: "confirmed", isRegistered: true, waitlistPosition: null, waitlistCount: 2 } }
    view.rerender(detailTree())
    expect(screen.getByRole("status")).toHaveTextContent(t("associationActivities.event.registered"))
    expect(screen.queryByRole("button", { name: t("associationActivities.event.refreshPlace") })).not.toBeInTheDocument()
    expect(mocks.success).toHaveBeenCalledTimes(2)
  })

  it.each([
    { status: "cancelled" as const },
    { startAt: NOW - 2 * 3_600_000, endAt: NOW - 3_600_000 },
    { moderation: "pending_review" as const },
  ])("ferme demande et actualisation mais permet de retirer sa demande en attente : %o", async (closed) => {
    mocks.event = { status: "ready", data: { ...WAITLISTED, ...closed } }
    const view = render(detailTree())
    expect(screen.queryByRole("button", { name: t("associationActivities.event.refreshPlace") })).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationActivities.event.withdrawWaitlist") })) })
    expect(mocks.eventUnregister).toHaveBeenCalledExactlyOnceWith("event-1")
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith(t("associationActivities.event.waitlistWithdrawn"))
    mocks.event = { status: "ready", data: { ...WAITLISTED, ...closed, registration: "none", waitlistPosition: null, canRegister: true } }
    view.rerender(detailTree())
    expect(screen.queryByRole("button", { name: t("associationActivities.event.register") })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("associationActivities.event.joinWaitlist") })).not.toBeInTheDocument()
    expect(mocks.eventRegister).not.toHaveBeenCalled()
  })

  it("un compte redevenu en attente peut retirer sa demande mais ne peut plus actualiser sa place", async () => {
    mocks.event = { status: "ready", data: WAITLISTED }
    const view = render(detailTree())
    expect(screen.getByRole("button", { name: t("associationActivities.event.refreshPlace") })).toBeEnabled()
    mocks.session = signedIn({ ...MEMBER, status: "en_attente", canPublish: false })
    view.rerender(detailTree())
    expect(screen.queryByRole("button", { name: t("associationActivities.event.refreshPlace") })).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationActivities.event.withdrawWaitlist") })) })
    expect(mocks.eventUnregister).toHaveBeenCalledExactlyOnceWith("event-1")
    expect(mocks.eventRegister).not.toHaveBeenCalled()
  })

  it("conserve le retrait d'une place confirmée après l'annulation de l'événement", async () => {
    mocks.event = { status: "ready", data: { ...WAITLISTED, status: "cancelled", registration: "confirmed", isRegistered: true, waitlistPosition: null } }
    render(detailTree())
    expect(screen.getByText(t("associationActivities.event.registered"))).toBeVisible()
    expect(screen.queryByRole("button", { name: t("associationActivities.event.refreshPlace") })).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationActivities.event.unregister") })) })
    expect(mocks.eventUnregister).toHaveBeenCalledExactlyOnceWith("event-1")
    expect(mocks.eventRegister).not.toHaveBeenCalled()
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith(t("associationActivities.event.unregistered"))
  })

  it("ignore l'actualisation tardive d'un ancien compte et affiche uniquement le rang du nouveau compte", async () => {
    const pending = pendingPublication()
    mocks.event = { status: "ready", data: WAITLISTED }
    mocks.eventRegister.mockReturnValueOnce(pending.promise)
    const view = render(detailTree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("associationActivities.event.refreshPlace") })) })
    mocks.session = signedIn({ ...MEMBER, personId: "person-autre", handle: "autre", displayName: "Jean MBA" })
    mocks.event = { status: "ready", data: { ...WAITLISTED, waitlistCount: 8, waitlistPosition: 8 } }
    view.rerender(detailTree())
    await act(async () => { pending.finish({ ok: true, value: null }); await pending.promise })

    expect(screen.getByRole("status")).toHaveTextContent(t("associationActivities.event.waitlistPosition", { position: "8" }))
    expect(screen.getByRole("button", { name: t("associationActivities.event.refreshPlace") })).toBeEnabled()
    expect(mocks.eventRegister).toHaveBeenCalledExactlyOnceWith("event-1")
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })
})

describe("DG-023 — clôture et rappel personnel", () => {
  it("convertit la clôture dans le fuseau événement, même si le décalage change avant son début", async () => {
    render(eventsTree())
    fireEvent.click(screen.getByRole("button", { name: t("associationActivities.event.create") }))
    fillEvent()
    fireEvent.change(screen.getByLabelText(t("associationActivities.event.registrationCloseDate")), { target: { value: "2026-10-24" } })
    fireEvent.change(screen.getByLabelText(t("associationActivities.event.registrationCloseTime")), { target: { value: "18:00" } })
    await submit(t("associationActivities.event.save"))
    // Paris : clôture avant le changement d'heure (+2), début après (+1).
    expect(mocks.eventCreate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ registrationClosesAt: Date.UTC(2026, 9, 24, 16), startAt: EVENT.startAt, timeZone: "Europe/Paris" }))
    expect(mocks.eventSetReminder).not.toHaveBeenCalled()
    expect(mocks.eventRegister).not.toHaveBeenCalled()
  })

  it.each([
    { date: "2026-10-24", time: "" },
    { date: "", time: "18:00" },
    { date: "2026-10-26", time: "18:01" },
    { date: "2026-10-25", time: "02:30" },
  ])("refuse une clôture partielle, après le début ou à une heure ambiguë sans perdre les champs : %o", async ({ date, time }) => {
    render(eventsTree())
    fireEvent.click(screen.getByRole("button", { name: t("associationActivities.event.create") }))
    fillEvent()
    fireEvent.change(screen.getByLabelText(t("associationActivities.event.registrationCloseDate")), { target: { value: date } })
    fireEvent.change(screen.getByLabelText(t("associationActivities.event.registrationCloseTime")), { target: { value: time } })
    await submit(t("associationActivities.event.save"))
    expect(screen.getByText(t("errors.association_event_deadline_invalid"))).toBeVisible()
    expect(screen.getByLabelText(t("associationActivities.event.registrationCloseDate"))).toHaveValue(date)
    expect(screen.getByLabelText(t("associationActivities.event.registrationCloseTime"))).toHaveValue(time)
    expect(screen.getByLabelText(t("associationActivities.event.titleField"))).toHaveValue(EVENT.title)
    expect(mocks.eventCreate).not.toHaveBeenCalled()
  })

  it("accepte une clôture passée explicite et explique la fermeture immédiate", async () => {
    render(eventsTree())
    fireEvent.click(screen.getByRole("button", { name: t("associationActivities.event.create") }))
    fillEvent()
    expect(screen.getByText(t("associationActivities.event.registrationCloseHint"))).toBeVisible()
    fireEvent.change(screen.getByLabelText(t("associationActivities.event.registrationCloseDate")), { target: { value: "2026-10-17" } })
    fireEvent.change(screen.getByLabelText(t("associationActivities.event.registrationCloseTime")), { target: { value: "18:00" } })
    await submit(t("associationActivities.event.save"))
    expect(mocks.eventCreate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ registrationClosesAt: Date.UTC(2026, 9, 17, 16) }))
  })

  it("relit la clôture initiale dans le fuseau événement et transmet null pour une réouverture explicite", async () => {
    mocks.event = { status: "ready", data: { ...WAITLISTED, canManage: true, registrationClosesAt: Date.UTC(2026, 9, 17, 16), registrationOpen: false } }
    render(detailTree())
    fireEvent.click(screen.getByRole("button", { name: t("associationActivities.event.edit") }))
    expect(screen.getByLabelText(t("associationActivities.event.registrationCloseDate"))).toHaveValue("2026-10-17")
    expect(screen.getByLabelText(t("associationActivities.event.registrationCloseTime"))).toHaveValue("18:00")
    expect(screen.getByText(plain(t("associationActivities.event.registrationReopenHint")))).toBeVisible()
    fireEvent.change(screen.getByLabelText(t("associationActivities.event.registrationCloseDate")), { target: { value: "" } })
    fireEvent.change(screen.getByLabelText(t("associationActivities.event.registrationCloseTime")), { target: { value: "" } })
    await submit(t("associationActivities.event.save"))
    expect(mocks.eventUpdate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ eventId: EVENT.eventId, expectedVersion: 7, registrationClosesAt: null }))
    expect(mocks.eventRegister).not.toHaveBeenCalled()
    expect(mocks.eventUnregister).not.toHaveBeenCalled()
  })

  it.each(["deadline", "start"] as const)("ferme au temps exact de %s malgré un booléen serveur encore ouvert", async (boundary) => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] })
    vi.setSystemTime(NOW)
    const closingAt = NOW + 30_000
    const event: AssociationEventView = { ...EVENT, canRegister: true, registrationOpen: true, startAt: boundary === "start" ? closingAt : EVENT.startAt, registrationClosesAt: boundary === "deadline" ? closingAt : null }
    mocks.event = { status: "ready", data: event }
    const view = render(detailTree())
    expect(screen.getByRole("button", { name: t("associationActivities.event.register") })).toBeEnabled()
    expect(screen.getByText(plain(t("associationActivities.event.registrationDeadline", { date: formatServiceInstant(closingAt, event.timeZone, "fr"), zone: event.timeZone })))).toBeVisible()
    await act(async () => { vi.advanceTimersByTime(30_000) })
    expect(screen.queryByRole("button", { name: t("associationActivities.event.register") })).not.toBeInTheDocument()
    expect(screen.getByText(t("associationActivities.event.registrationClosed"))).toBeVisible()
    mocks.event = { status: "ready", data: { ...event, registration: "waitlisted", waitlistPosition: 2, canRegister: false } }
    view.rerender(detailTree())
    expect(screen.queryByRole("button", { name: t("associationActivities.event.refreshPlace") })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: t("associationActivities.event.withdrawWaitlist") })).toBeEnabled()
    expect(mocks.eventRegister).not.toHaveBeenCalled()
  })

  it("respecte la fermeture serveur puis reprend la file après une réouverture lue", () => {
    mocks.event = { status: "ready", data: { ...WAITLISTED, registrationClosesAt: EVENT.startAt, registrationOpen: false } }
    const view = render(detailTree())
    expect(screen.queryByRole("button", { name: t("associationActivities.event.refreshPlace") })).not.toBeInTheDocument()
    expect(screen.getByText(t("associationActivities.event.registrationClosureRule"))).toBeVisible()
    mocks.event = { status: "ready", data: { ...WAITLISTED, registrationClosesAt: EVENT.startAt, registrationOpen: true, version: 8 } }
    view.rerender(detailTree())
    expect(screen.getByRole("button", { name: t("associationActivities.event.refreshPlace") })).toBeEnabled()
    expect(screen.getByText(t("associationActivities.event.waitlistPosition", { position: "2" }))).toBeVisible()
    expect(mocks.eventRegister).not.toHaveBeenCalled()
    expect(mocks.eventUnregister).not.toHaveBeenCalled()
  })

  it("permet à son compte en attente de choisir un rappel, puis attend sa confirmation de place", async () => {
    mocks.session = signedIn({ ...MEMBER, status: "en_attente", canPublish: false })
    mocks.event = { status: "ready", data: WAITLISTED }
    const view = render(detailTree())
    const choice = screen.getByRole("checkbox", { name: t("associationActivities.event.reminderChoice") })
    expect(choice).not.toBeChecked()
    expect(choice).toBeEnabled()
    expect(choice).toHaveAccessibleDescription(t("associationActivities.event.reminderHint"))
    await act(async () => { fireEvent.click(choice) })
    expect(mocks.eventSetReminder).toHaveBeenCalledExactlyOnceWith({ eventId: "event-1", enabled: true })
    expect(choice).not.toBeChecked()
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith(t("associationActivities.event.reminderSaved"))
    expect(mocks.eventRegister).not.toHaveBeenCalled()
    mocks.event = { status: "ready", data: { ...WAITLISTED, reminderEnabled: true, reminderState: "waiting_confirmation" } }
    view.rerender(detailTree())
    expect(screen.getByRole("checkbox", { name: t("associationActivities.event.reminderChoice") })).toBeChecked()
    expect(screen.getByText(t("associationActivities.event.reminderWaiting"))).toBeVisible()

    const due = EVENT.startAt - 86_400_000
    mocks.event = { status: "ready", data: { ...WAITLISTED, registration: "confirmed", isRegistered: true, waitlistPosition: null, reminderEnabled: true, reminderAt: due, reminderState: "scheduled" } }
    view.rerender(detailTree())
    expect(screen.getByText(t("associationActivities.event.reminderScheduled", { date: formatServiceInstant(due, EVENT.timeZone, "fr"), zone: EVENT.timeZone }))).toBeVisible()
    expect(mocks.eventSetReminder).toHaveBeenCalledTimes(1)
  })

  it("ne propose aucun choix de rappel à une personne sans inscription ni demande", () => {
    mocks.event = { status: "ready", data: { ...EVENT, canRegister: true } }
    render(detailTree())
    expect(screen.queryByRole("checkbox", { name: t("associationActivities.event.reminderChoice") })).not.toBeInTheDocument()
    expect(mocks.eventSetReminder).not.toHaveBeenCalled()
  })

  it.each(["scheduled", "cancelled"] as const)("refuse l'activation à J-1 mais laisse désactiver sa préférence après %s", async (status) => {
    const late: AssociationEventView = { ...WAITLISTED, status, startAt: NOW + 86_400_000, endAt: NOW + 90_000_000, reminderState: "expired" }
    mocks.event = { status: "ready", data: late }
    const view = render(detailTree())
    const choice = screen.getByRole("checkbox", { name: t("associationActivities.event.reminderChoice") })
    expect(choice).toBeDisabled()
    expect(screen.getByText(t("associationActivities.event.reminderTooLate"))).toBeVisible()
    expect(screen.getByText(t("associationActivities.event.reminderExpired"))).toBeVisible()
    expect(mocks.eventSetReminder).not.toHaveBeenCalled()
    mocks.event = { status: "ready", data: { ...late, reminderEnabled: true } }
    view.rerender(detailTree())
    const enabled = screen.getByRole("checkbox", { name: t("associationActivities.event.reminderChoice") })
    expect(enabled).toBeEnabled()
    await act(async () => { fireEvent.click(enabled) })
    expect(mocks.eventSetReminder).toHaveBeenCalledExactlyOnceWith({ eventId: "event-1", enabled: false })
  })

  it("affiche recorded comme un ajout à la cloche et permet encore de désactiver après l'événement", async () => {
    mocks.event = { status: "ready", data: { ...WAITLISTED, registration: "confirmed", isRegistered: true, waitlistPosition: null, startAt: NOW - 7_200_000, endAt: NOW - 3_600_000, reminderEnabled: true, reminderAt: NOW - 93_600_000, reminderState: "recorded" } }
    render(detailTree())
    expect(screen.getByText(t("associationActivities.event.reminderRecorded"))).toHaveTextContent("Rappel ajouté à votre cloche.")
    expect(screen.getByText(t("associationActivities.event.reminderRecorded"))).not.toHaveTextContent(/envoyé|reçu/i)
    await act(async () => { fireEvent.click(screen.getByRole("checkbox", { name: t("associationActivities.event.reminderChoice") })) })
    expect(mocks.eventSetReminder).toHaveBeenCalledExactlyOnceWith({ eventId: "event-1", enabled: false })
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith(t("associationActivities.event.reminderSaved"))
  })

  it("garde la préférence lue si le serveur refuse une activation devenue trop tardive", async () => {
    mocks.event = { status: "ready", data: WAITLISTED }
    mocks.eventSetReminder.mockResolvedValueOnce({ ok: false, code: "association_event_reminder_too_late" })
    render(detailTree())
    await act(async () => { fireEvent.click(screen.getByRole("checkbox", { name: t("associationActivities.event.reminderChoice") })) })
    expect(screen.getByRole("alert")).toHaveTextContent(t("errors.association_event_reminder_too_late"))
    expect(screen.getByRole("checkbox", { name: t("associationActivities.event.reminderChoice") })).not.toBeChecked()
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it("ignore une préférence tardive de l'ancien compte sans modifier celle de la nouvelle personne", async () => {
    const pending = pendingPublication()
    mocks.event = { status: "ready", data: WAITLISTED }
    mocks.eventSetReminder.mockReturnValueOnce(pending.promise)
    const view = render(detailTree())
    await act(async () => { fireEvent.click(screen.getByRole("checkbox", { name: t("associationActivities.event.reminderChoice") })) })
    mocks.session = signedIn({ ...MEMBER, personId: "person-autre", handle: "autre", displayName: "Jean MBA" })
    mocks.event = { status: "ready", data: { ...WAITLISTED, reminderEnabled: true, reminderState: "waiting_confirmation" } }
    view.rerender(detailTree())
    await act(async () => { pending.finish({ ok: true, value: null }); await pending.promise })
    expect(screen.getByRole("checkbox", { name: t("associationActivities.event.reminderChoice") })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: t("associationActivities.event.reminderChoice") })).toBeEnabled()
    expect(screen.getByText(t("associationActivities.event.reminderWaiting"))).toBeVisible()
    expect(mocks.eventSetReminder).toHaveBeenCalledExactlyOnceWith({ eventId: "event-1", enabled: true })
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })
})
