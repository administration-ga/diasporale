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
 * L'utilisateur extérieur au réseau ne rejoue que l'accueil d'ANTSIA
 * (`welcomeOutsider`), jamais `join`.
 */
import type { DiasporaleDemoActor, MembershipStatus } from "@diasporale/domain"

import type { ActionResult } from "./port"
import type { Loadable } from "./types"

/** Un compte du catalogue : l'acteur et son adresse réservée. */
export interface DemoAccountEntry {
  readonly actor: DiasporaleDemoActor
  readonly email: string
}

/**
 * Ce que l'équipement a obtenu : le statut EFFECTIF dans DIASPORALE (une suspension
 * de la racine vaut partout), le rôle, et la page de l'acteur. Statut et rôle sont
 * `null` sans adhésion (utilisateur extérieur au réseau).
 */
export interface DemoEquipmentView {
  readonly status: MembershipStatus | null
  readonly role: "member" | "network_moderator" | "network_admin" | null
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
  /**
   * L'accueil d'ANTSIA SANS entrer dans DIASPORALE, pour l'utilisateur extérieur au
   * réseau : consentement au profil social et profil publié, par les vraies
   * mutations, une seule fois (rien à refaire si le profil est déjà publié).
   */
  welcomeOutsider(input: { readonly handle: string; readonly displayName: string }): Promise<ActionResult>
  /** Équiper le compte de la session en son acteur (faits fictifs, rôle, équipe, page, blocage, suspension). */
  equip(actor: DiasporaleDemoActor): Promise<ActionResult<DemoEquipmentView>>
}
