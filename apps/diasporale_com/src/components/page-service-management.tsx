"use client"

import { isServiceProviderOwnerKind } from "@diasporale/domain"
import { EmptyState } from "@diasporale/features"
import { useServices, type ManagedPageDetailView, type ManagedPageView, type MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ShieldOffIcon, StoreIcon } from "lucide-react"

import { PageServicesManager } from "./page-services-manager"
import { ServiceInbox } from "./service-inbox"

/** Les outils existants, dans le contexte de cette page et sous son mandat vivant. */
export function PageServiceManagement(props: { page: ManagedPageDetailView; membership: MembershipView; tab: "services" | "demandes" }) {
  const { t } = useDiasporaleT()
  const services = useServices()
  const role = props.page.myRole
  if (role === null) return <EmptyState icon={<ShieldOffIcon />} title={t("pageAdmin.manage.notManager.title")} description={t("pageAdmin.manage.notManager.body")} />
  if (!isServiceProviderOwnerKind(props.page.ownerKind)) return <EmptyState icon={<StoreIcon />} title={t("pageServiceManagement.notProviderTitle")} description={t("pageServiceManagement.notProviderBody")} />
  const page: ManagedPageView = {
    id: props.page.id,
    handle: props.page.handle,
    name: props.page.name,
    ownerKind: props.page.ownerKind,
    role,
    badge: props.page.badge,
    country: props.page.country,
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-sm leading-relaxed text-muted-foreground">{props.tab === "services" ? t("pageServiceManagement.servicesLead") : t("pageServiceManagement.requestsLead")}</p>
      {props.tab === "demandes" ? <ServiceInbox key={`${props.membership.personId}:${page.id}`} pageId={page.id} pageHandle={page.handle} />
        : services ? <PageServicesManager key={`${props.membership.personId}:${page.id}`} services={services} page={page} membership={props.membership} />
          : <EmptyState icon={<StoreIcon />} title={t("services.results.unavailableTitle")} description={t("services.results.unavailableBody")} />}
    </div>
  )
}
