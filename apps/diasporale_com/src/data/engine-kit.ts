"use client"

/**
 * Les briques communes des adaptateurs « moteur » de DIASPORALE, extraites de
 * `engine-source.ts` pour que chaque capacité (pages, services, droits…) vive
 * dans son propre fichier sans recopier les gardes de lecture :
 *
 * - `useLoaded` : une query du moteur dont l'erreur se LIT (code fermé) ;
 * - `useNetworkId` / `useEngineMember` : le réseau `diasporale`, la session et
 *   l'adhésion du lecteur, résolus une fois par rendu ;
 * - `memberReadError` : le refus standard d'une lecture de membre, dans le même
 *   ordre que les lectures historiques (session, réseau, adhésion, capacité) ;
 * - `useReadablePostsQuery` : un refus retire le cache d'une lecture paginée ;
 * - `Refusal`, `attemptAction`, `resolveDiasporaleNetworkId` : les écritures
 *   rendent un résultat à code fermé, jamais une exception jusqu'à l'écran.
 */
import type { EngineAuthClient } from "@antsia/api/auth-client"
import { useStableConvexAuth } from "@antsia/api/hooks"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { DIASPORALE_NETWORK_SLUG } from "@diasporale/domain"
import type { ActionErrorCode, ActionResult, Loadable } from "@diasporale/features/data"
import { type ConvexReactClient, type RequestForQueries, useQueries } from "convex/react"
import { type FunctionArgs, type FunctionReference, type FunctionReturnType, getFunctionName, makeFunctionReference } from "convex/server"
import { convexToJson, jsonToConvex, type Value } from "convex/values"
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"

import { engineActionErrorCode } from "./engine-errors"

export const PAGE_ACCESS_ERRORS: ReadonlySet<ActionErrorCode> = new Set(["not_signed_in", "not_member", "not_found", "status_insufficient", "suspended", "network_unavailable"])

export interface ReadablePostsQuery<Data> {
  readonly data: Data | undefined
  readonly isError: boolean
  readonly isSuccess: boolean
  readonly isFetching: boolean
  readonly dataUpdatedAt: number
  readonly refetch: () => Promise<Pick<ReadablePostsQuery<Data>, "data" | "isError" | "isSuccess" | "isFetching" | "dataUpdatedAt">>
}

/** Un refus retire le cache ; seule une réponse fraîche peut rouvrir cette même lecture. */
export function useReadablePostsQuery<Data>(query: ReadablePostsQuery<Data>, requestKey: string, canRead: boolean, error: ActionErrorCode | null) {
  const generation = useMemo(() => ({ requestKey, canRead }), [requestKey, canRead])
  const activeGeneration = useRef<typeof generation | null>(null)
  useLayoutEffect(() => {
    activeGeneration.current = generation
    return () => { if (activeGeneration.current === generation) activeGeneration.current = null }
  }, [generation])
  const [denial, setDenial] = useState<{ key: string; code: ActionErrorCode; dataUpdatedAt: number } | null>(null)
  const [readback, setReadback] = useState<{ generation: typeof generation; data: Data; dataUpdatedAt: number } | null>(null)
  const denied = error !== null && PAGE_ACCESS_ERRORS.has(error)
  const blocked = denial?.key === requestKey ? denial : null
  const settled = canRead && query.isSuccess && !query.isError && !query.isFetching && query.data !== undefined
  const fresh = settled && blocked !== null && (query.dataUpdatedAt > blocked.dataUpdatedAt
    || (readback?.generation === generation && readback.data === query.data && readback.dataUpdatedAt === query.dataUpdatedAt))

  useLayoutEffect(() => {
    if (denied && error !== null) {
      const code = error
      setDenial((previous) => previous?.key === requestKey && previous.code === code && previous.dataUpdatedAt === query.dataUpdatedAt
        ? previous : { key: requestKey, code, dataUpdatedAt: query.dataUpdatedAt })
      setReadback(null)
    } else if (fresh || (denial !== null && denial.key !== requestKey)) setDenial(null)
  }, [denied, error, requestKey, query.dataUpdatedAt, fresh, denial])

  const refetch = query.refetch
  const retry = useCallback(() => {
    if (!canRead || activeGeneration.current !== generation) return
    void refetch().then((result) => {
      if (activeGeneration.current !== generation || !result.isSuccess || result.isError || result.isFetching || result.data === undefined) return
      setReadback({ generation, data: result.data, dataUpdatedAt: result.dataUpdatedAt })
    }).catch(() => undefined)
  }, [canRead, generation, refetch])

  if (denied || (blocked !== null && !fresh)) return { data: undefined, isLoading: query.isFetching === true, error: denied ? error : blocked!.code, retry }
  if (!canRead) return { data: undefined, isLoading: error === null, error, retry }
  return { data: query.data, isLoading: query.data === undefined && !query.isError, error, retry }
}

