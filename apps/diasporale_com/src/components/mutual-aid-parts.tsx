"use client"

/**
 * Briques communes des surfaces « entraide » (DG-024 a) : états, lieux, horaires
 * d'une mission, nom affiché d'une personne, confirmation d'un geste sensible,
 * mention de l'état de modération dans une liste de gestion (G9).
 * PROPRIÉTAIRE : chantier « entraide ».
 *
 * Une personne s'affiche telle qu'elle a PUBLIÉ son profil (jamais un nom
 * reconstruit) ; sans profil publié, le nom neutre. Une heure de mission se lit
 * dans le fuseau de l'équipe, et dans celui du lecteur s'il vit ailleurs.
 */
import { HOUR_MS, isAidMissionPast, type AidMissionStatus, type AidQuestionStatus, type AidTheme, type ContentModerationState, type CountryCode } from "@diasporale/domain"
import { Button, Sheet, SheetClose, SheetContent, countryName } from "@diasporale/features"
import { moderationBannerState, type AidPersonView, type ManagedModerationState } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { CircleAlertIcon, ClockIcon, type LucideIcon } from "lucide-react"
import NextLink from "next/link"
import { useRef, useState } from "react"

import { routes } from "@/lib/routes"

import { browserTimeZone, formatServiceInstant, formatServiceSlot } from "./service-request-ui"

const chipClass = "inline-flex shrink-0 items-center rounded-full bg-muted px-2.5 py-0.5 text-[13px] font-medium text-foreground"
export const aidLinkClass = "break-words font-semibold text-primary hover:underline focus-visible:shadow-focus"

/** Le début de l'heure courante : la borne des missions « à venir », fixée à l'ouverture d'une liste. */
export function aidListStart(now: number): number {
  return now - (now % HOUR_MS)
}

export function AidThemeChip(props: { readonly theme: AidTheme }) {
  const { t } = useDiasporaleT()
  return <span className={chipClass}>{t(`mutualAid.theme.${props.theme}`)}</span>
}

export function AidQuestionStatusChip(props: { readonly status: AidQuestionStatus }) {
  const { t } = useDiasporaleT()
  return <span data-status={props.status} className={chipClass}>{t(`mutualAid.questionStatus.${props.status}`)}</span>
}

/** La mention d'un état de modération, aux tons de l'avis de modération : pastille d'icône ET libellé, jamais la seule couleur. */
const MODERATION_MENTIONS: Readonly<Record<Exclude<ContentModerationState, "published">, { readonly key: string; readonly icon: LucideIcon; readonly tone: string }>> = {
  pending_review: { key: "mutualAid.moderation.pending", icon: ClockIcon, tone: "bg-pending text-pending-foreground" },
  rejected: { key: "mutualAid.moderation.removed", icon: CircleAlertIcon, tone: "bg-rejected text-rejected-foreground" },
}

/**
 * G9 — l'état de modération d'un contenu que le lecteur GÈRE (sa question, sa
 * réponse, une mission de son association), en courte mention de liste ; rien
 * pour un contenu publié ni sans état. L'appelant ne la pose que dans une vue de
 * gestion : le fournisseur ne sert de toute façon l'état à personne d'autre.
 */
