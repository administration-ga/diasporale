/**
 * Démonstration de la capacité « talents et emploi » (DG-025). PROPRIÉTAIRE : ce
 * chantier.
 *
 * Données FICTIVES de bout en bout : des offres portées par les pages de
 * démonstration existantes (« (démo) » dans chaque titre), des profils de talent
 * et des candidatures des comptes fictifs, gardés dans ce seul navigateur, à part
 * de l'état principal (une clé de stockage à eux) et remis à zéro avec lui.
 *
 * Les règles sont celles du domaine (`@diasporale/domain`, module des emplois),
 * dans l'ordre du moteur : session → adhésion → capacité → droit (page gérée,
 * personne qui candidate) → règles de la saisie → version. Une candidature est
 * privée : la personne qui candidate et l'équipe de la page, personne d'autre.
 * La démonstration ne modère jamais : ses vues de gestion omettent l'état de
 * modération (`moderation` absent, lu comme publié par les écrans).
 */
import {
  availableJobApplicationActions,
  checkJobDeadline,
  checkJobOfferVersion,
  checkTalentProfileVersion,
  effectiveJobOfferStatus,
  hasCapability,
  initialJobOfferStatus,
  isJobEmployerOwnerKind,
  isJobIdempotencyKey,
  isJobOfferEditable,
  isJobOfferOpen,
  isTalentAttachable,
  isTalentListed,
  JOB_OFFERS_PER_PAGE_MAX,
  jobApplicationFingerprint,
  jobOfferPublishedAt,
  matchesJobFilters,
  matchesJobQuery,
  normalizeJobApplication,
  parseJobDecisionReason,
  parseJobOffer,
  parseJobSearch,
  parseTalentProfile,
  parseTalentSearch,
  talentShortName,
  transitionJobApplication,
  transitionJobOffer,
  type JobApplicationAction,
  type JobApplicationStatus,
  type JobOfferDraft,
  type JobOfferInput,
  type JobOfferStatus,
  type MemberCapability,
  type TalentProfileDraft,
  type TalentProfileInput,
  type TalentProfileStatus,
} from "@diasporale/domain"
import { useMemo, useSyncExternalStore } from "react"

import type { ActionErrorCode } from "../data/errors"
import {
  JOB_APPLICATIONS_PAGE_SIZE,
  JOB_RESULTS_PAGE_SIZE,
  MANAGED_JOBS_PAGE_SIZE,
  TALENT_RESULTS_PAGE_SIZE,
  type JobEmployerView,
  type JobOfferCardView,
  type JobOfferDetailView,
  type JobOfferInputView,
  type JobsCapability,
  type JobsPage,
  type MyJobApplicationView,
  type OwnTalentProfileView,
  type ReceivedJobApplicationView,
  type TalentHitView,
} from "../data/jobs-port"
import type { ActionResult } from "../data/port"
import type { Loadable } from "../data/types"
import { demoManagedPage } from "./page-admin"
import { pageView, statusOf } from "./selectors"
import type { DemoPage, DemoState } from "./state"
import type { DemoStore } from "./store"

export const DEMO_JOBS_STORAGE_KEY = "diasporale:demonstration:jobs:v1"

/** Une offre de démonstration : les champs de la table `jobOffers` du moteur. */
export interface DemoJobOffer extends JobOfferDraft {
  readonly id: string
  readonly pageId: string
  readonly status: JobOfferStatus
  readonly version: number
  readonly publishedAt: number
  readonly createdAt: number
  readonly updatedAt: number
}

/** Une candidature de démonstration : privée, à la personne qui candidate. */
export interface DemoJobApplication {
  readonly id: string
  readonly offerId: string
  readonly pageId: string
  readonly candidateId: string
  readonly offerTitle: string
  readonly offerVersion: number
  readonly message: string
  readonly status: JobApplicationStatus
  readonly shareTalentProfile: boolean
  readonly idempotencyKey: string
  readonly fingerprint: string
  /** Note de l'équipe, jamais montrée à la personne qui candidate. */
  readonly notSelectedReason: string | null
  readonly createdAt: number
  readonly updatedAt: number
}

/** Un profil de talent de démonstration : opt-in, un par personne. */
export interface DemoTalentProfile extends TalentProfileDraft {
  readonly id: string
  readonly personId: string
  readonly status: TalentProfileStatus
  readonly version: number
  readonly createdAt: number
  readonly updatedAt: number
}

