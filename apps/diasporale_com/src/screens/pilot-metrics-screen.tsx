"use client"

/**
 * `/pilote` — la mesure du pilote (G11 · DG-027 du plan global), réservée aux
 * responsables du réseau (administrateurs et modérateurs ; le serveur rejuge
 * chaque lecture). Des comptes agrégés par jour et par pays, matérialisés par
 * le passage nocturne du moteur, sans contenu privé :
 *   · un compte sous le seuil se dit « moins de 5 », jamais le chiffre ;
 *   · chaque taux garde sa base, et n'est publié qu'avec une part et un écart
 *     au-dessus du seuil ; une part trop proche de sa base est masquée ;
 *   · le délai de première réponse se donne par classe d'heures.
 * La portée (tout le réseau ou un pays ouvert) et la période (7, 30 ou 90 jours)
 * se choisissent au clavier ; la mise en page tient en 320 px (tableaux à deux
 * colonnes, détails sous chaque indicateur).
 * PROPRIÉTAIRE : chantier « mesure du pilote ».
 */
import {
  DAY_MS,
  parsePilotScope,
  PILOT_DEFAULT_WINDOW_DAYS,
  PILOT_DISPLAY_THRESHOLD,
  PILOT_METRIC_GROUPS,
  PILOT_WINDOW_DAYS,
  type CountryCode,
  type PilotCount,
  type PilotHours,
  type PilotIndicator,
  type PilotMetricGroup,
  type PilotPart,
  type PilotWindowDays,
} from "@diasporale/domain"
import { Card, cn, countryName, EmptyState, Field, formatDate, formatNumber, RadioCard, RadioGroup, Skeleton } from "@diasporale/features"
import {
  ERROR_CODES,
  useOpenCountries,
  usePilotMetrics,
  type ErrorCode,
  type Loadable,
  type PilotMetricsCapability,
  type PilotMetricsView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ChartColumnIcon, CircleAlertIcon, ClockIcon, FlaskConicalIcon, LockIcon, ShieldCheckIcon } from "lucide-react"
import { useId, useState, type ReactNode } from "react"

import { AppShell } from "@/components/app-shell"
import { Gate } from "@/components/gate"

type Translate = ReturnType<typeof useDiasporaleT>["t"]
type MeasuredView = Extract<PilotMetricsView, { measured: true }>
type RatioIndicator = Extract<PilotIndicator, { kind: "ratio" }>

const SELECT_CLASS = "h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus"
/** Les bornes d'une période sont des jours UTC : elles se lisent en UTC, quel que soit le fuseau du lecteur. */
const UTC_DAY: Intl.DateTimeFormatOptions = { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }
const PASS_TIME: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }

/** Un code d'erreur traduisible ; tout autre code se dit « inconnu », jamais une phrase du serveur. */
function errorKey(code: string): string {
  return `errors.${ERROR_CODES.has(code as ErrorCode) ? code : "unknown"}`
}

export function PilotMetricsScreen() {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <AppShell membership={session.membership}>
            <div key={session.membership.personId} className="contents">
              <PilotMetricsPage />
            </div>
          </AppShell>
        ) : null
      }
    </Gate>
  )
}

function PilotMetricsPage() {
  const { t } = useDiasporaleT()
  const capability = usePilotMetrics()
  return (
    <>
      <header className="flex min-w-0 flex-col gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <ChartColumnIcon aria-hidden className="size-4 shrink-0" />
          {t("pilotMetrics.nav")}
        </p>
        <h1 className="font-display text-3xl font-bold">{t("pilotMetrics.title")}</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{t("pilotMetrics.lead")}</p>
        <p className="flex items-start gap-2 text-sm font-medium">
          <ShieldCheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">{t("pilotMetrics.privacyBadge")}</span>
        </p>
      </header>
      {capability === null ? <Notice icon={<CircleAlertIcon />} title={t("pilotMetrics.unavailableTitle")} body={t("pilotMetrics.unavailableBody")} /> : <PilotAccess capability={capability} />}
    </>
  )
}

function PilotAccess(props: { readonly capability: PilotMetricsCapability }) {
  const { t } = useDiasporaleT()
  const access = props.capability.useAccess()
  if (access.status === "loading") return <PilotSkeleton />
  if (access.status === "error") return <Notice tone="error" icon={<CircleAlertIcon />} title={t("pilotMetrics.errorTitle")} body={t(errorKey(access.code))} />
  if (!access.data.allowed) return <EmptyState icon={<LockIcon />} title={t("pilotMetrics.restrictedTitle")} description={t("pilotMetrics.restrictedBody")} />
  return <PilotDashboard capability={props.capability} />
}

function PilotDashboard(props: { readonly capability: PilotMetricsCapability }) {
  const [country, setCountry] = useState<CountryCode | null>(null)
  const [days, setDays] = useState<PilotWindowDays>(PILOT_DEFAULT_WINDOW_DAYS)
  const metrics = props.capability.useMetrics({ country, days })
  return (
    <>
      <PilotFilters country={country} days={days} onCountryChange={setCountry} onDaysChange={setDays} />
      <section aria-busy={metrics.status === "loading"} className="flex min-w-0 flex-col gap-4">
        <PilotResults metrics={metrics} />
      </section>
      <PilotNotes />
    </>
  )
}

