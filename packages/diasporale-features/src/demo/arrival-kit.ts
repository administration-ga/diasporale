/**
 * Démonstration de la capacité « kit d'arrivée » (DG-024 b) — données FICTIVES.
 * PROPRIÉTAIRE : ce chantier.
 *
 * Le registre des ressources est LOCAL à ce chantier (le magasin commun n'est pas
 * modifié) : gardé dans ce seul navigateur et remis à zéro avec la démonstration (il
 * suit la date de création du jeu fictif). Les règles sont celles de
 * `@diasporale/domain` (arrival-kit), dans l'ordre du moteur : session → adhésion →
 * capacité → droit sur la ressource → règle du kit.
 *
 * Le jeu fictif couvre Paris, Lyon et Montréal (et deux ressources valables dans toute
 * la France) ; chaque titre porte la mention « (démo) » et chaque source est FICTIVE,
 * sans adresse : aucun lien n'est proposé. Les autrices, auteurs et relecteurs sont
 * les personnes fictives de la démonstration ; une ressource est portée par la page
 * officielle FICTIVE du poste de démonstration, une autre par le collectif de Lyon.
 */
import { isProfilePublished } from "@antsia/social-domain/content"
import {
  arrivalKitReviewCause,
  arrivalKitReviewDueAt,
  checkArrivalKitFlag,
  checkArrivalKitReviewer,
  checkArrivalKitVersion,
  DAY_MS,
  effectiveArrivalKitStatus,
  hasCapability,
  isArrivalKitCarrierKind,
  isArrivalKitIndependent,
  isArrivalKitListed,
  isArrivalKitQuotaReached,
  isArrivalKitReviewer,
  matchesArrivalKitListing,
  pageBadge,
  parseArrivalKitCountry,
  parseArrivalKitListing,
  parseArrivalKitReason,
  parseArrivalKitResource,
  transitionArrivalKit,
  type ArrivalKitCategory,
  type ArrivalKitOutdatedReason,
  type ArrivalKitResourceDraft,
  type ArrivalKitReviewerFacts,
  type ArrivalKitReviewOutcome,
  type ArrivalKitStatus,
  type CountryCode,
  type MembershipStatus,
} from "@diasporale/domain"
import { useMemo, useSyncExternalStore } from "react"

import {
  ARRIVAL_KIT_LIST_PAGE_SIZE,
  type ArrivalKitCapability,
  type ArrivalKitCarrierView,
  type ArrivalKitListPage,
  type ArrivalKitOwnItemView,
  type ArrivalKitPageLabel,
  type ArrivalKitPersonLabel,
  type ArrivalKitQueueItemView,
  type ArrivalKitResourceCardView,
  type ArrivalKitResourceDetailView,
  type ArrivalKitStandingView,
} from "../data/arrival-kit-port"
import type { ActionErrorCode } from "../data/errors"
import type { ActionResult } from "../data/port"
import type { Loadable } from "../data/types"
import { demoPageAdminContext } from "./page-admin"
import { statusOf } from "./selectors"
import type { DemoPage, DemoState } from "./state"
import type { DemoStore } from "./store"

export const DEMO_ARRIVAL_KIT_STORAGE_KEY = "diasporale:demonstration:kit-arrivee:v1"

export interface DemoKitResource {
  readonly id: string
  /** Ressource personnelle : son autrice ou son auteur ; `null` pour une ressource portée par une page. */
  readonly authorId: string | null
  readonly pageId: string | null
  readonly proposedById: string
  readonly revisedById: string
  readonly title: string
  readonly summary: string
  readonly body: string
  readonly category: ArrivalKitCategory
  readonly country: CountryCode
  readonly city: string | null
  readonly cityKey: string
  readonly sourceName: string
  /** `null` : source fictive du jeu de démonstration, sans adresse (aucun lien proposé). */
  readonly sourceUrl: string | null
  readonly lastVerifiedAt: number
  readonly status: ArrivalKitStatus
  readonly statusReason: string | null
  readonly revision: number
  readonly version: number
  readonly reviewedById: string | null
  readonly reviewedAt: number | null
  readonly submittedAt: number | null
  readonly revisedAt: number
  readonly createdAt: number
  readonly updatedAt: number
}

export interface DemoKitFlag {
  readonly resourceId: string
  readonly revision: number
  readonly personId: string
  readonly reason: ArrivalKitOutdatedReason
  readonly createdAt: number
}

export interface DemoKitReview {
  readonly resourceId: string
  readonly revision: number
  readonly reviewerId: string
  readonly outcome: ArrivalKitReviewOutcome
  readonly reason: string | null
  readonly createdAt: number
}

export interface DemoKitLedger {
  readonly seedCreatedAt: number
  readonly sequence: number
  readonly resources: readonly DemoKitResource[]
  readonly flags: readonly DemoKitFlag[]
  readonly reviews: readonly DemoKitReview[]
}

type SeedFields = Pick<DemoKitResource, "id" | "title" | "summary" | "body" | "category" | "country" | "city" | "sourceName"> & Partial<DemoKitResource>

