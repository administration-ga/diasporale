// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import { DataSourceProvider, type ActionResult, type AssociationActivityPage, type AssociationEventGalleryCapability, type AssociationEventGalleryItem, type AssociationEventGalleryState, type AssociationEventsCapability, type AssociationEventView, type DiasporaleDataSource, type Loadable, type MembershipView, type PostView, type SessionView } from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AssociationEventGallery } from "./association-event-gallery"
import { AssociationEventsSection } from "./association-events"

const mocks = vi.hoisted(() => ({
  session: { status: "loading" } as Loadable<SessionView>,
  state: { status: "loading" } as Loadable<AssociationEventGalleryState | null>,
  items: { status: "loading" } as Loadable<AssociationActivityPage<AssociationEventGalleryItem>>,
  events: null as AssociationEventsCapability | null,
  read: vi.fn<AssociationEventGalleryCapability["useGallery"]>(),
  readItems: vi.fn<AssociationEventGalleryCapability["useItems"]>(),
  publish: vi.fn<AssociationEventGalleryCapability["publish"]>(),
  remove: vi.fn<AssociationEventGalleryCapability["remove"]>(),
  upload: vi.fn<DiasporaleDataSource["actions"]["uploadMedia"]>(),
  ordinaryPublish: vi.fn<DiasporaleDataSource["actions"]["publish"]>(),
  success: vi.fn(), error: vi.fn(),
}))
vi.mock("@diasporale/features/data", async (original) => ({
  ...await original<typeof import("@diasporale/features/data")>(), useSession: () => mocks.session, useAssociationEvents: () => mocks.events,
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

const t = getFixedT("fr")
const NOW = Date.UTC(2026, 9, 26, 20)
const MEMBER: MembershipView = {
  personId: "person-awa", handle: "awa", displayName: "Awa OGOOUÉ", status: "declaree", badges: [],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY }, joinedAt: 1, verifiedSince: null, sponsoredBy: null,
  attestation: { outcome: "none", postSlug: null, requestedAt: null }, root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: true, rateTier: "standard", directoryVisibility: "hidden",
}
const EVENT: AssociationEventView = {
  eventId: "event-1", pageId: "page-1", title: "Rencontre culturelle", description: "La rencontre de recette.", location: "Salle associative", startAt: NOW - 7_200_000, endAt: NOW,
  timeZone: "Europe/Paris", audience: "association", status: "scheduled", version: 3, organizer: { name: "Association de recette", handle: "association-recette" }, moderation: "published",
  isRegistered: false, canManage: true, canRegister: false, capacity: null, confirmedCount: 4, waitlistCount: 0, remainingPlaces: null, registration: "none", waitlistPosition: null,
  registrationClosesAt: null, registrationOpen: false, reminderEnabled: false, reminderAt: null, reminderState: "off",
}
const STATE: AssociationEventGalleryState = { eventId: EVENT.eventId, available: true, canPublish: true, audience: "association" }
const POST: PostView = {
  id: "gallery-post-1", eventGalleryId: EVENT.eventId, author: { kind: "page", id: EVENT.pageId, handle: EVENT.organizer.handle, displayName: EVENT.organizer.name, badges: [] }, body: "La rencontre en images.",
  media: [{ kind: "image", url: "/recette-gallery-1.png", withheld: null, altText: "La salle de la rencontre", width: 800, height: 600 }],
  share: null, shareCount: 0, scope: { reach: "diaspora" }, audience: "public", visibility: "network", moderation: "published", createdAt: NOW,
  reactionCount: 0, commentCount: 0, myReaction: null, isMine: false, bookmarked: false, edited: false,
}
const CAPABILITY: AssociationEventGalleryCapability = { mode: "engine", useGallery: mocks.read, useItems: mocks.readItems, publish: mocks.publish, remove: mocks.remove }
const SOURCE = { kind: "engine", useSession: () => mocks.session, actions: { uploadMedia: mocks.upload, publish: mocks.ordinaryPublish } } as unknown as DiasporaleDataSource
function signedIn(member = MEMBER): Loadable<SessionView> {
  return { status: "ready", data: { status: "signed_in", account: { id: member.personId, idn: null, local: null, nameHints: {} }, membership: member } }
}
function tree(event = EVENT, capability = CAPABILITY) {
  return <I18nProvider locale="fr"><DataSourceProvider source={SOURCE}><AssociationEventGallery event={event} capability={capability} /></DataSourceProvider></I18nProvider>
}
function deferred<T>() {
  let finish: (value: T) => void = () => {}
  const promise = new Promise<T>((resolve) => { finish = resolve })
  return { promise, finish }
}
function openComposer() { fireEvent.click(screen.getByRole("button", { name: t("eventGallery.add") })) }
function body(value: string) { fireEvent.change(screen.getByRole("textbox", { name: t("composer.bodyLabel") }), { target: { value } }) }
async function attachPhoto() {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error("Sélecteur de fixture absent")
  await act(async () => { fireEvent.change(input, { target: { files: [new File(["photo"], "rencontre.png", { type: "image/png" })] } }) })
}
async function publish() {
  const form = screen.getByRole("button", { name: t("composer.publish") }).closest("form")
  if (!form) throw new Error("Formulaire de fixture absent")
  await act(async () => { fireEvent.submit(form) })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval", "setTimeout", "clearTimeout"] })
  vi.setSystemTime(NOW)
  vi.clearAllMocks()
  window.localStorage.clear()
  mocks.session = signedIn()
  mocks.state = { status: "ready", data: STATE }
  mocks.items = { status: "ready", data: { items: [{ post: POST, canRemove: true }], continueCursor: null, isDone: true } }
  mocks.read.mockReset().mockImplementation(() => mocks.state)
  mocks.readItems.mockReset().mockImplementation(() => mocks.items)
  mocks.publish.mockReset().mockResolvedValue({ ok: true, value: { postId: "gallery-created", created: true } })
  mocks.remove.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.upload.mockReset().mockImplementation(async (file) => ({ ok: true, value: { ref: "stored-gallery-photo", kind: "image", mimeType: file.type, sizeBytes: file.size } }))
  const page: Loadable<AssociationActivityPage<AssociationEventView>> = { status: "ready", data: { items: [EVENT], continueCursor: null, isDone: true } }
  mocks.events = { gallery: CAPABILITY, useEvents: () => page, useEvent: () => ({ status: "ready", data: EVENT }), create: async () => ({ ok: true, value: { eventId: EVENT.eventId, created: true } }), update: async () => ({ ok: true, value: null }), cancel: async () => ({ ok: true, value: null }), register: async () => ({ ok: true, value: null }), unregister: async () => ({ ok: true, value: null }), setReminder: async () => ({ ok: true, value: null }) }
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal("URL", class extends URL { static override createObjectURL = vi.fn(() => "blob:gallery-preview"); static override revokeObjectURL = vi.fn() })
})
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); window.localStorage.clear() })

