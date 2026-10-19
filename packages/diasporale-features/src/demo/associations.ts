/**
 * Démonstration de la capacité « associations » (DG-010) — données FICTIVES.
 *
 * L'état des adhésions est LOCAL à ce chantier (le magasin commun n'est pas
 * modifié) : un registre en mémoire, gardé dans ce seul navigateur et remis à
 * zéro avec la démonstration (il suit la date de création du jeu fictif). Les
 * règles sont celles de `@diasporale/domain`, dans l'ordre du moteur : session
 * → adhésion au réseau → capacité → droit sur l'association → règle de l'adhésion.
 *
 * Le « Collectif Ivindo de Lyon (démo) » possède deux adhérentes et une demande
 * en attente. Les responsables viennent uniquement des équipes VIVANTES du
 * magasin des pages : une invitation non acceptée ne donne aucun droit et un
 * retrait referme immédiatement la gestion. Aucun de ces noms n'existe ;
 * aucune liste n'est importée.
 */
import { isProfilePublished } from "@antsia/social-domain/content"
import {
  checkManagementGesture,
  checkMembershipRequest,
  checkSelfWithdrawal,
  DAY_MS,
  hasCapability,
  parseDecisionReason,
  parseRequestMessage,
  requestStanding,
  type AssociationManagementGesture,
  type AssociationMemberRole,
  type AssociationMembershipFacts,
  type AssociationMembershipStatus,
  type AssociationResponsibleRole,
  type MembershipStatus,
} from "@diasporale/domain"
import { useMemo, useSyncExternalStore } from "react"

import {
  ASSOCIATION_LIST_PAGE_SIZE,
  type AssociationListPage,
  type AssociationMemberView,
  type AssociationMembershipView,
  type AssociationsCapability,
  type ManagedAssociationView,
  type MyAssociationItemView,
  type MyAssociationMembershipView,
} from "../data/associations-port"
import type { ActionErrorCode } from "../data/errors"
import type { ActionResult } from "../data/port"
import type { Loadable } from "../data/types"
import { demoManagedPage, demoPageAdminContext } from "./page-admin"
import { statusOf } from "./selectors"
import type { DemoState } from "./state"
import type { DemoStore } from "./store"

export const DEMO_ASSOCIATIONS_STORAGE_KEY = "diasporale:demonstration:associations:v1"

export interface DemoAssociationRow {
  readonly id: string
  readonly pageId: string
  readonly personId: string
  readonly status: AssociationMembershipStatus
  readonly role: AssociationMemberRole
  readonly requestMessage: string | null
  readonly decisionReason: string | null
  readonly requestedAt: number
  readonly statusChangedAt: number
  readonly decidedAt: number | null
  readonly decidedById: string | null
  readonly readmissionAllowedAt: number | null
  readonly version: number
}

interface Ledger {
  readonly seedCreatedAt: number
  readonly sequence: number
  readonly rows: readonly DemoAssociationRow[]
}

/** Le jeu fictif, daté depuis la création de la démonstration : chaque adhésion y est passée par une demande. */
export function demoAssociationSeed(createdAt: number): Ledger {
  const accepted = (id: string, personId: string, role: AssociationMemberRole, ageDays: number): DemoAssociationRow => ({
    id,
    pageId: "page-asso-lyon",
    personId,
    status: "accepted",
    role,
    requestMessage: null,
    decisionReason: null,
    requestedAt: createdAt - (ageDays + 2) * DAY_MS,
    statusChangedAt: createdAt - ageDays * DAY_MS,
    decidedAt: createdAt - ageDays * DAY_MS,
    decidedById: "p-steeve",
    readmissionAllowedAt: null,
    version: 2,
  })
  return {
    seedCreatedAt: createdAt,
    sequence: 10,
    rows: [
      accepted("assoc-1", "p-nadia", "animator", 60),
      accepted("assoc-2", "p-clarisse", "member", 30),
      {
        id: "assoc-3",
        pageId: "page-asso-lyon",
        personId: "p-rodrigue",
        status: "requested",
        role: "member",
        requestMessage: "J'arrive à Lyon en janvier pour mes études : je souhaite rejoindre le collectif. (Message fictif.)",
        decisionReason: null,
        requestedAt: createdAt - 2 * DAY_MS,
        statusChangedAt: createdAt - 2 * DAY_MS,
        decidedAt: null,
        decidedById: null,
        readmissionAllowedAt: null,
        version: 1,
      },
    ],
  }
}