export interface DemoJobsState {
  readonly version: 1
  /** L'état principal dont ces données sont le prolongement : sa remise à zéro les remet à zéro. */
  readonly seedCreatedAt: number
  readonly sequence: number
  readonly offers: readonly DemoJobOffer[]
  readonly applications: readonly DemoJobApplication[]
  readonly talents: readonly DemoTalentProfile[]
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

const DAY = 24 * 60 * 60 * 1000
const CURSOR_TAG = "demo-jobs"
/** Ordre des états dans « offres de la page » : les ouvertes d'abord, les closes en dernier. */
const STATUS_ORDER: Readonly<Record<JobOfferStatus, number>> = { open: 0, suspended: 1, draft: 2, closed: 3 }

interface SeedOffer {
  readonly id: string
  readonly pageId: string
  readonly ageDays: number
  /** Date limite, en jours après le chargement initial ; absente : sans date limite. */
  readonly closesInDays?: number
  readonly status: JobOfferStatus
  readonly input: Omit<JobOfferInput, "closesAt">
}

/** Les offres fictives de départ, chacune signalée « (démo) », sur les pages de démonstration. */
const SEED_OFFERS: readonly SeedOffer[] = [
  {
    id: "job-demo-cuisine",
    pageId: "page-saveurs",
    ageDays: 5,
    status: "open",
    input: {
      title: "Cuisinier ou cuisinière en traiteur (démo)",
      description: "Offre FICTIVE de démonstration : préparer les plats du pays pour les commandes de la semaine, en équipe de trois.",
      contract: "cdi",
      country: "FR",
      city: "Paris",
      workMode: "onsite",
      languages: ["fr"],
      payRange: { minMinor: 200000, maxMinor: 240000, currency: "EUR", period: "month" },
    },
  },
  {
    id: "job-demo-livraison",
    pageId: "page-saveurs",
    ageDays: 2,
    closesInDays: 25,
    status: "open",
    input: {
      title: "Livraisons à temps partiel, le week-end (démo)",
      description: "Offre FICTIVE de démonstration : livrer les commandes du samedi et du dimanche dans Paris, à vélo ou en transports.",
      contract: "part_time",
      country: "FR",
      city: "Paris",
      workMode: "onsite",
      languages: ["fr"],
      payRange: { minMinor: 1200, maxMinor: 1400, currency: "EUR", period: "hour" },
    },
  },
  {
    id: "job-demo-stage-lyon",
    pageId: "page-asso-lyon",
    ageDays: 8,
    closesInDays: 40,
    status: "open",
    input: {
      title: "Stage en communication associative (démo)",
      description: "Offre FICTIVE de démonstration : animer les réseaux du collectif, préparer les affiches et l'accueil des nouveaux arrivants.",
      contract: "internship",
      country: "FR",
      city: "Lyon",
      workMode: "hybrid",
      languages: ["fr", "en"],
    },
  },
  {
    id: "job-demo-projets-lyon",
    pageId: "page-asso-lyon",
    ageDays: 1,
    status: "draft",
    input: {
      title: "Chargé ou chargée de projets culturels (démo)",
      description: "Brouillon FICTIF de démonstration : coordonner les soirées culturelles et les partenariats du collectif lyonnais.",
      contract: "cdd",
      country: "FR",
      city: "Lyon",
      workMode: "onsite",
      languages: ["fr"],
    },
  },
  {
    id: "job-demo-logistique",
    pageId: "page-valise",
    ageDays: 12,
    status: "open",
    input: {
      title: "Coordination logistique en indépendant (démo)",
      description: "Offre FICTIVE de démonstration : organiser les envois groupés et suivre les dépôts, à distance depuis la Belgique.",
      contract: "freelance",
      country: "BE",
      city: "Bruxelles",
      workMode: "remote",
      languages: ["fr"],
      payRange: { minMinor: 25000, maxMinor: 35000, currency: "EUR", period: "day" },
    },
  },
  {
    id: "job-demo-accueil-bxl",
    pageId: "page-valise",
    ageDays: 20,
    status: "suspended",
    input: {
      title: "Accueil des dépôts de colis (démo)",
      description: "Offre FICTIVE de démonstration, suspendue : accueillir les dépôts au local et tenir le registre des envois.",
      contract: "cdd",
      country: "BE",
      city: "Bruxelles",
      workMode: "onsite",
      languages: ["fr"],
    },
  },
]

interface SeedTalent {
  /** Identifiant OPAQUE : il ne dit rien de la personne (aucun identifiant de personne ne sort d'un profil). */
  readonly id: string
  readonly personId: string
  readonly ageDays: number
  readonly status: TalentProfileStatus
  readonly input: TalentProfileInput
}

/** Les profils de talent fictifs de départ : opt-in des comptes de démonstration. */
const SEED_TALENTS: readonly SeedTalent[] = [
  {
    id: "talent-demo-a",
    personId: "p-prisca",
    ageDays: 30,
    status: "active",
    input: { title: "Juriste en devenir, droit des affaires (démo)", skills: ["Droit des contrats", "Recherche juridique", "Rédaction"], availability: "three_months", languages: ["fr", "en"], country: "FR", visibility: "network" },
  },
  {
    id: "talent-demo-b",
    personId: "p-steeve",
    ageDays: 10,
    status: "active",
    input: { title: "Développeur web (démo)", skills: ["TypeScript", "React", "Accessibilité"], availability: "open_to_offers", languages: ["fr", "en"], country: "FR", visibility: "network" },
  },
  {
    id: "talent-demo-c",
    personId: "p-rodrigue",
    ageDays: 15,
    status: "active",
    input: { title: "Ingénieur en génie civil (démo)", skills: ["Calcul de structures", "Conduite de chantier"], availability: "immediate", languages: ["fr", "en"], country: "CA", visibility: "unlisted" },
  },
  {
    id: "talent-demo-d",
    personId: "p-nadia",
    ageDays: 60,
    status: "hidden",
    input: { title: "Gestion d'entreprise (démo)", skills: ["Gestion", "Logistique"], availability: "open_to_offers", languages: ["fr"], country: "BE", visibility: "network" },
  },
]

interface SeedApplication {
  readonly id: string
  readonly offerId: string
  readonly candidateId: string
  readonly ageDays: number
  readonly status: JobApplicationStatus
  readonly message: string
  readonly shareTalentProfile: boolean
}

/** Les candidatures fictives de départ : chacune visible de la personne et de l'équipe de la page seulement. */
const SEED_APPLICATIONS: readonly SeedApplication[] = [
  {
    id: "application-demo-steeve",
    offerId: "job-demo-livraison",
    candidateId: "p-steeve",
    ageDays: 1,
    status: "sent",
    message: "Candidature FICTIVE de démonstration : disponible le week-end, je connais bien Paris et je circule à vélo.",
    shareTalentProfile: true,
  },
  {
    id: "application-demo-prisca",
    offerId: "job-demo-stage-lyon",
    candidateId: "p-prisca",
    ageDays: 4,
    status: "seen",
    message: "Candidature FICTIVE de démonstration : étudiante à Bordeaux, je peux venir à Lyon deux jours par semaine.",
    shareTalentProfile: true,
  },
]

/** L'état de départ, daté par rapport à l'état principal ; chaque saisie passe LA règle du domaine. */
export function createDemoJobsSeed(seedCreatedAt: number): DemoJobsState {
  const offers = SEED_OFFERS.flatMap((seed): DemoJobOffer[] => {
    const at = seedCreatedAt - seed.ageDays * DAY
    const closesAt = seed.closesInDays === undefined ? null : seedCreatedAt + seed.closesInDays * DAY
    const draft = parseJobOffer({ ...seed.input, closesAt }, at)
    if (!draft.ok) return []
    return [{ ...draft.value, id: seed.id, pageId: seed.pageId, status: seed.status, version: 1, publishedAt: at, createdAt: at, updatedAt: at }]
  })
  const talents = SEED_TALENTS.flatMap((seed): DemoTalentProfile[] => {
    const draft = parseTalentProfile(seed.input)
    if (!draft.ok) return []
    const at = seedCreatedAt - seed.ageDays * DAY
    return [{ ...draft.value, id: seed.id, personId: seed.personId, status: seed.status, version: 1, createdAt: at, updatedAt: at }]
  })
  const applications = SEED_APPLICATIONS.flatMap((seed): DemoJobApplication[] => {
    const offer = offers.find((candidate) => candidate.id === seed.offerId)
    const draft = normalizeJobApplication({ message: seed.message, shareName: true, shareTalentProfile: seed.shareTalentProfile })
    if (!offer || !draft.ok) return []
    const at = seedCreatedAt - seed.ageDays * DAY
    const idempotencyKey = `seed-${seed.id}`
    return [{
      id: seed.id,
      offerId: offer.id,
      pageId: offer.pageId,
      candidateId: seed.candidateId,
      offerTitle: offer.title,
      offerVersion: offer.version,
      message: draft.value.message,
      status: seed.status,
      shareTalentProfile: draft.value.shareTalentProfile,
      idempotencyKey,
      fingerprint: jobApplicationFingerprint({ jobId: offer.id, offerVersion: offer.version, message: draft.value.message, shareTalentProfile: draft.value.shareTalentProfile }),
      notSelectedReason: null,
      createdAt: at,
      updatedAt: at,
    }]
  })
  return { version: 1, seedCreatedAt, sequence: 1, offers, applications, talents }
}

function isState(value: unknown): value is DemoJobsState {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<DemoJobsState>
  return candidate.version === 1 && typeof candidate.seedCreatedAt === "number" && typeof candidate.sequence === "number"
    && Array.isArray(candidate.offers) && Array.isArray(candidate.applications) && Array.isArray(candidate.talents)
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage
  } catch {
    // Stockage interdit (navigation privée, iframe) : la démonstration reste en mémoire.
    return null
  }
}

