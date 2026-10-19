"use client"

/**
 * Briques d'écran des demandes de service (DG-014/015), partagées par la feuille
 * de demande, « Mes demandes », la boîte d'une page et les fiches de demande.
 * PROPRIÉTAIRE : chantier « demandes et rendez-vous ».
 *
 * Les heures sont toujours affichées avec leur FUSEAU (celui dans lequel elles
 * ont été pensées), et, s'il diffère, avec l'heure du lecteur : un rendez-vous
 * à Paris lu depuis Montréal reste exact, changement d'heure compris.
 */
import { Button, Card, EmptyState, Skeleton } from "@diasporale/features"
import {
  isCurrencyCode,
  minorUnitsOf,
  type ServiceRequestStatus,
  type ServiceWindow,
} from "@diasporale/domain"
import type {
  ServiceProposalView,
  ServiceRequestEventView,
  ServiceRequestsCapability,
  ServiceRequestsPageQuery,
  ServiceRequestSummaryView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { InboxIcon } from "lucide-react"
import NextLink from "next/link"
import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from "react"

// ═══════════════════════════════════════════════════════════════
// Temps, fuseaux et montants
// ═══════════════════════════════════════════════════════════════

/** L'heure courante, relue à intervalle régulier : une échéance ou un début de rendez-vous se constate à l'écran. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

/** Le fuseau IANA du navigateur ; UTC s'il est inconnu. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

/** Les fuseaux connus du navigateur, le sien en tête (liste courte si le navigateur ne les énumère pas). */
export function timeZoneOptions(current: string): readonly string[] {
  let zones: readonly string[] = []
  try {
    zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []
  } catch {
    zones = []
  }
  return [...new Set([current, ...zones, "UTC"])]
}

/** Un montant en unités mineures, dans sa devise, sans arrondi caché. */
export function formatServiceMoney(amountMinor: number, currency: string, locale: string): string {
  const code = currency.trim().toUpperCase()
  const digits = isCurrencyCode(code) ? minorUnitsOf(code) : 2
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amountMinor / 10 ** digits)
  } catch {
    return `${(amountMinor / 10 ** digits).toFixed(digits)} ${code}`
  }
}

function safeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone })
    return timeZone
  } catch {
    return "UTC"
  }
}

/** Un instant lisible dans un fuseau donné. */
export function formatServiceInstant(at: number, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: safeZone(timeZone), weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(at)
}

