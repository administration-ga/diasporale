"use client"

import { Button, Card, residenceCountryOptions } from "@diasporale/features"
import type { PageView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowRightIcon, PencilIcon } from "lucide-react"
import NextLink from "next/link"
import { useId, useMemo } from "react"

import { routes } from "@/lib/routes"

/** Présentation déclarée de l’organisation, distincte de son badge de confiance. */
export function PageAbout(props: { readonly page: PageView; readonly canEdit: boolean; readonly canBrowseCategories?: boolean }) {
  const { t, locale } = useDiasporaleT()
  const titleId = useId()
  const countries = useMemo(() => residenceCountryOptions(locale), [locale])
  const { page } = props
  const country = countries.find((item) => item.code === page.country)?.name
  const association = page.ownerKind === "association"
  const category = association
    ? page.associationType ? t(`association.type.${page.associationType}`) : null
    : page.ownerKind === "company" && page.sector ? t(`company.sector.${page.sector}`) : null
  const missing = t("pagePresentation.about.notProvided")
  const similarPages = props.canBrowseCategories
    ? association && page.associationType
      ? routes.pages({ ownerKind: "association", associationType: page.associationType, ...(page.country ? { country: page.country } : {}) })
      : page.ownerKind === "company" && page.sector
        ? routes.pages({ ownerKind: "company", sector: page.sector, ...(page.country ? { country: page.country } : {}) })
        : null
    : null

  return (
    <section aria-labelledby={titleId} className="min-w-0">
      <Card className="flex min-w-0 flex-col gap-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-xl font-bold">{t("pagePresentation.about.title")}</h2>
          {props.canEdit ? (
            <Button asChild variant="outline" className="h-auto min-h-11 max-w-full whitespace-normal py-2 text-left">
              <NextLink href={routes.pageManage(page.handle, "identite")}>
                <PencilIcon aria-hidden />
                <span className="min-w-0 break-words">{t("pagePresentation.about.edit")}</span>
              </NextLink>
            </Button>
          ) : null}
        </div>
        {page.description ? (
          <p className="whitespace-pre-line break-words text-[15px] leading-relaxed [overflow-wrap:anywhere]">{page.description}</p>
        ) : <p className="text-sm text-muted-foreground">{t("pagePresentation.about.noDescription")}</p>}
        <dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="font-medium text-muted-foreground">{t("pagePresentation.about.country")}</dt>
            <dd className="mt-1 break-words">{country ?? missing}</dd>
          </div>
          <div className="min-w-0">
            <dt className="font-medium text-muted-foreground">{t("pagePresentation.fields.city")}</dt>
            <dd className="mt-1 break-words [overflow-wrap:anywhere]">{page.city || missing}</dd>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <dt className="font-medium text-muted-foreground">{t(association ? "pagePresentation.fields.associationType" : "pagePresentation.fields.sector")}</dt>
            <dd className="mt-1 break-words">{category ?? missing}</dd>
            {similarPages ? <dd className="mt-1">
              <NextLink href={similarPages} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-sm text-primary underline-offset-4 hover:underline focus-visible:shadow-focus">
                <span className="min-w-0 break-words">{t(association ? "pageDirectoryCategories.similarAssociations" : "pageDirectoryCategories.similarCompanies")}</span>
                <ArrowRightIcon aria-hidden className="size-4 shrink-0" />
              </NextLink>
            </dd> : null}
          </div>
        </dl>
      </Card>
    </section>
  )
}
