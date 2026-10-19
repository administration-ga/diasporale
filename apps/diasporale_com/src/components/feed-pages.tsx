"use client"

import {
  appendPage,
  feedCursorKey,
  initialFeedPages,
  rebasePagesAfter,
  recordTail,
  shouldShowLoadMore,
  type FeedPagesState,
} from "@antsia/social-features/features/reseau-personnel/reseau-feed-pages"
import type { CountryCode, FeedScope } from "@diasporale/domain"
import { Button, Card, PostCard, PostMediaGrid, RoutingProvider, Skeleton, formatDate, useRouting } from "@diasporale/features"
import {
  ACCESS_REFUSAL_CODES,
  useActions,
  useDataSource,
  useFeedPage,
  useProfilePostsPage,
  type ActionErrorCode,
  type FeedCursorView,
  type FeedPageQuery,
  type MembershipView,
  type PageMediaCapability,
  type PageMediaKind,
  type PagePinningCapability,
  type PagePublicationsCapability,
  type PostView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { PagePostRemoveButton } from "./page-publications"
import { PagePostEditButton } from "./page-post-editor"
import { PagePostPinButton } from "./page-post-pin"

interface PostPagesProps {
  readonly membership: MembershipView
  readonly now: number
  readonly emptyFallback: ReactNode
}

export interface FeedPagesProps extends PostPagesProps {
  readonly scope: FeedScope
  readonly hubCountry?: CountryCode
  readonly tag?: string
}

export interface ProfilePostPagesProps extends PostPagesProps {
  readonly handle: string
}

interface PagePinContext {
  readonly capability: PagePinningCapability
  readonly pinnedPostId: string | null
  readonly ready: boolean
}

type PostPagesSource =
  | { readonly kind: "feed"; readonly scope: FeedScope; readonly hubCountry?: CountryCode; readonly tag?: string }
  | { readonly kind: "profile"; readonly handle: string }
  | { readonly kind: "page"; readonly handle: string; readonly pageId: string; readonly canRemove: boolean; readonly capability: PagePublicationsCapability; readonly pinContext?: PagePinContext }
  | { readonly kind: "page-media"; readonly handle: string; readonly pageId: string; readonly mediaKind: PageMediaKind; readonly capability: PageMediaCapability }

type PagePostSource = Extract<PostPagesSource, { kind: "page" }>
type PageMediaSource = Extract<PostPagesSource, { kind: "page-media" }>
type PagePostPagesProps = PostPagesProps & { handle: string; pageId: string; canRemove: boolean; capability: PagePublicationsCapability }
type PageMediaPagesProps = PostPagesProps & { handle: string; pageId: string; kind: PageMediaKind; capability: PageMediaCapability }

interface PageMediaWindow extends PageMediaSource {
  readonly recordedPostIds: readonly string[] | undefined
  readonly excludedPostIds: ReadonlySet<string>
}

interface PageReport {
  readonly hasData: boolean
  readonly count: number
  readonly nextCursor: FeedCursorView | null
  readonly isLoading: boolean
  readonly error: ActionErrorCode | null
  /** Uniquement la galerie : les fenêtres gardent leur ordre et leurs curseurs bruts. */
  readonly mediaPostIds?: readonly string[]
}

interface ChainState {
  readonly pages: FeedPagesState<FeedCursorView>
  readonly reports: Readonly<Record<string, PageReport>>
  readonly requestedKey: string | null
  readonly announcement: number | null
}

/** Le changement de lecteur ou de portée démonte tous les anciens abonnements. */
export function FeedPages(props: FeedPagesProps) {
  const source = useDataSource()
  const routing = useRouting()
  const country = props.hubCountry ?? props.membership.facet.countryOfResidence
  const tag = props.tag?.trim().toLowerCase() || undefined
  const key = JSON.stringify([source.kind, props.membership.personId, "feed", props.scope, country, tag ?? null])
  const scopedRoutes = useMemo(() => ({
    ...routing.routes,
    feed: (nextTag?: string, context?: Parameters<typeof routing.routes.feed>[1]) => routing.routes.feed(nextTag, context ?? {
      scope: props.scope,
      ...(props.hubCountry === undefined ? {} : { country: props.hubCountry }),
    }),
  }), [routing.routes, props.scope, props.hubCountry])
  return (
    <RoutingProvider routes={scopedRoutes} Link={routing.Link}>
      <PostPagesChain key={key} {...props} source={{ kind: "feed", scope: props.scope, ...(props.hubCountry === undefined ? {} : { hubCountry: props.hubCountry }), ...(tag === undefined ? {} : { tag }) }} />
    </RoutingProvider>
  )
}

/** Le mur reprend la même chaîne ; son identité suit aussi le profil consulté. */
export function ProfilePostPages(props: ProfilePostPagesProps) {
  const source = useDataSource()
  const handle = props.handle.trim().replace(/^@/, "").toLowerCase()
  const key = JSON.stringify([source.kind, props.membership.personId, "profile", handle])
  return <PostPagesChain key={key} {...props} source={{ kind: "profile", handle }} />
}

/** Le mur de la page reprend les mêmes fenêtres réactives et la même reprise. */
export function PagePostPages(props: PagePostPagesProps) {
  const source = useDataSource()
  const handle = props.handle.trim().replace(/^@/, "").toLowerCase()
  const key = JSON.stringify([source.kind, props.membership.personId, "page", props.pageId, handle])
  return props.capability.pinning ? (
    <PinnedPagePostPages key={key} {...props} handle={handle} pinning={props.capability.pinning} />
  ) : <PostPagesChain key={key} {...props} source={{ kind: "page", handle, pageId: props.pageId, canRemove: props.canRemove, capability: props.capability }} />
}

/** Une portée média ou un autre lecteur repart toujours de la première fenêtre. */
export function PageMediaPages(props: PageMediaPagesProps) {
  const source = useDataSource()
  const handle = props.handle.trim().replace(/^@/, "").toLowerCase()
  const key = JSON.stringify([source.kind, props.membership.personId, "page-media", props.pageId, handle, props.kind])
  return <PostPagesChain key={key} {...props} source={{ kind: "page-media", handle, pageId: props.pageId, mediaKind: props.kind, capability: props.capability }} />
}

function samePostIds(left: readonly string[] | undefined, right: readonly string[] | undefined) {
  return left === right || (left !== undefined && right !== undefined && left.length === right.length && left.every((id, index) => id === right[index]))
}

/** Une seule lecture de l'épingle, distincte des fenêtres et de leurs curseurs. */
function PinnedPagePostPages(props: PagePostPagesProps & { pinning: PagePinningCapability }) {
  const { t } = useDiasporaleT()
  const pinned = props.pinning.usePinned({ handle: props.handle, personId: props.membership.personId })
  const ready = !pinned.isLoading && pinned.error === null && pinned.data !== undefined
  // Une erreur ou une relecture ne conserve jamais la carte d'une ancienne lecture.
  const post = ready ? pinned.data : null
  const pageSource: PagePostSource = {
    kind: "page",
    handle: props.handle,
    pageId: props.pageId,
    canRemove: props.canRemove,
    capability: props.capability,
    pinContext: { capability: props.pinning, pinnedPostId: post?.id ?? null, ready },
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {pinned.error !== null ? (
        <Card role="alert" className="flex min-w-0 flex-col items-start gap-3 p-4">
          <div>
            <h2 className="font-semibold">{t("pagePinning.errorTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("pagePinning.errorBody")}</p>
          </div>
          <Button variant="outline" onClick={pinned.retry} disabled={pinned.isLoading} className="h-auto min-h-11 whitespace-normal py-2 focus-visible:shadow-focus">
            {t("pagePinning.retry")}
          </Button>
        </Card>
      ) : !ready ? (
        <div role="status" aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">{t("pagePinning.loading")}</span>
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : post ? (
        <section aria-label={t("pagePinning.section")} className="flex min-w-0 flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{t("pagePinning.section")}</h2>
          <PostEntry post={post} membership={props.membership} now={props.now} pageSource={pageSource} />
        </section>
      ) : null}
      <PostPagesChain {...props} source={pageSource} />
    </div>
  )
}

function PostPagesChain(props: PostPagesProps & { source: PostPagesSource }) {
  const { t } = useDiasporaleT()
  const [chain, setChain] = useState<ChainState>(() => ({
    pages: initialFeedPages<FeedCursorView>(),
    reports: {},
    requestedKey: null,
    announcement: null,
  }))

  const reportPage = useCallback((index: number, key: string, wasTail: boolean, report: PageReport) => {
    setChain((current) => {
      if (index >= current.pages.cursors.length || feedCursorKey(current.pages.cursors[index] ?? null) !== key) return current
      const isTail = index === current.pages.cursors.length - 1
      // Un effet d'une ancienne page terminale ne décide jamais de la nouvelle fin.
      if (wasTail !== isTail) return current

      const settled = report.hasData && !report.isLoading && report.error === null
      const pages = !settled
        ? current.pages
        : isTail
          ? recordTail(current.pages, report.nextCursor)
          : rebasePagesAfter(current.pages, index, report.nextCursor)
      const previous = current.reports[key]
      const unchanged = previous !== undefined
        && previous.hasData === report.hasData
        && previous.count === report.count
        && previous.isLoading === report.isLoading
        && previous.error === report.error
        && feedCursorKey(previous.nextCursor) === feedCursorKey(report.nextCursor)
        && samePostIds(previous.mediaPostIds, report.mediaPostIds)
      const requestedStillMounted = current.requestedKey !== null && pages.cursors.some((cursor) => feedCursorKey(cursor) === current.requestedKey)
      const requestedKey = requestedStillMounted ? current.requestedKey : null
      const announce = requestedKey === key && settled
      if (pages === current.pages && unchanged && !announce) return current

      const reports: Record<string, PageReport> = {}
      for (const cursor of pages.cursors) {
        const mountedKey = feedCursorKey(cursor)
        const mountedReport = mountedKey === key ? report : current.reports[mountedKey]
        if (mountedReport !== undefined) reports[mountedKey] = mountedReport
      }
      return {
        pages,
        reports,
        requestedKey: announce ? null : requestedKey,
        announcement: announce ? report.count : current.announcement,
      }
    })
  }, [])

  const lastIndex = chain.pages.cursors.length - 1
  const tailKey = feedCursorKey(chain.pages.cursors[lastIndex] ?? null)
  const tail = chain.reports[tailKey]
  const showMore = tail !== undefined && tail.hasData && !tail.isLoading && tail.error === null
    && shouldShowLoadMore(chain.pages, tail.nextCursor)
  const loadingMore = chain.requestedKey === tailKey && (tail === undefined || (tail.isLoading && tail.error === null))
  const empty = chain.pages.exhausted && chain.pages.cursors.every((cursor) => {
    const report = chain.reports[feedCursorKey(cursor)]
    return report !== undefined && report.hasData && !report.isLoading && report.error === null && report.count === 0
  })

  const loadMore = () => {
    setChain((current) => {
      const currentTail = current.reports[feedCursorKey(current.pages.cursors[current.pages.cursors.length - 1] ?? null)]
      if (!currentTail || currentTail.isLoading || currentTail.error !== null || !shouldShowLoadMore(current.pages, currentTail.nextCursor)) return current
      const pages = appendPage(current.pages, currentTail.nextCursor)
      if (pages === current.pages) return current
      return { ...current, pages, requestedKey: feedCursorKey(currentTail.nextCursor), announcement: null }
    })
  }

  const earlierMediaPostIds = new Set<string>()
  return (
    <div className="flex flex-col gap-4">
      {chain.pages.cursors.map((cursor, index) => {
        const pageProps: SubscribedPageProps = {
          membership: props.membership,
          now: props.now,
          cursor,
          pageIndex: index,
          isTail: index === lastIndex,
          onReport: reportPage,
        }
        if (props.source.kind === "page-media") {
          const recordedPostIds = chain.reports[feedCursorKey(cursor)]?.mediaPostIds
          const mediaSource: PageMediaWindow = { ...props.source, recordedPostIds, excludedPostIds: new Set(earlierMediaPostIds) }
          for (const id of recordedPostIds ?? []) earlierMediaPostIds.add(id)
          return <SubscribedPageMediaPage key={feedCursorKey(cursor)} {...pageProps} source={mediaSource} />
        }
        return props.source.kind === "feed" ? (
          <SubscribedFeedPage
            key={feedCursorKey(cursor)}
            {...pageProps}
            scope={props.source.scope}
            {...(props.source.hubCountry === undefined ? {} : { hubCountry: props.source.hubCountry })}
            {...(props.source.tag === undefined ? {} : { tag: props.source.tag })}
          />
        ) : props.source.kind === "profile" ? <SubscribedProfilePostPage key={feedCursorKey(cursor)} {...pageProps} handle={props.source.handle} />
          : <SubscribedPagePostPage key={feedCursorKey(cursor)} {...pageProps} source={props.source} />
      })}
      {empty && !(props.source.kind === "page" && props.source.pinContext?.ready && props.source.pinContext.pinnedPostId !== null) ? props.emptyFallback : null}
      {showMore || loadingMore ? (
        <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="self-center focus-visible:shadow-focus">
          {t(loadingMore ? "feed.pagination.loading" : "feed.pagination.loadMore")}
        </Button>
      ) : null}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {chain.announcement === null ? null : chain.announcement > 0 ? t("feed.pagination.added", { count: chain.announcement }) : t("feed.pagination.noneAdded")}
      </p>
    </div>
  )
}

interface SubscribedPageProps {
  readonly membership: MembershipView
  readonly now: number
  readonly hubCountry?: CountryCode
  readonly cursor: FeedCursorView | null
  readonly pageIndex: number
  readonly isTail: boolean
  readonly onReport: (index: number, key: string, wasTail: boolean, report: PageReport) => void
}

/** Un composant par lecture : changer de source ne change jamais l'ordre des hooks. */
function SubscribedFeedPage(props: SubscribedPageProps & { scope: FeedScope; tag?: string }) {
  const page = useFeedPage({ scope: props.scope, ...(props.hubCountry === undefined ? {} : { hubCountry: props.hubCountry }), ...(props.tag === undefined ? {} : { tag: props.tag }), cursor: props.cursor })
  return <SubscribedPostPage {...props} page={page} />
}

function SubscribedProfilePostPage(props: SubscribedPageProps & { handle: string }) {
  const page = useProfilePostsPage({ handle: props.handle, cursor: props.cursor })
  return <SubscribedPostPage {...props} page={page} />
}

function SubscribedPagePostPage(props: SubscribedPageProps & { source: PagePostSource }) {
  const page = props.source.capability.useWall({ handle: props.source.handle, cursor: props.cursor })
  return <SubscribedPostPage {...props} page={page} pageSource={props.source} />
}

function SubscribedPageMediaPage(props: SubscribedPageProps & { source: PageMediaWindow }) {
  const page = props.source.capability.useMedia({
    handle: props.source.handle,
    personId: props.membership.personId,
    kind: props.source.mediaKind,
    cursor: props.cursor,
  })
  return <SubscribedPostPage {...props} page={page} mediaSource={props.source} />
}

/** Les rapports gardent les fenêtres brutes ; le doublon épinglé est seulement masqué à l'écran. */
function SubscribedPostPage(props: SubscribedPageProps & { page: FeedPageQuery; pageSource?: PagePostSource; mediaSource?: PageMediaWindow }) {
  const { t } = useDiasporaleT()
  const { page } = props
  const key = feedCursorKey(props.cursor)
  const { onReport, pageIndex, isTail } = props
  const mediaSource = props.mediaSource
  const isMediaSource = mediaSource !== undefined
  const pinnedPostId = props.pageSource?.pinContext?.ready ? props.pageSource.pinContext.pinnedPostId : null
  const visiblePosts = pinnedPostId === null ? page.data?.items : page.data?.items.filter((post) => post.id !== pinnedPostId)
  const mediaPostIds = useMemo(() => isMediaSource && page.data !== undefined && !page.isLoading && page.error === null
    ? page.data.items.map((post) => post.id) : undefined, [isMediaSource, page.data, page.isLoading, page.error])
  // Une fenêtre modifiée attend son rapport avant de s'afficher ; aucune double
  // carte entre l'ancienne frontière réactive et le rebasing de la chaîne.
  const mediaWindowReady = mediaSource !== undefined && mediaPostIds !== undefined
    && samePostIds(mediaSource.recordedPostIds, mediaPostIds)
  const seenMediaPosts = new Set(mediaSource?.excludedPostIds)
  const mediaPosts = mediaWindowReady && mediaSource && visiblePosts
    ? visiblePosts.filter((post) => {
      if (post.author.kind !== "page" || post.author.id !== mediaSource.pageId) return false
      if (seenMediaPosts.has(post.id)) return false
      seenMediaPosts.add(post.id)
      return post.media.some((item) => mediaSource.mediaKind === "all" || item.kind === mediaSource.mediaKind)
    }) : []

  useEffect(() => {
    onReport(pageIndex, key, isTail, {
      hasData: page.data !== undefined,
      count: page.data?.items.length ?? 0,
      nextCursor: page.data?.nextCursor ?? null,
      isLoading: page.isLoading,
      error: page.error,
      ...(mediaPostIds === undefined ? {} : { mediaPostIds }),
    })
  }, [onReport, pageIndex, key, isTail, page.data, page.isLoading, page.error, mediaPostIds])

  return (
    <div className="flex flex-col gap-4" aria-busy={page.isLoading}>
      {page.error !== null && ACCESS_REFUSAL_CODES.has(page.error) ? (
        // Un refus d'accès (suspension, adhésion…) n'est pas une panne : il se dit, sans reprise.
        <Card role="alert" className="flex flex-col gap-1 p-4">
          <h2 className="font-semibold">{t("feed.pagination.deniedTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t(`errors.${page.error}`)}</p>
        </Card>
      ) : page.error !== null ? (
        <Card role="alert" className="flex flex-col items-start gap-3 p-4">
          <div>
            <h2 className="font-semibold">{t("feed.pagination.errorTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("feed.pagination.errorBody")}</p>
          </div>
          <Button variant="outline" onClick={page.retry} disabled={page.isLoading} className="focus-visible:shadow-focus">{t("feed.pagination.retry")}</Button>
        </Card>
      ) : page.isLoading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("feed.pagination.loading")}</span>
          {page.data === undefined ? <Skeleton className="h-40 w-full rounded-xl" /> : null}
        </div>
      ) : null}
      {page.data?.lacunar && (mediaSource === undefined || (page.error === null && !page.isLoading)) ? <p role="status" className="text-sm text-muted-foreground">{t("feed.pagination.lacunar")}</p> : null}
      {mediaSource ? mediaPosts.length > 0 ? (
        <ol className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          {mediaPosts.map((post) => <li key={post.id} className="min-w-0"><PageMediaCard post={post} kind={mediaSource.mediaKind} /></li>)}
        </ol>
      ) : null : visiblePosts && visiblePosts.length > 0 ? (
        <ol className="flex flex-col gap-4">
          {visiblePosts.map((post) => (
            <li key={post.id}>
              <PostEntry
                post={post}
                membership={props.membership}
                now={props.now}
                {...(props.hubCountry === undefined ? {} : { hubCountry: props.hubCountry })}
                {...(props.pageSource === undefined ? {} : { pageSource: props.pageSource })}
              />
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}

/** La galerie réutilise le lecteur sans dupliquer les menus et identifiants du mur. */
function PageMediaCard(props: { post: PostView; kind: PageMediaKind }) {
  const { t, locale } = useDiasporaleT()
  const { routes, Link } = useRouting()
  const media = props.post.media.filter((item) => props.kind === "all" || item.kind === props.kind)
  return (
    <Card className="flex min-w-0 flex-col overflow-hidden">
      <PostMediaGrid media={media} />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4">
        <time dateTime={new Date(props.post.createdAt).toISOString()} className="text-sm text-muted-foreground">
          {t("pageMedia.publishedAt", { date: formatDate(props.post.createdAt, locale) })}
        </time>
        <Link href={routes.post(props.post.id)} className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-primary hover:underline focus-visible:shadow-focus">
          {t("pageMedia.openPublication")}
        </Link>
      </div>
    </Card>
  )
}

/** La carte épinglée et les fenêtres partagent les mêmes gestes collectifs. */
function PostEntry(props: { post: PostView; membership: MembershipView; now: number; hubCountry?: CountryCode; pageSource?: PagePostSource }) {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const { post, pageSource } = props
  return (
    <>
      <PostCard
        // Les gestes personnels du menu ne valent pas mandat de la page.
        // Chaque geste collectif fait relire ce mandat par le moteur.
        post={pageSource ? { ...post, isMine: false } : post}
        now={props.now}
        {...(props.hubCountry === undefined ? {} : { hubCountry: props.hubCountry })}
        canReact={props.membership.canPublish}
        onReact={async (kind) => {
          if (!props.membership.canPublish) return
          try {
            const result = await actions.react(post.id, kind)
            if (!result.ok) toast.error(t(`errors.${result.code}`))
          } catch {
            toast.error(t("errors.unknown"))
          }
        }}
      />
      {pageSource?.canRemove && post.eventGalleryId === undefined ? <div className="flex flex-wrap justify-end gap-2">
        {props.membership.canPublish && post.moderation === "published" ? <>
          {post.editedAt !== undefined && pageSource.capability.edit ? <PagePostEditButton pageId={pageSource.pageId} post={post} edit={pageSource.capability.edit} /> : null}
          {pageSource.pinContext ? <PagePostPinButton
            key={`${pageSource.pageId}:${post.id}`}
            capability={pageSource.pinContext.capability}
            pageId={pageSource.pageId}
            postId={post.id}
            pinnedPostId={pageSource.pinContext.pinnedPostId}
            ready={pageSource.pinContext.ready}
          /> : null}
        </> : null}
        <PagePostRemoveButton capability={pageSource.capability} pageId={pageSource.pageId} postId={post.id} />
      </div> : null}
    </>
  )
}
