"use client"

import { Button, Field, Skeleton, Textarea, formatDate } from "@diasporale/features"
import {
  APPEAL_REASON_MAX,
  APPEAL_REASON_MIN,
  type ActionErrorCode,
  type ActionResult,
  type DecisionAppealLevel,
  type Loadable,
  type ModerationDecisionView,
  type ModerationDecisionsPage,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { ScaleIcon } from "lucide-react"
import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/**
 * Les décisions de modération et leur recours, communs à « Mes données »
 * (décisions qui me concernent, DG-026) et à la gestion d'une page (décisions qui
 * ont retiré un contenu porté par la page, P16 · G9) : la fiche d'une décision,
 * le recours motivé, la pagination par curseurs et les messages d'issue.
 *
 * Aucun déclarant, aucun contenu, aucune identité du modérateur : seulement ce
 * qu'il faut pour comprendre et contester. Le geste de recours est fourni par
 * l'appelant (`appeal`), lié à la personne ou à la page affichée.
 */

export interface Feedback {
  readonly key: string
  readonly values?: Readonly<Record<string, string | number>>
  readonly error: boolean
}

/** Les bornes du motif accompagnent toute phrase d'erreur (seule `appeal_reason_length` les cite). */
export const REASON_BOUNDS = { min: APPEAL_REASON_MIN, max: APPEAL_REASON_MAX } as const

export function errorFeedback(code: ActionErrorCode): Feedback {
  return { key: `errors.${code}`, values: REASON_BOUNDS, error: true }
}

/** Vrai tant que le panneau est monté : une réponse arrivée après lui ne change plus rien. */
export function useMounted(): RefObject<boolean> {
  const mounted = useRef(false)
  useLayoutEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  return mounted
}

/** Un message d'issue ; le focus s'y pose après un geste dont le bouton a disparu. */
export function useFeedback() {
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [focusPending, setFocusPending] = useState(false)
  const line = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (!focusPending || feedback === null) return
    line.current?.focus()
    setFocusPending(false)
  }, [focusPending, feedback])
  const show = (next: Feedback | null, focus = false) => {
    setFeedback(next)
    if (focus) setFocusPending(true)
  }
  return { feedback, show, line }
}

export function FeedbackLine({ feedback, line }: { feedback: Feedback | null; line?: RefObject<HTMLParagraphElement | null> }) {
  const { t } = useDiasporaleT()
  if (feedback === null) return null
  return (
    <p
      ref={line}
      tabIndex={-1}
      role={feedback.error ? "alert" : "status"}
      className={feedback.error ? "rounded-md text-sm text-destructive focus-visible:shadow-focus" : "rounded-md text-sm text-foreground focus-visible:shadow-focus"}
    >
      {t(feedback.key, feedback.values)}
    </p>
  )
}

export function LoadingLine() {
  const { t } = useDiasporaleT()
  return (
    <div role="status" className="flex flex-col gap-2">
      <span className="sr-only">{t("settings.dataRights.loading")}</span>
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  )
}

// ── Pagination ─────────────────────────────────────────────────────────────

/** Les curseurs déjà parcourus : « précédent » revient sans relire, « suivant » ne boucle jamais. */
export interface DecisionNavigation {
  readonly cursor: string | null
  readonly index: number
  readonly canPrevious: boolean
  previous(): void
  canNext(nextCursor: string | null): boolean
  next(nextCursor: string): void
}

export function useDecisionNavigation(): DecisionNavigation {
  const [navigation, setNavigation] = useState<{ cursors: readonly (string | null)[]; index: number }>({ cursors: [null], index: 0 })
  return {
    cursor: navigation.cursors[navigation.index] ?? null,
    index: navigation.index,
    canPrevious: navigation.index > 0,
    previous: () => setNavigation((current) => ({ ...current, index: Math.max(0, current.index - 1) })),
    canNext: (nextCursor) => nextCursor !== null && !navigation.cursors.slice(0, navigation.index + 1).includes(nextCursor),
    next: (nextCursor) => setNavigation((current) => ({ cursors: [...current.cursors.slice(0, current.index + 1), nextCursor], index: current.index + 1 })),
  }
}

/** Le recours, lié par l'appelant à la personne ou à la page affichée. */
export type AppealGesture = (input: { readonly reportId: string; readonly reason: string }) => Promise<ActionResult<{ readonly created: boolean }>>

