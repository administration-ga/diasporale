/**
 * L'interrupteur des APPELS de diasporale.com (lot IM-01) — module PUR.
 *
 * Décision du propriétaire (plan 04 du 10/11/2026, § 7, décision 2) : le pilote ouvre SANS
 * appels tant qu'ils n'ont pas été prouvés à deux, avec un vrai serveur d'appels (IC-01 du
 * moteur, recette IM-11). Un bouton qui finit sur « La visioconférence n'est pas configurée »
 * coûte plus qu'un bouton absent.
 *
 * Fermé, aucun geste d'appel n'est proposé par les écrans de DIASPORALE ; le code des appels
 * reste entier et branché (couche d'appel du moteur montée par `EngineIcom`, sonnerie d'un appel
 * entrant comprise). Le jour où les appels sont prouvés, on l'ouvre ici, en une valeur, sans
 * rien réécrire : `CALLS_SWITCH = "open"`.
 *
 * Écrans de DIASPORALE qui lisent l'interrupteur : le profil d'une relation (« Appeler ») ; la
 * rubrique « Messages et appels » des réglages (IM-02), qui dit, fermé, qu'aucun appel n'est
 * encore proposé depuis un profil.
 *
 * Tant que le moteur ne lit pas de déclaration « appels ouverts » (issue [S1] d'IM-01, à côté
 * de `liveAvailable`), les surfaces d'iCom montées telles quelles gardent leurs propres gestes :
 * l'en-tête d'une conversation (audio, vidéo, appel de groupe), le journal d'appels et son rappel,
 * le panneau d'appels d'une mise en relation. L'interrupteur leur sera transmis par l'îlot
 * (`IcomIsland`) dès que le moteur l'acceptera.
 *
 * Pourquoi une valeur du dépôt et pas une variable publique de construction : toute variable
 * `NEXT_PUBLIC_*` lue par l'application doit être déclarée au catalogue de déploiement du moteur
 * (`deploy/catalog.json`, cliquet `deploy-catalog`), qui n'est pas dans la zone de DIASPORALE.
 */
export const CALL_SWITCH_STATES = ["closed", "open"] as const
export type CallSwitch = (typeof CALL_SWITCH_STATES)[number]

/** L'interrupteur lui-même : fermé tant que les appels ne sont pas prouvés à deux. */
export const CALLS_SWITCH: CallSwitch = "closed"

/** Seul « open » ouvre les appels ; toute autre valeur les garde fermés. */
export function isCallsSwitchOpen(state: CallSwitch): boolean {
  return state === "open"
}

/** Les écrans demandent ici si un geste d'appel peut être proposé. */
export function callsAreOpen(): boolean {
  return isCallsSwitchOpen(CALLS_SWITCH)
}
