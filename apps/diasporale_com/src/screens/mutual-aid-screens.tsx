"use client"

/**
 * Les écrans « entraide » (DG-024 a, plan global §G8.2) :
 *
 *   · `/entraide` : deux onglets — les QUESTIONS d'un pays (et d'une ville
 *     saisie, sans GPS), par état ou les miennes, « Poser une question » ; les
 *     MISSIONS bénévoles à venir des associations, mes inscriptions, celles des
 *     associations que je gère, « Proposer une mission ». Listes paginées
 *     (« Afficher plus »), vides expliqués ; le lieu, l'onglet, la vue, le thème
 *     et les mots cherchés se lisent dans l'adresse (ET-04) : elle se partage ;
 *   · `/entraide/<id>` : une question (réponses, réponse retenue, répondre) ou
 *     une mission (places, inscription consentie, retrait ; équipe : bénévoles).
 *
 * L'autorité reste au fournisseur (moteur ou démonstration) : ces écrans disent
 * ce qu'il a jugé. Capacité absente : « indisponible », jamais une invention.
 * Aucune coordonnée : le contact privé passe par la messagerie. L'état de
 * modération (G9) ne se dit que dans les vues de gestion : « Mes questions »,
 * les missions de mes associations, et les fiches que le lecteur gère.
 * PROPRIÉTAIRE : chantier « entraide ».
 */
import { AID_CITY_MAX_LENGTH, AID_QUERY_MAX_LENGTH, AID_THEMES, isAidTheme, parseResidenceCountry, type AidTheme, type CountryCode } from "@diasporale/domain"
import {
  Button,
  Card,
  EmptyState,
  Field,
  FolderTabs,
  FolderTabsContent,
  FolderTabsList,
  FolderTabsTrigger,
  Input,
  Sheet,
  SheetContent,
  Skeleton,
  formatDate,
  residenceCountryOptions,
} from "@diasporale/features"
import {
  MUTUAL_AID_MISSION_VIEWS,
  MUTUAL_AID_QUESTION_VIEWS,
  useMutualAid,
  type AidMissionCardView,
  type AidMissionPageOption,
  type AidQuestionCardView,
  type MembershipView,
  type MutualAidCapability,
  type MutualAidMissionView,
  type MutualAidQuestionView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarHeartIcon, HandHeartIcon, MessageCircleQuestionIcon } from "lucide-react"
import NextLink from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useId, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { AppShell } from "@/components/app-shell"
import { errorKey } from "@/components/association-parts"
import { Gate } from "@/components/gate"
import { AidMissionDetail } from "@/components/mutual-aid-mission-detail"
import { AidMissionForm } from "@/components/mutual-aid-mission-form"
import {
  AidMissionStatusChip,
  AidMissionWhen,
  AidModerationChip,
  AidPersonName,
  AidPlace,
  AidQuestionStatusChip,
  AidThemeChip,
  aidLinkClass,
  aidListStart,
} from "@/components/mutual-aid-parts"
import { AidQuestionDetail } from "@/components/mutual-aid-question-detail"
import { AidQuestionForm } from "@/components/mutual-aid-question-form"
import { useNow } from "@/components/service-request-ui"
import { useUrlState } from "@/components/url-state"
import { ServicePager } from "@/components/service-pager"
import { AID_MISSION_VIEW_SLUGS, AID_QUESTION_VIEW_SLUGS, routes } from "@/lib/routes"

const selectClass = "h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus aria-invalid:border-destructive"

// ═══════════════════════════════════════════════════════════════
// Écrans
// ═══════════════════════════════════════════════════════════════

/** `/entraide` — questions et missions bénévoles d'un pays (et d'une ville saisie). */
export function MutualAidScreen() {
  return (
    <Gate require="member">
      {(session) => (session.membership ? <AppShell membership={session.membership}><MutualAidHome membership={session.membership} /></AppShell> : null)}
    </Gate>
  )
}

/** `/entraide/<id>` — une question ou une mission ; indisponible, un état neutre. */
export function MutualAidItemScreen(props: { readonly itemId: string }) {
  return (
    <Gate require="member">
      {(session) => (session.membership ? <AppShell membership={session.membership}><MutualAidItem itemId={props.itemId} /></AppShell> : null)}
    </Gate>
  )
}

