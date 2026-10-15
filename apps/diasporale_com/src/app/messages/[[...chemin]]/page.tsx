import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getAppT } from "@/i18n/server"
import { parseMessagesSegments } from "@/lib/messages-route"
import { MessagesScreen } from "@/screens/icom-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("messages.title") }
}

/**
 * La messagerie (iCom, PD7) en pages : liste, conversation, composeurs. Au
 * bureau, ces adresses ouvrent la carte iCom détachée sur le fil ; au
 * téléphone, elles rendent la page iCom du moteur.
 */
export default async function MessagesPage(props: { params: Promise<{ chemin?: string[] }> }) {
  const { chemin = [] } = await props.params
  const route = parseMessagesSegments(chemin)
  if (route === null) notFound()
  return <MessagesScreen route={route} />
}
