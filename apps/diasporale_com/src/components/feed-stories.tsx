"use client"

import { api } from "@antia/api/engine"
import { useAuthenticatedConvexQuery } from "@antia/api/hooks"
import { StoriesStyles, StoriesTray } from "@antia/social-features/stories"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { IcomIsland, useIcomNetwork } from "@/components/icom"
import { routes } from "@/lib/routes"

/** Le bandeau du moteur, aux deux paliers du fil ; même accès que le lecteur /actus. */
export function FeedStories(props: { now: number }) {
  const network = useIcomNetwork()
  if (network === null) return null
  return (
    <IcomIsland network={network}>
      <EngineStoriesTray now={props.now} />
    </IcomIsland>
  )
}

function EngineStoriesTray(props: { now: number }) {
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
        now={now}
        onOpen={(handle) => router.push(routes.story(handle))}
        onCreate={() => router.push(routes.newStory())}
      />
    </>
  )
}
