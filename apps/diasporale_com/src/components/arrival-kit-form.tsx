"use client"

/**
 * Le formulaire d'une ressource du kit d'arrivée (React Hook Form + Zod) : proposer,
 * ou modifier (une nouvelle version). Les bornes de Zod sont celles du domaine ; puis
 * LA règle du domaine (`parseArrivalKitResource`) juge l'ensemble — aucune coordonnée
 * dans le texte, adresse de la source en https sans suivi, vérification de moins de
 * douze mois — avant tout envoi. Le fournisseur la rejuge (moteur ou démonstration).
 * PROPRIÉTAIRE : chantier « kit d'arrivée ».
 */
import {
  ARRIVAL_KIT_BODY_MAX_LENGTH,
  ARRIVAL_KIT_BODY_MIN_LENGTH,
  ARRIVAL_KIT_CATEGORIES,
  ARRIVAL_KIT_CITY_MAX_LENGTH,
  ARRIVAL_KIT_SOURCE_NAME_MAX_LENGTH,
  ARRIVAL_KIT_SOURCE_NAME_MIN_LENGTH,
  ARRIVAL_KIT_SOURCE_URL_MAX_LENGTH,
  ARRIVAL_KIT_SUMMARY_MAX_LENGTH,
  ARRIVAL_KIT_SUMMARY_MIN_LENGTH,
  ARRIVAL_KIT_TITLE_MAX_LENGTH,
  ARRIVAL_KIT_TITLE_MIN_LENGTH,
  containsContactDetails,
  formatArrivalKitDateInput,
  parseArrivalKitDateInput,
  parseArrivalKitResource,
  type ArrivalKitCategory,
  type CountryCode,
} from "@diasporale/domain"
import { Button, Field, Input, Textarea, residenceCountryOptions } from "@diasporale/features"
import type { ActionErrorCode, ArrivalKitPageLabel, ArrivalKitResourceInputView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useForm, type FieldPath } from "react-hook-form"
import { z } from "zod"

import { errorKey } from "./association-parts"

const selectClass = "h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus aria-invalid:border-destructive"

const schema = z
  .object({
    title: z.string().trim().min(ARRIVAL_KIT_TITLE_MIN_LENGTH, "arrival_kit_title_too_short").max(ARRIVAL_KIT_TITLE_MAX_LENGTH, "arrival_kit_title_too_long"),
    summary: z.string().trim().min(ARRIVAL_KIT_SUMMARY_MIN_LENGTH, "arrival_kit_summary_too_short").max(ARRIVAL_KIT_SUMMARY_MAX_LENGTH, "arrival_kit_summary_too_long"),
    body: z.string().trim().min(ARRIVAL_KIT_BODY_MIN_LENGTH, "arrival_kit_body_too_short").max(ARRIVAL_KIT_BODY_MAX_LENGTH, "arrival_kit_body_too_long"),
    category: z.enum(ARRIVAL_KIT_CATEGORIES, { message: "arrival_kit_category_invalid" }),
    country: z.string().min(1, "arrival_kit_country_required"),
    city: z.string().trim().max(ARRIVAL_KIT_CITY_MAX_LENGTH, "arrival_kit_city_too_long"),
    sourceName: z.string().trim().min(ARRIVAL_KIT_SOURCE_NAME_MIN_LENGTH, "arrival_kit_source_name_too_short").max(ARRIVAL_KIT_SOURCE_NAME_MAX_LENGTH, "arrival_kit_source_name_too_long"),
    sourceUrl: z.string().trim().min(1, "arrival_kit_source_url_required").max(ARRIVAL_KIT_SOURCE_URL_MAX_LENGTH, "arrival_kit_source_url_invalid"),
    verifiedOn: z.string().min(1, "arrival_kit_verified_at_invalid"),
    carrier: z.string(),
  })
  .superRefine((values, ctx) => {
    const lastVerifiedAt = parseArrivalKitDateInput(values.verifiedOn)
    if (lastVerifiedAt === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["verifiedOn"], message: "arrival_kit_verified_at_invalid" })
      return
    }
    const parsed = parseArrivalKitResource(inputOf(values, lastVerifiedAt), Date.now())
    if (!parsed.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [fieldOf(parsed.code, values)], message: parsed.code })
  })

type Values = z.infer<typeof schema>

