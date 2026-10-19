"use client"

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { StoriesStyles, StoriesTray } from "@antsia/social-features/stories"
import { useSession } from "@diasporale/features/data"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { IcomIsland, useEngineNetwork } from "@/components/icom"
import { routes } from "@/lib/routes"

/** Le bandeau du moteur, aux deux paliers du fil ; même accès que le lecteur /actus. */
export function FeedStories(props: { now: number }) {
  const network = useEngineNetwork()
  const session = useSession()
  const membership = session.status === "ready" && session.data.status === "signed_in" ? session.data.membership : null
  if (network === null || membership === null || membership.status === "partie" || membership.status === "suspendue" || network.personId !== membership.personId) return null
  const canCreate = membership.canPublish
  return (
    <IcomIsland key={`${network.networkId}:${network.personId}:${canCreate}`} network={network}>
      <EngineStoriesTray now={props.now} canCreate={canCreate} />
    </IcomIsland>
  )
}

function EngineStoriesTray(props: { now: number; canCreate: boolean }) {
  const router = useRouter()
  const me = useAuthenticatedConvexQuery(api.modules.people.persons.getMyPerson, {})
  const [now, setNow] = useState(props.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return (
    <>
      <StoriesStyles />
      <StoriesTray
        myHandle={me.data?.published === true ? (me.data.handle ?? null) : null}
        myAvatarUrl={me.data?.avatar?.url ?? null}
        canCreate={props.canCreate}
        now={now}
        onOpen={(handle) => router.push(routes.story(handle))}
        onCreate={() => {
          if (props.canCreate) router.push(routes.newStory())
        }}
      />
    </>
  )
}
