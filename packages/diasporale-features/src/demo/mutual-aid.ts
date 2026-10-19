/**
 * Démonstration de la capacité « entraide » (DG-024 a) — données FICTIVES.
 * PROPRIÉTAIRE : ce chantier.
 *
 * L'état de l'entraide est LOCAL à ce chantier (le magasin commun n'est pas
 * modifié) : un registre en mémoire, gardé dans ce seul navigateur et remis à
 * zéro avec la démonstration (il suit la date de création du jeu fictif). Les
 * règles sont celles de `@diasporale/domain`, dans l'ordre du moteur : session
 * → adhésion au réseau → capacité → droit sur la ressource → règle de l'entraide.
 * Elle ne modère jamais : ses vues ne portent pas d'état de modération
 * (`moderation`, facultatif du port, servi par le moteur à qui gère le contenu).
 *
 * Le jeu fictif reprend les comptes de démonstration : une question résolue à
 * Bordeaux (réponse retenue par son autrice), une question ouverte à Paris, une
 * à Montréal, une question close à Lyon ; trois missions du « Collectif Ivindo
 * de Lyon (démo) », dont l'équipe vivante vient du magasin des pages (Steeve
 * l'administre ; l'invitation de Mireille, non acceptée, ne donne aucun droit).
 * Aucune de ces personnes, aucune de ces situations n'existe.
 */
import { isProfilePublished } from "@antsia/social-domain/content"
import {
  aidSignupBlocker,
  aidStatusWithoutAcceptedAnswer,
  checkAidAcceptedAnswer,
  checkAidAnswerGesture,
  checkAidAnswering,
  checkAidMissionGesture,
  checkAidMissionPlacesChange,
  checkAidMissionTiming,
  checkAidQuestionGesture,
  checkAidSignup,
  checkAidSignupWithdrawal,
  DAY_MS,
  HOUR_MS,
  parseAidAnswer,
  parseAidMission,
  parseAidPlaceFilter,
  parseAidQuestion,
  parseAidReason,
  type AidAnswerStatus,
  type AidMissionStatus,
  type AidQuestionGesture,
  type AidQuestionStatus,
  type AidSignupFacts,
  type AidSignupStatus,
  type AidTheme,
  type CountryCode,
} from "@diasporale/domain"
import { useMemo, useSyncExternalStore } from "react"

import type { ActionErrorCode } from "../data/errors"
import {
  MUTUAL_AID_PAGE_SIZE,
  type AidAnswerView,
  type AidItemView,
  type AidListPage,
  type AidMissionCardView,
  type AidMissionDetailView,
  type AidMissionPageOption,
  type AidPersonView,
  type AidQuestionCardView,
  type AidQuestionDetailView,
  type AidVolunteerView,
  type MutualAidCapability,
} from "../data/mutual-aid-port"
import type { ActionResult } from "../data/port"
import type { Loadable } from "../data/types"
import { demoViewerRefusal } from "./associations"
import { demoPageAdminContext } from "./page-admin"
import { pageView, statusOf } from "./selectors"
import type { DemoPage, DemoState } from "./state"
import type { DemoStore } from "./store"

export const DEMO_MUTUAL_AID_STORAGE_KEY = "diasporale:demonstration:mutual-aid:v1"

export interface DemoAidQuestion {
  readonly id: string
  readonly authorId: string
  readonly title: string
  readonly detail: string
  readonly theme: AidTheme
  readonly country: CountryCode
  readonly city: string | null
  readonly cityKey: string | null
  readonly status: AidQuestionStatus
  readonly acceptedAnswerId: string | null
  readonly answerCount: number
  readonly version: number
  readonly createdAt: number
  readonly updatedAt: number
  readonly editedAt: number | null
}

export interface DemoAidAnswer {
  readonly id: string
  readonly questionId: string
  readonly authorId: string
  readonly body: string
  readonly status: AidAnswerStatus
  readonly version: number
  readonly createdAt: number
  readonly updatedAt: number
  readonly editedAt: number | null
}

export interface DemoAidMission {
  readonly id: string
  readonly pageId: string
  readonly title: string
  readonly description: string
  readonly country: CountryCode
  readonly city: string
  readonly cityKey: string
  readonly area: string | null
  readonly startsAt: number
  readonly endsAt: number | null
  readonly timeZone: string
  readonly places: number
  readonly signupCount: number
  readonly status: AidMissionStatus
  readonly cancelReason: string | null
  readonly version: number
  readonly createdAt: number
  readonly updatedAt: number
}

export interface DemoAidSignup {
  readonly id: string
  readonly missionId: string
  readonly personId: string
  readonly status: AidSignupStatus
  /** Le consentement explicite à montrer son nom publié à l'équipe de la page. */
  readonly nameConsentAt: number
  readonly signedUpAt: number
}

export interface DemoAidLedger {
  readonly seedCreatedAt: number
  readonly sequence: number
  readonly questions: readonly DemoAidQuestion[]
  readonly answers: readonly DemoAidAnswer[]
  readonly missions: readonly DemoAidMission[]
  readonly signups: readonly DemoAidSignup[]
}

const LYON = "page-asso-lyon"