function Unavailable() {
  const { t } = useDiasporaleT()
  return <EmptyState icon={<HandHeartIcon />} title={t("mutualAid.unavailable.title")} description={t("mutualAid.unavailable.body")} />
}

function ListSkeleton() {
  const { t } = useDiasporaleT()
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">{t("common.pleaseWait")}</span>
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// /entraide
// ═══════════════════════════════════════════════════════════════

/** Le filtre porté par l'adresse : un pays de résidence (sinon celui du membre) et une ville saisie. */
export function aidFilterFromParams(params: Pick<URLSearchParams, "get">, fallback: CountryCode): { readonly country: CountryCode; readonly city: string } {
  const country = parseResidenceCountry(params.get("pays"))
  return { country: country.ok ? country.value : fallback, city: params.get("ville")?.trim() ?? "" }
}

/** ET-04 — tout ce que l'adresse porte de l'écran : lieu, onglet, vue de chaque onglet, thème et mots des questions. */
export interface MutualAidUrlState {
  readonly country: CountryCode
  readonly city: string
  readonly tab: "questions" | "missions"
  readonly questionView: MutualAidQuestionView
  readonly missionView: MutualAidMissionView
  readonly theme: AidTheme | null
  readonly q: string
}

/** Chaque vue de l'écran a son mot dans l'adresse (la table des routes les tient). */
const QUESTION_VIEW_SLUGS: Readonly<Record<MutualAidQuestionView, string | null>> = AID_QUESTION_VIEW_SLUGS
const MISSION_VIEW_SLUGS: Readonly<Record<MutualAidMissionView, string | null>> = AID_MISSION_VIEW_SLUGS

function viewOf<View extends string>(views: readonly View[], slugs: Readonly<Record<View, string | null>>, slug: string | null, fallback: View): View {
  return views.find((view) => slugs[view] !== null && slugs[view] === slug) ?? fallback
}

/** L'état porté par l'adresse ; une valeur illisible (vue, thème inconnus) est ignorée, jamais devinée. */
export function aidStateFromParams(params: Pick<URLSearchParams, "get">, fallback: CountryCode): MutualAidUrlState {
  const tab = params.get("onglet") === "missions" ? "missions" : "questions"
  const slug = params.get("vue")
  const theme = params.get("theme") ?? ""
  return {
    ...aidFilterFromParams(params, fallback),
    tab,
    questionView: tab === "questions" ? viewOf(MUTUAL_AID_QUESTION_VIEWS, QUESTION_VIEW_SLUGS, slug, "open") : "open",
    missionView: tab === "missions" ? viewOf(MUTUAL_AID_MISSION_VIEWS, MISSION_VIEW_SLUGS, slug, "upcoming") : "upcoming",
    theme: isAidTheme(theme) ? theme : null,
    q: (params.get("q") ?? "").trim().slice(0, AID_QUERY_MAX_LENGTH),
  }
}

/** L'adresse d'un état : le lieu, l'onglet et SA vue, le thème et les mots. */
export function aidHrefOf(state: MutualAidUrlState): string {
  return routes.mutualAid(state.country, state.city || undefined, {
    tab: state.tab,
    view: state.tab === "missions" ? state.missionView : state.questionView,
    theme: state.theme,
    q: state.q,
  })
}

function MutualAidHome(props: { readonly membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const capability = useMutualAid()
  const params = useSearchParams()
  const fromUrl = useMemo(() => aidStateFromParams(params, props.membership.facet.countryOfResidence), [params, props.membership.facet.countryOfResidence])
  const [state, setState] = useUrlState(fromUrl, aidHrefOf)
  const go = (next: Partial<MutualAidUrlState>) => setState({ ...state, ...next })
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">{t("mutualAid.title")}</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{t("mutualAid.lead")}</p>
      </header>
      {capability === null ? <Unavailable /> : (
        <>
          <PlaceFilter
            key={`${state.country}:${state.city}`}
            country={state.country}
            city={state.city}
            onApply={(country, city) => go({ country, city })}
          />
          <FolderTabs value={state.tab} onValueChange={(value) => go({ tab: value === "missions" ? "missions" : "questions" })} className="min-w-0">
            <FolderTabsList aria-label={t("mutualAid.tabsLabel")} className="flex-wrap overflow-visible">
              <FolderTabsTrigger value="questions" className="min-h-11 flex-1 whitespace-normal px-3 text-center">{t("mutualAid.tab.questions")}</FolderTabsTrigger>
              <FolderTabsTrigger value="missions" className="min-h-11 flex-1 whitespace-normal px-3 text-center">{t("mutualAid.tab.missions")}</FolderTabsTrigger>
            </FolderTabsList>
            <FolderTabsContent value="questions">
              <QuestionsPanel
                capability={capability}
                country={state.country}
                city={state.city}
                view={state.questionView}
                theme={state.theme}
                query={state.q}
                onChange={(next) => go(next)}
              />
            </FolderTabsContent>
            <FolderTabsContent value="missions">
              <MissionsPanel capability={capability} country={state.country} city={state.city} view={state.missionView} onView={(missionView) => go({ missionView })} />
            </FolderTabsContent>
          </FolderTabs>
        </>
      )}
    </>
  )
}

const filterSchema = z.object({
  country: z.string(),
  city: z.string().trim().max(AID_CITY_MAX_LENGTH, "aid_city_too_long"),
})
type FilterValues = z.infer<typeof filterSchema>

/** Un pays et une ville SAISIE (aucune géolocalisation) : l'adresse se partage, la résidence ne change pas. */
function PlaceFilter(props: { readonly country: CountryCode; readonly city: string; readonly onApply: (country: CountryCode, city: string) => void }) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const countries = useMemo(() => residenceCountryOptions(locale), [locale])
  const form = useForm<FilterValues>({ resolver: zodResolver(filterSchema), defaultValues: { country: props.country, city: props.city } })
  const cityError = form.formState.errors.city?.message
  const submit = form.handleSubmit((values) => {
    const country = parseResidenceCountry(values.country)
    props.onApply(country.ok ? country.value : props.country, values.city)
  })
  return (
    <Card className="p-4">
      <form noValidate role="search" aria-label={t("mutualAid.filter.label")} className="flex min-w-0 flex-col gap-4" onSubmit={submit}>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id={`${id}-country`} label={t("mutualAid.filter.country")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} className={selectClass} {...form.register("country")}>
                {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
              </select>
            )}
          </Field>
          <Field id={`${id}-city`} label={t("mutualAid.filter.city")} hint={t("mutualAid.filter.cityHint")} error={cityError ? t(errorKey(cityError)) : undefined}>
            {(field) => <Input id={field.id} autoComplete="address-level2" maxLength={AID_CITY_MAX_LENGTH} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("city")} />}
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{t("mutualAid.filter.apply")}</Button>
          {props.city ? <Button type="button" variant="ghost" onClick={() => props.onApply(props.country, "")}>{t("mutualAid.filter.wholeCountry")}</Button> : null}
        </div>
      </form>
    </Card>
  )
}