/** Le jeu fictif, daté depuis la création de la démonstration : chaque ressource publiée a été relue par une autre personne. */
export function demoArrivalKitSeed(createdAt: number): DemoKitLedger {
  const ago = (days: number) => createdAt - days * DAY_MS
  const resource = (fields: SeedFields): DemoKitResource => ({
    authorId: null,
    pageId: null,
    proposedById: "p-mireille",
    revisedById: "p-mireille",
    cityKey: "",
    sourceUrl: null,
    lastVerifiedAt: ago(20),
    status: "published",
    statusReason: null,
    revision: 1,
    version: 2,
    reviewedById: "p-prisca",
    reviewedAt: ago(15),
    submittedAt: ago(18),
    revisedAt: ago(18),
    createdAt: ago(18),
    updatedAt: ago(15),
    ...fields,
  })
  const resources: DemoKitResource[] = [
    resource({
      id: "kit-1",
      pageId: "page-poste-fr",
      proposedById: "p-clarisse",
      revisedById: "p-clarisse",
      title: "S'inscrire au registre consulaire (démo)",
      summary: "Les étapes d'une inscription, décrites par le poste de démonstration. Exemple fictif.",
      body: "Exemple de démonstration : prendre rendez-vous auprès du poste, présenter une pièce d'identité et un justificatif de résidence, puis recevoir une confirmation. Ces indications sont fictives et ne valent pour aucune démarche réelle.",
      category: "procedures",
      country: "FR",
      city: null,
      sourceName: "Poste consulaire de démonstration (source fictive)",
      lastVerifiedAt: ago(10),
    }),
    resource({
      id: "kit-2",
      authorId: "p-mireille",
      title: "Ouvrir un premier compte bancaire à Paris (démo)",
      summary: "Les pièces habituellement demandées et les délais constatés par des membres. Exemple fictif.",
      body: "Exemple de démonstration : prenez rendez-vous en agence avec une pièce d'identité, un justificatif de domicile et, le cas échéant, votre titre de séjour. Comptez quelques jours pour recevoir votre carte. Ces indications sont fictives.",
      category: "banking",
      country: "FR",
      city: "Paris",
      cityKey: "paris",
      sourceName: "Portail public d'information bancaire (source fictive)",
      lastVerifiedAt: ago(30),
    }),
    resource({
      id: "kit-3",
      authorId: "p-clarisse",
      proposedById: "p-clarisse",
      revisedById: "p-clarisse",
      title: "Se soigner à Paris : centres de santé de quartier (démo)",
      summary: "Trouver un centre de santé et préparer une première consultation. Exemple fictif.",
      body: "Exemple de démonstration : les centres de santé de quartier reçoivent sur rendez-vous ; munissez-vous de votre attestation d'assurance maladie. Ces indications sont fictives et leur vérification date de plus d'un an.",
      category: "health",
      country: "FR",
      city: "Paris",
      cityKey: "paris",
      sourceName: "Annuaire public des centres de santé (source fictive)",
      // Vérifiée il y a plus de douze mois : la règle d'ancienneté la fait lire « à revoir ».
      lastVerifiedAt: ago(400),
      reviewedById: "p-mireille",
      reviewedAt: ago(395),
      submittedAt: ago(398),
      revisedAt: ago(398),
      createdAt: ago(398),
      updatedAt: ago(395),
    }),
    resource({
      id: "kit-4",
      authorId: "p-steeve",
      proposedById: "p-steeve",
      revisedById: "p-steeve",
      title: "Trouver un logement étudiant à Lyon (démo)",
      summary: "Résidences, colocations et aides au logement : ce que des membres ont constaté. Exemple fictif.",
      body: "Exemple de démonstration : déposez votre dossier dès l'admission, comparez résidences et colocations, et renseignez-vous sur les aides au logement. Méfiez-vous de toute demande de paiement avant une visite. Ces indications sont fictives.",
      category: "housing",
      country: "FR",
      city: "Lyon",
      cityKey: "lyon",
      sourceName: "Service public du logement étudiant (source fictive)",
      lastVerifiedAt: ago(60),
      reviewedById: "p-nadia",
    }),
    resource({
      id: "kit-5",
      pageId: "page-asso-lyon",
      proposedById: "p-steeve",
      revisedById: "p-steeve",
      title: "Abonnements de transport à Lyon (démo)",
      summary: "Les formules d'abonnement et les réductions pour les jeunes et les étudiants. Exemple fictif.",
      body: "Exemple de démonstration proposé par le collectif : un abonnement mensuel couvre bus, tram et métro ; les jeunes bénéficient d'un tarif réduit sur justificatif. Ces indications sont fictives.",
      category: "transport",
      country: "FR",
      city: "Lyon",
      cityKey: "lyon",
      sourceName: "Réseau de transport métropolitain (source fictive)",
      lastVerifiedAt: ago(5),
      // Soumise : elle attend la relecture d'une personne étrangère au collectif.
      status: "submitted",
      version: 1,
      reviewedById: null,
      reviewedAt: null,
      submittedAt: ago(2),
      revisedAt: ago(2),
      createdAt: ago(2),
      updatedAt: ago(2),
    }),
    resource({
      id: "kit-6",
      authorId: "p-rodrigue",
      proposedById: "p-rodrigue",
      revisedById: "p-rodrigue",
      title: "Obtenir son numéro d'assurance sociale (démo)",
      summary: "La démarche pour obtenir le numéro demandé pour travailler au Canada. Exemple fictif.",
      body: "Exemple de démonstration : la demande se fait en ligne ou au comptoir d'un bureau de services, avec une pièce d'identité et un document d'immigration valide. Ces indications sont fictives.",
      category: "procedures",
      country: "CA",
      city: "Montréal",
      cityKey: "montreal",
      sourceName: "Portail fédéral des services (source fictive)",
      lastVerifiedAt: ago(45),
      reviewedById: "p-nadia",
    }),
    resource({
      id: "kit-7",
      authorId: "p-rodrigue",
      proposedById: "p-rodrigue",
      revisedById: "p-rodrigue",
      title: "Inscrire son enfant à l'école à Montréal (démo)",
      summary: "Les pièces demandées et le calendrier des inscriptions scolaires. Exemple fictif.",
      body: "Exemple de démonstration : l'inscription se fait auprès du centre de services scolaire du quartier, avec une preuve de résidence et le carnet de vaccination de l'enfant. Ces indications sont fictives.",
      category: "schooling",
      country: "CA",
      city: "Montréal",
      cityKey: "montreal",
      sourceName: "Centre de services scolaire (source fictive)",
      lastVerifiedAt: ago(120),
      // Marquée « à revoir » par une relecture, avec son motif (lu par l'auteur et les relecteurs).
      status: "needs_review",
      statusReason: "Les dates d'inscription ont changé cette année (motif fictif).",
      version: 3,
      reviewedById: "p-nadia",
      reviewedAt: ago(100),
      updatedAt: ago(4),
    }),
    resource({
      id: "kit-8",
      authorId: "p-mireille",
      title: "Numéros d'urgence en France (démo)",
      summary: "Où trouver les numéros à composer en cas d'urgence. Exemple fictif.",
      body: "Exemple de démonstration : une fiche réelle listerait ici les numéros d'urgence du pays, vérifiés auprès de la source officielle, et rappellerait qu'ils sont gratuits depuis tout téléphone. Ces indications sont fictives.",
      category: "emergency",
      country: "FR",
      city: null,
      sourceName: "Information publique sur les secours (source fictive)",
      lastVerifiedAt: ago(8),
      reviewedById: "p-nadia",
      reviewedAt: ago(6),
    }),
    resource({
      id: "kit-9",
      authorId: "p-prisca",
      proposedById: "p-prisca",
      revisedById: "p-prisca",
      title: "Rencontrer les associations culturelles à Bordeaux (démo)",
      summary: "Où rencontrer les associations qui accueillent les nouveaux arrivants. Exemple fictif.",
      body: "Exemple de démonstration : les associations culturelles se présentent lors des journées d'accueil de la rentrée ; renseignez-vous auprès de la maison des associations. Ces indications sont fictives.",
      category: "culture_associations",
      country: "FR",
      city: "Bordeaux",
      cityKey: "bordeaux",
      sourceName: "Maison des associations (source fictive)",
      lastVerifiedAt: ago(12),
      // Renvoyée à son autrice avec un motif : redevenue un brouillon.
      status: "draft",
      statusReason: "Précisez quelles associations accueillent les nouveaux arrivants (motif fictif).",
      reviewedById: null,
      reviewedAt: null,
      submittedAt: null,
      updatedAt: ago(9),
    }),
  ]
  return {
    seedCreatedAt: createdAt,
    sequence: 20,
    resources,
    // Deux signalements sur la ressource lyonnaise : sous le seuil, elle reste publiée.
    flags: [
      { resourceId: "kit-4", revision: 1, personId: "p-clarisse", reason: "link_broken", createdAt: ago(3) },
      { resourceId: "kit-4", revision: 1, personId: "p-rodrigue", reason: "information_changed", createdAt: ago(1) },
    ],
    reviews: resources
      .filter((row) => row.reviewedById !== null && row.reviewedAt !== null)
      .map((row) => ({ resourceId: row.id, revision: row.revision, reviewerId: row.reviewedById as string, outcome: "published" as const, reason: null, createdAt: row.reviewedAt as number })),
  }
}

