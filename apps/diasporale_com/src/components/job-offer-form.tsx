"use client"

/**
 * Le formulaire d'une offre d'emploi (React Hook Form + Zod), au nom d'une page
 * d'entreprise ou d'association. PROPRIÉTAIRE : chantier « talents et emploi ».
 *
 * Les bornes de Zod sont celles du domaine ; puis LA règle du domaine
 * (`parseJobOffer`) juge l'ensemble — coordonnées interdites, pays, fourchette,
 * date limite — avant tout envoi. Le fournisseur la rejuge (moteur ou
 * démonstration). Aucun champ d'âge, de sexe, d'origine, de situation familiale
 * ni de photo : le rappel le dit à la personne qui publie.
 */
import {
  CURRENCY_CODES,
  JOB_CITY_MAX_LENGTH,
  JOB_DESCRIPTION_MAX_LENGTH,
  JOB_DESCRIPTION_MIN_LENGTH,
  JOB_LANGUAGE_CODES,
  JOB_LANGUAGES_MAX,
  JOB_OFFER_CONTRACTS,
  JOB_PAY_PERIODS,
  JOB_TITLE_MAX_LENGTH,
  JOB_TITLE_MIN_LENGTH,
  JOB_WORK_MODES,
  parseJobOffer,
  parseMajorAmount,
  type CountryCode,
  type JobLanguageCode,
  type JobOfferInput,
  type JobPayRangeLike,
} from "@diasporale/domain"
import { Button, Card, Checkbox, Field, Input, Label, Textarea, residenceCountryOptions } from "@diasporale/features"
import type { ActionErrorCode, JobOfferDetailView, JobOfferInputView, JobsCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { dateOfDeadline, deadlineFromDate, jobSelectClass, jobTimeZone } from "./job-parts"
import { languageName, majorAmountInput } from "./service-format"

const DATE = /^\d{4}-\d{2}-\d{2}$/

const schema = z
  .object({
    title: z.string().trim().min(JOB_TITLE_MIN_LENGTH, "job_title_too_short").max(JOB_TITLE_MAX_LENGTH, "job_title_too_long"),
    description: z.string().trim().min(JOB_DESCRIPTION_MIN_LENGTH, "job_description_too_short").max(JOB_DESCRIPTION_MAX_LENGTH, "job_description_too_long"),
    contract: z.enum(JOB_OFFER_CONTRACTS, { message: "job_contract_invalid" }),
    workMode: z.enum(JOB_WORK_MODES, { message: "job_work_mode_invalid" }),
    country: z.string().min(1, "job_country_required"),
    city: z.string().trim().max(JOB_CITY_MAX_LENGTH, "job_city_too_long"),
    languages: z.array(z.enum(JOB_LANGUAGE_CODES)).min(1, "job_languages_required").max(JOB_LANGUAGES_MAX, "job_languages_too_many"),
    announcePay: z.boolean(),
    payMin: z.string(),
    payMax: z.string(),
    currency: z.string(),
    period: z.enum(JOB_PAY_PERIODS, { message: "job_pay_period_invalid" }),
    deadline: z.string(),
  })
  .superRefine((values, ctx) => {
    const input = inputOf(values, jobTimeZone())
    if (!input.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [fieldOf(input.code)], message: input.code })
      return
    }
    const offer = parseJobOffer(input.value, Date.now())
    if (!offer.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [fieldOf(offer.code)], message: offer.code })
  })

type Values = z.infer<typeof schema>

/** Où dire un refus du domaine ou du fournisseur : le champ concerné, sinon le formulaire. */
const FIELD_OF: Partial<Record<string, FieldPath<Values>>> = {
  job_title_too_short: "title",
  job_title_too_long: "title",
  job_description_too_short: "description",
  job_description_too_long: "description",
  job_contact_details_forbidden: "description",
  job_contract_invalid: "contract",
  job_country_required: "country",
  job_country_unknown: "country",
  job_country_is_home: "country",
  job_city_too_long: "city",
  job_work_mode_invalid: "workMode",
  job_languages_required: "languages",
  job_languages_too_many: "languages",
  job_language_invalid: "languages",
  job_pay_period_invalid: "period",
  job_pay_range_invalid: "payMax",
  amount_invalid: "payMax",
  amount_too_large: "payMax",
  currency_invalid: "currency",
  job_deadline_invalid: "deadline",
}

