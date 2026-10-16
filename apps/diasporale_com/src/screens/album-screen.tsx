"use client"

import { AlbumPage } from "@antia/social-features/albums"
import { EmptyState } from "@diasporale/features"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ImagesIcon } from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { IcomIsland, useEngineNetwork } from "@/components/icom"

/** La galerie du moteur ; la lecture reste ouverte aux membres en attente. */
export function AlbumScreen(props: { handle: string; albumId: string }) {
  const network = useEngineNetwork()
  const { t } = useDiasporaleT()
  return (
    <Gate require="member">
      {(session) => session.membership ? (
        <AppShell membership={session.membership}>
          {network === null ? (
            <EmptyState icon={<ImagesIcon />} title={t("albums.unavailableTitle")} description={t("albums.unavailableBody")} />
          ) : (
            <IcomIsland network={network}>
              <AlbumPage handle={props.handle} albumId={props.albumId} />
            </IcomIsland>
          )}
        </AppShell>
      ) : null}
    </Gate>
  )
}
