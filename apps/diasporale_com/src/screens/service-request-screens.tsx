"use client"

/**
 * Les écrans des demandes de service (DG-014/015) :
 *
 *   · `/mes-demandes` — mes demandes, des plus récemment mises à jour ;
 *   · `/mes-demandes/<id>` — ma demande : chronologie, proposition courante
 *     (montant, créneau, lieu approximatif, conditions, échéance), accord
 *     confirmé, annulation ;
 *   · `/mon-activite/demandes/<id>` — la demande reçue par une page : besoin,
 *     disponibilités, proposition versionnée, refus, puis constat de la
 *     réalisation ou de l'absence après le début, annulation motivée ;
 *   · une absence constatée se CONTESTE par la personne qui demande, dans les
 *     quatorze jours (DG-015) : la contestation s'ajoute, lisible des deux côtés.
 *
 * Le rôle du lecteur vient du SERVEUR (`viewerRole`) ; les gestes ouverts se
 * relisent avec l'heure courante (une échéance passe, un rendez-vous commence)
 * par les règles du domaine, et le serveur les rejuge à l'écriture.
 * PROPRIÉTAIRE : chantier « demandes et rendez-vous ».
 */
import { availableServiceRequestActions, effectiveServiceRequestStatus, SERVICE_NO_SHOW_CONTEST_DAYS, serviceRequestConversation, type ServiceRequestAction } from "@diasporale/domain"
import { Button, Card, EmptyState, Skeleton, formatDate } from "@diasporale/features"
import { useServiceRequests, type ActionErrorCode, type MembershipView, type ServiceRequestDetailView, type ServiceRequestsCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowLeftIcon, SearchXIcon } from "lucide-react"
import NextLink from "next/link"
import { useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { AppShell } from "@/components/app-shell"
import { ObjectConversationEntry } from "@/components/contextual-conversations"
import { Gate } from "@/components/gate"
import { ServiceProposalForm } from "@/components/service-proposal-form"
import { ServiceRequestReview } from "@/components/service-reviews-section"
import { ConfirmSheet, ReasonSheet } from "@/components/service-request-sheets"
import {
  browserTimeZone,
  formatServiceMoney,
  formatServiceSlot,
  ProposalDetails,
  ServiceRequestList,
  ServiceStatusBadge,
  ServiceTimeline,
  SlotText,
  useNow,
} from "@/components/service-request-ui"
import { routes } from "@/lib/routes"

/** La coque commune : membre, coquille de l'application, une clé par personne (aucun état d'un autre compte). */
function MemberScreen(props: { readonly children: (membership: MembershipView) => ReactNode }) {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <AppShell membership={session.membership}>
            <div key={session.membership.personId} className="contents">{props.children(session.membership)}</div>
          </AppShell>
        ) : null
      }
    </Gate>
  )
}

