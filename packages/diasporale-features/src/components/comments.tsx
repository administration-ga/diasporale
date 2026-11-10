"use client"

import {
  appendCursorPage,
  initialCursorPages,
  mergedCursorRows,
  nextCursor,
  recordCursorPage,
  type CursorPageMount,
  type CursorPageSnapshot,
  type CursorPagesState,
} from "@antsia/social-features/features/reseau-personnel/cursor-pages"
import { zodResolver } from "@hookform/resolvers/zod"
import { CornerDownRightIcon, MessageCircleIcon, SendIcon, XIcon } from "lucide-react"
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { useActions, useCommentsPage, useDataSource, useRepliesPage, useSession } from "../data/context"
import { ACCESS_REFUSAL_CODES, type ActionErrorCode } from "../data/errors"
import type { DiasporaleActions } from "../data/port"
import { COMMENT_MAX_LENGTH, type CommentPageQuery, type CommentThreadView, type CommentView } from "../data/types"
import { useDiasporaleT } from "../i18n/client"
import { formatDate, formatRelative } from "../lib/format"
import { Button } from "../primitives/button"
import { Label, Textarea } from "../primitives/field"
import { Sheet, SheetContent } from "../primitives/sheet"
import { Avatar, Skeleton } from "../primitives/surface"
import { useRouting } from "../routing"
import { EmptyState } from "./empty-state"
import { RichText } from "./rich-text"

const commentSchema = z.object({
  body: z.string().trim().min(1, "comment_empty").max(COMMENT_MAX_LENGTH, "comment_too_long"),
})
type CommentValues = z.infer<typeof commentSchema>

/** À qui l'on répond : la racine reçoit la réponse, la personne nommée est avisée. */
interface ReplyTarget {
  readonly commentId: string
  /** La racine sous laquelle la réponse se range (un seul niveau). */
  readonly rootId: string
  readonly name: string
}

type CommentsContext = { postId: string; postIsMine: boolean; canComment: boolean }

/** L'auteur de ce que la session envoie, tel que son profil publié le nomme. */
type CommentAuthor = CommentView["author"]

/**
 * Ce que la personne vient d'envoyer pendant cette lecture (FD-03) : montré aussitôt, à la
 * suite de la conversation, même quand les pages qui le contiennent ne sont pas encore lues.
 * Dès qu'une page lue le rend, c'est la ligne du fournisseur qui s'affiche, une seule fois.
 */
interface SentComments {
  readonly roots: readonly CommentThreadView[]
  /** Les réponses envoyées, par racine. */
  readonly replies: Readonly<Record<string, readonly CommentView[]>>
}

const NO_SENT: SentComments = { roots: [], replies: {} }
const NO_REPLIES: readonly CommentView[] = []

/** Un commentaire envoyé, modifié depuis : son texte suit, marqué « modifié ». */
function editSent(sent: SentComments, commentId: string, body: string): SentComments {
  const edit = <T extends CommentView>(list: readonly T[]): readonly T[] =>
    list.some((item) => item.id === commentId) ? list.map((item) => item.id === commentId ? { ...item, body, edited: true } : item) : list
  const replies: Record<string, readonly CommentView[]> = {}
  for (const [rootId, list] of Object.entries(sent.replies)) replies[rootId] = edit(list)
  return { roots: edit(sent.roots), replies }
}

/** Un commentaire retiré quitte ce qu'on a envoyé ; une racine retirée emporte ses réponses, comme chez le fournisseur. */
function dropSent(sent: SentComments, commentId: string): SentComments {
  const replies: Record<string, readonly CommentView[]> = {}
  for (const [rootId, list] of Object.entries(sent.replies)) {
    if (rootId !== commentId) replies[rootId] = list.filter((item) => item.id !== commentId)
  }
  return { roots: sent.roots.filter((item) => item.id !== commentId), replies }
}

/** Verrou immédiat, invalidé au démontage avant toute résolution tardive. */
function useCommentOperation() {
  const active = useRef(false)
  const current = useRef<symbol | null>(null)
  const [busy, setBusy] = useState(false)
  useLayoutEffect(() => {
    active.current = true
    return () => { active.current = false; current.current = null }
  }, [])
  return {
    busy,
    begin: () => {
      if (!active.current || current.current !== null) return null
      const operation = Symbol()
      current.current = operation
      setBusy(true)
      return operation
    },
    isCurrent: (operation: symbol) => active.current && current.current === operation,
    isBusy: () => current.current !== null,
    finish: (operation: symbol) => {
      if (!active.current || current.current !== operation) return
      current.current = null
      setBusy(false)
    },
  }
}