/** Le jeu fictif, daté depuis la création de la démonstration. */
export function demoMutualAidSeed(createdAt: number): DemoAidLedger {
  const question = (row: Omit<DemoAidQuestion, "version" | "updatedAt" | "editedAt">): DemoAidQuestion => ({ ...row, version: 1, updatedAt: row.createdAt, editedAt: null })
  const answer = (id: string, questionId: string, authorId: string, body: string, ageHours: number): DemoAidAnswer => ({
    id, questionId, authorId, body, status: "published", version: 1, createdAt: createdAt - ageHours * HOUR_MS, updatedAt: createdAt - ageHours * HOUR_MS, editedAt: null,
  })
  const mission = (row: Omit<DemoAidMission, "pageId" | "country" | "city" | "cityKey" | "timeZone" | "cancelReason" | "version" | "createdAt" | "updatedAt">): DemoAidMission => ({
    ...row, pageId: LYON, country: "FR", city: "Lyon", cityKey: "lyon", timeZone: "Europe/Paris", cancelReason: null, version: 1, createdAt: createdAt - 3 * DAY_MS, updatedAt: createdAt - 3 * DAY_MS,
  })
  const signup = (id: string, missionId: string, personId: string, ageDays: number): DemoAidSignup => ({
    id, missionId, personId, status: "confirmed", nameConsentAt: createdAt - ageDays * DAY_MS, signedUpAt: createdAt - ageDays * DAY_MS,
  })
  return {
    seedCreatedAt: createdAt,
    sequence: 20,
    questions: [
      question({
        id: "aid-q-1", authorId: "p-prisca", theme: "housing", country: "FR", city: "Bordeaux", cityKey: "bordeaux", status: "resolved", acceptedAnswerId: "aid-a-1", answerCount: 2,
        title: "Trouver une colocation étudiante à Bordeaux",
        detail: "J'arrive en janvier pour un master (situation fictive). Quels quartiers sont bien desservis, et comment repérer une annonce douteuse ?",
        createdAt: createdAt - 6 * DAY_MS,
      }),
      question({
        id: "aid-q-2", authorId: "p-clarisse", theme: "procedures", country: "FR", city: "Paris", cityKey: "paris", status: "open", acceptedAnswerId: null, answerCount: 1,
        title: "Renouveler un titre de séjour : combien de temps à l'avance ?",
        detail: "Mon titre expire au printemps (situation fictive). Faut-il vraiment s'y prendre plusieurs mois avant ?",
        createdAt: createdAt - 3 * DAY_MS,
      }),
      question({
        id: "aid-q-3", authorId: "p-rodrigue", theme: "health", country: "CA", city: "Montréal", cityKey: "montreal", status: "open", acceptedAnswerId: null, answerCount: 0,
        title: "Trouver un médecin de famille à Montréal",
        detail: "",
        createdAt: createdAt - 2 * DAY_MS,
      }),
      question({
        id: "aid-q-4", authorId: "p-steeve", theme: "transport", country: "FR", city: "Lyon", cityKey: "lyon", status: "closed", acceptedAnswerId: null, answerCount: 1,
        title: "Un abonnement de transport moins cher pour les étudiants ?",
        detail: "Je cherche le tarif le plus juste pour un trajet quotidien (situation fictive).",
        createdAt: createdAt - 9 * DAY_MS,
      }),
    ],
    answers: [
      answer("aid-a-1", "aid-q-1", "p-mireille", "Les quartiers proches du tram sont les plus simples. Ne versez jamais d'argent avant d'avoir visité, et passez par la messagerie pour poser vos questions. (Réponse fictive.)", 130),
      answer("aid-a-2", "aid-q-1", "p-steeve", "Le service logement de l'université tient une liste de résidences : demandez-la dès votre inscription. (Réponse fictive.)", 120),
      answer("aid-a-3", "aid-q-2", "p-nadia", "Mieux vaut commencer deux à trois mois avant : la préfecture indique la marche à suivre sur son site officiel. (Réponse fictive.)", 60),
      answer("aid-a-4", "aid-q-4", "p-prisca", "Un tarif étudiant existe : renseignez-vous à l'agence avec votre carte d'étudiant. (Réponse fictive.)", 200),
    ],
    missions: [
      mission({
        id: "aid-m-1", title: "Accueillir les nouveaux arrivants à la gare",
        description: "Orienter les étudiants qui arrivent un samedi matin : un plan du quartier, les premiers repères, un sourire. (Mission fictive.)",
        area: "Gare Part-Dieu, hall d'arrivée", startsAt: createdAt + 12 * DAY_MS, endsAt: createdAt + 12 * DAY_MS + 3 * HOUR_MS, places: 6, signupCount: 2, status: "open",
      }),
      mission({
        id: "aid-m-2", title: "Préparer le repas de la soirée culturelle",
        description: "Cuisiner avec l'équipe les plats du pays pour la soirée du collectif ; ustensiles fournis. (Mission fictive.)",
        area: "Quartier de la Guillotière", startsAt: createdAt + 20 * DAY_MS, endsAt: createdAt + 20 * DAY_MS + 5 * HOUR_MS, places: 2, signupCount: 2, status: "full",
      }),
      mission({
        id: "aid-m-3", title: "Collecter des vêtements d'hiver",
        description: "Trier et ranger les dons de manteaux pour les nouveaux arrivants pendant une semaine. (Mission fictive.)",
        area: null, startsAt: createdAt + 30 * DAY_MS, endsAt: createdAt + 37 * DAY_MS, places: 10, signupCount: 1, status: "closed",
      }),
    ],
    signups: [
      signup("aid-s-1", "aid-m-1", "p-mireille", 2),
      signup("aid-s-2", "aid-m-1", "p-clarisse", 1),
      signup("aid-s-3", "aid-m-2", "p-prisca", 2),
      signup("aid-s-4", "aid-m-2", "p-rodrigue", 1),
      signup("aid-s-5", "aid-m-3", "p-nadia", 1),
    ],
  }
}

