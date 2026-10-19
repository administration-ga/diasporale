/**
 * Avis FICTIFS (DG-016), dans ce seul navigateur et un stockage séparé, remis
 * à zéro avec la démonstration. Les prestations viennent exclusivement du
 * fournisseur des demandes : aucune preuve ni réservation n'est inventée ici.
 * Toute création/édition attend la modération. Cette démonstration ne dispose
 * d'aucun modérateur : elle n'approuve jamais un contenu et ne transmet aucun
 * signalement à une équipe réelle. Un signalement masque localement sa cible.
 */
import {
  checkServiceReviewActive,
  checkServiceReviewVersion,
  hasCapability,
  parseServiceReview,
  parseServiceReviewReply,
  SERVICE_REVIEW_PROOFS,
  serviceReviewEligibility,
  type MemberCapability,
  type ServiceReviewProof,
  type ServiceReviewStatus,
} from "@diasporale/domain"
import { useMemo, useSyncExternalStore } from "react"

import type { ActionErrorCode } from "../data/errors"
import type { ActionResult } from "../data/port"
import {
  SERVICE_REVIEW_REPORT_REASONS,
  SERVICE_REVIEWS_PAGE_SIZE,
  type MyServiceReviewView,
  type PageServiceReviewsPageView,
  type PageServiceReviewView,
  type ServiceReviewModeration,
  type ServiceReviewReportReason,
  type ServiceReviewsCapability,
  type ServiceReviewsPageView,
  type ServiceReviewView,
} from "../data/service-reviews-port"
import type { Loadable } from "../data/types"
import { statusOf } from "./selectors"
import type { DemoServiceReviewRequest, DemoServiceRequestsContext } from "./service-requests"
import type { DemoOfferRef } from "./services"
import type { DemoStore } from "./store"

export const DEMO_SERVICE_REVIEWS_STORAGE_KEY = "diasporale:demonstration:avis:v1"
type DemoStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">
interface Teams {
  readonly signatoriesOf: (pageId: string) => readonly string[]
  readonly subscribe: (listener: () => void) => () => void
  readonly getVersion: () => number
}
export interface DemoServiceReviewsDeps {
  readonly requests: Pick<DemoServiceRequestsContext, "findReviewRequest" | "subscribe" | "getVersion">
  readonly teams: Teams
  readonly findOffer: (offerId: string) => DemoOfferRef | null
  readonly storage?: DemoStorage | null
}
interface DemoReviewRow {
  readonly id: string
  readonly requestId: string
  readonly pageId: string
  readonly offerId: string
  readonly authorId: string
  readonly rating: number
  readonly body: string
  readonly proof: ServiceReviewProof
  readonly consentToPublishAt: number
  readonly version: number
  readonly status: ServiceReviewStatus
  readonly moderation: ServiceReviewModeration
  readonly createdAt: number
  readonly updatedAt: number
}
interface DemoReplyRow {
  readonly id: string
  readonly reviewId: string
  readonly authorId: string
  readonly body: string
  readonly version: number
  readonly status: ServiceReviewStatus
  readonly moderation: ServiceReviewModeration
  readonly createdAt: number
  readonly updatedAt: number
}
interface DemoReviewReport {
  readonly reporterId: string
  readonly target: { readonly kind: "review" | "reply"; readonly id: string }
  readonly reason: ServiceReviewReportReason
  readonly createdAt: number
}
export interface DemoServiceReviewsState {
  readonly version: 1
  readonly seedCreatedAt: number
  readonly sequence: number
  readonly reviews: readonly DemoReviewRow[]
  readonly replies: readonly DemoReplyRow[]
  readonly reports: readonly DemoReviewReport[]
}

const CURSOR_TAG = "demo-service-reviews"
const PAGE_CURSOR_TAG = "demo-page-service-reviews"
const OK: ActionResult = { ok: true, value: null }
const LOADING = { status: "loading" } as const
const fail = (code: ActionErrorCode): ActionResult<never> => ({ ok: false, code })
const failed = <T,>(code: ActionErrorCode): Loadable<T> => ({ status: "error", code })
const ready = <T,>(data: T): Loadable<T> => ({ status: "ready", data })