const ACTIVE: ReadonlySet<MembershipStatus> = new Set(["en_attente", "declaree", "verifiee"])
const LOADING = { status: "loading" } as const
const OK: ActionResult = { ok: true, value: null }
const fail = (code: ActionErrorCode): ActionResult => ({ ok: false, code })
const CURSOR_TAG = "demo-associations"

function isActiveMember(state: DemoState, personId: string, now: number): boolean {
  const status = statusOf(state, personId, now)
  return status !== null && ACTIVE.has(status)
}

/** Le refus du LECTEUR, dans l'ordre du moteur : session, adhésion, sanction, capacité. */
export function demoViewerRefusal(state: DemoState, now: number, capability: "read_network" | "publish" = "read_network"): ActionErrorCode | null {
  const viewerId = state.session.personId
  if (!viewerId || !state.persons[viewerId]) return "not_signed_in"
  const status = statusOf(state, viewerId, now)
  if (status === null || status === "partie") return "not_member"
  if (status === "suspendue") return "suspended"
  if (!hasCapability(status, capability)) return "status_insufficient"
  return null
}

function associationPage(state: DemoState, pageId: string) {
  const page = state.pages[pageId]
  return page?.ownerKind === "association" ? page : null
}

function factsOf(row: DemoAssociationRow | undefined): AssociationMembershipFacts | null {
  return row ? { status: row.status, statusChangedAt: row.statusChangedAt, readmissionAllowed: row.readmissionAllowedAt !== null } : null
}

function shownReason(row: DemoAssociationRow): string | null {
  return row.status === "rejected" || row.status === "removed" ? row.decisionReason : null
}

function ownView(row: DemoAssociationRow): AssociationMembershipView {
  return {
    membershipId: row.id,
    status: row.status,
    role: row.role,
    requestMessage: row.status === "requested" ? row.requestMessage : null,
    decisionReason: shownReason(row),
    requestedAt: row.requestedAt,
    statusChangedAt: row.statusChangedAt,
    readmissionAllowed: row.readmissionAllowedAt !== null,
  }
}

/** Le profil PUBLIÉ de la personne, ou le nom neutre ; aucune coordonnée. */
function personView(state: DemoState, personId: string): AssociationMemberView["person"] {
  const person = state.persons[personId]
  const profile = person?.profile && isProfilePublished(person) ? person.profile : null
  return { displayName: profile?.displayName ?? null, handle: profile?.handle ?? null, avatarUrl: null }
}

function memberView(state: DemoState, row: DemoAssociationRow): AssociationMemberView {
  return { ...ownView(row), person: personView(state, row.personId), version: row.version }
}

/** Une fenêtre d'une liste triée ; le curseur est opaque pour l'écran, validé ici. */
function windowOf<T>(items: readonly T[], cursor: string | null, scope: string): Loadable<AssociationListPage<T>> {
  let offset = 0
  if (cursor !== null) {
    try {
      const parsed: unknown = JSON.parse(cursor)
      if (!Array.isArray(parsed) || parsed[0] !== CURSOR_TAG || parsed[1] !== scope || !Number.isInteger(parsed[2]) || (parsed[2] as number) < 0) {
        return { status: "error", code: "unknown" }
      }
      offset = parsed[2] as number
    } catch {
      return { status: "error", code: "unknown" }
    }
  }
  const end = offset + ASSOCIATION_LIST_PAGE_SIZE
  const isDone = end >= items.length
  return {
    status: "ready",
    data: { items: items.slice(offset, end), isDone, continueCursor: isDone ? null : JSON.stringify([CURSOR_TAG, scope, end]) },
  }
}

function isLedger(value: unknown): value is Ledger {
  if (typeof value !== "object" || value === null) return false
  const ledger = value as Partial<Ledger>
  return typeof ledger.seedCreatedAt === "number" && typeof ledger.sequence === "number" && Array.isArray(ledger.rows)
    && ledger.rows.every((row) => typeof row === "object" && row !== null && typeof row.id === "string" && typeof row.version === "number")
}

type StorageLike = Pick<Storage, "getItem" | "setItem">

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}