const LOADING = { status: "loading" } as const
const ACTIVE = new Set(["en_attente", "declaree", "verifiee"])
const CURSOR_TAG = "demo-mutual-aid"

type Failure = { readonly ok: false; readonly code: ActionErrorCode }
const fail = (code: ActionErrorCode): Failure => ({ ok: false, code })

/** Une écriture admise : le registre suivant et la valeur rendue à l'écran. */
type Outcome<T> = { readonly next: DemoAidLedger; readonly value: T } | Failure

function isLedger(value: unknown): value is DemoAidLedger {
  if (typeof value !== "object" || value === null) return false
  const ledger = value as Partial<DemoAidLedger>
  return typeof ledger.seedCreatedAt === "number" && typeof ledger.sequence === "number"
    && Array.isArray(ledger.questions) && Array.isArray(ledger.answers) && Array.isArray(ledger.missions) && Array.isArray(ledger.signups)
}

/** Un blocage, dans un sens ou dans l'autre, entre deux personnes. */
function blockedBetween(state: DemoState, a: string, b: string): boolean {
  return a !== b && state.blocks.some((block) => (block.byId === a && block.targetId === b) || (block.byId === b && block.targetId === a))
}

/** Le profil PUBLIÉ d'un membre actif ; sinon le nom neutre. Aucune coordonnée. */
function personView(state: DemoState, personId: string, now: number): AidPersonView {
  const person = state.persons[personId]
  const status = statusOf(state, personId, now)
  const profile = status !== null && ACTIVE.has(status) && person?.profile && isProfilePublished(person) ? person.profile : null
  return { displayName: profile?.displayName ?? null, handle: profile?.handle ?? null }
}

/** Une fenêtre d'une liste triée ; le curseur est opaque pour l'écran, validé ici. */
function windowOf<T>(items: readonly T[], cursor: string | null, scope: string): Loadable<AidListPage<T>> {
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
  const end = offset + MUTUAL_AID_PAGE_SIZE
  const isDone = end >= items.length
  return { status: "ready", data: { items: items.slice(offset, end), isDone, continueCursor: isDone ? null : JSON.stringify([CURSOR_TAG, scope, end]) } }
}

type StorageLike = Pick<Storage, "getItem" | "setItem">

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}

export interface DemoMutualAidOptions {
  /** Persistance de ce navigateur ; `null` : en mémoire seulement (tests). */
  readonly storage?: StorageLike | null
  /** Latence simulée d'une écriture (ms). */
  readonly latencyMs?: number
}

