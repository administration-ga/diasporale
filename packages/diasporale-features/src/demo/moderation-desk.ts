/**
 * Démonstration de la capacité « modération par pays » (PD6 · G9). PROPRIÉTAIRE : ce chantier.
 *
 * EXPLICITEMENT FICTIVE, et cohérente avec le magasin de démonstration :
 *   · la personne de la session, membre active du jeu de démonstration, reçoit un
 *     rôle FICTIF d'administration du réseau pour parcourir les trois onglets ;
 *     elle fait partie de l'équipe fictive de départ ;
 *   · la file est un jeu d'exemples fictifs, sans lien avec les publications ni
 *     les personnes du magasin, répartis entre la France, la Belgique, le Canada
 *     et les cibles sans pays ; deux dossiers montrent la retenue d'une personne
 *     partie au dossier ;
 *   · une décision reste dans la mémoire de la page, liée au jeu en cours (une
 *     remise à zéro l'efface) : elle ne retire rien, ne sanctionne ni ne
 *     prévient personne ;
 *   · les règles sont celles du moteur et du port : motif borné, mesures, durée,
 *     personne partie au dossier, refus indistinct pour une autre session ou un
 *     membre qui n'agit pas.
 * Aucune statistique : une fenêtre liste, elle ne compte rien.
 */
import type { CountryCode } from "@diasporale/domain"
import { useMemo, useSyncExternalStore } from "react"

import type { ActionErrorCode } from "../data/errors"
import {
  deskReasonRefusal,
  deskSanctions,
  deskTeamNameRefusal,
  deskZoneFromKey,
  deskZoneKey,
  isInDeskZone,
  type DeskCaseDetailView,
  type DeskCaseView,
  type DeskDecision,
  type DeskGround,
  type DeskHistoryEntry,
  type DeskPage,
  type DeskParty,
  type DeskPendingView,
  type DeskPreviewView,
  type DeskRosterView,
  type DeskSurface,
  type DeskTeamMemberView,
  type DeskAppealView,
  type ModerationDeskCapability,
  type ModerationDeskView,
} from "../data/moderation-desk-port"
import type { ActionResult } from "../data/port"
import type { Loadable } from "../data/types"
import { statusOf } from "./selectors"
import type { DemoStore } from "./store"

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
/** Fenêtre de démonstration volontairement courte : « Afficher plus » se voit dès les premiers exemples. */
export const DEMO_DESK_WINDOW = 4
/** L'équipe fictive de départ. */
export const DEMO_DESK_TEAM_ID = "demo-equipe-france"

const LOADING = { status: "loading" } as const
const fail = (code: ActionErrorCode): ActionResult<never> => ({ ok: false, code })
/** Un refus de lecture, valable pour toute lecture du guichet. */
const refused = (code: ActionErrorCode) => ({ status: "error", code }) as const

interface DemoCase {
  readonly view: DeskCaseView
  readonly teamId: string | null
  readonly preview: DeskPreviewView
  readonly history: readonly DeskHistoryEntry[]
}

interface DemoPending {
  readonly view: DeskPendingView
  readonly teamId: string | null
  readonly preview: DeskPreviewView
}

interface DemoMemberLabel {
  readonly handle: string
  readonly displayName: string
}

interface DemoTeam {
  readonly teamId: string
  readonly name: string
  readonly scope: DeskSurface | null
  /** L'équipe de départ compte la personne de la session, jusqu'à son retrait. */
  readonly includesViewer: boolean
  readonly members: Map<string, DemoMemberLabel>
  readonly removed: Set<string>
}

interface DeskWorld {
  /** Le jeu de démonstration (`createdAt` de l'état) : une remise à zéro rend ce guichet caduc. */
  readonly world: number
  readonly cases: readonly DemoCase[]
  readonly pending: readonly DemoPending[]
  readonly appeals: readonly DeskAppealView[]
  readonly decided: Map<string, DeskDecision>
  readonly reviewed: Set<string>
  readonly settled: Set<string>
  readonly teams: DemoTeam[]
  teamSequence: number
}

