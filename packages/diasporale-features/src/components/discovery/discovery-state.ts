/**
 * L'état de la découverte verticale (DG-017) — un réducteur PUR, sans React ni
 * fournisseur, testé seul.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MÊME SOURCE QUE LA LISTE, CURSEURS STABLES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La découverte lit les mêmes pages que le fil en liste (`useFeedPage`, curseur
 * rendu par le serveur, mêmes gardes) : rien n'y est servi qui ne le serait pas
 * dans la liste. Elle diffère sur un seul point, voulu (plan global G6, point 1) :
 * ses curseurs ne bougent pas sous le doigt.
 *
 * Quand une page amont reçoit une publication en tête, sa dernière ligne glisse
 * hors d'elle. La liste réaligne alors la page suivante et abandonne les plus
 * profondes (`rebasePagesAfter`) : la publication regardée pourrait disparaître.
 * Ici, on INSÈRE un « pont » — une page de plus, au curseur que le serveur vient
 * de rendre — entre la page qui a reculé et la suivante, sans toucher aux pages
 * déjà montées ; un pont devenu inutile (la page amont rejoint de nouveau la
 * suivante) est ramassé. Les doublons entre pages se fondent (premier vu).
 *
 * Les publications ARRIVÉES en tête après l'ouverture (avant la première
 * publication déjà admise) ne sont pas injectées : elles attendent le geste
 * « Actualiser ». Une publication retirée de la lecture disparaît dès que les
 * pages ont répondu ; pendant une transition (pont ou page en chargement), la
 * séquence garde sa place pour ne rien faire sauter — jamais quand la première
 * page n'a plus de données (perte de l'adhésion, autre lecteur : tout tombe).
 */
import { feedCursorKey } from "@antsia/social-features/features/reseau-personnel/reseau-feed-pages"

import { ACCESS_REFUSAL_CODES, type ActionErrorCode } from "../../data/errors"
import type { FeedCursorView, PostView } from "../../data/types"

export interface DiscoveryPageReport {
  /** `undefined` : aucune donnée (chargement, refus ou panne sans données). */
  readonly items: readonly PostView[] | undefined
  readonly nextCursor: FeedCursorView | null
  readonly lacunar: boolean
  readonly isLoading: boolean
  readonly error: ActionErrorCode | null
}

export interface DiscoveryState {
  /** Les pages montées, dans l'ordre du fil ; la première a le curseur nul. */
  readonly cursors: readonly (FeedCursorView | null)[]
  readonly reports: Readonly<Record<string, DiscoveryPageReport>>
  /** La séquence admise, dans l'ordre chronologique du fil (aucun classement). */
  readonly items: readonly PostView[]
  /** Les arrivées en tête, en attente du geste « Actualiser ». */
  readonly pending: readonly PostView[]
  readonly known: ReadonlySet<string>
  /** `null` : la diapositive d'état (fin, chargement, erreur) ou rien encore. */
  readonly activeId: string | null
  /** Indice actif ; `items.length` désigne la diapositive d'état. */
  readonly activeIndex: number
  readonly exhausted: boolean
}

/** Ce que la mémoire de position retient pour reprendre au même endroit. */
export interface DiscoverySnapshot {
  readonly cursors: readonly (FeedCursorView | null)[]
  readonly known: readonly string[]
  readonly activeId: string | null
  readonly activeIndex: number
}

export type DiscoveryAction =
  | { readonly type: "report"; readonly key: string; readonly report: DiscoveryPageReport }
  | { readonly type: "append" }
  | { readonly type: "refresh" }
  | { readonly type: "activate"; readonly index: number }

export type DiscoveryTail = "loading" | "error" | "more" | "end" | "empty"

export const pageKey = (cursor: FeedCursorView | null): string => feedCursorKey(cursor)

export function sameCursor(left: FeedCursorView | null | undefined, right: FeedCursorView | null | undefined): boolean {
  if (left === null || left === undefined || right === null || right === undefined) return left === right
  return left.publishedAt === right.publishedAt && left.postId === right.postId
}

/** `left` vient-il AVANT `right` dans le fil ? Un même instant, autre publication : on suppose que oui (prudence). */
function isNewer(left: FeedCursorView, right: FeedCursorView): boolean {
  return left.publishedAt > right.publishedAt || (left.publishedAt === right.publishedAt && left.postId !== right.postId)
}

/** La frontière `left` atteint-elle (ou dépasse-t-elle) le début de la page `right` ? */
function reaches(left: FeedCursorView, right: FeedCursorView): boolean {
  return left.publishedAt < right.publishedAt || sameCursor(left, right)
}

export function isSettled(report: DiscoveryPageReport | undefined): report is DiscoveryPageReport & { readonly items: readonly PostView[] } {
  return report !== undefined && report.items !== undefined && !report.isLoading && report.error === null
}

function isPending(report: DiscoveryPageReport | undefined): boolean {
  return report === undefined || report.isLoading || (report.items === undefined && report.error === null)
}

