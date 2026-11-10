// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import {
  contentReportKey,
  DataSourceProvider,
  type ActionResult,
  type AssociationActivityPage,
  type AssociationEventGalleryCapability,
  type AssociationEventGalleryItem,
  type AssociationEventGalleryState,
  type AssociationEventsCapability,
  type AssociationEventView,
  type AssociationGroupPostView,
  type AssociationGroupView,
  type AssociationGroupsCapability,
  type ContentReportInput,
  type ContentReportsCapability,
  type ContentReportTarget,
  type DiasporaleDataSource,
  type Loadable,
  type MembershipView,
  type PostView,
  type SessionView,
} from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useSyncExternalStore, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { routes } from "@/lib/routes"

import { AssociationEventGallery } from "./association-event-gallery"
import { AssociationEventDetail, AssociationEventsSection } from "./association-events"
import { AssociationGroupContent } from "./association-group"

/**
 * MD-02 — le geste « Signaler » posé dans les surfaces des associations : publications
 * du mur d'un groupe (AS-02), évènement et ajout de sa galerie (EV-04). Offert sur le
 * contenu d'autrui, jamais sur le sien ni par qui anime l'espace ; signalé, le contenu
 * se masque aussitôt pour la personne. Données fictives.
 */
const mocks = vi.hoisted(() => ({
  groups: null as AssociationGroupsCapability | null,
  events: null as AssociationEventsCapability | null,
  session: { status: "loading" } as Loadable<SessionView>,
  posts: { status: "loading" } as Loadable<AssociationActivityPage<AssociationGroupPostView>>,
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}))

vi.mock("@diasporale/features/data", async (original) => ({
  ...await original<typeof import("@diasporale/features/data")>(),
  useAssociationGroups: () => mocks.groups,
  useAssociationEvents: () => mocks.events,
  useSession: () => mocks.session,
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error, info: mocks.info } }))