const ACTIVE: ReadonlySet<MembershipStatus> = new Set(["en_attente", "declaree", "verifiee"])
const LOADING = { status: "loading" } as const
const CURSOR_TAG = "demo-arrival-kit"
/**
 * La démonstration ne modère jamais (G9) : qui GÈRE une ressource y lit « publiée », comme
 * le moteur pour un contenu sans état ; tout autre lecteur ne lit aucun état.
 */
const MANAGED_MODERATION: Pick<ArrivalKitOwnItemView, "moderation"> = { moderation: "published" }

function failure(code: ActionErrorCode): { readonly ok: false; readonly code: ActionErrorCode } {
  return { ok: false, code }
}

/** Le refus du LECTEUR, dans l'ordre du moteur : session, adhésion, sanction, capacité. */
function viewerRefusal(state: DemoState, now: number, capability: "read_network" | "publish"): ActionErrorCode | null {
  const viewerId = state.session.personId
  if (!viewerId || !state.persons[viewerId]) return "not_signed_in"
  const status = statusOf(state, viewerId, now)
  if (status === null || status === "partie") return "not_member"
  if (status === "suspendue") return "suspended"
  if (!hasCapability(status, capability)) return "status_insufficient"
  return null
}

function isActiveMember(state: DemoState, personId: string, now: number): boolean {
  const status = statusOf(state, personId, now)
  return status !== null && ACTIVE.has(status)
}

