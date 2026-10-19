"use client"

import { EmptyState, FolderTabs, FolderTabsContent, FolderTabsList, FolderTabsTrigger, Skeleton } from "@diasporale/features"
import { useDataSource, type MembershipView, type PagePublicationsCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ImageIcon, VideoIcon } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, type ReactNode } from "react"

import { pageContentHref, pageContentTabOf, type PageContentContext, type PageContentTab } from "@/lib/page-content"

import { PageMediaPages } from "./feed-pages"
import { PageShareButton } from "./page-share-button"

interface PageContentViewsProps {
  handle: string
  readonly pageName?: string
  readonly context?: PageContentContext
  pageId: string
  membership: MembershipView
  now: number
  capability: PagePublicationsCapability | null | undefined
  children: ReactNode
  readonly reviews?: ReactNode
}

/** L'adresse doit être lue avant de monter la première liste. */
export function PageContentViews(props: PageContentViewsProps) {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
      <PageContentFromAddress {...props} />
    </Suspense>
  )
}

/** Le panneau actif garde seul ses lectures et ses lecteurs média montés. */
function PageContentFromAddress(props: PageContentViewsProps) {
  const source = useDataSource()
  const { t } = useDiasporaleT()
  const params = useSearchParams()
  const router = useRouter()
  const media = props.capability?.media
  const hasReviews = props.reviews !== undefined && props.reviews !== null
  const handle = props.handle.trim().replace(/^@/, "").toLowerCase()
  const values = params.getAll("contenu")
  const requested = values.length === 1 ? pageContentTabOf(values[0]) : "publications"
  const available = (tab: PageContentTab): boolean => tab === "avis" ? hasReviews : tab === "photos" || tab === "videos" ? Boolean(media) : true
  const active = available(requested) ? requested : "publications"
  const changeTab = (value: string) => {
    const next = pageContentTabOf(value)
    if (next === active || !available(next)) return
    router.push(pageContentHref(handle, next, params.toString(), props.context), { scroll: false })
  }
  if (!media && !hasReviews) return props.children
  const key = JSON.stringify([source.kind, props.membership.personId, props.pageId, handle, props.context ?? "page"])
  return (
    <FolderTabs key={key} value={active} onValueChange={changeTab} activationMode="manual" className="min-w-0">
      <FolderTabsList aria-label={t("pageMedia.contentLabel")} className="flex-wrap overflow-visible">
        <FolderTabsTrigger value="publications" className="min-h-11 flex-1 whitespace-normal px-3 text-center">
          {t("pageMedia.publications")}
        </FolderTabsTrigger>
        {media ? <>
          <FolderTabsTrigger value="photos" className="min-h-11 flex-1 whitespace-normal px-3 text-center">
            {t("pageMedia.photos")}
          </FolderTabsTrigger>
          <FolderTabsTrigger value="videos" className="min-h-11 flex-1 whitespace-normal px-3 text-center">
            {t("pageMedia.videos")}
          </FolderTabsTrigger>
        </> : null}
        {hasReviews ? <FolderTabsTrigger value="avis" className="min-h-11 flex-1 whitespace-normal px-3 text-center">
          {t("pageReviews.tab")}
        </FolderTabsTrigger> : null}
      </FolderTabsList>
      <div className="flex min-w-0 justify-end">
        <PageShareButton handle={handle} name={props.pageName ?? handle} content={active} />
      </div>
      <FolderTabsContent value="publications">{props.children}</FolderTabsContent>
      {media ? <FolderTabsContent value="photos">
        <PageMediaPages handle={handle} pageId={props.pageId} capability={media} kind="image" membership={props.membership} now={props.now}
          emptyFallback={<EmptyState icon={<ImageIcon />} title={t("pageMedia.emptyPhotosTitle")} description={t("pageMedia.emptyPhotosBody")} />} />
      </FolderTabsContent> : null}
      {media ? <FolderTabsContent value="videos">
        <PageMediaPages handle={handle} pageId={props.pageId} capability={media} kind="video" membership={props.membership} now={props.now}
          emptyFallback={<EmptyState icon={<VideoIcon />} title={t("pageMedia.emptyVideosTitle")} description={t("pageMedia.emptyVideosBody")} />} />
      </FolderTabsContent> : null}
      {hasReviews ? <FolderTabsContent value="avis">{props.reviews}</FolderTabsContent> : null}
    </FolderTabs>
  )
}
