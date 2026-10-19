"use client"

/**
 * « Demander un mentorat » depuis la fiche d'un mentor (DG-024, troisième
 * tranche) : un domaine parmi ceux du mentor, un objectif, un message sans
 * coordonnée, zéro à trois créneaux souhaités dans le fuseau du navigateur, et
 * le consentement EXPLICITE à montrer son nom et son message au mentor (case
 * jamais précochée). React Hook Form + Zod. PROPRIÉTAIRE : chantier « mentorat ».
 *
 * Idempotence : une clé STABLE pendant la vie de la feuille ; un double clic ou
 * un renvoi après une coupure rend la même demande.
 */
import {
  DAY_MS,
  isMentoringDomain,
  MENTORING_GOAL_MAX_LENGTH,
  MENTORING_GOAL_MIN_LENGTH,
  MENTORING_MESSAGE_MAX_LENGTH,
  MENTORING_MESSAGE_MIN_LENGTH,
  MENTORING_SLOTS_MAX,
  mentoringTextRefusal,
  mentoringWallTimeToUtc,
  utcToZonedWallTime,
} from "@diasporale/domain"
import { Button, Checkbox, Field, Input, Label, Sheet, SheetContent, Textarea } from "@diasporale/features"
import type { ActionErrorCode, MentorDetailView, MentoringCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2Icon, HandHeartIcon, Trash2Icon } from "lucide-react"
import NextLink from "next/link"
import { useId, useMemo, useRef, useState, type FormEvent } from "react"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { browserTimeZone } from "@/components/service-request-ui"
import { routes } from "@/lib/routes"

const selectClass = "h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus aria-invalid:border-destructive"
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

const slotSchema = z.object({
  date: z.string().regex(DATE, "mentoring_time_invalid"),
  start: z.string().regex(TIME, "mentoring_time_invalid"),
  end: z.string().regex(TIME, "mentoring_time_invalid"),
})

const requestSchema = z.object({
  domain: z.string().refine((value): boolean => isMentoringDomain(value), { message: "mentor_domain_invalid" }),
  goal: z.string().trim().min(MENTORING_GOAL_MIN_LENGTH, "mentoring_goal_too_short").max(MENTORING_GOAL_MAX_LENGTH, "mentoring_goal_too_long"),
  message: z.string().trim().min(MENTORING_MESSAGE_MIN_LENGTH, "mentoring_message_too_short").max(MENTORING_MESSAGE_MAX_LENGTH, "mentoring_message_too_long"),
  slots: z.array(slotSchema).max(MENTORING_SLOTS_MAX, "mentoring_slots_too_many"),
  consent: z.boolean().refine((value) => value, { message: "mentoring_consent_required" }),
})

type RequestValues = z.infer<typeof requestSchema>

