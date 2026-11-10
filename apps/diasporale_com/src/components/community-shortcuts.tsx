"use client"

import type { CountryCode } from "@diasporale/domain"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { BriefcaseIcon, Building2Icon, CalendarDays, GraduationCapIcon, HandHeartIcon, MapIcon, StoreIcon, type LucideIcon } from "lucide-react"
import NextLink from "next/link"

import { routes } from "@/lib/routes"

interface Shortcut {
  readonly id: string
  readonly href: string
  readonly icon: LucideIcon
  readonly label: string
}

/**
 * Les rubriques de la vie communautaire du pays CONSULTÉ, posées en tête de
 * chaque hub (HB-04) : le kit d'arrivée, l'entraide, le mentorat, l'emploi, les
 * services et l'annuaire des pages, chacun ouvert sur ce pays. Qui prépare une
 * installation au Canada les trouve depuis le hub du Canada. Chaque rubrique
 * garde ses propres gardes ; le pays sert de filtre de départ, jamais de
 * réécriture de la résidence. L'agenda est personnel : il ne suit pas le pays
 * consulté. L'annuaire des membres ne se filtre pas encore par un pays donné
 * dans l'adresse (plan 05) : il n'a pas de raccourci ici.
 */
export function CommunityShortcuts(props: { readonly country: CountryCode }) {
  const { t } = useDiasporaleT()
  const items: readonly Shortcut[] = [
    { id: "arrivalKit", href: routes.arrivalKit(props.country), icon: MapIcon, label: t("nav.community.arrivalKit") },
    { id: "mutualAid", href: routes.mutualAid(props.country), icon: HandHeartIcon, label: t("nav.community.mutualAid") },
    { id: "mentoring", href: routes.mentoring(props.country), icon: GraduationCapIcon, label: t("nav.community.mentoring") },
    { id: "jobs", href: routes.jobs(props.country), icon: BriefcaseIcon, label: t("nav.community.jobs") },
    { id: "services", href: routes.services({ country: props.country }), icon: StoreIcon, label: t("nav.services") },
    { id: "pages", href: routes.pages({ country: props.country }), icon: Building2Icon, label: t("hubShortcuts.pages") },
    { id: "agenda", href: routes.agenda(), icon: CalendarDays, label: t("eventCalendar.agendaTitle") },
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
