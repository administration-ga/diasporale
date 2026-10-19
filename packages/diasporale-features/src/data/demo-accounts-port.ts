/**
 * Capacité « comptes de démonstration » du port — DÉVELOPPEMENT LOCAL SEULEMENT.
 *
 * Servie par le fournisseur MOTEUR (tranche `convex/modules/diaspora/demoAccounts`
 * d'ANTSIA) : un compte par acteur du catalogue du domaine
 * (`DIASPORALE_DEMO_ACTOR_SPECS`), sur une adresse réservée. Hors des outils de
 * développement locaux du moteur, le catalogue est VIDE et la porte n'affiche
 * rien ; la démonstration (données fictives de ce navigateur) a ses propres
 * comptes (`DemoControls`) et ne sert pas cette capacité.
 *
 * Un compte entre par le vrai code à usage unique (`requestCode`, `verifyCode`) ;
 * l'application rejoue ensuite le vrai accueil (`join`), puis demande ici ce qu'il
 * ne peut pas se donner seul (`equip`), puis joue les vrais gestes de l'acteur.
 */
import type { DiasporaleDemoActor, MembershipStatus } from "@diasporale/domain"

import type { ActionResult } from "./port"
import type { Loadable } from "./types"

/** Un compte du catalogue : l'acteur et son adresse réservée. */
export interface DemoAccountEntry {
  readonly actor: DiasporaleDemoActor
  readonly email: string
}

/** Ce que l'équipement a obtenu : le statut dérivé, le rôle, et la page de l'acteur. */
export interface DemoEquipmentView {
  readonly status: MembershipStatus
  readonly role: "member" | "network_moderator" | "network_admin"
  /** La page de l'acteur (gestes d'une page), ou `null`. */
  readonly pageId: string | null
  /** La page vient d'être créée : ses gestes (offres, mission) se jouent une seule fois. */
  readonly pageCreated: boolean
}

export interface DemoAccountsCapability {
  /** Les comptes ouverts ici : vide hors des outils de développement locaux. */
  useCatalogue(): Loadable<readonly DemoAccountEntry[]>
  /** Le code à usage unique enregistré pour cette adresse (outil de développement), ou `null`. */
  readLocalCode(email: string): Promise<string | null>
  /** Équiper le compte de la session en son acteur (faits fictifs, rôle, équipe, page). */
  equip(actor: DiasporaleDemoActor): Promise<ActionResult<DemoEquipmentView>>
}
