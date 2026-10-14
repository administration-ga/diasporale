"use client"

import { FlaskConicalIcon } from "lucide-react"
import type { ReactNode } from "react"

import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"

/**
 * Bandeau PERMANENT du mode démonstration (charte §7) : tant que le
 * fournisseur factice est actif, aucune capture d'écran ne peut faire passer
 * une donnée de démonstration pour réelle. Il ne se ferme pas.
 */
export function DemoBanner(props: { action?: ReactNode; className?: string }) {
  const { t } = useDiasporaleT()
  return (
    <div
      data-slot="demo-banner"
      role="note"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-demo-edge bg-demo px-4 py-2 text-[13px] text-demo-foreground",
        props.className,
      )}
    >
      <FlaskConicalIcon className="size-4 shrink-0" aria-hidden />
      {/* Base de 16rem : sous cette largeur, l'action passe à la ligne au lieu d'écraser le texte. */}
      <p className="min-w-0 flex-[1_1_16rem]">
        <span className="font-semibold">{t("demo.bannerTitle")}</span> {t("demo.bannerBody")}
      </p>
      {props.action}
    </div>
  )
}
