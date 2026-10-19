"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Button,
  Card,
  Checkbox,
  Field,
  FloatingNotice,
  Input,
  Label,
  RadioCard,
  RadioGroup,
  cn,
  normalizeCivilName,
  normalizeFamilyName,
  normalizeGivenNames,
} from "@diasporale/features"
import { useActions, useDataSource, useSession } from "@diasporale/features/data"
import { DEMO_IDN_IDENTITIES, isValidDestination } from "@diasporale/features/demo"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowLeftIcon, FlaskConicalIcon, MailIcon, PhoneIcon } from "lucide-react"
import NextLink from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useState, type FocusEvent } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { EntryCard, EntryDoor } from "@/components/entry-door"
import { routes } from "@/lib/routes"

/** Une personne déjà connectée n'a rien à faire sur l'entrée : elle va à son fil ou à l'onboarding. */
export function useLeaveEntryWhenSignedIn(enabled = true) {
  const session = useSession()
  const router = useRouter()
  useEffect(() => {
    if (!enabled || session.status !== "ready" || session.data.status !== "signed_in") return
    router.replace(session.data.membership && session.data.membership.status !== "partie" ? routes.feed() : routes.welcome())
  }, [enabled, session, router])
}

/** Le retour d'une étape vers la porte (`/entrer`), sous la carte de l'étape. */
function BackToDoor() {
  const { t } = useDiasporaleT()
  return (
    <NextLink
      href={routes.enter()}
      className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:shadow-focus"
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      {t("common.back")}
    </NextLink>
  )
}

// ═══════════════════════════════════════════════════════════════
// Simulation d'IDN (démonstration seulement)
// ═══════════════════════════════════════════════════════════════

const idnSchema = z.object({
  identity: z.string().min(1, "idn_identity_required"),
  firstName: z.string().transform(normalizeGivenNames),
  lastName: z.string().transform(normalizeFamilyName),
  loa: z.enum(["1", "2", "3"]),
  gabonese: z.boolean(),
  consent: z.boolean().refine((value) => value, "idn_consent_required"),
})
type IdnValues = z.infer<typeof idnSchema>

/**
 * `/entrer/idn` — en production, ce bouton part vers identite.ga (OIDC, PKCE)
 * et revient avec l'identité. En DÉMONSTRATION, cet écran SIMULE l'écran de
 * consentement d'identite.ga avec des identités fictives : il le dit en tête.
 */
