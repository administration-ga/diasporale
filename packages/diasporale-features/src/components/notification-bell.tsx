"use client"

import {
  BadgeCheckIcon,
  BellIcon,
  BriefcaseBusinessIcon,
  CalendarIcon,
  CalendarCheckIcon,
  CalendarXIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleXIcon,
  FileTextIcon,
  FlagIcon,
  GraduationCapIcon,
  HandHeartIcon,
  HandshakeIcon,
  HeartIcon,
  HourglassIcon,
  InboxIcon,
  type LucideIcon,
  MessageCircleIcon,
  MessageCircleOffIcon,
  MessageSquareReplyIcon,
  MessagesSquareIcon,
  Repeat2Icon,
  ScaleIcon,
  ShieldQuestionIcon,
  SparklesIcon,
  UserCheckIcon,
  UserPlusIcon,
  UserRoundCheckIcon,
  UserRoundXIcon,
  UsersIcon,
  UserXIcon,
  AtSignIcon,
  UserMinusIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { ActionResult } from "../data/port"
import { useActions, useNotifications, useUnreadCount } from "../data/context"
import {
  COMMUNITY_NOTIFICATION_KINDS,
  CONTEXTUAL_NOTIFICATION_KINDS,
  SERVICE_NOTIFICATION_KINDS,
  type CommunityNoticeView,
  type NotificationKind,
  type NotificationView,
  type ServiceNoticeView,
} from "../data/types"
import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"
import { formatRelative } from "../lib/format"
import { Button } from "../primitives/button"
import { Sheet, SheetContent } from "../primitives/sheet"
import { Skeleton } from "../primitives/surface"
import { useRouting } from "../routing"
import { EmptyState } from "./empty-state"

const KIND_ICONS: Readonly<Record<NotificationKind, LucideIcon>> = {
  connection_request: UserPlusIcon,
  connection_accepted: UserCheckIcon,
  new_follower: SparklesIcon,
  post_reaction: HeartIcon,
  post_comment: MessageCircleIcon,
  post_share: Repeat2Icon,
  mention: AtSignIcon,
  sponsorship_received: HandshakeIcon,
  sponsorship_withdrawn: UserMinusIcon,
  attestation_verified: BadgeCheckIcon,
  attestation_not_confirmed: ShieldQuestionIcon,
  association_event_reminder: CalendarIcon,
  // Mise en relation (DG-010, DG-015, DG-016).
  service_request_received: InboxIcon,
  service_proposal_received: FileTextIcon,
  service_request_declined: CircleXIcon,
  service_proposal_accepted: CalendarCheckIcon,
  service_request_cancelled: CalendarXIcon,
  service_request_expired: HourglassIcon,
  service_booking_completed: CircleCheckIcon,
  service_booking_no_show: UserXIcon,
  service_no_show_contested: FlagIcon,
  association_membership_requested: UsersIcon,
  association_membership_accepted: UserRoundCheckIcon,
  association_membership_declined: UserRoundXIcon,
  association_membership_removed: UserMinusIcon,
  service_review_replied: MessageSquareReplyIcon,
  // Vie communautaire (vague H : entraide, mentorat, emploi, kit d'arrivée).
  aid_answer_received: MessagesSquareIcon,
  aid_answer_retained: CircleCheckIcon,
  aid_mission_signup: HandHeartIcon,
  mentoring_request_received: GraduationCapIcon,
  mentoring_request_accepted: UserRoundCheckIcon,
  mentoring_request_declined: UserRoundXIcon,
  mentoring_closed: UserMinusIcon,
  job_application_received: BriefcaseBusinessIcon,
  job_application_shortlisted: BadgeCheckIcon,
  job_application_not_selected: CircleXIcon,
  kit_resource_reviewed: FileTextIcon,
  // Conversation de mise en relation (CC-2b du moteur).
  contextual_message: MessageCircleIcon,
  contextual_closed: MessageCircleOffIcon,
  moderation_decision: ScaleIcon,
  other: BellIcon,
}

/**
 * Les avis qui SUIVENT le nom de qui a agi (« Awa souhaite… ») ; les autres sont
 * une phrase entière, dite par le système, sans nom devant.
 */
export const BELL_ACTOR_LED_KINDS = [
  "connection_request",
  "connection_accepted",
  "new_follower",
  "post_reaction",
  "post_comment",
  "post_share",
  "mention",
  "sponsorship_received",
  "sponsorship_withdrawn",
] as const satisfies readonly NotificationKind[]
type ActorLedKind = (typeof BELL_ACTOR_LED_KINDS)[number]
const ACTOR_LED: ReadonlySet<NotificationKind> = new Set(BELL_ACTOR_LED_KINDS)

function isActorLed(kind: NotificationKind): kind is ActorLedKind {
  return ACTOR_LED.has(kind)
}

/**
 * Les phrases entières du système ; un retrait de parrainage en a une pour quand personne n'est nommé.
 * Les avis de mise en relation en sont : neutres, ils ne nomment personne.
 */
export const BELL_SYSTEM_KINDS = [
  "sponsorship_withdrawn",
  "attestation_verified",
  "attestation_not_confirmed",
  "association_event_reminder",
  ...SERVICE_NOTIFICATION_KINDS,
  ...COMMUNITY_NOTIFICATION_KINDS,
  ...CONTEXTUAL_NOTIFICATION_KINDS,
  "moderation_decision",
  "other",
] as const satisfies readonly NotificationKind[]
type SystemKind = (typeof BELL_SYSTEM_KINDS)[number]

/** La clé d'une phrase du système : un genre nouveau, sans phrase ni nom devant, ne compile pas. */
function systemSentence(kind: SystemKind): `bell.system.${SystemKind}` {
  return `bell.system.${kind}`
}

/**
 * Les adresses des avis de mise en relation, quand l'application les fournit dans sa
 * table (`serviceRequest`, `activityRequest`, `associationMembers`, `myAssociations`) :
 * chacune relit les droits à l'ouverture et ne porte qu'un identifiant. Absentes, l'avis
 * retombe sur la fiche de la page ; sans page lisible, il n'offre aucun lien inventé.
 */
type ServiceNoticeRoutes = ReturnType<typeof useRouting>["routes"] & {
  readonly serviceRequest?: (requestId: string) => string
  readonly activityRequest?: (requestId: string) => string
  readonly associationMembers?: (handle: string) => string
  readonly myAssociations?: () => string
}

/**
 * Le lien d'un avis de la vie communautaire : l'objet qu'il ouvre, par la route que
 * l'application fournit (chaque route relit les droits à l'ouverture), avec son libellé.
 * Sans route fournie, aucun lien inventé.
 */
function communityNoticeLink(notice: CommunityNoticeView, routes: ReturnType<typeof useRouting>["routes"]): { readonly href: string; readonly label: string } | null {
  switch (notice.opens) {
    case "aidQuestion": {
      const href = routes.mutualAidItem?.(notice.objectId)
      return href ? { href, label: "bell.communityLink.aidQuestion" } : null
    }
    case "aidMission": {
      const href = routes.mutualAidItem?.(notice.objectId)
      return href ? { href, label: "bell.communityLink.aidMission" } : null
    }
    case "mentoringRequest": {
      const href = routes.myMentoring?.()
      return href ? { href, label: "bell.communityLink.mentoringRequest" } : null
    }
    case "jobApplication": {
      // L'équipe : le recrutement de la page concernée quand elle se lit, sinon Mon activité.
      const teamHref = notice.pageHandle !== null ? routes.pageJobs?.(notice.pageHandle) ?? routes.jobsActivity?.() : routes.jobsActivity?.()
      const href = notice.audience === "team" ? teamHref : routes.myApplications?.()
      return href ? { href, label: notice.audience === "team" ? "bell.communityLink.jobApplicationTeam" : "bell.communityLink.jobApplicationCandidate" } : null
    }
    case "kitResource": {
      const href = routes.arrivalKitResource?.(notice.objectId)
      return href ? { href, label: "bell.communityLink.kitResource" } : null
    }
  }
}

/**
 * Le lien d'un avis de décision de modération : les décisions de la page quand le moteur
 * nomme une page dont je signe à la lecture, sinon « Mes données » ; chaque route relit
 * les droits à l'ouverture. Sans route fournie par l'application, aucun lien inventé.
 */
function moderationDecisionLink(item: NotificationView, routes: ReturnType<typeof useRouting>["routes"]): { readonly href: string; readonly page: boolean } | null {
  if (item.kind !== "moderation_decision" || !item.moderationDecision) return null
  const handle = item.moderationDecision.pageHandle
  const href = handle !== null ? routes.pageDecisions?.(handle) : routes.myDecisions?.()
  return href ? { href, page: handle !== null } : null
}

/** La route propre à l'interlocuteur : sa demande, la demande reçue, les adhérents, ses associations. */
function deepServiceHref(notice: ServiceNoticeView, routes: ServiceNoticeRoutes): string | undefined {
  switch (notice.audience) {
    case "requester":
      return notice.requestId !== null ? routes.serviceRequest?.(notice.requestId) : undefined
    case "provider":
      return notice.requestId !== null ? routes.activityRequest?.(notice.requestId) : undefined
    case "responsible":
      return notice.pageHandle !== null ? routes.associationMembers?.(notice.pageHandle) : undefined
    case "member":
      return routes.myAssociations?.()
  }
}

/** Le lien d'un avis de mise en relation : la route qui relit les droits (`deep`), sinon la fiche de la page. */
function serviceNoticeLink(notice: ServiceNoticeView, routes: ServiceNoticeRoutes): { readonly href: string; readonly deep: boolean } | null {
  const deep = deepServiceHref(notice, routes)
  if (deep) return { href: deep, deep: true }
  return notice.pageHandle !== null ? { href: routes.page(notice.pageHandle), deep: false } : null
}

/**
 * La cloche de DIASPORALE : le compte des avis non lus (« 99+ » au-delà) et, au
 * clic, les avis du réseau. Une demande de relation encore à trancher s'accepte
 * ou se refuse d'ici ; chaque avis se marque lu, ou tous d'un geste.
 */
export function NotificationBell(props: { className?: string }) {
  const { t } = useDiasporaleT()
  const unread = useUnreadCount()
  const [open, setOpen] = useState(false)
  const count = unread.status === "ready" ? unread.data : null
  const shown = count && count.count > 0 ? (count.capped ? "99+" : `${count.count}${count.truncated ? "+" : ""}`) : null

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={count?.truncated ? t("bell.partialUnread", { count: count.count }) : count && count.count > 0 ? t("bell.openUnread", { count: count.count }) : t("bell.open")}
        onClick={() => setOpen(true)}
        className={cn(
          "relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:shadow-focus",
          props.className,
        )}
      >
        <BellIcon aria-hidden className="size-5" />
        {shown ? (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-primary px-1 text-center text-[11px] font-semibold leading-5 text-primary-foreground"
          >
            {shown}
          </span>
        ) : null}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title={t("bell.title")} description={t("bell.description")} hideDescription closeLabel={t("bell.close")}>
          <NotificationList onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}

function NotificationList(props: { onNavigate: () => void }) {
  const { t } = useDiasporaleT()
  const notifications = useNotifications()
  const actions = useActions()
  // Une date de référence par ouverture : les « il y a … » ne bougent pas pendant la lecture.
  const [now] = useState(() => Date.now())

  if (notifications.status === "loading") {
    return (
      <div className="flex flex-col gap-3 p-5" aria-busy="true">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    )
  }
  if (notifications.status === "error") {
    return (
      <p role="alert" className="p-5 text-sm text-muted-foreground">
        {t(`errors.${notifications.code}`)}
      </p>
    )
  }
  const items = notifications.data
  if (items.length === 0) {
    return <EmptyState icon={<BellIcon />} title={t("bell.emptyTitle")} description={t("bell.emptyBody")} />
  }
  const hasUnread = items.some((item) => !item.read)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {hasUnread ? (
        <div className="flex justify-end px-4 pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const result = await actions.markAllNotificationsRead()
              if (!result.ok) toast.error(t(`errors.${result.code}`))
            }}
          >
            <CheckIcon aria-hidden />
            {t("bell.markAll")}
          </Button>
        </div>
      ) : null}
      <ul className="flex flex-col gap-1 overflow-y-auto px-2 pb-3 pt-1">
        {items.map((item) => (
          <NotificationRow key={item.id} item={item} now={now} onNavigate={props.onNavigate} />
        ))}
      </ul>
    </div>
  )
}

