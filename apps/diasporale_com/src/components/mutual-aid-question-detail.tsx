"use client"

/**
 * La fiche d'une question d'entraide (DG-024 a) : la question, sa réponse
 * retenue mise en avant, les réponses publiées (« Afficher plus »), répondre ;
 * pour son auteur : modifier, retenir une réponse ou ne plus la retenir, clore,
 * retirer ; pour autrui, signaler la question ou une réponse (G9, chantier
 * « confiance des surfaces »). PROPRIÉTAIRE : chantier « entraide ».
 *
 * L'autorité reste au fournisseur (moteur ou démonstration) : un bouton absent
 * ne protège rien, il dit ce que le fournisseur a déjà jugé. Aucune coordonnée :
 * pour poursuivre en privé, la messagerie, depuis le profil de la personne.
 * L'état de modération (G9) se dit à l'auteur seul : l'avis de modération sur
 * sa question, une mention sur sa réponse.
 */
import { AID_ANSWER_MAX_LENGTH, parseAidAnswer } from "@diasporale/domain"
import { Button, Card, EmptyState, Field, ModerationBanner, Sheet, SheetContent, Textarea, formatDate } from "@diasporale/features"
import {
  moderationBannerState,
  type ActionResult,
  type AidAnswerView,
  type AidQuestionDetailView,
  type ContentReportTarget,
  type MutualAidCapability,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, CheckCircle2Icon, MessageCircleQuestionIcon } from "lucide-react"
import NextLink from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useId, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { routes } from "@/lib/routes"

import { type AssociationFeedback, errorKey, FeedbackLine, useGuardedAction } from "./association-parts"
import { AidConfirmButton, AidModerationChip, AidPersonName, AidPlace, AidQuestionStatusChip, AidThemeChip } from "./mutual-aid-parts"
import { AidQuestionForm } from "./mutual-aid-question-form"
import { ReportContentAction, ReportedContent } from "./report-content-sheet"
import { useReviewTask as useAidTask } from "./service-review-editor"
import { ServicePager } from "./service-pager"

const answerSchema = z.object({ body: z.string() }).superRefine((values, context) => {
  const parsed = parseAidAnswer(values.body)
  if (!parsed.ok) context.addIssue({ code: z.ZodIssueCode.custom, message: parsed.code, path: ["body"] })
})
type AnswerValues = z.infer<typeof answerSchema>