/** Un créneau lisible dans un fuseau donné (« mardi 20 octobre 2026, 14:30 – 16:00 »). */
export function formatServiceSlot(slot: ServiceWindow, timeZone: string, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, { timeZone: safeZone(timeZone), weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
  // Un navigateur ancien sans `formatRange` lit les deux bornes en entier.
  return typeof formatter.formatRange === "function" ? formatter.formatRange(slot.startAt, slot.endAt) : `${formatter.format(slot.startAt)} – ${formatter.format(slot.endAt)}`
}

/** Un créneau, son fuseau et, si le lecteur vit ailleurs, son heure à lui. */
export function SlotText(props: { readonly slot: ServiceWindow; readonly timeZone: string; readonly viewerTimeZone: string }) {
  const { t, locale } = useDiasporaleT()
  const local = props.viewerTimeZone !== props.timeZone
  return (
    <span className="flex min-w-0 flex-col">
      <span className="break-words">{t("serviceRequests.time.inZone", { slot: formatServiceSlot(props.slot, props.timeZone, locale), zone: props.timeZone })}</span>
      {local ? (
        <span className="break-words text-[13px] text-muted-foreground">
          {t("serviceRequests.time.yours", { slot: formatServiceSlot(props.slot, props.viewerTimeZone, locale), zone: props.viewerTimeZone })}
        </span>
      ) : null}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════
// États, chronologie, proposition
// ═══════════════════════════════════════════════════════════════

export function ServiceStatusBadge(props: { readonly status: ServiceRequestStatus }) {
  const { t } = useDiasporaleT()
  return (
    <span data-status={props.status} className="inline-flex shrink-0 items-center rounded-full bg-muted px-2.5 py-0.5 text-[13px] font-medium text-foreground">
      {t(`serviceRequests.status.${props.status}`)}
    </span>
  )
}

export function ServiceTimeline(props: { readonly events: readonly ServiceRequestEventView[]; readonly viewerTimeZone: string }) {
  const { t, locale } = useDiasporaleT()
  return (
    <ol className="flex flex-col gap-2 border-l border-border pl-4">
      {props.events.map((event, index) => (
        <li key={`${event.status}-${event.at}-${index}`} className="flex min-w-0 flex-col">
          <span className="font-medium">
            {event.version === null ? t(`serviceRequests.timeline.${event.status}`) : t("serviceRequests.timeline.proposedVersion", { version: event.version })}
          </span>
          <span className="text-[13px] text-muted-foreground">{formatServiceInstant(event.at, props.viewerTimeZone, locale)}</span>
        </li>
      ))}
    </ol>
  )
}

/** Les conditions d'une proposition, toutes lisibles avant l'accord. */
export function ProposalDetails(props: { readonly proposal: ServiceProposalView; readonly viewerTimeZone: string }) {
  const { t, locale } = useDiasporaleT()
  const { proposal } = props
  return (
    <dl className="grid min-w-0 gap-2 sm:grid-cols-2">
      <Item label={t("serviceRequests.proposal.amount")}>{formatServiceMoney(proposal.amountMinor, proposal.currency, locale)}</Item>
      <Item label={t("serviceRequests.proposal.duration")}>{t("serviceRequests.proposal.minutes", { count: proposal.durationMinutes })}</Item>
      <Item label={t("serviceRequests.proposal.slot")} wide>
        <SlotText slot={proposal} timeZone={proposal.timeZone} viewerTimeZone={props.viewerTimeZone} />
      </Item>
      <Item label={t("serviceRequests.proposal.location")} wide>
        {proposal.location.mode === "remote" ? t("serviceRequests.proposal.remote") : t("serviceRequests.proposal.approximate", { area: proposal.location.area })}
      </Item>
      <Item label={t("serviceRequests.proposal.details")} wide>
        <span className="whitespace-pre-line">{proposal.details}</span>
      </Item>
      <Item label={t("serviceRequests.proposal.terms")} wide>
        <span className="whitespace-pre-line">{proposal.cancellationTerms}</span>
      </Item>
      <Item label={t("serviceRequests.proposal.deadline")} wide>{formatServiceInstant(proposal.expiresAt, props.viewerTimeZone, locale)}</Item>
    </dl>
  )
}

function Item(props: { readonly label: string; readonly wide?: boolean; readonly children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted px-3 py-2${props.wide ? " sm:col-span-2" : ""}`}>
      <dt className="text-[13px] text-muted-foreground">{props.label}</dt>
      <dd className="break-words font-medium">{props.children}</dd>
    </div>
  )
}

/** Ce qui vient ensuite pour une demande, en une ligne. */
export function NextStep(props: { readonly summary: ServiceRequestSummaryView; readonly viewerTimeZone: string }) {
  const { t, locale } = useDiasporaleT()
  const { summary } = props
  if (summary.booking && summary.status === "confirmed") {
    return <span>{t("serviceRequests.next.booking", { slot: formatServiceSlot(summary.booking, summary.booking.timeZone, locale), zone: summary.booking.timeZone })}</span>
  }
  if (summary.currentProposal && summary.status === "proposed") {
    return <span>{t("serviceRequests.next.proposal", { date: formatServiceInstant(summary.currentProposal.expiresAt, props.viewerTimeZone, locale) })}</span>
  }
  const first = summary.windows[0]
  if (first && summary.status === "sent") {
    return <span>{t("serviceRequests.next.window", { slot: formatServiceSlot(first, summary.timeZone, locale), zone: summary.timeZone })}</span>
  }
  return <span>{t("serviceRequests.next.updated", { date: formatServiceInstant(summary.updatedAt, props.viewerTimeZone, locale) })}</span>
}

// ═══════════════════════════════════════════════════════════════
// Listes paginées
// ═══════════════════════════════════════════════════════════════

export type ServiceRequestListSource =
  | { readonly kind: "mine" }
  | { readonly kind: "page"; readonly pageId: string; readonly status: ServiceRequestStatus | null }

type Report = (index: number, query: ServiceRequestsPageQuery) => void

function MinePage(props: { readonly capability: ServiceRequestsCapability; readonly index: number; readonly cursor: string | null; readonly report: Report }) {
  const query = props.capability.useMyRequests({ cursor: props.cursor })
  const { index, report } = props
  useLayoutEffect(() => report(index, query), [index, query, report])
  return null
}

function InboxPage(props: {
  readonly capability: ServiceRequestsCapability
  readonly pageId: string
  readonly status: ServiceRequestStatus | null
  readonly index: number
  readonly cursor: string | null
  readonly report: Report
}) {
  const query = props.capability.usePageRequests({ pageId: props.pageId, status: props.status, cursor: props.cursor })
  const { index, report } = props
  useLayoutEffect(() => report(index, query), [index, query, report])
  return null
}

/**
 * Une liste de demandes, page après page : chaque page reste abonnée (une
 * demande mise à jour se relit), les doublons d'une page à l'autre sont
 * écartés, un refus vide la liste plutôt que de montrer un ancien cache.
 */
export function ServiceRequestList(props: {
  readonly capability: ServiceRequestsCapability
  readonly source: ServiceRequestListSource
  readonly hrefOf: (requestId: string) => string
  readonly viewerTimeZone: string
  readonly emptyTitle: string
  readonly emptyBody: string
}) {
  const { t } = useDiasporaleT()
  const [cursors, setCursors] = useState<readonly (string | null)[]>([null])
  const [pages, setPages] = useState<Readonly<Record<number, ServiceRequestsPageQuery>>>({})
  const [generation, setGeneration] = useState(0)
  const report = useCallback<Report>((index, query) => {
    setPages((current) => (current[index] === query ? current : { ...current, [index]: query }))
  }, [])
  const queries = cursors.map((_, index) => pages[index])
  const failure = queries.find((query) => query?.status === "error")
  const items: ServiceRequestSummaryView[] = []
  const seen = new Set<string>()
  for (const query of queries) {
    if (query?.status !== "ready") continue
    for (const item of query.data.items) {
      if (seen.has(item.requestId)) continue
      seen.add(item.requestId)
      items.push(item)
    }
  }
  const last = queries[queries.length - 1]
  const loadingFirst = queries[0] === undefined || queries[0].status === "loading"
  const loadingMore = cursors.length > 1 && (last === undefined || last.status === "loading")
  const nextCursor = last?.status === "ready" && !last.data.isDone ? last.data.continueCursor : null
  const retry = () => {
    setPages({})
    setCursors([null])
    setGeneration((value) => value + 1)
  }
  const { capability, source } = props
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {cursors.map((cursor, index) =>
        source.kind === "mine" ? (
          <MinePage key={`${generation}:${index}`} capability={capability} index={index} cursor={cursor} report={report} />
        ) : (
          <InboxPage key={`${generation}:${index}`} capability={capability} pageId={source.pageId} status={source.status} index={index} cursor={cursor} report={report} />
        ),
      )}
      {failure?.status === "error" ? (
        <Card role="alert" className="flex flex-col items-start gap-3 p-4">
          <p>{t(`errors.${failure.code}`)}</p>
          <Button variant="outline" onClick={retry}>{t("serviceRequests.list.retry")}</Button>
        </Card>
      ) : loadingFirst ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState icon={<InboxIcon />} title={props.emptyTitle} description={props.emptyBody} />
      ) : (
        <ul className="flex flex-col gap-2" aria-busy={loadingMore}>
          {items.map((item) => (
            <li key={item.requestId}>
              <RequestRow summary={item} href={props.hrefOf(item.requestId)} viewerTimeZone={props.viewerTimeZone} />
            </li>
          ))}
        </ul>
      )}
      {failure === undefined && (nextCursor !== null || loadingMore) ? (
        <Button
          variant="outline"
          disabled={loadingMore}
          aria-busy={loadingMore}
          onClick={() => {
            if (nextCursor !== null) setCursors((current) => [...current, nextCursor])
          }}
        >
          {t(loadingMore ? "serviceRequests.list.loadingMore" : "serviceRequests.list.loadMore")}
        </Button>
      ) : null}
    </div>
  )
}

function RequestRow(props: { readonly summary: ServiceRequestSummaryView; readonly href: string; readonly viewerTimeZone: string }) {
  const { t } = useDiasporaleT()
  const { summary } = props
  const who = summary.requester
    ? (summary.requester.displayName ?? t("serviceRequests.requester.unknown"))
    : (summary.page?.name ?? t("serviceRequests.page.unavailable"))
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <p className="break-words font-semibold">{summary.offerTitle}</p>
          <p className="break-words text-[13px] text-muted-foreground">{who}</p>
        </div>
        <ServiceStatusBadge status={summary.status} />
      </div>
      <p className="break-words text-sm">
        <NextStep summary={summary} viewerTimeZone={props.viewerTimeZone} />
      </p>
      <div>
        <Button asChild variant="outline" size="sm">
          <NextLink href={props.href}>{t("serviceRequests.list.open")}</NextLink>
        </Button>
      </div>
    </Card>
  )
}
