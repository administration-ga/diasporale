import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { HubScreen } from "@/screens/hub-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("hub.metaTitle") }
}

export default async function HubPage(props: { params: Promise<{ iso: string }> }) {
  const { iso } = await props.params
  return (
    <Suspense fallback={<GateSkeleton />}>
      <HubScreen iso={iso} />
    </Suspense>
  )
}