function commentKey(comment: CommentView) {
  return JSON.stringify([comment.id, comment.body, comment.edited, comment.isMine, comment.author])
}

type PageReport<Row> = (mount: CursorPageMount, snapshot: CursorPageSnapshot<Row>, error: ActionErrorCode | null) => void

interface CommentChainState<Row> {
  readonly pages: CursorPagesState<Row>
  readonly errors: Readonly<Record<number, ActionErrorCode | null>>
  readonly retryToken: number
}

/**
 * Une suite de pages natives du fournisseur (FD-03), sur les gardes communes des pages à
 * curseur : une frontière qui bouge remonte la suite, une page en panne bloque la suivante
 * et se reprend, un refus d'accès n'affiche plus rien de ce qui avait été lu.
 */
function useCommentChain<Row extends { readonly id: string }>() {
  const [state, setState] = useState<CommentChainState<Row>>(() => ({ pages: initialCursorPages<Row>(), errors: {}, retryToken: 0 }))
  const report = useCallback<PageReport<Row>>((mount, snapshot, error) => {
    setState((current) => {
      const pages = recordCursorPage(current.pages, mount, snapshot)
      if (pages === current.pages && (current.errors[mount.id] ?? null) === error) return current
      return { ...current, pages, errors: { ...current.errors, [mount.id]: error } }
    })
  }, [])
  const more = useCallback(() => setState((current) => ({ ...current, pages: appendCursorPage(current.pages) })), [])
  const retry = useCallback(() => setState((current) => ({ ...current, retryToken: current.retryToken + 1 })), [])
  const { pages, errors } = state
  const codes = pages.mounts.map((mount) => errors[mount.id] ?? null)
  const refusal = codes.find((code): code is ActionErrorCode => code !== null && ACCESS_REFUSAL_CODES.has(code)) ?? null
  const failure = refusal ?? codes.find((code): code is ActionErrorCode => code !== null) ?? null
  const first = pages.pages[pages.mounts[0]!.id]
  const last = pages.pages[pages.mounts[pages.mounts.length - 1]!.id]
  return {
    mounts: pages.mounts,
    report,
    more,
    retry,
    retryToken: state.retryToken,
    rows: refusal ? [] : mergedCursorRows(pages, (row) => row.id),
    refusal,
    failure,
    loaded: first?.data !== undefined,
    loadingMore: pages.mounts.length > 1 && (!last?.data || last.isPending) && !last?.isError,
    hasMore: refusal === null && nextCursor(pages) !== null,
  }
}

/** Une page lue par son curseur, rapportée à la suite qui l'a montée ; la reprise la relit. */
function usePageReport<Row>(query: CommentPageQuery<Row>, mount: CursorPageMount, retryToken: number, report: PageReport<Row>) {
  const data = useMemo(() => query.data === undefined ? undefined : {
    page: query.data.items,
    isDone: query.data.isDone,
    continueCursor: query.data.continueCursor,
  }, [query.data])
  useLayoutEffect(() => {
    report(mount, { data, isPending: query.isLoading, isError: query.error !== null }, query.error)
  }, [mount, data, query.isLoading, query.error, report])
  const latest = useRef({ retry: query.retry, failed: query.error !== null })
  useLayoutEffect(() => { latest.current = { retry: query.retry, failed: query.error !== null } })
  useEffect(() => {
    if (retryToken > 0 && latest.current.failed) latest.current.retry()
  }, [retryToken])
}

function CommentsQueryPage(props: { postId: string; mount: CursorPageMount; retryToken: number; report: PageReport<CommentThreadView> }) {
  usePageReport(useCommentsPage({ postId: props.postId, cursor: props.mount.cursor }), props.mount, props.retryToken, props.report)
  return null
}

