"use client"

import { Skeleton } from "@diasporale/features"
import { useSession, type MembershipView, type SessionView } from "@diasporale/features/data"
import { useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"

import { routes } from "@/lib/routes"

type SignedIn = Extract<SessionView, { status: "signed_in" }>

/**
 * Garde de session CÔTÉ CLIENT — confort de navigation seulement : l'autorité
 * reste au serveur (le moteur refuse toute lecture ou écriture hors adhésion).
 *
 *   · `account` : il faut être connecté ; un membre est renvoyé vers son fil ;
 *   · `member`  : il faut une adhésion à DIASPORALE ; sans elle → onboarding.
 */
export function Gate(props: {
  require: "account" | "member"
  children: (session: SignedIn & { membership: MembershipView | null }) => ReactNode
}) {
  const session = useSession()
  const router = useRouter()
  const ready = session.status === "ready" ? session.data : null

  useEffect(() => {
    if (ready === null) return
    if (ready.status === "anonymous") router.replace(routes.enter())
    else if (props.require === "member" && (ready.membership === null || ready.membership.status === "partie")) router.replace(routes.welcome())
    else if (props.require === "account" && ready.membership !== null && ready.membership.status !== "partie") router.replace(routes.feed())
  }, [ready, props.require, router])

  if (ready === null || ready.status === "anonymous") return <GateSkeleton />
  if (props.require === "member" && (ready.membership === null || ready.membership.status === "partie")) return <GateSkeleton />
  if (props.require === "account" && ready.membership !== null && ready.membership.status !== "partie") return <GateSkeleton />
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
