import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { ProfileScreen } from "@/screens/profile-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("profile.metaTitle") }
}

export default async function ProfilePage(props: { params: Promise<{ handle: string }> }) {
  const { handle } = await props.params
  return (
    <Suspense fallback={<GateSkeleton />}>
      <ProfileScreen handle={handle} />
    </Suspense>
  )
}
