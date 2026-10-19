"use client"

import { Button, Card, Skeleton } from "@diasporale/features"
import { usePage } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import NextLink from "next/link"

import { AppShell } from "@/components/app-shell"
import { AssociationEventDetail } from "@/components/association-events"
import { AssociationGroupContent } from "@/components/association-group"
import { Gate } from "@/components/gate"
import { routes } from "@/lib/routes"

export function AssociationActivitiesScreen(props: { readonly handle: string; readonly eventId?: string }) {
  return <Gate require="member">{(session) => session.membership ? <AppShell membership={session.membership}><AssociationActivity {...props} /></AppShell> : null}</Gate>
}

function AssociationActivity(props: { readonly handle: string; readonly eventId?: string }) {
  const { t } = useDiasporaleT()
  const page = usePage(props.handle)
  if (page.status === "loading") return <Skeleton className="h-32 w-full rounded-xl" />
  if (page.status === "error") return <Card role="alert" className="p-4">{t(`errors.${page.code}`)}</Card>
  if (!page.data || page.data.page.ownerKind !== "association") return <Card className="p-4">{t("errors.not_found")}</Card>
  return <>
    <Button asChild variant="ghost" className="self-start"><NextLink href={routes.page(props.handle)}>{t("associationActivities.backToAssociation")}</NextLink></Button>
    {props.eventId ? <AssociationEventDetail pageId={page.data.page.id} handle={props.handle} eventId={props.eventId} /> : <AssociationGroupContent pageId={page.data.page.id} />}
  </>
}
