"use client"

/**
 * L'onglet « Emploi » du hub d'un pays (DG-025) : les offres OUVERTES des
 * entreprises et des associations de ce pays, page par page, puis la recherche
 * complète et mes candidatures. PROPRIÉTAIRE : chantier « talents et emploi » ;
 * le hub (chantier « pages ») le monte seulement quand le fournisseur sert la
 * capacité.
 */
import type { CountryCode } from "@diasporale/domain"
import { Button, EmptyState } from "@diasporale/features"
import type { JobsCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { BriefcaseBusinessIcon } from "lucide-react"
import NextLink from "next/link"

import { routes } from "@/lib/routes"

import { JobOfferCard } from "./job-parts"
import { ServicePager } from "./service-pager"

export function HubJobsTab(props: { readonly jobs: JobsCapability; readonly country: CountryCode; readonly countryLabel: string }) {
  const { t } = useDiasporaleT()
  const { jobs, country } = props
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t("jobs.hub.lead", { country: props.countryLabel })}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <NextLink href={routes.jobs(country)}>{t("jobs.hub.all", { country: props.countryLabel })}</NextLink>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <NextLink href={routes.myApplications()}>{t("jobs.hub.mine")}</NextLink>
          </Button>
        </div>
      </div>
      <ServicePager
        read={(cursor) => jobs.useSearch({ country, cursor })}
        keyOf={(offer) => offer.id}
        empty={<EmptyState icon={<BriefcaseBusinessIcon />} title={t("jobs.hub.emptyTitle", { country: props.countryLabel })} description={t("jobs.hub.emptyBody")} />}
      >
        {(offers) => (
          <ul aria-label={t("jobs.hub.listLabel", { country: props.countryLabel })} className="grid min-w-0 gap-3 sm:grid-cols-2">
            {offers.map((offer) => (
              <li key={offer.id} className="min-w-0"><JobOfferCard offer={offer} /></li>
            ))}
          </ul>
        )}
      </ServicePager>
    </div>
  )
}
