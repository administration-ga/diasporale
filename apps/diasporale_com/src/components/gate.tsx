"use client"

import { Skeleton } from "@diasporale/features"
import { useSession, type MembershipView, type SessionView } from "@diasporale/features/data"
import { useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"

import { routes } from "@/lib/routes"

type SignedIn = Extract<SessionView, { status: "signed_in" }>

/** L'exigence d'une page : ce que la session doit porter pour qu'elle s'affiche. */
export type GateRequirement = "account" | "member" | "person"

/** Une adhésion vivante (en attente, déclarée, vérifiée ou suspendue) ; un départ n'en est plus une. */
function hasLiveMembership(session: SignedIn): boolean {
  return session.membership !== null && session.membership.status !== "partie"
}

/** Où renvoyer une session qui ne convient pas à la page ; `null` si elle y est admise. */
export function gateRedirect(session: SessionView, require: GateRequirement): string | null {
  if (session.status === "anonymous") return routes.enter()
  if (require === "member" && !hasLiveMembership(session)) return routes.welcome()
  if (require === "account" && hasLiveMembership(session)) return routes.feed()
  return null
}

/**
 * Garde de session CÔTÉ CLIENT — confort de navigation seulement : l'autorité
 * reste au serveur (le moteur refuse toute lecture ou écriture hors adhésion).
 *
 *   · `account` : il faut être connecté ; un membre est renvoyé vers son fil ;
 *   · `member`  : il faut une adhésion à DIASPORALE ; sans elle, ou après un
 *     départ → accueil ;
 *   · `person`  : il faut être connecté, l'adhésion est facultative — membre,
 *     partie, suspendue ou sans adhésion. Réservée aux droits personnels
 *     (« Mes données », NP-02) : les portes du moteur qu'ils appellent ne lisent
 *     aucune adhésion, et la page ne monte aucune surface sociale.
 */
export function Gate(props: {
  require: GateRequirement
  children: (session: SignedIn & { membership: MembershipView | null }) => ReactNode
}) {
  const session = useSession()
  const router = useRouter()
  const ready = session.status === "ready" ? session.data : null
  const redirect = ready === null ? null : gateRedirect(ready, props.require)

  useEffect(() => {
    if (redirect !== null) router.replace(redirect)
  }, [redirect, router])

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
