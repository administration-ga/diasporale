import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { ModerationDeskScreen } from "@/screens/moderation-desk-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("moderationDesk.meta.title") }
}

/**
 * `/moderation` — le guichet de modération par pays (PD6 · G9) : file, recours,
 * équipe ; l'onglet se lit dans l'adresse. Réservé aux équipes habilitées : le
 * moteur relit la compétence à chaque lecture, l'écran dit « indisponible » sinon.
 */
export default function ModerationDeskPage() {
  return <Suspense fallback={<GateSkeleton />}><ModerationDeskScreen /></Suspense>
}
