/**
 * Démonstration de la capacité « gestion des pages » (DG-008). PROPRIÉTAIRE :
 * chantier « gestion des pages ».
 *
 * Le jeu fictif (`state.ts`) ne connaît ni signataires ni revendications : ils
 * vivent dans un état PROPRE à cette capacité, posé à côté du magasin (une
 * instance par magasin), persisté dans ce seul navigateur et remis à zéro avec
 * la démonstration. Les pages du jeu fictif sont lues sans être modifiées ;
 * les pages créées ici, les identités modifiées et les vérifications validées
 * sont des surcouches de cet état.
 *
 * Mêmes règles que le moteur, dans le même ordre : session → adhésion →
 * statut (créer exige `verifiee`, revendiquer `declaree`) → droit sur la page
 * (rôle VIVANT relu à chaque geste). Aucune pièce n'est gardée : la
 * démonstration ne conserve que le type et le poids des fichiers choisis.
 */
import { isProfilePublished } from "@antsia/social-domain/content"
import { normalizePageAssociationType, normalizePageCity, normalizePageSector } from "@antsia/social-domain/pagePresentation"
import { hasCapability, isCountryCode, type CountryCode, type MembershipStatus, type PageTrustLevel } from "@diasporale/domain"
import { useMemo, useSyncExternalStore } from "react"

import type { ActionErrorCode } from "../data/errors"
import {
  isMemberPageKind,
  pageClaimNoteRefusal,
  pageDecisionReasonRefusal,
  pageDescriptionRefusal,
  pageEvidenceSetRefusal,
  pageHandleFor,
  pageHandleRefusal,
  pageNameRefusal,
  pageShortNameRefusal,
  PAGE_SIGNATORIES_MAX,
  type ManagedPageDetailView,
  type ManagedPageRole,
  type ManagedPageView,
  type MemberPageKind,
  type PageAdminCapability,
  type PageClaimDetailView,
  type PageClaimQueueView,
  type PageClaimStatus,
  type PageClaimView,
  type PageInvitationView,
  type PageManagement,
  type PageRefView,
  type PageSignatoryView,
} from "../data/page-admin-port"
import { pageAssociationTypeRefusal, pageCityRefusal, pageSectorRefusal } from "../data/page-presentation"
import type { ActionResult } from "../data/port"
import type { AssociationType, CompanySector, Loadable } from "../data/types"
import { normalizeHandle } from "../lib/handle"
import { pageView, statusOf } from "./selectors"
import type { DemoPage, DemoState } from "./state"
import { DEMO_STORAGE_KEY, type DemoStore } from "./store"

export const DEMO_PAGE_ADMIN_STORAGE_KEY = "diasporale:demonstration:page-admin:v1"
const OVERLAY_VERSION = 1
const DAY = 24 * 60 * 60 * 1000
const CLAIM_QUEUE_PAGE = 20
const MY_CLAIMS_MAX = 50
const CURSOR_TAG = "demo-page-claims"

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

interface DemoSignatory {
  readonly pageId: string
  readonly personId: string
  readonly role: ManagedPageRole
  /** `null` : invitation en attente, qui ne donne aucun droit. */
  readonly acceptedAt: number | null
  readonly createdAt: number
}

interface DemoClaim {
  readonly id: string
  readonly pageId: string
  readonly claimantId: string
  readonly note: string | null
  /** Ni contenu ni nom de fichier : le type et le poids seulement. */
  readonly evidence: readonly { readonly mimeType: string; readonly sizeBytes: number }[]
  readonly status: PageClaimStatus
  readonly decisionReason: string | null
  readonly createdAt: number
  readonly decidedAt: number | null
}

interface DemoCreatedPage {
  readonly id: string
  readonly handle: string
  readonly name: string
  readonly shortName: string | null
  readonly description: string | null
  readonly ownerKind: MemberPageKind
  readonly country: CountryCode
  readonly city?: string | null
  readonly associationType?: AssociationType | null
  readonly sector?: CompanySector | null
  readonly createdById: string
  readonly createdAt: number
}

interface DemoIdentity {
  readonly name?: string
  readonly shortName?: string | null
  readonly description?: string | null
  readonly country?: CountryCode | null
  readonly city?: string | null
  readonly associationType?: AssociationType | null
  readonly sector?: CompanySector | null
}

export interface DemoPageAdminState {
  readonly version: number
  /** L'instant du jeu fictif auquel cet état se rapporte : une remise à zéro le change. */
  readonly seedCreatedAt: number
  readonly sequence: number
  readonly signatories: readonly DemoSignatory[]
  readonly claims: readonly DemoClaim[]
  readonly created: readonly DemoCreatedPage[]
  readonly identity: Readonly<Record<string, DemoIdentity>>
  /** Pages devenues « Vérifié » par une revendication validée (jamais « Officiel »). */
  readonly verified: readonly string[]
  /** Qui instruit les revendications au nom de la modération du réseau (démonstration seulement). */
  readonly reviewers: readonly string[]
}

