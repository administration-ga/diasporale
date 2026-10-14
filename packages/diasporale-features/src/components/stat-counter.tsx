"use client"

import type { CounterPresentation } from "@diasporale/domain"

import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"
import { formatNumber } from "../lib/format"

/**
 * Compteur (C10) : chiffre en mono, libellé en petites capitales. Un compteur
 * de membres sous le seuil anti-réidentification n'affiche jamais le chiffre
 * exact (`hubs.ts`). Les compteurs viennent TOUJOURS du serveur (matérialisés) :
 * aucun chiffre n'est écrit en dur.
 */
export function StatCounter(props: { value: CounterPresentation; label: string; className?: string }) {
  const { t, locale } = useDiasporaleT()
  const shown =
    props.value.kind === "value"
      ? formatNumber(props.value.value, locale)
      : t("hub.belowThreshold", { threshold: props.value.threshold })
  return (
    <div data-slot="stat-counter" className={cn("flex min-w-0 flex-col gap-1", props.className)}>
      <span
        className={cn(
          "font-mono font-semibold leading-none tracking-tight text-foreground",
          props.value.kind === "value" ? "text-2xl" : "text-base",
        )}
      >
        {shown}
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{props.label}</span>
    </div>
  )
}