describe("DG-023 — ouverture et lecture vivantes de la galerie", () => {
  it("ne lit pas de galerie sur les cartes de liste", () => {
    render(<I18nProvider locale="fr"><DataSourceProvider source={SOURCE}><AssociationEventsSection pageId={EVENT.pageId} handle={EVENT.organizer.handle} canManage /></DataSourceProvider></I18nProvider>)
    expect(mocks.read).not.toHaveBeenCalled()
    expect(mocks.readItems).not.toHaveBeenCalled()
  })

  it("franchit la fin une fois, attend le serveur puis offre une actualisation explicite", async () => {
    const event: AssociationEventView = { ...EVENT, endAt: NOW + 1_000 }
    mocks.state = { status: "ready", data: { ...STATE, available: false } }
    const view = render(tree(event))
    expect(mocks.read).toHaveBeenLastCalledWith(EVENT.eventId, 0)
    expect(mocks.readItems).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: t("eventGallery.refresh") })).not.toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(1_000) })
    expect(mocks.read).toHaveBeenLastCalledWith(EVENT.eventId, 1)
    expect(screen.getByText(t("eventGallery.awaitingServer"))).toBeVisible()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: t("eventGallery.refresh") }))
    expect(mocks.read).toHaveBeenLastCalledWith(EVENT.eventId, 3)
    await act(async () => { vi.advanceTimersByTime(2_000) })
    expect(mocks.read).toHaveBeenLastCalledWith(EVENT.eventId, 3)
    expect(mocks.readItems).not.toHaveBeenCalled()
    mocks.state = { status: "ready", data: STATE }
    view.rerender(tree(event))
    expect(screen.getByRole("img", { name: POST.media[0]!.altText! })).toBeVisible()
  })

  it.each([{ status: "cancelled" as const }, { moderation: "pending_review" as const }])("ferme images et composeur malgré une projection disponible : %o", (closed) => {
    render(tree({ ...EVENT, ...closed }))
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("eventGallery.add") })).not.toBeInTheDocument()
    expect(mocks.readItems).not.toHaveBeenCalled()
  })

  it("autorise une lecture en attente sans geste de responsable et étiquette la démo", () => {
    mocks.session = signedIn({ ...MEMBER, status: "en_attente", canPublish: false })
    render(tree(EVENT, { ...CAPABILITY, mode: "demonstration" }))
    expect(screen.getByRole("img", { name: POST.media[0]!.altText! })).toBeVisible()
    expect(screen.getByText(t("eventGallery.demo"), { normalizer: (text) => text })).toBeVisible()
    expect(screen.queryByRole("button", { name: t("eventGallery.add") })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("eventGallery.remove") })).not.toBeInTheDocument()
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it.each([false, true])("ne monte pas le composeur sans les deux droits serveur et événement : %s", (canManage) => {
    mocks.state = { status: "ready", data: { ...STATE, canPublish: !canManage } }
    render(tree({ ...EVENT, canManage }))
    expect(screen.getByRole("img", { name: POST.media[0]!.altText! })).toBeVisible()
    expect(screen.queryByRole("button", { name: t("eventGallery.add") })).not.toBeInTheDocument()
  })

  it("ferme la visionneuse sur toute erreur et garde les anciens médias absents pendant Réessayer/loading", async () => {
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: t("post.media.openImage", { position: 1, total: 1 }) }))
    expect(screen.getByRole("dialog", { name: t("post.media.viewer.title") })).toBeVisible()
    mocks.items = { status: "error", code: "unknown" }
    view.rerender(tree())
    expect(screen.queryByRole("dialog", { name: t("post.media.viewer.title") })).not.toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    mocks.items = { status: "loading" }
    view.rerender(tree())
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: t("services.results.retry") }))
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.queryByText(POST.body)).not.toBeInTheDocument()
    mocks.items = { status: "ready", data: { items: [], continueCursor: null, isDone: true } }
    view.rerender(tree())
    expect(screen.getByText(t("eventGallery.empty"))).toBeVisible()
    await act(async () => { vi.advanceTimersByTime(1_000) })
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("ne présente que published et retire toute lecture quand l'accès devient nul", () => {
    mocks.items = { status: "ready", data: { items: [{ post: { ...POST, moderation: "pending_review" }, canRemove: true }, { post: { ...POST, id: "rejected", moderation: "rejected" }, canRemove: false }], continueCursor: null, isDone: true } }
    const view = render(tree())
    expect(screen.queryByText(POST.body)).not.toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    mocks.state = { status: "ready", data: null }
    view.rerender(tree())
    expect(screen.queryByRole("button", { name: t("eventGallery.add") })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: t("eventGallery.title") })).not.toBeInTheDocument()
  })
})

