"use client"

/**
 * Briques communes des écrans « talents et emploi » (DG-025) : carte d'une
 * offre, carte d'un talent, étiquettes, formats (rémunération ANNONCÉE, lieu,
 * date limite), état « indisponible », clé d'envoi et geste unique (un envoi à
 * la fois). PROPRIÉTAIRE : chantier « talents et emploi ».
 *
 * Aucune coordonnée nulle part : on candidate sur DIASPORALE ; un talent se
 * montre par son nom court et ses compétences DÉCLARÉES, jamais par une adresse.
 * Un profil de talent trouvé se signale (G9, chantier « confiance des surfaces ») ;
 * l'état de modération d'un contenu géré se dit dans les seules vues de gestion.
 */
import { utcToZonedWallTime, zonedWallTimeToUtc, type CountryCode, type JobPayRangeLike } from "@diasporale/domain"
import { Card, EmptyState, TrustBadge, countryName, formatDate } from "@diasporale/features"
import type { ActionErrorCode, ContentReportTarget, JobOfferCardView, ManagedModerationState, TalentHitView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { BriefcaseBusinessIcon, CircleAlertIcon, ClockIcon, MapPinIcon, type LucideIcon } from "lucide-react"
import NextLink from "next/link"
import { useLayoutEffect, useRef, useState, type ReactNode } from "react"

import { routes } from "@/lib/routes"

import { ReportContentAction, ReportedContent } from "./report-content-sheet"
import { formatMoney, languageList } from "./service-format"

type Translate = (key: string, options?: Record<string, unknown>) => string

export const jobSelectClass = "h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus aria-invalid:border-destructive disabled:opacity-55"

const chipClass = "rounded-[var(--radius-xs)] bg-[var(--esp-neutral-chip)] px-2 py-0.5 text-[12px] font-medium text-foreground"

/** Une étiquette discrète (contrat, mode, état). */
export function JobChip(props: { readonly children: ReactNode }) {
  return <span className={chipClass}>{props.children}</span>
}

/** La rémunération ANNONCÉE par la page : fourchette, montant unique, « jusqu'à », ou non communiquée. */
export function formatJobPay(payRange: JobPayRangeLike | null, locale: string, t: Translate): string {
  if (payRange === null) return t("jobs.pay.none")
  const period = t(`jobs.payPeriod.${payRange.period}`)
  const max = formatMoney(payRange.maxMinor, payRange.currency, locale)
  if (payRange.minMinor === payRange.maxMinor) return t("jobs.pay.single", { amount: max, period })
  if (payRange.minMinor === 0) return t("jobs.pay.upTo", { max, period })
  return t("jobs.pay.range", { min: formatMoney(payRange.minMinor, payRange.currency, locale), max, period })
}

/** Le lieu : la ville saisie et le pays, ou le pays seul. */
export function jobPlace(place: { readonly country: CountryCode; readonly city: string | null }, locale: string, t: Translate): string {
  const country = countryName(place.country, locale)
  return place.city ? t("jobs.card.place", { city: place.city, country }) : country
}

/** Le fuseau du navigateur : une date limite se pense dans le fuseau de la personne qui la pose. */
export function jobTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

/** Une date limite saisie (AAAA-MM-JJ) : la fin de ce jour, dans le fuseau du navigateur ; `null` si illisible. */
export function deadlineFromDate(date: string, timeZone: string): number | null {
  const instant = zonedWallTimeToUtc({ date, time: "23:59" }, timeZone)
  return instant.ok ? instant.value : null
}

/** La date (AAAA-MM-JJ) d'une date limite, pour la ressaisir. */
export function dateOfDeadline(closesAt: number | null, timeZone: string): string {
  if (closesAt === null) return ""
  return utcToZonedWallTime(closesAt, timeZone)?.date ?? ""
}

/** Une clé d'envoi neuve, pour une nouvelle feuille (idempotence d'une candidature). */
export function newJobIdempotencyKey(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `candidature-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  }
}

/** Un geste à la fois : rend `null` s'il a abouti, son code fermé sinon ; une réponse après démontage est ignorée. */
export function useJobGesture() {
  const locked = useRef(false)
  const active = useRef(true)
  useLayoutEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const [busy, setBusy] = useState(false)
  const run = async (gesture: () => Promise<ActionErrorCode | null>): Promise<ActionErrorCode | null | "busy"> => {
    if (locked.current) return "busy"
    locked.current = true
    setBusy(true)
    try {
      return await gesture()
    } catch {
      return "unknown"
    } finally {
      locked.current = false
      if (active.current) setBusy(false)
    }
  }
  return { busy, run, isActive: () => active.current }
}

/** Les mots de l'état de modération d'un contenu géré (G9), par objet : en relecture préalable, ou retiré. */
const MODERATION_NOTES = {
  offer: { pending_review: "jobs.moderation.offer.pending_review", removed: "jobs.moderation.offer.removed" },
  application: { pending_review: "jobs.moderation.application.pending_review", removed: "jobs.moderation.application.removed" },
  talent: { pending_review: "jobs.moderation.talent.pending_review", removed: "jobs.moderation.talent.removed" },
} as const satisfies Readonly<Record<string, Readonly<Record<Exclude<ManagedModerationState, "published">, string>>>>

/** La pastille de l'état, aux tons de l'avis de modération : icône ET texte, jamais la seule couleur. */
const MODERATION_MARKS: Readonly<Record<Exclude<ManagedModerationState, "published">, { readonly icon: LucideIcon; readonly tone: string }>> = {
  pending_review: { icon: ClockIcon, tone: "bg-pending text-pending-foreground" },
  removed: { icon: CircleAlertIcon, tone: "bg-rejected text-rejected-foreground" },
}

/**
 * L'état de modération d'un contenu que la personne GÈRE (G9), en une courte mention de liste :
 * l'offre pour l'équipe vivante de sa page, la candidature et le profil pour leur personne
 * propriétaire. Rien pour un contenu publié, ni chez un fournisseur qui ne modère pas (état
 * absent) ; seules les vues de gestion la montent, aucun autre lecteur ne reçoit cet état.
 */
export function JobModerationNote(props: { readonly subject: keyof typeof MODERATION_NOTES; readonly state: ManagedModerationState | undefined }) {
  const { t } = useDiasporaleT()
  const { state } = props
  if (state === undefined || state === "published") return null
  const mark = MODERATION_MARKS[state]
  const Icon = mark.icon
  return (
    <p role="status" data-moderation={state} className="flex min-w-0 items-start gap-2 rounded-lg bg-muted px-3 py-2 text-[13px]">
      <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-full ${mark.tone}`}>
        <Icon className="size-3" />
      </span>
      <span className="min-w-0 break-words">{t(MODERATION_NOTES[props.subject][state])}</span>
    </p>
  )
}

