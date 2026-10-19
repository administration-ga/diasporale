/** Choix privés de démonstration : migration v7, droits et pages bornées. */
import { isProfileDiscoverable } from "@antsia/social-domain/content"
import { deriveMembershipStatus, hasCapability, isConsentActive, isListedInDirectoryFor } from "@diasporale/domain"

import type { ActionErrorCode } from "../data/errors"
import type {
  ContentPreferenceAuthor,
  ContentPreferenceItem,
  ContentPreferenceKind,
  ContentPreferencesQuery,
  ContentPreferencesRequest,
} from "../data/port"
import { canRead, statusOf } from "./selectors"
import type { DemoMuteChoice, DemoState } from "./state"

const PAGE_SIZE = 20
const CURSOR_TAG = "demo-content-preferences"
const CURSOR_VERSION = 1

/**
 * Ajout seulement : ni version globale, ni marque, ni paire ne sont effacées.
 * La séquence, et non l'horloge, distingue deux choix successifs identiques.
 */
export function withContentPreferenceIdentities(state: DemoState): DemoState {
  let sequence = state.sequence
  let changed = false
  const reserved = new Set([
    ...state.marks.flatMap((mark) => mark.choiceId ? [mark.choiceId] : []),
    ...(state.muteChoices ?? []).map((choice) => choice.choiceId),
  ])
  const used = new Set<string>()
  const allocate = () => {
    let choiceId: string
    do { choiceId = `content-choice-${sequence++}` } while (reserved.has(choiceId))
    reserved.add(choiceId)
    return choiceId
  }
  const marks = state.marks.map((mark) => {
    if (mark.kind !== "hidden") return mark
    if (mark.choiceId && !used.has(mark.choiceId)) {
      used.add(mark.choiceId)
      return mark
    }
    const choiceId = allocate()
    used.add(choiceId)
    changed = true
    return { ...mark, choiceId }
  })
  const muteChoices: DemoMuteChoice[] = state.mutes.map(([personId, targetId]) => {
    const existing = state.muteChoices?.find((choice) => choice.personId === personId && choice.targetId === targetId && !used.has(choice.choiceId))
    if (existing?.choiceId) {
      used.add(existing.choiceId)
      return existing
    }
    const choiceId = allocate()
    used.add(choiceId)
    changed = true
    return { personId, targetId, choiceId, createdAt: 0 }
  })
  if ((state.muteChoices?.length ?? 0) !== muteChoices.length) changed = true
  return changed ? { ...state, marks, muteChoices, sequence } : state
}

/** L'identité demandée ne remplace jamais celle de la session courante. */
export function contentPreferencesRefusal(state: DemoState, personId: string, now: number): ActionErrorCode | null {
  const viewerId = state.session.personId
  if (!viewerId || !state.persons[viewerId]) return "not_signed_in"
  if (viewerId !== personId) return "not_found"
  const membership = state.memberships[viewerId]
  if (!membership) return "not_member"
  const status = statusOf(state, viewerId, now)
  if (status === null || !hasCapability(status, "read_network", { suspensionReadAccess: membership.grounds.suspension?.readAccess ?? "none" })) {
    return status === "suspendue" ? "suspended" : "not_member"
  }
  return null
}

function blockedBetween(state: DemoState, viewerId: string, personId: string): boolean {
  return viewerId !== personId && state.blocks.some((block) =>
    (block.byId === viewerId && block.targetId === personId) || (block.byId === personId && block.targetId === viewerId),
  )
}

/** Même règle d'annuaire opt-in que les suggestions ; aucun profil n'est déduit d'un choix privé. */
function personAuthor(state: DemoState, viewerId: string, personId: string, now: number): ContentPreferenceAuthor | null {
  const person = state.persons[personId]
  const membership = state.memberships[personId]
  const viewerMembership = state.memberships[viewerId]
  const viewerStatus = statusOf(state, viewerId, now)
  if (!person?.profile || !isProfileDiscoverable(person) || !membership || !viewerMembership || !viewerStatus) return null
  if (!hasCapability(viewerStatus, "view_directory")) return null
  const listed = isListedInDirectoryFor(
    {
      status: deriveMembershipStatus(membership.grounds, now),
      visibility: membership.directoryVisibility,
      consentActive: isConsentActive(state.consents.filter((record) => record.personId === personId), "directory"),
      country: membership.facet.countryOfResidence,
    },
    {
      status: viewerStatus,
      country: viewerMembership.facet.countryOfResidence,
      isSelf: viewerId === personId,
      blockedWithTarget: blockedBetween(state, viewerId, personId),
    },
  )
  return listed ? { kind: "person", displayName: person.profile.displayName, handle: person.profile.handle, avatarUrl: null } : null
}

