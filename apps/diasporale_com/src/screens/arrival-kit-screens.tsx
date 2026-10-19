"use client"

/**
 * Le kit d'arrivée de DIASPORALE (DG-024 b, plan global §4 G8 point 3) — deux écrans :
 *
 *   · `/kit-arrivee?pays&ville` : les ressources d'un pays et d'une ville saisie (sans
 *     GPS), par rubrique, avec leur date de vérification et l'avertissement « à revoir » ;
 *     « Mes propositions » ; la file de relecture pour les relecteurs habilités ;
 *     « Proposer une ressource » ;
 *   · `/kit-arrivee/<id>` : la fiche — contenu, source (lien externe sûr), qui la porte
 *     et qui l'a relue, dates ; signaler une information périmée, modifier la sienne,
 *     relire.
 *
 * L'autorité reste au fournisseur (moteur ou démonstration) : l'écran dit ce qu'il a
 * jugé. Une ressource communautaire ne se dit jamais officielle ; seule une page au badge
 * « Officiel » calculé le fait. Qui gère une ressource y lit aussi son état de modération
 * (G9 : en relecture préalable, refusée) — l'avis de modération sur la fiche, une ligne
 * dans « Mes propositions » ; le fournisseur le tait pour tout autre lecteur.
 * PROPRIÉTAIRE : chantier « kit d'arrivée ».
 */