/** Le profil PUBLIÉ d'une personne encore membre active, ou le nom neutre ; aucune coordonnée. */
function personLabel(state: DemoState, personId: string, now: number): ArrivalKitPersonLabel {
  const person = state.persons[personId]
  const profile = person?.profile && isProfilePublished(person) && isActiveMember(state, personId, now) ? person.profile : null
  return { displayName: profile?.displayName ?? null, handle: profile?.handle ?? null }
}

/** La page et son badge CALCULÉ (jamais stocké) ; `null` si elle n'existe pas. */
function pageLabel(pages: Readonly<Record<string, DemoPage>>, pageId: string): ArrivalKitPageLabel | null {
  const page = pages[pageId]
  if (!page) return null
  return {
    id: page.id,
    handle: page.handle,
    name: page.name,
    badge: pageBadge({ ownerKind: page.ownerKind, source: page.source, claimValidated: page.claimValidated }),
    ownerKind: page.ownerKind,
  }
}

function writersOf(row: DemoKitResource): string[] {
  return row.authorId === null ? [row.proposedById, row.revisedById] : [row.authorId, row.proposedById, row.revisedById]
}

function flagCount(ledger: DemoKitLedger, row: DemoKitResource): number {
  return ledger.flags.filter((flag) => flag.resourceId === row.id && flag.revision === row.revision).length
}

function toCard(row: DemoKitResource, carrier: ArrivalKitCarrierView, flags: number, now: number): ArrivalKitResourceCardView {
  const standing = { status: row.status, lastVerifiedAt: row.lastVerifiedAt, outdatedFlags: flags }
  return {
    id: row.id,
    version: row.version,
    revision: row.revision,
    title: row.title,
    summary: row.summary,
    category: row.category,
    country: row.country,
    city: row.city,
    status: effectiveArrivalKitStatus(standing, now),
    reviewCause: arrivalKitReviewCause(standing, now),
    lastVerifiedAt: row.lastVerifiedAt,
    reviewDueAt: arrivalKitReviewDueAt(row.lastVerifiedAt),
    revisedAt: row.revisedAt,
    reviewedAt: row.reviewedAt,
    carrier,
    official: carrier.kind === "page" && carrier.page.badge === "official",
  }
}

const byVerified = (left: DemoKitResource, right: DemoKitResource) => right.lastVerifiedAt - left.lastVerifiedAt || (left.id < right.id ? 1 : -1)
const byUpdated = (left: DemoKitResource, right: DemoKitResource) => right.updatedAt - left.updatedAt || (left.id < right.id ? 1 : -1)
const bySubmitted = (left: DemoKitResource, right: DemoKitResource) => (left.submittedAt ?? left.revisedAt) - (right.submittedAt ?? right.revisedAt) || (left.id < right.id ? -1 : 1)

/** Une fenêtre d'une liste triée ; le curseur est opaque pour l'écran, validé ici. */
function windowOf<T>(items: readonly T[], cursor: string | null, scope: string): Loadable<ArrivalKitListPage<T>> {
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
  const end = offset + ARRIVAL_KIT_LIST_PAGE_SIZE
  const isDone = end >= items.length
  return { status: "ready", data: { items: items.slice(offset, end), isDone, continueCursor: isDone ? null : JSON.stringify([CURSOR_TAG, scope, end]) } }
}

function isLedger(value: unknown): value is DemoKitLedger {
  if (typeof value !== "object" || value === null) return false
  const ledger = value as Partial<DemoKitLedger>
  return typeof ledger.seedCreatedAt === "number" && typeof ledger.sequence === "number"
    && Array.isArray(ledger.resources) && Array.isArray(ledger.flags) && Array.isArray(ledger.reviews)
    && ledger.resources.every((row) => typeof row === "object" && row !== null && typeof row.id === "string" && typeof row.version === "number")
}

/** Les champs écrits d'une version validée par la règle du domaine. */
function contentOf(draft: ArrivalKitResourceDraft) {
  return {
    title: draft.title,
    summary: draft.summary,
    body: draft.body,
    category: draft.category,
    country: draft.country,
    city: draft.city,
    cityKey: draft.cityKey,
    sourceName: draft.sourceName,
    sourceUrl: draft.sourceUrl,
    lastVerifiedAt: draft.lastVerifiedAt,
  }
}

function replace(ledger: DemoKitLedger, id: string, patch: Partial<DemoKitResource>): DemoKitLedger {
  return { ...ledger, resources: ledger.resources.map((row) => (row.id === id ? { ...row, ...patch } : row)) }
}

type StorageLike = Pick<Storage, "getItem" | "setItem">

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}

export interface DemoArrivalKitOptions {
  /** Persistance de ce navigateur ; `null` : en mémoire seulement (tests). */
  readonly storage?: StorageLike | null
  /** Latence simulée d'une écriture (ms). */
  readonly latencyMs?: number
}

