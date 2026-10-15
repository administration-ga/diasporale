"use client"

import { MembershipStatusBanner } from "@diasporale/features"
import type { MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ExternalLinkIcon } from "lucide-react"
import NextLink from "next/link"

import { publicEnv } from "@/lib/env"
import { routes } from "@/lib/routes"

import { useFloatingCard } from "./floating-cards"
import { floatingLinkClass } from "./site-chrome"

/**
 * Le statut d'adhésion, en carte flottante (charte v2 §7), branché sur les
 * adresses de l'application : la vérification consulaire (écran de consentement
 * d'abord), l'aide au parrainage, et les sorties vers identite.ga et consulat.ga
 * — seulement si l'environnement les fournit (jamais de lien mort, jamais d'URL
 * en dur). Écartée, la carte ne revient qu'au prochain changement de statut.
 */
export function StatusBanner(props: { membership: MembershipView }) {
  const { t, locale } = useDiasporaleT()
  const { membership } = props
  const verified = membership.badges.includes("verified")
  const shown = membership.status !== "verifiee" && membership.status !== "partie"
  useFloatingCard({
    id: "diasporale-statut",
    dismissKey: `diasporale:carte:statut:${membership.status}:${verified ? "verifie" : "a-verifier"}`,
    store: "local",
    version: `${locale}:${membership.status}:${membership.badges.join(",")}`,
    content: shown
      ? (dismiss) => (
          <MembershipStatusBanner
            status={membership.status}
            badges={membership.badges}
            onDismiss={dismiss}
            actions={{
              verifyConsular: (
                <NextLink href={routes.attestation()} className={floatingLinkClass}>
                  {t("status.verifyConsular")}
                </NextLink>
              ),
              sponsorHelp: (
                <NextLink href={routes.sponsorHelp()} className={floatingLinkClass}>
                  {t("status.sponsorHelp")}
                </NextLink>
              ),
              ...(publicEnv.idnPortalUrl
                ? {
                    activateIdn: (
                      <a href={publicEnv.idnPortalUrl} className={floatingLinkClass} rel="noopener">
                        {t("status.activateIdn")}
                        <ExternalLinkIcon className="size-3.5" aria-hidden />
                      </a>
                    ),
                  }
                : {}),
              ...(publicEnv.consulateUrl
                ? {
                    registerConsulate: (
                      <a href={publicEnv.consulateUrl} className={floatingLinkClass} rel="noopener">
                        {t("status.registerConsulate")}
                        <ExternalLinkIcon className="size-3.5" aria-hidden />
                      </a>
                    ),
                  }
                : {}),
            }}
          />
        )
      : null,
  })
  return null
}
