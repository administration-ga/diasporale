"use client"

import type { ContentModerationState } from "@diasporale/domain"
import { CircleAlertIcon, CircleCheckIcon, ClockIcon, type LucideIcon } from "lucide-react"

import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"

/**
 * Bandeau de modération (C14, principe P4) — montré à l'AUTEUR seulement :
 * les autres membres ne voient jamais un contenu non publié (règle du domaine
 * `isReadableByOthers`, appliquée par le serveur). Liseré gauche de 3 px,
 * fond de teinte plein, icône et libellé : jamais la seule couleur.
 */
const STATES: Record<ContentModerationState, { icon: LucideIcon; className: string; key: string }> = {
  pending_review: {
    icon: ClockIcon,
    className: "bg-pending text-pending-foreground border-pending-edge",
    key: "moderation.pending",
  },
  published: {
    icon: CircleCheckIcon,
    className: "bg-published text-published-foreground border-published-edge",
    key: "moderation.published",
  },
  rejected: {
    icon: CircleAlertIcon,
    className: "bg-rejected text-rejected-foreground border-rejected-edge",
    key: "moderation.rejected",
  },
}

export function ModerationBanner(props: { state: ContentModerationState; reason?: string; className?: string }) {
  const { t } = useDiasporaleT()
  const spec = STATES[props.state]
  const Icon = spec.icon
  return (
    <div
      data-slot="moderation-banner"
      data-state={props.state}
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border-l-[3px] px-3 py-2 text-[13px] leading-snug",
        spec.className,
        props.className,
      )}
    >
      <Icon className="mt-px size-4 shrink-0" aria-hidden />
      <p>
        <span className="font-semibold">{t(spec.key)}</span>
        {props.state === "pending_review" ? <span> {t("moderation.pendingHint")}</span> : null}
        {props.state === "rejected" && props.reason ? (
          <span> {t("moderation.rejectedReason", { reason: props.reason })}</span>
        ) : null}
      </p>
    </div>
  )
}
