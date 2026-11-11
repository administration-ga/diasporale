"use client"

import {
  BadgeCheckIcon,
  BadgeIcon,
  BellIcon,
  Building2Icon,
  BriefcaseBusinessIcon,
  CalendarIcon,
  CalendarCheck2Icon,
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarOffIcon,
  CalendarSyncIcon,
  CalendarPlusIcon,
  CalendarX2Icon,
  CalendarXIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleXIcon,
  FileLockIcon,
  FileTextIcon,
  FlagIcon,
  GavelIcon,
  GraduationCapIcon,
  HandHeartIcon,
  HandshakeIcon,
  HeartIcon,
  HourglassIcon,
  IdCardIcon,
  ImagesIcon,
  InboxIcon,
  KeyRoundIcon,
  LandmarkIcon,
  MessageSquareMoreIcon,
  PhoneMissedIcon,
  UserRoundPlusIcon,
  VoicemailIcon,
  type LucideIcon,
  MessageCircleIcon,
  MessageCircleOffIcon,
  MessageSquareReplyIcon,
  MessagesSquareIcon,
  Repeat2Icon,
  ScaleIcon,
  ShieldQuestionIcon,
  SparklesIcon,
  TicketCheckIcon,
  UserCheckIcon,
  UserPlusIcon,
  UserRoundCheckIcon,
  UserRoundXIcon,
  UsersIcon,
  UsersRoundIcon,
  UserXIcon,
  AtSignIcon,
  UserMinusIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { ActionResult } from "../data/port"
import { useActions, useNotifications, useUnreadCount } from "../data/context"
import {
  ASSOCIATION_EVENT_NOTIFICATION_KINDS,
  COMMUNITY_NOTIFICATION_KINDS,
  CONTEXTUAL_NOTIFICATION_KINDS,
  ICOM_NOTIFICATION_KINDS,
  PAGE_GOVERNANCE_NOTIFICATION_KINDS,
  REPORTER_NOTIFICATION_KINDS,
  SERVICE_NOTIFICATION_KINDS,
  type NotificationKind,
  type NotificationView,
} from "../data/types"
import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"
import { formatRelative } from "../lib/format"
import { Button } from "../primitives/button"
import { Sheet, SheetContent } from "../primitives/sheet"
import { Skeleton } from "../primitives/surface"
import { useRouting } from "../routing"
import { EmptyState } from "./empty-state"
import { noticeLink } from "./notification-destinations"

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
  // EV-03 : l'évènement est annulé ; la personne en attente obtient sa place.
  association_event_cancelled: CalendarX2Icon,
  association_event_seat_confirmed: TicketCheckIcon,
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
  // SV-03 : déplacement d'un rendez-vous.
  service_booking_reschedule_proposed: CalendarSyncIcon,
  service_booking_rescheduled: CalendarCheck2Icon,
  association_membership_requested: UsersIcon,
  association_membership_accepted: UserRoundCheckIcon,
  association_membership_declined: UserRoundXIcon,
  association_membership_removed: UserMinusIcon,
  service_review_replied: MessageSquareReplyIcon,
  // Vie communautaire (vague H : entraide, mentorat, emploi, kit d'arrivée).
  aid_answer_received: MessagesSquareIcon,
  aid_answer_retained: CircleCheckIcon,
  aid_mission_signup: HandHeartIcon,
  // ET-01 : au bénévole inscrit, la mission annulée ou déplacée.
  aid_mission_cancelled: CalendarOffIcon,
  aid_mission_rescheduled: CalendarClockIcon,
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
  // SU01d : l'accusé de réception et la décision, au déclarant.
  report_received: FlagIcon,
  report_decided: GavelIcon,
  // NP-04 : genres communs du moteur nommés par DIASPORALE.
  page_post: Building2Icon,
  album_published: ImagesIcon,
  file_withheld: FileLockIcon,
  thematic_group_invite: UsersRoundIcon,
  event_invite: CalendarPlusIcon,
  membership_changed: IdCardIcon,
  badge_changed: BadgeIcon,
  // PG-01 du moteur : invitation à signer pour une page, revendication tranchée.
  page_signatory_invite: KeyRoundIcon,
  page_claim_decided: LandmarkIcon,
  // IM-04 : message et invitation de groupe, appel manqué, message vocal.
  group_message: MessageSquareMoreIcon,
  group_added: UserRoundPlusIcon,
  call_missed: PhoneMissedIcon,
  voicemail_left: VoicemailIcon,
  other: BellIcon,
}

