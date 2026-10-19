"use client"

import { Button, Card } from "@diasporale/features"
import { useActions, useDataSource } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { LogOutIcon } from "lucide-react"
import { useRef, useState } from "react"

import { routes } from "@/lib/routes"

/**
 * Se déconnecter partout, un seul geste à la fois. La source moteur conserve sa
 * navigation complète et son éventuel avis de révocation ; la démonstration
 * recharge l'accueil. Partagé par les réglages et l'accueil des comptes sans
 * adhésion.
 */
export function useSignOutEverywhere() {
  const actions = useActions()
  const { kind } = useDataSource()
  const running = useRef(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const signOutEverywhere = async () => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setFailed(false)
    try {
      await actions.signOutEverywhere()
      if (kind === "demo") window.location.assign(routes.home())
      // La navigation est engagée : le bouton reste fermé jusqu'au démontage.
    } catch {
      setFailed(true)
      running.current = false
      setBusy(false)
    }
  }

  return { busy, failed, signOutEverywhere }
}

export function SignOutSettings() {
  const { t } = useDiasporaleT()
  const { busy, failed, signOutEverywhere } = useSignOutEverywhere()

  return (
    <section id="session" aria-labelledby="session-titre" aria-busy={busy} className="scroll-mt-20">
      <Card className="flex flex-col gap-4 p-5">
        <div>
          <h2 id="session-titre" className="font-display text-xl font-bold">{t("settings.session")}</h2>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{t("settings.sessionLead")}</p>
        </div>
        {failed ? <p role="alert" className="text-sm text-destructive">{t("errors.unknown")}</p> : null}
        <Button type="button" variant="outline" disabled={busy} onClick={() => void signOutEverywhere()} className="self-start">
          <LogOutIcon aria-hidden className="size-4" />
          {t(busy ? "settings.signingOut" : "settings.signOutEverywhere")}
        </Button>
      </Card>
    </section>
  )
}
