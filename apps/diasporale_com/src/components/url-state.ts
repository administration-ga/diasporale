"use client"

/**
 * Un état d'écran PORTÉ PAR L'ADRESSE (ET-04) : lu dans l'adresse, appliqué tout de
 * suite à l'écran, puis réécrit dans l'adresse (`router.replace`) — qui se partage et
 * se recharge à l'identique. Une adresse changée d'ailleurs (retour, lien suivi)
 * l'emporte sur l'état local. PROPRIÉTAIRE : chantier « entraide » (ET-04).
 */
import { useRouter } from "next/navigation"
import { useState } from "react"

export function useUrlState<State>(fromUrl: State, hrefOf: (state: State) => string): readonly [State, (next: State) => void] {
  const router = useRouter()
  const href = hrefOf(fromUrl)
  const [state, setState] = useState(fromUrl)
  const [seenHref, setSeenHref] = useState(href)
  let current = state
  if (seenHref !== href) {
    // L'adresse a changé hors de cet écran : elle fait foi (ajustement pendant le rendu, motif React).
    setSeenHref(href)
    setState(fromUrl)
    current = fromUrl
  }
  const go = (next: State) => {
    setState(next)
    router.replace(hrefOf(next))
  }
  return [current, go] as const
}
