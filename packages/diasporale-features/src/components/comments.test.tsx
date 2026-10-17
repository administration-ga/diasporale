// @vitest-environment jsdom
import { act, fireEvent, getDefaultNormalizer, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ActionResult, DiasporaleActions } from "../data/port"
import { COMMENT_MAX_LENGTH, type AccountView, type CommentThreadView, type CommentView, type Loadable, type MembershipView } from "../data/types"
import { getFixedT } from "../i18n"
import { I18nProvider } from "../i18n/client"
import { RoutingProvider, type FeatureRoutes } from "../routing"
import { renderWithI18n } from "../test-utils"
import { PostCommentsSheet } from "./comments"

const mocks = vi.hoisted(() => ({
  edit: vi.fn<NonNullable<DiasporaleActions["editComment"]>>(),
  remove: vi.fn<DiasporaleActions["removeComment"]>(),
  comment: vi.fn<DiasporaleActions["comment"]>(),
  success: vi.fn(), error: vi.fn(),
}))

type SessionProbe = { status: "anonymous" } | {
  status: "signed_in"
  account: Pick<AccountView, "id">
  membership: Pick<MembershipView, "personId" | "status" | "canPublish"> | null
}
let source: { kind: "engine" | "demo"; actions: Pick<DiasporaleActions, "editComment" | "removeComment" | "comment"> }
let session: Loadable<SessionProbe>
let threads: Loadable<readonly CommentThreadView[]>
let replies: Loadable<readonly CommentView[]>

