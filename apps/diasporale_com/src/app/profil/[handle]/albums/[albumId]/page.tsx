import type { Metadata } from "next"
import { Suspense } from "react"

import { GateSkeleton } from "@/components/gate"
import { getAppT } from "@/i18n/server"
import { AlbumScreen } from "@/screens/album-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("albums.metaTitle") }
}

export default async function ProfileAlbumPage(props: { params: Promise<{ handle: string; albumId: string }> }) {
  const { handle, albumId } = await props.params
  return (
    <Suspense fallback={<GateSkeleton />}>
      <AlbumScreen handle={handle} albumId={albumId} />
    </Suspense>
  )
}
