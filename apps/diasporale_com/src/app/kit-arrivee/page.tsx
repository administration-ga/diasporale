import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { ArrivalKitScreen } from "@/screens/arrival-kit-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("arrivalKit.meta.home") }
}

/** `/kit-arrivee` — le kit d'arrivée d'un pays et d'une ville saisie ; la zone se lit dans l'adresse (DG-024 b). */
export default function ArrivalKitPage() {
  return <Suspense fallback={<GateSkeleton />}><ArrivalKitScreen /></Suspense>
}