/** La phrase d'un avis : le nom de qui a agi puis la suite, ou une phrase entière du système. */
function NoticeSentence(props: { item: NotificationView; onNavigate: () => void }) {
  const { t } = useDiasporaleT()
  const { routes, Link } = useRouting()
  const { item } = props
  if (!isActorLed(item.kind)) return <>{t(systemSentence(item.kind))}</>
  if (item.actor) {
    return (
      <>
        <Link href={routes.profile(item.actor.handle)} onClick={props.onNavigate} className="font-semibold hover:underline focus-visible:shadow-focus">
          {item.actor.displayName}
        </Link>{" "}
        {t(`bell.kind.${item.kind}`)}
      </>
    )
  }
  // Sans profil publié derrière : un retrait se dit au passif, le reste garde un sujet sans nom.
  if (item.kind === "sponsorship_withdrawn") return <>{t(systemSentence(item.kind))}</>
  return <>{`${t("bell.someone")} ${t(`bell.kind.${item.kind}`)}`}</>
}

function NotificationRow(props: { item: NotificationView; now: number; onNavigate: () => void }) {
  const { t, locale } = useDiasporaleT()
  const actions = useActions()
  const { routes, Link } = useRouting()
  const [busy, setBusy] = useState(false)
  const { item } = props
  const Icon = KIND_ICONS[item.kind]
  const eventHref = item.kind === "association_event_reminder" && item.associationEvent
    ? routes.associationEvent?.(item.associationEvent.pageHandle, item.associationEvent.eventId) ?? routes.page(item.associationEvent.pageHandle) : null
  // Mise en relation : la route qui relit les droits, ou la fiche de la page ; rien sans cible relue.
  const serviceNotice = item.serviceNotice ?? null
  const serviceLink = serviceNotice ? serviceNoticeLink(serviceNotice, routes) : null
  // Décision de modération (P16 · G9) : mes décisions, ou celles d'une page dont je signe.
  const decisionLink = moderationDecisionLink(item, routes)
  // Vie communautaire (vague H) : l'objet relu, par sa route ; rien sans cible relue.
  const communityNotice = item.communityNotice ?? null
  const communityLink = communityNotice ? communityNoticeLink(communityNotice, routes) : null
  // Conversation de mise en relation (CC-6) : le fil relu pour moi, par la route de l'application.
  const conversationHref = item.contextualThreadId ? routes.contextualConversation?.(item.contextualThreadId) : undefined

  const run = async (action: () => Promise<ActionResult>) => {
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (!result.ok) toast.error(t(`errors.${result.code}`))
  }

  return (
    <li>
      <div className={cn("flex gap-3 rounded-xl px-3 py-3", item.read ? "" : "bg-[var(--primary-50)]")}>
        <span aria-hidden className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] leading-snug">
            <NoticeSentence item={item} onNavigate={props.onNavigate} />
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {formatRelative(item.createdAt, props.now, locale)}
            {item.inviteOutcome ? ` · ${t(`bell.outcome.${item.inviteOutcome}`)}` : null}
            {item.read ? null : <span className="sr-only"> · {t("bell.unread")}</span>}
          </p>
          {eventHref ? <Link href={eventHref} onClick={props.onNavigate} className="mt-1 inline-flex text-[13px] font-semibold text-[var(--esp-accent-deep)] hover:underline focus-visible:shadow-focus">{t("bell.openAssociationEvent")}</Link> : null}
          {serviceNotice && serviceLink ? (
            <Link href={serviceLink.href} onClick={props.onNavigate} className="mt-1 inline-flex text-[13px] font-semibold text-[var(--esp-accent-deep)] hover:underline focus-visible:shadow-focus">
              {serviceLink.deep ? t(`bell.serviceLink.${serviceNotice.audience}`) : t("bell.serviceLinkPage")}
            </Link>
          ) : null}
          {decisionLink ? (
            <Link href={decisionLink.href} onClick={props.onNavigate} className="mt-1 inline-flex text-[13px] font-semibold text-[var(--esp-accent-deep)] hover:underline focus-visible:shadow-focus">
              {t(decisionLink.page ? "bell.openPageDecisions" : "bell.openMyDecisions")}
            </Link>
          ) : null}
          {communityLink ? (
            <Link href={communityLink.href} onClick={props.onNavigate} className="mt-1 inline-flex text-[13px] font-semibold text-[var(--esp-accent-deep)] hover:underline focus-visible:shadow-focus">
              {t(communityLink.label)}
            </Link>
          ) : null}
          {conversationHref ? (
            <Link href={conversationHref} onClick={props.onNavigate} className="mt-1 inline-flex text-[13px] font-semibold text-[var(--esp-accent-deep)] hover:underline focus-visible:shadow-focus">
              {t("bell.openConversation")}
            </Link>
          ) : null}
          {item.postId ? (
            <Link
              href={routes.post(item.postId)}
              onClick={props.onNavigate}
              className="mt-1 inline-flex text-[13px] font-semibold text-[var(--esp-accent-deep)] hover:underline focus-visible:shadow-focus"
            >
              {t("bell.openPost")}
            </Link>
          ) : null}
          {item.pendingConnectionId ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => run(() => actions.respondToConnection(item.pendingConnectionId ?? "", true))}>
                <UserCheckIcon aria-hidden />
                {t("relation.accept")}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => actions.respondToConnection(item.pendingConnectionId ?? "", false))}>
                {t("relation.decline")}
              </Button>
            </div>
          ) : null}
        </div>
        {item.read ? null : (
          <Button variant="ghost" size="sm" disabled={busy} aria-label={t("bell.markRead")} onClick={() => run(() => actions.markNotificationRead(item.id))}>
            <CheckIcon aria-hidden />
          </Button>
        )}
      </div>
    </li>
  )
}
