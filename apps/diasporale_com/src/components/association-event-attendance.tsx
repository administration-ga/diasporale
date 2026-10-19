"use client"

/** DG-023 : le code prépare un accueil ; seul un responsable confirme le pointage. */
import { OpaqueQrCode } from "@antsia/social-features/qr"
import { ASSOCIATION_EVENT_ATTENDANCE_TICKET_TTL_MS, isAssociationEventAttendanceOpen, parseAssociationEventAttendanceCode } from "@diasporale/domain"
import { Button, Field, Input, Sheet, SheetContent, Skeleton } from "@diasporale/features"
import { useSession, type ActionErrorCode, type ActionResult, type AssociationEventAttendanceCapability, type AssociationEventAttendancePreview, type AssociationEventAttendanceRow, type AssociationEventAttendanceTicket, type AssociationEventAttendanceView, type AssociationEventView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { Camera, Copy, RefreshCw } from "lucide-react"
import { useId, useLayoutEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { useAttendanceCamera } from "./association-event-camera"
import { ServicePager } from "./service-pager"
import { formatServiceInstant, useNow } from "./service-request-ui"

const codeSchema = z.object({ code: z.string().trim().refine((code) => parseAssociationEventAttendanceCode(code) !== null, "association_event_attendance_code_invalid") })
type CodeValues = z.infer<typeof codeSchema>

/** La génération d'une instance ne peut plus agir après sa sortie. */
function useAttendanceTask() {
  const active = useRef(false)
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ActionErrorCode | null>(null)
  useLayoutEffect(() => { active.current = true; return () => { active.current = false } }, [])
  async function run<T>(work: () => Promise<ActionResult<T>>, success: (value: T) => void, refused?: () => void) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await work()
      if (!active.current) return
      if (result.ok) success(result.value)
      else { setError(result.code); refused?.() }
    } catch {
      if (active.current) { setError("unknown"); refused?.() }
    } finally {
      locked.current = false
      if (active.current) setBusy(false)
    }
  }
  return { busy, error, run }
}

interface AttendanceProps {
  readonly event: AssociationEventView
  readonly capability: AssociationEventAttendanceCapability
}

export function AssociationEventAttendance(props: AttendanceProps) {
  const session = useSession()
  if (session.status !== "ready" || session.data.status !== "signed_in" || !session.data.membership) return null
  const member = session.data.membership
  if (member.status === "suspendue" || member.status === "partie" || member.root.status === "suspendue" || member.root.status === "partie" || props.event.moderation !== "published") return null
  return <AttendanceReader key={`${member.personId}:${props.event.pageId}:${props.event.eventId}:${props.capability.mode}`} {...props} />
}

function AttendanceReader(props: AttendanceProps) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const now = useNow(1_000)
  const query = props.capability.useAttendance(props.event.eventId)
  if (query.status === "loading") return <Skeleton className="h-24 w-full rounded-xl" />
  if (query.status === "error") return <p role="alert" className="text-sm text-destructive">{t(`errors.${query.code}`)}</p>
  const view = query.data
  if (!view || view.eventId !== props.event.eventId) return null
  const open = props.event.status === "scheduled" && view.isOpen && now >= view.opensAt && now < view.closesAt && isAssociationEventAttendanceOpen(props.event, now)
  const canIssue = open && view.canIssueTicket && props.event.registration === "confirmed" && view.checkedInAt === null
  const canManage = view.canManage && props.event.canManage
  // Un changement de contexte démonte les actions et leurs réponses encore en vol.
  const context = `${props.event.version}:${props.event.registration}:${props.event.status}:${view.canIssueTicket}:${canManage}:${open}:${view.checkedInAt}`
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4">
      <h2 id={id} className="font-display text-xl font-bold">{t("associationAttendance.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("associationAttendance.lead")}</p>
      {props.capability.mode === "demonstration" ? <p className="rounded-lg bg-muted p-3 text-sm">{t("associationAttendance.demo")}</p> : null}
      <p className="text-sm">{t("associationAttendance.window", { opens: formatServiceInstant(view.opensAt, props.event.timeZone, locale), closes: formatServiceInstant(view.closesAt, props.event.timeZone, locale), zone: props.event.timeZone })}</p>
      {!open ? <p>{t("associationAttendance.closed")}</p> : null}
      {view.checkedInAt !== null ? <p role="status">{t("associationAttendance.ownRecorded", { date: formatServiceInstant(view.checkedInAt, props.event.timeZone, locale) })}</p> : null}
      <AttendanceActions key={context} {...props} view={view} now={now} open={open} canIssue={canIssue} canManage={canManage} />
    </section>
  )
}

