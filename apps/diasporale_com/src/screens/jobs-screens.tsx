"use client"

/**
 * Talents et emploi de DIASPORALE (DG-025, plan global §G8 point 4) — quatre écrans :
 *
 *   · `/emploi` : chercher une offre OUVERTE du réseau (texte, pays, ville saisie
 *     sans GPS, contrat, mode de travail), résultats paginés, vide expliqué ;
 *   · `/emploi/<id>` : la fiche d'une offre — la page qui recrute et son badge,
 *     le contrat, le lieu, les langues, la rémunération ANNONCÉE, la date limite,
 *     puis « Candidater » ; une offre indisponible est un état neutre ; l'offre
 *     d'une autre page se signale (G9, chantier « confiance des surfaces ») ;
 *   · `/mes-candidatures` : mes candidatures PRIVÉES, leur état, le retrait ;
 *   · `/talents` : mon profil de talent (opt-in, révocable) et la recherche
 *     BORNÉE des talents visibles, sans coordonnée ni nom complet.
 *
 * Aucune coordonnée nulle part : on candidate sur DIASPORALE. Aucun champ
 * d'âge, de sexe, d'origine, de situation familiale ni de photo. Une
 * attestation consulaire dit qui est une personne, pas ce qu'elle sait faire.
 * L'état de modération (G9) ne se lit que dans les vues de gestion : la fiche
 * pour l'équipe de la page, « Mes candidatures » et mon profil de talent.
 */
import {
  JOB_CITY_MAX_LENGTH,
  JOB_OFFER_CONTRACTS,
  JOB_QUERY_MAX_LENGTH,
  JOB_WORK_MODES,
  isJobOfferContract,
  isJobWorkMode,
  jobApplicationConversation,
  parseResidenceCountry,
  type CountryCode,
  type JobOfferContract,
  type JobWorkMode,
} from "@diasporale/domain"
import { Button, Card, EmptyState, Field, Input, ModerationBanner, Skeleton, TrustBadge, formatDate, residenceCountryOptions } from "@diasporale/features"
import {
  moderationBannerState,
  useJobs,
  type ContentReportTarget,
  type JobOfferDetailView,
  type JobsCapability,
  type JobSearchRequest,
  type MembershipView,
  type MyJobApplicationView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { FileUserIcon, SearchXIcon, UserRoundSearchIcon } from "lucide-react"
import NextLink from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useId, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { AppShell } from "@/components/app-shell"
import { ObjectConversationEntry } from "@/components/contextual-conversations"
import { Gate } from "@/components/gate"
import { JobApplyEntry } from "@/components/job-apply-entry"
import { formatJobPay, JobChip, JobDetail, JobModerationNote, JobOfferCard, jobPlace, jobSelectClass, JobsUnavailable, TalentHitCard } from "@/components/job-parts"
import { MyTalentProfileSection } from "@/components/job-talent-profile"
import { ReportContentAction, ReportedContent } from "@/components/report-content-sheet"
import { languageList } from "@/components/service-format"
import { ServicePager } from "@/components/service-pager"
import { ConfirmSheet } from "@/components/service-request-sheets"
import { routes } from "@/lib/routes"

// ═══════════════════════════════════════════════════════════════
// Écrans
// ═══════════════════════════════════════════════════════════════

/** `/emploi` — les offres ouvertes du réseau. */
export function JobsScreen() {
  return (
    <Gate require="member">
      {(session) => (session.membership ? <AppShell membership={session.membership}><JobsSearch /></AppShell> : null)}
    </Gate>
  )
}

/** `/emploi/<id>` — la fiche d'une offre. */
export function JobOfferScreen(props: { readonly jobId: string }) {
  return (
    <Gate require="member">
      {(session) => (session.membership ? <AppShell membership={session.membership}><JobOfferDetail jobId={props.jobId} /></AppShell> : null)}
    </Gate>
  )
}

/** `/mes-candidatures` — mes candidatures, privées. */
export function MyApplicationsScreen() {
  return (
    <Gate require="member">
      {(session) => (session.membership ? <AppShell membership={session.membership}><MyApplications /></AppShell> : null)}
    </Gate>
  )
}

/** `/talents` — mon profil de talent et la recherche des talents visibles. */
export function TalentsScreen() {
  return (
    <Gate require="member">
      {(session) => (session.membership ? <AppShell membership={session.membership}><Talents membership={session.membership} /></AppShell> : null)}
    </Gate>
  )
}

// ═══════════════════════════════════════════════════════════════
// /emploi — chercher
// ═══════════════════════════════════════════════════════════════

/** Les filtres portés par l'adresse (pays et ville saisie) ; une valeur illisible est ignorée, jamais devinée. */
export function jobFiltersFromParams(params: Pick<URLSearchParams, "get">): { readonly country?: CountryCode; readonly city?: string } {
  const country = parseResidenceCountry(params.get("pays"))
  const city = params.get("ville")?.trim()
  return { ...(country.ok ? { country: country.value } : {}), ...(city ? { city } : {}) }
}

/** Les filtres gardés dans l'écran (la table des routes ne porte que le pays et la ville). */
interface LocalFilters {
  readonly query?: string
  readonly contract?: JobOfferContract
  readonly workMode?: JobWorkMode
}

const searchSchema = z.object({
  q: z.string().trim().max(JOB_QUERY_MAX_LENGTH, "job_query_too_long"),
  country: z.string(),
  city: z.string().trim().max(JOB_CITY_MAX_LENGTH, "job_city_too_long"),
  contract: z.string(),
  workMode: z.string(),
})

type SearchValues = z.infer<typeof searchSchema>

function JobsSearch() {
  const { t } = useDiasporaleT()
  const jobs = useJobs()
  const params = useSearchParams()
  const router = useRouter()
  const zone = useMemo(() => jobFiltersFromParams(params), [params])
  const [local, setLocal] = useState<LocalFilters>({})
  const key = JSON.stringify([zone, local])
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">{t("jobs.search.title")}</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{t("jobs.search.lead")}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <NextLink href={routes.myApplications()} className="font-medium text-primary underline-offset-4 hover:underline">{t("jobs.search.myApplications")}</NextLink>
          <NextLink href={routes.talents(zone.country)} className="font-medium text-primary underline-offset-4 hover:underline">{t("jobs.search.talents")}</NextLink>
        </p>
      </header>
      {jobs === null ? (
        <JobsUnavailable />
      ) : (
        <>
          <JobSearchForm
            key={key}
            zone={zone}
            local={local}
            onSearch={(nextZone, nextLocal) => {
              setLocal(nextLocal)
              router.replace(routes.jobs(nextZone.country, nextZone.city))
            }}
          />
          <JobResults key={key} jobs={jobs} request={{ ...zone, ...local }} />
        </>
      )}
    </>
  )
}

