/**
 * Démonstration de la capacité « services » (DG-011/012). PROPRIÉTAIRE :
 * chantier « catalogue des services ».
 *
 * CONTRAT FIGÉ consommé par la démonstration des demandes : `createDemoServices`
 * rend `{ capability, findOffer }` et `DemoOfferRef` garde au moins ces champs.
 *
 * Données FICTIVES de bout en bout : quelques offres portées par les pages de
 * démonstration existantes (« (démo) » dans chaque titre), gardées dans ce seul
 * navigateur, à part de l'état principal (une clé de stockage à elles) et
 * remises à zéro avec lui. Les règles sont celles du domaine
 * (`@diasporale/domain`, module des services), dans l'ordre du moteur : session →
 * adhésion → capacité → page gérée → nature admise → règles de l'offre → version.
 */
import {
  checkOfferVersion,
  hasCapability,
  initialOfferStatus,
  isKeptByBudget,
  isOfferEditable,
  isOfferPublic,
  isServiceProviderOwnerKind,
  matchesDeliveryFilter,
  parseServiceOffer,
  parseServiceSearch,
  SERVICE_OFFERS_PER_PAGE_MAX,
  SERVICE_OFFER_STATUSES,
  serviceBudgetFit,
  transitionOffer,
  type MemberCapability,
  type ServiceBudgetFit,
  type ServiceOfferDraft,
  type ServiceOfferInput,
  type ServiceOfferStatus,
  type ServiceSearchFilters,
} from "@diasporale/domain"
import { useMemo, useSyncExternalStore } from "react"

import type { ActionErrorCode } from "../data/errors"
import type { ActionResult } from "../data/port"
import {
  MANAGED_OFFERS_PAGE_SIZE,
  SERVICE_RESULTS_PAGE_SIZE,
  type ServiceOfferCardView,
  type ServiceOfferDetailView,
  type ServiceOfferInputView,
  type ServiceOffersPage,
  type ServiceProviderView,
  type ServicesCapability,
  type ServiceSearchRequest,
} from "../data/services-port"
import type { Loadable } from "../data/types"
import { demoManagedPage } from "./page-admin"
import { pageView, statusOf } from "./selectors"
import type { DemoPage, DemoState } from "./state"
import type { DemoStore } from "./store"

/** Ce que la démonstration des demandes lit d'une offre fictive. */
export interface DemoOfferRef {
  readonly id: string
  readonly title: string
  readonly version: number
  readonly status: "draft" | "active" | "paused" | "withdrawn"
  readonly pageId: string
  readonly pageHandle: string
  readonly pageName: string
}

export interface DemoServices {
  readonly capability: ServicesCapability
  readonly findOffer: (offerId: string) => DemoOfferRef | null
}

export const DEMO_SERVICES_STORAGE_KEY = "diasporale:demonstration:services:v1"

/**
 * Les équipes FICTIVES de départ des pages qui proposent des services (qui y
 * signe, invitation acceptée) — le miroir du jeu de la gestion des pages
 * (`page-admin.ts`), vérifié par test. Par défaut, le rôle VIVANT se relit à
 * chaque acte dans la démonstration de la gestion des pages (`demoManagedPage`) :
 * une invitation acceptée ou un rôle retiré y change aussitôt qui gère les offres.
 */
export const DEMO_SERVICE_TEAMS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "page-saveurs": ["p-mireille"],
  "page-asso-lyon": ["p-steeve"],
  "page-valise": ["p-nadia"],
})

/** Une offre de démonstration : les champs de la table `serviceOffers` du moteur. */
export interface DemoServiceOffer extends ServiceOfferDraft {
  readonly id: string
  readonly pageId: string
  readonly status: ServiceOfferStatus
  readonly version: number
  readonly createdAt: number
  readonly updatedAt: number
}

