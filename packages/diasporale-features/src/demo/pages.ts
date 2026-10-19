"use client"

/**
 * Démonstration de la capacité « pages » (DG-007). PROPRIÉTAIRE : chantier « pages ».
 *
 * - Fiche, annuaire et listes du hub : les pages FICTIVES du jeu (`state.ts`),
 *   projetées par les sélecteurs (`selectors.ts`). L'identité, la confiance et
 *   le rôle VIVANT du lecteur viennent de la démonstration de la gestion des
 *   pages (`demoManagedPage`, DG-008) : une seule définition de ces règles.
 * - Abonnements : un état PROPRE à cette capacité, posé à côté du magasin (une
 *   instance par magasin), persisté dans ce seul navigateur AVEC la
 *   démonstration et remis à zéro avec elle.
 *
 * Mêmes refus, dans le même ordre, que le moteur : session → adhésion → statut
 * (suivre exige `declaree`, comme les écritures du moteur ; ne plus suivre se
 * fait aussi en attente) → page lisible. Les identités créées ou modifiées
 * dans la gestion des pages sont relues sans recopier leurs droits.
 */
import { hasCapability, type CountryCode, type MembershipStatus } from "@diasporale/domain"
import { useMemo, useSyncExternalStore } from "react"

import type { ActionErrorCode } from "../data/errors"
import {
  PAGE_DIRECTORY_PAGE_SIZE,
  normalizePageDirectoryCategories,
  type HubPagesQuery,
  type PageDetailQuery,
  type PageDirectoryQuery,
  type PageDirectoryRequest,
  type PageFollowState,
  type PagesCapability,
} from "../data/pages-port"
import type { ActionResult } from "../data/port"
import type { PageView } from "../data/types"
import { demoManagedPage, demoPageAdminContext } from "./page-admin"
import { findDemoPage, followedPageEntries, hubPagesView, pageDetailView, pageDirectoryEntries, pageFollowKey, statusOf, withDemoPageContext, type DemoPageContext, type DemoPageStanding } from "./selectors"
import type { DemoState } from "./state"
import { DEMO_STORAGE_KEY, type DemoStore } from "./store"

export const DEMO_PAGE_FOLLOWS_STORAGE_KEY = "diasporale:demonstration:pages:v1"
const FOLLOWS_VERSION = 1
const DIRECTORY_CURSOR_TAG = "demo-pages"
const FOLLOWED_CURSOR_TAG = "demo-page-follows"
const LOADING = { status: "loading" } as const

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

interface PersistedFollows {
  readonly version: number
  /** L'instant du jeu fictif auquel ces abonnements se rapportent : une remise à zéro le change. */
  readonly seedCreatedAt: number
  readonly follows: readonly string[]
}

function isPersisted(value: unknown, seedCreatedAt: number): value is PersistedFollows {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<PersistedFollows>
  return candidate.version === FOLLOWS_VERSION && candidate.seedCreatedAt === seedCreatedAt
    && Array.isArray(candidate.follows) && candidate.follows.every((key) => typeof key === "string")
}

/** Les abonnements locaux aux pages, à côté d'UN magasin ; ils suivent ses remises à zéro. */
class DemoPageFollows {
  private follows: ReadonlySet<string>
  private seedCreatedAt: number
  private version = 0
  private readonly listeners = new Set<() => void>()

