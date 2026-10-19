/**
 * Démonstration de la capacité « mentorat » (DG-024, troisième tranche).
 * PROPRIÉTAIRE : ce chantier.
 *
 * Données explicitement FICTIVES, dans ce seul navigateur, à part de l'état
 * principal (une clé de stockage à elles) et remises à zéro avec lui. Les règles
 * sont celles du moteur, appliquées par `@diasporale/domain` dans le même ordre :
 * session → adhésion → capacité → droit (le mentor sur son profil ; le mentoré
 * ou le mentor sur LEUR demande) → règles du geste. Une demande d'autrui est
 * introuvable ; un mentor en pause, retiré ou bloqué aussi.
 *
 * Mentors fictifs de départ, posés sur les comptes de démonstration existants :
 * Mireille (Paris), Nadia (Bruxelles) et Rodrigue (Montréal) actifs, Clarisse
 * (Paris) en pause ; une demande de Steeve attend la réponse de Mireille. La
 * ville d'un mentor suit la visibilité de SA facette : Prisca, relation de
 * Mireille, voit sa ville ; Steeve ne la voit pas.
 *
 * La démonstration ne modère jamais : tout y est publié. Cet état n'en suit pas
 * moins la forme du moteur (G9) : servi aux seules vues de gestion (mon profil de
 * mentor, mes demandes de mentoré), jamais à une demande lue par son mentor.
 */
import { isProfileDiscoverable, isProfilePublished } from "@antsia/social-domain/content"
import {
  availableMentoringActions,
  checkMentorCapacity,
  checkMentorCapacityChange,
  checkMentoringAdmission,
  checkMentoringRequestTiming,
  checkMentoringSlotVersion,
  checkMentoringTransition,
  checkMentorOptIn,
  checkMentorProfileEditable,
  checkMentorProfileVersion,
  DAY_MS,
  effectiveMentoringStatus,
  hasCapability,
  isMentoringIdempotencyKey,
  mentorAcceptsRequests,
  mentoringRequestDeadline,
  mentoringRequestFingerprint,
  normalizeMentoringRequestDraft,
  parseMentoringReason,
  parseMentoringSlot,
  parseMentorProfile,
  projectMentorPlace,
  transitionMentorState,
  type CountryCode,
  type MemberCapability,
  type MentoringCloser,
  type MentoringDomain,
  type MentoringRequestStatus,
  type MentoringRole,
  type MentoringSlot,
  type MentorProfileDraft,
  type MentorProfileState,
} from "@diasporale/domain"
import { useMemo, useSyncExternalStore } from "react"

import type { ActionErrorCode } from "../data/errors"
import type { ManagedModerationState } from "../data/managed-moderation"
import {
  MENTORING_REQUESTS_PAGE_SIZE,
  MENTORS_PAGE_SIZE,
  type MentorCardView,
  type MentorDetailView,
  type MentoringCapability,
  type MentoringPage,
  type MentoringProposedSlotView,
  type MentoringRequestDetailView,
  type MentoringRequestSummaryView,
  type MyMentorProfileView,
} from "../data/mentoring-port"
import type { ActionResult } from "../data/port"
import type { Loadable } from "../data/types"
import type { DemoState } from "./state"
import { badgesOfPerson, isConnected, statusOf } from "./selectors"
import type { DemoStore } from "./store"

export const DEMO_MENTORING_STORAGE_KEY = "diasporale:demonstration:mentorat:v1"

type DemoStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

export interface DemoMentoringDeps {
  /** Le stockage du mentorat ; `null` : en mémoire seulement. Par défaut, celui du navigateur. */
  readonly storage?: DemoStorage | null
}

interface DemoMentorRow {
  readonly id: string
  readonly personId: string
  readonly state: MentorProfileState
  readonly domains: readonly MentoringDomain[]
  readonly presentation: string
  readonly languages: readonly string[]
  readonly country: CountryCode
  readonly city: string | null
  readonly availability: string
  readonly maxActiveMentees: number
  readonly version: number
  readonly optedInAt: number
  readonly listedAt: number
  readonly updatedAt: number
}

