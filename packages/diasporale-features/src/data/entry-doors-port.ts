/**
 * Les portes d'entrée de DIASPORALE (EA-02) : ce que le déploiement sait VRAIMENT servir.
 *
 *   · Le moteur publie la disponibilité de ses portes sans aucun secret (configuration publique
 *     de l'authentification) ; la démonstration les sert toutes, en simulation.
 *   · La porte n'active que les portes ouvertes : aucun bouton actif sans effet. « Disponible
 *     prochainement » ne se dit que d'une porte fermée.
 *   · Un fournisseur qui ne lit pas les portes garde la porte d'avant ce lot
 *     (`UNREAD_ENTRY_DOORS`) : le code par e-mail, IDN fermée.
 */
import type { Loadable } from "./types"

export interface EntryDoorsView {
  /** « Continuer avec IDN » : le client IDN du moteur est configuré sur ce déploiement. */
  readonly idn: boolean
  /** Le code à usage unique par e-mail peut partir (service de courriel, ou développement local). */
  readonly emailCode: boolean
}

/**
 * Les refus de l'entrée par IDN, dits à la porte : au départ (`idn_unavailable`), ou au retour
 * d'IDN (refus ou abandon chez IDN, compte déjà ouvert à la même adresse, échec).
 */
export const ENTRY_DOORS_ERROR_CODES = ["idn_unavailable", "idn_refused", "idn_account_exists", "idn_failed"] as const

export type EntryDoorsErrorCode = (typeof ENTRY_DOORS_ERROR_CODES)[number]

/** La porte d'avant EA-02, pour un fournisseur qui ne lit pas les portes : code par e-mail, IDN fermée. */
export const UNREAD_ENTRY_DOORS: Loadable<EntryDoorsView> = { status: "ready", data: { idn: false, emailCode: true } }