export interface DemoAssociationsOptions {
  /** Persistance de ce navigateur ; `null` : en mémoire seulement (tests). */
  readonly storage?: StorageLike | null
  /** Latence simulée d'une écriture (ms). */
  readonly latencyMs?: number
}

/** État partagé avec les activités ; aucune copie ni exposition de la liste privée dans le port public. */
export interface DemoAssociationsContext {
  readonly capability: AssociationsCapability
  readonly membershipOf: (pageId: string, personId: string) => { readonly status: AssociationMembershipStatus; readonly role: AssociationMemberRole } | null
  readonly subscribe: (listener: () => void) => () => void
  readonly getVersion: () => number
}

export function createDemoAssociations(store: DemoStore, options: DemoAssociationsOptions = {}): AssociationsCapability {
  return createDemoAssociationsContext(store, options).capability
}

export function createDemoAssociationsContext(store: DemoStore, options: DemoAssociationsOptions = {}): DemoAssociationsContext {
  const teams = demoPageAdminContext(store)
  const readState = (): DemoState => {
    const state = store.getState()
    return { ...state, pages: teams.pagesOf(state) }
  }
  const liveRole = (state: DemoState, pageId: string, personId: string, now: number): AssociationResponsibleRole | null => {
    if (state.session.personId !== personId || !isActiveMember(state, personId, now) || !teams.isSignatory(pageId, personId)) return null
    const page = associationPage(state, pageId)
    return page ? demoManagedPage(store, page.handle)?.myRole ?? null : null
  }
  const isManaged = (pageId: string) => teams.hasLiveAdmin(pageId)
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const latencyMs = options.latencyMs ?? 180
  const listeners = new Set<() => void>()
  let revision = 0
  let ledger: Ledger | null = null

  /** Le registre du jeu fictif COURANT : une démonstration remise à zéro repart du jeu fictif. */
  const current = (): Ledger => {
    const createdAt = store.getState().createdAt
    if (ledger?.seedCreatedAt === createdAt) return ledger
    let loaded: Ledger | null = null
    try {
      const raw = storage?.getItem(DEMO_ASSOCIATIONS_STORAGE_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : null
      if (isLedger(parsed) && parsed.seedCreatedAt === createdAt) loaded = parsed
    } catch {
      // Stockage illisible ou bloqué : on repart du jeu fictif.
    }
    ledger = loaded ?? demoAssociationSeed(createdAt)
    return ledger
  }

  const commit = (next: Ledger) => {
    ledger = next
    revision += 1
    try {
      storage?.setItem(DEMO_ASSOCIATIONS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Stockage plein ou interdit : la démonstration continue en mémoire.
    }
    for (const listener of listeners) listener()
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    const unsubscribe = store.subscribe(listener)
    const unsubscribeTeams = teams.subscribe(listener)
    return () => {
      listeners.delete(listener)
      unsubscribe()
      unsubscribeTeams()
    }
  }
  /** Instantané primitif : la session (magasin commun) et le registre. Rendu serveur : en chargement. */
  const useRevision = () => useSyncExternalStore(subscribe, () => `${store.getVersion()}:${revision}:${teams.getVersion()}`, () => "")

  const pause = async () => {
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs))
  }

  /** Une écriture appartient à la session qui l'a lancée : changée pendant l'attente, rien n'est écrit. */
  const act = async (work: (state: DemoState, viewerId: string, now: number) => ActionResult | Ledger): Promise<ActionResult> => {
    const viewerId = store.getState().session.personId
    await pause()
    const state = readState()
    if (!viewerId || state.session.personId !== viewerId) return fail("not_signed_in")
    const outcome = work(state, viewerId, store.now())
    if ("rows" in outcome) {
      commit(outcome)
      return OK
    }
    return outcome
  }

  const update = (base: Ledger, row: DemoAssociationRow, patch: Partial<DemoAssociationRow>): Ledger => ({
    ...base,
    rows: base.rows.map((candidate) => (candidate.id === row.id ? { ...candidate, ...patch, version: candidate.version + 1 } : candidate)),
  })

  const ownRow = (base: Ledger, pageId: string, personId: string) => base.rows.find((row) => row.pageId === pageId && row.personId === personId)

  /** Une ligne gérée par le lecteur : association, responsable vivant, personne membre active ; sinon refus indistinct. */
  const managed = (state: DemoState, base: Ledger, membershipId: string, viewerId: string, now: number) => {
    const row = base.rows.find((candidate) => candidate.id === membershipId)
    if (!row || !associationPage(state, row.pageId) || !isActiveMember(state, row.personId, now)) return null
    const role = liveRole(state, row.pageId, viewerId, now)
    return role === null ? null : { row, role }
  }

  const manage = (
    gesture: AssociationManagementGesture,
    membershipId: string,
    expectedVersion: number,
    apply: (row: DemoAssociationRow, now: number, viewerId: string) => Partial<DemoAssociationRow> | ActionErrorCode | null,
  ) => act((state, viewerId, now) => {
    const refusal = demoViewerRefusal(state, now, "publish")
    if (refusal) return fail(refusal)
    const base = current()
    const target = managed(state, base, membershipId, viewerId, now)
    if (!target) return fail("not_found")
    const check = checkManagementGesture({
      gesture,
      actorRole: target.role,
      current: target.row.status,
      expectedVersion,
      version: target.row.version,
      isSelf: target.row.personId === viewerId,
    })
    if (!check.ok) return fail(check.code)
    const patch = apply(target.row, now, viewerId)
    if (typeof patch === "string") return fail(patch)
    return patch === null ? OK : update(base, target.row, patch)
  })

  const selfWithdrawal = (gesture: "cancel" | "leave", pageId: string) => act((state, viewerId, now) => {
    const refusal = demoViewerRefusal(state, now)
    if (refusal) return fail(refusal)
    const base = current()
    const row = ownRow(base, pageId, viewerId)
    const check = checkSelfWithdrawal(gesture, row?.status ?? null)
    if (!check.ok || !row) return fail(check.ok ? "not_found" : check.code)
    return update(base, row, { status: check.value, statusChangedAt: now, ...(gesture === "leave" ? { role: "member" as const } : {}) })
  })

  const capability: AssociationsCapability = {
    useMyMembership(pageId) {
      const revisionKey = useRevision()
      return useMemo((): Loadable<MyAssociationMembershipView> => {
        if (revisionKey === "") return LOADING
        const state = readState()
        const now = store.now()
        const refusal = demoViewerRefusal(state, now)
        if (refusal) return { status: "error", code: refusal }
        const viewerId = state.session.personId as string
        if (!associationPage(state, pageId)) return { status: "error", code: "not_found" }
        const row = ownRow(current(), pageId, viewerId)
        const canPublish = demoViewerRefusal(state, now, "publish") === null
        return {
          status: "ready",
          data: {
            pageId,
            membership: row ? ownView(row) : null,
            request: canPublish
              ? requestStanding({ previous: factsOf(row), managed: isManaged(pageId) }, now)
              : { allowed: false, refusal: "status_insufficient", availableAt: null },
            responsibleRole: liveRole(state, pageId, viewerId, now),
          },
        }
      }, [revisionKey, pageId])
    },

    useMyAssociations({ cursor }) {
      const revisionKey = useRevision()
      return useMemo((): Loadable<AssociationListPage<MyAssociationItemView>> => {
        if (revisionKey === "") return LOADING
        const state = readState()
        const refusal = demoViewerRefusal(state, store.now())
        if (refusal) return { status: "error", code: refusal }
        const viewerId = state.session.personId as string
        const items = current().rows
          .filter((row) => row.personId === viewerId)
          .flatMap((row): MyAssociationItemView[] => {
            const page = associationPage(state, row.pageId)
            return page ? [{
              membershipId: row.id,
              status: row.status,
              role: row.role,
              decisionReason: shownReason(row),
              statusChangedAt: row.statusChangedAt,
              page: { id: page.id, handle: page.handle, name: page.name },
            }] : []
          })
          .sort((left, right) => right.statusChangedAt - left.statusChangedAt || (left.membershipId < right.membershipId ? 1 : -1))
        return windowOf(items, cursor, viewerId)
      }, [revisionKey, cursor])
    },

    useManagedAssociation(handle) {
      const revisionKey = useRevision()
      return useMemo((): Loadable<ManagedAssociationView> => {
        if (revisionKey === "") return LOADING
        const state = readState()
        const now = store.now()
        const refusal = demoViewerRefusal(state, now)
        if (refusal) return { status: "error", code: refusal }
        const page = Object.values(state.pages).find((candidate) => candidate.handle === handle && candidate.ownerKind === "association")
        const role = page ? liveRole(state, page.id, state.session.personId as string, now) : null
        if (!page || role === null) return { status: "error", code: "not_found" }
        return { status: "ready", data: { pageId: page.id, handle: page.handle, name: page.name, role } }
      }, [revisionKey, handle])
    },

    useMembers({ pageId, status, cursor }) {
      const revisionKey = useRevision()
      return useMemo((): Loadable<AssociationListPage<AssociationMemberView>> => {
        if (revisionKey === "") return LOADING
        const state = readState()
        const now = store.now()
        const refusal = demoViewerRefusal(state, now)
        if (refusal) return { status: "error", code: refusal }
        if (!associationPage(state, pageId) || liveRole(state, pageId, state.session.personId as string, now) === null) {
          return { status: "error", code: "not_found" }
        }
        const direction = status === "removed" ? -1 : 1
        const items = current().rows
          .filter((row) => row.pageId === pageId && row.status === status && isActiveMember(state, row.personId, now))
          .sort((left, right) => direction * (left.statusChangedAt - right.statusChangedAt) || (left.id < right.id ? -direction : direction))
          .map((row) => memberView(state, row))
        return windowOf(items, cursor, `${pageId}:${status}`)
      }, [revisionKey, pageId, status, cursor])
    },

    request: ({ pageId, message }) => act((state, viewerId, now) => {
      const refusal = demoViewerRefusal(state, now, "publish")
      if (refusal) return fail(refusal)
      if (!associationPage(state, pageId)) return fail("not_found")
      const text = parseRequestMessage(message)
      if (!text.ok) return fail(text.code)
      const base = current()
      const row = ownRow(base, pageId, viewerId)
      const check = checkMembershipRequest({ previous: factsOf(row), managed: isManaged(pageId) }, now)
      if (!check.ok) return fail(check.code)
      const fields = {
        status: "requested" as const,
        role: "member" as const,
        requestMessage: text.value,
        decisionReason: null,
        decidedAt: null,
        decidedById: null,
        readmissionAllowedAt: null,
        requestedAt: now,
        statusChangedAt: now,
      }
      if (row) return update(base, row, fields)
      return {
        ...base,
        sequence: base.sequence + 1,
        rows: [...base.rows, { id: `assoc-${base.sequence}`, pageId, personId: viewerId, ...fields, version: 1 }],
      }
    }),

    cancelRequest: (pageId) => selfWithdrawal("cancel", pageId),

    leave: (pageId) => selfWithdrawal("leave", pageId),

    decide: ({ membershipId, decision, expectedVersion, reason }) => manage(decision, membershipId, expectedVersion, (row, now, viewerId) => {
      const parsed = decision === "reject" ? parseDecisionReason(reason, { required: false }) : null
      if (parsed && !parsed.ok) return parsed.code
      return {
        status: decision === "accept" ? "accepted" : "rejected",
        role: "member",
        decisionReason: parsed?.ok ? parsed.value : null,
        decidedAt: now,
        decidedById: viewerId,
        statusChangedAt: now,
      }
    }),

    remove: ({ membershipId, expectedVersion, reason }) => manage("remove", membershipId, expectedVersion, (row, now, viewerId) => {
      const parsed = parseDecisionReason(reason, { required: true })
      if (!parsed.ok) return parsed.code
      return { status: "removed", role: "member", decisionReason: parsed.value, decidedAt: now, decidedById: viewerId, readmissionAllowedAt: null, statusChangedAt: now }
    }),

    setRole: ({ membershipId, expectedVersion, role }) => manage("set_role", membershipId, expectedVersion, (row) => (row.role === role ? null : { role })),

    allowReadmission: ({ membershipId, expectedVersion }) => manage("allow_readmission", membershipId, expectedVersion, (row, now) => (
      row.readmissionAllowedAt !== null ? null : { readmissionAllowedAt: now }
    )),
  }

  return {
    capability,
    subscribe,
    getVersion: () => revision + teams.getVersion(),
    membershipOf(pageId, personId) {
      const row = ownRow(current(), pageId, personId)
      return row ? { status: row.status, role: row.role } : null
    },
  }
}