function RepliesQueryPage(props: { postId: string; commentId: string; mount: CursorPageMount; retryToken: number; report: PageReport<CommentView> }) {
  usePageReport(useRepliesPage({ postId: props.postId, commentId: props.commentId, cursor: props.mount.cursor }), props.mount, props.retryToken, props.report)
  return null
}

/** Une page en panne se dit et se reprend ; un refus d'accès se dit tel quel, sans « Réessayer ». */
function PageFailure(props: { code: ActionErrorCode; onRetry: () => void; className?: string }) {
  const { t } = useDiasporaleT()
  return (
    <div className={props.className ?? "flex flex-wrap items-center gap-2 px-2 py-2"}>
      <p role="alert" className="text-sm text-muted-foreground">{t(`errors.${props.code}`)}</p>
      {ACCESS_REFUSAL_CODES.has(props.code) ? null : (
        <Button variant="outline" size="sm" onClick={props.onRetry}>{t("comments.retry")}</Button>
      )}
    </div>
  )
}

/**
 * Les commentaires d'une publication (EXF-DG-12), en feuille : des plus anciens
 * aux plus récents, un seul niveau de réponse, trois réponses en aperçu puis
 * « voir les réponses ». Tous se lisent, page après page (FD-03), et ce qu'on
 * vient d'envoyer paraît aussitôt. On retire son commentaire, ou n'importe
 * lequel sous sa propre publication — en deux gestes. Aucune coordonnée : le
 * contact passe par la messagerie.
 */