interface DemoMentoringRequestRow {
  readonly id: string
  readonly mentorId: string
  readonly mentorPersonId: string
  readonly menteePersonId: string
  readonly domain: MentoringDomain
  readonly goal: string
  readonly message: string
  readonly wishedSlots: readonly MentoringSlot[]
  readonly timeZone: string
  readonly status: MentoringRequestStatus
  readonly consentAt: number
  readonly idempotencyKey: string
  readonly fingerprint: string
  readonly expiresAt: number
  readonly slot: MentoringProposedSlotView | null
  readonly slotVersion: number
  readonly acceptedAt: number | null
  readonly closedBy: MentoringCloser | null
  readonly closedReason: string | null
  readonly closedAt: number | null
  readonly createdAt: number
  readonly updatedAt: number
}

export interface DemoMentoringState {
  readonly version: 1
  /** L'état principal dont ce mentorat est le prolongement : sa remise à zéro le remet à zéro. */
  readonly seedCreatedAt: number
  readonly sequence: number
  readonly mentors: readonly DemoMentorRow[]
  readonly requests: readonly DemoMentoringRequestRow[]
}

const CURSOR_TAG = "demo-mentoring"
const OK: ActionResult = { ok: true, value: null }
const LOADING = { status: "loading" } as const
/** L'état de modération de tout contenu de la démonstration, qui ne modère jamais. */
const DEMO_MODERATION: ManagedModerationState = "published"

function fail(code: ActionErrorCode): ActionResult<never> {
  return { ok: false, code }
}

function failed<T>(code: ActionErrorCode): Loadable<T> {
  return { status: "error", code }
}

function ready<T>(data: T): Loadable<T> {
  return { status: "ready", data }
}

function defaultStorage(): DemoStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

function isState(value: unknown): value is DemoMentoringState {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<DemoMentoringState>
  return candidate.version === 1 && typeof candidate.seedCreatedAt === "number" && typeof candidate.sequence === "number"
    && Array.isArray(candidate.mentors) && Array.isArray(candidate.requests)
}

/** Les mentors fictifs de départ, datés par rapport au premier chargement de la démonstration. */
export function demoMentoringSeed(seedCreatedAt: number): DemoMentoringState {
  const at = (days: number) => seedCreatedAt - days * DAY_MS
  const mentor = (row: Omit<DemoMentorRow, "version" | "optedInAt" | "listedAt" | "updatedAt">, days: number): DemoMentorRow => ({
    ...row,
    version: 1,
    optedInAt: at(days),
    listedAt: at(days),
    updatedAt: at(days),
  })
  const pendingAt = at(1)
  return {
    version: 1,
    seedCreatedAt,
    sequence: 1,
    mentors: [
      mentor({
        id: "mentor-demo-mireille",
        personId: "p-mireille",
        state: "active",
        domains: ["housing", "family", "admin"],
        presentation: "Installée à Paris de longue date (démo), j'aide les nouveaux arrivants à chercher un logement et à faire leurs premières démarches.",
        languages: ["fr"],
        country: "FR",
        city: "Paris",
        availability: "Le soir en semaine et le samedi matin",
        maxActiveMentees: 3,
      }, 300),
      mentor({
        id: "mentor-demo-nadia",
        personId: "p-nadia",
        state: "active",
        domains: ["work", "admin"],
        presentation: "Entrepreneuse à Bruxelles (démo) : je partage mon expérience de la recherche d'emploi et de la création d'une activité.",
        languages: ["fr", "en"],
        country: "BE",
        city: "Bruxelles",
        availability: "En semaine, à l'heure du déjeuner",
        maxActiveMentees: 2,
      }, 200),
      mentor({
        id: "mentor-demo-rodrigue",
        personId: "p-rodrigue",
        state: "active",
        domains: ["studies", "work"],
        presentation: "Ingénieur à Montréal (démo) : études, équivalences de diplômes et premiers pas dans l'emploi.",
        languages: ["fr", "en"],
        country: "CA",
        city: "Montréal",
        availability: "Le week-end",
        maxActiveMentees: 2,
      }, 20),
      mentor({
        id: "mentor-demo-clarisse",
        personId: "p-clarisse",
        state: "paused",
        domains: ["admin"],
        presentation: "Je connais bien les démarches de la vie quotidienne à Paris (démo), en pause pour le moment.",
        languages: ["fr"],
        country: "FR",
        city: "Paris",
        availability: "Ponctuellement",
        maxActiveMentees: 1,
      }, 100),
    ],
    requests: [
      {
        id: "mentorat-demo-steeve",
        mentorId: "mentor-demo-mireille",
        mentorPersonId: "p-mireille",
        menteePersonId: "p-steeve",
        domain: "housing",
        goal: "Trouver un logement à Paris",
        message: "Je dois m'installer à Paris pour un stage (démo) et je cherche des conseils pour trouver un logement.",
        wishedSlots: [],
        timeZone: "Europe/Paris",
        status: "sent",
        consentAt: pendingAt,
        idempotencyKey: "demo-mentorat-steeve-0001",
        fingerprint: "demo",
        expiresAt: pendingAt + 14 * DAY_MS,
        slot: null,
        slotVersion: 0,
        acceptedAt: null,
        closedBy: null,
        closedReason: null,
        closedAt: null,
        createdAt: pendingAt,
        updatedAt: pendingAt,
      },
    ],
  }
}