import {
  ARRIVAL_KIT_CATEGORIES,
  ARRIVAL_KIT_CITY_MAX_LENGTH,
  isArrivalKitCategory,
  isArrivalKitListed,
  parseResidenceCountry,
  type ArrivalKitCategory,
  type CountryCode,
} from "@diasporale/domain"
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
  ModerationBanner,
  Sheet,
  SheetContent,
  Skeleton,
  cn,
  countryName,
  formatDate,
  residenceCountryOptions,
} from "@diasporale/features"
import {
  ARRIVAL_KIT_VIEWS,
  moderationBannerState,
  useArrivalKit,
  useDataSource,
  type ArrivalKitCapability,
  type ArrivalKitListRequest,
  type ArrivalKitResourceDetailView,
  type ArrivalKitStandingView,
  type ArrivalKitView,
  type ManagedModerationState,
  type MembershipView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, CircleAlertIcon, ClockIcon, ExternalLinkIcon, FilePlus2Icon, InboxIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react"
import NextLink from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useId, useMemo, useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { AppShell } from "@/components/app-shell"
import { ArrivalKitResourceActions } from "@/components/arrival-kit-actions"
import { ArrivalKitResourceForm, type ArrivalKitFormInitial } from "@/components/arrival-kit-form"
import {
  ArrivalKitCarrier,
  ArrivalKitCategoryChip,
  ArrivalKitPersonName,
  ArrivalKitResourceCard,
  ArrivalKitStatusBadge,
  ArrivalKitTrustChip,
  ArrivalKitUnavailable,
  isSafeExternalUrl,
  kitLinkClass,
} from "@/components/arrival-kit-parts"
import { errorKey } from "@/components/association-parts"
import { Gate } from "@/components/gate"
import { ReportedContent } from "@/components/report-content-sheet"
import { ServicePager } from "@/components/service-pager"
import { routes } from "@/lib/routes"

const selectClass = "h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus aria-invalid:border-destructive"

// ═══════════════════════════════════════════════════════════════
// Écrans
// ═══════════════════════════════════════════════════════════════

/** `/kit-arrivee` — le kit d'un pays et d'une ville saisie ; la zone se lit dans l'adresse. */
export function ArrivalKitScreen() {
  return (
    <Gate require="member">
      {(session) => (session.membership ? <AppShell membership={session.membership}><ArrivalKitHome membership={session.membership} /></AppShell> : null)}
    </Gate>
  )
}

/** `/kit-arrivee/<id>` — la fiche d'une ressource ; indisponible, un état neutre. */
export function ArrivalKitResourceScreen(props: { readonly resourceId: string }) {
  return (
    <Gate require="member">
      {(session) => (session.membership ? <AppShell membership={session.membership}><ResourceDetail resourceId={props.resourceId} /></AppShell> : null)}
    </Gate>
  )
}

// ═══════════════════════════════════════════════════════════════
// /kit-arrivee — la zone, les ressources, mes propositions, la relecture
// ═══════════════════════════════════════════════════════════════

/** La zone consultée : un pays (sinon celui de résidence) et une ville saisie, facultative. */
export interface ArrivalKitZoneView {
  readonly country: CountryCode
  readonly city: string | null
}

/** La zone portée par l'adresse ; une valeur illisible est ignorée, jamais devinée. */
export function zoneFromParams(params: Pick<URLSearchParams, "get">, fallback: CountryCode): ArrivalKitZoneView {
  const country = parseResidenceCountry(params.get("pays"))
  const city = params.get("ville")?.trim() ?? ""
  return { country: country.ok ? country.value : fallback, city: city.length > 0 && city.length <= ARRIVAL_KIT_CITY_MAX_LENGTH ? city : null }
}

function ArrivalKitHome(props: { readonly membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const kit = useArrivalKit()
  const params = useSearchParams()
  const router = useRouter()
  const zone = zoneFromParams(params, props.membership.facet.countryOfResidence)
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">{t("arrivalKit.home.title")}</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{t("arrivalKit.home.lead")}</p>
        <p className="text-[13px] text-muted-foreground">{t("arrivalKit.home.trustNote")}</p>
      </header>
      {kit === null ? (
        <ArrivalKitUnavailable />
      ) : (
        <ArrivalKitBoard
          key={`${zone.country}:${zone.city ?? ""}`}
          kit={kit}
          zone={zone}
          onZone={(next) => router.replace(routes.arrivalKit(next.country, next.city ?? undefined))}
        />
      )}
    </>
  )
}

function ArrivalKitBoard(props: { readonly kit: ArrivalKitCapability; readonly zone: ArrivalKitZoneView; readonly onZone: (zone: ArrivalKitZoneView) => void }) {
  const { t } = useDiasporaleT()
  const { kit, zone } = props
  const standing = kit.useStanding()
  const [tab, setTab] = useState<ArrivalKitView>("resources")
  /** L'instant où la proposition s'ouvre : la date de vérification proposée par défaut. */
  const [proposingAt, setProposingAt] = useState<number | null>(null)
  const ready = standing.status === "ready" ? standing.data : null
  const tabs = ARRIVAL_KIT_VIEWS.filter((item) => item !== "review" || ready?.canReview === true)
  const current = tabs.includes(tab) ? tab : "resources"
  const propose = ready?.canPropose === true ? () => setProposingAt(Date.now()) : null

  return (
    <>
      <ZoneForm zone={zone} onSubmit={props.onZone} />
      <div className="flex flex-wrap items-center gap-2">
        {propose !== null ? (
          <Button onClick={propose}>
            <FilePlus2Icon aria-hidden />
            {t("arrivalKit.propose.open")}
          </Button>
        ) : ready !== null ? (
          <p className="text-sm text-muted-foreground">{t("arrivalKit.propose.statusInsufficient")}</p>
        ) : null}
        {standing.status === "error" ? <p role="alert" className="text-sm text-destructive">{t(errorKey(standing.code))}</p> : null}
      </div>
      <FolderTabs value={current} onValueChange={(value) => setTab(value as ArrivalKitView)} className="min-w-0">
        <FolderTabsList aria-label={t("arrivalKit.tabs.label")} className="flex-wrap overflow-visible">
          {tabs.map((item) => (
            <FolderTabsTrigger key={item} value={item} className="min-h-11 flex-1 whitespace-normal px-3 text-center">
              {t(`arrivalKit.tabs.${item}`)}
            </FolderTabsTrigger>
          ))}
        </FolderTabsList>
        <FolderTabsContent value="resources">
          <ResourcesPanel kit={kit} zone={zone} onPropose={propose} />
        </FolderTabsContent>
        <FolderTabsContent value="mine">
          <MyResourcesPanel kit={kit} />
        </FolderTabsContent>
        {ready?.canReview === true ? (
          <FolderTabsContent value="review">
            <ReviewQueuePanel kit={kit} country={zone.country} />
          </FolderTabsContent>
        ) : null}
      </FolderTabs>
      {proposingAt !== null && ready !== null ? (
        <ProposeSheet kit={kit} standing={ready} zone={zone} openedAt={proposingAt} onClose={() => setProposingAt(null)} />
      ) : null}
    </>
  )
}

const zoneSchema = z.object({
  country: z.string().min(1, "arrival_kit_country_required"),
  city: z.string().trim().max(ARRIVAL_KIT_CITY_MAX_LENGTH, "arrival_kit_city_too_long"),
})
type ZoneValues = z.infer<typeof zoneSchema>

/** Choisir la zone : un pays et une ville SAISIE, jamais de géolocalisation ; l'adresse se partage. */
function ZoneForm(props: { readonly zone: ArrivalKitZoneView; readonly onSubmit: (zone: ArrivalKitZoneView) => void }) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const countries = useMemo(() => residenceCountryOptions(locale), [locale])
  const form = useForm<ZoneValues>({ resolver: zodResolver(zoneSchema), defaultValues: { country: props.zone.country, city: props.zone.city ?? "" } })
  const submit = form.handleSubmit((values) => {
    const country = parseResidenceCountry(values.country)
    if (!country.ok) return
    props.onSubmit({ country: country.value, city: values.city.length > 0 ? values.city : null })
  })
  const cityError = form.formState.errors.city?.message
  return (
    <Card className="p-4">
      <form noValidate role="search" aria-label={t("arrivalKit.zone.label")} className="grid min-w-0 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start" onSubmit={submit}>
        <Field id={`${id}-country`} label={t("arrivalKit.zone.country")}>
          {(field) => (
            <select id={field.id} aria-describedby={field.describedBy} className={selectClass} {...form.register("country")}>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>{country.name}</option>
              ))}
            </select>
          )}
        </Field>
        <Field id={`${id}-city`} label={t("arrivalKit.zone.city")} hint={t("arrivalKit.zone.cityHint")} error={typeof cityError === "string" ? t(errorKey(cityError)) : undefined}>
          {(field) => <Input id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} autoComplete="address-level2" maxLength={ARRIVAL_KIT_CITY_MAX_LENGTH} {...form.register("city")} />}
        </Field>
        <Button type="submit" className="sm:mt-6">{t("arrivalKit.zone.submit")}</Button>
      </form>
    </Card>
  )
}

