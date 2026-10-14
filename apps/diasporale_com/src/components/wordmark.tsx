"use client"

import { cn } from "@diasporale/features"
import { useDiasporaleT } from "@diasporale/features/i18n/client"

/**
 * Mot-symbole DIASPORALE (charte §8) : Plex Condensed 700, l'œillet de
 * l'étiquette pays en point d'ancrage. Aucune armoirie, aucun drapeau.
 */
export function Wordmark(props: { className?: string }) {
  const { t } = useDiasporaleT()
  return (
    <span className={cn("inline-flex items-center gap-2", props.className)}>
      <span aria-hidden className="size-2.5 rounded-full bg-tag-eyelet ring-2 ring-[var(--ink-900)]" />
      <span className="font-display text-xl font-bold uppercase leading-none tracking-[0.04em] text-foreground">
        {t("brand.name")}
      </span>
    </span>
  )
}
