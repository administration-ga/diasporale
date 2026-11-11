"use client"

/**
 * L'onglet « Pages à vérifier » du guichet de modération (AS-01) : les demandes
 * de vérification des pages d'association ou d'entreprise, pièces à l'appui,
 * filtrées par le pays de la PAGE, la plus ancienne d'abord. La modération du
 * réseau les tranche par une décision motivée ; validée, la demande fait du
 * demandeur un administrateur de la page, qui devient « Vérifié », jamais
 * « Officiel ».
 *
 * Le demandeur et toute personne qui a une ligne de signataire sur la page ne
 * tranchent jamais : l'écran n'offre pas le geste (conflit dit par la file, ou
 * `canDecide` quand le serveur le sert), le moteur refuse de façon indistincte.
 * « Mes revendications » restent dans « Mon activité ».
 * PROPRIÉTAIRE : chantier « modération par pays ».
 */
import { Button, Card, EmptyState, RadioCard, RadioGroup, Sheet, SheetContent, Skeleton, TrustBadge } from "@diasporale/features"
import {
  DESK_CLAIM_DECISIONS,
  deskZoneFromKey,
  type ActionErrorCode,
  type DeskClaimDecision,
  type DeskClaimDetailView,
  type DeskClaimParty,
  type DeskClaimView,
  type ModerationDeskCapability,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { ExternalLinkIcon, FileCheck2Icon, GavelIcon } from "lucide-react"
import NextLink from "next/link"
import { useId, useMemo, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { routes } from "@/lib/routes"

import { DESK_ERROR_VALUES, DeskCountry, DeskErrorLine, DeskReasonField, DeskZoneSelect, deskDateTime, deskReasonSchema, useMounted } from "./moderation-desk-parts"
import { usePersonLabel } from "./page-admin-parts"
import { ServicePager } from "./service-pager"

const decisionSchema = z.object({
  decision: z.enum(DESK_CLAIM_DECISIONS, { errorMap: () => ({ message: "moderation_desk_outcome_required" }) }),
  reason: deskReasonSchema,
})
type DecisionValues = z.infer<typeof decisionSchema>

const PARTY_LABELS: Readonly<Record<DeskClaimParty, string>> = {
  author: "moderationDesk.claims.party.author",
  page: "moderationDesk.claims.party.page",
}

const DECISION_LABELS: Readonly<Record<DeskClaimDecision, { readonly label: string; readonly hint: string; readonly done: string }>> = {
  approved: { label: "moderationDesk.claims.decision.approved", hint: "moderationDesk.claims.decision.approvedHint", done: "moderationDesk.claims.decided.approved" },
  rejected: { label: "moderationDesk.claims.decision.rejected", hint: "moderationDesk.claims.decision.rejectedHint", done: "moderationDesk.claims.decided.rejected" },
}

export function ModerationDeskClaims(props: { readonly desk: ModerationDeskCapability; readonly personId: string }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const [zoneKey, setZoneKey] = useState("all")
  const [opened, setOpened] = useState<DeskClaimView | null>(null)
  const zone = useMemo(() => deskZoneFromKey(zoneKey), [zoneKey])
  const { desk, personId } = props
  return (
    <section aria-labelledby={`${id}-titre`} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-titre`} className="font-display text-xl font-bold">{t("moderationDesk.claims.title")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("moderationDesk.claims.lead")}</p>
        <p className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.claims.countryNote")}</p>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <DeskZoneSelect id={`${id}-pays`} value={zoneKey} onChange={setZoneKey} />
      </div>
      <ServicePager<DeskClaimView>
        key={zoneKey}
        read={(cursor) => desk.useClaims({ personId, zone, cursor })}
        keyOf={(row) => row.claimId}
        empty={
          <EmptyState
            icon={<FileCheck2Icon />}
            title={t("moderationDesk.claims.emptyTitle")}
            description={t(zoneKey === "all" ? "moderationDesk.claims.emptyBody" : "moderationDesk.claims.emptyFilteredBody")}
          />
        }
      >
        {(rows) => (
          <ul className="flex min-w-0 flex-col gap-3">
            {rows.map((row) => <ClaimCard key={row.claimId} row={row} onOpen={() => setOpened(row)} />)}
          </ul>
        )}
      </ServicePager>
      <ClaimSheet desk={desk} personId={personId} row={opened} onClose={() => setOpened(null)} />
    </section>
  )
}

function ClaimCard(props: { readonly row: DeskClaimView; readonly onOpen: () => void }) {
  const { t, locale } = useDiasporaleT()
  const titleId = useId()
  const { row } = props
  return (
    <li>
      <Card className="flex min-w-0 flex-col gap-2 p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 id={titleId} className="min-w-0 break-words font-semibold">{row.page.name}</h3>
          <TrustBadge badge={row.page.badge} />
          <DeskCountry country={row.country} />
        </div>
        <p className="break-words text-xs text-muted-foreground">
          {t("moderationDesk.claims.receivedLine", { date: deskDateTime(row.createdAt, locale) })} · {t("moderationDesk.claims.evidenceCount", { count: row.evidenceCount })}
        </p>
        {row.party !== null ? <p className="break-words text-xs text-muted-foreground">{t(PARTY_LABELS[row.party])}</p> : null}
        <Button variant="outline" size="sm" className="self-start" aria-describedby={titleId} aria-haspopup="dialog" onClick={props.onOpen}>
          <GavelIcon aria-hidden />
          {t(row.party === null ? "moderationDesk.claims.open" : "moderationDesk.claims.view")}
        </Button>
      </Card>
    </li>
  )
}

function ClaimSheet(props: { readonly desk: ModerationDeskCapability; readonly personId: string; readonly row: DeskClaimView | null; readonly onClose: () => void }) {
  const { t } = useDiasporaleT()
  const busy = useRef(false)
  const { row } = props
  return (
    <Sheet open={row !== null} onOpenChange={(open) => { if (!open && !busy.current) props.onClose() }}>
      {row ? (
        <SheetContent title={t("moderationDesk.claims.sheetTitle", { page: row.page.name })} description={t("moderationDesk.claims.sheetDescription")} closeLabel={t("common.close")}>
          <ClaimBody key={row.claimId} desk={props.desk} personId={props.personId} row={row} onBusyChange={(value) => { busy.current = value }} onDecided={props.onClose} />
        </SheetContent>
      ) : null}
    </Sheet>
  )
}

function ClaimBody(props: {
  readonly desk: ModerationDeskCapability
  readonly personId: string
  readonly row: DeskClaimView
  readonly onBusyChange: (busy: boolean) => void
  readonly onDecided: () => void
}) {
  const { t, locale } = useDiasporaleT()
  const label = usePersonLabel()
  const { row } = props
  const detail = props.desk.useClaim({ personId: props.personId, claimId: row.claimId })
  const data = detail.status === "ready" ? detail.data : null
  // Le geste n'est offert ni à une partie (file), ni quand le serveur dit que la personne ne peut pas trancher.
  const refused = row.party !== null || data?.canDecide === false
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t("moderationDesk.claims.page")}</dt>
        <dd className="min-w-0 break-words">
          <NextLink href={routes.page(row.page.handle)} className="text-primary underline-offset-4 hover:underline">{row.page.name}</NextLink>
        </dd>
        <dt className="text-muted-foreground">{t("moderationDesk.case.fact.country")}</dt>
        <dd className="min-w-0"><DeskCountry country={row.country} /></dd>
        <dt className="text-muted-foreground">{t("moderationDesk.claims.received")}</dt>
        <dd className="min-w-0">{deskDateTime(row.createdAt, locale)}</dd>
        <dt className="text-muted-foreground">{t("moderationDesk.claims.claimant")}</dt>
        <dd className="min-w-0 break-words">
          {data ? <>{label(data.claimant)}{data.claimant.handle ? ` (@${data.claimant.handle})` : null}</> : <Skeleton className="h-5 w-32" />}
        </dd>
      </dl>
      <ClaimDetail detail={detail} />
      {refused ? (
        <div className="flex flex-col gap-1 rounded-xl bg-muted p-4 text-sm">
          <p className="font-semibold">{t("moderationDesk.claims.party.title")}</p>
          <p>{t(row.party !== null ? PARTY_LABELS[row.party] : "moderationDesk.claims.party.server")}</p>
          <p className="text-muted-foreground">{t("moderationDesk.claims.party.handOver")}</p>
        </div>
      ) : (
        <DecisionForm desk={props.desk} personId={props.personId} row={row} onBusyChange={props.onBusyChange} onDecided={props.onDecided} />
      )}
    </div>
  )
}

/** La note du demandeur et les pièces, servies par la garde des fichiers ; lues par la modération et le demandeur seuls. */
function ClaimDetail(props: { readonly detail: ReturnType<ModerationDeskCapability["useClaim"]> }) {
  const { t } = useDiasporaleT()
  const { detail } = props
  if (detail.status === "loading") {
    return (
      <div role="status">
        <span className="sr-only">{t("moderationDesk.claims.loading")}</span>
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    )
  }
  if (detail.status === "error") return <DeskErrorLine code={detail.code} />
  return <ClaimEvidence data={detail.data} />
}

function ClaimEvidence(props: { readonly data: DeskClaimDetailView }) {
  const { t } = useDiasporaleT()
  const { data } = props
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl bg-muted p-4 text-sm">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold">{t("moderationDesk.claims.note")}</h3>
        <p className="whitespace-pre-line break-words">{data.note ?? t("moderationDesk.claims.noNote")}</p>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold">{t("moderationDesk.claims.evidence")}</h3>
        <p className="text-[13px] leading-snug text-muted-foreground">{t("moderationDesk.claims.evidencePrivate")}</p>
        {data.evidence.length === 0 ? (
          <p className="text-muted-foreground">{t("moderationDesk.claims.noEvidence")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {data.evidence.map((item, index) => (
              <li key={index}>
                {item.withheld === null && item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline">
                    <ExternalLinkIcon aria-hidden className="size-4" />
                    {t("moderationDesk.claims.evidenceOpen", { index: index + 1 })}
                  </a>
                ) : (
                  <span className="text-muted-foreground">
                    {t(
                      item.withheld === "fileScanPending"
                        ? "moderationDesk.claims.evidencePending"
                        : item.withheld === "fileScanUnavailable"
                          ? "moderationDesk.claims.evidenceUnavailable"
                          : item.withheld === "fileQuarantined"
                            ? "moderationDesk.claims.evidenceBlocked"
                            : "moderationDesk.claims.evidenceKept",
                      { index: index + 1 },
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function DecisionForm(props: {
  readonly desk: ModerationDeskCapability
  readonly personId: string
  readonly row: DeskClaimView
  readonly onBusyChange: (busy: boolean) => void
  readonly onDecided: () => void
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const mounted = useMounted()
  const locked = useRef(false)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const form = useForm<DecisionValues>({ resolver: zodResolver(decisionSchema), defaultValues: { reason: "" } })
  const errors = form.formState.errors
  const busy = form.formState.isSubmitting

  const send = async (values: DecisionValues) => {
    if (locked.current) return
    locked.current = true
    props.onBusyChange(true)
    setError(null)
    try {
      const result = await props.desk.decideClaim({ personId: props.personId, claimId: props.row.claimId, decision: values.decision, reason: values.reason })
      if (!mounted.current) return
      if (!result.ok) {
        setError(result.code)
        return
      }
      toast.success(t(DECISION_LABELS[values.decision].done, { page: props.row.page.name }))
      props.onBusyChange(false)
      props.onDecided()
    } catch {
      if (mounted.current) setError("unknown")
    } finally {
      locked.current = false
      props.onBusyChange(false)
    }
  }

  return (
    <form noValidate onSubmit={(event) => void form.handleSubmit(send)(event)} className="flex min-w-0 flex-col gap-4 border-t border-border pt-4">
      <h3 className="font-semibold">{t("moderationDesk.claims.decisionTitle")}</h3>
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <p id={`${id}-issue`} className="text-sm font-medium">{t("moderationDesk.claims.decisionLegend")}</p>
          <Controller
            control={form.control}
            name="decision"
            render={({ field }) => (
              <RadioGroup
                aria-labelledby={`${id}-issue`}
                value={field.value ?? ""}
                onValueChange={(value) => field.onChange(DESK_CLAIM_DECISIONS.find((decision) => decision === value))}
              >
                {DESK_CLAIM_DECISIONS.map((decision) => (
                  <RadioCard key={decision} value={decision}>
                    <span className="block font-medium">{t(DECISION_LABELS[decision].label)}</span>
                    <span className="block text-[13px] text-muted-foreground">{t(DECISION_LABELS[decision].hint)}</span>
                  </RadioCard>
                ))}
              </RadioGroup>
            )}
          />
          {errors.decision?.message ? <p role="alert" className="text-[13px] font-medium text-destructive">{t(`errors.${errors.decision.message}`)}</p> : null}
        </div>
        <DeskReasonField
          id={`${id}-motif`}
          label={t("moderationDesk.decision.reason")}
          hint={t("moderationDesk.claims.reasonHint", DESK_ERROR_VALUES)}
          error={errors.reason?.message}
          disabled={busy}
          registration={form.register("reason")}
        />
      </fieldset>
      <DeskErrorLine code={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>{busy ? t("common.pleaseWait") : t("moderationDesk.claims.submit")}</Button>
      </div>
    </form>
  )
}
