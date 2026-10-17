"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  FACET_FIELDS,
  FIELD_VISIBILITY_LEVELS,
  isResidenceCountry,
  type ConsentPurpose,
  type DirectoryVisibility,
  type FacetField,
  type FieldVisibility,
} from "@diasporale/domain"
import {
  Button,
  Card,
  Checkbox,
  CountrySwitch,
  Field,
  Input,
  Label,
  RadioCard,
  RadioGroup,
  Sheet,
  SheetContent,
  Switch,
  TrustBadges,
  formatDate,
} from "@diasporale/features"
import { useActions, useMyConsents, useOpenCountries, type MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { CopyIcon, DownloadIcon, Trash2Icon } from "lucide-react"
import NextLink from "next/link"
import { useRouter } from "next/navigation"
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { AppShell } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { ProfileImagesSettings } from "@/components/profile-images-settings"
import { ProfilePublicationSettings } from "@/components/profile-publication-settings"
import { SignOutSettings } from "@/components/sign-out-settings"
import { LanguageSwitch, ThemeSwitch } from "@/components/preferences"
import { routes } from "@/lib/routes"

/** `/parametres` — profil, facette, confidentialité, consentements, « Mes données » (EXF-DG-44 à 46). */
export function SettingsScreen() {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <AppShell membership={session.membership}>
            <Settings key={session.membership.personId} membership={session.membership} />
          </AppShell>
        ) : null
      }
    </Gate>
  )
}

function Section(props: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={props.id} aria-labelledby={`${props.id}-titre`} className="scroll-mt-20">
      <Card className="flex flex-col gap-4 p-5">
        <div>
          <h2 id={`${props.id}-titre`} className="font-display text-xl font-bold">
            {props.title}
          </h2>
          {props.lead ? <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{props.lead}</p> : null}
        </div>
        {props.children}
      </Card>
    </section>
  )
}

function Settings(props: { membership: MembershipView }) {
  const { t } = useDiasporaleT()
  return (
    <>
      <h1 className="font-display text-3xl font-bold">{t("settings.title")}</h1>
      <MembershipSection membership={props.membership} />
      <ProfilePublicationSettings key={props.membership.personId} membership={props.membership} />
      <ProfileImagesSettings membership={props.membership} />
      <FacetSection membership={props.membership} />
      <DirectorySection membership={props.membership} />
      <ConsentsSection />
      <SponsorHelpSection membership={props.membership} />
      <DataSection membership={props.membership} />
      <Section id="apparence" title={t("settings.appearance")}>
        <div className="flex flex-col gap-3">
          <LanguageSwitch className="self-start" />
          <ThemeSwitch className="self-start" />
        </div>
      </Section>
      <SignOutSettings />
    </>
  )
}

function MembershipSection(props: { membership: MembershipView }) {
  const { t, locale } = useDiasporaleT()
  const { membership } = props
  return (
    <Section id="adhesions" title={t("settings.memberships")} lead={t("settings.membershipsLead")}>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-muted p-4">
          <dt className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{t("brand.name")}</dt>
          <dd className="mt-2 flex flex-col gap-2">
            <span className="font-semibold">{t(`membership.status.${membership.status}`)}</span>
            <TrustBadges badges={membership.badges} />
            <span className="text-[13px] text-muted-foreground">{t("settings.memberSince", { date: formatDate(membership.joinedAt, locale) })}</span>
            {membership.sponsoredBy ? (
              <span className="text-[13px] text-muted-foreground">
                {t("settings.sponsoredBy", { name: membership.sponsoredBy.displayName, handle: membership.sponsoredBy.handle })}
              </span>
            ) : null}
          </dd>
        </div>
        <div className="rounded-xl bg-muted p-4">
          <dt className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{t("settings.rootName")}</dt>
          <dd className="mt-2 flex flex-col gap-2">
            <span className="font-semibold">{t(`membership.status.${membership.root.status}`)}</span>
            <span className="text-[13px] leading-snug text-muted-foreground">{t("settings.rootDerived")}</span>
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">
          {membership.attestation.outcome === "verified"
            ? t("settings.attestationVerified")
            : membership.attestation.outcome === "not_confirmed"
              ? t("settings.attestationNotConfirmed")
              : t("settings.attestationNone")}
        </p>
        {membership.status !== "verifiee" ? (
          <Button asChild variant="outline" size="sm">
            <NextLink href={routes.attestation()}>{t("status.verifyConsular")}</NextLink>
          </Button>
        ) : null}
      </div>
    </Section>
  )
}

const facetSchema = z.object({
  country: z.string().refine((value) => isResidenceCountry(value), "country_required"),
  city: z.string().trim().max(80, "city_too_long"),
  arrivedAt: z.string().regex(/^(\d{4})?$/, "arrived_at_out_of_range"),
  visibility: z.record(z.enum(FIELD_VISIBILITY_LEVELS)),
})
type FacetInput = z.input<typeof facetSchema>
type FacetValues = z.output<typeof facetSchema>

const EDITABLE_VISIBILITY: readonly FacetField[] = ["countryOfResidence", "city", "postSlug", "arrivedAt"]

