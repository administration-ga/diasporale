"use client"

import type { MembershipStatus, TrustBadge as TrustBadgeKind } from "@diasporale/domain"
import { BadgeCheckIcon, ClockIcon, InfoIcon, ShieldAlertIcon, type LucideIcon } from "lucide-react"
import { Fragment, type ReactNode } from "react"

import { useDiasporaleT } from "../i18n/client"
import { FloatingNotice, type NoticeTone } from "../primitives/floating-notice"

/**
 * Statut d'adhésion (PD2 point 2), en carte flottante (charte v2 §7) :
 *   · `en_attente` → lecture seule, et les deux chemins pour publier :
 *     parrainage ou vérification de l'inscription consulaire ;
 *   · `declaree` → parcours d'élévation (EXF-DG-05) : activer IDN, s'inscrire
 *     au consulat, vérifier son inscription ;
 *   · `verifiee` → le badge, sobrement ;
 *   · `suspendue` → la sanction, et rien d'autre.
 * Les liens d'élévation sortent vers identite.ga et consulat.ga (adresses
 * fournies par l'application, jamais écrites ici). Une croix écarte la carte ;
 * `onDismiss` laisse l'application s'en souvenir.
 */
export interface StatusBannerActions {
  /** Ouvre la vérification de l'inscription consulaire (consentement d'abord). */
  readonly verifyConsular?: ReactNode
  /** Lien vers l'aide « obtenir un parrainage ». */
  readonly sponsorHelp?: ReactNode
  /** Lien sortant « Activer mon identité numérique IDN » (identite.ga). */
  readonly activateIdn?: ReactNode
  /** Lien sortant « M'inscrire au consulat » (consulat.ga). */
  readonly registerConsulate?: ReactNode
}

const TONES: Record<Exclude<MembershipStatus, "partie">, { icon: LucideIcon; tone: NoticeTone }> = {
  en_attente: { icon: ClockIcon, tone: "pending" },
  declaree: { icon: InfoIcon, tone: "info" },
  verifiee: { icon: BadgeCheckIcon, tone: "success" },
  suspendue: { icon: ShieldAlertIcon, tone: "danger" },
}

export function MembershipStatusBanner(props: {
  status: MembershipStatus
  badges: readonly TrustBadgeKind[]
  suspendedUntil?: string
  actions?: StatusBannerActions
  onDismiss?: () => void
  className?: string
}) {
  const { t } = useDiasporaleT()
  if (props.status === "partie") return null
  const spec = TONES[props.status]
  const Icon = spec.icon
  const hasVerifiedBadge = props.badges.includes("verified")
  const actions = props.actions ?? {}

  let title: string
  let body: string | null
  // Les sorties proposées, par nom : chacune n'apparaît que si l'application la fournit.
  let links: (keyof StatusBannerActions)[] = []
  switch (props.status) {
    case "en_attente":
      title = t("status.pendingTitle")
      body = t("status.pendingBody")
      links = ["verifyConsular", "sponsorHelp"]
      break
    case "declaree":
      title = hasVerifiedBadge ? t("status.declaredVerifiedTitle") : t("status.declaredTitle")
      body = hasVerifiedBadge ? t("status.declaredVerifiedBody") : t("status.declaredBody")
      links = hasVerifiedBadge
        ? ["verifyConsular"]
        : ["activateIdn", "registerConsulate", "verifyConsular"]
      break
    case "verifiee":
      title = t("status.verifiedTitle")
      body = null
      break
    case "suspendue":
      title = t("status.suspendedTitle")
      body = props.suspendedUntil
        ? t("status.suspendedUntil", { date: props.suspendedUntil })
        : t("status.suspendedIndefinite")
      break
  }
  const shownLinks = links.filter((name) => actions[name] !== undefined && actions[name] !== null)

  return (
    <FloatingNotice
      data-slot="membership-status-banner"
      data-status={props.status}
      role="region"
      aria-label={t("status.regionLabel")}
      tone={spec.tone}
      icon={<Icon />}
      heading={title}
      actions={
        shownLinks.length > 0
          ? shownLinks.map((name) => <Fragment key={name}>{actions[name]}</Fragment>)
          : undefined
      }
      dismissLabel={t("notice.dismiss")}
      onDismiss={props.onDismiss}
      className={props.className}
    >
      {body}
    </FloatingNotice>
  )
}