/** Les ressources de la zone : la ville saisie et tout le pays, ou tout le pays seul ; une rubrique restreint. */
function ResourcesPanel(props: { readonly kit: ArrivalKitCapability; readonly zone: ArrivalKitZoneView; readonly onPropose: (() => void) | null }) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const [category, setCategory] = useState<ArrivalKitCategory | null>(null)
  const { zone } = props
  const country = countryName(zone.country, locale)
  const base = { country: zone.country, category } as const
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex min-w-0 max-w-sm flex-col gap-1.5">
        <label htmlFor={`${id}-category`} className="text-sm font-medium">{t("arrivalKit.filter.category")}</label>
        <select
          id={`${id}-category`}
          className={selectClass}
          value={category ?? ""}
          onChange={(event) => setCategory(isArrivalKitCategory(event.target.value) ? event.target.value : null)}
        >
          <option value="">{t("arrivalKit.filter.anyCategory")}</option>
          {ARRIVAL_KIT_CATEGORIES.map((item) => (
            <option key={item} value={item}>{t(`arrivalKit.category.${item}`)}</option>
          ))}
        </select>
      </div>
      {zone.city !== null ? (
        <>
          <ResourceSection
            key={`ville:${category ?? ""}`}
            kit={props.kit}
            title={t("arrivalKit.list.cityTitle", { city: zone.city })}
            request={{ ...base, city: zone.city, nationalOnly: false }}
            onPropose={props.onPropose}
          />
          <ResourceSection
            key={`national:${category ?? ""}`}
            kit={props.kit}
            title={t("arrivalKit.list.nationalTitle", { country })}
            request={{ ...base, city: null, nationalOnly: true }}
            onPropose={null}
          />
        </>
      ) : (
        <ResourceSection
          key={`pays:${category ?? ""}`}
          kit={props.kit}
          title={t("arrivalKit.list.countryTitle", { country })}
          request={{ ...base, city: null, nationalOnly: false }}
          onPropose={props.onPropose}
        />
      )}
    </div>
  )
}

