"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ARRIVED_AT_MIN_YEAR, initialConsentChoices, isResidenceCountry, utcYear, type CountryCode } from "@diasporale/domain"
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
import {
  useActions,
  useDataSource,
  useHandleSuggestions,
  useOpenCountries,
  type ActionErrorCode,
  type DiasporaleActions,
  type DiasporaleDataSource,
  type MembershipView,
  type OwnProfileView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, LogOutIcon, ShieldCheckIcon } from "lucide-react"
import NextLink from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Controller, useForm, useWatch, type Control, type FieldPath, type Resolver } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Gate, GateSkeleton } from "@/components/gate"
import { useSignOutEverywhere } from "@/components/sign-out-settings"
import { PublicShell } from "@/components/site-chrome"
import { peekReturnPath, welcomeExit } from "@/lib/return-path"
import { routes } from "@/lib/routes"

const OTHER_HANDLE = "__autre__"

/** Une année d'arrivée saisie : quatre chiffres, de la borne du domaine à l'année en cours. Vide : rien n'est envoyé. */
function isArrivalYear(value: string): boolean {
  if (value === "") return true
  if (!/^\d{4}$/.test(value)) return false
  const year = Number(value)
  return year >= ARRIVED_AT_MIN_YEAR && year <= utcYear(Date.now())
}

const choicesShape = {
  country: z.string().refine((value) => isResidenceCountry(value), "country_required"),
  city: z.string().trim().max(80, "city_too_long"),
  // EA-08 : proposée dès l'entrée, facultative ; visible de la seule personne par défaut (facette).
  arrivedAt: z.string().trim().refine(isArrivalYear, "arrived_at_out_of_range"),
  handleOther: z.string(),
  socialProfile: z.boolean().refine((value) => value, "consent_social_profile_required"),
  directory: z.boolean(),
  directoryLevel: z.enum(["country", "network"]),
  notifications: z.boolean(),
}
/** Un compte neuf : il choisit son nom affiché et son identifiant. */
const schema = z.object({
  ...choicesShape,
  displayName: z.string().trim().min(2, "display_name_invalid").max(60, "display_name_invalid"),
  handleChoice: z.string().min(1, "handle_required"),
})
/** Un profil commun déjà là (EA-04) : ni nom ni identifiant à saisir, rien à réécrire. */
const keptIdentitySchema = z.object({ ...choicesShape, displayName: z.string(), handleChoice: z.string() })
// Le pays est une chaîne en saisie et un `CountryCode` en sortie (garde de type du domaine).
type FormInput = z.input<typeof schema>
type Values = z.output<typeof schema>

const STEP_FIELDS: readonly (readonly FieldPath<FormInput>[])[] = [
  ["country", "city", "arrivedAt"],
  ["displayName", "handleChoice"],
  ["socialProfile", "directory", "notifications"],
]

type ProfilePublication = NonNullable<DiasporaleDataSource["profilePublication"]>

/**
 * L'identité commune déjà là (EA-04) : aucune (compte neuf), publiée (membre d'ANTSIA, retour
 * après un départ) ou retirée. Seul un compte neuf saisit un nom et un identifiant ; les autres
 * gardent les leurs, accroche comprise.
 */
type ExistingIdentity =
  | { readonly kind: "none" }
  | {
      readonly kind: "published" | "withdrawn"
      readonly personId: string
      readonly handle: string
      readonly displayName: string
      readonly headline: string | null
    }

const NO_IDENTITY: ExistingIdentity = { kind: "none" }

/** L'identifiant saisi, jugé pendant la saisie (EA-08) : rien à dire, en cours, libre, pris, ou refusé par le moteur. */
type HandleAvailability =
  | { readonly state: "idle" }
  | { readonly state: "checking"; readonly handle: string }
  | { readonly state: "available"; readonly handle: string }
  | { readonly state: "taken"; readonly handle: string }
  | { readonly state: "refused"; readonly handle: string; readonly code: ActionErrorCode }

const HANDLE_IDLE: HandleAvailability = { state: "idle" }
/** Le temps de finir un mot avant d'interroger le fournisseur : une question par pause, pas par touche. */
const HANDLE_CHECK_DELAY_MS = 400

/**
 * La disponibilité d'un identifiant pendant sa saisie. Un identifiant hors charte n'est pas
 * soumis (la règle le dit déjà sous le champ) ; une réponse arrivée après une nouvelle frappe est
 * ignorée. Le bouton « Continuer » refait la vérification : c'est elle qui fait foi.
 */
