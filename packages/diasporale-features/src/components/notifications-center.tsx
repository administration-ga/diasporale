"use client"

import {
  appendCursorPage,
  initialCursorPages,
  mergedCursorRows,
  nextCursor,
  recordCursorPage,
  type CursorPageMount,
  type CursorPageSnapshot,
  type CursorPagesState,
} from "@antsia/social-features/features/reseau-personnel/cursor-pages"
import { BellIcon, CheckIcon } from "lucide-react"
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { useActions, useNotificationsPage, useUnreadCount } from "../data/context"
import { ACCESS_REFUSAL_CODES, type ActionErrorCode } from "../data/errors"
import type { NotificationsPageQuery, NotificationView } from "../data/types"
import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"
import { Button } from "../primitives/button"
import { Skeleton } from "../primitives/surface"
import { EmptyState } from "./empty-state"
import { NotificationRow } from "./notification-bell"

/** Les deux filtres de la page : tous les avis chargés, ou seulement les non lus. */
export const NOTIFICATION_FILTERS = ["all", "unread"] as const
export type NotificationFilter = (typeof NOTIFICATION_FILTERS)[number]

/** « Nouveau » : les avis des dernières vingt-quatre heures, comme la cloche du moteur ; le reste « Plus tôt ». */
export const RECENT_NOTICE_WINDOW_MS = 24 * 60 * 60 * 1000

type PageReport = (mount: CursorPageMount, snapshot: CursorPageSnapshot<NotificationView>, error: ActionErrorCode | null) => void

interface ChainState {
  readonly pages: CursorPagesState<NotificationView>
  readonly errors: Readonly<Record<number, ActionErrorCode | null>>
  readonly retryToken: number
}

/**
 * La suite des pages natives des avis, sur les gardes communes des pages à curseur (mêmes règles
 * que les commentaires, FD-03) : une frontière qui bouge (un avis arrive en tête) remonte la suite,
 * une page en panne bloque la suivante et se reprend, un refus d'accès n'affiche plus rien.
 */
function useNotificationChain() {
  const [state, setState] = useState<ChainState>(() => ({ pages: initialCursorPages<NotificationView>(), errors: {}, retryToken: 0 }))
  const report = useCallback<PageReport>((mount, snapshot, error) => {
    setState((current) => {
      const pages = recordCursorPage(current.pages, mount, snapshot)
      if (pages === current.pages && (current.errors[mount.id] ?? null) === error) return current
      return { ...current, pages, errors: { ...current.errors, [mount.id]: error } }
    })
  }, [])
  const more = useCallback(() => setState((current) => ({ ...current, pages: appendCursorPage(current.pages) })), [])
  const retry = useCallback(() => setState((current) => ({ ...current, retryToken: current.retryToken + 1 })), [])
  const { pages, errors } = state
  const codes = pages.mounts.map((mount) => errors[mount.id] ?? null)
  const refusal = codes.find((code): code is ActionErrorCode => code !== null && ACCESS_REFUSAL_CODES.has(code)) ?? null
  const failure = refusal ?? codes.find((code): code is ActionErrorCode => code !== null) ?? null
  const first = pages.pages[pages.mounts[0]!.id]
  const last = pages.pages[pages.mounts[pages.mounts.length - 1]!.id]
  return {
    mounts: pages.mounts,
    report,
    more,
    retry,
    retryToken: state.retryToken,
    rows: refusal ? [] : mergedCursorRows(pages, (row) => row.id),
    refusal,
    failure,
    loaded: first?.data !== undefined,
    loadingMore: pages.mounts.length > 1 && (!last?.data || last.isPending) && !last?.isError,
    hasMore: refusal === null && nextCursor(pages) !== null,
  }
}

/** Une page lue par son curseur, rapportée à la suite qui l'a montée ; la reprise la relit. */
function usePageReport(query: NotificationsPageQuery, mount: CursorPageMount, retryToken: number, report: PageReport) {
  const data = useMemo(() => query.data === undefined ? undefined : {
    page: query.data.items,
    isDone: query.data.isDone,
    continueCursor: query.data.continueCursor,
  }, [query.data])
  useLayoutEffect(() => {
    report(mount, { data, isPending: query.isLoading, isError: query.error !== null }, query.error)
  }, [mount, data, query.isLoading, query.error, report])
  const latest = useRef({ retry: query.retry, failed: query.error !== null })
  useLayoutEffect(() => { latest.current = { retry: query.retry, failed: query.error !== null } })
  useEffect(() => {
    if (retryToken > 0 && latest.current.failed) latest.current.retry()
  }, [retryToken])
}

function NotificationsQueryPage(props: { mount: CursorPageMount; retryToken: number; report: PageReport }) {
  usePageReport(useNotificationsPage({ cursor: props.mount.cursor }), props.mount, props.retryToken, props.report)
  return null
}