/** L'issue d'un geste : un registre à enregistrer et une valeur, ou un refus à code fermé. */
type Outcome<T> = { readonly commit: DemoKitLedger; readonly value: T } | { readonly refuse: ActionErrorCode }

interface DemoAccess {
  readonly row: DemoKitResource
  readonly carrier: ArrivalKitCarrierView
  readonly manages: boolean
  readonly reviewer: ArrivalKitReviewerFacts
  readonly independent: boolean
}

export function createDemoArrivalKit(store: DemoStore, options: DemoArrivalKitOptions = {}): ArrivalKitCapability {
  const teams = demoPageAdminContext(store)
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const latencyMs = options.latencyMs ?? 180
  const listeners = new Set<() => void>()
  let revision = 0
  let ledger: DemoKitLedger | null = null

  /** Le registre du jeu fictif COURANT : une démonstration remise à zéro repart du jeu fictif. */
  const current = (): DemoKitLedger => {
    const createdAt = store.getState().createdAt
    if (ledger?.seedCreatedAt === createdAt) return ledger
    let loaded: DemoKitLedger | null = null
    try {
      const raw = storage?.getItem(DEMO_ARRIVAL_KIT_STORAGE_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : null
      if (isLedger(parsed) && parsed.seedCreatedAt === createdAt) loaded = parsed
    } catch {
      // Stockage illisible ou bloqué : on repart du jeu fictif.
    }
    ledger = loaded ?? demoArrivalKitSeed(createdAt)
    return ledger
  }

  const commit = (next: DemoKitLedger) => {
    ledger = next
    revision += 1
    try {
      storage?.setItem(DEMO_ARRIVAL_KIT_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Stockage plein ou interdit : la démonstration continue en mémoire.
    }
    for (const listener of listeners) listener()
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    const unsubscribeStore = store.subscribe(listener)
    const unsubscribeTeams = teams.subscribe(listener)
    return () => {
      listeners.delete(listener)
      unsubscribeStore()
      unsubscribeTeams()
    }
  }
  /** Instantané primitif : la session (magasin commun), les équipes et le registre. Rendu serveur : en chargement. */
  const useRevision = () => useSyncExternalStore(subscribe, () => `${store.getVersion()}:${revision}:${teams.getVersion()}`, () => "")

  const pause = async () => {
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs))
  }

  /** Une écriture appartient à la session qui l'a lancée : changée pendant l'attente, rien n'est écrit. */
  const act = async <T>(work: (state: DemoState, viewerId: string, now: number) => Outcome<T>): Promise<ActionResult<T>> => {
    const viewerId = store.getState().session.personId
    await pause()
    const state = store.getState()
    if (!viewerId || state.session.personId !== viewerId) return failure("not_signed_in")
    const outcome = work(state, viewerId, store.now())
    if ("refuse" in outcome) return failure(outcome.refuse)
    commit(outcome.commit)
    return { ok: true, value: outcome.value }
  }

  /** Qui GÈRE la ressource : son autrice ou son auteur, ou un signataire VIVANT de la page qui la porte. */
  const manages = (row: DemoKitResource, viewerId: string) => (row.pageId !== null ? teams.isSignatory(row.pageId, viewerId) : row.authorId === viewerId)

  const reviewerFacts = (state: DemoState, pages: Readonly<Record<string, DemoPage>>, viewerId: string, now: number): ArrivalKitReviewerFacts => {
    const status = statusOf(state, viewerId, now) ?? "partie"
    if (status === "verifiee" || !hasCapability(status, "publish")) return { status, livePageSignatory: false }
    return { status, livePageSignatory: Object.keys(pages).some((pageId) => teams.isSignatory(pageId, viewerId)) }
  }

  /** Qui porte la ressource, ou `null` si elle ne se lit plus (page absente, auteur parti du réseau). */
  const carrierOf = (state: DemoState, pages: Readonly<Record<string, DemoPage>>, row: DemoKitResource, now: number): ArrivalKitCarrierView | null => {
    if (row.pageId !== null) {
      const page = pageLabel(pages, row.pageId)
      return page === null ? null : { kind: "page", page }
    }
    const authorId = row.authorId ?? row.proposedById
    if (!isActiveMember(state, authorId, now)) return null
    return { kind: "person", person: personLabel(state, authorId, now) }
  }

  /** Mêmes règles que le moteur : publiée ou à revoir pour tout lecteur ; sinon qui gère, ou — soumise — une relectrice étrangère. */
  const accessOf = (state: DemoState, pages: Readonly<Record<string, DemoPage>>, row: DemoKitResource | undefined, viewerId: string, now: number): DemoAccess | null => {
    if (!row) return null
    const carrier = carrierOf(state, pages, row, now)
    if (carrier === null) return null
    const managing = manages(row, viewerId)
    const reviewer = reviewerFacts(state, pages, viewerId, now)
    const independent = isArrivalKitIndependent({ actorId: viewerId, writerIds: writersOf(row), onCarrierTeam: row.pageId !== null && managing })
    const visible = isArrivalKitListed(row.status) || managing || (row.status === "submitted" && isArrivalKitReviewer(reviewer) && independent)
    return visible ? { row, carrier, manages: managing, reviewer, independent } : null
  }

  /** La ressource gérée par le lecteur ; sinon le refus indistinct. */
  const managed = (base: DemoKitLedger, resourceId: string, viewerId: string): DemoKitResource | null => {
    const row = base.resources.find((candidate) => candidate.id === resourceId)
    return row && manages(row, viewerId) ? row : null
  }

  /** La ressource visible ET relue par le lecteur (habilité, étranger à elle), ou le refus. */
  const reviewable = (state: DemoState, base: DemoKitLedger, resourceId: string, viewerId: string, now: number): DemoAccess | ActionErrorCode => {
    const access = accessOf(state, teams.pagesOf(state), base.resources.find((candidate) => candidate.id === resourceId), viewerId, now)
    if (access === null) return "not_found"
    const check = checkArrivalKitReviewer({ reviewer: access.reviewer, actorId: viewerId, writerIds: writersOf(access.row), onCarrierTeam: access.row.pageId !== null && access.manages })
    return check.ok ? access : check.code
  }

  /** Le registre après une décision de relecture : la ressource changée, et la décision au journal. */
  const withReview = (
    base: DemoKitLedger,
    row: DemoKitResource,
    viewerId: string,
    now: number,
    outcome: ArrivalKitReviewOutcome,
    reason: string | null,
    patch: Partial<DemoKitResource>,
  ): DemoKitLedger => {
    const next = replace(base, row.id, { ...patch, updatedAt: now })
    return { ...next, reviews: [...next.reviews, { resourceId: row.id, revision: row.revision, reviewerId: viewerId, outcome, reason, createdAt: now }] }
  }

  return {
    useStanding() {
      const key = useRevision()
      return useMemo((): Loadable<ArrivalKitStandingView> => {
        if (key === "") return LOADING
        const state = store.getState()
        const now = store.now()
        const refusal = viewerRefusal(state, now, "read_network")
        if (refusal) return { status: "error", code: refusal }
        const viewerId = state.session.personId as string
        const pages = teams.pagesOf(state)
        const canPropose = viewerRefusal(state, now, "publish") === null
        const signed = canPropose ? Object.values(pages).filter((page) => teams.isSignatory(page.id, viewerId)) : []
        const status = statusOf(state, viewerId, now) ?? "partie"
        return {
          status: "ready",
          data: {
            canPropose,
            canReview: isArrivalKitReviewer({ status, livePageSignatory: signed.length > 0 }),
            carrierPages: signed.filter((page) => isArrivalKitCarrierKind(page.ownerKind)).flatMap((page) => {
              const label = pageLabel(pages, page.id)
              return label === null ? [] : [label]
            }),
          },
        }
      }, [key])
    },

    useResources(request) {
      const key = useRevision()
      const { country, city, nationalOnly, category, cursor } = request
      return useMemo((): Loadable<ArrivalKitListPage<ArrivalKitResourceCardView>> => {
        if (key === "") return LOADING
        const state = store.getState()
        const now = store.now()
        const refusal = viewerRefusal(state, now, "read_network")
        if (refusal) return { status: "error", code: refusal }
        const listing = parseArrivalKitListing({ country, city, nationalOnly, category })
        if (!listing.ok) return { status: "error", code: listing.code }
        const base = current()
        const pages = teams.pagesOf(state)
        const items = base.resources
          .filter((row) => isArrivalKitListed(row.status) && matchesArrivalKitListing(row, listing.value))
          .sort(byVerified)
          .flatMap((row) => {
            const carrier = carrierOf(state, pages, row, now)
            return carrier === null ? [] : [toCard(row, carrier, flagCount(base, row), now)]
          })
        return windowOf(items, cursor, JSON.stringify([country, city ?? "", nationalOnly, category ?? ""]))
      }, [key, country, city, nationalOnly, category, cursor])
    },

    useResource(resourceId) {
      const key = useRevision()
      return useMemo((): Loadable<ArrivalKitResourceDetailView | null> => {
        if (key === "") return LOADING
        const state = store.getState()
        const now = store.now()
        const refusal = viewerRefusal(state, now, "read_network")
        if (refusal) return { status: "error", code: refusal }
        const viewerId = state.session.personId as string
        const base = current()
        const access = accessOf(state, teams.pagesOf(state), base.resources.find((row) => row.id === resourceId), viewerId, now)
        if (access === null) return { status: "ready", data: null }
        const { row } = access
        const listed = isArrivalKitListed(row.status)
        const flags = flagCount(base, row)
        const hasFlagged = listed && base.flags.some((flag) => flag.resourceId === row.id && flag.revision === row.revision && flag.personId === viewerId)
        const canReview = isArrivalKitReviewer(access.reviewer) && access.independent
        const insider = access.manages || canReview
        const status = statusOf(state, viewerId, now)
        return {
          status: "ready",
          data: {
            ...toCard(row, access.carrier, flags, now),
            body: row.body,
            source: { name: row.sourceName, url: row.sourceUrl },
            createdAt: row.createdAt,
            submittedAt: row.submittedAt,
            reviewer: listed && row.reviewedById !== null ? personLabel(state, row.reviewedById, now) : null,
            statusReason: insider ? row.statusReason : null,
            outdatedFlags: insider ? flags : null,
            ...(access.manages ? MANAGED_MODERATION : {}),
            viewer: {
              canManage: access.manages && row.status !== "archived",
              canReview: canReview && (row.status === "submitted" || row.status === "published"),
              canFlag: listed && access.independent && !hasFlagged && status !== null && hasCapability(status, "publish"),
              hasFlagged,
            },
          },
        }
      }, [key, resourceId])
    },

    useMyResources({ cursor }) {
      const key = useRevision()
      return useMemo((): Loadable<ArrivalKitListPage<ArrivalKitOwnItemView>> => {
        if (key === "") return LOADING
        const state = store.getState()
        const now = store.now()
        const refusal = viewerRefusal(state, now, "read_network")
        if (refusal) return { status: "error", code: refusal }
        const viewerId = state.session.personId as string
        const base = current()
        const pages = teams.pagesOf(state)
        const items = base.resources
          .filter((row) => row.proposedById === viewerId)
          .sort(byUpdated)
          .flatMap((row): ArrivalKitOwnItemView[] => {
            const managing = manages(row, viewerId)
            if (!managing && !isArrivalKitListed(row.status)) return []
            const carrier = carrierOf(state, pages, row, now)
            if (carrier === null) return []
            const flags = flagCount(base, row)
            return [{
              ...toCard(row, carrier, flags, now),
              statusReason: managing ? row.statusReason : null,
              outdatedFlags: managing ? flags : null,
              ...(managing ? MANAGED_MODERATION : {}),
            }]
          })
        return windowOf(items, cursor, `mine:${viewerId}`)
      }, [key, cursor])
    },

    useReviewQueue({ country, cursor }) {
      const key = useRevision()
      return useMemo((): Loadable<ArrivalKitListPage<ArrivalKitQueueItemView>> => {
        if (key === "") return LOADING
        const state = store.getState()
        const now = store.now()
        const refusal = viewerRefusal(state, now, "read_network")
        if (refusal) return { status: "error", code: refusal }
        const viewerId = state.session.personId as string
        const pages = teams.pagesOf(state)
        if (!isArrivalKitReviewer(reviewerFacts(state, pages, viewerId, now))) return { status: "error", code: "arrival_kit_reviewer_not_eligible" }
        const parsed = parseArrivalKitCountry(country)
        if (!parsed.ok) return { status: "error", code: parsed.code }
        const base = current()
        const items = base.resources
          .filter((row) => row.status === "submitted" && row.country === parsed.value)
          .filter((row) => isArrivalKitIndependent({ actorId: viewerId, writerIds: writersOf(row), onCarrierTeam: row.pageId !== null && manages(row, viewerId) }))
          .sort(bySubmitted)
          .flatMap((row): ArrivalKitQueueItemView[] => {
            const carrier = carrierOf(state, pages, row, now)
            return carrier === null ? [] : [{ ...toCard(row, carrier, flagCount(base, row), now), submittedAt: row.submittedAt ?? row.revisedAt }]
          })
        return windowOf(items, cursor, `queue:${viewerId}:${parsed.value}`)
      }, [key, country, cursor])
    },

    propose: (input) => act((state, viewerId, now): Outcome<{ readonly resourceId: string }> => {
      const refusal = viewerRefusal(state, now, "publish")
      if (refusal) return { refuse: refusal }
      let pageId: string | null = null
      if (input.pageId !== null) {
        const page = teams.pagesOf(state)[input.pageId]
        if (!page || !teams.isSignatory(page.id, viewerId)) return { refuse: "not_found" }
        if (!isArrivalKitCarrierKind(page.ownerKind)) return { refuse: "arrival_kit_page_kind_not_allowed" }
        pageId = page.id
      }
      const draft = parseArrivalKitResource(input, now)
      if (!draft.ok) return { refuse: draft.code }
      const base = current()
      const live = base.resources.filter((row) => row.proposedById === viewerId && row.status !== "archived").length
      if (isArrivalKitQuotaReached(live)) return { refuse: "arrival_kit_resource_limit_reached" }
      const id = `kit-${base.sequence}`
      const created: DemoKitResource = {
        id,
        authorId: pageId === null ? viewerId : null,
        pageId,
        proposedById: viewerId,
        revisedById: viewerId,
        ...contentOf(draft.value),
        status: input.submit ? "submitted" : "draft",
        statusReason: null,
        revision: 1,
        version: 1,
        reviewedById: null,
        reviewedAt: null,
        submittedAt: input.submit ? now : null,
        revisedAt: now,
        createdAt: now,
        updatedAt: now,
      }
      return { commit: { ...base, sequence: base.sequence + 1, resources: [...base.resources, created] }, value: { resourceId: id } }
    }),

    update: (input) => act((state, viewerId, now): Outcome<null> => {
      const refusal = viewerRefusal(state, now, "publish")
      if (refusal) return { refuse: refusal }
      const base = current()
      const row = managed(base, input.resourceId, viewerId)
      if (row === null) return { refuse: "not_found" }
      const status = transitionArrivalKit(row.status, input.submit ? "save_and_submit" : "save_draft")
      if (!status.ok) return { refuse: status.code }
      const version = checkArrivalKitVersion(row.version, input.expectedVersion)
      if (!version.ok) return { refuse: version.code }
      const draft = parseArrivalKitResource(input, now)
      if (!draft.ok) return { refuse: draft.code }
      return {
        commit: replace(base, row.id, {
          ...contentOf(draft.value),
          status: status.value,
          statusReason: null,
          revisedById: viewerId,
          revision: row.revision + 1,
          version: version.value,
          reviewedById: null,
          reviewedAt: null,
          submittedAt: status.value === "submitted" ? now : null,
          revisedAt: now,
          updatedAt: now,
        }),
        value: null,
      }
    }),

    submit: ({ resourceId, expectedVersion }) => act((state, viewerId, now): Outcome<null> => {
      const refusal = viewerRefusal(state, now, "publish")
      if (refusal) return { refuse: refusal }
      const base = current()
      const row = managed(base, resourceId, viewerId)
      if (row === null) return { refuse: "not_found" }
      const status = transitionArrivalKit(row.status, "submit")
      if (!status.ok) return { refuse: status.code }
      const version = checkArrivalKitVersion(row.version, expectedVersion)
      if (!version.ok) return { refuse: version.code }
      if (arrivalKitReviewDueAt(row.lastVerifiedAt) <= now) return { refuse: "arrival_kit_verified_at_too_old" }
      return { commit: replace(base, row.id, { status: status.value, statusReason: null, submittedAt: now, version: version.value, updatedAt: now }), value: null }
    }),

    withdraw: ({ resourceId, expectedVersion }) => act((state, viewerId, now): Outcome<null> => {
      const refusal = viewerRefusal(state, now, "publish")
      if (refusal) return { refuse: refusal }
      const base = current()
      const row = managed(base, resourceId, viewerId)
      if (row === null) return { refuse: "not_found" }
      const status = transitionArrivalKit(row.status, "archive")
      if (!status.ok) return { refuse: status.code }
      const version = checkArrivalKitVersion(row.version, expectedVersion)
      if (!version.ok) return { refuse: version.code }
      return { commit: replace(base, row.id, { status: status.value, version: version.value, updatedAt: now }), value: null }
    }),

    review: ({ resourceId, expectedVersion, decision, reason }) => act((state, viewerId, now): Outcome<null> => {
      const refusal = viewerRefusal(state, now, "publish")
      if (refusal) return { refuse: refusal }
      const base = current()
      const access = reviewable(state, base, resourceId, viewerId, now)
      if (typeof access === "string") return { refuse: access }
      const { row } = access
      const status = transitionArrivalKit(row.status, decision)
      if (!status.ok) return { refuse: status.code }
      const version = checkArrivalKitVersion(row.version, expectedVersion)
      if (!version.ok) return { refuse: version.code }
      if (decision === "return") {
        const parsed = parseArrivalKitReason(reason)
        if (!parsed.ok) return { refuse: parsed.code }
        return { commit: withReview(base, row, viewerId, now, "returned", parsed.value, { status: status.value, statusReason: parsed.value, version: version.value }), value: null }
      }
      if (arrivalKitReviewDueAt(row.lastVerifiedAt) <= now) return { refuse: "arrival_kit_verified_at_too_old" }
      return {
        commit: withReview(base, row, viewerId, now, "published", null, { status: status.value, statusReason: null, reviewedById: viewerId, reviewedAt: now, version: version.value }),
        value: null,
      }
    }),

    markForReview: ({ resourceId, expectedVersion, reason }) => act((state, viewerId, now): Outcome<null> => {
      const refusal = viewerRefusal(state, now, "publish")
      if (refusal) return { refuse: refusal }
      const base = current()
      const access = reviewable(state, base, resourceId, viewerId, now)
      if (typeof access === "string") return { refuse: access }
      const { row } = access
      const status = transitionArrivalKit(row.status, "mark_needs_review")
      if (!status.ok) return { refuse: status.code }
      const version = checkArrivalKitVersion(row.version, expectedVersion)
      if (!version.ok) return { refuse: version.code }
      const parsed = parseArrivalKitReason(reason)
      if (!parsed.ok) return { refuse: parsed.code }
      return { commit: withReview(base, row, viewerId, now, "needs_review", parsed.value, { status: status.value, statusReason: parsed.value, version: version.value }), value: null }
    }),

    flagOutdated: ({ resourceId, revision: flaggedRevision, reason }) => act((state, viewerId, now): Outcome<null> => {
      const refusal = viewerRefusal(state, now, "publish")
      if (refusal) return { refuse: refusal }
      const base = current()
      const access = accessOf(state, teams.pagesOf(state), base.resources.find((row) => row.id === resourceId), viewerId, now)
      if (access === null) return { refuse: "not_found" }
      const { row } = access
      if (flaggedRevision !== row.revision) return { refuse: "arrival_kit_version_conflict" }
      const check = checkArrivalKitFlag({
        status: row.status,
        actorId: viewerId,
        writerIds: writersOf(row),
        onCarrierTeam: row.pageId !== null && access.manages,
        alreadyFlagged: base.flags.some((flag) => flag.resourceId === row.id && flag.revision === row.revision && flag.personId === viewerId),
        reason,
      })
      if (!check.ok) return { refuse: check.code }
      return { commit: { ...base, flags: [...base.flags, { resourceId: row.id, revision: row.revision, personId: viewerId, reason: check.value, createdAt: now }] }, value: null }
    }),
  }
}