export function AidModerationChip(props: { readonly state: ManagedModerationState | undefined }) {
  const { t } = useDiasporaleT()
  const state = moderationBannerState(props.state)
  if (state === null) return null
  const mention = MODERATION_MENTIONS[state]
  const Icon = mention.icon
  return (
    <span data-moderation={state} className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-medium ${mention.tone}`}>
      <Icon aria-hidden className="size-3.5" />
      {t(mention.key)}
    </span>
  )
}

/** L'état d'une mission ; une mission passée le dit, quel que soit son état. */
export function AidMissionStatusChip(props: { readonly status: AidMissionStatus; readonly startsAt: number; readonly endsAt: number | null; readonly now: number }) {
  const { t } = useDiasporaleT()
  const past = isAidMissionPast({ startsAt: props.startsAt, endsAt: props.endsAt }, props.now)
  return <span data-status={props.status} className={chipClass}>{past && props.status !== "cancelled" ? t("mutualAid.mission.past") : t(`mutualAid.missionStatus.${props.status}`)}</span>
}

/** « Lyon, France » ou « France » : le lieu tel qu'il a été saisi, le pays dans la langue de l'écran. */
export function AidPlace(props: { readonly country: CountryCode; readonly city: string | null; readonly area?: string | null }) {
  const { t, locale } = useDiasporaleT()
  const country = countryName(props.country, locale)
  const place = props.city ? t("mutualAid.place.cityCountry", { city: props.city, country }) : country
  return (
    <span className="break-words">
      {props.area ? t("mutualAid.place.withArea", { place, area: props.area }) : place}
    </span>
  )
}

/** Le nom PUBLIÉ d'une personne, lien vers son profil (d'où passe la messagerie) ; sinon le nom neutre. */
export function AidPersonName(props: { readonly person: AidPersonView }) {
  const { t } = useDiasporaleT()
  const { displayName, handle } = props.person
  if (displayName && handle) return <NextLink href={routes.profile(handle)} className={aidLinkClass}>{displayName}</NextLink>
  return <span className="font-semibold">{displayName ?? t("mutualAid.person.neutral")}</span>
}

/** L'horaire d'une mission dans le fuseau de l'équipe, et dans celui du lecteur s'il vit ailleurs. */
export function AidMissionWhen(props: { readonly startsAt: number; readonly endsAt: number | null; readonly timeZone: string }) {
  const { t, locale } = useDiasporaleT()
  const [viewerZone] = useState(() => browserTimeZone())
  const say = (zone: string) => (props.endsAt === null
    ? formatServiceInstant(props.startsAt, zone, locale)
    : formatServiceSlot({ startAt: props.startsAt, endAt: props.endsAt }, zone, locale))
  return (
    <span className="flex min-w-0 flex-col">
      <span className="break-words">{t("mutualAid.mission.inZone", { when: say(props.timeZone), zone: props.timeZone })}</span>
      {viewerZone !== props.timeZone ? (
        <span className="break-words text-[13px] text-muted-foreground">{t("mutualAid.mission.yourTime", { when: say(viewerZone), zone: viewerZone })}</span>
      ) : null}
    </span>
  )
}

/**
 * Un geste sensible CONFIRMÉ (clore, retirer, se désinscrire) : une feuille,
 * le focus d'abord sur « Annuler », une seule confirmation à la fois.
 */
export function AidConfirmButton(props: {
  readonly label: string
  readonly title: string
  readonly body: string
  readonly confirmLabel: string
  readonly busy: boolean
  readonly destructive?: boolean
  readonly onConfirm: () => Promise<boolean>
}) {
  const { t } = useDiasporaleT()
  const [open, setOpen] = useState(false)
  const cancel = useRef<HTMLButtonElement>(null)
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!props.busy) setOpen(next) }}>
      <Button variant={props.destructive ? "ghost" : "outline"} className={props.destructive ? "text-destructive" : undefined} disabled={props.busy} onClick={() => setOpen(true)}>
        {props.label}
      </Button>
      <SheetContent
        title={props.title}
        description={props.body}
        closeLabel={t("common.close")}
        onOpenAutoFocus={(event) => { event.preventDefault(); cancel.current?.focus() }}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <SheetClose asChild><Button ref={cancel} variant="ghost" disabled={props.busy}>{t("common.cancel")}</Button></SheetClose>
          <Button
            variant={props.destructive ? "destructive" : "primary"}
            disabled={props.busy}
            aria-busy={props.busy}
            onClick={async () => {
              if (await props.onConfirm()) setOpen(false)
            }}
          >
            {props.busy ? t("common.pleaseWait") : props.confirmLabel}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
