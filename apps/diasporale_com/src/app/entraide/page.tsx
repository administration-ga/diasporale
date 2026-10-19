import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { MutualAidScreen } from "@/screens/mutual-aid-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("mutualAid.meta.home") }
}

/** `/entraide` — questions et missions bénévoles d'un pays ; le pays et la ville saisie se lisent dans l'adresse. */
export default function MutualAidPage() {
  return <Suspense fallback={<GateSkeleton />}><MutualAidScreen /></Suspense>
}
