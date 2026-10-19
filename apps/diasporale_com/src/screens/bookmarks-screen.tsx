"use client"

import { Button, Card, EmptyState, Skeleton, formatDate } from "@diasporale/features"
import {
  appendCursorPage, initialCursorPages, mergedCursorRows, nextCursor, recordCursorPage, removeCursorRows,
  type CursorPageMount, type CursorPageSnapshot, type CursorPagesState,
} from "@antsia/social-features/reseau-personnel"
import { useActions, useBookmarksPage, useDataSource, type ActionErrorCode, type BookmarksPageView, type BookmarkView, type MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { BookmarkIcon, BookmarkXIcon } from "lucide-react"
import NextLink from "next/link"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { AppShell } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { useEngineNetwork } from "@/components/icom"
import { routes } from "@/lib/routes"

const ACCESS_ERRORS: ReadonlySet<ActionErrorCode> = new Set(["not_signed_in", "not_member", "not_found", "status_insufficient", "suspended", "network_unavailable"])

/** `/enregistrements` — mes signets (EXF-DG-12) : visibles de moi seul ; une publication devenue illisible disparaît. */
export function BookmarksScreen() {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <AppShell membership={session.membership}>
            <Bookmarks membership={session.membership} />
          </AppShell>
        ) : null
      }
    </Gate>
  )
}

function Bookmarks({ membership }: { membership: MembershipView }) {
  const source = useDataSource()
  const network = useEngineNetwork()
  const identity = JSON.stringify([source.kind, membership.personId, network?.networkId, network?.personId])
  // L'adhésion et l'îlot réseau peuvent changer sur deux rendus distincts.
  if (source.kind === "engine" && network && network.personId !== membership.personId) return <Skeleton className="h-32 w-full rounded-xl" />
  return <BookmarksPages key={identity} />
}

interface ChainState {
  readonly pages: CursorPagesState<BookmarkView>
  readonly errors: Readonly<Record<number, ActionErrorCode | null>>
  readonly denied: Readonly<Record<number, ActionErrorCode>>
  readonly protectionCode: ActionErrorCode | null
  readonly validation: number
}

/** Une nouvelle frontière ne réautorise pas une page remise en cache. */
function withPages(current: ChainState, pages: CursorPagesState<BookmarkView>): ChainState {
  const errors: Record<number, ActionErrorCode | null> = {}
  const denied: Record<number, ActionErrorCode> = {}
  for (const mount of pages.mounts) {
    errors[mount.id] = current.errors[mount.id] ?? null
    const code = current.denied[mount.id] ?? (current.protectionCode !== null && !current.pages.mounts.some((previous) => previous.id === mount.id) ? current.protectionCode : null)
    if (code !== null) denied[mount.id] = code
  }
  return { ...current, pages, errors, denied }
}

function BookmarksQueryPage(props: {
  mount: CursorPageMount
  report: (mount: CursorPageMount, snapshot: CursorPageSnapshot<BookmarkView>, error: ActionErrorCode | null) => void
  validation: number
  validated: (mount: CursorPageMount, validation: number, page: BookmarksPageView) => void
}) {
  const { mount, report, validation, validated } = props
  const query = useBookmarksPage({ cursor: mount.cursor })
  const retry = useRef(query.retry)
  useLayoutEffect(() => { retry.current = query.retry }, [query.retry])
  const data = useMemo(() => query.data === undefined ? undefined : {
    page: query.data.items, isDone: query.data.isDone, continueCursor: query.data.continueCursor,
  }, [query.data])
  useLayoutEffect(() => {
    report(mount, { data, isPending: query.isLoading, isError: query.error !== null }, query.error)
  }, [mount, data, query.isLoading, query.error, report])
  useEffect(() => {
    if (validation === 0) return
    let active = true
    void (async () => {
      try {
        const page = await retry.current()
        if (active && page !== undefined) validated(mount, validation, page)
      } catch { /* La query garde le refus fermé ; aucune projection n'est réautorisée. */ }
    })()
    return () => { active = false }
  }, [mount, validation, validated])
  return null
}

