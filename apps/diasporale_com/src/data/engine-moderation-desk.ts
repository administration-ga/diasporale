"use client"

/**
 * Adaptateur moteur de la capacité « modération par pays » (PD6 · G9).
 * PROPRIÉTAIRE : ce chantier.
 *
 * Lectures : la tranche `diaspora/moderationDesk` du moteur (capacité, file
 * filtrée par le pays de la cible, dossier et décisions antérieures, relecture
 * préalable, recours du réseau, composition des équipes), toutes bornées par le
 * réseau `diasporale` et par la personne ATTENDUE (`expectedPersonId`) ; l'aperçu
 * est la projection bornée du moteur (`moderation/reviewProjection.preview`).
 * Une lecture ne part qu'une fois la session et l'adhésion lisibles ; un refus
 * ne laisse aucune ligne à l'écran.
 *
 * Écritures : les mutations EXISTANTES du moteur (`moderation/cases` :
 * `decide`, `reviewContent`, `reviewNetworkAppeal`, `createTeam`,
 * `setTeamMember`), qui motivent, journalisent et préviennent l'auteur. Le
 * motif et les mesures sont jugés avant tout appel, la personne de la session
 * est relue : une autre session ferme le geste (`not_found`) avant toute écriture.
 */
import { engineErrorCode, engineErrorRule } from "@antsia/social-contracts/errors"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  DESK_PAGE_SIZE,
  deskCountry,
  deskGround,
  deskReasonRefusal,
  deskSanctions,
  deskTeamNameRefusal,
  type ActionErrorCode,
  type ActionResult,
  type DeskAppealView,
  type DeskCaseDetailView,
  type DeskCaseView,
  type DeskPage,
  type DeskPendingView,
  type DeskPreviewView,
  type DeskRosterView,
  type DeskSurface,
  type DeskZone,
  type Loadable,
  type ModerationDeskCapability,
  type ModerationDeskView,
  type PostMediaView,
} from "@diasporale/features/data"
import type { FunctionArgs, FunctionReturnType } from "convex/server"
import { useMemo } from "react"

import { engineActionErrorCode } from "./engine-errors"
import {
  failed,
  LOADING,
  memberReadError,
  ready,
  Refusal,
  resolveDiasporaleNetworkId,
  useEngineMember,
  useLoaded,
  type EngineSourceDeps,
  type Loaded,
} from "./engine-kit"

const DESK = api.modules.diaspora.moderationDesk
const CASES = api.modules.moderation.cases
const PREVIEW = api.modules.moderation.reviewProjection.preview

type DeskRow = FunctionReturnType<typeof DESK.myDesk>
type CaseRow = FunctionReturnType<typeof DESK.queue>["items"][number]
type CaseDetailRow = FunctionReturnType<typeof DESK.caseDetail>
type PendingRow = FunctionReturnType<typeof DESK.pendingQueue>["items"][number]
type AppealRow = FunctionReturnType<typeof DESK.appealQueue>["items"][number]
type RosterRow = FunctionReturnType<typeof DESK.teamRoster>
type PreviewRow = FunctionReturnType<typeof PREVIEW>
type EngineZone = FunctionArgs<typeof DESK.queue>["zone"]
type EngineTarget = FunctionArgs<typeof CASES.reviewContent>["target"]
type Window<Row> = { readonly items: readonly Row[]; readonly continueCursor: string | null; readonly isDone: boolean }

// ── Refus ──────────────────────────────────────────────────────────────────

/** Le champ fautif d'un `invalidArgument` du moteur (un nom de champ, jamais une valeur). */
function invalidField(error: unknown): string | null {
  if (engineErrorCode(error) !== "invalidArgument" || typeof error !== "object" || error === null || !("data" in error)) return null
  const data = (error as { data: unknown }).data
  if (typeof data !== "object" || data === null || !("field" in data)) return null
  const field = (data as { field: unknown }).field
  return typeof field === "string" ? field : null
}

/** Les refus des gestes de modération, en codes FERMÉS ; le reste suit la table commune du moteur. */
export function moderationDeskErrorCode(error: unknown): ActionErrorCode {
  if (error instanceof Refusal) return error.code
  if (engineErrorRule(error)?.rule === "DECISION_REASON_LENGTH") return "moderation_desk_reason_length"
  const code = engineErrorCode(error)
  if (code === "conflict") return "moderation_desk_conflict"
  if (code === "policyRefused") return "moderation_desk_limit"
  const field = invalidField(error)
  if (field === "sanctions" || field === "until") return "moderation_desk_measure_refused"
  if (field === "name") return "moderation_desk_team_name_length"
  return engineActionErrorCode(error)
}

