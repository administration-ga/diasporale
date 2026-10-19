"use client"

/**
 * Le formulaire du profil de mentor (DG-024, troisième tranche) : devenir mentor
 * (opt-in explicite, case jamais précochée) ou modifier son profil à la version
 * lue. React Hook Form + Zod ; les règles du domaine restent l'autorité, le
 * serveur les rejuge. PROPRIÉTAIRE : chantier « mentorat ».
 */
import {
  isMentorCapacity,
  MENTOR_AVAILABILITY_MAX_LENGTH,
  MENTOR_AVAILABILITY_MIN_LENGTH,
  MENTOR_CAPACITY_MAX,
  MENTOR_CAPACITY_MIN,
  MENTOR_CITY_MAX_LENGTH,
  MENTOR_LANGUAGE_CODES,
  MENTOR_LANGUAGES_MAX,
  MENTOR_PRESENTATION_MAX_LENGTH,
  MENTOR_PRESENTATION_MIN_LENGTH,
  MENTORING_DOMAINS,
  isMentoringDomain,
  mentoringTextRefusal,
  parseResidenceCountry,
  type CountryCode,
} from "@diasporale/domain"
import { Button, Checkbox, Field, Input, Label, Textarea, residenceCountryOptions } from "@diasporale/features"
import type { ActionErrorCode, MentoringCapability, MentorProfileInputView, MyMentorProfileView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useMemo, useRef, useState, type FormEvent } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { languageName } from "@/components/service-format"

const selectClass = "h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus aria-invalid:border-destructive"

const profileSchema = z.object({
  domains: z.array(z.string()).min(1, "mentor_domains_required"),
  presentation: z.string().trim().min(MENTOR_PRESENTATION_MIN_LENGTH, "mentor_presentation_too_short").max(MENTOR_PRESENTATION_MAX_LENGTH, "mentor_presentation_too_long"),
  languages: z.array(z.string()).min(1, "mentor_languages_required").max(MENTOR_LANGUAGES_MAX, "mentor_languages_too_many"),
  country: z.string().refine((value) => parseResidenceCountry(value).ok, { message: "mentor_country_invalid" }),
  city: z.string().trim().max(MENTOR_CITY_MAX_LENGTH, "mentor_city_invalid"),
  availability: z.string().trim().min(MENTOR_AVAILABILITY_MIN_LENGTH, "mentor_availability_too_short").max(MENTOR_AVAILABILITY_MAX_LENGTH, "mentor_availability_too_long"),
  maxActiveMentees: z.string().refine((value) => isMentorCapacity(Number(value)), { message: "mentor_capacity_invalid" }),
  consent: z.boolean(),
})

type ProfileValues = z.infer<typeof profileSchema>

const CAPACITY_OPTIONS = Array.from({ length: MENTOR_CAPACITY_MAX - MENTOR_CAPACITY_MIN + 1 }, (_, index) => String(MENTOR_CAPACITY_MIN + index))

function defaultsOf(current: MyMentorProfileView | null, country: CountryCode): ProfileValues {
  return {
    domains: current ? [...current.domains] : [],
    presentation: current?.presentation ?? "",
    languages: current ? [...current.languages] : ["fr"],
    country: current?.country ?? country,
    city: current?.city ?? "",
    availability: current?.availability ?? "",
    maxActiveMentees: String(current?.maxActiveMentees ?? 2),
    consent: false,
  }
}

/**
 * Devenir mentor (`mode: "create"`, le consentement explicite est exigé) ou
 * modifier son profil (`mode: "update"`, à la version lue). Un profil retiré se
 * relit comme valeurs de départ d'un nouvel opt-in.
 */
