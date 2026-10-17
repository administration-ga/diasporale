"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CornerDownRightIcon, MessageCircleIcon, SendIcon, XIcon } from "lucide-react"
import { useCallback, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { useActions, useComments, useDataSource, useReplies, useSession } from "../data/context"
import type { DiasporaleActions } from "../data/port"
import { COMMENT_MAX_LENGTH, type CommentThreadView, type CommentView } from "../data/types"
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
  readonly name: string
}

type CommentsContext = { postId: string; postIsMine: boolean; canComment: boolean }

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

/**
 * Les commentaires d'une publication (EXF-DG-12), en feuille : des plus anciens
 * aux plus récents, un seul niveau de réponse, trois réponses en aperçu puis
 * « voir les réponses ». On retire son commentaire, ou n'importe lequel sous sa
 * propre publication — en deux gestes. Aucune coordonnée : le contact passe par
 * la messagerie.
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
  return <CommentsContent key={boundary.generation} {...props} />
}

function CommentsContent(props: CommentsContext) {
  const { t } = useDiasporaleT()
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null)
  const dismissReply = useCallback((commentId: string) => setReplyTo((target) => target?.commentId === commentId ? null : target), [])
  return <>
    <CommentList {...props} onReply={setReplyTo} onDismissReply={dismissReply} />
    {props.canComment ? (
      <CommentForm key={JSON.stringify(replyTo)} postId={props.postId} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} onSent={() => setReplyTo(null)} />
    ) : <p className="border-t border-border px-5 py-3 text-[13px] text-muted-foreground">{t("comments.notAllowed")}</p>}
  </>
}

function CommentList(props: CommentsContext & { onReply: (target: ReplyTarget) => void; onDismissReply: (commentId: string) => void }) {
  const { t } = useDiasporaleT()
  const threads = useComments(props.postId)
  // Une date de référence par ouverture : les « il y a … » ne bougent pas pendant la lecture.
  const [now] = useState(() => Date.now())

  if (threads.status === "loading") {
    return (
      <div className="flex flex-col gap-3 p-5" aria-busy="true">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    )
  }
  if (threads.status === "error") {
    return (
      <p role="alert" className="p-5 text-sm text-muted-foreground">
        {t(`errors.${threads.code}`)}
      </p>
    )
  }
  if (threads.data.length === 0) {
    return (
      <div className="p-4">
        <EmptyState icon={<MessageCircleIcon />} title={t("comments.emptyTitle")} description={props.canComment ? t("comments.emptyBody") : undefined} />
      </div>
    )
  }
  return (
    <ol className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
      {threads.data.map((thread) => (
        <Thread key={thread.id} thread={thread} postId={props.postId} postIsMine={props.postIsMine} canComment={props.canComment} now={now} onReply={props.onReply} onDismissReply={props.onDismissReply} />
      ))}
    </ol>
  )
}

function Thread(props: {
  thread: CommentThreadView
  postId: string
  postIsMine: boolean
  canComment: boolean
  now: number
  onReply: (target: ReplyTarget) => void
  onDismissReply: (commentId: string) => void
}) {
  const { t } = useDiasporaleT()
  const { thread } = props
  const [expanded, setExpanded] = useState(false)
  const all = useReplies({ postId: props.postId, commentId: expanded ? thread.id : null })
  const replies = expanded && all.status === "ready" ? all.data : thread.replies
  const hidden = thread.replyCount - replies.length

  return (
    <li>
      <Comment key={commentKey(thread)} comment={thread} postIsMine={props.postIsMine} canComment={props.canComment} now={props.now} onReply={props.onReply} onDismissReply={props.onDismissReply} />
      {replies.length > 0 || hidden > 0 ? (
        <div className="ml-11 flex flex-col gap-1">
          {replies.length > 0 ? (
            <ol className="flex flex-col gap-1">
              {replies.map((reply) => (
                <li key={reply.id}>
                  <Comment key={commentKey(reply)} comment={reply} postIsMine={props.postIsMine} canComment={props.canComment} now={props.now} onReply={props.onReply} onDismissReply={props.onDismissReply} compact />
                </li>
              ))}
            </ol>
          ) : null}
          {hidden > 0 ? (
            <Button variant="ghost" size="sm" className="self-start" disabled={expanded && all.status === "loading"} onClick={() => setExpanded(true)}>
              <CornerDownRightIcon aria-hidden />
              {t("comments.showReplies", { count: hidden })}
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function Comment(props: {
  comment: CommentView
  postIsMine: boolean
  canComment: boolean
  now: number
  compact?: boolean
  onReply: (target: ReplyTarget) => void
  onDismissReply: (commentId: string) => void
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
      if (result.ok) { setConfirming(false); toast.success(t("comments.removed")) }
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
            {formatRelative(comment.createdAt, props.now, locale)}
          </time>
          {comment.edited ? <span className="text-muted-foreground">· {t("comments.edited")}</span> : null}
        </p>
        {editing && editComment ? (
          <CommentEditor key={commentKey(comment)} comment={comment} editComment={editComment} onClose={closeEditor} />
        ) : <p className="mt-0.5 whitespace-pre-line break-words text-[14px] leading-relaxed"><RichText text={comment.body} /></p>}
        {!editing && (props.canComment || canRemove) ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {props.canComment ? (
              <Button variant="ghost" size="sm" disabled={operation.busy} onClick={() => { if (!operation.isBusy() && !editingRef.current) props.onReply({ commentId: comment.id, name }) }}>
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

function CommentEditor(props: { comment: CommentView; editComment: NonNullable<DiasporaleActions["editComment"]>; onClose: () => void }) {
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

function CommentForm(props: { postId: string; replyTo: ReplyTarget | null; onCancelReply: () => void; onSent: () => void }) {
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
        props.onSent()
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
        <Button type="submit" size="sm" disabled={busy}>
          <SendIcon aria-hidden />
          {t("comments.send")}
        </Button>
      </div>
    </form>
  )
}
