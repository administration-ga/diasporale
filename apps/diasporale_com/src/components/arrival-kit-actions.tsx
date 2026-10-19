"use client"

/**
 * Les gestes sur une ressource du kit d'arrivée (DG-024 b), tels que le fournisseur
 * les a jugés pour CE lecteur (`viewer`) : signaler une information périmée (une fois
 * par version, motif fermé), modifier, soumettre ou retirer la sienne, relire —
 * publier ou renvoyer avec un motif — et marquer « à revoir ». Une action à la fois,
 * une issue annoncée (`role="status"` ou `role="alert"`), chaque formulaire en
 * React Hook Form + Zod. Signaler un abus ou une fausse information, DISTINCT de
 * l'information périmée, passe par la modération (G9, chantier « confiance des
 * surfaces »). PROPRIÉTAIRE : chantier « kit d'arrivée ».
 */
import {
  ARRIVAL_KIT_OUTDATED_FLAG_THRESHOLD,
  ARRIVAL_KIT_OUTDATED_REASONS,
  ARRIVAL_KIT_REASON_MAX_LENGTH,
  ARRIVAL_KIT_REASON_MIN_LENGTH,
  isArrivalKitListed,
  type ArrivalKitOutdatedReason,
} from "@diasporale/domain"
import { Button, Field, Sheet, SheetClose, SheetContent, Textarea } from "@diasporale/features"
import type { ActionErrorCode, ActionResult, ArrivalKitCapability, ArrivalKitFeedbackKind, ArrivalKitResourceDetailView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { FlagIcon } from "lucide-react"
import { useId, useRef, useState, type FormEvent } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { ArrivalKitResourceForm } from "./arrival-kit-form"
import { type AssociationFeedback, errorKey, FeedbackLine, useGuardedAction } from "./association-parts"
import { ReportContentAction, useOptionalContentReports } from "./report-content-sheet"

type Dialog = "flag" | "return" | "mark" | "withdraw" | "edit"

export interface ArrivalKitResourceActionsProps {
  readonly kit: ArrivalKitCapability
  readonly resource: ArrivalKitResourceDetailView
  /** Après un geste qui retire la ressource au lecteur (un renvoi) : revenir au kit. */
  readonly onGone: () => void
}

export function ArrivalKitResourceActions(props: ArrivalKitResourceActionsProps) {
  const { t } = useDiasporaleT()
  const headingId = useId()
  const { kit, resource } = props
  const { viewer } = resource
  const { busy, run } = useGuardedAction()
  const [feedback, setFeedback] = useState<AssociationFeedback | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  // G9 : une ressource publiée d'autrui se signale (abus, fausse information) ; jamais la sienne.
  const reportable = useOptionalContentReports() !== null && !viewer.canManage && isArrivalKitListed(resource.status)

  /** Un geste direct (publier, soumettre) : l'issue se dit sous les boutons. */
  const perform = async (key: string, done: ArrivalKitFeedbackKind, work: () => Promise<ActionResult>) => {
    setFeedback(null)
    const result = await run(key, work)
    if (!result) return
    setFeedback(result.ok ? { tone: "status", text: t(`arrivalKit.feedback.${done}`) } : { tone: "alert", text: t(errorKey(result.code)) })
  }

  /** Un geste confirmé dans une feuille : fermée et annoncée au succès, le refus reste dans la feuille. */
  const finish = (done: ArrivalKitFeedbackKind) => {
    setDialog(null)
    setFeedback({ tone: "status", text: t(`arrivalKit.feedback.${done}`) })
  }

  const reviewing = viewer.canReview && resource.status === "submitted"
  const marking = viewer.canReview && resource.status !== "submitted"
  const hasActions = reviewing || marking || viewer.canManage || viewer.canFlag || reportable
  if (!hasActions && !viewer.hasFlagged && feedback === null) return null

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3">
      <h2 id={headingId} className="text-lg font-semibold">{t("arrivalKit.actions.title")}</h2>
      {viewer.hasFlagged ? <p className="text-sm text-muted-foreground">{t("arrivalKit.actions.flagged")}</p> : null}
      {hasActions ? (
        <div className="flex flex-wrap items-center gap-2">
          {reviewing ? (
            <>
              <Button
                disabled={busy !== null}
                aria-busy={busy === "publish"}
                onClick={() => void perform("publish", "published", () => kit.review({ resourceId: resource.id, expectedVersion: resource.version, decision: "publish", reason: "" }))}
              >
                {t(busy === "publish" ? "arrivalKit.actions.pleaseWait" : "arrivalKit.actions.publish")}
              </Button>
              <Button variant="outline" disabled={busy !== null} onClick={() => setDialog("return")}>{t("arrivalKit.actions.return")}</Button>
            </>
          ) : null}
          {marking ? <Button variant="outline" disabled={busy !== null} onClick={() => setDialog("mark")}>{t("arrivalKit.actions.markForReview")}</Button> : null}
          {viewer.canManage ? (
            <>
              {/* G9 : une ressource retirée par la modération ne se modifie ni ne se soumet plus (refus du moteur) ; elle se retire encore. */}
              {resource.moderation !== "removed" ? (
                <Button variant="outline" disabled={busy !== null} onClick={() => setDialog("edit")}>{t("arrivalKit.actions.edit")}</Button>
              ) : null}
              {resource.status === "draft" && resource.moderation !== "removed" ? (
                <Button
                  disabled={busy !== null}
                  aria-busy={busy === "submit"}
                  onClick={() => void perform("submit", "submitted", () => kit.submit({ resourceId: resource.id, expectedVersion: resource.version }))}
                >
                  {t(busy === "submit" ? "arrivalKit.actions.pleaseWait" : "arrivalKit.actions.submit")}
                </Button>
              ) : null}
              <Button variant="ghost" className="text-destructive" disabled={busy !== null} onClick={() => setDialog("withdraw")}>{t("arrivalKit.actions.withdraw")}</Button>
            </>
          ) : null}
          {viewer.canFlag ? (
            <Button variant="outline" disabled={busy !== null} onClick={() => setDialog("flag")}>
              <FlagIcon aria-hidden />
              {t("arrivalKit.actions.flag")}
            </Button>
          ) : null}
          {reportable ? <ReportContentAction target={{ kind: "diasporaKitResource", id: resource.id }} hint={t("contentReports.kitHint")} /> : null}
        </div>
      ) : null}
      <FeedbackLine feedback={dialog === null ? feedback : null} />

      {dialog === "flag" ? (
        <FlagSheet
          onClose={() => setDialog(null)}
          onSend={async (reason) => {
            const result = await kit.flagOutdated({ resourceId: resource.id, revision: resource.revision, reason })
            if (result.ok) finish("flagged")
            return result.ok ? null : result.code
          }}
        />
      ) : null}
      {dialog === "return" || dialog === "mark" ? (
        <ReasonSheet
          kind={dialog}
          onClose={() => setDialog(null)}
          onSend={async (reason) => {
            const result = dialog === "return"
              ? await kit.review({ resourceId: resource.id, expectedVersion: resource.version, decision: "return", reason })
              : await kit.markForReview({ resourceId: resource.id, expectedVersion: resource.version, reason })
            if (!result.ok) return result.code
            if (dialog === "return") {
              // Redevenue un brouillon, la ressource ne se lit plus par la relectrice : retour au kit.
              setDialog(null)
              toast.success(t("arrivalKit.feedback.returned"))
              props.onGone()
            } else {
              finish("marked")
            }
            return null
          }}
        />
      ) : null}
      {dialog === "withdraw" ? (
        <WithdrawSheet
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const result = await kit.withdraw({ resourceId: resource.id, expectedVersion: resource.version })
            if (result.ok) finish("withdrawn")
            return result.ok ? null : result.code
          }}
        />
      ) : null}
      {dialog === "edit" ? (
        <Sheet open onOpenChange={(open) => { if (!open) setDialog(null) }}>
          <SheetContent title={t("arrivalKit.form.editTitle")} description={t("arrivalKit.form.editDescription")} closeLabel={t("arrivalKit.actions.close")}>
            <ArrivalKitResourceForm
              mode="edit"
              initial={{
                title: resource.title,
                summary: resource.summary,
                body: resource.body,
                category: resource.category,
                country: resource.country,
                city: resource.city ?? "",
                sourceName: resource.source.name,
                sourceUrl: resource.source.url ?? "",
                lastVerifiedAt: resource.lastVerifiedAt,
              }}
              onCancel={() => setDialog(null)}
              onSave={async (input, options) => {
                const result = await kit.update({ ...input, resourceId: resource.id, expectedVersion: resource.version, submit: options.submit })
                if (!result.ok) return result.code
                finish(options.submit ? "savedSubmitted" : "savedDraft")
                return null
              }}
            />
          </SheetContent>
        </Sheet>
      ) : null}
    </section>
  )
}

