"use client"

import { useRingRelation } from "@antsia/social-features/iappel"
import type { Id } from "@convex/_generated/dataModel"
import type { FacetProjection } from "@diasporale/domain"
import {
  Button,
  Card,
  ContactButton,
  CountryTag,
  EmptyState,
  FolderTabsNav,
  Skeleton,
  TrustBadges,
  formatDate,
} from "@diasporale/features"
import { type ActionResult, useActions, useProfile, useRelation, type MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { BanIcon, BookmarkIcon, ClockIcon, EyeIcon, HandHeartIcon, ImageIcon, LandmarkIcon, NewspaperIcon, PencilIcon, PhoneIcon, ShieldOffIcon, UserCheckIcon, UserPlusIcon, UserRoundXIcon, UsersIcon } from "lucide-react"
import NextLink from "next/link"
import { useSearchParams } from "next/navigation"
import { type ReactNode, useId, useRef, useState } from "react"
import { toast } from "sonner"

import { AppShell } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { IcomIsland, useEngineNetwork, useIcomState, useWriteTo } from "@/components/icom"
import { ProfileAlbums } from "@/components/profile-albums"
import { ProfileAvatar, ProfileCover } from "@/components/profile-images"
import { ProfileMenu } from "@/components/profile-menu"
import { ProfilePostPages } from "@/components/feed-pages"
import { ReportedContent } from "@/components/report-content-sheet"
import { callsAreOpen } from "@/lib/calls"
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
  const profile = useProfile(props.handle.replace(/^@/, "").toLowerCase())
  const preview = searchParams.get("apercu") === "1"
  const engineNetwork = useEngineNetwork()
  const requestedTab = searchParams.get("onglet")
  const withAlbums = engineNetwork !== null && !preview
  const tab = withAlbums && (requestedTab === "photos" || requestedTab === "albums") ? requestedTab : "publications"
  const now = Date.now()

  if (profile.status === "error") return (
    <Card role="alert" className="flex flex-col items-start gap-3 p-4">
      <h1 className="font-display text-2xl font-bold">{t("profile.errorTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("profile.errorBody")}</p>
      <Button variant="outline" onClick={() => window.location.reload()}>{t("profile.reload")}</Button>
    </Card>
  )
  if (profile.status !== "ready") return <Skeleton className="h-72 w-full rounded-xl" />
  if (profile.data === null) {
    // Refus indistinct : profil inconnu, retiré, hors réseau ou bloqué (EXF-DG-19).
    const ownHandle = props.handle.replace(/^@/, "").toLowerCase() === props.membership.handle.toLowerCase()
    return (
      <>
        <EmptyState icon={<UserRoundXIcon />} title={t("profile.unavailableTitle")} description={t("profile.unavailableBody")} />
        {ownHandle ? (
          <Button asChild variant="outline" className="self-start">
            <NextLink href={`${routes.settings()}#profil`}>{t("profile.managePublication")}</NextLink>
          </Button>
        ) : null}
      </>
    )
  }
  const view = profile.data
  const facet: FacetProjection = view.isSelf && preview ? view.publicFacet : view.facet

  const body = (
    <>
      {view.isSelf && preview ? (
        <p className="rounded-xl bg-[var(--info-50)] px-4 py-3 text-[13px] text-[var(--info-600)]">{t("profile.previewNotice")}</p>
      ) : null}
      <Card className="overflow-hidden">
        <ProfileCover image={view.cover} />
        <div className="flex flex-col gap-4 px-5 pb-5">
          <div className="-mt-10 flex items-end justify-between gap-3">
            <ProfileAvatar id={view.personId} name={view.displayName} image={view.avatar} />
            <div className="flex flex-wrap justify-end gap-2">
              {view.isSelf ? preview ? (
                <Button asChild variant="ghost" size="sm">
                  <NextLink href={routes.profile(view.handle)}><EyeIcon aria-hidden />{t("profile.previewExit")}</NextLink>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline" size="sm">
                    <NextLink href={routes.settings()}>
                      <PencilIcon aria-hidden />
                      {t("profile.edit")}
                    </NextLink>
                  </Button>
                  {engineNetwork && props.membership.canPublish ? (
                    <Button asChild variant="outline" size="sm">
                      <NextLink href={routes.settingsImages()}><ImageIcon aria-hidden />{t("profile.images.edit")}</NextLink>
                    </Button>
                  ) : null}
                  <Button asChild variant="ghost" size="sm">
                    <NextLink href={routes.profilePreview(view.handle)}>
                      <EyeIcon aria-hidden />
                      {preview ? t("profile.previewExit") : t("profile.preview")}
                    </NextLink>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <NextLink href={routes.bookmarks()}>
                      <BookmarkIcon aria-hidden />
                      {t("profile.bookmarks")}
                    </NextLink>
                  </Button>
                  {engineNetwork && !preview ? (
                    <Button asChild variant="ghost" size="sm">
                      <NextLink href={routes.relations()}>
                        <UsersIcon aria-hidden />
                        {t("nav.relations")}
                      </NextLink>
                    </Button>
                  ) : null}
                </>
              ) : (
                <>
                  <RelationBar personId={view.personId} handle={view.handle} displayName={view.displayName} canCommunicate={props.membership.canPublish} />
                  <PersonContact personId={view.personId} handle={view.handle} displayName={view.displayName} />
                </>
              )}
            </div>
          </div>
          <div>
            <h1 className="break-words font-display text-3xl font-bold leading-tight">{view.displayName}</h1>
            <p className="break-words font-mono text-sm text-muted-foreground">@{view.handle}</p>
            <TrustBadges badges={view.badges} size="md" className="mt-2" />
            {view.headline ? <p className="mt-3 break-words text-[15px]">{view.headline}</p> : null}
          </div>
          <FacetDetails facet={facet} postName={facet.postSlug ? view.postName : null} locale={locale} />
        </div>
      </Card>

      {withAlbums ? (
        <FolderTabsNav
          label={t("profile.tabsLabel")}
          items={([
            { id: "publications", label: t("profile.posts") },
            { id: "photos", label: t("profile.photos") },
            { id: "albums", label: t("profile.albums") },
          ] as const).map((item) => ({ ...item, href: routes.profileTab(view.handle, item.id, preview), active: tab === item.id }))}
          renderLink={(item, className, children) => (
            <NextLink key={item.id} href={item.href} className={className} aria-current={item.active ? "page" : undefined} scroll={false}>
              {children}
            </NextLink>
          )}
        />
      ) : null}

      {tab === "publications" ? (
        <section aria-labelledby="profil-publications" className="flex flex-col gap-4">
          <h2 id="profil-publications" className="font-display text-xl font-bold">
            {t("profile.posts")}
          </h2>
          {preview ? (
            <p className="text-sm text-muted-foreground">{t("profile.previewPostsUnavailable")}</p>
          ) : (
            <ProfilePostPages
              membership={props.membership}
              handle={view.handle}
              now={now}
              emptyFallback={<EmptyState icon={<NewspaperIcon />} title={view.isSelf ? t("profile.noPostsSelf") : t("profile.noPosts", { name: view.displayName })} />}
            />
          )}
        </section>
      ) : (
        <section aria-labelledby="profil-albums" className="flex flex-col gap-4">
          <h2 id="profil-albums" className="font-display text-xl font-bold">{tab === "photos" ? t("profile.photos") : t("profile.albums")}</h2>
          <ProfileAlbums
            key={`${view.handle}:${tab}:${preview}`}
            handle={view.handle}
            isSelf={view.isSelf}
            canPublish={props.membership.canPublish}
            preview={preview}
            variant={tab}
            create={searchParams.get("nouveau") === "1"}
          />
        </section>
      )}
    </>
  )
  if (view.isSelf) return body
  // RP-02 : signalée depuis son menu, la fiche d'autrui se masque aussitôt pour la personne qui l'a signalée.
  return (
    <ReportedContent target={{ kind: "person", id: view.personId }} back={{ href: routes.feed(), label: t("contentReports.back.feed") }}>
      {body}
    </ReportedContent>
  )
}

/**
 * Ma relation avec ce membre (EXF-DG-11, EXF-DG-12) : se connecter, répondre à
 * une demande reçue, suivre, bloquer. Un blocage posé par l'autre ne se voit
 * pas ; bloquer se confirme, et défait le lien et les abonnements de la paire.
 * Bloquer, signaler, mettre en sourdine et copier le lien vivent dans le menu
 * « … » de la fiche (RP-02).
 */
function RelationBar(props: { personId: string; handle: string; displayName: string; canCommunicate: boolean }) {
  const { t } = useDiasporaleT()
  const relation = useRelation(props.personId)
  const actions = useActions()
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const [confirmingBlock, setConfirmingBlock] = useState(false)
  const hintId = useId()
  const name = props.displayName

  if (relation.status !== "ready") return <Skeleton className="h-9 w-40 rounded-full" />
  const { connection, connectionId, following } = relation.data

  const run = async (action: () => Promise<ActionResult>, done?: string) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    try {
      const result = await action()
      if (!result.ok) toast.error(t(`errors.${result.code}`))
      else if (done) toast.success(done)
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  if (connection === "blocked_by_me") {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => actions.unblock(props.personId), t("relation.unblocked", { name }))}>
          <ShieldOffIcon aria-hidden />
          {t("relation.unblock")}
        </Button>
        <ProfileMenu personId={props.personId} handle={props.handle} displayName={name} />
      </div>
    )
  }

  if (confirmingBlock) {
    return (
      <div role="group" aria-label={t("relation.blockConfirm", { name })} className="flex flex-wrap items-center justify-end gap-2">
        <p className="text-[13px] text-muted-foreground">{t("relation.blockConfirm", { name })}</p>
        <Button
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={async () => {
            await run(() => actions.block(props.personId), t("relation.blocked", { name }))
            setConfirmingBlock(false)
          }}
        >
          <BanIcon aria-hidden />
          {t("relation.blockAction")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirmingBlock(false)}>
          {t("relation.cancel")}
        </Button>
      </div>
    )
  }

  const locked = busy || !props.canCommunicate
  // Un seul bouton plein par zone : le geste de relation prime sur « Suivre ».
  const relationIsFilled = connection === "none" || (connection === "requested_by_them" && Boolean(connectionId))
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {connection === "none" ? (
        <Button variant="social" size="sm" disabled={locked} aria-describedby={props.canCommunicate ? undefined : hintId} onClick={() => run(() => actions.connect(props.personId), t("relation.requestSent", { name }))}>
          <UserPlusIcon aria-hidden />
          {t("relation.connect")}
        </Button>
      ) : connection === "requested_by_me" ? (
        <Button size="sm" variant="outline" disabled>
          <ClockIcon aria-hidden />
          {t("relation.requested")}
        </Button>
      ) : connection === "requested_by_them" && connectionId ? (
        <>
          <Button variant="social" size="sm" disabled={locked} onClick={() => run(() => actions.respondToConnection(connectionId, true), t("relation.accepted", { name }))}>
            <UserCheckIcon aria-hidden />
            {t("relation.accept")}
          </Button>
          <Button size="sm" variant="ghost" disabled={locked} onClick={() => run(() => actions.respondToConnection(connectionId, false))}>
            {t("relation.decline")}
          </Button>
        </>
      ) : connection === "connected" ? (
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-muted px-3 text-[13px] font-medium">
          <UsersIcon aria-hidden className="size-4" />
          {t("relation.connected")}
        </span>
      ) : null}
      <Button
        size="sm"
        variant={following || relationIsFilled ? "outline" : "social"}
        aria-pressed={following}
        disabled={busy || (!following && !props.canCommunicate)}
        onClick={() => run(() => (following ? actions.unfollow(props.personId) : actions.follow(props.handle)))}
      >
        {following ? t("relation.unfollow") : t("relation.follow")}
      </Button>
      {/* RP-02 : Signaler, Bloquer, Mettre en sourdine et Copier le lien, dans le menu « … » de la fiche. */}
      <ProfileMenu personId={props.personId} handle={props.handle} displayName={name} onBlock={() => { if (!running.current) setConfirmingBlock(true) }} />
      {props.canCommunicate ? null : (
        <p id={hintId} className="basis-full text-right text-[12px] text-muted-foreground">
          {t("relation.needsStatus")}
        </p>
      )}
    </div>
  )
}

