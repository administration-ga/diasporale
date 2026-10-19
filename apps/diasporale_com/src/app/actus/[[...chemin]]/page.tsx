import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getAppT } from "@/i18n/server"
import { STORIES_NEW_SEGMENT } from "@/lib/routes"
import { StoriesScreen } from "@/screens/icom-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("stories.title") }
}

/** Le lecteur plein écran des statuts du moteur (PD7) et, sur `…/nouvelle`, le composeur ouvert. */
export default async function StoriesPage(props: { params: Promise<{ chemin?: string[] }> }) {
  const { chemin = [] } = await props.params
  if (chemin.length > 1 || (chemin.length === 1 && chemin[0] !== STORIES_NEW_SEGMENT)) notFound()
  return <StoriesScreen openCreate={chemin[0] === STORIES_NEW_SEGMENT} />
}
