"use client"

/**
 * Les gestes de gestion depuis la fiche d'une page : « Gérer la page » pour un
 * signataire vivant, « Revendiquer » pour une page revendicable (ou « Demander
 * la vérification » pour son administrateur), et l'état de ma revendication en
 * cours. PROPRIÉTAIRE : chantier « gestion des pages ». La fiche (chantier
 * « pages ») le monte ; la signature est figée.
 *
 * Présentation seulement : `viewerRole` et `claimable` viennent de la fiche
 * (lus au serveur) ; le moteur rejuge chaque geste.
 */
import { Button } from "@diasporale/features"
import type { PageManagement } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { BadgeCheckIcon, ClockIcon, FlagIcon, Settings2Icon } from "lucide-react"
import NextLink from "next/link"

import { routes } from "@/lib/routes"

import { usePageManagement } from "./page-admin-parts"

export function PageAdminEntry(props: {
  readonly pageId: string
  readonly handle: string
  readonly viewerRole: "admin" | "signatory" | null
  readonly claimable: boolean
}) {
  const management = usePageManagement()
  // Sans la capacité, la fiche ne promet aucun geste de gestion.
  if (!management) return null
  return <Entry management={management} {...props} />
}

function Entry(props: {
  readonly management: PageManagement
  readonly pageId: string
  readonly handle: string
  readonly viewerRole: "admin" | "signatory" | null
  readonly claimable: boolean
}) {
  const { t } = useDiasporaleT()
  const claims = props.management.useMyClaims()
  const pending = claims.status === "ready" ? claims.data.some((claim) => claim.page.id === props.pageId && claim.status === "pending") : false
  // Un signataire qui n'administre pas ne revendique pas : la page a déjà ses administrateurs.
  const canClaim = props.claimable && props.viewerRole !== "signatory"
  if (props.viewerRole === null && !pending && !canClaim) return null
  return (
    <div className="flex flex-wrap items-center gap-3" data-slot="page-admin-entry">
      {props.viewerRole !== null ? (
        <Button asChild variant="outline">
          <NextLink href={routes.pageManage(props.handle)}>
            <Settings2Icon aria-hidden />
            {t("pageAdmin.entry.manage")}
          </NextLink>
        </Button>
      ) : null}
      {pending ? (
        <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <ClockIcon aria-hidden className="size-4 shrink-0" />
          <span>{t("pageAdmin.entry.pending")}</span>
          <NextLink href={routes.pageClaim(props.handle)} className="font-medium text-primary underline-offset-4 hover:underline">
            {t("pageAdmin.entry.follow")}
          </NextLink>
        </p>
      ) : canClaim ? (
        <Button asChild variant="outline">
          <NextLink href={routes.pageClaim(props.handle)}>
            {props.viewerRole === "admin" ? <BadgeCheckIcon aria-hidden /> : <FlagIcon aria-hidden />}
            {t(props.viewerRole === "admin" ? "pageAdmin.entry.verify" : "pageAdmin.entry.claim")}
          </NextLink>
        </Button>
      ) : null}
    </div>
  )
}
