"use client"

import { ArrowRightIcon, FlagIcon } from "lucide-react"
import type { ReactNode } from "react"

import type { PageView } from "../../data/types"
import { useDiasporaleT } from "../../i18n/client"
import { cn } from "../../lib/cn"
import { Avatar, Card } from "../../primitives/surface"
import { useRouting } from "../../routing"
import { CountryTag } from "../country-tag"
import { TrustBadge } from "../trust-badge"

function PageCardFrame(props: { page: PageView; kindLabel: ReactNode; className?: string }) {
  const { t } = useDiasporaleT()
  const { routes, Link } = useRouting()
  const { page } = props
  return (
    <Card className={cn("animate-rise flex flex-col gap-3 p-4", props.className)}>
      <div className="flex items-start gap-3">
        <Avatar id={page.id} name={page.name} shape={page.ownerKind === "association" ? "round" : "square"} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug text-foreground">{page.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-[var(--radius-xs)] bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {props.kindLabel}
            </span>
            {page.badge !== "community" ? <TrustBadge badge={page.badge} /> : null}
          </div>
        </div>
      </div>
      <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{page.description}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        {page.country ? <CountryTag country={page.country} city={page.city ?? undefined} /> : <span />}
        <div className="flex items-center gap-3">
          {page.claimable ? (
            <span className="inline-flex items-center gap-1 text-[13px] text-muted-foreground">
              <FlagIcon className="size-3.5" aria-hidden />
              {t("page.claimable")}
            </span>
          ) : null}
          <Link
            href={routes.page(page.handle)}
            className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-semibold text-primary hover:bg-muted focus-visible:shadow-focus"
          >
            {t("page.see")}
            <span className="sr-only">{page.name}</span>
            <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </Card>
  )
}

/** Association (C2) — badge Vérifié si la revendication est validée ; « revendicable » sinon. */
export function AssociationCard(props: { page: PageView; className?: string }) {
  const { t } = useDiasporaleT()
  const kindLabel = props.page.associationType ? t(`association.type.${props.page.associationType}`) : t("page.kind.association")
  return <PageCardFrame page={props.page} kindLabel={kindLabel} className={props.className} />
}

/** Entreprise (C3) — badge Vérifié si la vérification (registre, mandat) est validée. */
export function CompanyCard(props: { page: PageView; className?: string }) {
  const { t } = useDiasporaleT()
  const kindLabel = props.page.sector ? t(`company.sector.${props.page.sector}`) : t("page.kind.company")
  return <PageCardFrame page={props.page} kindLabel={kindLabel} className={props.className} />
}

/** Page d'institution « Officiel » — le tampon d'encre, toujours. */
export function OfficialPageCard(props: { page: PageView; className?: string }) {
  const { t } = useDiasporaleT()
  return <PageCardFrame page={props.page} kindLabel={t("page.kind.institution")} className={props.className} />
}
