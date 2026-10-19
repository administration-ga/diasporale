"use client"

import type { CountryCode } from "@diasporale/domain"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { BriefcaseIcon, CalendarDays, GraduationCapIcon, HandHeartIcon, MapIcon, type LucideIcon } from "lucide-react"
import NextLink from "next/link"

import { routes } from "@/lib/routes"

interface Shortcut {
  readonly id: string
  readonly href: string
  readonly icon: LucideIcon
  readonly label: string
}

/**
 * Les rubriques de la vie communautaire d'un pays, posées en tête du hub de
 * « Communautés » : l'agenda, l'entraide, le kit d'arrivée, le mentorat et
 * l'emploi (plan global, vague H). Chaque rubrique garde ses propres gardes ; le
 * pays sert de filtre de départ, jamais de réécriture de la résidence.
 */
export function CommunityShortcuts(props: { readonly country: CountryCode }) {
  const { t } = useDiasporaleT()
  const items: readonly Shortcut[] = [
    { id: "agenda", href: routes.agenda(), icon: CalendarDays, label: t("eventCalendar.agendaTitle") },
    { id: "mutualAid", href: routes.mutualAid(props.country), icon: HandHeartIcon, label: t("nav.community.mutualAid") },
    { id: "arrivalKit", href: routes.arrivalKit(props.country), icon: MapIcon, label: t("nav.community.arrivalKit") },
    { id: "mentoring", href: routes.mentoring(props.country), icon: GraduationCapIcon, label: t("nav.community.mentoring") },
    { id: "jobs", href: routes.jobs(props.country), icon: BriefcaseIcon, label: t("nav.community.jobs") },
  ]
  return (
    <nav aria-label={t("nav.community.label")} className="flex flex-wrap gap-1">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <NextLink
            key={item.id}
            href={item.href}
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-primary hover:underline focus-visible:shadow-focus"
          >
            <Icon aria-hidden className="size-4" />
            {item.label}
          </NextLink>
        )
      })}
    </nav>
  )
}
