"use client"

/**
 * Mes pages dans « Mon activité » (onglet « Pages ») : les pages que je gère,
 * mes invitations de signataire, mes revendications, « Créer une page » — et,
 * pour la modération du réseau seule, les revendications à instruire.
 * PROPRIÉTAIRE : chantier « gestion des pages ». « Mon activité » (chantier
 * « catalogue ») le monte ; la signature est figée.
 */
import { Avatar, Button, Card, EmptyState, Skeleton, TrustBadge, formatDate } from "@diasporale/features"
import { isServiceProviderOwnerKind } from "@diasporale/domain"
import { usePageAdmin, useServiceReviews, type ActionErrorCode, type ManagedPageView, type PageAdminCapability, type PageClaimView, type PageInvitationView, type PageManagement } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { Building2Icon, CheckIcon, FilePlus2Icon, NewspaperIcon, Settings2Icon, UsersRoundIcon, XIcon } from "lucide-react"
import NextLink from "next/link"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { routes } from "@/lib/routes"

import { ClaimStatusChip, ConfirmSheet, ErrorNotice, PageAdminUnavailable, RoleChip } from "./page-admin-parts"
import { ClaimReviewSection } from "./page-claim-review"

export function MyPagesPanel() {
  const capability = usePageAdmin()
  if (!capability) return <PageAdminUnavailable />
  return <Panel capability={capability} management={capability.management ?? null} />
}

function Panel(props: { readonly capability: PageAdminCapability; readonly management: PageManagement | null }) {
  const { t } = useDiasporaleT()
  const pages = props.capability.useMyPages()
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="mes-pages" className="flex flex-col gap-3">
        <div>
          <h2 id="mes-pages" className="font-display text-xl font-bold">{t("pageAdmin.myPages.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("pageAdmin.myPages.lead")}</p>
        </div>
        <Button asChild variant="outline" className="self-start"><NextLink href={routes.pages({ followed: true })}>{t("pageBrowsing.followingShortcut")}</NextLink></Button>
        {pages.status === "loading" ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : pages.status === "error" ? (
          <ErrorNotice code={pages.code} />
        ) : pages.data.length === 0 ? (
          <EmptyState
            icon={<Building2Icon />}
            title={t("pageAdmin.myPages.emptyTitle")}
            description={t("pageAdmin.myPages.emptyBody")}
            action={props.management ? <CreateLinks /> : undefined}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {pages.data.map((page) => (
              <ManagedPageItem key={page.id} page={page} />
            ))}
          </ul>
        )}
        {props.management && pages.status === "ready" && pages.data.length > 0 ? <CreateLinks /> : null}
      </section>
      {props.management ? <Invitations management={props.management} /> : null}
      {props.management ? <MyClaims management={props.management} /> : null}
      {props.management ? <ClaimReviewSection management={props.management} /> : null}
    </div>
  )
}

function CreateLinks() {
  const { t } = useDiasporaleT()
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild>
        <NextLink href={routes.newPage("association")}>
          <FilePlus2Icon aria-hidden />
          {t("pageAdmin.myPages.createAssociation")}
        </NextLink>
      </Button>
      <Button asChild variant="outline">
        <NextLink href={routes.newPage("company")}>
          <FilePlus2Icon aria-hidden />
          {t("pageAdmin.myPages.createCompany")}
        </NextLink>
      </Button>
      <Button asChild variant="ghost">
        <NextLink href={routes.newPage()}>{t("pageAdmin.myPages.createOther")}</NextLink>
      </Button>
    </div>
  )
}

