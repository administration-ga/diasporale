"use client"

import type { TrustBadge } from "@diasporale/domain"
import { Avatar, Button, Card, Skeleton, TrustBadges } from "@diasporale/features"
import NextLink from "next/link"
import { useState } from "react"

export interface ConnectionListRow {
  readonly connectionId: string
  readonly personId: string
  readonly displayName: string | null
  readonly handle: string | null
  readonly headline: string | null
  readonly badges: readonly TrustBadge[]
  readonly message?: string
}

export interface ConnectionListLabels {
  readonly member: string
  readonly loading: string
  readonly errorTitle: string
  readonly errorBody: string
  readonly retry: string
  readonly emptyTitle: string
  readonly emptyBody: string
  readonly discover: string
  readonly loadMore: string
  readonly loadingMore: string
  readonly accept: string
  readonly decline: string
  readonly readOnly: string
}

export interface ConnectionListProps {
  readonly items: readonly ConnectionListRow[]
  readonly kind: "accepted" | "received"
  readonly isLoading: boolean
  readonly isLoadingMore: boolean
  readonly isError: boolean
  readonly hasMore: boolean
  readonly canRespond: boolean
  readonly onRetry: () => void
  readonly onMore: () => void
  readonly onRespond: (id: string, accept: boolean) => Promise<void>
  readonly profileHref: (handle: string) => string
  readonly discoverHref: string
  readonly labels: ConnectionListLabels
}

/** Liste de présentation : le parent conserve les données, les curseurs et les résultats des gestes. */
export function ConnectionList(props: ConnectionListProps) {
  const { items, labels } = props

  return (
    <div className="flex flex-col gap-4" aria-busy={props.isLoading || props.isLoadingMore}>
      {props.isError ? (
        <Card role="alert" className="flex flex-col items-start gap-3 p-4">
          <div>
            <h2 className="font-semibold">{labels.errorTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{labels.errorBody}</p>
          </div>
          <Button variant="outline" onClick={props.onRetry}>{labels.retry}</Button>
        </Card>
      ) : null}

      {items.length > 0 ? (
        <>
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <ConnectionRow
                key={item.connectionId}
                item={item}
                kind={props.kind}
                canRespond={props.canRespond}
                onRespond={props.onRespond}
                profileHref={props.profileHref}
                labels={labels}
              />
            ))}
          </ul>
          {props.kind === "received" && !props.canRespond ? (
            <p className="text-sm text-muted-foreground">{labels.readOnly}</p>
          ) : null}
          {props.hasMore ? (
            <Button variant="outline" disabled={props.isLoadingMore} onClick={props.onMore} className="self-center">
              {props.isLoadingMore ? labels.loadingMore : labels.loadMore}
            </Button>
          ) : null}
        </>
      ) : props.isError ? null : props.isLoading ? (
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">{labels.loading}</span>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : (
        <Card className="flex flex-col items-start gap-3 p-5">
          <div>
            <h2 className="font-display text-xl font-bold">{labels.emptyTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{labels.emptyBody}</p>
          </div>
          <Button asChild variant="outline">
            <NextLink href={props.discoverHref}>{labels.discover}</NextLink>
          </Button>
        </Card>
      )}
    </div>
  )
}

function ConnectionRow(props: Pick<ConnectionListProps, "kind" | "canRespond" | "onRespond" | "profileHref" | "labels"> & { item: ConnectionListRow }) {
  const [busy, setBusy] = useState(false)
  const { item, labels } = props
  const name = item.displayName ?? labels.member
  const identity = (
    <>
      <Avatar id={item.personId} name={name} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="break-words font-semibold">{name}</span>
          <TrustBadges badges={item.badges} />
        </span>
        {item.handle ? <span className="block truncate text-sm text-muted-foreground">@{item.handle}</span> : null}
        {item.headline ? <span className="block break-words text-sm text-muted-foreground">{item.headline}</span> : null}
      </span>
    </>
  )

  const respond = async (accept: boolean) => {
    setBusy(true)
    try {
      await props.onRespond(item.connectionId, accept)
    } catch {
      // Le parent porte l'erreur de l'action ; la ligne reste présente jusqu'à sa mise à jour.
    } finally {
      setBusy(false)
    }
  }

  return (
    <li aria-busy={busy}>
      <Card className="flex flex-col gap-3 p-4">
        {item.handle ? (
          <NextLink href={props.profileHref(item.handle)} className="flex min-h-11 min-w-0 items-center gap-3 rounded-md focus-visible:shadow-focus">
            {identity}
          </NextLink>
        ) : (
          <div className="flex min-h-11 min-w-0 items-center gap-3">{identity}</div>
        )}
        {props.kind === "received" ? (
          <>
            {item.message ? <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.message}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || !props.canRespond} onClick={() => void respond(true)}>{labels.accept}</Button>
              <Button variant="outline" disabled={busy || !props.canRespond} onClick={() => void respond(false)}>{labels.decline}</Button>
            </div>
          </>
        ) : null}
      </Card>
    </li>
  )
}
