"use client"

import {
  CURRENCY_CODES,
  parseMajorAmount,
  parseServiceOffer,
  SERVICE_CATEGORIES,
  SERVICE_CITY_MAX_LENGTH,
  SERVICE_DELIVERY_MODES,
  SERVICE_DESCRIPTION_MAX_LENGTH,
  SERVICE_DESCRIPTION_MIN_LENGTH,
  SERVICE_LANGUAGE_CODES,
  SERVICE_LANGUAGES_MAX,
  SERVICE_PRICING_MODES,
  SERVICE_TITLE_MAX_LENGTH,
  SERVICE_TITLE_MIN_LENGTH,
  type CountryCode,
  type ServiceOfferInput,
  type ServiceOfferRefusal,
  type ServicePricingLike,
} from "@diasporale/domain"
import { Button, Card, Field, Input, Textarea, residenceCountryOptions } from "@diasporale/features"
import type { ActionErrorCode, ServiceOfferDetailView, ServiceOfferInputView, ServicesCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useForm, useWatch, type FieldPath } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { formatServiceDuration, languageName, majorAmountInput } from "./service-format"

/** Durées proposées, en minutes ; une durée déjà enregistrée hors de cette liste reste proposée. */
const DURATION_CHOICES = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720] as const

const selectClass = "h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus aria-invalid:border-destructive"

/**
 * Le formulaire d'une offre (React Hook Form + Zod). Les bornes de Zod sont
 * celles du domaine ; puis LA règle du domaine (`parseServiceOffer`) juge
 * l'ensemble — coordonnées interdites dans le texte comprises — avant tout
 * envoi. Le fournisseur la rejuge (moteur ou démonstration).
 */
const schema = z
  .object({
    title: z.string().trim().min(SERVICE_TITLE_MIN_LENGTH, "service_title_too_short").max(SERVICE_TITLE_MAX_LENGTH, "service_title_too_long"),
    description: z
      .string()
      .trim()
      .min(SERVICE_DESCRIPTION_MIN_LENGTH, "service_description_too_short")
      .max(SERVICE_DESCRIPTION_MAX_LENGTH, "service_description_too_long"),
    category: z.enum(SERVICE_CATEGORIES, { message: "service_category_invalid" }),
    country: z.string().min(1, "service_country_required"),
    city: z.string().trim().min(1, "service_city_required").max(SERVICE_CITY_MAX_LENGTH, "service_city_too_long"),
    delivery: z.enum(SERVICE_DELIVERY_MODES, { message: "service_delivery_invalid" }),
    languages: z.array(z.enum(SERVICE_LANGUAGE_CODES)).min(1, "service_languages_required").max(SERVICE_LANGUAGES_MAX, "service_languages_too_many"),
    duration: z.string(),
    pricingMode: z.enum(SERVICE_PRICING_MODES, { message: "service_pricing_invalid" }),
    amount: z.string(),
    currency: z.string(),
  })
  .superRefine((values, ctx) => {
    const input = inputOf(values)
    if (!input.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [fieldOf(input.code)], message: input.code })
      return
    }
    const offer = parseServiceOffer(input.value)
    if (!offer.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [fieldOf(offer.code)], message: offer.code })
  })

type Values = z.infer<typeof schema>

/** Où dire un refus du domaine ou du fournisseur : le champ concerné, sinon le formulaire. */
const FIELD_OF: Partial<Record<string, FieldPath<Values>>> = {
  service_title_too_short: "title",
  service_title_too_long: "title",
  service_description_too_short: "description",
  service_description_too_long: "description",
  service_contact_details_forbidden: "description",
  service_category_invalid: "category",
  service_country_required: "country",
  service_country_unknown: "country",
  service_country_is_home: "country",
  service_city_required: "city",
  service_city_too_long: "city",
  service_delivery_invalid: "delivery",
  service_languages_required: "languages",
  service_languages_too_many: "languages",
  service_language_invalid: "languages",
  service_duration_invalid: "duration",
  service_pricing_invalid: "pricingMode",
  service_price_from_zero: "amount",
  amount_invalid: "amount",
  amount_too_large: "amount",
  currency_invalid: "currency",
}

function fieldOf(code: string): FieldPath<Values> {
  return FIELD_OF[code] ?? "title"
}

