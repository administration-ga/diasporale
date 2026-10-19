"use client"

/** DG-010 : événements sous identité d'association, audience explicite et inscription personnelle. */
import { associationEventReminderAt, isAssociationEventRegistrationOpen } from "@diasporale/domain"
import { Button, Card, Checkbox, Sheet, SheetContent, Skeleton } from "@diasporale/features"
import { useAssociationEvents, useSession, type ActionErrorCode, type AssociationEventView, type AssociationEventsCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import NextLink from "next/link"
import { useId, useState } from "react"
import { toast } from "sonner"

import { routes } from "@/lib/routes"

import { AssociationEventForm } from "./association-event-form"
import { AssociationEventAttendance } from "./association-event-attendance"
import { AssociationEventGallery } from "./association-event-gallery"
import { AssociationEventCalendar } from "./association-event-calendar"
import { ServicePager } from "./service-pager"
import { ConfirmSheet } from "./service-request-sheets"
import { browserTimeZone, formatServiceInstant, SlotText, useNow } from "./service-request-ui"
import { useReviewTask as useActivityTask } from "./service-review-editor"

export function AssociationEventsSection(props: { readonly pageId: string; readonly handle: string; readonly canManage: boolean }) {
  const capability = useAssociationEvents()
  const session = useSession()
  if (!capability || session.status !== "ready" || session.data.status !== "signed_in" || !session.data.membership) return null
  return <EventsSection key={`${session.data.membership.personId}:${props.pageId}`} {...props} canManage={props.canManage && session.data.membership.canPublish} capability={capability} />
}

function EventsSection(props: { readonly pageId: string; readonly handle: string; readonly canManage: boolean; readonly capability: AssociationEventsCapability }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const [create, setCreate] = useState(false)
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id={id} className="font-display text-xl font-bold">{t("associationActivities.event.sectionTitle")}</h2>{props.canManage ? <Button variant="outline" onClick={() => setCreate(true)}>{t("associationActivities.event.create")}</Button> : null}</div>
      <p className="text-sm text-muted-foreground">{t("associationActivities.event.lead")}</p>
      <ServicePager read={(cursor) => props.capability.useEvents({ pageId: props.pageId, cursor })} keyOf={(event) => event.eventId} empty={<p className="rounded-lg bg-muted p-4">{t("associationActivities.event.empty")}</p>}>
        {(events) => <ul className="flex flex-col gap-3">{events.map((event) => <li key={event.eventId}><AssociationEventCard event={event} capability={props.capability} handle={props.handle} /></li>)}</ul>}
      </ServicePager>
      {create ? <EventEditor pageId={props.pageId} capability={props.capability} initial={null} onClose={() => setCreate(false)} /> : null}
    </section>
  )
}

export function AssociationEventDetail(props: { readonly pageId: string; readonly handle: string; readonly eventId: string }) {
  const capability = useAssociationEvents()
  const session = useSession()
  const { t } = useDiasporaleT()
  if (!capability) return <Card className="p-4">{t("errors.feature_unavailable")}</Card>
  if (session.status !== "ready") return <Skeleton className="h-32 w-full rounded-xl" />
  if (session.data.status !== "signed_in" || !session.data.membership) return null
  return <EventDetail key={`${session.data.membership.personId}:${props.eventId}`} {...props} capability={capability} />
}

function EventDetail(props: { readonly pageId: string; readonly handle: string; readonly eventId: string; readonly capability: AssociationEventsCapability }) {
  const { t } = useDiasporaleT()
  const query = props.capability.useEvent(props.eventId)
  if (query.status === "loading") return <Skeleton className="h-32 w-full rounded-xl" />
  if (query.status === "error") return <Card role="alert" className="p-4">{t(`errors.${query.code}`)}</Card>
  if (!query.data || query.data.pageId !== props.pageId) return <Card className="p-4">{t("errors.not_found")}</Card>
  return <AssociationEventCard event={query.data} handle={props.handle} capability={props.capability} detail />
}

function EventEditor(props: { readonly pageId: string; readonly initial: AssociationEventView | null; readonly capability: AssociationEventsCapability; readonly onClose: () => void }) {
  const { t } = useDiasporaleT()
  return (
    <Sheet open onOpenChange={(open) => { if (!open) props.onClose() }}>
      <SheetContent title={t(props.initial ? "associationActivities.event.edit" : "associationActivities.event.create")} description={t("associationActivities.event.editorLead")} closeLabel={t("associationActivities.close")}>
        <AssociationEventForm key={`${props.initial?.eventId ?? props.pageId}:${props.initial?.version ?? 0}`} pageId={props.pageId} initial={props.initial} capability={props.capability} onCancel={props.onClose} onSaved={() => { props.onClose(); toast.success(t("associationActivities.event.saved")) }} />
      </SheetContent>
    </Sheet>
  )
}