function sameReport(left: DiscoveryPageReport, right: DiscoveryPageReport): boolean {
  return left.items === right.items && left.isLoading === right.isLoading && left.error === right.error
    && left.lacunar === right.lacunar && sameCursor(left.nextCursor, right.nextCursor)
}

export function initialDiscoveryState(snapshot?: DiscoverySnapshot | null): DiscoveryState {
  const cursors = snapshot && snapshot.cursors.length > 0 && snapshot.cursors[0] === null ? snapshot.cursors : [null]
  return {
    cursors,
    reports: {},
    items: [],
    pending: [],
    known: new Set(snapshot?.known ?? []),
    activeId: snapshot?.activeId ?? null,
    activeIndex: Math.max(0, snapshot?.activeIndex ?? 0),
    exhausted: false,
  }
}

export function snapshotOf(state: DiscoveryState): DiscoverySnapshot {
  return { cursors: state.cursors, known: [...state.known], activeId: state.activeId, activeIndex: state.activeIndex }
}

/**
 * Ponts et ramassage. Les curseurs ne viennent que du serveur (`nextCursor`) ;
 * aucune page montée n'est jamais réalignée.
 */
export function reconcileChain(
  cursors: readonly (FeedCursorView | null)[],
  reports: Readonly<Record<string, DiscoveryPageReport>>,
): { readonly cursors: readonly (FeedCursorView | null)[]; readonly exhausted: boolean } {
  let next = [...cursors]

  // 1. Une page dont la frontière a reculé laisse un trou avant la suivante : un pont le comble.
  for (let index = 0; index < next.length - 1; index += 1) {
    const report = reports[pageKey(next[index] ?? null)]
    if (!isSettled(report)) continue
    const frontier = report.nextCursor
    if (frontier === null) {
      // La page contient désormais toute la suite : les pages plus profondes ne lisent plus rien.
      next = next.slice(0, index + 1)
      break
    }
    const following = next[index + 1]
    if (following === null || following === undefined) continue
    if (isNewer(frontier, following) && !next.some((cursor) => sameCursor(cursor, frontier))) {
      next.splice(index + 1, 0, frontier)
      index += 1
    }
  }

  // 2. Une page intermédiaire que sa voisine amont rejoint déjà ne sert plus.
  for (let index = 1; index < next.length - 1;) {
    const before = reports[pageKey(next[index - 1] ?? null)]
    const after = next[index + 1]
    if (isSettled(before) && before.nextCursor !== null && after && reaches(before.nextCursor, after)) {
      next.splice(index, 1)
      continue
    }
    index += 1
  }

  const tail = reports[pageKey(next[next.length - 1] ?? null)]
  const unchanged = next.length === cursors.length && next.every((cursor, index) => sameCursor(cursor, cursors[index]))
  return { cursors: unchanged ? cursors : next, exhausted: isSettled(tail) && tail.nextCursor === null }
}

function dedupe(posts: readonly PostView[]): PostView[] {
  const seen = new Set<string>()
  const out: PostView[] = []
  for (const post of posts) {
    if (seen.has(post.id)) continue
    seen.add(post.id)
    out.push(post)
  }
  return out
}

/** Réinsère, à leur place, les publications précédentes absentes le temps d'une transition. */
function keepPlaces(previous: readonly PostView[], admitted: readonly PostView[], excluded: ReadonlySet<string>): readonly PostView[] {
  if (previous.length === 0) return admitted
  const output = [...admitted]
  let changed = false
  let anchor = -1
  for (const post of previous) {
    const at = output.findIndex((candidate) => candidate.id === post.id)
    if (at >= 0) {
      anchor = at
      continue
    }
    if (excluded.has(post.id)) continue
    output.splice(anchor + 1, 0, post)
    anchor += 1
    changed = true
  }
  return changed ? output : admitted
}

/** Séquence admise et arrivées en attente, à partir des pages montées. */
export function admitSequence(args: {
  readonly previous: readonly PostView[]
  readonly current: readonly PostView[]
  readonly known: ReadonlySet<string>
  /** Une page montée est-elle en transition (chargement, pont pas encore répondu) ? */
  readonly transition: boolean
}): { readonly items: readonly PostView[]; readonly pending: readonly PostView[] } {
  const { current, known, transition } = args
  const firstKnown = known.size === 0 ? 0 : current.findIndex((post) => known.has(post.id))
  let admitted: readonly PostView[]
  let pending: readonly PostView[]
  if (firstKnown >= 0) {
    pending = current.slice(0, firstKnown)
    admitted = current.slice(firstKnown)
  } else if (transition) {
    // Rien de connu n'a encore répondu : on attend, sans rien injecter de neuf.
    pending = current
    admitted = []
  } else {
    // Plus aucune publication connue n'est lisible : on repart de ce que le fil rend.
    pending = []
    admitted = current
  }
  if (transition) admitted = keepPlaces(args.previous, admitted, new Set(pending.map((post) => post.id)))
  return { items: admitted, pending }
}

function withIds(known: ReadonlySet<string>, posts: readonly PostView[]): ReadonlySet<string> {
  if (posts.every((post) => known.has(post.id))) return known
  const next = new Set(known)
  for (const post of posts) next.add(post.id)
  return next
}

