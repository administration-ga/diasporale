import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { CommunitiesScreen } from "@/screens/communities-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("nav.communities") }
}

/** `/communautes` — le hub de son pays de résidence (DG-005) ; le hub lit l'adresse (`?bienvenue=1`). */
export default function CommunitiesPage() {
  return (
    <Suspense fallback={<GateSkeleton />}>
      <CommunitiesScreen />
    </Suspense>
  )
}