function isBlocked(main: DemoState, a: string, b: string): boolean {
  return main.blocks.some((block) => (block.byId === a && block.targetId === b) || (block.byId === b && block.targetId === a))
}

function draftFields(draft: MentorProfileDraft) {
  return {
    domains: draft.domains,
    presentation: draft.presentation,
    languages: draft.languages,
    country: draft.country,
    city: draft.city,
    availability: draft.availability,
    maxActiveMentees: draft.maxActiveMentees,
  }
}

export function createDemoMentoring(store: DemoStore, deps: DemoMentoringDeps = {}): MentoringCapability {
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage
  const listeners = new Set<() => void>()
  let version = 0
  let state: DemoMentoringState | null = null

  function load(seedCreatedAt: number): DemoMentoringState {
    try {
      const raw = storage?.getItem(DEMO_MENTORING_STORAGE_KEY)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (isState(parsed) && parsed.seedCreatedAt === seedCreatedAt) return parsed
      }
    } catch {
      // Stockage illisible ou bloqué : on repart des mentors fictifs de départ.
    }
    return demoMentoringSeed(seedCreatedAt)
  }

  /** L'état courant ; une remise à zéro de la démonstration le remet à zéro. */
  function current(): DemoMentoringState {
    const seedCreatedAt = store.getState().createdAt
    if (state === null || state.seedCreatedAt !== seedCreatedAt) state = load(seedCreatedAt)
    return state
  }

  function commit(next: DemoMentoringState): void {
    state = next
    version += 1
    try {
      storage?.setItem(DEMO_MENTORING_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Stockage plein ou interdit : la démonstration continue en mémoire.
    }
    for (const listener of listeners) listener()
  }

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    const unsubscribe = store.subscribe(listener)
    return () => {
      listeners.delete(listener)
      unsubscribe()
    }
  }
  /** Une session, une adhésion ou un mentorat qui change relit les vues. */
  const snapshot = () => `${store.getVersion()}:${version}`
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

  /** Le mentor se montre-t-il à ce lecteur ? Profil publié (découvrable sauf pour soi), membre qui agit, aucun blocage. */
  function visibleMentor(row: DemoMentorRow, viewerId: string): boolean {
    if (row.state === "retired") return false
    const main = store.getState()
    const person = main.persons[row.personId]
    if (!person?.profile || !isProfilePublished(person)) return false
    const isSelf = row.personId === viewerId
    if (!isSelf && (!isProfileDiscoverable(person) || isBlocked(main, viewerId, row.personId))) return false
    const status = statusOf(main, row.personId, store.now())
    return status !== null && hasCapability(status, "publish")
  }

  function countsOf(data: DemoMentoringState, mentorPersonId: string, now: number): { readonly activeMentees: number; readonly pendingRequests: number } {
    let activeMentees = 0
    let pendingRequests = 0
    for (const row of data.requests) {
      if (row.mentorPersonId !== mentorPersonId) continue
      if (row.status === "accepted") activeMentees += 1
      else if (row.status === "sent" && row.expiresAt > now) pendingRequests += 1
    }
    return { activeMentees, pendingRequests }
  }

  /** La carte d'un mentor VISIBLE pour ce lecteur : la ville et l'année d'arrivée selon sa facette. */
  function cardFor(data: DemoMentoringState, row: DemoMentorRow, viewerId: string, now: number): MentorCardView {
    const main = store.getState()
    const profile = main.persons[row.personId]?.profile
    const isSelf = row.personId === viewerId
    const facet = main.memberships[row.personId]?.facet ?? null
    const viewerStatus = statusOf(main, viewerId, now)
    const isActiveMember = viewerStatus === "declaree" || viewerStatus === "verifiee"
    const viewerCountry = main.memberships[viewerId]?.facet.countryOfResidence ?? null
    const place = projectMentorPlace({
      city: row.city,
      facet,
      viewer: {
        isSelf,
        isConnection: !isSelf && isConnected(main, viewerId, row.personId),
        isSameCountryMember: isActiveMember && facet !== null && viewerCountry === facet.countryOfResidence,
        isActiveMember,
      },
    })
    const { activeMentees, pendingRequests } = countsOf(data, row.personId, now)
    return {
      mentorId: row.id,
      personId: row.personId,
      displayName: profile?.displayName ?? "",
      handle: profile?.handle ?? "",
      badges: badgesOfPerson(main, row.personId, now),
      country: row.country,
      city: place.city,
      arrivedAt: place.arrivedAt,
      domains: row.domains,
      languages: row.languages,
      acceptsRequests: mentorAcceptsRequests({ state: row.state, activeMentees, maxActiveMentees: row.maxActiveMentees, pendingRequests }),
    }
  }

  /** La demande OUVERTE d'une paire : un mentorat en cours, ou une demande envoyée non échue. */
  function openPairRequest(data: DemoMentoringState, menteePersonId: string, mentorPersonId: string, now: number): DemoMentoringRequestRow | null {
    return data.requests.find((row) => row.menteePersonId === menteePersonId && row.mentorPersonId === mentorPersonId && (row.status === "accepted" || effectiveMentoringStatus(row, now) === "sent")) ?? null
  }

  function partyOf(personId: string): { readonly displayName: string | null; readonly handle: string | null } {
    const person = store.getState().persons[personId]
    const profile = person?.profile && isProfilePublished(person) ? person.profile : null
    return { displayName: profile?.displayName ?? null, handle: profile?.handle ?? null }
  }

  function summaryOf(row: DemoMentoringRequestRow, role: MentoringRole, now: number): MentoringRequestSummaryView {
    const status = effectiveMentoringStatus(row, now)
    return {
      requestId: row.id,
      status,
      viewerRole: role,
      mentorId: row.mentorId,
      counterpart: partyOf(role === "mentee" ? row.mentorPersonId : row.menteePersonId),
      domain: row.domain,
      goal: row.goal,
      wishedSlots: row.wishedSlots,
      timeZone: row.timeZone,
      slot: row.slot,
      deadlineAt: mentoringRequestDeadline({ status, expiresAt: row.expiresAt }),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      // Comme le moteur : l'état au seul mentoré, propriétaire de sa demande.
      ...(role === "mentee" ? { moderation: DEMO_MODERATION } : {}),
    }
  }

  function detailOf(row: DemoMentoringRequestRow, role: MentoringRole, now: number): MentoringRequestDetailView {
    const summary = summaryOf(row, role, now)
    return {
      ...summary,
      message: row.message,
      slotVersion: row.slotVersion,
      acceptedAt: row.acceptedAt,
      closedBy: row.closedBy,
      closedReason: row.closedReason,
      closedAt: row.closedAt,
      actions: availableMentoringActions({ role, status: summary.status }),
    }
  }

  /** Une fenêtre de liste à curseur opaque, comme la pagination du moteur (la plus récente d'abord). */
  function pageOf<Row, View>(
    rows: readonly Row[],
    cursor: string | null,
    size: number,
    keyOf: (row: Row) => { readonly at: number; readonly id: string },
    project: (row: Row) => View,
  ): Loadable<MentoringPage<View>> {
    let boundary: { readonly at: number; readonly id: string } | null = null
    if (cursor !== null) {
      try {
        const parsed: unknown = JSON.parse(cursor)
        if (!Array.isArray(parsed) || parsed.length !== 3 || parsed[0] !== CURSOR_TAG || typeof parsed[1] !== "number" || typeof parsed[2] !== "string") return failed("unknown")
        boundary = { at: parsed[1], id: parsed[2] }
      } catch {
        return failed("unknown")
      }
    }
    const after = boundary
    const remaining = [...rows]
      .sort((left, right) => {
        const a = keyOf(left)
        const b = keyOf(right)
        return b.at - a.at || (a.id === b.id ? 0 : a.id < b.id ? 1 : -1)
      })
      .filter((row) => {
        if (after === null) return true
        const key = keyOf(row)
        return key.at < after.at || (key.at === after.at && key.id < after.id)
      })
    const slice = remaining.slice(0, size)
    const last = slice[slice.length - 1]
    const isDone = remaining.length <= size
    return ready({
      items: slice.map(project),
      isDone,
      continueCursor: !isDone && last ? JSON.stringify([CURSOR_TAG, keyOf(last).at, keyOf(last).id]) : null,
    })
  }

  function roleOf(row: DemoMentoringRequestRow, personId: string): MentoringRole | null {
    if (row.menteePersonId === personId) return "mentee"
    if (row.mentorPersonId === personId) return "mentor"
    return null
  }

  /** La demande d'un participant, pour un geste : introuvable pour tout autre. */
  function participantRow(requestId: string, personId: string): { readonly data: DemoMentoringState; readonly row: DemoMentoringRequestRow; readonly role: MentoringRole } | null {
    const data = current()
    const row = data.requests.find((candidate) => candidate.id === requestId)
    const role = row ? roleOf(row, personId) : null
    return row && role ? { data, row, role } : null
  }

  function replaceRequest(data: DemoMentoringState, next: DemoMentoringRequestRow): readonly DemoMentoringRequestRow[] {
    return data.requests.map((row) => (row.id === next.id ? next : row))
  }

  function replaceMentor(data: DemoMentoringState, next: DemoMentorRow): readonly DemoMentorRow[] {
    return data.mentors.map((row) => (row.id === next.id ? next : row))
  }

  function ownMentor(data: DemoMentoringState, personId: string): DemoMentorRow | null {
    return data.mentors.find((row) => row.personId === personId) ?? null
  }

  /** Clore ou décliner une demande : le geste d'une partie, motif facultatif. */
  function closeWith(
    requestId: string,
    reason: string | null,
    gesture: { readonly action: "cancel" | "decline" | "close"; readonly role: MentoringRole | null; readonly to: "cancelled" | "declined" | "closed" },
  ): ActionResult {
    const access = viewer("read_network")
    if (!access.ok) return fail(access.code)
    const found = participantRow(requestId, access.personId)
    if (!found || (gesture.role !== null && found.role !== gesture.role)) return fail("not_found")
    const { data, row, role } = found
    const now = store.now()
    const transition = checkMentoringTransition({ action: gesture.action, role, status: effectiveMentoringStatus(row, now) })
    if (!transition.ok) return fail(transition.code)
    const motive = parseMentoringReason(reason)
    if (!motive.ok) return fail(motive.code)
    commit({ ...data, requests: replaceRequest(data, { ...row, status: gesture.to, closedBy: role, closedReason: motive.value, closedAt: now, updatedAt: now }) })
    return OK
  }

  return {
    useMyProfile() {
      const tick = useSnapshot()
      return useMemo<Loadable<MyMentorProfileView | null>>(() => {
        if (tick === "") return LOADING
        const access = viewer("read_network")
        if (!access.ok) return failed(access.code)
        const data = current()
        const row = ownMentor(data, access.personId)
        if (!row) return ready(null)
        const { activeMentees, pendingRequests } = countsOf(data, row.personId, store.now())
        return ready({
          mentorId: row.id,
          state: row.state,
          domains: row.domains,
          presentation: row.presentation,
          languages: row.languages,
          country: row.country,
          city: row.city,
          availability: row.availability,
          maxActiveMentees: row.maxActiveMentees,
          activeMentees,
          pendingRequests,
          version: row.version,
          optedInAt: row.optedInAt,
          updatedAt: row.updatedAt,
          moderation: DEMO_MODERATION,
        })
      }, [tick])
    },

    useSearch({ country, domain, cursor }) {
      const tick = useSnapshot()
      return useMemo<Loadable<MentoringPage<MentorCardView>>>(() => {
        if (tick === "") return LOADING
        const access = viewer("read_network")
        if (!access.ok) return failed(access.code)
        const data = current()
        const now = store.now()
        const rows = data.mentors.filter((row) => row.state === "active" && row.country === country && (domain === null || row.domains.includes(domain)) && visibleMentor(row, access.personId))
        return pageOf(rows, cursor, MENTORS_PAGE_SIZE, (row) => ({ at: row.listedAt, id: row.id }), (row) => cardFor(data, row, access.personId, now))
      }, [tick, country, domain, cursor])
    },

    useMentor(mentorId) {
      const tick = useSnapshot()
      return useMemo<Loadable<MentorDetailView | null>>(() => {
        if (tick === "") return LOADING
        const access = viewer("read_network")
        if (!access.ok) return failed(access.code)
        const data = current()
        const row = data.mentors.find((candidate) => candidate.id === mentorId)
        if (!row) return ready(null)
        const isSelf = row.personId === access.personId
        if ((!isSelf && row.state !== "active") || !visibleMentor(row, access.personId)) return ready(null)
        const now = store.now()
        const open = isSelf ? null : openPairRequest(data, access.personId, row.personId, now)
        return ready({
          ...cardFor(data, row, access.personId, now),
          presentation: row.presentation,
          availability: row.availability,
          state: row.state,
          isSelf,
          viewerRequest: open ? { requestId: open.id, status: effectiveMentoringStatus(open, now) } : null,
        })
      }, [tick, mentorId])
    },

    useMenteeRequests({ cursor }) {
      const tick = useSnapshot()
      return useMemo<Loadable<MentoringPage<MentoringRequestSummaryView>>>(() => {
        if (tick === "") return LOADING
        const access = viewer("read_network")
        if (!access.ok) return failed(access.code)
        const now = store.now()
        const rows = current().requests.filter((row) => row.menteePersonId === access.personId)
        return pageOf(rows, cursor, MENTORING_REQUESTS_PAGE_SIZE, (row) => ({ at: row.updatedAt, id: row.id }), (row) => summaryOf(row, "mentee", now))
      }, [tick, cursor])
    },

    useMentorRequests({ status, cursor }) {
      const tick = useSnapshot()
      return useMemo<Loadable<MentoringPage<MentoringRequestSummaryView>>>(() => {
        if (tick === "") return LOADING
        const access = viewer("read_network")
        if (!access.ok) return failed(access.code)
        const now = store.now()
        const rows = current().requests.filter((row) => row.mentorPersonId === access.personId && (status === null || effectiveMentoringStatus(row, now) === status))
        return pageOf(rows, cursor, MENTORING_REQUESTS_PAGE_SIZE, (row) => ({ at: row.updatedAt, id: row.id }), (row) => summaryOf(row, "mentor", now))
      }, [tick, status, cursor])
    },

    useRequest(requestId) {
      const tick = useSnapshot()
      return useMemo<Loadable<MentoringRequestDetailView | null>>(() => {
        if (tick === "") return LOADING
        const access = viewer("read_network")
        if (!access.ok) return failed(access.code)
        const found = participantRow(requestId, access.personId)
        return ready(found ? detailOf(found.row, found.role, store.now()) : null)
      }, [tick, requestId])
    },

    async becomeMentor(input) {
      const access = viewer("publish")
      if (!access.ok) return fail(access.code)
      const draft = parseMentorProfile(input)
      if (!draft.ok) return fail(draft.code)
      const data = current()
      const existing = ownMentor(data, access.personId)
      const optIn = checkMentorOptIn({ consent: input.consent, existing: existing?.state ?? null })
      if (!optIn.ok) return fail(optIn.code)
      const now = store.now()
      if (existing) {
        const next = existing.version + 1
        commit({ ...data, mentors: replaceMentor(data, { ...existing, ...draftFields(draft.value), state: "active", version: next, optedInAt: now, listedAt: now, updatedAt: now }) })
        return { ok: true, value: { mentorId: existing.id, version: next } }
      }
      const mentorId = `mentor-demo-${data.sequence}`
      commit({
        ...data,
        sequence: data.sequence + 1,
        mentors: [...data.mentors, { id: mentorId, personId: access.personId, ...draftFields(draft.value), state: "active", version: 1, optedInAt: now, listedAt: now, updatedAt: now }],
      })
      return { ok: true, value: { mentorId, version: 1 } }
    },

    async updateProfile(input) {
      const access = viewer("publish")
      if (!access.ok) return fail(access.code)
      const data = current()
      const existing = ownMentor(data, access.personId)
      if (!existing) return fail("not_found")
      const editable = checkMentorProfileEditable(existing.state)
      if (!editable.ok) return fail(editable.code)
      const next = checkMentorProfileVersion(input.expectedVersion, existing.version)
      if (!next.ok) return fail(next.code)
      const draft = parseMentorProfile(input)
      if (!draft.ok) return fail(draft.code)
      const now = store.now()
      const change = checkMentorCapacityChange(draft.value.maxActiveMentees, countsOf(data, existing.personId, now).activeMentees)
      if (!change.ok) return fail(change.code)
      commit({ ...data, mentors: replaceMentor(data, { ...existing, ...draftFields(draft.value), version: next.value, updatedAt: now }) })
      return { ok: true, value: { version: next.value } }
    },

    async setState({ expectedVersion, state: target }) {
      // Pause et retrait restent possibles à un membre redevenu « en attente » ; la reprise exige de pouvoir publier.
      const access = viewer(target === "active" ? "publish" : "read_network")
      if (!access.ok) return fail(access.code)
      const data = current()
      const existing = ownMentor(data, access.personId)
      if (!existing) return fail("not_found")
      const transition = transitionMentorState(existing.state, target)
      if (!transition.ok) return fail(transition.code)
      if (!transition.value.changed) return { ok: true, value: { state: existing.state, version: existing.version } }
      const next = checkMentorProfileVersion(expectedVersion, existing.version)
      if (!next.ok) return fail(next.code)
      const now = store.now()
      const nextState = transition.value.state
      // Le retrait décline les demandes en attente et clôt les mentorats en cours.
      const requests = nextState === "retired"
        ? data.requests.map((row): DemoMentoringRequestRow => {
            if (row.mentorPersonId !== existing.personId) return row
            if (row.status === "sent" && row.expiresAt > now) return { ...row, status: "declined", closedBy: "mentor", closedAt: now, updatedAt: now }
            if (row.status === "accepted") return { ...row, status: "closed", closedBy: "mentor", closedAt: now, updatedAt: now }
            return row
          })
        : data.requests
      commit({ ...data, requests, mentors: replaceMentor(data, { ...existing, state: nextState, version: next.value, updatedAt: now }) })
      return { ok: true, value: { state: nextState, version: next.value } }
    },

    async request(input) {
      const access = viewer("publish")
      if (!access.ok) return fail(access.code)
      if (!isMentoringIdempotencyKey(input.idempotencyKey)) return fail("unknown")
      const draft = normalizeMentoringRequestDraft(input)
      if (!draft.ok) return fail(draft.code)
      const fingerprint = mentoringRequestFingerprint({ mentorId: input.mentorId, ...draft.value })
      const data = current()
      // Rejeu AVANT les gardes du mentor et de l'heure : la demande déjà créée est la réponse.
      const replay = data.requests.find((row) => row.menteePersonId === access.personId && row.idempotencyKey === input.idempotencyKey)
      if (replay) return replay.fingerprint === fingerprint ? { ok: true, value: { requestId: replay.id, created: false } } : fail("mentoring_idempotency_conflict")
      if (!input.shareWithMentor) return fail("mentoring_consent_required")
      const mentor = data.mentors.find((row) => row.id === input.mentorId)
      if (!mentor) return fail("not_found")
      if (mentor.personId === access.personId) return fail("mentoring_self_request")
      if (mentor.state !== "active" || !visibleMentor(mentor, access.personId)) return fail("not_found")
      const now = store.now()
      const { activeMentees, pendingRequests } = countsOf(data, mentor.personId, now)
      const admission = checkMentoringAdmission({
        isSelf: false,
        domainOffered: mentor.domains.includes(draft.value.domain),
        pairOpen: openPairRequest(data, access.personId, mentor.personId, now) !== null,
        menteeOpenRequests: data.requests.filter((row) => row.menteePersonId === access.personId && row.status === "sent" && row.expiresAt > now).length,
        mentorAccepts: mentorAcceptsRequests({ state: mentor.state, activeMentees, maxActiveMentees: mentor.maxActiveMentees, pendingRequests }),
      })
      if (!admission.ok) return fail(admission.code)
      const timing = checkMentoringRequestTiming(draft.value, now)
      if (!timing.ok) return fail(timing.code)
      const requestId = `mentorat-demo-${data.sequence}`
      commit({
        ...data,
        sequence: data.sequence + 1,
        requests: [
          ...data.requests,
          {
            id: requestId,
            mentorId: mentor.id,
            mentorPersonId: mentor.personId,
            menteePersonId: access.personId,
            domain: draft.value.domain,
            goal: draft.value.goal,
            message: draft.value.message,
            wishedSlots: draft.value.wishedSlots,
            timeZone: draft.value.timeZone,
            status: "sent",
            consentAt: now,
            idempotencyKey: input.idempotencyKey,
            fingerprint,
            expiresAt: timing.value.expiresAt,
            slot: null,
            slotVersion: 0,
            acceptedAt: null,
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

    cancel: async ({ requestId, reason }) => closeWith(requestId, reason, { action: "cancel", role: "mentee", to: "cancelled" }),

    async accept({ requestId, slot }) {
      const access = viewer("publish")
      if (!access.ok) return fail(access.code)
      const found = participantRow(requestId, access.personId)
      if (!found || found.role !== "mentor") return fail("not_found")
      const { data, row } = found
      const now = store.now()
      const transition = checkMentoringTransition({ action: "accept", role: "mentor", status: effectiveMentoringStatus(row, now) })
      if (!transition.ok) return fail(transition.code)
      const mentor = data.mentors.find((candidate) => candidate.id === row.mentorId)
      if (!mentor || mentor.personId !== access.personId || mentor.state === "retired") return fail("not_found")
      // Le mentoré doit encore être membre, et aucun blocage ne doit exister dans la paire.
      const main = store.getState()
      const menteeStatus = statusOf(main, row.menteePersonId, now)
      if (menteeStatus === null || menteeStatus === "partie" || menteeStatus === "suspendue" || isBlocked(main, row.menteePersonId, access.personId)) return fail("not_found")
      const capacity = checkMentorCapacity(countsOf(data, access.personId, now).activeMentees, mentor.maxActiveMentees)
      if (!capacity.ok) return fail(capacity.code)
      let proposed: MentoringProposedSlotView | null = null
      if (slot !== null) {
        const parsed = parseMentoringSlot(slot, now)
        if (!parsed.ok) return fail(parsed.code)
        proposed = { ...parsed.value, proposedAt: now }
      }
      const slotVersion = proposed ? 1 : 0
      commit({ ...data, requests: replaceRequest(data, { ...row, status: "accepted", acceptedAt: now, slot: proposed, slotVersion, updatedAt: now }) })
      return { ok: true, value: { slotVersion } }
    },

    decline: async ({ requestId, reason }) => closeWith(requestId, reason, { action: "decline", role: "mentor", to: "declined" }),

    async proposeSlot({ requestId, expectedSlotVersion, slot }) {
      const access = viewer("publish")
      if (!access.ok) return fail(access.code)
      const found = participantRow(requestId, access.personId)
      if (!found || found.role !== "mentor") return fail("not_found")
      const { data, row } = found
      const now = store.now()
      const transition = checkMentoringTransition({ action: "propose_slot", role: "mentor", status: effectiveMentoringStatus(row, now) })
      if (!transition.ok) return fail(transition.code)
      if (isBlocked(store.getState(), row.menteePersonId, access.personId)) return fail("not_found")
      const next = checkMentoringSlotVersion(expectedSlotVersion, row.slotVersion)
      if (!next.ok) return fail(next.code)
      const parsed = parseMentoringSlot(slot, now)
      if (!parsed.ok) return fail(parsed.code)
      commit({ ...data, requests: replaceRequest(data, { ...row, slot: { ...parsed.value, proposedAt: now }, slotVersion: next.value, updatedAt: now }) })
      return { ok: true, value: { slotVersion: next.value } }
    },

    close: async ({ requestId, reason }) => closeWith(requestId, reason, { action: "close", role: null, to: "closed" }),
  }
}
