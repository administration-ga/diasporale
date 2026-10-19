import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { PageClaimScreen } from "@/screens/page-admin-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("pageAdmin.claim.metaTitle") }
}

export default async function PageClaimPage(props: { params: Promise<{ handle: string }> }) {
  const { handle } = await props.params
  return (
    <Suspense fallback={<GateSkeleton />}>
      <PageClaimScreen handle={handle} />
    </Suspense>
  )
}
