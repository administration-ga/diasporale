"use client"

/**
 * Les écrans du mentorat bénévole (DG-024, troisième tranche, lot G8 point 2) :
 *
 *   · `/mentorat?pays=` — chercher des mentors actifs par pays (celui de ma
 *     facette par défaut) et domaine, leurs cartes, « Devenir mentor » ;
 *   · `/mentorat/<id>` — la fiche d'un mentor et « Demander un mentorat »
 *     (feuille React Hook Form + Zod, consentement explicite) ; le profil d'autrui
 *     se signale (G9, chantier « confiance des surfaces ») ;
 *   · `/mes-mentorats` — deux onglets : « Mes demandes » (envoyées ; reçues à
 *     accepter ou décliner) et « Mon profil de mentor » (plafond affiché, pause,
 *     retrait).
 *
 * Le mentorat est BÉNÉVOLE : aucun tarif, aucun paiement. Aucune coordonnée :
 * le contact passe par la messagerie une fois la demande acceptée. Chaque écran
 * dit le chargement, l'erreur, le vide et l'indisponibilité (capacité absente).
 * PROPRIÉTAIRE : chantier « mentorat ».
 */
import { isMentoringDomain, MENTORING_DOMAINS, parseResidenceCountry, type CountryCode, type MentoringDomain } from "@diasporale/domain"
import {
  Button,
  Card,
  EmptyState,
  Field,
  FolderTabs,
  FolderTabsContent,
  FolderTabsList,
  FolderTabsTrigger,
  Skeleton,
  countryName,
  residenceCountryOptions,
} from "@diasporale/features"
import { useMentoring, type ContentReportTarget, type MembershipView, type MentorDetailView, type MentoringCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, SearchXIcon } from "lucide-react"
import NextLink from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useId, useMemo, useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { AppShell } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { BecomeMentorEntry, MentorProfilePanel } from "@/components/mentoring-profile-panel"
import { MentoringRequestEntry } from "@/components/mentoring-request-form"
import { MenteeRequestsSection, MentorRequestsSection } from "@/components/mentoring-requests"
import { MentoringPager, MentoringUnavailable, MentoringVolunteerNote, MentorResultCard, MentorSummary } from "@/components/mentoring-ui"
import { ReportContentAction, ReportedContent } from "@/components/report-content-sheet"
import { browserTimeZone } from "@/components/service-request-ui"
import { routes } from "@/lib/routes"

const selectClass = "h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus aria-invalid:border-destructive"

/** La coque commune : membre, coquille de l'application, une clé par personne (aucun état d'un autre compte). */
function MemberScreen(props: { readonly children: (membership: MembershipView) => ReactNode }) {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <AppShell membership={session.membership}>
            <div key={session.membership.personId} className="contents">{props.children(session.membership)}</div>
          </AppShell>
        ) : null
      }
    </Gate>
  )
}

/** Le pays de l'adresse (`?pays=`) s'il est un pays de la diaspora, sinon celui de ma facette. */
export function mentoringCountryOf(raw: string | null, fallback: CountryCode): CountryCode {
  const parsed = parseResidenceCountry(raw)
  return parsed.ok ? parsed.value : fallback
}

// ═══════════════════════════════════════════════════════════════
// /mentorat
// ═══════════════════════════════════════════════════════════════

export function MentoringScreen() {
  return <MemberScreen>{(membership) => <MentoringSearch membership={membership} />}</MemberScreen>
}

const searchSchema = z.object({
  country: z.string().refine((value) => parseResidenceCountry(value).ok, { message: "mentor_country_invalid" }),
  domain: z.string().refine((value): boolean => value === "" || isMentoringDomain(value), { message: "mentor_domain_invalid" }),
})

type SearchValues = z.infer<typeof searchSchema>

function MentoringSearch(props: { readonly membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const capability = useMentoring()
  const params = useSearchParams()
  const router = useRouter()
  const country = mentoringCountryOf(params.get("pays"), props.membership.facet.countryOfResidence)
  // Le domaine vit dans l'écran : l'adresse ne porte que le pays (table des routes).
  const [domain, setDomain] = useState<MentoringDomain | null>(null)
  const searchKey = `${country}:${domain ?? ""}`
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">{t("mentoring.search.title")}</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{t("mentoring.search.lead")}</p>
      </header>
      {capability === null ? (
        <MentoringUnavailable />
      ) : (
        <>
          <MentoringVolunteerNote />
          <div className="flex flex-wrap items-start gap-2">
            <BecomeMentorEntry capability={capability} membership={props.membership} />
            <Button asChild variant="outline">
              <NextLink href={routes.myMentoring()}>{t("mentoring.search.myMentoring")}</NextLink>
            </Button>
          </div>
          <SearchForm
            key={searchKey}
            country={country}
            domain={domain}
            onSearch={(next) => {
              setDomain(next.domain)
              router.replace(routes.mentoring(next.country))
            }}
          />
          <SearchResults key={searchKey} capability={capability} country={country} domain={domain} />
        </>
      )}
    </>
  )
}