  constructor(
    private readonly store: DemoStore,
    private readonly storage: StorageLike | null,
  ) {
    this.seedCreatedAt = store.getState().createdAt
    this.follows = this.load()
    store.subscribe(() => this.followSeed())
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getVersion = (): number => this.version

  current(): ReadonlySet<string> {
    return this.follows
  }

  /** Pose ou retire un abonnement ; sans changement, rien n'est écrit (idempotent). */
  set(personId: string, pageId: string, following: boolean): void {
    const key = pageFollowKey(personId, pageId)
    if (this.follows.has(key) === following) return
    const next = new Set(this.follows)
    if (following) next.add(key)
    else next.delete(key)
    this.commit(next)
  }

  private commit(next: ReadonlySet<string>): void {
    this.follows = next
    this.version += 1
    try {
      if (this.demoPersists()) {
        const persisted: PersistedFollows = { version: FOLLOWS_VERSION, seedCreatedAt: this.seedCreatedAt, follows: [...next] }
        this.storage?.setItem(DEMO_PAGE_FOLLOWS_STORAGE_KEY, JSON.stringify(persisted))
      }
    } catch {
      // Stockage plein ou interdit : la démonstration continue en mémoire.
    }
    for (const listener of this.listeners) listener()
  }

  /** Ces abonnements persistent AVEC la démonstration : un magasin tenu en mémoire seule (rendu serveur, tests) n'écrit rien ici. */
  private demoPersists(): boolean {
    return this.storage !== null && this.storage.getItem(DEMO_STORAGE_KEY) !== null
  }

  /** Une remise à zéro de la démonstration change le jeu fictif : les abonnements repartent avec lui. */
  private followSeed(): void {
    const seed = this.store.getState().createdAt
    if (seed === this.seedCreatedAt) return
    this.seedCreatedAt = seed
    this.commit(new Set())
  }

  private load(): ReadonlySet<string> {
    try {
      const raw = this.demoPersists() ? this.storage?.getItem(DEMO_PAGE_FOLLOWS_STORAGE_KEY) : null
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (isPersisted(parsed, this.seedCreatedAt)) return new Set(parsed.follows)
      }
    } catch {
      // Stockage illisible ou bloqué : aucun abonnement.
    }
    return new Set()
  }
}

const FOLLOWS = new WeakMap<DemoStore, DemoPageFollows>()

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

function followsOf(store: DemoStore, storage?: StorageLike | null): DemoPageFollows {
  let follows = FOLLOWS.get(store)
  if (!follows) {
    follows = new DemoPageFollows(store, storage === undefined ? defaultStorage() : storage)
    FOLLOWS.set(store, follows)
  }
  return follows
}

// ═══════════════════════════════════════════════════════════════
// Règles — les mêmes que le moteur
// ═══════════════════════════════════════════════════════════════

interface Viewer {
  readonly id: string
  readonly status: MembershipStatus
}

/** Le lecteur de DIASPORALE, ou le refus d'une lecture de membre (même ordre que le moteur). */
function viewerOf(state: DemoState, now: number): Viewer | ActionErrorCode {
  const id = state.session.personId
  if (!id || !state.persons[id]) return "not_signed_in"
  const membership = state.memberships[id]
  if (!membership) return "not_member"
  const status = statusOf(state, id, now)
  if (status === null || status === "partie") return "not_member"
  if (!hasCapability(status, "read_network", { suspensionReadAccess: membership.grounds.suspension?.readAccess ?? "none" })) {
    return status === "suspendue" ? "suspended" : "not_member"
  }
  return { id, status }
}

/**
 * L'identité, la confiance et le rôle vivant d'une page fictive, lus par la
 * démonstration de la gestion des pages. Revendicable pour CE lecteur, comme le
 * moteur : confiance « communauté », pas une institution, et soit aucun
 * administrateur dans l'équipe fictive, soit le lecteur l'administre (demande de
 * vérification).
 */
function standingFor(store: DemoStore): DemoPageStanding {
  return (page, base) => {
    const managed = demoManagedPage(store, page.handle)
    const trust = managed?.badge ?? base.trust
    const role = managed?.myRole ?? null
    const administered = demoPageAdminContext(store).hasLiveAdmin(page.id)
    const { associationType: baseAssociationType, sector: baseSector, ...baseIdentity } = base
    const associationType = managed?.associationType === undefined ? baseAssociationType : managed.associationType
    const sector = managed?.sector === undefined ? baseSector : managed.sector
    const view: PageView = {
      ...baseIdentity,
      ...(managed ? { name: managed.name, shortName: managed.shortName, description: managed.description ?? "", country: managed.country, city: managed.city === undefined ? base.city : managed.city } : {}),
      ...(associationType != null ? { associationType } : {}),
      ...(sector != null ? { sector } : {}),
      trust,
      badge: trust,
      claimable: trust === "community" && base.ownerKind !== "institution" && (role === "admin" || !administered),
    }
    return { view, role }
  }
}