/** Les valeurs du formulaire, en saisie du domaine (le montant lisible devient des unités mineures). */
function inputOf(values: Values): { readonly ok: true; readonly value: ServiceOfferInput & { readonly pricing: ServicePricingLike } } | { readonly ok: false; readonly code: ServiceOfferRefusal } {
  let pricing: ServicePricingLike = { mode: "quote" }
  if (values.pricingMode !== "quote") {
    const money = parseMajorAmount(values.amount, values.currency)
    if (!money.ok) return money
    pricing = { mode: values.pricingMode, amountMinor: money.value.amountMinor, currency: money.value.currency }
  }
  return {
    ok: true,
    value: {
      title: values.title,
      description: values.description,
      category: values.category,
      country: values.country,
      city: values.city,
      delivery: values.delivery,
      languages: values.languages,
      durationMinutes: values.duration === "" ? null : Number(values.duration),
      pricing,
    },
  }
}

function defaultsOf(offer: ServiceOfferDetailView | null, fallback: { readonly country: CountryCode; readonly city: string }): Values {
  if (offer === null) {
    return {
      title: "",
      description: "",
      category: SERVICE_CATEGORIES[0],
      country: fallback.country,
      city: fallback.city,
      delivery: "onsite",
      languages: ["fr"],
      duration: "",
      pricingMode: "quote",
      amount: "",
      currency: "EUR",
    }
  }
  const { pricing } = offer
  return {
    title: offer.title,
    description: offer.description,
    category: offer.category,
    country: offer.country,
    city: offer.city,
    delivery: offer.delivery,
    languages: offer.languages.filter((code): code is (typeof SERVICE_LANGUAGE_CODES)[number] => (SERVICE_LANGUAGE_CODES as readonly string[]).includes(code)),
    duration: offer.durationMinutes === null ? "" : String(offer.durationMinutes),
    pricingMode: pricing.mode,
    amount: pricing.mode === "quote" ? "" : majorAmountInput(pricing.amountMinor, pricing.currency),
    currency: pricing.mode === "quote" ? "EUR" : pricing.currency,
  }
}

export interface ServiceOfferFormProps {
  readonly services: ServicesCapability
  readonly pageId: string
  /** L'offre à modifier ; absente : une nouvelle offre. */
  readonly offer?: ServiceOfferDetailView
  /** Zone proposée pour une nouvelle offre (celle du membre). */
  readonly fallbackZone: { readonly country: CountryCode; readonly city: string }
  readonly onClose: () => void
  /** Après un conflit de version : relire la dernière version de l'offre. */
  readonly onReload?: () => void
}