export interface DemoServicesState {
  readonly version: 1
  /** L'état principal dont ces offres sont le prolongement : sa remise à zéro les remet à zéro. */
  readonly seedCreatedAt: number
  readonly sequence: number
  readonly offers: readonly DemoServiceOffer[]
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

const DAY = 24 * 60 * 60 * 1000
const CURSOR_TAG = "demo-services"
/** Ordre des états dans « mes offres » : celui de l'index du moteur (ordre alphabétique des états). */
const STATUS_ORDER: Readonly<Record<ServiceOfferStatus, number>> = { active: 0, draft: 1, paused: 2, withdrawn: 3 }

interface SeedOffer {
  readonly id: string
  readonly pageId: string
  readonly ageDays: number
  readonly status: ServiceOfferStatus
  readonly input: ServiceOfferInput
}

/** Les offres fictives de départ, chacune signalée « (démo) ». */
const SEED_OFFERS: readonly SeedOffer[] = [
  {
    id: "offer-demo-coiffure",
    pageId: "page-saveurs",
    ageDays: 6,
    status: "active",
    input: {
      title: "Tresses et coiffure afro (démo)",
      description: "Offre FICTIVE de démonstration : tresses, nattes, vanilles et entretien, au salon ou à domicile dans Paris.",
      category: "beauty",
      country: "FR",
      city: "Paris",
      delivery: "onsite",
      languages: ["fr"],
      durationMinutes: 180,
      pricing: { mode: "from", amountMinor: 6000, currency: "EUR" },
    },
  },
  {
    id: "offer-demo-photo",
    pageId: "page-saveurs",
    ageDays: 20,
    status: "paused",
    input: {
      title: "Photographie de vos fêtes de famille (démo)",
      description: "Offre FICTIVE de démonstration, en pause : reportage photo d'un baptême, d'un mariage coutumier ou d'un anniversaire.",
      category: "photography",
      country: "FR",
      city: "Paris",
      delivery: "onsite",
      languages: ["fr", "en"],
      durationMinutes: 240,
      pricing: { mode: "fixed", amountMinor: 25000, currency: "EUR" },
    },
  },
  {
    id: "offer-demo-traduction",
    pageId: "page-asso-lyon",
    ageDays: 3,
    status: "active",
    input: {
      title: "Traduction et relecture de courriers, à distance (démo)",
      description: "Offre FICTIVE de démonstration : traduction français-anglais de courriers administratifs, relue par un bénévole du collectif.",
      category: "translation",
      country: "FR",
      city: "Lyon",
      delivery: "remote",
      languages: ["fr", "en"],
      durationMinutes: null,
      pricing: { mode: "quote" },
    },
  },
  {
    id: "offer-demo-accueil-lyon",
    pageId: "page-asso-lyon",
    ageDays: 12,
    status: "active",
    input: {
      title: "Accueil des nouveaux arrivants à Lyon (démo)",
      description: "Offre FICTIVE de démonstration : un premier rendez-vous pour s'orienter (transports, démarches, associations du quartier).",
      category: "settling_in",
      country: "FR",
      city: "Lyon",
      delivery: "both",
      languages: ["fr"],
      durationMinutes: 60,
      pricing: { mode: "fixed", amountMinor: 0, currency: "EUR" },
    },
  },
  {
    id: "offer-demo-affiches",
    pageId: "page-asso-lyon",
    ageDays: 1,
    status: "draft",
    input: {
      title: "Affiches pour vos évènements (démo)",
      description: "Brouillon FICTIF de démonstration : création d'affiches et de visuels pour les soirées des associations.",
      category: "digital_creation",
      country: "FR",
      city: "Lyon",
      delivery: "remote",
      languages: ["fr"],
      durationMinutes: null,
      pricing: { mode: "from", amountMinor: 3000, currency: "EUR" },
    },
  },
  {
    id: "offer-demo-bruxelles",
    pageId: "page-valise",
    ageDays: 9,
    status: "active",
    input: {
      title: "Démarches d'installation à Bruxelles (démo)",
      description: "Offre FICTIVE de démonstration : accompagnement pour la commune, le logement et l'ouverture des compteurs.",
      category: "settling_in",
      country: "BE",
      city: "Bruxelles",
      delivery: "both",
      languages: ["fr"],
      durationMinutes: 90,
      pricing: { mode: "from", amountMinor: 4000, currency: "EUR" },
    },
  },
]

/** L'état de départ, daté par rapport à l'état principal ; chaque offre passe LA règle du domaine. */
export function createDemoServicesSeed(seedCreatedAt: number): DemoServicesState {
  const offers = SEED_OFFERS.flatMap((seed): DemoServiceOffer[] => {
    const draft = parseServiceOffer(seed.input)
    if (!draft.ok) return []
    const at = seedCreatedAt - seed.ageDays * DAY
    return [{ ...draft.value, id: seed.id, pageId: seed.pageId, status: seed.status, version: 1, createdAt: at, updatedAt: at }]
  })
  return { version: 1, seedCreatedAt, sequence: 1, offers }
}

function isState(value: unknown): value is DemoServicesState {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<DemoServicesState>
  return candidate.version === 1 && typeof candidate.seedCreatedAt === "number" && typeof candidate.sequence === "number" && Array.isArray(candidate.offers)
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
  const membership = state.memberships[personId]
  if (!membership) return { refusal: "not_member" }
  const status = statusOf(state, personId, now)
  // Comme la garde du moteur : une sanction ferme le réseau, lecture comprise.
  if (status === "suspendue") return { refusal: "suspended" }
  if (status === null || !hasCapability(status, "read_network")) return { refusal: "not_member" }
  if (!hasCapability(status, capability)) return { refusal: "status_insufficient" }
  return { personId }
}

function providerPage(state: DemoState, pageId: string): DemoPage | null {
  const page = state.pages[pageId]
  return page && isServiceProviderOwnerKind(page.ownerKind) ? page : null
}

function providerView(page: DemoPage): ServiceProviderView {
  return { id: page.id, handle: page.handle, name: page.name, ownerKind: page.ownerKind, badge: pageView(page).badge, logoUrl: null }
}

function cardView(offer: DemoServiceOffer, page: DemoPage, budgetFit: ServiceBudgetFit | null): ServiceOfferCardView {
  return {
    id: offer.id,
    version: offer.version,
    title: offer.title,
    description: offer.description,
    category: offer.category,
    country: offer.country,
    city: offer.city,
    delivery: offer.delivery,
    languages: offer.languages,
    durationMinutes: offer.durationMinutes,
    pricing: offer.pricing,
    provider: providerView(page),
    budgetFit,
    updatedAt: offer.updatedAt,
  }
}

function detailView(offer: DemoServiceOffer, page: DemoPage, viewerCanManage: boolean): ServiceOfferDetailView {
  return { ...cardView(offer, page, null), status: offer.status, viewerCanManage }
}

/** Chaque mot cherché commence un mot du texte indexé (recherche locale, sans moteur plein texte). */
function matchesQuery(searchText: string, query: string | null): boolean {
  if (query === null) return true
  const words = searchText.split(" ")
  return query.split(" ").every((term) => words.some((word) => word.startsWith(term)))
}

function matchesFilters(offer: DemoServiceOffer, filters: ServiceSearchFilters): boolean {
  if (filters.country !== null && offer.country !== filters.country) return false
  if (filters.cityKey !== null && offer.cityKey !== filters.cityKey) return false
  if (filters.category !== null && offer.category !== filters.category) return false
  if (!matchesDeliveryFilter(offer.delivery, filters.delivery)) return false
  return matchesQuery(offer.searchText, filters.query)
}

// ═══════════════════════════════════════════════════════════════
// Curseurs : une frontière (clé de tri), jamais une position
// ═══════════════════════════════════════════════════════════════

type Boundary = readonly [number, number, string]

function encodeCursor(scope: string, boundary: Boundary): string {
  return JSON.stringify([CURSOR_TAG, 1, scope, ...boundary])
}

/** `null` : première page ; `undefined` : curseur illisible ou d'une autre recherche. */
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
function windowAfter<Row>(rows: readonly { readonly key: Boundary; readonly row: Row }[], boundary: Boundary | null, size: number, scope: string): ServiceOffersPage<Row> {
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

function inputOf(input: ServiceOfferInputView): ServiceOfferInput {
  return {
    title: input.title,
    description: input.description,
    category: input.category,
    country: input.country,
    city: input.city,
    delivery: input.delivery,
    languages: input.languages,
    durationMinutes: input.durationMinutes,
    pricing: input.pricing,
  }
}

export interface DemoServicesOptions {
  /** Le stockage des offres ; `null` : en mémoire seulement. Par défaut, celui du navigateur. */
  readonly storage?: StorageLike | null
  /**
   * Des équipes FIXES (tests) ; par défaut, le rôle vivant de la démonstration de
   * la gestion des pages, relu à chaque acte.
   */
  readonly teams?: Readonly<Record<string, readonly string[]>>
}

export function createDemoServices(store: DemoStore, options: DemoServicesOptions = {}): DemoServices {
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
  let state: DemoServicesState = load()
  let version = 0
  const listeners = new Set<() => void>()

  function load(): DemoServicesState {
    const seedCreatedAt = store.getState().createdAt
    try {
      const raw = storage?.getItem(DEMO_SERVICES_STORAGE_KEY)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (isState(parsed) && parsed.seedCreatedAt === seedCreatedAt) return parsed
      }
    } catch {
      // Stockage illisible : on repart des offres de démonstration.
    }
    return createDemoServicesSeed(seedCreatedAt)
  }

  function persist(next: DemoServicesState): void {
    try {
      storage?.setItem(DEMO_SERVICES_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Stockage plein ou interdit : la démonstration continue en mémoire.
    }
  }

  /** L'état courant ; une remise à zéro de l'état principal remet aussi les offres à zéro. */
  function current(): DemoServicesState {
    const seedCreatedAt = store.getState().createdAt
    if (state.seedCreatedAt !== seedCreatedAt) {
      state = createDemoServicesSeed(seedCreatedAt)
      persist(state)
    }
    return state
  }

  function commit(next: DemoServicesState): void {
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

  // ── Lectures ──────────────────────────────────────────────────────────
  function search(request: ServiceSearchRequest): Loadable<ServiceOffersPage<ServiceOfferCardView>> {
    const main = store.getState()
    const viewer = viewerOf(main, store.now(), "read_network")
    if ("refusal" in viewer) return failed(viewer.refusal)
    const parsed = parseServiceSearch({
      query: request.query,
      country: request.country,
      city: request.city,
      category: request.category,
      delivery: request.delivery,
      budget: request.budget,
    })
    if (!parsed.ok) return failed(parsed.code)
    const filters = parsed.value
    const scope = JSON.stringify(filters)
    const boundary = decodeCursor(request.cursor, scope)
    if (boundary === undefined) return failed("unknown")
    const rows = current().offers.flatMap((offer) => {
      if (!isOfferPublic(offer.status) || !matchesFilters(offer, filters)) return []
      const page = providerPage(main, offer.pageId)
      if (!page) return []
      const fit = filters.budget === null ? null : serviceBudgetFit(offer.pricing, filters.budget)
      if (fit !== null && !isKeptByBudget(fit)) return []
      // Les plus récentes d'abord : la clé croissante est l'opposé de la date.
      return [{ key: [-offer.createdAt, 0, offer.id] as Boundary, row: cardView(offer, page, fit) }]
    })
    return ready(windowAfter(rows, boundary, SERVICE_RESULTS_PAGE_SIZE, scope))
  }

  function offer(offerId: string): Loadable<ServiceOfferDetailView | null> {
    const main = store.getState()
    const viewer = viewerOf(main, store.now(), "read_network")
    if ("refusal" in viewer) return failed(viewer.refusal)
    const found = current().offers.find((candidate) => candidate.id === offerId)
    const page = found ? providerPage(main, found.pageId) : null
    if (!found || !page) return ready(null)
    if (isOnTeam(page.id, viewer.personId)) return ready(detailView(found, page, true))
    return ready(isOfferPublic(found.status) ? detailView(found, page, false) : null)
  }

  function pageOffers({ pageHandle, cursor, category, delivery, personId }: Parameters<ServicesCapability["usePageOffers"]>[0]): Loadable<ServiceOffersPage<ServiceOfferCardView>> {
    const main = store.getState()
    const viewer = viewerOf(main, store.now(), "read_network")
    if ("refusal" in viewer) return failed(viewer.refusal)
    if (personId !== undefined && personId !== viewer.personId) return failed("not_found")
    const page = Object.values(main.pages).find((candidate) => candidate.handle === pageHandle.trim().toLowerCase())
    if (!page || !isServiceProviderOwnerKind(page.ownerKind)) return failed("not_found")
    const parsed = parseServiceSearch({ category, delivery })
    if (!parsed.ok) return failed(parsed.code)
    const filters = parsed.value
    const data = current()
    const scoped = personId !== undefined || filters.category !== null || filters.delivery !== null
    // Le périmètre historique reste identique sans filtre effectif ni lecteur
    // explicite ; les nouveaux curseurs ne traversent ni compte ni remise à zéro.
    const scope = scoped ? JSON.stringify(["page-filtered", page.id, viewer.personId, data.seedCreatedAt, filters.category, filters.delivery]) : `page:${page.id}`
    if (scoped && cursor !== null && cursor.length > 1024) return failed("unknown")
    const boundary = decodeCursor(cursor, scope)
    if (boundary === undefined) return failed("unknown")
    const rows = data.offers
      .filter((candidate) => candidate.pageId === page.id && isOfferPublic(candidate.status) && matchesFilters(candidate, filters))
      .map((candidate) => ({ key: [-candidate.createdAt, 0, candidate.id] as Boundary, row: cardView(candidate, page, null) }))
    return ready(windowAfter(rows, boundary, SERVICE_RESULTS_PAGE_SIZE, scope))
  }

  function myPageOffers({ pageId, cursor, status, personId }: Parameters<ServicesCapability["useMyPageOffers"]>[0]): Loadable<ServiceOffersPage<ServiceOfferDetailView>> {
    const main = store.getState()
    const viewer = viewerOf(main, store.now(), "read_network")
    if ("refusal" in viewer) return failed(viewer.refusal)
    if (personId !== undefined && personId !== viewer.personId) return failed("not_found")
    const page = main.pages[pageId]
    if (!page || !isOnTeam(page.id, viewer.personId)) return failed("not_found")
    if (!isServiceProviderOwnerKind(page.ownerKind)) return failed("service_page_kind_not_allowed")
    if (status !== undefined && !(SERVICE_OFFER_STATUSES as readonly string[]).includes(status)) return failed("unknown")
    const data = current()
    const scoped = status !== undefined || personId !== undefined
    // Les anciens appels gardent leur frontière ; les lectures filtrées sont
    // liées au lecteur, à l'état choisi et à cette génération de démonstration.
    const scope = scoped ? JSON.stringify(["mine-filtered", page.id, viewer.personId, data.seedCreatedAt, status ?? null]) : `mine:${page.id}`
    if (scoped && cursor !== null && cursor.length > 1024) return failed("unknown")
    const boundary = decodeCursor(cursor, scope)
    if (boundary === undefined) return failed("unknown")
    const rows = data.offers
      .filter((candidate) => candidate.pageId === page.id && (status === undefined || candidate.status === status))
      .map((candidate) => ({ key: [STATUS_ORDER[candidate.status], candidate.createdAt, candidate.id] as Boundary, row: detailView(candidate, page, true) }))
    return ready(windowAfter(rows, boundary, MANAGED_OFFERS_PAGE_SIZE, scope))
  }

  // ── Écritures ─────────────────────────────────────────────────────────
  /** Le gestionnaire de la page : membre qui publie, signataire de la page, nature admise. */
  function manager(pageId: string): { readonly page: DemoPage } | { readonly refusal: ActionErrorCode } {
    const main = store.getState()
    const viewer = viewerOf(main, store.now(), "publish")
    if ("refusal" in viewer) return viewer
    const page = main.pages[pageId]
    if (!page || !isOnTeam(page.id, viewer.personId)) return { refusal: "not_found" }
    if (!isServiceProviderOwnerKind(page.ownerKind)) return { refusal: "service_page_kind_not_allowed" }
    return { page }
  }

  function managedOffer(offerId: string): { readonly offer: DemoServiceOffer } | { readonly refusal: ActionErrorCode } {
    const found = current().offers.find((candidate) => candidate.id === offerId)
    if (!found) {
      // Même ordre que le moteur : l'éligibilité de la personne se juge avant l'existence de l'offre.
      const viewer = viewerOf(store.getState(), store.now(), "publish")
      return { refusal: "refusal" in viewer ? viewer.refusal : "not_found" }
    }
    const access = manager(found.pageId)
    return "refusal" in access ? access : { offer: found }
  }

  function replaceOffer(next: DemoServiceOffer): void {
    const live = current()
    commit({ ...live, offers: live.offers.map((candidate) => (candidate.id === next.id ? next : candidate)) })
  }

  const capability: ServicesCapability = {
    supportsPageOfferFilters: true,
    supportsManagedOfferStatusFilter: true,
    useSearch(request) {
      const snap = useSnapshot()
      const key = JSON.stringify([request.query, request.country, request.city, request.category, request.delivery, request.budget?.amountMinor, request.budget?.currency, request.cursor])
      // `key` résume la requête : un objet de requête neuf, de même contenu, ne relance rien.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      return useMemo(() => (snap === OUT_OF_SESSION ? LOADING : search(request)), [snap, key])
    },
    useOffer(offerId) {
      const snap = useSnapshot()
      return useMemo(() => (snap === OUT_OF_SESSION ? LOADING : offer(offerId)), [snap, offerId])
    },
    usePageOffers({ pageHandle, cursor, category, delivery, personId }) {
      const snap = useSnapshot()
      return useMemo(() => (snap === OUT_OF_SESSION ? LOADING : pageOffers({
        pageHandle,
        cursor,
        ...(category !== undefined ? { category } : {}),
        ...(delivery !== undefined ? { delivery } : {}),
        ...(personId !== undefined ? { personId } : {}),
      })), [snap, pageHandle, cursor, category, delivery, personId])
    },
    useMyPageOffers({ pageId, cursor, status, personId }) {
      const snap = useSnapshot()
      return useMemo(() => (snap === OUT_OF_SESSION ? LOADING : myPageOffers({
        pageId,
        cursor,
        ...(status !== undefined ? { status } : {}),
        ...(personId !== undefined ? { personId } : {}),
      })), [snap, pageId, cursor, status, personId])
    },

    async createOffer(input) {
      const access = manager(input.pageId)
      if ("refusal" in access) return fail(access.refusal)
      const draft = parseServiceOffer(inputOf(input))
      if (!draft.ok) return fail(draft.code)
      const live = current()
      const count = live.offers.filter((candidate) => candidate.pageId === access.page.id && candidate.status !== "withdrawn").length
      if (count >= SERVICE_OFFERS_PER_PAGE_MAX) return fail("service_offer_limit_reached")
      const now = store.now()
      const status = initialOfferStatus(input.publish)
      const offerId = `offer-demo-${live.sequence}`
      commit({
        ...live,
        sequence: live.sequence + 1,
        offers: [...live.offers, { ...draft.value, id: offerId, pageId: access.page.id, status, version: 1, createdAt: now, updatedAt: now }],
      })
      return { ok: true, value: { offerId, version: 1, status } }
    },

    async updateOffer(input) {
      const access = managedOffer(input.offerId)
      if ("refusal" in access) return fail(access.refusal)
      if (!isOfferEditable(access.offer.status)) return fail("service_offer_withdrawn")
      const next = checkOfferVersion(access.offer.version, input.expectedVersion)
      if (!next.ok) return fail(next.code)
      const draft = parseServiceOffer(inputOf(input))
      if (!draft.ok) return fail(draft.code)
      replaceOffer({ ...access.offer, ...draft.value, version: next.value, updatedAt: store.now() })
      return { ok: true, value: { version: next.value } }
    },

    async setOfferStatus(input) {
      const access = managedOffer(input.offerId)
      if ("refusal" in access) return fail(access.refusal)
      const transition = transitionOffer(access.offer.status, input.status)
      if (!transition.ok) return fail(transition.code)
      if (!transition.value.changed) return { ok: true, value: { status: access.offer.status, version: access.offer.version } }
      const next = checkOfferVersion(access.offer.version, input.expectedVersion)
      if (!next.ok) return fail(next.code)
      replaceOffer({ ...access.offer, status: transition.value.status, version: next.value, updatedAt: store.now() })
      return { ok: true, value: { status: transition.value.status, version: next.value } }
    },
  }

  function findOffer(offerId: string): DemoOfferRef | null {
    const found = current().offers.find((candidate) => candidate.id === offerId)
    const page = found ? store.getState().pages[found.pageId] : undefined
    if (!found || !page) return null
    return { id: found.id, title: found.title, version: found.version, status: found.status, pageId: page.id, pageHandle: page.handle, pageName: page.name }
  }

  return { capability, findOffer }
}