function ResourceSection(props: {
  readonly kit: ArrivalKitCapability
  readonly title: string
  readonly request: Omit<ArrivalKitListRequest, "cursor">
  readonly onPropose: (() => void) | null
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const { kit, request } = props
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <h2 id={id} className="text-lg font-semibold">{props.title}</h2>
      <ServicePager
        read={(cursor) => kit.useResources({ ...request, cursor })}
        keyOf={(resource) => resource.id}
        empty={
          <EmptyState
            icon={<SearchXIcon />}
            title={t("arrivalKit.list.emptyTitle")}
            description={
              <>
                {t("arrivalKit.list.emptyBody")}
                {request.category !== null ? <> {t("arrivalKit.list.emptyCategory")}</> : null}
              </>
            }
            action={props.onPropose !== null ? <Button variant="outline" onClick={props.onPropose}>{t("arrivalKit.list.emptyAction")}</Button> : undefined}
          />
        }
      >
        {(resources) => (
          <ul aria-label={props.title} className="grid min-w-0 gap-3 sm:grid-cols-2">
            {resources.map((resource) => (
              <li key={resource.id} className="min-w-0"><ArrivalKitResourceCard resource={resource} /></li>
            ))}
          </ul>
        )}
      </ServicePager>
    </section>
  )
}

/** « Mes propositions » : tous leurs états, le motif d'un renvoi, les signalements, l'état de modération. */
function MyResourcesPanel(props: { readonly kit: ArrivalKitCapability }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const { kit } = props
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <h2 id={id} className="text-lg font-semibold">{t("arrivalKit.mine.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("arrivalKit.mine.lead")}</p>
      <ServicePager
        read={(cursor) => kit.useMyResources({ cursor })}
        keyOf={(resource) => resource.id}
        empty={<EmptyState icon={<InboxIcon />} title={t("arrivalKit.mine.empty")} description={t("arrivalKit.mine.emptyBody")} />}
      >
        {(resources) => (
          <ul aria-label={t("arrivalKit.mine.title")} className="grid min-w-0 gap-3 sm:grid-cols-2">
            {resources.map((resource) => (
              <li key={resource.id} className="min-w-0">
                <ArrivalKitResourceCard resource={resource} showStatus>
                  <ModerationLine moderation={resource.moderation} />
                  {resource.statusReason !== null ? <p className="whitespace-pre-line break-words text-[13px]">{t("arrivalKit.card.reason", { reason: resource.statusReason })}</p> : null}
                  {resource.outdatedFlags !== null && resource.outdatedFlags > 0 ? (
                    <p className="text-[13px] text-muted-foreground">{t("arrivalKit.card.flags", { count: resource.outdatedFlags })}</p>
                  ) : null}
                </ArrivalKitResourceCard>
              </li>
            ))}
          </ul>
        )}
      </ServicePager>
    </section>
  )
}

/**
 * L'état de modération du moteur (G9) en une ligne, sur une de « Mes propositions » : le
 * fournisseur ne le sert qu'à qui gère la ressource ; publiée, rien n'est dit. Icône et
 * libellé, jamais la seule couleur.
 */
function ModerationLine(props: { readonly moderation: ManagedModerationState | undefined }) {
  const { t } = useDiasporaleT()
  const state = moderationBannerState(props.moderation)
  if (state === null) return null
  const pending = state === "pending_review"
  const Icon = pending ? ClockIcon : CircleAlertIcon
  return (
    <p className={cn("flex min-w-0 items-start gap-1.5 text-[13px] font-medium", pending ? "text-pending-foreground" : "text-rejected-foreground")}>
      <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0 break-words">{t(pending ? "arrivalKit.card.moderationPending" : "arrivalKit.card.moderationRemoved")}</span>
    </p>
  )
}

/** La file de relecture du pays consulté : ce que je n'ai pas écrit, les plus anciennes soumissions d'abord. */
function ReviewQueuePanel(props: { readonly kit: ArrivalKitCapability; readonly country: CountryCode }) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const { kit, country } = props
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <h2 id={id} className="text-lg font-semibold">{t("arrivalKit.queue.title", { country: countryName(country, locale) })}</h2>
      <p className="text-sm text-muted-foreground">{t("arrivalKit.queue.lead")}</p>
      <ServicePager
        key={country}
        read={(cursor) => kit.useReviewQueue({ country, cursor })}
        keyOf={(resource) => resource.id}
        empty={<p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("arrivalKit.queue.empty")}</p>}
      >
        {(resources) => (
          <ul aria-label={t("arrivalKit.queue.label")} className="grid min-w-0 gap-3 sm:grid-cols-2">
            {resources.map((resource) => (
              <li key={resource.id} className="min-w-0">
                <ArrivalKitResourceCard resource={resource} showStatus>
                  <p className="text-[13px] text-muted-foreground">{t("arrivalKit.card.submittedOn", { date: formatDate(resource.submittedAt, locale) })}</p>
                </ArrivalKitResourceCard>
              </li>
            ))}
          </ul>
        )}
      </ServicePager>
    </section>
  )
}