function PilotFilters(props: {
  readonly country: CountryCode | null
  readonly days: PilotWindowDays
  readonly onCountryChange: (country: CountryCode | null) => void
  readonly onDaysChange: (days: PilotWindowDays) => void
}) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const openCountries = useOpenCountries()
  const open = openCountries.status === "ready" ? openCountries.data.map((hub) => hub.country) : []
  // Le pays choisi reste proposé, même si la liste des pays ouverts change entre-temps.
  const choices = props.country !== null && !open.includes(props.country) ? [props.country, ...open] : open
  const chooseCountry = (value: string) => {
    const scope = parsePilotScope(value === "" ? null : value)
    props.onCountryChange(scope.ok ? scope.value : null)
  }
  const chooseDays = (value: string) => {
    const chosen = PILOT_WINDOW_DAYS.find((candidate) => String(candidate) === value)
    if (chosen !== undefined) props.onDaysChange(chosen)
  }
  return (
    <Card className="flex min-w-0 flex-col gap-4 p-4">
      <h2 className="text-base font-semibold">{t("pilotMetrics.filters.title")}</h2>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field id={`${id}-pays`} label={t("pilotMetrics.filters.country")} hint={t("pilotMetrics.filters.countryHint")}>
          {(field) => (
            <select id={field.id} aria-describedby={field.describedBy} className={SELECT_CLASS} value={props.country ?? ""} onChange={(event) => chooseCountry(event.target.value)}>
              <option value="">{t("pilotMetrics.scope.network")}</option>
              {choices.map((code) => (
                <option key={code} value={code}>{countryName(code, locale)}</option>
              ))}
            </select>
          )}
        </Field>
        <div className="flex min-w-0 flex-col gap-1.5">
          <p id={`${id}-periode`} className="text-sm font-medium">{t("pilotMetrics.filters.period")}</p>
          <RadioGroup aria-labelledby={`${id}-periode`} value={String(props.days)} onValueChange={chooseDays} className="grid grid-cols-3 gap-2">
            {PILOT_WINDOW_DAYS.map((option) => (
              <RadioCard key={option} value={String(option)}>{t("pilotMetrics.filters.days", { count: option })}</RadioCard>
            ))}
          </RadioGroup>
        </div>
      </div>
    </Card>
  )
}

function PilotResults(props: { readonly metrics: Loadable<PilotMetricsView> }) {
  const { t } = useDiasporaleT()
  const { metrics } = props
  if (metrics.status === "loading") return <PilotSkeleton />
  if (metrics.status === "error") return <Notice tone="error" icon={<CircleAlertIcon />} title={t("pilotMetrics.errorTitle")} body={t(errorKey(metrics.code))} />
  const view = metrics.data
  return (
    <>
      {view.fictional ? <Notice icon={<FlaskConicalIcon />} title={t("pilotMetrics.fictionalTitle")} body={t("pilotMetrics.fictionalBody")} /> : null}
      {view.measured ? (
        <>
          <PilotSummary view={view} />
          {PILOT_METRIC_GROUPS.map((group) => (
            <PilotGroupTable key={group} group={group} indicators={view.indicators.filter((indicator) => indicator.group === group)} />
          ))}
        </>
      ) : (
        <EmptyState icon={<ClockIcon />} title={t("pilotMetrics.notMeasuredTitle")} description={t("pilotMetrics.notMeasuredBody")} />
      )}
    </>
  )
}

function PilotSummary(props: { readonly view: MeasuredView }) {
  const { t, locale } = useDiasporaleT()
  const { view } = props
  const scope = view.country === null ? t("pilotMetrics.scope.network") : countryName(view.country, locale)
  return (
    <Card className="flex min-w-0 flex-col gap-1 p-4 text-sm">
      <p className="font-semibold">{t("pilotMetrics.summary.scope", { scope })}</p>
      <p>{t("pilotMetrics.summary.window", { start: formatDate(view.windowStartAt, locale, UTC_DAY), end: formatDate(view.windowEndAt - DAY_MS, locale, UTC_DAY) })}</p>
      <p className="text-muted-foreground">{t("pilotMetrics.summary.computedAt", { date: formatDate(view.computedAt, locale, PASS_TIME) })}</p>
      {view.daysMeasured < view.days ? <p className="font-medium">{t("pilotMetrics.summary.partial", { count: view.daysMeasured, days: view.days })}</p> : null}
    </Card>
  )
}

