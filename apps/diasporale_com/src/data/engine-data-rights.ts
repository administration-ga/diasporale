"use client"

/**
 * Adaptateur moteur de la capacité « droits personnels » (DG-026) : portes
 * self-scoped du moteur (`people/erasure`, `moderation/cases`).
 * PROPRIÉTAIRE : chantier « droits personnels ».
 *
 * Fonctions du moteur EXISTANTES, toutes `personQuery` / `personMutation` (la
 * seule personne de la session, même suspendue) :
 *   · `people/erasure` : `myErasure`, `requestErasure` (confirmation littérale),
 *     `cancelErasure` (pendant la grâce seulement), `exportMyData` (préparation,
 *     valable 24 h) et `exportMyDataPage` (une page d'une table, relue pour la
 *     personne de la session à chaque appel) ;
 *   · `moderation/cases` : `myDecisions` (sans déclarant ni contenu), `fileAppeal`, et
 *     `myReports` (SU01d : mes signalements, sans auteur, sanction ni motif de modération).
 *
 * Aucune lecture d'adhésion : un membre suspendu exerce ses droits sans
 * qu'aucune surface sociale lui soit rouverte. Chaque écriture relit d'abord la
 * personne de la session : un changement de personne ferme le geste
 * (`not_found`) avant toute écriture. L'export s'assemble en mémoire, page à
 * page : aucune URL, aucun stockage tiers, jamais de fichier partiel.
 */
import { useStableConvexAuth } from "@antsia/api/hooks"
import { engineErrorCode, engineErrorRule } from "@antsia/social-contracts/errors"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { ROOT_NETWORK_SLUG } from "@diasporale/domain"
import {
  appealReasonRefusal,
  decisionGround,
  DECISIONS_PAGE_SIZE,
  nextAppealLevel,
  type ActionErrorCode,
  type ActionResult,
  type DataExportFile,
  type DataExportOptions,
  type DataRightsCapability,
  type DecisionNetwork,
  type DecisionsQuery,
  type DecisionsRequest,
  type ErasureView,
  type LastExportView,
  type Loadable,
  type ModerationDecisionView,
  type PersonalReportView,
  type ReportsQuery,
  type ReportsRequest,
} from "@diasporale/features/data"
import type { FunctionReturnType } from "convex/server"
import { useSyncExternalStore } from "react"

import { engineActionErrorCode } from "./engine-errors"
import { type EngineSourceDeps, failed, LOADING, ready, Refusal, useLoaded, useNetworkId } from "./engine-kit"

type ErasureRow = FunctionReturnType<typeof api.modules.people.erasure.myErasure>
type DecisionRow = FunctionReturnType<typeof api.modules.moderation.cases.myDecisions>["page"][number]
type ReportRow = FunctionReturnType<typeof api.modules.moderation.cases.myReports>["page"][number]

/** Le document exporté : un objet JSON unique, assemblé dans ce navigateur. */
export const DATA_EXPORT_FORMAT = "antsia-personal-export"

/**
 * La capacité, et les deux écritures historiques du port principal
 * (`exportMyData` / `deleteMyAccount` des actions) qui lui sont déléguées :
 * l'export complet en un document, et la DEMANDE d'effacement (délai de grâce,
 * annulable) — jamais un effacement immédiat.
 */
export interface EngineDataRights extends DataRightsCapability {
  exportMyData(): Promise<ActionResult<string>>
  deleteMyAccount(): Promise<ActionResult>
}

// ── Refus ──────────────────────────────────────────────────────────────────

/** Le champ fautif d'un `invalidArgument` du moteur (un nom de champ, jamais une valeur). */
function invalidField(error: unknown): string | null {
  if (engineErrorCode(error) !== "invalidArgument" || typeof error !== "object" || error === null || !("data" in error)) return null
  const data = (error as { data: unknown }).data
  if (typeof data !== "object" || data === null || !("field" in data)) return null
  const field = (data as { field: unknown }).field
  return typeof field === "string" ? field : null
}

