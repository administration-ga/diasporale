// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import {
  contentReportKey,
  DataSourceProvider,
  type ActionResult,
  type AssociationActivityPage,
  type AssociationGroupPostView,
  type AssociationGroupView,
  type AssociationGroupsCapability,
  type ContentReportInput,
  type ContentReportsCapability,
  type ContentReportTarget,
  type DiasporaleDataSource,
  type Loadable,
  type MembershipView,
  type SessionView,
} from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useSyncExternalStore, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AssociationGroupContent } from "./association-group"

/**
 * MD-02 — le geste « Signaler » posé dans les surfaces des associations : publications
 * du mur d'un groupe (AS-02). Offert sur le contenu d'autrui, jamais sur le sien ni
 * par qui anime l'espace ; signalé, le contenu se masque aussitôt pour la personne.
 * Données fictives.
 */
const mocks = vi.hoisted(() => ({
  groups: null as AssociationGroupsCapability | null,
  session: { status: "loading" } as Loadable<SessionView>,
  posts: { status: "loading" } as Loadable<AssociationActivityPage<AssociationGroupPostView>>,
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}))

vi.mock("@diasporale/features/data", async (original) => ({
  ...await original<typeof import("@diasporale/features/data")>(),
  useAssociationGroups: () => mocks.groups,
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
  const source = { kind: "engine", ...(capability === null ? {} : { contentReports: capability }) } as unknown as DiasporaleDataSource
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
})
afterEach(cleanup)

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
