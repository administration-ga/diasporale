"use client"

/**
 * Feuilles des gestes du mentorat (DG-024, troisième tranche) : un geste qui
 * engage (accepter, décliner, retirer, clore, proposer un créneau, retirer son
 * profil) se confirme, et son motif ou son créneau se saisit ici (React Hook
 * Form + Zod). PROPRIÉTAIRE : chantier « mentorat ».
 */
import { MENTORING_REASON_MAX_LENGTH, mentoringWallTimeToUtc, type MentoringSlot } from "@diasporale/domain"
import { Button, Field, Input, RadioCard, RadioGroup, Sheet, SheetContent, Textarea } from "@diasporale/features"
import type { ActionErrorCode, MentoringSlotInput } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { MentoringSlotText } from "@/components/mentoring-ui"

/** Un geste confirmé : rend `null` s'il a abouti, son code fermé sinon. */
export type MentoringGesture = () => Promise<ActionErrorCode | null>

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
  const run = async (gesture: MentoringGesture): Promise<boolean> => {
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

function GestureError(props: { readonly code: ActionErrorCode | null }) {
  const { t } = useDiasporaleT()
  return props.code ? <p role="alert" className="text-sm font-medium text-destructive">{t(`errors.${props.code}`)}</p> : null
}

function GestureButtons(props: { readonly busy: boolean; readonly confirmLabel: string; readonly destructive?: boolean; readonly onBack: () => void }) {
  const { t } = useDiasporaleT()
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" variant={props.destructive ? "destructive" : "primary"} disabled={props.busy} aria-busy={props.busy}>
        {props.busy ? t("mentoring.sheet.working") : props.confirmLabel}
      </Button>
      <Button type="button" variant="ghost" disabled={props.busy} onClick={props.onBack}>{t("mentoring.sheet.back")}</Button>
    </div>
  )
}

/** Une confirmation simple : ce qui va se passer, puis le geste. */
export function MentoringConfirmSheet(props: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly description: string
  readonly confirmLabel: string
  readonly destructive?: boolean
  readonly children?: ReactNode
  readonly onConfirm: MentoringGesture
}) {
  const { t } = useDiasporaleT()
  const gesture = useGesture()
  const close = (open: boolean) => {
    if (gesture.busy) return
    if (!open) gesture.reset()
    props.onOpenChange(open)
  }
  const form = useForm()
  const submit = form.handleSubmit(async () => {
    if (await gesture.run(props.onConfirm)) props.onOpenChange(false)
  })
  return (
    <Sheet open={props.open} onOpenChange={close}>
      <SheetContent title={props.title} description={props.description} closeLabel={t("mentoring.sheet.close")}>
        <form noValidate className="flex flex-col gap-4" onSubmit={submit}>
          {props.children}
          <GestureError code={gesture.error} />
          <GestureButtons busy={gesture.busy} confirmLabel={props.confirmLabel} destructive={props.destructive} onBack={() => close(false)} />
        </form>
      </SheetContent>
    </Sheet>
  )
}

const reasonSchema = z.object({ reason: z.string().trim().max(MENTORING_REASON_MAX_LENGTH, "mentoring_reason_too_long") })

/** Un geste avec motif FACULTATIF (décliner, retirer sa demande, clore un mentorat). */
export function MentoringReasonSheet(props: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly description: string
  readonly label: string
  readonly hint: string
  readonly confirmLabel: string
  readonly onConfirm: (reason: string | null) => Promise<ActionErrorCode | null>
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const gesture = useGesture()
  const form = useForm<z.infer<typeof reasonSchema>>({ resolver: zodResolver(reasonSchema), defaultValues: { reason: "" } })
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
      <SheetContent title={props.title} description={props.description} closeLabel={t("mentoring.sheet.close")}>
        <form noValidate className="flex flex-col gap-4" onSubmit={submit}>
          <Field id={`${id}-motif`} label={props.label} hint={props.hint} error={fieldError ? t(`errors.${fieldError}`) : undefined}>
            {(field) => (
              <Textarea
                id={field.id}
                aria-describedby={field.describedBy}
                aria-invalid={field.invalid || undefined}
                maxLength={MENTORING_REASON_MAX_LENGTH}
                rows={3}
                disabled={gesture.busy}
                {...form.register("reason")}
              />
            )}
          </Field>
          <GestureError code={gesture.error} />
          <GestureButtons busy={gesture.busy} confirmLabel={props.confirmLabel} destructive onBack={() => close(false)} />
        </form>
      </SheetContent>
    </Sheet>
  )
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

const slotSchema = z.object({
  date: z.string().regex(DATE, "mentoring_time_invalid"),
  start: z.string().regex(TIME, "mentoring_time_invalid"),
  end: z.string().regex(TIME, "mentoring_time_invalid"),
})

type SlotValues = z.infer<typeof slotSchema>

/**
 * Proposer un créneau (date, début, fin) dans le fuseau du navigateur du
 * mentor : l'heure qui n'existe pas ou qui existe deux fois est refusée.
 */
