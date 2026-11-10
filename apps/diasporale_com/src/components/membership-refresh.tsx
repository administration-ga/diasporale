"use client"

import { useActions, useSession } from "@diasporale/features/data"
import { useEffect, useRef } from "react"

/**
 * EA-03 — le statut d'adhésion relu quand l'identité a changé hors de DIASPORALE
 * (IDN liée, niveau relevé, lien révoqué). Monté une fois sous la source de données,
 * là où la session est connue : à l'ouverture de session comme au retour d'IDN (la
 * page se recharge, ou la lecture réactive de l'adhésion change), il demande la
 * relecture SEULEMENT si le moteur signale un écart (`statusOutdated` de l'adhésion).
 * Une seule demande par écart (personne et statut) : un refus (débit, réseau) ne
 * boucle pas ; la carte de statut et les droits suivent la lecture réactive. Rien
 * ne s'affiche ; un fournisseur sans relecture (la démonstration) n'appelle rien.
 */
export function MembershipStatusRefresh() {
  const session = useSession()
  const actions = useActions()
  const membership = session.status === "ready" && session.data.status === "signed_in" ? session.data.membership : null
  const outdated = membership?.statusOutdated === true
  const episode = membership ? `${membership.personId}:${membership.status}` : null
  const requested = useRef<string | null>(null)

  useEffect(() => {
    if (!outdated || episode === null) {
      // L'écart résorbé (ou la session changée) : un écart futur sera de nouveau relu.
      requested.current = null
      return
    }
    if (requested.current === episode || actions.refreshMembership === undefined) return
    requested.current = episode
    void actions.refreshMembership?.()
  }, [outdated, episode, actions])

  return null
}