describe("DG-023 — publication et retrait collectifs de galerie", () => {
  it("impose un média et la portée événement, puis garde le brouillon et l'idempotence après refus", async () => {
    mocks.publish.mockResolvedValueOnce({ ok: false, code: "association_event_gallery_not_open" })
    render(tree())
    openComposer()
    body("Légende de mon ajout")
    const dialog = screen.getByRole("dialog", { name: t("pagePublications.composeTitle") })
    expect(dialog).toHaveAccessibleDescription(/Rencontre culturelle/)
    expect(within(dialog).getByText(t("eventGallery.associationAudience"))).toBeVisible()
    expect(within(dialog).queryByRole("radiogroup")).not.toBeInTheDocument()
    expect(within(dialog).queryByRole("checkbox", { name: t("composer.alsoOnRoot") })).not.toBeInTheDocument()
    await publish()
    expect(screen.getByRole("alert")).toHaveTextContent(t("errors.association_event_gallery_media_required"))
    expect(mocks.publish).not.toHaveBeenCalled()
    await attachPhoto()
    fireEvent.change(screen.getByRole("textbox", { name: t("composer.mediaAltLabel") }), { target: { value: "La rencontre en salle" } })
    await publish()
    expect(screen.getByRole("textbox", { name: t("composer.bodyLabel") })).toHaveValue("Légende de mon ajout")
    expect(mocks.error).toHaveBeenCalledWith(t("errors.association_event_gallery_not_open"))
    await publish()
    expect(mocks.publish).toHaveBeenCalledTimes(2)
    expect(mocks.publish.mock.calls[0]?.[0]).toEqual({ eventId: EVENT.eventId, body: "Légende de mon ajout", media: [{ upload: { ref: "stored-gallery-photo", kind: "image", mimeType: "image/png", sizeBytes: 5 }, altText: "La rencontre en salle" }], idempotencyKey: expect.any(String) })
    expect(mocks.publish.mock.calls[1]?.[0]).toEqual(mocks.publish.mock.calls[0]?.[0])
    expect(mocks.ordinaryPublish).not.toHaveBeenCalled()
    expect(mocks.upload).toHaveBeenCalledOnce()
  })

  it("ignore le succès après fermeture du composeur sans fermer ni effacer le nouveau brouillon", async () => {
    const pending = deferred<ActionResult<{ readonly postId: string; readonly created: boolean }>>()
    mocks.publish.mockReturnValueOnce(pending.promise)
    render(tree())
    openComposer()
    body("Premier brouillon")
    await act(async () => { vi.advanceTimersByTime(400) })
    await attachPhoto()
    await publish()
    const dialog = screen.getByRole("dialog", { name: t("pagePublications.composeTitle") })
    fireEvent.click(within(dialog).getByRole("button", { name: t("common.close") }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    openComposer()
    body("Nouveau brouillon à conserver")
    await act(async () => { vi.advanceTimersByTime(400) })
    await act(async () => { pending.finish({ ok: true, value: { postId: "old-created", created: true } }); await pending.promise })
    expect(screen.getByRole("textbox", { name: t("composer.bodyLabel") })).toHaveValue("Nouveau brouillon à conserver")
    expect(JSON.parse(window.localStorage.getItem(`diasporale:event-gallery:${MEMBER.personId}:${EVENT.pageId}:${EVENT.eventId}`) ?? "null").body).toBe("Nouveau brouillon à conserver")
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it("confirme le retrait depuis la légende vivante et conserve le dialogue sur refus", async () => {
    mocks.remove.mockResolvedValueOnce({ ok: false, code: "association_event_access_required" })
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: t("eventGallery.remove") }))
    expect(mocks.remove).not.toHaveBeenCalled()
    mocks.items = { status: "ready", data: { items: [{ post: { ...POST, body: "Légende actuelle relue" }, canRemove: true }], continueCursor: null, isDone: true } }
    view.rerender(tree())
    const dialog = screen.getByRole("dialog", { name: t("eventGallery.removeTitle") })
    expect(dialog).toHaveTextContent("Légende actuelle relue")
    expect(dialog).not.toHaveTextContent(POST.body)
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: t("eventGallery.confirmRemove") })) })
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({ eventId: EVENT.eventId, postId: POST.id })
    expect(within(dialog).getByRole("alert")).toHaveTextContent(t("errors.association_event_access_required"))
    mocks.items = { status: "ready", data: { items: [], continueCursor: null, isDone: true } }
    view.rerender(tree())
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it("ignore un retrait tardif après changement de lecteur et ferme l'ancien média", async () => {
    const pending = deferred<ActionResult>()
    mocks.remove.mockReturnValueOnce(pending.promise)
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: t("eventGallery.remove") }))
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("eventGallery.confirmRemove") })) })
    mocks.session = signedIn({ ...MEMBER, personId: "person-autre", handle: "autre", displayName: "Jean MBA" })
    mocks.items = { status: "ready", data: { items: [], continueCursor: null, isDone: true } }
    view.rerender(tree())
    await act(async () => { pending.finish({ ok: true, value: null }); await pending.promise })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it("sépare les brouillons par événement et par personne", async () => {
    const view = render(tree())
    openComposer(); body("Brouillon du premier événement")
    await act(async () => { vi.advanceTimersByTime(400) })
    mocks.state = { status: "ready", data: { ...STATE, eventId: "event-2" } }
    view.rerender(tree({ ...EVENT, eventId: "event-2" }))
    openComposer()
    expect(screen.getByRole("textbox", { name: t("composer.bodyLabel") })).toHaveValue("")
    body("Brouillon du second événement")
    await act(async () => { vi.advanceTimersByTime(400) })
    mocks.session = signedIn({ ...MEMBER, personId: "person-autre", handle: "autre", displayName: "Jean MBA" })
    view.rerender(tree({ ...EVENT, eventId: "event-2" }))
    openComposer()
    expect(screen.getByRole("textbox", { name: t("composer.bodyLabel") })).toHaveValue("")
    mocks.session = signedIn()
    mocks.state = { status: "ready", data: STATE }
    view.rerender(tree())
    openComposer()
    expect(screen.getByRole("textbox", { name: t("composer.bodyLabel") })).toHaveValue("Brouillon du premier événement")
  })
})
