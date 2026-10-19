"use client"

/** DG-023 : médias de page attachés à l'événement dès leur publication. */
import { isAssociationEventGalleryOpen } from "@diasporale/domain"
import { Button, Card, PostComposerSheet, PostMediaGrid, Sheet, SheetContent, Skeleton } from "@diasporale/features"
import { useSession, type AssociationEventGalleryCapability, type AssociationEventGalleryItem, type AssociationEventView, type MembershipView, type PagePublicationsCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ImagePlus, RefreshCw } from "lucide-react"
import { useId, useLayoutEffect, useState } from "react"
import { toast } from "sonner"

import { ServicePager } from "./service-pager"
import { formatServiceInstant, useNow } from "./service-request-ui"
import { useReviewTask as useGalleryTask } from "./service-review-editor"

interface GalleryProps {
  readonly event: AssociationEventView
  readonly capability: AssociationEventGalleryCapability
}

export function AssociationEventGallery(props: GalleryProps) {
  const session = useSession()
  if (session.status !== "ready" || session.data.status !== "signed_in" || !session.data.membership) return null
  const member = session.data.membership
  if (member.status === "suspendue" || member.status === "partie" || member.root.status === "suspendue" || member.root.status === "partie" || props.event.moderation !== "published") return null
  return <GalleryReader key={`${member.personId}:${props.event.pageId}:${props.event.eventId}:${props.capability.mode}`} {...props} member={member} />
}

function GalleryReader(props: GalleryProps & { readonly member: MembershipView }) {
  const { t, locale } = useDiasporaleT()
  const id = useId()
  const now = useNow(1_000)
  const [refresh, setRefresh] = useState(0)
  const finished = now >= props.event.endAt
  // Une seule relecture au franchissement ; aucune clé construite avec l'heure courante.
  const query = props.capability.useGallery(props.event.eventId, refresh * 2 + (finished ? 1 : 0))
  if (query.status === "loading") return <Skeleton className="h-32 w-full rounded-xl" />
  if (query.status === "error") return <p role="alert" className="text-sm text-destructive">{t(`errors.${query.code}`)}</p>
  const state = query.data
  if (!state || state.eventId !== props.event.eventId) return null
  const available = state.available && isAssociationEventGalleryOpen(props.event, now)
  const canManage = props.member.canPublish && props.event.canManage
  const canPublish = canManage && state.canPublish
  const audienceLabel = t(state.audience === "association" ? "eventGallery.associationAudience" : "eventGallery.networkAudience")
  return <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4">
    <h2 id={id} className="font-display text-xl font-bold">{t("eventGallery.title")}</h2>
    <p className="text-sm text-muted-foreground">{t("eventGallery.lead")}</p>
    {props.capability.mode === "demonstration" ? <p className="rounded-lg bg-muted p-3 text-sm">{t("eventGallery.demo")}</p> : null}
    {!available ? <>
      <p>{t(props.event.status === "cancelled" ? "eventGallery.cancelled" : finished ? "eventGallery.awaitingServer" : "eventGallery.beforeEnd", { date: formatServiceInstant(props.event.endAt, props.event.timeZone, locale), zone: props.event.timeZone })}</p>
      {finished && props.event.status === "scheduled" && !state.available ? <Button variant="outline" onClick={() => setRefresh((value) => value + 1)}><RefreshCw aria-hidden className="size-4" />{t("eventGallery.refresh")}</Button> : null}
    </> : <GalleryBody key={`${props.event.version}:${state.audience}:${canManage}:${canPublish}`} {...props} canManage={canManage} canPublish={canPublish} audienceLabel={audienceLabel} />}
  </section>
}

