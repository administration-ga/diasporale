"use client"

/**
 * Le catalogue des services de DIASPORALE (DG-011/012) — trois écrans :
 *
 *   · `/services` : chercher une prestation dans le réseau (texte, pays, ville
 *     saisie sans GPS, catégorie, présentiel ou distance, budget), résultats
 *     paginés, vide expliqué ; les filtres de l'adresse se partagent ;
 *   · `/services/<id>` : la fiche d'une offre — la page et son badge, la zone,
 *     le mode, les langues, la durée et le tarif ANNONCÉ, « aucun paiement sur
 *     DIASPORALE », puis la demande structurée ; une offre indisponible est un
 *     état neutre (inconnue, en pause ou retirée : la même réponse) ;
 *   · `/mon-activite` : les offres et les demandes des pages que je gère, et mes pages.
 *
 * Mise en relation seulement : aucun paiement, aucune note ni avis inventés,
 * aucune coordonnée ; le badge d'une page dit qui elle est, il ne garantit pas
 * la prestation. Aucun historique de recherche n'est gardé.
 */
import {
  CURRENCY_CODES,
  isServiceCategory,
  isServiceProviderOwnerKind,
  parseMajorAmount,
  parseResidenceCountry,
  SERVICE_CATEGORIES,
  SERVICE_CITY_MAX_LENGTH,
  SERVICE_DELIVERY_FILTERS,
  SERVICE_QUERY_MAX_LENGTH,
  type Money,
  type ServiceDeliveryFilter,
} from "@diasporale/domain"
import { Button, Card, EmptyState, Field, FolderTabsNav, Input, Skeleton, TrustBadge, countryName, formatDate, residenceCountryOptions } from "@diasporale/features"
import {
  usePageAdmin,
  useServices,
  type ManagedPageView,
  type MembershipView,
  type PageAdminCapability,
  type ServicesCapability,
  type ServiceSearchRequest,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { BriefcaseBusinessIcon, SearchXIcon, StoreIcon } from "lucide-react"
import NextLink from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useId, useMemo, useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { AppShell } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { JobRecruiterPanel } from "@/components/job-recruiter-panel"
import { MyPagesPanel } from "@/components/my-pages-panel"
import { PageServicesManager } from "@/components/page-services-manager"
import { ACTIVITY_TABS, parseActivityTab } from "@/components/service-activity"
import { ServiceCard } from "@/components/service-card"
import { formatServiceDuration, formatServicePrice, languageList, majorAmountInput } from "@/components/service-format"
import { ServiceInbox } from "@/components/service-inbox"
import { ServicePager } from "@/components/service-pager"
import { ServiceRequestEntry } from "@/components/service-request-entry"
import { ServiceOfferReviews } from "@/components/service-reviews-section"
import { routes, type ServiceSearchParams } from "@/lib/routes"

const selectClass = "h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus aria-invalid:border-destructive"

// ═══════════════════════════════════════════════════════════════
// Écrans
// ═══════════════════════════════════════════════════════════════

/** `/services` — le catalogue du réseau. */
export function ServicesScreen() {
  return (
    <Gate require="member">
      {(session) => (session.membership ? <AppShell membership={session.membership}><ServicesCatalog /></AppShell> : null)}
    </Gate>
  )
}

/** `/services/<id>` — la fiche d'une offre. */
export function ServiceOfferScreen(props: { readonly offerId: string }) {
  return (
    <Gate require="member">
      {(session) => (session.membership ? <AppShell membership={session.membership}><OfferDetail offerId={props.offerId} /></AppShell> : null)}
    </Gate>
  )
}

/** `/mon-activite` — les offres, les demandes et les pages de la personne qui propose. */
export function MyActivityScreen() {
  return (
    <Gate require="member">
      {(session) => (session.membership ? <AppShell membership={session.membership}><MyActivity membership={session.membership} /></AppShell> : null)}
    </Gate>
  )
}

function Unavailable(props: { readonly title: string; readonly body: string }) {
  return <EmptyState icon={<StoreIcon />} title={props.title} description={props.body} />
}

// ═══════════════════════════════════════════════════════════════
// /services — chercher
// ═══════════════════════════════════════════════════════════════

/** Les filtres portés par l'adresse ; une valeur illisible est ignorée, jamais devinée. */
export function filtersFromParams(params: Pick<URLSearchParams, "get">): ServiceSearchParams {
  const q = params.get("q")?.trim()
  const country = parseResidenceCountry(params.get("pays"))
  const city = params.get("ville")?.trim()
  const category = params.get("categorie") ?? ""
  const delivery = params.get("mode") ?? ""
  return {
    ...(q ? { q } : {}),
    ...(country.ok ? { country: country.value } : {}),
    ...(city ? { city } : {}),
    ...(isServiceCategory(category) ? { category } : {}),
    ...((SERVICE_DELIVERY_FILTERS as readonly string[]).includes(delivery) ? { delivery: delivery as ServiceDeliveryFilter } : {}),
  }
}

const searchSchema = z
  .object({
    q: z.string().trim().max(SERVICE_QUERY_MAX_LENGTH, "service_query_too_long"),
    country: z.string(),
    city: z.string().trim().max(SERVICE_CITY_MAX_LENGTH, "service_city_too_long"),
    category: z.string(),
    delivery: z.string(),
    budget: z.string(),
    currency: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.budget.trim().length === 0) return
    const money = parseMajorAmount(values.budget, values.currency)
    if (!money.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["budget"], message: money.code })
  })

