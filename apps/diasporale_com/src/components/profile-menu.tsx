"use client"

/**
 * Le menu « … » de la fiche d'autrui (RP-02) : Signaler ce profil, Bloquer, Mettre en
 * sourdine, Copier le lien. Jamais sur sa propre fiche (l'écran ne le monte pas).
 *
 *   · Signaler : la feuille commune (nature `person`) ; elle dit que le réseau racine
 *     traite le dossier, le profil étant commun à tout le moteur. Envoyé, la fiche se
 *     masque pour la personne qui l'a signalée (masque posé par l'écran du profil) ;
 *   · Bloquer : la confirmation existante de la barre de relation (rien de neuf ici) ;
 *   · Mettre en sourdine : le choix privé déjà offert depuis une publication ;
 *   · Copier le lien : l'adresse du profil, sans rien changer à sa visibilité.
 * Un profil bloqué par soi ne se signale plus (le moteur le refuserait) ni ne se met
 * en sourdine : seul le lien reste.
 */
import { useActions } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { BanIcon, FlagIcon, LinkIcon, VolumeXIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { routes } from "@/lib/routes"

import { ObjectMenu, ObjectMenuItem } from "./object-menu"
import { ReportContentSheet, useOptionalContentReports } from "./report-content-sheet"

export interface ProfileMenuProps {
  readonly personId: string
  readonly handle: string
  readonly displayName: string
  /** Ouvre la confirmation du blocage ; absent : le profil est déjà bloqué par soi. */
  readonly onBlock?: () => void
}

export function ProfileMenu(props: ProfileMenuProps) {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const reports = useOptionalContentReports()
  const [reporting, setReporting] = useState(false)
  const blockedByMe = props.onBlock === undefined
  const canReport = reports !== null && !blockedByMe

  const mute = async () => {
    const result = await actions.muteAuthor(props.personId)
    if (result.ok) toast.success(t("postMenu.muted", { name: props.displayName }))
    else toast.error(t(`errors.${result.code}`))
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(new URL(routes.profile(props.handle), window.location.origin).href)
      toast.success(t("profileMenu.linkCopied"))
    } catch {
      toast.error(t("profileMenu.copyFailed"))
    }
  }

  return (
    <>
      <ObjectMenu label={t("objectMenu.open", { name: props.displayName })}>
        {canReport ? (
          <ObjectMenuItem icon={FlagIcon} tone="danger" onSelect={() => setReporting(true)}>
            {t("contentReports.action.person")}
          </ObjectMenuItem>
        ) : null}
        {props.onBlock ? (
          <ObjectMenuItem icon={BanIcon} onSelect={props.onBlock}>
            {t("relation.block")}
          </ObjectMenuItem>
        ) : null}
        {blockedByMe ? null : (
          <ObjectMenuItem icon={VolumeXIcon} onSelect={() => void mute()}>
            {t("postMenu.mute", { name: props.displayName })}
          </ObjectMenuItem>
        )}
        <ObjectMenuItem icon={LinkIcon} onSelect={() => void copy()}>
          {t("profileMenu.copyLink")}
        </ObjectMenuItem>
      </ObjectMenu>
      {reports !== null && canReport ? <ReportContentSheet capability={reports} target={{ kind: "person", id: props.personId }} open={reporting} onOpenChange={setReporting} /> : null}
    </>
  )
}