// ── Questions ─────────────────────────────────────────────────────

const searchSchema = z.object({ q: z.string().trim().max(AID_QUERY_MAX_LENGTH, "aid_query_too_long") })
type SearchValues = z.infer<typeof searchSchema>

/**
 * ET-04 — chercher par mots dans les questions du lieu : le titre et le détail. La
 * saisie part dans l'adresse ; le moteur cherche dès deux caractères.
 */
function QuestionSearch(props: { readonly query: string; readonly onSearch: (q: string) => void }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const form = useForm<SearchValues>({ resolver: zodResolver(searchSchema), defaultValues: { q: props.query } })
  const error = form.formState.errors.q?.message
  const submit = form.handleSubmit((values) => props.onSearch(values.q))
  return (
    <form noValidate role="search" aria-label={t("mutualAid.search.label")} className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end" onSubmit={submit}>
      <Field id={`${id}-q`} label={t("mutualAid.search.query")} hint={t("mutualAid.search.hint")} error={error ? t(errorKey(error)) : undefined} className="min-w-0 flex-1">
        {(field) => <Input id={field.id} type="search" maxLength={AID_QUERY_MAX_LENGTH} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("q")} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline">{t("mutualAid.search.submit")}</Button>
        {props.query ? <Button type="button" variant="ghost" onClick={() => props.onSearch("")}>{t("mutualAid.search.clear")}</Button> : null}
      </div>
    </form>
  )
}