function AssociationEventCard(props: { readonly event: AssociationEventView; readonly handle: string; readonly capability: AssociationEventsCapability; readonly detail?: boolean }) {
  const { t, locale } = useDiasporaleT()
  const session = useSession()
  const task = useActivityTask()
  const now = useNow()
  const [viewerZone] = useState(browserTimeZone)
  const [editor, setEditor] = useState<AssociationEventView | null>(null)
  const [cancelling, setCancelling] = useState<AssociationEventView | null>(null)
  const placeHintId = useId()
  const reminderId = useId()
  const { event } = props
  const confirmed = event.registration === "confirmed"
  const waitlisted = event.registration === "waitlisted"
  const registrationOpen = event.registrationOpen && isAssociationEventRegistrationOpen(event, now)
  const placesOpen = event.status === "scheduled" && registrationOpen && event.moderation === "published"
  const canPublish = session.status === "ready" && session.data.status === "signed_in" && session.data.membership?.canPublish === true
  const canRequest = placesOpen && canPublish && event.canRegister && event.registration === "none"
  const reminderTooLate = now >= associationEventReminderAt(event.startAt)
  const canEnableReminder = event.status === "scheduled" && event.moderation === "published" && !reminderTooLate
  const full = event.capacity !== null && event.remainingPlaces === 0
  const formatNumber = new Intl.NumberFormat(locale)
  function requestPlace() {
    if (!placesOpen || !canPublish || !isAssociationEventRegistrationOpen(event, Date.now())) return
    void task.run(() => props.capability.register(event.eventId), () => toast.success(t("associationActivities.event.requestSaved")))
  }
  function setReminder(enabled: boolean) {
    if (enabled && (!canEnableReminder || Date.now() >= associationEventReminderAt(event.startAt))) return
    void task.run(() => props.capability.setReminder({ eventId: event.eventId, enabled }), () => toast.success(t("associationActivities.event.reminderSaved")))
  }
  async function cancel(): Promise<ActionErrorCode | null> {
    if (!cancelling) return null
    const result = await props.capability.cancel({ eventId: cancelling.eventId, expectedVersion: cancelling.version })
    return result.ok ? null : result.code
  }
  const title = <span className="break-words">{event.title}</span>
  const Heading = props.detail ? "h1" : "h3"
  return (
    <Card className="flex min-w-0 flex-col gap-3 p-4">
      <Heading className="text-lg font-semibold">{props.detail ? title : <NextLink href={routes.associationEvent(props.handle, event.eventId)} className="rounded-sm hover:underline focus-visible:shadow-focus">{title}</NextLink>}</Heading>
      <p className="text-sm font-medium">{event.organizer.name}</p>
      <SlotText slot={{ startAt: event.startAt, endAt: event.endAt }} timeZone={event.timeZone} viewerTimeZone={viewerZone} />
      <p className="text-sm">{t("associationActivities.event.registrationDeadline", { date: formatServiceInstant(event.registrationClosesAt ?? event.startAt, event.timeZone, locale), zone: event.timeZone })}</p>
      <p className="text-sm text-muted-foreground">{t("associationActivities.event.registrationClosureRule")}</p>
      {event.status === "scheduled" && !registrationOpen ? <p className="text-sm font-semibold">{t("associationActivities.event.registrationClosed")}</p> : null}
      <p className="text-sm text-muted-foreground">{t(event.audience === "association" ? "associationActivities.event.membersOnly" : "associationActivities.event.network")}</p>
      <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 text-sm sm:grid-cols-4">
        <div><dt className="text-muted-foreground">{t("associationActivities.event.capacityLabel")}</dt><dd className="font-semibold">{event.capacity === null ? t("associationActivities.event.unlimited") : formatNumber.format(event.capacity)}</dd></div>
        <div><dt className="text-muted-foreground">{t("associationActivities.event.confirmedLabel")}</dt><dd className="font-semibold">{formatNumber.format(event.confirmedCount)}</dd></div>
        <div><dt className="text-muted-foreground">{t("associationActivities.event.remainingLabel")}</dt><dd className="font-semibold">{event.remainingPlaces === null ? t("associationActivities.event.unlimited") : formatNumber.format(event.remainingPlaces)}</dd></div>
        <div><dt className="text-muted-foreground">{t("associationActivities.event.waitlistLabel")}</dt><dd className="font-semibold">{formatNumber.format(event.waitlistCount)}</dd></div>
      </dl>
      {event.location ? <p className="whitespace-pre-line break-words">{event.location}</p> : null}
      {event.description ? <p className="whitespace-pre-line break-words">{event.description}</p> : null}
      {event.status === "cancelled" ? <p role="status" className="font-semibold">{t("associationActivities.event.cancelled")}</p> : event.endAt <= now ? <p role="status">{t("associationActivities.event.past")}</p> : null}
      {event.moderation !== "published" ? <p role="status" className="text-sm text-muted-foreground">{t(event.moderation === "removed" ? "associationActivities.removed" : "associationActivities.pending")}</p> : null}
      {confirmed ? <p role="status">{t("associationActivities.event.registered")}</p> : null}
      {waitlisted ? <p role="status">{event.waitlistPosition === null ? t("associationActivities.event.waitlisted") : t("associationActivities.event.waitlistPosition", { position: formatNumber.format(event.waitlistPosition) })}</p> : null}
      {canRequest ? <p id={placeHintId} className="text-sm text-muted-foreground">{t("associationActivities.event.placeRequestConsent")}</p> : null}
      <div className="flex flex-wrap gap-2">
        {canRequest ? <Button disabled={task.busy} aria-busy={task.busy} aria-describedby={placeHintId} onClick={requestPlace}>{t(full ? "associationActivities.event.joinWaitlist" : "associationActivities.event.register")}</Button> : null}
        {waitlisted && placesOpen && canPublish ? <Button variant="outline" disabled={task.busy} aria-busy={task.busy} onClick={requestPlace}>{t("associationActivities.event.refreshPlace")}</Button> : null}
        {confirmed || waitlisted ? <Button variant="outline" disabled={task.busy} aria-busy={task.busy} onClick={() => void task.run(() => props.capability.unregister(event.eventId), () => toast.success(t(waitlisted ? "associationActivities.event.waitlistWithdrawn" : "associationActivities.event.unregistered")))}>{t(waitlisted ? "associationActivities.event.withdrawWaitlist" : "associationActivities.event.unregister")}</Button> : null}
        {event.canManage && event.status === "scheduled" ? <><Button variant="outline" onClick={() => setEditor(event)}>{t("associationActivities.event.edit")}</Button><Button variant="ghost" onClick={() => setCancelling(event)}>{t("associationActivities.event.cancelEvent")}</Button></> : null}
      </div>
      {confirmed || waitlisted ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
          <div className="flex items-start gap-2">
            <Checkbox id={reminderId} checked={event.reminderEnabled} disabled={task.busy || (!event.reminderEnabled && !canEnableReminder)} aria-describedby={`${reminderId}-hint`} onCheckedChange={(enabled) => setReminder(enabled === true)} />
            <label htmlFor={reminderId}>{t("associationActivities.event.reminderChoice")}</label>
          </div>
          <p id={`${reminderId}-hint`} className="text-muted-foreground">{t("associationActivities.event.reminderHint")}</p>
          {props.capability.reminderDelivery === "preferences_only" ? <p className="text-muted-foreground">{t("associationActivities.event.reminderDemo")}</p> : null}
          <p>{event.reminderState === "recorded" ? t("associationActivities.event.reminderRecorded")
            : event.reminderState === "waiting_confirmation" ? t("associationActivities.event.reminderWaiting")
            : event.reminderState === "scheduled" ? t("associationActivities.event.reminderScheduled", { date: formatServiceInstant(event.reminderAt ?? associationEventReminderAt(event.startAt), event.timeZone, locale), zone: event.timeZone })
            : event.reminderState === "expired" ? t("associationActivities.event.reminderExpired")
            : t("associationActivities.event.reminderOff")}</p>
          {!event.reminderEnabled && reminderTooLate ? <p className="text-muted-foreground">{t("associationActivities.event.reminderTooLate")}</p> : null}
        </div>
      ) : null}
      {props.detail && props.capability.attendance ? <AssociationEventAttendance event={event} capability={props.capability.attendance} /> : null}
      {props.detail && props.capability.gallery ? <AssociationEventGallery event={event} capability={props.capability.gallery} /> : null}
      {props.detail && props.capability.calendar ? <AssociationEventCalendar event={event} capability={props.capability.calendar} /> : null}
      {task.error ? <p role="alert" className="text-sm text-destructive">{t(`errors.${task.error}`)}</p> : null}
      {editor ? <EventEditor initial={editor} pageId={event.pageId} capability={props.capability} onClose={() => setEditor(null)} /> : null}
      {cancelling ? <ConfirmSheet open onOpenChange={(open) => { if (!open) setCancelling(null) }} title={t("associationActivities.event.cancelEvent")} description={t("associationActivities.event.cancelDescription")} confirmLabel={t("associationActivities.event.cancelEvent")} destructive onConfirm={cancel} /> : null}
    </Card>
  )
}