export function IdnScreen() {
  const { t } = useDiasporaleT()
  const source = useDataSource()
  const actions = useActions()
  const router = useRouter()
  const ids = useId()
  useLeaveEntryWhenSignedIn()
  const form = useForm<IdnValues>({
    resolver: zodResolver(idnSchema),
    defaultValues: { identity: "", firstName: "", lastName: "", loa: "2", gabonese: true, consent: false },
  })
  const identity = useWatch({ control: form.control, name: "identity" })

  const onSubmit = form.handleSubmit(async (values) => {
    const preset = DEMO_IDN_IDENTITIES.find((item) => item.key === values.identity)
    const names = normalizeCivilName(preset ?? values)
    const input = preset
      ? { ...names, loa: preset.loa, gaboneseNationality: preset.gaboneseNationality }
      : { ...names, loa: Number(values.loa), gaboneseNationality: values.gabonese }
    const result = await actions.signInWithIdn(input)
    if (!result.ok) {
      toast.error(t(`errors.${result.code}`))
      return
    }
    router.push(routes.welcome())
  })

  if (source.kind !== "demo") return null
  const consentError = form.formState.errors.consent?.message
  return (
    <EntryDoor align="start">
      <EntryCard title={t("idn.title")} lead={t("idn.lead")}>
        <FloatingNotice role="note" tone="demo" icon={<FlaskConicalIcon />} heading={t("demo.bannerTitle")}>
          {t("idn.simulation")}
        </FloatingNotice>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("idn.identityLegend")}</legend>
            <Controller
              control={form.control}
              name="identity"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} aria-label={t("idn.identityLegend")}>
                  {DEMO_IDN_IDENTITIES.map((item) => (
                    <RadioCard key={item.key} value={item.key}>
                      <span className="block font-medium">
                        {item.firstName} {item.lastName}
                      </span>
                      <span className="block text-[13px] text-muted-foreground">{t(`idn.preset.${item.key}`)}</span>
                    </RadioCard>
                  ))}
                  <RadioCard value="custom">
                    <span className="block font-medium">{t("idn.customTitle")}</span>
                    <span className="block text-[13px] text-muted-foreground">{t("idn.customBody")}</span>
                  </RadioCard>
                </RadioGroup>
              )}
            />
            {form.formState.errors.identity ? (
              <p role="alert" className="text-[13px] font-medium text-destructive">
                {t(`errors.${form.formState.errors.identity.message}`)}
              </p>
            ) : null}
          </fieldset>

          {identity === "custom" ? (
            <Card className="flex flex-col gap-4 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id={`${ids}-prenom`} label={t("idn.firstName")}>
                  {(control) => (
                    <Input id={control.id} autoComplete="given-name" {...form.register("firstName", {
                      onBlur: (event: FocusEvent<HTMLInputElement>) => form.setValue("firstName", normalizeGivenNames(event.target.value), { shouldDirty: true, shouldValidate: true }),
                    })} />
                  )}
                </Field>
                <Field id={`${ids}-nom`} label={t("idn.lastName")}>
                  {(control) => (
                    <Input id={control.id} autoComplete="family-name" {...form.register("lastName", {
                      onBlur: (event: FocusEvent<HTMLInputElement>) => form.setValue("lastName", normalizeFamilyName(event.target.value), { shouldDirty: true, shouldValidate: true }),
                    })} />
                  )}
                </Field>
              </div>
              <Field id={`${ids}-loa`} label={t("idn.loa")} hint={t("idn.loaHint")}>
                {(control) => (
                  <select
                    id={control.id}
                    aria-describedby={control.describedBy}
                    className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus"
                    {...form.register("loa")}
                  >
                    <option value="1">{t("idn.loaLevel", { level: 1 })}</option>
                    <option value="2">{t("idn.loaLevel", { level: 2 })}</option>
                    <option value="3">{t("idn.loaLevel", { level: 3 })}</option>
                  </select>
                )}
              </Field>
              <div className="flex items-center gap-3">
                <Controller
                  control={form.control}
                  name="gabonese"
                  render={({ field }) => (
                    <Checkbox id={`${ids}-nationalite`} checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                  )}
                />
                <Label htmlFor={`${ids}-nationalite`}>{t("idn.gabonese")}</Label>
              </div>
            </Card>
          ) : null}

          <div className="rounded-xl bg-muted p-4">
            <p className="text-sm font-semibold">{t("idn.receivesTitle")}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{t("idn.receives")}</p>
            <p className="mt-2 text-sm font-semibold">{t("idn.neverTitle")}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{t("idn.never")}</p>
            <div className="mt-4 flex items-start gap-3">
              <Controller
                control={form.control}
                name="consent"
                render={({ field }) => (
                  <Checkbox
                    id={`${ids}-consentement`}
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    aria-invalid={consentError ? true : undefined}
                    aria-describedby={consentError ? `${ids}-consentement-erreur` : undefined}
                    className="mt-0.5"
                  />
                )}
              />
              <Label htmlFor={`${ids}-consentement`} className="leading-snug">
                {t("idn.consent")}
              </Label>
            </div>
            {consentError ? (
              <p id={`${ids}-consentement-erreur`} role="alert" className="mt-2 text-[13px] font-medium text-destructive">
                {t(`errors.${consentError}`)}
              </p>
            ) : null}
          </div>

          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t("common.pleaseWait") : t("idn.submit")}
          </Button>
        </form>
        <BackToDoor />
      </EntryCard>
    </EntryDoor>
  )
}

// ═══════════════════════════════════════════════════════════════
// Compte léger : code à usage unique (e-mail ou SMS)
// ═══════════════════════════════════════════════════════════════

const codeSchema = z.object({ code: z.string().regex(/^\s*\d{3}\s?\d{3}\s*$/, "code_format") })

/** `/entrer/code` — un code à usage unique, jamais de mot de passe ; en démonstration, le code s'affiche. */
export function CodeScreen() {
  const { t } = useDiasporaleT()
  useLeaveEntryWhenSignedIn()
  return (
    <EntryDoor>
      <EntryCard title={t("code.title")} lead={t("code.lead")}>
        <CodeForm />
        <BackToDoor />
      </EntryCard>
    </EntryDoor>
  )
}

/**
 * Même accès par code sur la porte et sur sa page dédiée : aucune seconde
 * authentification. L'écran qui le monte décide du départ d'une session déjà
 * ouverte (`useLeaveEntryWhenSignedIn`) : après une déconnexion incomplète, la
 * porte le suspend. Dans la porte (`compact`), le bouton dit « Se connecter »,
 * ou « Recevoir le code » quand la carte crée un compte.
 */
