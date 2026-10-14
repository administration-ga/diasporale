"use client"

import type { TrustBadge as TrustBadgeKind } from "@diasporale/domain"
import { BadgeCheckIcon, IdCardIcon, LandmarkIcon, MegaphoneIcon, UsersIcon, type LucideIcon } from "lucide-react"

import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"

/**
 * Les quatre badges de confiance (P1, charte §6). Toujours visibles, jamais
 * confondus : « Officiel » est un tampon d'encre inversé, « Vérifié » une
 * pastille verte, « Agent public » bleue, « Communauté » une puce sable.
 * Chaque badge porte une icône ET un libellé : jamais la seule couleur.
 * Les badges sont CALCULÉS côté serveur ; ce composant ne fait que les montrer.
 */
const BADGES: Record<TrustBadgeKind, { icon: LucideIcon; className: string; labelKey: string; hintKey: string }> = {
  official: {
    icon: LandmarkIcon,
    className: "bg-official text-official-foreground font-mono uppercase tracking-[0.08em]",
    labelKey: "badge.official",
    hintKey: "badge.officialHint",
  },
  verified: {
    icon: BadgeCheckIcon,
    className: "bg-verified text-verified-foreground",
    labelKey: "badge.verified",
    hintKey: "badge.verifiedHint",
  },
  public_agent: {
    icon: IdCardIcon,
    className: "bg-agent text-agent-foreground",
    labelKey: "badge.publicAgent",
    hintKey: "badge.publicAgentHint",
  },
  community: {
    icon: UsersIcon,
    className: "bg-community text-community-foreground",
    labelKey: "badge.community",
    hintKey: "badge.communityHint",
  },
}

const SIZES = {
  sm: "h-6 gap-1 px-2 text-[11px] [&_svg]:size-3.5",
  md: "h-7 gap-1.5 px-2.5 text-xs [&_svg]:size-4",
} as const

export function TrustBadge(props: { badge: TrustBadgeKind; size?: keyof typeof SIZES; className?: string }) {
  const { t } = useDiasporaleT()
  const spec = BADGES[props.badge]
  const Icon = spec.icon
  return (
    <span
      data-slot="trust-badge"
      data-badge={props.badge}
      title={t(spec.hintKey)}
      className={cn(
        "inline-flex shrink-0 items-center rounded-[var(--radius-xs)] font-semibold leading-none",
        spec.className,
        SIZES[props.size ?? "sm"],
        props.className,
      )}
    >
      <Icon aria-hidden />
      <span>{t(spec.labelKey)}</span>
    </span>
  )
}

/** Les badges d'un auteur, dans l'ordre rendu par le serveur. */
export function TrustBadges(props: { badges: readonly TrustBadgeKind[]; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", props.className)}>
      {props.badges.map((badge) => (
        <TrustBadge key={badge} badge={badge} size={props.size} />
      ))}
    </span>
  )
}

/** Sponsorisé (lot D4) — toujours présent quand un contenu est payé, jamais dans la messagerie. */
export function SponsoredBadge(props: { className?: string }) {
  const { t } = useDiasporaleT()
  return (
    <span
      data-slot="sponsored-badge"
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-[var(--radius-xs)] bg-sponsored px-2 text-[11px] font-semibold text-sponsored-foreground [&_svg]:size-3.5",
        props.className,
      )}
    >
      <MegaphoneIcon aria-hidden />
      <span>{t("badge.sponsored")}</span>
    </span>
  )
}
