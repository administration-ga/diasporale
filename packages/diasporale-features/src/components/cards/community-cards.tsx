"use client"

import {
  BriefcaseBusinessIcon,
  HandHeartIcon,
  HouseIcon,
  LockIcon,
  MapPinIcon,
  MessagesSquareIcon,
  PackageIcon,
  ShoppingBagIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

import type { ClassifiedCategory, ClassifiedView, GroupView, JobView, MentorView, TalentView } from "../../data/types"
import { useDiasporaleT } from "../../i18n/client"
import { cn } from "../../lib/cn"
import { formatDate, formatRelative } from "../../lib/format"
import { Avatar, Card } from "../../primitives/surface"
import { ContentScopeTag, CountryTag } from "../country-tag"
import { SponsoredBadge, TrustBadge, TrustBadges } from "../trust-badge"

const chip = "rounded-[var(--radius-xs)] bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground"

/** Offre d'emploi (C4) — état « Pourvue » grisé ; « Sponsorisée » toujours étiquetée (D4). */
export function JobCard(props: { job: JobView; now: number; className?: string }) {
  const { t, locale } = useDiasporaleT()
  const { job } = props
  return (
    <Card className={cn("animate-rise flex flex-col gap-2 p-4", job.filled && "opacity-70", props.className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={chip}>{t(`job.contract.${job.contract}`)}</span>
        {job.sponsored ? <SponsoredBadge /> : null}
        {job.filled ? <span className={chip}>{t("job.filled")}</span> : null}
      </div>
      <h3 className="text-[15px] font-semibold leading-snug">{job.title}</h3>
      <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
        <Avatar id={job.employer.id} name={job.employer.name} size="sm" shape="square" />
        <span className="font-medium">{job.employer.name}</span>
        <TrustBadge badge={job.employer.badge} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPinIcon className="size-3.5" aria-hidden />
          {job.city}
        </span>
        <ContentScopeTag scope={job.scope} />
        {job.salary ? <span className="font-mono text-xs">{job.salary}</span> : null}
        <time dateTime={new Date(job.publishedAt).toISOString()}>{formatRelative(job.publishedAt, props.now, locale)}</time>
      </div>
    </Card>
  )
}

const CLASSIFIED_ICONS: Record<ClassifiedCategory, LucideIcon> = {
  housing: HouseIcon,
  goods: ShoppingBagIcon,
  services: WrenchIcon,
  parcel: PackageIcon,
  other: BriefcaseBusinessIcon,
}

/** Petite annonce (C5) — vignette 4:3, prix en gras, badge Vérifié du vendeur. */
export function ClassifiedCard(props: { item: ClassifiedView; now: number; className?: string }) {
  const { t, locale } = useDiasporaleT()
  const { item } = props
  const Icon = CLASSIFIED_ICONS[item.category]
  return (
    <Card className={cn("animate-rise overflow-hidden", props.className)}>
      <div aria-hidden className="grid aspect-[4/3] place-items-center bg-tag text-tag-code">
        <Icon className="size-10 opacity-70" />
      </div>
      <div className="flex flex-col gap-1.5 p-3">
        <span className={cn(chip, "self-start")}>{t(`classified.category.${item.category}`)}</span>
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug">{item.title}</h3>
        {item.price ? <p className="font-mono text-base font-semibold">{item.price}</p> : null}
        <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
          <CountryTag country={item.country} city={item.city} />
          <time dateTime={new Date(item.publishedAt).toISOString()}>{formatRelative(item.publishedAt, props.now, locale)}</time>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <span>{item.seller.displayName}</span>
          <TrustBadges badges={item.seller.badges} />
        </div>
      </div>
    </Card>
  )
}

/** Talent (C6) — prénom et initiale seulement, trois compétences, langues calculées. */
export function TalentCard(props: { talent: TalentView; className?: string }) {
  const { t, locale } = useDiasporaleT()
  const { talent } = props
  const languageNames = new Intl.DisplayNames([locale], { type: "language" })
  return (
    <Card className={cn("animate-rise flex flex-col gap-3 p-4", props.className)}>
      <div className="flex items-start gap-3">
        <Avatar id={talent.personId} name={talent.shortName} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{talent.shortName}</h3>
          <p className="text-[13px] text-muted-foreground">{talent.title}</p>
          <TrustBadges badges={talent.badges} className="mt-1.5" />
        </div>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label={t("talent.skills")}>
        {talent.skills.slice(0, 3).map((skill) => (
          <li key={skill} className={chip}>
            {skill}
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-muted-foreground">
        {t("talent.languages", { languages: talent.languages.map((code) => languageNames.of(code) ?? code).join(", ") })}
      </p>
      <CountryTag country={talent.country} city={talent.city ?? undefined} className="self-start" />
    </Card>
  )
}

/** Groupe (C7) — nombre de membres, extrait du dernier message, pastille de non-lus, « Privé ». */
export function GroupCard(props: { group: GroupView; className?: string }) {
  const { t } = useDiasporaleT()
  const { group } = props
  return (
    <Card className={cn("animate-rise flex items-center gap-3 p-3", props.className)}>
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-lg bg-tag text-tag-code">
        <MessagesSquareIcon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="truncate font-semibold">{group.name}</h3>
          {group.private ? (
            <span className={cn(chip, "inline-flex items-center gap-1")}>
              <LockIcon className="size-3" aria-hidden />
              {t("group.private")}
            </span>
          ) : null}
        </div>
        <p className="truncate text-[13px] text-muted-foreground">
          {group.lastMessage ?? t("group.members", { count: group.memberCount })}
        </p>
        <ContentScopeTag scope={group.scope} className="mt-1" />
      </div>
      {group.unread > 0 ? (
        <span className="grid min-w-6 place-items-center rounded-full bg-primary px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary-foreground">
          <span aria-hidden>{group.unread}</span>
          <span className="sr-only">{t("group.unread", { count: group.unread })}</span>
        </span>
      ) : null}
    </Card>
  )
}

/** Mentor (C9) — badge « Mentor », domaines d'aide, ancienneté dans le pays. */
export function MentorCard(props: { mentor: MentorView; className?: string }) {
  const { t, locale } = useDiasporaleT()
  const { mentor } = props
  return (
    <Card className={cn("animate-rise flex flex-col gap-3 p-4", props.className)}>
      <div className="flex items-start gap-3">
        <Avatar id={mentor.personId} name={mentor.shortName} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="font-semibold">{mentor.shortName}</h3>
            <span className="inline-flex h-6 items-center gap-1 rounded-[var(--radius-xs)] bg-verified px-2 text-[11px] font-semibold text-verified-foreground">
              <HandHeartIcon className="size-3.5" aria-hidden />
              {t("mentor.badge")}
            </span>
          </div>
          {mentor.arrivedAt ? (
            <p className="text-[13px] text-muted-foreground">
              {t("mentor.since", { year: formatDate(Date.UTC(mentor.arrivedAt, 0, 1), locale, { year: "numeric" }) })}
            </p>
          ) : null}
        </div>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label={t("mentor.domains")}>
        {mentor.domains.map((domain) => (
          <li key={domain} className={chip}>
            {t(`mentor.domain.${domain}`)}
          </li>
        ))}
      </ul>
      <CountryTag country={mentor.country} city={mentor.city ?? undefined} className="self-start" />
    </Card>
  )
}