/** Où dire un refus du domaine ou du fournisseur : le champ concerné, sinon le formulaire. */
const FIELD_OF: Partial<Record<string, FieldPath<Values>>> = {
  arrival_kit_title_too_short: "title",
  arrival_kit_title_too_long: "title",
  arrival_kit_summary_too_short: "summary",
  arrival_kit_summary_too_long: "summary",
  arrival_kit_body_too_short: "body",
  arrival_kit_body_too_long: "body",
  arrival_kit_category_invalid: "category",
  arrival_kit_country_required: "country",
  arrival_kit_country_unknown: "country",
  arrival_kit_country_is_home: "country",
  arrival_kit_city_too_long: "city",
  arrival_kit_city_invalid: "city",
  arrival_kit_source_name_too_short: "sourceName",
  arrival_kit_source_name_too_long: "sourceName",
  arrival_kit_source_url_required: "sourceUrl",
  arrival_kit_source_url_invalid: "sourceUrl",
  arrival_kit_source_url_not_https: "sourceUrl",
  arrival_kit_verified_at_invalid: "verifiedOn",
  arrival_kit_verified_at_in_future: "verifiedOn",
  arrival_kit_verified_at_too_old: "verifiedOn",
}

/** Une coordonnée se dit sur le champ qui la porte (titre, résumé, contenu, puis nom de la source). */
function fieldOf(code: string, values: Pick<Values, "title" | "summary" | "body">): FieldPath<Values> {
  if (code === "arrival_kit_contact_details_forbidden") {
    if (containsContactDetails(values.title)) return "title"
    if (containsContactDetails(values.summary)) return "summary"
    return containsContactDetails(values.body) ? "body" : "sourceName"
  }
  return FIELD_OF[code] ?? "title"
}

function inputOf(values: Values, lastVerifiedAt: number): ArrivalKitResourceInputView {
  return {
    title: values.title,
    summary: values.summary,
    body: values.body,
    category: values.category,
    country: values.country as CountryCode,
    city: values.city,
    sourceName: values.sourceName,
    sourceUrl: values.sourceUrl,
    lastVerifiedAt,
  }
}

/** Les valeurs de départ : une version existante, ou une proposition neuve (zone et date du jour). */
export interface ArrivalKitFormInitial {
  readonly title: string
  readonly summary: string
  readonly body: string
  readonly category: ArrivalKitCategory
  readonly country: CountryCode
  readonly city: string
  readonly sourceName: string
  readonly sourceUrl: string
  readonly lastVerifiedAt: number
}

export interface ArrivalKitResourceFormProps {
  readonly mode: "propose" | "edit"
  readonly initial: ArrivalKitFormInitial
  /** Proposition seulement : les pages au nom desquelles proposer (signataire vivant). */
  readonly carrierPages?: readonly ArrivalKitPageLabel[]
  /** L'envoi au fournisseur : `null` en cas de succès, sinon le code fermé du refus. */
  readonly onSave: (input: ArrivalKitResourceInputView, options: { readonly submit: boolean; readonly pageId: string | null }) => Promise<ActionErrorCode | null>
  readonly onCancel: () => void
}

