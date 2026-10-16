"use client"

import { AlbumComposer, AlbumsSection } from "@antsia/social-features/albums"
import { useRouter } from "next/navigation"

import { IcomIsland, useEngineNetwork } from "@/components/icom"
import { routes } from "@/lib/routes"

/** Les surfaces d'albums du moteur, sans recopier ni leur donnée ni leur garde de fichiers. */
export function ProfileAlbums(props: {
  handle: string
  isSelf: boolean
  canPublish: boolean
  preview: boolean
  variant: "photos" | "albums"
  create: boolean
}) {
  const network = useEngineNetwork()
  const router = useRouter()
  // Le moteur ne projette pas encore les albums pour un autre lecteur : masquer
  // seulement les commandes ne suffirait pas à produire un aperçu fidèle.
  if (network === null || props.preview) return null
  const canCreate = props.isSelf && !props.preview && props.canPublish && props.variant === "albums"

  return (
    <IcomIsland network={network}>
      {props.create && canCreate ? (
        <AlbumComposer
          handle={props.handle}
          onCancel={() => router.replace(routes.profileTab(props.handle, "albums"), { scroll: false })}
          onPublished={(albumId) => router.push(routes.album(props.handle, albumId))}
        />
      ) : (
        <AlbumsSection
          handle={props.handle}
          isSelf={props.isSelf && !props.preview}
          variant={props.variant}
          onCreate={canCreate ? () => router.push(routes.newAlbum(props.handle), { scroll: false }) : undefined}
        />
      )}
    </IcomIsland>
  )
}
