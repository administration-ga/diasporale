"use client"

import type { MembershipStatus, TrustBadge as TrustBadgeKind } from "@diasporale/domain"
import { BadgeCheckIcon, ClockIcon, InfoIcon, ShieldAlertIcon, type LucideIcon } from "lucide-react"
import { Fragment, type ReactNode } from "react"

import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"

/**
 * Bannière de statut d'adhésion (PD2 point 2) :
 *   · `en_attente` → lecture seule, et les deux chemins pour publier :
 *     parrainage ou vérification de l'inscription consulaire ;
 *   · `declaree` → parcours d'élévation (EXF-DG-05) : activer IDN, s'inscrire
 *     au consulat, vérifier son inscription ;
 *   · `verifiee` → le badge, sobrement ;
 *   · `suspendue` → la sanction, et rien d'autre.
 * Les liens d'élévation sortent vers identite.ga et consulat.ga (adresses
 * fournies par l'application, jamais écrites ici).
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

const TONES: Record<Exclude<MembershipStatus, "partie">, { icon: LucideIcon; className: string }> = {
  en_attente: { icon: ClockIcon, className: "bg-pending text-pending-foreground border-pending-edge" },
  declaree: { icon: InfoIcon, className: "bg-[var(--info-50)] text-[var(--info-600)] border-primary" },
  verifiee: { icon: BadgeCheckIcon, className: "bg-published text-published-foreground border-published-edge" },
  suspendue: { icon: ShieldAlertIcon, className: "bg-rejected text-rejected-foreground border-rejected-edge" },
}

export function MembershipStatusBanner(props: {
  status: MembershipStatus
  badges: readonly TrustBadgeKind[]
  suspendedUntil?: string
  actions?: StatusBannerActions
  className?: string
}) {
  const { t } = useDiasporaleT()
  if (props.status === "partie") return null
  const tone = TONES[props.status]
  const Icon = tone.icon
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
    <section
      data-slot="membership-status-banner"
      data-status={props.status}
      aria-label={t("status.regionLabel")}
      className={cn("flex gap-3 rounded-xl border-l-[3px] px-4 py-3", tone.className, props.className)}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">{title}</p>
        {body ? <p className="mt-0.5 text-[13px] leading-snug">{body}</p> : null}
        {shownLinks.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-semibold">
            {shownLinks.map((name) => (
              <Fragment key={name}>{actions[name]}</Fragment>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