/** La modératrice fictive de l'équipe de départ : aucune personne du magasin. */
const FICTIVE_MODERATOR = { personId: "demo-moderatrice-fictive", label: { handle: "moderatrice.fictive", displayName: "Modératrice fictive" } } as const

function preview(title: string | null, body: string): DeskPreviewView {
  return { available: true, title, body, media: [] }
}

function demoCase(input: {
  readonly id: string
  readonly surface: DeskSurface
  readonly country: CountryCode | null
  readonly ground: DeskGround
  readonly age: number
  readonly world: number
  readonly team: boolean
  readonly hasAuthor: boolean
  readonly party?: DeskParty
  readonly title?: string
  readonly body: string
  readonly history?: readonly DeskHistoryEntry[]
}): DemoCase {
  return {
    view: {
      reportId: input.id,
      surface: input.surface,
      country: input.country,
      ground: input.ground,
      status: "open",
      level: input.team ? "team" : "network",
      teamName: input.team ? "Équipe France (fictive)" : null,
      createdAt: input.world - input.age,
      hasAuthor: input.hasAuthor,
      party: input.party ?? null,
    },
    teamId: input.team ? DEMO_DESK_TEAM_ID : null,
    preview: preview(input.title ?? null, input.body),
    history: input.history ?? [],
  }
}

