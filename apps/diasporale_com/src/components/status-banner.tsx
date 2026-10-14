"use client"

import { MembershipStatusBanner } from "@diasporale/features"
import type { MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ExternalLinkIcon } from "lucide-react"
import NextLink from "next/link"

import { publicEnv } from "@/lib/env"
import { routes } from "@/lib/routes"

const linkClass = "inline-flex min-h-8 items-center gap-1 underline underline-offset-2 focus-visible:shadow-focus"

/**
 * La bannière de statut, branchée sur les adresses de l'application : la
 * vérification consulaire (écran de consentement d'abord), l'aide au
 * parrainage, et les sorties vers identite.ga et consulat.ga — seulement si
 * l'environnement les fournit (jamais de lien mort, jamais d'URL en dur).
 */
export function StatusBanner(props: { membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const { membership } = props
  if (membership.status === "verifiee") return null
  return (
    <MembershipStatusBanner
      status={membership.status}
      badges={membership.badges}
      actions={{
        verifyConsular: (
          <NextLink href={routes.attestation()} className={linkClass}>
            {t("status.verifyConsular")}
          </NextLink>
        ),
        sponsorHelp: (
          <NextLink href={routes.sponsorHelp()} className={linkClass}>
            {t("status.sponsorHelp")}
          </NextLink>
        ),
        ...(publicEnv.idnPortalUrl
          ? {
              activateIdn: (
                <a href={publicEnv.idnPortalUrl} className={linkClass} rel="noopener">
                  {t("status.activateIdn")}
                  <ExternalLinkIcon className="size-3.5" aria-hidden />
                </a>
              ),
            }
          : {}),
        ...(publicEnv.consulateUrl
          ? {
              registerConsulate: (
                <a href={publicEnv.consulateUrl} className={linkClass} rel="noopener">
                  {t("status.registerConsulate")}
                  <ExternalLinkIcon className="size-3.5" aria-hidden />
                </a>
              ),
            }
          : {}),
      }}
    />
  )
}