async function run<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, value: await work() }
  } catch (error) {
    return { ok: false, code: moderationDeskErrorCode(error) }
  }
}

// ── Projections ────────────────────────────────────────────────────────────

export function toDeskView(row: NonNullable<DeskRow>): ModerationDeskView {
  return {
    role: row.role,
    networkWide: row.networkWide,
    canReviewAppeals: row.canReviewAppeals,
    canManageTeams: row.canManageTeams,
    teams: row.teams.map((team) => ({ teamId: team.teamId, name: team.name, scope: team.scope, isMember: team.isMember })),
  }
}

/** Un dossier de la file : le motif dit par une valeur fermée, le pays seulement s'il est un code connu. */
export function toCaseView(row: CaseRow): DeskCaseView {
  return {
    reportId: row.reportId,
    surface: row.surface,
    country: deskCountry(row.country),
    ground: deskGround(row.reason),
    status: row.status,
    level: row.level,
    teamName: row.teamName,
    createdAt: row.createdAt,
    hasAuthor: row.hasAuthor,
    party: row.party,
  }
}

export function toCaseDetailView(row: CaseDetailRow): DeskCaseDetailView {
  return {
    case: toCaseView(row.case),
    history: row.history.map((entry) => ({
      status: entry.status,
      origin: entry.origin,
      decidedAt: entry.decidedAt,
      decisionReason: entry.decisionReason,
      sanctions: [...entry.sanctions],
    })),
    historyMore: row.historyMore,
  }
}

export function toPendingView(row: PendingRow): DeskPendingView {
  return {
    key: `${row.target.kind}:${row.target.id}`,
    targetKind: row.target.kind,
    targetId: row.target.id,
    country: deskCountry(row.country),
    teamName: row.teamName,
    updatedAt: row.updatedAt,
    party: row.party,
  }
}

export function toAppealView(row: AppealRow): DeskAppealView {
  return {
    appealId: row.appealId,
    reportId: row.reportId,
    surface: row.surface,
    country: deskCountry(row.country),
    ground: deskGround(row.reason),
    appealReason: row.appealReason,
    createdAt: row.createdAt,
    decisionReason: row.decisionReason,
    decidedAt: row.decidedAt,
    sanctions: row.sanctions.map((sanction) => ({ kind: sanction.kind, until: sanction.until })),
    party: row.party,
  }
}

export function toRosterView(row: RosterRow): DeskRosterView {
  return {
    members: row.members.map((member) => ({
      personId: member.personId,
      handle: member.handle,
      displayName: member.displayName,
      inNetwork: member.inNetwork,
      isMe: member.isMe,
    })),
    more: row.more,
  }
}

/** Un média retenu par la garde des fichiers garde sa place, sans adresse. */
function toMediaView(media: PreviewRow["media"][number]): PostMediaView {
  const withheld = media.withheld === "fileScanPending" ? "scan_pending" : media.withheld === "fileQuarantined" ? "quarantined" : null
  return {
    kind: media.kind,
    url: withheld === null ? media.url : null,
    withheld,
    altText: media.altText ?? null,
    width: media.width ?? null,
    height: media.height ?? null,
  }
}

/** La projection bornée du moteur, telle quelle : ni auteur, ni contact, ni contexte. */
export function toPreviewView(row: PreviewRow): DeskPreviewView {
  return { available: row.available, title: row.title, body: row.body, media: row.media.map(toMediaView) }
}

function windowOf<Row, View>(rows: Window<Row>, view: (row: Row) => View): DeskPage<View> {
  return { items: rows.items.map(view), continueCursor: rows.isDone ? null : rows.continueCursor, isDone: rows.isDone }
}

const projectDesk = (row: DeskRow): ModerationDeskView | null => (row === null ? null : toDeskView(row))
const projectCases = (rows: FunctionReturnType<typeof DESK.queue>): DeskPage<DeskCaseView> => windowOf(rows, toCaseView)
const projectPending = (rows: FunctionReturnType<typeof DESK.pendingQueue>): DeskPage<DeskPendingView> => windowOf(rows, toPendingView)
const projectAppeals = (rows: FunctionReturnType<typeof DESK.appealQueue>): DeskPage<DeskAppealView> => windowOf(rows, toAppealView)

export function engineZone(zone: DeskZone): EngineZone {
  if (zone.kind === "country") return { kind: "country", country: zone.country }
  return zone.kind === "none" ? { kind: "none" } : { kind: "all" }
}

