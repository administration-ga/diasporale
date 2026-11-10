import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import type { DataSourceKind } from "@/lib/data-source"
import { currentFunctionalHealth, type EngineReach, type FunctionalHealthReport } from "@/lib/functional-health"

// Jamais figée à la construction : la santé décrit le service qui répond, comme la sonde.
export const dynamic = "force-dynamic"

const STATUS_KEYS: Readonly<Record<FunctionalHealthReport["status"], string>> = {
  ok: "health.status.ok",
  degraded: "health.status.degraded",
}
const DATA_SOURCE_KEYS: Readonly<Record<DataSourceKind, string>> = {
  engine: "health.dataSource.engine",
  demo: "health.dataSource.demo",
}
const ENGINE_KEYS: Readonly<Record<EngineReach, string>> = {
  reachable: "health.engine.reachable",
  unreachable: "health.engine.unreachable",
  not_checked: "health.engine.not_checked",
}
const BACKEND_KEYS: Readonly<Record<FunctionalHealthReport["backend"], string>> = {
  configured: "health.backend.configured",
  missing: "health.backend.missing",
}

/** La phrase d'état, selon la source servie et la réponse du moteur. */
function summaryKey(report: FunctionalHealthReport): string {
  if (report.dataSource === "demo") return "health.summary.demo"
  if (report.engine === "reachable") return "health.summary.engineReachable"
  if (report.engine === "unreachable") return "health.summary.engineUnreachable"
  return "health.summary.engineMissing"
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("health.title") }
}

/**
 * Page de santé fonctionnelle (LX-01) : le rapport de la sonde `/api/sante-fonctionnelle`,
 * lu par la même fonction, en français et en anglais. Ni adresse de déploiement, ni secret.
 */
export default async function HealthPage() {
  const [{ t }, report] = await Promise.all([getAppT(), currentFunctionalHealth()])
  return (
    <main id="contenu" className="mx-auto max-w-[640px] px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{t("health.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("health.lead")}</p>
      <p role="status" data-status={report.status} className="mt-6 font-semibold">
        {t(summaryKey(report))}
      </p>
      <dl className="mt-4 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 rounded-xl bg-card p-4 text-card-foreground shadow-sm [overflow-wrap:anywhere]">
        <dt className="text-muted-foreground">{t("health.label.status")}</dt>
        <dd data-status={report.status}>{t(STATUS_KEYS[report.status])}</dd>
        <dt className="text-muted-foreground">{t("health.label.dataSource")}</dt>
        <dd data-source={report.dataSource}>{t(DATA_SOURCE_KEYS[report.dataSource])}</dd>
        <dt className="text-muted-foreground">{t("health.label.engine")}</dt>
        <dd data-engine={report.engine}>{t(ENGINE_KEYS[report.engine])}</dd>
        <dt className="text-muted-foreground">{t("health.label.backend")}</dt>
        <dd data-backend={report.backend}>{t(BACKEND_KEYS[report.backend])}</dd>
        <dt className="text-muted-foreground">{t("health.label.version")}</dt>
        <dd>
          <span className="font-mono">{report.version}</span>
          {report.version === "dev" ? <span className="text-muted-foreground"> · {t("health.versionUndeclared")}</span> : null}
        </dd>
        <dt className="text-muted-foreground">{t("health.label.application")}</dt>
        <dd className="font-mono">{report.application}</dd>
      </dl>
    </main>
  )
}
