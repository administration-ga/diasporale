/**
 * Fabriques de jeux d'essai pour les RETOURS des fonctions du moteur — tests seulement : jamais
 * importé par un écran ni par un adaptateur (`test-utils` est exclu des sources relues par les
 * cliquets, et le fichier n'est pas un fichier de test joué).
 *
 * Pourquoi : un test d'adaptateur qui écrit à la main le retour ENTIER d'une fonction du moteur,
 * typé par `FunctionReturnType<…>`, casse à chaque champ obligatoire que le moteur AJOUTE, et lie
 * nos deux dépôts à chaque fois (antsia#138 : `readReceipts` sur `calls/preferences:getMine`). Une
 * fabrique rend un retour complet à valeurs par défaut ; le test ne nomme que ce qu'il éprouve.
 *
 * Ce que le typage continue de dire, parce que défauts et remplacements sont des littéraux
 * vérifiés contre `Partial<retour>` (contrôle des propriétés en trop) :
 *  · un champ que le moteur RETIRE ou RENOMME : refusé dans les défauts comme dans un remplacement ;
 *  · un champ dont le moteur CHANGE le type : refusé de même.
 * Ce qu'il tolère, par construction : un champ que le moteur AJOUTE et que les défauts ne portent
 * pas encore. L'adaptateur ne le lit pas ; le jour où il le lit, les défauts l'ajoutent et le test
 * qui l'éprouve le nomme.
 */
import type { api } from "@convex/_generated/api"
import type { FunctionReturnType } from "convex/server"

/**
 * Une fabrique pour un retour du moteur : `engineReturnFactory<Retour>(défauts)`. Le type du retour
 * se donne toujours en toutes lettres (`NoInfer` : il n'est jamais déduit des défauts, qui seraient
 * alors acceptés quels qu'ils soient).
 */
export function engineReturnFactory<Return extends object = never>(defaults: NoInfer<Partial<Return>>): (overrides?: Partial<Return>) => Return {
  const base: Partial<Return> = defaults
  // La seule conversion de la fabrique : un champ ajouté par le moteur et absent des défauts reste absent.
  return (overrides: Partial<Return> = {}) => ({ ...base, ...overrides }) as Return
}

export type CallPreferencesReturn = FunctionReturnType<typeof api.modules.calls.preferences.getMine>

/**
 * `calls/preferences:getMine` pour une personne qui n'a jamais rien réglé : les défauts du moteur,
 * ceux d'IC-04 compris (« mes relations seulement », accusés de lecture actifs).
 */
export const callPreferencesReturn = engineReturnFactory<CallPreferencesReturn>({
  dnd: null,
  ringtone: { muted: false, vibrate: true },
  callWaiting: true,
  quickReplies: null,
  voicemailEnabled: true,
  autoMeetingDnd: null,
  sharePresence: true,
  pushIncoming: true,
  outsideRelationsCalls: "silent",
  readReceipts: true,
  journalSeenAt: null,
  saved: false,
})
