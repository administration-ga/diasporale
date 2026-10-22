"use client"

import { Button, formatDate } from "@diasporale/features"
import { personalReportDelayHours, type Loadable, type PersonalReportView, type PersonalReportsPage } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"

import { LoadingLine, type DecisionNavigation } from "./moderation-decisions"

/**
 * « Mes signalements » (SU01d du moteur, ordonnance n° 0011/PR/2026, art. 24) : les signalements
 * que la personne a transmis, dans tous les réseaux du compte commun — accusé de réception,
 * échéance légale et issue pour le contenu. Destination de l'accusé de réception et de l'avis
 * de décision de la cloche. Ni l'auteur, ni la sanction, ni le motif écrit par la modération,
 * ni de lien vers le contenu signalé.
 */
export function ReportResults(props: { query: Loadable<PersonalReportsPage>; navigation: DecisionNavigation }) {
  const { t } = useDiasporaleT()
  const { query, navigation } = props
  const nextCursor = query.status === "ready" && !query.data.isDone ? query.data.continueCursor : null
  const canNext = navigation.canNext(nextCursor)

  return (
    <>
      {query.status === "loading" ? (
        <LoadingLine />
      ) : query.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">{t("settings.dataRights.reports.loadError")}</p>
      ) : query.data.items.length === 0 ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
          {t(navigation.index > 0 ? "settings.dataRights.reports.emptyPage" : "settings.dataRights.reports.empty")}
        </p>
      ) : (
        <ul className="flex min-w-0 flex-col gap-3">
          {query.data.items.map((report) => (
            <ReportItem key={report.reportId} report={report} />
          ))}
        </ul>
      )}
      {navigation.canPrevious || canNext ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" disabled={!navigation.canPrevious} onClick={navigation.previous}>
            {t("settings.dataRights.reports.previous")}
          </Button>
          <span className="text-sm text-muted-foreground">{t("settings.dataRights.decisions.page", { number: navigation.index + 1 })}</span>
          <Button
            variant="outline"
            disabled={!canNext}
            onClick={() => {
              if (nextCursor === null) return
              navigation.next(nextCursor)
            }}
          >
            {t("settings.dataRights.reports.next")}
          </Button>
        </div>
      ) : null}
    </>
  )
}

/** Une échéance se lit à la minute : la date seule ne dirait pas si le délai court encore. */
const DATE_TIME: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }

function ReportItem({ report }: { report: PersonalReportView }) {
  const { t, locale } = useDiasporaleT()
  const at = (timestamp: number) => formatDate(timestamp, locale, DATE_TIME)
  const ground = report.ground === "pre_review"
    ? t("settings.dataRights.decisions.preReview")
    : report.ground === "unspecified" ? t("settings.dataRights.decisions.unspecified") : t(`report.reason.${report.ground}`)

  return (
    <li className="flex min-w-0 flex-col gap-1 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{t(`settings.dataRights.decisions.surface.${report.surface}`)}</p>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{t(`settings.dataRights.reports.outcome.${report.outcome}`)}</span>
      </div>
      <p className="text-sm">{t("settings.dataRights.decisions.ground", { ground })}</p>
      <p className="text-xs text-muted-foreground">{t("settings.dataRights.reports.reportedAt", { date: at(report.createdAt) })}</p>
      {report.acknowledgedAt !== null ? (
        <p className="text-xs text-muted-foreground">{t("settings.dataRights.reports.acknowledgedAt", { date: at(report.acknowledgedAt) })}</p>
      ) : null}
      {report.legal !== null ? (
        <p className="text-xs text-muted-foreground">
          {t("settings.dataRights.reports.due", {
            basis: t(`settings.dataRights.reports.basis.${report.legal.basis}`, { hours: personalReportDelayHours(report.legal.basis) }),
            date: at(report.legal.dueAt),
          })}
        </p>
      ) : null}
      {report.decidedAt !== null ? (
        <p className="text-xs text-muted-foreground">{t("settings.dataRights.reports.decidedAt", { date: at(report.decidedAt) })}</p>
      ) : null}
    </li>
  )
}