type SearchValues = z.infer<typeof searchSchema>

function ServicesCatalog() {
  const { t } = useDiasporaleT()
  const services = useServices()
  const params = useSearchParams()
  const router = useRouter()
  const filters = useMemo(() => filtersFromParams(params), [params])
  // Le budget vit dans l'écran : l'adresse ne porte pas encore de montant (table des routes).
  const [budget, setBudget] = useState<Money | null>(null)
  const filtersKey = JSON.stringify(filters)

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">{t("services.catalog.title")}</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{t("services.catalog.lead")}</p>
        <p className="text-sm">
          <NextLink href={routes.myActivity("offres")} className="font-medium text-primary underline-offset-4 hover:underline">{t("services.catalog.offerYourServices")}</NextLink>
        </p>
      </header>
      {services === null ? (
        <Unavailable title={t("services.results.unavailableTitle")} body={t("services.results.unavailableBody")} />
      ) : (
        <>
          <SearchForm
            key={filtersKey}
            filters={filters}
            budget={budget}
            onSearch={(next, nextBudget) => {
              setBudget(nextBudget)
              router.replace(routes.services(next))
            }}
          />
          <CatalogResults key={JSON.stringify([filtersKey, budget])} services={services} filters={filters} budget={budget} />
        </>
      )}
    </>
  )
}