/** Les phrases propres à la liste : vide, page vide, lecture refusée. */
export interface DecisionsCopy {
  readonly empty: string
  readonly emptyPage: string
  readonly loadError: string
}

/** Une fenêtre de décisions : chargement, refus, vide, fiches, puis la pagination. */
export function DecisionResults(props: { query: Loadable<ModerationDecisionsPage>; navigation: DecisionNavigation; appeal: AppealGesture; copy: DecisionsCopy }) {
  const { t } = useDiasporaleT()
  const { query, navigation } = props
  const nextCursor = query.status === "ready" && !query.data.isDone ? query.data.continueCursor : null
  const canNext = navigation.canNext(nextCursor)

  return (
    <>
      {query.status === "loading" ? (
        <LoadingLine />
      ) : query.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">{t(props.copy.loadError)}</p>
      ) : query.data.items.length === 0 ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
          {t(navigation.index > 0 ? props.copy.emptyPage : props.copy.empty)}
        </p>
      ) : (
        <ul className="flex min-w-0 flex-col gap-3">
          {query.data.items.map((decision) => (
            <DecisionItem key={decision.reportId} decision={decision} appeal={props.appeal} />
          ))}
        </ul>
      )}
      {navigation.canPrevious || canNext ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" disabled={!navigation.canPrevious} onClick={navigation.previous}>
            {t("settings.dataRights.decisions.previous")}
          </Button>
          <span className="text-sm text-muted-foreground">{t("settings.dataRights.decisions.page", { number: navigation.index + 1 })}</span>
          <Button
            variant="outline"
            disabled={!canNext}
            onClick={() => {
              if (nextCursor === null) return
              navigation.next(nextCursor)
            }}
          >
            {t("settings.dataRights.decisions.next")}
          </Button>
        </div>
      ) : null}
    </>
  )
}

// ── Une décision ───────────────────────────────────────────────────────────