function JobSearchForm(props: {
  readonly zone: { readonly country?: CountryCode; readonly city?: string }
  readonly local: LocalFilters
  readonly onSearch: (zone: { readonly country?: CountryCode; readonly city?: string }, local: LocalFilters) => void
}) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const countries = useMemo(() => residenceCountryOptions(locale), [locale])
  const form = useForm<SearchValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      q: props.local.query ?? "",
      country: props.zone.country ?? "",
      city: props.zone.city ?? "",
      contract: props.local.contract ?? "",
      workMode: props.local.workMode ?? "",
    },
  })
  const error = (field: keyof SearchValues) => {
    const message = form.formState.errors[field]?.message
    return typeof message === "string" ? t(`errors.${message}`) : undefined
  }
  const submit = form.handleSubmit((values) => {
    const country = parseResidenceCountry(values.country)
    props.onSearch(
      { ...(country.ok ? { country: country.value } : {}), ...(values.city ? { city: values.city } : {}) },
      {
        ...(values.q ? { query: values.q } : {}),
        ...(isJobOfferContract(values.contract) ? { contract: values.contract } : {}),
        ...(isJobWorkMode(values.workMode) ? { workMode: values.workMode } : {}),
      },
    )
  })
  return (
    <Card className="p-4">
      <form noValidate role="search" aria-label={t("jobs.search.label")} className="flex min-w-0 flex-col gap-4" onSubmit={submit}>
        <Field id={`${id}-q`} label={t("jobs.search.query")} error={error("q")}>
          {(field) => <Input id={field.id} type="search" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} placeholder={t("jobs.search.queryPlaceholder")} maxLength={JOB_QUERY_MAX_LENGTH} {...form.register("q")} />}
        </Field>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id={`${id}-country`} label={t("jobs.search.country")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} className={jobSelectClass} {...form.register("country")}>
                <option value="">{t("jobs.search.anyCountry")}</option>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>{country.name}</option>
                ))}
              </select>
            )}
          </Field>
          <Field id={`${id}-city`} label={t("jobs.search.city")} hint={t("jobs.search.cityHint")} error={error("city")}>
            {(field) => <Input id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} autoComplete="address-level2" maxLength={JOB_CITY_MAX_LENGTH} {...form.register("city")} />}
          </Field>
          <Field id={`${id}-contract`} label={t("jobs.search.contract")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} className={jobSelectClass} {...form.register("contract")}>
                <option value="">{t("jobs.search.anyContract")}</option>
                {JOB_OFFER_CONTRACTS.map((contract) => (
                  <option key={contract} value={contract}>{t(`job.contract.${contract}`)}</option>
                ))}
              </select>
            )}
          </Field>
          <Field id={`${id}-workMode`} label={t("jobs.search.workMode")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} className={jobSelectClass} {...form.register("workMode")}>
                <option value="">{t("jobs.search.anyWorkMode")}</option>
                {JOB_WORK_MODES.map((mode) => (
                  <option key={mode} value={mode}>{t(`jobs.workMode.${mode}`)}</option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{t("jobs.search.submit")}</Button>
          <Button type="button" variant="ghost" onClick={() => props.onSearch({}, {})}>{t("jobs.search.reset")}</Button>
        </div>
      </form>
    </Card>
  )
}

function JobResults(props: { readonly jobs: JobsCapability; readonly request: Omit<JobSearchRequest, "cursor"> }) {
  const { t } = useDiasporaleT()
  const { jobs, request } = props
  const narrowed = Object.keys(request).length > 0
  return (
    <section aria-labelledby="resultats-emploi" className="flex min-w-0 flex-col gap-3">
      <h2 id="resultats-emploi" className="text-lg font-semibold">{t("jobs.results.title")}</h2>
      <ServicePager
        read={(cursor) => jobs.useSearch({ ...request, cursor })}
        keyOf={(offer) => offer.id}
        empty={
          <EmptyState
            icon={<SearchXIcon />}
            title={t("jobs.results.emptyTitle")}
            description={
              <>
                {t("jobs.results.emptyBody")}
                {narrowed ? <> {t("jobs.results.emptyFilters")}</> : null}
              </>
            }
          />
        }
      >
        {(offers) => (
          <ul aria-label={t("jobs.results.label")} className="grid min-w-0 gap-3 sm:grid-cols-2">
            {offers.map((offer) => (
              <li key={offer.id} className="min-w-0"><JobOfferCard offer={offer} /></li>
            ))}
          </ul>
        )}
      </ServicePager>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════
// /emploi/<id> — la fiche
// ═══════════════════════════════════════════════════════════════

function JobOfferDetail(props: { readonly jobId: string }) {
  const { t } = useDiasporaleT()
  const jobs = useJobs()
  const [attempt, setAttempt] = useState(0)
  return (
    <>
      <NextLink href={routes.jobs()} className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline">{t("jobs.offer.back")}</NextLink>
      {jobs === null ? <JobsUnavailable /> : <JobOfferBody key={attempt} jobs={jobs} jobId={props.jobId} onRetry={() => setAttempt((value) => value + 1)} />}
    </>
  )
}

function JobOfferBody(props: { readonly jobs: JobsCapability; readonly jobId: string; readonly onRetry: () => void }) {
  const { t } = useDiasporaleT()
  const loaded = props.jobs.useOffer(props.jobId)
  if (loaded.status === "loading") return <Skeleton className="h-64 w-full rounded-xl" />
  if (loaded.status === "error") {
    return (
      <Card role="alert" className="flex flex-col items-start gap-3 p-4">
        <p>{t(`errors.${loaded.code}`)}</p>
        <Button variant="outline" onClick={props.onRetry}>{t("jobs.offer.retry")}</Button>
      </Card>
    )
  }
  if (loaded.data === null) {
    return (
      <EmptyState
        icon={<SearchXIcon />}
        title={t("jobs.offer.unavailableTitle")}
        description={t("jobs.offer.unavailableBody")}
        action={<Button asChild variant="outline"><NextLink href={routes.jobs()}>{t("jobs.offer.back")}</NextLink></Button>}
      />
    )
  }
  return <JobOfferArticle offer={loaded.data} />
}

function JobOfferArticle(props: { readonly offer: JobOfferDetailView }) {
  const { t, locale } = useDiasporaleT()
  const { offer } = props
  // G9 : l'offre d'une autre page se signale ; signalée, la fiche est masquée pour la personne.
  const reportTarget: ContentReportTarget = { kind: "diasporaJobOffer", id: offer.id }
  // G9 : l'état de modération de l'offre, à l'équipe vivante de la page seulement (le fournisseur ne le sert à personne d'autre).
  const moderation = offer.viewerCanManage ? moderationBannerState(offer.moderation) : null
  const article = (
    <article className="flex min-w-0 flex-col gap-4" aria-labelledby="fiche-emploi">
      <header className="flex min-w-0 flex-col gap-2">
        <p className="flex flex-wrap items-center gap-1.5">
          <JobChip>{t(`job.contract.${offer.contract}`)}</JobChip>
          <JobChip>{t(`jobs.workMode.${offer.workMode}`)}</JobChip>
          {offer.viewerCanManage || offer.status !== "open" ? <JobChip>{t(`jobs.status.${offer.status}`)}</JobChip> : null}
        </p>
        <h1 id="fiche-emploi" className="break-words font-display text-3xl font-bold">{offer.title}</h1>
      </header>

      {moderation !== null ? <ModerationBanner state={moderation} /> : null}

      <Card className="flex min-w-0 flex-col gap-2 p-4">
        <p className="text-[13px] font-medium text-muted-foreground">{t("jobs.offer.employer")}</p>
        <p className="flex min-w-0 flex-wrap items-center gap-2">
          <NextLink href={routes.page(offer.employer.handle)} className="min-w-0 break-words font-semibold hover:underline">{offer.employer.name}</NextLink>
          <TrustBadge badge={offer.employer.badge} />
        </p>
        <p className="text-[13px] text-muted-foreground">{t("jobs.offer.badgeNote")}</p>
      </Card>

      <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
        <JobDetail label={t("jobs.offer.place")}>{jobPlace(offer, locale, t)}</JobDetail>
        <JobDetail label={t("jobs.offer.languages")}>{languageList(offer.languages, locale)}</JobDetail>
        <JobDetail label={t("jobs.offer.pay")}>{formatJobPay(offer.payRange, locale, t)}</JobDetail>
        <JobDetail label={t("jobs.offer.deadline")}>{offer.closesAt === null ? t("jobs.offer.noDeadline") : formatDate(offer.closesAt, locale)}</JobDetail>
        <JobDetail label={t("jobs.offer.published")}>{formatDate(offer.publishedAt, locale)}</JobDetail>
      </dl>

      <section aria-labelledby="description-emploi" className="flex min-w-0 flex-col gap-2">
        <h2 id="description-emploi" className="text-lg font-semibold">{t("jobs.offer.description")}</h2>
        <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{offer.description}</p>
      </section>

      <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("jobs.offer.noContact")}</p>

      {offer.viewerCanManage ? (
        <Card className="flex flex-col items-start gap-2 p-4">
          <p className="text-sm">{t("jobs.offer.manageNote")}</p>
          <Button asChild variant="outline" size="sm"><NextLink href={routes.pageManage(offer.employer.handle, "emplois")}>{t("jobs.offer.manage")}</NextLink></Button>
        </Card>
      ) : (
        <>
          <JobApplyEntry offer={offer} />
          <ReportContentAction target={reportTarget} className="self-start" />
        </>
      )}
    </article>
  )
  return <ReportedContent target={reportTarget}>{article}</ReportedContent>
}

// ═══════════════════════════════════════════════════════════════
// /mes-candidatures
// ═══════════════════════════════════════════════════════════════

function MyApplications() {
  const { t } = useDiasporaleT()
  const jobs = useJobs()
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">{t("jobs.mine.title")}</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{t("jobs.mine.lead")}</p>
      </header>
      {jobs === null ? (
        <JobsUnavailable />
      ) : (
        <ServicePager
          read={(cursor) => jobs.useMyApplications({ cursor })}
          keyOf={(application) => application.id}
          empty={
            <EmptyState
              icon={<FileUserIcon />}
              title={t("jobs.mine.emptyTitle")}
              description={t("jobs.mine.emptyBody")}
              action={<Button asChild variant="outline"><NextLink href={routes.jobs()}>{t("jobs.mine.browse")}</NextLink></Button>}
            />
          }
        >
          {(applications) => (
            <ul aria-label={t("jobs.mine.label")} className="flex min-w-0 flex-col gap-3">
              {applications.map((application) => (
                <MyApplicationRow key={application.id} jobs={jobs} application={application} />
              ))}
            </ul>
          )}
        </ServicePager>
      )}
    </>
  )
}

/** Ce que l'état dit à la personne qui candidate (jamais le motif de l'équipe). */
const STATUS_NOTES = {
  sent: "jobs.mine.note.sent",
  seen: "jobs.mine.note.seen",
  shortlisted: "jobs.mine.note.shortlisted",
  not_selected: "jobs.mine.note.not_selected",
  withdrawn: "jobs.mine.note.withdrawn",
} as const

function MyApplicationRow(props: { readonly jobs: JobsCapability; readonly application: MyJobApplicationView }) {
  const { t, locale } = useDiasporaleT()
  const { application } = props
  const [withdrawing, setWithdrawing] = useState(false)
  const pageName = application.employer?.name ?? t("jobs.mine.unknownPage")
  return (
    <li className="min-w-0">
      <Card className="flex min-w-0 flex-col gap-2 p-4">
        <p className="flex flex-wrap items-center gap-1.5">
          <JobChip>{t(`jobs.applicationStatus.${application.status}`)}</JobChip>
          <span className="text-[13px] text-muted-foreground">{t("jobs.mine.sentAt", { date: formatDate(application.createdAt, locale) })}</span>
        </p>
        <p className="min-w-0 break-words font-semibold">
          {application.offerOpen ? (
            <NextLink href={routes.jobOffer(application.jobId)} className="rounded-sm hover:underline focus-visible:shadow-focus">{application.offerTitle}</NextLink>
          ) : (
            application.offerTitle
          )}
        </p>
        <p className="min-w-0 break-words text-sm">{t("jobs.mine.employer", { page: pageName })}</p>
        <p className="text-[13px] text-muted-foreground">{t(STATUS_NOTES[application.status])}</p>
        {/* G9 : l'état de modération de MA candidature (l'équipe de la page ne le voit jamais). */}
        <JobModerationNote subject="application" state={application.moderation} />
        {!application.offerOpen ? <p className="text-[13px] text-muted-foreground">{t("jobs.mine.offerClosed")}</p> : null}
        {/* CC-6 : la conversation avec l'équipe, ouverte à la présélection ; le serveur relit l'offre et la modération. */}
        <div>
          <ObjectConversationEntry
            object={{ kind: "diasporaJobApplication", id: application.id }}
            phase={jobApplicationConversation({ status: application.status }, { application: application.moderation === "removed", offer: false }).phase}
          />
        </div>
        {application.sharedTalentProfile ? <p className="text-[13px]">{t("jobs.mine.profileShared")}</p> : null}
        <details className="text-sm">
          <summary className="cursor-pointer rounded-sm font-medium focus-visible:shadow-focus">{t("jobs.mine.message")}</summary>
          <p className="mt-2 whitespace-pre-line break-words leading-relaxed">{application.message}</p>
        </details>
        {application.actions.includes("withdraw") ? (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setWithdrawing(true)}>{t("jobs.mine.withdraw")}</Button>
          </div>
        ) : null}
      </Card>
      <ConfirmSheet
        open={withdrawing}
        onOpenChange={setWithdrawing}
        title={t("jobs.mine.confirmWithdrawTitle")}
        description={t("jobs.mine.confirmWithdrawBody", { page: pageName })}
        confirmLabel={t("jobs.mine.confirmWithdraw")}
        destructive
        onConfirm={async () => {
          const result = await props.jobs.withdraw(application.id)
          if (result.ok) toast.success(t("jobs.mine.withdrawn"))
          return result.ok ? null : result.code
        }}
      />
    </li>
  )
}

