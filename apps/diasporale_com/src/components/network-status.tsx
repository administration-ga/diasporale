"use client"

import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { WifiIcon, WifiOffIcon } from "lucide-react"
import { useEffect, useState, useSyncExternalStore } from "react"

/** Le temps pendant lequel « De nouveau en ligne » reste affiché. */
export const NETWORK_RESTORED_NOTICE_MS = 4_000

export type NetworkState = "online" | "offline" | "restored"

function subscribe(notify: () => void): () => void {
  window.addEventListener("online", notify)
  window.addEventListener("offline", notify)
  return () => {
    window.removeEventListener("online", notify)
    window.removeEventListener("offline", notify)
  }
}

/**
 * L'état du réseau tel que le navigateur le connaît (MO-05) : hors ligne, en ligne, ou revenu à
 * l'instant. Au rendu serveur et au premier passage, « en ligne » : aucun écart d'hydratation, et
 * rien n'est dit avant d'être su.
 */
export function useNetworkState(): NetworkState {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
  const [restored, setRestored] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const back = () => {
      clearTimeout(timer)
      setRestored(true)
      timer = setTimeout(() => setRestored(false), NETWORK_RESTORED_NOTICE_MS)
    }
    const lost = () => {
      clearTimeout(timer)
      setRestored(false)
    }
    window.addEventListener("online", back)
    window.addEventListener("offline", lost)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("online", back)
      window.removeEventListener("offline", lost)
    }
  }, [])
  if (!online) return "offline"
  return restored ? "restored" : "online"
}

/**
 * La coque dit l'état du réseau (MO-05), dans le fil de la page et sans rien masquer : ce qui est
 * déjà affiché reste lisible, rien ne se pose par-dessus. La région d'annonce est toujours montée
 * (hors de la mise en page) pour que le changement s'entende ; l'avis visible la double, sans
 * être lu deux fois. En ligne, rien ne s'affiche.
 */
export function NetworkStatusNotice() {
  const { t } = useDiasporaleT()
  const state = useNetworkState()
  const message = state === "offline" ? t("installableApp.network.offline") : state === "restored" ? t("installableApp.network.restored") : ""
  const Icon = state === "offline" ? WifiOffIcon : WifiIcon
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">{message}</p>
      {message ? (
        <p aria-hidden data-network-state={state} className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{message}</span>
        </p>
      ) : null}
    </>
  )
}