/** La cible d'un contenu en relecture, rendue telle que le moteur l'a typée dans sa file. */
function engineTarget(kind: DeskSurface, id: string): EngineTarget {
  return { kind, id } as EngineTarget
}

// ── Lecture ────────────────────────────────────────────────────────────────

interface DeskReader {
  readonly networkId: Id<"networks"> | null
  readonly error: ActionErrorCode | null
}

/** Le réseau `diasporale`, seulement quand la session et l'adhésion sont lisibles (sinon le refus standard). */
function useDeskReader(personId: string): DeskReader {
  const member = useEngineMember()
  const error = memberReadError(member)
  const networkId = member.networkId.state === "ready" ? member.networkId.value : null
  const canRead = error === null && member.auth.isAuthenticated && member.membership.state === "ready" && member.membership.value !== null && personId.trim().length > 0
  return { networkId: canRead ? networkId : null, error }
}

/**
 * Une réponse du moteur projetée UNE fois : la même référence tant que la
 * réponse et les refus ne changent pas (les fenêtres de la file s'y fient).
 */
function useProjected<T, V>(reader: DeskReader, loaded: Loaded<T>, project: (value: T) => V): Loadable<V> {
  const value = loaded.state === "ready" ? loaded.value : undefined
  const code = loaded.state === "error" ? loaded.code : null
  return useMemo<Loadable<V>>(
    () => {
      if (reader.error !== null) return failed(reader.error)
      if (code !== null) return failed(code)
      if (value === undefined) return LOADING
      return ready(project(value))
    },
    // La projection est une fonction du module : seuls la réponse et les refus comptent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reader.error, code, value],
  )
}

// ── La capacité ────────────────────────────────────────────────────────────

