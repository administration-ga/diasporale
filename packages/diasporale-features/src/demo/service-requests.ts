/**
 * Démonstration de la capacité « demandes de service » (DG-014/015).
 * PROPRIÉTAIRE : chantier « demandes et rendez-vous ».
 *
 * Données FICTIVES, dans ce seul navigateur, à part de l'état principal (une
 * clé de stockage à elles) et remises à zéro avec lui. Les règles sont celles
 * du moteur, appliquées par `@diasporale/domain` dans le même ordre : session →
 * adhésion → capacité → droit sur la demande (le demandeur, ou l'équipe de la
 * page) → règles du geste. Une demande d'autrui est introuvable.
 *
 * Les offres sont lues par `findOffer` (catalogue de démonstration). L'équipe
 * d'une page fictive est le miroir du jeu de départ de la gestion des pages
 * (`DEMO_REQUEST_TEAMS`) tant que `signatoriesOf` n'est pas fourni : Mireille
 * répond pour « Saveurs d'Okoumé (démo) », Prisca et Steeve peuvent demander.
 */
import {
  availableServiceRequestActions,
  canContestNoShow,
  checkNoShowContest,
  checkProposalVersion,
  checkServiceRequestTiming,
  checkServiceRequestTransition,
  effectiveServiceRequestStatus,
  hasCapability,
  isServiceIdempotencyKey,
  isServiceRequestTerminal,
  nextProposalVersion,
  normalizeServiceRequestDraft,
  parseServiceProposal,
  parseServiceReason,
  serviceRequestFingerprint,
  serviceRequestTimeline,
  slotsOverlap,
  type MemberCapability,
  type ServiceBookingStatus,
  type ServiceLocation,
  type ServiceProposalState,
  type ServiceRequestAction,
  type ServiceRequestActor,
  type ServiceRequestCloser,
  type ServiceRequestStatus,
  type ServiceWindow,
} from "@diasporale/domain"
import { useMemo, useSyncExternalStore } from "react"

import type { ActionErrorCode } from "../data/errors"
import type { ActionResult } from "../data/port"
import {
  SERVICE_REQUESTS_PAGE_SIZE,
  type ProposeServiceInput,
  type SendServiceRequestInput,
  type ServiceRequestDetailView,
  type ServiceRequestsCapability,
  type ServiceRequestsPageQuery,
  type ServiceRequestSummaryView,
} from "../data/service-requests-port"
import type { Loadable } from "../data/types"
import { statusOf } from "./selectors"
import type { DemoOfferRef } from "./services"
import type { DemoStore } from "./store"

export const DEMO_SERVICE_REQUESTS_STORAGE_KEY = "diasporale:demonstration:demandes:v1"

/** Les équipes fictives de départ des pages qui proposent des services (miroir de la gestion des pages). */
export const DEMO_REQUEST_TEAMS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "page-saveurs": ["p-mireille"],
  "page-asso-lyon": ["p-steeve"],
  "page-valise": ["p-nadia"],
})

type DemoStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

export interface DemoServiceRequestsDeps {
  readonly findOffer: (offerId: string) => DemoOfferRef | null
  /** Les signataires vivants d'une page fictive ; par défaut, `DEMO_REQUEST_TEAMS`. */
  readonly signatoriesOf?: (pageId: string) => readonly string[]
  readonly subscribeSignatories?: (listener: () => void) => () => void
  readonly getSignatoriesVersion?: () => number
  /** Le stockage des demandes ; `null` : en mémoire seulement. Par défaut, celui du navigateur. */
  readonly storage?: DemoStorage | null
}

interface DemoRequestRow {
  readonly id: string
  readonly offerId: string
  readonly offerVersion: number
  readonly offerTitle: string
  readonly pageId: string
  readonly pageHandle: string
  readonly pageName: string
  readonly requesterId: string
  readonly need: string
  readonly windows: readonly ServiceWindow[]
  readonly timeZone: string
  readonly status: ServiceRequestStatus
  readonly identityConsentAt: number
  readonly idempotencyKey: string
  readonly fingerprint: string
  readonly expiresAt: number
  readonly deadlineAt: number | null
  readonly currentProposalId: string | null
  readonly proposalVersion: number
  readonly bookingId: string | null
  readonly closedBy: ServiceRequestCloser | null
  readonly closedReason: string | null
  readonly closedAt: number | null
  /** DG-015 : la contestation d'une absence (facultative : un état local antérieur ne la porte pas). */
  readonly contestedAt?: number | null
  readonly contestReason?: string | null
  readonly createdAt: number
  readonly updatedAt: number
}

