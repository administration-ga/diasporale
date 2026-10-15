"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { initialConsentChoices, isResidenceCountry, type CountryCode } from "@diasporale/domain"
import {
  Button,
  Checkbox,
  CountrySwitch,
  Field,
  Input,
  Label,
  RadioCard,
  RadioGroup,
  cn,
  handleRefusal,
  normalizeHandle,
} from "@diasporale/features"
import { useActions, useHandleSuggestions, useOpenCountries } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState, type ReactNode } from "react"
import { Controller, useForm, useWatch, type Control, type FieldPath } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Gate } from "@/components/gate"
import { PublicShell } from "@/components/site-chrome"
import { routes } from "@/lib/routes"

const OTHER_HANDLE = "__autre__"

const schema = z.object({
  country: z.string().refine((value) => isResidenceCountry(value), "country_required"),
  city: z.string().trim().max(80, "city_too_long"),
  displayName: z.string().trim().min(2, "display_name_invalid").max(60, "display_name_invalid"),
  handleChoice: z.string().min(1, "handle_required"),
  handleOther: z.string(),
  socialProfile: z.boolean().refine((value) => value, "consent_social_profile_required"),
  directory: z.boolean(),
  directoryLevel: z.enum(["country", "network"]),
  notifications: z.boolean(),
})
// Le pays est une chaîne en saisie et un `CountryCode` en sortie (garde de type du domaine).
type FormInput = z.input<typeof schema>
type Values = z.output<typeof schema>

const STEP_FIELDS: readonly (readonly FieldPath<FormInput>[])[] = [
  ["country", "city"],
  ["displayName", "handleChoice"],
  ["socialProfile", "directory", "notifications"],
]

/** `/bienvenue` — onboarding en trois écrans (EXF-DG-02, E12). */
export function WelcomeScreen() {
  return (
    <PublicShell hideEnter>
      <Gate require="account">{() => <Onboarding />}</Gate>
    </PublicShell>
  )
}