vi.mock("../data/context", () => ({
  useDataSource: () => source,
  useSession: () => session,
  useActions: () => source.actions,
  useComments: () => threads,
  useReplies: () => replies,
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

const t = getFixedT("fr")
const normalizeText = getDefaultNormalizer()
const routes: FeatureRoutes = {
  profile: vi.fn((handle: string) => `/@${handle}`),
  post: (id) => `/publication/${id}`, page: (handle) => `/pages/${handle}`,
  hub: (country) => `/pays/${country}`, feed: () => "/fil", sponsor: () => "/parrainer",
  settings: () => "/parametres", attestation: () => "/attestation", enter: () => "/entrer",
}
function Link({ children, ...props }: ComponentProps<"a">) { return <a {...props}>{children}</a> }
function signedIn(id = "person-a", pending = false): Loadable<SessionProbe> {
  return { status: "ready", data: { status: "signed_in", account: { id }, membership: { personId: id, status: pending ? "en_attente" : "declaree", canPublish: !pending } } }
}
function comment(extra: Partial<CommentThreadView> = {}): CommentThreadView {
  return {
    id: "comment-root", author: { personId: "person-a", handle: "membre.a", displayName: "Membre A" },
    body: "Texte initial", createdAt: Date.UTC(2026, 9, 17, 12), edited: false, isMine: true,
    replyCount: 0, replies: [], ...extra,
  }
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
function editor() { return screen.getByRole("textbox", { name: t("comments.editLabel") }) }
function submit(field: HTMLElement) { fireEvent.submit(field.closest("form")!) }
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.edit.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.remove.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.comment.mockReset().mockResolvedValue({ ok: true, value: null })
  source = { kind: "engine", actions: { editComment: mocks.edit, removeComment: mocks.remove, comment: mocks.comment } }
  session = signedIn()
  threads = { status: "ready", data: [comment()] }
  replies = { status: "ready", data: [] }
})

describe("Commentaires — édition de l'auteur", () => {
  it.each(["commentaire", "réponse"])("enregistre le %s existant après trim, puis attend le DTO pour le texte et le marqueur", async (kind) => {
    const target = kind === "commentaire" ? comment() : comment({ id: "reply-a", body: "Réponse initiale" })
    threads = { status: "ready", data: kind === "commentaire" ? [target] : [comment({ isMine: false, replyCount: 1, replies: [target] })] }
    const view = mount()
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByRole("button", { name: t("comments.close") })).toHaveFocus())
    const row = screen.getByText(target.body).closest("article")!
    await user.click(within(row).getByRole("button", { name: t("comments.edit") }))
    expect(editor()).toHaveValue(target.body)
    await waitFor(() => expect(editor()).toHaveFocus())
    fireEvent.change(editor(), { target: { value: "  Texte corrigé\n  " } })
    submit(editor())
    await waitFor(() => expect(mocks.edit).toHaveBeenCalledWith(target.id, "Texte corrigé"))
    await waitFor(() => expect(screen.queryByRole("textbox", { name: t("comments.editLabel") })).toBeNull())
    expect(mocks.comment).not.toHaveBeenCalled()
    expect(screen.getByText(target.body)).toBeInTheDocument()
    expect(screen.queryByText("Texte corrigé")).toBeNull()
    expect(screen.queryByText(`· ${t("comments.edited")}`)).toBeNull()
    const updated = { ...target, body: "Texte corrigé", edited: true }
    threads = { status: "ready", data: kind === "commentaire" ? [updated] : [comment({ isMine: false, replyCount: 1, replies: [updated] })] }
    view.update()
    expect(screen.getByText("Texte corrigé")).toBeInTheDocument()
    expect(screen.getByText(`· ${t("comments.edited")}`)).toBeInTheDocument()
  })

  it.each([
    { label: "commentaire tiers sous son post", mine: false, postMine: true, allowed: true, capability: true, removable: true },
    { label: "commentaire tiers", mine: false, postMine: false, allowed: true, capability: true, removable: false },
    { label: "fournisseur sans édition", mine: true, postMine: false, allowed: true, capability: false, removable: true },
    { label: "auteur en attente", mine: true, postMine: false, allowed: false, capability: true, removable: true },
  ])("n'offre pas l'édition : $label", ({ mine, postMine, allowed, capability, removable }) => {
    threads = { status: "ready", data: [comment({ isMine: mine })] }
    if (!capability) source = { ...source, actions: { comment: mocks.comment, removeComment: mocks.remove } }
    if (!allowed) session = signedIn("person-a", true)
    mount({ postIsMine: postMine, canComment: allowed })
    expect(screen.queryByRole("button", { name: t("comments.edit") })).toBeNull()
    expect(Boolean(screen.queryByRole("button", { name: t("comments.remove") }))).toBe(removable)
    expect(Boolean(screen.queryByRole("textbox", { name: t("comments.label") }))).toBe(allowed)
    expect(mocks.edit).not.toHaveBeenCalled()
  })

  it.each([
    { value: " \n\t ", code: "comment_empty" },
    { value: "x".repeat(COMMENT_MAX_LENGTH + 1), code: "comment_too_long" },
  ])("valide $code sans envoyer ni perdre le brouillon", async ({ value, code }) => {
    mount()
    fireEvent.click(screen.getByRole("button", { name: t("comments.edit") }))
    fireEvent.change(editor(), { target: { value } })
    submit(editor())
    expect(await screen.findByRole("alert")).toHaveTextContent(normalizeText(t(`errors.${code}`)))
    expect(editor()).toHaveValue(value)
    expect(mocks.edit).not.toHaveBeenCalled()
  })

  it.each(["refus", "exception"])("conserve le texte après %s et permet de réessayer", async (failure) => {
    if (failure === "refus") mocks.edit.mockResolvedValueOnce({ ok: false, code: "rate_limited" })
    else mocks.edit.mockRejectedValueOnce(new Error("détail privé du transport"))
    mount()
    fireEvent.click(screen.getByRole("button", { name: t("comments.edit") }))
    fireEvent.change(editor(), { target: { value: "Brouillon conservé" } })
    submit(editor())
    expect(await screen.findByRole("alert")).toHaveTextContent(normalizeText(t(`errors.${failure === "refus" ? "rate_limited" : "unknown"}`)))
    expect(screen.queryByText("détail privé du transport")).toBeNull()
    expect(editor()).toHaveValue("Brouillon conservé")
    await waitFor(() => expect(screen.getByRole("button", { name: t("common.save") })).toBeEnabled())
    submit(editor())
    await waitFor(() => expect(mocks.edit).toHaveBeenCalledTimes(2))
    expect(mocks.edit).toHaveBeenLastCalledWith("comment-root", "Brouillon conservé")
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(t("comments.updated")))
  })

  it("annule le brouillon sans écriture et rend le focus à Modifier", () => {
    mount()
    fireEvent.click(screen.getByRole("button", { name: t("comments.edit") }))
    fireEvent.change(editor(), { target: { value: "Modification abandonnée" } })
    fireEvent.click(screen.getByRole("button", { name: t("comments.cancel") }))
    expect(screen.getByRole("button", { name: t("comments.edit") })).toHaveFocus()
    expect(screen.getByText("Texte initial")).toBeInTheDocument()
    expect(mocks.edit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: t("comments.edit") }))
    expect(editor()).toHaveValue("Texte initial")
  })

  it("verrouille immédiatement les doubles soumissions et les champs jusqu'à la réponse", async () => {
    const pending = deferred<ActionResult>()
    mocks.edit.mockReturnValueOnce(pending.promise)
    mount()
    fireEvent.click(screen.getByRole("button", { name: t("comments.edit") }))
    fireEvent.change(editor(), { target: { value: "Une seule correction" } })
    const form = editor().closest("form")!
    act(() => { fireEvent.submit(form); fireEvent.submit(form) })
    await waitFor(() => expect(mocks.edit).toHaveBeenCalledTimes(1))
    expect(editor()).toBeDisabled()
    expect(screen.getByRole("button", { name: t("comments.cancel") })).toBeDisabled()
    expect(screen.getByRole("button", { name: t("common.pleaseWait") })).toBeDisabled()
    await act(async () => { pending.resolve({ ok: true, value: null }); await pending.promise })
    expect(mocks.success).toHaveBeenCalledTimes(1)
  })

  it.each(["lecteur", "source", "post", "commentaire", "droits", "fermeture"])("ferme l'édition et ignore sa résolution tardive au changement de %s", async (change) => {
    const pending = deferred<ActionResult>()
    mocks.edit.mockReturnValueOnce(pending.promise)
    const view = mount()
    fireEvent.click(screen.getByRole("button", { name: t("comments.edit") }))
    fireEvent.change(editor(), { target: { value: "Ancien brouillon" } })
    submit(editor())
    await waitFor(() => expect(mocks.edit).toHaveBeenCalledTimes(1))
    if (change === "lecteur") session = signedIn("person-b")
    if (change === "source") source = { ...source }
    if (change === "commentaire") threads = { status: "ready", data: [comment({ body: "Texte réactif suivant" })] }
    view.update(change === "post" ? { postId: "post-b" } : change === "droits" ? { canComment: false } : change === "fermeture" ? { open: false } : {})
    expect(screen.queryByDisplayValue("Ancien brouillon")).toBeNull()
    expect(screen.queryByRole("textbox", { name: t("comments.editLabel") })).toBeNull()
    await act(async () => { pending.resolve({ ok: false, code: "not_found" }); await pending.promise })
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("n'écrit pas si le lecteur change pendant la validation asynchrone du formulaire", async () => {
    const view = mount()
    fireEvent.click(screen.getByRole("button", { name: t("comments.edit") }))
    fireEvent.change(editor(), { target: { value: "Ancienne validation" } })
    act(() => {
      submit(editor())
      session = signedIn("person-b")
      view.update()
    })
    await act(async () => { await Promise.resolve() })
    expect(mocks.edit).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })
})

