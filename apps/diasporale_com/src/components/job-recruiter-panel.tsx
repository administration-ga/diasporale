"use client"

/**
 * L'espace recruteur d'une page (DG-025) : ses offres d'emploi dans tous leurs
 * états, leur création et leur modification, leurs changements d'état, puis,
 * offre par offre, les candidatures reçues et les décisions de l'équipe.
 * PROPRIÉTAIRE : chantier « talents et emploi ». « Mon activité » le monte ; la
 * signature `JobRecruiterPanel({ pageId, pageHandle })` est figée.
 *
 * Réservé aux signataires VIVANTS de la page : le fournisseur juge à chaque
 * lecture et à chaque geste (refus indistinct sinon). Une candidature est
 * privée ; retirée, il n'en reste que l'état. Le motif de non-sélection est une
 * note de l'équipe, jamais montrée à la personne qui candidate. Aucune
 * coordonnée n'est échangée ici. L'équipe peut signaler une candidature reçue
 * (G9, chantier « confiance des surfaces ») ; elle lit ici l'état de modération
 * des offres de sa page, jamais celui des candidatures.
 */
import {
  JOB_APPLICATION_STATUSES,
  JOB_DECISION_REASON_MAX_LENGTH,
  JOB_OFFER_STATUSES,
  isJobApplicationStatus,
  isJobOfferStatus,
  jobApplicationConversation,
  type CountryCode,
  type JobApplicationAction,
  type JobApplicationStatus,
  type JobOfferStatus,
  type JobOfferStatusTarget,
} from "@diasporale/domain"
import { Button, Card, EmptyState, Field, Sheet, SheetContent, Textarea, formatDate } from "@diasporale/features"
import { useJobs, useSession, type ActionErrorCode, type ContentReportTarget, type JobOfferDetailView, type JobsCapability, type ReceivedJobApplicationView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { BriefcaseBusinessIcon, InboxIcon } from "lucide-react"
import NextLink from "next/link"
import { useId, useLayoutEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { routes } from "@/lib/routes"

import { ObjectConversationEntry } from "./contextual-conversations"
import { JobOfferForm } from "./job-offer-form"
import { formatJobPay, JobChip, JobModerationNote, jobPlace, jobSelectClass, JobsUnavailable, useJobGesture } from "./job-parts"
import { ReportContentAction, ReportedContent, useOptionalContentReports } from "./report-content-sheet"
import { ServicePager } from "./service-pager"
import { ConfirmSheet } from "./service-request-sheets"

type Editor = { readonly mode: "create" } | { readonly mode: "edit"; readonly jobId: string; readonly generation: number } | null

/** Les gestes d'état d'une offre, et l'état où chacun mène. */
type StatusAction = "publish" | "suspend" | "resume" | "close"

const ACTION_TARGET: Readonly<Record<StatusAction, JobOfferStatusTarget>> = { publish: "open", suspend: "suspended", resume: "open", close: "closed" }

/** Les gestes proposés selon l'état EFFECTIF (clore se confirme à part). */
const ACTIONS_BY_STATUS: Readonly<Record<JobOfferStatus, readonly Exclude<StatusAction, "close">[]>> = {
  draft: ["publish"],
  open: ["suspend"],
  suspended: ["resume"],
  closed: [],
}

/** Les décisions de l'équipe sur une candidature (ne pas retenir passe par sa feuille de motif). */
type Decision = Exclude<JobApplicationAction, "withdraw">

/** Le motif de non-sélection : facultatif, borné comme le domaine. */
const reasonSchema = z.object({ reason: z.string().trim().max(JOB_DECISION_REASON_MAX_LENGTH, "job_decision_reason_too_long") })

export function JobRecruiterPanel(props: { readonly pageId: string; readonly pageHandle: string }) {
  const { t } = useDiasporaleT()
  const jobs = useJobs()
  const session = useSession()
  if (jobs === null) return <JobsUnavailable />
  const member = session.status === "ready" && session.data.status === "signed_in" ? session.data.membership : null
  // La page de démonstration ou du moteur garde son identité : l'éditeur repart à zéro si elle change.
  return (
    <RecruiterBody
      key={`${props.pageId}:${member?.personId ?? "anonyme"}`}
      jobs={jobs}
      pageId={props.pageId}
      pageHandle={props.pageHandle}
      canPublish={member?.canPublish === true}
      fallbackCountry={member?.facet.countryOfResidence ?? null}
      title={t("jobs.recruiter.title")}
    />
  )
}

function RecruiterBody(props: {
  readonly jobs: JobsCapability
  readonly pageId: string
  readonly pageHandle: string
  readonly canPublish: boolean
  readonly fallbackCountry: CountryCode | null
  readonly title: string
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const { jobs } = props
  const [editor, setEditor] = useState<Editor>(null)
  const [status, setStatus] = useState<JobOfferStatus | null>(null)
  const heading = useRef<HTMLHeadingElement | null>(null)
  const wasEditing = useRef(false)
  // Le formulaire fermé (enregistré ou annulé), le focus revient au titre de la section, jamais au vide.
  useLayoutEffect(() => {
    if (editor === null && wasEditing.current) heading.current?.focus()
    wasEditing.current = editor !== null
  }, [editor])
  const fallbackCountry = props.fallbackCountry ?? "FR"
  return (
    <section aria-labelledby={`${id}-titre`} className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 ref={heading} id={`${id}-titre`} tabIndex={-1} className="min-w-0 break-words rounded-sm text-lg font-semibold focus-visible:shadow-focus">{props.title}</h2>
          <p className="text-sm text-muted-foreground">{t("jobs.recruiter.lead")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="link" size="sm">
            <NextLink href={routes.page(props.pageHandle)}>{t("jobs.recruiter.viewPage")}</NextLink>
          </Button>
          <Button className="h-auto min-h-11 whitespace-normal" disabled={!props.canPublish || editor?.mode === "create"} onClick={() => setEditor({ mode: "create" })}>
            {t("jobs.recruiter.newOffer")}
          </Button>
        </div>
      </div>
      {!props.canPublish ? <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("jobs.recruiter.cannotPublish")}</p> : null}
      <div className="flex min-w-0 flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <Field id={`${id}-filtre`} label={t("jobs.recruiter.filter")}>
            {(field) => (
              <select
                id={field.id}
                aria-describedby={field.describedBy}
                disabled={editor !== null}
                value={status ?? ""}
                onChange={(event) => setStatus(isJobOfferStatus(event.target.value) ? event.target.value : null)}
                className={jobSelectClass}
              >
                <option value="">{t("jobs.recruiter.allStatuses")}</option>
                {JOB_OFFER_STATUSES.map((value) => (
                  <option key={value} value={value}>{t(`jobs.status.${value}`)}</option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </div>
      {editor?.mode === "create" ? <JobOfferForm jobs={jobs} pageId={props.pageId} fallbackCountry={fallbackCountry} onClose={() => setEditor(null)} /> : null}
      <ServicePager
        key={status ?? "all"}
        read={(cursor) => jobs.usePageOffers({ pageId: props.pageId, cursor, ...(status !== null ? { status } : {}) })}
        keyOf={(offer) => offer.id}
        empty={<EmptyState icon={<BriefcaseBusinessIcon />} title={t(status === null ? "jobs.recruiter.emptyTitle" : "jobs.recruiter.emptyFilteredTitle")} description={t("jobs.recruiter.emptyBody")} />}
      >
        {(offers) => (
          <>
            {editor?.mode === "edit"
              ? (() => {
                  const latest = offers.find((offer) => offer.id === editor.jobId)
                  return latest ? (
                    <JobOfferForm
                      key={`${latest.id}:${editor.generation}`}
                      jobs={jobs}
                      pageId={props.pageId}
                      offer={latest}
                      fallbackCountry={fallbackCountry}
                      onClose={() => setEditor(null)}
                      onReload={() => setEditor({ ...editor, generation: editor.generation + 1 })}
                    />
                  ) : null
                })()
              : null}
            <ul className="flex min-w-0 flex-col gap-3" aria-label={t("jobs.recruiter.listLabel")}>
              {offers.map((offer) => (
                <RecruiterOfferRow key={offer.id} jobs={jobs} offer={offer} canPublish={props.canPublish} onEdit={() => setEditor({ mode: "edit", jobId: offer.id, generation: 0 })} />
              ))}
            </ul>
          </>
        )}
      </ServicePager>
    </section>
  )
}

function RecruiterOfferRow(props: { readonly jobs: JobsCapability; readonly offer: JobOfferDetailView; readonly canPublish: boolean; readonly onEdit: () => void }) {
  const { t, locale } = useDiasporaleT()
  const { offer } = props
  const gesture = useJobGesture()
  const [closing, setClosing] = useState(false)
  const [showApplications, setShowApplications] = useState(false)

  const run = async (action: StatusAction): Promise<ActionErrorCode | null> => {
    const outcome = await gesture.run(async () => {
      const result = await props.jobs.setOfferStatus({ jobId: offer.id, expectedVersion: offer.version, status: ACTION_TARGET[action] })
      return result.ok ? null : result.code
    })
    if (outcome === "busy" || !gesture.isActive()) return null
    if (outcome === null) toast.success(t(`jobs.recruiter.done.${action}`))
    else toast.error(t(`errors.${outcome}`))
    return outcome
  }

  const disabled = gesture.busy || !props.canPublish
  return (
    <li className="min-w-0">
      <Card className="flex min-w-0 flex-col gap-2 p-4">
        <p className="flex flex-wrap items-center gap-1.5">
          <JobChip>{t(`jobs.status.${offer.status}`)}</JobChip>
          <JobChip>{t(`job.contract.${offer.contract}`)}</JobChip>
          <span className="text-[13px] text-muted-foreground">{t("jobs.recruiter.updated", { date: formatDate(offer.updatedAt, locale) })}</span>
        </p>
        <p className="min-w-0 break-words font-semibold">
          <NextLink href={routes.jobOffer(offer.id)} className="rounded-sm hover:underline focus-visible:shadow-focus">{offer.title}</NextLink>
        </p>
        {/* G9 : l'état de modération de l'offre, servi à l'équipe vivante de la page seulement. */}
        <JobModerationNote subject="offer" state={offer.moderation} />
        <p className="text-sm">{jobPlace(offer, locale, t)} · {formatJobPay(offer.payRange, locale, t)}</p>
        {offer.closesAt !== null ? <p className="text-[13px] text-muted-foreground">{t("jobs.card.closesAt", { date: formatDate(offer.closesAt, locale) })}</p> : null}
        {offer.status !== "closed" ? (
          <div className="flex flex-wrap gap-2">
            {/* G9 : une offre retirée par la modération ne se modifie plus (refus du moteur) ; elle se suspend ou se clôt encore. */}
            {offer.moderation !== "removed" ? (
              <Button variant="outline" size="sm" disabled={disabled} onClick={props.onEdit}>{t("jobs.recruiter.edit")}</Button>
            ) : null}
            {ACTIONS_BY_STATUS[offer.status].map((action) => (
              <Button key={action} variant="outline" size="sm" disabled={disabled} aria-busy={gesture.busy} onClick={() => void run(action)}>
                {t(`jobs.recruiter.action.${action}`)}
              </Button>
            ))}
            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setClosing(true)}>{t("jobs.recruiter.action.close")}</Button>
          </div>
        ) : null}
        <div>
          <Button variant="link" size="sm" aria-expanded={showApplications} onClick={() => setShowApplications((value) => !value)}>
            {t(showApplications ? "jobs.recruiter.hideApplications" : "jobs.recruiter.showApplications")}
          </Button>
        </div>
        {showApplications ? <OfferApplications jobs={props.jobs} jobId={offer.id} /> : null}
      </Card>
      <ConfirmSheet
        open={closing}
        onOpenChange={setClosing}
        title={t("jobs.recruiter.confirmCloseTitle", { title: offer.title })}
        description={t("jobs.recruiter.confirmCloseBody")}
        confirmLabel={t("jobs.recruiter.confirmClose")}
        destructive
        onConfirm={async () => {
          const result = await props.jobs.setOfferStatus({ jobId: offer.id, expectedVersion: offer.version, status: "closed" })
          if (result.ok) toast.success(t("jobs.recruiter.done.close"))
          return result.ok ? null : result.code
        }}
      />
    </li>
  )
}

/** Les candidatures d'une offre, filtrées par état, de la plus récente à la plus ancienne. */
function OfferApplications(props: { readonly jobs: JobsCapability; readonly jobId: string }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const [status, setStatus] = useState<JobApplicationStatus | null>(null)
  return (
    <section aria-labelledby={`${id}-candidatures`} className="flex min-w-0 flex-col gap-3 border-t border-border pt-3">
      <h3 id={`${id}-candidatures`} className="font-semibold">{t("jobs.recruiter.applicationsTitle")}</h3>
      <p className="text-[13px] text-muted-foreground">{t("jobs.recruiter.applicationsLead")}</p>
      <div className="flex min-w-0 flex-col gap-1.5 sm:max-w-xs">
        <label htmlFor={`${id}-etat`} className="text-sm font-medium">{t("jobs.recruiter.applicationsFilter")}</label>
        <select id={`${id}-etat`} value={status ?? ""} onChange={(event) => setStatus(isJobApplicationStatus(event.target.value) ? event.target.value : null)} className={jobSelectClass}>
          <option value="">{t("jobs.recruiter.allApplications")}</option>
          {JOB_APPLICATION_STATUSES.map((value) => (
            <option key={value} value={value}>{t(`jobs.applicationStatus.${value}`)}</option>
          ))}
        </select>
      </div>
      <ServicePager
        key={status ?? "all"}
        read={(cursor) => props.jobs.useOfferApplications({ jobId: props.jobId, cursor, ...(status !== null ? { status } : {}) })}
        keyOf={(application) => application.id}
        empty={<EmptyState icon={<InboxIcon />} title={t("jobs.recruiter.noApplicationsTitle")} description={t("jobs.recruiter.noApplicationsBody")} />}
      >
        {(applications) => (
          <ul className="flex min-w-0 flex-col gap-2" aria-label={t("jobs.recruiter.applicationsLabel")}>
            {applications.map((application) => (
              <ReceivedApplicationRow key={application.id} jobs={props.jobs} application={application} />
            ))}
          </ul>
        )}
      </ServicePager>
    </section>
  )
}

function ReceivedApplicationRow(props: { readonly jobs: JobsCapability; readonly application: ReceivedJobApplicationView }) {
  const { t, locale } = useDiasporaleT()
  const { application } = props
  const gesture = useJobGesture()
  const [rejecting, setRejecting] = useState(false)
  // G9 : l'équipe signale une candidature reçue (jamais la personne qui candidate, qui n'a pas cette vue).
  const reports = useOptionalContentReports()

  const decide = async (decision: Exclude<Decision, "not_select">) => {
    const outcome = await gesture.run(async () => {
      const result = decision === "mark_seen" ? await props.jobs.markSeen(application.id) : await props.jobs.shortlist(application.id)
      return result.ok ? null : result.code
    })
    if (outcome === "busy" || !gesture.isActive()) return
    if (outcome === null) toast.success(t(`jobs.decisionDone.${decision}`))
    else toast.error(t(`errors.${outcome}`))
  }

  if (application.status === "withdrawn" || application.candidate === null) {
    return (
      <li className="min-w-0 rounded-lg bg-muted px-3 py-2 text-sm">
        <JobChip>{t("jobs.applicationStatus.withdrawn")}</JobChip>
        <p className="mt-1 text-muted-foreground">{t("jobs.recruiter.withdrawnNote")}</p>
      </li>
    )
  }
  const { candidate } = application
  const reportTarget: ContentReportTarget = { kind: "diasporaJobApplication", id: application.id }
  return (
    <li className="min-w-0">
      <ReportedContent target={reportTarget}>
        <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3">
          <p className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 break-words font-semibold">{candidate.displayName ?? t("jobs.recruiter.unnamed")}</span>
            <JobChip>{t(`jobs.applicationStatus.${application.status}`)}</JobChip>
            <span className="text-[13px] text-muted-foreground">{t("jobs.recruiter.receivedAt", { date: formatDate(application.createdAt, locale) })}</span>
          </p>
          {candidate.handle ? (
            <p className="text-[13px]">
              <NextLink href={routes.profile(candidate.handle)} className="font-medium text-primary underline-offset-4 hover:underline">{t("jobs.recruiter.viewProfile")}</NextLink>
            </p>
          ) : null}
          {application.message ? <p className="whitespace-pre-line break-words text-sm leading-relaxed">{application.message}</p> : null}
          {application.talentProfile ? (
            <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-muted px-3 py-2 text-[13px]">
              <p className="font-medium">{t("jobs.recruiter.talentProfile", { title: application.talentProfile.title })}</p>
              <p className="break-words">{application.talentProfile.skills.join(" · ")}</p>
              <p>{t(`jobs.availability.${application.talentProfile.availability}`)}</p>
              <p className="text-muted-foreground">{t("jobs.recruiter.declaredSkills")}</p>
            </div>
          ) : null}
          {application.notSelectedReason ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("jobs.recruiter.teamNote", { note: application.notSelectedReason })}</p>
          ) : null}
          {/* CC-6 : la conversation avec la personne présélectionnée, au nom de la page ; le serveur relit l'équipe vivante. */}
          <div>
            <ObjectConversationEntry
              object={{ kind: "diasporaJobApplication", id: application.id }}
              phase={jobApplicationConversation({ status: application.status }, { application: false, offer: false }).phase}
            />
          </div>
          {application.actions.length > 0 || reports !== null ? (
            <div className="flex flex-wrap gap-2">
              {application.actions.includes("mark_seen") ? (
                <Button variant="outline" size="sm" disabled={gesture.busy} onClick={() => void decide("mark_seen")}>{t("jobs.decision.mark_seen")}</Button>
              ) : null}
              {application.actions.includes("shortlist") ? (
                <Button variant="outline" size="sm" disabled={gesture.busy} onClick={() => void decide("shortlist")}>{t("jobs.decision.shortlist")}</Button>
              ) : null}
              {application.actions.includes("not_select") ? (
                <Button variant="ghost" size="sm" disabled={gesture.busy} onClick={() => setRejecting(true)}>{t("jobs.decision.not_select")}</Button>
              ) : null}
              <ReportContentAction target={reportTarget} />
            </div>
          ) : null}
        </div>
      </ReportedContent>
      <JobReasonSheet
        open={rejecting}
        onOpenChange={setRejecting}
        onConfirm={async (reason) => {
          const result = await props.jobs.markNotSelected({ applicationId: application.id, reason })
          if (result.ok) toast.success(t("jobs.decisionDone.not_select"))
          return result.ok ? null : result.code
        }}
      />
    </li>
  )
}

/** Ne pas retenir : un motif FACULTATIF, note de l'équipe, jamais montrée à la personne qui candidate. */
function JobReasonSheet(props: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onConfirm: (reason: string | null) => Promise<ActionErrorCode | null>
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const gesture = useJobGesture()
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const form = useForm<{ reason: string }>({ resolver: zodResolver(reasonSchema), defaultValues: { reason: "" } })
  const close = (open: boolean) => {
    if (gesture.busy) return
    if (!open) {
      setError(null)
      form.reset({ reason: "" })
    }
    props.onOpenChange(open)
  }
  const submit = form.handleSubmit(async (values) => {
    const reason = values.reason.trim()
    const outcome = await gesture.run(async () => await props.onConfirm(reason.length > 0 ? reason : null))
    if (outcome === "busy" || !gesture.isActive()) return
    if (outcome === null) {
      form.reset({ reason: "" })
      props.onOpenChange(false)
    } else setError(outcome)
  })
  const fieldError = form.formState.errors.reason?.message
  return (
    <Sheet open={props.open} onOpenChange={close}>
      {props.open ? (
        <SheetContent title={t("jobs.recruiter.rejectTitle")} description={t("jobs.recruiter.rejectBody")} closeLabel={t("common.close")}>
          <form noValidate className="flex flex-col gap-4" onSubmit={submit}>
            <Field id={`${id}-motif`} label={t("jobs.recruiter.reasonLabel")} hint={t("jobs.recruiter.reasonHint")} error={fieldError ? t(`errors.${fieldError}`) : undefined}>
              {(field) => (
                <Textarea id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} maxLength={JOB_DECISION_REASON_MAX_LENGTH} rows={3} disabled={gesture.busy} {...form.register("reason")} />
              )}
            </Field>
            {error ? <p role="alert" className="text-sm font-medium text-destructive">{t(`errors.${error}`)}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="destructive" disabled={gesture.busy} aria-busy={gesture.busy}>{t(gesture.busy ? "common.pleaseWait" : "jobs.recruiter.confirmReject")}</Button>
              <Button type="button" variant="ghost" disabled={gesture.busy} onClick={() => close(false)}>{t("common.cancel")}</Button>
            </div>
          </form>
        </SheetContent>
      ) : null}
    </Sheet>
  )
}