/** Les refus des portes de droits, en codes FERMÉS ; le reste suit la table commune du moteur. */
export function dataRightsErrorCode(error: unknown): ActionErrorCode {
  if (error instanceof Refusal) return error.code
  const field = invalidField(error)
  if (field === "erasurePhase") return "erasure_not_cancellable"
  if (field === "dataInventory") return "export_unavailable"
  if (engineErrorRule(error)?.rule === "DECISION_REASON_LENGTH") return "appeal_reason_length"
  return engineActionErrorCode(error)
}

/** Une page d'export refusée : préparation échue ou d'une autre session, ou assemblage rompu. */
function exportPageRefusal(error: unknown): ActionErrorCode {
  const code = dataRightsErrorCode(error)
  if (code === "not_found") return "export_expired"
  return code === "unknown" ? "export_interrupted" : code
}

async function run<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, value: await work() }
  } catch (error) {
    return { ok: false, code: dataRightsErrorCode(error) }
  }
}

// ── Projections ────────────────────────────────────────────────────────────

/** `canCancel` est calculé par le serveur : il ne vaut que pendant la grâce. */
export function toErasureView(row: ErasureRow): ErasureView {
  if (row === null) return { state: "none" }
  return { state: row.canCancel ? "grace" : "processing", requestedAt: row.requestedAt, dueAt: row.dueAt }
}

/**
 * Une décision du moteur, sans identifiant de cible, d'équipe ni de réseau :
 * le réseau se dit DIASPORALE, ANTSIA (la racine) ou « un autre réseau ».
 */
export function toDecisionView(row: DecisionRow, networks: { readonly diasporale: string | null; readonly root: string | null }): ModerationDecisionView {
  const network: DecisionNetwork = networks.diasporale !== null && row.networkId === networks.diasporale
    ? "diasporale"
    : networks.root !== null && row.networkId === networks.root ? "antsia" : "other"
  const view = {
    reportId: row.reportId,
    network,
    surface: row.target.kind,
    ground: decisionGround(row.reason),
    status: row.status,
    level: row.level,
    createdAt: row.createdAt,
    decisionReason: row.decisionReason,
    sanctions: row.sanctions.map((sanction) => ({ kind: sanction.kind, status: sanction.status, until: sanction.until, reason: sanction.reason })),
    appeals: row.appeals.map((appeal) => ({ level: appeal.level, status: appeal.status, decisionReason: appeal.decisionReason })),
  }
  return { ...view, appealLevel: nextAppealLevel(view) }
}

/** Un signalement que j'ai transmis, tel que le moteur le rend au seul déclarant (SU01d). */
export function toPersonalReportView(row: ReportRow): PersonalReportView {
  return {
    reportId: row.reportId,
    surface: row.targetKind,
    ground: decisionGround(row.reason),
    createdAt: row.createdAt,
    acknowledgedAt: row.acknowledgedAt,
    legal: row.legalBasis !== null && row.dueAt !== null ? { basis: row.legalBasis, dueAt: row.dueAt } : null,
    outcome: row.outcome,
    decidedAt: row.decidedAt,
  }
}

/** La partie « compte » de la préparation (Better Auth et preuves IDN), relue telle que le moteur l'a projetée. */
function accountPart(accountJson: string): { account: unknown; identityProofs: unknown[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(accountJson)
  } catch {
    throw new Refusal("export_interrupted")
  }
  if (typeof parsed !== "object" || parsed === null) throw new Refusal("export_interrupted")
  const part = parsed as { account?: unknown; identityProofs?: unknown }
  return { account: part.account ?? null, identityProofs: Array.isArray(part.identityProofs) ? part.identityProofs : [] }
}

function pageRows(json: string): unknown[] {
  let rows: unknown
  try {
    rows = JSON.parse(json)
  } catch {
    throw new Refusal("export_interrupted")
  }
  if (!Array.isArray(rows)) throw new Refusal("export_interrupted")
  return rows
}

// ── Mémoire du dernier export ──────────────────────────────────────────────

/**
 * Le dernier export de chaque personne, par client Convex : mémoire de l'onglet
 * seulement (une déconnexion recharge la page), jamais le contenu du fichier.
 */
