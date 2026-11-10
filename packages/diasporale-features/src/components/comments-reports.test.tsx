// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useSyncExternalStore, type ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { contentReportKey, type ContentReportInput, type ContentReportsCapability, type ContentReportTarget } from "../data/content-reports-port"
import type { ActionResult, DiasporaleActions } from "../data/port"
import type { CommentPageQuery, CommentThreadView, CommentView, Loadable } from "../data/types"
import { getFixedT } from "../i18n"
import { RoutingProvider, type FeatureRoutes } from "../routing"
import { renderWithI18n } from "../test-utils"
import { PostCommentsSheet } from "./comments"

/**
 * FD-05 — signaler un commentaire : le geste est offert sur le commentaire d'autrui
 * (racine ou réponse), jamais sur le sien ; envoyé, le commentaire se masque aussitôt
 * pour la personne qui l'a signalé, les autres restent. Sans capacité, aucun geste.
 * Données fictives.
 */
const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error, info: mocks.info } }))

type SessionProbe = { status: "signed_in"; account: { id: string }; membership: { personId: string; handle: string; displayName: string; status: "declaree"; canPublish: boolean } }
let source: { kind: "engine"; actions: Pick<DiasporaleActions, "editComment" | "removeComment" | "comment">; contentReports?: ContentReportsCapability }
let session: Loadable<SessionProbe>
let threads: CommentPageQuery<CommentThreadView>
const LOADING_PAGE = { data: undefined, isLoading: true, error: null, retry: () => undefined } as const

vi.mock("../data/context", () => ({
  useDataSource: () => source,
  useSession: () => session,
  useActions: () => source.actions,
  useCommentsPage: (args: { readonly cursor: string | null }) => (args.cursor === null || args.cursor === "" ? threads : LOADING_PAGE),
  useRepliesPage: () => LOADING_PAGE,
}))

const t = getFixedT("fr")
const plain = (value: string) => value.replace(/\s+/g, " ").trim()
const routes: FeatureRoutes = {
  profile: (handle: string) => `/@${handle}`, post: (id) => `/publication/${id}`, page: (handle) => `/pages/${handle}`,
  hub: (country) => `/pays/${country}`, feed: () => "/fil", sponsor: () => "/parrainer",
  settings: () => "/parametres", attestation: () => "/attestation", enter: () => "/entrer",
}
function Link({ children, ...props }: ComponentProps<"a">) { return <a {...props}>{children}</a> }

const NOW = Date.UTC(2026, 10, 10, 12)
const OTHER = { personId: "person-b", handle: "membre.b", displayName: "Boris NZÉ" }
const ME = { personId: "person-a", handle: "membre.a", displayName: "Awa OGOOUÉ" }
const REPLY: CommentView = { id: "comment-reply", author: OTHER, body: "Réponse fictive d'autrui", createdAt: NOW, edited: false, isMine: false }
const MINE: CommentThreadView = { id: "comment-mine", author: ME, body: "Mon commentaire fictif", createdAt: NOW, edited: false, isMine: true, replyCount: 0, replies: [] }
const THEIRS: CommentThreadView = { id: "comment-theirs", author: OTHER, body: "Commentaire fictif d'autrui", createdAt: NOW, edited: false, isMine: false, replyCount: 1, replies: [REPLY] }

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

function mount(props: { postIsMine?: boolean } = {}) {
  return renderWithI18n(
    <RoutingProvider routes={routes} Link={Link}>
      <PostCommentsSheet postId="post-a" postIsMine={props.postIsMine ?? false} canComment open onOpenChange={() => undefined} />
    </RoutingProvider>,
  )
}
const row = (body: string) => screen.getByText(body).closest("article")!

beforeEach(() => {
  vi.clearAllMocks()
  // Les motifs sont des boutons radio de Radix, qui mesurent leur taille.
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  const resolved = { ok: true as const, value: null }
  source = { kind: "engine", actions: { editComment: vi.fn(async () => resolved), removeComment: vi.fn(async () => resolved), comment: vi.fn(async () => ({ ok: true as const, value: { commentId: "comment-new" } })) } }
  session = { status: "ready", data: { status: "signed_in", account: { id: "account-a" }, membership: { ...ME, status: "declaree", canPublish: true } } }
  threads = { data: { items: [MINE, THEIRS], continueCursor: "", isDone: true }, isLoading: false, error: null, retry: vi.fn() }
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("FD-05 — signaler un commentaire", () => {
  it("offert sur le commentaire et la réponse d'autrui, jamais sur le sien", async () => {
    source.contentReports = fakeReports().capability
    mount()
    expect(await screen.findByText(THEIRS.body)).toBeInTheDocument()
    expect(within(row(THEIRS.body)).getByRole("button", { name: t("contentReports.action.comment") })).toBeInTheDocument()
    expect(within(row(REPLY.body)).getByRole("button", { name: t("contentReports.action.comment") })).toBeInTheDocument()
    expect(within(row(MINE.body)).queryByRole("button", { name: t("contentReports.action.comment") })).not.toBeInTheDocument()
  })

  it("sous sa propre publication, le signalement reste offert à côté de « Retirer » sur le commentaire d'autrui", async () => {
    source.contentReports = fakeReports().capability
    mount({ postIsMine: true })
    await screen.findByText(THEIRS.body)
    const theirs = row(THEIRS.body)
    expect(within(theirs).getByRole("button", { name: t("comments.remove") })).toBeInTheDocument()
    expect(within(theirs).getByRole("button", { name: t("contentReports.action.comment") })).toBeInTheDocument()
  })

  it("envoyé : la nature « commentaire » part, le commentaire se masque pour soi, les autres restent", async () => {
    const user = userEvent.setup()
    const { capability, report } = fakeReports()
    source.contentReports = capability
    mount()
    await screen.findByText(REPLY.body)
    await user.click(within(row(REPLY.body)).getByRole("button", { name: t("contentReports.action.comment") }))
    const dialog = await screen.findByRole("dialog", { name: t("contentReports.title.comment") })
    await user.click(within(dialog).getByRole("radio", { name: t("report.reason.harassment") }))
    await user.click(within(dialog).getByRole("button", { name: t("contentReports.confirm") }))

    await waitFor(() => expect(report).toHaveBeenCalledExactlyOnceWith({ kind: "comment", id: REPLY.id, reason: "harassment" }))
    await waitFor(() => expect(screen.queryByText(REPLY.body)).not.toBeInTheDocument())
    expect(screen.getByRole("note")).toHaveTextContent(plain(t("contentReports.masked.title")))
    expect(screen.getByText(THEIRS.body)).toBeInTheDocument()
    expect(screen.getByText(MINE.body)).toBeInTheDocument()
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith(t("contentReports.sent"))
  })

  it("sans capacité de signalement chez le fournisseur : aucun geste, rien de masqué", async () => {
    mount()
    expect(await screen.findByText(THEIRS.body)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("contentReports.action.comment") })).not.toBeInTheDocument()
  })
})
