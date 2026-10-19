"use client"

/** DG-023 : une lecture fraîche prépare une copie iCal, sans inscription ni abonnement. */
import { Button } from "@diasporale/features"
import { useSession, type ActionErrorCode, type AssociationEventCalendarCapability, type AssociationEventView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { CalendarDays, Download } from "lucide-react"
import NextLink from "next/link"
import { useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { routes } from "@/lib/routes"

const ICAL_FILENAME = "diasporale-event.ics"
const ICAL_MEDIA_TYPE = "text/calendar;charset=utf-8"

export function AssociationEventCalendar(props: { readonly event: AssociationEventView; readonly capability?: AssociationEventCalendarCapability | null }) {
  const session = useSession()
  if (!props.capability || props.event.moderation !== "published" || session.status !== "ready" || session.data.status !== "signed_in" || !session.data.membership) return null
  const member = session.data.membership
  if (session.data.account.id !== member.personId) return null
  if (member.status === "suspendue" || member.status === "partie" || member.root.status === "suspendue" || member.root.status === "partie") return null
  const context = `${member.personId}:${props.event.eventId}:${props.event.version}:${props.event.audience}:${props.event.registration}:${props.event.status}:${props.event.canManage}:${member.status}:${member.root.status}:${member.canPublish}:${props.capability.mode}`
  return <CalendarDownload key={context} event={props.event} capability={props.capability} />
}

function CalendarDownload(props: { readonly event: AssociationEventView; readonly capability: AssociationEventCalendarCapability }) {
  const { t } = useDiasporaleT()
  const active = useRef(false)
  const generation = useRef(0)
  const locked = useRef(false)
  const urls = useRef(new Set<string>())
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  const [failed, setFailed] = useState(false)
  useLayoutEffect(() => {
    active.current = true
    return () => {
      active.current = false
      generation.current += 1
      for (const timer of timers.current) clearTimeout(timer)
      timers.current.clear()
      for (const url of urls.current) URL.revokeObjectURL(url)
      urls.current.clear()
    }
  }, [])

  async function download() {
    if (locked.current) return
    locked.current = true
    const attempt = ++generation.current
    const current = () => active.current && attempt === generation.current
    setBusy(true)
    setError(null)
    setFailed(false)
    try {
      const result = await props.capability.exportIcal(props.event.eventId)
      if (!current()) return
      if (!result.ok) { setError(result.code); return }
      if (result.value.filename !== ICAL_FILENAME || result.value.mediaType !== ICAL_MEDIA_TYPE || result.value.content.length === 0) { setFailed(true); return }
      const url = URL.createObjectURL(new Blob([result.value.content], { type: ICAL_MEDIA_TYPE }))
      urls.current.add(url)
      const anchor = document.createElement("a")
      try {
        anchor.href = url
        anchor.download = ICAL_FILENAME
        anchor.hidden = true
        document.body.append(anchor)
        anchor.click()
      } finally {
        anchor.remove()
        if (current()) {
          const timer = setTimeout(() => { if (urls.current.delete(url)) URL.revokeObjectURL(url); timers.current.delete(timer) }, 1_000)
          timers.current.add(timer)
        } else if (urls.current.delete(url)) URL.revokeObjectURL(url)
      }
      if (current()) toast.success(t("eventCalendar.prepared"))
    } catch {
      if (current()) setFailed(true)
    } finally {
      locked.current = false
      if (current()) setBusy(false)
    }
  }

  return <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
    <p className="text-sm text-muted-foreground">{t("eventCalendar.exportHint")}</p>
    {props.event.status === "scheduled" && props.event.registration === "waitlisted" ? <p className="text-sm">{t("eventCalendar.waitlistExport")}</p> : null}
    {props.event.status === "cancelled" ? <p className="text-sm">{t("eventCalendar.cancelledExport")}</p> : null}
    {props.capability.mode === "demonstration" ? <p className="text-sm text-muted-foreground">{t("eventCalendar.demoFile")}</p> : null}
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy} aria-busy={busy} onClick={() => void download()}><Download aria-hidden className="size-4" />{t("eventCalendar.download")}</Button><NextLink href={routes.agenda()} className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-primary hover:underline focus-visible:shadow-focus"><CalendarDays aria-hidden className="size-4" />{t("eventCalendar.agendaTitle")}</NextLink></div>
    {error ? <p role="alert" className="text-sm text-destructive">{t(`errors.${error}`)}</p> : failed ? <p role="alert" className="text-sm text-destructive">{t("eventCalendar.downloadFailed")}</p> : null}
  </div>
}