function contextOf(store: DemoStore, follows: DemoPageFollows): DemoPageContext {
  const admin = demoPageAdminContext(store)
  return {
    follows: follows.current(),
    standing: standingFor(store),
    isSignatory: admin.isSignatory,
    isFollowing: (pageId, personId) => follows.current().has(pageFollowKey(personId, pageId)),
  }
}

/**
 * Le lecteur commun aux fiches et aux murs : les pages créées restent dans
 * leur surcouche persistée, l'état lu les projette avec leurs droits vivants.
 * Aucune identité de page ne devient une autorité personnelle.
 */
export function demoPageReader(store: DemoStore, storage?: StorageLike | null) {
  const follows = followsOf(store, storage)
  const admin = demoPageAdminContext(store)
  // Lecture stable : tant que l'état, les abonnements et la surcouche des pages ne changent pas,
  // `getState()` rend le MÊME objet (les sélecteurs mémorisés et les refus sans effet s'y fient).
  let projection: { readonly state: DemoState; readonly key: string; readonly projected: DemoState } | null = null
  store.setPageReadingProjection((state) => {
    const key = `${follows.getVersion()}:${admin.getVersion()}`
    if (projection !== null && projection.state === state && projection.key === key) return projection.projected
    const projected = withDemoPageContext(state, { ...contextOf(store, follows), pages: admin.pagesOf(state) })
    projection = { state, key, projected }
    return projected
  })
  return {
    subscribe(listener: () => void): () => void {
      const subscriptions = [store.subscribe(listener), follows.subscribe(listener), admin.subscribe(listener)]
      return () => subscriptions.forEach((unsubscribe) => unsubscribe())
    },
    getVersion: () => `${store.getVersion()}:${follows.getVersion()}:${admin.getVersion()}`,
    context: () => contextOf(store, follows),
  }
}

/** Le curseur d'une recherche : il ne vaut que pour ses filtres, son lecteur et ce jeu fictif. */
function directorySignature(args: Omit<PageDirectoryRequest, "cursor">, viewerId: string, seedCreatedAt: number): string {
  return JSON.stringify([viewerId, seedCreatedAt, args.query.trim().toLowerCase(), args.country ?? null, args.ownerKind ?? null, args.associationType ?? null, args.sector ?? null])
}

function decodeOffset(cursor: string | null, signature: string, tag = DIRECTORY_CURSOR_TAG): number | null {
  if (cursor === null) return 0
  try {
    if (cursor.length > 1024) return null
    const parsed: unknown = JSON.parse(cursor)
    if (!Array.isArray(parsed) || parsed.length !== 3 || parsed[0] !== tag || parsed[1] !== signature) return null
    const offset: unknown = parsed[2]
    return typeof offset === "number" && Number.isInteger(offset) && offset >= 0 ? offset : null
  } catch {
    return null
  }
}

// ═══════════════════════════════════════════════════════════════
// Vues — pures, testables sans React
// ═══════════════════════════════════════════════════════════════

export function demoPageDetail(state: DemoState, handle: string, context: DemoPageContext, now: number): PageDetailQuery {
  const viewer = viewerOf(state, now)
  if (typeof viewer === "string") return { status: "error", code: viewer }
  return { status: "ready", data: pageDetailView(state, handle, viewer.id, now, context) }
}

export function demoPageDirectory(state: DemoState, args: PageDirectoryRequest, context: DemoPageContext, now: number): PageDirectoryQuery {
  const viewer = viewerOf(state, now)
  if (typeof viewer === "string") return { status: "error", code: viewer }
  const categories = normalizePageDirectoryCategories(args)
  if (!categories.ok) return { status: "error", code: categories.code }
  const filters = { query: args.query, ...(args.country !== undefined ? { country: args.country } : {}), ...categories.value }
  const signature = directorySignature(filters, viewer.id, state.createdAt)
  const offset = decodeOffset(args.cursor, signature)
  if (offset === null) return { status: "error", code: "unknown" }
  const entries = pageDirectoryEntries(state, viewer.id, filters, context)
  const next = offset + PAGE_DIRECTORY_PAGE_SIZE
  const isDone = next >= entries.length
  return {
    status: "ready",
    data: {
      items: entries.slice(offset, next),
      isDone,
      continueCursor: isDone ? null : JSON.stringify([DIRECTORY_CURSOR_TAG, signature, next]),
    },
  }
}

