/**
 * Démonstration de la capacité « signalements » (G9) : un signalement masque la cible
 * pour la personne qui signale, dans ce seul navigateur, sans AUCUNE transmission —
 * aucune équipe réelle ne le reçoit, aucun dossier n'est ouvert. PROPRIÉTAIRE :
 * chantier « confiance des surfaces ».
 *
 * Les signalements vivent dans un stockage séparé, remis à zéro avec la démonstration
 * (graine du jeu fictif). La démonstration ne relit pas l'auteur de la cible (il vit
 * dans le fournisseur de chaque chantier) : l'écran n'offre jamais le geste sur son
 * propre contenu, et le moteur, lui, le refuse.
 */
import { hasCapability } from "@diasporale/domain"
import { useSyncExternalStore } from "react"

import {
  CONTENT_REPORT_KINDS,
  contentReportRefusal,
  type ContentReportKind,
  type ContentReportsCapability,
  type ContentReportTarget,
} from "../data/content-reports-port"
import type { ActionErrorCode } from "../data/errors"
import type { ActionResult } from "../data/port"
import { REPORT_REASONS, type ReportReason } from "../data/types"
import { statusOf } from "./selectors"
import type { DemoStore } from "./store"

export const DEMO_CONTENT_REPORTS_STORAGE_KEY = "diasporale:demonstration:signalements:v1"
/** Au plus tant de signalements gardés, les plus anciens tombent : le stockage du navigateur est compté. */
export const DEMO_CONTENT_REPORTS_MAX = 500

type DemoStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

interface DemoContentReport {
  readonly reporterId: string
  readonly kind: ContentReportKind
  readonly targetId: string
  readonly reason: ReportReason
  readonly createdAt: number
}

export interface DemoContentReportsState {
  readonly version: 1
  /** La graine du jeu fictif : une démonstration remise à zéro oublie ses signalements. */
  readonly seedCreatedAt: number
  readonly reports: readonly DemoContentReport[]
}

export interface DemoContentReportsDeps {
  /** Le stockage du navigateur par défaut ; `null` : en mémoire seulement. */
  readonly storage?: DemoStorage | null
}

type Viewer = { readonly ok: true; readonly personId: string } | { readonly ok: false; readonly code: ActionErrorCode }

const fail = (code: ActionErrorCode): ActionResult<never> => ({ ok: false, code })

function defaultStorage(): DemoStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isReport(value: unknown): value is DemoContentReport {
  return isRecord(value)
    && typeof value.reporterId === "string"
    && typeof value.kind === "string" && (CONTENT_REPORT_KINDS as readonly string[]).includes(value.kind)
    && typeof value.targetId === "string"
    && typeof value.reason === "string" && (REPORT_REASONS as readonly string[]).includes(value.reason)
    && typeof value.createdAt === "number" && Number.isFinite(value.createdAt)
}

function isState(value: unknown): value is DemoContentReportsState {
  return isRecord(value)
    && value.version === 1
    && typeof value.seedCreatedAt === "number" && Number.isFinite(value.seedCreatedAt)
    && Array.isArray(value.reports) && value.reports.every(isReport)
}

export function createDemoContentReports(store: DemoStore, deps: DemoContentReportsDeps = {}): ContentReportsCapability {
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage
  let state: DemoContentReportsState | null = null
  let version = 0
  const listeners = new Set<() => void>()
  const empty = (seedCreatedAt: number): DemoContentReportsState => ({ version: 1, seedCreatedAt, reports: [] })

  /** L'état courant, relu du stockage une fois ; une démonstration remise à zéro repart vide. */
  function current(): DemoContentReportsState {
    const seed = store.getState().createdAt
    if (state !== null) {
      if (state.seedCreatedAt !== seed) {
        state = empty(seed)
        try {
          storage?.removeItem(DEMO_CONTENT_REPORTS_STORAGE_KEY)
        } catch {
          // La remise à zéro en mémoire suffit.
        }
      }
      return state
    }
    try {
      const raw = storage?.getItem(DEMO_CONTENT_REPORTS_STORAGE_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : null
      if (isState(parsed) && parsed.seedCreatedAt === seed) return (state = parsed)
    } catch {
      // Stockage illisible ou bloqué : une démonstration sans signalement.
    }
    return (state = empty(seed))
  }

  function commit(next: DemoContentReportsState): void {
    state = next
    version += 1
    try {
      storage?.setItem(DEMO_CONTENT_REPORTS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Stockage plein ou interdit : la démonstration continue en mémoire.
    }
    for (const listener of listeners) listener()
  }

  // Une nouvelle personne de session, une remise à zéro : le jeu principal le dit aussi.
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    const unsubscribe = store.subscribe(listener)
    return () => {
      listeners.delete(listener)
      unsubscribe()
    }
  }
  const snapshot = () => `${store.getVersion()}:${version}`

  /** La personne de la session, membre qui lit le réseau ; sinon le refus fermé. */
  function viewer(): Viewer {
    const main = store.getState()
    const personId = main.session.personId
    if (!personId || !main.persons[personId]) return { ok: false, code: "not_signed_in" }
    const status = statusOf(main, personId, store.now())
    if (!main.memberships[personId] || status === null || status === "partie") return { ok: false, code: "not_member" }
    if (status === "suspendue") return { ok: false, code: "suspended" }
    if (!hasCapability(status, "read_network")) return { ok: false, code: "not_member" }
    return { ok: true, personId }
  }

  function reportedBy(personId: string, target: ContentReportTarget): boolean {
    return current().reports.some((row) => row.reporterId === personId && row.kind === target.kind && row.targetId === target.id)
  }

  return {
    demonstration: true,

    async report(input) {
      const refusal = contentReportRefusal(input)
      if (refusal !== null) return fail(refusal)
      const access = viewer()
      if (!access.ok) return fail(access.code)
      // Rejoué : le signalement existant, rien de plus n'est créé.
      if (reportedBy(access.personId, input)) return { ok: true, value: { created: false } }
      const data = current()
      const row: DemoContentReport = { reporterId: access.personId, kind: input.kind, targetId: input.id, reason: input.reason, createdAt: store.now() }
      commit({ ...data, reports: [...data.reports, row].slice(-DEMO_CONTENT_REPORTS_MAX) })
      return { ok: true, value: { created: true } }
    },

    useReported(target) {
      const tick = useSyncExternalStore(subscribe, snapshot, () => "")
      // Rendu serveur et hydratation : rien n'est masqué (aucun écart avec le premier rendu du client).
      if (tick === "") return false
      const personId = store.getState().session.personId
      return personId !== null && reportedBy(personId, target)
    },
  }
}