const t = getFixedT("fr")
/** Le texte tel que l'écran le lit (espaces insécables ramenées à l'espace simple). */
const plain = (value: string) => value.replace(/\s+/g, " ").trim()
const NOW = Date.UTC(2026, 10, 10, 10)
const MEMBER: MembershipView = {
  personId: "person-awa", handle: "awa", displayName: "Awa OGOOUÉ", status: "declaree", badges: ["verified"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: null, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: true, rateTier: "standard", directoryVisibility: "hidden",
}

/** Une capacité factice : sa mémoire des cibles signalées relance le rendu, comme les vrais fournisseurs. */
function fakeReports() {
  const reported = new Set<string>()
  const listeners = new Set<() => void>()
  let version = 0
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  const getVersion = () => version
  const report = vi.fn(async (input: ContentReportInput): Promise<ActionResult<{ readonly created: boolean }>> => {
    reported.add(contentReportKey(input))
    version += 1
    for (const listener of listeners) listener()
    return { ok: true, value: { created: true } }
  })
  function useReported(target: ContentReportTarget): boolean {
    useSyncExternalStore(subscribe, getVersion, getVersion)
    return reported.has(contentReportKey(target))
  }
  const capability: ContentReportsCapability = { demonstration: false, report, useReported }
  return { capability, report }
}

function mount(capability: ContentReportsCapability | null, node: ReactNode) {
  // La grille des médias relit la session par le fournisseur.
  const source = { kind: "engine", useSession: () => mocks.session, ...(capability === null ? {} : { contentReports: capability }) } as unknown as DiasporaleDataSource
  return render(<I18nProvider locale="fr"><DataSourceProvider source={source}>{node}</DataSourceProvider></I18nProvider>)
}

/** Ouvrir la feuille d'une nature depuis une zone, choisir un motif, confirmer. */
async function reportFrom(user: ReturnType<typeof userEvent.setup>, zone: HTMLElement, kind: ContentReportTarget["kind"]) {
  await user.click(within(zone).getByRole("button", { name: t(`contentReports.action.${kind}`) }))
  const dialog = await screen.findByRole("dialog", { name: t(`contentReports.title.${kind}`) })
  await user.click(within(dialog).getByRole("radio", { name: t("report.reason.harassment") }))
  await user.click(within(dialog).getByRole("button", { name: t("contentReports.confirm") }))
}

function signedIn(membership: MembershipView = MEMBER): Loadable<SessionView> {
  return { status: "ready", data: { status: "signed_in", account: { id: "account-1", idn: null, local: null, nameHints: {} }, membership } }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.session = signedIn()
  // Les motifs sont des boutons radio de Radix, qui mesurent leur taille.
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ── AS-02 : les publications du mur d'un groupe d'association ─────────────

const GROUP: AssociationGroupView = {
  groupId: "group-1", pageId: "page-1", name: "Groupe privé de recette", state: "active", role: "member",
  isMember: true, canJoin: false, canManage: false, canPublish: true,
}
const THEIRS: AssociationGroupPostView = {
  postId: "post-theirs", body: "Un échange fictif d'un autre membre.", author: { displayName: "Éloïse NDONG MBA" },
  createdAt: NOW, isMine: false, canRemove: false, moderation: "published",
}
const MINE: AssociationGroupPostView = { ...THEIRS, postId: "post-mine", body: "Ma publication fictive.", author: { displayName: MEMBER.displayName }, isMine: true, canRemove: true }
const MODERATED: AssociationGroupPostView = { ...THEIRS, postId: "post-moderated", body: "Une publication fictive que l'animateur peut retirer.", canRemove: true }

function groups(posts: readonly AssociationGroupPostView[]): AssociationGroupsCapability {
  const page: Loadable<AssociationActivityPage<AssociationGroupPostView>> = { status: "ready", data: { items: posts, continueCursor: null, isDone: true } }
  mocks.posts = page
  const group: Loadable<AssociationGroupView | null> = { status: "ready", data: GROUP }
  const ok = async () => ({ ok: true as const, value: null })
  return {
    useGroup: () => group, usePosts: () => mocks.posts, create: async () => ({ ok: true, value: { groupId: GROUP.groupId, created: true } }),
    join: ok, leave: ok, close: ok, publish: async () => ({ ok: true, value: { postId: "post-new", created: true } }), removePost: ok,
  } as unknown as AssociationGroupsCapability
}
const card = (body: string) => screen.getByText(body).closest("li")!

describe("AS-02 — signaler une publication du mur d'un groupe", () => {
  it("offert sur la publication d'autrui ; jamais sur la sienne, ni par qui peut la retirer", () => {
    mocks.groups = groups([THEIRS, MINE, MODERATED])
    mount(fakeReports().capability, <AssociationGroupContent pageId="page-1" />)
    expect(within(card(THEIRS.body)).getByRole("button", { name: t("contentReports.action.post") })).toBeInTheDocument()
    expect(within(card(MINE.body)).queryByRole("button", { name: t("contentReports.action.post") })).not.toBeInTheDocument()
    expect(within(card(MODERATED.body)).queryByRole("button", { name: t("contentReports.action.post") })).not.toBeInTheDocument()
    expect(within(card(MODERATED.body)).getByRole("button", { name: t("associationActivities.group.removePost") })).toBeInTheDocument()
  })

  it("envoyée avec la nature « post » ; la publication se masque pour soi, les autres restent", async () => {
    const user = userEvent.setup()
    const { capability, report } = fakeReports()
    mocks.groups = groups([THEIRS, MINE])
    mount(capability, <AssociationGroupContent pageId="page-1" />)
    await reportFrom(user, card(THEIRS.body), "post")

    await waitFor(() => expect(report).toHaveBeenCalledExactlyOnceWith({ kind: "post", id: THEIRS.postId, reason: "harassment" }))
    await waitFor(() => expect(screen.queryByText(THEIRS.body)).not.toBeInTheDocument())
    expect(screen.getByRole("note")).toHaveTextContent(plain(t("contentReports.masked.title")))
    expect(screen.getByText(MINE.body)).toBeInTheDocument()
  })

  it("sans capacité de signalement chez le fournisseur : le mur reste tel quel, sans geste", () => {
    mocks.groups = groups([THEIRS])
    mount(null, <AssociationGroupContent pageId="page-1" />)
    expect(screen.getByText(THEIRS.body)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("contentReports.action.post") })).not.toBeInTheDocument()
  })
})

