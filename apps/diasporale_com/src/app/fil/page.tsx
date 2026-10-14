import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { FeedScreen } from "@/screens/feed-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("feed.title") }
}

export default function FeedPage() {
  return (
    <Suspense fallback={<GateSkeleton />}>
      <FeedScreen />
    </Suspense>
  )
}