/** Proposer une ressource : la zone consultée et la date du jour par défaut, en son nom ou au nom d'une page qu'on signe. */
function ProposeSheet(props: {
  readonly kit: ArrivalKitCapability
  readonly standing: ArrivalKitStandingView
  readonly zone: ArrivalKitZoneView
  readonly openedAt: number
  readonly onClose: () => void
}) {
  const { t } = useDiasporaleT()
  const router = useRouter()
  const initial: ArrivalKitFormInitial = {
    title: "",
    summary: "",
    body: "",
    category: ARRIVAL_KIT_CATEGORIES[0],
    country: props.zone.country,
    city: props.zone.city ?? "",
    sourceName: "",
    sourceUrl: "",
    lastVerifiedAt: props.openedAt,
  }
  return (
    <Sheet open onOpenChange={(open) => { if (!open) props.onClose() }}>
      <SheetContent title={t("arrivalKit.propose.title")} description={t("arrivalKit.propose.description")} closeLabel={t("arrivalKit.actions.close")}>
        <ArrivalKitResourceForm
          mode="propose"
          initial={initial}
          carrierPages={props.standing.carrierPages}
          onCancel={props.onClose}
          onSave={async (input, options) => {
            const result = await props.kit.propose({ ...input, pageId: options.pageId, submit: options.submit })
            if (!result.ok) return result.code
            toast.success(t(options.submit ? "arrivalKit.feedback.proposedSubmitted" : "arrivalKit.feedback.proposedDraft"))
            props.onClose()
            router.push(routes.arrivalKitResource(result.value.resourceId))
            return null
          }}
        />
      </SheetContent>
    </Sheet>
  )
}

// ═══════════════════════════════════════════════════════════════
// /kit-arrivee/<id> — la fiche
// ═══════════════════════════════════════════════════════════════

function BackLink(props: { readonly href: string }) {
  const { t } = useDiasporaleT()
  return (
    <NextLink href={props.href} className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium text-primary hover:underline focus-visible:shadow-focus">
      <ArrowLeftIcon aria-hidden className="size-4" />
      {t("arrivalKit.detail.back")}
    </NextLink>
  )
}

function ResourceDetail(props: { readonly resourceId: string }) {
  const kit = useArrivalKit()
  const [attempt, setAttempt] = useState(0)
  if (kit === null) {
    return (
      <>
        <BackLink href={routes.arrivalKit()} />
        <ArrivalKitUnavailable />
      </>
    )
  }
  return <ResourceDetailBody key={attempt} kit={kit} resourceId={props.resourceId} onRetry={() => setAttempt((value) => value + 1)} />
}