// ═══════════════════════════════════════════════════════════════
// /talents
// ═══════════════════════════════════════════════════════════════

function Talents(props: { readonly membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const jobs = useJobs()
  const params = useSearchParams()
  const fromAddress = parseResidenceCountry(params.get("pays"))
  const home = props.membership.facet.countryOfResidence
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">{t("jobs.talents.title")}</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{t("jobs.talents.lead")}</p>
        <p className="text-sm">
          <NextLink href={routes.jobs()} className="font-medium text-primary underline-offset-4 hover:underline">{t("jobs.talents.jobs")}</NextLink>
        </p>
      </header>
      {jobs === null ? (
        <JobsUnavailable />
      ) : (
        <>
          <MyTalentProfileSection jobs={jobs} fallbackCountry={home} />
          <TalentSearch key={fromAddress.ok ? fromAddress.value : home} jobs={jobs} initialCountry={fromAddress.ok ? fromAddress.value : home} />
        </>
      )}
    </>
  )
}

const talentSearchSchema = z.object({
  country: z.string().min(1, "job_country_required"),
  skill: z.string().trim().max(JOB_QUERY_MAX_LENGTH, "job_query_too_long"),
})

type TalentSearchValues = z.infer<typeof talentSearchSchema>

function TalentSearch(props: { readonly jobs: JobsCapability; readonly initialCountry: CountryCode }) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const router = useRouter()
  const countries = useMemo(() => residenceCountryOptions(locale), [locale])
  const [filters, setFilters] = useState<{ readonly country: CountryCode; readonly skill: string }>({ country: props.initialCountry, skill: "" })
  const form = useForm<TalentSearchValues>({ resolver: zodResolver(talentSearchSchema), defaultValues: { country: props.initialCountry, skill: "" } })
  const error = (field: keyof TalentSearchValues) => {
    const message = form.formState.errors[field]?.message
    return typeof message === "string" ? t(`errors.${message}`) : undefined
  }
  const submit = form.handleSubmit((values) => {
    const country = parseResidenceCountry(values.country)
    if (!country.ok) return form.setError("country", { message: "job_country_required" })
    setFilters({ country: country.value, skill: values.skill })
    router.replace(routes.talents(country.value))
  })
  const { jobs } = props
  return (
    <section aria-labelledby={`${id}-titre`} className="flex min-w-0 flex-col gap-3">
      <h2 id={`${id}-titre`} className="text-lg font-semibold">{t("jobs.talents.searchTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("jobs.talents.privacyNote")}</p>
      <p className="text-[13px] text-muted-foreground">{t("jobs.talents.declaredNote")}</p>
      <Card className="p-4">
        <form noValidate role="search" aria-label={t("jobs.talents.searchLabel")} className="flex min-w-0 flex-col gap-4" onSubmit={submit}>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field id={`${id}-country`} label={t("jobs.talents.country")} error={error("country")}>
              {(field) => (
                <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={jobSelectClass} {...form.register("country")}>
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>{country.name}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field id={`${id}-skill`} label={t("jobs.talents.skill")} hint={t("jobs.talents.skillHint")} error={error("skill")}>
              {(field) => <Input id={field.id} type="search" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} maxLength={JOB_QUERY_MAX_LENGTH} {...form.register("skill")} />}
            </Field>
          </div>
          <div>
            <Button type="submit">{t("jobs.talents.submit")}</Button>
          </div>
        </form>
      </Card>
      <ServicePager
        key={JSON.stringify(filters)}
        read={(cursor) => jobs.useTalentSearch({ country: filters.country, cursor, ...(filters.skill.trim().length > 0 ? { skill: filters.skill } : {}) })}
        keyOf={(talent) => talent.id}
        empty={<EmptyState icon={<UserRoundSearchIcon />} title={t("jobs.talents.emptyTitle")} description={t("jobs.talents.emptyBody")} />}
      >
        {(talents) => (
          <ul aria-label={t("jobs.talents.label")} className="grid min-w-0 gap-3 sm:grid-cols-2">
            {talents.map((talent) => (
              <li key={talent.id} className="min-w-0"><TalentHitCard talent={talent} /></li>
            ))}
          </ul>
        )}
      </ServicePager>
    </section>
  )
}
