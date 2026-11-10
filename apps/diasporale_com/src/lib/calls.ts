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
 * Qui lit l'interrupteur :
 *  · l'îlot des surfaces du moteur (`IcomIsland`), qui le déclare au moteur (`callsAvailable`,
 *    IC-04, antsia#138) : fermé, iCom retire de lui-même tous ses gestes qui lancent un appel
 *    (en-tête d'une conversation et fiche d'un groupe, rappel du journal, boutons des relations
 *    et « Nouvel appel », panneau d'appels et accord d'une mise en relation) ;
 *  · le profil d'une relation (« Appeler ») : ce bouton est écrit par DIASPORALE, la déclaration
 *    du moteur ne l'atteint pas, il garde donc sa propre condition ;
 *  · la rubrique « Messages et appels » des réglages (IM-02), qui dit, fermé, que DIASPORALE ne
 *    propose pas encore d'appel.
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
