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
import { Button, Card, PostCard, Skeleton } from "@diasporale/features"
import {
  useActions,
  useDataSource,
  useFeedPage,
  useProfilePostsPage,
  type ActionErrorCode,
  type FeedCursorView,
  type FeedPageQuery,
  type MembershipView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"

interface PostPagesProps {
  readonly membership: MembershipView
  readonly now: number
  readonly emptyFallback: ReactNode
}

export interface FeedPagesProps extends PostPagesProps {
  readonly scope: FeedScope
  readonly hubCountry?: CountryCode
}

export interface ProfilePostPagesProps extends PostPagesProps {
  readonly handle: string
}

type PostPagesSource =
  | { readonly kind: "feed"; readonly scope: FeedScope; readonly hubCountry?: CountryCode }
  | { readonly kind: "profile"; readonly handle: string }

interface PageReport {
  readonly hasData: boolean
  readonly count: number
  readonly nextCursor: FeedCursorView | null
  readonly isLoading: boolean
  readonly error: ActionErrorCode | null
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
  const country = props.hubCountry ?? props.membership.facet.countryOfResidence
  const key = JSON.stringify([source.kind, props.membership.personId, "feed", props.scope, country])
  return <PostPagesChain key={key} {...props} source={{ kind: "feed", scope: props.scope, ...(props.hubCountry === undefined ? {} : { hubCountry: props.hubCountry }) }} />
}

/** Le mur reprend la même chaîne ; son identité suit aussi le profil consulté. */
export function ProfilePostPages(props: ProfilePostPagesProps) {
  const source = useDataSource()
  const handle = props.handle.trim().replace(/^@/, "").toLowerCase()
  const key = JSON.stringify([source.kind, props.membership.personId, "profile", handle])
  return <PostPagesChain key={key} {...props} source={{ kind: "profile", handle }} />
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
        return props.source.kind === "feed" ? (
          <SubscribedFeedPage
            key={feedCursorKey(cursor)}
            {...pageProps}
            scope={props.source.scope}
            {...(props.source.hubCountry === undefined ? {} : { hubCountry: props.source.hubCountry })}
          />
        ) : <SubscribedProfilePostPage key={feedCursorKey(cursor)} {...pageProps} handle={props.source.handle} />
      })}
      {empty ? props.emptyFallback : null}
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
function SubscribedFeedPage(props: SubscribedPageProps & { scope: FeedScope }) {
  const page = useFeedPage({ scope: props.scope, ...(props.hubCountry === undefined ? {} : { hubCountry: props.hubCountry }), cursor: props.cursor })
  return <SubscribedPostPage {...props} page={page} />
}

function SubscribedProfilePostPage(props: SubscribedPageProps & { handle: string }) {
  const page = useProfilePostsPage({ handle: props.handle, cursor: props.cursor })
  return <SubscribedPostPage {...props} page={page} />
}

/** Présentation et rapport communs : aucun tri, filtre ni curseur reconstruit. */
function SubscribedPostPage(props: SubscribedPageProps & { page: FeedPageQuery }) {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const { page } = props
  const key = feedCursorKey(props.cursor)
  const { onReport, pageIndex, isTail } = props

  useEffect(() => {
    onReport(pageIndex, key, isTail, {
      hasData: page.data !== undefined,
      count: page.data?.items.length ?? 0,
      nextCursor: page.data?.nextCursor ?? null,
      isLoading: page.isLoading,
      error: page.error,
    })
  }, [onReport, pageIndex, key, isTail, page.data, page.isLoading, page.error])

  return (
    <div className="flex flex-col gap-4" aria-busy={page.isLoading}>
      {page.error !== null ? (
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
      {page.data?.lacunar ? <p role="status" className="text-sm text-muted-foreground">{t("feed.pagination.lacunar")}</p> : null}
      {page.data && page.data.items.length > 0 ? (
        <ol className="flex flex-col gap-4">
          {page.data.items.map((post) => (
            <li key={post.id}>
              <PostCard
                post={post}
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
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