interface DemoProposalRow {
  readonly id: string
  readonly requestId: string
  readonly version: number
  readonly authorId: string
  readonly amountMinor: number
  readonly currency: string
  readonly durationMinutes: number
  readonly startAt: number
  readonly endAt: number
  readonly timeZone: string
  readonly location: ServiceLocation
  readonly details: string
  readonly cancellationTerms: string
  readonly expiresAt: number
  readonly state: ServiceProposalState
  readonly createdAt: number
}

interface DemoBookingRow {
  readonly id: string
  readonly requestId: string
  readonly proposalId: string
  readonly pageId: string
  readonly startAt: number
  readonly endAt: number
  readonly timeZone: string
  readonly status: ServiceBookingStatus
  readonly reason: string | null
  readonly createdAt: number
}

export interface DemoServiceRequestsState {
  readonly version: 1
  /** L'état principal dont ces demandes sont le prolongement : sa remise à zéro les remet à zéro. */
  readonly seedCreatedAt: number
  readonly sequence: number
  readonly requests: readonly DemoRequestRow[]
  readonly proposals: readonly DemoProposalRow[]
  readonly bookings: readonly DemoBookingRow[]
}

const CURSOR_TAG = "demo-service-requests"
const OK: ActionResult = { ok: true, value: null }
const LOADING = { status: "loading" } as const

function fail(code: ActionErrorCode): ActionResult<never> {
  return { ok: false, code }
}

function failed<T>(code: ActionErrorCode): Loadable<T> {
  return { status: "error", code }
}

function defaultStorage(): DemoStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

function isState(value: unknown): value is DemoServiceRequestsState {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<DemoServiceRequestsState>
  return candidate.version === 1 && typeof candidate.seedCreatedAt === "number" && typeof candidate.sequence === "number"
    && Array.isArray(candidate.requests) && Array.isArray(candidate.proposals) && Array.isArray(candidate.bookings)
}

function effectiveOf(row: DemoRequestRow, now: number): ServiceRequestStatus {
  return effectiveServiceRequestStatus({ status: row.status, deadlineAt: row.deadlineAt }, now)
}

/** L'ordre des listes : les plus récemment mises à jour d'abord, l'identifiant départage. */
function newestFirst(left: DemoRequestRow, right: DemoRequestRow): number {
  return right.updatedAt - left.updatedAt || (left.id === right.id ? 0 : left.id < right.id ? 1 : -1)
}

/** Faits privés minimaux, réservés au fournisseur local des avis ; jamais exposés dans le port public. */
export interface DemoServiceReviewRequest {
  readonly requestId: string
  readonly requesterId: string
  readonly providerId: string | null
  readonly pageId: string
  readonly offerId: string
  readonly status: ServiceRequestStatus
  readonly booking: { readonly status: ServiceBookingStatus; readonly endAt: number } | null
  /** DG-015 : l'absence déclarée par la page a été contestée par la personne qui demande. */
  readonly noShowContested: boolean
}

export interface DemoServiceRequestsContext {
  readonly capability: ServiceRequestsCapability
  readonly findReviewRequest: (requestId: string) => DemoServiceReviewRequest | null
  readonly subscribe: (listener: () => void) => () => void
  readonly getVersion: () => number
}

/** Le contrat historique reste une capacité ; la source compose les capacités avec le contexte privé ci-dessous. */
export function createDemoServiceRequests(store: DemoStore, deps: DemoServiceRequestsDeps): ServiceRequestsCapability {
  return createDemoServiceRequestsContext(store, deps).capability
}