function Unavailable() {
  const { t } = useDiasporaleT()
  return (
    <Card className="flex flex-col gap-2 p-4">
      <p className="font-semibold">{t("serviceRequests.unavailableTitle")}</p>
      <p className="text-sm text-muted-foreground">{t("serviceRequests.unavailableBody")}</p>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════
// /mes-demandes
// ═══════════════════════════════════════════════════════════════

export function MyServiceRequestsScreen() {
  return <MemberScreen>{() => <MyRequests />}</MemberScreen>
}

function MyRequests() {
  const { t } = useDiasporaleT()
  const capability = useServiceRequests()
  const viewerTimeZone = useMemo(() => browserTimeZone(), [])
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">{t("serviceRequests.mine.title")}</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{t("serviceRequests.mine.lead")}</p>
      </header>
      {capability === null ? (
        <Unavailable />
      ) : (
        <ServiceRequestList
          capability={capability}
          source={{ kind: "mine" }}
          hrefOf={routes.serviceRequest}
          viewerTimeZone={viewerTimeZone}
          emptyTitle={t("serviceRequests.mine.emptyTitle")}
          emptyBody={t("serviceRequests.mine.emptyBody")}
        />
      )}
      <div>
        <Button asChild variant="outline">
          <NextLink href={routes.services()}>{t("serviceRequests.mine.browse")}</NextLink>
        </Button>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Une demande
// ═══════════════════════════════════════════════════════════════

export function MyServiceRequestScreen(props: { readonly requestId: string }) {
  return <MemberScreen>{() => <RequestDetail requestId={props.requestId} backHref={routes.myServiceRequests()} backLabel="serviceRequests.detail.backMine" />}</MemberScreen>
}

export function ActivityRequestScreen(props: { readonly requestId: string }) {
  return <MemberScreen>{() => <RequestDetail requestId={props.requestId} backHref={routes.myActivity("demandes")} backLabel="serviceRequests.detail.backActivity" />}</MemberScreen>
}

interface RequestDetailProps {
  readonly requestId: string
  readonly backHref: string
  readonly backLabel: "serviceRequests.detail.backMine" | "serviceRequests.detail.backActivity"
}

function RequestDetail(props: RequestDetailProps) {
  const capability = useServiceRequests()
  return capability === null ? <><RequestBackLink href={props.backHref} label={props.backLabel} /><Unavailable /></>
    : <LoadedRequest capability={capability} {...props} />
}

function RequestBackLink(props: { href: string; label: RequestDetailProps["backLabel"] | "pageServiceManagement.backToRequests" }) {
  const { t } = useDiasporaleT()
  return <div><Button asChild variant="ghost" size="sm" className="min-h-11"><NextLink href={props.href}><ArrowLeftIcon aria-hidden />{t(props.label)}</NextLink></Button></div>
}

function LoadedRequest(props: RequestDetailProps & { readonly capability: ServiceRequestsCapability }) {
  const { t } = useDiasporaleT()
  const query = props.capability.useRequest(props.requestId)
  const detail = query.status === "ready" ? query.data : null
  const page = detail?.viewerRole === "page" ? detail.page : null
  let body: ReactNode
  if (query.status === "loading") body = <Skeleton className="h-64 w-full rounded-xl" />
  else if (query.status === "error") body = <Card role="alert" className="p-4"><p>{t(`errors.${query.code}`)}</p></Card>
  else if (query.data === null) body = <EmptyState icon={<SearchXIcon />} title={t("serviceRequests.detail.notFoundTitle")} description={t("serviceRequests.detail.notFoundBody")} />
  else body = <RequestView key={query.data.requestId} capability={props.capability} detail={query.data} />
  return <>
    <RequestBackLink href={page ? routes.pageManage(page.handle, "demandes") : props.backHref} label={page ? "pageServiceManagement.backToRequests" : props.backLabel} />
    {body}
  </>
}

type OpenSheet = "cancel" | "refuse" | "complete" | "no_show" | "contest" | null

function RequestView(props: { readonly capability: ServiceRequestsCapability; readonly detail: ServiceRequestDetailView }) {
  const { t, locale } = useDiasporaleT()
  const { capability, detail } = props
  const now = useNow()
  const viewerTimeZone = useMemo(() => browserTimeZone(), [])
  const [sheet, setSheet] = useState<OpenSheet>(null)
  // La version LUE au moment du geste : une version publiée entre-temps fait refuser le geste, jamais l'accepte en silence.
  const [proposingFrom, setProposingFrom] = useState<number | null>(null)
  const [acceptVersion, setAcceptVersion] = useState<number | null>(null)
  // Les gestes se relisent avec l'heure courante, selon les règles du domaine ; le serveur les rejuge.
  const status = effectiveServiceRequestStatus({ status: detail.status, deadlineAt: detail.deadlineAt }, now)
  const actions = new Set<ServiceRequestAction>(
    availableServiceRequestActions({
      actor: detail.viewerRole,
      status,
      now,
      bookingStartAt: detail.booking ? detail.booking.startAt : null,
      proposalVersion: detail.currentProposal ? detail.currentProposal.version : 0,
    }),
  )
  const current = detail.proposals.find((proposal) => proposal.state === "current" && proposal.version === detail.currentProposal?.version) ?? null
  const previous = detail.proposals.filter((proposal) => proposal !== current)
  // La feuille d'accord montre et cite la version ouverte, même si une autre arrive pendant la lecture.
  const accepted = acceptVersion === null ? null : (detail.proposals.find((proposal) => proposal.version === acceptVersion) ?? null)
  const isPage = detail.viewerRole === "page"
  const confirmed = status === "confirmed"
  // DG-015 : le geste n'existe que si le fournisseur le sert et que le serveur l'ouvre à ce lecteur.
  const contestNoShow = capability.contestNoShow
  const contest = detail.noShowContest ?? null
  const outcome = (code: ActionErrorCode | null, success: string): ActionErrorCode | null => {
    if (code === null) toast.success(success)
    return code
  }
  const settle = async <T,>(work: Promise<{ ok: true; value: T } | { ok: false; code: ActionErrorCode }>, success: string) => {
    const result = await work
    return outcome(result.ok ? null : result.code, success)
  }

  return (
    <article className="flex min-w-0 flex-col gap-5" aria-labelledby="demande-titre">
      <header className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <h1 id="demande-titre" className="min-w-0 break-words font-display text-2xl font-bold">{detail.offerTitle}</h1>
          <ServiceStatusBadge status={status} />
        </div>
        <p className="break-words text-[15px] text-muted-foreground">
          {isPage
            ? t("serviceRequests.detail.fromRequester", { name: detail.requester?.displayName ?? t("serviceRequests.requester.unknown") })
            : t("serviceRequests.detail.withPage", { page: detail.page?.name ?? t("serviceRequests.page.unavailable") })}
        </p>
        {detail.page && !isPage ? (
          <div>
            <Button asChild variant="link" size="sm">
              <NextLink href={routes.page(detail.page.handle)}>{t("serviceRequests.detail.viewPage")}</NextLink>
            </Button>
          </div>
        ) : null}
        {/* CC-6 : la conversation de la demande, des deux côtés ; la phase suit l'état effectif. */}
        <div>
          <ObjectConversationEntry
            object={{ kind: "diasporaServiceRequest", id: detail.requestId }}
            phase={serviceRequestConversation({ status: detail.status, deadlineAt: detail.deadlineAt }, now).phase}
          />
        </div>
      </header>

      <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("serviceRequests.detail.noPayment")}</p>

      {detail.booking ? (
        <section aria-labelledby="rendez-vous" className="flex min-w-0 flex-col gap-2">
          <h2 id="rendez-vous" className="text-lg font-semibold">{t("serviceRequests.detail.booking")}</h2>
          <Card className="flex min-w-0 flex-col gap-1 p-4">
            <SlotText slot={detail.booking} timeZone={detail.booking.timeZone} viewerTimeZone={viewerTimeZone} />
            <span className="text-[13px] text-muted-foreground">{t(`serviceRequests.bookingStatus.${detail.booking.status}`)}</span>
          </Card>
        </section>
      ) : null}

      {current ? (
        <section aria-labelledby="proposition" className="flex min-w-0 flex-col gap-2">
          <h2 id="proposition" className="text-lg font-semibold">{t("serviceRequests.detail.proposal", { version: current.version })}</h2>
          <ProposalDetails proposal={current} viewerTimeZone={viewerTimeZone} />
        </section>
      ) : null}

      <section aria-labelledby="besoin" className="flex min-w-0 flex-col gap-2">
        <h2 id="besoin" className="text-lg font-semibold">{t("serviceRequests.detail.need")}</h2>
        <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{detail.need}</p>
        <h3 className="font-semibold">{t("serviceRequests.detail.windows")}</h3>
        <ul className="flex flex-col gap-2">
          {detail.windows.map((window) => (
            <li key={`${window.startAt}-${window.endAt}`} className="rounded-lg bg-muted px-3 py-2">
              <SlotText slot={window} timeZone={detail.timeZone} viewerTimeZone={viewerTimeZone} />
            </li>
          ))}
        </ul>
      </section>

      {detail.closedReason ? (
        <section aria-labelledby="motif" className="flex min-w-0 flex-col gap-1">
          <h2 id="motif" className="text-lg font-semibold">{t("serviceRequests.detail.reason")}</h2>
          <p className="whitespace-pre-line break-words">{detail.closedReason}</p>
        </section>
      ) : null}

      {contest ? (
        <section aria-labelledby="contestation" className="flex min-w-0 flex-col gap-1 rounded-lg border border-border p-3">
          <h2 id="contestation" className="text-lg font-semibold">{t("serviceRequests.contest.title")}</h2>
          <p className="text-[13px] text-muted-foreground">
            {t(isPage ? "serviceRequests.contest.byRequester" : "serviceRequests.contest.mine", { date: formatDate(contest.at, locale) })}
          </p>
          <p className="whitespace-pre-line break-words">{contest.reason}</p>
        </section>
      ) : null}

      {!isPage && contestNoShow && detail.canContestNoShow ? (
        <section aria-labelledby="contester" className="flex min-w-0 flex-col gap-2">
          <h2 id="contester" className="text-lg font-semibold">{t("serviceRequests.contest.actionTitle")}</h2>
          <p className="text-[13px] leading-snug text-muted-foreground">{t("serviceRequests.contest.lead", { days: SERVICE_NO_SHOW_CONTEST_DAYS })}</p>
          <div>
            <Button variant="outline" onClick={() => setSheet("contest")}>{t("serviceRequests.contest.cta")}</Button>
          </div>
        </section>
      ) : null}

      {actions.size > 0 ? (
        <section aria-labelledby="gestes" className="flex min-w-0 flex-col gap-3">
          <h2 id="gestes" className="text-lg font-semibold">{t("serviceRequests.detail.actions")}</h2>
          {proposingFrom !== null && actions.has("propose") ? (
            <ServiceProposalForm
              capability={capability}
              requestId={detail.requestId}
              expectedVersion={proposingFrom}
              windows={detail.windows}
              viewerTimeZone={viewerTimeZone}
              onDone={() => setProposingFrom(null)}
              onCancel={() => setProposingFrom(null)}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {actions.has("accept") && current ? <Button onClick={() => setAcceptVersion(current.version)}>{t("serviceRequests.accept.cta")}</Button> : null}
              {actions.has("propose") ? (
                <Button onClick={() => setProposingFrom(detail.currentProposal ? detail.currentProposal.version : 0)}>
                  {t(detail.currentProposal ? "serviceRequests.propose.update" : "serviceRequests.propose.cta")}
                </Button>
              ) : null}
              {actions.has("complete") ? <Button onClick={() => setSheet("complete")}>{t("serviceRequests.complete.cta")}</Button> : null}
              {actions.has("no_show") ? <Button variant="outline" onClick={() => setSheet("no_show")}>{t("serviceRequests.noShow.cta")}</Button> : null}
              {actions.has("refuse") ? <Button variant="outline" onClick={() => setSheet("refuse")}>{t("serviceRequests.refuse.cta")}</Button> : null}
              {actions.has("cancel") ? (
                <Button variant="outline" onClick={() => setSheet("cancel")}>{t(confirmed ? "serviceRequests.cancel.bookingCta" : "serviceRequests.cancel.requestCta")}</Button>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {!isPage ? <ServiceRequestReview requestId={detail.requestId} /> : null}

      <section aria-labelledby="chronologie" className="flex min-w-0 flex-col gap-2">
        <h2 id="chronologie" className="text-lg font-semibold">{t("serviceRequests.detail.timeline")}</h2>
        <ServiceTimeline events={detail.timeline} viewerTimeZone={viewerTimeZone} />
      </section>

      {previous.length > 0 ? (
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer font-medium">{t("serviceRequests.detail.previous", { count: previous.length })}</summary>
          <ul className="mt-3 flex flex-col gap-3">
            {previous.map((proposal) => (
              <li key={proposal.version} className="flex flex-col gap-1">
                <p className="text-sm font-medium">{t("serviceRequests.detail.previousVersion", { version: proposal.version })}</p>
                <p className="text-sm text-muted-foreground">
                  {formatServiceMoney(proposal.amountMinor, proposal.currency, locale)} · {formatServiceSlot(proposal, proposal.timeZone, locale)}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {accepted ? (
        <ConfirmSheet
          open
          onOpenChange={(open) => {
            if (!open) setAcceptVersion(null)
          }}
          title={t("serviceRequests.accept.title")}
          description={t("serviceRequests.accept.description", { page: detail.page?.name ?? t("serviceRequests.page.unavailable") })}
          confirmLabel={t("serviceRequests.accept.confirm")}
          onConfirm={() => settle(capability.accept({ requestId: detail.requestId, expectedProposalVersion: accepted.version }), t("serviceRequests.accept.done"))}
        >
          <ProposalDetails proposal={accepted} viewerTimeZone={viewerTimeZone} />
        </ConfirmSheet>
      ) : null}
      <ReasonSheet
        open={sheet === "cancel"}
        onOpenChange={(open) => setSheet(open ? "cancel" : null)}
        title={t(confirmed ? "serviceRequests.cancel.bookingTitle" : "serviceRequests.cancel.requestTitle")}
        description={t(confirmed ? "serviceRequests.cancel.bookingDescription" : "serviceRequests.cancel.requestDescription")}
        label={t("serviceRequests.cancel.reason")}
        hint={t(confirmed ? "serviceRequests.cancel.reasonRequired" : "serviceRequests.cancel.reasonOptional")}
        required={confirmed}
        confirmLabel={t(confirmed ? "serviceRequests.cancel.bookingConfirm" : "serviceRequests.cancel.requestConfirm")}
        onConfirm={(reason) => settle(capability.cancel({ requestId: detail.requestId, reason }), t("serviceRequests.cancel.done"))}
      />
      <ReasonSheet
        open={sheet === "refuse"}
        onOpenChange={(open) => setSheet(open ? "refuse" : null)}
        title={t("serviceRequests.refuse.title")}
        description={t("serviceRequests.refuse.description")}
        label={t("serviceRequests.refuse.reason")}
        hint={t("serviceRequests.refuse.reasonHint")}
        required={false}
        confirmLabel={t("serviceRequests.refuse.confirm")}
        onConfirm={(reason) => settle(capability.refuse({ requestId: detail.requestId, reason }), t("serviceRequests.refuse.done"))}
      />
      <ConfirmSheet
        open={sheet === "complete"}
        onOpenChange={(open) => setSheet(open ? "complete" : null)}
        title={t("serviceRequests.complete.title")}
        description={t("serviceRequests.complete.description")}
        confirmLabel={t("serviceRequests.complete.confirm")}
        onConfirm={() => settle(capability.complete(detail.requestId), t("serviceRequests.complete.done"))}
      />
      <ConfirmSheet
        open={sheet === "no_show"}
        onOpenChange={(open) => setSheet(open ? "no_show" : null)}
        title={t("serviceRequests.noShow.title")}
        description={t("serviceRequests.noShow.description")}
        confirmLabel={t("serviceRequests.noShow.confirm")}
        destructive
        onConfirm={() => settle(capability.markNoShow(detail.requestId), t("serviceRequests.noShow.done"))}
      />
      {contestNoShow ? (
        <ReasonSheet
          open={sheet === "contest"}
          onOpenChange={(open) => setSheet(open ? "contest" : null)}
          title={t("serviceRequests.contest.sheetTitle")}
          description={t("serviceRequests.contest.sheetDescription")}
          label={t("serviceRequests.contest.reason")}
          hint={t("serviceRequests.contest.reasonHint")}
          required
          confirmLabel={t("serviceRequests.contest.confirm")}
          onConfirm={(reason) => settle(contestNoShow({ requestId: detail.requestId, reason: reason ?? "" }), t("serviceRequests.contest.done"))}
        />
      ) : null}
    </article>
  )
}
