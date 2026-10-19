"use client"

import { EmptyState, Skeleton } from "@diasporale/features"
import { useOptionalDataSource, type MembershipView, type PagesCapability, type PagePublicationsCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { NewspaperIcon, ShieldOffIcon } from "lucide-react"

import { PagePostPages } from "./feed-pages"
import { ErrorNotice, PageAdminUnavailable } from "./page-admin-parts"
import { PagePublishButton } from "./page-publications"
import { PageContentViews } from "./page-content-views"

/** Même mur et mêmes gestes que sur la fiche ; aucun second espace de publications. */
export function PagePublicationsPanel(props: { pageId: string; handle: string; membership: MembershipView }) {
  const source = useOptionalDataSource()
  if (!source?.pages || !source.pagePublications) return <PageAdminUnavailable />
  return <PublicationsRead key={`${props.membership.personId}:${props.pageId}`} {...props} pages={source.pages} publications={source.pagePublications} />
}

function PublicationsRead(props: { pageId: string; handle: string; membership: MembershipView; pages: PagesCapability; publications: PagePublicationsCapability }) {
  const { t } = useDiasporaleT()
  const query = props.pages.usePage(props.handle)
  if (query.status === "loading") return <div role="status"><span className="sr-only">{t("common.pleaseWait")}</span><Skeleton className="h-40 w-full rounded-xl" /></div>
  if (query.status === "error") return <ErrorNotice code={query.code} />
  if (query.data === null || query.data.page.id !== props.pageId) return <EmptyState icon={<NewspaperIcon />} title={t("page.unavailableTitle")} />
  const { page, viewer } = query.data
  if (viewer.role === null) return <EmptyState icon={<ShieldOffIcon />} title={t("pageAdmin.manage.notManager.title")} description={t("pageAdmin.manage.notManager.body")} />
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-labelledby="gestion-publications">
      <div>
        <h2 id="gestion-publications" className="font-display text-xl font-bold">{t("pagePostManagement.title")}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("pagePostManagement.lead")}</p>
      </div>
      <div className="flex flex-wrap gap-2"><PagePublishButton page={page} membership={props.membership} role={viewer.role} /></div>
      <PageContentViews handle={page.handle} pageName={page.name} pageId={page.id} context="manage" capability={props.publications} membership={props.membership} now={Date.now()}>
        <PagePostPages handle={page.handle} pageId={page.id} capability={props.publications} canRemove membership={props.membership} now={Date.now()}
          emptyFallback={<EmptyState icon={<NewspaperIcon />} title={t("page.noPosts")} />} />
      </PageContentViews>
    </section>
  )
}
