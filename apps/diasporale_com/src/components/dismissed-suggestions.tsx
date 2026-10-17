"use client"

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import {
  appendCursorPage,
  initialCursorPages,
  mergedCursorRows,
  nextCursor,
  recordCursorPage,
  removeCursorRows,
  type CursorPageMount,
  type CursorPageSnapshot,
  type CursorPagesState,
} from "@antsia/social-features/reseau-personnel"
import { Avatar, Button, Card, formatDate } from "@diasporale/features"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import NextLink from "next/link"
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { engineActionErrorCode } from "@/data/engine-errors"
import { routes } from "@/lib/routes"

type DismissedRow = FunctionReturnType<typeof api.modules.diaspora.suggestions.paginateDismissed>["page"][number]
type DismissalId = DismissedRow["dismissalId"]
type RetryPage = () => Promise<unknown>
const PAGE_SIZE = 12
const keyOf = (row: DismissedRow) => row.dismissalId
const ACCESS_ERRORS = new Set(["not_signed_in", "not_member", "not_found", "status_insufficient", "suspended", "network_unavailable"])
interface DismissedPagesState {
  chain: CursorPagesState<DismissedRow>
  generation: number
  deniedPages: ReadonlySet<number>
}
type ReportPage = (mount: CursorPageMount, snapshot: CursorPageSnapshot<DismissedRow>, denied: boolean, generation: number, recovery: boolean) => void

/** Les choix du lecteur restent distincts des suggestions que le moteur peut lui proposer. */
export function EngineDismissedSuggestions() {
  const { networkId, personId } = useNetwork()
  return <DismissedSuggestionsPages key={JSON.stringify([networkId, personId])} />
}

function DismissedQueryPage(props: {
  mount: CursorPageMount
  generation: number
  report: ReportPage
  registerRetry: (id: number, retry: RetryPage) => () => void
}) {
  const { networkId } = useNetwork()
  const { mount, generation, report, registerRetry } = props
  const query = useAuthenticatedConvexQuery(api.modules.diaspora.suggestions.paginateDismissed, {
    networkId,
    paginationOpts: { cursor: mount.cursor, numItems: PAGE_SIZE },
  })
  const denied = query.isError && ACCESS_ERRORS.has(engineActionErrorCode(query.error))
  const { refetch } = query
  useLayoutEffect(() => {
    report(mount, { data: query.data, isPending: query.isPending, isError: query.isError }, denied, generation, false)
  }, [mount, query.data, query.isPending, query.isError, denied, generation, report])
  const retry = useCallback(async () => {
    const result = await refetch()
    report(mount, { data: result.data, isPending: result.isPending, isError: result.isError }, result.isError && ACCESS_ERRORS.has(engineActionErrorCode(result.error)), generation, true)
  }, [mount, generation, refetch, report])
  useEffect(() => registerRetry(mount.id, retry), [mount.id, retry, registerRetry])
  return null
}

