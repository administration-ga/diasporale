"use client"

/**
 * Poser ou modifier une question d'entraide (DG-024 a) : titre, détail
 * facultatif, thème, pays de résidence (à la création) et ville saisie
 * facultative, sans GPS. PROPRIÉTAIRE : chantier « entraide ».
 *
 * Les bornes et le refus des coordonnées sont ceux du domaine
 * (`parseAidQuestion`), jugés avant l'envoi puis par le fournisseur : un refus
 * revient en code fermé, posé sur le champ qu'il concerne.
 */
import {
  AID_CITY_MAX_LENGTH,
  AID_DETAIL_MAX_LENGTH,
  AID_THEMES,
  AID_TITLE_MAX_LENGTH,
  aidTextRefusal,
  parseAidQuestion,
  type CountryCode,
  type MutualAidRefusal,
} from "@diasporale/domain"
import { Button, Field, Input, Textarea, residenceCountryOptions } from "@diasporale/features"
import type { AidQuestionDetailView, MutualAidCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { errorKey } from "./association-parts"
import { useReviewTask as useAidTask } from "./service-review-editor"

const selectClass = "h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus aria-invalid:border-destructive"

const fields = z.object({
  title: z.string(),
  detail: z.string(),
  theme: z.enum(AID_THEMES),
  country: z.string(),
  city: z.string(),
})
type Values = z.infer<typeof fields>
type FieldName = keyof Values

/** Le champ qu'un refus du domaine concerne : la coordonnée se cherche dans l'ordre du formulaire. */
function fieldOf(code: MutualAidRefusal, values: Values): FieldName {
  if (code === "aid_contact_forbidden" || code === "aid_address_forbidden") {
    if (aidTextRefusal(values.title) !== null) return "title"
    if (aidTextRefusal(values.detail) !== null) return "detail"
    return "city"
  }
  if (code.startsWith("aid_title")) return "title"
  if (code === "aid_detail_too_long") return "detail"
  if (code === "aid_theme_invalid") return "theme"
  if (code.startsWith("aid_country")) return "country"
  return "city"
}

const schema = fields.superRefine((values, context) => {
  const parsed = parseAidQuestion(values)
  if (!parsed.ok) context.addIssue({ code: z.ZodIssueCode.custom, message: parsed.code, path: [fieldOf(parsed.code, values)] })
})

export function AidQuestionForm(props: {
  readonly capability: MutualAidCapability
  /** La question à modifier ; absente, une question nouvelle. */
  readonly initial: AidQuestionDetailView | null
  readonly defaultCountry: CountryCode
  readonly defaultCity: string
  readonly onSaved: (questionId: string) => void
  readonly onCancel: () => void
}) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const task = useAidTask()
  const countries = useMemo(() => residenceCountryOptions(locale), [locale])
  const { initial } = props
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initial?.title ?? "",
      detail: initial?.detail ?? "",
      theme: initial?.theme ?? "daily_life",
      country: initial?.country ?? props.defaultCountry,
      city: initial ? (initial.city ?? "") : props.defaultCity,
    },
  })
  const error = (name: FieldName) => {
    const message = form.formState.errors[name]?.message
    return typeof message === "string" ? t(errorKey(message)) : undefined
  }
  const submit = form.handleSubmit((values) => {
    if (initial) {
      return task.run(
        () => props.capability.updateQuestion({ questionId: initial.id, expectedVersion: initial.version, title: values.title, detail: values.detail, theme: values.theme, city: values.city }),
        () => props.onSaved(initial.id),
      )
    }
    let created: string | null = null
    return task.run(async () => {
      const result = await props.capability.askQuestion({ title: values.title, detail: values.detail, theme: values.theme, country: values.country as CountryCode, city: values.city })
      if (result.ok) created = result.value.questionId
      return result
    }, () => { if (created !== null) props.onSaved(created) })
  })

  return (
    <form noValidate onSubmit={submit} className="flex min-w-0 flex-col gap-4">
      <Field id={`${id}-title`} label={t("mutualAid.questionForm.title")} hint={t("mutualAid.questionForm.titleHint", { max: AID_TITLE_MAX_LENGTH })} error={error("title")}>
        {(field) => <Input id={field.id} maxLength={AID_TITLE_MAX_LENGTH} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("title")} />}
      </Field>
      <Field id={`${id}-detail`} label={t("mutualAid.questionForm.detail")} hint={t("mutualAid.questionForm.detailHint", { max: AID_DETAIL_MAX_LENGTH })} error={error("detail")}>
        {(field) => <Textarea id={field.id} rows={5} maxLength={AID_DETAIL_MAX_LENGTH} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("detail")} />}
      </Field>
      <Field id={`${id}-theme`} label={t("mutualAid.questionForm.theme")} error={error("theme")}>
        {(field) => (
          <select id={field.id} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} className={selectClass} {...form.register("theme")}>
            {AID_THEMES.map((theme) => <option key={theme} value={theme}>{t(`mutualAid.theme.${theme}`)}</option>)}
          </select>
        )}
      </Field>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        {initial ? null : (
          <Field id={`${id}-country`} label={t("mutualAid.questionForm.country")} error={error("country")}>
            {(field) => (
              <select id={field.id} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} className={selectClass} {...form.register("country")}>
                {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
              </select>
            )}
          </Field>
        )}
        <Field id={`${id}-city`} label={t("mutualAid.questionForm.city")} hint={t("mutualAid.questionForm.cityHint")} error={error("city")}>
          {(field) => <Input id={field.id} autoComplete="address-level2" maxLength={AID_CITY_MAX_LENGTH} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("city")} />}
        </Field>
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("mutualAid.noContactReminder")}</p>
      {task.error ? <p role="alert" className="text-sm font-medium text-destructive">{t(errorKey(task.error))}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={task.busy} aria-busy={task.busy}>
          {t(task.busy ? "common.pleaseWait" : initial ? "mutualAid.questionForm.save" : "mutualAid.questionForm.publish")}
        </Button>
        <Button type="button" variant="ghost" disabled={task.busy} onClick={props.onCancel}>{t("common.cancel")}</Button>
      </div>
    </form>
  )
}