/** Le texte d'une réponse : à écrire, ou à corriger (sa version lue). */
function AnswerEditor(props: {
  readonly label: string
  readonly submitLabel: string
  readonly initial: string
  readonly onSubmit: (body: string) => Promise<ActionResult<unknown>>
  readonly onDone: () => void
  readonly onCancel?: () => void
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const task = useAidTask()
  const form = useForm<AnswerValues>({ resolver: zodResolver(answerSchema), defaultValues: { body: props.initial } })
  const message = form.formState.errors.body?.message
  const submit = form.handleSubmit(({ body }) => task.run(() => props.onSubmit(body), () => {
    form.reset({ body: "" })
    props.onDone()
  }))
  return (
    <form noValidate onSubmit={submit} className="flex min-w-0 flex-col gap-3">
      <Field id={`${id}-reponse`} label={props.label} hint={t("mutualAid.answers.hint", { max: AID_ANSWER_MAX_LENGTH })} error={message ? t(errorKey(message)) : undefined}>
        {(field) => <Textarea id={field.id} rows={4} maxLength={AID_ANSWER_MAX_LENGTH} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("body")} />}
      </Field>
      {task.error ? <p role="alert" className="text-sm font-medium text-destructive">{t(errorKey(task.error))}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={task.busy} aria-busy={task.busy}>{task.busy ? t("common.pleaseWait") : props.submitLabel}</Button>
        {props.onCancel ? <Button type="button" variant="ghost" disabled={task.busy} onClick={props.onCancel}>{t("common.cancel")}</Button> : null}
      </div>
    </form>
  )
}

function AnswerItem(props: {
  readonly capability: MutualAidCapability
  readonly question: AidQuestionDetailView
  readonly answer: AidAnswerView
  readonly busy: string | null
  readonly onGesture: (key: string, done: "accepted" | "unaccepted" | "answerWithdrawn", work: () => ReturnType<MutualAidCapability["acceptAnswer"]>) => Promise<boolean>
  readonly highlighted?: boolean
}) {
  const { t, locale } = useDiasporaleT()
  const [editing, setEditing] = useState(false)
  const { answer, question } = props
  const canChange = answer.isMine && !answer.isAccepted && question.status !== "closed"
  // G9 : la réponse d'autrui se signale ; signalée, elle est masquée pour la personne qui l'a signalée.
  const reportTarget: ContentReportTarget = { kind: "diasporaAidAnswer", id: answer.id }
  return (
    <li className={props.highlighted ? "flex min-w-0 flex-col gap-3 rounded-xl border-2 border-primary bg-card p-4" : "flex min-w-0 flex-col gap-3 rounded-xl border border-border p-4"}>
      <ReportedContent target={reportTarget}>
        {props.highlighted ? (
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <CheckCircle2Icon aria-hidden className="size-4" />{t("mutualAid.answers.accepted")}
          </p>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <AidPersonName person={answer.author} />
          <span className="text-muted-foreground">{t("mutualAid.answers.answeredOn", { date: formatDate(answer.createdAt, locale) })}</span>
          {answer.editedAt !== null ? <span className="text-muted-foreground">{t("mutualAid.edited")}</span> : null}
          {/* G9 : l'état de modération de sa réponse, à son auteur seul. */}
          {answer.isMine ? <AidModerationChip state={answer.moderation} /> : null}
        </div>
        {editing ? (
          <AnswerEditor
            label={t("mutualAid.answers.editLabel")}
            submitLabel={t("mutualAid.answers.saveEdit")}
            initial={answer.body}
            onSubmit={(body) => props.capability.updateAnswer({ answerId: answer.id, expectedVersion: answer.version, body })}
            onDone={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{answer.body}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {question.canEdit && !answer.isAccepted ? (
            <Button
              variant="outline"
              disabled={props.busy !== null}
              aria-busy={props.busy === `accept:${answer.id}`}
              onClick={() => void props.onGesture(`accept:${answer.id}`, "accepted", () => props.capability.acceptAnswer({ questionId: question.id, answerId: answer.id, expectedVersion: question.version }))}
            >
              {t("mutualAid.answers.accept")}
            </Button>
          ) : null}
          {question.canEdit && answer.isAccepted ? (
            <Button
              variant="outline"
              disabled={props.busy !== null}
              aria-busy={props.busy === "unaccept"}
              onClick={() => void props.onGesture("unaccept", "unaccepted", () => props.capability.unacceptAnswer({ questionId: question.id, expectedVersion: question.version }))}
            >
              {t("mutualAid.answers.unaccept")}
            </Button>
          ) : null}
          {canChange && !editing ? <Button variant="ghost" disabled={props.busy !== null} onClick={() => setEditing(true)}>{t("mutualAid.answers.edit")}</Button> : null}
          {answer.isMine ? (
            <AidConfirmButton
              label={t("mutualAid.answers.withdraw")}
              title={t("mutualAid.answers.withdrawConfirm.title")}
              body={t("mutualAid.answers.withdrawConfirm.body")}
              confirmLabel={t("mutualAid.answers.withdrawConfirm.confirm")}
              destructive
              busy={props.busy !== null}
              onConfirm={() => props.onGesture(`withdraw:${answer.id}`, "answerWithdrawn", () => props.capability.withdrawAnswer({ answerId: answer.id, expectedVersion: answer.version }))}
            />
          ) : (
            <ReportContentAction target={reportTarget} />
          )}
        </div>
      </ReportedContent>
    </li>
  )
}

export function AidQuestionDetail(props: { readonly capability: MutualAidCapability; readonly question: AidQuestionDetailView }) {
  const { t, locale } = useDiasporaleT()
  const router = useRouter()
  const { capability, question } = props
  const { busy, run } = useGuardedAction()
  const [feedback, setFeedback] = useState<AssociationFeedback | null>(null)
  const [editing, setEditing] = useState(false)
  const announcer = useRef<HTMLDivElement>(null)
  const back = routes.mutualAid(question.country, question.city ?? undefined)
  // G9 : l'avis de modération, à l'auteur seul ; retirée, la question ne reçoit plus de réponse (le fournisseur refuserait).
  const banner = question.isMine ? moderationBannerState(question.moderation) : null
  const removed = banner === "rejected"

  const gesture = useCallback(async (key: string, done: string, work: () => ReturnType<MutualAidCapability["acceptAnswer"]>): Promise<boolean> => {
    setFeedback(null)
    const result = await run(key, work)
    if (!result) return false
    setFeedback(result.ok ? { tone: "status", text: t(`mutualAid.feedback.${done}`) } : { tone: "alert", text: t(errorKey(result.code)) })
    if (result.ok) announcer.current?.focus()
    return result.ok
  }, [run, t])

  // G9 : la question d'autrui se signale ; signalée, la fiche entière est masquée pour la personne.
  const reportTarget: ContentReportTarget = { kind: "diasporaAidQuestion", id: question.id }
  const article = (
    <article className="flex min-w-0 flex-col gap-5" aria-labelledby="question-entraide">
      <NextLink href={back} className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium text-primary hover:underline focus-visible:shadow-focus">
        <ArrowLeftIcon aria-hidden className="size-4" />{t("mutualAid.backToList")}
      </NextLink>
      <header className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <AidThemeChip theme={question.theme} />
          <AidQuestionStatusChip status={question.status} />
        </div>
        <h1 id="question-entraide" className="break-words font-display text-3xl font-bold leading-tight">{question.title}</h1>
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>{t("mutualAid.askedBy")}</span>
          <AidPersonName person={question.author} />
          <span>{t("mutualAid.askedOn", { date: formatDate(question.createdAt, locale) })}</span>
          <span aria-hidden>·</span>
          <AidPlace country={question.country} city={question.city} />
          {question.editedAt !== null ? <span>{t("mutualAid.edited")}</span> : null}
        </p>
      </header>
      {banner !== null ? <ModerationBanner state={banner} /> : null}
      {question.detail ? <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{question.detail}</p> : null}

      {question.isMine ? (
        <div className="flex flex-wrap items-center gap-2">
          {question.canEdit ? <Button variant="outline" disabled={busy !== null} onClick={() => setEditing(true)}>{t("mutualAid.question.edit")}</Button> : null}
          {question.canEdit ? (
            <AidConfirmButton
              label={t("mutualAid.question.close")}
              title={t("mutualAid.question.closeConfirm.title")}
              body={t("mutualAid.question.closeConfirm.body")}
              confirmLabel={t("mutualAid.question.closeConfirm.confirm")}
              busy={busy !== null}
              onConfirm={() => gesture("close", "closed", () => capability.closeQuestion({ questionId: question.id, expectedVersion: question.version }))}
            />
          ) : null}
          <AidConfirmButton
            label={t("mutualAid.question.withdraw")}
            title={t("mutualAid.question.withdrawConfirm.title")}
            body={t("mutualAid.question.withdrawConfirm.body")}
            confirmLabel={t("mutualAid.question.withdrawConfirm.confirm")}
            destructive
            busy={busy !== null}
            onConfirm={async () => {
              const ok = await gesture("withdraw", "withdrawn", () => capability.withdrawQuestion({ questionId: question.id, expectedVersion: question.version }))
              if (ok) router.push(back)
              return ok
            }}
          />
        </div>
      ) : (
        <ReportContentAction target={reportTarget} className="self-start" />
      )}

      <div ref={announcer} tabIndex={-1} className="min-w-0 rounded-md focus-visible:shadow-focus">
        <FeedbackLine feedback={feedback} />
      </div>

      {question.acceptedAnswer ? (
        <section aria-label={t("mutualAid.answers.accepted")}>
          <ul className="flex min-w-0 flex-col">
            <AnswerItem capability={capability} question={question} answer={question.acceptedAnswer} busy={busy} onGesture={gesture} highlighted />
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="reponses-entraide" className="flex min-w-0 flex-col gap-3">
        <h2 id="reponses-entraide" className="text-lg font-semibold">{t("mutualAid.answers.title", { count: question.answerCount })}</h2>
        <ServicePager
          read={(cursor) => capability.useAnswers({ questionId: question.id, cursor })}
          keyOf={(answer) => answer.id}
          empty={<EmptyState icon={<MessageCircleQuestionIcon />} title={t("mutualAid.answers.emptyTitle")} description={t("mutualAid.answers.emptyBody")} />}
        >
          {(answers) => {
            // La réponse retenue est déjà mise en avant au-dessus.
            const others = answers.filter((answer) => answer.id !== question.acceptedAnswer?.id)
            return others.length > 0 ? (
              <ul className="flex min-w-0 flex-col gap-3">
                {others.map((answer) => <AnswerItem key={answer.id} capability={capability} question={question} answer={answer} busy={busy} onGesture={gesture} />)}
              </ul>
            ) : null
          }}
        </ServicePager>
      </section>

      {removed ? null : (
        <Card className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
          <h2 className="text-lg font-semibold">{t("mutualAid.answers.yourAnswer")}</h2>
          {question.canAnswer ? (
            <AnswerEditor
              label={t("mutualAid.answers.writeLabel")}
              submitLabel={t("mutualAid.answers.submit")}
              initial=""
              onSubmit={(body) => capability.answer({ questionId: question.id, body })}
              onDone={() => setFeedback({ tone: "status", text: t("mutualAid.feedback.answered") })}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t(question.status === "closed" ? "mutualAid.answers.closed" : "mutualAid.answers.cannotAnswer")}</p>
          )}
          <p className="text-[13px] text-muted-foreground">{t("mutualAid.privateContact")}</p>
        </Card>
      )}

      {editing ? (
        <Sheet open onOpenChange={(open) => { if (!open) setEditing(false) }}>
          <SheetContent title={t("mutualAid.question.editTitle")} description={t("mutualAid.question.editDescription")} closeLabel={t("common.close")}>
            <AidQuestionForm
              capability={capability}
              initial={question}
              defaultCountry={question.country}
              defaultCity={question.city ?? ""}
              onSaved={() => {
                setEditing(false)
                setFeedback({ tone: "status", text: t("mutualAid.feedback.questionSaved") })
              }}
              onCancel={() => setEditing(false)}
            />
          </SheetContent>
        </Sheet>
      ) : null}
    </article>
  )
  return <ReportedContent target={reportTarget} back={{ href: back, label: t("mutualAid.backToList") }}>{article}</ReportedContent>
}
