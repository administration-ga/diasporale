"use client"

import { AlbumComposer, AlbumPage } from "@antsia/social-features/albums"
import { EmptyState } from "@diasporale/features"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ImagesIcon } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { IcomIsland, useEngineNetwork } from "@/components/icom"
import { routes } from "@/lib/routes"

/** La galerie du moteur ; la lecture reste ouverte aux membres en attente. */
export function AlbumScreen(props: { handle: string; albumId: string }) {
  const network = useEngineNetwork()
  const { t } = useDiasporaleT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preview = searchParams.get("apercu") === "1"
  const editing = searchParams.get("modifier") === "1"
  const handle = props.handle.replace(/^@/, "").toLowerCase()
  return (
    <Gate require="member">
      {(session) => {
        const membership = session.membership
        if (!membership) return null
        const canEdit = membership.canPublish && handle === membership.handle && network?.personId === membership.personId
        return (
          <AppShell membership={membership}>
            {network === null || network.personId !== membership.personId || preview ? (
              <EmptyState icon={<ImagesIcon />} title={t("albums.unavailableTitle")} description={t(preview ? "albums.previewUnavailableBody" : "albums.unavailableBody")} />
            ) : (
              <IcomIsland network={network} key={`${network.networkId}:${network.personId}:${props.albumId}`}>
                {editing && canEdit ? (
                  <AlbumComposer
                    handle={handle}
                    albumId={props.albumId}
                    canPublish={membership.canPublish}
                    onCancel={() => router.replace(routes.album(handle, props.albumId), { scroll: false })}
                    onPublished={(albumId) => router.push(routes.album(handle, albumId))}
                  />
                ) : (
                  <AlbumPage
                    handle={handle}
                    albumId={props.albumId}
                    canEdit={canEdit}
                    onEdit={canEdit ? (albumId) => router.push(routes.editAlbum(handle, albumId), { scroll: false }) : undefined}
                  />
                )}
              </IcomIsland>
            )}
          </AppShell>
        )
      }}
    </Gate>
  )
}