function QuestionsPanel(props: {
  readonly capability: MutualAidCapability
  readonly country: CountryCode
  readonly city: string
  readonly view: MutualAidQuestionView
  readonly theme: AidTheme | null
  readonly query: string
  readonly onChange: (next: { readonly questionView?: MutualAidQuestionView; readonly theme?: AidTheme | null; readonly q?: string }) => void
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const router = useRouter()
  const { capability, country, city, view, theme, query } = props
  const [asking, setAsking] = useState(false)
  // « Mes questions » n'est pas une liste du lieu : ni thème ni mots ne la restreignent.
  const searching = view !== "mine" && (theme !== null || query.length > 0)
  const read = (cursor: string | null) => (view === "mine"
    ? capability.useMyQuestions({ cursor })
    : capability.useQuestions({
      country,
      ...(city ? { city } : {}),
      status: view === "unanswered" ? "open" : view,
      ...(view === "unanswered" ? { unanswered: true } : {}),
      ...(theme ? { theme } : {}),
      ...(query ? { query } : {}),
      cursor,
    }))
  return (
    <section aria-labelledby={`${id}-titre`} className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <h2 id={`${id}-titre`} className="text-lg font-semibold">{t("mutualAid.questions.title")}</h2>
        <Button onClick={() => setAsking(true)}>{t("mutualAid.questions.ask")}</Button>
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field id={`${id}-vue`} label={t("mutualAid.questions.viewLabel")}>
          {(field) => (
            <select id={field.id} aria-describedby={field.describedBy} className={selectClass} value={view} onChange={(event) => props.onChange({ questionView: event.target.value as MutualAidQuestionView })}>
              {MUTUAL_AID_QUESTION_VIEWS.map((value) => <option key={value} value={value}>{t(`mutualAid.questions.view.${value}`)}</option>)}
            </select>
          )}
        </Field>
        {view !== "mine" ? (
          <Field id={`${id}-theme`} label={t("mutualAid.search.theme")}>
            {(field) => (
              <select
                id={field.id}
                aria-describedby={field.describedBy}
                className={selectClass}
                value={theme ?? ""}
                onChange={(event) => props.onChange({ theme: isAidTheme(event.target.value) ? event.target.value : null })}
              >
                <option value="">{t("mutualAid.search.anyTheme")}</option>
                {AID_THEMES.map((value) => <option key={value} value={value}>{t(`mutualAid.theme.${value}`)}</option>)}
              </select>
            )}
          </Field>
        ) : null}
      </div>
      {view !== "mine" ? <QuestionSearch key={query} query={query} onSearch={(q) => props.onChange({ q })} /> : null}
      <ServicePager
        key={`${view}:${country}:${city}:${theme ?? ""}:${query}`}
        read={read}
        keyOf={(question) => question.id}
        empty={searching
          ? <EmptyState icon={<MessageCircleQuestionIcon />} title={t("mutualAid.search.emptyTitle")} description={t("mutualAid.search.emptyBody")} />
          : <EmptyState icon={<MessageCircleQuestionIcon />} title={t(`mutualAid.questions.empty.${view}.title`)} description={t(`mutualAid.questions.empty.${view}.body`)} />}
      >
        {(questions) => (
          <ul className="flex min-w-0 flex-col gap-3">
            {questions.map((question) => <QuestionCard key={question.id} question={question} />)}
          </ul>
        )}
      </ServicePager>
      {asking ? (
        <Sheet open onOpenChange={(open) => { if (!open) setAsking(false) }}>
          <SheetContent title={t("mutualAid.questions.askTitle")} description={t("mutualAid.questions.askDescription")} closeLabel={t("common.close")}>
            <AidQuestionForm
              capability={capability}
              initial={null}
              defaultCountry={country}
              defaultCity={city}
              onSaved={(questionId) => {
                setAsking(false)
                router.push(routes.mutualAidItem(questionId))
              }}
              onCancel={() => setAsking(false)}
            />
          </SheetContent>
        </Sheet>
      ) : null}
    </section>
  )
}

function QuestionCard(props: { readonly question: AidQuestionCardView }) {
  const { t, locale } = useDiasporaleT()
  const { question } = props
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <AidThemeChip theme={question.theme} />
        {question.status !== "open" ? <AidQuestionStatusChip status={question.status} /> : null}
        {/* G9 : l'état de modération, à son auteur seul (« Mes questions ») ; le fournisseur ne le sert à personne d'autre. */}
        {question.isMine ? <AidModerationChip state={question.moderation} /> : null}
      </div>
      <NextLink href={routes.mutualAidItem(question.id)} className={`${aidLinkClass} text-base`}>{question.title}</NextLink>
      {question.detail ? <p className="line-clamp-2 break-words text-sm text-muted-foreground">{question.detail}</p> : null}
      <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
        <AidPersonName person={question.author} />
        <span>{formatDate(question.createdAt, locale)}</span>
        <span aria-hidden>·</span>
        <AidPlace country={question.country} city={question.city} />
        <span aria-hidden>·</span>
        <span>{t("mutualAid.questions.answerCount", { count: question.answerCount })}</span>
        {question.hasAcceptedAnswer ? <span className="font-medium text-foreground">{t("mutualAid.questions.hasAccepted")}</span> : null}
      </p>
    </li>
  )
}