// ── EV-04 : l'évènement d'association et les ajouts de sa galerie ────────────

/** Terminé il y a une heure : la galerie est ouverte (fin franchie), sans horloge simulée. */
const ENDED_AT = Date.now() - 60 * 60 * 1000
const EVENT: AssociationEventView = {
  eventId: "event-1", pageId: "page-1", title: "Rencontre culturelle fictive", description: "La rencontre de recette.", location: "Salle associative",
  startAt: ENDED_AT - 2 * 60 * 60 * 1000, endAt: ENDED_AT, timeZone: "Europe/Paris", audience: "network", status: "scheduled", version: 3,
  organizer: { name: "Association de recette", handle: "association-recette" }, moderation: "published", isRegistered: false, canManage: false, canRegister: false,
  capacity: null, confirmedCount: 4, waitlistCount: 0, remainingPlaces: null, registration: "none", waitlistPosition: null,
  registrationClosesAt: null, registrationOpen: false, reminderEnabled: false, reminderAt: null, reminderState: "off",
}
const STAFF_EVENT: AssociationEventView = { ...EVENT, canManage: true }

function events(list: readonly AssociationEventView[], detail: AssociationEventView = list[0] ?? EVENT): AssociationEventsCapability {
  const page: Loadable<AssociationActivityPage<AssociationEventView>> = { status: "ready", data: { items: list, continueCursor: null, isDone: true } }
  const one: Loadable<AssociationEventView | null> = { status: "ready", data: detail }
  const ok = async () => ({ ok: true as const, value: null })
  return {
    useEvents: () => page, useEvent: () => one, create: async () => ({ ok: true, value: { eventId: EVENT.eventId, created: true } }),
    update: ok, cancel: ok, register: ok, unregister: ok, setReminder: ok,
  } as unknown as AssociationEventsCapability
}

describe("EV-04 — signaler un évènement d'association", () => {
  it("offert sur la carte et le détail d'un évènement publié ; jamais à l'équipe de la page", () => {
    const { capability } = fakeReports()
    mocks.events = events([EVENT])
    const list = mount(capability, <AssociationEventsSection pageId="page-1" handle="association-recette" canManage={false} />)
    expect(screen.getByRole("button", { name: t("contentReports.action.event") })).toBeInTheDocument()
    list.unmount()

    const detail = mount(capability, <AssociationEventDetail pageId="page-1" handle="association-recette" eventId="event-1" />)
    expect(screen.getByRole("heading", { level: 1, name: EVENT.title })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: t("contentReports.action.event") })).toBeInTheDocument()
    detail.unmount()

    mocks.events = events([STAFF_EVENT])
    const staff = mount(capability, <AssociationEventsSection pageId="page-1" handle="association-recette" canManage />)
    expect(screen.getByText(EVENT.title)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("contentReports.action.event") })).not.toBeInTheDocument()
    staff.unmount()

    mocks.events = events([{ ...EVENT, moderation: "pending_review" }])
    mount(capability, <AssociationEventsSection pageId="page-1" handle="association-recette" canManage={false} />)
    expect(screen.queryByRole("button", { name: t("contentReports.action.event") })).not.toBeInTheDocument()
  })

  it("envoyé avec la nature « event » ; au détail, l'évènement se masque pour soi, avec le retour à la page", async () => {
    const user = userEvent.setup()
    const { capability, report } = fakeReports()
    mocks.events = events([EVENT])
    mount(capability, <AssociationEventDetail pageId="page-1" handle="association-recette" eventId="event-1" />)
    await reportFrom(user, document.body, "event")

    await waitFor(() => expect(report).toHaveBeenCalledExactlyOnceWith({ kind: "event", id: EVENT.eventId, reason: "harassment" }))
    await waitFor(() => expect(screen.queryByRole("heading", { level: 1, name: EVENT.title })).not.toBeInTheDocument())
    const notice = screen.getByRole("note")
    expect(notice).toHaveTextContent(plain(t("contentReports.masked.title")))
    expect(within(notice).getByRole("link", { name: t("contentReports.back.page") })).toHaveAttribute("href", routes.page("association-recette"))
  })
})

