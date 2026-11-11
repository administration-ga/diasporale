/**
 * Capacité « réglages iCom » du port (IM-02) — les réglages d'appel, de présence et
 * de lecture de la PERSONNE : qui peut faire sonner son téléphone, « Ne pas
 * déranger », les accusés de lecture, la messagerie vocale, la présence montrée aux
 * relations, le double appel.
 *
 * Ces réglages sont ceux du compte commun : ils valent dans tous les réseaux de la
 * personne, ANTSIA compris. Le moteur les porte (`calls/preferences` : `getMine`,
 * `update`, `setDnd`, fonctions sur soi) et les applique à chaque appel qu'il
 * admet, d'où qu'il vienne (`calls/evaluate`, `calls/presence`, `calls/voicemail`),
 * et à chaque « Lu » qu'il sert dans une conversation à deux (`messaging/participation`).
 *
 * Seuls les réglages qui ont un EFFET réel côté serveur sont servis ici. La
 * sonnerie et la vibration de l'appareil, les réponses rapides, le silence
 * pendant un évènement et l'avis d'appel hors du site ne le sont pas : aucun écran
 * de DIASPORALE ne les montre aujourd'hui.
 */
import { DEFAULT_OUTSIDE_RELATIONS_CALLS, DEFAULT_READ_RECEIPTS, MAX_DND_DURATION_MS } from "@antsia/social-contracts/calls"

import type { ActionResult } from "./port"
import type { Loadable } from "./types"

const HOUR_MS = 60 * 60 * 1000

/**
 * Les appels d'une personne HORS de mes relations (moteur : `outsideRelationsCalls`).
 * `ring` : le téléphone sonne ; `silent` : il ne sonne pas, l'appel est inscrit au
 * journal de l'appelé, et l'appelant voit un appel sans réponse (IC-04 : la raison ne lui
 * est jamais dite). Un appel lancé dans un groupe dont on est membre, et un appel accepté
 * dans une mise en relation, ne dépendent pas de ce choix.
 */
export const OUTSIDE_RELATIONS_CALLS = ["ring", "silent"] as const
export type OutsideRelationsCalls = (typeof OUTSIDE_RELATIONS_CALLS)[number]

export interface CallSettingsView {
  readonly outsideRelationsCalls: OutsideRelationsCalls
  /** Fin du « Ne pas déranger » en cours ; `null` : aucun silence en cours. */
  readonly dndUntil: number | null
  /**
   * Accusés de lecture des conversations à deux, RÉCIPROQUES (IC-04) : coupés, les autres ne
   * voient plus quand je lis, et je ne vois plus quand ils lisent. Le serveur applique la règle.
   */
  readonly readReceipts: boolean
  /** L'appelant d'un appel manqué peut laisser un message vocal. */
  readonly voicemailEnabled: boolean
  /** Mes relations voient ma présence (en ligne, en appel, « Ne pas déranger »). */
  readonly sharePresence: boolean
  /** Pendant un appel, un second appel se présente en attente au lieu d'être refusé. */
  readonly callWaiting: boolean
}

/** Les réglages qu'un formulaire écrit : chaque champ omis reste inchangé (moteur : `update`). */
export type CallPreferencesPatch = Partial<Pick<CallSettingsView, "outsideRelationsCalls" | "readReceipts" | "voicemailEnabled" | "sharePresence" | "callWaiting">>

/**
 * Les défauts du moteur pour une personne qui n'a jamais rien réglé (`getMine`). Les deux
 * défauts d'IC-04 viennent du contrat du moteur, leur seule source : « mes relations
 * seulement » (décision du propriétaire du 9/11/2026) et les accusés de lecture actifs.
 */
export const DEFAULT_CALL_SETTINGS: CallSettingsView = Object.freeze({
  outsideRelationsCalls: DEFAULT_OUTSIDE_RELATIONS_CALLS,
  dndUntil: null,
  readReceipts: DEFAULT_READ_RECEIPTS,
  voicemailEnabled: true,
  sharePresence: true,
  callWaiting: true,
})

/** Les durées proposées pour « Ne pas déranger ». */
export const DND_DURATIONS = ["oneHour", "eightHours", "oneDay", "sevenDays"] as const
export type DndDuration = (typeof DND_DURATIONS)[number]

/**
 * Une minute de marge sous le plafond du moteur (sept jours, `MAX_DND_DURATION_MS`) :
 * l'horloge de l'appareil peut avancer un peu sur celle du serveur.
 */
const DND_CLOCK_MARGIN_MS = 60_000

export const DND_DURATION_MS: Readonly<Record<DndDuration, number>> = Object.freeze({
  oneHour: HOUR_MS,
  eightHours: 8 * HOUR_MS,
  oneDay: 24 * HOUR_MS,
  sevenDays: MAX_DND_DURATION_MS - DND_CLOCK_MARGIN_MS,
})

/** La fin d'un « Ne pas déranger » posé à l'instant `now`. */
export function dndUntilFor(duration: DndDuration, now: number): number {
  return now + DND_DURATION_MS[duration]
}

/** Codes de refus propres aux réglages iCom (fragment `call-settings.json`). */
export const CALL_SETTINGS_ERROR_CODES = [
  // « Ne pas déranger » : la fin demandée est déjà passée (horloge de l'appareil en retard).
  "call_dnd_past",
  // « Ne pas déranger » : plus de sept jours (horloge de l'appareil en avance).
  "call_dnd_too_long",
] as const
export type CallSettingsErrorCode = (typeof CALL_SETTINGS_ERROR_CODES)[number]

/** La règle de `setDnd` du moteur, jugée de même par la démonstration. */
export function dndRefusal(until: number, now: number): CallSettingsErrorCode | null {
  if (until <= now) return "call_dnd_past"
  if (until - now > MAX_DND_DURATION_MS) return "call_dnd_too_long"
  return null
}

export interface CallSettingsCapability {
  /** MES réglages, ou les défauts du moteur ; la session d'une autre personne : `not_found`. */
  useMine(personId: string): Loadable<CallSettingsView>
  /** Écrit les seuls réglages fournis ; rien d'autre ne change. */
  update(personId: string, patch: CallPreferencesPatch): Promise<ActionResult>
  /** Pose (`until`) ou lève (`null`) MON « Ne pas déranger », sept jours au plus. */
  setDoNotDisturb(personId: string, until: number | null): Promise<ActionResult<{ readonly dndUntil: number | null }>>
}
