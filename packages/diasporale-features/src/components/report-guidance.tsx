"use client"

/**
 * Ce que toute feuille de signalement rappelle, au-delà du motif. PROPRIÉTAIRE : lots MD-05
 * et MD-06 (plan 14 du dossier de finalisation).
 *
 *   · `ReportRulesLink` (MD-05) : le lien vers les règles de la communauté, page publique qui
 *     dit, pour chaque motif, la règle qu'il vise. L'adresse vient de la table de routes de
 *     l'application ; rendue hors d'elle, la feuille ne montre aucun lien plutôt qu'une
 *     adresse inventée.
 */
import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"
import { useOptionalRouting } from "../routing"

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