const GALLERY_STATE: AssociationEventGalleryState = { eventId: EVENT.eventId, available: true, canPublish: false, audience: "network" }
const GALLERY_POST: PostView = {
  id: "gallery-post-1", eventGalleryId: EVENT.eventId, author: { kind: "page", id: EVENT.pageId, handle: EVENT.organizer.handle, displayName: EVENT.organizer.name, badges: [] },
  body: "La rencontre fictive en images.", media: [{ kind: "image", url: "/recette-gallery-1.png", withheld: null, altText: "La salle de la rencontre", width: 800, height: 600 }],
  share: null, shareCount: 0, scope: { reach: "diaspora" }, audience: "public", visibility: "network", moderation: "published", createdAt: ENDED_AT,
  reactionCount: 0, commentCount: 0, myReaction: null, isMine: false, bookmarked: false, edited: false,
}
const MY_GALLERY_POST: PostView = { ...GALLERY_POST, id: "gallery-post-mine", body: "Mon ajout fictif.", isMine: true }

function gallery(items: readonly AssociationEventGalleryItem[]): AssociationEventGalleryCapability {
  const state: Loadable<AssociationEventGalleryState | null> = { status: "ready", data: GALLERY_STATE }
  const page: Loadable<AssociationActivityPage<AssociationEventGalleryItem>> = { status: "ready", data: { items, continueCursor: null, isDone: true } }
  return {
    mode: "engine", useGallery: () => state, useItems: () => page,
    publish: async () => ({ ok: true, value: { postId: "gallery-new", created: true } }), remove: async () => ({ ok: true, value: null }),
  } as unknown as AssociationEventGalleryCapability
}
const galleryCard = (body: string) => screen.getByText(body).closest("li")!

describe("EV-04 — signaler un ajout de la galerie d'un évènement", () => {
  it("offert sur l'ajout d'autrui ; jamais sur le sien, ni à l'équipe de la page", () => {
    const { capability } = fakeReports()
    const items: AssociationEventGalleryItem[] = [{ post: GALLERY_POST, canRemove: false }, { post: MY_GALLERY_POST, canRemove: false }]
    const member = mount(capability, <AssociationEventGallery event={EVENT} capability={gallery(items)} />)
    expect(within(galleryCard(GALLERY_POST.body)).getByRole("button", { name: t("contentReports.action.post") })).toBeInTheDocument()
    expect(within(galleryCard(MY_GALLERY_POST.body)).queryByRole("button", { name: t("contentReports.action.post") })).not.toBeInTheDocument()
    member.unmount()

    mount(capability, <AssociationEventGallery event={STAFF_EVENT} capability={gallery([{ post: GALLERY_POST, canRemove: true }])} />)
    expect(screen.getByText(GALLERY_POST.body)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("contentReports.action.post") })).not.toBeInTheDocument()
  })

  it("envoyé avec la nature « post » ; l'ajout se masque pour soi, les autres restent", async () => {
    const user = userEvent.setup()
    const { capability, report } = fakeReports()
    const other: PostView = { ...GALLERY_POST, id: "gallery-post-2", body: "Un autre ajout fictif." }
    mount(capability, <AssociationEventGallery event={EVENT} capability={gallery([{ post: GALLERY_POST, canRemove: false }, { post: other, canRemove: false }])} />)
    await reportFrom(user, galleryCard(GALLERY_POST.body), "post")

    await waitFor(() => expect(report).toHaveBeenCalledExactlyOnceWith({ kind: "post", id: GALLERY_POST.id, reason: "harassment" }))
    await waitFor(() => expect(screen.queryByText(GALLERY_POST.body)).not.toBeInTheDocument())
    expect(screen.getByRole("note")).toHaveTextContent(plain(t("contentReports.masked.title")))
    expect(screen.getByText(other.body)).toBeInTheDocument()
  })
})