/** Le jeu fictif du guichet, daté depuis la création du jeu de démonstration. */
function seedWorld(world: number): DeskWorld {
  const cases: DemoCase[] = [
    demoCase({ id: "demo-dossier-1", surface: "post", country: "FR", ground: "harassment", age: 30 * HOUR, world, team: false, hasAuthor: true, body: "Exemple fictif : moqueries répétées adressées à une nouvelle arrivante dans le fil local de Paris." }),
    demoCase({ id: "demo-dossier-2", surface: "comment", country: "FR", ground: "hate", age: 26 * HOUR, world, team: true, hasAuthor: true, body: "Exemple fictif : commentaire dénigrant une communauté sous l'annonce d'une fête associative." }),
    demoCase({ id: "demo-dossier-3", surface: "page", country: "FR", ground: "misinformation", age: 22 * HOUR, world, team: false, hasAuthor: true, party: "page", title: "Association fictive des Gabonais de Lille", body: "Exemple fictif : page qui se présenterait comme la représentation officielle d'une association." }),
    demoCase({ id: "demo-dossier-4", surface: "serviceReview", country: "FR", ground: "spam", age: 18 * HOUR, world, team: true, hasAuthor: true, body: "Exemple fictif : avis promotionnel copié sous plusieurs prestations." }),
    demoCase({ id: "demo-dossier-5", surface: "serviceReviewReply", country: "BE", ground: "harassment", age: 14 * HOUR, world, team: false, hasAuthor: false, body: "Exemple fictif : réponse d'une page qui interpelle l'auteur de l'avis sur un ton agressif." }),
    demoCase({ id: "demo-dossier-6", surface: "event", country: "CA", ground: "other", age: 10 * HOUR, world, team: false, hasAuthor: false, title: "Soirée fictive à Montréal", body: "Exemple fictif : évènement dont la description renvoie vers une cagnotte extérieure non expliquée." }),
    demoCase({
      id: "demo-dossier-7", surface: "post", country: null, ground: "misinformation", age: 6 * HOUR, world, team: false, hasAuthor: true,
      body: "Exemple fictif : publication de portée diaspora annonçant une démarche consulaire inexistante.",
      history: [{ status: "dismissed", origin: "reader", decidedAt: world - 3 * DAY, decisionReason: "Information vérifiée auprès de la source citée (exemple fictif).", sanctions: [] }],
    }),
    demoCase({ id: "demo-dossier-8", surface: "person", country: null, ground: "harassment", age: 2 * HOUR, world, team: false, hasAuthor: true, party: "reporter", title: "Compte fictif", body: "Exemple fictif : compte qui relance des membres en messages privés malgré leurs refus." }),
  ]
  const pending: DemoPending[] = [
    {
      view: { key: "page:demo-page-relecture", targetKind: "page", targetId: "demo-page-relecture", country: "FR", teamName: null, updatedAt: world - 5 * HOUR, party: null },
      teamId: null,
      preview: preview("Collectif fictif des étudiants de Rennes", "Exemple fictif : nouvelle page d'association en attente de vérification avant publication."),
    },
    {
      view: { key: "event:demo-evenement-relecture", targetKind: "event", targetId: "demo-evenement-relecture", country: "FR", teamName: null, updatedAt: world - 3 * HOUR, party: null },
      teamId: null,
      preview: preview("Après-midi fictive de contes", "Exemple fictif : évènement associatif en relecture, programme et lieu à confirmer."),
    },
  ]
  const appeals: DeskAppealView[] = [
    {
      appealId: "demo-recours-1", reportId: "demo-dossier-tranche-1", surface: "post", country: "FR", ground: "harassment",
      appealReason: "Exemple fictif : je conteste, mon message était une plaisanterie entre amis.",
      createdAt: world - 20 * HOUR, decisionReason: "Propos insultants répétés envers un membre (exemple fictif).", decidedAt: world - 2 * DAY,
      sanctions: [{ kind: "warning", until: null }], party: null,
    },
    {
      appealId: "demo-recours-2", reportId: "demo-dossier-tranche-2", surface: "comment", country: null, ground: "hate",
      appealReason: "Exemple fictif : le commentaire a été mal compris, je demande un réexamen.",
      createdAt: world - 8 * HOUR, decisionReason: "Propos haineux visant une communauté (exemple fictif).", decidedAt: world - DAY,
      sanctions: [{ kind: "removal", until: null }, { kind: "suspension", until: world + 6 * DAY }], party: "decider",
    },
  ]
  const team: DemoTeam = {
    teamId: DEMO_DESK_TEAM_ID,
    name: "Équipe France (fictive)",
    scope: null,
    includesViewer: true,
    members: new Map<string, DemoMemberLabel>([[FICTIVE_MODERATOR.personId, FICTIVE_MODERATOR.label]]),
    removed: new Set<string>(),
  }
  return { world, cases, pending, appeals, decided: new Map(), reviewed: new Set(), settled: new Set(), teams: [team], teamSequence: 1 }
}

function isTeamMember(team: DemoTeam, personId: string): boolean {
  if (team.removed.has(personId)) return false
  return team.members.has(personId) || team.includesViewer
}

/** Une fenêtre fictive ; le curseur est lié au jeu de démonstration. */
function windowed<Row>(rows: readonly Row[], cursor: string | null, world: number): Loadable<DeskPage<Row>> {
  let offset = 0
  if (cursor !== null) {
    const match = /^demo:(\d+):(\d+)$/.exec(cursor)
    if (!match || Number(match[1]) !== world) return refused("not_found")
    offset = Number(match[2])
  }
  const next = offset + DEMO_DESK_WINDOW
  const isDone = next >= rows.length
  return { status: "ready", data: { items: rows.slice(offset, next), continueCursor: isDone ? null : `demo:${world}:${next}`, isDone } }
}

