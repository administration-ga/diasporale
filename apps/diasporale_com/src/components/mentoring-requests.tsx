"use client"

/**
 * Mes demandes de mentorat (DG-024, troisième tranche) : celles que j'envoie
 * (comme mentoré) et celles que je reçois (comme mentor), chacune avec sa fiche
 * dépliable et les seuls gestes ouverts maintenant. Le rôle vient du SERVEUR
 * (`viewerRole`) ; l'échéance se relit avec l'heure courante par les règles du
 * domaine, et le serveur rejuge chaque geste. Aucune coordonnée : une fois la
 * demande acceptée, l'échange passe par la messagerie. Le mentor peut signaler une
 * demande reçue (G9, chantier « confiance des surfaces ») ; le mentoré voit seul
 * l'état de modération de la sienne (en relecture, retirée). PROPRIÉTAIRE : chantier
 * « mentorat ».
 */
import { availableMentoringActions, effectiveMentoringStatus, mentoringConversation, type MentoringRequestAction, type MentoringRequestStatus } from "@diasporale/domain"
import { Button, Card, EmptyState, Skeleton } from "@diasporale/features"
import type { ActionErrorCode, ActionResult, ContentReportTarget, MentoringCapability, MentoringRequestDetailView, MentoringRequestSummaryView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { InboxIcon } from "lucide-react"
import NextLink from "next/link"
import { useId, useState } from "react"
import { toast } from "sonner"

import { ObjectConversationEntry } from "@/components/contextual-conversations"
import { MentoringAcceptSheet, MentoringReasonSheet, MentoringSlotSheet } from "@/components/mentoring-sheets"
import { MentoringModerationNotice, MentoringPager, MentoringSlotText, MentoringStatusBadge } from "@/components/mentoring-ui"
import { ReportContentAction, ReportedContent } from "@/components/report-content-sheet"
import { formatServiceInstant, formatServiceSlot, useNow } from "@/components/service-request-ui"
import { routes } from "@/lib/routes"

/** L'état EFFECTIF à l'écran : une demande en attente dont l'échéance passe pendant la lecture est expirée. */
function statusNow(summary: Pick<MentoringRequestSummaryView, "status" | "deadlineAt">, now: number): MentoringRequestStatus {
  return effectiveMentoringStatus({ status: summary.status, expiresAt: summary.deadlineAt ?? Number.POSITIVE_INFINITY }, now)
}

/** Les demandes que j'ai envoyées, des plus récemment mises à jour. */
export function MenteeRequestsSection(props: { readonly capability: MentoringCapability; readonly viewerTimeZone: string }) {
  const { t } = useDiasporaleT()
  const { capability } = props
  return (
    <section aria-labelledby="mentorats-envoyes" className="flex min-w-0 flex-col gap-3">
      <h2 id="mentorats-envoyes" className="text-lg font-semibold">{t("mentoring.mine.sentTitle")}</h2>
      <MentoringPager
        read={(cursor) => capability.useMenteeRequests({ cursor })}
        keyOf={(request) => request.requestId}
        empty={
          <EmptyState
            icon={<InboxIcon />}
            title={t("mentoring.mine.sentEmptyTitle")}
            description={t("mentoring.mine.sentEmptyBody")}
            action={
              <Button asChild variant="outline">
                <NextLink href={routes.mentoring()}>{t("mentoring.mine.browse")}</NextLink>
              </Button>
            }
          />
        }
      >
        {(requests) => (
          <ul className="flex min-w-0 flex-col gap-2">
            {requests.map((request) => (
              <li key={request.requestId} className="min-w-0">
                <MentoringRequestCard capability={capability} summary={request} viewerTimeZone={props.viewerTimeZone} />
              </li>
            ))}
          </ul>
        )}
      </MentoringPager>
    </section>
  )
}

const RECEIVED_FILTERS = [
  { value: "sent", label: "mentoring.mine.filterSent" },
  { value: "accepted", label: "mentoring.mine.filterAccepted" },
  { value: null, label: "mentoring.mine.filterAll" },
] as const

type ReceivedFilter = (typeof RECEIVED_FILTERS)[number]["value"]

/** Les demandes que je reçois comme mentor : en attente, en cours, ou toutes. */
export function MentorRequestsSection(props: { readonly capability: MentoringCapability; readonly viewerTimeZone: string }) {
  const { t } = useDiasporaleT()
  const { capability } = props
  const [status, setStatus] = useState<ReceivedFilter>("sent")
  return (
    <section aria-labelledby="mentorats-recus" className="flex min-w-0 flex-col gap-3">
      <h2 id="mentorats-recus" className="text-lg font-semibold">{t("mentoring.mine.receivedTitle")}</h2>
      <div role="group" aria-label={t("mentoring.mine.filterLabel")} className="flex flex-wrap gap-2">
        {RECEIVED_FILTERS.map((filter) => (
          <Button key={filter.label} type="button" size="sm" className="min-h-11" variant={status === filter.value ? "primary" : "outline"} aria-pressed={status === filter.value} onClick={() => setStatus(filter.value)}>
            {t(filter.label)}
          </Button>
        ))}
      </div>
      <MentoringPager
        key={String(status)}
        read={(cursor) => capability.useMentorRequests({ status, cursor })}
        keyOf={(request) => request.requestId}
        empty={<EmptyState icon={<InboxIcon />} title={t("mentoring.mine.receivedEmptyTitle")} description={t("mentoring.mine.receivedEmptyBody")} />}
      >
        {(requests) => (
          <ul className="flex min-w-0 flex-col gap-2">
            {requests.map((request) => (
              <li key={request.requestId} className="min-w-0">
                <MentoringRequestCard capability={capability} summary={request} viewerTimeZone={props.viewerTimeZone} />
              </li>
            ))}
          </ul>
        )}
      </MentoringPager>
    </section>
  )
}

/** Ce qui vient ensuite pour une demande, en une ligne. */
function NextStep(props: { readonly summary: MentoringRequestSummaryView; readonly status: MentoringRequestStatus; readonly viewerTimeZone: string }) {
  const { t, locale } = useDiasporaleT()
  const { summary, status } = props
  if (status === "sent" && summary.deadlineAt !== null) {
    return <span>{t("mentoring.next.deadline", { date: formatServiceInstant(summary.deadlineAt, props.viewerTimeZone, locale) })}</span>
  }
  if (status === "accepted" && summary.slot) {
    return <span>{t("mentoring.next.slot", { slot: formatServiceSlot(summary.slot, summary.slot.timeZone, locale), zone: summary.slot.timeZone })}</span>
  }
  if (status === "accepted") return <span>{t("mentoring.next.accepted")}</span>
  return <span>{t("mentoring.next.updated", { date: formatServiceInstant(summary.updatedAt, props.viewerTimeZone, locale) })}</span>
}

/** Une demande dans une liste : l'autre partie, le domaine, l'objectif, l'état, puis sa fiche dépliable. */
export function MentoringRequestCard(props: { readonly capability: MentoringCapability; readonly summary: MentoringRequestSummaryView; readonly viewerTimeZone: string }) {
  const { t } = useDiasporaleT()
  const panelId = useId()
  const now = useNow()
  const [open, setOpen] = useState(false)
  const { summary } = props
  const status = statusNow(summary, now)
  const name = summary.counterpart.displayName ?? t("mentoring.party.unknown")
  // G9 : le mentor signale une demande reçue ; celle qu'on envoie est son propre contenu.
  const reportTarget: ContentReportTarget = { kind: "diasporaMentoringRequest", id: summary.requestId }
  // G9 : l'état de modération de MA demande, à moi seul ; jamais montré au mentor, même servi.
  const moderation = summary.viewerRole === "mentee" ? summary.moderation : undefined
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-4">
      <ReportedContent target={reportTarget}>
        <MentoringModerationNotice state={moderation} removed={t("mentoring.moderation.requestRemoved")} />
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <p className="break-words font-semibold">{summary.goal}</p>
            <p className="break-words text-[13px] text-muted-foreground">
              {t(summary.viewerRole === "mentee" ? "mentoring.requestCard.withMentor" : "mentoring.requestCard.fromMentee", { name, domain: t(`mentor.domain.${summary.domain}`) })}
            </p>
          </div>
          <MentoringStatusBadge status={status} />
        </div>
        <p className="break-words text-sm">
          <NextStep summary={summary} status={status} viewerTimeZone={props.viewerTimeZone} />
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="min-h-11" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
            {t(open ? "mentoring.requestCard.hide" : "mentoring.requestCard.show")}
          </Button>
          {summary.viewerRole === "mentor" ? <ReportContentAction target={reportTarget} /> : null}
          {/* CC-6 : la conversation du mentorat, ouverte à l'accord ; un retrait par la modération la ferme (le serveur relit). */}
          <ObjectConversationEntry
            object={{ kind: "diasporaMentoring", id: summary.requestId }}
            phase={mentoringConversation({ status: summary.status, expiresAt: summary.deadlineAt ?? Number.POSITIVE_INFINITY }, now, summary.moderation === "removed").phase}
          />
        </div>
        {open ? (
          <div id={panelId} className="min-w-0">
            <RequestDetail capability={props.capability} requestId={summary.requestId} viewerTimeZone={props.viewerTimeZone} />
          </div>
        ) : null}
      </ReportedContent>
    </Card>
  )
}