/** Un envoi dans une feuille : une seule fois à la fois, même sur deux validations rapprochées. */
function useSingleSubmit() {
  const sending = useRef(false)
  return (handler: (event: FormEvent<HTMLFormElement>) => Promise<void>) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sending.current) return
    sending.current = true
    void handler(event).finally(() => { sending.current = false })
  }
}

const flagSchema = z.object({ reason: z.enum(ARRIVAL_KIT_OUTDATED_REASONS, { message: "arrival_kit_outdated_reason_invalid" }) })
type FlagValues = z.infer<typeof flagSchema>

/** Signaler une information périmée : un motif fermé, aucune saisie libre, une fois par version. */
function FlagSheet(props: { readonly onClose: () => void; readonly onSend: (reason: ArrivalKitOutdatedReason) => Promise<ActionErrorCode | null> }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const form = useForm<FlagValues>({ resolver: zodResolver(flagSchema), defaultValues: { reason: "link_broken" } })
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const single = useSingleSubmit()
  const busy = form.formState.isSubmitting
  const submit = single(form.handleSubmit(async ({ reason }) => {
    setError(null)
    setError(await props.onSend(reason))
  }))
  return (
    <Sheet open onOpenChange={(open) => { if (!open && !busy) props.onClose() }}>
      <SheetContent
        title={t("arrivalKit.actions.flagTitle")}
        description={t("arrivalKit.actions.flagDescription", { threshold: ARRIVAL_KIT_OUTDATED_FLAG_THRESHOLD })}
        closeLabel={t("arrivalKit.actions.close")}
      >
        <form noValidate className="flex flex-col gap-4" onSubmit={submit}>
          <fieldset className="flex min-w-0 flex-col gap-1">
            <legend className="mb-1.5 text-sm font-medium">{t("arrivalKit.actions.flagReason")}</legend>
            {ARRIVAL_KIT_OUTDATED_REASONS.map((reason) => (
              <label key={reason} htmlFor={`${id}-${reason}`} className="inline-flex min-h-11 items-center gap-3 rounded-md px-1 text-sm">
                <input id={`${id}-${reason}`} type="radio" value={reason} className="size-5 accent-primary" disabled={busy} {...form.register("reason")} />
                {t(`arrivalKit.outdatedReason.${reason}`)}
              </label>
            ))}
          </fieldset>
          {error ? <p role="alert" className="text-sm font-medium text-destructive">{t(errorKey(error))}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <SheetClose asChild><Button variant="ghost" disabled={busy}>{t("arrivalKit.actions.cancel")}</Button></SheetClose>
            <Button type="submit" disabled={busy} aria-busy={busy}>{t(busy ? "arrivalKit.actions.pleaseWait" : "arrivalKit.actions.flagSend")}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

const reasonSchema = z.object({
  reason: z.string().trim().min(ARRIVAL_KIT_REASON_MIN_LENGTH, "arrival_kit_reason_too_short").max(ARRIVAL_KIT_REASON_MAX_LENGTH, "arrival_kit_reason_too_long"),
})
type ReasonValues = z.infer<typeof reasonSchema>

/** Renvoyer à l'auteur ou marquer « à revoir » : un motif obligatoire, lu par qui gère la ressource. */
function ReasonSheet(props: { readonly kind: "return" | "mark"; readonly onClose: () => void; readonly onSend: (reason: string) => Promise<ActionErrorCode | null> }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const form = useForm<ReasonValues>({ resolver: zodResolver(reasonSchema), defaultValues: { reason: "" } })
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const single = useSingleSubmit()
  const busy = form.formState.isSubmitting
  const returning = props.kind === "return"
  const submit = single(form.handleSubmit(async ({ reason }) => {
    setError(null)
    setError(await props.onSend(reason))
  }))
  const reasonError = form.formState.errors.reason?.message
  return (
    <Sheet open onOpenChange={(open) => { if (!open && !busy) props.onClose() }}>
      <SheetContent
        title={t(returning ? "arrivalKit.actions.returnTitle" : "arrivalKit.actions.markTitle")}
        description={t(returning ? "arrivalKit.actions.returnDescription" : "arrivalKit.actions.markDescription")}
        closeLabel={t("arrivalKit.actions.close")}
      >
        <form noValidate className="flex flex-col gap-4" onSubmit={submit}>
          <Field
            id={`${id}-motif`}
            label={t("arrivalKit.actions.reason")}
            hint={t("arrivalKit.actions.reasonHint", { min: ARRIVAL_KIT_REASON_MIN_LENGTH, max: ARRIVAL_KIT_REASON_MAX_LENGTH })}
            error={typeof reasonError === "string" ? t(errorKey(reasonError)) : undefined}
          >
            {(field) => <Textarea id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} rows={4} maxLength={ARRIVAL_KIT_REASON_MAX_LENGTH} disabled={busy} {...form.register("reason")} />}
          </Field>
          {error ? <p role="alert" className="text-sm font-medium text-destructive">{t(errorKey(error))}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <SheetClose asChild><Button variant="ghost" disabled={busy}>{t("arrivalKit.actions.cancel")}</Button></SheetClose>
            <Button type="submit" disabled={busy} aria-busy={busy}>{t(busy ? "arrivalKit.actions.pleaseWait" : "arrivalKit.actions.confirm")}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/** Retirer sa ressource : un geste CONFIRMÉ (le focus va d'abord sur « Annuler »), terminal. */
function WithdrawSheet(props: { readonly onClose: () => void; readonly onConfirm: () => Promise<ActionErrorCode | null> }) {
  const { t } = useDiasporaleT()
  const cancel = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const confirm = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      setError(await props.onConfirm())
    } catch {
      setError("unknown")
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet open onOpenChange={(open) => { if (!open && !busy) props.onClose() }}>
      <SheetContent
        title={t("arrivalKit.actions.withdrawTitle")}
        description={t("arrivalKit.actions.withdrawBody")}
        closeLabel={t("arrivalKit.actions.close")}
        onOpenAutoFocus={(event) => { event.preventDefault(); cancel.current?.focus() }}
      >
        {error ? <p role="alert" className="mb-3 text-sm font-medium text-destructive">{t(errorKey(error))}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <SheetClose asChild><Button ref={cancel} variant="ghost" disabled={busy}>{t("arrivalKit.actions.cancel")}</Button></SheetClose>
          <Button variant="destructive" disabled={busy} aria-busy={busy} onClick={() => void confirm()}>
            {t(busy ? "arrivalKit.actions.pleaseWait" : "arrivalKit.actions.withdrawConfirm")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