// ═══════════════════════════════════════════════════════════════
// Règles d'accès de la démonstration (mêmes refus que le moteur)
// ═══════════════════════════════════════════════════════════════

/** Le lecteur courant, ou le refus standard d'une lecture ou d'une écriture de membre. */
function viewerOf(state: DemoState, now: number, capability: MemberCapability): { readonly personId: string } | { readonly refusal: ActionErrorCode } {
  const personId = state.session.personId
  if (!personId || !state.persons[personId]) return { refusal: "not_signed_in" }
  if (!state.memberships[personId]) return { refusal: "not_member" }
  const status = statusOf(state, personId, now)
  // Comme la garde du moteur : une sanction ferme le réseau, lecture comprise.
  if (status === "suspendue") return { refusal: "suspended" }
  if (status === null || !hasCapability(status, "read_network")) return { refusal: "not_member" }
  if (!hasCapability(status, capability)) return { refusal: "status_insufficient" }
  return { personId }
}

function employerPage(state: DemoState, pageId: string): DemoPage | null {
  const page = state.pages[pageId]
  return page && isJobEmployerOwnerKind(page.ownerKind) ? page : null
}

function employerView(page: DemoPage): JobEmployerView {
  return { id: page.id, handle: page.handle, name: page.name, ownerKind: page.ownerKind, badge: pageView(page).badge, logoUrl: null }
}

function stateOf(offer: DemoJobOffer) {
  return { status: offer.status, closesAt: offer.closesAt }
}

function cardView(offer: DemoJobOffer, page: DemoPage): JobOfferCardView {
  return {
    id: offer.id,
    version: offer.version,
    title: offer.title,
    description: offer.description,
    contract: offer.contract,
    country: offer.country,
    city: offer.city,
    workMode: offer.workMode,
    languages: offer.languages,
    payRange: offer.payRange,
    closesAt: offer.closesAt,
    publishedAt: offer.publishedAt,
    updatedAt: offer.updatedAt,
    employer: employerView(page),
  }
}

function detailView(offer: DemoJobOffer, page: DemoPage, now: number, viewerCanManage: boolean, mine: DemoJobApplication | null): JobOfferDetailView {
  return {
    ...cardView(offer, page),
    status: effectiveJobOfferStatus(stateOf(offer), now),
    viewerCanManage,
    myApplication: mine ? { id: mine.id, status: mine.status } : null,
  }
}

function ownTalentView(profile: DemoTalentProfile): OwnTalentProfileView {
  return {
    id: profile.id,
    title: profile.title,
    skills: profile.skills,
    availability: profile.availability,
    languages: profile.languages,
    country: profile.country,
    visibility: profile.visibility,
    status: profile.status,
    version: profile.version,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  }
}

