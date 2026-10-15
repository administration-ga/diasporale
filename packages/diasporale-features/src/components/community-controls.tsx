"use client"

import {
  BriefcaseBusinessIcon,
  CalendarDaysIcon,
  MailIcon,
  MegaphoneIcon,
  NewspaperIcon,
  SlidersHorizontalIcon,
  StoreIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"
import { Button } from "../primitives/button"
import { FolderTabsList, FolderTabsTrigger } from "../primitives/folder-tabs"
import { Card } from "../primitives/surface"
import { SponsoredBadge } from "./trust-badge"

/**
 * Bouton « Écrire » (C16, P3) — le seul moyen de contacter une page, une
 * association, un recruteur ou un vendeur : aucune coordonnée n'est jamais
 * affichée. La messagerie arrive au lot D2 (PD7) : d'ici là, le bouton dit
 * clairement qu'elle arrive, au lieu de mentir par un lien mort.
 */
export function ContactButton(props: { onContact?: () => void; recipientName: string; className?: string }) {
  const { t } = useDiasporaleT()
  const available = props.onContact !== undefined
  return (
    <Button
      variant="primary"
      onClick={props.onContact}
      disabled={!available}
      aria-label={t("contact.writeTo", { name: props.recipientName })}
      title={available ? undefined : t("contact.soon")}
      className={props.className}
    >
      <MailIcon aria-hidden />
      {t("contact.write")}
    </Button>
  )
}

/**
 * Barre de filtres (C15) : puces bascules défilantes (état porté par
 * `aria-pressed`, jamais par la seule couleur) + filtres avancés. La puce choisie
 * passe à l'encre inversée, sans contour (charte v3.2) : la clarté s'inverse, ce
 * qui se lit aussi sans voir les couleurs.
 */
export function FilterBar<T extends string>(props: {
  label: string
  options: readonly { id: T; label: ReactNode }[]
  selected: readonly T[]
  onToggle: (id: T) => void
  onAdvanced?: () => void
  className?: string
}) {
  const { t } = useDiasporaleT()
  return (
    <div className={cn("flex items-center gap-2", props.className)}>
      <div
        role="group"
        aria-label={props.label}
        className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {props.options.map((option) => {
          const active = props.selected.includes(option.id)
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => props.onToggle(option.id)}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center rounded-[var(--esp-r-chrome)] px-3.5 text-sm transition-colors focus-visible:shadow-focus",
                active
                  ? "bg-chosen font-semibold text-chosen-foreground"
                  : "bg-[var(--esp-neutral-chip)] font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {props.onAdvanced ? (
        <Button variant="ghost" size="icon" onClick={props.onAdvanced} aria-label={t("filters.advanced")}>
          <SlidersHorizontalIcon aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}

export const COMMUNITY_TABS = ["actus", "evenements", "associations", "entreprises", "emploi", "annonces", "groupes"] as const
export type CommunityTab = (typeof COMMUNITY_TABS)[number]

const TAB_ICONS: Record<CommunityTab, LucideIcon> = {
  actus: NewspaperIcon,
  evenements: CalendarDaysIcon,
  associations: UsersRoundIcon,
  entreprises: StoreIcon,
  emploi: BriefcaseBusinessIcon,
  annonces: MegaphoneIcon,
  groupes: UsersIcon,
}

/**
 * Onglets de la communauté (C17), en chemise. Les volets du lot D2 (emploi,
 * annonces, groupes) n'apparaissent que lorsqu'ils existent : l'appelant passe
 * la liste des onglets disponibles.
 */
export function CommunityTabSwitcher(props: { tabs: readonly CommunityTab[]; label: string }) {
  const { t } = useDiasporaleT()
  return (
    <FolderTabsList aria-label={props.label}>
      {props.tabs.map((tab) => {
        const Icon = TAB_ICONS[tab]
        return (
          <FolderTabsTrigger key={tab} value={tab}>
            <Icon className="size-4" aria-hidden />
            {t(`hub.tab.${tab}`)}
          </FolderTabsTrigger>
        )
      })}
    </FolderTabsList>
  )
}

/**
 * Emplacement sponsorisé (C13, lot D4) : TOUJOURS étiqueté, jamais plus d'un
 * par écran, jamais dans la messagerie, hauteur bornée. Aucun emplacement
 * n'est actif en V1 (A9) : le composant existe pour la charte et la recette.
 */
export function SponsoredSlot(props: { advertiser: string; message: string; className?: string }) {
  return (
    <Card className={cn("relative flex max-h-24 items-center gap-3 overflow-hidden p-3 md:max-h-28", props.className)}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">{props.advertiser}</p>
        <p className="line-clamp-2 text-[13px] text-muted-foreground">{props.message}</p>
      </div>
      <SponsoredBadge className="absolute right-2 top-2" />
    </Card>
  )
}