// ── Missions bénévoles ───────────────────────────────────────────

function MissionsPanel(props: {
  readonly capability: MutualAidCapability
  readonly country: CountryCode
  readonly city: string
  readonly view: MutualAidMissionView
  readonly onView: (view: MutualAidMissionView) => void
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const router = useRouter()
  const { capability, country, city, view } = props
  const now = useNow()
  const [from] = useState(() => aidListStart(Date.now()))
  const [proposing, setProposing] = useState(false)
  const pagesLoad = capability.useMissionPages()
  const pages: readonly AidMissionPageOption[] = pagesLoad.status === "ready" ? pagesLoad.data : []
  const [teamPageId, setTeamPageId] = useState<string | null>(null)
  const selectedPage = pages.find((page) => page.id === teamPageId) ?? pages[0] ?? null
  const views = MUTUAL_AID_MISSION_VIEWS.filter((value) => value !== "team" || pages.length > 0)
  const shown: MutualAidMissionView = views.includes(view) ? view : "upcoming"
  const read = (cursor: string | null) => (shown === "mine"
    ? capability.useMySignups({ cursor })
    : shown === "team"
      ? capability.usePageMissions({ pageId: selectedPage?.id ?? "", cursor })
      : capability.useMissions({ country, ...(city ? { city } : {}), from, cursor }))
  return (
    <section aria-labelledby={`${id}-titre`} className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <h2 id={`${id}-titre`} className="text-lg font-semibold">{t("mutualAid.missions.title")}</h2>
        {pages.length > 0 ? <Button onClick={() => setProposing(true)}>{t("mutualAid.missions.propose")}</Button> : null}
      </div>
      <p className="text-[13px] text-muted-foreground">{t("mutualAid.missions.lead")}</p>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field id={`${id}-vue`} label={t("mutualAid.missions.viewLabel")}>
          {(field) => (
            <select id={field.id} aria-describedby={field.describedBy} className={selectClass} value={shown} onChange={(event) => props.onView(event.target.value as MutualAidMissionView)}>
              {views.map((value) => <option key={value} value={value}>{t(`mutualAid.missions.view.${value}`)}</option>)}
            </select>
          )}
        </Field>
        {shown === "team" && selectedPage ? (
          <Field id={`${id}-page`} label={t("mutualAid.missions.pageLabel")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} className={selectClass} value={selectedPage.id} onChange={(event) => setTeamPageId(event.target.value)}>
                {pages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}
              </select>
            )}
          </Field>
        ) : null}
      </div>
      {pagesLoad.status === "loading" && shown === "team" ? <ListSkeleton /> : (
        <ServicePager
          key={`${shown}:${country}:${city}:${shown === "team" ? (selectedPage?.id ?? "") : ""}`}
          read={read}
          keyOf={(mission) => mission.id}
          empty={<EmptyState icon={<CalendarHeartIcon />} title={t(`mutualAid.missions.empty.${shown}.title`)} description={t(`mutualAid.missions.empty.${shown}.body`)} />}
        >
          {(missions) => (
            <ul className="flex min-w-0 flex-col gap-3">
              {missions.map((mission) => <MissionCard key={mission.id} mission={mission} now={now} managed={shown === "team"} />)}
            </ul>
          )}
        </ServicePager>
      )}
      {proposing ? (
        <Sheet open onOpenChange={(open) => { if (!open) setProposing(false) }}>
          <SheetContent title={t("mutualAid.missions.proposeTitle")} description={t("mutualAid.missions.proposeDescription")} closeLabel={t("common.close")}>
            <AidMissionForm
              capability={capability}
              pages={pages}
              initial={null}
              defaultCountry={country}
              onSaved={(missionId) => {
                setProposing(false)
                router.push(routes.mutualAidItem(missionId))
              }}
              onCancel={() => setProposing(false)}
            />
          </SheetContent>
        </Sheet>
      ) : null}
    </section>
  )
}