interface ChoiceRow {
  readonly choiceId: string
  readonly at: number
  readonly postId: string | null
  readonly targetId: string | null
}

function hiddenItem(state: DemoState, choice: ChoiceRow, viewerId: string, now: number): ContentPreferenceItem {
  const post = state.posts.find((candidate) => candidate.id === choice.postId)
  // Le choix que l'on veut annuler n'est pas un refus de lecture : ni le
  // masquage ni la sourdine ne participent à cette garde.
  let readable = post && canRead(state, post, viewerId, now)
    && (post.author.kind !== "person" || !blockedBetween(state, viewerId, post.author.id))
  let author: ContentPreferenceAuthor | null = null
  if (readable && post) {
    if (post.author.kind === "person") author = personAuthor(state, viewerId, post.author.id, now)
    else {
      const page = state.pages[post.author.id]
      // Une page de démonstration n'a pas d'état de retrait ; son absence ferme
      // aussi le corps de la publication, sans projeter tous les posts du mur.
      if (!page) readable = false
      else author = { kind: "page", displayName: page.name, handle: page.handle, avatarUrl: null }
    }
  }
  return { choiceId: choice.choiceId, at: choice.at, postId: readable && post ? post.id : null, body: readable && post ? post.body : null, author }
}

/** Fenêtre sur les choix, puis projection gardée : les lignes neutres restent restaurables. */
export function contentPreferencesPage(state: DemoState, args: ContentPreferencesRequest, now: number): ContentPreferencesQuery {
  const refusal = contentPreferencesRefusal(state, args.personId, now)
  if (refusal) return { status: "error", code: refusal }
  if (args.kind !== "hiddenPosts" && args.kind !== "mutedAuthors") return { status: "error", code: "unknown" }
  let boundary: { at: number; choiceId: string } | null = null
  if (args.cursor !== null) {
    try {
      if (args.cursor.length > 4096) return { status: "error", code: "unknown" }
      const cursor: unknown = JSON.parse(args.cursor)
      if (!Array.isArray(cursor) || cursor.length !== 6 || cursor[0] !== CURSOR_TAG || cursor[1] !== CURSOR_VERSION
        || cursor[2] !== args.personId || cursor[3] !== args.kind || typeof cursor[4] !== "number" || !Number.isFinite(cursor[4])
        || typeof cursor[5] !== "string" || !cursor[5]) return { status: "error", code: "unknown" }
      boundary = { at: cursor[4], choiceId: cursor[5] }
    } catch { return { status: "error", code: "unknown" } }
  }
  const choices: ChoiceRow[] = args.kind === "hiddenPosts"
    ? state.marks.flatMap((mark) => mark.kind === "hidden" && mark.personId === args.personId && mark.choiceId
      ? [{ choiceId: mark.choiceId, at: mark.createdAt, postId: mark.postId, targetId: null }]
      : [])
    : (state.muteChoices ?? []).filter((choice) => choice.personId === args.personId).map((choice) => ({
      choiceId: choice.choiceId,
      at: choice.createdAt,
      postId: null,
      targetId: choice.targetId,
    }))
  const remaining = choices
    .sort((left, right) => right.at - left.at || (left.choiceId === right.choiceId ? 0 : left.choiceId < right.choiceId ? 1 : -1))
    .filter((choice) => boundary === null || choice.at < boundary.at || (choice.at === boundary.at && choice.choiceId < boundary.choiceId))
  const window = remaining.slice(0, PAGE_SIZE)
  const items = window.map((choice): ContentPreferenceItem => args.kind === "hiddenPosts"
    ? hiddenItem(state, choice, args.personId, now)
    : { choiceId: choice.choiceId, at: choice.at, postId: null, body: null, author: choice.targetId === null ? null : personAuthor(state, args.personId, choice.targetId, now) })
  const last = window.at(-1)
  const isDone = remaining.length <= PAGE_SIZE
  return {
    status: "ready",
    data: {
      items,
      isDone,
      continueCursor: !isDone && last ? JSON.stringify([CURSOR_TAG, CURSOR_VERSION, args.personId, args.kind, last.at, last.choiceId]) : null,
    },
  }
}

/** Cherche une identité exacte ; un identifiant ancien ou étranger ne désigne aucun choix. */
export function hasContentPreference(state: DemoState, personId: string, kind: ContentPreferenceKind, choiceId: string): boolean {
  if (kind === "hiddenPosts") return state.marks.some((mark) => mark.personId === personId && mark.kind === "hidden" && mark.choiceId === choiceId)
  if (kind === "mutedAuthors") return (state.muteChoices ?? []).some((choice) => choice.personId === personId && choice.choiceId === choiceId
    && state.mutes.some(([by, target]) => by === personId && target === choice.targetId))
  return false
}
