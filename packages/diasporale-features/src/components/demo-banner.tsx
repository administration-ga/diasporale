"use client"

import { FlaskConicalIcon } from "lucide-react"
import type { ReactNode } from "react"

import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"
import { FloatingNotice } from "../primitives/floating-notice"

/**
 * Mode démonstration (charte v2 §7), en deux pièces qui ne se quittent pas :
 *   · `DemoBanner` — la carte flottante qui l'explique, avec sa croix ;
 *   · `DemoChip` — le repère PERMANENT de l'en-tête : tant que le fournisseur
 *     factice est actif, aucune capture ne peut faire passer une donnée de
 *     démonstration pour réelle, même la carte écartée.
 */
export function DemoBanner(props: { action?: ReactNode; onDismiss?: () => void; className?: string }) {
  const { t } = useDiasporaleT()
  return (
    <FloatingNotice
      data-slot="demo-banner"
      role="note"
      tone="demo"
      icon={<FlaskConicalIcon />}
      heading={t("demo.bannerTitle")}
      actions={props.action}
      dismissLabel={t("notice.dismiss")}
      onDismiss={props.onDismiss}
      className={props.className}
    >
      {t("demo.bannerBody")}
    </FloatingNotice>
  )
}

/**
 * Le repère « Démo » de l'en-tête ; `onClick` rouvre la carte qui l'explique.
 * Sous 380 px, il ne garde que son icône (le libellé reste lu par les lecteurs
 * d'écran) : l'en-tête d'un téléphone de 320 px tient sur une ligne.
 */
export function DemoChip(props: { onClick?: () => void; className?: string }) {
  const { t } = useDiasporaleT()
  const className = cn(
    "inline-flex h-7 shrink-0 items-center gap-1 rounded-[var(--esp-r-chrome)] bg-demo px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-demo-foreground max-[379px]:px-2 [&_svg]:size-3.5",
    props.className,
  )
  const content = (
    <>
      <FlaskConicalIcon aria-hidden />
      <span className="max-[379px]:sr-only">{t("demo.tag")}</span>
    </>
  )
  if (!props.onClick) {
    return (
      <span data-slot="demo-chip" title={t("demo.bannerBody")} className={className}>
        {content}
      </span>
    )
  }
  return (
    <button
      type="button"
      data-slot="demo-chip"
      onClick={props.onClick}
      aria-label={t("demo.chipLabel")}
      className={cn(
        className,
        // Cible de 44 px (charte §10) sans grossir la pastille : la zone sensible déborde.
        "relative decoration-1 underline-offset-2 after:absolute after:-inset-x-1 after:-inset-y-2 hover:underline focus-visible:shadow-focus",
      )}
    >
      {content}
    </button>
  )
}