describe("Commentaires — envoi, retrait et identité", () => {
  it.each(["envoi", "retrait"])("protège aussi %s des doubles gestes et de l'ancien lecteur", async (kind) => {
    const pending = deferred<ActionResult>()
    const action = kind === "envoi" ? mocks.comment : mocks.remove
    action.mockReturnValueOnce(pending.promise)
    const view = mount()
    if (kind === "envoi") {
      const field = screen.getByRole("textbox", { name: t("comments.label") })
      fireEvent.change(field, { target: { value: "Ancien envoi" } })
      const form = field.closest("form")!
      act(() => { fireEvent.submit(form); fireEvent.submit(form) })
    } else {
      fireEvent.click(screen.getByRole("button", { name: t("comments.remove") }))
      const button = screen.getByRole("button", { name: t("comments.confirmRemove") })
      act(() => { fireEvent.click(button); fireEvent.click(button) })
    }
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    if (kind === "envoi") expect(screen.getByRole("textbox", { name: t("comments.label") })).toBeDisabled()
    else expect(screen.getByRole("button", { name: t("comments.confirmRemove") })).toBeDisabled()
    session = signedIn("person-b")
    view.update()
    const nextDraft = screen.getByRole("textbox", { name: t("comments.label") })
    fireEvent.change(nextDraft, { target: { value: "Nouveau brouillon" } })
    await act(async () => { pending.resolve({ ok: true, value: null }); await pending.promise })
    expect(nextDraft).toHaveValue("Nouveau brouillon")
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: t("comments.confirmRemove") })).toBeNull()
  })

  it("conserve une réponse refusée puis envoie le même parent et le texte normalisé", async () => {
    mocks.comment.mockResolvedValueOnce({ ok: false, code: "rate_limited" })
    mount()
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByRole("button", { name: t("comments.close") })).toHaveFocus())
    await user.click(screen.getByRole("button", { name: t("comments.reply") }))
    const field = screen.getByRole("textbox", { name: t("comments.label") })
    await waitFor(() => expect(field).toHaveFocus())
    fireEvent.change(field, { target: { value: "  Ma réponse  " } })
    submit(field)
    expect(await screen.findByRole("alert")).toHaveTextContent(normalizeText(t("errors.rate_limited")))
    expect(field).toHaveValue("  Ma réponse  ")
    await waitFor(() => expect(field).toBeEnabled())
    submit(field)
    await waitFor(() => expect(mocks.comment).toHaveBeenCalledTimes(2))
    expect(mocks.comment).toHaveBeenLastCalledWith({ postId: "post-a", parentCommentId: "comment-root", body: "Ma réponse" })
    await waitFor(() => expect(screen.queryByRole("button", { name: t("comments.cancelReply") })).toBeNull())
  })

  it.each([null, "  "])("neutralise un nom incohérent lorsque le handle vaut %s", (handle) => {
    threads = { status: "ready", data: [comment({ author: { personId: "private-id", handle, displayName: "Nom à ne pas révéler" }, isMine: false })] }
    mount()
    expect(screen.queryByText("Nom à ne pas révéler")).toBeNull()
    expect(screen.getByText(t("comments.someone"))).toBeInTheDocument()
    expect(screen.queryByRole("link")).toBeNull()
    expect(routes.profile).not.toHaveBeenCalled()
    expect(document.querySelector('[data-slot="avatar"]')).toHaveClass("bg-muted", "text-muted-foreground")
    fireEvent.click(screen.getByRole("button", { name: t("comments.reply") }))
    expect(screen.getByText(t("comments.replyingTo", { name: t("comments.someone") }))).toBeInTheDocument()
  })

  it("retire aussi l'ancien nom de la cible de réponse dès sa projection neutre", () => {
    const view = mount()
    fireEvent.click(screen.getByRole("button", { name: t("comments.reply") }))
    expect(screen.getByText(t("comments.replyingTo", { name: "Membre A" }))).toBeInTheDocument()
    threads = { status: "ready", data: [comment({ author: { personId: "person-a", handle: null, displayName: "Membre A" } })] }
    view.update()
    expect(screen.queryByText("Membre A")).toBeNull()
    expect(screen.queryByText(t("comments.replyingTo", { name: "Membre A" }))).toBeNull()
    expect(screen.queryByRole("button", { name: t("comments.cancelReply") })).toBeNull()
  })

  it.each(["loading", "error", "anonymous"])("ferme les champs et anciens commentaires quand la session devient %s", (status) => {
    const view = mount()
    session = status === "loading" ? { status: "loading" } : status === "error" ? { status: "error", code: "not_signed_in" } : { status: "ready", data: { status: "anonymous" } }
    view.update()
    expect(screen.queryByText("Texte initial")).toBeNull()
    expect(screen.queryByRole("textbox")).toBeNull()
    if (status === "error") expect(screen.getByRole("alert")).toHaveTextContent(normalizeText(t("errors.not_signed_in")))
  })

  it("présente les commandes d'édition en anglais avec les mêmes actions", () => {
    const en = getFixedT("en")
    mount({}, "en")
    fireEvent.click(screen.getByRole("button", { name: en("comments.edit") }))
    expect(screen.getByRole("textbox", { name: en("comments.editLabel") })).toHaveValue("Texte initial")
    expect(screen.getByRole("button", { name: en("common.save") })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: en("comments.cancel") }))
    expect(mocks.edit).not.toHaveBeenCalled()
  })
})