function GalleryBody(props: GalleryProps & { readonly member: MembershipView; readonly canManage: boolean; readonly canPublish: boolean; readonly audienceLabel: string }) {
  const { t } = useDiasporaleT()
  const [compose, setCompose] = useState(false)
  const publish: PagePublicationsCapability["publish"] = (input) => {
    if (!props.canPublish || props.event.moderation !== "published" || !isAssociationEventGalleryOpen(props.event, Date.now())) return Promise.resolve({ ok: false, code: "association_event_gallery_not_open" })
    const media = input.media ?? []
    if (media.length === 0) return Promise.resolve({ ok: false, code: "association_event_gallery_media_required" })
    return props.capability.publish({ eventId: props.event.eventId, body: input.body, media, idempotencyKey: input.idempotencyKey })
  }
  return <div className="flex min-w-0 flex-col gap-3">
    <p className="text-sm font-medium">{props.audienceLabel}</p>
    {props.canPublish ? <>
      <Button className="self-start" onClick={() => { if (isAssociationEventGalleryOpen(props.event, Date.now())) setCompose(true) }}><ImagePlus aria-hidden className="size-4" />{t("eventGallery.add")}</Button>
      {compose ? <PostComposerSheet open onOpenChange={setCompose} memberCountry={props.member.facet.countryOfResidence} openCountries={[]} draftKey={`diasporale:event-gallery:${props.member.personId}:${props.event.pageId}:${props.event.eventId}`} page={{ id: props.event.pageId, name: props.event.organizer.name, country: null, publish, fixedScope: { description: t("eventGallery.composeDescription", { title: props.event.title }), audienceLabel: props.audienceLabel, requireMedia: true } }} /> : null}
    </> : null}
    <ServicePager clearOnError read={(cursor) => props.capability.useItems({ eventId: props.event.eventId, cursor })} keyOf={(item) => item.post.id} empty={<p>{t("eventGallery.empty")}</p>}>
      {(items) => <GalleryItems {...props} items={items} />}
    </ServicePager>
  </div>
}

function GalleryItems(props: GalleryProps & { readonly items: readonly AssociationEventGalleryItem[]; readonly canManage: boolean }) {
  const { t, locale } = useDiasporaleT()
  const task = useGalleryTask()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const items = props.items.filter((item) => item.post.moderation === "published")
  const current = items.find((item) => item.post.id === removingId && item.canRemove && props.canManage)
  useLayoutEffect(() => { if (removingId && !current) setRemovingId(null) }, [removingId, current])
  function remove() {
    if (!current || !isAssociationEventGalleryOpen(props.event, Date.now())) return
    const postId = current.post.id
    void task.run(() => props.capability.remove({ eventId: props.event.eventId, postId }), () => { setRemovingId(null); toast.success(t("eventGallery.removed")) })
  }
  return <>
    <ul className="flex min-w-0 flex-col gap-3">{items.map(({ post, canRemove }) => <li key={post.id}>
      <Card className="flex min-w-0 flex-col gap-3 p-4">
        <p className="font-semibold">{post.author.displayName}</p>
        <time dateTime={new Date(post.createdAt).toISOString()} className="text-sm text-muted-foreground">{formatServiceInstant(post.createdAt, props.event.timeZone, locale)}</time>
        {post.body ? <p className="whitespace-pre-line break-words">{post.body}</p> : null}
        <PostMediaGrid media={post.media} />
        {canRemove && props.canManage ? <Button variant="outline" className="self-start" disabled={task.busy} onClick={() => setRemovingId(post.id)}>{t("eventGallery.remove")}</Button> : null}
      </Card>
    </li>)}</ul>
    {task.error && !current ? <p role="alert" className="text-sm text-destructive">{t(`errors.${task.error}`)}</p> : null}
    {current ? <Sheet open onOpenChange={(open) => { if (!open && !task.busy) setRemovingId(null) }}><SheetContent title={t("eventGallery.removeTitle")} description={t("eventGallery.removeHint")} closeLabel={t("eventGallery.close")}>
      <div className="flex min-w-0 flex-col gap-3"><p className="whitespace-pre-line break-words">{current.post.body || t("eventGallery.noCaption")}</p>
        {task.error ? <p role="alert" className="text-sm text-destructive">{t(`errors.${task.error}`)}</p> : null}
        <div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={task.busy} aria-busy={task.busy} onClick={remove}>{t("eventGallery.confirmRemove")}</Button><Button variant="ghost" disabled={task.busy} onClick={() => setRemovingId(null)}>{t("eventGallery.cancel")}</Button></div>
      </div>
    </SheetContent></Sheet> : null}
  </>
}