/** Mes abonnements seulement, par fenêtres de vingt ; un curseur ne change ni de lecteur ni de liste. */
export function demoFollowedPages(state: DemoState, args: { readonly cursor: string | null }, context: DemoPageContext, now: number): PageDirectoryQuery {
  const viewer = viewerOf(state, now)
  if (typeof viewer === "string") return { status: "error", code: viewer }
  const signature = JSON.stringify([viewer.id, state.createdAt])
  const offset = decodeOffset(args.cursor, signature, FOLLOWED_CURSOR_TAG)
  if (offset === null) return { status: "error", code: "unknown" }
  const entries = followedPageEntries(state, viewer.id, context)
  const next = offset + PAGE_DIRECTORY_PAGE_SIZE
  const isDone = next >= entries.length
  return {
    status: "ready",
    data: {
      items: entries.slice(offset, next),
      isDone,
      continueCursor: isDone ? null : JSON.stringify([FOLLOWED_CURSOR_TAG, signature, next]),
    },
  }
}

export function demoHubPages(state: DemoState, country: CountryCode, context: DemoPageContext, now: number): HubPagesQuery {
  const viewer = viewerOf(state, now)
  if (typeof viewer === "string") return { status: "error", code: viewer }
  return { status: "ready", data: hubPagesView(state, country, context) }
}

// ═══════════════════════════════════════════════════════════════
// La capacité
// ═══════════════════════════════════════════════════════════════

const fail = (code: ActionErrorCode): ActionResult<never> => ({ ok: false, code })

export function createDemoPages(store: DemoStore, options: { readonly storage?: StorageLike | null } = {}): PagesCapability {
  const follows = followsOf(store, options.storage)
  const reader = demoPageReader(store, options.storage)
  const useVersions = () => useSyncExternalStore(reader.subscribe, reader.getVersion, () => null)

  /** Suivre ou ne plus suivre : le lecteur, son statut, puis une page lisible d'ici. */
  async function setFollowing(handle: string, following: boolean): Promise<ActionResult<PageFollowState>> {
    const state = store.getState()
    const viewer = viewerOf(state, store.now())
    if (typeof viewer === "string") return fail(viewer)
    if (following && !hasCapability(viewer.status, "publish")) return fail(viewer.status === "suspendue" ? "suspended" : "status_insufficient")
    const page = findDemoPage(state, handle)
    if (!page) return fail("not_found")
    follows.set(viewer.id, page.id, following)
    return { ok: true, value: { following } }
  }

  return {
    supportsDirectoryCategories: true,
    usePage(handle) {
      const version = useVersions()
      return useMemo(() => (version === null ? LOADING : demoPageDetail(store.getState(), handle, contextOf(store, follows), store.now())), [version, handle])
    },
    useDirectory({ query, country, ownerKind, associationType, sector, cursor }) {
      const version = useVersions()
      return useMemo(
        () => (version === null ? LOADING : demoPageDirectory(store.getState(), { query, cursor, ...(country !== undefined ? { country } : {}), ...(ownerKind !== undefined ? { ownerKind } : {}), ...(associationType !== undefined ? { associationType } : {}), ...(sector !== undefined ? { sector } : {}) }, contextOf(store, follows), store.now())),
        [version, query, country, ownerKind, associationType, sector, cursor],
      )
    },
    useFollowedPages({ cursor }) {
      const version = useVersions()
      return useMemo(
        () => (version === null ? LOADING : demoFollowedPages(store.getState(), { cursor }, contextOf(store, follows), store.now())),
        [version, cursor],
      )
    },
    useHubPages(country) {
      const version = useVersions()
      return useMemo(() => (version === null ? LOADING : demoHubPages(store.getState(), country, contextOf(store, follows), store.now())), [version, country])
    },
    follow: (handle) => setFollowing(handle, true),
    unfollow: (handle) => setFollowing(handle, false),
  }
}
