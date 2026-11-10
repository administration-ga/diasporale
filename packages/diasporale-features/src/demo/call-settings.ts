/**
 * Démonstration de la capacité « réglages iCom » (IM-02). PROPRIÉTAIRE : ce lot.
 *
 * Les mêmes règles que le moteur (`calls/preferences`) : des défauts lus sans rien
 * écrire, une mise à jour qui ne touche que les champs fournis, un « Ne pas
 * déranger » dans le futur et à sept jours au plus, une échéance passée lue comme
 * absente. Les gestes portent sur la personne de la session, jamais sur une autre.
 *
 * Réglages FICTIFS, gardés le temps de la page pour chaque compte de démonstration :
 * aucun appel n'existe en démonstration, rien n'est transmis.
 */
import { useSyncExternalStore } from "react"

import {
  DEFAULT_CALL_SETTINGS,
  dndRefusal,
  type CallPreferencesPatch,
  type CallSettingsCapability,
  type CallSettingsView,
  type OutsideRelationsCalls,
} from "../data/call-settings-port"
import type { ActionErrorCode } from "../data/errors"
import type { ActionResult } from "../data/port"
import type { Loadable } from "../data/types"
import type { DemoStore } from "./store"

interface DemoCallPreferences {
  readonly outsideRelationsCalls: OutsideRelationsCalls
  readonly dnd: { readonly until: number; readonly startedAt: number } | null
  readonly voicemailEnabled: boolean
  readonly sharePresence: boolean
  readonly callWaiting: boolean
}

const LOADING = { status: "loading" } as const

const DEFAULTS: DemoCallPreferences = {
  outsideRelationsCalls: DEFAULT_CALL_SETTINGS.outsideRelationsCalls,
  dnd: null,
  voicemailEnabled: DEFAULT_CALL_SETTINGS.voicemailEnabled,
  sharePresence: DEFAULT_CALL_SETTINGS.sharePresence,
  callWaiting: DEFAULT_CALL_SETTINGS.callWaiting,
}

function fail<T>(code: ActionErrorCode): ActionResult<T> {
  return { ok: false, code }
}

/** Seuls les champs fournis changent, comme `update` du moteur. */
function patched(current: DemoCallPreferences, patch: CallPreferencesPatch): DemoCallPreferences {
  return {
    ...current,
    ...(patch.outsideRelationsCalls !== undefined ? { outsideRelationsCalls: patch.outsideRelationsCalls } : {}),
    ...(patch.voicemailEnabled !== undefined ? { voicemailEnabled: patch.voicemailEnabled } : {}),
    ...(patch.sharePresence !== undefined ? { sharePresence: patch.sharePresence } : {}),
    ...(patch.callWaiting !== undefined ? { callWaiting: patch.callWaiting } : {}),
  }
}

/** La vue d'une ligne à l'instant `now` : un silence échu est absent, jamais nettoyé. */
function viewOf(row: DemoCallPreferences, now: number): CallSettingsView {
  return {
    outsideRelationsCalls: row.outsideRelationsCalls,
    dndUntil: row.dnd !== null && row.dnd.until > now ? row.dnd.until : null,
    voicemailEnabled: row.voicemailEnabled,
    sharePresence: row.sharePresence,
    callWaiting: row.callWaiting,
  }
}

export function createDemoCallSettings(store: DemoStore): CallSettingsCapability {
  const rows = new Map<string, DemoCallPreferences>()
  const listeners = new Set<() => void>()
  let version = 0
  /** Une vue par personne, gardée tant que rien n'a changé (instantané stable pour React). */
  const snapshots = new Map<string, { readonly stamp: string; readonly value: Loadable<CallSettingsView> }>()

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    const unsubscribe = store.subscribe(listener)
    return () => {
      listeners.delete(listener)
      unsubscribe()
    }
  }

  function commit(personId: string, row: DemoCallPreferences): void {
    rows.set(personId, row)
    version += 1
    for (const listener of listeners) listener()
  }

  /** Le geste ne vaut que pour la personne de la session. */
  function refusal(personId: string): ActionErrorCode | null {
    const viewerId = store.getState().session.personId
    if (!viewerId) return "not_signed_in"
    return viewerId === personId ? null : "not_found"
  }

  function snapshot(personId: string): Loadable<CallSettingsView> {
    const stamp = `${store.getVersion()}:${version}`
    const known = snapshots.get(personId)
    if (known?.stamp === stamp) return known.value
    const code = refusal(personId)
    const value: Loadable<CallSettingsView> = code !== null
      ? { status: "error", code }
      : { status: "ready", data: viewOf(rows.get(personId) ?? DEFAULTS, store.now()) }
    snapshots.set(personId, { stamp, value })
    return value
  }

  return {
    useMine(personId: string): Loadable<CallSettingsView> {
      // Rendu serveur : « en chargement », comme le reste de la démonstration (aucun écart d'hydratation).
      return useSyncExternalStore(subscribe, () => snapshot(personId), () => LOADING)
    },

    async update(personId, patch) {
      const code = refusal(personId)
      if (code !== null) return fail(code)
      commit(personId, patched(rows.get(personId) ?? DEFAULTS, patch))
      return { ok: true, value: null }
    },

    async setDoNotDisturb(personId, until) {
      const code = refusal(personId)
      if (code !== null) return fail(code)
      const current = rows.get(personId) ?? DEFAULTS
      if (until === null) {
        commit(personId, { ...current, dnd: null })
        return { ok: true, value: { dndUntil: null } }
      }
      const now = store.now()
      const refused = dndRefusal(until, now)
      if (refused !== null) return fail(refused)
      commit(personId, { ...current, dnd: { until, startedAt: now } })
      return { ok: true, value: { dndUntil: until } }
    },
  }
}