function RequestDetail(props: { readonly capability: MentoringCapability; readonly requestId: string; readonly viewerTimeZone: string }) {
  const { t } = useDiasporaleT()
  const query = props.capability.useRequest(props.requestId)
  if (query.status === "loading") return <Skeleton className="h-24 w-full rounded-lg" />
  if (query.status === "error") return <p role="alert" className="text-sm">{t(`errors.${query.code}`)}</p>
  if (query.data === null) return <p className="text-sm text-muted-foreground">{t("mentoring.detail.notFound")}</p>
  return <RequestDetailBody capability={props.capability} detail={query.data} viewerTimeZone={props.viewerTimeZone} />
}

type OpenSheet = "accept" | "decline" | "cancel" | "close" | "slot" | null

function RequestDetailBody(props: { readonly capability: MentoringCapability; readonly detail: MentoringRequestDetailView; readonly viewerTimeZone: string }) {
  const { t } = useDiasporaleT()
  const now = useNow()
  const { capability, detail } = props
  const [sheet, setSheet] = useState<OpenSheet>(null)
  // La version du créneau LUE à l'ouverture de la feuille : une version publiée entre-temps fait refuser le geste.
  const [slotFrom, setSlotFrom] = useState<number | null>(null)
  const status = statusNow(detail, now)
  const actions = new Set<MentoringRequestAction>(availableMentoringActions({ role: detail.viewerRole, status }))
  const name = detail.counterpart.displayName ?? t("mentoring.party.unknown")
  const futureWishes = detail.wishedSlots.filter((slot) => slot.startAt > now)
  const settle = async <T,>(work: Promise<ActionResult<T>>, success: string): Promise<ActionErrorCode | null> => {
    const result = await work
    if (!result.ok) return result.code
    toast.success(success)
    return null
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-3">
      <section className="flex min-w-0 flex-col gap-1">
        <h3 className="font-semibold">{t("mentoring.detail.message")}</h3>
        <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{detail.message}</p>
      </section>
      <section className="flex min-w-0 flex-col gap-1">
        <h3 className="font-semibold">{t("mentoring.detail.wishedSlots")}</h3>
        {detail.wishedSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("mentoring.detail.noWishedSlots")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.wishedSlots.map((slot) => (
              <li key={`${slot.startAt}-${slot.endAt}`} className="rounded-lg bg-muted px-3 py-2">
                <MentoringSlotText slot={slot} timeZone={detail.timeZone} viewerTimeZone={props.viewerTimeZone} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {detail.slot ? (
        <section className="flex min-w-0 flex-col gap-1">
          <h3 className="font-semibold">{t("mentoring.detail.slot")}</h3>
          <MentoringSlotText slot={detail.slot} timeZone={detail.slot.timeZone} viewerTimeZone={props.viewerTimeZone} />
        </section>
      ) : null}
      {status === "accepted" ? <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("mentoring.detail.contact")}</p> : null}
      {status === "closed" && detail.closedBy ? <p className="text-sm">{t(`mentoring.closedBy.${detail.closedBy}`)}</p> : null}
      {detail.closedReason ? (
        <section className="flex min-w-0 flex-col gap-1">
          <h3 className="font-semibold">{t("mentoring.detail.reason")}</h3>
          <p className="whitespace-pre-line break-words">{detail.closedReason}</p>
        </section>
      ) : null}

      {actions.size > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.has("accept") ? <Button onClick={() => setSheet("accept")}>{t("mentoring.accept.cta")}</Button> : null}
          {actions.has("propose_slot") ? (
            <Button
              onClick={() => {
                setSlotFrom(detail.slotVersion)
                setSheet("slot")
              }}
            >
              {t(detail.slot ? "mentoring.slot.update" : "mentoring.slot.cta")}
            </Button>
          ) : null}
          {actions.has("decline") ? <Button variant="outline" onClick={() => setSheet("decline")}>{t("mentoring.decline.cta")}</Button> : null}
          {actions.has("cancel") ? <Button variant="outline" onClick={() => setSheet("cancel")}>{t("mentoring.cancel.cta")}</Button> : null}
          {actions.has("close") ? <Button variant="outline" onClick={() => setSheet("close")}>{t("mentoring.close.cta")}</Button> : null}
        </div>
      ) : null}

      <MentoringAcceptSheet
        open={sheet === "accept"}
        onOpenChange={(open) => setSheet(open ? "accept" : null)}
        title={t("mentoring.accept.title")}
        description={t("mentoring.accept.description", { name })}
        wishedSlots={futureWishes}
        timeZone={detail.timeZone}
        viewerTimeZone={props.viewerTimeZone}
        onConfirm={(slot) => settle(capability.accept({ requestId: detail.requestId, slot }), t("mentoring.accept.done"))}
      />
      <MentoringSlotSheet
        open={sheet === "slot"}
        onOpenChange={(open) => setSheet(open ? "slot" : null)}
        title={t("mentoring.slot.title")}
        description={t("mentoring.slot.description", { name })}
        confirmLabel={t("mentoring.slot.confirm")}
        timeZone={props.viewerTimeZone}
        onConfirm={(slot) => settle(capability.proposeSlot({ requestId: detail.requestId, expectedSlotVersion: slotFrom ?? detail.slotVersion, slot }), t("mentoring.slot.done"))}
      />
      <MentoringReasonSheet
        open={sheet === "decline"}
        onOpenChange={(open) => setSheet(open ? "decline" : null)}
        title={t("mentoring.decline.title")}
        description={t("mentoring.decline.description", { name })}
        label={t("mentoring.reason.label")}
        hint={t("mentoring.reason.hint")}
        confirmLabel={t("mentoring.decline.confirm")}
        onConfirm={(reason) => settle(capability.decline({ requestId: detail.requestId, reason }), t("mentoring.decline.done"))}
      />
      <MentoringReasonSheet
        open={sheet === "cancel"}
        onOpenChange={(open) => setSheet(open ? "cancel" : null)}
        title={t("mentoring.cancel.title")}
        description={t("mentoring.cancel.description")}
        label={t("mentoring.reason.label")}
        hint={t("mentoring.reason.hint")}
        confirmLabel={t("mentoring.cancel.confirm")}
        onConfirm={(reason) => settle(capability.cancel({ requestId: detail.requestId, reason }), t("mentoring.cancel.done"))}
      />
      <MentoringReasonSheet
        open={sheet === "close"}
        onOpenChange={(open) => setSheet(open ? "close" : null)}
        title={t("mentoring.close.title")}
        description={t("mentoring.close.description", { name })}
        label={t("mentoring.reason.label")}
        hint={t("mentoring.reason.hint")}
        confirmLabel={t("mentoring.close.confirm")}
        onConfirm={(reason) => settle(capability.close({ requestId: detail.requestId, reason }), t("mentoring.close.done"))}
      />
    </div>
  )
}
