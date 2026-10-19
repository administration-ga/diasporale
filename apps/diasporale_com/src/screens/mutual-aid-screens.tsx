"use client"

/**
 * Les écrans « entraide » (DG-024 a, plan global §G8.2) :
 *
 *   · `/entraide` : deux onglets — les QUESTIONS d'un pays (et d'une ville
 *     saisie, sans GPS), par état ou les miennes, « Poser une question » ; les
 *     MISSIONS bénévoles à venir des associations, mes inscriptions, celles des
 *     associations que je gère, « Proposer une mission ». Listes paginées
 *     (« Afficher plus »), vides expliqués ; le filtre se lit dans l'adresse ;
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
import { AID_CITY_MAX_LENGTH, parseResidenceCountry, type CountryCode } from "@diasporale/domain"
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
import { ServicePager } from "@/components/service-pager"
import { routes } from "@/lib/routes"

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

function MutualAidHome(props: { readonly membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const capability = useMutualAid()
  const params = useSearchParams()
  const router = useRouter()
  const filter = useMemo(() => aidFilterFromParams(params, props.membership.facet.countryOfResidence), [params, props.membership.facet.countryOfResidence])
  const [tab, setTab] = useState<"questions" | "missions">("questions")
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">{t("mutualAid.title")}</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{t("mutualAid.lead")}</p>
      </header>
      {capability === null ? <Unavailable /> : (
        <>
          <PlaceFilter
            key={`${filter.country}:${filter.city}`}
            country={filter.country}
            city={filter.city}
            onApply={(country, city) => router.replace(routes.mutualAid(country, city || undefined))}
          />
          <FolderTabs value={tab} onValueChange={(value) => setTab(value === "missions" ? "missions" : "questions")} className="min-w-0">
            <FolderTabsList aria-label={t("mutualAid.tabsLabel")} className="flex-wrap overflow-visible">
              <FolderTabsTrigger value="questions" className="min-h-11 flex-1 whitespace-normal px-3 text-center">{t("mutualAid.tab.questions")}</FolderTabsTrigger>
              <FolderTabsTrigger value="missions" className="min-h-11 flex-1 whitespace-normal px-3 text-center">{t("mutualAid.tab.missions")}</FolderTabsTrigger>
            </FolderTabsList>
            <FolderTabsContent value="questions">
              <QuestionsPanel capability={capability} country={filter.country} city={filter.city} />
            </FolderTabsContent>
            <FolderTabsContent value="missions">
              <MissionsPanel capability={capability} country={filter.country} city={filter.city} />
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

function QuestionsPanel(props: { readonly capability: MutualAidCapability; readonly country: CountryCode; readonly city: string }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const router = useRouter()
  const { capability, country, city } = props
  const [view, setView] = useState<MutualAidQuestionView>("open")
  const [asking, setAsking] = useState(false)
  const read = (cursor: string | null) => (view === "mine"
    ? capability.useMyQuestions({ cursor })
    : capability.useQuestions({ country, ...(city ? { city } : {}), status: view, cursor }))
  return (
    <section aria-labelledby={`${id}-titre`} className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <h2 id={`${id}-titre`} className="text-lg font-semibold">{t("mutualAid.questions.title")}</h2>
        <Button onClick={() => setAsking(true)}>{t("mutualAid.questions.ask")}</Button>
      </div>
      <Field id={`${id}-vue`} label={t("mutualAid.questions.viewLabel")} className="max-w-xs">
        {(field) => (
          <select id={field.id} aria-describedby={field.describedBy} className={selectClass} value={view} onChange={(event) => setView(event.target.value as MutualAidQuestionView)}>
            {MUTUAL_AID_QUESTION_VIEWS.map((value) => <option key={value} value={value}>{t(`mutualAid.questions.view.${value}`)}</option>)}
          </select>
        )}
      </Field>
      <ServicePager
        key={`${view}:${country}:${city}`}
        read={read}
        keyOf={(question) => question.id}
        empty={<EmptyState icon={<MessageCircleQuestionIcon />} title={t(`mutualAid.questions.empty.${view}.title`)} description={t(`mutualAid.questions.empty.${view}.body`)} />}
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

function MissionsPanel(props: { readonly capability: MutualAidCapability; readonly country: CountryCode; readonly city: string }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const router = useRouter()
  const { capability, country, city } = props
  const [view, setView] = useState<MutualAidMissionView>("upcoming")
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
            <select id={field.id} aria-describedby={field.describedBy} className={selectClass} value={shown} onChange={(event) => setView(event.target.value as MutualAidMissionView)}>
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
