// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { DiasporaleActions } from "../data/port"
import type { AccountView, CommentPageQuery, CommentsPageRequest, CommentThreadView, CommentView, Loadable, MembershipView, RepliesPageRequest } from "../data/types"
import { getFixedT } from "../i18n"
import { I18nProvider } from "../i18n/client"
import { RoutingProvider, type FeatureRoutes } from "../routing"
import { renderWithI18n } from "../test-utils"
import { PostCommentsSheet } from "./comments"

/**
 * FD-03 — lire tous les commentaires : au-delà de la première page, les suivants se lisent ;
 * la réponse au-delà de la cinquantième aussi ; une page en panne se reprend ; ce qu'on vient
 * d'envoyer paraît aussitôt, même hors des pages lues ; un autre lecteur repart de zéro.
 */
const mocks = vi.hoisted(() => ({
  edit: vi.fn<NonNullable<DiasporaleActions["editComment"]>>(),
  remove: vi.fn<DiasporaleActions["removeComment"]>(),
  comment: vi.fn<DiasporaleActions["comment"]>(),
  success: vi.fn(), error: vi.fn(),
}))

type SessionProbe = { status: "anonymous" } | {
  status: "signed_in"
  account: Pick<AccountView, "id">
  membership: Pick<MembershipView, "personId" | "handle" | "displayName" | "status" | "canPublish"> | null
}
let source: { kind: "engine" | "demo"; actions: Pick<DiasporaleActions, "editComment" | "removeComment" | "comment"> }
let session: Loadable<SessionProbe>
let commentPages: Record<string, CommentPageQuery<CommentThreadView>>
let replyPages: Record<string, CommentPageQuery<CommentView>>
const LOADING_PAGE = { data: undefined, isLoading: true, error: null, retry: () => undefined } as const
const requested: { comments: (string | null)[]; replies: string[] } = { comments: [], replies: [] }

vi.mock("../data/context", () => ({
  useDataSource: () => source,
  useSession: () => session,
  useActions: () => source.actions,
  useCommentsPage: (args: CommentsPageRequest) => {
    requested.comments.push(args.cursor ?? null)
    return commentPages[args.cursor ?? ""] ?? LOADING_PAGE
  },
  useRepliesPage: (args: RepliesPageRequest) => {
    requested.replies.push(`${args.commentId}|${args.cursor ?? ""}`)
    return replyPages[`${args.commentId}|${args.cursor ?? ""}`] ?? LOADING_PAGE
  },
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

const t = getFixedT("fr")
const NOW = Date.UTC(2026, 10, 10, 12)
const routes: FeatureRoutes = {
  profile: (handle) => `/@${handle}`, post: (id) => `/publication/${id}`, page: (handle) => `/pages/${handle}`,
  hub: (country) => `/pays/${country}`, feed: () => "/fil", sponsor: () => "/parrainer",
  settings: () => "/parametres", attestation: () => "/attestation", enter: () => "/entrer",
}
function Link({ children, ...props }: ComponentProps<"a">) { return <a {...props}>{children}</a> }
function signedIn(id = "person-a"): Loadable<SessionProbe> {
  const handle = id === "person-a" ? "membre.a" : "membre.b"
  const displayName = id === "person-a" ? "Membre A" : "Membre B"
  return { status: "ready", data: { status: "signed_in", account: { id }, membership: { personId: id, handle, displayName, status: "declaree", canPublish: true } } }
}
const other = { personId: "person-c", handle: "membre.c", displayName: "Membre C" }
function root(index: number, extra: Partial<CommentThreadView> = {}): CommentThreadView {
  return { id: `racine-${index}`, author: other, body: `Commentaire fictif ${index}`, createdAt: NOW - 100_000 + index, edited: false, isMine: false, replyCount: 0, replies: [], ...extra }
}
function reply(index: number): CommentView {
  return { id: `reponse-${index}`, author: other, body: `Réponse fictive ${index}`, createdAt: NOW - 50_000 + index, edited: false, isMine: false }
}
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, offset) => from + offset)
/** Une page lue, stable d'un rendu à l'autre. */
function page<Row>(items: readonly Row[], more: { readonly continueCursor?: string; readonly isDone?: boolean } = {}): CommentPageQuery<Row> {
  return { data: { items, continueCursor: more.continueCursor ?? "", isDone: more.isDone ?? true }, isLoading: false, error: null, retry: vi.fn() }
}
function failing<Row>(error: CommentPageQuery<Row>["error"]): CommentPageQuery<Row> {
  return { data: undefined, isLoading: false, error, retry: vi.fn() }
}
type SheetProps = ComponentProps<typeof PostCommentsSheet>
const defaults: SheetProps = { postId: "post-a", postIsMine: false, canComment: true, open: true, onOpenChange: vi.fn() }
function tree(props: Partial<SheetProps> = {}) {
  return <RoutingProvider routes={routes} Link={Link}><PostCommentsSheet {...defaults} {...props} /></RoutingProvider>
}
function mount(props: Partial<SheetProps> = {}, locale: "fr" | "en" = "fr") {
  const result = renderWithI18n(tree(props), locale)
  return { ...result, update: (next: Partial<SheetProps> = {}) => result.rerender(<I18nProvider locale={locale}>{tree({ ...props, ...next })}</I18nProvider>) }
}
async function send(text: string) {
  const field = screen.getByRole("textbox", { name: t("comments.label") })
  fireEvent.change(field, { target: { value: text } })
  fireEvent.submit(field.closest("form")!)
  await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(t("comments.sent")))
}

