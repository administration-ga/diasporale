"use client"

import type { FacetProjection } from "@diasporale/domain"
import {
  Avatar,
  Button,
  Card,
  ContactButton,
  CountryTag,
  EmptyState,
  EventCard,
  PostCard,
  Skeleton,
  TrustBadge,
  TrustBadges,
  formatDate,
} from "@diasporale/features"
import { useActions, usePage, useProfile, type MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { EyeIcon, FlagIcon, HandHeartIcon, LandmarkIcon, NewspaperIcon, PencilIcon, UserRoundXIcon } from "lucide-react"
import NextLink from "next/link"
import { useSearchParams } from "next/navigation"
import type { ReactNode } from "react"
import { toast } from "sonner"

import { AppShell } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { routes } from "@/lib/routes"

/** `/@handle` (réécrit vers `/profil/handle`) — profil publié, facette selon ses visibilités (EXF-DG-07/08). */
export function ProfileScreen(props: { handle: string }) {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <AppShell membership={session.membership}>
            <Profile handle={props.handle} membership={session.membership} />
          </AppShell>
        ) : null
      }
    </Gate>
  )
}

function Profile(props: { handle: string; membership: MembershipView }) {
  const { t, locale } = useDiasporaleT()
  const searchParams = useSearchParams()
  const profile = useProfile(decodeURIComponent(props.handle).replace(/^@/, "").toLowerCase())
  const actions = useActions()
  const preview = searchParams.get("apercu") === "1"
  const now = Date.now()

  if (profile.status !== "ready") return <Skeleton className="h-72 w-full rounded-xl" />
  if (profile.data === null) {
    // Refus indistinct : profil inconnu, privé ou bloqué rendent la même page (EXF-DG-19).
    return <EmptyState icon={<UserRoundXIcon />} title={t("profile.unavailableTitle")} description={t("profile.unavailableBody")} />
  }
  const view = profile.data
  const facet: FacetProjection = view.isSelf && preview ? view.publicFacet : view.facet

  return (
    <>
      {view.isSelf && preview ? (
        <p className="rounded-xl bg-[var(--info-50)] px-4 py-3 text-[13px] text-[var(--info-600)]">{t("profile.previewNotice")}</p>
      ) : null}
      <Card className="overflow-hidden">
        <div aria-hidden className="h-20 bg-[var(--ink-100)] md:h-28" />
        <div className="flex flex-col gap-4 px-5 pb-5">
          <div className="-mt-10 flex items-end justify-between gap-3">
            <Avatar id={view.personId} name={view.displayName} size="xl" className="ring-4 ring-card" />
            <div className="flex flex-wrap justify-end gap-2">
              {view.isSelf ? (
                <>
                  <Button asChild variant="outline" size="sm">
                    <NextLink href={routes.settings()}>
                      <PencilIcon aria-hidden />
                      {t("profile.edit")}
                    </NextLink>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <NextLink href={preview ? routes.profile(view.handle) : routes.profilePreview(view.handle)}>
                      <EyeIcon aria-hidden />
                      {preview ? t("profile.previewExit") : t("profile.preview")}
                    </NextLink>
                  </Button>
                </>
              ) : (
                <ContactButton recipientName={view.displayName} />
              )}
            </div>
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold leading-tight">{view.displayName}</h1>
            <p className="font-mono text-sm text-muted-foreground">@{view.handle}</p>
            <TrustBadges badges={view.badges} size="md" className="mt-2" />
            {view.headline ? <p className="mt-3 text-[15px]">{view.headline}</p> : null}
          </div>
          <FacetDetails facet={facet} postName={facet.postSlug ? view.postName : null} locale={locale} />
        </div>
      </Card>

      <section aria-labelledby="profil-publications" className="flex flex-col gap-4">
        <h2 id="profil-publications" className="font-display text-xl font-bold">
          {t("profile.posts")}
        </h2>
        {view.posts.length === 0 ? (
          <EmptyState icon={<NewspaperIcon />} title={view.isSelf ? t("profile.noPostsSelf") : t("profile.noPosts", { name: view.displayName })} />
        ) : (
          view.posts.map((post) => (
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
      </section>
    </>
  )
}

function FacetDetails(props: { facet: FacetProjection; postName: string | null; locale: string }) {
  const { t } = useDiasporaleT()
  const { facet } = props
  const rows: { key: string; label: string; value: ReactNode }[] = []
  if (facet.countryOfResidence) {
    rows.push({ key: "pays", label: t("facet.country"), value: <CountryTag country={facet.countryOfResidence} city={facet.city} size="md" /> })
  }
  if (facet.postSlug && props.postName) {
    rows.push({
      key: "poste",
      label: t("facet.post"),
      value: (
        <span className="inline-flex items-center gap-1.5 text-[15px]">
          <LandmarkIcon className="size-4 text-muted-foreground" aria-hidden />
          {props.postName}
        </span>
      ),
    })
  }
  if (facet.arrivedAt) {
    rows.push({
      key: "arrivee",
      label: t("facet.arrivedAt"),
      value: <span className="font-mono">{formatDate(Date.UTC(facet.arrivedAt, 6, 1), props.locale, { year: "numeric" })}</span>,
    })
  }
  if (facet.helpAvailable) {
    rows.push({
      key: "entraide",
      label: t("facet.help"),
      value: (
        <span className="inline-flex items-center gap-1.5 text-[15px]">
          <HandHeartIcon className="size-4 text-muted-foreground" aria-hidden />
          {t("facet.helpAvailable")}
        </span>
      ),
    })
  }
  if (rows.length === 0) return null
  return (
    <dl className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.key} className="flex flex-col gap-1">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** `/pages/[handle]` — page d'institution, d'association ou d'entreprise (EXF-DG-20 à 23). */
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

function PageDetail(props: { handle: string; membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const detail = usePage(props.handle)
  const actions = useActions()
  const now = Date.now()
  if (detail.status !== "ready") return <Skeleton className="h-72 w-full rounded-xl" />
  if (detail.data === null) {
    return <EmptyState icon={<UserRoundXIcon />} title={t("page.unavailableTitle")} description={t("page.unavailableBody")} />
  }
  const { page, posts, events } = detail.data
  return (
    <>
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-4">
          <Avatar id={page.id} name={page.name} size="xl" shape={page.ownerKind === "association" ? "round" : "square"} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-bold leading-tight">{page.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TrustBadge badge={page.badge} size="md" />
              {page.country ? <CountryTag country={page.country} city={page.city ?? undefined} size="md" /> : null}
            </div>
          </div>
        </div>
        <p className="text-[15px] leading-relaxed">{page.description}</p>
        <div className="flex flex-wrap items-center gap-3">
          <ContactButton recipientName={page.name} />
          {page.claimable ? (
            <Button variant="outline" disabled title={t("page.claimSoon")}>
              <FlagIcon aria-hidden />
              {t("page.claim")}
            </Button>
          ) : null}
        </div>
        {page.trust === "official" ? <p className="text-[13px] text-muted-foreground">{t("page.officialNote")}</p> : null}
      </Card>

      {events.length > 0 ? (
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
          {t("page.posts")}
        </h2>
        {posts.length === 0 ? (
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
      </section>
    </>
  )
}
