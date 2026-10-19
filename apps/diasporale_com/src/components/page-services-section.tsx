"use client"

import { isServiceCategory, SERVICE_CATEGORIES, SERVICE_DELIVERY_FILTERS, type ServiceCategory, type ServiceDeliveryFilter } from "@diasporale/domain"
import { Button, Card, EmptyState, Field, Skeleton } from "@diasporale/features"
import { useDataSource, useServices, useSession, type ServiceOfferCardView, type ServicesCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { BriefcaseBusinessIcon } from "lucide-react"
import NextLink from "next/link"
import { useId, useState, type ReactNode } from "react"

import { routes } from "@/lib/routes"

import { ServiceCard } from "./service-card"
import { ServicePager } from "./service-pager"

const selectClass = "h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus aria-invalid:border-destructive"

/**
 * Les services proposés par une page, montés dans sa fiche (`PageDetail`).
 * PROPRIÉTAIRE : chantier « catalogue des services ». La fiche (chantier
 * « pages ») le monte ; les options restent facultatives.
 *
 * Discret : rien pendant le chargement, rien pour une page sans offre active
 * ou illisible (une institution, un média ne proposent pas de services) ; une
 * offre en pause, en brouillon ou retirée n'y paraît jamais. Les associations
 * et entreprises peuvent garder une section vide explicite avec `showEmpty`.
 */
export function PageServicesSection(props: {
  readonly pageId: string
  readonly pageHandle: string
  readonly canManage?: boolean
  readonly showEmpty?: boolean
}) {
  const { t } = useDiasporaleT()
  const source = useDataSource()
  const services = useServices()
  const session = useSession()
  if (services === null) return null
  const keepSection = props.showEmpty === true || props.canManage === true
  if (session.status === "loading") return keepSection ? <Skeleton className="h-32 w-full rounded-xl" /> : null
  if (session.status === "error") return keepSection ? <Card role="alert" className="p-4">{t(`errors.${session.code}`)}</Card> : null
  if (session.data.status !== "signed_in" || !session.data.membership) return null
  const personId = session.data.membership.personId
  const key = JSON.stringify([source.kind, personId, props.pageId, props.pageHandle, services.supportsPageOfferFilters === true])
  return <PageServicesList key={key} services={services} personId={personId} {...props} />
}

function PageServicesList(props: {
  readonly services: ServicesCapability
  readonly personId: string
  readonly pageHandle: string
  readonly canManage?: boolean
  readonly showEmpty?: boolean
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  const [category, setCategory] = useState<ServiceCategory | null>(null)
  const [delivery, setDelivery] = useState<ServiceDeliveryFilter | null>(null)
  const { services, pageHandle } = props
  const supportsFilters = services.supportsPageOfferFilters === true
  const filtered = supportsFilters && (category !== null || delivery !== null)
  const keepSection = props.showEmpty === true || props.canManage === true || filtered
  const reset = () => { setCategory(null); setDelivery(null) }
  const filters = supportsFilters ? (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("pageServiceFilters.lead")}</p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Field id={`${id}-category`} label={t("services.search.category")}>
          {(field) => (
            <select
              id={field.id}
              aria-describedby={field.describedBy}
              className={selectClass}
              value={category ?? ""}
              onChange={(event) => { const value = event.target.value; setCategory(isServiceCategory(value) ? value : null) }}
            >
              <option value="">{t("pageServiceFilters.allCategories")}</option>
              {SERVICE_CATEGORIES.map((value) => <option key={value} value={value}>{t(`services.category.${value}`)}</option>)}
            </select>
          )}
        </Field>
        <Field id={`${id}-delivery`} label={t("services.search.delivery")}>
          {(field) => (
            <select
              id={field.id}
              aria-describedby={field.describedBy}
              className={selectClass}
              value={delivery ?? ""}
              onChange={(event) => setDelivery(SERVICE_DELIVERY_FILTERS.find((value) => value === event.target.value) ?? null)}
            >
              <option value="">{t("services.deliveryFilter.any")}</option>
              {SERVICE_DELIVERY_FILTERS.map((value) => <option key={value} value={value}>{t(`services.deliveryFilter.${value}`)}</option>)}
            </select>
          )}
        </Field>
      </div>
      <Button variant="ghost" className="h-auto min-h-11 self-start whitespace-normal text-left" disabled={!filtered} onClick={reset}>{t("pageServiceFilters.reset")}</Button>
    </div>
  ) : null
  const pager = (
    <ServicePager
      key={JSON.stringify([supportsFilters ? category : null, supportsFilters ? delivery : null])}
      quiet={!keepSection}
      read={(cursor) => services.usePageOffers(supportsFilters ? {
        pageHandle,
        personId: props.personId,
        cursor,
        ...(category !== null ? { category } : {}),
        ...(delivery !== null ? { delivery } : {}),
      } : { pageHandle, cursor })}
      keyOf={(offer) => offer.id}
      empty={filtered ? (
        <EmptyState
          icon={<BriefcaseBusinessIcon />}
          title={t("pageServiceFilters.emptyTitle")}
          description={t("pageServiceFilters.emptyBody")}
          action={<Button variant="outline" className="h-auto min-h-11 whitespace-normal" onClick={reset}>{t("pageServiceFilters.reset")}</Button>}
        />
      ) : props.showEmpty ? (
        <EmptyState
          icon={<BriefcaseBusinessIcon />}
          title={t("pageServices.emptyTitle")}
          description={t("pageServices.emptyBody")}
        />
      ) : null}
    >
      {(offers) => keepSection ? <PageServicesGrid offers={offers} /> : (
        <PageServicesFrame pageHandle={pageHandle}>
          {filters}
          <PageServicesGrid offers={offers} />
        </PageServicesFrame>
      )}
    </ServicePager>
  )
  return keepSection ? (
    <PageServicesFrame pageHandle={pageHandle} canManage={props.canManage === true}>{filters}{pager}</PageServicesFrame>
  ) : pager
}

function PageServicesFrame(props: {
  readonly pageHandle: string
  readonly canManage?: boolean
  readonly children: ReactNode
}) {
  const { t } = useDiasporaleT()
  return (
    <section id="services-de-la-page" tabIndex={-1} aria-labelledby="services-de-la-page-title" className="flex min-w-0 scroll-mt-24 flex-col gap-3">
      <h2 id="services-de-la-page-title" className="break-words text-lg font-semibold">{t("pageServices.title")}</h2>
      {props.canManage ? (
        <div className="flex min-w-0 flex-wrap gap-3">
          <Button asChild variant="outline" className="h-auto min-h-11 max-w-full whitespace-normal text-center">
            <NextLink href={routes.pageManage(props.pageHandle, "services")}>{t("pageServices.manage")}</NextLink>
          </Button>
          <Button asChild variant="outline" className="h-auto min-h-11 max-w-full whitespace-normal text-center">
            <NextLink href={routes.pageManage(props.pageHandle, "demandes")}>{t("pageServices.inbox")}</NextLink>
          </Button>
        </div>
      ) : null}
      {props.children}
    </section>
  )
}

function PageServicesGrid(props: { readonly offers: readonly ServiceOfferCardView[] }) {
  return (
    <ul className="grid min-w-0 gap-3 sm:grid-cols-2">
      {props.offers.map((offer) => (
        <li key={offer.id} className="min-w-0"><ServiceCard offer={offer} showProvider={false} /></li>
      ))}
    </ul>
  )
}

/** Le contact de page conduit aux prestations réellement lisibles, sans ouvrir une conversation personnelle. */
export function PageServiceContactEntry(props: { readonly pageHandle: string }) {
  const services = useServices()
  if (services === null) return null
  return <PageServiceContactLink key={props.pageHandle} services={services} pageHandle={props.pageHandle} />
}

function PageServiceContactLink(props: { readonly services: ServicesCapability; readonly pageHandle: string }) {
  const { t } = useDiasporaleT()
  const offers = props.services.usePageOffers({ pageHandle: props.pageHandle, cursor: null })
  // Une fenêtre vide, même avec une suite, ne prouve aucune offre disponible.
  if (offers.status !== "ready" || offers.data.items.length === 0) return null
  return (
    <Button asChild className="h-auto min-h-11 max-w-full whitespace-normal text-center">
      <NextLink href={routes.pageServices(props.pageHandle)}>
        <BriefcaseBusinessIcon aria-hidden className="shrink-0" />
        {t("pageServices.request")}
      </NextLink>
    </Button>
  )
}