beforeEach(() => {
  vi.clearAllMocks()
  requested.comments = []
  requested.replies = []
  mocks.edit.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.remove.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.comment.mockReset().mockResolvedValue({ ok: true, value: { commentId: "comment-envoye" } })
  source = { kind: "engine", actions: { editComment: mocks.edit, removeComment: mocks.remove, comment: mocks.comment } }
  session = signedIn()
  commentPages = { "": page(range(1, 20).map((index) => root(index)), { continueCursor: "page-2", isDone: false }), "page-2": page([root(21)]) }
  replyPages = {}
})

describe("Commentaires — tous se lisent, page après page (FD-03)", () => {
  it("21 commentaires : le 21e se lit après « Voir les commentaires suivants », puis la suite s'arrête", async () => {
    mount()
    expect(screen.getByText("Commentaire fictif 20")).toBeInTheDocument()
    expect(screen.queryByText("Commentaire fictif 21")).toBeNull()
    expect(requested.comments).not.toContain("page-2")
    fireEvent.click(screen.getByRole("button", { name: t("comments.loadMore") }))
    expect(await screen.findByText("Commentaire fictif 21")).toBeInTheDocument()
    expect(requested.comments).toContain("page-2")
    expect(screen.getAllByText(/^Commentaire fictif \d+$/)).toHaveLength(21)
    expect(screen.queryByRole("button", { name: t("comments.loadMore") })).toBeNull()
  })

  it("51 réponses : l'aperçu, puis cinquante, puis la 51e par « Voir les réponses suivantes »", async () => {
    commentPages = { "": page([root(1, { replyCount: 51, replies: range(1, 3).map(reply) })]) }
    replyPages = {
      "racine-1|": page(range(1, 50).map(reply), { continueCursor: "reponses-2", isDone: false }),
      "racine-1|reponses-2": page([reply(51)]),
    }
    mount()
    expect(screen.getByText("Réponse fictive 3")).toBeInTheDocument()
    expect(screen.queryByText("Réponse fictive 4")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: t("comments.showReplies", { count: 48 }) }))
    expect(await screen.findByText("Réponse fictive 50")).toBeInTheDocument()
    expect(screen.queryByText("Réponse fictive 51")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: t("comments.moreReplies") }))
    expect(await screen.findByText("Réponse fictive 51")).toBeInTheDocument()
    expect(screen.getAllByText(/^Réponse fictive \d+$/)).toHaveLength(51)
    expect(screen.queryByRole("button", { name: t("comments.moreReplies") })).toBeNull()
  })

  it("une page en panne se dit, bloque la suite et se reprend ; les commentaires déjà lus restent", async () => {
    const broken = failing<CommentThreadView>("network_unavailable")
    commentPages = { ...commentPages, "page-2": broken }
    const view = mount()
    fireEvent.click(screen.getByRole("button", { name: t("comments.loadMore") }))
    expect(await screen.findByRole("alert")).toHaveTextContent(t("errors.network_unavailable"))
    expect(screen.getByText("Commentaire fictif 20")).toBeInTheDocument()
    // Rien ne se lit au-delà d'une page en panne : la reprise d'abord.
    expect(screen.queryByRole("button", { name: t("comments.loadMore") })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: t("comments.retry") }))
    await waitFor(() => expect(broken.retry).toHaveBeenCalledOnce())
    commentPages = { ...commentPages, "page-2": page([root(21)]) }
    view.update()
    expect(await screen.findByText("Commentaire fictif 21")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("la première page en panne se reprend aussi", async () => {
    const broken = failing<CommentThreadView>("unknown")
    commentPages = { "": broken }
    const view = mount()
    expect(await screen.findByRole("alert")).toHaveTextContent(t("errors.unknown"))
    fireEvent.click(screen.getByRole("button", { name: t("comments.retry") }))
    await waitFor(() => expect(broken.retry).toHaveBeenCalledOnce())
    commentPages = { "": page([root(1)]) }
    view.update()
    expect(await screen.findByText("Commentaire fictif 1")).toBeInTheDocument()
  })

  it("une page de réponses en panne se reprend", async () => {
    const broken = failing<CommentView>("network_unavailable")
    commentPages = { "": page([root(1, { replyCount: 5, replies: range(1, 3).map(reply) })]) }
    replyPages = { "racine-1|": broken }
    const view = mount()
    fireEvent.click(screen.getByRole("button", { name: t("comments.showReplies", { count: 2 }) }))
    expect(await screen.findByRole("alert")).toHaveTextContent(t("errors.network_unavailable"))
    // L'aperçu reste lisible pendant la panne.
    expect(screen.getByText("Réponse fictive 3")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: t("comments.retry") }))
    await waitFor(() => expect(broken.retry).toHaveBeenCalledOnce())
    replyPages = { "racine-1|": page(range(1, 5).map(reply)) }
    view.update()
    expect(await screen.findByText("Réponse fictive 5")).toBeInTheDocument()
  })

  it("un refus d'accès se dit tel quel, sans « Réessayer », et n'affiche plus rien de ce qui avait été lu", async () => {
    const view = mount()
    expect(screen.getByText("Commentaire fictif 1")).toBeInTheDocument()
    commentPages = { "": failing("not_found") }
    view.update()
    expect(await screen.findByRole("alert")).toHaveTextContent(t("errors.not_found"))
    expect(screen.queryByText("Commentaire fictif 1")).toBeNull()
    expect(screen.queryByRole("button", { name: t("comments.retry") })).toBeNull()
    expect(screen.queryByRole("button", { name: t("comments.loadMore") })).toBeNull()
  })
})