function Onboarding() {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const router = useRouter()
  const ids = useId()
  const openCountries = useOpenCountries()
  const [step, setStep] = useState(0)
  const consents = initialConsentChoices()
  const form = useForm<FormInput, unknown, Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      country: "",
      city: "",
      displayName: "",
      handleChoice: "",
      handleOther: "",
      // Contrat « aucune case précochée » : les trois consentements partent de `initialConsentChoices()`.
      socialProfile: consents.social_profile,
      directory: consents.directory,
      directoryLevel: "country",
      notifications: consents.notifications,
    },
  })
  const [displayName, handleChoice, directory, country] = useWatch({
    control: form.control,
    name: ["displayName", "handleChoice", "directory", "country"],
  })
  const suggestions = useHandleSuggestions(displayName)
  const open = openCountries.status === "ready" ? openCountries.data.map((item) => item.country) : []

  const chosenHandle = (values: Pick<FormInput, "handleChoice" | "handleOther">) => normalizeHandle(values.handleChoice === OTHER_HANDLE ? values.handleOther : values.handleChoice)

  const next = async () => {
    const valid = await form.trigger([...(STEP_FIELDS[step] ?? [])], { shouldFocus: true })
    if (!valid) return
    if (step === 1) {
      const handle = chosenHandle(form.getValues())
      const refusal = handleRefusal(handle)
      if (refusal) {
        form.setError(form.getValues().handleChoice === OTHER_HANDLE ? "handleOther" : "handleChoice", { message: refusal }, { shouldFocus: true })
        return
      }
      const check = await actions.checkHandle(handle)
      if (!check.ok || !check.value.available) {
        form.setError("handleOther", { message: check.ok ? "handle_taken" : check.code }, { shouldFocus: true })
        return
      }
    }
    setStep((current) => Math.min(current + 1, 2))
  }

  const submit = form.handleSubmit(async (values) => {
    const result = await actions.join({
      facet: { countryOfResidence: values.country, city: values.city },
      handle: chosenHandle(values),
      displayName: values.displayName,
      consents: { social_profile: values.socialProfile, directory: values.directory, notifications: values.notifications },
      directoryVisibility: values.directory ? values.directoryLevel : "hidden",
    })
    if (!result.ok) {
      toast.error(t(`errors.${result.code}`))
      return
    }
    toast.success(t("welcome.joined"))
    router.push(`${routes.hub(result.value.country)}?bienvenue=1`)
  })

  const errorOf = (name: keyof FormInput) => {
    const message = form.formState.errors[name]?.message
    return message ? t(`errors.${message}`) : undefined
  }

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 pb-10 pt-6 md:pt-10">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {t("welcome.stepOf", { step: step + 1, total: 3 })}
      </p>
      <div aria-hidden className="mt-2 grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((index) => (
          <span key={index} className={cn("h-1.5 rounded-full", index <= step ? "bg-primary" : "bg-[var(--ink-200)]")} />
        ))}
      </div>
      <h1 className="mt-6 font-display text-4xl font-bold leading-tight">{t(`welcome.step${step + 1}Title`)}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t(`welcome.step${step + 1}Lead`)}</p>

      <form
        noValidate
        onSubmit={(event) => {
          if (step < 2) {
            event.preventDefault()
            void next()
          } else {
            void submit(event)
          }
        }}
        className="mt-8 flex flex-col gap-6"
      >
        {step === 0 ? (
          <>
            <Field id={`${ids}-pays`} label={t("welcome.countryLabel")} hint={t("welcome.countryHint")} error={errorOf("country")}>
              {(control) => (
                <Controller
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <CountrySwitch
                      id={control.id}
                      describedBy={control.describedBy}
                      invalid={control.invalid}
                      value={isResidenceCountry(field.value) ? field.value : null}
                      onChange={(code: CountryCode) => {
                        field.onChange(code)
                        void form.trigger("country")
                      }}
                      openCountries={open}
                      title={t("welcome.countrySheetTitle")}
                      description={t("welcome.countrySheetDescription")}
                    />
                  )}
                />
              )}
            </Field>
            <Field id={`${ids}-ville`} label={t("welcome.cityLabel")} hint={t("welcome.cityHint")} error={errorOf("city")}>
              {(control) => (
                <Input
                  id={control.id}
                  aria-describedby={control.describedBy}
                  aria-invalid={control.invalid || undefined}
                  autoComplete="address-level2"
                  {...form.register("city")}
                />
              )}
            </Field>
            {isResidenceCountry(country) && !open.includes(country) ? (
              <p className="rounded-lg bg-pending px-3 py-2 text-[13px] text-pending-foreground">{t("welcome.countryNotOpen")}</p>
            ) : null}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Field id={`${ids}-nom`} label={t("welcome.displayNameLabel")} hint={t("welcome.displayNameHint")} error={errorOf("displayName")}>
              {(control) => (
                <Input
                  id={control.id}
                  aria-describedby={control.describedBy}
                  aria-invalid={control.invalid || undefined}
                  autoComplete="name"
                  {...form.register("displayName")}
                />
              )}
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t("welcome.handleLegend")}</legend>
              <p className="text-[13px] text-muted-foreground">{t("welcome.handleHint")}</p>
              <Controller
                control={form.control}
                name="handleChoice"
                render={({ field }) => (
                  <RadioGroup value={field.value} onValueChange={field.onChange} aria-label={t("welcome.handleLegend")}>
                    {suggestions.map((suggestion) => (
                      <RadioCard key={suggestion} value={suggestion}>
                        <span className="font-mono text-[15px]">@{suggestion}</span>
                      </RadioCard>
                    ))}
                    <RadioCard value={OTHER_HANDLE}>
                      <span className="text-[15px]">{t("welcome.handleOther")}</span>
                    </RadioCard>
                  </RadioGroup>
                )}
              />
              {errorOf("handleChoice") ? (
                <p role="alert" className="text-[13px] font-medium text-destructive">
                  {errorOf("handleChoice")}
                </p>
              ) : null}
              {handleChoice === OTHER_HANDLE ? (
                <Field id={`${ids}-handle`} label={t("welcome.handleOtherLabel")} hint={t("welcome.handleRules")} error={errorOf("handleOther")}>
                  {(control) => (
                    <div className="relative">
                      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                        @
                      </span>
                      <Input
                        id={control.id}
                        aria-describedby={control.describedBy}
                        aria-invalid={control.invalid || undefined}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className="pl-7 font-mono"
                        {...form.register("handleOther")}
                      />
                    </div>
                  )}
                </Field>
              ) : null}
            </fieldset>
          </>
        ) : null}

        {step === 2 ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">{t("welcome.consentsLegend")}</legend>
            <ConsentRow
              id={`${ids}-profil`}
              name="socialProfile"
              control={form.control}
              title={t("consent.socialProfile.title")}
              body={t("consent.socialProfile.body")}
              required={t("consent.required")}
              error={errorOf("socialProfile")}
            />
            <ConsentRow
              id={`${ids}-annuaire`}
              name="directory"
              control={form.control}
              title={t("consent.directory.title")}
              body={t("consent.directory.body")}
            >
              {directory ? (
                <Controller
                  control={form.control}
                  name="directoryLevel"
                  render={({ field }) => (
                    <RadioGroup value={field.value} onValueChange={field.onChange} aria-label={t("consent.directory.levelLabel")} className="mt-3">
                      <RadioCard value="country">
                        <span className="text-sm">{t("consent.directory.country")}</span>
                      </RadioCard>
                      <RadioCard value="network">
                        <span className="text-sm">{t("consent.directory.network")}</span>
                      </RadioCard>
                    </RadioGroup>
                  )}
                />
              ) : null}
            </ConsentRow>
            <ConsentRow
              id={`${ids}-notifications`}
              name="notifications"
              control={form.control}
              title={t("consent.notifications.title")}
              body={t("consent.notifications.body")}
            />
            <p className="text-[13px] text-muted-foreground">{t("welcome.consentsFooter")}</p>
          </fieldset>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((current) => current - 1)}>
              <ArrowLeftIcon aria-hidden />
              {t("common.back")}
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {step < 2 ? (
              <>
                {t("common.next")}
                <ArrowRightIcon aria-hidden />
              </>
            ) : (
              <>
                <CheckIcon aria-hidden />
                {form.formState.isSubmitting ? t("common.pleaseWait") : t("welcome.submit")}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

function ConsentRow(props: {
  id: string
  name: "socialProfile" | "directory" | "notifications"
  control: Control<FormInput, unknown, Values>
  title: string
  body: string
  required?: string
  error?: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <Controller
          control={props.control}
          name={props.name}
          render={({ field }) => (
            <Checkbox
              id={props.id}
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              aria-describedby={`${props.id}-texte`}
              aria-invalid={props.error ? true : undefined}
              className="mt-0.5"
            />
          )}
        />
        <div className="min-w-0 flex-1">
          <Label htmlFor={props.id} className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
            {props.title}
            {props.required ? (
              <span className="rounded-[var(--radius-xs)] bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{props.required}</span>
            ) : null}
          </Label>
          <p id={`${props.id}-texte`} className="mt-1 text-[13px] leading-snug text-muted-foreground">
            {props.body}
          </p>
          {props.error ? (
            <p role="alert" className="mt-2 text-[13px] font-medium text-destructive">
              {props.error}
            </p>
          ) : null}
          {props.children}
        </div>
      </div>
    </div>
  )
}
