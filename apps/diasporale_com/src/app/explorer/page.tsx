import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { ExploreScreen } from "@/screens/explore-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("explore.title") }
}

/** `/explorer` — la découverte (DG-005). La frontière d'attente couvre les surfaces qui lisent l'adresse. */
export default function ExplorePage() {
  return (
    <Suspense fallback={<GateSkeleton />}>
      <ExploreScreen />
    </Suspense>
  )
}