function DismissedSuggestionsPages() {
  const { networkId } = useNetwork()
  const { t } = useDiasporaleT()
  const [model, setModel] = useState<DismissedPagesState>(() => ({ chain: initialCursorPages<DismissedRow>(), generation: 0, deniedPages: new Set() }))
  const state = model.chain
  const [busyIds, setBusyIds] = useState<ReadonlySet<DismissalId>>(new Set())
  const pendingIds = useRef(new Set<DismissalId>())
  const active = useRef(false)
  const allowed = useRef(true)
  const accessGeneration = useRef(0)
  const retries = useRef(new Map<number, RetryPage>())
  useLayoutEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  const report = useCallback<ReportPage>((mount, snapshot, denied, generation, recovery) => {
    setModel((previous) => {
      // Un refetch antérieur au refus, ou une ancienne génération de curseur,
      // ne peut ni rouvrir une page ni réintroduire un refus sur la nouvelle chaîne.
      if (generation !== previous.generation || !previous.chain.mounts.some((candidate) => candidate.id === mount.id && candidate.cursor === mount.cursor)) return previous
      const chain = recordCursorPage(previous.chain, mount, snapshot)
      if (denied && !previous.deniedPages.has(mount.id)) {
        return { chain, generation: previous.generation + 1, deniedPages: new Set(chain.mounts.map((candidate) => candidate.id)) }
      }
      const deniedPages = new Set(chain.mounts.filter((candidate) => previous.deniedPages.has(candidate.id)
        || (previous.deniedPages.size > 0 && !previous.chain.mounts.some((before) => before.id === candidate.id))).map((candidate) => candidate.id))
      const ready = snapshot.data !== undefined && !snapshot.isPending && !snapshot.isError
      // Une référence de cache rendue à nouveau n'est pas une réautorisation.
      // Chaque page fermée attend sa propre relecture commencée après le refus.
      if (recovery && ready) deniedPages.delete(mount.id)
      if (chain === previous.chain && deniedPages.size === previous.deniedPages.size && [...deniedPages].every((id) => previous.deniedPages.has(id))) return previous
      return { ...previous, chain, deniedPages }
    })
  }, [])
  const registerRetry = useCallback((id: number, retry: RetryPage) => {
    retries.current.set(id, retry)
    return () => {
      if (retries.current.get(id) === retry) retries.current.delete(id)
    }
  }, [])
  const retry = () => {
    for (const refetch of retries.current.values()) {
      void (async () => { try { await refetch() } catch { /* La query porte le refus fermé. */ } })()
    }
  }
  const restore = useMutation(api.modules.diaspora.suggestions.restoreDismissed)
  const restoreRow = async (dismissalId: DismissalId) => {
    if (!active.current || !allowed.current || pendingIds.current.has(dismissalId)) return
    const generation = accessGeneration.current
    pendingIds.current.add(dismissalId)
    setBusyIds(new Set(pendingIds.current))
    try {
      await restore({ networkId, dismissalId })
      if (!active.current || !allowed.current || accessGeneration.current !== generation) return
      // false signifie que cette version n'est plus là ; jamais supprimer
      // un autre choix de la même cible ni promettre une nouvelle proposition.
      setModel((previous) => ({ ...previous, chain: removeCursorRows(previous.chain, (row) => row.dismissalId === dismissalId) }))
      toast.success(t("relations.dismissed.restored"))
    } catch (error) {
      if (!active.current || !allowed.current || accessGeneration.current !== generation) return
      const code = engineActionErrorCode(error)
      if (ACCESS_ERRORS.has(code)) {
        allowed.current = false
        setModel((previous) => ({
          ...previous,
          generation: previous.generation + 1,
          deniedPages: new Set(previous.chain.mounts.map((mount) => mount.id)),
        }))
      }
      toast.error(t(code === "unknown" ? "relations.dismissed.restoreFailed" : `errors.${code}`))
    } finally {
      pendingIds.current.delete(dismissalId)
      if (active.current) setBusyIds(new Set(pendingIds.current))
    }
  }

  const accessDenied = state.mounts.some((mount) => model.deniedPages.has(mount.id))
  useLayoutEffect(() => {
    allowed.current = !accessDenied
    accessGeneration.current = model.generation
  }, [accessDenied, model.generation])
  const rows = accessDenied ? [] : mergedCursorRows(state, keyOf)
  const hasError = accessDenied || state.mounts.some((mount) => state.pages[mount.id]?.isError)
  const current = state.pages[state.mounts[state.mounts.length - 1]!.id]
  const initialLoading = state.pages[0]?.data === undefined && !hasError
  const loadingMore = state.mounts.length > 1 && (!current?.data || current.isPending) && !current?.isError
  const hasMore = nextCursor(state) !== null
  const empty = rows.length === 0 && !initialLoading && !loadingMore && !hasError && !hasMore

  return (
    <div className="flex flex-col gap-4" aria-busy={initialLoading || loadingMore}>
      {state.mounts.map((mount) => <DismissedQueryPage key={mount.id} mount={mount} generation={model.generation} report={report} registerRetry={registerRetry} />)}
      <Card className="flex flex-col gap-2 p-4">
        <h2 className="font-display text-xl font-bold">{t("relations.dismissed.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("relations.dismissed.body")}</p>
      </Card>
      {hasError ? (
        <Card role="alert" className="flex flex-col items-start gap-3 p-4">
          <h3 className="font-semibold">{t("relations.dismissed.errorTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("relations.dismissed.errorBody")}</p>
          <Button variant="outline" onClick={retry}>{t("relations.dismissed.retry")}</Button>
        </Card>
      ) : null}
      {initialLoading ? <p role="status">{t("relations.dismissed.loading")}</p> : empty ? <Card className="p-4"><p>{t("relations.dismissed.empty")}</p></Card> : null}
      {rows.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => <DismissedSuggestionRow key={row.dismissalId} row={row} busy={busyIds.has(row.dismissalId)} onRestore={restoreRow} />)}
        </ul>
      ) : null}
      {hasMore || loadingMore ? (
        <Button variant="outline" className="self-center focus-visible:shadow-focus" disabled={loadingMore || hasError} onClick={() => setModel((previous) => ({ ...previous, chain: appendCursorPage(previous.chain) }))}>
          {t(loadingMore ? "relations.dismissed.loading" : "relations.dismissed.loadMore")}
        </Button>
      ) : null}
    </div>
  )
}

function DismissedSuggestionRow(props: { row: DismissedRow; busy: boolean; onRestore: (id: DismissalId) => Promise<void> }) {
  const { t, locale } = useDiasporaleT()
  const dateId = useId()
  const { row } = props
  // La projection du serveur fait autorité. Un morceau d'identité isolé ne
  // suffit pas : aucune URL, initiale, présentation ou cible n'en sort.
  const identity = row.handle !== null && row.handle.trim().length > 0 && row.displayName !== null && row.displayName.trim().length > 0
    ? { handle: row.handle, name: row.displayName } : null
  return (
    <li aria-busy={props.busy} className="[content-visibility:auto] [contain-intrinsic-size:auto_12rem]">
      <Card className="flex flex-col gap-3 p-4">
        {identity ? (
          <NextLink href={routes.profile(identity.handle)} className="flex min-h-11 min-w-0 items-center gap-3 rounded-md focus-visible:shadow-focus">
            {row.avatarUrl ? <img src={row.avatarUrl} width={40} height={40} alt="" aria-hidden className="size-10 shrink-0 rounded-full object-cover" loading="lazy" /> : <Avatar id={row.targetPersonId} name={identity.name} />}
            <span className="min-w-0 flex-1">
              <span className="block break-words font-semibold">{identity.name}</span>
              <span className="block truncate text-sm text-muted-foreground">@{identity.handle}</span>
              {row.headline ? <span className="block break-words text-sm text-muted-foreground">{row.headline}</span> : null}
            </span>
          </NextLink>
        ) : <p className="font-semibold">{t("relations.dismissed.neutral")}</p>}
        <time id={dateId} dateTime={new Date(row.at).toISOString()} className="text-sm text-muted-foreground">{t("relations.dismissed.hiddenAt", { date: formatDate(row.at, locale) })}</time>
        <Button variant="outline" className="min-h-11 self-start focus-visible:shadow-focus" aria-label={t("relations.dismissed.restoreLabel", { name: identity?.name ?? t("relations.dismissed.neutral") })} aria-describedby={dateId} aria-busy={props.busy} disabled={props.busy} onClick={() => void props.onRestore(row.dismissalId)}>
          {t(props.busy ? "relations.dismissed.restoring" : "relations.dismissed.restore")}
        </Button>
      </Card>
    </li>
  )
}