export function MentorProfileForm(props: {
  readonly capability: MentoringCapability
  readonly mode: "create" | "update"
  readonly current: MyMentorProfileView | null
  readonly defaultCountry: CountryCode
  readonly onDone: () => void
  readonly onCancel?: () => void
}) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const countries = useMemo(() => residenceCountryOptions(locale), [locale])
  const [formError, setFormError] = useState<ActionErrorCode | null>(null)
  const locked = useRef(false)
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: defaultsOf(props.current, props.defaultCountry) })
  const errors = form.formState.errors
  const message = (code: string | undefined) => (code ? t(`errors.${code}`) : undefined)
  const creating = props.mode === "create"

  const validatedSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    for (const field of ["presentation", "availability", "city"] as const) {
      const refusal = mentoringTextRefusal(values[field])
      if (refusal) return form.setError(field, { message: refusal })
    }
    if (creating && !values.consent) return form.setError("consent", { message: "mentor_consent_required" })
    const country = parseResidenceCountry(values.country)
    if (!country.ok) return form.setError("country", { message: "mentor_country_invalid" })
    const input: MentorProfileInputView = {
      domains: values.domains.filter(isMentoringDomain),
      presentation: values.presentation,
      languages: values.languages,
      country: country.value,
      city: values.city.trim().length > 0 ? values.city : null,
      availability: values.availability,
      maxActiveMentees: Number(values.maxActiveMentees),
    }
    try {
      const result = creating || props.current === null
        ? await props.capability.becomeMentor({ ...input, consent: values.consent })
        : await props.capability.updateProfile({ ...input, expectedVersion: props.current.version })
      if (result.ok) {
        toast.success(t(creating ? "mentoring.form.created" : "mentoring.form.saved"))
        props.onDone()
        return
      }
      setFormError(result.code)
    } catch {
      setFormError("unknown")
    }
  })

  /** Un envoi à la fois. */
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

  const busy = form.formState.isSubmitting
  return (
    <form noValidate className="flex min-w-0 flex-col gap-4" onSubmit={submit}>
      <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={`${id}-domaines-aide`}>
        <legend className="text-sm font-medium">{t("mentoring.form.domains")}</legend>
        <p id={`${id}-domaines-aide`} className="text-[13px] text-muted-foreground">{t("mentoring.form.domainsHint")}</p>
        <Controller
          control={form.control}
          name="domains"
          render={({ field }) => (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {MENTORING_DOMAINS.map((domain) => (
                <div key={domain} className="flex min-h-11 items-center gap-2">
                  <Checkbox
                    id={`${id}-domaine-${domain}`}
                    checked={field.value.includes(domain)}
                    onCheckedChange={(checked) => field.onChange(checked === true ? [...field.value, domain] : field.value.filter((value) => value !== domain))}
                    disabled={busy}
                  />
                  <Label htmlFor={`${id}-domaine-${domain}`} className="font-normal">{t(`mentor.domain.${domain}`)}</Label>
                </div>
              ))}
            </div>
          )}
        />
        {errors.domains?.message ? <p role="alert" className="text-[13px] font-medium text-destructive">{message(errors.domains.message)}</p> : null}
      </fieldset>

      <Field
        id={`${id}-presentation`}
        label={t("mentoring.form.presentation")}
        hint={t("mentoring.form.presentationHint", { min: MENTOR_PRESENTATION_MIN_LENGTH, max: MENTOR_PRESENTATION_MAX_LENGTH })}
        error={message(errors.presentation?.message)}
      >
        {(field) => (
          <Textarea id={field.id} rows={4} maxLength={MENTOR_PRESENTATION_MAX_LENGTH} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("presentation")} />
        )}
      </Field>

      <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={`${id}-langues-aide`}>
        <legend className="text-sm font-medium">{t("mentoring.form.languages")}</legend>
        <p id={`${id}-langues-aide`} className="text-[13px] text-muted-foreground">{t("mentoring.form.languagesHint", { max: MENTOR_LANGUAGES_MAX })}</p>
        <Controller
          control={form.control}
          name="languages"
          render={({ field }) => (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {MENTOR_LANGUAGE_CODES.map((code) => (
                <div key={code} className="flex min-h-11 items-center gap-2">
                  <Checkbox
                    id={`${id}-langue-${code}`}
                    checked={field.value.includes(code)}
                    onCheckedChange={(checked) => field.onChange(checked === true ? [...field.value, code] : field.value.filter((value) => value !== code))}
                    disabled={busy}
                  />
                  <Label htmlFor={`${id}-langue-${code}`} className="font-normal">{languageName(code, locale)}</Label>
                </div>
              ))}
            </div>
          )}
        />
        {errors.languages?.message ? <p role="alert" className="text-[13px] font-medium text-destructive">{message(errors.languages.message)}</p> : null}
      </fieldset>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field id={`${id}-pays`} label={t("mentoring.form.country")} hint={t("mentoring.form.countryHint")} error={message(errors.country?.message)}>
          {(field) => (
            <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={selectClass} disabled={busy} {...form.register("country")}>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>{country.name}</option>
              ))}
            </select>
          )}
        </Field>
        <Field id={`${id}-ville`} label={t("mentoring.form.city")} hint={t("mentoring.form.cityHint")} error={message(errors.city?.message)}>
          {(field) => (
            <Input id={field.id} autoComplete="address-level2" maxLength={MENTOR_CITY_MAX_LENGTH} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("city")} />
          )}
        </Field>
        <Field id={`${id}-disponibilite`} label={t("mentoring.form.availability")} hint={t("mentoring.form.availabilityHint")} error={message(errors.availability?.message)}>
          {(field) => (
            <Input id={field.id} maxLength={MENTOR_AVAILABILITY_MAX_LENGTH} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} disabled={busy} {...form.register("availability")} />
          )}
        </Field>
        <Field id={`${id}-plafond`} label={t("mentoring.form.capacity")} hint={t("mentoring.form.capacityHint")} error={message(errors.maxActiveMentees?.message)}>
          {(field) => (
            <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={selectClass} disabled={busy} {...form.register("maxActiveMentees")}>
              {CAPACITY_OPTIONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("mentoring.form.reminder")}</p>

      {creating ? (
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
            <Label htmlFor={`${id}-consentement`} className="font-normal leading-snug">{t("mentoring.form.consent")}</Label>
          </div>
          {errors.consent?.message ? <p id={`${id}-consentement-erreur`} role="alert" className="text-[13px] font-medium text-destructive">{message(errors.consent.message)}</p> : null}
        </div>
      ) : null}

      {formError ? <p role="alert" className="text-sm font-medium text-destructive">{t(`errors.${formError}`)}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy} aria-busy={busy}>
          {t(busy ? "mentoring.form.saving" : creating ? "mentoring.form.create" : "mentoring.form.save")}
        </Button>
        {props.onCancel ? <Button type="button" variant="ghost" disabled={busy} onClick={props.onCancel}>{t("mentoring.sheet.back")}</Button> : null}
      </div>
    </form>
  )
}
