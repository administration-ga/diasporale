"use client"

import { Avatar as EngineAvatar } from "@antsia/social-features/reseau-personnel"
import { isServiceProviderOwnerKind } from "@diasporale/domain"
import { Avatar, Button, Card, ContactButton, CountryTag, EmptyState, EventCard, PostCard, Skeleton, TrustBadge } from "@diasporale/features"
import {
  ERROR_CODES,
  type ErrorCode,
  type MembershipView,
  type PageDetailQuery,
  type PageDetailView,
  type PagesCapability,
  type PagesRetry,
  useActions,
  usePage,
  usePagesCapability,
  useOptionalDataSource,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowLeftIcon, BellOffIcon, BellPlusIcon, NewspaperIcon, UserRoundXIcon } from "lucide-react"
import NextLink from "next/link"
import { useId, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { AppShell } from "@/components/app-shell"
import { AssociationMembershipEntry } from "@/components/association-membership-entry"
import { AssociationGroupEntry } from "@/components/association-group"
import { AssociationEventsSection } from "@/components/association-events"
import { Gate } from "@/components/gate"
import { PagePostPages } from "@/components/feed-pages"
import { PageAdminEntry } from "@/components/page-admin-entry"
import { PageAbout } from "@/components/page-about"
import { PageContentViews } from "@/components/page-content-views"
import { PageServiceReviews } from "@/components/page-reviews-section"
import { PageServiceContactEntry, PageServicesSection } from "@/components/page-services-section"
import { PagePublishButton } from "@/components/page-publications"
import { PageShareButton } from "@/components/page-share-button"
import { ProfileCover } from "@/components/profile-images"
import { routes } from "@/lib/routes"

/** `/pages/[handle]` — page d'institution, d'association ou d'entreprise (EXF-DG-20 à 23, DG-007). */
export function PageScreen(props: { handle: string }) {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <AppShell membership={session.membership}>
            <PageDetail handle={props.handle} membership={session.membership} />
          </AppShell>
        ) : null
      }
    </Gate>
  )
}

/**
 * La fiche se lit par la capacité « pages » quand le fournisseur la sert
 * (réactive à l'abonnement et au rôle du lecteur, avec reprise), sinon par
 * `usePage` du port. La source ne change pas pendant la vie de l'arbre : chaque
 * branche garde l'ordre de ses hooks.
 */
export function PageDetail(props: { handle: string; membership: MembershipView }) {
  const capability = usePagesCapability()
  return capability ? <CapabilityPageDetail {...props} capability={capability} /> : <PortPageDetail {...props} />
}

function CapabilityPageDetail(props: { handle: string; membership: MembershipView; capability: PagesCapability }) {
  const detail = props.capability.usePage(props.handle)
  return <PageDetailBody detail={detail} membership={props.membership} capability={props.capability} />
}

function PortPageDetail(props: { handle: string; membership: MembershipView }) {
  const detail = usePage(props.handle)
  return <PageDetailBody detail={detail} membership={props.membership} capability={null} />
}

/** Un code reçu qui n'est pas fermé se dit « erreur inconnue », jamais tel quel. */
function closedCode(code: string): ErrorCode {
  return ERROR_CODES.has(code as ErrorCode) ? (code as ErrorCode) : "unknown"
}