function fieldOf(code: string): FieldPath<Values> {
  return FIELD_OF[code] ?? "title"
}

type InputResult =
  | { readonly ok: true; readonly value: JobOfferInput & { readonly payRange: JobPayRangeLike | null; readonly closesAt: number | null } }
  | { readonly ok: false; readonly code: ActionErrorCode }

/** Les valeurs du formulaire, en saisie du domaine : montants lisibles en unités mineures, date en fin de jour du fuseau. */
function inputOf(values: Values, timeZone: string): InputResult {
  let payRange: JobPayRangeLike | null = null
  if (values.announcePay) {
    const min = values.payMin.trim().length === 0 ? parseMajorAmount("0", values.currency) : parseMajorAmount(values.payMin, values.currency)
    if (!min.ok) return { ok: false, code: min.code }
    const max = parseMajorAmount(values.payMax, values.currency)
    if (!max.ok) return { ok: false, code: max.code }
    payRange = { minMinor: min.value.amountMinor, maxMinor: max.value.amountMinor, currency: max.value.currency, period: values.period }
  }
  let closesAt: number | null = null
  if (values.deadline.trim().length > 0) {
    if (!DATE.test(values.deadline.trim())) return { ok: false, code: "job_deadline_invalid" }
    closesAt = deadlineFromDate(values.deadline.trim(), timeZone)
    if (closesAt === null) return { ok: false, code: "job_deadline_invalid" }
  }
  const city = values.city.trim()
  return {
    ok: true,
    value: {
      title: values.title,
      description: values.description,
      contract: values.contract,
      country: values.country,
      city: city.length > 0 ? city : null,
      workMode: values.workMode,
      languages: values.languages,
      payRange,
      closesAt,
    },
  }
}

function defaultsOf(offer: JobOfferDetailView | null, fallbackCountry: CountryCode, timeZone: string): Values {
  if (offer === null) {
    return {
      title: "",
      description: "",
      contract: JOB_OFFER_CONTRACTS[0],
      workMode: "onsite",
      country: fallbackCountry,
      city: "",
      languages: ["fr"],
      announcePay: false,
      payMin: "",
      payMax: "",
      currency: "EUR",
      period: "month",
      deadline: "",
    }
  }
  const { payRange } = offer
  return {
    title: offer.title,
    description: offer.description,
    contract: offer.contract,
    workMode: offer.workMode,
    country: offer.country,
    city: offer.city ?? "",
    languages: offer.languages.filter((code): code is JobLanguageCode => (JOB_LANGUAGE_CODES as readonly string[]).includes(code)),
    announcePay: payRange !== null,
    payMin: payRange === null ? "" : majorAmountInput(payRange.minMinor, payRange.currency),
    payMax: payRange === null ? "" : majorAmountInput(payRange.maxMinor, payRange.currency),
    currency: payRange === null ? "EUR" : payRange.currency,
    period: payRange === null ? "month" : payRange.period,
    deadline: dateOfDeadline(offer.closesAt, timeZone),
  }
}

export interface JobOfferFormProps {
  readonly jobs: JobsCapability
  readonly pageId: string
  /** L'offre à modifier ; absente : une nouvelle offre. */
  readonly offer?: JobOfferDetailView
  /** Le pays proposé pour une nouvelle offre (celui de la page, ou du membre). */
  readonly fallbackCountry: CountryCode
  readonly onClose: () => void
  /** Après un conflit de version : relire la dernière version de l'offre. */
  readonly onReload?: () => void
}