export function DecisionItem({ decision, appeal }: { decision: ModerationDecisionView; appeal: AppealGesture }) {
  const { t, locale } = useDiasporaleT()
  const { feedback, show, line } = useFeedback()
  const network = decision.network === "diasporale"
    ? t("brand.name")
    : decision.network === "antsia" ? t("settings.rootName") : t("settings.dataRights.decisions.otherNetwork")
  const ground = decision.ground === "pre_review"
    ? t("settings.dataRights.decisions.preReview")
    : decision.ground === "unspecified" ? t("settings.dataRights.decisions.unspecified") : t(`report.reason.${decision.ground}`)

  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{t(`settings.dataRights.decisions.surface.${decision.surface}`)}</p>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{t(`settings.dataRights.decisions.status.${decision.status}`)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("settings.dataRights.decisions.network", { name: network })} · {t("settings.dataRights.decisions.openedAt", { date: formatDate(decision.createdAt, locale) })}
      </p>
      <p className="text-sm">{t("settings.dataRights.decisions.ground", { ground })}</p>
      {decision.decisionReason ? (
        <p className="whitespace-pre-line break-words text-sm">{t("settings.dataRights.decisions.decisionReason", { reason: decision.decisionReason })}</p>
      ) : null}
      {decision.sanctions.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-muted-foreground">{t("settings.dataRights.decisions.sanctionsLabel")}</p>
          <ul className="flex flex-col gap-1 text-sm">
            {decision.sanctions.map((sanction) => (
              <li key={sanction.kind} className="break-words">
                <span className="font-medium">{t(`settings.dataRights.decisions.sanction.${sanction.kind}`)}</span>
                {" · "}
                {t(`settings.dataRights.decisions.sanctionStatus.${sanction.status}`)}
                {sanction.status === "active" && sanction.until !== null ? (
                  <>
                    {" · "}
                    {t("settings.dataRights.decisions.sanctionUntil", { date: formatDate(sanction.until, locale) })}
                  </>
                ) : null}
                {sanction.reason && sanction.reason !== decision.decisionReason ? (
                  <span className="block whitespace-pre-line text-muted-foreground">{t("settings.dataRights.decisions.sanctionReason", { reason: sanction.reason })}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {decision.appeals.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-muted-foreground">{t("settings.dataRights.decisions.appealsLabel")}</p>
          <ul className="flex flex-col gap-1 text-sm">
            {decision.appeals.map((item) => (
              <li key={item.level} className="break-words">
                {t("settings.dataRights.decisions.appealLine", {
                  level: t(`settings.dataRights.decisions.appealLevel.${item.level}`),
                  status: t(`settings.dataRights.decisions.appealStatus.${item.status}`),
                })}
                {item.decisionReason ? (
                  <span className="block whitespace-pre-line text-muted-foreground">{t("settings.dataRights.decisions.appealAnswer", { reason: item.decisionReason })}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <FeedbackLine feedback={feedback} line={line} />
      {decision.appealLevel ? (
        <AppealControl
          key={decision.appealLevel}
          appeal={appeal}
          reportId={decision.reportId}
          level={decision.appealLevel}
          onOpen={() => show(null)}
          onDone={(next) => show(next, true)}
        />
      ) : null}
    </li>
  )
}

const appealSchema = z.object({
  reason: z.string().trim().min(APPEAL_REASON_MIN, "appeal_reason_length").max(APPEAL_REASON_MAX, "appeal_reason_length"),
})
type AppealValues = z.infer<typeof appealSchema>

function AppealControl(props: {
  appeal: AppealGesture
  reportId: string
  level: DecisionAppealLevel
  onOpen: () => void
  onDone: (feedback: Feedback) => void
}) {
  const { t } = useDiasporaleT()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  useEffect(() => {
    if (open || !restoreFocus.current) return
    restoreFocus.current = false
    trigger.current?.focus()
  }, [open])

  if (!open) {
    return (
      <Button
        ref={trigger}
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => {
          props.onOpen()
          setOpen(true)
        }}
      >
        <ScaleIcon aria-hidden />
        {t("settings.dataRights.decisions.appeal")}
      </Button>
    )
  }
  return (
    <AppealForm
      appeal={props.appeal}
      reportId={props.reportId}
      level={props.level}
      onCancel={() => {
        restoreFocus.current = true
        setOpen(false)
      }}
      onDone={(feedback) => {
        setOpen(false)
        props.onDone(feedback)
      }}
    />
  )
}

function AppealForm(props: {
  appeal: AppealGesture
  reportId: string
  level: DecisionAppealLevel
  onCancel: () => void
  onDone: (feedback: Feedback) => void
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const mounted = useMounted()
  const locked = useRef(false)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const form = useForm<AppealValues>({ resolver: zodResolver(appealSchema), defaultValues: { reason: "" } })
  const reasonField = form.register("reason")
  const reasonInput = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => { reasonInput.current?.focus() }, [])

  // Le verrou n'est lu qu'au geste : la soumission est construite dans le gestionnaire, jamais au rendu.
  const send = async (values: AppealValues) => {
    if (locked.current) return
    locked.current = true
    setError(null)
    try {
      const result = await props.appeal({ reportId: props.reportId, reason: values.reason })
      if (!mounted.current) return
      if (!result.ok) {
        setError(result.code)
        return
      }
      props.onDone({ key: result.value.created ? "settings.dataRights.decisions.appealSent" : "settings.dataRights.decisions.appealExists", error: false })
    } catch {
      if (mounted.current) setError("unknown")
    } finally {
      locked.current = false
    }
  }

  const invalid = form.formState.errors.reason?.message
  const busy = form.formState.isSubmitting
  return (
    <form noValidate onSubmit={(event) => void form.handleSubmit(send)(event)} className="flex w-full min-w-0 flex-col gap-3 rounded-xl bg-muted p-4">
      <p className="text-[13px] leading-snug text-muted-foreground">{t(`settings.dataRights.decisions.appealHint.${props.level}`)}</p>
      <Field
        id={`${id}-motif`}
        label={t("settings.dataRights.decisions.appealReason")}
        hint={t("settings.dataRights.decisions.appealReasonHint", REASON_BOUNDS)}
        error={invalid ? t(`errors.${invalid}`, REASON_BOUNDS) : undefined}
      >
        {(field) => (
          <Textarea
            id={field.id}
            aria-describedby={field.describedBy}
            aria-invalid={field.invalid || undefined}
            maxLength={APPEAL_REASON_MAX}
            rows={3}
            disabled={busy}
            {...reasonField}
            ref={(element) => {
              reasonField.ref(element)
              reasonInput.current = element
            }}
          />
        )}
      </Field>
      {error ? <p role="alert" className="text-sm text-destructive">{t(`errors.${error}`, REASON_BOUNDS)}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>{busy ? t("common.pleaseWait") : t("settings.dataRights.decisions.appealSubmit")}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={props.onCancel}>{t("common.cancel")}</Button>
      </div>
    </form>
  )
}
