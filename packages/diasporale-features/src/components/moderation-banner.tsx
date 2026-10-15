"use client"

import type { ContentModerationState } from "@diasporale/domain"
import { CircleAlertIcon, CircleCheckIcon, ClockIcon, type LucideIcon } from "lucide-react"

import { useDiasporaleT } from "../i18n/client"
import { FloatingNotice, type NoticeTone } from "../primitives/floating-notice"

/**
 * Avis de modération (C14, principe P4) — montré à l'AUTEUR seulement : les
 * autres membres ne voient jamais un contenu non publié (règle du domaine
 * `isReadableByOthers`, appliquée par le serveur). Carte flottante de la charte
 * v2 : pastille d'icône et libellé, jamais la seule couleur ; une croix pour
 * l'écarter.
 */
const STATES: Record<ContentModerationState, { icon: LucideIcon; tone: NoticeTone; key: string }> = {
  pending_review: { icon: ClockIcon, tone: "pending", key: "moderation.pending" },
  published: { icon: CircleCheckIcon, tone: "success", key: "moderation.published" },
  rejected: { icon: CircleAlertIcon, tone: "danger", key: "moderation.rejected" },
}

export function ModerationBanner(props: {
  state: ContentModerationState
  reason?: string
  onDismiss?: () => void
  className?: string
}) {
  const { t } = useDiasporaleT()
  const spec = STATES[props.state]
  const Icon = spec.icon
  const detail =
    props.state === "pending_review"
      ? t("moderation.pendingHint")
      : props.state === "rejected" && props.reason
        ? t("moderation.rejectedReason", { reason: props.reason })
        : null
  return (
    <FloatingNotice
      data-slot="moderation-banner"
      data-state={props.state}
      role="status"
      tone={spec.tone}
      icon={<Icon />}
      heading={t(spec.key)}
      dismissLabel={t("notice.dismiss")}
      onDismiss={props.onDismiss}
      className={props.className}
    >
      {detail}
    </FloatingNotice>
  )
}
