import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { RelationsScreen } from "@/screens/relations-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("relations.title") }
}

export default function RelationsPage() {
  return <Suspense fallback={<GateSkeleton />}><RelationsScreen /></Suspense>
}
