import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { MyActivityScreen } from "@/screens/services-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("services.meta.activity") }
}

/** `/mon-activite` — offres, demandes et pages de la personne qui propose ; l'onglet se lit dans l'adresse. */
export default function MyActivityPage() {
  return <Suspense fallback={<GateSkeleton />}><MyActivityScreen /></Suspense>
}