/** Une clé d'idempotence neuve, pour une nouvelle feuille. */
function newIdempotencyKey(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `mentorat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  }
}

/** Un créneau proposé par défaut : demain, de 18 h à 19 h, dans le fuseau du navigateur. */
function defaultSlot(timeZone: string): RequestValues["slots"][number] {
  const tomorrow = utcToZonedWallTime(Date.now() + DAY_MS, timeZone)
  return { date: tomorrow?.date ?? "", start: "18:00", end: "19:00" }
}

/** Le bouton « Demander un mentorat » et sa feuille ; l'appelant a déjà vérifié que le geste est ouvert. */
export function MentoringRequestEntry(props: { readonly capability: MentoringCapability; readonly mentor: MentorDetailView }) {
  const { t } = useDiasporaleT()
  const [open, setOpen] = useState(false)
  // Une clé par ouverture de la feuille : stable pour ses renvois, neuve à la suivante.
  const [sheetKey, setSheetKey] = useState(0)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        aria-haspopup="dialog"
        onClick={() => {
          setSheetKey((value) => value + 1)
          setOpen(true)
        }}
      >
        <HandHeartIcon aria-hidden />
        {t("mentoring.request.cta")}
      </Button>
      {open ? (
        <SheetContent
          title={t("mentoring.request.title", { name: props.mentor.displayName })}
          description={t("mentoring.request.description")}
          closeLabel={t("mentoring.sheet.close")}
        >
          <RequestForm key={sheetKey} capability={props.capability} mentor={props.mentor} onClose={() => setOpen(false)} />
        </SheetContent>
      ) : null}
    </Sheet>
  )
}

function RequestForm(props: { readonly capability: MentoringCapability; readonly mentor: MentorDetailView; readonly onClose: () => void }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const timeZone = useMemo(() => browserTimeZone(), [])
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<ActionErrorCode | null>(null)
  const form = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { domain: props.mentor.domains[0] ?? "", goal: "", message: "", slots: [], consent: false },
  })
  const slots = useFieldArray({ control: form.control, name: "slots" })
  const locked = useRef(false)
  const errors = form.formState.errors
  const message = (code: string | undefined) => (code ? t(`errors.${code}`) : undefined)

  const validatedSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    for (const field of ["goal", "message"] as const) {
      const refusal = mentoringTextRefusal(values[field])
      if (refusal) return form.setError(field, { message: refusal })
    }
    const domain = values.domain
    if (!isMentoringDomain(domain)) return form.setError("domain", { message: "mentor_domain_invalid" })
    const wishedSlots: { startAt: number; endAt: number }[] = []
    for (const [index, slot] of values.slots.entries()) {
      const startAt = mentoringWallTimeToUtc({ date: slot.date, time: slot.start }, timeZone)
      if (!startAt.ok) return form.setError(`slots.${index}.start`, { message: startAt.code })
      const endAt = mentoringWallTimeToUtc({ date: slot.date, time: slot.end }, timeZone)
      if (!endAt.ok) return form.setError(`slots.${index}.end`, { message: endAt.code })
      if (endAt.value <= startAt.value) return form.setError(`slots.${index}.end`, { message: "mentoring_slot_invalid" })
      if (startAt.value <= Date.now()) return form.setError(`slots.${index}.start`, { message: "mentoring_slot_past" })
      wishedSlots.push({ startAt: startAt.value, endAt: endAt.value })
    }
    try {
      const result = await props.capability.request({
        mentorId: props.mentor.mentorId,
        domain,
        goal: values.goal,
        message: values.message,
        wishedSlots,
        timeZone,
        shareWithMentor: values.consent,
        idempotencyKey,
      })
      if (result.ok) {
        setSent(true)
        toast.success(t("mentoring.request.sent"))
        return
      }
      // Un autre corps sous la même clé : la feuille repart d'une clé neuve, sans rien deviner.
      if (result.code === "mentoring_idempotency_conflict") setIdempotencyKey(newIdempotencyKey())
      setFormError(result.code)
    } catch {
      setFormError("unknown")
    }
  })

  /** Un envoi à la fois ; un renvoi rejoue la même clé, donc la même demande. */
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (locked.current) return
    locked.current = true
    try {
      await validatedSubmit(event)
    } finally {
      locked.current = false
    }
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2Icon aria-hidden className="size-5 text-primary" />
          {t("mentoring.request.sent")}
        </p>
        <p className="text-sm">{t("mentoring.request.sentBody", { name: props.mentor.displayName })}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <NextLink href={routes.myMentoring()}>{t("mentoring.profile.followRequests")}</NextLink>
          </Button>
          <Button variant="ghost" onClick={props.onClose}>{t("mentoring.sheet.close")}</Button>
        </div>
      </div>
    )
  }

  const busy = form.formState.isSubmitting
  return (
    <form noValidate className="flex min-w-0 flex-col gap-4" onSubmit={submit}>
      <Field id={`${id}-domaine`} label={t("mentoring.request.domain")} error={message(errors.domain?.message)}>
        {(field) => (
          <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={selectClass} disabled={busy} {...form.register("domain")}>
            {props.mentor.domains.map((domain) => (
              <option key={domain} value={domain}>{t(`mentor.domain.${domain}`)}</option>
            ))}
          </select>
        )}
      </Field>

      <Field
        id={`${id}-objectif`}
        label={t("mentoring.request.goal")}
        hint={t("mentoring.request.goalHint", { min: MENTORING_GOAL_MIN_LENGTH, max: MENTORING_GOAL_MAX_LENGTH })}
        error={message(errors.goal?.message)}
      >
        {(field) => <Input id={field.id} maxLength={MENTORING_GOAL_MAX_LENGTH} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("goal")} />}
      </Field>

      <Field
        id={`${id}-message`}
        label={t("mentoring.request.message")}
        hint={t("mentoring.request.messageHint", { min: MENTORING_MESSAGE_MIN_LENGTH })}
        error={message(errors.message?.message)}
      >
        {(field) => (
          <Textarea id={field.id} rows={4} maxLength={MENTORING_MESSAGE_MAX_LENGTH} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("message")} />
        )}
      </Field>

      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="text-sm font-medium">{t("mentoring.request.slots")}</legend>
        <p className="text-[13px] text-muted-foreground">{t("mentoring.request.slotsHint", { zone: timeZone })}</p>
        {slots.fields.map((item, index) => (
          <div key={item.id} className="flex min-w-0 flex-col gap-2 rounded-lg bg-muted p-3">
            <p className="text-sm font-medium">{t("mentoring.request.slot", { index: index + 1 })}</p>
            <div className="grid min-w-0 gap-2 sm:grid-cols-3">
              <Field id={`${id}-date-${index}`} label={t("mentoring.slot.date")} error={message(errors.slots?.[index]?.date?.message)}>
                {(field) => <Input id={field.id} type="date" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register(`slots.${index}.date`)} />}
              </Field>
              <Field id={`${id}-debut-${index}`} label={t("mentoring.slot.start")} error={message(errors.slots?.[index]?.start?.message)}>
                {(field) => <Input id={field.id} type="time" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register(`slots.${index}.start`)} />}
              </Field>
              <Field id={`${id}-fin-${index}`} label={t("mentoring.slot.end")} error={message(errors.slots?.[index]?.end?.message)}>
                {(field) => <Input id={field.id} type="time" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register(`slots.${index}.end`)} />}
              </Field>
            </div>
            <div>
              <Button type="button" variant="ghost" size="sm" className="min-h-11" disabled={busy} onClick={() => slots.remove(index)}>
                <Trash2Icon aria-hidden />
                {t("mentoring.request.removeSlot", { index: index + 1 })}
              </Button>
            </div>
          </div>
        ))}
        {errors.slots?.message ? <p role="alert" className="text-[13px] font-medium text-destructive">{message(errors.slots.message)}</p> : null}
        {slots.fields.length < MENTORING_SLOTS_MAX ? (
          <div>
            <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={busy} onClick={() => slots.append(defaultSlot(timeZone))}>
              {t("mentoring.request.addSlot")}
            </Button>
          </div>
        ) : null}
      </fieldset>

      <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("mentoring.request.reminder")}</p>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-3">
          <Controller
            control={form.control}
            name="consent"
            render={({ field }) => (
              <Checkbox
                id={`${id}-consentement`}
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                onBlur={field.onBlur}
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={errors.consent ? `${id}-consentement-erreur` : undefined}
                disabled={busy}
              />
            )}
          />
          <Label htmlFor={`${id}-consentement`} className="font-normal leading-snug">{t("mentoring.request.consent", { name: props.mentor.displayName })}</Label>
        </div>
        {errors.consent?.message ? <p id={`${id}-consentement-erreur`} role="alert" className="text-[13px] font-medium text-destructive">{message(errors.consent.message)}</p> : null}
      </div>

      {formError ? (
        <div role="alert" className="flex flex-col items-start gap-2 text-sm">
          <p className="font-medium text-destructive">{t(`errors.${formError}`)}</p>
          {formError === "mentoring_pair_open" ? (
            <Button asChild variant="outline" size="sm">
              <NextLink href={routes.myMentoring()}>{t("mentoring.profile.followRequests")}</NextLink>
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy} aria-busy={busy}>{t(busy ? "mentoring.request.sending" : "mentoring.request.submit")}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={props.onClose}>{t("mentoring.sheet.back")}</Button>
      </div>
    </form>
  )
}