function SearchForm(props: {
  readonly country: CountryCode
  readonly domain: MentoringDomain | null
  readonly onSearch: (next: { readonly country: CountryCode; readonly domain: MentoringDomain | null }) => void
}) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const countries = useMemo(() => residenceCountryOptions(locale), [locale])
  const form = useForm<SearchValues>({ resolver: zodResolver(searchSchema), defaultValues: { country: props.country, domain: props.domain ?? "" } })
  const countryError = form.formState.errors.country?.message
  const submit = form.handleSubmit((values) => {
    const country = parseResidenceCountry(values.country)
    if (!country.ok) return form.setError("country", { message: "mentor_country_invalid" })
    props.onSearch({ country: country.value, domain: isMentoringDomain(values.domain) ? values.domain : null })
  })
  return (
    <Card className="p-4">
      <form noValidate role="search" aria-label={t("mentoring.search.label")} className="flex min-w-0 flex-col gap-4" onSubmit={submit}>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id={`${id}-pays`} label={t("mentoring.search.country")} error={countryError ? t(`errors.${countryError}`) : undefined}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} className={selectClass} {...form.register("country")}>
                {countries.map((option) => (
                  <option key={option.code} value={option.code}>{option.name}</option>
                ))}
              </select>
            )}
          </Field>
          <Field id={`${id}-domaine`} label={t("mentoring.search.domain")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} className={selectClass} {...form.register("domain")}>
                <option value="">{t("mentoring.search.anyDomain")}</option>
                {MENTORING_DOMAINS.map((value) => (
                  <option key={value} value={value}>{t(`mentor.domain.${value}`)}</option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <div>
          <Button type="submit">{t("mentoring.search.submit")}</Button>
        </div>
      </form>
    </Card>
  )
}

function SearchResults(props: { readonly capability: MentoringCapability; readonly country: CountryCode; readonly domain: MentoringDomain | null }) {
  const { t, locale } = useDiasporaleT()
  const { capability, country, domain } = props
  const name = countryName(country, locale)
  return (
    <section aria-labelledby="resultats-mentors" className="flex min-w-0 flex-col gap-3">
      <h2 id="resultats-mentors" className="text-lg font-semibold">{t("mentoring.search.results", { country: name })}</h2>
      <MentoringPager
        read={(cursor) => capability.useSearch({ country, domain, cursor })}
        keyOf={(mentor) => mentor.mentorId}
        empty={
          <EmptyState
            icon={<SearchXIcon />}
            title={t("mentoring.search.emptyTitle")}
            description={t(domain ? "mentoring.search.emptyDomain" : "mentoring.search.emptyBody", { country: name })}
          />
        }
      >
        {(mentors) => (
          <ul aria-label={t("mentoring.search.resultsLabel")} className="grid min-w-0 gap-3 sm:grid-cols-2">
            {mentors.map((mentor) => (
              <li key={mentor.mentorId} className="min-w-0">
                <MentorResultCard mentor={mentor} />
              </li>
            ))}
          </ul>
        )}
      </MentoringPager>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════
// /mentorat/<id>
// ═══════════════════════════════════════════════════════════════

export function MentorProfileScreen(props: { readonly mentorId: string }) {
  return <MemberScreen>{(membership) => <MentorDetail mentorId={props.mentorId} membership={membership} />}</MemberScreen>
}

function MentorDetail(props: { readonly mentorId: string; readonly membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const capability = useMentoring()
  return (
    <>
      <div>
        <Button asChild variant="ghost" size="sm" className="min-h-11">
          <NextLink href={routes.mentoring()}>
            <ArrowLeftIcon aria-hidden />
            {t("mentoring.profile.back")}
          </NextLink>
        </Button>
      </div>
      {capability === null ? <MentoringUnavailable /> : <LoadedMentor capability={capability} mentorId={props.mentorId} membership={props.membership} />}
    </>
  )
}

function LoadedMentor(props: { readonly capability: MentoringCapability; readonly mentorId: string; readonly membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const query = props.capability.useMentor(props.mentorId)
  if (query.status === "loading") return <Skeleton className="h-64 w-full rounded-xl" />
  if (query.status === "error") {
    return (
      <Card role="alert" className="p-4">
        <p>{t(`errors.${query.code}`)}</p>
      </Card>
    )
  }
  if (query.data === null) return <EmptyState icon={<SearchXIcon />} title={t("mentoring.profile.notFoundTitle")} description={t("mentoring.profile.notFoundBody")} />
  return <MentorArticle key={query.data.mentorId} capability={props.capability} mentor={query.data} membership={props.membership} />
}

/** Une phrase et son lien : « c'est votre profil », « une demande est déjà en cours ». */
function NoticeWithLink(props: { readonly text: string; readonly href: string; readonly link: string }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm">{props.text}</p>
      <Button asChild variant="outline" size="sm" className="min-h-11">
        <NextLink href={props.href}>{props.link}</NextLink>
      </Button>
    </div>
  )
}

function MentorArticle(props: { readonly capability: MentoringCapability; readonly mentor: MentorDetailView; readonly membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const { mentor } = props
  const canPublish = props.membership.status !== "partie" && props.membership.canPublish
  let action: ReactNode
  if (mentor.isSelf) {
    action = <NoticeWithLink text={t("mentoring.profile.self")} href={routes.myMentoring()} link={t("mentoring.search.myMentoring")} />
  } else if (mentor.viewerRequest) {
    action = <NoticeWithLink text={t("mentoring.profile.alreadyRequested")} href={routes.myMentoring()} link={t("mentoring.profile.followRequests")} />
  } else if (!mentor.acceptsRequests) {
    action = <p className="text-sm">{t("mentoring.profile.full")}</p>
  } else if (!canPublish) {
    action = (
      <div className="flex flex-col items-start gap-2">
        <Button disabled>{t("mentoring.request.cta")}</Button>
        <p className="text-sm text-muted-foreground">{t("mentoring.request.statusInsufficient")}</p>
      </div>
    )
  } else {
    action = <MentoringRequestEntry capability={props.capability} mentor={mentor} />
  }
  // G9 : le profil d'un autre mentor se signale ; signalé, la fiche est masquée pour la personne.
  const reportTarget: ContentReportTarget = { kind: "diasporaMentorProfile", id: mentor.mentorId }
  const article = (
    <article aria-labelledby="mentor-titre" className="flex min-w-0 flex-col gap-5">
      <h1 id="mentor-titre" className="break-words font-display text-2xl font-bold">{t("mentoring.profile.title", { name: mentor.displayName })}</h1>
      <MentorSummary mentor={mentor} />
      {mentor.isSelf && mentor.state === "paused" ? <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("mentoring.panel.pausedNote")}</p> : null}
      <section aria-labelledby="mentor-presentation" className="flex min-w-0 flex-col gap-1">
        <h2 id="mentor-presentation" className="text-lg font-semibold">{t("mentoring.profile.presentation")}</h2>
        <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{mentor.presentation}</p>
      </section>
      <section aria-labelledby="mentor-disponibilite" className="flex min-w-0 flex-col gap-1">
        <h2 id="mentor-disponibilite" className="text-lg font-semibold">{t("mentoring.profile.availability")}</h2>
        <p className="break-words text-[15px]">{mentor.availability}</p>
      </section>
      <MentoringVolunteerNote />
      <section aria-labelledby="mentor-demande" className="flex min-w-0 flex-col gap-2">
        <h2 id="mentor-demande" className="text-lg font-semibold">{t("mentoring.profile.requestTitle")}</h2>
        {action}
      </section>
      {mentor.isSelf ? null : <ReportContentAction target={reportTarget} className="self-start" />}
    </article>
  )
  return <ReportedContent target={reportTarget}>{article}</ReportedContent>
}

// ═══════════════════════════════════════════════════════════════
// /mes-mentorats
// ═══════════════════════════════════════════════════════════════

export function MyMentoringScreen() {
  return <MemberScreen>{(membership) => <MyMentoring membership={membership} />}</MemberScreen>
}

function MyMentoring(props: { readonly membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const capability = useMentoring()
  const viewerTimeZone = useMemo(() => browserTimeZone(), [])
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">{t("mentoring.mine.title")}</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{t("mentoring.mine.lead")}</p>
      </header>
      {capability === null ? (
        <MentoringUnavailable />
      ) : (
        <FolderTabs defaultValue="demandes">
          <FolderTabsList aria-label={t("mentoring.mine.tabsLabel")}>
            <FolderTabsTrigger value="demandes">{t("mentoring.mine.tabRequests")}</FolderTabsTrigger>
            <FolderTabsTrigger value="profil">{t("mentoring.mine.tabProfile")}</FolderTabsTrigger>
          </FolderTabsList>
          <FolderTabsContent value="demandes" className="flex min-w-0 flex-col gap-6">
            <MenteeRequestsSection capability={capability} viewerTimeZone={viewerTimeZone} />
            <ReceivedRequests capability={capability} viewerTimeZone={viewerTimeZone} />
          </FolderTabsContent>
          <FolderTabsContent value="profil">
            <MentorProfilePanel capability={capability} membership={props.membership} />
          </FolderTabsContent>
        </FolderTabs>
      )}
    </>
  )
}

/** Les demandes reçues ne s'affichent qu'à qui a (ou a eu) un profil de mentor. */
function ReceivedRequests(props: { readonly capability: MentoringCapability; readonly viewerTimeZone: string }) {
  const query = props.capability.useMyProfile()
  if (query.status !== "ready" || query.data === null) return null
  return <MentorRequestsSection capability={props.capability} viewerTimeZone={props.viewerTimeZone} />
}