export function ArrivalKitResourceForm(props: ArrivalKitResourceFormProps) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const countries = useMemo(() => residenceCountryOptions(locale), [locale])
  const carriers = props.mode === "propose" ? props.carrierPages ?? [] : []
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: props.initial.title,
      summary: props.initial.summary,
      body: props.initial.body,
      category: props.initial.category,
      country: props.initial.country,
      city: props.initial.city,
      sourceName: props.initial.sourceName,
      sourceUrl: props.initial.sourceUrl,
      verifiedOn: formatArrivalKitDateInput(props.initial.lastVerifiedAt),
      carrier: "",
    },
  })
  const [formError, setFormError] = useState<ActionErrorCode | null>(null)
  const locked = useRef(false)
  const titleInput = useRef<HTMLInputElement | null>(null)
  const titleField = form.register("title")
  useLayoutEffect(() => {
    titleInput.current?.focus()
  }, [])

  const error = (field: keyof Values) => {
    const message = form.formState.errors[field]?.message
    return typeof message === "string" ? t(errorKey(message)) : undefined
  }

  /** Enregistrer la version : soumise à la relecture, ou gardée en brouillon. Un seul envoi à la fois. */
  const save = (submit: boolean) =>
    form.handleSubmit(async (values) => {
      const lastVerifiedAt = parseArrivalKitDateInput(values.verifiedOn)
      if (locked.current || lastVerifiedAt === null) return
      locked.current = true
      setFormError(null)
      try {
        const code = await props.onSave(inputOf(values, lastVerifiedAt), { submit, pageId: values.carrier === "" ? null : values.carrier })
        if (code === null) return
        const field = FIELD_OF[code]
        if (field) form.setError(field, { message: code })
        else setFormError(code)
      } catch {
        setFormError("unknown")
      } finally {
        locked.current = false
      }
    })

  const busy = form.formState.isSubmitting
  return (
    <form noValidate className="flex min-w-0 flex-col gap-4" onSubmit={(event) => void save(true)(event)}>
      {props.mode === "edit" ? <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("arrivalKit.form.editNotice")}</p> : null}

      {carriers.length > 0 ? (
        <Field id={`${id}-carrier`} label={t("arrivalKit.propose.carrier")} hint={t("arrivalKit.propose.carrierHint")}>
          {(field) => (
            <select id={field.id} aria-describedby={field.describedBy} className={selectClass} disabled={busy} {...form.register("carrier")}>
              <option value="">{t("arrivalKit.propose.carrierSelf")}</option>
              {carriers.map((page) => (
                <option key={page.id} value={page.id}>{page.name}</option>
              ))}
            </select>
          )}
        </Field>
      ) : null}

      <Field id={`${id}-title`} label={t("arrivalKit.form.title")} hint={t("arrivalKit.form.titleHint", { min: ARRIVAL_KIT_TITLE_MIN_LENGTH, max: ARRIVAL_KIT_TITLE_MAX_LENGTH })} error={error("title")}>
        {(field) => (
          <Input
            id={field.id}
            aria-describedby={field.describedBy}
            aria-invalid={field.invalid || undefined}
            maxLength={ARRIVAL_KIT_TITLE_MAX_LENGTH}
            disabled={busy}
            {...titleField}
            ref={(element) => {
              titleField.ref(element)
              titleInput.current = element
            }}
          />
        )}
      </Field>

      <Field id={`${id}-summary`} label={t("arrivalKit.form.summary")} hint={t("arrivalKit.form.summaryHint", { min: ARRIVAL_KIT_SUMMARY_MIN_LENGTH, max: ARRIVAL_KIT_SUMMARY_MAX_LENGTH })} error={error("summary")}>
        {(field) => <Textarea id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} rows={2} maxLength={ARRIVAL_KIT_SUMMARY_MAX_LENGTH} disabled={busy} {...form.register("summary")} />}
      </Field>

      <Field id={`${id}-body`} label={t("arrivalKit.form.body")} hint={t("arrivalKit.form.bodyHint")} error={error("body")}>
        {(field) => <Textarea id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} rows={8} maxLength={ARRIVAL_KIT_BODY_MAX_LENGTH} disabled={busy} {...form.register("body")} />}
      </Field>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field id={`${id}-category`} label={t("arrivalKit.form.category")} error={error("category")}>
          {(field) => (
            <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={selectClass} disabled={busy} {...form.register("category")}>
              {ARRIVAL_KIT_CATEGORIES.map((category) => (
                <option key={category} value={category}>{t(`arrivalKit.category.${category}`)}</option>
              ))}
            </select>
          )}
        </Field>
        <Field id={`${id}-verified`} label={t("arrivalKit.form.verifiedOn")} hint={t("arrivalKit.form.verifiedOnHint")} error={error("verifiedOn")}>
          {(field) => <Input id={field.id} type="date" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("verifiedOn")} />}
        </Field>
        <Field id={`${id}-country`} label={t("arrivalKit.form.country")} error={error("country")}>
          {(field) => (
            <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={selectClass} disabled={busy} {...form.register("country")}>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>{country.name}</option>
              ))}
            </select>
          )}
        </Field>
        <Field id={`${id}-city`} label={t("arrivalKit.form.city")} hint={t("arrivalKit.form.cityHint")} error={error("city")}>
          {(field) => <Input id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} maxLength={ARRIVAL_KIT_CITY_MAX_LENGTH} autoComplete="address-level2" disabled={busy} {...form.register("city")} />}
        </Field>
      </div>

      <Field id={`${id}-source-name`} label={t("arrivalKit.form.sourceName")} hint={t("arrivalKit.form.sourceNameHint")} error={error("sourceName")}>
        {(field) => <Input id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} maxLength={ARRIVAL_KIT_SOURCE_NAME_MAX_LENGTH} disabled={busy} {...form.register("sourceName")} />}
      </Field>
      <Field id={`${id}-source-url`} label={t("arrivalKit.form.sourceUrl")} hint={t("arrivalKit.form.sourceUrlHint")} error={error("sourceUrl")}>
        {(field) => <Input id={field.id} type="url" inputMode="url" autoComplete="url" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} maxLength={ARRIVAL_KIT_SOURCE_URL_MAX_LENGTH} disabled={busy} {...form.register("sourceUrl")} />}
      </Field>

      {formError ? <p role="alert" className="text-sm font-medium text-destructive">{t(errorKey(formError))}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" disabled={busy} onClick={props.onCancel}>{t("arrivalKit.actions.cancel")}</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void save(false)()}>{t("arrivalKit.form.saveDraft")}</Button>
        <Button type="submit" disabled={busy} aria-busy={busy}>{t(busy ? "arrivalKit.actions.pleaseWait" : "arrivalKit.form.submit")}</Button>
      </div>
    </form>
  )
}