export const LOADING = { status: "loading" } as const

export function ready<T>(data: T): Loadable<T> {
  return { status: "ready", data }
}

export function failed<T>(code: ActionErrorCode): Loadable<T> {
  return { status: "error", code }
}

export type Loaded<T> = { readonly state: "loading" } | { readonly state: "error"; readonly code: ActionErrorCode } | { readonly state: "ready"; readonly value: T }

/**
 * Une query du moteur dont l'erreur se LIT (`useQueries` la rend au lieu de la
 * lever) : un refus du serveur devient un code fermé, pas un écran d'erreur.
 *
 * L'objet de requêtes est MÉMORISÉ sur une clé stable (nom de la fonction et
 * arguments sérialisés), comme le fait le `useQuery` de Convex : un objet neuf à
 * chaque rendu relancerait l'abonnement à chaque rendu, sans fin.
 */
export function useLoaded<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query> | "skip",
): Loaded<FunctionReturnType<Query>> {
  const name = getFunctionName(query)
  const argsKey = args === "skip" ? null : JSON.stringify(convexToJson(args as Value))
  const queries = useMemo(() => {
    const request: RequestForQueries = {}
    if (argsKey !== null) {
      request.value = { query: makeFunctionReference<"query">(name), args: jsonToConvex(JSON.parse(argsKey) as never) as Record<string, Value> }
    }
    return request
  }, [name, argsKey])
  const results = useQueries(queries) as Record<string, unknown>
  if (argsKey === null) return { state: "loading" }
  const value = results.value
  if (value === undefined) return { state: "loading" }
  if (value instanceof Error) return { state: "error", code: engineActionErrorCode(value) }
  return { state: "ready", value: value as FunctionReturnType<Query> }
}

/** Le réseau `diasporale`, résolu par son identifiant public (projection publique du moteur). */
export function useNetworkId(): Loaded<Id<"networks"> | null> {
  const network = useLoaded(api.modules.networks.networks.getBySlug, { slug: DIASPORALE_NETWORK_SLUG })
  if (network.state !== "ready") return network
  return { state: "ready", value: network.value?._id ?? null }
}

export interface EngineSourceDeps {
  readonly convex: ConvexReactClient
  readonly authClient: EngineAuthClient
  /** Attente entre deux lectures de l'issue d'une attestation (remplaçable dans les tests). */
  readonly sleep?: (ms: number) => Promise<void>
}

export class Refusal extends Error {
  constructor(readonly code: ActionErrorCode) {
    super(code)
  }
}

/** La session, le réseau `diasporale` et l'adhésion du lecteur (lecture réactive du moteur). */
export function useEngineMember() {
  const auth = useStableConvexAuth()
  const networkId = useNetworkId()
  const id = networkId.state === "ready" ? networkId.value : null
  const membership = useLoaded(api.modules.diaspora.membership.myMembership, auth.isAuthenticated && id ? { networkId: id } : "skip")
  return { auth, networkId, membership }
}

export type EngineMember = ReturnType<typeof useEngineMember>

/**
 * Le refus standard d'une lecture réservée aux membres qui lisent le réseau —
 * même ordre que les lectures historiques du fil et des signets. `null` : rien
 * n'empêche la lecture (ou l'état n'est pas encore connu).
 */
export function memberReadError(member: EngineMember, capability: "read_network" | "publish" | "view_directory" = "read_network"): ActionErrorCode | null {
  const { auth, networkId, membership } = member
  const id = networkId.state === "ready" ? networkId.value : null
  const row = membership.state === "ready" ? membership.value : null
  if (auth.isUnauthenticated) return "not_signed_in"
  if (networkId.state === "error") return networkId.code
  if (membership.state === "error") return membership.code
  if (networkId.state === "ready" && id === null) return "network_unavailable"
  if (membership.state === "ready" && !row) return "not_member"
  if (row && !row.capabilities.includes("read_network")) return row.status === "suspendue" ? "suspended" : "not_member"
  if (row && capability !== "read_network" && !row.capabilities.includes(capability)) return "status_insufficient"
  return null
}

/** Le réseau `diasporale` pour une écriture (une lecture ponctuelle, sans abonnement). */
export async function resolveDiasporaleNetworkId(convex: ConvexReactClient): Promise<Id<"networks">> {
  const network = await convex.query(api.modules.networks.networks.getBySlug, { slug: DIASPORALE_NETWORK_SLUG })
  if (!network) throw new Refusal("network_unavailable")
  return network._id
}

/** Une écriture rend un résultat à code fermé, jamais une exception jusqu'à l'écran. */
export async function attemptAction<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, value: await work() }
  } catch (error) {
    return { ok: false, code: error instanceof Refusal ? error.code : engineActionErrorCode(error) }
  }
}