function resolveActive(items: readonly PostView[], activeId: string | null, activeIndex: number, transition: boolean) {
  if (activeId !== null) {
    const found = items.findIndex((post) => post.id === activeId)
    if (found >= 0) return { activeId, activeIndex: found }
    // L'élément actif peut revenir avec la page qui charge : on l'attend.
    if (transition) return { activeId, activeIndex: Math.min(Math.max(activeIndex, 0), items.length) }
  }
  const index = Math.min(Math.max(activeIndex, 0), items.length)
  return { activeId: items[index]?.id ?? null, activeIndex: index }
}

/** Recalcule la séquence, les connus et l'actif depuis les pages montées. */
function derive(state: DiscoveryState): DiscoveryState {
  const pages = state.cursors.map((cursor) => state.reports[pageKey(cursor)])
  const head = pages[0]
  // Sans données en tête (perte de lecture, autre lecteur, rechargement complet), rien n'est gardé.
  const transition = head?.items !== undefined && pages.some(isPending)
  const current = dedupe(pages.flatMap((report) => report?.items ?? []))
  const { items, pending } = admitSequence({ previous: state.items, current, known: state.known, transition })
  const known = withIds(state.known, items)
  return { ...state, items, pending, known, ...resolveActive(items, state.activeId, state.activeIndex, transition) }
}

export function discoveryReducer(state: DiscoveryState, action: DiscoveryAction): DiscoveryState {
  switch (action.type) {
    case "report": {
      if (!state.cursors.some((cursor) => pageKey(cursor) === action.key)) return state
      const previous = state.reports[action.key]
      if (previous !== undefined && sameReport(previous, action.report)) return state
      const reports = { ...state.reports, [action.key]: action.report }
      const chain = reconcileChain(state.cursors, reports)
      const mounted = new Set(chain.cursors.map(pageKey))
      const kept: Record<string, DiscoveryPageReport> = {}
      for (const [key, report] of Object.entries(reports)) if (mounted.has(key)) kept[key] = report
      return derive({ ...state, cursors: chain.cursors, exhausted: chain.exhausted, reports: kept })
    }
    case "append": {
      const tail = state.reports[pageKey(state.cursors[state.cursors.length - 1] ?? null)]
      if (!isSettled(tail) || tail.nextCursor === null) return state
      const frontier = tail.nextCursor
      if (state.cursors.some((cursor) => sameCursor(cursor, frontier))) return state
      return derive({ ...state, cursors: [...state.cursors, frontier], exhausted: false })
    }
    case "refresh": {
      if (state.pending.length === 0) return state
      const known = withIds(state.known, state.pending)
      const next = derive({ ...state, known })
      return { ...next, activeIndex: 0, activeId: next.items[0]?.id ?? null }
    }
    case "activate": {
      const index = Math.min(Math.max(action.index, 0), state.items.length)
      const activeId = state.items[index]?.id ?? null
      if (index === state.activeIndex && activeId === state.activeId) return state
      return { ...state, activeIndex: index, activeId }
    }
  }
}

/** Ce que dit la diapositive d'état, après la dernière publication. */
export function discoveryTail(state: DiscoveryState): DiscoveryTail {
  const tail = state.reports[pageKey(state.cursors[state.cursors.length - 1] ?? null)]
  if (tail !== undefined && tail.error !== null && !tail.isLoading) return "error"
  if (isPending(tail)) return "loading"
  if (state.exhausted) return state.items.length === 0 ? "empty" : "end"
  return "more"
}

/**
 * La page suivante se demande seule près de la fin, sauf derrière une fenêtre
 * vide : une suite de fenêtres lacunaires ne s'enchaîne qu'au geste.
 */
export function canAutoAppend(state: DiscoveryState): boolean {
  const tail = state.reports[pageKey(state.cursors[state.cursors.length - 1] ?? null)]
  if (!isSettled(tail) || tail.nextCursor === null || tail.items.length === 0) return false
  const frontier = tail.nextCursor
  return !state.cursors.some((cursor) => sameCursor(cursor, frontier))
}

/** Les pages montées en panne (avec ou sans données), à reprendre. */
export function failedPages(state: DiscoveryState): readonly string[] {
  return state.cursors.map(pageKey).filter((key) => {
    const report = state.reports[key]
    return report !== undefined && report.error !== null && !report.isLoading
  })
}

/**
 * Le refus d'accès d'une page en échec (suspension, adhésion…), ou `null` : un
 * refus se dit tel quel, sans reprise ; une panne garde « Réessayer ».
 */
export function accessRefusal(state: DiscoveryState): ActionErrorCode | null {
  for (const cursor of state.cursors) {
    const report = state.reports[pageKey(cursor)]
    if (report !== undefined && !report.isLoading && report.error !== null && ACCESS_REFUSAL_CODES.has(report.error)) return report.error
  }
  return null
}

export function hasLacunarPage(state: DiscoveryState): boolean {
  return state.cursors.some((cursor) => state.reports[pageKey(cursor)]?.lacunar === true)
}