export function createDemoServiceRequestsContext(store: DemoStore, deps: DemoServiceRequestsDeps): DemoServiceRequestsContext {
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage
  const teamOf = deps.signatoriesOf ?? ((pageId: string) => DEMO_REQUEST_TEAMS[pageId] ?? [])
  const listeners = new Set<() => void>()
  let version = 0
  let state: DemoServiceRequestsState | null = null

  function load(seedCreatedAt: number): DemoServiceRequestsState {
    try {
      const raw = storage?.getItem(DEMO_SERVICE_REQUESTS_STORAGE_KEY)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (isState(parsed) && parsed.seedCreatedAt === seedCreatedAt) return parsed
      }
    } catch {
      // Stockage illisible ou bloqué : on repart d'une démonstration vide.
    }
    return { version: 1, seedCreatedAt, sequence: 1, requests: [], proposals: [], bookings: [] }
  }

  /** L'état courant ; une remise à zéro de la démonstration le remet à zéro. */
  function current(): DemoServiceRequestsState {
    const seedCreatedAt = store.getState().createdAt
    if (state === null || state.seedCreatedAt !== seedCreatedAt) state = load(seedCreatedAt)
    return state
  }

  function commit(next: DemoServiceRequestsState): void {
    state = next
    version += 1
    try {
      storage?.setItem(DEMO_SERVICE_REQUESTS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Stockage plein ou interdit : la démonstration continue en mémoire.
    }
    for (const listener of listeners) listener()
  }

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    const unsubscribe = store.subscribe(listener)
    const unsubscribeSignatories = deps.subscribeSignatories?.(listener)
    return () => {
      listeners.delete(listener)
      unsubscribe()
      unsubscribeSignatories?.()
    }
  }
  /** Une session, une adhésion ou une demande qui change relit les vues. */
  const snapshot = () => `${store.getVersion()}:${version}:${deps.getSignatoriesVersion?.() ?? 0}`
  const useSnapshot = () => useSyncExternalStore(subscribe, snapshot, () => "")

  /** La session de démonstration, membre active, avec la capacité demandée. */
  function viewer(capability: MemberCapability): { readonly ok: true; readonly personId: string } | { readonly ok: false; readonly code: ActionErrorCode } {
    const main = store.getState()
    const personId = main.session.personId
    if (!personId || !main.persons[personId]) return { ok: false, code: "not_signed_in" }
    const membership = main.memberships[personId]
    const status = statusOf(main, personId, store.now())
    if (!membership || status === null || status === "partie") return { ok: false, code: "not_member" }
    if (status === "suspendue") return { ok: false, code: "suspended" }
    if (!hasCapability(status, capability)) return { ok: false, code: capability === "read_network" ? "not_member" : "status_insufficient" }
    return { ok: true, personId }
  }

  function participant(row: DemoRequestRow, personId: string): ServiceRequestActor | null {
    if (row.requesterId === personId) return "requester"
    return teamOf(row.pageId).includes(personId) ? "page" : null
  }

  function summaryOf(data: DemoServiceRequestsState, row: DemoRequestRow, viewerRole: ServiceRequestActor, now: number): ServiceRequestSummaryView {
    const main = store.getState()
    const proposal = row.currentProposalId === null ? undefined : data.proposals.find((candidate) => candidate.id === row.currentProposalId)
    const booking = row.bookingId === null ? undefined : data.bookings.find((candidate) => candidate.id === row.bookingId)
    const page = main.pages[row.pageId]
    const requester = main.persons[row.requesterId]
    const profile = requester?.profile && requester.withdrawnAt === undefined ? requester.profile : null
    const status = effectiveOf(row, now)
    return {
      requestId: row.id,
      status,
      offerId: row.offerId,
      offerTitle: row.offerTitle,
      offerVersion: row.offerVersion,
      page: { pageId: row.pageId, handle: page?.handle ?? row.pageHandle, name: page?.name ?? row.pageName, logoUrl: null },
      requester: viewerRole === "page" ? { displayName: profile?.displayName ?? null, handle: profile?.handle ?? null } : null,
      windows: row.windows,
      timeZone: row.timeZone,
      currentProposal: proposal
        ? { version: proposal.version, amountMinor: proposal.amountMinor, currency: proposal.currency, startAt: proposal.startAt, endAt: proposal.endAt, timeZone: proposal.timeZone, expiresAt: proposal.expiresAt }
        : null,
      booking: booking ? { startAt: booking.startAt, endAt: booking.endAt, timeZone: booking.timeZone, status: booking.status } : null,
      deadlineAt: status === "sent" || status === "proposed" ? row.deadlineAt : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  function detailOf(data: DemoServiceRequestsState, row: DemoRequestRow, viewerRole: ServiceRequestActor, now: number): ServiceRequestDetailView {
    const summary = summaryOf(data, row, viewerRole, now)
    const proposals = data.proposals.filter((proposal) => proposal.requestId === row.id).sort((left, right) => right.version - left.version)
    const booking = row.bookingId === null ? undefined : data.bookings.find((candidate) => candidate.id === row.bookingId)
    return {
      ...summary,
      viewerRole,
      need: row.need,
      proposals: proposals.map((proposal) => ({
        version: proposal.version,
        amountMinor: proposal.amountMinor,
        currency: proposal.currency,
        durationMinutes: proposal.durationMinutes,
        startAt: proposal.startAt,
        endAt: proposal.endAt,
        timeZone: proposal.timeZone,
        location: proposal.location,
        details: proposal.details,
        cancellationTerms: proposal.cancellationTerms,
        expiresAt: proposal.expiresAt,
        state: proposal.state,
        createdAt: proposal.createdAt,
      })),
      timeline: serviceRequestTimeline({
        createdAt: row.createdAt,
        proposals: proposals.map((proposal) => ({ version: proposal.version, createdAt: proposal.createdAt })),
        confirmedAt: booking ? booking.createdAt : null,
        closed: row.closedAt !== null && isServiceRequestTerminal(row.status) ? { status: row.status, at: row.closedAt } : null,
        effectiveStatus: summary.status,
        deadlineAt: row.deadlineAt,
      }),
      closedBy: row.closedBy,
      closedReason: row.closedReason,
      actions: availableServiceRequestActions({
        actor: viewerRole,
        status: summary.status,
        now,
        bookingStartAt: booking ? booking.startAt : null,
        proposalVersion: row.proposalVersion,
      }),
      noShowContest: row.contestedAt != null && row.contestReason != null ? { at: row.contestedAt, reason: row.contestReason } : null,
      canContestNoShow: viewerRole === "requester" && canContestNoShow(contestInput(row, summary.status, now)),
    }
  }

  /** Les faits de la contestation d'une absence : le constat de la page est l'instant de clôture `no_show`. */
  function contestInput(row: DemoRequestRow, status: ServiceRequestStatus, now: number) {
    return { status, declaredAt: status === "no_show" ? row.closedAt : null, contestedAt: row.contestedAt ?? null, now }
  }

  /** Une fenêtre de liste à curseur opaque, comme la pagination du moteur. */
  function pageOf(rows: readonly DemoRequestRow[], cursor: string | null, project: (row: DemoRequestRow) => ServiceRequestSummaryView): ServiceRequestsPageQuery {
    let boundary: { readonly updatedAt: number; readonly id: string } | null = null
    if (cursor !== null) {
      try {
        const parsed: unknown = JSON.parse(cursor)
        if (!Array.isArray(parsed) || parsed.length !== 3 || parsed[0] !== CURSOR_TAG || typeof parsed[1] !== "number" || typeof parsed[2] !== "string") return failed("unknown")
        boundary = { updatedAt: parsed[1], id: parsed[2] }
      } catch {
        return failed("unknown")
      }
    }
    const after = boundary
    const remaining = [...rows].sort(newestFirst).filter((row) => after === null || row.updatedAt < after.updatedAt || (row.updatedAt === after.updatedAt && row.id < after.id))
    const window = remaining.slice(0, SERVICE_REQUESTS_PAGE_SIZE)
    const last = window[window.length - 1]
    const isDone = remaining.length <= SERVICE_REQUESTS_PAGE_SIZE
    return {
      status: "ready",
      data: {
        items: window.map(project),
        isDone,
        continueCursor: !isDone && last ? JSON.stringify([CURSOR_TAG, last.updatedAt, last.id]) : null,
      },
    }
  }

  function slotTaken(data: DemoServiceRequestsState, pageId: string, slot: ServiceWindow): boolean {
    return data.bookings.some((booking) => booking.pageId === pageId && booking.status === "confirmed" && slotsOverlap(booking, slot))
  }

  function replaceRequest(data: DemoServiceRequestsState, next: DemoRequestRow): readonly DemoRequestRow[] {
    return data.requests.map((row) => (row.id === next.id ? next : row))
  }

  /** La demande d'un participant, pour un geste : introuvable pour tout autre. */
  function participantRow(requestId: string, personId: string): { readonly data: DemoServiceRequestsState; readonly row: DemoRequestRow; readonly actor: ServiceRequestActor } | null {
    const data = current()
    const row = data.requests.find((candidate) => candidate.id === requestId)
    const actor = row ? participant(row, personId) : null
    return row && actor ? { data, row, actor } : null
  }

  const capability: ServiceRequestsCapability = {
    useMyRequests({ cursor }) {
      const tick = useSnapshot()
      return useMemo<ServiceRequestsPageQuery>(() => {
        if (tick === "") return LOADING
        const access = viewer("read_network")
        if (!access.ok) return failed(access.code)
        const data = current()
        const now = store.now()
        return pageOf(data.requests.filter((row) => row.requesterId === access.personId), cursor, (row) => summaryOf(data, row, "requester", now))
      }, [tick, cursor])
    },

    usePageRequests({ pageId, status, cursor }) {
      const tick = useSnapshot()
      return useMemo<ServiceRequestsPageQuery>(() => {
        if (tick === "") return LOADING
        const access = viewer("read_network")
        if (!access.ok) return failed(access.code)
        if (!teamOf(pageId).includes(access.personId)) return failed("not_found")
        const data = current()
        const now = store.now()
        const rows = data.requests.filter((row) => row.pageId === pageId && (status === null || effectiveOf(row, now) === status))
        return pageOf(rows, cursor, (row) => summaryOf(data, row, "page", now))
      }, [tick, pageId, status, cursor])
    },

    useRequest(requestId) {
      const tick = useSnapshot()
      return useMemo<Loadable<ServiceRequestDetailView | null>>(() => {
        if (tick === "") return LOADING
        const access = viewer("read_network")
        if (!access.ok) return failed(access.code)
        const found = participantRow(requestId, access.personId)
        return { status: "ready", data: found ? detailOf(found.data, found.row, found.actor, store.now()) : null }
      }, [tick, requestId])
    },

    async send(input: SendServiceRequestInput) {
      const access = viewer("publish")
      if (!access.ok) return fail(access.code)
      if (!isServiceIdempotencyKey(input.idempotencyKey)) return fail("unknown")
      const draft = normalizeServiceRequestDraft(input)
      if (!draft.ok) return fail(draft.code)
      const fingerprint = serviceRequestFingerprint({ offerId: input.offerId, offerVersion: input.offerVersion, ...draft.value })
      const data = current()
      // Rejeu AVANT les gardes de l'offre et de l'heure : la demande déjà créée est la réponse.
      const replay = data.requests.find((row) => row.requesterId === access.personId && row.idempotencyKey === input.idempotencyKey)
      if (replay) return replay.fingerprint === fingerprint ? { ok: true, value: { requestId: replay.id, created: false } } : fail("request_idempotency_conflict")
      if (!input.shareIdentityWithPage) return fail("request_consent_required")
      const offer = deps.findOffer(input.offerId)
      if (!offer || offer.status !== "active") return fail("not_found")
      if (offer.version !== input.offerVersion) return fail("request_offer_changed")
      if (teamOf(offer.pageId).includes(access.personId)) return fail("request_own_page")
      const now = store.now()
      const open = data.requests.some((row) => {
        if (row.requesterId !== access.personId || row.offerId !== offer.id) return false
        const status = effectiveOf(row, now)
        return status === "sent" || status === "proposed"
      })
      if (open) return fail("request_already_open")
      const timing = checkServiceRequestTiming(draft.value, now)
      if (!timing.ok) return fail(timing.code)
      const requestId = `demande-demo-${data.sequence}`
      commit({
        ...data,
        sequence: data.sequence + 1,
        requests: [
          ...data.requests,
          {
            id: requestId,
            offerId: offer.id,
            offerVersion: offer.version,
            offerTitle: offer.title,
            pageId: offer.pageId,
            pageHandle: offer.pageHandle,
            pageName: offer.pageName,
            requesterId: access.personId,
            need: draft.value.need,
            windows: draft.value.windows,
            timeZone: draft.value.timeZone,
            status: "sent",
            identityConsentAt: now,
            idempotencyKey: input.idempotencyKey,
            fingerprint,
            expiresAt: timing.value.expiresAt,
            deadlineAt: timing.value.expiresAt,
            currentProposalId: null,
            proposalVersion: 0,
            bookingId: null,
            closedBy: null,
            closedReason: null,
            closedAt: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
      })
      return { ok: true, value: { requestId, created: true } }
    },

    async propose(input: ProposeServiceInput) {
      const access = viewer("publish")
      if (!access.ok) return fail(access.code)
      const found = participantRow(input.requestId, access.personId)
      if (!found || found.actor !== "page") return fail("not_found")
      const { data, row } = found
      const now = store.now()
      const transition = checkServiceRequestTransition({ action: "propose", actor: "page", status: effectiveOf(row, now), now, bookingStartAt: null })
      if (!transition.ok) return fail(transition.code)
      const expected = checkProposalVersion(input.expectedVersion, row.proposalVersion)
      if (!expected.ok) return fail(expected.code)
      const next = nextProposalVersion(row.proposalVersion)
      if (!next.ok) return fail(next.code)
      const terms = parseServiceProposal(input, now)
      if (!terms.ok) return fail(terms.code)
      if (slotTaken(data, row.pageId, terms.value)) return fail("booking_slot_unavailable")
      const proposalId = `proposition-demo-${data.sequence}`
      commit({
        ...data,
        sequence: data.sequence + 1,
        proposals: [
          ...data.proposals.map((proposal) => (proposal.id === row.currentProposalId ? { ...proposal, state: "superseded" as const } : proposal)),
          { id: proposalId, requestId: row.id, version: next.value, authorId: access.personId, ...terms.value, state: "current", createdAt: now },
        ],
        requests: replaceRequest(data, { ...row, status: "proposed", currentProposalId: proposalId, proposalVersion: next.value, deadlineAt: terms.value.expiresAt, updatedAt: now }),
      })
      return { ok: true, value: { version: next.value } }
    },

    async refuse({ requestId, reason }) {
      const access = viewer("publish")
      if (!access.ok) return fail(access.code)
      const found = participantRow(requestId, access.personId)
      if (!found || found.actor !== "page") return fail("not_found")
      const { data, row } = found
      const now = store.now()
      const transition = checkServiceRequestTransition({ action: "refuse", actor: "page", status: effectiveOf(row, now), now, bookingStartAt: null })
      if (!transition.ok) return fail(transition.code)
      const motive = parseServiceReason(reason, false)
      if (!motive.ok) return fail(motive.code)
      commit({ ...data, requests: replaceRequest(data, { ...row, status: "refused", closedBy: "page", closedReason: motive.value, closedAt: now, deadlineAt: null, updatedAt: now }) })
      return OK
    },

    async cancel({ requestId, reason }) {
      const access = viewer("publish")
      if (!access.ok) return fail(access.code)
      const found = participantRow(requestId, access.personId)
      if (!found) return fail("not_found")
      const { data, row, actor } = found
      const now = store.now()
      const status = effectiveOf(row, now)
      const booking = status === "confirmed" ? data.bookings.find((candidate) => candidate.id === row.bookingId) : undefined
      const transition = checkServiceRequestTransition({ action: "cancel", actor, status, now, bookingStartAt: booking ? booking.startAt : null })
      if (!transition.ok) return fail(transition.code)
      const motive = parseServiceReason(reason, status === "confirmed")
      if (!motive.ok) return fail(motive.code)
      commit({
        ...data,
        bookings: data.bookings.map((candidate) => (candidate.id === booking?.id ? { ...candidate, status: "cancelled" as const, reason: motive.value } : candidate)),
        requests: replaceRequest(data, { ...row, status: "cancelled", closedBy: actor, closedReason: motive.value, closedAt: now, deadlineAt: null, updatedAt: now }),
      })
      return OK
    },

    async accept({ requestId, expectedProposalVersion }) {
      const access = viewer("publish")
      if (!access.ok) return fail(access.code)
      const found = participantRow(requestId, access.personId)
      if (!found || found.actor !== "requester") return fail("not_found")
      const { data, row } = found
      const now = store.now()
      const transition = checkServiceRequestTransition({ action: "accept", actor: "requester", status: effectiveOf(row, now), now, bookingStartAt: null })
      if (!transition.ok) return fail(transition.code)
      const expected = checkProposalVersion(expectedProposalVersion, row.proposalVersion)
      if (!expected.ok) return fail(expected.code)
      const proposal = data.proposals.find((candidate) => candidate.id === row.currentProposalId)
      if (!proposal || proposal.state !== "current") return fail("request_not_open")
      if (slotTaken(data, row.pageId, proposal)) return fail("booking_slot_unavailable")
      const bookingId = `rendez-vous-demo-${data.sequence}`
      commit({
        ...data,
        sequence: data.sequence + 1,
        bookings: [
          ...data.bookings,
          { id: bookingId, requestId: row.id, proposalId: proposal.id, pageId: row.pageId, startAt: proposal.startAt, endAt: proposal.endAt, timeZone: proposal.timeZone, status: "confirmed", reason: null, createdAt: now },
        ],
        requests: replaceRequest(data, { ...row, status: "confirmed", bookingId, deadlineAt: null, updatedAt: now }),
      })
      return { ok: true, value: { bookingId } }
    },

    complete: (requestId) => closeBooking(requestId, "complete"),
    markNoShow: (requestId) => closeBooking(requestId, "no_show"),

    async contestNoShow({ requestId, reason }) {
      const access = viewer("publish")
      if (!access.ok) return fail(access.code)
      const found = participantRow(requestId, access.personId)
      if (!found || found.actor !== "requester") return fail("not_found")
      const { data, row } = found
      const now = store.now()
      const verdict = checkNoShowContest(contestInput(row, effectiveOf(row, now), now))
      if (!verdict.ok) return fail(verdict.code)
      if (verdict.value === "already" && row.contestedAt != null) return { ok: true, value: { contestedAt: row.contestedAt, created: false } }
      const motive = parseServiceReason(reason, true)
      if (!motive.ok) return fail(motive.code)
      commit({ ...data, requests: replaceRequest(data, { ...row, contestedAt: now, contestReason: motive.value, updatedAt: now }) })
      return { ok: true, value: { contestedAt: now, created: true } }
    },
  }

  return {
    capability,
    subscribe,
    getVersion: () => version,
    findReviewRequest(requestId) {
      const data = current()
      const row = data.requests.find((candidate) => candidate.id === requestId)
      if (!row) return null
      const booking = data.bookings.find((candidate) => candidate.id === row.bookingId)
      const proposal = booking ? data.proposals.find((candidate) => candidate.id === booking.proposalId) : null
      if (booking && (booking.requestId !== row.id || booking.pageId !== row.pageId || !proposal || proposal.requestId !== row.id
        || row.currentProposalId !== proposal.id || row.proposalVersion !== proposal.version
        || booking.startAt !== proposal.startAt || booking.endAt !== proposal.endAt)) return null
      return {
        requestId: row.id,
        requesterId: row.requesterId,
        providerId: proposal?.authorId ?? null,
        pageId: row.pageId,
        offerId: row.offerId,
        status: effectiveOf(row, store.now()),
        booking: booking ? { status: booking.status, endAt: booking.endAt } : null,
        noShowContested: row.contestedAt != null,
      }
    },
  }

  /** Le constat de la page après le début : réalisation ou absence, jamais déduit d'un silence. */
  async function closeBooking(requestId: string, action: Extract<ServiceRequestAction, "complete" | "no_show">): Promise<ActionResult> {
    const access = viewer("publish")
    if (!access.ok) return fail(access.code)
    const found = participantRow(requestId, access.personId)
    if (!found || found.actor !== "page") return fail("not_found")
    const { data, row } = found
    const now = store.now()
    const booking = data.bookings.find((candidate) => candidate.id === row.bookingId)
    const transition = checkServiceRequestTransition({ action, actor: "page", status: effectiveOf(row, now), now, bookingStartAt: booking ? booking.startAt : null })
    if (!transition.ok) return fail(transition.code)
    const status = transition.value === "completed" ? "completed" : "no_show"
    commit({
      ...data,
      bookings: data.bookings.map((candidate) => (candidate.id === booking?.id ? { ...candidate, status } : candidate)),
      requests: replaceRequest(data, { ...row, status, closedBy: "page", closedAt: now, updatedAt: now }),
    })
    return OK
  }
}