export function JobOfferForm(props: JobOfferFormProps) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const offer = props.offer ?? null
  const timeZone = useMemo(() => jobTimeZone(), [])
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaultsOf(offer, props.fallbackCountry, timeZone) })
  const [formError, setFormError] = useState<ActionErrorCode | null>(null)
  const locked = useRef(false)
  const titleInput = useRef<HTMLInputElement | null>(null)
  const titleField = form.register("title")
  const countries = useMemo(() => residenceCountryOptions(locale), [locale])
  const announcePay = useWatch({ control: form.control, name: "announcePay" })
  useLayoutEffect(() => {
    titleInput.current?.focus()
  }, [])

  const error = (field: FieldPath<Values>) => {
    const message = form.formState.errors[field as keyof Values]?.message
    return typeof message === "string" ? t(`errors.${message}`) : undefined
  }

  const save = (publish: boolean) =>
    form.handleSubmit(async (values) => {
      if (locked.current) return
      const parsed = inputOf(values, timeZone)
      if (!parsed.ok) return
      locked.current = true
      setFormError(null)
      const input: JobOfferInputView = {
        title: values.title,
        description: values.description,
        contract: values.contract,
        country: values.country as CountryCode,
        city: parsed.value.city ?? null,
        workMode: values.workMode,
        languages: values.languages,
        payRange: parsed.value.payRange,
        closesAt: parsed.value.closesAt,
      }
      try {
        const result = offer === null
          ? await props.jobs.createOffer({ ...input, pageId: props.pageId, publish })
          : await props.jobs.updateOffer({ ...input, jobId: offer.id, expectedVersion: offer.version })
        if (result.ok) {
          toast.success(t(offer === null ? (publish ? "jobs.form.published" : "jobs.form.created") : "jobs.form.saved"))
          props.onClose()
          return
        }
        const field = FIELD_OF[result.code]
        if (field) form.setError(field, { message: result.code })
        else setFormError(result.code)
      } catch {
        setFormError("unknown")
      } finally {
        locked.current = false
      }
    })

  const busy = form.formState.isSubmitting
  const conflict = formError === "job_offer_version_conflict"
  return (
    <Card className="p-4">
      <form noValidate className="flex min-w-0 flex-col gap-4" onSubmit={(event) => void save(false)(event)} aria-labelledby={`${id}-titre`}>
        <h3 id={`${id}-titre`} className="text-lg font-semibold">{t(offer === null ? "jobs.form.createTitle" : "jobs.form.editTitle")}</h3>

        <Field id={`${id}-title`} label={t("jobs.form.title")} hint={t("jobs.form.titleHint", { min: JOB_TITLE_MIN_LENGTH, max: JOB_TITLE_MAX_LENGTH })} error={error("title")}>
          {(field) => (
            <Input
              id={field.id}
              aria-describedby={field.describedBy}
              aria-invalid={field.invalid || undefined}
              maxLength={JOB_TITLE_MAX_LENGTH}
              disabled={busy}
              {...titleField}
              ref={(element) => {
                titleField.ref(element)
                titleInput.current = element
              }}
            />
          )}
        </Field>

        <Field id={`${id}-description`} label={t("jobs.form.description")} hint={t("jobs.form.descriptionHint", { min: JOB_DESCRIPTION_MIN_LENGTH })} error={error("description")}>
          {(field) => <Textarea id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} rows={6} maxLength={JOB_DESCRIPTION_MAX_LENGTH} disabled={busy} {...form.register("description")} />}
        </Field>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id={`${id}-contract`} label={t("jobs.form.contract")} error={error("contract")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={jobSelectClass} disabled={busy} {...form.register("contract")}>
                {JOB_OFFER_CONTRACTS.map((contract) => (
                  <option key={contract} value={contract}>{t(`job.contract.${contract}`)}</option>
                ))}
              </select>
            )}
          </Field>
          <Field id={`${id}-workMode`} label={t("jobs.form.workMode")} error={error("workMode")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={jobSelectClass} disabled={busy} {...form.register("workMode")}>
                {JOB_WORK_MODES.map((mode) => (
                  <option key={mode} value={mode}>{t(`jobs.workMode.${mode}`)}</option>
                ))}
              </select>
            )}
          </Field>
          <Field id={`${id}-country`} label={t("jobs.form.country")} error={error("country")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={jobSelectClass} disabled={busy} {...form.register("country")}>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>{country.name}</option>
                ))}
              </select>
            )}
          </Field>
          <Field id={`${id}-city`} label={t("jobs.form.city")} hint={t("jobs.form.cityHint")} error={error("city")}>
            {(field) => <Input id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} maxLength={JOB_CITY_MAX_LENGTH} autoComplete="address-level2" disabled={busy} {...form.register("city")} />}
          </Field>
        </div>

        <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={error("languages") ? `${id}-languages-erreur` : undefined}>
          <legend className="mb-1 text-sm font-medium">{t("jobs.form.languages")}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {JOB_LANGUAGE_CODES.map((code) => (
              <label key={code} className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" value={code} className="size-5 accent-primary" disabled={busy} {...form.register("languages")} />
                {languageName(code, locale)}
              </label>
            ))}
          </div>
          {error("languages") ? <p id={`${id}-languages-erreur`} role="alert" className="text-[13px] font-medium text-destructive">{error("languages")}</p> : null}
        </fieldset>

        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="mb-1 text-sm font-medium">{t("jobs.form.pay")}</legend>
          <div className="flex items-start gap-3">
            <Controller
              control={form.control}
              name="announcePay"
              render={({ field }) => (
                <Checkbox id={`${id}-announcePay`} checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} onBlur={field.onBlur} disabled={busy} />
              )}
            />
            <Label htmlFor={`${id}-announcePay`} className="font-normal leading-snug">{t("jobs.form.announcePay")}</Label>
          </div>
          {announcePay ? (
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field id={`${id}-payMin`} label={t("jobs.form.payMin")} hint={t("jobs.form.payMinHint")} error={error("payMin")}>
                {(field) => <Input id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} inputMode="decimal" disabled={busy} {...form.register("payMin")} />}
              </Field>
              <Field id={`${id}-payMax`} label={t("jobs.form.payMax")} error={error("payMax")}>
                {(field) => <Input id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} inputMode="decimal" disabled={busy} {...form.register("payMax")} />}
              </Field>
              <Field id={`${id}-currency`} label={t("jobs.form.currency")} error={error("currency")}>
                {(field) => (
                  <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={jobSelectClass} disabled={busy} {...form.register("currency")}>
                    {CURRENCY_CODES.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field id={`${id}-period`} label={t("jobs.form.period")} error={error("period")}>
                {(field) => (
                  <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={jobSelectClass} disabled={busy} {...form.register("period")}>
                    {JOB_PAY_PERIODS.map((period) => (
                      <option key={period} value={period}>{t(`jobs.payPeriod.${period}`)}</option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          ) : null}
        </fieldset>

        <Field id={`${id}-deadline`} label={t("jobs.form.deadline")} hint={t("jobs.form.deadlineHint", { zone: timeZone })} error={error("deadline")}>
          {(field) => <Input id={field.id} type="date" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("deadline")} />}
        </Field>

        <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("jobs.form.fairness")}</p>

        {formError !== null ? (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-destructive px-3 py-2 text-sm">
            {conflict ? <p className="font-semibold">{t("jobs.form.conflictTitle")}</p> : null}
            <p>{t(conflict ? "jobs.form.conflictBody" : `errors.${formError}`)}</p>
            {conflict && props.onReload ? (
              <Button variant="outline" size="sm" onClick={props.onReload}>{t("jobs.form.reload")}</Button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {offer === null ? (
            <>
              <Button type="submit" variant="outline" disabled={busy}>{t(busy ? "common.pleaseWait" : "jobs.form.saveDraft")}</Button>
              <Button type="button" disabled={busy} onClick={(event) => void save(true)(event)}>{t("jobs.form.publish")}</Button>
            </>
          ) : (
            <Button type="submit" disabled={busy}>{t(busy ? "common.pleaseWait" : "jobs.form.save")}</Button>
          )}
          <Button type="button" variant="ghost" disabled={busy} onClick={props.onClose}>{t("common.cancel")}</Button>
        </div>
      </form>
    </Card>
  )
}