function FacetSection(props: { membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const ids = useId()
  const open = useOpenCountries()
  const { facet } = props.membership
  const form = useForm<FacetInput, unknown, FacetValues>({
    resolver: zodResolver(facetSchema),
    defaultValues: {
      country: facet.countryOfResidence,
      city: facet.city ?? "",
      arrivedAt: facet.arrivedAt ? String(facet.arrivedAt) : "",
      visibility: Object.fromEntries(FACET_FIELDS.map((field) => [field, facet.visibility[field]])),
    },
  })
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await actions.updateFacet({
      countryOfResidence: values.country,
      city: values.city,
      arrivedAt: values.arrivedAt ? Number(values.arrivedAt) : null,
      associationIds: facet.associationIds,
      helpAvailable: facet.helpAvailable,
      visibility: values.visibility as Partial<Record<FacetField, FieldVisibility>>,
    })
    if (!result.ok) {
      toast.error(t(`errors.${result.code}`))
      return
    }
    toast.success(t("settings.saved"))
  })
  const error = (name: "country" | "city" | "arrivedAt") => {
    const message = form.formState.errors[name]?.message
    return message ? t(`errors.${message}`) : undefined
  }
  return (
    <Section id="facette" title={t("settings.facet")} lead={t("settings.facetLead")}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${ids}-pays`} label={t("facet.country")} error={error("country")}>
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
                    onChange={field.onChange}
                    openCountries={open.status === "ready" ? open.data.map((item) => item.country) : []}
                    title={t("welcome.countrySheetTitle")}
                    description={t("welcome.countrySheetDescription")}
                  />
                )}
              />
            )}
          </Field>
          <Field id={`${ids}-ville`} label={t("facet.city")} error={error("city")}>
            {(control) => <Input id={control.id} aria-describedby={control.describedBy} autoComplete="address-level2" {...form.register("city")} />}
          </Field>
          <Field id={`${ids}-arrivee`} label={t("facet.arrivedAt")} hint={t("settings.arrivedAtHint")} error={error("arrivedAt")}>
            {(control) => (
              <Input id={control.id} aria-describedby={control.describedBy} inputMode="numeric" maxLength={4} {...form.register("arrivedAt")} />
            )}
          </Field>
        </div>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium">{t("settings.visibilityLegend")}</legend>
          {EDITABLE_VISIBILITY.filter((field) => field !== "postSlug" || facet.postSlug !== undefined).map((field) => (
            <div key={field} className="grid items-center gap-2 sm:grid-cols-[1fr_auto]">
              <Label htmlFor={`${ids}-vis-${field}`}>{t(`facet.field.${field}`)}</Label>
              <select
                id={`${ids}-vis-${field}`}
                className="h-11 rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus"
                {...form.register(`visibility.${field}`)}
              >
                {FIELD_VISIBILITY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {t(`facet.visibility.${level}`)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </fieldset>
        <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("common.pleaseWait") : t("common.save")}
        </Button>
      </form>
    </Section>
  )
}

function DirectorySection(props: { membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const consents = useMyConsents()
  const directoryConsent = consents.status === "ready" && consents.data.some((item) => item.purpose === "directory" && item.granted)
  return (
    <Section id="annuaire" title={t("settings.directory")} lead={t("settings.directoryLead")}>
      {!directoryConsent ? <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("settings.directoryNeedsConsent")}</p> : null}
      <RadioGroup
        value={props.membership.directoryVisibility}
        onValueChange={async (value) => {
          const result = await actions.setDirectoryVisibility(value as DirectoryVisibility)
          if (!result.ok) toast.error(t(`errors.${result.code}`))
          else toast.success(t("settings.saved"))
        }}
        aria-label={t("settings.directory")}
      >
        {(["hidden", "country", "network"] as const).map((level) => (
          <RadioCard key={level} value={level} disabled={level !== "hidden" && !directoryConsent}>
            <span className="block text-sm font-medium">{t(`settings.directoryLevel.${level}`)}</span>
          </RadioCard>
        ))}
      </RadioGroup>
    </Section>
  )
}

const CONSENT_ROWS: readonly { purpose: ConsentPurpose; locked?: boolean; disabled?: boolean }[] = [
  { purpose: "social_profile", locked: true },
  { purpose: "directory" },
  { purpose: "notifications" },
  { purpose: "consular_attestation" },
  { purpose: "talents", disabled: true },
]

function ConsentsSection() {
  const { t, locale } = useDiasporaleT()
  const actions = useActions()
  const consents = useMyConsents()
  const [leaveOpen, setLeaveOpen] = useState(false)
  const router = useRouter()
  const active = useRef(false)
  useLayoutEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  if (consents.status !== "ready") return null
  return (
    <Section id="consentements" title={t("settings.consents")} lead={t("settings.consentsLead")}>
      <ul className="flex flex-col divide-y divide-border">
        {CONSENT_ROWS.map((row) => {
          const view = consents.data.find((item) => item.purpose === row.purpose)
          const granted = view?.granted ?? false
          const switchId = `consentement-${row.purpose}`
          return (
            <li key={row.purpose} className="flex items-start gap-4 py-3">
              <div className="min-w-0 flex-1">
                <Label htmlFor={switchId} className="text-[15px] font-semibold">
                  {t(`consentPurpose.${row.purpose}.title`)}
                </Label>
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{t(`consentPurpose.${row.purpose}.body`)}</p>
                {view?.recordedAt ? (
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {t("settings.consentRecorded", { date: formatDate(view.recordedAt, locale), version: view.textVersion })}
                  </p>
                ) : null}
              </div>
              <Switch
                id={switchId}
                checked={granted}
                disabled={row.locked || row.disabled || (row.purpose === "consular_attestation" && !granted)}
                onCheckedChange={async (checked) => {
                  const result = await actions.setConsent(row.purpose, checked)
                  if (!active.current) return
                  if (!result.ok) toast.error(t(`errors.${result.code}`))
                  else toast.success(checked ? t("settings.consentGranted") : t("settings.consentRevoked"))
                }}
              />
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">{t("settings.leaveExplain")}</p>
        <Button variant="outline" onClick={() => setLeaveOpen(true)}>
          {t("settings.leave")}
        </Button>
      </div>
      <ConfirmSheet
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title={t("settings.leaveConfirmTitle")}
        body={t("settings.leaveConfirmBody")}
        confirm={t("settings.leave")}
        onConfirm={async () => {
          const result = await actions.leaveDiasporale()
          if (!active.current) return
          if (!result.ok) {
            toast.error(t(`errors.${result.code}`))
            return
          }
          toast.success(t("settings.left"))
          router.push(routes.welcome())
        }}
      />
    </Section>
  )
}

function SponsorHelpSection(props: { membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const pending = props.membership.status === "en_attente"
  return (
    <Section id="parrainage" title={t("settings.sponsorHelp")} lead={pending ? t("settings.sponsorHelpPending") : t("settings.sponsorHelpLead")}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-muted px-3 py-2 font-mono text-[15px]">@{props.membership.handle}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`@${props.membership.handle}`)
              toast.success(t("settings.handleCopied"))
            } catch {
              toast.error(t("errors.clipboard_unavailable"))
            }
          }}
        >
          <CopyIcon aria-hidden />
          {t("settings.copyHandle")}
        </Button>
      </div>
      {props.membership.status === "verifiee" ? (
        <Button asChild variant="ghost" size="sm" className="self-start">
          <NextLink href={routes.sponsor()}>{t("settings.goSponsor")}</NextLink>
        </Button>
      ) : null}
    </Section>
  )
}

function DataSection(props: { membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  return (
    <Section id="donnees" title={t("settings.data")} lead={t("settings.dataLead")}>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={async () => {
            const result = await actions.exportMyData()
            if (!result.ok) {
              toast.error(t(`errors.${result.code}`))
              return
            }
            const url = URL.createObjectURL(new Blob([result.value], { type: "application/json" }))
            const anchor = document.createElement("a")
            anchor.href = url
            anchor.download = `diasporale-${props.membership.handle}.json`
            anchor.click()
            URL.revokeObjectURL(url)
            toast.success(t("settings.exported"))
          }}
        >
          <DownloadIcon aria-hidden />
          {t("settings.export")}
        </Button>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2Icon aria-hidden />
          {t("settings.delete")}
        </Button>
      </div>
      <ConfirmSheet
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("settings.deleteConfirmTitle")}
        body={t("settings.deleteConfirmBody")}
        confirm={t("settings.delete")}
        destructive
        requireAcknowledge={t("settings.deleteAcknowledge")}
        onConfirm={async () => {
          const result = await actions.deleteMyAccount()
          if (!result.ok) {
            toast.error(t(`errors.${result.code}`))
            return
          }
          toast.success(t("settings.deleted"))
          router.push(routes.home())
        }}
      />
    </Section>
  )
}

function ConfirmSheet(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  body: string
  confirm: string
  destructive?: boolean
  requireAcknowledge?: string
  onConfirm: () => Promise<void>
}) {
  const { t } = useDiasporaleT()
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const id = useId()
  return (
    <Sheet
      open={props.open}
      onOpenChange={(open) => {
        setAcknowledged(false)
        props.onOpenChange(open)
      }}
    >
      <SheetContent title={props.title} description={props.body} closeLabel={t("common.close")}>
        {props.requireAcknowledge ? (
          <div className="flex items-start gap-3">
            <Checkbox id={id} checked={acknowledged} onCheckedChange={(checked) => setAcknowledged(checked === true)} className="mt-0.5" />
            <Label htmlFor={id} className="leading-snug">
              {props.requireAcknowledge}
            </Label>
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant={props.destructive ? "destructive" : "primary"}
            disabled={busy || (props.requireAcknowledge !== undefined && !acknowledged)}
            onClick={async () => {
              if (running.current) return
              running.current = true
              setBusy(true)
              try {
                await props.onConfirm()
                props.onOpenChange(false)
              } finally {
                running.current = false
                setBusy(false)
              }
            }}
          >
            {busy ? t("common.pleaseWait") : props.confirm}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
