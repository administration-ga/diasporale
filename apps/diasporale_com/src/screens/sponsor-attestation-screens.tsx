"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { SPONSORSHIPS_PER_WINDOW } from "@diasporale/domain"
import { Button, Card, Checkbox, EmptyState, Field, FloatingNotice, Input, Label, Skeleton, formatDate, normalizeHandle } from "@diasporale/features"
import { useActions, useSponsorDashboard, type MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { BadgeCheckIcon, CircleCheckIcon, CircleDashedIcon, HandshakeIcon, InfoIcon, ShieldCheckIcon, XIcon } from "lucide-react"
import NextLink from "next/link"
import { useId, useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { AppShell } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { routes } from "@/lib/routes"

// ═══════════════════════════════════════════════════════════════
// Parrainer (EXF-DG-04, PD2 point 3)
// ═══════════════════════════════════════════════════════════════

const sponsorSchema = z.object({ handle: z.string().trim().min(1, "handle_required") })

/** `/parrainer` — parrainer par handle, journal des parrainages donnés, retrait, quotas affichés. */
export function SponsorScreen() {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <AppShell membership={session.membership}>
            <Sponsor />
          </AppShell>
        ) : null
      }
    </Gate>
  )
}

function Sponsor() {
  const { t, locale } = useDiasporaleT()
  const dashboard = useSponsorDashboard()
  const actions = useActions()
  const ids = useId()
  const form = useForm<z.infer<typeof sponsorSchema>>({ resolver: zodResolver(sponsorSchema), defaultValues: { handle: "" } })

  if (dashboard.status !== "ready") return <Skeleton className="h-64 w-full rounded-xl" />
  const view = dashboard.data
  const onSubmit = form.handleSubmit(async ({ handle }) => {
    const result = await actions.sponsor(normalizeHandle(handle))
    if (!result.ok) {
      form.setError("handle", { message: result.code })
      return
    }
    toast.success(t("sponsor.done", { handle: normalizeHandle(handle) }))
    form.reset({ handle: "" })
  })
  const error = form.formState.errors.handle?.message

  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold">{t("sponsor.title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t("sponsor.lead")}</p>
      </div>
      {!view.eligible ? (
        <Card className="flex gap-3 p-4">
          <InfoIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-[15px] leading-snug">
            {view.refusal === "sponsor_too_recent" && view.seniorityReachedAt
              ? t("sponsor.tooRecent", { date: formatDate(view.seniorityReachedAt, locale) })
              : t(`errors.${view.refusal ?? "sponsor_not_verified"}`)}
          </p>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4 p-5">
          <p className="font-mono text-sm">
            {t("sponsor.quota", { remaining: view.remaining, total: SPONSORSHIPS_PER_WINDOW, days: view.windowDays })}
          </p>
          <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Field id={`${ids}-handle`} label={t("sponsor.handleLabel")} hint={t("sponsor.handleHint")} error={error ? t(`errors.${error}`) : undefined} className="flex-1">
              {(control) => (
                <Input
                  id={control.id}
                  aria-describedby={control.describedBy}
                  aria-invalid={control.invalid || undefined}
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={t("sponsor.handlePlaceholder")}
                  className="font-mono"
                  {...form.register("handle")}
                />
              )}
            </Field>
            <Button type="submit" disabled={form.formState.isSubmitting || view.remaining === 0}>
              <HandshakeIcon aria-hidden />
              {form.formState.isSubmitting ? t("common.pleaseWait") : t("sponsor.submit")}
            </Button>
          </form>
        </Card>
      )}

      <section aria-labelledby="parrainages-donnes" className="flex flex-col gap-3">
        <h2 id="parrainages-donnes" className="font-display text-xl font-bold">
          {t("sponsor.given")}
        </h2>
        {view.given.length === 0 ? (
          <EmptyState icon={<HandshakeIcon />} title={t("sponsor.noneGiven")} description={t("sponsor.noneGivenBody")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {view.given.map((item) => (
              <li key={item.id}>
                <Card className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <NextLink href={routes.profile(item.sponsored.handle)} className="font-semibold hover:underline focus-visible:shadow-focus">
                      {item.sponsored.displayName}
                    </NextLink>
                    <p className="font-mono text-[12px] text-muted-foreground">
                      {item.revokedAt
                        ? t("sponsor.revokedOn", { date: formatDate(item.revokedAt, locale) })
                        : t("sponsor.givenOn", { date: formatDate(item.createdAt, locale) })}
                    </p>
                  </div>
                  {item.revokedAt === null ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const result = await actions.revokeSponsorship(item.id)
                        if (!result.ok) toast.error(t(`errors.${result.code}`))
                        else toast.success(t("sponsor.revoked"))
                      }}
                    >
                      <XIcon aria-hidden />
                      {t("sponsor.revoke")}
                    </Button>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Vérifier mon inscription consulaire (EXF-DG-03, PD3 point 5)
// ═══════════════════════════════════════════════════════════════

/**
 * `/verification` — écran de consentement explicite : ce qui est demandé, ce
 * qui est reçu, ce qui ne l'est JAMAIS ; case non cochée ; puis l'issue :
 * « vérifié depuis le … » ou « nous n'avons pas pu confirmer », sans jamais la
 * raison consulaire.
 */
export function AttestationScreen() {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <AppShell membership={session.membership}>
            <Attestation membership={session.membership} />
          </AppShell>
        ) : null
      }
    </Gate>
  )
}

function Attestation(props: { membership: MembershipView }) {
  const { t, locale } = useDiasporaleT()
  const actions = useActions()
  const id = useId()
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { attestation, status } = props.membership

  if (status === "verifiee" && attestation.outcome === "verified") {
    return (
      <Card className="flex gap-3 p-5">
        <BadgeCheckIcon className="mt-0.5 size-6 shrink-0 text-[var(--success)]" aria-hidden />
        <div>
          <h1 className="font-display text-2xl font-bold">{t("attestation.verifiedTitle")}</h1>
          <p className="mt-1 text-[15px]">
            {attestation.requestedAt ? t("attestation.verifiedSince", { date: formatDate(attestation.requestedAt, locale) }) : null}
          </p>
        </div>
      </Card>
    )
  }

  const request = async () => {
    setError(null)
    if (!consent) {
      setError("attestation_consent_required")
      return
    }
    setBusy(true)
    const result = await actions.requestAttestation()
    setBusy(false)
    if (!result.ok) {
      setError(result.code)
      return
    }
    if (result.value.outcome === "verified") toast.success(t("attestation.success"))
    else toast(t("attestation.notConfirmedTitle"))
  }

  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold">{t("attestation.title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t("attestation.lead")}</p>
      </div>
      {attestation.outcome === "not_confirmed" ? (
        <FloatingNotice
          role="status"
          tone="pending"
          icon={<CircleDashedIcon />}
          heading={t("attestation.notConfirmedTitle")}
          dismissLabel={t("notice.dismiss")}
        >
          {t("attestation.notConfirmedBody")}
        </FloatingNotice>
      ) : null}
      <Card className="flex flex-col gap-5 p-5">
        <ConsentList icon={<ShieldCheckIcon aria-hidden />} title={t("attestation.askedTitle")} body={t("attestation.asked")} />
        <ConsentList icon={<CircleCheckIcon aria-hidden />} title={t("attestation.receivedTitle")} body={t("attestation.received")} />
        <ConsentList icon={<XIcon aria-hidden />} title={t("attestation.neverTitle")} body={t("attestation.never")} />
        <div className="flex items-start gap-3 rounded-xl bg-muted p-4">
          <Checkbox
            id={id}
            checked={consent}
            onCheckedChange={(checked) => setConsent(checked === true)}
            aria-describedby={error ? `${id}-erreur` : undefined}
            aria-invalid={error === "attestation_consent_required" ? true : undefined}
            className="mt-0.5"
          />
          <Label htmlFor={id} className="leading-snug">
            {t("attestation.consent")}
          </Label>
        </div>
        {error ? (
          <p id={`${id}-erreur`} role="alert" className="text-[13px] font-medium text-destructive">
            {t(`errors.${error}`)}
          </p>
        ) : null}
        <Button size="lg" onClick={request} disabled={busy} className="self-start">
          {busy ? t("attestation.inProgress") : t("status.verifyConsular")}
        </Button>
        <p className="text-[13px] text-muted-foreground">{t("attestation.footer")}</p>
      </Card>
    </>
  )
}

function ConsentList(props: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-5">{props.icon}</span>
      <div>
        <p className="text-sm font-semibold">{props.title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{props.body}</p>
      </div>
    </div>
  )
}