export function CodeForm(props: { compact?: boolean; signUp?: boolean } = {}) {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const source = useDataSource()
  const router = useRouter()
  const ids = useId()
  const [kind, setKind] = useState<"email" | "phone">("email")
  const [sent, setSent] = useState<{ demoCode: string | null } | null>(null)
  const destinationForm = useForm<{ destination: string }>({
    resolver: zodResolver(z.object({
      destination: z.string().refine((value) => isValidDestination({ kind, value }), kind === "email" ? "email_invalid" : "phone_invalid"),
    })),
    defaultValues: { destination: "" },
  })
  const destination = useWatch({ control: destinationForm.control, name: "destination" })
  const sending = destinationForm.formState.isSubmitting
  const destinationError = destinationForm.formState.errors.destination?.message
  const codeForm = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema), defaultValues: { code: "" } })

  const focusCode = codeForm.setFocus
  useEffect(() => {
    if (sent !== null) focusCode("code")
  }, [sent, focusCode])

  const send = destinationForm.handleSubmit(async ({ destination: value }) => {
    try {
      const result = await actions.requestCode({ kind, value })
      if (!result.ok) {
        destinationForm.setError("destination", { message: result.code }, { shouldFocus: true })
        return
      }
      setSent(result.value)
    } catch {
      destinationForm.setError("destination", { message: "network_unavailable" }, { shouldFocus: true })
    }
  })

  const verify = codeForm.handleSubmit(async ({ code }) => {
    try {
      const result = await actions.verifyCode(code)
      if (!result.ok) {
        codeForm.setError("code", { message: result.code }, { shouldFocus: true })
        return
      }
      router.push(routes.welcome())
    } catch {
      codeForm.setError("code", { message: "network_unavailable" }, { shouldFocus: true })
    }
  })

  const codeError = codeForm.formState.errors.code?.message
  return (
    <>
      {sent === null ? (
        <form
          noValidate
          onSubmit={send}
          aria-busy={sending || undefined}
          className={cn("flex flex-col", props.compact ? "gap-3" : "gap-5")}
        >
          {!props.compact && source.kind === "demo" ? <div role="group" aria-label={t("code.kindLabel")} className="inline-flex gap-1 self-start rounded-[var(--esp-r-chrome)] bg-[var(--esp-neutral-chip)] p-1">
            {(["email", "phone"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={kind === option}
                onClick={() => {
                  setKind(option)
                  destinationForm.clearErrors()
                }}
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-[var(--esp-r-chrome)] px-4 text-sm font-medium focus-visible:shadow-focus",
                  kind === option ? "bg-thumb text-foreground shadow-card" : "text-muted-foreground",
                )}
              >
                {option === "email" ? <MailIcon className="size-4" aria-hidden /> : <PhoneIcon className="size-4" aria-hidden />}
                {t(`code.kind.${option}`)}
              </button>
            ))}
          </div> : null}
          <Field
            id={`${ids}-destination`}
            label={t(kind === "email" ? "code.emailLabel" : "code.phoneLabel")}
            hint={props.compact ? undefined : t("code.destinationHint")}
            error={destinationError ? t(`errors.${destinationError}`) : undefined}
          >
            {(control) => (
              <Input
                id={control.id}
                aria-describedby={control.describedBy}
                aria-invalid={control.invalid || undefined}
                type={kind === "email" ? "email" : "tel"}
                inputMode={kind === "email" ? "email" : "tel"}
                autoComplete={kind === "email" ? "email" : "tel"}
                spellCheck={false}
                readOnly={sending}
                className={props.compact ? "h-12 text-base" : undefined}
                {...destinationForm.register("destination")}
              />
            )}
          </Field>
          <Button type="submit" size="lg" disabled={sending}>
            {sending ? t("common.pleaseWait") : t(props.compact && !props.signUp ? "landing.signIn" : "code.send")}
          </Button>
        </form>
      ) : (
        <form noValidate onSubmit={verify} aria-busy={codeForm.formState.isSubmitting || undefined} className="flex flex-col gap-5">
          <p role="status" className="break-words text-[15px]">{t("code.sentTo", { destination })}</p>
          {sent.demoCode ? (
            // Le code à recopier ne se ferme pas : la carte n'a pas de croix.
            <FloatingNotice role="note" tone="demo" icon={<FlaskConicalIcon />} heading={t("code.demoCode")}>
              <span className="font-mono text-base font-semibold tracking-[0.2em] text-popover-foreground">{sent.demoCode}</span>
            </FloatingNotice>
          ) : null}
          <Field id={`${ids}-code`} label={t("code.codeLabel")} error={codeError ? t(`errors.${codeError}`) : undefined}>
            {(control) => (
              <Input
                id={control.id}
                aria-describedby={control.describedBy}
                aria-invalid={control.invalid || undefined}
                inputMode="numeric"
                autoComplete="one-time-code"
                spellCheck={false}
                readOnly={codeForm.formState.isSubmitting}
                maxLength={7}
                className="font-mono text-lg tracking-[0.3em]"
                {...codeForm.register("code")}
              />
            )}
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="lg" disabled={codeForm.formState.isSubmitting}>
              {codeForm.formState.isSubmitting ? t("common.pleaseWait") : t("code.verify")}
            </Button>
            <Button variant="ghost" size="lg" disabled={codeForm.formState.isSubmitting} onClick={() => { codeForm.reset(); setSent(null) }}>
              {t("code.changeDestination")}
            </Button>
          </div>
        </form>
      )}
    </>
  )
}