export function PostCommentsSheet(props: {
  postId: string
  postIsMine: boolean
  canComment: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useDiasporaleT()
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent title={t("comments.title")} description={t("comments.description")} hideDescription closeLabel={t("comments.close")}>
        {props.open ? <CommentsSession postId={props.postId} postIsMine={props.postIsMine} canComment={props.canComment} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function CommentsSession(props: CommentsContext) {
  const { t } = useDiasporaleT()
  const source = useDataSource()
  const session = useSession()
  const identity = JSON.stringify([
    source.kind, props.postId, props.postIsMine, props.canComment, session.status,
    session.status === "ready" && session.data.status === "signed_in" ? [session.data.account.id, session.data.membership?.personId, session.data.membership?.status, session.data.membership?.canPublish] : null,
  ])
  const [boundary, setBoundary] = useState(() => ({ source, actions: source.actions, edit: source.actions.editComment, identity, generation: 0 }))
  // Réinitialisation pendant le rendu : aucun ancien champ n'est réutilisé par le nouveau lecteur.
  if (boundary.source !== source || boundary.actions !== source.actions || boundary.edit !== source.actions.editComment || boundary.identity !== identity) {
    setBoundary({ source, actions: source.actions, edit: source.actions.editComment, identity, generation: boundary.generation + 1 })
    return null
  }
  if (session.status === "loading") return <div className="p-5" aria-busy="true"><Skeleton className="h-16 w-full rounded-xl" /></div>
  if (session.status === "error") return <p role="alert" className="p-5 text-sm text-muted-foreground">{t(`errors.${session.code}`)}</p>
  if (session.data.status !== "signed_in") return <p className="p-5 text-sm text-muted-foreground">{t("comments.notAllowed")}</p>
  const membership = session.data.membership
  const me: CommentAuthor | null = membership ? { personId: membership.personId, handle: membership.handle, displayName: membership.displayName } : null
  return <CommentsContent key={boundary.generation} {...props} me={me} />
}

function CommentsContent(props: CommentsContext & { me: CommentAuthor | null }) {
  const { t } = useDiasporaleT()
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null)
  const [sent, setSent] = useState<SentComments>(NO_SENT)
  const dismissReply = useCallback((commentId: string) => setReplyTo((target) => target?.commentId === commentId ? null : target), [])
  const { me } = props
  const onSent = useCallback((commentId: string, body: string, rootId: string | null) => {
    setReplyTo(null)
    if (me === null) return
    const comment: CommentView = { id: commentId, author: me, body, createdAt: Date.now(), edited: false, isMine: true }
    setSent((current) => rootId === null
      ? { ...current, roots: [...current.roots, { ...comment, replyCount: 0, replies: [] }] }
      : { ...current, replies: { ...current.replies, [rootId]: [...(current.replies[rootId] ?? []), comment] } })
  }, [me])
  const onEdited = useCallback((commentId: string, body: string) => setSent((current) => editSent(current, commentId, body)), [])
  const onRemoved = useCallback((commentId: string) => setSent((current) => dropSent(current, commentId)), [])
  return <>
    <CommentList {...props} sent={sent} onReply={setReplyTo} onDismissReply={dismissReply} onEdited={onEdited} onRemoved={onRemoved} />
    {props.canComment ? (
      <CommentForm key={JSON.stringify(replyTo)} postId={props.postId} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} onSent={onSent} />
    ) : <p className="border-t border-border px-5 py-3 text-[13px] text-muted-foreground">{t("comments.notAllowed")}</p>}
  </>
}

/** Les gestes qu'un commentaire remonte à la lecture en cours. */
interface CommentHandlers {
  readonly onReply: (target: ReplyTarget) => void
  readonly onDismissReply: (commentId: string) => void
  readonly onEdited: (commentId: string, body: string) => void
  readonly onRemoved: (commentId: string) => void
}

function CommentList(props: CommentsContext & CommentHandlers & { sent: SentComments }) {
  const { t } = useDiasporaleT()
  const chain = useCommentChain<CommentThreadView>()
  // Une date de référence par ouverture : les « il y a … » ne bougent pas pendant la lecture.
  const [now] = useState(() => Date.now())
  const shown = new Set(chain.rows.map((thread) => thread.id))
  const echoes = chain.refusal ? [] : props.sent.roots.filter((thread) => !shown.has(thread.id))
  const thread = (item: CommentThreadView) => (
    <Thread key={item.id} thread={item} postId={props.postId} postIsMine={props.postIsMine} canComment={props.canComment} now={now}
      sentReplies={props.sent.replies[item.id] ?? NO_REPLIES} onReply={props.onReply} onDismissReply={props.onDismissReply} onEdited={props.onEdited} onRemoved={props.onRemoved} />
  )
  // Les pages lues restent montées à la même place, quel que soit l'état affiché.
  const pages = chain.mounts.map((mount) => <CommentsQueryPage key={mount.id} postId={props.postId} mount={mount} retryToken={chain.retryToken} report={chain.report} />)
  const empty = chain.rows.length === 0 && echoes.length === 0 && chain.failure === null && !chain.hasMore && !chain.loadingMore

  return <>
    {pages}
    {!chain.loaded && chain.failure === null ? (
      <div className="flex flex-col gap-3 p-5" aria-busy="true">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    ) : empty ? (
      <div className="p-4">
        <EmptyState icon={<MessageCircleIcon />} title={t("comments.emptyTitle")} description={props.canComment ? t("comments.emptyBody") : undefined} />
      </div>
    ) : (
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3" aria-busy={chain.loadingMore}>
        {chain.rows.length > 0 ? <ol className="flex flex-col gap-1">{chain.rows.map(thread)}</ol> : null}
        {chain.failure !== null ? <PageFailure code={chain.failure} onRetry={chain.retry} /> : null}
        {chain.hasMore || chain.loadingMore ? (
          <Button variant="outline" size="sm" className="self-start" disabled={chain.loadingMore || chain.failure !== null} aria-busy={chain.loadingMore} onClick={chain.more}>
            {t(chain.loadingMore ? "comments.loadingMore" : "comments.loadMore")}
          </Button>
        ) : null}
        {echoes.length > 0 ? <ol className="flex flex-col gap-1">{echoes.map(thread)}</ol> : null}
      </div>
    )}
  </>
}

function Thread(props: CommentHandlers & {
  thread: CommentThreadView
  postId: string
  postIsMine: boolean
  canComment: boolean
  now: number
  sentReplies: readonly CommentView[]
}) {
  const { t } = useDiasporaleT()
  const { thread } = props
  const [expanded, setExpanded] = useState(false)
  const chain = useCommentChain<CommentView>()
  // Pendant la lecture de la première page, l'aperçu reste affiché ; puis les pages lues le remplacent.
  const paged = expanded && (chain.loaded || chain.refusal !== null)
  const replies = paged ? chain.rows : thread.replies
  const shown = new Set(replies.map((reply) => reply.id))
  const echoes = paged && chain.refusal ? [] : props.sentReplies.filter((reply) => !shown.has(reply.id))
  // Le compte du fournisseur peut déjà inclure la réponse qu'on vient d'envoyer, ou pas encore :
  // mieux vaut proposer une réponse de trop à lire que d'en cacher une.
  const hidden = expanded ? 0 : Math.max(0, thread.replyCount - replies.length)
  const reply = (item: CommentView) => (
    <li key={item.id}>
      <Comment key={commentKey(item)} comment={item} rootId={thread.id} postIsMine={props.postIsMine} canComment={props.canComment} now={props.now}
        onReply={props.onReply} onDismissReply={props.onDismissReply} onEdited={props.onEdited} onRemoved={props.onRemoved} compact />
    </li>
  )
  const loadingFirst = expanded && !chain.loaded && chain.failure === null

  return (
    <li>
      {expanded ? chain.mounts.map((mount) => <RepliesQueryPage key={mount.id} postId={props.postId} commentId={thread.id} mount={mount} retryToken={chain.retryToken} report={chain.report} />) : null}
      <Comment key={commentKey(thread)} comment={thread} rootId={thread.id} postIsMine={props.postIsMine} canComment={props.canComment} now={props.now}
        onReply={props.onReply} onDismissReply={props.onDismissReply} onEdited={props.onEdited} onRemoved={props.onRemoved} />
      {replies.length > 0 || echoes.length > 0 || hidden > 0 || expanded ? (
        <div className="ml-11 flex flex-col gap-1">
          {replies.length > 0 ? <ol className="flex flex-col gap-1">{replies.map(reply)}</ol> : null}
          {expanded && chain.failure !== null ? <PageFailure code={chain.failure} onRetry={chain.retry} /> : null}
          {hidden > 0 ? (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setExpanded(true)}>
              <CornerDownRightIcon aria-hidden />
              {t("comments.showReplies", { count: hidden })}
            </Button>
          ) : null}
          {loadingFirst || (expanded && (chain.hasMore || chain.loadingMore)) ? (
            <Button variant="ghost" size="sm" className="self-start" disabled={loadingFirst || chain.loadingMore || chain.failure !== null} aria-busy={loadingFirst || chain.loadingMore} onClick={chain.more}>
              <CornerDownRightIcon aria-hidden />
              {t(loadingFirst || chain.loadingMore ? "comments.loadingReplies" : "comments.moreReplies")}
            </Button>
          ) : null}
          {echoes.length > 0 ? <ol className="flex flex-col gap-1">{echoes.map(reply)}</ol> : null}
        </div>
      ) : null}
    </li>
  )
}

