"use client"

/**
 * Feuilles de confirmation des gestes sur une demande de service (DG-014/015) :
 * un geste qui engage (accepter, annuler, décliner, constater) se confirme, et
 * son motif, quand il est requis, se saisit ici. PROPRIÉTAIRE : chantier
 * « demandes et rendez-vous ».
 */
import { SERVICE_REASON_MAX_LENGTH } from "@diasporale/domain"
import { Button, Field, Sheet, SheetContent, Textarea } from "@diasporale/features"
import type { ActionErrorCode } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

/** Un geste confirmé : rend `null` s'il a abouti, son code fermé sinon. */
export type ServiceGesture = () => Promise<ActionErrorCode | null>

/** Garde un geste à la fois et ignore une réponse arrivée après la fermeture. */
function useGesture() {
  const locked = useRef(false)
  const active = useRef(true)
  useLayoutEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const run = async (gesture: ServiceGesture): Promise<boolean> => {
    if (locked.current) return false
    locked.current = true
    setBusy(true)
    setError(null)
    try {
      const code = await gesture()
      if (active.current) setError(code)
      return code === null
    } catch {
      if (active.current) setError("unknown")
      return false
    } finally {
      locked.current = false
      if (active.current) setBusy(false)
    }
  }
  return { busy, error, run, reset: () => setError(null) }
}

/** Une confirmation simple : ce qui va se passer, puis le geste. */
export function ConfirmSheet(props: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly description: string
  readonly confirmLabel: string
  readonly destructive?: boolean
  readonly children?: ReactNode
  readonly onConfirm: ServiceGesture
}) {
  const { t } = useDiasporaleT()
  const gesture = useGesture()
  const close = (open: boolean) => {
    if (gesture.busy) return
    if (!open) gesture.reset()
    props.onOpenChange(open)
  }
  return (
    <Sheet open={props.open} onOpenChange={close}>
      <SheetContent title={props.title} description={props.description} closeLabel={t("serviceRequests.sheet.close")}>
        <div className="flex flex-col gap-4">
          {props.children}
          {gesture.error ? <p role="alert" className="text-sm font-medium text-destructive">{t(`errors.${gesture.error}`)}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={props.destructive ? "destructive" : "primary"}
              disabled={gesture.busy}
              aria-busy={gesture.busy}
              onClick={async () => {
                if (await gesture.run(props.onConfirm)) props.onOpenChange(false)
              }}
            >
              {gesture.busy ? t("serviceRequests.sheet.working") : props.confirmLabel}
            </Button>
            <Button variant="ghost" disabled={gesture.busy} onClick={() => close(false)}>{t("serviceRequests.sheet.back")}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Un geste avec motif : facultatif (décliner, retirer sa demande) ou requis (annuler un rendez-vous convenu). */
export function ReasonSheet(props: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly description: string
  readonly label: string
  readonly hint: string
  readonly required: boolean
  readonly confirmLabel: string
  readonly onConfirm: (reason: string | null) => Promise<ActionErrorCode | null>
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const gesture = useGesture()
  const { required } = props
  const schema = useMemo(
    () =>
      z
        .object({ reason: z.string().trim().max(SERVICE_REASON_MAX_LENGTH, "request_reason_too_long") })
        .refine((values) => !required || values.reason.length > 0, { message: "request_reason_required", path: ["reason"] }),
    [required],
  )
  const form = useForm<{ reason: string }>({ resolver: zodResolver(schema), defaultValues: { reason: "" } })
  const close = (open: boolean) => {
    if (gesture.busy) return
    if (!open) {
      gesture.reset()
      form.reset({ reason: "" })
    }
    props.onOpenChange(open)
  }
  const submit = form.handleSubmit(async (values) => {
    const reason = values.reason.trim()
    if (await gesture.run(() => props.onConfirm(reason.length > 0 ? reason : null))) {
      form.reset({ reason: "" })
      props.onOpenChange(false)
    }
  })
  const fieldError = form.formState.errors.reason?.message
  return (
    <Sheet open={props.open} onOpenChange={close}>
      <SheetContent title={props.title} description={props.description} closeLabel={t("serviceRequests.sheet.close")}>
        <form noValidate className="flex flex-col gap-4" onSubmit={submit}>
          <Field id={`${id}-motif`} label={props.label} hint={props.hint} error={fieldError ? t(`errors.${fieldError}`) : undefined}>
            {(field) => (
              <Textarea
                id={field.id}
                aria-describedby={field.describedBy}
                aria-invalid={field.invalid || undefined}
                aria-required={props.required || undefined}
                maxLength={SERVICE_REASON_MAX_LENGTH}
                rows={3}
                disabled={gesture.busy}
                {...form.register("reason")}
              />
            )}
          </Field>
          {gesture.error ? <p role="alert" className="text-sm font-medium text-destructive">{t(`errors.${gesture.error}`)}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="destructive" disabled={gesture.busy} aria-busy={gesture.busy}>
              {gesture.busy ? t("serviceRequests.sheet.working") : props.confirmLabel}
            </Button>
            <Button type="button" variant="ghost" disabled={gesture.busy} onClick={() => close(false)}>{t("serviceRequests.sheet.back")}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