/** La capacité n'est pas servie par ce fournisseur : on le dit, rien n'est inventé à sa place. */
export function JobsUnavailable() {
  const { t } = useDiasporaleT()
  return <EmptyState icon={<BriefcaseBusinessIcon />} title={t("jobs.unavailable.title")} description={t("jobs.unavailable.body")} />
}

/** Une offre dans une liste : contrat, mode, page qui recrute (badge calculé), lieu, rémunération annoncée, date limite. */
export function JobOfferCard(props: { readonly offer: JobOfferCardView }) {
  const { t, locale } = useDiasporaleT()
  const { offer } = props
  return (
    <Card className="flex h-full min-w-0 flex-col gap-2 p-4">
      <p className="flex flex-wrap items-center gap-1.5">
        <JobChip>{t(`job.contract.${offer.contract}`)}</JobChip>
        <JobChip>{t(`jobs.workMode.${offer.workMode}`)}</JobChip>
      </p>
      <h3 className="min-w-0 break-words text-[15px] font-semibold leading-snug">
        <NextLink href={routes.jobOffer(offer.id)} className="rounded-sm hover:underline focus-visible:shadow-focus">{offer.title}</NextLink>
      </h3>
      <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-[13px]">
        <span className="min-w-0 break-words font-medium">{t("jobs.card.by", { name: offer.employer.name })}</span>
        <TrustBadge badge={offer.employer.badge} />
      </p>
      <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1 break-words">
          <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
          {jobPlace(offer, locale, t)}
        </span>
        <span>{formatJobPay(offer.payRange, locale, t)}</span>
        {offer.closesAt !== null ? <span>{t("jobs.card.closesAt", { date: formatDate(offer.closesAt, locale) })}</span> : null}
      </p>
    </Card>
  )
}

/** Un talent trouvé : nom COURT, titre, compétences déclarées, disponibilité, langues, pays — aucune coordonnée. */
export function TalentHitCard(props: { readonly talent: TalentHitView }) {
  const { t, locale } = useDiasporaleT()
  const { talent } = props
  // G9 : la recherche ne rend jamais son propre profil (les deux fournisseurs l'écartent) : tout profil trouvé se signale.
  const reportTarget: ContentReportTarget = { kind: "diasporaTalentProfile", id: talent.id }
  return (
    <ReportedContent target={reportTarget} className="h-full">
      <Card className="flex h-full min-w-0 flex-col gap-2 p-4">
        <h3 className="min-w-0 break-words font-semibold">{talent.shortName}</h3>
        <p className="min-w-0 break-words text-[13px] text-muted-foreground">{talent.title}</p>
        <ul className="flex flex-wrap gap-1.5" aria-label={t("jobs.talentCard.skills")}>
          {talent.skills.map((skill) => (
            <li key={skill} className={chipClass}>{skill}</li>
          ))}
        </ul>
        <p className="text-[13px]">{t(`jobs.availability.${talent.availability}`)}</p>
        <p className="text-[13px] text-muted-foreground">
          {t("jobs.talentCard.languages", { languages: languageList(talent.languages, locale) })}
          {" · "}
          {countryName(talent.country, locale)}
        </p>
        <ReportContentAction target={reportTarget} className="mt-auto self-start" />
      </Card>
    </ReportedContent>
  )
}

/** Un détail de fiche : libellé et valeur. */
export function JobDetail(props: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted px-3 py-2">
      <dt className="text-[13px] text-muted-foreground">{props.label}</dt>
      <dd className="break-words font-medium">{props.children}</dd>
    </div>
  )
}
