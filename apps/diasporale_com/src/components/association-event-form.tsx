"use client"

/** DG-010 : instants calculés dans le fuseau choisi, jamais dans celui implicite du navigateur. */
import { assertPersonalEventTimeZone, assertPersonalEventWindow } from "@antsia/social-domain/events"
import { ASSOCIATION_EVENT_MAX_CAPACITY, checkAssociationEventCapacityChange, parseAssociationEventCapacity, parseAssociationEventDeadline, utcToZonedWallTime, zonedWallTimeToUtc } from "@diasporale/domain"
import { Button, Field, Input, Textarea } from "@diasporale/features"
import type { AssociationEventView, AssociationEventsCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { browserTimeZone, timeZoneOptions } from "./service-request-ui"
import { useReviewTask as useActivityTask } from "./service-review-editor"

const fields = z.object({
  title: z.string().trim().min(3, "association_event_invalid").max(120, "association_event_invalid"),
  description: z.string().trim().max(2000, "association_event_invalid"),
  location: z.string().trim().max(200, "association_event_invalid"),
  startDate: z.string(), startTime: z.string(), endDate: z.string(), endTime: z.string(),
  timeZone: z.string(), audience: z.enum(["network", "association"]),
  capacity: z.string().trim(),
  registrationCloseDate: z.string(), registrationCloseTime: z.string(),
})
type Values = z.infer<typeof fields>

function windowOf(values: Values) {
  const start = zonedWallTimeToUtc({ date: values.startDate, time: values.startTime }, values.timeZone)
  const end = zonedWallTimeToUtc({ date: values.endDate, time: values.endTime }, values.timeZone)
  if (!start.ok || !end.ok) return null
  try {
    assertPersonalEventTimeZone(values.timeZone)
    assertPersonalEventWindow({ startAt: start.value, endAt: end.value })
    return { startAt: start.value, endAt: end.value }
  } catch { return null }
}

function deadlineOf(values: Values, startAt: number) {
  if (!values.registrationCloseDate && !values.registrationCloseTime) return parseAssociationEventDeadline(null, startAt)
  const instant = zonedWallTimeToUtc({ date: values.registrationCloseDate, time: values.registrationCloseTime }, values.timeZone)
  return parseAssociationEventDeadline(instant.ok ? instant.value : NaN, startAt)
}

const schema = fields.superRefine((values, context) => {
  const window = windowOf(values)
  if (!window) context.addIssue({ code: z.ZodIssueCode.custom, message: "association_event_invalid", path: ["startDate"] })
  const capacity = parseAssociationEventCapacity(values.capacity === "" ? null : Number(values.capacity))
  if (!capacity.ok) context.addIssue({ code: z.ZodIssueCode.custom, message: capacity.code, path: ["capacity"] })
  const deadline = deadlineOf(values, window?.startAt ?? NaN)
  if (!deadline.ok) context.addIssue({ code: z.ZodIssueCode.custom, message: deadline.code, path: ["registrationCloseDate"] })
})

export function AssociationEventForm(props: { readonly pageId: string; readonly capability: AssociationEventsCapability; readonly initial: AssociationEventView | null; readonly onSaved: () => void; readonly onCancel: () => void }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const task = useActivityTask()
  const [key] = useState(() => crypto.randomUUID())
  const [zone] = useState(() => props.initial?.timeZone ?? browserTimeZone())
  const zones = useMemo(() => timeZoneOptions(zone), [zone])
  const initial = props.initial
  const [defaults] = useState<Values>(() => {
    const start = utcToZonedWallTime(initial?.startAt ?? Date.now() + 86_400_000, zone)
    const end = utcToZonedWallTime(initial?.endAt ?? Date.now() + 90_000_000, zone)
    const deadline = initial?.registrationClosesAt == null ? null : utcToZonedWallTime(initial.registrationClosesAt, zone)
    return { title: initial?.title ?? "", description: initial?.description ?? "", location: initial?.location ?? "", audience: initial?.audience ?? "association", capacity: String(initial?.capacity ?? ""), timeZone: zone, startDate: start?.date ?? "", startTime: start?.time ?? "", endDate: end?.date ?? "", endTime: end?.time ?? "", registrationCloseDate: deadline?.date ?? "", registrationCloseTime: deadline?.time ?? "" }
  })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })
  const submit = form.handleSubmit((values) => {
    const window = windowOf(values)
    if (!window) return
    const capacity = parseAssociationEventCapacity(values.capacity === "" ? null : Number(values.capacity))
    if (!capacity.ok) { form.setError("capacity", { message: capacity.code }); return }
    const deadline = deadlineOf(values, window.startAt)
    if (!deadline.ok) { form.setError("registrationCloseDate", { message: deadline.code }); return }
    if (initial) {
      const change = checkAssociationEventCapacityChange(capacity.value, initial.confirmedCount)
      if (!change.ok) { form.setError("capacity", { message: change.code }); return }
    }
    const scheduleChanged = !initial || window.startAt !== initial.startAt || window.endAt !== initial.endAt || values.timeZone !== initial.timeZone
    if (scheduleChanged && window.startAt <= Date.now()) { form.setError("startDate", { message: "association_event_invalid" }); return }
    const input = { pageId: props.pageId, title: values.title, description: values.description, location: values.location, timeZone: values.timeZone, audience: values.audience, capacity: capacity.value, registrationClosesAt: deadline.value, ...window }
    return task.run(() => initial
      ? props.capability.update({ ...input, eventId: initial.eventId, expectedVersion: initial.version })
      : props.capability.create({ ...input, idempotencyKey: key }), props.onSaved)
  })
  const error = (message: string | undefined) => message ? t(`errors.${message}`) : undefined
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <Field id={`${id}-title`} label={t("associationActivities.event.titleField")} error={error(form.formState.errors.title?.message)}>
        {(field) => <Input id={field.id} maxLength={120} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("title")} />}
      </Field>
      <Field id={`${id}-description`} label={t("associationActivities.event.descriptionField")} error={error(form.formState.errors.description?.message)}>
        {(field) => <Textarea id={field.id} maxLength={2000} rows={4} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("description")} />}
      </Field>
      <Field id={`${id}-location`} label={t("associationActivities.event.locationField")} hint={t("associationActivities.event.locationHint")} error={error(form.formState.errors.location?.message)}>
        {(field) => <Input id={field.id} maxLength={200} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("location")} />}
      </Field>
      <Field id={`${id}-zone`} label={t("associationActivities.event.timeZone")} error={error(form.formState.errors.timeZone?.message)}>
        {(field) => <select id={field.id} disabled={task.busy} aria-describedby={field.describedBy} className="h-11 min-w-0 rounded-md border border-input bg-card px-3" {...form.register("timeZone")}>{zones.map((value) => <option key={value} value={value}>{value}</option>)}</select>}
      </Field>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id={`${id}-startDate`} label={t("associationActivities.event.startDate")} error={error(form.formState.errors.startDate?.message)}>{(field) => <Input id={field.id} type="date" disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("startDate")} />}</Field>
        <Field id={`${id}-startTime`} label={t("associationActivities.event.startTime")}>{(field) => <Input id={field.id} type="time" disabled={task.busy} {...form.register("startTime")} />}</Field>
        <Field id={`${id}-endDate`} label={t("associationActivities.event.endDate")}>{(field) => <Input id={field.id} type="date" disabled={task.busy} {...form.register("endDate")} />}</Field>
        <Field id={`${id}-endTime`} label={t("associationActivities.event.endTime")}>{(field) => <Input id={field.id} type="time" disabled={task.busy} {...form.register("endTime")} />}</Field>
      </div>
      <p className="text-sm text-muted-foreground">{t("associationActivities.event.scheduleHint")}</p>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id={`${id}-registrationCloseDate`} label={t("associationActivities.event.registrationCloseDate")} hint={t("associationActivities.event.registrationCloseHint")} error={error(form.formState.errors.registrationCloseDate?.message)}>{(field) => <Input id={field.id} type="date" disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("registrationCloseDate")} />}</Field>
        <Field id={`${id}-registrationCloseTime`} label={t("associationActivities.event.registrationCloseTime")}>{(field) => <Input id={field.id} type="time" disabled={task.busy} {...form.register("registrationCloseTime")} />}</Field>
      </div>
      {initial ? <p className="text-sm text-muted-foreground">{t("associationActivities.event.registrationReopenHint")}</p> : null}
      <Field id={`${id}-audience`} label={t("associationActivities.event.audience")} hint={t("associationActivities.event.audienceHint")}>
        {(field) => <select id={field.id} disabled={task.busy} aria-describedby={field.describedBy} className="h-11 min-w-0 rounded-md border border-input bg-card px-3" {...form.register("audience")}><option value="association">{t("associationActivities.event.membersOnly")}</option><option value="network">{t("associationActivities.event.network")}</option></select>}
      </Field>
      <Field id={`${id}-capacity`} label={t("associationActivities.event.capacityField")} hint={t("associationActivities.event.capacityHint", { max: ASSOCIATION_EVENT_MAX_CAPACITY })} error={error(form.formState.errors.capacity?.message)}>
        {(field) => <Input id={field.id} type="number" inputMode="numeric" min={1} max={ASSOCIATION_EVENT_MAX_CAPACITY} step={1} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("capacity")} />}
      </Field>
      {initial ? <p className="text-sm text-muted-foreground">{t("associationActivities.event.capacityChangeHint")}</p> : null}
      {task.error ? <p role="alert" className="text-sm text-destructive">{t(`errors.${task.error}`)}</p> : null}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={task.busy} aria-busy={task.busy}>{t(task.busy ? "associationActivities.working" : "associationActivities.event.save")}</Button><Button type="button" variant="ghost" disabled={task.busy} onClick={props.onCancel}>{t("associationActivities.cancel")}</Button></div>
    </form>
  )
}
