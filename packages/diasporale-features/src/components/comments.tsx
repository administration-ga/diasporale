"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CornerDownRightIcon, MessageCircleIcon, SendIcon, XIcon } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { useActions, useComments, useReplies } from "../data/context"
import { COMMENT_MAX_LENGTH, type CommentThreadView, type CommentView } from "../data/types"
import { useDiasporaleT } from "../i18n/client"
import { formatDate, formatRelative } from "../lib/format"
import { Button } from "../primitives/button"
import { Label, Textarea } from "../primitives/field"
import { Sheet, SheetContent } from "../primitives/sheet"
import { Avatar, Skeleton } from "../primitives/surface"
import { useRouting } from "../routing"
import { EmptyState } from "./empty-state"

const commentSchema = z.object({
  body: z.string().trim().min(1, "comment_empty").max(COMMENT_MAX_LENGTH, "comment_too_long"),
})
type CommentValues = z.infer<typeof commentSchema>

/** À qui l'on répond : la racine reçoit la réponse, la personne nommée est avisée. */
interface ReplyTarget {
  readonly commentId: string
  readonly name: string
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
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null)
  return (
    <Sheet
      open={props.open}
      onOpenChange={(open) => {
        if (!open) setReplyTo(null)
        props.onOpenChange(open)
      }}
    >
      <SheetContent title={t("comments.title")} description={t("comments.description")} hideDescription closeLabel={t("comments.close")}>
        {props.open ? (
          <>
            <CommentList postId={props.postId} postIsMine={props.postIsMine} canComment={props.canComment} onReply={setReplyTo} />
            {props.canComment ? (
              <CommentForm postId={props.postId} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} onSent={() => setReplyTo(null)} />
            ) : (
              <p className="border-t border-border px-5 py-3 text-[13px] text-muted-foreground">{t("comments.notAllowed")}</p>
            )}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function CommentList(props: { postId: string; postIsMine: boolean; canComment: boolean; onReply: (target: ReplyTarget) => void }) {
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
        <Thread key={thread.id} thread={thread} postId={props.postId} postIsMine={props.postIsMine} canComment={props.canComment} now={now} onReply={props.onReply} />
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
}) {
  const { t } = useDiasporaleT()
  const { thread } = props
  const [expanded, setExpanded] = useState(false)
  const all = useReplies({ postId: props.postId, commentId: expanded ? thread.id : null })
  const replies = expanded && all.status === "ready" ? all.data : thread.replies
  const hidden = thread.replyCount - replies.length

  return (
    <li>
      <Comment comment={thread} postIsMine={props.postIsMine} canComment={props.canComment} now={props.now} onReply={props.onReply} />
      {replies.length > 0 || hidden > 0 ? (
        <div className="ml-11 flex flex-col gap-1">
          {replies.length > 0 ? (
            <ol className="flex flex-col gap-1">
              {replies.map((reply) => (
                <li key={reply.id}>
                  <Comment comment={reply} postIsMine={props.postIsMine} canComment={props.canComment} now={props.now} onReply={props.onReply} compact />
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
}) {
  const { t, locale } = useDiasporaleT()
  const actions = useActions()
  const { routes, Link } = useRouting()
  const { comment } = props
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const name = comment.author.displayName ?? t("comments.someone")
  const canRemove = comment.isMine || props.postIsMine

  const remove = async () => {
    setBusy(true)
    const result = await actions.removeComment(comment.id)
    setBusy(false)
    setConfirming(false)
    if (result.ok) toast.success(t("comments.removed"))
    else toast.error(t(`errors.${result.code}`))
  }

  return (
    <article className="flex gap-3 rounded-xl px-2 py-2">
      <Avatar id={comment.author.personId} name={name} size={props.compact ? "sm" : "md"} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
          {comment.author.handle ? (
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
        <p className="mt-0.5 whitespace-pre-line break-words text-[14px] leading-relaxed">{comment.body}</p>
        {props.canComment || canRemove ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {props.canComment ? (
              <Button variant="ghost" size="sm" onClick={() => props.onReply({ commentId: comment.id, name })}>
                {t("comments.reply")}
              </Button>
            ) : null}
            {canRemove && !confirming ? (
              <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                {t("comments.remove")}
              </Button>
            ) : null}
            {canRemove && confirming ? (
              <>
                <Button variant="destructive" size="sm" disabled={busy} onClick={remove}>
                  {t("comments.confirmRemove")}
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
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

function CommentForm(props: { postId: string; replyTo: ReplyTarget | null; onCancelReply: () => void; onSent: () => void }) {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const ids = useId()
  const form = useForm<CommentValues>({ resolver: zodResolver(commentSchema), defaultValues: { body: "" } })
  const body = useWatch({ control: form.control, name: "body" })
  const error = form.formState.errors.body?.message

  // « Répondre » mène au champ : on écrit aussitôt, sans chercher où.
  useEffect(() => {
    if (props.replyTo) form.setFocus("body")
  }, [props.replyTo, form])

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await actions.comment({
      postId: props.postId,
      body: values.body,
      ...(props.replyTo ? { parentCommentId: props.replyTo.commentId } : {}),
    })
    if (!result.ok) {
      form.setError("body", { message: result.code })
      return
    }
    toast.success(t("comments.sent"))
    form.reset({ body: "" })
    props.onSent()
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-2 border-t border-border px-5 pb-4 pt-3">
      {props.replyTo ? (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <CornerDownRightIcon className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{t("comments.replyingTo", { name: props.replyTo.name })}</span>
          <Button variant="ghost" size="icon" type="button" onClick={props.onCancelReply} aria-label={t("comments.cancelReply")}>
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
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${ids}-erreur` : `${ids}-compte`}
        placeholder={props.replyTo ? t("comments.replyPlaceholder") : t("comments.placeholder")}
        className="min-h-11"
        {...form.register("body")}
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
        <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
          <SendIcon aria-hidden />
          {t("comments.send")}
        </Button>
      </div>
    </form>
  )
}