/**
 * « Écrire » et « Appeler » (PD7) : la messagerie et les appels du moteur. Le
 * moteur n'ouvre un fil neuf qu'entre relations (`THREAD_RELATION_REQUIRED`) et
 * n'appelle que ses relations : hors relation, ou sans iCom (démonstration,
 * membre pas encore déclaré), seul « Écrire » reste, fermé, et dit pourquoi.
 * « Appeler » n'est proposé que si l'interrupteur des appels est ouvert (IM-01).
 */
function PersonContact(props: { personId: string; handle: string; displayName: string }) {
  const { t } = useDiasporaleT()
  const icom = useIcomState()
  const relation = useRelation(props.personId)
  const connected = relation.status === "ready" && relation.data.connection === "connected"
  if (icom.status === "on" && connected) {
    return (
      <IcomIsland network={icom.network}>
        <IcomContact personId={props.personId} handle={props.handle} displayName={props.displayName} />
      </IcomIsland>
    )
  }
  const hint =
    icom.status === "on" ? t("contact.needsRelation") : icom.status === "off" && icom.reason === "not_allowed" ? t("relation.needsStatus") : undefined
  return <ContactButton recipientName={props.displayName} unavailableHint={hint} />
}

/**
 * Les gestes d'iCom, sous l'îlot du moteur (réseau courant, hôte d'appel de la coque) :
 * « Écrire », puis « Appeler » quand les appels sont ouverts (IM-01). Fermés, le geste
 * n'est pas proposé du tout : aucun bouton ne finit sur une erreur de configuration.
 */
function IcomContact(props: { personId: string; handle: string; displayName: string }) {
  const writeTo = useWriteTo()
  return (
    <>
      <ContactButton recipientName={props.displayName} onContact={() => writeTo(props.handle)} />
      {callsAreOpen() ? <CallButton personId={props.personId} handle={props.handle} displayName={props.displayName} /> : null}
    </>
  )
}

/** « Appeler » une relation : la sonnerie du moteur (`ring`), audio. */
function CallButton(props: { personId: string; handle: string; displayName: string }) {
  const { t } = useDiasporaleT()
  const { busyHandle, ring } = useRingRelation()
  return (
    <Button
      variant="message"
      disabled={busyHandle === props.handle}
      aria-label={t("contact.callTo", { name: props.displayName })}
      onClick={() => void ring({ personId: props.personId as Id<"persons">, handle: props.handle, displayName: props.displayName })}
    >
      <PhoneIcon aria-hidden />
      {t("contact.call")}
    </Button>
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