function ResourceDetailBody(props: { readonly kit: ArrivalKitCapability; readonly resourceId: string; readonly onRetry: () => void }) {
  const { t } = useDiasporaleT()
  const router = useRouter()
  const loaded = props.kit.useResource(props.resourceId)
  if (loaded.status === "loading") return <Skeleton className="h-64 w-full rounded-xl" />
  if (loaded.status === "error") {
    return (
      <Card role="alert" className="flex flex-col items-start gap-3 p-4">
        <p>{t(errorKey(loaded.code))}</p>
        <Button variant="outline" onClick={props.onRetry}>{t("arrivalKit.detail.retry")}</Button>
      </Card>
    )
  }
  const resource = loaded.data
  if (resource === null) {
    return (
      <>
        <BackLink href={routes.arrivalKit()} />
        <EmptyState icon={<SearchXIcon />} title={t("arrivalKit.detail.unavailableTitle")} description={t("arrivalKit.detail.unavailableBody")} />
      </>
    )
  }
  const back = routes.arrivalKit(resource.country, resource.city ?? undefined)
  return <ResourceArticle kit={props.kit} resource={resource} back={back} onGone={() => router.push(back)} />
}

function ResourceArticle(props: { readonly kit: ArrivalKitCapability; readonly resource: ArrivalKitResourceDetailView; readonly back: string; readonly onGone: () => void }) {
  const { t, locale } = useDiasporaleT()
  const titleId = useId()
  const { resource } = props
  const listed = isArrivalKitListed(resource.status)
  // G9 : l'état de modération du moteur, que le fournisseur ne sert qu'à qui gère la ressource.
  const moderation = moderationBannerState(resource.moderation)
  const date = (at: number) => formatDate(at, locale)
  // G9 : signalée pour abus (geste des actions), la ressource est masquée pour la personne.
  const article = (
    <article aria-labelledby={titleId} className="flex min-w-0 flex-col gap-5">
      <BackLink href={props.back} />
      <header className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ArrivalKitCategoryChip category={resource.category} />
          <ArrivalKitStatusBadge status={resource.status} always />
          <ArrivalKitTrustChip official={resource.official} />
        </div>
        <h1 id={titleId} className="break-words font-display text-3xl font-bold">{resource.title}</h1>
        <p className="break-words text-[15px] leading-relaxed text-muted-foreground">{resource.summary}</p>
        <p className="text-[13px] text-muted-foreground">
          {resource.city !== null
            ? t("arrivalKit.detail.zoneCity", { city: resource.city, country: countryName(resource.country, locale) })
            : t("arrivalKit.detail.zoneCountry", { country: countryName(resource.country, locale) })}
        </p>
      </header>

      {moderation !== null ? <ModerationBanner state={moderation} /> : null}

      {resource.status === "needs_review" ? (
        <div role="note" className="flex min-w-0 gap-3 rounded-lg bg-[var(--warning-50)] px-3 py-3 text-[var(--warning-600)]">
          <TriangleAlertIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div className="flex min-w-0 flex-col gap-1 text-sm">
            <p className="font-semibold">{t("arrivalKit.detail.needsReviewTitle")}</p>
            <p>{t("arrivalKit.detail.needsReviewBody")}</p>
            {resource.reviewCause !== null ? <p>{t(`arrivalKit.reviewCause.${resource.reviewCause}`)}</p> : null}
          </div>
        </div>
      ) : null}

      {resource.viewer.canManage || resource.status === "submitted" || resource.status === "archived" ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">{t(`arrivalKit.statusNote.${resource.status}`)}</p>
      ) : null}
      {resource.statusReason !== null ? <p className="whitespace-pre-line break-words text-sm">{t("arrivalKit.detail.reason", { reason: resource.statusReason })}</p> : null}
      {resource.outdatedFlags !== null && resource.outdatedFlags > 0 ? (
        <p className="text-sm text-muted-foreground">{t("arrivalKit.card.flags", { count: resource.outdatedFlags })}</p>
      ) : null}

      <DetailSection title={t("arrivalKit.detail.content")}>
        <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{resource.body}</p>
      </DetailSection>

      <SourceSection source={resource.source} />

      <DetailSection title={t("arrivalKit.detail.dates")}>
        <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
          <DetailItem label={t("arrivalKit.detail.verifiedOn")}>{date(resource.lastVerifiedAt)}</DetailItem>
          <DetailItem label={t("arrivalKit.detail.reviewDue")}>{date(resource.reviewDueAt)}</DetailItem>
          <DetailItem label={t("arrivalKit.detail.revisedOn")}>{date(resource.revisedAt)}</DetailItem>
          <DetailItem label={t("arrivalKit.detail.reviewedOn")}>{resource.reviewedAt !== null && listed ? date(resource.reviewedAt) : t("arrivalKit.detail.notReviewed")}</DetailItem>
          <DetailItem label={t("arrivalKit.detail.createdOn")}>{date(resource.createdAt)}</DetailItem>
        </dl>
      </DetailSection>

      <DetailSection title={t("arrivalKit.detail.people")}>
        <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
          <DetailItem label={t("arrivalKit.detail.author")}><ArrivalKitCarrier carrier={resource.carrier} /></DetailItem>
          <DetailItem label={t("arrivalKit.detail.reviewer")}>
            {resource.reviewer !== null
              ? <ArrivalKitPersonName person={resource.reviewer} />
              : listed ? t("arrivalKit.detail.neutralPerson") : t("arrivalKit.detail.notReviewed")}
          </DetailItem>
        </dl>
        <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t(resource.official ? "arrivalKit.detail.officialNote" : "arrivalKit.detail.communityNote")}</p>
      </DetailSection>

      <ArrivalKitResourceActions kit={props.kit} resource={resource} onGone={props.onGone} />
    </article>
  )
  return (
    <ReportedContent target={{ kind: "diasporaKitResource", id: resource.id }} back={{ href: props.back, label: t("arrivalKit.detail.back") }}>
      {article}
    </ReportedContent>
  )
}

