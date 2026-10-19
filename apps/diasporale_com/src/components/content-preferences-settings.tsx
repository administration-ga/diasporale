"use client"

import {
  Avatar,
  Button,
  Card,
  FolderTabs,
  FolderTabsContent,
  FolderTabsList,
  FolderTabsTrigger,
  Skeleton,
  formatDate,
} from "@diasporale/features"
import {
  useDataSource,
  type ContentPreferenceItem,
  type ContentPreferenceKind,
  type ContentPreferences,
  type MembershipView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { EyeOffIcon, VolumeXIcon } from "lucide-react"
import NextLink from "next/link"
import { useId, useLayoutEffect, useRef, useState } from "react"

import { routes } from "@/lib/routes"

/** Des choix privés réversibles, sans transformer un masquage en droit de lecture. */
export function ContentPreferencesSettings({ membership }: { membership: MembershipView }) {
  const source = useDataSource()
  const { t } = useDiasporaleT()
  const titleId = useId()
  const preferences = source.contentPreferences
  if (!preferences) return null

  return (
    <section id="mon-fil" aria-labelledby={titleId} className="scroll-mt-20">
      <Card className="flex min-w-0 flex-col gap-4 p-5">
        <div>
          <h2 id={titleId} className="font-display text-xl font-bold">{t("settings.contentPreferences.title")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("settings.contentPreferences.lead")}</p>
        </div>
        <FolderTabs key={`${source.kind}:${membership.personId}`} defaultValue="hiddenPosts" className="min-w-0">
          <FolderTabsList aria-label={t("settings.contentPreferences.title")} className="flex-wrap overflow-visible">
            <FolderTabsTrigger value="hiddenPosts" className="min-h-11 flex-1 whitespace-normal px-3 text-center">
              <EyeOffIcon aria-hidden className="size-4 shrink-0" />{t("settings.contentPreferences.hiddenTab")}
            </FolderTabsTrigger>
            <FolderTabsTrigger value="mutedAuthors" className="min-h-11 flex-1 whitespace-normal px-3 text-center">
              <VolumeXIcon aria-hidden className="size-4 shrink-0" />{t("settings.contentPreferences.mutedTab")}
            </FolderTabsTrigger>
          </FolderTabsList>
          {(["hiddenPosts", "mutedAuthors"] as const).map((kind) => (
            <FolderTabsContent key={kind} value={kind}>
              <PreferencePage personId={membership.personId} preferences={preferences} kind={kind} />
            </FolderTabsContent>
          ))}
        </FolderTabs>
      </Card>
    </section>
  )
}

function PreferencePage({ personId, preferences, kind }: { personId: string; preferences: ContentPreferences; kind: ContentPreferenceKind }) {
  const { t } = useDiasporaleT()
  const [navigation, setNavigation] = useState<{ cursors: readonly (string | null)[]; index: number }>({ cursors: [null], index: 0 })
  const cursor = navigation.cursors[navigation.index] ?? null
  const page = preferences.usePage({ personId, kind, cursor })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [restored, setRestored] = useState<ReadonlySet<string>>(new Set())
  const [feedback, setFeedback] = useState<{ key: string; error: boolean } | null>(null)
  const pending = useRef<string | null>(null)
  const active = useRef(false)
  const results = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  const entries = page.status === "ready" ? page.data.items.filter((entry) => !restored.has(entry.choiceId)) : []
  const nextCursor = page.status === "ready" && !page.data.isDone ? page.data.continueCursor : null
  const canNext = nextCursor !== null && !navigation.cursors.slice(0, navigation.index + 1).includes(nextCursor)
  const canPrevious = navigation.index > 0
  const blocked = busyId !== null || retrying || page.status === "loading"

  const restore = async (entry: ContentPreferenceItem) => {
    if (!active.current || pending.current !== null || page.status !== "ready") return
    if (!page.data.items.some((current) => current.choiceId === entry.choiceId)) return
    pending.current = entry.choiceId
    setBusyId(entry.choiceId)
    setFeedback(null)
    try {
      const result = await preferences.restore({ personId, kind, choiceId: entry.choiceId })
      if (!active.current) return
      if (!result.ok) {
        setFeedback({ key: `errors.${result.code}`, error: true })
        return
      }
      setRestored((previous) => new Set([...previous, entry.choiceId]))
      setFeedback({
        key: result.value.restored
          ? kind === "hiddenPosts" ? "settings.contentPreferences.restoredHidden" : "settings.contentPreferences.restoredMuted"
          : "settings.contentPreferences.moved",
        error: false,
      })
      results.current?.focus()
    } catch {
      if (active.current) setFeedback({ key: "errors.unknown", error: true })
    } finally {
      pending.current = null
      if (active.current) setBusyId(null)
    }
  }

  const retry = async () => {
    if (retrying || pending.current !== null || !page.retry) return
    setRetrying(true)
    setFeedback(null)
    try { await page.retry() } catch { /* L'état de lecture conserve son erreur traduite. */ }
    finally { if (active.current) setRetrying(false) }
  }

  const previous = () => {
    if (blocked || !canPrevious) return
    setFeedback(null)
    setNavigation((current) => ({ ...current, index: current.index - 1 }))
  }
  const next = () => {
    if (blocked || !canNext || nextCursor === null) return
    setFeedback(null)
    setNavigation((current) => ({ cursors: [...current.cursors.slice(0, current.index + 1), nextCursor], index: current.index + 1 }))
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div ref={results} tabIndex={-1} className="min-w-0 rounded-md focus-visible:shadow-focus" aria-busy={page.status === "loading" || retrying}>
        {page.status === "loading" ? (
          <div role="status" className="flex flex-col gap-3">
            <span className="sr-only">{t("common.pleaseWait")}</span>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : page.status === "error" ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-sm">{t("settings.contentPreferences.error")}</p>
            {page.retry ? <Button variant="outline" disabled={retrying} onClick={() => void retry()}>{t("settings.contentPreferences.retry")}</Button> : null}
          </div>
        ) : entries.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            {t(navigation.index > 0 || !page.data.isDone
              ? "settings.contentPreferences.emptyPage"
              : kind === "hiddenPosts" ? "settings.contentPreferences.emptyHidden" : "settings.contentPreferences.emptyMuted")}
          </p>
        ) : (
          <ul className="flex min-w-0 flex-col gap-3">
            {entries.map((entry) => (
              <PreferenceRow key={entry.choiceId} entry={entry} kind={kind} busyId={busyId} restore={() => void restore(entry)} />
            ))}
          </ul>
        )}
      </div>
      {feedback ? <p role={feedback.error ? "alert" : "status"} className={feedback.error ? "text-sm text-destructive" : "text-sm text-foreground"}>{t(feedback.key)}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" aria-disabled={!canPrevious || blocked} className="aria-disabled:opacity-55" onClick={previous}>
          {t("settings.contentPreferences.previous")}
        </Button>
        <span className="text-sm text-muted-foreground">{t("settings.contentPreferences.page", { number: navigation.index + 1 })}</span>
        <Button variant="outline" aria-disabled={!canNext || blocked} className="aria-disabled:opacity-55" onClick={next}>
          {t("settings.contentPreferences.next")}
        </Button>
      </div>
    </div>
  )
}

function PreferenceRow({ entry, kind, busyId, restore }: { entry: ContentPreferenceItem; kind: ContentPreferenceKind; busyId: string | null; restore: () => void }) {
  const { t, locale } = useDiasporaleT()
  const hidden = kind === "hiddenPosts"
  const author = entry.author
  const authorHref = author?.handle ? (author.kind === "page" ? routes.page(author.handle) : routes.profile(author.handle)) : null
  const unavailable = hidden ? entry.postId === null : author === null
  const authorName = author?.displayName ?? t("settings.contentPreferences.unknownAuthor")
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar id={entry.choiceId} name={authorName} shape={author?.kind === "page" ? "square" : "round"} />
        <div className="min-w-0 flex-1">
          {authorHref ? <NextLink href={authorHref} className="break-words font-semibold text-primary hover:underline focus-visible:shadow-focus">{authorName}</NextLink> : <p className="break-words font-semibold">{hidden && unavailable ? t("settings.contentPreferences.unavailablePost") : authorName}</p>}
          {entry.at > 0 ? <p className="mt-1 text-xs text-muted-foreground">{t(hidden ? "settings.contentPreferences.hiddenAt" : "settings.contentPreferences.mutedAt", { date: formatDate(entry.at, locale) })}</p> : null}
        </div>
      </div>
      {hidden && entry.postId !== null ? <p className="line-clamp-3 whitespace-pre-line break-words text-sm">{entry.body?.trim() || t("settings.contentPreferences.noText")}</p> : null}
      {unavailable ? <p className="text-xs leading-relaxed text-muted-foreground">{t("settings.contentPreferences.unavailableLead")}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {hidden && entry.postId !== null ? <Button asChild variant="ghost"><NextLink href={routes.post(entry.postId)}>{t("settings.contentPreferences.showPost")}</NextLink></Button> : null}
        <Button variant="outline" aria-disabled={busyId !== null} aria-busy={busyId === entry.choiceId} onClick={restore} className="h-auto min-h-11 max-w-full whitespace-normal py-2 text-left aria-disabled:opacity-55">
          {t(busyId === entry.choiceId ? "settings.contentPreferences.restoring" : hidden ? "settings.contentPreferences.restoreHidden" : "settings.contentPreferences.restoreMuted")}
        </Button>
      </div>
    </li>
  )
}