export function createDemoModerationDesk(store: DemoStore): ModerationDeskCapability {
  const listeners = new Set<() => void>()
  let revision = 0
  let current: DeskWorld | null = null

  const emit = () => {
    revision += 1
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
  const snapshot = () => `${store.getVersion()}:${revision}`
  /** `null` au rendu serveur : la démonstration ne se lit qu'au navigateur. */
  const useSnapshot = () => useSyncExternalStore(subscribe, snapshot, () => null)

  /** Le guichet du jeu en cours ; un autre jeu (remise à zéro) repart des exemples fictifs. */
  const deskWorld = (): DeskWorld => {
    const world = store.getState().createdAt
    if (current === null || current.world !== world) current = seedWorld(world)
    return current
  }

  /** Seule la personne de la session, membre qui agit, ouvre le guichet ; une autre personne : `not_found`. */
  const viewerRefusal = (personId: string): ActionErrorCode | null => {
    const state = store.getState()
    const viewer = state.session.personId
    if (viewer === null) return "not_signed_in"
    if (viewer !== personId) return "not_found"
    const status = statusOf(state, viewer, store.now())
    if (status === null || status === "partie") return "not_member"
    if (status === "suspendue") return "suspended"
    if (status === "en_attente") return "status_insufficient"
    return null
  }

  const openCase = (desk: DeskWorld, reportId: string): DemoCase | null => {
    const row = desk.cases.find((item) => item.view.reportId === reportId)
    return row && !desk.decided.has(reportId) ? row : null
  }
  const openPending = (desk: DeskWorld, key: string): DemoPending | null => {
    const row = desk.pending.find((item) => item.view.key === key)
    return row && !desk.reviewed.has(key) ? row : null
  }
  const teamOf = (desk: DeskWorld, teamId: string | null): DemoTeam | null | undefined =>
    teamId === null ? null : desk.teams.find((team) => team.teamId === teamId)

  /** Le nom publié d'une personne du magasin, membre qui agit ; `null` sinon. */
  const storeLabel = (personId: string): DemoMemberLabel | null => {
    const state = store.getState()
    const profile = state.persons[personId]?.profile
    const status = statusOf(state, personId, store.now())
    if (!profile || status === null || status === "partie" || status === "suspendue") return null
    return { handle: profile.handle, displayName: profile.displayName }
  }

  return {
    demonstration: true,

    useDesk(personId) {
      const version = useSnapshot()
      return useMemo((): Loadable<ModerationDeskView | null> => {
        if (version === null) return LOADING
        const refusal = viewerRefusal(personId)
        if (refusal !== null) return refused(refusal)
        const desk = deskWorld()
        return {
          status: "ready",
          data: {
            role: "network_admin",
            networkWide: true,
            canReviewAppeals: true,
            canManageTeams: true,
            teams: desk.teams.map((team) => ({ teamId: team.teamId, name: team.name, scope: team.scope, isMember: isTeamMember(team, personId) })),
          },
        }
      }, [version, personId])
    },

    useQueue({ personId, zone, surface, teamId, status, cursor }) {
      const version = useSnapshot()
      const zoneKey = deskZoneKey(zone)
      const wanted = status ?? "open"
      return useMemo((): Loadable<DeskPage<DeskCaseView>> => {
        if (version === null) return LOADING
        const refusal = viewerRefusal(personId)
        if (refusal !== null) return refused(refusal)
        const desk = deskWorld()
        if (teamOf(desk, teamId) === undefined) return refused("not_found")
        const filter = deskZoneFromKey(zoneKey)
        const rows = desk.cases
          .filter((row) => !desk.decided.has(row.view.reportId) && row.view.status === wanted)
          .filter((row) => (surface === null || row.view.surface === surface) && (teamId === null || row.teamId === teamId) && isInDeskZone(filter, row.view.country))
          .map((row) => row.view)
        return windowed(rows, cursor, desk.world)
      }, [version, personId, zoneKey, surface, teamId, wanted, cursor])
    },

    useCase({ personId, reportId }) {
      const version = useSnapshot()
      return useMemo((): Loadable<DeskCaseDetailView> => {
        if (version === null) return LOADING
        const refusal = viewerRefusal(personId)
        if (refusal !== null) return refused(refusal)
        const row = openCase(deskWorld(), reportId)
        return row === null ? refused("not_found") : { status: "ready", data: { case: row.view, history: row.history, historyMore: false } }
      }, [version, personId, reportId])
    },

    useCasePreview({ personId, reportId }) {
      const version = useSnapshot()
      return useMemo((): Loadable<DeskPreviewView> => {
        if (version === null) return LOADING
        const refusal = viewerRefusal(personId)
        if (refusal !== null) return refused(refusal)
        const row = openCase(deskWorld(), reportId)
        return row === null ? refused("not_found") : { status: "ready", data: row.preview }
      }, [version, personId, reportId])
    },

    async decide(input) {
      const refusal = viewerRefusal(input.personId)
      if (refusal !== null) return fail(refusal)
      const reasonRefusal = deskReasonRefusal(input.reason)
      if (reasonRefusal !== null) return fail(reasonRefusal)
      const sanctions = deskSanctions(input, store.now())
      if (!sanctions.ok) return fail(sanctions.code)
      const desk = deskWorld()
      const row = openCase(desk, input.reportId)
      if (row === null) return fail("not_found")
      if (row.view.party !== null) return fail("moderation_desk_party")
      // Comme le moteur : sans personne visée, seul le retrait du contenu s'applique.
      if (!row.view.hasAuthor && sanctions.value.some((sanction) => sanction.kind !== "removal")) return fail("moderation_desk_measure_refused")
      desk.decided.set(input.reportId, input.decision)
      emit()
      return { ok: true, value: { status: input.decision } }
    },

    usePending({ personId, zone, surface, teamId, cursor }) {
      const version = useSnapshot()
      const zoneKey = deskZoneKey(zone)
      return useMemo((): Loadable<DeskPage<DeskPendingView>> => {
        if (version === null) return LOADING
        const refusal = viewerRefusal(personId)
        if (refusal !== null) return refused(refusal)
        const desk = deskWorld()
        if (teamOf(desk, teamId) === undefined) return refused("not_found")
        const filter = deskZoneFromKey(zoneKey)
        const rows = desk.pending
          .filter((row) => !desk.reviewed.has(row.view.key))
          .filter((row) => (surface === null || row.view.targetKind === surface) && (teamId === null || row.teamId === teamId) && isInDeskZone(filter, row.view.country))
          .map((row) => row.view)
        return windowed(rows, cursor, desk.world)
      }, [version, personId, zoneKey, surface, teamId, cursor])
    },

    usePendingPreview({ personId, targetKind, targetId }) {
      const version = useSnapshot()
      return useMemo((): Loadable<DeskPreviewView> => {
        if (version === null) return LOADING
        const refusal = viewerRefusal(personId)
        if (refusal !== null) return refused(refusal)
        const row = openPending(deskWorld(), `${targetKind}:${targetId}`)
        return row === null ? refused("not_found") : { status: "ready", data: row.preview }
      }, [version, personId, targetKind, targetId])
    },

    async reviewPending(input) {
      const refusal = viewerRefusal(input.personId)
      if (refusal !== null) return fail(refusal)
      const reasonRefusal = deskReasonRefusal(input.reason)
      if (reasonRefusal !== null) return fail(reasonRefusal)
      const desk = deskWorld()
      const key = `${input.targetKind}:${input.targetId}`
      const row = openPending(desk, key)
      if (row === null) return fail("not_found")
      if (row.view.party !== null) return fail("moderation_desk_party")
      desk.reviewed.add(key)
      emit()
      return { ok: true, value: null }
    },

    useAppeals({ personId, zone, surface, cursor }) {
      const version = useSnapshot()
      const zoneKey = deskZoneKey(zone)
      return useMemo((): Loadable<DeskPage<DeskAppealView>> => {
        if (version === null) return LOADING
        const refusal = viewerRefusal(personId)
        if (refusal !== null) return refused(refusal)
        const desk = deskWorld()
        const filter = deskZoneFromKey(zoneKey)
        const rows = desk.appeals.filter((row) => !desk.settled.has(row.appealId) && (surface === null || row.surface === surface) && isInDeskZone(filter, row.country))
        return windowed(rows, cursor, desk.world)
      }, [version, personId, zoneKey, surface, cursor])
    },

    async decideAppeal(input) {
      const refusal = viewerRefusal(input.personId)
      if (refusal !== null) return fail(refusal)
      const reasonRefusal = deskReasonRefusal(input.reason)
      if (reasonRefusal !== null) return fail(reasonRefusal)
      const desk = deskWorld()
      const row = desk.appeals.find((item) => item.appealId === input.appealId)
      if (!row || desk.settled.has(row.appealId)) return fail("not_found")
      if (row.party !== null) return fail("moderation_desk_party")
      desk.settled.add(row.appealId)
      emit()
      return { ok: true, value: null }
    },

    useRoster({ personId, teamId }) {
      const version = useSnapshot()
      return useMemo((): Loadable<DeskRosterView> => {
        if (version === null) return LOADING
        const refusal = viewerRefusal(personId)
        if (refusal !== null) return refused(refusal)
        const team = teamOf(deskWorld(), teamId)
        if (!team) return refused("not_found")
        const members: DeskTeamMemberView[] = []
        if (team.includesViewer && !team.removed.has(personId) && !team.members.has(personId)) {
          const label = storeLabel(personId)
          members.push({ personId, handle: label?.handle ?? null, displayName: label?.displayName ?? null, inNetwork: label !== null, isMe: true })
        }
        for (const [memberId, label] of team.members) {
          if (team.removed.has(memberId)) continue
          members.push({ personId: memberId, handle: label.handle, displayName: label.displayName, inNetwork: true, isMe: memberId === personId })
        }
        return { status: "ready", data: { members, more: false } }
      }, [version, personId, teamId])
    },

    async findMember({ personId, handle }) {
      const refusal = viewerRefusal(personId)
      if (refusal !== null) return fail(refusal)
      const wanted = handle.trim().replace(/^@/, "").toLowerCase()
      if (wanted.length === 0) return fail("moderation_desk_handle_required")
      const person = Object.values(store.getState().persons).find((candidate) => candidate.profile?.handle === wanted)
      const label = person ? storeLabel(person.id) : null
      return { ok: true, value: person && label ? { personId: person.id, handle: label.handle, displayName: label.displayName } : null }
    },

    async createTeam(input) {
      const refusal = viewerRefusal(input.personId)
      if (refusal !== null) return fail(refusal)
      const nameRefusal = deskTeamNameRefusal(input.name)
      if (nameRefusal !== null) return fail(nameRefusal)
      const reasonRefusal = deskReasonRefusal(input.reason)
      if (reasonRefusal !== null) return fail(reasonRefusal)
      const desk = deskWorld()
      desk.teamSequence += 1
      const teamId = `demo-equipe-${desk.teamSequence}`
      desk.teams.push({ teamId, name: input.name.trim(), scope: input.scope, includesViewer: false, members: new Map(), removed: new Set() })
      emit()
      return { ok: true, value: { teamId } }
    },

    async setTeamMember(input) {
      const refusal = viewerRefusal(input.personId)
      if (refusal !== null) return fail(refusal)
      const reasonRefusal = deskReasonRefusal(input.reason)
      if (reasonRefusal !== null) return fail(reasonRefusal)
      const team = teamOf(deskWorld(), input.teamId)
      if (!team) return fail("not_found")
      if (!input.active) {
        team.members.delete(input.memberPersonId)
        team.removed.add(input.memberPersonId)
        emit()
        return { ok: true, value: null }
      }
      const label = input.memberPersonId === FICTIVE_MODERATOR.personId ? FICTIVE_MODERATOR.label : storeLabel(input.memberPersonId)
      if (label === null) return fail("not_found")
      team.removed.delete(input.memberPersonId)
      team.members.set(input.memberPersonId, label)
      emit()
      return { ok: true, value: null }
    },
  }
}
