"use client"

/**
 * EV-03 : annuler un événement d'association. Le motif se choisit dans une liste FERMÉE (plan 08,
 * décision 2 : lieu indisponible, météo, organisateur empêché, autre), sans texte libre — rien à
 * modérer dans l'urgence ; il se lit sur la fiche, avec les droits du lecteur. L'écran ne promet un
 * avis aux inscrits que si le fournisseur l'écrit (`outcomeNotices`) ; la démonstration le simule
 * dans ce navigateur, et le dit.
 */
import { Button, RadioCard, RadioGroup, Sheet, SheetContent } from "@diasporale/features"
import {
  ASSOCIATION_EVENT_CANCELLATION_REASONS,
  isAssociationEventCancellationReason,
  type ActionErrorCode,
  type AssociationEventCancellationReason,
  type AssociationEventCancellationView,
  type AssociationEventsCapability,
  type AssociationEventView,
  type Loadable,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useLayoutEffect, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

/** Le libellé de chaque motif de la liste fermée. */
export const ASSOCIATION_EVENT_CANCELLATION_LABELS: Readonly<Record<AssociationEventCancellationReason, string>> = {
  venue_unavailable: "associationActivities.eventCancel.reason.venue_unavailable",
  weather: "associationActivities.eventCancel.reason.weather",
  organizer_unavailable: "associationActivities.eventCancel.reason.organizer_unavailable",
  other: "associationActivities.eventCancel.reason.other",
}

const cancelSchema = z.object({ reason: z.string() }).superRefine((values, context) => {
  if (!isAssociationEventCancellationReason(values.reason)) context.addIssue({ code: z.ZodIssueCode.custom, message: "association_event_cancel_reason_required", path: ["reason"] })
})
type CancelValues = z.infer<typeof cancelSchema>

export function AssociationEventCancelSheet(props: {
  readonly event: AssociationEventView
  readonly capability: AssociationEventsCapability
  readonly onClose: () => void
  readonly onCancelled: () => void
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const locked = useRef(false)
  const mounted = useRef(true)
  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const form = useForm<CancelValues>({ resolver: zodResolver(cancelSchema), defaultValues: { reason: "" } })
  const reasonError = form.formState.errors.reason?.message

  // Une seule annulation à la fois, même sur deux validations rapprochées ; une réponse tardive après fermeture est ignorée.
  const send = async ({ reason }: CancelValues) => {
    if (locked.current || !isAssociationEventCancellationReason(reason)) return
    locked.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await props.capability.cancel({ eventId: props.event.eventId, expectedVersion: props.event.version, reason })
      if (!mounted.current) return
      if (result.ok) props.onCancelled()
      else setError(result.code)
    } catch {
      if (mounted.current) setError("unknown")
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const notices = props.capability.outcomeNotices
  return (
    <Sheet open onOpenChange={(open) => { if (!open && !busy) props.onClose() }}>
      <SheetContent title={t("associationActivities.event.cancelEvent")} description={t("associationActivities.event.cancelDescription")} closeLabel={t("associationActivities.close")}>
        <form noValidate className="flex flex-col gap-4" onSubmit={(formEvent) => void form.handleSubmit(send)(formEvent)}>
          <div className="flex min-w-0 flex-col gap-2">
            <p id={`${id}-motif`} className="text-sm font-medium">{t("associationActivities.eventCancel.reasonLegend")}</p>
            <p id={`${id}-aide`} className="text-[13px] text-muted-foreground">{t("associationActivities.eventCancel.reasonHint")}</p>
            <Controller
              control={form.control}
              name="reason"
              render={({ field }) => (
                <RadioGroup
                  aria-labelledby={`${id}-motif`}
                  aria-describedby={reasonError ? `${id}-aide ${id}-erreur` : `${id}-aide`}
                  aria-invalid={reasonError ? true : undefined}
                  aria-required
                  disabled={busy}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  {ASSOCIATION_EVENT_CANCELLATION_REASONS.map((reason) => <RadioCard key={reason} value={reason}>{t(ASSOCIATION_EVENT_CANCELLATION_LABELS[reason])}</RadioCard>)}
                </RadioGroup>
              )}
            />
            {reasonError ? <p id={`${id}-erreur`} role="alert" className="text-[13px] font-medium text-destructive">{t(`errors.${reasonError}`)}</p> : null}
          </div>
          {notices ? <p className="text-sm">{t("associationActivities.eventCancel.notice")}</p> : null}
          {notices === "simulated" ? <p className="text-sm text-muted-foreground">{t("associationActivities.eventCancel.noticeDemo")}</p> : null}
          {error ? <p role="alert" className="text-sm font-medium text-destructive">{t(`errors.${error}`)}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="destructive" disabled={busy} aria-busy={busy}>{t(busy ? "associationActivities.working" : "associationActivities.event.cancelEvent")}</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={props.onClose}>{t("associationActivities.eventCancel.back")}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/** EV-03 : le motif d'un événement annulé, relu avec les droits du lecteur ; rien tant qu'il ne se lit pas, ni sans motif. */
export function AssociationEventCancellationReason(props: { readonly eventId: string; readonly useCancellation: (eventId: string) => Loadable<AssociationEventCancellationView | null> }) {
  const { t } = useDiasporaleT()
  const cancellation = props.useCancellation(props.eventId)
  if (cancellation.status !== "ready" || !cancellation.data?.reason) return null
  return <p className="text-sm">{t("associationActivities.eventCancellation.reason", { reason: t(ASSOCIATION_EVENT_CANCELLATION_LABELS[cancellation.data.reason]) })}</p>
}