/** `managed` : la liste des missions de mes associations, vue de gestion de l'équipe. */
function MissionCard(props: { readonly mission: AidMissionCardView; readonly now: number; readonly managed: boolean }) {
  const { t } = useDiasporaleT()
  const { mission, now } = props
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <AidMissionStatusChip status={mission.status} startsAt={mission.startsAt} endsAt={mission.endsAt} now={now} />
        {mission.signedUp ? <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[13px] font-medium">{t("mutualAid.mission.signedUp")}</span> : null}
        {/* G9 : l'état de modération, à l'équipe seule ; ni les missions à venir ni mes inscriptions ne le disent. */}
        {props.managed ? <AidModerationChip state={mission.moderation} /> : null}
      </div>
      <NextLink href={routes.mutualAidItem(mission.id)} className={`${aidLinkClass} text-base`}>{mission.title}</NextLink>
      <p className="break-words text-sm">{t("mutualAid.mission.byPage", { page: mission.page.name })}</p>
      <div className="flex min-w-0 flex-col gap-1 text-[13px] text-muted-foreground">
        <AidMissionWhen startsAt={mission.startsAt} endsAt={mission.endsAt} timeZone={mission.timeZone} />
        <AidPlace country={mission.country} city={mission.city} area={mission.area} />
        <span>{t("mutualAid.mission.places", { count: mission.places, taken: mission.signupCount })}</span>
      </div>
    </li>
  )
}

// ═══════════════════════════════════════════════════════════════
// /entraide/<id>
// ═══════════════════════════════════════════════════════════════

function MutualAidItem(props: { readonly itemId: string }) {
  const capability = useMutualAid()
  if (capability === null) return <Unavailable />
  return <ItemDetail capability={capability} itemId={props.itemId} />
}

function ItemDetail(props: { readonly capability: MutualAidCapability; readonly itemId: string }) {
  const { t } = useDiasporaleT()
  const item = props.capability.useItem(props.itemId)
  if (item.status === "loading") return <ListSkeleton />
  if (item.status === "error") return <p role="alert" className="text-sm text-destructive">{t(errorKey(item.code))}</p>
  if (item.data === null) {
    return (
      <EmptyState
        icon={<HandHeartIcon />}
        title={t("mutualAid.item.unavailableTitle")}
        description={t("mutualAid.item.unavailableBody")}
        action={<Button asChild variant="outline"><NextLink href={routes.mutualAid()}>{t("mutualAid.backToList")}</NextLink></Button>}
      />
    )
  }
  return item.data.kind === "question"
    ? <AidQuestionDetail capability={props.capability} question={item.data.question} />
    : <AidMissionDetail capability={props.capability} mission={item.data.mission} />
}
