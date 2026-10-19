import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { JobsScreen } from "@/screens/jobs-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("jobs.meta.search") }
}

/** `/emploi` — les offres d'emploi ouvertes du réseau ; le pays et la ville se lisent dans l'adresse. */
export default function JobsPage() {
  return <Suspense fallback={<GateSkeleton />}><JobsScreen /></Suspense>
}
