import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { TalentsScreen } from "@/screens/jobs-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("jobs.meta.talents") }
}

/** `/talents` — mon profil de talent (opt-in) et la recherche bornée des talents visibles ; le pays se lit dans l'adresse. */
export default function TalentsPage() {
  return <Suspense fallback={<GateSkeleton />}><TalentsScreen /></Suspense>
}
