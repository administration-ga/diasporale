"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Card, Checkbox, Field, FloatingNotice, Input, Label, RadioCard, RadioGroup, cn } from "@diasporale/features"
import { useActions, useDataSource, useSession } from "@diasporale/features/data"
import { DEMO_IDN_IDENTITIES, isValidDestination } from "@diasporale/features/demo"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowRightIcon, FlaskConicalIcon, IdCardIcon, KeyRoundIcon, MailIcon, PhoneIcon, ShieldCheckIcon } from "lucide-react"
import NextLink from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useState, type ReactNode } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { PublicShell } from "@/components/site-chrome"
import { routes } from "@/lib/routes"

/** Une personne déjà connectée n'a rien à faire sur l'entrée : elle va à son fil ou à l'onboarding. */
function useLeaveEntryWhenSignedIn() {
  const session = useSession()
  const router = useRouter()
  useEffect(() => {
    if (session.status !== "ready" || session.data.status !== "signed_in") return
    router.replace(session.data.membership && session.data.membership.status !== "partie" ? routes.feed() : routes.welcome())
  }, [session, router])
}

function EntryFrame(props: { title: string; lead: string; children: ReactNode }) {
  return (
    <PublicShell hideEnter>
      <div className="mx-auto w-full max-w-[640px] px-4 pb-10 pt-6 md:pt-12">
        <h1 className="font-display text-4xl font-bold leading-tight">{props.title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{props.lead}</p>
        <div className="mt-8 flex flex-col gap-4">{props.children}</div>
      </div>
    </PublicShell>
  )
}

/** `/entrer` — deux portes, IDN en premier ; jamais de mot de passe (EXF-DG-01). */
export function EnterScreen() {
  const { t } = useDiasporaleT()
  useLeaveEntryWhenSignedIn()
  return (
    <EntryFrame title={t("entry.title")} lead={t("entry.lead")}>
      <DoorLink
        href={routes.enterIdn()}
        icon={<IdCardIcon aria-hidden />}
        title={t("entry.idnTitle")}
        body={t("entry.idnBody")}
        badge={t("entry.recommended")}
        emphasis
      />
      <DoorLink href={routes.enterCode()} icon={<KeyRoundIcon aria-hidden />} title={t("entry.codeTitle")} body={t("entry.codeBody")} />
      <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("entry.noPassword")}
      </p>
    </EntryFrame>
  )
}

function DoorLink(props: { href: string; icon: ReactNode; title: string; body: string; badge?: string; emphasis?: boolean }) {
  return (
    <NextLink
      href={props.href}
      className={cn(
        "group flex items-start gap-4 rounded-2xl bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover focus-visible:shadow-focus",
      )}
    >
      {/* La porte recommandée se distingue par sa pastille bleue et son badge, jamais par un contour. */}
      <span
        aria-hidden
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-xl [&_svg]:size-6",
          props.emphasis ? "bg-[var(--primary-50)] text-[var(--primary-700)]" : "bg-tag text-tag-code",
        )}
      >
        {props.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-display text-xl font-bold">{props.title}</span>
          {props.badge ? (
            <span className="rounded-[var(--radius-xs)] bg-[var(--primary-50)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--primary-700)]">
              {props.badge}
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-[15px] leading-relaxed text-muted-foreground">{props.body}</span>
      </span>
      <ArrowRightIcon className="mt-1 size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden />
    </NextLink>
  )
}

// ═══════════════════════════════════════════════════════════════
// Simulation d'IDN (démonstration seulement)
// ═══════════════════════════════════════════════════════════════

const idnSchema = z.object({
  identity: z.string().min(1, "idn_identity_required"),
  firstName: z.string().trim(),
  lastName: z.string().trim(),
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
    const input = preset
      ? { firstName: preset.firstName, lastName: preset.lastName, loa: preset.loa, gaboneseNationality: preset.gaboneseNationality }
      : { firstName: values.firstName, lastName: values.lastName, loa: Number(values.loa), gaboneseNationality: values.gabonese }
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
    <EntryFrame title={t("idn.title")} lead={t("idn.lead")}>
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
                {(control) => <Input id={control.id} autoComplete="given-name" {...form.register("firstName")} />}
              </Field>
              <Field id={`${ids}-nom`} label={t("idn.lastName")}>
                {(control) => <Input id={control.id} autoComplete="family-name" {...form.register("lastName")} />}
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
    </EntryFrame>
  )
}

// ═══════════════════════════════════════════════════════════════
// Compte léger : code à usage unique (e-mail ou SMS)
// ═══════════════════════════════════════════════════════════════

const codeSchema = z.object({ code: z.string().regex(/^\s*\d{3}\s?\d{3}\s*$/, "code_format") })

/** `/entrer/code` — un code à usage unique, jamais de mot de passe ; en démonstration, le code s'affiche. */
export function CodeScreen() {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const router = useRouter()
  const ids = useId()
  useLeaveEntryWhenSignedIn()
  const [kind, setKind] = useState<"email" | "phone">("email")
  const [destination, setDestination] = useState("")
  const [destinationError, setDestinationError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ demoCode: string | null } | null>(null)
  const [sending, setSending] = useState(false)
  const codeForm = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema), defaultValues: { code: "" } })

  const send = async () => {
    if (!isValidDestination({ kind, value: destination })) {
      setDestinationError(kind === "email" ? "email_invalid" : "phone_invalid")
      return
    }
    setDestinationError(null)
    setSending(true)
    const result = await actions.requestCode({ kind, value: destination })
    setSending(false)
    if (!result.ok) {
      setDestinationError(result.code)
      return
    }
    setSent(result.value)
  }

  const verify = codeForm.handleSubmit(async ({ code }) => {
    const result = await actions.verifyCode(code)
    if (!result.ok) {
      codeForm.setError("code", { message: result.code })
      return
    }
    router.push(routes.welcome())
  })

  const codeError = codeForm.formState.errors.code?.message
  return (
    <EntryFrame title={t("code.title")} lead={t("code.lead")}>
      {sent === null ? (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void send()
          }}
          className="flex flex-col gap-5"
        >
          <div role="group" aria-label={t("code.kindLabel")} className="inline-flex gap-1 self-start rounded-[var(--esp-r-chrome)] bg-[var(--esp-neutral-chip)] p-1">
            {(["email", "phone"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={kind === option}
                onClick={() => {
                  setKind(option)
                  setDestinationError(null)
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
          </div>
          <Field
            id={`${ids}-destination`}
            label={t(kind === "email" ? "code.emailLabel" : "code.phoneLabel")}
            hint={t("code.destinationHint")}
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
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
              />
            )}
          </Field>
          <Button type="submit" size="lg" disabled={sending}>
            {sending ? t("common.pleaseWait") : t("code.send")}
          </Button>
        </form>
      ) : (
        <form noValidate onSubmit={verify} className="flex flex-col gap-5">
          <p className="text-[15px]">{t("code.sentTo", { destination })}</p>
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
            <Button variant="ghost" size="lg" onClick={() => setSent(null)}>
              {t("code.changeDestination")}
            </Button>
          </div>
        </form>
      )}
    </EntryFrame>
  )
}