function blockedBetween(state: DemoState, a: string, b: string): boolean {
  return state.blocks.some((block) => (block.byId === a && block.targetId === b) || (block.byId === b && block.targetId === a))
}

// ═══════════════════════════════════════════════════════════════
// Curseurs : une frontière (clé de tri), jamais une position
// ═══════════════════════════════════════════════════════════════

type Boundary = readonly [number, number, string]

function encodeCursor(scope: string, boundary: Boundary): string {
  return JSON.stringify([CURSOR_TAG, 1, scope, ...boundary])
}

/** `null` : première page ; `undefined` : curseur illisible ou d'une autre lecture. */
function decodeCursor(cursor: string | null, scope: string): Boundary | null | undefined {
  if (cursor === null) return null
  try {
    const parsed: unknown = JSON.parse(cursor)
    if (!Array.isArray(parsed) || parsed.length !== 6 || parsed[0] !== CURSOR_TAG || parsed[1] !== 1 || parsed[2] !== scope) return undefined
    const [, , , first, second, id] = parsed as unknown[]
    if (typeof first !== "number" || typeof second !== "number" || typeof id !== "string") return undefined
    return [first, second, id]
  } catch {
    return undefined
  }
}

function compareBoundary(left: Boundary, right: Boundary): number {
  return left[0] - right[0] || left[1] - right[1] || (left[2] === right[2] ? 0 : left[2] < right[2] ? -1 : 1)
}

/** Une fenêtre après la frontière, dans l'ordre des clés croissantes. */
function windowAfter<Row>(rows: readonly { readonly key: Boundary; readonly row: Row }[], boundary: Boundary | null, size: number, scope: string): JobsPage<Row> {
  const sorted = [...rows].sort((left, right) => compareBoundary(left.key, right.key))
  const remaining = boundary === null ? sorted : sorted.filter((entry) => compareBoundary(entry.key, boundary) > 0)
  const window = remaining.slice(0, size)
  const last = window.at(-1)
  const isDone = remaining.length <= size
  return { items: window.map((entry) => entry.row), isDone, continueCursor: isDone || !last ? "" : encodeCursor(scope, last.key) }
}

// ═══════════════════════════════════════════════════════════════
// La capacité
// ═══════════════════════════════════════════════════════════════

const LOADING = { status: "loading" } as const
const OUT_OF_SESSION = "ssr"

function ready<T>(data: T): Loadable<T> {
  return { status: "ready", data }
}

function failed<T>(code: ActionErrorCode): Loadable<T> {
  return { status: "error", code }
}

const fail = (code: ActionErrorCode): ActionResult<never> => ({ ok: false, code })

function offerInputOf(input: JobOfferInputView): JobOfferInput {
  return {
    title: input.title,
    description: input.description,
    contract: input.contract,
    country: input.country,
    city: input.city,
    workMode: input.workMode,
    languages: input.languages,
    payRange: input.payRange,
    closesAt: input.closesAt,
  }
}

export interface DemoJobsOptions {
  /** Le stockage des données ; `null` : en mémoire seulement. Par défaut, celui du navigateur. */
  readonly storage?: StorageLike | null
  /**
   * Des équipes FIXES (tests) ; par défaut, le rôle vivant de la démonstration de
   * la gestion des pages, relu à chaque acte.
   */
  readonly teams?: Readonly<Record<string, readonly string[]>>
}

