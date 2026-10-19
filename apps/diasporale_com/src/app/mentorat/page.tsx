import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { MentoringScreen } from "@/screens/mentoring-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("mentoring.meta.search") }
}

/** `/mentorat` — chercher un mentor bénévole par pays et domaine ; le pays se lit dans l'adresse (`?pays=`). */
export default function MentoringPage() {
  return (
    <Suspense fallback={<GateSkeleton />}>
      <MentoringScreen />
    </Suspense>
  )
}