export function createDemoMutualAid(store: DemoStore, options: DemoMutualAidOptions = {}): MutualAidCapability {
  const teams = demoPageAdminContext(store)
  const readState = (): DemoState => {
    const state = store.getState()
    return { ...state, pages: teams.pagesOf(state) }
  }
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const latencyMs = options.latencyMs ?? 180
  const listeners = new Set<() => void>()
  let revision = 0
  let ledger: DemoAidLedger | null = null

  /** Le registre du jeu fictif COURANT : une démonstration remise à zéro repart du jeu fictif. */
  const current = (): DemoAidLedger => {
    const createdAt = store.getState().createdAt
    if (ledger?.seedCreatedAt === createdAt) return ledger
    let loaded: DemoAidLedger | null = null
    try {
      const raw = storage?.getItem(DEMO_MUTUAL_AID_STORAGE_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : null
      if (isLedger(parsed) && parsed.seedCreatedAt === createdAt) loaded = parsed
    } catch {
      // Stockage illisible ou bloqué : on repart du jeu fictif.
    }
    ledger = loaded ?? demoMutualAidSeed(createdAt)
    return ledger
  }

  const commit = (next: DemoAidLedger) => {
    ledger = next
    revision += 1
    try {
      storage?.setItem(DEMO_MUTUAL_AID_STORAGE_KEY, JSON.stringify(next))
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
  /** Instantané primitif : la session (magasin commun), les équipes et le registre. Rendu serveur : en chargement. */
  const useRevision = () => useSyncExternalStore(subscribe, () => `${store.getVersion()}:${revision}:${teams.getVersion()}`, () => "")

  const pause = async () => {
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs))
  }

  /** Une écriture appartient à la session qui l'a lancée : changée pendant l'attente, rien n'est écrit. */
  const act = async <T>(work: (state: DemoState, viewerId: string, now: number) => Outcome<T>): Promise<ActionResult<T>> => {
    const viewerId = store.getState().session.personId
    await pause()
    const state = readState()
    if (!viewerId || state.session.personId !== viewerId) return fail("not_signed_in")
    const outcome = work(state, viewerId, store.now())
    if ("next" in outcome) {
      commit(outcome.next)
      return { ok: true, value: outcome.value }
    }
    return outcome
  }

  /** Une lecture : le refus du lecteur d'abord (session, adhésion, sanction, capacité), puis la projection. */
  const read = <T>(revisionKey: string, project: (state: DemoState, viewerId: string, now: number) => Loadable<T>): Loadable<T> => {
    if (revisionKey === "") return LOADING
    const state = readState()
    const now = store.now()
    const refusal = demoViewerRefusal(state, now)
    if (refusal) return { status: "error", code: refusal }
    return project(state, state.session.personId as string, now)
  }

  const canPublish = (state: DemoState, now: number) => demoViewerRefusal(state, now, "publish") === null

  // ── Questions ──────────────────────────────────────────────────

  const readableQuestion = (state: DemoState, base: DemoAidLedger, questionId: string, viewerId: string): DemoAidQuestion | null => {
    const question = base.questions.find((candidate) => candidate.id === questionId)
    if (!question || question.status === "withdrawn" || blockedBetween(state, viewerId, question.authorId)) return null
    return question
  }

  const questionCard = (state: DemoState, question: DemoAidQuestion, viewerId: string, now: number): AidQuestionCardView => ({
    id: question.id,
    title: question.title,
    detail: question.detail,
    theme: question.theme,
    country: question.country,
    city: question.city,
    status: question.status,
    answerCount: question.answerCount,
    hasAcceptedAnswer: question.acceptedAnswerId !== null,
    author: personView(state, question.authorId, now),
    isMine: question.authorId === viewerId,
    createdAt: question.createdAt,
  })

  const answerView = (state: DemoState, answer: DemoAidAnswer, question: DemoAidQuestion, viewerId: string, now: number): AidAnswerView => ({
    id: answer.id,
    questionId: answer.questionId,
    body: answer.body,
    version: answer.version,
    author: personView(state, answer.authorId, now),
    isMine: answer.authorId === viewerId,
    isAccepted: question.acceptedAnswerId === answer.id,
    createdAt: answer.createdAt,
    editedAt: answer.editedAt,
  })

  const questionDetail = (state: DemoState, base: DemoAidLedger, question: DemoAidQuestion, viewerId: string, now: number): AidQuestionDetailView => {
    const accepted = question.acceptedAnswerId === null ? undefined : base.answers.find((answer) => answer.id === question.acceptedAnswerId)
    const showAccepted = accepted !== undefined && accepted.questionId === question.id && accepted.status === "published" && !blockedBetween(state, viewerId, accepted.authorId)
    const publish = canPublish(state, now)
    const mine = question.authorId === viewerId
    return {
      ...questionCard(state, question, viewerId, now),
      version: question.version,
      updatedAt: question.updatedAt,
      editedAt: question.editedAt,
      acceptedAnswer: showAccepted ? answerView(state, accepted, question, viewerId, now) : null,
      canAnswer: publish && checkAidAnswering({ questionStatus: question.status, answerCount: question.answerCount }).ok,
      canEdit: mine && publish && (question.status === "open" || question.status === "resolved"),
    }
  }

  const updateQuestionRow = (base: DemoAidLedger, question: DemoAidQuestion, patch: Partial<DemoAidQuestion>): DemoAidLedger => ({
    ...base,
    questions: base.questions.map((candidate) => (candidate.id === question.id ? { ...candidate, ...patch } : candidate)),
  })

  /** Un geste de l'auteur, jugé par le domaine sur la ligne relue ; la version avance. */
  const questionGesture = (
    gesture: AidQuestionGesture,
    questionId: string,
    expectedVersion: number,
    capability: "read_network" | "publish",
    apply: (question: DemoAidQuestion, status: AidQuestionStatus, base: DemoAidLedger, now: number) => Outcome<null>,
  ) => act((state, viewerId, now) => {
    const refusal = demoViewerRefusal(state, now, capability)
    if (refusal) return fail(refusal)
    const base = current()
    const question = readableQuestion(state, base, questionId, viewerId)
    if (!question) return fail("not_found")
    const check = checkAidQuestionGesture({ gesture, isAuthor: question.authorId === viewerId, status: question.status, expectedVersion, version: question.version })
    if (!check.ok) return fail(check.code)
    return apply(question, check.value, base, now)
  })

  // ── Missions ───────────────────────────────────────────────────

  const associationPage = (state: DemoState, pageId: string): DemoPage | null => {
    const page = state.pages[pageId]
    return page?.ownerKind === "association" ? page : null
  }

  const isTeam = (state: DemoState, pageId: string, viewerId: string, now: number): boolean => {
    const status = statusOf(state, viewerId, now)
    return status !== null && ACTIVE.has(status) && teams.isSignatory(pageId, viewerId)
  }

  const signupOf = (base: DemoAidLedger, missionId: string, personId: string) => base.signups.find((row) => row.missionId === missionId && row.personId === personId)

  const factsOf = (mission: DemoAidMission, signup: DemoAidSignup | undefined): AidSignupFacts => ({
    status: mission.status,
    startsAt: mission.startsAt,
    places: mission.places,
    signupCount: mission.signupCount,
    signedUp: signup?.status === "confirmed",
  })

  const missionCard = (page: DemoPage, mission: DemoAidMission, signedUp: boolean): AidMissionCardView => {
    const card = pageView(page)
    return {
      id: mission.id,
      page: { id: card.id, handle: card.handle, name: card.name, badge: card.badge },
      title: mission.title,
      description: mission.description,
      country: mission.country,
      city: mission.city,
      area: mission.area,
      startsAt: mission.startsAt,
      endsAt: mission.endsAt,
      timeZone: mission.timeZone,
      places: mission.places,
      signupCount: mission.signupCount,
      status: mission.status,
      signedUp,
    }
  }

  const missionDetail = (state: DemoState, base: DemoAidLedger, page: DemoPage, mission: DemoAidMission, viewerId: string, now: number): AidMissionDetailView => {
    const signup = signupOf(base, mission.id, viewerId)
    const blocker = aidSignupBlocker(factsOf(mission, signup), now)
    return {
      ...missionCard(page, mission, signup?.status === "confirmed"),
      version: mission.version,
      cancelReason: mission.cancelReason,
      signup: blocker !== null
        ? { allowed: false, refusal: blocker }
        : canPublish(state, now) ? { allowed: true, refusal: null } : { allowed: false, refusal: "status_insufficient" },
      canManage: isTeam(state, page.id, viewerId, now),
      createdAt: mission.createdAt,
      updatedAt: mission.updatedAt,
    }
  }

  const updateMissionRow = (base: DemoAidLedger, mission: DemoAidMission, patch: Partial<DemoAidMission>): DemoAidLedger => ({
    ...base,
    missions: base.missions.map((candidate) => (candidate.id === mission.id ? { ...candidate, ...patch } : candidate)),
  })

  /** Une mission gérée par le lecteur : page d'association, équipe vivante ; sinon le refus indistinct. */
  const managedMission = (state: DemoState, base: DemoAidLedger, missionId: string, viewerId: string, now: number): DemoAidMission | null => {
    const mission = base.missions.find((candidate) => candidate.id === missionId)
    if (!mission || !associationPage(state, mission.pageId) || !isTeam(state, mission.pageId, viewerId, now)) return null
    return mission
  }

  const missionGesture = (
    gesture: "close" | "cancel",
    missionId: string,
    expectedVersion: number,
    apply: (mission: DemoAidMission, status: AidMissionStatus, base: DemoAidLedger, now: number) => Outcome<null>,
  ) => act((state, viewerId, now) => {
    const refusal = demoViewerRefusal(state, now, "publish")
    if (refusal) return fail(refusal)
    const base = current()
    const mission = managedMission(state, base, missionId, viewerId, now)
    if (!mission) return fail("not_found")
    const check = checkAidMissionGesture({ gesture, status: mission.status, expectedVersion, version: mission.version })
    if (!check.ok) return fail(check.code)
    return apply(mission, check.value, base, now)
  })

  return {
    // ── Lectures des questions ───────────────────────────────────
    useQuestions({ country, city, status, cursor }) {
      const revisionKey = useRevision()
      return useMemo(() => read(revisionKey, (state, viewerId, now): Loadable<AidListPage<AidQuestionCardView>> => {
        const filter = parseAidPlaceFilter({ country, city })
        if (!filter.ok) return { status: "error", code: filter.code }
        const items = current().questions
          .filter((question) => question.country === filter.value.country && question.status === status
            && (filter.value.cityKey === null || question.cityKey === filter.value.cityKey)
            && !blockedBetween(state, viewerId, question.authorId))
          .sort((left, right) => right.createdAt - left.createdAt || (left.id < right.id ? 1 : -1))
          .map((question) => questionCard(state, question, viewerId, now))
        return windowOf(items, cursor, `questions:${filter.value.country}:${filter.value.cityKey ?? ""}:${status}`)
      }), [revisionKey, country, city, status, cursor])
    },

    useMyQuestions({ cursor }) {
      const revisionKey = useRevision()
      return useMemo(() => read(revisionKey, (state, viewerId, now): Loadable<AidListPage<AidQuestionCardView>> => {
        const items = current().questions
          .filter((question) => question.authorId === viewerId && question.status !== "withdrawn")
          .sort((left, right) => right.createdAt - left.createdAt || (left.id < right.id ? 1 : -1))
          .map((question) => questionCard(state, question, viewerId, now))
        return windowOf(items, cursor, `mine:${viewerId}`)
      }), [revisionKey, cursor])
    },

    useItem(itemId) {
      const revisionKey = useRevision()
      return useMemo(() => read(revisionKey, (state, viewerId, now): Loadable<AidItemView | null> => {
        const base = current()
        const question = readableQuestion(state, base, itemId, viewerId)
        if (question) return { status: "ready", data: { kind: "question", question: questionDetail(state, base, question, viewerId, now) } }
        const mission = base.missions.find((candidate) => candidate.id === itemId)
        const page = mission ? associationPage(state, mission.pageId) : null
        if (mission && page) return { status: "ready", data: { kind: "mission", mission: missionDetail(state, base, page, mission, viewerId, now) } }
        return { status: "ready", data: null }
      }), [revisionKey, itemId])
    },

    useAnswers({ questionId, cursor }) {
      const revisionKey = useRevision()
      return useMemo(() => read(revisionKey, (state, viewerId, now): Loadable<AidListPage<AidAnswerView>> => {
        const base = current()
        const question = readableQuestion(state, base, questionId, viewerId)
        if (!question) return { status: "error", code: "not_found" }
        const items = base.answers
          .filter((answer) => answer.questionId === question.id && answer.status === "published" && !blockedBetween(state, viewerId, answer.authorId))
          .sort((left, right) => left.createdAt - right.createdAt || (left.id < right.id ? -1 : 1))
          .map((answer) => answerView(state, answer, question, viewerId, now))
        return windowOf(items, cursor, `answers:${question.id}`)
      }), [revisionKey, questionId, cursor])
    },

    // ── Gestes sur les questions ─────────────────────────────────
    askQuestion: (input) => act((state, viewerId, now) => {
      const refusal = demoViewerRefusal(state, now, "publish")
      if (refusal) return fail(refusal)
      const draft = parseAidQuestion(input)
      if (!draft.ok) return fail(draft.code)
      const base = current()
      const id = `aid-q-${base.sequence}`
      const question: DemoAidQuestion = {
        id, authorId: viewerId, ...draft.value, status: "open", acceptedAnswerId: null, answerCount: 0, version: 1, createdAt: now, updatedAt: now, editedAt: null,
      }
      return { next: { ...base, sequence: base.sequence + 1, questions: [...base.questions, question] }, value: { questionId: id } }
    }),

    updateQuestion: (input) => questionGesture("edit", input.questionId, input.expectedVersion, "publish", (question, _status, base, now) => {
      const draft = parseAidQuestion({ title: input.title, detail: input.detail, theme: input.theme, country: question.country, city: input.city })
      if (!draft.ok) return fail(draft.code)
      const { title, detail, theme, city, cityKey } = draft.value
      return { next: updateQuestionRow(base, question, { title, detail, theme, city, cityKey, editedAt: now, updatedAt: now, version: question.version + 1 }), value: null }
    }),

    closeQuestion: ({ questionId, expectedVersion }) => questionGesture("close", questionId, expectedVersion, "publish", (question, status, base, now) => ({
      next: updateQuestionRow(base, question, { status, updatedAt: now, version: question.version + 1 }),
      value: null,
    })),

    withdrawQuestion: ({ questionId, expectedVersion }) => questionGesture("withdraw", questionId, expectedVersion, "read_network", (question, status, base, now) => ({
      next: updateQuestionRow(base, question, { status, updatedAt: now, version: question.version + 1 }),
      value: null,
    })),

    answer: ({ questionId, body }) => act((state, viewerId, now) => {
      const refusal = demoViewerRefusal(state, now, "publish")
      if (refusal) return fail(refusal)
      const base = current()
      const question = readableQuestion(state, base, questionId, viewerId)
      if (!question) return fail("not_found")
      const answering = checkAidAnswering({ questionStatus: question.status, answerCount: question.answerCount })
      if (!answering.ok) return fail(answering.code)
      const text = parseAidAnswer(body)
      if (!text.ok) return fail(text.code)
      const id = `aid-a-${base.sequence}`
      const answer: DemoAidAnswer = { id, questionId: question.id, authorId: viewerId, body: text.value, status: "published", version: 1, createdAt: now, updatedAt: now, editedAt: null }
      const next = updateQuestionRow({ ...base, sequence: base.sequence + 1, answers: [...base.answers, answer] }, question, { answerCount: question.answerCount + 1, updatedAt: now })
      return { next, value: { answerId: id } }
    }),

    updateAnswer: ({ answerId, expectedVersion, body }) => act((state, viewerId, now) => {
      const refusal = demoViewerRefusal(state, now, "publish")
      if (refusal) return fail(refusal)
      const base = current()
      const answer = base.answers.find((candidate) => candidate.id === answerId)
      const question = answer ? base.questions.find((candidate) => candidate.id === answer.questionId) : undefined
      if (!answer || !question) return fail("not_found")
      const check = checkAidAnswerGesture({
        gesture: "edit", isAuthor: answer.authorId === viewerId, status: answer.status, isAccepted: question.acceptedAnswerId === answer.id,
        questionStatus: question.status, expectedVersion, version: answer.version,
      })
      if (!check.ok) return fail(check.code)
      const text = parseAidAnswer(body)
      if (!text.ok) return fail(text.code)
      return {
        next: { ...base, answers: base.answers.map((candidate) => (candidate.id === answer.id ? { ...candidate, body: text.value, editedAt: now, updatedAt: now, version: candidate.version + 1 } : candidate)) },
        value: null,
      }
    }),

    withdrawAnswer: ({ answerId, expectedVersion }) => act((state, viewerId, now) => {
      const refusal = demoViewerRefusal(state, now)
      if (refusal) return fail(refusal)
      const base = current()
      const answer = base.answers.find((candidate) => candidate.id === answerId)
      const question = answer ? base.questions.find((candidate) => candidate.id === answer.questionId) : undefined
      if (!answer || !question) return fail("not_found")
      const isAccepted = question.acceptedAnswerId === answer.id
      const check = checkAidAnswerGesture({
        gesture: "withdraw", isAuthor: answer.authorId === viewerId, status: answer.status, isAccepted,
        questionStatus: question.status, expectedVersion, version: answer.version,
      })
      if (!check.ok) return fail(check.code)
      const answers = base.answers.map((candidate) => (candidate.id === answer.id ? { ...candidate, status: check.value, updatedAt: now, version: candidate.version + 1 } : candidate))
      const next = updateQuestionRow({ ...base, answers }, question, {
        answerCount: Math.max(0, question.answerCount - 1),
        updatedAt: now,
        ...(isAccepted ? { acceptedAnswerId: null, status: aidStatusWithoutAcceptedAnswer(question.status), version: question.version + 1 } : {}),
      })
      return { next, value: null }
    }),

    acceptAnswer: ({ questionId, answerId, expectedVersion }) => act((state, viewerId, now) => {
      const refusal = demoViewerRefusal(state, now, "publish")
      if (refusal) return fail(refusal)
      const base = current()
      const question = readableQuestion(state, base, questionId, viewerId)
      if (!question) return fail("not_found")
      const check = checkAidQuestionGesture({ gesture: "accept", isAuthor: question.authorId === viewerId, status: question.status, expectedVersion, version: question.version })
      if (!check.ok) return fail(check.code)
      const answer = base.answers.find((candidate) => candidate.id === answerId)
      const candidate = answer && !blockedBetween(state, viewerId, answer.authorId) ? answer : null
      const eligible = checkAidAcceptedAnswer(candidate, question.id)
      if (!eligible.ok) return fail(eligible.code)
      if (question.acceptedAnswerId === answerId) return { next: base, value: null }
      return { next: updateQuestionRow(base, question, { status: check.value, acceptedAnswerId: answerId, updatedAt: now, version: question.version + 1 }), value: null }
    }),

    unacceptAnswer: ({ questionId, expectedVersion }) => questionGesture("unaccept", questionId, expectedVersion, "publish", (question, status, base, now) => ({
      next: updateQuestionRow(base, question, { status, acceptedAnswerId: null, updatedAt: now, version: question.version + 1 }),
      value: null,
    })),

    // ── Lectures des missions ────────────────────────────────────
    useMissions({ country, city, from, cursor }) {
      const revisionKey = useRevision()
      return useMemo(() => read(revisionKey, (state, viewerId, now): Loadable<AidListPage<AidMissionCardView>> => {
        const filter = parseAidPlaceFilter({ country, city })
        if (!filter.ok) return { status: "error", code: filter.code }
        const base = current()
        const items = base.missions
          .filter((mission) => mission.country === filter.value.country && mission.status === "open" && mission.startsAt >= from && now < mission.startsAt
            && (filter.value.cityKey === null || mission.cityKey === filter.value.cityKey))
          .sort((left, right) => left.startsAt - right.startsAt || (left.id < right.id ? -1 : 1))
          .flatMap((mission): AidMissionCardView[] => {
            const page = associationPage(state, mission.pageId)
            return page ? [missionCard(page, mission, signupOf(base, mission.id, viewerId)?.status === "confirmed")] : []
          })
        return windowOf(items, cursor, `missions:${filter.value.country}:${filter.value.cityKey ?? ""}:${from}`)
      }), [revisionKey, country, city, from, cursor])
    },

    useMySignups({ cursor }) {
      const revisionKey = useRevision()
      return useMemo(() => read(revisionKey, (state, viewerId): Loadable<AidListPage<AidMissionCardView>> => {
        const base = current()
        const items = base.signups
          .filter((signup) => signup.personId === viewerId && signup.status === "confirmed")
          .sort((left, right) => right.signedUpAt - left.signedUpAt || (left.id < right.id ? 1 : -1))
          .flatMap((signup): AidMissionCardView[] => {
            const mission = base.missions.find((candidate) => candidate.id === signup.missionId)
            const page = mission ? associationPage(state, mission.pageId) : null
            return mission && page ? [missionCard(page, mission, true)] : []
          })
        return windowOf(items, cursor, `signups:${viewerId}`)
      }), [revisionKey, cursor])
    },

    useMissionPages() {
      const revisionKey = useRevision()
      return useMemo(() => read(revisionKey, (state, viewerId, now): Loadable<readonly AidMissionPageOption[]> => ({
        status: "ready",
        data: Object.values(state.pages)
          .filter((page) => page.ownerKind === "association" && isTeam(state, page.id, viewerId, now))
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((page) => ({ id: page.id, handle: page.handle, name: page.name, country: page.country, city: page.city })),
      })), [revisionKey])
    },

    usePageMissions({ pageId, cursor }) {
      const revisionKey = useRevision()
      return useMemo(() => read(revisionKey, (state, viewerId, now): Loadable<AidListPage<AidMissionCardView>> => {
        const page = associationPage(state, pageId)
        if (!page || !isTeam(state, page.id, viewerId, now)) return { status: "error", code: "not_found" }
        const base = current()
        const items = base.missions
          .filter((mission) => mission.pageId === page.id)
          .sort((left, right) => right.startsAt - left.startsAt || (left.id < right.id ? 1 : -1))
          .map((mission) => missionCard(page, mission, signupOf(base, mission.id, viewerId)?.status === "confirmed"))
        return windowOf(items, cursor, `page:${page.id}`)
      }), [revisionKey, pageId, cursor])
    },

    useVolunteers({ missionId, cursor }) {
      const revisionKey = useRevision()
      return useMemo(() => read(revisionKey, (state, viewerId, now): Loadable<AidListPage<AidVolunteerView>> => {
        const base = current()
        const mission = base.missions.find((candidate) => candidate.id === missionId)
        if (!mission || !associationPage(state, mission.pageId) || !isTeam(state, mission.pageId, viewerId, now)) return { status: "error", code: "not_found" }
        const items = base.signups
          .filter((signup) => signup.missionId === mission.id && signup.status === "confirmed")
          .sort((left, right) => left.signedUpAt - right.signedUpAt || (left.id < right.id ? -1 : 1))
          .map((signup): AidVolunteerView => ({ id: signup.id, person: personView(state, signup.personId, now), signedUpAt: signup.signedUpAt }))
        return windowOf(items, cursor, `volunteers:${mission.id}`)
      }), [revisionKey, missionId, cursor])
    },

    // ── Gestes de l'équipe ───────────────────────────────────────
    createMission: (input) => act((state, viewerId, now) => {
      const refusal = demoViewerRefusal(state, now, "publish")
      if (refusal) return fail(refusal)
      const page = state.pages[input.pageId]
      if (!page || !isTeam(state, page.id, viewerId, now)) return fail("not_found")
      if (page.ownerKind !== "association") return fail("aid_page_kind_not_allowed")
      const draft = parseAidMission(input)
      if (!draft.ok) return fail(draft.code)
      const timing = checkAidMissionTiming(draft.value.startsAt, now)
      if (!timing.ok) return fail(timing.code)
      const base = current()
      const id = `aid-m-${base.sequence}`
      const mission: DemoAidMission = {
        id, pageId: page.id, ...draft.value, signupCount: 0, status: "open", cancelReason: null, version: 1, createdAt: now, updatedAt: now,
      }
      return { next: { ...base, sequence: base.sequence + 1, missions: [...base.missions, mission] }, value: { missionId: id } }
    }),

    updateMission: (input) => act((state, viewerId, now) => {
      const refusal = demoViewerRefusal(state, now, "publish")
      if (refusal) return fail(refusal)
      const base = current()
      const mission = managedMission(state, base, input.missionId, viewerId, now)
      if (!mission) return fail("not_found")
      const check = checkAidMissionGesture({ gesture: "edit", status: mission.status, expectedVersion: input.expectedVersion, version: mission.version })
      if (!check.ok) return fail(check.code)
      const draft = parseAidMission(input)
      if (!draft.ok) return fail(draft.code)
      const rescheduled = draft.value.startsAt !== mission.startsAt || draft.value.endsAt !== mission.endsAt || draft.value.timeZone !== mission.timeZone
      if (rescheduled) {
        const timing = checkAidMissionTiming(draft.value.startsAt, now)
        if (!timing.ok) return fail(timing.code)
      }
      const status = checkAidMissionPlacesChange(draft.value.places, mission.signupCount)
      if (!status.ok) return fail(status.code)
      return { next: updateMissionRow(base, mission, { ...draft.value, status: status.value, updatedAt: now, version: mission.version + 1 }), value: null }
    }),

    closeMission: ({ missionId, expectedVersion }) => missionGesture("close", missionId, expectedVersion, (mission, status, base, now) => ({
      next: updateMissionRow(base, mission, { status, updatedAt: now, version: mission.version + 1 }),
      value: null,
    })),

    cancelMission: ({ missionId, expectedVersion, reason }) => missionGesture("cancel", missionId, expectedVersion, (mission, status, base, now) => {
      const parsed = parseAidReason(reason)
      if (!parsed.ok) return fail(parsed.code)
      return { next: updateMissionRow(base, mission, { status, cancelReason: parsed.value, updatedAt: now, version: mission.version + 1 }), value: null }
    }),

    // ── Gestes des bénévoles ─────────────────────────────────────
    signUp: ({ missionId, shareNameWithTeam }) => act((state, viewerId, now) => {
      const refusal = demoViewerRefusal(state, now, "publish")
      if (refusal) return fail(refusal)
      const base = current()
      const mission = base.missions.find((candidate) => candidate.id === missionId)
      if (!mission || !associationPage(state, mission.pageId)) return fail("not_found")
      const row = signupOf(base, mission.id, viewerId)
      const next = checkAidSignup(factsOf(mission, row), shareNameWithTeam, now)
      if (!next.ok) return fail(next.code)
      const signups = row
        ? base.signups.map((candidate) => (candidate.id === row.id ? { ...candidate, status: "confirmed" as const, nameConsentAt: now, signedUpAt: now } : candidate))
        : [...base.signups, { id: `aid-s-${base.sequence}`, missionId: mission.id, personId: viewerId, status: "confirmed" as const, nameConsentAt: now, signedUpAt: now }]
      const ledgerNext = updateMissionRow({ ...base, sequence: row ? base.sequence : base.sequence + 1, signups }, mission, { signupCount: next.value.signupCount, status: next.value.status, updatedAt: now })
      return { next: ledgerNext, value: null }
    }),

    withdrawSignup: (missionId) => act((state, viewerId, now) => {
      const refusal = demoViewerRefusal(state, now)
      if (refusal) return fail(refusal)
      const base = current()
      const mission = base.missions.find((candidate) => candidate.id === missionId)
      if (!mission) return fail("not_found")
      const row = signupOf(base, mission.id, viewerId)
      const next = checkAidSignupWithdrawal(factsOf(mission, row), now)
      if (!next.ok || !row) return fail(next.ok ? "not_found" : next.code)
      const signups = base.signups.map((candidate) => (candidate.id === row.id ? { ...candidate, status: "withdrawn" as const } : candidate))
      return { next: updateMissionRow({ ...base, signups }, mission, { signupCount: next.value.signupCount, status: next.value.status, updatedAt: now }), value: null }
    }),
  }
}
