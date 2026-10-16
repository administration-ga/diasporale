"use client"

import { usePersonalConnections, usePersonalPendingConnections } from "@antia/social-features/features/reseau-personnel/use-dual-connection-pagination"
import { useActions } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { toast } from "sonner"

import { routes } from "@/lib/routes"

import { ConnectionList, type ConnectionListLabels, type ConnectionListRow } from "./connection-list"

export interface EnginePersonalConnectionsProps {
  readonly kind: "accepted" | "received"
  readonly canRespond: boolean
}

/** À monter sous l'îlot réseau : un seul type de liste et un seul hook sont actifs à la fois. */
export function EnginePersonalConnections(props: EnginePersonalConnectionsProps) {
  return props.kind === "accepted" ? <AcceptedConnections canRespond={props.canRespond} /> : <ReceivedConnections canRespond={props.canRespond} />
}

function AcceptedConnections(props: { canRespond: boolean }) {
  const list = usePersonalConnections({ pageSize: 12 })
  return <PersonalConnectionsList list={list} kind="accepted" canRespond={props.canRespond} />
}

function ReceivedConnections(props: { canRespond: boolean }) {
  const list = usePersonalPendingConnections({ pageSize: 10 })
  return <PersonalConnectionsList list={list} kind="received" canRespond={props.canRespond} />
}

function PersonalConnectionsList(props: EnginePersonalConnectionsProps & { list: ReturnType<typeof usePersonalConnections> }) {
  const { t } = useDiasporaleT()
  const actions = useActions()
  const { list } = props
  // Les badges des deux domaines portent déjà les mêmes quatre valeurs ; aucune conversion ni assertion.
  const items: ConnectionListRow[] = list.items.map((item) => ({
    connectionId: item.connectionId,
    personId: item.otherPersonId,
    displayName: item.displayName,
    handle: item.handle,
    headline: item.headline,
    badges: item.badges,
    ...(item.message !== undefined ? { message: item.message } : {}),
  }))
  const labels: ConnectionListLabels = {
    member: t("relations.member"),
    loading: t("relations.loading"),
    errorTitle: t("relations.errorTitle"),
    errorBody: t("relations.errorBody"),
    retry: t("relations.retry"),
    emptyTitle: t(props.kind === "accepted" ? "relations.emptyAcceptedTitle" : "relations.emptyReceivedTitle"),
    emptyBody: t(props.kind === "accepted" ? "relations.emptyAcceptedBody" : "relations.emptyReceivedBody"),
    discover: t("relations.discover"),
    loadMore: t("relations.loadMore"),
    loadingMore: t("relations.loadingMore"),
    accept: t("relation.accept"),
    decline: t("relation.decline"),
    readOnly: t("relations.readOnly"),
  }

  const respond = async (connectionId: string, accept: boolean) => {
    if (!props.canRespond || props.kind !== "received") return
    try {
      const result = await actions.respondToConnection(connectionId, accept)
      if (!result.ok) {
        toast.error(t(`errors.${result.code}`))
        return
      }
      list.remove(connectionId)
      toast.success(t(accept ? "relations.accepted" : "relations.declined"))
    } catch {
      toast.error(t("errors.unknown"))
    }
  }

  return (
    <ConnectionList
      items={items}
      kind={props.kind}
      isLoading={list.isLoading}
      isLoadingMore={list.isLoadingMore}
      isError={list.isError}
      hasMore={list.hasMore}
      canRespond={props.canRespond}
      onRetry={list.retry}
      onMore={list.loadMore}
      onRespond={respond}
      profileHref={routes.profile}
      discoverHref={routes.members()}
      labels={labels}
    />
  )
}