export function createDemoJobs(store: DemoStore, options: DemoJobsOptions = {}): JobsCapability {
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const teams = options.teams
  /** La personne signe-t-elle VIVANTE pour la page ? (la session de démonstration, seule à agir) */
  const isOnTeam = (pageId: string, personId: string): boolean => {
    if (teams) return teams[pageId]?.includes(personId) ?? false
    const main = store.getState()
    const page = main.pages[pageId]
    if (!page || main.session.personId !== personId) return false
    return (demoManagedPage(store, page.handle)?.myRole ?? null) !== null
  }
  let state: DemoJobsState = load()
  let version = 0
  const listeners = new Set<() => void>()

  function load(): DemoJobsState {
    const seedCreatedAt = store.getState().createdAt
    try {
      const raw = storage?.getItem(DEMO_JOBS_STORAGE_KEY)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (isState(parsed) && parsed.seedCreatedAt === seedCreatedAt) return parsed
      }
    } catch {
      // Stockage illisible : on repart des données de démonstration.
    }
    return createDemoJobsSeed(seedCreatedAt)
  }

  function persist(next: DemoJobsState): void {
    try {
      storage?.setItem(DEMO_JOBS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Stockage plein ou interdit : la démonstration continue en mémoire.
    }
  }

  /** L'état courant ; une remise à zéro de l'état principal remet aussi ces données à zéro. */
  function current(): DemoJobsState {
    const seedCreatedAt = store.getState().createdAt
    if (state.seedCreatedAt !== seedCreatedAt) {
      state = createDemoJobsSeed(seedCreatedAt)
      persist(state)
    }
    return state
  }

  function commit(next: DemoJobsState): void {
    state = next
    version += 1
    persist(next)
    for (const listener of listeners) listener()
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    const unsubscribe = store.subscribe(listener)
    return () => {
      listeners.delete(listener)
      unsubscribe()
    }
  }
  const snapshot = () => `${store.getVersion()}:${version}`
  const useSnapshot = () => useSyncExternalStore(subscribe, snapshot, () => OUT_OF_SESSION)

  function nextId(prefix: string): { readonly id: string; readonly live: DemoJobsState } {
    const live = current()
    return { id: `${prefix}-${live.sequence}`, live }
  }

  // ── Lectures ──────────────────────────────────────────────────────────
  function search(request: Parameters<JobsCapability["useSearch"]>[0]): Loadable<JobsPage<JobOfferCardView>> {
    const main = store.getState()
    const now = store.now()
    const viewer = viewerOf(main, now, "read_network")
    if ("refusal" in viewer) return failed(viewer.refusal)
    const parsed = parseJobSearch({ query: request.query, country: request.country, city: request.city, contract: request.contract, workMode: request.workMode })
    if (!parsed.ok) return failed(parsed.code)
    const filters = parsed.value
    const scope = JSON.stringify(filters)
    const boundary = decodeCursor(request.cursor, scope)
    if (boundary === undefined) return failed("unknown")
    const rows = current().offers.flatMap((offer) => {
      if (!isJobOfferOpen(stateOf(offer), now) || !matchesJobFilters(offer, filters) || !matchesJobQuery(offer.searchText, filters.query)) return []
      const page = employerPage(main, offer.pageId)
      // Les plus récentes d'abord : la clé croissante est l'opposé de la date.
      return page ? [{ key: [-offer.publishedAt, 0, offer.id] as Boundary, row: cardView(offer, page) }] : []
    })
    return ready(windowAfter(rows, boundary, JOB_RESULTS_PAGE_SIZE, scope))
  }

  function offer(jobId: string): Loadable<JobOfferDetailView | null> {
    const main = store.getState()
    const now = store.now()
    const viewer = viewerOf(main, now, "read_network")
    if ("refusal" in viewer) return failed(viewer.refusal)
    const data = current()
    const found = data.offers.find((candidate) => candidate.id === jobId)
    const page = found ? employerPage(main, found.pageId) : null
    if (!found || !page) return ready(null)
    if (isOnTeam(page.id, viewer.personId)) return ready(detailView(found, page, now, true, null))
    if (!isJobOfferOpen(stateOf(found), now)) return ready(null)
    const mine = data.applications.find((application) => application.offerId === found.id && application.candidateId === viewer.personId) ?? null
    return ready(detailView(found, page, now, false, mine))
  }

  function pageOffers({ pageId, status, cursor }: Parameters<JobsCapability["usePageOffers"]>[0]): Loadable<JobsPage<JobOfferDetailView>> {
    const main = store.getState()
    const now = store.now()
    const viewer = viewerOf(main, now, "read_network")
    if ("refusal" in viewer) return failed(viewer.refusal)
    const page = main.pages[pageId]
    if (!page || !isOnTeam(page.id, viewer.personId)) return failed("not_found")
    if (!isJobEmployerOwnerKind(page.ownerKind)) return failed("job_page_kind_not_allowed")
    const data = current()
    const scope = JSON.stringify(["mine", page.id, viewer.personId, data.seedCreatedAt, status ?? null])
    const boundary = decodeCursor(cursor, scope)
    if (boundary === undefined) return failed("unknown")
    const rows = data.offers.flatMap((candidate) => {
      if (candidate.pageId !== page.id) return []
      const detail = detailView(candidate, page, now, true, null)
      if (status !== undefined && detail.status !== status) return []
      return [{ key: [STATUS_ORDER[detail.status], -candidate.createdAt, candidate.id] as Boundary, row: detail }]
    })
    return ready(windowAfter(rows, boundary, MANAGED_JOBS_PAGE_SIZE, scope))
  }

  function myApplicationView(main: DemoState, data: DemoJobsState, application: DemoJobApplication, now: number): MyJobApplicationView {
    const found = data.offers.find((candidate) => candidate.id === application.offerId)
    const page = employerPage(main, application.pageId)
    return {
      id: application.id,
      status: application.status,
      jobId: application.offerId,
      offerTitle: application.offerTitle,
      offerVersion: application.offerVersion,
      offerOpen: page !== null && found !== undefined && isJobOfferOpen(stateOf(found), now),
      employer: page ? employerView(page) : null,
      message: application.message,
      sharedTalentProfile: application.shareTalentProfile,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      actions: availableJobApplicationActions("candidate", application.status),
    }
  }

  function myApplications({ cursor }: Parameters<JobsCapability["useMyApplications"]>[0]): Loadable<JobsPage<MyJobApplicationView>> {
    const main = store.getState()
    const now = store.now()
    const viewer = viewerOf(main, now, "read_network")
    if ("refusal" in viewer) return failed(viewer.refusal)
    const data = current()
    const scope = JSON.stringify(["applications", viewer.personId, data.seedCreatedAt])
    const boundary = decodeCursor(cursor, scope)
    if (boundary === undefined) return failed("unknown")
    const rows = data.applications
      .filter((application) => application.candidateId === viewer.personId)
      .map((application) => ({ key: [-application.updatedAt, 0, application.id] as Boundary, row: myApplicationView(main, data, application, now) }))
    return ready(windowAfter(rows, boundary, JOB_APPLICATIONS_PAGE_SIZE, scope))
  }

  function receivedView(main: DemoState, data: DemoJobsState, application: DemoJobApplication): ReceivedJobApplicationView {
    // Retirée : la personne a repris sa candidature ; il n'en reste que l'état.
    const withdrawn = application.status === "withdrawn"
    const person = main.persons[application.candidateId]
    const profile = person?.profile && person.withdrawnAt === undefined ? person.profile : null
    const talent = application.shareTalentProfile ? data.talents.find((candidate) => candidate.personId === application.candidateId) : undefined
    return {
      id: application.id,
      jobId: application.offerId,
      status: application.status,
      offerVersion: application.offerVersion,
      candidate: withdrawn ? null : { displayName: profile?.displayName ?? null, handle: profile?.handle ?? null },
      message: withdrawn ? null : application.message,
      talentProfile: !withdrawn && talent && isTalentAttachable(talent)
        ? { title: talent.title, skills: talent.skills, availability: talent.availability, languages: talent.languages, country: talent.country }
        : null,
      notSelectedReason: application.notSelectedReason,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      actions: availableJobApplicationActions("page", application.status),
    }
  }

  function offerApplications({ jobId, status, cursor }: Parameters<JobsCapability["useOfferApplications"]>[0]): Loadable<JobsPage<ReceivedJobApplicationView>> {
    const main = store.getState()
    const now = store.now()
    const viewer = viewerOf(main, now, "read_network")
    if ("refusal" in viewer) return failed(viewer.refusal)
    const data = current()
    const found = data.offers.find((candidate) => candidate.id === jobId)
    if (!found || !employerPage(main, found.pageId) || !isOnTeam(found.pageId, viewer.personId)) return failed("not_found")
    const scope = JSON.stringify(["received", found.id, viewer.personId, data.seedCreatedAt, status ?? null])
    const boundary = decodeCursor(cursor, scope)
    if (boundary === undefined) return failed("unknown")
    const rows = data.applications
      .filter((application) => application.offerId === found.id && (status === undefined || application.status === status))
      .map((application) => ({ key: [-application.createdAt, 0, application.id] as Boundary, row: receivedView(main, data, application) }))
    return ready(windowAfter(rows, boundary, JOB_APPLICATIONS_PAGE_SIZE, scope))
  }

  function myTalent(): Loadable<OwnTalentProfileView | null> {
    const main = store.getState()
    const viewer = viewerOf(main, store.now(), "read_network")
    if ("refusal" in viewer) return failed(viewer.refusal)
    const profile = current().talents.find((candidate) => candidate.personId === viewer.personId)
    return ready(profile ? ownTalentView(profile) : null)
  }

  function talentSearch({ country, skill, cursor }: Parameters<JobsCapability["useTalentSearch"]>[0]): Loadable<JobsPage<TalentHitView>> {
    const main = store.getState()
    const now = store.now()
    const viewer = viewerOf(main, now, "view_directory")
    if ("refusal" in viewer) return failed(viewer.refusal)
    const parsed = parseTalentSearch({ country, skill })
    if (!parsed.ok) return failed(parsed.code)
    const data = current()
    const scope = JSON.stringify(["talents", parsed.value.country, parsed.value.skill, viewer.personId, data.seedCreatedAt])
    const boundary = decodeCursor(cursor, scope)
    if (boundary === undefined) return failed("unknown")
    const rows = data.talents.flatMap((profile) => {
      if (!isTalentListed(profile) || profile.country !== parsed.value.country || profile.personId === viewer.personId) return []
      if (!matchesJobQuery(profile.searchText, parsed.value.skill)) return []
      const person = main.persons[profile.personId]
      const published = person?.profile && person.withdrawnAt === undefined && person.privateAt === undefined ? person.profile : null
      const status = statusOf(main, profile.personId, now)
      if (!published || status === null || !hasCapability(status, "read_network") || blockedBetween(main, viewer.personId, profile.personId)) return []
      const shortName = talentShortName(published.displayName)
      if (shortName === null) return []
      const hit: TalentHitView = {
        id: profile.id,
        shortName,
        title: profile.title,
        skills: profile.skills,
        availability: profile.availability,
        languages: profile.languages,
        country: profile.country,
        updatedAt: profile.updatedAt,
      }
      return [{ key: [-profile.updatedAt, 0, profile.id] as Boundary, row: hit }]
    })
    return ready(windowAfter(rows, boundary, TALENT_RESULTS_PAGE_SIZE, scope))
  }

  // ── Écritures ─────────────────────────────────────────────────────────
  /** L'équipe de la page : membre qui publie, signataire de la page, nature admise. */
  function manager(pageId: string): { readonly page: DemoPage } | { readonly refusal: ActionErrorCode } {
    const main = store.getState()
    const viewer = viewerOf(main, store.now(), "publish")
    if ("refusal" in viewer) return viewer
    const page = main.pages[pageId]
    if (!page || !isOnTeam(page.id, viewer.personId)) return { refusal: "not_found" }
    if (!isJobEmployerOwnerKind(page.ownerKind)) return { refusal: "job_page_kind_not_allowed" }
    return { page }
  }

  function managedOffer(jobId: string): { readonly offer: DemoJobOffer } | { readonly refusal: ActionErrorCode } {
    const found = current().offers.find((candidate) => candidate.id === jobId)
    if (!found) {
      // Même ordre que le moteur : l'éligibilité de la personne se juge avant l'existence de l'offre.
      const viewer = viewerOf(store.getState(), store.now(), "publish")
      return { refusal: "refusal" in viewer ? viewer.refusal : "not_found" }
    }
    const access = manager(found.pageId)
    return "refusal" in access ? access : { offer: found }
  }

  function replaceOffer(next: DemoJobOffer): void {
    const live = current()
    commit({ ...live, offers: live.offers.map((candidate) => (candidate.id === next.id ? next : candidate)) })
  }

  function replaceApplication(next: DemoJobApplication): void {
    const live = current()
    commit({ ...live, applications: live.applications.map((candidate) => (candidate.id === next.id ? next : candidate)) })
  }

  /** Un geste de l'équipe : signataire de la page de la candidature, transition du domaine. */
  function decide(applicationId: string, action: Exclude<JobApplicationAction, "withdraw">, rawReason: string | null): ActionResult<{ status: JobApplicationStatus }> {
    const main = store.getState()
    const viewer = viewerOf(main, store.now(), "publish")
    if ("refusal" in viewer) return fail(viewer.refusal)
    const application = current().applications.find((candidate) => candidate.id === applicationId)
    if (!application || !isOnTeam(application.pageId, viewer.personId)) return fail("not_found")
    const reason = action === "not_select" ? parseJobDecisionReason(rawReason) : null
    if (reason !== null && !reason.ok) return fail(reason.code)
    const next = transitionJobApplication({ actor: "page", action, status: application.status })
    if (!next.ok) return fail(next.code)
    if (!next.value.changed) return { ok: true, value: { status: application.status } }
    replaceApplication({
      ...application,
      status: next.value.status,
      notSelectedReason: reason !== null && reason.ok && reason.value !== null ? reason.value : application.notSelectedReason,
      updatedAt: store.now(),
    })
    return { ok: true, value: { status: next.value.status } }
  }

  return {
    useSearch(request) {
      const snap = useSnapshot()
      const key = JSON.stringify([request.query, request.country, request.city, request.contract, request.workMode, request.cursor])
      // `key` résume la requête : un objet de requête neuf, de même contenu, ne relance rien.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      return useMemo(() => (snap === OUT_OF_SESSION ? LOADING : search(request)), [snap, key])
    },
    useOffer(jobId) {
      const snap = useSnapshot()
      return useMemo(() => (snap === OUT_OF_SESSION ? LOADING : offer(jobId)), [snap, jobId])
    },
    usePageOffers({ pageId, status, cursor }) {
      const snap = useSnapshot()
      return useMemo(() => (snap === OUT_OF_SESSION ? LOADING : pageOffers({ pageId, cursor, ...(status !== undefined ? { status } : {}) })), [snap, pageId, status, cursor])
    },
    useMyApplications({ cursor }) {
      const snap = useSnapshot()
      return useMemo(() => (snap === OUT_OF_SESSION ? LOADING : myApplications({ cursor })), [snap, cursor])
    },
    useOfferApplications({ jobId, status, cursor }) {
      const snap = useSnapshot()
      return useMemo(() => (snap === OUT_OF_SESSION ? LOADING : offerApplications({ jobId, cursor, ...(status !== undefined ? { status } : {}) })), [snap, jobId, status, cursor])
    },
    useMyTalentProfile() {
      const snap = useSnapshot()
      return useMemo(() => (snap === OUT_OF_SESSION ? LOADING : myTalent()), [snap])
    },
    useTalentSearch({ country, skill, cursor }) {
      const snap = useSnapshot()
      return useMemo(() => (snap === OUT_OF_SESSION ? LOADING : talentSearch({ country, cursor, ...(skill !== undefined ? { skill } : {}) })), [snap, country, skill, cursor])
    },

    async createOffer(input) {
      const access = manager(input.pageId)
      if ("refusal" in access) return fail(access.refusal)
      const now = store.now()
      const draft = parseJobOffer(offerInputOf(input), now)
      if (!draft.ok) return fail(draft.code)
      const { id, live } = nextId("job-demo")
      const count = live.offers.filter((candidate) => candidate.pageId === access.page.id && effectiveJobOfferStatus(stateOf(candidate), now) !== "closed").length
      if (count >= JOB_OFFERS_PER_PAGE_MAX) return fail("job_offer_limit_reached")
      const status = initialJobOfferStatus(input.publish)
      commit({
        ...live,
        sequence: live.sequence + 1,
        offers: [...live.offers, { ...draft.value, id, pageId: access.page.id, status, version: 1, publishedAt: now, createdAt: now, updatedAt: now }],
      })
      return { ok: true, value: { jobId: id, version: 1, status } }
    },

    async updateOffer(input) {
      const access = managedOffer(input.jobId)
      if ("refusal" in access) return fail(access.refusal)
      const now = store.now()
      if (!isJobOfferEditable(effectiveJobOfferStatus(stateOf(access.offer), now))) return fail("job_offer_closed")
      const next = checkJobOfferVersion(access.offer.version, input.expectedVersion)
      if (!next.ok) return fail(next.code)
      const draft = parseJobOffer(offerInputOf(input), now)
      if (!draft.ok) return fail(draft.code)
      replaceOffer({ ...access.offer, ...draft.value, version: next.value, updatedAt: now })
      return { ok: true, value: { version: next.value } }
    },

    async setOfferStatus(input) {
      const access = managedOffer(input.jobId)
      if ("refusal" in access) return fail(access.refusal)
      const now = store.now()
      const currentStatus = effectiveJobOfferStatus(stateOf(access.offer), now)
      const transition = transitionJobOffer(currentStatus, input.status)
      if (!transition.ok) return fail(transition.code)
      if (!transition.value.changed) return { ok: true, value: { status: currentStatus, version: access.offer.version } }
      if (transition.value.status === "open") {
        const deadline = checkJobDeadline(access.offer.closesAt, now)
        if (!deadline.ok) return fail(deadline.code)
      }
      const next = checkJobOfferVersion(access.offer.version, input.expectedVersion)
      if (!next.ok) return fail(next.code)
      replaceOffer({
        ...access.offer,
        status: transition.value.status,
        version: next.value,
        publishedAt: jobOfferPublishedAt(currentStatus, transition.value.status, access.offer.publishedAt, now),
        updatedAt: now,
      })
      return { ok: true, value: { status: transition.value.status, version: next.value } }
    },

    async apply(input) {
      const main = store.getState()
      const now = store.now()
      const viewer = viewerOf(main, now, "publish")
      if ("refusal" in viewer) return fail(viewer.refusal)
      if (!isJobIdempotencyKey(input.idempotencyKey)) return fail("unknown")
      const draft = normalizeJobApplication({ message: input.message, shareName: input.shareName, shareTalentProfile: input.shareTalentProfile })
      if (!draft.ok) return fail(draft.code)
      const fingerprint = jobApplicationFingerprint({ jobId: input.jobId, offerVersion: input.offerVersion, message: draft.value.message, shareTalentProfile: draft.value.shareTalentProfile })
      const data = current()
      // Rejeu AVANT les gardes de l'offre : la candidature déjà créée est la réponse.
      const replay = data.applications.find((candidate) => candidate.candidateId === viewer.personId && candidate.idempotencyKey === input.idempotencyKey)
      if (replay) return replay.fingerprint === fingerprint ? { ok: true, value: { applicationId: replay.id, created: false } } : fail("job_application_idempotency_conflict")
      const found = data.offers.find((candidate) => candidate.id === input.jobId)
      const page = found ? employerPage(main, found.pageId) : null
      if (!found || !page || !isJobOfferOpen(stateOf(found), now)) return fail("not_found")
      if (found.version !== input.offerVersion) return fail("job_offer_changed")
      if (isOnTeam(page.id, viewer.personId)) return fail("job_application_own_page")
      if (data.applications.some((candidate) => candidate.offerId === found.id && candidate.candidateId === viewer.personId)) return fail("job_application_already_exists")
      if (draft.value.shareTalentProfile) {
        const talent = data.talents.find((candidate) => candidate.personId === viewer.personId)
        if (!talent || !isTalentAttachable(talent)) return fail("job_talent_profile_unavailable")
      }
      const { id, live } = nextId("application-demo")
      commit({
        ...live,
        sequence: live.sequence + 1,
        applications: [...live.applications, {
          id,
          offerId: found.id,
          pageId: page.id,
          candidateId: viewer.personId,
          offerTitle: found.title,
          offerVersion: found.version,
          message: draft.value.message,
          status: "sent",
          shareTalentProfile: draft.value.shareTalentProfile,
          idempotencyKey: input.idempotencyKey,
          fingerprint,
          notSelectedReason: null,
          createdAt: now,
          updatedAt: now,
        }],
      })
      return { ok: true, value: { applicationId: id, created: true } }
    },

    async withdraw(applicationId) {
      const viewer = viewerOf(store.getState(), store.now(), "read_network")
      if ("refusal" in viewer) return fail(viewer.refusal)
      const application = current().applications.find((candidate) => candidate.id === applicationId)
      if (!application || application.candidateId !== viewer.personId) return fail("not_found")
      const next = transitionJobApplication({ actor: "candidate", action: "withdraw", status: application.status })
      if (!next.ok) return fail(next.code)
      if (!next.value.changed) return { ok: true, value: { status: application.status } }
      replaceApplication({ ...application, status: next.value.status, updatedAt: store.now() })
      return { ok: true, value: { status: next.value.status } }
    },

    markSeen: async (applicationId) => decide(applicationId, "mark_seen", null),
    shortlist: async (applicationId) => decide(applicationId, "shortlist", null),
    markNotSelected: async ({ applicationId, reason }) => decide(applicationId, "not_select", reason),

    async saveTalentProfile(input) {
      const viewer = viewerOf(store.getState(), store.now(), "appear_in_directory")
      if ("refusal" in viewer) return fail(viewer.refusal)
      const draft = parseTalentProfile({
        title: input.title,
        skills: input.skills,
        availability: input.availability,
        languages: input.languages,
        country: input.country,
        visibility: input.visibility,
      })
      if (!draft.ok) return fail(draft.code)
      const live = current()
      const existing = live.talents.find((candidate) => candidate.personId === viewer.personId)
      const version = checkTalentProfileVersion(existing ? existing.version : null, input.expectedVersion)
      if (!version.ok) return fail(version.code)
      const now = store.now()
      if (existing) {
        commit({ ...live, talents: live.talents.map((candidate) => (candidate.id === existing.id ? { ...existing, ...draft.value, version: version.value, updatedAt: now } : candidate)) })
        return { ok: true, value: { id: existing.id, version: version.value } }
      }
      const id = `talent-demo-${live.sequence}`
      commit({
        ...live,
        sequence: live.sequence + 1,
        talents: [...live.talents, { ...draft.value, id, personId: viewer.personId, status: "active", version: version.value, createdAt: now, updatedAt: now }],
      })
      return { ok: true, value: { id, version: version.value } }
    },

    async setTalentProfileStatus(input) {
      const viewer = viewerOf(store.getState(), store.now(), input.status === "active" ? "appear_in_directory" : "read_network")
      if ("refusal" in viewer) return fail(viewer.refusal)
      const live = current()
      const existing = live.talents.find((candidate) => candidate.personId === viewer.personId)
      if (!existing) return fail("not_found")
      if (existing.status === input.status) return { ok: true, value: { status: existing.status, version: existing.version } }
      const version = checkTalentProfileVersion(existing.version, input.expectedVersion)
      if (!version.ok) return fail(version.code)
      commit({ ...live, talents: live.talents.map((candidate) => (candidate.id === existing.id ? { ...existing, status: input.status, version: version.value, updatedAt: store.now() } : candidate)) })
      return { ok: true, value: { status: input.status, version: version.value } }
    },

    async removeTalentProfile() {
      const viewer = viewerOf(store.getState(), store.now(), "read_network")
      if ("refusal" in viewer) return fail(viewer.refusal)
      const live = current()
      if (live.talents.some((candidate) => candidate.personId === viewer.personId)) {
        commit({ ...live, talents: live.talents.filter((candidate) => candidate.personId !== viewer.personId) })
      }
      return { ok: true, value: null }
    },
  }
}