/** L'icône de chaque genre de notre liste (lue par le test de complétude de la cloche). */
export const BELL_KIND_ICONS: Readonly<Record<string, LucideIcon>> = KIND_ICONS

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
  // NP-04 : un album publié, une invitation à un groupe ou à un évènement.
  "album_published",
  "thematic_group_invite",
  "event_invite",
  // IM-04 : l'auteur du message, de l'invitation, de l'appel ou du message vocal, par son profil publié.
  ...ICOM_NOTIFICATION_KINDS,
] as const satisfies readonly NotificationKind[]
type ActorLedKind = (typeof BELL_ACTOR_LED_KINDS)[number]
const ACTOR_LED: ReadonlySet<NotificationKind> = new Set(BELL_ACTOR_LED_KINDS)

function isActorLed(kind: NotificationKind): kind is ActorLedKind {
  return ACTOR_LED.has(kind)
}

/**
 * Les phrases entières du système ; un retrait de parrainage en a une pour quand personne n'est nommé.
 * Les avis de mise en relation en sont : neutres, ils ne nomment personne. Une publication de page
 * suivie en a une pour quand la page n'est plus active (sinon son nom mène la phrase).
 */
export const BELL_SYSTEM_KINDS = [
  "sponsorship_withdrawn",
  "attestation_verified",
  "attestation_not_confirmed",
  ...ASSOCIATION_EVENT_NOTIFICATION_KINDS,
  ...SERVICE_NOTIFICATION_KINDS,
  ...COMMUNITY_NOTIFICATION_KINDS,
  ...CONTEXTUAL_NOTIFICATION_KINDS,
  "moderation_decision",
  ...REPORTER_NOTIFICATION_KINDS,
  // NP-04 : page suivie (sans carte), fichier retenu, statut et badges changés.
  "page_post",
  "file_withheld",
  "membership_changed",
  "badge_changed",
  ...PAGE_GOVERNANCE_NOTIFICATION_KINDS,
  "other",
] as const satisfies readonly NotificationKind[]
type SystemKind = (typeof BELL_SYSTEM_KINDS)[number]

/** La clé d'une phrase du système : un genre nouveau, sans phrase ni nom devant, ne compile pas. */
function systemSentence(kind: SystemKind): `bell.system.${SystemKind}` {
  return `bell.system.${kind}`
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
  const { routes, Link } = useRouting()
  // NP-04 : la page des notifications, quand l'application la sert ; sinon la feuille reste seule.
  const allHref = routes.notifications?.()
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
      {allHref ? (
        <div className="border-t border-border px-4 py-3">
          <Link href={allHref} onClick={props.onNavigate} className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--esp-accent-deep)] hover:underline focus-visible:shadow-focus">
            {t("bell.seeAll")}
          </Link>
        </div>
      ) : null}
    </div>
  )
}

/** La phrase d'un avis : le nom de qui a agi puis la suite, ou une phrase entière du système. */
function NoticeSentence(props: { item: NotificationView; onNavigate: () => void }) {
  const { t } = useDiasporaleT()
  const { routes, Link } = useRouting()
  const { item } = props
  // NP-04 : la page suivie qui a publié se nomme par sa carte publique ; sans elle, la phrase du système.
  if (item.kind === "page_post" && item.page) {
    return (
      <>
        <Link href={routes.page(item.page.handle)} onClick={props.onNavigate} className="font-semibold hover:underline focus-visible:shadow-focus">
          {item.page.name}
        </Link>{" "}
        {t("bell.kind.page_post")}
      </>
    )
  }
  // NP-04 : un fichier retenu que l'analyse a depuis libéré se dit tel quel.
  if (item.kind === "file_withheld" && item.fileReleased) return <>{t("bell.fileReleased")}</>
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

/**
 * Une ligne d'avis : son icône, sa phrase, sa date, l'issue d'une invitation, puis le lien vers son
 * objet (`noticeLink`, une destination par genre). Partagée par la feuille de la cloche et la page
 * des notifications (NP-04).
 */
export function NotificationRow(props: { item: NotificationView; now: number; onNavigate: () => void }) {
  const { t, locale } = useDiasporaleT()
  const actions = useActions()
  const { routes, Link } = useRouting()
  const [busy, setBusy] = useState(false)
  const { item } = props
  const Icon = KIND_ICONS[item.kind]
  // L'objet de l'avis, par la route de l'application, qui relit les droits à l'ouverture ; rien sans cible relue.
  const link = noticeLink(item, routes)

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
          {link ? (
            <Link href={link.href} onClick={props.onNavigate} className="mt-1 inline-flex text-[13px] font-semibold text-[var(--esp-accent-deep)] hover:underline focus-visible:shadow-focus">
              {t(link.label)}
            </Link>
          ) : null}
          {item.pendingConnectionId ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="social" size="sm" disabled={busy} onClick={() => run(() => actions.respondToConnection(item.pendingConnectionId ?? "", true))}>
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
