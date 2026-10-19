"use client"

import { parseResidenceCountry } from "@diasporale/domain"
import { Button, FolderTabsNav, type FolderNavItem } from "@diasporale/features"
import type { MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { FilePlus2Icon } from "lucide-react"
import NextLink from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

import { AppShell } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { PageDirectory, type PageDirectoryFilters } from "@/components/page-directory"
import { pageCategoryFiltersOf, routes } from "@/lib/routes"

/** Annuaire et abonnements sont lisibles sans mandat de gestion d'une page. */
export function PagesScreen() {
  return <Gate require="member">{(session) => session.membership ? <AppShell membership={session.membership}><PagesContent membership={session.membership} /></AppShell> : null}</Gate>
}

function PagesContent(props: { membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const router = useRouter()
  const params = useSearchParams()
  const followed = params.get("vue") === "suivies"
  const { ownerKind, associationType, sector } = pageCategoryFiltersOf({ ownerKind: params.get("type"), associationType: params.get("activite"), sector: params.get("secteur") })
  const country = parseResidenceCountry(params.get("pays"))
  const query = (params.get("q") ?? "").slice(0, 200)
  const persistFilters = useCallback((filters: PageDirectoryFilters) => {
    const href = routes.pages({
      ...(filters.query ? { q: filters.query } : {}),
      ...(filters.country ? { country: filters.country } : {}),
      ...(filters.ownerKind ? { ownerKind: filters.ownerKind } : {}),
      ...(filters.associationType ? { associationType: filters.associationType } : {}),
      ...(filters.sector ? { sector: filters.sector } : {}),
    })
    if (href !== window.location.pathname + window.location.search) router.replace(href, { scroll: false })
  }, [router])
  const tabs: FolderNavItem[] = [
    { id: "directory", label: t("pageBrowsing.browse"), href: routes.pages(), active: !followed },
    { id: "following", label: t("pageBrowsing.followedTitle"), href: routes.pages({ followed: true }), active: followed },
  ]
  return (
    <>
      <div className="flex min-w-0 flex-col gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{t("pageBrowsing.title")}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t("pageBrowsing.lead")}</p>
        </div>
        {props.membership.status === "verifiee" ? <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><NextLink href={routes.newPage("association")}><FilePlus2Icon aria-hidden />{t("pageAdmin.myPages.createAssociation")}</NextLink></Button>
          <Button asChild variant="outline"><NextLink href={routes.newPage("company")}><FilePlus2Icon aria-hidden />{t("pageAdmin.myPages.createCompany")}</NextLink></Button>
        </div> : null}
      </div>
      <FolderTabsNav label={t("pageBrowsing.views")} items={tabs}
        renderLink={(item, className, children) => <NextLink key={item.id} href={item.href} className={className} aria-current={item.active ? "page" : undefined} scroll={false}>{children}</NextLink>} />
      <PageDirectory key={`${props.membership.personId}:${followed ? "following" : "directory"}`}
        followedOnly={followed} query={query}
        {...(country.ok ? { country: country.value } : {})}
        {...(ownerKind ? { ownerKind } : {})}
        {...(associationType ? { associationType } : {})}
        {...(sector ? { sector } : {})}
        {...(!followed ? { onFiltersChange: persistFilters } : {})} />
    </>
  )
}