interface LastExports {
  readonly subscribe: (listener: () => void) => () => void
  get(personId: string): LastExportView | null
  set(personId: string, view: LastExportView): void
}

const LAST_EXPORTS = new WeakMap<object, LastExports>()

function lastExportsOf(owner: object): LastExports {
  const known = LAST_EXPORTS.get(owner)
  if (known) return known
  const views = new Map<string, LastExportView>()
  const listeners = new Set<() => void>()
  const created: LastExports = {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    get: (personId) => views.get(personId) ?? null,
    set: (personId, view) => {
      views.set(personId, view)
      for (const listener of listeners) listener()
    },
  }
  LAST_EXPORTS.set(owner, created)
  return created
}

// ── La capacité ────────────────────────────────────────────────────────────

export function createEngineDataRights(deps: EngineSourceDeps): EngineDataRights {
  const lastExports = lastExportsOf(deps.convex)

  /** La personne de la session, relue à l'acte. */
  async function sessionPersonId(): Promise<string> {
    const person = await deps.convex.query(api.modules.people.persons.getMyPerson, {})
    if (!person) throw new Refusal("not_signed_in")
    return person._id
  }

  /** Le geste ne vaut que pour la personne affichée : une autre session le ferme avant toute écriture. */
  async function expectPerson(personId: string): Promise<void> {
    if ((await sessionPersonId()) !== personId) throw new Refusal("not_found")
  }

  async function requestFor(personId: string): Promise<{ dueAt: number }> {
    await expectPerson(personId)
    const { dueAt } = await deps.convex.mutation(api.modules.people.erasure.requestErasure, { confirmation: "DELETE_MY_ANTSIA_ACCOUNT" })
    return { dueAt }
  }

  async function assemble(personId: string, options?: DataExportOptions): Promise<DataExportFile> {
    const stopIfCancelled = () => {
      if (options?.signal?.aborted) throw new Refusal("export_cancelled")
    }
    stopIfCancelled()
    await expectPerson(personId)
    stopIfCancelled()
    const started = await deps.convex.mutation(api.modules.people.erasure.exportMyData, {})
    const account = accountPart(started.accountJson)
    const total = started.tableCount
    const tables: Record<string, unknown[]> = {}
    let tableIndex = 0
    let cursor: string | null = null
    options?.onProgress?.({ done: 0, total })
    for (;;) {
      stopIfCancelled()
      let page: FunctionReturnType<typeof api.modules.people.erasure.exportMyDataPage>
      try {
        page = await deps.convex.query(api.modules.people.erasure.exportMyDataPage, { exportId: started.exportId, tableIndex, cursor })
      } catch (error) {
        throw new Refusal(exportPageRefusal(error))
      }
      const rows = pageRows(page.json)
      if (rows.length > 0) (tables[page.table] ??= []).push(...rows)
      if (page.done) break
      // Garde de progression : la table suivante sans curseur, ou la même table avec un curseur neuf.
      const nextTable = page.nextTableIndex === tableIndex + 1 && page.cursor === null
      const nextPage = page.nextTableIndex === tableIndex && page.cursor !== null && page.cursor !== cursor
      if ((!nextTable && !nextPage) || page.nextTableIndex >= total) throw new Refusal("export_interrupted")
      tableIndex = page.nextTableIndex
      cursor = page.cursor
      options?.onProgress?.({ done: tableIndex, total })
    }
    stopIfCancelled()
    options?.onProgress?.({ done: total, total })
    const exportedAt = Date.now()
    const json = JSON.stringify({
      format: DATA_EXPORT_FORMAT,
      exportedAt: new Date(exportedAt).toISOString(),
      account: account.account,
      identityProofs: account.identityProofs,
      tables,
    }, null, 2)
    lastExports.set(personId, { exportedAt })
    return { json, exportedAt }
  }

  return {
    useErasure(personId: string): Loadable<ErasureView> {
      const auth = useStableConvexAuth()
      const signedIn = auth.isAuthenticated
      const person = useLoaded(api.modules.people.persons.getMyPerson, signedIn ? {} : "skip")
      const erasure = useLoaded(api.modules.people.erasure.myErasure, signedIn ? {} : "skip")
      if (auth.isUnauthenticated) return failed("not_signed_in")
      if (!signedIn) return LOADING
      if (person.state === "error") return failed(person.code)
      if (erasure.state === "error") return failed(erasure.code)
      // La personne naît à la première session : un instant, elle n'existe pas encore.
      if (person.state !== "ready" || erasure.state !== "ready" || person.value === null) return LOADING
      if (person.value._id !== personId) return failed("not_found")
      return ready(toErasureView(erasure.value))
    },

    requestErasure: (personId) => run(() => requestFor(personId)),

    cancelErasure: (personId) => run(async () => {
      await expectPerson(personId)
      await deps.convex.mutation(api.modules.people.erasure.cancelErasure, {})
      return null
    }),

    prepareExport: (personId, options) => run(() => assemble(personId, options)),

    useLastExport(personId: string): LastExportView | null {
      return useSyncExternalStore(lastExports.subscribe, () => lastExports.get(personId), () => null)
    },

    useDecisions({ personId, cursor }: DecisionsRequest): DecisionsQuery {
      const auth = useStableConvexAuth()
      const signedIn = auth.isAuthenticated
      const person = useLoaded(api.modules.people.persons.getMyPerson, signedIn ? {} : "skip")
      const diasporale = useNetworkId()
      const root = useLoaded(api.modules.networks.networks.getBySlug, { slug: ROOT_NETWORK_SLUG })
      const page = useLoaded(api.modules.moderation.cases.myDecisions, signedIn ? { paginationOpts: { cursor, numItems: DECISIONS_PAGE_SIZE } } : "skip")
      if (auth.isUnauthenticated) return failed("not_signed_in")
      if (!signedIn) return LOADING
      if (person.state === "error") return failed(person.code)
      if (page.state === "error") return failed(page.code)
      if (person.state !== "ready" || page.state !== "ready" || person.value === null) return LOADING
      if (person.value._id !== personId) return failed("not_found")
      // Le nom d'un réseau n'est qu'une étiquette : une lecture refusée le dit « autre réseau ».
      if (diasporale.state === "loading" || root.state === "loading") return LOADING
      const networks = {
        diasporale: diasporale.state === "ready" ? diasporale.value : null,
        root: root.state === "ready" ? (root.value?._id ?? null) : null,
      }
      return ready({
        items: page.value.page.map((row) => toDecisionView(row, networks)),
        continueCursor: page.value.isDone ? null : page.value.continueCursor,
        isDone: page.value.isDone,
      })
    },

    useReports({ personId, cursor }: ReportsRequest): ReportsQuery {
      const auth = useStableConvexAuth()
      const signedIn = auth.isAuthenticated
      const person = useLoaded(api.modules.people.persons.getMyPerson, signedIn ? {} : "skip")
      const page = useLoaded(api.modules.moderation.cases.myReports, signedIn ? { paginationOpts: { cursor, numItems: DECISIONS_PAGE_SIZE } } : "skip")
      if (auth.isUnauthenticated) return failed("not_signed_in")
      if (!signedIn) return LOADING
      if (person.state === "error") return failed(person.code)
      if (page.state === "error") return failed(page.code)
      if (person.state !== "ready" || page.state !== "ready" || person.value === null) return LOADING
      if (person.value._id !== personId) return failed("not_found")
      return ready({
        items: page.value.page.map(toPersonalReportView),
        continueCursor: page.value.isDone ? null : page.value.continueCursor,
        isDone: page.value.isDone,
      })
    },

    fileAppeal: ({ personId, reportId, reason }) => run(async () => {
      const refusal = appealReasonRefusal(reason)
      if (refusal) throw new Refusal(refusal)
      await expectPerson(personId)
      const result = await deps.convex.mutation(api.modules.moderation.cases.fileAppeal, { reportId: reportId as Id<"reports">, reason: reason.trim() })
      return { created: result.created }
    }),

    exportMyData: () => run(async () => (await assemble(await sessionPersonId())).json),

    deleteMyAccount: () => run(async () => {
      await requestFor(await sessionPersonId())
      return null
    }),
  }
}
