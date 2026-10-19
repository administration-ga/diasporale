import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { ServicesScreen } from "@/screens/services-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("services.meta.catalog") }
}

/** `/services` — le catalogue du réseau ; ses filtres se lisent dans l'adresse. */
export default function ServicesPage() {
  return <Suspense fallback={<GateSkeleton />}><ServicesScreen /></Suspense>
}