function PageDetailBody(props: { detail: PageDetailQuery; membership: MembershipView; capability: PagesCapability | null }) {
  const { t } = useDiasporaleT()
  const { detail } = props
  // Le chargement seul a son squelette : un refus ou une panne sortent du squelette (DG-007).
  if (detail.status === "loading") {
    return (
      <div role="status" aria-busy="true">
        <span className="sr-only">{t("common.pleaseWait")}</span>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }
  if (detail.status === "error") return <PageError code={closedCode(detail.code)} {...(detail.retry ? { retry: detail.retry } : {})} />
  if (detail.data === null) {
    return <EmptyState icon={<UserRoundXIcon />} title={t("page.unavailableTitle")} description={t("page.unavailableBody")} />
  }
  return <PageFiche view={detail.data} membership={props.membership} capability={props.capability} />
}

function PageError(props: { code: ErrorCode; retry?: PagesRetry }) {
  const { t } = useDiasporaleT()
  const [retrying, setRetrying] = useState(false)
  const active = useRef(false)
  useLayoutEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const retry = props.retry
  const again = async () => {
    if (!retry || retrying) return
    setRetrying(true)
    try {
      await retry()
    } catch {
      // La lecture garde son erreur traduite ; rien d'autre à dire ici.
    } finally {
      if (active.current) setRetrying(false)
    }
  }
  return (
    <Card role="alert" className="flex flex-col items-start gap-3 p-4">
      <div>
        <h1 className="font-semibold">{t("page.errorTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(`errors.${props.code}`)}</p>
      </div>
      {retry ? (
        <Button variant="outline" disabled={retrying} aria-busy={retrying} onClick={() => void again()}>
          {t("page.retry")}
        </Button>
      ) : null}
    </Card>
  )
}

function PageLogo(props: { page: PageDetailView["page"] }) {
  const { page } = props
  const shape = page.ownerKind === "association" ? "round" : "square"
  // Le logo n'est montré que délivré par la garde des fichiers ; sinon, les initiales.
  return page.logoUrl ? (
    <span className="inline-flex shrink-0 ring-4 ring-card">
      <EngineAvatar key={page.logoUrl} displayName={page.name} avatarUrl={page.logoUrl} size={80} shape={shape} />
    </span>
  ) : (
    <Avatar id={page.id} name={page.name} size="xl" shape={shape} />
  )
}

function PageFiche(props: { view: PageDetailView; membership: MembershipView; capability: PagesCapability | null }) {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const source = useOptionalDataSource()
  const publications = source?.pagePublications
  const { view } = props
  const { page, posts, events } = view
  const serviceProvider = isServiceProviderOwnerKind(page.ownerKind)
  const hasPageReviews = serviceProvider && !!source?.serviceReviews?.usePageReviews
  const now = Date.now()
  return (
    <>
      <Button asChild variant="ghost" className="self-start"><NextLink href={routes.pages({ ...(page.ownerKind === "association" || page.ownerKind === "company" ? { ownerKind: page.ownerKind } : {}), ...(page.country ? { country: page.country } : {}) })}>
        <ArrowLeftIcon aria-hidden />{t("pageBrowsing.backToDirectory")}
      </NextLink></Button>
      <Card className="flex flex-col overflow-hidden">
        {view.bannerUrl ? <ProfileCover image={{ url: view.bannerUrl, withheld: null }} /> : null}
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-4">
            <PageLogo page={page} />
            <div className="min-w-0 flex-1">
              <h1 className="break-words font-display text-3xl font-bold leading-tight">{page.name}</h1>
              {page.shortName ? <p className="mt-1 text-sm font-semibold text-muted-foreground">{page.shortName}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <TrustBadge badge={page.badge} size="md" />
                {page.country ? <CountryTag country={page.country} city={page.city ?? undefined} size="md" /> : null}
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground">
                {t("page.followers", { count: page.followers })}
                <span aria-hidden> · </span>
                {t("page.postCount", { count: view.postCount })}
              </p>
            </div>
          </div>
          {!serviceProvider && page.description ? <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{page.description}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            {props.capability ? (
              <FollowButton
                capability={props.capability}
                handle={page.handle}
                name={page.name}
                following={view.viewer.following}
                canFollow={props.membership.canPublish}
              />
            ) : null}
            {serviceProvider ? view.viewer.role === null ? <PageServiceContactEntry pageHandle={page.handle} /> : null : <ContactButton recipientName={page.name} />}
            <PageAdminEntry pageId={page.id} handle={page.handle} viewerRole={view.viewer.role} claimable={page.claimable} />
            <AssociationMembershipEntry pageId={page.id} handle={page.handle} ownerKind={page.ownerKind} />
            <PagePublishButton page={page} membership={props.membership} role={view.viewer.role} />
            <PageShareButton handle={page.handle} name={page.name} />
          </div>
          {page.trust === "official" ? <p className="text-[13px] text-muted-foreground">{t("page.officialNote")}</p> : null}
        </div>
      </Card>

      {serviceProvider ? <PageAbout page={page} canEdit={view.viewer.role === "admin" && props.membership.canPublish && source?.pageAdmin?.management?.supportsPresentation === true} canBrowseCategories={source?.pages?.supportsDirectoryCategories === true} /> : null}

      {serviceProvider ? <PageServicesSection pageId={page.id} pageHandle={page.handle} canManage={view.viewer.role !== null} showEmpty /> : null}

      {page.ownerKind === "association" ? <>
        <AssociationGroupEntry pageId={page.id} handle={page.handle} isAdmin={view.viewer.role === "admin"} canPublish={props.membership.canPublish} />
        <AssociationEventsSection pageId={page.id} handle={page.handle} canManage={view.viewer.role !== null} />
      </> : null}

      {page.ownerKind !== "association" && events.length > 0 ? (
        <section aria-labelledby="page-evenements" className="flex flex-col gap-3">
          <h2 id="page-evenements" className="font-display text-xl font-bold">
            {t("page.events")}
          </h2>
          {events.map((event) => (
            <EventCard key={event.id} event={event} now={now} />
          ))}
        </section>
      ) : null}

      <section aria-labelledby="page-publications" className="flex flex-col gap-4">
        <h2 id="page-publications" className="font-display text-xl font-bold">
          {t(publications?.media || hasPageReviews ? "pageMedia.section" : "page.posts")}
        </h2>
        <PageContentViews handle={page.handle} pageId={page.id} pageName={page.name} membership={props.membership} now={now} capability={publications}
          reviews={hasPageReviews ? <PageServiceReviews pageId={page.id} personId={props.membership.personId} /> : null}>
          {publications ? <PagePostPages
            handle={page.handle}
            pageId={page.id}
            capability={publications}
            canRemove={view.viewer.role !== null}
            membership={props.membership}
            now={now}
            emptyFallback={<EmptyState icon={<NewspaperIcon />} title={t("page.noPosts")} />}
          /> : posts.length === 0 ? (
            <EmptyState icon={<NewspaperIcon />} title={t("page.noPosts")} />
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                now={now}
                canReact={props.membership.canPublish}
                onReact={async (kind) => {
                  const result = await actions.react(post.id, kind)
                  if (!result.ok) toast.error(t(`errors.${result.code}`))
                }}
              />
            ))
          )}
          {!publications && view.morePosts ? <p className="text-[13px] text-muted-foreground">{t("page.morePosts")}</p> : null}
        </PageContentViews>
      </section>
    </>
  )
}

/**
 * Suivre / Ne plus suivre — le geste réel du moteur (idempotent), retour sonner.
 * L'état affiché est celui de la fiche, relue après le geste (abonnement
 * réactif) : jamais un état supposé. Un membre en attente lit, il ne suit pas
 * encore ; se désabonner reste toujours possible.
 */
function FollowButton(props: { capability: PagesCapability; handle: string; name: string; following: boolean; canFollow: boolean }) {
  const { t } = useDiasporaleT()
  const hintId = useId()
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const active = useRef(false)
  useLayoutEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const blocked = !props.following && !props.canFollow
  const toggle = async () => {
    if (locked.current || blocked) return
    locked.current = true
    setBusy(true)
    try {
      const result = props.following ? await props.capability.unfollow(props.handle) : await props.capability.follow(props.handle)
      if (!active.current) return
      if (result.ok) toast.success(t(result.value.following ? "page.followed" : "page.unfollowed", { name: props.name }))
      else toast.error(t(`errors.${result.code}`))
    } catch {
      if (active.current) toast.error(t("errors.unknown"))
    } finally {
      locked.current = false
      if (active.current) setBusy(false)
    }
  }
  return (
    <>
      <Button
        variant={props.following ? "outline" : "primary"}
        disabled={busy || blocked}
        aria-busy={busy}
        aria-describedby={blocked ? hintId : undefined}
        onClick={() => void toggle()}
      >
        {props.following ? <BellOffIcon aria-hidden /> : <BellPlusIcon aria-hidden />}
        {t(props.following ? "page.unfollow" : "page.follow")}
      </Button>
      {blocked ? (
        <p id={hintId} className="w-full text-[13px] text-muted-foreground">
          {t("page.followNeedsStatus")}
        </p>
      ) : null}
    </>
  )
}