function AttendanceActions(props: AttendanceProps & { readonly view: AssociationEventAttendanceView; readonly now: number; readonly open: boolean; readonly canIssue: boolean; readonly canManage: boolean }) {
  return <>
    {props.canIssue ? <PersonalTicket {...props} /> : null}
    {props.canManage ? <ManagerAttendance {...props} /> : null}
  </>
}

function PersonalTicket(props: AttendanceProps & { readonly now: number }) {
  const { t, locale } = useDiasporaleT()
  const task = useAttendanceTask()
  const [ticket, setTicket] = useState<AssociationEventAttendanceTicket | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const live = ticket !== null && ticket.expiresAt > props.now
  useLayoutEffect(() => { if (ticket && !live) { setTicket(null); setCopyFailed(false) } }, [ticket, live])
  function issue() {
    if (!isAssociationEventAttendanceOpen(props.event, Date.now())) return
    setTicket(null)
    setCopyFailed(false)
    void task.run(() => props.capability.issueTicket(props.event.eventId), (value) => {
      const now = Date.now()
      if (!parseAssociationEventAttendanceCode(value.code) || value.expiresAt <= now || value.expiresAt > now + ASSOCIATION_EVENT_ATTENDANCE_TICKET_TTL_MS || !isAssociationEventAttendanceOpen(props.event, now)) return
      setTicket(value)
    })
  }
  function copy() {
    if (!ticket || ticket.expiresAt <= Date.now() || !isAssociationEventAttendanceOpen(props.event, Date.now())) { setTicket(null); return }
    if (!navigator.clipboard?.writeText) { setCopyFailed(true); return }
    void task.run(async () => { await navigator.clipboard.writeText(ticket.code); return { ok: true, value: null } }, () => toast.success(t("associationAttendance.copied")), () => setCopyFailed(true))
  }
  return (
    <div className="flex min-w-0 flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">{t("associationAttendance.ticketPrivacy")}</p>
      <Button disabled={task.busy} aria-busy={task.busy} onClick={issue}><RefreshCw aria-hidden className="size-4" />{t(ticket ? "associationAttendance.renew" : "associationAttendance.issue")}</Button>
      {live && ticket ? <>
        <OpaqueQrCode value={ticket.code} title={t("associationAttendance.qrTitle")} />
        <p className="text-sm">{t("associationAttendance.expires", { date: formatServiceInstant(ticket.expiresAt, props.event.timeZone, locale) })}</p>
        <details className="w-full min-w-0 text-sm"><summary className="cursor-pointer rounded-sm font-medium focus-visible:shadow-focus">{t("associationAttendance.showCode")}</summary><p className="mt-2 break-all rounded-lg bg-muted p-3 font-mono">{ticket.code}</p></details>
        <Button variant="outline" disabled={task.busy} onClick={copy}><Copy aria-hidden className="size-4" />{t("associationAttendance.copy")}</Button>
      </> : null}
      {copyFailed ? <p className="text-sm text-destructive">{t("associationAttendance.copyFailed")}</p> : null}
      {task.error ? <p role="alert" className="text-sm text-destructive">{t(`errors.${task.error}`)}</p> : null}
    </div>
  )
}