/**
 * La source citée : un lien EXTERNE sûr (https, nouvel onglet signalé, sans référent ni
 * accès à cette page), son adresse en clair ; une source de démonstration, ou sans
 * adresse, n'est jamais cliquable.
 */
function SourceSection(props: { readonly source: ArrivalKitResourceDetailView["source"] }) {
  const { t } = useDiasporaleT()
  const demo = useDataSource().kind === "demo"
  const url = !demo && isSafeExternalUrl(props.source.url) ? props.source.url : null
  return (
    <DetailSection title={t("arrivalKit.detail.source")}>
      {url !== null ? (
        <>
          <a href={url} target="_blank" rel="noopener noreferrer" className={`${kitLinkClass} inline-flex min-h-11 items-center gap-2 self-start`}>
            <span className="break-words">{props.source.name}</span>
            <ExternalLinkIcon aria-hidden className="size-4 shrink-0" />
            {" "}
            <span className="sr-only">{t("arrivalKit.detail.newTab")}</span>
          </a>
          <p className="break-all text-[13px] text-muted-foreground">{t("arrivalKit.detail.sourceAddress", { url })}</p>
        </>
      ) : (
        <>
          <p className="break-words font-semibold">{props.source.name}</p>
          <p className="text-[13px] text-muted-foreground">{t(demo ? "arrivalKit.detail.sourceDemo" : "arrivalKit.detail.sourceNoLink")}</p>
        </>
      )}
      <p className="text-[13px] text-muted-foreground">{t("arrivalKit.detail.sourceAdvice")}</p>
    </DetailSection>
  )
}

function DetailSection(props: { readonly title: string; readonly children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-2">
      <h2 id={id} className="text-lg font-semibold">{props.title}</h2>
      {props.children}
    </section>
  )
}

function DetailItem(props: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted px-3 py-2">
      <dt className="text-[13px] text-muted-foreground">{props.label}</dt>
      <dd className="break-words font-medium">{props.children}</dd>
    </div>
  )
}
