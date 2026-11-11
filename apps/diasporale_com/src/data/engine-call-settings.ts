"use client"

/**
 * Adaptateur moteur de la capacité « réglages iCom » (IM-02). PROPRIÉTAIRE : ce lot.
 *
 * Fonctions du moteur EXISTANTES, toutes sur soi (`personQuery` / `personMutation`,
 * sans réseau : les réglages valent dans tous les réseaux de la personne, ANTSIA
 * compris) — `calls/preferences` :
 *   · `getMine({ now })` : mes réglages ou les défauts, un silence échu à `now` rendu absent ;
 *   · `update(…)` : un sous-ensemble de réglages, chaque champ omis inchangé (IC-04 :
 *     `readReceipts` compris, facultatif) ;
 *   · `setDnd({ until })` : pose ou lève « Ne pas déranger », refus à code de règle
 *     (`CALL_DND_PAST`, `CALL_DND_TOO_LONG`).
 * IC-04 (antsia#138) : `getMine` rend aussi `readReceipts` (accusés de lecture réciproques,
 * actifs par défaut) et `outsideRelationsCalls` vaut `silent` pour qui ne l'a jamais réglé.
 * Aucun changement du moteur. Chaque écriture relit d'abord la personne de la session :
 * un changement de personne ferme le geste (`not_found`) avant toute écriture.
 */
import { useStableConvexAuth } from "@antsia/api/hooks"
import { engineErrorRule } from "@antsia/social-contracts/errors"
import { api } from "@convex/_generated/api"
import type {
  ActionErrorCode,
  ActionResult,
  CallPreferencesPatch,
  CallSettingsCapability,
  CallSettingsView,
  Loadable,
} from "@diasporale/features/data"
import type { FunctionReturnType } from "convex/server"
import { useState } from "react"

import { engineActionErrorCode } from "./engine-errors"
import { type EngineSourceDeps, failed, LOADING, ready, Refusal, useLoaded } from "./engine-kit"

type PreferencesRow = FunctionReturnType<typeof api.modules.calls.preferences.getMine>

/**
 * Le pas de l'instant passé à la lecture : une minute, comme la rangée « Mon statut » du
 * moteur. Le moteur ne lit pas l'horloge dans une requête ; un instant arrondi et figé au
 * montage garde le même abonnement d'un rendu à l'autre.
 */
const PREFS_NOW_STEP_MS = 60_000

/** Les refus des réglages iCom, en codes FERMÉS ; le reste suit la table commune du moteur. */
export function callSettingsErrorCode(error: unknown): ActionErrorCode {
  if (error instanceof Refusal) return error.code
  const rule = engineErrorRule(error)?.rule
  if (rule === "CALL_DND_PAST") return "call_dnd_past"
  if (rule === "CALL_DND_TOO_LONG") return "call_dnd_too_long"
  return engineActionErrorCode(error)
}

/** Les seuls réglages que DIASPORALE montre, tels que le moteur les rend. */
export function toCallSettingsView(row: PreferencesRow): CallSettingsView {
  return {
    outsideRelationsCalls: row.outsideRelationsCalls,
    dndUntil: row.dnd?.until ?? null,
    readReceipts: row.readReceipts,
    voicemailEnabled: row.voicemailEnabled,
    sharePresence: row.sharePresence,
    callWaiting: row.callWaiting,
  }
}

/** Seuls les champs fournis partent au moteur : un champ omis y reste inchangé. */
export function toUpdateArgs(patch: CallPreferencesPatch): CallPreferencesPatch {
  return {
    ...(patch.outsideRelationsCalls !== undefined ? { outsideRelationsCalls: patch.outsideRelationsCalls } : {}),
    ...(patch.readReceipts !== undefined ? { readReceipts: patch.readReceipts } : {}),
    ...(patch.voicemailEnabled !== undefined ? { voicemailEnabled: patch.voicemailEnabled } : {}),
    ...(patch.sharePresence !== undefined ? { sharePresence: patch.sharePresence } : {}),
    ...(patch.callWaiting !== undefined ? { callWaiting: patch.callWaiting } : {}),
  }
}

async function run<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, value: await work() }
  } catch (error) {
    return { ok: false, code: callSettingsErrorCode(error) }
  }
}

export function createEngineCallSettings(deps: EngineSourceDeps): CallSettingsCapability {
  /** Le geste ne vaut que pour la personne affichée : une autre session le ferme avant toute écriture. */
  async function expectPerson(personId: string): Promise<void> {
    const person = await deps.convex.query(api.modules.people.persons.getMyPerson, {})
    if (!person) throw new Refusal("not_signed_in")
    if (person._id !== personId) throw new Refusal("not_found")
  }

  return {
    useMine(personId: string): Loadable<CallSettingsView> {
      const auth = useStableConvexAuth()
      const signedIn = auth.isAuthenticated
      const [now] = useState(() => Math.floor(Date.now() / PREFS_NOW_STEP_MS) * PREFS_NOW_STEP_MS)
      const person = useLoaded(api.modules.people.persons.getMyPerson, signedIn ? {} : "skip")
      const preferences = useLoaded(api.modules.calls.preferences.getMine, signedIn ? { now } : "skip")
      if (auth.isUnauthenticated) return failed("not_signed_in")
      if (!signedIn) return LOADING
      if (person.state === "error") return failed(person.code)
      if (preferences.state === "error") return failed(preferences.code)
      // La personne naît à la première session : un instant, elle n'existe pas encore.
      if (person.state !== "ready" || preferences.state !== "ready" || person.value === null) return LOADING
      if (person.value._id !== personId) return failed("not_found")
      return ready(toCallSettingsView(preferences.value))
    },

    update: (personId, patch) => run(async () => {
      await expectPerson(personId)
      await deps.convex.mutation(api.modules.calls.preferences.update, toUpdateArgs(patch))
      return null
    }),

    setDoNotDisturb: (personId, until) => run(async () => {
      await expectPerson(personId)
      const result = await deps.convex.mutation(api.modules.calls.preferences.setDnd, { until })
      return { dndUntil: result.dnd?.until ?? null }
    }),
  }
}