function useHandleAvailability(handle: string, actions: Pick<DiasporaleActions, "checkHandle">): HandleAvailability {
  const [availability, setAvailability] = useState<HandleAvailability>(HANDLE_IDLE)
  useEffect(() => {
    if (handle.length === 0 || handleRefusal(handle) !== null) {
      setAvailability(HANDLE_IDLE)
      return
    }
    let current = true
    setAvailability({ state: "checking", handle })
    const timer = window.setTimeout(() => {
      actions.checkHandle(handle).then(
        (result) => {
          if (!current) return
          if (!result.ok) setAvailability({ state: "refused", handle, code: result.code })
          else setAvailability({ state: result.value.available ? "available" : "taken", handle })
        },
        () => {
          if (current) setAvailability(HANDLE_IDLE)
        },
      )
    }, HANDLE_CHECK_DELAY_MS)
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [handle, actions])
  return availability
}

function existingIdentityOf(profile: OwnProfileView | null): ExistingIdentity {
  const handle = profile?.handle ?? ""
  const displayName = profile?.displayName ?? ""
  if (profile === null || !handle.trim() || !displayName.trim()) return NO_IDENTITY
  return { kind: profile.published ? "published" : "withdrawn", personId: profile.personId, handle, displayName, headline: profile.headline }
}

/** Ce que l'accueil reçoit de sa page : l'adhésion partie s'il y en a une, et la prise de main de la garde. */
interface OnboardingContext {
  readonly membership: MembershipView | null
  /** Pendant l'entrée qu'il écrit, l'accueil garde la main : il mène lui-même à la page demandée. */
  readonly onFinishing: (finishing: boolean) => void
}

/** `/bienvenue` — onboarding en trois écrans (EXF-DG-02, E12). */
export function WelcomeScreen() {
  const [finishing, setFinishing] = useState(false)
  return (
    <PublicShell hideEnter>
      <Gate require="account" holdMember={finishing}>
        {(session) => <WelcomeOnboarding membership={session.membership} onFinishing={setFinishing} />}
      </Gate>
    </PublicShell>
  )
}

/** Le profil commun se lit avant l'accueil ; un fournisseur sans cette capacité n'a que des comptes neufs. */
function WelcomeOnboarding(props: OnboardingContext) {
  const source = useDataSource()
  return source.profilePublication
    ? <OnboardingWithProfile publication={source.profilePublication} {...props} />
    : <Onboarding identity={NO_IDENTITY} {...props} />
}

function OnboardingWithProfile(props: OnboardingContext & { publication: ProfilePublication }) {
  const profile = props.publication.useMyProfile()
  if (profile.status === "loading") return <GateSkeleton />
  // Profil illisible : l'accueil d'un compte neuf ; le fournisseur relit le profil et ne réécrit rien.
  const identity = profile.status === "ready" ? existingIdentityOf(profile.data) : NO_IDENTITY
  return <Onboarding identity={identity} {...props} />
}

function Onboarding(props: OnboardingContext & { identity: ExistingIdentity; publication?: ProfilePublication }) {
  const { identity } = props
  const { t } = useDiasporaleT()
  const actions = useActions()
  const router = useRouter()
  const ids = useId()
  const openCountries = useOpenCountries()
  const [step, setStep] = useState(0)
  const [identityError, setIdentityError] = useState<ActionErrorCode | null>(null)
  const [republishing, setRepublishing] = useState(false)
  const consents = initialConsentChoices()
  // Retour après un départ : l'adhésion partie garde sa facette, pays et ville sont repris.
  const departed = props.membership?.status === "partie" ? props.membership : null
  // Le nom et l'identifiant ne se valident que pour un compte neuf (le profil peut naître en cours de route).
  const asksIdentity = identity.kind === "none"
  const asksIdentityRef = useRef(asksIdentity)
  useLayoutEffect(() => {
    asksIdentityRef.current = asksIdentity
  }, [asksIdentity])
  const resolver = useMemo<Resolver<FormInput, unknown, Values>>(() => {
    const chooseIdentity = zodResolver(schema)
    const keepIdentity = zodResolver(keptIdentitySchema)
    return (values, context, options) => (asksIdentityRef.current ? chooseIdentity : keepIdentity)(values, context, options)
  }, [])
  const form = useForm<FormInput, unknown, Values>({
    resolver,
    mode: "onTouched",
    defaultValues: {
      country: departed?.facet.countryOfResidence ?? "",
      city: departed?.facet.city ?? "",
      arrivedAt: departed && departed.facet.arrivedAt !== undefined ? String(departed.facet.arrivedAt) : "",
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
  const [displayName, handleChoice, directory, country, handleOther] = useWatch({
    control: form.control,
    name: ["displayName", "handleChoice", "directory", "country", "handleOther"],
  })
  const suggestions = useHandleSuggestions(displayName)
  // L'identifiant « autre » se juge pendant la saisie ; les propositions sont déjà libres.
  const handleAvailability = useHandleAvailability(asksIdentity && handleChoice === OTHER_HANDLE ? normalizeHandle(handleOther) : "", actions)
  const open = openCountries.status === "ready" ? openCountries.data.map((item) => item.country) : []

  const chosenHandle = (values: Pick<FormInput, "handleChoice" | "handleOther">) => normalizeHandle(values.handleChoice === OTHER_HANDLE ? values.handleOther : values.handleChoice)

  const republish = async () => {
    if (identity.kind !== "withdrawn" || !props.publication || republishing) return
    setRepublishing(true)
    setIdentityError(null)
    try {
      // Le geste explicite de la personne : le profil revient tel qu'il était, accroche comprise.
      const result = await props.publication.republish(identity.personId)
      if (result.ok) toast.success(t("settings.profilePublication.saved.republish"))
      else setIdentityError(result.code)
    } catch {
      setIdentityError("unknown")
    } finally {
      setRepublishing(false)
    }
  }

  const next = async () => {
    if (step === 1 && !asksIdentity) {
      // L'identité commune n'est ni redemandée ni réécrite ; retirée, elle se republie d'abord.
      if (identity.kind === "withdrawn") {
        setIdentityError("profile_republish_required")
        return
      }
      setStep(2)
      return
    }
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
    // L'accueil garde la main jusqu'à sa sortie : la garde ne renvoie pas ailleurs le membre qui naît.
    props.onFinishing(true)
    let result: Awaited<ReturnType<typeof actions.join>>
    try {
      result = await actions.join({
        // L'année d'arrivée ne part que si la personne l'a donnée.
        facet: { countryOfResidence: values.country, city: values.city, ...(values.arrivedAt ? { arrivedAt: Number(values.arrivedAt) } : {}) },
        // Un profil déjà là n'envoie rien : le fournisseur le garde tel quel (EA-04).
        ...(asksIdentity ? { handle: chosenHandle(values), displayName: values.displayName } : {}),
        consents: { social_profile: values.socialProfile, directory: values.directory, notifications: values.notifications },
        directoryVisibility: values.directory ? values.directoryLevel : "hidden",
      })
    } catch {
      result = { ok: false, code: "unknown" }
    }
    if (!result.ok) {
      props.onFinishing(false)
      toast.error(t(`errors.${result.code}`))
      return
    }
    toast.success(t("welcome.joined"))
    // Nouveau membre : l'accueil d'abord, puis la page demandée s'il peut la lire (UX-02, MO-03).
    router.push(welcomeExit(result.value, peekReturnPath()))
  })

  const errorOf = (name: keyof FormInput) => {
    const message = form.formState.errors[name]?.message
    return message ? t(`errors.${message}`) : undefined
  }

  const shownIdentityError = identity.kind === "withdrawn" ? identityError : null
  const title = step === 1 && identity.kind === "published"
    ? t("welcomeProfile.keptTitle")
    : step === 1 && identity.kind === "withdrawn" ? t("welcomeProfile.withdrawnTitle") : t(`welcome.step${step + 1}Title`)
  const lead = step === 1 && identity.kind === "published"
    ? t("welcomeProfile.keptLead")
    : step === 1 && identity.kind === "withdrawn" ? t("welcomeProfile.withdrawnLead") : t(`welcome.step${step + 1}Lead`)

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
      <h1 className="mt-6 font-display text-4xl font-bold leading-tight">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{lead}</p>

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
            <Field id={`${ids}-arrivee`} label={t("welcomeArrival.label")} hint={t("welcomeArrival.hint")} error={errorOf("arrivedAt")}>
              {(control) => (
                <Input
                  id={control.id}
                  aria-describedby={control.describedBy}
                  aria-invalid={control.invalid || undefined}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  className="max-w-32 font-mono"
                  {...form.register("arrivedAt")}
                />
              )}
            </Field>
            {isResidenceCountry(country) && !open.includes(country) ? (
              <p className="rounded-lg bg-pending px-3 py-2 text-[13px] text-pending-foreground">{t("welcome.countryNotOpen")}</p>
            ) : null}
            {departed ? <p className="rounded-lg bg-muted px-3 py-2 text-[13px] text-muted-foreground">{t("welcomeProfile.returningNote")}</p> : null}
          </>
        ) : null}

        {step === 1 && identity.kind !== "none" ? (
          <>
            <section aria-label={t("welcomeProfile.identityLabel")} className="rounded-xl bg-card p-4 shadow-card">
              <p className="break-words text-[15px] font-semibold">{identity.displayName}</p>
              <p className="break-words font-mono text-sm text-muted-foreground">@{identity.handle}</p>
              {identity.headline ? <p className="mt-2 break-words text-sm leading-snug">{identity.headline}</p> : null}
            </section>
            {identity.kind === "withdrawn" ? (
              <div className="flex flex-col items-start gap-3" aria-busy={republishing || undefined}>
                <p className="text-[13px] text-muted-foreground">{t("settings.profilePublication.republishLead")}</p>
                <Button variant="outline" disabled={republishing} onClick={() => void republish()}>
                  {t(republishing ? "settings.profilePublication.working" : "settings.profilePublication.republish")}
                </Button>
              </div>
            ) : null}
            {shownIdentityError ? (
              <p role="alert" className="text-[13px] font-medium text-destructive">
                {t(`errors.${shownIdentityError}`)}
              </p>
            ) : null}
          </>
        ) : null}

        {step === 1 && identity.kind === "none" ? (
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
              {handleChoice === OTHER_HANDLE ? <HandleAvailabilityStatus availability={handleAvailability} /> : null}
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
      <WelcomeSignOut />
    </div>
  )
}

/**
 * Les sorties d'un compte connecté sans adhésion (jamais entré, ou parti) : exercer
 * ses droits personnels sans adhérer (« Mes données », NP-02 et EA-05 : exporter,
 * demander l'effacement, lire ses décisions), et se déconnecter — ce n'est pas son
 * compte, ou il veut en changer. Les réglages de membre ne lui sont pas ouverts ;
 * sans ces gestes, il restait enfermé dans l'accueil.
 */
function WelcomeSignOut() {
  const { t } = useDiasporaleT()
  const { busy, failed, signOutEverywhere } = useSignOutEverywhere()
  return (
    <div aria-busy={busy} className="mt-10 flex flex-col items-center gap-2 text-center text-[13px] text-muted-foreground">
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span>{t("welcome.myDataLead")}</span>
        <NextLink
          href={routes.myData()}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:shadow-focus"
        >
          <ShieldCheckIcon aria-hidden className="size-3.5" />
          {t("welcome.myData")}
        </NextLink>
      </p>
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span>{t("welcome.notYourAccount")}</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void signOutEverywhere()}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:shadow-focus disabled:cursor-wait disabled:opacity-70"
        >
          <LogOutIcon aria-hidden className="size-3.5" />
          {t(busy ? "settings.signingOut" : "settings.signOutEverywhere")}
        </button>
      </p>
      {failed ? <p role="alert" className="text-destructive">{t("errors.unknown")}</p> : null}
    </div>
  )
}

/**
 * Ce que la saisie de l'identifiant apprend, dit poliment aux lecteurs d'écran : la zone reste
 * montée, seul son texte change (une zone vivante qui naît ne s'annonce pas partout).
 */
function HandleAvailabilityStatus(props: { availability: HandleAvailability }) {
  const { t } = useDiasporaleT()
  const { availability } = props
  return (
    <p
      role="status"
      className={cn(
        "min-h-5 text-[13px]",
        availability.state === "available" ? "font-medium text-success-ink" : availability.state === "checking" ? "text-muted-foreground" : "font-medium text-destructive",
      )}
    >
      {availability.state === "checking"
        ? t("welcomeHandle.checking")
        : availability.state === "available"
          ? t("welcomeHandle.available", { handle: availability.handle })
          : availability.state === "taken"
            ? t("welcomeHandle.taken", { handle: availability.handle })
            : availability.state === "refused"
              ? t(`errors.${availability.code}`)
              : null}
    </p>
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