function defaultStorage(): DemoStorage | null {
  try { return typeof window === "undefined" ? null : window.localStorage } catch { return null }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
function isRow(value: unknown): value is Omit<DemoReplyRow, "reviewId"> {
  return isRecord(value) && typeof value.id === "string" && typeof value.authorId === "string" && typeof value.body === "string"
    && Number.isSafeInteger(value.version) && (value.version as number) > 0
    && (value.status === "active" || value.status === "withdrawn")
    && (value.moderation === "published" || value.moderation === "pending_review" || value.moderation === "removed")
    && typeof value.createdAt === "number" && Number.isFinite(value.createdAt) && typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
}
function isState(value: unknown): value is DemoServiceReviewsState {
  return isRecord(value) && value.version === 1 && typeof value.seedCreatedAt === "number" && Number.isFinite(value.seedCreatedAt)
    && Number.isSafeInteger(value.sequence) && (value.sequence as number) > 0
    && Array.isArray(value.reviews) && value.reviews.every((row: unknown) => isRecord(row)
      && typeof row.requestId === "string" && typeof row.pageId === "string" && typeof row.offerId === "string"
      && Number.isInteger(row.rating) && (row.rating as number) >= 1 && (row.rating as number) <= 5
      && SERVICE_REVIEW_PROOFS.some((proof) => proof === row.proof) && typeof row.consentToPublishAt === "number" && isRow(row))
    && Array.isArray(value.replies) && value.replies.every((row: unknown) => isRecord(row) && typeof row.reviewId === "string" && isRow(row))
    && Array.isArray(value.reports) && value.reports.every((row: unknown) => isRecord(row) && typeof row.reporterId === "string"
      && isRecord(row.target) && (row.target.kind === "review" || row.target.kind === "reply") && typeof row.target.id === "string"
      && SERVICE_REVIEW_REPORT_REASONS.some((reason) => reason === row.reason) && typeof row.createdAt === "number")
}

export function createDemoServiceReviews(store: DemoStore, deps: DemoServiceReviewsDeps): ServiceReviewsCapability {
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage
  let state: DemoServiceReviewsState | null = null
  let version = 0
  const listeners = new Set<() => void>()
  const empty = (seedCreatedAt: number): DemoServiceReviewsState => ({ version: 1, seedCreatedAt, sequence: 1, reviews: [], replies: [], reports: [] })

  function current(): DemoServiceReviewsState {
    const seed = store.getState().createdAt
    if (state !== null) {
      if (state.seedCreatedAt !== seed) {
        state = empty(seed)
        try { storage?.removeItem(DEMO_SERVICE_REVIEWS_STORAGE_KEY) } catch { /* La remise à zéro en mémoire suffit. */ }
      }
      return state
    }
    try {
      const raw = storage?.getItem(DEMO_SERVICE_REVIEWS_STORAGE_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : null
      if (isState(parsed) && parsed.seedCreatedAt === seed) return state = parsed
    } catch { /* Stockage illisible ou bloqué : une démonstration vide. */ }
    return state = empty(seed)
  }

  function commit(next: DemoServiceReviewsState): void {
    state = next
    version += 1
    try { storage?.setItem(DEMO_SERVICE_REVIEWS_STORAGE_KEY, JSON.stringify(next)) } catch { /* La démonstration continue en mémoire. */ }
    for (const listener of listeners) listener()
  }
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    const subscriptions = [store.subscribe(listener), deps.requests.subscribe(listener), deps.teams.subscribe(listener)]
    return () => { listeners.delete(listener); subscriptions.forEach((unsubscribe) => unsubscribe()) }
  }
  const snapshot = () => `${store.getVersion()}:${version}:${deps.requests.getVersion()}:${deps.teams.getVersion()}`
  const useSnapshot = () => useSyncExternalStore(subscribe, snapshot, () => "")

  function viewer(capability: MemberCapability): { readonly ok: true; readonly personId: string } | { readonly ok: false; readonly code: ActionErrorCode } {
    const main = store.getState()
    const personId = main.session.personId
    if (!personId || !main.persons[personId]) return { ok: false, code: "not_signed_in" }
    const status = statusOf(main, personId, store.now())
    if (!main.memberships[personId] || status === null || status === "partie") return { ok: false, code: "not_member" }
    if (status === "suspendue") return { ok: false, code: "suspended" }
    if (!hasCapability(status, capability)) return { ok: false, code: capability === "read_network" ? "not_member" : "status_insufficient" }
    return { ok: true, personId }
  }
  function blocked(a: string, b: string): boolean {
    return store.getState().blocks.some((row) => (row.byId === a && row.targetId === b) || (row.byId === b && row.targetId === a))
  }
  function requestOf(requestId: string): DemoServiceReviewRequest | null {
    const request = deps.requests.findReviewRequest(requestId)
    const offer = request && deps.findOffer(request.offerId)
    return request && offer && offer.pageId === request.pageId && store.getState().pages[request.pageId] ? request : null
  }
  function eligibility(request: DemoServiceReviewRequest, personId: string) {
    return serviceReviewEligibility({
      isRequester: request.requesterId === personId,
      isProvider: request.providerId === personId || deps.teams.signatoriesOf(request.pageId).includes(personId),
      requestStatus: request.status,
      bookingStatus: request.booking?.status ?? null,
      bookingEndAt: request.booking?.endAt ?? null,
      // DG-015 : une absence contestée ne retire pas son avis à la personne qui demande.
      noShowContested: request.noShowContested,
      now: store.now(),
    })
  }
  function sourcesMatch(row: DemoReviewRow): boolean {
    const request = requestOf(row.requestId)
    return request !== null && request.requesterId === row.authorId && request.offerId === row.offerId && request.pageId === row.pageId && eligibility(request, row.authorId).ok
  }
  function reported(kind: "review" | "reply", id: string, personId: string): boolean {
    return current().reports.some((row) => row.reporterId === personId && row.target.kind === kind && row.target.id === id)
  }
  function visibleReview(row: DemoReviewRow, personId: string): boolean {
    return row.status === "active" && row.moderation === "published" && sourcesMatch(row) && !blocked(row.authorId, personId) && !reported("review", row.id, personId)
  }
  function view(row: DemoReviewRow, personId: string): ServiceReviewView {
    const person = store.getState().persons[row.authorId]
    const mine = row.authorId === personId
    const manager = !mine && deps.teams.signatoriesOf(row.pageId).includes(personId)
    const redacted = row.status === "withdrawn" || row.moderation === "removed"
    const reply = current().replies.find((candidate) => candidate.reviewId === row.id)
    const canManageReply = !redacted && reply !== undefined && !blocked(personId, reply.authorId) && manager && reply.status === "active" && reply.moderation !== "removed"
    const replyVisible = !redacted && reply && !blocked(personId, reply.authorId) && !reported("reply", reply.id, personId)
      && (reply.status === "withdrawn" || reply.moderation === "published" || (manager && reply.moderation === "pending_review"))
    return {
      reviewId: row.id, pageId: row.pageId, offerId: row.offerId, rating: row.rating,
      body: redacted ? "" : row.body,
      proof: row.proof, version: row.version, status: row.status, moderation: row.moderation,
      author: { displayName: !redacted && person?.withdrawnAt === undefined ? person?.profile?.displayName ?? null : null },
      isMine: mine,
      canReply: viewer("publish").ok && manager && row.status === "active" && row.moderation === "published" && (!reply || canManageReply),
      reply: reply && replyVisible ? {
        replyId: reply.id, body: reply.status === "withdrawn" || reply.moderation === "removed" ? "" : reply.body,
        version: reply.version, status: reply.status, moderation: reply.moderation,
        canManage: canManageReply,
        createdAt: reply.createdAt, updatedAt: reply.updatedAt,
      } : null,
      createdAt: row.createdAt, updatedAt: row.updatedAt,
    }
  }
  function replyRight(reviewId: string, personId: string): DemoReviewRow | null {
    const row = current().reviews.find((candidate) => candidate.id === reviewId)
    return row && row.authorId !== personId && visibleReview(row, personId) && deps.teams.signatoriesOf(row.pageId).includes(personId) ? row : null
  }
  function replaceReview(row: DemoReviewRow): readonly DemoReviewRow[] {
    return current().reviews.map((candidate) => candidate.id === row.id ? row : candidate)
  }

  return {
    useOfferReviews({ offerId, cursor }) {
      const tick = useSnapshot()
      return useMemo<Loadable<ServiceReviewsPageView>>(() => {
        if (tick === "") return LOADING
        const data = current()
        const access = viewer("read_network")
        if (!access.ok) return failed(access.code)
        const offer = deps.findOffer(offerId)
        if (!offer || offer.status !== "active" || !store.getState().pages[offer.pageId]) return failed("not_found")
        let boundary: { readonly createdAt: number; readonly id: string } | null = null
        if (cursor !== null) {
          try {
            const parsed: unknown = JSON.parse(cursor)
            if (!Array.isArray(parsed) || parsed.length !== 4 || parsed[0] !== CURSOR_TAG || parsed[1] !== offerId || typeof parsed[2] !== "number" || !Number.isFinite(parsed[2]) || typeof parsed[3] !== "string") return failed("unknown")
            boundary = { createdAt: parsed[2], id: parsed[3] }
          } catch { return failed("unknown") }
        }
        const after = boundary
        const rows = data.reviews.filter((row) => row.offerId === offerId)
          .sort((a, b) => b.createdAt - a.createdAt || (a.id === b.id ? 0 : a.id < b.id ? 1 : -1))
          .filter((row) => after === null || row.createdAt < after.createdAt || (row.createdAt === after.createdAt && row.id < after.id))
        const page = rows.slice(0, SERVICE_REVIEWS_PAGE_SIZE)
        const last = page[page.length - 1]
        const isDone = rows.length <= SERVICE_REVIEWS_PAGE_SIZE
        return ready({ items: page.filter((row) => visibleReview(row, access.personId)).map((row) => view(row, access.personId)), isDone, continueCursor: !isDone && last ? JSON.stringify([CURSOR_TAG, offerId, last.createdAt, last.id]) : null })
      }, [tick, offerId, cursor])
    },

    usePageReviews({ pageId, personId, cursor }) {
      const tick = useSnapshot()
      return useMemo<Loadable<PageServiceReviewsPageView>>(() => {
        if (tick === "") return LOADING
        const data = current()
        const access = viewer("read_network")
        if (!access.ok) return failed(access.code)
        if (personId !== access.personId) return failed("not_found")
        const page = store.getState().pages[pageId]
        if (!page || (page.ownerKind !== "association" && page.ownerKind !== "company")) return failed("not_found")
        let boundary: { readonly createdAt: number; readonly id: string } | null = null
        if (cursor !== null) {
          if (cursor.length > 1024) return failed("unknown")
          try {
            const parsed: unknown = JSON.parse(cursor)
            if (!Array.isArray(parsed) || parsed.length !== 6 || parsed[0] !== PAGE_CURSOR_TAG
              || parsed[1] !== pageId || parsed[2] !== personId || parsed[3] !== data.seedCreatedAt
              || typeof parsed[4] !== "number" || !Number.isFinite(parsed[4])
              || typeof parsed[5] !== "string" || parsed[5].length === 0 || parsed[5].length > 256) return failed("unknown")
            boundary = { createdAt: parsed[4], id: parsed[5] }
          } catch { return failed("unknown") }
        }
        const after = boundary
        const rows = data.reviews.filter((row) => row.pageId === pageId)
          .sort((a, b) => b.createdAt - a.createdAt || (a.id === b.id ? 0 : a.id < b.id ? 1 : -1))
          .filter((row) => after === null || row.createdAt < after.createdAt || (row.createdAt === after.createdAt && row.id < after.id))
        // La fenêtre est bornée avant les gardes de visibilité : une fenêtre vide
        // peut donc continuer, sans sonder davantage d'avis pour la remplir.
        const batch = rows.slice(0, SERVICE_REVIEWS_PAGE_SIZE)
        const last = batch[batch.length - 1]
        const isDone = rows.length <= SERVICE_REVIEWS_PAGE_SIZE
        const items: PageServiceReviewView[] = []
        for (const row of batch) {
          const offer = deps.findOffer(row.offerId)
          if (!offer || offer.pageId !== pageId || offer.status !== "active" || !visibleReview(row, access.personId)) continue
          items.push({ ...view(row, access.personId), offerTitle: offer.title })
        }
        return ready({
          items,
          isDone,
          continueCursor: !isDone && last ? JSON.stringify([PAGE_CURSOR_TAG, pageId, personId, data.seedCreatedAt, last.createdAt, last.id]) : null,
        })
      }, [tick, pageId, personId, cursor])
    },

    useMyReview({ requestId }) {
      const tick = useSnapshot()
      return useMemo<Loadable<MyServiceReviewView | null>>(() => {
        if (tick === "") return LOADING
        const data = current()
        const access = viewer("read_network")
        if (!access.ok) return failed(access.code)
        const request = requestOf(requestId)
        if (!request || request.requesterId !== access.personId) return ready(null)
        const result = eligibility(request, access.personId)
        const row = data.reviews.find((candidate) => candidate.requestId === requestId && candidate.authorId === access.personId)
        if (row && (row.pageId !== request.pageId || row.offerId !== request.offerId)) return ready(null)
        return ready({
          canCreate: !row && result.ok && viewer("publish").ok,
          refusal: row ? row.status === "withdrawn" ? "review_withdrawn" : "review_already_exists" : result.ok ? null : result.code,
          proof: row?.proof ?? (result.ok ? result.value : null),
          review: row ? view(row, access.personId) : null,
        })
      }, [tick, requestId])
    },

    async publish(input) {
      const access = viewer("publish")
      if (!access.ok) return fail(access.code)
      const parsed = parseServiceReview(input)
      if (!parsed.ok) return fail(parsed.code)
      const request = requestOf(input.requestId)
      if (!request || request.requesterId !== access.personId) return fail("not_found")
      const proof = eligibility(request, access.personId)
      if (!proof.ok) return fail(proof.code)
      if (request.providerId && blocked(access.personId, request.providerId)) return fail("not_found")
      const data = current()
      const existing = data.reviews.find((row) => row.requestId === input.requestId && row.authorId === access.personId)
      if (existing) {
        const active = checkServiceReviewActive(existing.status)
        if (!active.ok) return fail(active.code)
        if (existing.moderation === "removed") return fail("review_not_published")
        return existing.rating === parsed.value.rating && existing.body === parsed.value.body
          ? { ok: true, value: { reviewId: existing.id, created: false } } : fail("review_already_exists")
      }
      const now = store.now()
      const reviewId = `avis-demo-${data.sequence}`
      commit({ ...data, sequence: data.sequence + 1, reviews: [...data.reviews, {
        id: reviewId, requestId: input.requestId, pageId: request.pageId, offerId: request.offerId, authorId: access.personId,
        ...parsed.value, proof: proof.value, consentToPublishAt: now, status: "active", moderation: "pending_review", version: 1, createdAt: now, updatedAt: now,
      }] })
      return { ok: true, value: { reviewId, created: true } }
    },

    async update(input) {
      const access = viewer("publish")
      if (!access.ok) return fail(access.code)
      const row = current().reviews.find((candidate) => candidate.id === input.reviewId && candidate.authorId === access.personId)
      if (!row) return fail("not_found")
      const expected = checkServiceReviewVersion(input.expectedVersion, row.version)
      if (!expected.ok) return fail(expected.code)
      const active = checkServiceReviewActive(row.status)
      if (!active.ok) return fail(active.code)
      const request = requestOf(row.requestId)
      if (!request || request.requesterId !== row.authorId || request.pageId !== row.pageId || request.offerId !== row.offerId) return fail("not_found")
      const eligible = eligibility(request, access.personId)
      if (!eligible.ok) return fail(eligible.code)
      if (request.providerId && blocked(access.personId, request.providerId)) return fail("not_found")
      const parsed = parseServiceReview({ ...input, consentToPublish: true })
      if (!parsed.ok) return fail(parsed.code)
      if (row.moderation === "removed") return fail("review_not_published")
      commit({ ...current(), reviews: replaceReview({ ...row, ...parsed.value, moderation: "pending_review", version: row.version + 1, updatedAt: store.now() }) })
      return OK
    },

    async withdraw({ reviewId, expectedVersion }) {
      const access = viewer("read_network")
      if (!access.ok) return fail(access.code)
      const row = current().reviews.find((candidate) => candidate.id === reviewId && candidate.authorId === access.personId)
      if (!row) return fail("not_found")
      const expected = checkServiceReviewVersion(expectedVersion, row.version)
      if (!expected.ok) return fail(expected.code)
      const active = checkServiceReviewActive(row.status)
      if (!active.ok) return fail(active.code)
      commit({ ...current(), reviews: replaceReview({ ...row, status: "withdrawn", version: row.version + 1, updatedAt: store.now() }) })
      return OK
    },

    async reply({ reviewId, expectedVersion, body }) {
      const access = viewer("publish")
      if (!access.ok) return fail(access.code)
      if (!replyRight(reviewId, access.personId)) return fail("not_found")
      const parsed = parseServiceReviewReply(body)
      if (!parsed.ok) return fail(parsed.code)
      const data = current()
      const existing = data.replies.find((row) => row.reviewId === reviewId)
      const now = store.now()
      if (existing) {
        if (expectedVersion === null) return fail("review_version_changed")
        const expected = checkServiceReviewVersion(expectedVersion, existing.version)
        if (!expected.ok) return fail(expected.code)
        if (existing.status !== "active") return fail("review_reply_unavailable")
        if (existing.moderation === "removed") return fail("review_not_published")
        commit({ ...data, replies: data.replies.map((row) => row.id === existing.id ? { ...row, body: parsed.value, authorId: access.personId, moderation: "pending_review", version: row.version + 1, updatedAt: now } : row) })
      } else {
        if (expectedVersion !== null) return fail("review_version_changed")
        commit({ ...data, sequence: data.sequence + 1, replies: [...data.replies, { id: `reponse-avis-demo-${data.sequence}`, reviewId, authorId: access.personId, body: parsed.value, status: "active", moderation: "pending_review", version: 1, createdAt: now, updatedAt: now }] })
      }
      return OK
    },

    async withdrawReply({ reviewId, expectedVersion }) {
      const access = viewer("read_network")
      if (!access.ok) return fail(access.code)
      if (!replyRight(reviewId, access.personId)) return fail("not_found")
      const data = current()
      const reply = data.replies.find((row) => row.reviewId === reviewId)
      if (!reply) return fail("not_found")
      const expected = checkServiceReviewVersion(expectedVersion, reply.version)
      if (!expected.ok) return fail(expected.code)
      if (reply.status !== "active") return fail("review_reply_unavailable")
      commit({ ...data, replies: data.replies.map((row) => row.id === reply.id ? { ...row, status: "withdrawn", version: row.version + 1, updatedAt: store.now() } : row) })
      return OK
    },

    async report({ target, reason }) {
      const access = viewer("read_network")
      if (!access.ok) return fail(access.code)
      if (!SERVICE_REVIEW_REPORT_REASONS.includes(reason)) return fail("report_reason_required")
      const data = current()
      if (reported(target.kind, target.id, access.personId)) return OK
      const reply = target.kind === "reply" ? data.replies.find((row) => row.id === target.id) : null
      const row = data.reviews.find((candidate) => candidate.id === (target.kind === "review" ? target.id : reply?.reviewId))
      if (!row || !visibleReview(row, access.personId)) return fail("not_found")
      if (target.kind === "review" ? row.authorId === access.personId : !reply || reply.authorId === access.personId || !view(row, access.personId).reply || reply.status !== "active" || reply.moderation !== "published") return fail("not_found")
      commit({ ...data, reports: [...data.reports, { reporterId: access.personId, target: { kind: target.kind, id: target.id }, reason, createdAt: store.now() }] })
      return OK
    },
  }
}
