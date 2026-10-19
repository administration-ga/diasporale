import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { PagesScreen } from "@/screens/pages-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("pageBrowsing.title") }
}

export default function PagesPage() {
  return <Suspense fallback={<GateSkeleton />}><PagesScreen /></Suspense>
}
