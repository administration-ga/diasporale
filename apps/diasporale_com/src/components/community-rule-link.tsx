"use client"

/**
 * Le lien vers la règle de la communauté que vise un motif (MD-05). PROPRIÉTAIRE : ce lot.
 * Partagé par la fiche d'une décision (« Mes données », décisions d'une page), le détail
 * d'un dossier au guichet et la feuille de signalement d'un avis. Un motif sans règle
 * (non précisé, inconnu, ou aucun motif) renvoie à la page entière, jamais à une règle
 * devinée. La page est publique : elle se lit sans compte.
 */
import { cn } from "@diasporale/features"
import { communityRuleOf } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import NextLink from "next/link"

import { routes } from "@/lib/routes"

export function CommunityRuleLink(props: { readonly ground?: string; readonly className?: string }) {
  const { t } = useDiasporaleT()
  const rule = props.ground === undefined ? null : communityRuleOf(props.ground)
  return (
    <NextLink
      href={rule === null ? routes.communityRules() : routes.communityRule(rule)}
      className={cn(
        "inline-flex min-h-11 items-center self-start rounded-sm text-[13px] font-medium text-primary underline-offset-4 hover:underline focus-visible:shadow-focus",
        props.className,
      )}
    >
      {rule === null ? t("communityRules.read") : t("communityRules.readRule", { rule: t(`legal.community.${rule}.title`) })}
    </NextLink>
  )
}
