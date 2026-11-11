import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { SponsorScreen } from "@/screens/sponsor-attestation-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("sponsor.title") }
}

/** L'écran lit la demande de parrainage dans l'adresse (`?pour=`, EA-10) : il attend sous une frontière. */
export default function SponsorPage() {
  return <Suspense fallback={<GateSkeleton />}><SponsorScreen /></Suspense>
}