function Comment(props: CommentHandlers & {
  comment: CommentView
  /** La racine de la conversation : elle-même, ou celle de la réponse. */
  rootId: string
  postIsMine: boolean
  canComment: boolean
  now: number
  compact?: boolean
}) {
  const { t, locale } = useDiasporaleT()
  const actions = useActions()
  const { routes, Link } = useRouting()
  const { comment } = props
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const editingRef = useRef(false)
  const editButton = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const operation = useCommentOperation()
  const neutral = !comment.author.handle?.trim()
  const name = neutral ? t("comments.someone") : comment.author.displayName ?? t("comments.someone")
  const canRemove = comment.isMine || props.postIsMine
  const editComment = comment.isMine && props.canComment ? actions.editComment : undefined

  useLayoutEffect(() => {
    if (!editing && restoreFocus.current) {
      editButton.current?.focus()
      restoreFocus.current = false
    }
  }, [editing])
  const { onDismissReply } = props
  useLayoutEffect(() => () => onDismissReply(comment.id), [comment.id, onDismissReply])

  const closeEditor = () => {
    editingRef.current = false
    restoreFocus.current = true
    setEditing(false)
  }

  const remove = async () => {
    if (!canRemove || !confirming || editingRef.current) return
    const token = operation.begin()
    if (token === null) return
    try {
      const result = await actions.removeComment(comment.id)
      if (!operation.isCurrent(token)) return
      if (result.ok) { setConfirming(false); props.onRemoved(comment.id); toast.success(t("comments.removed")) }
      else toast.error(t(`errors.${result.code}`))
    } catch {
      if (operation.isCurrent(token)) toast.error(t("errors.unknown"))
    } finally { operation.finish(token) }
  }

  return (
    <article className="flex gap-3 rounded-xl px-2 py-2">
      <Avatar id={neutral ? "neutral" : comment.author.personId} name={name} size={props.compact ? "sm" : "md"} className={neutral ? "bg-muted text-muted-foreground" : undefined} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
          {!neutral && comment.author.handle ? (
            <Link href={routes.profile(comment.author.handle)} className="font-semibold text-foreground hover:underline focus-visible:shadow-focus">
              {name}
            </Link>
          ) : (
            <span className="font-semibold text-foreground">{name}</span>
          )}
          <time dateTime={new Date(comment.createdAt).toISOString()} title={formatDate(comment.createdAt, locale)} className="text-muted-foreground">
            {/* Arrivé pendant la lecture (le sien, ou la page qui suit) : « maintenant », jamais « dans … ». */}
            {formatRelative(Math.min(comment.createdAt, props.now), props.now, locale)}
          </time>
          {comment.edited ? <span className="text-muted-foreground">· {t("comments.edited")}</span> : null}
        </p>
        {editing && editComment ? (
          <CommentEditor key={commentKey(comment)} comment={comment} editComment={editComment} onSaved={(body) => props.onEdited(comment.id, body)} onClose={closeEditor} />
        ) : <p className="mt-0.5 whitespace-pre-line break-words text-[14px] leading-relaxed"><RichText text={comment.body} /></p>}
        {!editing && (props.canComment || canRemove) ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {props.canComment ? (
              <Button variant="ghost" size="sm" disabled={operation.busy} onClick={() => { if (!operation.isBusy() && !editingRef.current) props.onReply({ commentId: comment.id, rootId: props.rootId, name }) }}>
                {t("comments.reply")}
              </Button>
            ) : null}
            {editComment && !confirming ? <Button ref={editButton} variant="ghost" size="sm" onClick={() => {
              if (operation.isBusy() || editingRef.current) return
              editingRef.current = true
              setEditing(true)
            }}>{t("comments.edit")}</Button> : null}
            {canRemove && !confirming ? (
              <Button variant="ghost" size="sm" onClick={() => { if (!editingRef.current) setConfirming(true) }}>
                {t("comments.remove")}
              </Button>
            ) : null}
            {canRemove && confirming ? (
              <>
                <Button variant="destructive" size="sm" disabled={operation.busy} onClick={remove}>
                  {t("comments.confirmRemove")}
                </Button>
                <Button variant="ghost" size="sm" disabled={operation.busy} onClick={() => { if (!operation.isBusy()) setConfirming(false) }}>
                  {t("comments.cancel")}
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function CommentEditor(props: { comment: CommentView; editComment: NonNullable<DiasporaleActions["editComment"]>; onSaved: (body: string) => void; onClose: () => void }) {
  const { t } = useDiasporaleT()
  const ids = useId()
  const operation = useCommentOperation()
  const form = useForm<CommentValues>({ resolver: zodResolver(commentSchema), defaultValues: { body: props.comment.body } })
  const bodyInput = useRef<HTMLTextAreaElement>(null)
  const bodyField = form.register("body")
  const body = useWatch({ control: form.control, name: "body" })
  const error = form.formState.errors.body?.message
  const busy = operation.busy || form.formState.isSubmitting
  useLayoutEffect(() => { bodyInput.current?.focus() }, [])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    const token = operation.begin()
    if (token === null) { event.preventDefault(); return }
    try {
      await form.handleSubmit(async (values) => {
        if (!operation.isCurrent(token)) return
        const result = await props.editComment(props.comment.id, values.body)
        if (!operation.isCurrent(token)) return
        if (!result.ok) { form.setError("body", { message: result.code }); return }
        props.onSaved(values.body)
        toast.success(t("comments.updated"))
        props.onClose()
      })(event)
    } catch {
      if (operation.isCurrent(token)) form.setError("body", { message: "unknown" })
    } finally { operation.finish(token) }
  }

  return <form noValidate onSubmit={onSubmit} aria-label={t("comments.editLabel")} className="mt-2 flex flex-col gap-2">
    <Label htmlFor={`${ids}-edition`}>{t("comments.editLabel")}</Label>
    <Textarea id={`${ids}-edition`} rows={3} maxLength={COMMENT_MAX_LENGTH} disabled={busy}
      aria-invalid={error ? true : undefined} aria-describedby={error ? `${ids}-erreur` : `${ids}-compte`} {...bodyField}
      ref={(element) => { bodyField.ref(element); bodyInput.current = element }} />
    {error ? <p id={`${ids}-erreur`} role="alert" className="text-[13px] font-medium text-destructive">{t(`errors.${error}`)}</p>
      : <p id={`${ids}-compte`} className="text-[12px] text-muted-foreground">{t("comments.counter", { count: body.length, max: COMMENT_MAX_LENGTH })}</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="submit" size="sm" disabled={busy}>{t(busy ? "common.pleaseWait" : "common.save")}</Button>
      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { if (!operation.isBusy()) props.onClose() }}>{t("comments.cancel")}</Button>
    </div>
  </form>
}

function CommentForm(props: {
  postId: string
  replyTo: ReplyTarget | null
  onCancelReply: () => void
  /** Le commentaire créé, sa racine s'il répond : la lecture le montre aussitôt (FD-03). */
  onSent: (commentId: string, body: string, rootId: string | null) => void
}) {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const operation = useCommentOperation()
  const ids = useId()
  const form = useForm<CommentValues>({ resolver: zodResolver(commentSchema), defaultValues: { body: "" } })
  const bodyInput = useRef<HTMLTextAreaElement>(null)
  const bodyField = form.register("body")
  const body = useWatch({ control: form.control, name: "body" })
  const error = form.formState.errors.body?.message
  const busy = operation.busy || form.formState.isSubmitting
  const replying = props.replyTo !== null

  // « Répondre » mène au champ : on écrit aussitôt, sans chercher où.
  useLayoutEffect(() => {
    if (replying) bodyInput.current?.focus()
  }, [replying])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    const token = operation.begin()
    if (token === null) { event.preventDefault(); return }
    try {
      await form.handleSubmit(async (values) => {
        if (!operation.isCurrent(token)) return
        const result = await actions.comment({ postId: props.postId, body: values.body, ...(props.replyTo ? { parentCommentId: props.replyTo.commentId } : {}) })
        if (!operation.isCurrent(token)) return
        if (!result.ok) { form.setError("body", { message: result.code }); return }
        toast.success(t("comments.sent"))
        form.reset({ body: "" })
        props.onSent(result.value.commentId, values.body, props.replyTo?.rootId ?? null)
      })(event)
    } catch {
      if (operation.isCurrent(token)) form.setError("body", { message: "unknown" })
    } finally { operation.finish(token) }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-2 border-t border-border px-5 pb-4 pt-3">
      {props.replyTo ? (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <CornerDownRightIcon className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{t("comments.replyingTo", { name: props.replyTo.name })}</span>
          <Button variant="ghost" size="icon" type="button" disabled={busy} onClick={() => { if (!operation.isBusy()) props.onCancelReply() }} aria-label={t("comments.cancelReply")}>
            <XIcon aria-hidden />
          </Button>
        </p>
      ) : null}
      <Label htmlFor={`${ids}-corps`} className="sr-only">
        {t("comments.label")}
      </Label>
      <Textarea
        id={`${ids}-corps`}
        rows={2}
        maxLength={COMMENT_MAX_LENGTH}
        disabled={busy}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${ids}-erreur` : `${ids}-compte`}
        placeholder={props.replyTo ? t("comments.replyPlaceholder") : t("comments.placeholder")}
        className="min-h-11"
        {...bodyField}
        ref={(element) => { bodyField.ref(element); bodyInput.current = element }}
      />
      <div className="flex items-center gap-3">
        {error ? (
          <p id={`${ids}-erreur`} role="alert" className="min-w-0 flex-1 text-[13px] font-medium text-destructive">
            {t(`errors.${error}`)}
          </p>
        ) : (
          <p id={`${ids}-compte`} className="min-w-0 flex-1 text-[12px] text-muted-foreground">
            {t("comments.counter", { count: body.length, max: COMMENT_MAX_LENGTH })}
          </p>
        )}
        <Button variant="send" type="submit" size="sm" disabled={busy}>
          <SendIcon aria-hidden />
          {t("comments.send")}
        </Button>
      </div>
    </form>
  )
}
