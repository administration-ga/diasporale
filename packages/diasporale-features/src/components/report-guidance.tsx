"use client"

/**
 * Ce que toute feuille de signalement rappelle, au-delà du motif. PROPRIÉTAIRE : lots MD-05
 * et MD-06 (plan 14 du dossier de finalisation).
 *
 *   · `ReportEmergencyNotice` (MD-06) : la consigne d'urgence, en tête de la feuille. Un
 *     signalement n'alerte aucun service de secours : la consigne le dit, et renvoie aux
 *     secours du pays où l'on se trouve, SANS numéro — aucun numéro ni service n'est cité
 *     tant qu'aucun document du dépôt ne l'a vérifié ;
 *   · `ReportRulesLink` (MD-05) : le lien vers les règles de la communauté, page publique qui
 *     dit, pour chaque motif, la règle qu'il vise. L'adresse vient de la table de routes de
 *     l'application ; rendue hors d'elle, la feuille ne montre aucun lien plutôt qu'une
 *     adresse inventée.
 */
import { TriangleAlertIcon } from "lucide-react"

import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"
import { useOptionalRouting } from "../routing"

export function ReportEmergencyNotice(props: { readonly className?: string }) {
  const { t } = useDiasporaleT()
  return (
    <div className={cn("flex min-w-0 items-start gap-2 rounded-lg bg-muted px-3 py-2 text-[13px] leading-snug", props.className)}>
      <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
      <p className="min-w-0">
        <span className="font-semibold">{t("reportEmergency.heading")}</span> {t("reportEmergency.body")}
      </p>
    </div>
  )
}

export function ReportRulesLink(props: { readonly className?: string }) {
  const { t } = useDiasporaleT()
  const routing = useOptionalRouting()
  const href = routing?.routes.communityRules?.()
  if (routing === null || href === undefined) return null
  const { Link } = routing
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center self-start rounded-sm text-[13px] font-medium text-primary underline-offset-4 hover:underline focus-visible:shadow-focus",
        props.className,
      )}
    >
      {t("communityRules.read")}
    </Link>
  )
}
