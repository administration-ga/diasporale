"use client"

import { Skeleton } from "@diasporale/features"
import { useSession, type MembershipView, type SessionView } from "@diasporale/features/data"
import { useRouter } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"

import { forgetPendingCode } from "@/lib/pending-code"
import { entryExit, forgetReturnPath, liveMember, peekReturnPath, rememberReturnPath, type ReturnDestination } from "@/lib/return-path"
import { routes } from "@/lib/routes"

type SignedIn = Extract<SessionView, { status: "signed_in" }>

/** L'exigence d'une page : ce que la session doit porter pour qu'elle s'affiche. */
export type GateRequirement = "account" | "member" | "person"

/**
 * Où renvoyer une session qui ne convient pas à la page ; `null` si elle y est admise.
 * `destination` : la page demandée avant la connexion (UX-02, MO-03), que l'accueil rend à un
 * membre — ou, hors adhésion, quand elle n'est que « Mes données ».
 */
export function gateRedirect(session: SessionView, require: GateRequirement, destination: ReturnDestination | null = null): string | null {
  if (session.status === "anonymous") return routes.enter()
  // Une adhésion vivante (en attente, déclarée, vérifiée ou suspendue) ; un départ n'en est plus une.
  const member = liveMember(session.membership)
  if (require === "member" && member === null) return routes.welcome()
  if (require === "account" && (member !== null || destination?.needs === "person")) return entryExit(member, destination)
  return null
}

/** La page demandée, lue une fois par montage (cet onglet seulement ; rien côté serveur). */
const readReturnPath = () => peekReturnPath()

/**
 * Garde de session CÔTÉ CLIENT — confort de navigation seulement : l'autorité
 * reste au serveur (le moteur refuse toute lecture ou écriture hors adhésion).
 *
 *   · `account` : il faut être connecté ; un membre est renvoyé vers la page qu'il
 *     avait demandée, sinon son fil ;
 *   · `member`  : il faut une adhésion à DIASPORALE ; sans elle, ou après un
 *     départ → accueil ;
 *   · `person`  : il faut être connecté, l'adhésion est facultative — membre,
 *     partie, suspendue ou sans adhésion. Réservée aux droits personnels
 *     (« Mes données », NP-02) : les portes du moteur qu'ils appellent ne lisent
 *     aucune adhésion, et la page ne monte aucune surface sociale.
 *
 * La page demandée (UX-02, MO-03) : renvoyée à l'entrée ou à l'accueil, une page `member` ou
 * `person` est retenue dans l'onglet ; l'arrivée sur une page de membre l'efface. `holdMember` :
 * l'accueil garde la main pendant l'entrée qu'il écrit, puis mène lui-même à la page demandée.
 */
export function Gate(props: {
  require: GateRequirement
  holdMember?: boolean
  children: (session: SignedIn & { membership: MembershipView | null }) => ReactNode
}) {
  const session = useSession()
  const router = useRouter()
  const [destination] = useState(readReturnPath)
  const ready = session.status === "ready" ? session.data : null
  const held = props.holdMember === true && ready?.status === "signed_in"
  const redirect = ready === null || held ? null : gateRedirect(ready, props.require, destination)
  const admitted = ready?.status === "signed_in" && redirect === null
  const remembers = props.require !== "account"

  useEffect(() => {
    if (redirect === null) return
    if (remembers && (redirect === routes.enter() || redirect === routes.welcome())) rememberReturnPath(window.location)
    router.replace(redirect)
  }, [redirect, remembers, router])

  // L'arrivée consomme la page demandée : toute page de membre, ou « Mes données » quand c'était elle.
  const arrives = admitted && (props.require === "member" || (props.require === "person" && destination?.needs === "person"))
  useEffect(() => {
    if (arrives) forgetReturnPath()
  }, [arrives])

  // Une session ouverte n'attend plus de code : l'adresse gardée pour la saisie est oubliée (EA-08).
  const signedIn = ready?.status === "signed_in"
  useEffect(() => {
    if (signedIn) forgetPendingCode()
  }, [signedIn])

  if (ready === null || ready.status === "anonymous" || redirect !== null) return <GateSkeleton />
  return <>{props.children(ready)}</>
}

export function GateSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[792px] flex-col gap-4 px-4 py-6" aria-busy="true">
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}