function ManagerAttendance(props: AttendanceProps & { readonly view: AssociationEventAttendanceView; readonly now: number; readonly open: boolean }) {
  const { t, locale } = useDiasporaleT()
  return <div className="flex min-w-0 flex-col gap-4">
    {props.open ? <TicketReader {...props} /> : null}
    <h3 className="font-semibold">{t("associationAttendance.presentTitle")}</h3>
    {props.view.recordedCount !== null ? <p>{t("associationAttendance.count", { total: new Intl.NumberFormat(locale).format(props.view.recordedCount) })}</p> : null}
    <p className="text-sm text-muted-foreground">{t("associationAttendance.countHint")}</p>
    <ServicePager read={(cursor) => props.capability.usePresent({ eventId: props.event.eventId, cursor })} keyOf={(row) => row.registrationId} empty={<p>{t("associationAttendance.empty")}</p>}>
      {(rows) => <PresentRows {...props} rows={rows} />}
    </ServicePager>
  </div>
}

function PresentRows(props: AttendanceProps & { readonly rows: readonly AssociationEventAttendanceRow[] }) {
  const { t, locale } = useDiasporaleT()
  const [correcting, setCorrecting] = useState<{ readonly registrationId: string; readonly expectedVersion: number } | null>(null)
  const task = useAttendanceTask()
  const row = correcting ? props.rows.find((item) => item.registrationId === correcting.registrationId) : undefined
  useLayoutEffect(() => { if (correcting && !row) setCorrecting(null) }, [correcting, row])
  function clear() {
    if (!correcting || !row) return
    const snapshot = correcting
    void task.run(() => props.capability.clear({ eventId: props.event.eventId, ...snapshot }), () => { setCorrecting(null); toast.success(t("associationAttendance.corrected")) })
  }
  return <>
    <ul className="flex flex-col gap-3">{props.rows.map((item) => <li key={item.registrationId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-3"><div><p className="font-medium">{item.displayName || t("associationAttendance.neutralName")}</p><p className="text-sm">{formatServiceInstant(item.checkedInAt, props.event.timeZone, locale)}</p></div><Button variant="outline" disabled={task.busy} onClick={() => setCorrecting({ registrationId: item.registrationId, expectedVersion: item.version })}>{t("associationAttendance.correct")}</Button></li>)}</ul>
    {task.error && !correcting ? <p role="alert" className="text-sm text-destructive">{t(`errors.${task.error}`)}</p> : null}
    {correcting && row ? <Sheet open onOpenChange={(open) => { if (!open && !task.busy) setCorrecting(null) }}><SheetContent title={t("associationAttendance.correctTitle")} description={t("associationAttendance.correctHint")} closeLabel={t("associationAttendance.close")}>
      <div className="flex flex-col gap-3"><p className="font-semibold">{row.displayName || t("associationAttendance.neutralName")}</p><p>{formatServiceInstant(row.checkedInAt, props.event.timeZone, locale)}</p>
        {task.error ? <p role="alert" className="text-sm text-destructive">{t(`errors.${task.error}`)}</p> : null}
        <div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={task.busy} aria-busy={task.busy} onClick={clear}>{t("associationAttendance.confirmCorrection")}</Button><Button variant="ghost" disabled={task.busy} onClick={() => setCorrecting(null)}>{t("associationAttendance.cancel")}</Button></div>
      </div>
    </SheetContent></Sheet> : null}
  </>
}

function TicketReader(props: AttendanceProps & { readonly now: number }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const task = useAttendanceTask()
  const [preview, setPreview] = useState<(Omit<AssociationEventAttendancePreview, "displayName"> & { readonly code: string }) | null>(null)
  const [scanned, setScanned] = useState(false)
  const form = useForm<CodeValues>({ resolver: zodResolver(codeSchema), defaultValues: { code: "" } })
  const camera = useAttendanceCamera((code) => { setPreview(null); form.setValue("code", code, { shouldValidate: true }); setScanned(true) })
  const validPreview = preview !== null && preview.expiresAt > props.now
  useLayoutEffect(() => { if (preview && !validPreview) { setPreview(null); form.reset({ code: "" }) } }, [preview, validPreview, form])
  const submit = form.handleSubmit((values) => {
    camera.stop()
    setPreview(null)
    if (!isAssociationEventAttendanceOpen(props.event, Date.now())) return
    return task.run(() => props.capability.previewTicket({ eventId: props.event.eventId, code: values.code }), (value) => {
      if (value.expiresAt <= Date.now() || !isAssociationEventAttendanceOpen(props.event, Date.now())) return
      // Le nom renvoyé ponctuellement n'est pas conservé : aucune lecture réactive de ce profil.
      setPreview({ registrationId: value.registrationId, checkedInAt: value.checkedInAt, version: value.version, expiresAt: value.expiresAt, code: values.code })
    })
  })
  function checkIn() {
    if (!preview || preview.expiresAt <= Date.now() || !isAssociationEventAttendanceOpen(props.event, Date.now())) { setPreview(null); form.reset({ code: "" }); return }
    const snapshot = preview
    void task.run(() => props.capability.checkIn({ eventId: props.event.eventId, code: snapshot.code, expectedVersion: snapshot.version }), (value) => { setPreview(null); form.reset({ code: "" }); toast.success(t(value.alreadyRecorded ? "associationAttendance.alreadyRecorded" : "associationAttendance.recorded")) }, () => { setPreview(null); form.reset({ code: "" }) })
  }
  return <div className="flex min-w-0 flex-col gap-3">
    <h3 className="font-semibold">{t("associationAttendance.readerTitle")}</h3>
    <p className="text-sm text-muted-foreground">{t("associationAttendance.cameraHint")}</p>
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={task.busy || camera.state !== "idle"} onClick={() => { setPreview(null); form.reset({ code: "" }); setScanned(false); void camera.start() }}><Camera aria-hidden className="size-4" />{t("associationAttendance.startCamera")}</Button>{camera.state !== "idle" ? <Button variant="ghost" onClick={camera.stop}>{t("associationAttendance.stopCamera")}</Button> : null}</div>
    <video ref={camera.video} muted playsInline hidden={camera.state === "idle"} aria-label={t("associationAttendance.videoLabel")} className="max-h-80 w-full rounded-lg bg-muted object-contain" />
    {camera.state === "starting" ? <p role="status">{t("associationAttendance.cameraStarting")}</p> : null}
    {camera.error ? <p role="alert" className="text-sm text-destructive">{t(camera.error === "unavailable" ? "associationAttendance.cameraUnavailable" : camera.error === "denied" ? "associationAttendance.cameraDenied" : camera.error === "invalidCode" ? "errors.association_event_attendance_code_invalid" : "associationAttendance.cameraFailed")}</p> : null}
    {scanned ? <p role="status">{t("associationAttendance.scanned")}</p> : null}
    <form noValidate onSubmit={submit} className="flex min-w-0 flex-col gap-3">
      <Field id={`${id}-code`} label={t("associationAttendance.codeField")} hint={t("associationAttendance.codeHint")} error={form.formState.errors.code?.message ? t(`errors.${form.formState.errors.code.message}`) : undefined}>{(field) => <Input id={field.id} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={256} disabled={task.busy} aria-invalid={field.invalid || undefined} aria-describedby={field.describedBy} {...form.register("code", { onChange: () => { camera.stop(); setPreview(null); setScanned(false) } })} />}</Field>
      <Button type="submit" disabled={task.busy} aria-busy={task.busy}>{t("associationAttendance.preview")}</Button>
    </form>
    {validPreview && preview ? <div className="flex flex-col items-start gap-3 rounded-lg bg-muted p-3"><p className="font-semibold">{t("associationAttendance.neutralName")}</p><p>{t("associationAttendance.previewHint")}</p>{preview.checkedInAt !== null ? <p role="status">{t("associationAttendance.alreadyRecorded")}</p> : <Button disabled={task.busy} aria-busy={task.busy} onClick={checkIn}>{t("associationAttendance.confirm")}</Button>}<Button variant="ghost" disabled={task.busy} onClick={() => { setPreview(null); form.reset({ code: "" }) }}>{t("associationAttendance.cancel")}</Button></div> : null}
    {task.error ? <p role="alert" className="text-sm text-destructive">{t(`errors.${task.error}`)}</p> : null}
  </div>
}
