"use client"

import { Button, Card, EmptyState, Skeleton, formatDate } from "@diasporale/features"
import { useActions, useBookmarks, type BookmarkView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { BookmarkIcon, BookmarkXIcon } from "lucide-react"
import NextLink from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { AppShell } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { routes } from "@/lib/routes"

/** `/enregistrements` — mes signets (EXF-DG-12) : visibles de moi seul ; une publication devenue illisible disparaît. */
export function BookmarksScreen() {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <AppShell membership={session.membership}>
            <Bookmarks />
          </AppShell>
        ) : null
      }
    </Gate>
  )
}

function Bookmarks() {
  const { t } = useDiasporaleT()
  const bookmarks = useBookmarks()
  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold">{t("bookmarks.title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t("bookmarks.lead")}</p>
      </div>
      {bookmarks.status === "loading" ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : bookmarks.status === "error" ? (
        <p role="alert" className="rounded-xl bg-card p-4 text-[15px] shadow-card">
          {t(`errors.${bookmarks.code}`)}
        </p>
      ) : bookmarks.data.length === 0 ? (
        <EmptyState icon={<BookmarkIcon />} title={t("bookmarks.emptyTitle")} description={t("bookmarks.emptyBody")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {bookmarks.data.map((bookmark) => (
            <BookmarkRow key={bookmark.postId} bookmark={bookmark} />
          ))}
        </ul>
      )}
    </>
  )
}

function BookmarkRow(props: { bookmark: BookmarkView }) {
  const { t, locale } = useDiasporaleT()
  const actions = useActions()
  const [busy, setBusy] = useState(false)
  const { bookmark } = props
  const name = bookmark.author.displayName ?? t("bell.someone")

  const remove = async () => {
    setBusy(true)
    const result = await actions.toggleBookmark(bookmark.postId)
    setBusy(false)
    if (result.ok) toast.success(t("postMenu.unbookmarked"))
    else toast.error(t(`errors.${result.code}`))
  }

  return (
    <li>
      <Card className="flex flex-col gap-2 p-4">
        <p className="text-[13px] text-muted-foreground">
          <span className="font-semibold text-foreground">{name}</span> · {formatDate(bookmark.publishedAt, locale)}
        </p>
        <p className="line-clamp-3 whitespace-pre-line text-[15px] leading-relaxed">{bookmark.body}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <NextLink href={routes.post(bookmark.postId)}>{t("bookmarks.open")}</NextLink>
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={remove}>
            <BookmarkXIcon aria-hidden />
            {t("bookmarks.remove")}
          </Button>
        </div>
      </Card>
    </li>
  )
}
