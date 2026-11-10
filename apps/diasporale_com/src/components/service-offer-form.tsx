"use client"

import {
  CURRENCY_CODES,
  parseMajorAmount,
  parseServiceOffer,
  parseServiceProviderSettings,
  SERVICE_BOOKING_CAPACITY_MAX,
  SERVICE_CANCELLATION_TERMS_MAX_LENGTH,
  SERVICE_CATEGORIES,
  SERVICE_CITY_MAX_LENGTH,
  SERVICE_DELIVERY_MODES,
  SERVICE_DESCRIPTION_MAX_LENGTH,
  SERVICE_DESCRIPTION_MIN_LENGTH,
  SERVICE_LANGUAGE_CODES,
  SERVICE_LANGUAGES_MAX,
  SERVICE_LOCATION_AREA_MAX_LENGTH,
  SERVICE_PRICING_MODES,
  SERVICE_TITLE_MAX_LENGTH,
  SERVICE_TITLE_MIN_LENGTH,
  type CountryCode,
  type ServiceOfferInput,
  type ServiceOfferRefusal,
  type ServicePricingLike,
  serviceTextRefusal,
} from "@diasporale/domain"
import { Button, Card, Field, Input, Textarea, residenceCountryOptions } from "@diasporale/features"
import type { ActionErrorCode, ServiceOfferDetailView, ServiceOfferInputView, ServiceProviderSettingsView, ServicesCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useForm, useWatch, type FieldPath } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { formatServiceDuration, languageName, majorAmountInput } from "./service-format"
import { browserTimeZone, timeZoneOptions } from "./service-request-ui"

/** Durées proposées, en minutes ; une durée déjà enregistrée hors de cette liste reste proposée. */
const DURATION_CHOICES = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720] as const

const selectClass = "h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus aria-invalid:border-destructive"

/** SV-04 : le lieu habituel d'une prestation — aucun (la ville de l'offre), sur place approximatif, ou à distance. */
const SETTINGS_LOCATION_MODES = ["none", "onsite", "remote"] as const
const SETTINGS_LOCATION_LABELS = {
  none: "serviceProposalSettings.locationNone",
  onsite: "serviceProposalSettings.locationOnsite",
  remote: "serviceProposalSettings.locationRemote",
} as const satisfies Record<(typeof SETTINGS_LOCATION_MODES)[number], string>

/** SV-09 : de un (par défaut) à dix rendez-vous simultanés. */
const CAPACITY_CHOICES = Array.from({ length: SERVICE_BOOKING_CAPACITY_MAX }, (_, index) => index + 1)

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
    settingsLocationMode: z.enum(SETTINGS_LOCATION_MODES),
    settingsArea: z.string().max(SERVICE_LOCATION_AREA_MAX_LENGTH, "proposal_location_invalid"),
    settingsTerms: z.string().max(SERVICE_CANCELLATION_TERMS_MAX_LENGTH, "proposal_terms_invalid"),
    settingsTimeZone: z.string(),
    settingsCapacity: z.string(),
  })
  .superRefine((values, ctx) => {
    const input = inputOf(values)
    if (!input.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [fieldOf(input.code)], message: input.code })
      return
    }
    const offer = parseServiceOffer(input.value)
    if (!offer.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [fieldOf(offer.code)], message: offer.code })
      return
    }
    // SV-04 : les réglages de prestation, jugés par la règle du domaine (mêmes refus que la proposition).
    const settings = parseServiceProviderSettings(settingsOf(values))
    if (!settings.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [settingsFieldOf(settings.code, values)], message: settings.code })
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
  request_time_zone_invalid: "settingsTimeZone",
  proposal_location_invalid: "settingsArea",
  proposal_terms_invalid: "settingsTerms",
  booking_capacity_invalid: "settingsCapacity",
}

function fieldOf(code: string): FieldPath<Values> {
  return FIELD_OF[code] ?? "title"
}

/** SV-04 : les réglages saisis, en réglages de prestation (un champ vide n'est pas réglé). */
function settingsOf(values: Values): ServiceProviderSettingsView {
  return {
    timeZone: values.settingsTimeZone === "" ? null : values.settingsTimeZone,
    location: values.settingsLocationMode === "remote" ? { mode: "remote" } : values.settingsLocationMode === "onsite" ? { mode: "onsite", area: values.settingsArea } : null,
    cancellationTerms: values.settingsTerms.trim() === "" ? null : values.settingsTerms,
    bookingCapacity: Number(values.settingsCapacity),
  }
}

