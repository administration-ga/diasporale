"use client"

/** DG-016 : les formulaires gardent la version ouverte et le brouillon en cas de refus. */
import { parseServiceReview, parseServiceReviewReply, SERVICE_REVIEW_BODY_MAX_LENGTH, SERVICE_REVIEW_REPLY_MAX_LENGTH } from "@diasporale/domain"
import { Button, Checkbox, Field, Label, Textarea } from "@diasporale/features"
import type { ActionErrorCode, ActionResult, ServiceReviewView, ServiceReviewsCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useLayoutEffect, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

/** Une réponse tardive n'agit plus après la sortie de cette instance/personne. */
export function useReviewTask() {
  const active = useRef(false)
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  useLayoutEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  async function run(work: () => Promise<ActionResult<unknown>>, onSuccess: () => void) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await work()
      if (!active.current) return
      if (result.ok) onSuccess()
      else setError(result.code)
    } catch {
      if (active.current) setError("unknown")
    } finally {
      locked.current = false
      if (active.current) setBusy(false)
    }
  }
  return { busy, error, run }
}

const reviewSchema = z.object({
  rating: z.number({ invalid_type_error: "review_rating_invalid" }),
  body: z.string(),
  consent: z.boolean(),
}).superRefine((values, ctx) => {
  const parsed = parseServiceReview({ ...values, consentToPublish: values.consent })
  if (!parsed.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.code, path: [parsed.code === "review_rating_invalid" ? "rating" : parsed.code === "review_consent_required" ? "consent" : "body"] })
})

type ReviewValues = z.infer<typeof reviewSchema>

export function ServiceReviewEditor(props: {
  readonly requestId: string
  readonly capability: ServiceReviewsCapability
  readonly initial: ServiceReviewView | null
  readonly onSaved: () => void
  readonly onCancel: () => void
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const task = useReviewTask()
  const initial = props.initial
  const form = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: initial?.rating ?? 0, body: initial?.body ?? "", consent: initial !== null },
  })
  const submit = form.handleSubmit((values) => task.run(
    () => initial
      ? props.capability.update({ reviewId: initial.reviewId, expectedVersion: initial.version, rating: values.rating, body: values.body })
      : props.capability.publish({ requestId: props.requestId, rating: values.rating, body: values.body, consentToPublish: values.consent }),
    props.onSaved,
  ))
  const errorOf = (message: string | undefined) => message ? t(`errors.${message}`) : undefined
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <Field id={`${id}-rating`} label={t("serviceReviews.form.rating")} error={errorOf(form.formState.errors.rating?.message)}>
        {(field) => (
          <select id={field.id} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} disabled={task.busy} className="h-11 rounded-md border border-input bg-card px-3 focus-visible:shadow-focus" {...form.register("rating", { valueAsNumber: true })}>
            <option value={0}>{t("serviceReviews.form.chooseRating")}</option>
            {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{t("serviceReviews.form.ratingChoice", { rating })}</option>)}
          </select>
        )}
      </Field>
      <Field id={`${id}-body`} label={t("serviceReviews.form.body")} hint={t("serviceReviews.form.hint")} error={errorOf(form.formState.errors.body?.message)}>
        {(field) => <Textarea id={field.id} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} disabled={task.busy} rows={5} maxLength={SERVICE_REVIEW_BODY_MAX_LENGTH} {...form.register("body")} />}
      </Field>
      {initial === null ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-3">
            <Controller control={form.control} name="consent" render={({ field }) => <Checkbox id={`${id}-consent`} checked={field.value} onCheckedChange={(value) => field.onChange(value === true)} disabled={task.busy} aria-describedby={form.formState.errors.consent ? `${id}-consent-error` : undefined} aria-invalid={form.formState.errors.consent ? true : undefined} />} />
            <Label htmlFor={`${id}-consent`} className="text-sm leading-relaxed">{t("serviceReviews.form.consent")}</Label>
          </div>
          {form.formState.errors.consent ? <p id={`${id}-consent-error`} role="alert" className="text-sm text-destructive">{errorOf(form.formState.errors.consent.message)}</p> : null}
        </div>
      ) : null}
      {task.error ? <p role="alert" className="text-sm text-destructive">{t(`errors.${task.error}`)}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={task.busy} aria-busy={task.busy}>{t(task.busy ? "serviceReviews.working" : initial ? "serviceReviews.form.save" : "serviceReviews.form.publish")}</Button>
        <Button type="button" variant="ghost" disabled={task.busy} onClick={props.onCancel}>{t("serviceReviews.cancel")}</Button>
      </div>
    </form>
  )
}

const replySchema = z.object({ body: z.string() }).superRefine((values, ctx) => {
  const parsed = parseServiceReviewReply(values.body)
  if (!parsed.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.code, path: ["body"] })
})

export function ServiceReviewReplyEditor(props: {
  readonly reviewId: string
  readonly initial: ServiceReviewView["reply"]
  readonly capability: ServiceReviewsCapability
  readonly onSaved: () => void
  readonly onCancel: () => void
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const task = useReviewTask()
  const form = useForm<{ body: string }>({ resolver: zodResolver(replySchema), defaultValues: { body: props.initial?.body ?? "" } })
  const submit = form.handleSubmit((values) => task.run(
    () => props.capability.reply({ reviewId: props.reviewId, expectedVersion: props.initial?.version ?? null, body: values.body }), props.onSaved,
  ))
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <Field id={id} label={t("serviceReviews.reply.body")} hint={t("serviceReviews.form.hint")} error={form.formState.errors.body?.message ? t(`errors.${form.formState.errors.body.message}`) : undefined}>
        {(field) => <Textarea id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={task.busy} rows={4} maxLength={SERVICE_REVIEW_REPLY_MAX_LENGTH} {...form.register("body")} />}
      </Field>
      {task.error ? <p role="alert" className="text-sm text-destructive">{t(`errors.${task.error}`)}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={task.busy} aria-busy={task.busy}>{t(task.busy ? "serviceReviews.working" : "serviceReviews.reply.save")}</Button>
        <Button type="button" variant="ghost" disabled={task.busy} onClick={props.onCancel}>{t("serviceReviews.cancel")}</Button>
      </div>
    </form>
  )
}