export function MentoringSlotSheet(props: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly description: string
  readonly confirmLabel: string
  readonly timeZone: string
  readonly onConfirm: (slot: MentoringSlotInput) => Promise<ActionErrorCode | null>
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const gesture = useGesture()
  const form = useForm<SlotValues>({ resolver: zodResolver(slotSchema), defaultValues: { date: "", start: "18:00", end: "19:00" } })
  const errors = form.formState.errors
  const message = (code: string | undefined) => (code ? t(`errors.${code}`) : undefined)
  const close = (open: boolean) => {
    if (gesture.busy) return
    if (!open) gesture.reset()
    props.onOpenChange(open)
  }
  const submit = form.handleSubmit(async (values) => {
    const startAt = mentoringWallTimeToUtc({ date: values.date, time: values.start }, props.timeZone)
    if (!startAt.ok) return form.setError("start", { message: startAt.code })
    const endAt = mentoringWallTimeToUtc({ date: values.date, time: values.end }, props.timeZone)
    if (!endAt.ok) return form.setError("end", { message: endAt.code })
    if (endAt.value <= startAt.value) return form.setError("end", { message: "mentoring_slot_invalid" })
    if (startAt.value <= Date.now()) return form.setError("start", { message: "mentoring_slot_past" })
    if (await gesture.run(() => props.onConfirm({ startAt: startAt.value, endAt: endAt.value, timeZone: props.timeZone }))) props.onOpenChange(false)
  })
  return (
    <Sheet open={props.open} onOpenChange={close}>
      <SheetContent title={props.title} description={props.description} closeLabel={t("mentoring.sheet.close")}>
        <form noValidate className="flex min-w-0 flex-col gap-4" onSubmit={submit}>
          <p className="text-[13px] text-muted-foreground">{t("mentoring.slot.zoneHint", { zone: props.timeZone })}</p>
          <div className="grid min-w-0 gap-2 sm:grid-cols-3">
            <Field id={`${id}-date`} label={t("mentoring.slot.date")} error={message(errors.date?.message)}>
              {(field) => <Input id={field.id} type="date" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={gesture.busy} {...form.register("date")} />}
            </Field>
            <Field id={`${id}-debut`} label={t("mentoring.slot.start")} error={message(errors.start?.message)}>
              {(field) => <Input id={field.id} type="time" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={gesture.busy} {...form.register("start")} />}
            </Field>
            <Field id={`${id}-fin`} label={t("mentoring.slot.end")} error={message(errors.end?.message)}>
              {(field) => <Input id={field.id} type="time" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={gesture.busy} {...form.register("end")} />}
            </Field>
          </div>
          <GestureError code={gesture.error} />
          <GestureButtons busy={gesture.busy} confirmLabel={props.confirmLabel} onBack={() => close(false)} />
        </form>
      </SheetContent>
    </Sheet>
  )
}

const acceptSchema = z.object({ choice: z.string().min(1, "mentoring_slot_invalid") })

/**
 * Accepter une demande : sans créneau pour l'instant, ou en retenant l'un des
 * créneaux souhaités encore à venir (pensés dans le fuseau du mentoré).
 */
export function MentoringAcceptSheet(props: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly description: string
  readonly wishedSlots: readonly MentoringSlot[]
  readonly timeZone: string
  readonly viewerTimeZone: string
  readonly onConfirm: (slot: MentoringSlotInput | null) => Promise<ActionErrorCode | null>
}) {
  const { t } = useDiasporaleT()
  const gesture = useGesture()
  const form = useForm<z.infer<typeof acceptSchema>>({ resolver: zodResolver(acceptSchema), defaultValues: { choice: "none" } })
  const close = (open: boolean) => {
    if (gesture.busy) return
    if (!open) {
      gesture.reset()
      form.reset({ choice: "none" })
    }
    props.onOpenChange(open)
  }
  const submit = form.handleSubmit(async (values) => {
    const index = values.choice === "none" ? -1 : Number(values.choice)
    const wished = index >= 0 ? props.wishedSlots[index] : undefined
    const slot = wished ? { startAt: wished.startAt, endAt: wished.endAt, timeZone: props.timeZone } : null
    if (await gesture.run(() => props.onConfirm(slot))) props.onOpenChange(false)
  })
  return (
    <Sheet open={props.open} onOpenChange={close}>
      <SheetContent title={props.title} description={props.description} closeLabel={t("mentoring.sheet.close")}>
        <form noValidate className="flex min-w-0 flex-col gap-4" onSubmit={submit}>
          <Controller
            control={form.control}
            name="choice"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} aria-label={t("mentoring.accept.choice")} disabled={gesture.busy}>
                <RadioCard value="none">{t("mentoring.accept.noSlot")}</RadioCard>
                {props.wishedSlots.map((slot, index) => (
                  <RadioCard key={`${slot.startAt}-${slot.endAt}`} value={String(index)}>
                    <MentoringSlotText slot={slot} timeZone={props.timeZone} viewerTimeZone={props.viewerTimeZone} />
                  </RadioCard>
                ))}
              </RadioGroup>
            )}
          />
          <GestureError code={gesture.error} />
          <GestureButtons busy={gesture.busy} confirmLabel={t("mentoring.accept.confirm")} onBack={() => close(false)} />
        </form>
      </SheetContent>
    </Sheet>
  )
}