export function createEngineModerationDesk(deps: EngineSourceDeps): ModerationDeskCapability {
  /** La personne de la session, relue à l'acte : le geste ne vaut que pour la personne affichée. */
  async function expectPerson(personId: string): Promise<void> {
    const person = await deps.convex.query(api.modules.people.persons.getMyPerson, {})
    if (!person) throw new Refusal("not_signed_in")
    if (person._id !== personId) throw new Refusal("not_found")
  }

  function requireReason(reason: string): string {
    const refusal = deskReasonRefusal(reason)
    if (refusal) throw new Refusal(refusal)
    return reason.trim()
  }

  return {
    demonstration: false,

    useDesk(personId) {
      const reader = useDeskReader(personId)
      const loaded = useLoaded(DESK.myDesk, reader.networkId ? { networkId: reader.networkId, expectedPersonId: personId as Id<"persons"> } : "skip")
      return useProjected(reader, loaded, projectDesk)
    },

    useQueue({ personId, zone, surface, teamId, status, cursor }) {
      const reader = useDeskReader(personId)
      const loaded = useLoaded(DESK.queue, reader.networkId
        ? {
            networkId: reader.networkId,
            expectedPersonId: personId as Id<"persons">,
            zone: engineZone(zone),
            ...(surface ? { surface } : {}),
            ...(teamId ? { teamId: teamId as Id<"moderationTeams"> } : {}),
            // Les dossiers ouverts par défaut, comme le moteur ; « en examen » seulement sur demande.
            ...(status === "reviewing" ? { status } : {}),
            paginationOpts: { cursor, numItems: DESK_PAGE_SIZE },
          }
        : "skip")
      return useProjected(reader, loaded, projectCases)
    },

    useCase({ personId, reportId }) {
      const reader = useDeskReader(personId)
      const loaded = useLoaded(DESK.caseDetail, reader.networkId
        ? { networkId: reader.networkId, expectedPersonId: personId as Id<"persons">, reportId: reportId as Id<"reports"> }
        : "skip")
      return useProjected(reader, loaded, toCaseDetailView)
    },

    useCasePreview({ personId, reportId }) {
      const reader = useDeskReader(personId)
      const loaded = useLoaded(PREVIEW, reader.networkId ? { networkId: reader.networkId, reportId: reportId as Id<"reports"> } : "skip")
      return useProjected(reader, loaded, toPreviewView)
    },

    async decide(input) {
      return await run(async () => {
        const reason = requireReason(input.reason)
        const sanctions = deskSanctions(input, Date.now())
        if (!sanctions.ok) throw new Refusal(sanctions.code)
        await expectPerson(input.personId)
        const networkId = await resolveDiasporaleNetworkId(deps.convex)
        await deps.convex.mutation(CASES.decide, {
          networkId,
          reportId: input.reportId as Id<"reports">,
          decision: input.decision,
          reason,
          sanctions: sanctions.value.map((sanction) => (sanction.until === undefined ? { kind: sanction.kind } : { kind: sanction.kind, until: sanction.until })),
        })
        return { status: input.decision }
      })
    },

    usePending({ personId, zone, surface, teamId, cursor }) {
      const reader = useDeskReader(personId)
      const loaded = useLoaded(DESK.pendingQueue, reader.networkId
        ? {
            networkId: reader.networkId,
            expectedPersonId: personId as Id<"persons">,
            zone: engineZone(zone),
            ...(surface ? { surface } : {}),
            ...(teamId ? { teamId: teamId as Id<"moderationTeams"> } : {}),
            paginationOpts: { cursor, numItems: DESK_PAGE_SIZE },
          }
        : "skip")
      return useProjected(reader, loaded, projectPending)
    },

    usePendingPreview({ personId, targetKind, targetId }) {
      const reader = useDeskReader(personId)
      const loaded = useLoaded(PREVIEW, reader.networkId ? { networkId: reader.networkId, target: engineTarget(targetKind, targetId) } : "skip")
      return useProjected(reader, loaded, toPreviewView)
    },

    async reviewPending(input) {
      return await run(async () => {
        const reason = requireReason(input.reason)
        await expectPerson(input.personId)
        const networkId = await resolveDiasporaleNetworkId(deps.convex)
        await deps.convex.mutation(CASES.reviewContent, { networkId, target: engineTarget(input.targetKind, input.targetId), approve: input.approve, reason })
        return null
      })
    },

    useAppeals({ personId, zone, surface, cursor }) {
      const reader = useDeskReader(personId)
      const loaded = useLoaded(DESK.appealQueue, reader.networkId
        ? {
            networkId: reader.networkId,
            expectedPersonId: personId as Id<"persons">,
            zone: engineZone(zone),
            ...(surface ? { surface } : {}),
            paginationOpts: { cursor, numItems: DESK_PAGE_SIZE },
          }
        : "skip")
      return useProjected(reader, loaded, projectAppeals)
    },

    async decideAppeal(input) {
      return await run(async () => {
        const reason = requireReason(input.reason)
        await expectPerson(input.personId)
        const networkId = await resolveDiasporaleNetworkId(deps.convex)
        await deps.convex.mutation(CASES.reviewNetworkAppeal, { networkId, appealId: input.appealId as Id<"appeals">, overturn: input.overturn, reason })
        return null
      })
    },

    useRoster({ personId, teamId }) {
      const reader = useDeskReader(personId)
      const loaded = useLoaded(DESK.teamRoster, reader.networkId
        ? { networkId: reader.networkId, expectedPersonId: personId as Id<"persons">, teamId: teamId as Id<"moderationTeams"> }
        : "skip")
      return useProjected(reader, loaded, toRosterView)
    },

    async findMember({ personId, handle }) {
      return await run(async () => {
        const raw = handle.trim().replace(/^@/, "")
        if (raw.length === 0) throw new Refusal("moderation_desk_handle_required")
        const networkId = await resolveDiasporaleNetworkId(deps.convex)
        const row = await deps.convex.query(DESK.teamCandidate, { networkId, expectedPersonId: personId as Id<"persons">, handle: raw })
        return row === null ? null : { personId: row.personId, handle: row.handle, displayName: row.displayName }
      })
    },

    async createTeam(input) {
      return await run(async () => {
        const nameRefusal = deskTeamNameRefusal(input.name)
        if (nameRefusal) throw new Refusal(nameRefusal)
        const reason = requireReason(input.reason)
        await expectPerson(input.personId)
        const networkId = await resolveDiasporaleNetworkId(deps.convex)
        const created = await deps.convex.mutation(CASES.createTeam, {
          networkId,
          name: input.name.trim(),
          ...(input.scope ? { scope: input.scope } : {}),
          reason,
        })
        return { teamId: created.teamId }
      })
    },

    async setTeamMember(input) {
      return await run(async () => {
        const reason = requireReason(input.reason)
        await expectPerson(input.personId)
        const networkId = await resolveDiasporaleNetworkId(deps.convex)
        await deps.convex.mutation(CASES.setTeamMember, {
          networkId,
          teamId: input.teamId as Id<"moderationTeams">,
          personId: input.memberPersonId as Id<"persons">,
          active: input.active,
          reason,
        })
        return null
      })
    },
  }
}