/**
 * L'équipe fictive des pages du jeu : Mireille gère le traiteur parisien et
 * instruit les revendications ; Steeve administre l'association lyonnaise et y
 * a invité Mireille ; l'entreprise bruxelloise a déjà son administratrice (elle
 * ne se revendique donc pas). Les associations de Bordeaux et de Montréal
 * restent sans administrateur : revendicables.
 */
export function seedPageAdmin(state: DemoState): DemoPageAdminState {
  const at = state.createdAt
  const signatories: DemoSignatory[] = []
  const add = (pageId: string, personId: string, role: ManagedPageRole, acceptedAgoDays: number | null, createdAgoDays: number) => {
    if (!state.pages[pageId] || !state.persons[personId]) return
    signatories.push({ pageId, personId, role, acceptedAt: acceptedAgoDays === null ? null : at - acceptedAgoDays * DAY, createdAt: at - createdAgoDays * DAY })
  }
  add("page-saveurs", "p-mireille", "admin", 200, 200)
  add("page-asso-lyon", "p-steeve", "admin", 60, 60)
  add("page-asso-lyon", "p-mireille", "signatory", null, 2)
  add("page-valise", "p-nadia", "admin", 250, 250)
  return {
    version: OVERLAY_VERSION,
    seedCreatedAt: at,
    sequence: 1,
    signatories,
    claims: [],
    created: [],
    identity: {},
    verified: [],
    reviewers: state.persons["p-mireille"] ? ["p-mireille"] : [],
  }
}

function isOverlay(value: unknown, seedCreatedAt: number): value is DemoPageAdminState {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<DemoPageAdminState>
  return candidate.version === OVERLAY_VERSION && candidate.seedCreatedAt === seedCreatedAt && typeof candidate.sequence === "number"
    && Array.isArray(candidate.signatories) && Array.isArray(candidate.claims) && Array.isArray(candidate.created)
    && Array.isArray(candidate.verified) && Array.isArray(candidate.reviewers) && typeof candidate.identity === "object" && candidate.identity !== null
}

/** L'état propre à la capacité, à côté d'UN magasin ; il suit ses remises à zéro. */
class DemoPageAdminOverlay {
  private state: DemoPageAdminState
  private version = 0
  private readonly listeners = new Set<() => void>()