function SearchForm(props: { readonly filters: ServiceSearchParams; readonly budget: Money | null; readonly onSearch: (filters: ServiceSearchParams, budget: Money | null) => void }) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const countries = useMemo(() => residenceCountryOptions(locale), [locale])
  const form = useForm<SearchValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      q: props.filters.q ?? "",
      country: props.filters.country ?? "",
      city: props.filters.city ?? "",
      category: props.filters.category ?? "",
      delivery: props.filters.delivery ?? "",
      budget: props.budget ? majorAmountInput(props.budget.amountMinor, props.budget.currency) : "",
      currency: props.budget?.currency ?? "EUR",
    },
  })
  const error = (field: keyof SearchValues) => {
    const message = form.formState.errors[field]?.message
    return typeof message === "string" ? t(`errors.${message}`) : undefined
  }
  const submit = form.handleSubmit((values) => {
    const money = values.budget.trim().length > 0 ? parseMajorAmount(values.budget, values.currency) : null
    const country = parseResidenceCountry(values.country)
    const next: ServiceSearchParams = {
      ...(values.q ? { q: values.q } : {}),
      ...(country.ok ? { country: country.value } : {}),
      ...(values.city ? { city: values.city } : {}),
      ...(isServiceCategory(values.category) ? { category: values.category } : {}),
      ...((SERVICE_DELIVERY_FILTERS as readonly string[]).includes(values.delivery) ? { delivery: values.delivery as ServiceDeliveryFilter } : {}),
    }
    props.onSearch(next, money?.ok ? money.value : null)
  })
  const reset = () => props.onSearch({}, null)

  return (
    <Card className="p-4">
      <form noValidate role="search" aria-label={t("services.search.label")} className="flex min-w-0 flex-col gap-4" onSubmit={submit}>
        <Field id={`${id}-q`} label={t("services.search.query")} error={error("q")}>
          {(field) => <Input id={field.id} type="search" aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} placeholder={t("services.search.queryPlaceholder")} maxLength={SERVICE_QUERY_MAX_LENGTH} {...form.register("q")} />}
        </Field>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id={`${id}-city`} label={t("services.search.city")} hint={t("services.search.cityHint")} error={error("city")}>
            {(field) => <Input id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} autoComplete="address-level2" maxLength={SERVICE_CITY_MAX_LENGTH} {...form.register("city")} />}
          </Field>
          <Field id={`${id}-country`} label={t("services.search.country")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} className={selectClass} {...form.register("country")}>
                <option value="">{t("services.search.anyCountry")}</option>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>{country.name}</option>
                ))}
              </select>
            )}
          </Field>
          <Field id={`${id}-category`} label={t("services.search.category")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} className={selectClass} {...form.register("category")}>
                <option value="">{t("services.search.anyCategory")}</option>
                {SERVICE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{t(`services.category.${category}`)}</option>
                ))}
              </select>
            )}
          </Field>
          <fieldset className="flex min-w-0 flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">{t("services.search.delivery")}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {(["", ...SERVICE_DELIVERY_FILTERS] as const).map((delivery) => (
                <label key={delivery || "any"} className="inline-flex min-h-11 items-center gap-2 text-sm">
                  <input type="radio" value={delivery} className="size-5 accent-primary" {...form.register("delivery")} />
                  {t(`services.deliveryFilter.${delivery || "any"}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <Field id={`${id}-budget`} label={t("services.search.budget")} hint={t("services.search.budgetHint")} error={error("budget")}>
            {(field) => <Input id={field.id} aria-describedby={field.describedBy} aria-invalid={field.invalid || undefined} inputMode="decimal" {...form.register("budget")} />}
          </Field>
          <Field id={`${id}-currency`} label={t("services.search.currency")}>
            {(field) => (
              <select id={field.id} aria-describedby={field.describedBy} className={selectClass} {...form.register("currency")}>
                {CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{t("services.search.submit")}</Button>
          <Button type="button" variant="ghost" onClick={reset}>{t("services.search.reset")}</Button>
        </div>
      </form>
    </Card>
  )
}

function CatalogResults(props: { readonly services: ServicesCapability; readonly filters: ServiceSearchParams; readonly budget: Money | null }) {
  const { t } = useDiasporaleT()
  const { services, filters, budget } = props
  const request: Omit<ServiceSearchRequest, "cursor"> = {
    ...(filters.q ? { query: filters.q } : {}),
    ...(filters.country ? { country: filters.country } : {}),
    ...(filters.city ? { city: filters.city } : {}),
    ...(filters.category && isServiceCategory(filters.category) ? { category: filters.category } : {}),
    ...(filters.delivery ? { delivery: filters.delivery } : {}),
    ...(budget ? { budget } : {}),
  }
  const narrowed = Boolean(filters.city || filters.country || filters.delivery || filters.category || filters.q)
  return (
    <section aria-labelledby="resultats-services" className="flex flex-col gap-3">
      <h2 id="resultats-services" className="text-lg font-semibold">{t("services.results.title")}</h2>
      {budget ? <p className="text-[13px] text-muted-foreground">{t("services.results.budgetRule")}</p> : null}
      <ServicePager
        read={(cursor) => services.useSearch({ ...request, cursor })}
        keyOf={(offer) => offer.id}
        empty={
          <EmptyState
            icon={<SearchXIcon />}
            title={t("services.results.emptyTitle")}
            description={
              <>
                {t("services.results.emptyBody")}
                {narrowed ? <> {t("services.results.emptyFilters")}</> : null}
                {budget ? <> {t("services.results.emptyBudget")}</> : null}
              </>
            }
          />
        }
      >
        {(offers) => (
          <ul aria-label={t("services.results.label")} className="grid min-w-0 gap-3 sm:grid-cols-2">
            {offers.map((offer) => (
              <li key={offer.id} className="min-w-0"><ServiceCard offer={offer} /></li>
            ))}
          </ul>
        )}
      </ServicePager>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════
// /services/<id> — la fiche
// ═══════════════════════════════════════════════════════════════

function OfferDetail(props: { readonly offerId: string }) {
  const { t } = useDiasporaleT()
  const services = useServices()
  const [attempt, setAttempt] = useState(0)
  return (
    <>
      <NextLink href={routes.services()} className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline">{t("services.offer.back")}</NextLink>
      {services === null ? (
        <Unavailable title={t("services.results.unavailableTitle")} body={t("services.results.unavailableBody")} />
      ) : (
        <OfferDetailBody key={attempt} services={services} offerId={props.offerId} onRetry={() => setAttempt((value) => value + 1)} />
      )}
    </>
  )
}

const STATUS_NOTES = { draft: "services.offer.statusNote.draft", paused: "services.offer.statusNote.paused", withdrawn: "services.offer.statusNote.withdrawn" } as const

function OfferDetailBody(props: { readonly services: ServicesCapability; readonly offerId: string; readonly onRetry: () => void }) {
  const { t, locale } = useDiasporaleT()
  const loaded = props.services.useOffer(props.offerId)
  if (loaded.status === "loading") return <Skeleton className="h-64 w-full rounded-xl" />
  if (loaded.status === "error") {
    return (
      <Card role="alert" className="flex flex-col items-start gap-3 p-4">
        <p>{t(`errors.${loaded.code}`)}</p>
        <Button variant="outline" onClick={props.onRetry}>{t("services.results.retry")}</Button>
      </Card>
    )
  }
  const offer = loaded.data
  if (offer === null) {
    return (
      <EmptyState
        icon={<SearchXIcon />}
        title={t("services.offer.unavailableTitle")}
        description={t("services.offer.unavailableBody")}
        action={<Button asChild variant="outline"><NextLink href={routes.services()}>{t("services.offer.back")}</NextLink></Button>}
      />
    )
  }
  const statusNote = offer.status === "active" ? null : STATUS_NOTES[offer.status]
  return (
    <article className="flex min-w-0 flex-col gap-4" aria-labelledby="fiche-offre">
      <header className="flex min-w-0 flex-col gap-2">
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          <span className="rounded-[var(--radius-xs)] bg-[var(--esp-neutral-chip)] px-2 py-0.5 font-medium text-foreground">{t(`services.category.${offer.category}`)}</span>
          {offer.viewerCanManage ? <span className="font-medium text-foreground">{t(`services.status.${offer.status}`)}</span> : null}
        </p>
        <h1 id="fiche-offre" className="break-words font-display text-3xl font-bold">{offer.title}</h1>
      </header>

      <Card className="flex min-w-0 flex-col gap-2 p-4">
        <p className="text-[13px] font-medium text-muted-foreground">{t("services.offer.provider")}</p>
        <p className="flex min-w-0 flex-wrap items-center gap-2">
          <NextLink href={routes.page(offer.provider.handle)} className="min-w-0 break-words font-semibold hover:underline">{offer.provider.name}</NextLink>
          <TrustBadge badge={offer.provider.badge} />
        </p>
        <p className="text-[13px] text-muted-foreground">{t("services.offer.badgeNote")}</p>
      </Card>

      <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Detail label={t("services.offer.zone")}>{t("services.card.zone", { city: offer.city, country: countryName(offer.country, locale) })}</Detail>
        <Detail label={t("services.offer.delivery")}>{t(`services.delivery.${offer.delivery}`)}</Detail>
        <Detail label={t("services.offer.languages")}>{languageList(offer.languages, locale)}</Detail>
        <Detail label={t("services.offer.duration")}>{offer.durationMinutes === null ? t("services.offer.durationUnknown") : formatServiceDuration(offer.durationMinutes, t)}</Detail>
        <Detail label={t("services.offer.price")}>{formatServicePrice(offer.pricing, locale, t)}</Detail>
        <Detail label={t("services.offer.updated")}>{formatDate(offer.updatedAt, locale)}</Detail>
      </dl>

      <section aria-labelledby="description-offre" className="flex min-w-0 flex-col gap-2">
        <h2 id="description-offre" className="text-lg font-semibold">{t("services.offer.description")}</h2>
        <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{offer.description}</p>
      </section>

      <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("services.offer.noPayment")}</p>

      {offer.viewerCanManage ? (
        <Card className="flex flex-col items-start gap-2 p-4">
          <p className="text-sm">{t("services.offer.manageNote")}</p>
          {statusNote ? <p className="text-sm text-muted-foreground">{t(statusNote)}</p> : null}
          <Button asChild variant="outline" size="sm"><NextLink href={routes.pageManage(offer.provider.handle, "services")}>{t("services.offer.manage")}</NextLink></Button>
        </Card>
      ) : null}

      {offer.status === "active" && !offer.viewerCanManage ? (
        <ServiceRequestEntry offerId={offer.id} offerVersion={offer.version} offerTitle={offer.title} pageName={offer.provider.name} />
      ) : null}
      {offer.status === "active" ? <ServiceOfferReviews key={offer.id} offerId={offer.id} /> : null}
    </article>
  )
}

function Detail(props: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted px-3 py-2">
      <dt className="text-[13px] text-muted-foreground">{props.label}</dt>
      <dd className="break-words font-medium">{props.children}</dd>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// /mon-activite
// ═══════════════════════════════════════════════════════════════

function MyActivity(props: { readonly membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const params = useSearchParams()
  const tab = parseActivityTab(params.get("onglet"))
  const pageAdmin = usePageAdmin()
  const services = useServices()
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">{t("services.activity.title")}</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{t("services.activity.lead")}</p>
      </header>
      <FolderTabsNav
        label={t("services.activity.tabsLabel")}
        items={ACTIVITY_TABS.map((item) => ({ id: item, label: t(`services.activity.tab.${item}`), href: routes.myActivity(item), active: item === tab }))}
        renderLink={(item, className, children) => (
          <NextLink key={item.id} href={item.href} className={className} aria-current={item.active ? "page" : undefined}>{children}</NextLink>
        )}
      />
      {tab === "pages" ? (
        <MyPagesPanel />
      ) : pageAdmin === null ? (
        <Unavailable title={t("services.activity.unavailableTitle")} body={t("services.activity.unavailableBody")} />
      ) : (
        <ProviderPagePicker pageAdmin={pageAdmin}>
          {(page) =>
            tab === "demandes" ? (
              <ServiceInbox pageId={page.id} pageHandle={page.handle} />
            ) : tab === "emplois" ? (
              <JobRecruiterPanel key={page.id} pageId={page.id} pageHandle={page.handle} />
            ) : services === null ? (
              <Unavailable title={t("services.results.unavailableTitle")} body={t("services.results.unavailableBody")} />
            ) : (
              <PageServicesManager key={page.id} services={services} page={page} membership={props.membership} />
            )
          }
        </ProviderPagePicker>
      )}
    </>
  )
}

/** Les pages au nom desquelles je peux proposer des services (entreprise, association ; rôle vivant). */
function ProviderPagePicker(props: { readonly pageAdmin: PageAdminCapability; readonly children: (page: ManagedPageView) => ReactNode }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const pages = props.pageAdmin.useMyPages()
  const [selected, setSelected] = useState<string | null>(null)
  if (pages.status === "loading") return <Skeleton className="h-24 w-full rounded-xl" />
  if (pages.status === "error") return <Card role="alert" className="p-4"><p>{t(`errors.${pages.code}`)}</p></Card>
  const providers = pages.data.filter((page) => isServiceProviderOwnerKind(page.ownerKind))
  if (providers.length === 0) {
    return (
      <EmptyState
        icon={<BriefcaseBusinessIcon />}
        title={t("services.activity.noPagesTitle")}
        description={t("services.activity.noPagesBody")}
        action={<Button asChild variant="outline"><NextLink href={routes.myActivity("pages")}>{t("services.activity.goToPages")}</NextLink></Button>}
      />
    )
  }
  const current = providers.find((page) => page.id === selected) ?? providers[0]!
  return (
    <>
      {providers.length > 1 ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={`${id}-page`} className="text-sm font-medium">{t("services.activity.pagePicker")}</label>
          <select id={`${id}-page`} className={selectClass} value={current.id} onChange={(event) => setSelected(event.target.value)}>
            {providers.map((page) => (
              <option key={page.id} value={page.id}>{page.name}</option>
            ))}
          </select>
        </div>
      ) : null}
      {props.children(current)}
    </>
  )
}
