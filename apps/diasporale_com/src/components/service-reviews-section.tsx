"use client"

/** DG-016 : avis du service, preuve exacte et droit de réponse de l'équipe. */
import { Button, Card, Sheet, SheetContent, Skeleton } from "@diasporale/features"
import {
  SERVICE_REVIEW_REPORT_REASONS,
  useServiceReviews,
  useSession,
  type ActionErrorCode,
  type ServiceReviewReportReason,
  type ServiceReviewView,
  type ServiceReviewsCapability,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { useId, useState } from "react"
import { toast } from "sonner"

import { ServicePager } from "./service-pager"
import { ServiceReviewEditor, ServiceReviewReplyEditor, useReviewTask } from "./service-review-editor"
import { ConfirmSheet } from "./service-request-sheets"

const PROOF_KEYS = {
  booking_confirmed: "serviceReviews.proof.bookingConfirmed",
  completion_declared: "serviceReviews.proof.completionDeclared",
} as const

const MODERATION_KEYS = {
  published: "serviceReviews.moderation.published",
  pending_review: "serviceReviews.moderation.pending",
  removed: "serviceReviews.moderation.removed",
} as const

const REPORT_KEYS: Readonly<Record<ServiceReviewReportReason, string>> = {
  spam: "serviceReviews.report.spam",
  harassment: "serviceReviews.report.harassment",
  fraud: "serviceReviews.report.fraud",
  other: "serviceReviews.report.other",
}

/** Une génération par personne : aucun état de formulaire ou de liste n'est réadopté. */
export function ServiceOfferReviews(props: { readonly offerId: string }) {
  const capability = useServiceReviews()
  const session = useSession()
  if (capability === null) return null
  if (session.status !== "ready") return <Skeleton className="h-24 w-full rounded-xl" />
  if (session.data.status !== "signed_in" || !session.data.membership) return null
  return <OfferReviews key={`${session.data.membership.personId}:${props.offerId}`} capability={capability} offerId={props.offerId} />
}

function OfferReviews(props: { readonly offerId: string; readonly capability: ServiceReviewsCapability }) {
  const { t } = useDiasporaleT()
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <h2 id={id} className="text-lg font-semibold">{t("serviceReviews.list.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("serviceReviews.list.lead")}</p>
      <ServicePager
        read={(cursor) => props.capability.useOfferReviews({ offerId: props.offerId, cursor })}
        keyOf={(review) => review.reviewId}
        empty={<p className="rounded-lg bg-muted p-4 text-sm">{t("serviceReviews.list.empty")}</p>}
      >
        {(reviews) => <ul className="flex flex-col gap-3">{reviews.map((review) => <li key={review.reviewId}><ServiceReviewCard review={review} capability={props.capability} /></li>)}</ul>}
      </ServicePager>
    </section>
  )
}

export function ServiceRequestReview(props: { readonly requestId: string }) {
  const capability = useServiceReviews()
  const session = useSession()
  if (capability === null || session.status !== "ready" || session.data.status !== "signed_in" || !session.data.membership) return null
  return <MyReview key={`${session.data.membership.personId}:${props.requestId}`} capability={capability} requestId={props.requestId} canPublish={session.data.membership.canPublish} />
}

function MyReview(props: { readonly requestId: string; readonly capability: ServiceReviewsCapability; readonly canPublish: boolean }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const query = props.capability.useMyReview({ requestId: props.requestId })
  const [editor, setEditor] = useState<{ readonly review: ServiceReviewView | null } | null>(null)
  if (query.status === "loading") return <Skeleton className="h-24 w-full rounded-xl" />
  if (query.status === "error") return <Card role="alert" className="p-4">{t(`errors.${query.code}`)}</Card>
  if (query.data === null) return null
  const { review, canCreate, refusal } = query.data
  const canEdit = props.canPublish && review?.status === "active" && review.moderation !== "removed"
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <h2 id={id} className="text-lg font-semibold">{t("serviceReviews.mine.title")}</h2>
      {review ? <ServiceReviewCard review={review} capability={props.capability} /> : <p className="text-sm text-muted-foreground">{t("serviceReviews.mine.lead")}</p>}
      {!review && !canCreate && refusal ? <p className="text-sm text-muted-foreground">{t(`errors.${refusal}`)}</p> : null}
      {canCreate && props.canPublish ? <Button className="self-start" onClick={() => setEditor({ review: null })}>{t("serviceReviews.mine.write")}</Button> : null}
      {canEdit ? <Button className="self-start" variant="outline" onClick={() => setEditor({ review })}>{t("serviceReviews.mine.edit")}</Button> : null}
      {editor !== null ? (
        <Sheet open onOpenChange={(open) => { if (!open) setEditor(null) }}>
          <SheetContent title={t(editor.review ? "serviceReviews.form.editTitle" : "serviceReviews.form.title")} description={t("serviceReviews.form.description")} closeLabel={t("serviceReviews.close")}>
            <ServiceReviewEditor
              key={`${editor.review?.reviewId ?? props.requestId}:${editor.review?.version ?? 0}`}
              capability={props.capability}
              initial={editor.review}
              requestId={props.requestId}
              onCancel={() => setEditor(null)}
              onSaved={() => { setEditor(null); toast.success(t("serviceReviews.form.saved")) }}
            />
          </SheetContent>
        </Sheet>
      ) : null}
    </section>
  )
}

/** Pas d'accès à une demande depuis une carte d'avis ; la preuve reste minimale. */
export function ServiceReviewCard(props: { readonly review: ServiceReviewView; readonly capability: ServiceReviewsCapability }) {
  const { t, locale } = useDiasporaleT()
  const { review, capability } = props
  const [withdraw, setWithdraw] = useState<{ readonly target: "review" | "reply"; readonly version: number } | null>(null)
  const [replyEditor, setReplyEditor] = useState<{ readonly initial: ServiceReviewView["reply"] } | null>(null)
  const [report, setReport] = useState<{ readonly kind: "review" | "reply"; readonly id: string } | null>(null)
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(review.createdAt)
  const removed = review.status === "withdrawn" || review.moderation === "removed"
  const reply = review.reply
  const replyReadable = reply?.status === "active" && reply.moderation !== "removed"
  async function remove(): Promise<ActionErrorCode | null> {
    if (!withdraw) return null
    const result = withdraw.target === "review"
      ? await capability.withdraw({ reviewId: review.reviewId, expectedVersion: withdraw.version })
      : await capability.withdrawReply({ reviewId: review.reviewId, expectedVersion: withdraw.version })
    return result.ok ? null : result.code
  }
  return (
    <Card className="flex min-w-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="font-semibold">{review.author.displayName ?? t("serviceReviews.authorUnavailable")}</p>
        <time dateTime={new Date(review.createdAt).toISOString()} className="text-sm text-muted-foreground">{date}</time>
      </div>
      {removed ? <p className="text-sm text-muted-foreground">{t(review.status === "withdrawn" ? "serviceReviews.withdrawn" : "serviceReviews.moderation.removed")}</p> : (
        <>
          <p className="font-semibold">{t("serviceReviews.rating", { rating: review.rating })}</p>
          <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{review.body}</p>
          <p className="text-sm text-muted-foreground">{t(PROOF_KEYS[review.proof])}</p>
          {review.isMine || review.moderation !== "published" ? <p role="status" className="text-sm text-muted-foreground">{t(MODERATION_KEYS[review.moderation])}</p> : null}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {review.isMine && review.status === "active" ? <Button variant="ghost" size="sm" onClick={() => setWithdraw({ target: "review", version: review.version })}>{t("serviceReviews.withdraw.cta")}</Button> : null}
        {!removed && !review.isMine && review.moderation === "published" ? <Button variant="ghost" size="sm" onClick={() => setReport({ kind: "review", id: review.reviewId })}>{t("serviceReviews.report.cta")}</Button> : null}
        {!removed && review.canReply ? <Button variant="outline" size="sm" onClick={() => setReplyEditor({ initial: reply })}>{t(reply ? "serviceReviews.reply.edit" : "serviceReviews.reply.cta")}</Button> : null}
      </div>
      {!removed && reply ? (
        <div className="flex min-w-0 flex-col gap-2 rounded-lg bg-muted p-3">
          <p className="text-sm font-semibold">{t("serviceReviews.reply.title")}</p>
          {replyReadable ? <p className="whitespace-pre-line break-words text-sm">{reply.body}</p> : <p className="text-sm text-muted-foreground">{t(reply.status === "withdrawn" ? "serviceReviews.reply.withdrawn" : "serviceReviews.moderation.removed")}</p>}
          {replyReadable && reply.moderation !== "published" ? <p role="status" className="text-sm text-muted-foreground">{t(MODERATION_KEYS[reply.moderation])}</p> : null}
          <div className="flex flex-wrap gap-2">
            {reply.canManage && reply.status === "active" ? <Button variant="ghost" size="sm" onClick={() => setWithdraw({ target: "reply", version: reply.version })}>{t("serviceReviews.reply.withdraw")}</Button> : null}
            {replyReadable && !reply.canManage && reply.moderation === "published" ? <Button variant="ghost" size="sm" onClick={() => setReport({ kind: "reply", id: reply.replyId })}>{t("serviceReviews.report.reply")}</Button> : null}
          </div>
        </div>
      ) : null}
      {withdraw ? <ConfirmSheet open onOpenChange={(open) => { if (!open) setWithdraw(null) }} title={t("serviceReviews.withdraw.title")} description={t("serviceReviews.withdraw.description")} confirmLabel={t("serviceReviews.withdraw.confirm")} destructive onConfirm={remove} /> : null}
      {replyEditor ? (
        <Sheet open onOpenChange={(open) => { if (!open) setReplyEditor(null) }}>
          <SheetContent title={t("serviceReviews.reply.title")} description={t("serviceReviews.reply.description")} closeLabel={t("serviceReviews.close")}>
            <ServiceReviewReplyEditor initial={replyEditor.initial} reviewId={review.reviewId} capability={capability} onCancel={() => setReplyEditor(null)} onSaved={() => { setReplyEditor(null); toast.success(t("serviceReviews.reply.saved")) }} />
          </SheetContent>
        </Sheet>
      ) : null}
      {report ? <ReviewReport capability={capability} target={report} onClose={() => setReport(null)} /> : null}
    </Card>
  )
}

function ReviewReport(props: { readonly capability: ServiceReviewsCapability; readonly target: { readonly kind: "review" | "reply"; readonly id: string }; readonly onClose: () => void }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const [reason, setReason] = useState<ServiceReviewReportReason>("other")
  const task = useReviewTask()
  const close = () => { if (!task.busy) props.onClose() }
  return (
    <Sheet open onOpenChange={(open) => { if (!open) close() }}>
      <SheetContent title={t("serviceReviews.report.title")} description={t("serviceReviews.report.description")} closeLabel={t("serviceReviews.close")}>
        <div className="flex flex-col gap-4">
          <label htmlFor={id} className="text-sm font-medium">{t("serviceReviews.report.reason")}</label>
          <select id={id} value={reason} disabled={task.busy} onChange={(event) => { const value = event.target.value; if (SERVICE_REVIEW_REPORT_REASONS.some((candidate) => candidate === value)) setReason(value as ServiceReviewReportReason) }} className="h-11 rounded-md border border-input bg-card px-3 focus-visible:shadow-focus">
            {SERVICE_REVIEW_REPORT_REASONS.map((value) => <option key={value} value={value}>{t(REPORT_KEYS[value])}</option>)}
          </select>
          {task.error ? <p role="alert" className="text-sm text-destructive">{t(`errors.${task.error}`)}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={task.busy} aria-busy={task.busy} onClick={() => void task.run(() => props.capability.report({ target: props.target, reason }), () => { props.onClose(); toast.success(t("serviceReviews.report.saved")) })}>{t(task.busy ? "serviceReviews.working" : "serviceReviews.report.send")}</Button>
            <Button variant="ghost" disabled={task.busy} onClick={close}>{t("serviceReviews.cancel")}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