  constructor(
    readonly store: DemoStore,
    private readonly storage: StorageLike | null,
  ) {
    this.state = this.load()
    store.subscribe(() => this.followSeed())
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getVersion = (): number => this.version

  current(): DemoPageAdminState {
    return this.state
  }

  commit(next: DemoPageAdminState): void {
    this.state = next
    this.version += 1
    try {
      if (this.demoPersists()) this.storage?.setItem(DEMO_PAGE_ADMIN_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Stockage plein ou interdit : la démonstration continue en mémoire.
    }
    for (const listener of this.listeners) listener()
  }

  /** Cet état persiste AVEC la démonstration : un magasin tenu en mémoire seule (rendu serveur, tests) n'écrit rien ici. */
  private demoPersists(): boolean {
    return this.storage !== null && this.storage.getItem(DEMO_STORAGE_KEY) !== null
  }

  /** Une remise à zéro de la démonstration change le jeu fictif : l'état de la capacité repart avec lui. */
  private followSeed(): void {
    const seed = this.store.getState()
    if (seed.createdAt !== this.state.seedCreatedAt) this.commit(seedPageAdmin(seed))
  }

  private load(): DemoPageAdminState {
    const seed = this.store.getState()
    try {
      const raw = this.demoPersists() ? this.storage?.getItem(DEMO_PAGE_ADMIN_STORAGE_KEY) : null
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (isOverlay(parsed, seed.createdAt)) return parsed
      }
    } catch {
      // Stockage illisible ou bloqué : on repart de l'équipe fictive.
    }
    return seedPageAdmin(seed)
  }
}

const OVERLAYS = new WeakMap<DemoStore, DemoPageAdminOverlay>()

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

function overlayOf(store: DemoStore, storage?: StorageLike | null): DemoPageAdminOverlay {
  let overlay = OVERLAYS.get(store)
  if (!overlay) {
    overlay = new DemoPageAdminOverlay(store, storage === undefined ? defaultStorage() : storage)
    OVERLAYS.set(store, overlay)
  }
  return overlay
}

// ═══════════════════════════════════════════════════════════════
// Règles — les mêmes que le moteur
// ═══════════════════════════════════════════════════════════════

const STATUS_RANK: Readonly<Record<MembershipStatus, number>> = { partie: -1, suspendue: -1, en_attente: 0, declaree: 1, verifiee: 2 }

interface Viewer {
  readonly id: string
  readonly status: MembershipStatus
}

/** Le lecteur de DIASPORALE, ou le refus d'une lecture de membre (même ordre que le moteur). */
function readerOf(state: DemoState, now: number): Viewer | ActionErrorCode {
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

/** Un auteur d'écriture : lecteur actif, non suspendu, au statut demandé. */
function writerOf(state: DemoState, now: number, minStatus: "en_attente" | "declaree" | "verifiee"): Viewer | ActionErrorCode {
  const reader = readerOf(state, now)
  if (typeof reader === "string") return reader
  if (reader.status === "suspendue") return "suspended"
  if (STATUS_RANK[reader.status] < STATUS_RANK[minStatus]) return "status_insufficient"
  return reader
}

function isActiveMember(state: DemoState, personId: string, now: number): boolean {
  const status = statusOf(state, personId, now)
  return status === "en_attente" || status === "declaree" || status === "verifiee"
}

/** Une page OFFICIELLE ne se signe qu'avec une identité forte (IDN niveau 2 au moins). */
function hasStrongIdentity(state: DemoState, personId: string): boolean {
  return (state.persons[personId]?.idn?.loa ?? 0) >= 2
}

interface ResolvedPage extends PageRefView {
  readonly shortName: string | null
  readonly description: string | null
  readonly city: string | null
  readonly associationType: AssociationType | null
  readonly sector: CompanySector | null
}

function resolvedPages(state: DemoState, overlay: DemoPageAdminState): ResolvedPage[] {
  const createdIds = new Set(overlay.created.map((page) => page.id))
  const seeded = Object.values(state.pages).filter((page) => !createdIds.has(page.id)).map((page): ResolvedPage => {
    const view = pageView(page)
    return {
      id: page.id,
      handle: page.handle,
      name: page.name,
      ownerKind: page.ownerKind,
      badge: view.trust,
      country: page.country,
      shortName: null,
      description: page.description,
      city: page.city,
      associationType: page.associationType ?? null,
      sector: page.sector ?? null,
    }
  })
  const created = overlay.created.map((page): ResolvedPage => ({
    id: page.id,
    handle: page.handle,
    name: page.name,
    ownerKind: page.ownerKind,
    badge: "community",
    country: page.country,
    shortName: page.shortName,
    description: page.description,
    city: page.city ?? null,
    associationType: page.associationType ?? null,
    sector: page.sector ?? null,
  }))
  return [...seeded, ...created].map((page) => {
    const identity = overlay.identity[page.id] ?? {}
    // La confiance ne se déclare pas : seule une revendication validée fait « Vérifié », jamais « Officiel ».
    const badge: PageTrustLevel = page.badge === "official" ? "official" : overlay.verified.includes(page.id) ? "verified" : page.badge
    return {
      ...page,
      ...(identity.name !== undefined ? { name: identity.name } : {}),
      ...(identity.shortName !== undefined ? { shortName: identity.shortName } : {}),
      ...(identity.description !== undefined ? { description: identity.description } : {}),
      ...(identity.country !== undefined ? { country: identity.country } : {}),
      ...(identity.city !== undefined ? { city: identity.city } : {}),
      ...(identity.associationType !== undefined ? { associationType: identity.associationType } : {}),
      ...(identity.sector !== undefined ? { sector: identity.sector } : {}),
      badge,
    }
  })
}

function pageById(state: DemoState, overlay: DemoPageAdminState, pageId: string): ResolvedPage | null {
  return resolvedPages(state, overlay).find((page) => page.id === pageId) ?? null
}

function pageByHandle(state: DemoState, overlay: DemoPageAdminState, rawHandle: string): ResolvedPage | null {
  const handle = pageHandleFor({ name: rawHandle })
  return resolvedPages(state, overlay).find((page) => page.handle === handle) ?? null
}

function refOf(page: ResolvedPage): PageRefView {
  return { id: page.id, handle: page.handle, name: page.name, ownerKind: page.ownerKind, badge: page.badge, country: page.country }
}

function rowOf(overlay: DemoPageAdminState, pageId: string, personId: string): DemoSignatory | undefined {
  return overlay.signatories.find((row) => row.pageId === pageId && row.personId === personId)
}

/** Le rôle VIVANT : invitation acceptée, membre actif, identité forte pour une page officielle. */
function liveRole(state: DemoState, overlay: DemoPageAdminState, page: ResolvedPage, personId: string, now: number): ManagedPageRole | null {
  const row = rowOf(overlay, page.id, personId)
  if (!row || row.acceptedAt === null) return null
  if (!isActiveMember(state, personId, now)) return null
  if (page.badge === "official" && !hasStrongIdentity(state, personId)) return null
  return row.role
}

function liveAdminCount(state: DemoState, overlay: DemoPageAdminState, pageId: string, now: number): number {
  return overlay.signatories.filter((row) => row.pageId === pageId && row.role === "admin" && row.acceptedAt !== null && isActiveMember(state, row.personId, now)).length
}

function personLabel(state: DemoState, personId: string): { personId: string; handle: string | null; displayName: string | null } {
  const person = state.persons[personId]
  // Profil retiré ou absent : nom neutre, aucun identifiant.
  if (!person?.profile || !isProfilePublished(person)) return { personId, handle: null, displayName: null }
  return { personId, handle: person.profile.handle, displayName: person.profile.displayName }
}

function claimView(state: DemoState, overlay: DemoPageAdminState, claim: DemoClaim): PageClaimView | null {
  const page = pageById(state, overlay, claim.pageId)
  if (!page) return null
  return {
    id: claim.id,
    page: refOf(page),
    claimant: personLabel(state, claim.claimantId),
    status: claim.status,
    note: claim.note,
    evidenceCount: claim.evidence.length,
    decisionReason: claim.decisionReason,
    createdAt: claim.createdAt,
    decidedAt: claim.decidedAt,
  }
}

const isReviewer = (overlay: DemoPageAdminState, personId: string) => overlay.reviewers.includes(personId)

// ═══════════════════════════════════════════════════════════════
// Vues — pures, testables sans React
// ═══════════════════════════════════════════════════════════════

export function myPagesView(state: DemoState, overlay: DemoPageAdminState, now: number): Loadable<readonly ManagedPageView[]> {
  const viewer = readerOf(state, now)
  if (typeof viewer === "string") return { status: "error", code: viewer }
  const pages: ManagedPageView[] = []
  for (const row of overlay.signatories) {
    if (row.personId !== viewer.id || row.acceptedAt === null) continue
    const page = pageById(state, overlay, row.pageId)
    const role = page ? liveRole(state, overlay, page, viewer.id, now) : null
    if (page && role) pages.push({ id: page.id, handle: page.handle, name: page.name, ownerKind: page.ownerKind, role, badge: page.badge, country: page.country })
  }
  return { status: "ready", data: pages }
}

export function managedPageView(state: DemoState, overlay: DemoPageAdminState, handle: string, now: number): Loadable<ManagedPageDetailView | null> {
  const viewer = readerOf(state, now)
  if (typeof viewer === "string") return { status: "error", code: viewer }
  const page = pageByHandle(state, overlay, handle)
  if (!page) return { status: "ready", data: null }
  return {
    status: "ready",
    data: {
      ...refOf(page),
      shortName: page.shortName,
      description: page.description,
      city: page.city,
      associationType: page.associationType,
      sector: page.sector,
      logoUrl: null,
      bannerUrl: null,
      myRole: liveRole(state, overlay, page, viewer.id, now),
    },
  }
}

export function signatoriesView(state: DemoState, overlay: DemoPageAdminState, pageId: string, now: number): Loadable<readonly PageSignatoryView[]> {
  const viewer = readerOf(state, now)
  if (typeof viewer === "string") return { status: "error", code: viewer }
  const page = pageById(state, overlay, pageId)
  if (!page) return { status: "error", code: "not_found" }
  // Ses signataires VIVANTS seuls voient l'équipe ; un rôle retiré perd l'accès aussitôt.
  if (liveRole(state, overlay, page, viewer.id, now) === null) return { status: "error", code: "page_role_required" }
  const rows = overlay.signatories
    .filter((row) => row.pageId === pageId)
    .sort((left, right) => (left.role === right.role ? 0 : left.role === "admin" ? -1 : 1) || left.createdAt - right.createdAt)
  return {
    status: "ready",
    data: rows.map((row) => ({
      ...personLabel(state, row.personId),
      role: row.role,
      accepted: row.acceptedAt !== null,
      since: row.acceptedAt ?? row.createdAt,
      isMe: row.personId === viewer.id,
    })),
  }
}

export function invitationsView(state: DemoState, overlay: DemoPageAdminState, now: number): Loadable<readonly PageInvitationView[]> {
  const viewer = readerOf(state, now)
  if (typeof viewer === "string") return { status: "error", code: viewer }
  const out: PageInvitationView[] = []
  for (const row of overlay.signatories) {
    if (row.personId !== viewer.id || row.acceptedAt !== null) continue
    const page = pageById(state, overlay, row.pageId)
    if (page) out.push({ page: refOf(page), role: row.role, invitedAt: row.createdAt })
  }
  return { status: "ready", data: out }
}

export function myClaimsView(state: DemoState, overlay: DemoPageAdminState, now: number): Loadable<readonly PageClaimView[]> {
  const viewer = readerOf(state, now)
  if (typeof viewer === "string") return { status: "error", code: viewer }
  const claims = overlay.claims
    .filter((claim) => claim.claimantId === viewer.id)
    .sort((left, right) => right.createdAt - left.createdAt || (left.id < right.id ? 1 : -1))
    .slice(0, MY_CLAIMS_MAX)
    .flatMap((claim) => claimView(state, overlay, claim) ?? [])
  return { status: "ready", data: claims }
}

export function claimQueueView(
  state: DemoState,
  overlay: DemoPageAdminState,
  args: { readonly status: PageClaimStatus; readonly cursor: string | null },
  now: number,
): Loadable<PageClaimQueueView | null> {
  const viewer = readerOf(state, now)
  if (typeof viewer === "string") return { status: "error", code: viewer }
  if (!isReviewer(overlay, viewer.id)) return { status: "ready", data: null }
  let offset = 0
  if (args.cursor !== null) {
    const match = new RegExp(`^${CURSOR_TAG}:(\\d{1,6})$`).exec(args.cursor)
    if (!match) return { status: "error", code: "unknown" }
    offset = Number(match[1])
  }
  // Les plus anciennes d'abord : une file se vide par le bas.
  const queue = overlay.claims.filter((claim) => claim.status === args.status).sort((left, right) => left.createdAt - right.createdAt || (left.id < right.id ? -1 : 1))
  const window = queue.slice(offset, offset + CLAIM_QUEUE_PAGE)
  const next = offset + CLAIM_QUEUE_PAGE
  return {
    status: "ready",
    data: { items: window.flatMap((claim) => claimView(state, overlay, claim) ?? []), continueCursor: next < queue.length ? `${CURSOR_TAG}:${next}` : null },
  }
}

export function claimDetailView(state: DemoState, overlay: DemoPageAdminState, claimId: string, now: number): Loadable<PageClaimDetailView | null> {
  const viewer = readerOf(state, now)
  if (typeof viewer === "string") return { status: "error", code: viewer }
  const claim = overlay.claims.find((candidate) => candidate.id === claimId)
  // Son demandeur ou la modération seuls ; pour tout autre, le même refus qu'un identifiant inventé.
  if (!claim || (claim.claimantId !== viewer.id && !isReviewer(overlay, viewer.id))) return { status: "error", code: "not_found" }
  const view = claimView(state, overlay, claim)
  if (!view) return { status: "error", code: "not_found" }
  // La démonstration ne garde aucun fichier : chaque pièce est dite reçue, jamais servie.
  return { status: "ready", data: { ...view, evidence: claim.evidence.map(() => ({ url: null, withheld: null })) } }
}

// ═══════════════════════════════════════════════════════════════
// La capacité
// ═══════════════════════════════════════════════════════════════

const fail = (code: ActionErrorCode): ActionResult<never> => ({ ok: false, code })
const ok = <T>(value: T): ActionResult<T> => ({ ok: true, value })
const LOADING = { status: "loading" } as const
const NOTHING: Loadable<null> = { status: "ready", data: null }
const NO_SIGNATORIES: Loadable<readonly PageSignatoryView[]> = { status: "ready", data: [] }

export function createDemoPageAdmin(store: DemoStore, options: { readonly storage?: StorageLike | null } = {}): PageAdminCapability {
  const overlay = overlayOf(store, options.storage)
  const useVersions = () => {
    const storeVersion = useSyncExternalStore(store.subscribe, store.getVersion, () => -1)
    const overlayVersion = useSyncExternalStore(overlay.subscribe, overlay.getVersion, () => -1)
    return storeVersion < 0 || overlayVersion < 0 ? null : `${storeVersion}:${overlayVersion}`
  }
  const nextId = (prefix: string): [string, number] => {
    const current = overlay.current()
    return [`${prefix}-${current.sequence}`, current.sequence + 1]
  }

  const management: PageManagement = {
    supportsPresentation: true,
    useManagedPage(handle) {
      const version = useVersions()
      return useMemo(() => (version === null ? LOADING : managedPageView(store.getState(), overlay.current(), handle, store.now())), [version, handle])
    },
    useSignatories(pageId) {
      const version = useVersions()
      return useMemo(() => {
        if (version === null) return LOADING
        if (pageId === null) return NO_SIGNATORIES
        return signatoriesView(store.getState(), overlay.current(), pageId, store.now())
      }, [version, pageId])
    },
    useMyInvitations() {
      const version = useVersions()
      return useMemo(() => (version === null ? LOADING : invitationsView(store.getState(), overlay.current(), store.now())), [version])
    },
    useMyClaims() {
      const version = useVersions()
      return useMemo(() => (version === null ? LOADING : myClaimsView(store.getState(), overlay.current(), store.now())), [version])
    },
    useClaimQueue({ status, cursor }) {
      const version = useVersions()
      return useMemo(() => (version === null ? LOADING : claimQueueView(store.getState(), overlay.current(), { status, cursor }, store.now())), [version, status, cursor])
    },
    useClaim(claimId) {
      const version = useVersions()
      return useMemo(() => {
        if (version === null) return LOADING
        return claimId === null ? NOTHING : claimDetailView(store.getState(), overlay.current(), claimId, store.now())
      }, [version, claimId])
    },

    async createPage(input) {
      const state = store.getState()
      const now = store.now()
      const writer = writerOf(state, now, "verifiee")
      if (typeof writer === "string") return fail(writer === "status_insufficient" ? "page_verified_required" : writer)
      if (!isMemberPageKind(input.ownerKind)) return fail("page_kind_reserved")
      const refusal = pageNameRefusal(input.name) ?? pageHandleRefusal(input)
        ?? (input.shortName ? pageShortNameRefusal(input.shortName) : null)
        ?? (input.description ? pageDescriptionRefusal(input.description) : null)
        ?? pageCityRefusal(input.city)
        ?? pageAssociationTypeRefusal(input.ownerKind, input.associationType)
        ?? pageSectorRefusal(input.ownerKind, input.sector)
      if (refusal) return fail(refusal)
      if (!isCountryCode(input.country)) return fail("page_country_invalid")
      const current = overlay.current()
      const handle = pageHandleFor(input)
      if (resolvedPages(state, current).some((page) => page.handle === handle)) return fail("page_handle_taken")
      const [id, sequence] = nextId("page-demo")
      const page: DemoCreatedPage = {
        id,
        handle,
        name: input.name.trim().replace(/\s+/g, " "),
        shortName: input.shortName?.trim().replace(/\s+/g, " ") || null,
        description: input.description?.trim() || null,
        ownerKind: input.ownerKind,
        country: input.country,
        city: normalizePageCity(input.city) ?? null,
        associationType: normalizePageAssociationType(input.ownerKind, input.associationType) ?? null,
        sector: normalizePageSector(input.ownerKind, input.sector) ?? null,
        createdById: writer.id,
        createdAt: now,
      }
      overlay.commit({
        ...current,
        sequence,
        created: [...current.created, page],
        // Le créateur est le premier administrateur, sans invitation (c'est son geste).
        signatories: [...current.signatories, { pageId: id, personId: writer.id, role: "admin", acceptedAt: now, createdAt: now }],
      })
      return ok({ pageId: id, handle })
    },

    async updateIdentity(pageId, input) {
      const state = store.getState()
      const now = store.now()
      const writer = writerOf(state, now, "declaree")
      if (typeof writer === "string") return fail(writer)
      const current = overlay.current()
      const page = pageById(state, current, pageId)
      if (!page) return fail("not_found")
      if (liveRole(state, current, page, writer.id, now) !== "admin") return fail("page_role_required")
      const refusal = pageNameRefusal(input.name)
        ?? (input.shortName ? pageShortNameRefusal(input.shortName) : null)
        ?? (input.description ? pageDescriptionRefusal(input.description) : null)
        ?? pageCityRefusal(input.city)
        ?? pageAssociationTypeRefusal(page.ownerKind, input.associationType)
        ?? pageSectorRefusal(page.ownerKind, input.sector)
      if (refusal) return fail(refusal)
      if (input.country !== null && !isCountryCode(input.country)) return fail("page_country_invalid")
      const next: DemoIdentity = {
        ...current.identity[pageId],
        name: input.name.trim().replace(/\s+/g, " "),
        shortName: input.shortName?.trim().replace(/\s+/g, " ") || null,
        description: input.description?.trim() || null,
        country: input.country,
        ...(input.city !== undefined ? { city: normalizePageCity(input.city) ?? null } : {}),
        ...(input.associationType !== undefined ? { associationType: normalizePageAssociationType(page.ownerKind, input.associationType) ?? null } : {}),
        ...(input.sector !== undefined ? { sector: normalizePageSector(page.ownerKind, input.sector) ?? null } : {}),
      }
      const changed = next.name !== page.name || next.shortName !== page.shortName || next.description !== page.description || next.country !== page.country
        || (next.city !== undefined && next.city !== page.city)
        || (next.associationType !== undefined && next.associationType !== page.associationType)
        || (next.sector !== undefined && next.sector !== page.sector)
      if (!changed) return ok({ changed: false })
      overlay.commit({ ...current, identity: { ...current.identity, [pageId]: next } })
      return ok({ changed: true })
    },

    async grantRole(pageId, rawHandle, role) {
      const state = store.getState()
      const now = store.now()
      const writer = writerOf(state, now, "declaree")
      if (typeof writer === "string") return fail(writer)
      const current = overlay.current()
      const page = pageById(state, current, pageId)
      if (!page) return fail("not_found")
      if (liveRole(state, current, page, writer.id, now) !== "admin") return fail("page_role_required")
      const handle = normalizeHandle(rawHandle)
      if (handle.length === 0) return fail("page_member_handle_required")
      const target = Object.values(state.persons).find((person) => person.profile?.handle === handle && isProfilePublished(person) && state.memberships[person.id] !== undefined)
      if (!target) return fail("page_member_not_found")
      if (target.id === writer.id) return fail("page_signatory_self")
      const existing = rowOf(current, pageId, target.id)
      if (existing && existing.role === role) return ok({ personId: target.id, role, invited: existing.acceptedAt === null })
      if (existing) {
        if (existing.role === "admin" && existing.acceptedAt !== null && role !== "admin" && liveAdminCount(state, current, pageId, now) <= 1) return fail("page_last_admin")
        overlay.commit({ ...current, signatories: current.signatories.map((row) => (row === existing ? { ...row, role } : row)) })
        return ok({ personId: target.id, role, invited: existing.acceptedAt === null })
      }
      if (current.signatories.filter((row) => row.pageId === pageId).length >= PAGE_SIGNATORIES_MAX) return fail("page_signatories_full")
      if (page.badge === "official" && !hasStrongIdentity(state, target.id)) return fail("page_signatory_identity_required")
      // Une habilitation est une INVITATION : personne n'est associé à une page sans l'avoir voulu.
      overlay.commit({ ...current, signatories: [...current.signatories, { pageId, personId: target.id, role, acceptedAt: null, createdAt: now }] })
      return ok({ personId: target.id, role, invited: true })
    },

    async revokeRole(pageId, personId) {
      const state = store.getState()
      const now = store.now()
      const writer = writerOf(state, now, "en_attente")
      if (typeof writer === "string") return fail(writer)
      const current = overlay.current()
      const page = pageById(state, current, pageId)
      if (!page) return fail("not_found")
      const self = personId === writer.id
      const role = liveRole(state, current, page, writer.id, now)
      if (role === null || (!self && role !== "admin")) return fail("page_role_required")
      const row = rowOf(current, pageId, personId)
      if (!row) return ok({ revoked: false })
      if (row.role === "admin" && row.acceptedAt !== null && liveAdminCount(state, current, pageId, now) <= 1) return fail("page_last_admin")
      overlay.commit({ ...current, signatories: current.signatories.filter((candidate) => candidate !== row) })
      return ok({ revoked: true })
    },

    async respondToInvitation(pageId, accept) {
      const state = store.getState()
      const now = store.now()
      const writer = writerOf(state, now, "declaree")
      if (typeof writer === "string") return fail(writer)
      const current = overlay.current()
      const page = pageById(state, current, pageId)
      const row = page ? rowOf(current, pageId, writer.id) : undefined
      if (!page || !row || row.acceptedAt !== null) return fail("page_invitation_gone")
      if (!accept) {
        overlay.commit({ ...current, signatories: current.signatories.filter((candidate) => candidate !== row) })
        return ok({ role: null })
      }
      // L'identité forte se relit à l'acceptation : elle a pu tomber depuis l'invitation.
      if (page.badge === "official" && !hasStrongIdentity(state, writer.id)) return fail("page_signatory_identity_required")
      overlay.commit({ ...current, signatories: current.signatories.map((candidate) => (candidate === row ? { ...row, acceptedAt: now } : candidate)) })
      return ok({ role: row.role })
    },

    async requestClaim(input) {
      const state = store.getState()
      const now = store.now()
      const writer = writerOf(state, now, "declaree")
      if (typeof writer === "string") return fail(writer)
      const current = overlay.current()
      const page = pageById(state, current, input.pageId)
      if (!page) return fail("not_found")
      if (page.badge === "official") return fail("page_not_claimable")
      if (page.badge === "verified") return fail("page_already_verified")
      const hasLiveAdmin = liveAdminCount(state, current, page.id, now) > 0
      // Une page déjà administrée ne se revendique que par l'un de ses administrateurs : c'est alors une demande de vérification.
      if (hasLiveAdmin && liveRole(state, current, page, writer.id, now) !== "admin") return fail("page_already_claimed")
      if (current.claims.some((claim) => claim.pageId === page.id && claim.claimantId === writer.id && claim.status === "pending")) return fail("page_claim_pending")
      const refusal = pageEvidenceSetRefusal(input.evidence) ?? (input.note ? pageClaimNoteRefusal(input.note) : null)
      if (refusal) return fail(refusal)
      const [id, sequence] = nextId("claim-demo")
      const claim: DemoClaim = {
        id,
        pageId: page.id,
        claimantId: writer.id,
        note: input.note?.trim() || null,
        evidence: input.evidence.map((file) => ({ mimeType: file.type, sizeBytes: file.size })),
        status: "pending",
        decisionReason: null,
        createdAt: now,
        decidedAt: null,
      }
      overlay.commit({ ...current, sequence, claims: [...current.claims, claim] })
      return ok({ claimId: id })
    },

    async withdrawClaim(claimId) {
      const state = store.getState()
      const now = store.now()
      const writer = writerOf(state, now, "en_attente")
      if (typeof writer === "string") return fail(writer)
      const current = overlay.current()
      const claim = current.claims.find((candidate) => candidate.id === claimId)
      if (!claim || claim.claimantId !== writer.id) return fail("not_found")
      if (claim.status !== "pending") return ok({ withdrawn: false })
      // Retirée : ses pièces sont purgées aussitôt (ici, ce qu'on savait d'elles).
      overlay.commit({ ...current, claims: current.claims.map((candidate) => (candidate === claim ? { ...claim, status: "withdrawn", evidence: [], decidedAt: null } : candidate)) })
      return ok({ withdrawn: true })
    },

    async decideClaim(claimId, decision, reason) {
      const state = store.getState()
      const now = store.now()
      const writer = writerOf(state, now, "declaree")
      if (typeof writer === "string") return fail(writer)
      const current = overlay.current()
      if (!isReviewer(current, writer.id)) return fail("not_found")
      const claim = current.claims.find((candidate) => candidate.id === claimId)
      if (!claim) return fail("not_found")
      if (claim.status !== "pending") return fail("page_claim_closed")
      const refusal = pageDecisionReasonRefusal(reason)
      if (refusal) return fail(refusal)
      const page = pageById(state, current, claim.pageId)
      if (!page) return fail("not_found")
      let signatories = current.signatories
      let verified = current.verified
      if (decision === "approved") {
        if (page.badge === "official") return fail("page_not_claimable")
        if (!isActiveMember(state, claim.claimantId, now)) return fail("page_claim_closed")
        const row = rowOf(current, page.id, claim.claimantId)
        signatories = row
          ? signatories.map((candidate) => (candidate === row ? { ...row, role: "admin" as const, acceptedAt: row.acceptedAt ?? now } : candidate))
          : [...signatories, { pageId: page.id, personId: claim.claimantId, role: "admin", acceptedAt: now, createdAt: now }]
        if (page.badge === "community" && !verified.includes(page.id)) verified = [...verified, page.id]
      }
      const decided: DemoClaim = { ...claim, status: decision, decisionReason: reason.trim(), decidedAt: now }
      overlay.commit({ ...current, signatories, verified, claims: current.claims.map((candidate) => (candidate === claim ? decided : candidate)) })
      return ok({ status: decision })
    },
  }

  return {
    useMyPages() {
      const version = useVersions()
      return useMemo(() => (version === null ? LOADING : myPagesView(store.getState(), overlay.current(), store.now())), [version])
    },
    management,
  }
}

/**
 * La page vue par la session de démonstration, surcouches comprises (pages
 * créées, identité modifiée, vérification validée) — pour qu'un autre écran de
 * démonstration (la fiche) puisse la lire sans dupliquer ces règles.
 */
export function demoManagedPage(store: DemoStore, handle: string): ManagedPageDetailView | null {
  const view = managedPageView(store.getState(), overlayOf(store).current(), handle, store.now())
  return view.status === "ready" ? view.data : null
}

/** Équipes vivantes partagées avec les demandes et les avis, sans copie de rôles. */
export function demoPageAdminContext(store: DemoStore) {
  const overlay = overlayOf(store)
  return {
    subscribe: overlay.subscribe,
    getVersion: overlay.getVersion,
    /** Projection des identités : aucun rôle ni droit personnel n'est stocké sur la page. */
    pagesOf(state: DemoState): Readonly<Record<string, DemoPage>> {
      const pages = { ...state.pages }
      for (const page of resolvedPages(state, overlay.current())) {
        const base = state.pages[page.id]
        pages[page.id] = {
          id: page.id,
          handle: page.handle,
          name: page.name,
          ownerKind: page.ownerKind,
          country: page.country,
          city: page.city,
          ...(page.associationType !== null ? { associationType: page.associationType } : {}),
          ...(page.sector !== null ? { sector: page.sector } : {}),
          source: base?.source ?? "member_created",
          followers: base?.followers ?? 0,
          ...(base?.relay !== undefined ? { relay: base.relay } : {}),
          description: page.description ?? "",
          claimValidated: page.badge === "verified",
        }
      }
      return pages
    },
    isSignatory(pageId: string, personId: string): boolean {
      const state = store.getState()
      const current = overlay.current()
      const page = pageById(state, current, pageId)
      return page !== null && liveRole(state, current, page, personId, store.now()) !== null
    },
    hasLiveAdmin(pageId: string): boolean {
      return liveAdminCount(store.getState(), overlay.current(), pageId, store.now()) > 0
    },
    signatoriesOf(pageId: string): readonly string[] {
      const state = store.getState()
      const current = overlay.current()
      const page = pageById(state, current, pageId)
      if (!page) return []
      return current.signatories
        .filter((row) => row.pageId === pageId && liveRole(state, current, page, row.personId, store.now()) !== null)
        .map((row) => row.personId)
    },
  }
}
