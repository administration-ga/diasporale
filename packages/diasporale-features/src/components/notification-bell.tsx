"use client"

import {
  BadgeCheckIcon,
  BellIcon,
  CheckIcon,
  HandshakeIcon,
  HeartIcon,
  type LucideIcon,
  MessageCircleIcon,
  ShieldQuestionIcon,
  SparklesIcon,
  UserCheckIcon,
  UserPlusIcon,
  AtSignIcon,
  UserMinusIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { ActionResult } from "../data/port"
import { useActions, useNotifications, useUnreadCount } from "../data/context"
import type { NotificationKind, NotificationView } from "../data/types"
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
  mention: AtSignIcon,
  sponsorship_received: HandshakeIcon,
  sponsorship_withdrawn: UserMinusIcon,
  attestation_verified: BadgeCheckIcon,
  attestation_not_confirmed: ShieldQuestionIcon,
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
  "mention",
  "sponsorship_received",
  "sponsorship_withdrawn",
] as const satisfies readonly NotificationKind[]
type ActorLedKind = (typeof BELL_ACTOR_LED_KINDS)[number]
const ACTOR_LED: ReadonlySet<NotificationKind> = new Set(BELL_ACTOR_LED_KINDS)

function isActorLed(kind: NotificationKind): kind is ActorLedKind {
  return ACTOR_LED.has(kind)
}

/** Les phrases entières du système ; un retrait de parrainage en a une pour quand personne n'est nommé. */
export const BELL_SYSTEM_KINDS = ["sponsorship_withdrawn", "attestation_verified", "attestation_not_confirmed", "other"] as const satisfies readonly NotificationKind[]
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
  const shown = count && count.count > 0 ? (count.capped ? "99+" : String(count.count)) : null

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={count && count.count > 0 ? t("bell.openUnread", { count: count.count }) : t("bell.open")}
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