/** Le champ d'un refus des réglages : une coordonnée ou une adresse se dit là où elle est écrite. */
function settingsFieldOf(code: string, values: Values): FieldPath<Values> {
  if (code === "request_contact_forbidden" || code === "request_address_forbidden") {
    return values.settingsLocationMode === "onsite" && serviceTextRefusal(values.settingsArea) !== null ? "settingsArea" : "settingsTerms"
  }
  return fieldOf(code)
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
      settingsLocationMode: "none",
      settingsArea: "",
      settingsTerms: "",
      settingsTimeZone: "",
      settingsCapacity: "1",
    }
  }
  const { pricing } = offer
  const settings = offer.providerSettings ?? null
  const location = settings?.location ?? null
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
    settingsLocationMode: location?.mode ?? "none",
    settingsArea: location?.mode === "onsite" ? location.area : "",
    settingsTerms: settings?.cancellationTerms ?? "",
    settingsTimeZone: settings?.timeZone ?? "",
    settingsCapacity: String(settings?.bookingCapacity ?? 1),
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
  const settingsLocationMode = useWatch({ control: form.control, name: "settingsLocationMode" })
  // Le fuseau déjà réglé reste choisissable, même hors de la liste du navigateur.
  const zones = useMemo(() => {
    const saved = offer?.providerSettings?.timeZone ?? null
    return [...new Set([...(saved ? [saved] : []), ...timeZoneOptions(browserTimeZone())])]
  }, [offer?.providerSettings?.timeZone])
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
        providerSettings: settingsOf(values),
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

        <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3" aria-describedby={`${id}-reglages-aide`}>
          <legend className="px-1 text-sm font-medium">{t("serviceProposalSettings.title")}</legend>
          <p id={`${id}-reglages-aide`} className="text-[13px] text-muted-foreground">{t("serviceProposalSettings.lead")}</p>
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("serviceProposalSettings.location")}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {SETTINGS_LOCATION_MODES.map((mode) => (
                <label key={mode} className="inline-flex min-h-11 items-center gap-2 text-sm">
                  <input type="radio" value={mode} className="size-5 accent-primary" disabled={busy} {...form.register("settingsLocationMode")} />
                  {t(SETTINGS_LOCATION_LABELS[mode])}
                </label>
              ))}
            </div>
          </fieldset>
          {settingsLocationMode === "onsite" ? (
            <Field id={`${id}-settings-area`} label={t("serviceProposalSettings.area")} hint={t("serviceProposalSettings.areaHint")} error={error("settingsArea")}>
              {(field) => <Input id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} maxLength={SERVICE_LOCATION_AREA_MAX_LENGTH} autoComplete="off" disabled={busy} {...form.register("settingsArea")} />}
            </Field>
          ) : null}
          <Field id={`${id}-settings-terms`} label={t("serviceProposalSettings.terms")} hint={t("serviceProposalSettings.termsHint")} error={error("settingsTerms")}>
            {(field) => <Textarea id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} rows={2} maxLength={SERVICE_CANCELLATION_TERMS_MAX_LENGTH} disabled={busy} {...form.register("settingsTerms")} />}
          </Field>
          <Field id={`${id}-settings-zone`} label={t("serviceProposalSettings.timeZone")} hint={t("serviceProposalSettings.timeZoneHint")} error={error("settingsTimeZone")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={selectClass} disabled={busy} {...form.register("settingsTimeZone")}>
                <option value="">{t("serviceProposalSettings.timeZoneDevice")}</option>
                {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
              </select>
            )}
          </Field>
          <Field id={`${id}-settings-capacity`} label={t("serviceProposalSettings.capacity")} hint={t("serviceProposalSettings.capacityHint")} error={error("settingsCapacity")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={selectClass} disabled={busy} {...form.register("settingsCapacity")}>
                {CAPACITY_CHOICES.map((count) => <option key={count} value={String(count)}>{count}</option>)}
              </select>
            )}
          </Field>
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
