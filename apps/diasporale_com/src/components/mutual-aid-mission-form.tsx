"use client"

/**
 * Proposer ou modifier une mission bénévole (DG-024 a) au nom d'une page
 * d'association que l'on gère : titre, description, lieu (pays, ville saisie,
 * lieu approximatif facultatif), date ou période dans un fuseau choisi, et
 * nombre de places. PROPRIÉTAIRE : chantier « entraide ».
 *
 * Les instants sont calculés dans le fuseau CHOISI, jamais dans celui implicite
 * du navigateur ; les règles sont celles du domaine (`parseAidMission`,
 * `checkAidMissionTiming`), jugées avant l'envoi puis par le fournisseur.
 */
import {
  AID_CITY_MAX_LENGTH,
  AID_MISSION_AREA_MAX_LENGTH,
  AID_MISSION_DESCRIPTION_MAX_LENGTH,
  AID_MISSION_PLACES_MAX,
  AID_MISSION_PLACES_MIN,
  AID_TITLE_MAX_LENGTH,
  aidTextRefusal,
  checkAidMissionTiming,
  DAY_MS,
  parseAidMission,
  utcToZonedWallTime,
  zonedWallTimeToUtc,
  type CountryCode,
  type MutualAidRefusal,
} from "@diasporale/domain"
import { Button, Field, Input, Textarea, residenceCountryOptions } from "@diasporale/features"
import type { AidMissionDetailView, AidMissionPageOption, MutualAidCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { errorKey } from "./association-parts"
import { browserTimeZone, timeZoneOptions } from "./service-request-ui"
import { useReviewTask as useAidTask } from "./service-review-editor"

const selectClass = "h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus aria-invalid:border-destructive"

const fields = z.object({
  pageId: z.string(),
  title: z.string(),
  description: z.string(),
  country: z.string(),
  city: z.string(),
  area: z.string(),
  timeZone: z.string(),
  startDate: z.string(),
  startTime: z.string(),
  endDate: z.string(),
  endTime: z.string(),
  places: z.string(),
})
type Values = z.infer<typeof fields>
type FieldName = keyof Values

/** L'horaire saisi en instants UTC, dans le fuseau choisi ; `null` : une heure qui n'existe pas ou mal formée. */
function scheduleOf(values: Values): { readonly startsAt: number; readonly endsAt: number | null } | null {
  const start = zonedWallTimeToUtc({ date: values.startDate, time: values.startTime }, values.timeZone)
  if (!start.ok) return null
  if (!values.endDate && !values.endTime) return { startsAt: start.value, endsAt: null }
  const end = zonedWallTimeToUtc({ date: values.endDate || values.startDate, time: values.endTime }, values.timeZone)
  return end.ok ? { startsAt: start.value, endsAt: end.value } : null
}

function placesOf(values: Values): number {
  return values.places.trim() === "" ? Number.NaN : Number(values.places)
}

/** Le champ qu'un refus du domaine concerne. */
function fieldOf(code: MutualAidRefusal, values: Values): FieldName {
  if (code === "aid_contact_forbidden" || code === "aid_address_forbidden") {
    if (aidTextRefusal(values.title) !== null) return "title"
    if (aidTextRefusal(values.description) !== null) return "description"
    if (aidTextRefusal(values.city) !== null) return "city"
    return "area"
  }
  if (code.startsWith("aid_title")) return "title"
  if (code.startsWith("aid_mission_description")) return "description"
  if (code.startsWith("aid_country")) return "country"
  if (code.startsWith("aid_city")) return "city"
  if (code === "aid_mission_area_too_long") return "area"
  if (code === "aid_time_zone_invalid") return "timeZone"
  if (code === "aid_mission_places_invalid") return "places"
  return "startDate"
}

const schema = fields.superRefine((values, context) => {
  const schedule = scheduleOf(values)
  if (!schedule) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "aid_mission_schedule_invalid", path: ["startDate"] })
    return
  }
  const parsed = parseAidMission({ ...values, places: placesOf(values), startsAt: schedule.startsAt, endsAt: schedule.endsAt })
  if (!parsed.ok) context.addIssue({ code: z.ZodIssueCode.custom, message: parsed.code, path: [fieldOf(parsed.code, values)] })
})