export function ServiceOfferForm(props: ServiceOfferFormProps) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const offer = props.offer ?? null
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaultsOf(offer, props.fallbackZone) })
  const [formError, setFormError] = useState<ActionErrorCode | null>(null)
  const locked = useRef(false)
  const titleInput = useRef<HTMLInputElement | null>(null)
  const titleField = form.register("title")
  const countries = useMemo(() => residenceCountryOptions(locale), [locale])
  const durations = useMemo(() => {
    const current = offer?.durationMinutes ?? null
    const choices: number[] = [...DURATION_CHOICES]
    return current !== null && !choices.includes(current) ? [...choices, current].sort((left, right) => left - right) : choices
  }, [offer?.durationMinutes])
  const pricingMode = useWatch({ control: form.control, name: "pricingMode" })
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
      const parsed = inputOf(values)
      if (!parsed.ok) return
      locked.current = true
      setFormError(null)
      const input: ServiceOfferInputView = {
        title: values.title,
        description: values.description,
        category: values.category,
        country: values.country as CountryCode,
        city: values.city,
        delivery: values.delivery,
        languages: values.languages,
        durationMinutes: parsed.value.durationMinutes ?? null,
        pricing: parsed.value.pricing,
      }
      try {
        const result = offer === null
          ? await props.services.createOffer({ ...input, pageId: props.pageId, publish })
          : await props.services.updateOffer({ ...input, offerId: offer.id, expectedVersion: offer.version })
        if (result.ok) {
          toast.success(t(offer === null ? (publish ? "services.form.published" : "services.form.created") : "services.form.saved"))
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
  const conflict = formError === "service_offer_version_conflict"
  return (
    <Card className="p-4">
      <form noValidate className="flex min-w-0 flex-col gap-4" onSubmit={(event) => void save(false)(event)} aria-labelledby={`${id}-titre`}>
        <h3 id={`${id}-titre`} className="text-lg font-semibold">{t(offer === null ? "services.form.createTitle" : "services.form.editTitle")}</h3>

        <Field id={`${id}-title`} label={t("services.form.title")} hint={t("services.form.titleHint", { min: SERVICE_TITLE_MIN_LENGTH, max: SERVICE_TITLE_MAX_LENGTH })} error={error("title")}>
          {(field) => (
            <Input
              id={field.id}
              aria-describedby={field.describedBy}
              aria-invalid={field.invalid || undefined}
              maxLength={SERVICE_TITLE_MAX_LENGTH}
              disabled={busy}
              {...titleField}
              ref={(element) => {
                titleField.ref(element)
                titleInput.current = element
              }}
            />
          )}
        </Field>

        <Field id={`${id}-description`} label={t("services.form.description")} hint={t("services.form.descriptionHint")} error={error("description")}>
          {(field) => <Textarea id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} rows={5} maxLength={SERVICE_DESCRIPTION_MAX_LENGTH} disabled={busy} {...form.register("description")} />}
        </Field>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id={`${id}-category`} label={t("services.form.category")} hint={t("services.form.categoryHint")} error={error("category")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={selectClass} disabled={busy} {...form.register("category")}>
                {SERVICE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{t(`services.category.${category}`)}</option>
                ))}
              </select>
            )}
          </Field>
          <Field id={`${id}-delivery`} label={t("services.form.delivery")} error={error("delivery")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={selectClass} disabled={busy} {...form.register("delivery")}>
                {SERVICE_DELIVERY_MODES.map((delivery) => (
                  <option key={delivery} value={delivery}>{t(`services.delivery.${delivery}`)}</option>
                ))}
              </select>
            )}
          </Field>
          <Field id={`${id}-country`} label={t("services.form.country")} error={error("country")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={selectClass} disabled={busy} {...form.register("country")}>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>{country.name}</option>
                ))}
              </select>
            )}
          </Field>
          <Field id={`${id}-city`} label={t("services.form.city")} hint={t("services.form.cityHint")} error={error("city")}>
            {(field) => <Input id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} maxLength={SERVICE_CITY_MAX_LENGTH} autoComplete="address-level2" disabled={busy} {...form.register("city")} />}
          </Field>
        </div>

        <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={error("languages") ? `${id}-languages-erreur` : undefined}>
          <legend className="mb-1 text-sm font-medium">{t("services.form.languages")}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {SERVICE_LANGUAGE_CODES.map((code) => (
              <label key={code} className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" value={code} className="size-5 accent-primary" disabled={busy} {...form.register("languages")} />
                {languageName(code, locale)}
              </label>
            ))}
          </div>
          {error("languages") ? <p id={`${id}-languages-erreur`} role="alert" className="text-[13px] font-medium text-destructive">{error("languages")}</p> : null}
        </fieldset>

        <Field id={`${id}-duration`} label={t("services.form.duration")} error={error("duration")}>
          {(field) => (
            <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={selectClass} disabled={busy} {...form.register("duration")}>
              <option value="">{t("services.form.durationNone")}</option>
              {durations.map((minutes) => (
                <option key={minutes} value={String(minutes)}>{formatServiceDuration(minutes, t)}</option>
              ))}
            </select>
          )}
        </Field>

        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="mb-1 text-sm font-medium">{t("services.form.pricing")}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {SERVICE_PRICING_MODES.map((mode) => (
              <label key={mode} className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input type="radio" value={mode} className="size-5 accent-primary" disabled={busy} {...form.register("pricingMode")} />
                {t(`services.pricingMode.${mode}`)}
              </label>
            ))}
          </div>
          {error("pricingMode") ? <p role="alert" className="text-[13px] font-medium text-destructive">{error("pricingMode")}</p> : null}
          {pricingMode !== "quote" ? (
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field id={`${id}-amount`} label={t("services.form.amount")} hint={t("services.form.amountHint")} error={error("amount")}>
                {(field) => <Input id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} inputMode="decimal" disabled={busy} {...form.register("amount")} />}
              </Field>
              <Field id={`${id}-currency`} label={t("services.form.currency")} error={error("currency")}>
                {(field) => (
                  <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={selectClass} disabled={busy} {...form.register("currency")}>
                    {CURRENCY_CODES.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          ) : null}
        </fieldset>

        <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("services.offer.noPayment")}</p>

        {formError !== null ? (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-destructive px-3 py-2 text-sm">
            {conflict ? <p className="font-semibold">{t("services.form.conflictTitle")}</p> : null}
            <p>{t(conflict ? "services.form.conflictBody" : `errors.${formError}`)}</p>
            {conflict && props.onReload ? (
              <Button variant="outline" size="sm" onClick={props.onReload}>{t("services.form.reload")}</Button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {offer === null ? (
            <>
              <Button type="submit" variant="outline" disabled={busy}>{t(busy ? "common.pleaseWait" : "services.form.saveDraft")}</Button>
              <Button type="button" disabled={busy} onClick={(event) => void save(true)(event)}>{t("services.form.publish")}</Button>
            </>
          ) : (
            <Button type="submit" disabled={busy}>{t(busy ? "common.pleaseWait" : "services.form.save")}</Button>
          )}
          <Button type="button" variant="ghost" disabled={busy} onClick={props.onClose}>{t("common.cancel")}</Button>
        </div>
      </form>
    </Card>
  )
}
