"use client"

/**
 * Les demandes reçues par une page professionnelle, montées dans l'onglet
 * « Demandes » de « Mon activité ». PROPRIÉTAIRE : chantier « demandes et
 * rendez-vous ». « Mon activité » (chantier « catalogue ») le monte ; la
 * signature est figée.
 *
 * Réservé aux signataires VIVANTS de la page (le serveur juge à chaque
 * lecture) ; la liste se filtre par état, chaque demande s'ouvre dans
 * `/mon-activite/demandes/<id>`.
 */
import { SERVICE_REQUEST_STATUSES, type ServiceRequestStatus } from "@diasporale/domain"
import { Button, Card } from "@diasporale/features"
import { useServiceRequests } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import NextLink from "next/link"
import { useId, useMemo, useState } from "react"

import { routes } from "@/lib/routes"

import { browserTimeZone, ServiceRequestList } from "./service-request-ui"

const ALL = "all"

function parseStatus(value: string): ServiceRequestStatus | null {
  return (SERVICE_REQUEST_STATUSES as readonly string[]).includes(value) ? (value as ServiceRequestStatus) : null
}

export function ServiceInbox(props: { readonly pageId: string; readonly pageHandle: string }) {
  const { t } = useDiasporaleT()
  const id = useId()
  const capability = useServiceRequests()
  const [status, setStatus] = useState<ServiceRequestStatus | null>(null)
  const viewerTimeZone = useMemo(() => browserTimeZone(), [])
  if (capability === null) {
    return (
      <Card className="flex flex-col gap-2 p-4">
        <p className="font-semibold">{t("serviceRequests.inbox.unavailableTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("serviceRequests.inbox.unavailableBody")}</p>
      </Card>
    )
  }
  return (
    <section aria-labelledby={`${id}-titre`} className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={`${id}-titre`} className="text-lg font-semibold">{t("serviceRequests.inbox.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("serviceRequests.inbox.lead")}</p>
        </div>
        <Button asChild variant="link" size="sm">
          <NextLink href={routes.page(props.pageHandle)}>{t("serviceRequests.inbox.viewPage")}</NextLink>
        </Button>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={`${id}-filtre`} className="text-sm font-medium">{t("serviceRequests.inbox.filter")}</label>
        <select
          id={`${id}-filtre`}
          value={status ?? ALL}
          onChange={(event) => setStatus(parseStatus(event.target.value))}
          className="h-11 w-full max-w-xs rounded-md border border-input bg-card px-3 text-[15px]"
        >
          <option value={ALL}>{t("serviceRequests.inbox.all")}</option>
          {SERVICE_REQUEST_STATUSES.map((value) => (
            <option key={value} value={value}>{t(`serviceRequests.status.${value}`)}</option>
          ))}
        </select>
      </div>
      <ServiceRequestList
        key={`${props.pageId}:${status ?? ALL}`}
        capability={capability}
        source={{ kind: "page", pageId: props.pageId, status }}
        hrefOf={routes.activityRequest}
        viewerTimeZone={viewerTimeZone}
        emptyTitle={t(status === null ? "serviceRequests.inbox.emptyTitle" : "serviceRequests.inbox.emptyFilteredTitle")}
        emptyBody={t("serviceRequests.inbox.emptyBody")}
      />
    </section>
  )
}
