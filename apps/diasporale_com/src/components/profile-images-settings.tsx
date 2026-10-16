"use client"

import { Button, Card, Skeleton } from "@diasporale/features"
import { useDataSource, useProfile, type MembershipView, type ProfileImagesActions } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"

import { ProfileImagesEditor } from "./profile-images-editor"

/** Les images appartiennent au profil commun ; aucune commande globale de retrait ou de confidentialité. */
export function ProfileImagesSettings(props: { membership: MembershipView }) {
  const source = useDataSource()
  const { t } = useDiasporaleT()
  if (source.kind !== "engine" || !source.profileImages) return null

  return (
    <section id="images" aria-labelledby="images-titre" className="scroll-mt-20">
      <Card className="flex flex-col gap-4 p-5">
        <div>
          <h2 id="images-titre" className="font-display text-xl font-bold">{t("profile.images.title")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("profile.images.shared")}</p>
        </div>
        {props.membership.canPublish ? (
          <OwnProfileImages key={props.membership.personId} membership={props.membership} actions={source.profileImages} />
        ) : <p className="text-sm text-muted-foreground">{t("profile.images.readOnly")}</p>}
      </Card>
    </section>
  )
}

function OwnProfileImages(props: { membership: MembershipView; actions: ProfileImagesActions }) {
  const { t } = useDiasporaleT()
  const profile = useProfile(props.membership.handle)
  if (profile.status === "loading") return (
    <div role="status"><span className="sr-only">{t("common.pleaseWait")}</span><Skeleton className="h-32 w-full rounded-xl" /></div>
  )
  if (profile.status === "error") return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p>{t("profile.errorBody")}</p>
      <Button variant="outline" onClick={() => window.location.reload()}>{t("profile.reload")}</Button>
    </div>
  )
  if (!profile.data?.isSelf || profile.data.personId !== props.membership.personId) {
    return <p className="text-sm text-muted-foreground">{t("profile.images.unavailable")}</p>
  }
  return <ProfileImagesEditor avatar={profile.data.avatar} cover={profile.data.cover} actions={props.actions} />
}