function ManagedPageItem(props: { readonly page: ManagedPageView }) {
  const { t } = useDiasporaleT()
  const reviews = useServiceReviews()
  const { page } = props
  return (
    <li>
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Avatar id={page.id} name={page.name} size="md" shape="square" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <NextLink href={routes.page(page.handle)} className="min-w-0 break-words underline-offset-4 hover:underline">
              {page.name}
            </NextLink>
            {page.badge ? <TrustBadge badge={page.badge} /> : null}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <RoleChip role={page.role} />
            <span>{t(`pageAdmin.kind.${page.ownerKind}`)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm" className="min-h-11">
            <NextLink href={routes.pageManage(page.handle, "publications")}><NewspaperIcon aria-hidden />{t("pagePostManagement.tab")}</NextLink>
          </Button>
          {isServiceProviderOwnerKind(page.ownerKind) ? <>
            <Button asChild variant="ghost" size="sm" className="min-h-11"><NextLink href={routes.pageManage(page.handle, "services")}>{t("pageServiceManagement.tabServices")}</NextLink></Button>
            <Button asChild variant="ghost" size="sm" className="min-h-11"><NextLink href={routes.pageManage(page.handle, "demandes")}>{t("pageServiceManagement.tabRequests")}</NextLink></Button>
            {reviews?.usePageReviews ? <Button asChild variant="ghost" size="sm" className="min-h-11"><NextLink href={routes.pageManage(page.handle, "avis")}>{t("pageReviews.tab")}</NextLink></Button> : null}
          </> : null}
          <Button asChild variant="outline" size="sm">
            <NextLink href={routes.pageManage(page.handle)} aria-label={t("pageAdmin.myPages.manageLabel", { name: page.name })}>
              <Settings2Icon aria-hidden />
              {t("pageAdmin.myPages.manage")}
            </NextLink>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <NextLink href={routes.pageManage(page.handle, "equipe")} aria-label={t("pageAdmin.myPages.teamLabel", { name: page.name })}>
              <UsersRoundIcon aria-hidden />
              {t("pageAdmin.myPages.team")}
            </NextLink>
          </Button>
        </div>
      </Card>
    </li>
  )
}

function Invitations(props: { readonly management: PageManagement }) {
  const { t } = useDiasporaleT()
  const invitations = props.management.useMyInvitations()
  // Une liste vide ne dit rien : aucune invitation n'attend.
  if (invitations.status === "loading" || (invitations.status === "ready" && invitations.data.length === 0)) return null
  return (
    <section aria-labelledby="mes-invitations" className="flex flex-col gap-3">
      <div>
        <h2 id="mes-invitations" className="font-display text-xl font-bold">{t("pageAdmin.invitations.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("pageAdmin.invitations.lead")}</p>
      </div>
      {invitations.status === "error" ? (
        <ErrorNotice code={invitations.code} />
      ) : (
        <ul className="flex flex-col gap-2">
          {invitations.data.map((invitation) => (
            <InvitationItem key={invitation.page.id} management={props.management} invitation={invitation} />
          ))}
        </ul>
      )}
    </section>
  )
}

function InvitationItem(props: { readonly management: PageManagement; readonly invitation: PageInvitationView }) {
  const { t, locale } = useDiasporaleT()
  const { invitation } = props
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<ActionErrorCode | null>(null)
  const running = useRef(false)
  const respond = async (accept: boolean) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setRefusal(null)
    try {
      const result = await props.management.respondToInvitation(invitation.page.id, accept)
      if (!result.ok) setRefusal(result.code)
      else toast.success(accept ? t("pageAdmin.invitations.accepted", { name: invitation.page.name }) : t("pageAdmin.invitations.declined"))
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  return (
    <li>
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Avatar id={invitation.page.id} name={invitation.page.name} size="md" shape="square" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              <NextLink href={routes.page(invitation.page.handle)} className="min-w-0 break-words underline-offset-4 hover:underline">
                {invitation.page.name}
              </NextLink>
              <TrustBadge badge={invitation.page.badge} />
            </p>
            <p className="text-[13px] text-muted-foreground">
              {t("pageAdmin.invitations.item", { role: t(`pageAdmin.role.${invitation.role}`), date: formatDate(invitation.invitedAt, locale) })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => void respond(true)}>
            <CheckIcon aria-hidden />
            {t("pageAdmin.invitations.accept")}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void respond(false)}>
            <XIcon aria-hidden />
            {t("pageAdmin.invitations.decline")}
          </Button>
        </div>
        {refusal ? <ErrorNotice code={refusal} /> : null}
      </Card>
    </li>
  )
}

function MyClaims(props: { readonly management: PageManagement }) {
  const { t } = useDiasporaleT()
  const claims = props.management.useMyClaims()
  if (claims.status === "loading" || (claims.status === "ready" && claims.data.length === 0)) return null
  return (
    <section aria-labelledby="mes-revendications" className="flex flex-col gap-3">
      <h2 id="mes-revendications" className="font-display text-xl font-bold">{t("pageAdmin.claims.title")}</h2>
      {claims.status === "error" ? (
        <ErrorNotice code={claims.code} />
      ) : (
        <ul className="flex flex-col gap-2">
          {claims.data.map((claim) => (
            <ClaimItem key={claim.id} management={props.management} claim={claim} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ClaimItem(props: { readonly management: PageManagement; readonly claim: PageClaimView }) {
  const { t, locale } = useDiasporaleT()
  const { claim } = props
  const [confirming, setConfirming] = useState(false)
  const [refusal, setRefusal] = useState<ActionErrorCode | null>(null)
  const withdraw = async () => {
    setRefusal(null)
    const result = await props.management.withdrawClaim(claim.id)
    if (!result.ok) setRefusal(result.code)
    else if (result.value.withdrawn) toast.success(t("pageAdmin.claim.withdrawn"))
    else setRefusal("page_claim_closed")
    return true
  }
  return (
    <li>
      <Card className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <NextLink href={routes.page(claim.page.handle)} className="min-w-0 break-words font-semibold underline-offset-4 hover:underline">
            {claim.page.name}
          </NextLink>
          <ClaimStatusChip status={claim.status} />
        </div>
        <p className="text-[13px] text-muted-foreground">{t("pageAdmin.claims.sentOn", { date: formatDate(claim.createdAt, locale) })}</p>
        {claim.decisionReason ? <p className="text-sm">{t("pageAdmin.claim.decisionReason", { reason: claim.decisionReason })}</p> : null}
        {claim.status === "pending" ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <NextLink href={routes.pageClaim(claim.page.handle)}>{t("pageAdmin.entry.follow")}</NextLink>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
              {t("pageAdmin.claim.withdraw")}
            </Button>
          </div>
        ) : null}
        {refusal ? <ErrorNotice code={refusal} /> : null}
      </Card>
      <ConfirmSheet
        open={confirming}
        onOpenChange={setConfirming}
        title={t("pageAdmin.claim.withdrawConfirmTitle")}
        body={t("pageAdmin.claim.withdrawConfirmBody")}
        confirm={t("pageAdmin.claim.withdraw")}
        onConfirm={withdraw}
      />
    </li>
  )
}