function PilotGroupTable(props: { readonly group: PilotMetricGroup; readonly indicators: readonly PilotIndicator[] }) {
  const { t } = useDiasporaleT()
  return (
    <Card className="min-w-0 overflow-hidden">
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="px-4 pt-4 pb-2 text-left text-base font-semibold">{t(`pilotMetrics.group.${props.group}`)}</caption>
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="px-4 pb-2 font-medium">{t("pilotMetrics.table.indicator")}</th>
            <th scope="col" className="w-28 px-4 pb-2 text-right font-medium">{t("pilotMetrics.table.value")}</th>
          </tr>
        </thead>
        <tbody>
          {props.indicators.map((indicator) => (
            <IndicatorRows key={indicator.id} indicator={indicator} />
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function IndicatorRows(props: { readonly indicator: PilotIndicator }) {
  const { t, locale } = useDiasporaleT()
  const { indicator } = props
  if (indicator.kind === "duration") {
    const sample = indicator.sample.kind === "value"
      ? t("pilotMetrics.duration.sample", { value: formatNumber(indicator.sample.value, locale) })
      : t("pilotMetrics.duration.sampleBelow", { threshold: indicator.sample.threshold })
    return (
      <>
        <IndicatorRow label={t("pilotMetrics.duration.median")} hint={t("pilotMetrics.duration.hint")} detail={sample} value={hoursText(t, indicator.median)} />
        <IndicatorRow label={t("pilotMetrics.duration.p75")} hint={sample} detail={null} value={hoursText(t, indicator.p75)} />
      </>
    )
  }
  const label = t(`pilotMetrics.indicator.${indicator.id}.label`)
  const hint = t(`pilotMetrics.indicator.${indicator.id}.hint`)
  if (indicator.kind === "ratio") {
    const base = indicator.denominator.kind === "value"
      ? t(`pilotMetrics.base.${indicator.denominatorId}`, { value: formatNumber(indicator.denominator.value, locale) })
      : t(`pilotMetrics.baseBelow.${indicator.denominatorId}`, { threshold: indicator.denominator.threshold })
    return <IndicatorRow label={label} hint={hint} detail={t("pilotMetrics.ratioDetail", { base, rate: rateText(t, locale, indicator) })} value={partText(t, locale, indicator.value)} />
  }
  return <IndicatorRow label={label} hint={hint} detail={null} value={countText(t, locale, indicator.value)} />
}

function IndicatorRow(props: { readonly label: string; readonly hint: string; readonly detail: string | null; readonly value: string }) {
  return (
    <tr className="border-t border-border align-top">
      <th scope="row" className="px-4 py-3 text-left font-normal">
        <span className="block break-words text-[15px] font-medium">{props.label}</span>
        <span className="mt-0.5 block break-words text-sm text-muted-foreground">{props.hint}</span>
        {props.detail === null ? null : <span className="mt-0.5 block break-words text-sm text-muted-foreground">{props.detail}</span>}
      </th>
      <td className="px-4 py-3 text-right align-top text-[15px] font-semibold tabular-nums break-words">{props.value}</td>
    </tr>
  )
}

function countText(t: Translate, locale: string, count: PilotCount): string {
  return count.kind === "value" ? formatNumber(count.value, locale) : t("pilotMetrics.value.belowThreshold", { threshold: count.threshold })
}

function partText(t: Translate, locale: string, part: PilotPart): string {
  return part.kind === "complement_below_threshold" ? t("pilotMetrics.value.masked") : countText(t, locale, part)
}

function rateText(t: Translate, locale: string, indicator: RatioIndicator): string {
  if (indicator.rate.kind === "value") return t("pilotMetrics.rate.value", { rate: formatNumber(indicator.rate.percent, locale) })
  return indicator.value.kind === "complement_below_threshold" ? t("pilotMetrics.rate.complement") : t("pilotMetrics.rate.withheld")
}

function hoursText(t: Translate, hours: PilotHours): string {
  switch (hours.kind) {
    case "at_most":
      return t("pilotMetrics.hours.atMost", { hours: hours.hours })
    case "above":
      return t("pilotMetrics.hours.above", { hours: hours.hours })
    case "withheld":
      return t("pilotMetrics.hours.withheld")
  }
}

function Notice(props: { readonly icon: ReactNode; readonly title: string; readonly body: string; readonly tone?: "info" | "error" }) {
  const error = props.tone === "error"
  return (
    <Card role={error ? "alert" : undefined} className="flex min-w-0 gap-3 p-4">
      <span aria-hidden className={cn("mt-0.5 shrink-0 [&_svg]:size-5", error ? "text-destructive" : "text-muted-foreground")}>{props.icon}</span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold">{props.title}</p>
        <p className="text-sm text-muted-foreground">{props.body}</p>
      </div>
    </Card>
  )
}

function PilotSkeleton() {
  const { t } = useDiasporaleT()
  return (
    <div role="status" className="flex min-w-0 flex-col gap-4">
      <span className="sr-only">{t("pilotMetrics.loading")}</span>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}

function PilotNotes() {
  const { t } = useDiasporaleT()
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-4 text-sm">
      <h2 className="text-base font-semibold">{t("pilotMetrics.notes.title")}</h2>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
        <li>{t("pilotMetrics.notes.noContent")}</li>
        <li>{t("pilotMetrics.notes.noPeople")}</li>
        <li>{t("pilotMetrics.notes.threshold", { threshold: PILOT_DISPLAY_THRESHOLD })}</li>
        <li>{t("pilotMetrics.notes.cohorts")}</li>
        <li>{t("pilotMetrics.notes.notMeasured")}</li>
      </ul>
    </Card>
  )
}