export function AidMissionForm(props: {
  readonly capability: MutualAidCapability
  /** Les pages d'association au nom desquelles proposer (création). */
  readonly pages: readonly AidMissionPageOption[]
  /** La mission à modifier ; absente, une mission nouvelle. */
  readonly initial: AidMissionDetailView | null
  readonly defaultCountry: CountryCode
  readonly onSaved: (missionId: string) => void
  readonly onCancel: () => void
}) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const task = useAidTask()
  const countries = useMemo(() => residenceCountryOptions(locale), [locale])
  const { initial } = props
  const [zone] = useState(() => initial?.timeZone ?? browserTimeZone())
  const zones = useMemo(() => timeZoneOptions(zone), [zone])
  const [defaults] = useState<Values>(() => {
    const firstPage = props.pages[0]
    const start = utcToZonedWallTime(initial?.startsAt ?? Date.now() + 7 * DAY_MS, zone)
    const end = initial?.endsAt == null ? null : utcToZonedWallTime(initial.endsAt, zone)
    return {
      pageId: firstPage?.id ?? "",
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      country: initial?.country ?? firstPage?.country ?? props.defaultCountry,
      city: initial?.city ?? firstPage?.city ?? "",
      area: initial?.area ?? "",
      timeZone: zone,
      startDate: start?.date ?? "",
      startTime: initial ? (start?.time ?? "") : "10:00",
      endDate: end?.date ?? "",
      endTime: end?.time ?? "",
      places: String(initial?.places ?? 5),
    }
  })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })
  const error = (name: FieldName) => {
    const message = form.formState.errors[name]?.message
    return typeof message === "string" ? t(errorKey(message)) : undefined
  }

  const submit = form.handleSubmit((values) => {
    const schedule = scheduleOf(values)
    if (!schedule) return
    // Une mission nouvelle, ou replanifiée, commence dans le futur (règle du domaine).
    const rescheduled = !initial || schedule.startsAt !== initial.startsAt || schedule.endsAt !== initial.endsAt || values.timeZone !== initial.timeZone
    if (rescheduled) {
      const timing = checkAidMissionTiming(schedule.startsAt, Date.now())
      if (!timing.ok) {
        form.setError("startDate", { message: timing.code })
        return
      }
    }
    const input = {
      title: values.title,
      description: values.description,
      country: values.country as CountryCode,
      city: values.city,
      area: values.area,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
      timeZone: values.timeZone,
      places: placesOf(values),
    }
    if (initial) {
      return task.run(() => props.capability.updateMission({ ...input, missionId: initial.id, expectedVersion: initial.version }), () => props.onSaved(initial.id))
    }
    let created: string | null = null
    return task.run(async () => {
      const result = await props.capability.createMission({ ...input, pageId: values.pageId })
      if (result.ok) created = result.value.missionId
      return result
    }, () => { if (created !== null) props.onSaved(created) })
  })

  return (
    <form noValidate onSubmit={submit} className="flex min-w-0 flex-col gap-4">
      {initial ? null : (
        <Field id={`${id}-page`} label={t("mutualAid.missionForm.page")} hint={t("mutualAid.missionForm.pageHint")}>
          {(field) => (
            <select id={field.id} disabled={task.busy} aria-describedby={field.describedBy} className={selectClass} {...form.register("pageId")}>
              {props.pages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}
            </select>
          )}
        </Field>
      )}
      <Field id={`${id}-title`} label={t("mutualAid.missionForm.title")} error={error("title")}>
        {(field) => <Input id={field.id} maxLength={AID_TITLE_MAX_LENGTH} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("title")} />}
      </Field>
      <Field id={`${id}-description`} label={t("mutualAid.missionForm.description")} hint={t("mutualAid.missionForm.descriptionHint", { max: AID_MISSION_DESCRIPTION_MAX_LENGTH })} error={error("description")}>
        {(field) => <Textarea id={field.id} rows={5} maxLength={AID_MISSION_DESCRIPTION_MAX_LENGTH} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("description")} />}
      </Field>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={`${id}-country`} label={t("mutualAid.missionForm.country")} error={error("country")}>
          {(field) => (
            <select id={field.id} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} className={selectClass} {...form.register("country")}>
              {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
            </select>
          )}
        </Field>
        <Field id={`${id}-city`} label={t("mutualAid.missionForm.city")} hint={t("mutualAid.missionForm.cityHint")} error={error("city")}>
          {(field) => <Input id={field.id} autoComplete="address-level2" maxLength={AID_CITY_MAX_LENGTH} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("city")} />}
        </Field>
      </div>
      <Field id={`${id}-area`} label={t("mutualAid.missionForm.area")} hint={t("mutualAid.missionForm.areaHint")} error={error("area")}>
        {(field) => <Input id={field.id} maxLength={AID_MISSION_AREA_MAX_LENGTH} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("area")} />}
      </Field>
      <Field id={`${id}-zone`} label={t("mutualAid.missionForm.timeZone")} error={error("timeZone")}>
        {(field) => (
          <select id={field.id} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} className={selectClass} {...form.register("timeZone")}>
            {zones.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        )}
      </Field>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id={`${id}-startDate`} label={t("mutualAid.missionForm.startDate")} error={error("startDate")}>
          {(field) => <Input id={field.id} type="date" disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("startDate")} />}
        </Field>
        <Field id={`${id}-startTime`} label={t("mutualAid.missionForm.startTime")}>
          {(field) => <Input id={field.id} type="time" disabled={task.busy} {...form.register("startTime")} />}
        </Field>
        <Field id={`${id}-endDate`} label={t("mutualAid.missionForm.endDate")}>
          {(field) => <Input id={field.id} type="date" disabled={task.busy} {...form.register("endDate")} />}
        </Field>
        <Field id={`${id}-endTime`} label={t("mutualAid.missionForm.endTime")}>
          {(field) => <Input id={field.id} type="time" disabled={task.busy} {...form.register("endTime")} />}
        </Field>
      </div>
      <p className="text-sm text-muted-foreground">{t("mutualAid.missionForm.scheduleHint")}</p>
      <Field id={`${id}-places`} label={t("mutualAid.missionForm.places")} hint={t("mutualAid.missionForm.placesHint", { min: AID_MISSION_PLACES_MIN, max: AID_MISSION_PLACES_MAX })} error={error("places")}>
        {(field) => <Input id={field.id} type="number" inputMode="numeric" min={AID_MISSION_PLACES_MIN} max={AID_MISSION_PLACES_MAX} step={1} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("places")} />}
      </Field>
      {initial ? <p className="text-sm text-muted-foreground">{t("mutualAid.missionForm.placesChangeHint")}</p> : null}
      <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("mutualAid.noContactReminder")}</p>
      {task.error ? <p role="alert" className="text-sm font-medium text-destructive">{t(errorKey(task.error))}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={task.busy} aria-busy={task.busy}>
          {t(task.busy ? "common.pleaseWait" : initial ? "mutualAid.missionForm.save" : "mutualAid.missionForm.publish")}
        </Button>
        <Button type="button" variant="ghost" disabled={task.busy} onClick={props.onCancel}>{t("common.cancel")}</Button>
      </div>
    </form>
  )
}