/** Le bouton d'un filtre : appuyé ou non (`aria-pressed`), jamais un bouton plein. */
function FilterButton(props: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={props.pressed}
      onClick={props.onClick}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:shadow-focus",
        props.pressed ? "bg-[var(--esp-accent-soft)] text-[var(--esp-accent-deep)]" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {props.children}
    </button>
  )
}

/**
 * La page des notifications (NP-04) : tous mes avis du réseau, du plus récent au plus ancien, la
 * suite lue au curseur du serveur à la demande ; « Toutes » ou « Non lues » (sur les avis déjà
 * chargés : le serveur ne filtre pas encore) ; sections « Nouveau » et « Plus tôt ». Chaque ligne
 * est celle de la cloche : sa phrase, l'issue d'une invitation, le lien vers son objet. « Tout
 * marquer comme lu » suit le décompte du serveur, jamais un chiffre calculé ici.
 */
export function NotificationsCenter() {
  const { t } = useDiasporaleT()
  const chain = useNotificationChain()
  const actions = useActions()
  const unread = useUnreadCount()
  const [filter, setFilter] = useState<NotificationFilter>("all")
  // Une date de référence par visite : les « il y a … » et les sections ne bougent pas pendant la lecture.
  const [now] = useState(() => Date.now())
  const titleId = useId()
  const newId = useId()
  const earlierId = useId()

  const pages = chain.mounts.map((mount) => <NotificationsQueryPage key={mount.id} mount={mount} retryToken={chain.retryToken} report={chain.report} />)
  const visible = filter === "unread" ? chain.rows.filter((item) => !item.read) : chain.rows
  const cutoff = now - RECENT_NOTICE_WINDOW_MS
  const sections = [
    { id: newId, titleKey: "notificationsCenter.groups.new", items: visible.filter((item) => item.createdAt >= cutoff) },
    { id: earlierId, titleKey: "notificationsCenter.groups.earlier", items: visible.filter((item) => item.createdAt < cutoff) },
  ].filter((section) => section.items.length > 0)
  const serverUnread = unread.status === "ready" && unread.data.count > 0
  const empty = chain.loaded && chain.rows.length === 0 && chain.failure === null && !chain.hasMore && !chain.loadingMore

  const markAll = async () => {
    const result = await actions.markAllNotificationsRead()
    if (!result.ok) toast.error(t(`errors.${result.code}`))
  }

  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-4">
      {pages}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 id={titleId} className="text-2xl font-semibold">
          {t("notificationsCenter.title")}
        </h1>
        {serverUnread && chain.refusal === null ? (
          <Button variant="ghost" size="sm" onClick={markAll}>
            <CheckIcon aria-hidden />
            {t("bell.markAll")}
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{t("notificationsCenter.lead")}</p>

      {chain.refusal === null ? (
        <div className="flex flex-col gap-1">
          <div role="group" aria-label={t("notificationsCenter.filterLabel")} className="flex flex-wrap gap-1">
            <FilterButton pressed={filter === "all"} onClick={() => setFilter("all")}>{t("notificationsCenter.filter.all")}</FilterButton>
            <FilterButton pressed={filter === "unread"} onClick={() => setFilter("unread")}>{t("notificationsCenter.filter.unread")}</FilterButton>
          </div>
          {filter === "unread" ? <p className="text-[13px] text-muted-foreground">{t("notificationsCenter.filterScope")}</p> : null}
        </div>
      ) : null}

      {!chain.loaded && chain.failure === null ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : empty ? (
        <EmptyState icon={<BellIcon />} title={t("bell.emptyTitle")} description={t("bell.emptyBody")} />
      ) : (
        <div className="flex flex-col gap-4" aria-busy={chain.loadingMore}>
          {sections.map((section) => (
            <section key={section.id} aria-labelledby={section.id} className="flex flex-col gap-1">
              <h2 id={section.id} className="px-1 text-sm font-semibold text-muted-foreground">
                {t(section.titleKey)}
              </h2>
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <NotificationRow key={item.id} item={item} now={now} onNavigate={() => undefined} />
                ))}
              </ul>
            </section>
          ))}
          {chain.loaded && visible.length === 0 && filter === "unread" && chain.failure === null ? (
            <p role="status" className="text-sm text-muted-foreground">{t("notificationsCenter.emptyUnread")}</p>
          ) : null}
          {chain.failure !== null ? (
            <div className="flex flex-wrap items-center gap-2">
              <p role="alert" className="text-sm text-muted-foreground">{t(`errors.${chain.failure}`)}</p>
              {ACCESS_REFUSAL_CODES.has(chain.failure) ? null : (
                <Button variant="outline" size="sm" onClick={chain.retry}>{t("notificationsCenter.retry")}</Button>
              )}
            </div>
          ) : null}
          {chain.hasMore || chain.loadingMore ? (
            <Button variant="outline" className="self-start" disabled={chain.loadingMore || chain.failure !== null} aria-busy={chain.loadingMore} onClick={chain.more}>
              {t(chain.loadingMore ? "notificationsCenter.loadingMore" : "notificationsCenter.loadMore")}
            </Button>
          ) : null}
        </div>
      )}
    </section>
  )
}