function BookmarksPages() {
  const { t } = useDiasporaleT()
  const [chain, setChain] = useState<ChainState>(() => ({ pages: initialCursorPages<BookmarkView>(), errors: {}, denied: {}, protectionCode: null, validation: 0 }))
  const report = useCallback((mount: CursorPageMount, snapshot: CursorPageSnapshot<BookmarkView>, error: ActionErrorCode | null) => {
    setChain((current) => {
      if (!current.pages.mounts.some((candidate) => candidate.id === mount.id && candidate.cursor === mount.cursor)) return current
      const accessDenied = error !== null && ACCESS_ERRORS.has(error)
      const pages = recordCursorPage(current.pages, mount, accessDenied ? { ...snapshot, data: undefined } : snapshot)
      if (pages === current.pages && current.errors[mount.id] === error) return current
      const next = withPages(current, pages)
      if (accessDenied && error !== null) return {
        ...next,
        errors: { ...next.errors, [mount.id]: error },
        denied: current.denied[mount.id] === undefined
          ? Object.fromEntries(pages.mounts.map((mounted) => [mounted.id, error]))
          : { ...next.denied, [mount.id]: error },
        protectionCode: error,
        validation: current.denied[mount.id] === undefined ? current.validation + 1 : current.validation,
      }
      return { ...next, errors: { ...next.errors, [mount.id]: error } }
    })
  }, [])
  const validated = useCallback((mount: CursorPageMount, validation: number, page: BookmarksPageView) => {
    setChain((current) => {
      if (validation !== current.validation || !current.pages.mounts.some((candidate) => candidate.id === mount.id && candidate.cursor === mount.cursor)) return current
      const pages = recordCursorPage(current.pages, mount, { data: { page: page.items, isDone: page.isDone, continueCursor: page.continueCursor }, isPending: false, isError: false })
      const next = withPages(current, pages)
      const denied = { ...next.denied }
      delete denied[mount.id]
      return { ...next, errors: { ...next.errors, [mount.id]: null }, denied }
    })
  }, [])
  const retry = () => setChain((current) => ({ ...current, validation: current.validation + 1 }))
  const accessDenied = useCallback((code: ActionErrorCode) => {
    setChain((current) => ({ ...current, protectionCode: code, denied: Object.fromEntries(current.pages.mounts.map((mount) => [mount.id, code])), validation: current.validation + 1 }))
  }, [])
  const remove = useCallback((bookmark: BookmarkView) => {
    // Un signet réenregistré entre-temps est une autre version du choix.
    setChain((current) => ({ ...current, pages: removeCursorRows(current.pages, (row) => row.postId === bookmark.postId && row.markedAt === bookmark.markedAt) }))
  }, [])
  const { pages, errors } = chain
  const forbidden = pages.mounts.some((mount) => chain.denied[mount.id] !== undefined)
  const error = pages.mounts.map((mount) => chain.denied[mount.id] ?? errors[mount.id]).find((code) => code != null) ?? null
  const items = forbidden ? [] : mergedCursorRows(pages, (row) => row.postId)
  const current = pages.pages[pages.mounts[pages.mounts.length - 1]!.id]
  const initialLoading = pages.pages[0]?.data === undefined && error === null
  const loadingMore = pages.mounts.length > 1 && (!current?.data || current.isPending) && !current?.isError
  const hasMore = nextCursor(pages) !== null
  const empty = items.length === 0 && !initialLoading && error === null && !hasMore && !loadingMore
  return (
    <>
      {pages.mounts.map((mount) => <BookmarksQueryPage key={mount.id} mount={mount} report={report} validation={chain.validation} validated={validated} />)}
      <div>
        <h1 className="font-display text-3xl font-bold">{t("bookmarks.title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t("bookmarks.lead")}</p>
      </div>
      {initialLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : null}
      {error !== null ? (
        <Card role="alert" className="flex flex-col items-start gap-3 p-4">
          <p>{t(`errors.${error}`)}</p>
          <Button variant="outline" onClick={retry}>{t("bookmarks.retry")}</Button>
        </Card>
      ) : null}
      {empty ? (
        <EmptyState icon={<BookmarkIcon />} title={t("bookmarks.emptyTitle")} description={t("bookmarks.emptyBody")} />
      ) : null}
      {items.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-busy={loadingMore}>
          {items.map((bookmark) => (
            <BookmarkRow key={JSON.stringify([bookmark.postId, bookmark.markedAt])} bookmark={bookmark} onRemoved={remove} onAccessDenied={accessDenied} />
          ))}
        </ul>
      ) : null}
      {!forbidden && (hasMore || loadingMore) ? (
        <Button variant="outline" disabled={loadingMore || error !== null} aria-busy={loadingMore} onClick={() => setChain((current) => withPages(current, appendCursorPage(current.pages)))}>
          {t(loadingMore ? "bookmarks.loadingMore" : "bookmarks.loadMore")}
        </Button>
      ) : null}
    </>
  )
}

function BookmarkRow(props: { bookmark: BookmarkView; onRemoved: (bookmark: BookmarkView) => void; onAccessDenied: (code: ActionErrorCode) => void }) {
  const { t, locale } = useDiasporaleT()
  const actions = useActions()
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const active = useRef(false)
  useLayoutEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  const { bookmark } = props
  const name = bookmark.author.displayName ?? t("bell.someone")

  const remove = async () => {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    try {
      const result = await actions.toggleBookmark(bookmark.postId)
      if (!active.current) return
      if (result.ok && !result.value.bookmarked) {
        props.onRemoved(bookmark)
        toast.success(t("postMenu.unbookmarked"))
      } else if (!result.ok) {
        if (ACCESS_ERRORS.has(result.code)) props.onAccessDenied(result.code)
        toast.error(t(`errors.${result.code}`))
      }
    } catch {
      if (active.current) toast.error(t("errors.unknown"))
    } finally {
      locked.current = false
      if (active.current) setBusy(false)
    }
  }

  return (
    <li className="[content-visibility:auto] [contain-intrinsic-size:auto_12rem]">
      <Card className="flex flex-col gap-2 p-4">
        <p className="text-[13px] text-muted-foreground">
          <span className="font-semibold text-foreground">{name}</span> · {formatDate(bookmark.publishedAt, locale)}
        </p>
        <p className="line-clamp-3 whitespace-pre-line text-[15px] leading-relaxed">{bookmark.body}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <NextLink href={routes.post(bookmark.postId)}>{t("bookmarks.open")}</NextLink>
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} aria-busy={busy} onClick={remove}>
            <BookmarkXIcon aria-hidden />
            {t("bookmarks.remove")}
          </Button>
        </div>
      </Card>
    </li>
  )
}
