"use client"

import { Avatar as EngineAvatar } from "@antsia/social-features/reseau-personnel"
import { coverBannerStyle } from "@antsia/social-features/features/reseau-personnel/profil-personne"
import { Avatar } from "@diasporale/features"
import type { ProfileImageView } from "@diasporale/features/data"

/** Seules les images délivrées par le moteur peuvent quitter le fond neutre. */
function deliveredUrl(image: ProfileImageView | null) {
  return image?.withheld === null ? image.url : null
}

export function ProfileCover(props: { image: ProfileImageView | null }) {
  return <div aria-hidden className="h-20 bg-[var(--ink-100)] md:h-28" style={coverBannerStyle(deliveredUrl(props.image))} />
}

export function ProfileAvatar(props: { id: string; name: string; image: ProfileImageView | null }) {
  const url = deliveredUrl(props.image)
  return url ? (
    <span className="inline-flex size-20 shrink-0 rounded-full ring-4 ring-card">
      <EngineAvatar key={url} displayName={props.name} avatarUrl={url} size={80} />
    </span>
  ) : <Avatar id={props.id} name={props.name} size="xl" className="ring-4 ring-card" />
}