describe("Commentaires — ce qu'on vient d'envoyer paraît aussitôt (FD-03)", () => {
  it("le commentaire envoyé se lit tout de suite, après les pages non lues, puis une seule fois quand sa page arrive", async () => {
    commentPages = { ...commentPages, "page-2": page([root(21), { ...root(22), id: "comment-envoye", author: { personId: "person-a", handle: "membre.a", displayName: "Membre A" }, body: "Mon avis fictif", isMine: true }]) }
    mount()
    await send("  Mon avis fictif  ")
    expect(mocks.comment).toHaveBeenCalledWith({ postId: "post-a", body: "Mon avis fictif" })
    const mine = screen.getByText("Mon avis fictif").closest("article")!
    expect(within(mine).getByText("Membre A")).toBeInTheDocument()
    expect(within(mine).getByRole("button", { name: t("comments.edit") })).toBeInTheDocument()
    // Il suit la conversation : la suite non lue reste proposée avant lui.
    const loadMore = screen.getByRole("button", { name: t("comments.loadMore") })
    expect(loadMore.compareDocumentPosition(mine) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(loadMore)
    expect(await screen.findByText("Commentaire fictif 21")).toBeInTheDocument()
    expect(screen.getAllByText("Mon avis fictif")).toHaveLength(1)
  })

  it("une conversation vide : le premier commentaire envoyé remplace l'état vide", async () => {
    commentPages = { "": page([]) }
    mount()
    expect(screen.getByText(t("comments.emptyTitle"))).toBeInTheDocument()
    await send("Premier commentaire fictif")
    expect(screen.getByText("Premier commentaire fictif")).toBeInTheDocument()
    expect(screen.queryByText(t("comments.emptyTitle"))).toBeNull()
  })

  it("la réponse envoyée paraît sous sa racine, même quand les réponses sont repliées", async () => {
    commentPages = { "": page([root(1, { replyCount: 5, replies: range(1, 3).map(reply) })]) }
    mocks.comment.mockResolvedValue({ ok: true, value: { commentId: "reponse-envoyee" } })
    mount()
    const thread = screen.getByText("Réponse fictive 2").closest("article")!
    fireEvent.click(within(thread).getByRole("button", { name: t("comments.reply") }))
    await send("Ma réponse fictive")
    // Répondre à une réponse range sous la racine.
    expect(mocks.comment).toHaveBeenCalledWith({ postId: "post-a", body: "Ma réponse fictive", parentCommentId: "reponse-2" })
    const sent = screen.getByText("Ma réponse fictive").closest("article")!
    expect(screen.getByText("Commentaire fictif 1").closest("li")).toContainElement(sent)
    expect(screen.getByRole("button", { name: t("comments.showReplies", { count: 2 }) })).toBeInTheDocument()
  })

  it("modifier puis retirer son commentaire envoyé : le texte suit, puis il disparaît", async () => {
    mount()
    await send("Avis à corriger")
    const article = () => screen.getByText(/^Avis/).closest("article")!
    fireEvent.click(within(article()).getByRole("button", { name: t("comments.edit") }))
    fireEvent.change(screen.getByRole("textbox", { name: t("comments.editLabel") }), { target: { value: "Avis corrigé" } })
    fireEvent.submit(screen.getByRole("textbox", { name: t("comments.editLabel") }).closest("form")!)
    await waitFor(() => expect(mocks.edit).toHaveBeenCalledWith("comment-envoye", "Avis corrigé"))
    expect(await screen.findByText("Avis corrigé")).toBeInTheDocument()
    expect(within(article()).getByText(`· ${t("comments.edited")}`)).toBeInTheDocument()
    fireEvent.click(within(article()).getByRole("button", { name: t("comments.remove") }))
    fireEvent.click(within(article()).getByRole("button", { name: t("comments.confirmRemove") }))
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("comment-envoye"))
    await waitFor(() => expect(screen.queryByText("Avis corrigé")).toBeNull())
  })

  it("un autre lecteur repart de zéro : ni ce qui avait été envoyé, ni les pages lues", async () => {
    const view = mount()
    fireEvent.click(screen.getByRole("button", { name: t("comments.loadMore") }))
    expect(await screen.findByText("Commentaire fictif 21")).toBeInTheDocument()
    await send("Envoyé par le premier lecteur")
    session = signedIn("person-b")
    view.update()
    expect(screen.queryByText("Envoyé par le premier lecteur")).toBeNull()
    expect(screen.queryByText("Commentaire fictif 21")).toBeNull()
    expect(screen.getByText("Commentaire fictif 1")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: t("comments.loadMore") })).toBeEnabled()
  })

  it("en anglais, les mêmes gestes de suite", () => {
    const en = getFixedT("en")
    mount({}, "en")
    expect(screen.getByRole("button", { name: en("comments.loadMore") })).toBeInTheDocument()
  })
})
