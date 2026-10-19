/**
 * Capacité « conversations de mise en relation » du port (CC-6, contrat
 * CONVERSATION-CONTEXTUELLE-V1, ADR-0025 du moteur) : le fil d'un objet — demande
 * de service, mentorat, candidature — lu et ouvert depuis l'écran de l'objet.
 * PROPRIÉTAIRE : chantier « conversations contextuelles ».
 *
 * La conversation elle-même se lit et s'écrit dans la messagerie du moteur (îlot
 * iCom, `useContextualMessages`) ; ce port ne porte que l'ENTRÉE depuis l'objet.
 * Le moteur relit tout à chaque lecture et à chaque ouverture : partie actuelle de
 * l'objet, phase, réseau, adhésion. Un objet sans fil, ou dont je ne suis plus
 * partie, se lit `null` — la même réponse.
 *
 * La démonstration ne sert pas cette capacité : iCom y est fermé.
 */
import type { ConversationKind } from "@diasporale/domain"

import type { ActionResult } from "./port"
import type { Loadable } from "./types"

/**
 * Les refus EXPLICITES d'une ouverture, que le moteur ne dit qu'à une partie (contrat §5.3) :
 * l'objet n'est pas en phase d'ouverture ; la conversation est close, ou le réseau ne
 * l'ouvre pas encore ; l'autre côté n'a plus personne pour la recevoir. Un tiers reçoit
 * `not_found`, comme pour un identifiant inventé.
 */
export const CONVERSATION_ERROR_CODES = ["context_not_open", "context_closed", "context_unavailable"] as const
export type ConversationErrorCode = (typeof CONVERSATION_ERROR_CODES)[number]

/** L'objet qui ouvre une conversation : sa nature et son identifiant, rien de son contenu. */
export interface ConversationObjectRef {
  readonly kind: ConversationKind
  readonly id: string
}

/** Le fil d'un objet, vu de moi. */
export interface ObjectConversationView {
  readonly threadId: string
  /** J'y écris encore (fil ouvert) ; sinon lecture seule (fil clos ou objet indisponible). */
  readonly writable: boolean
  /** Un message d'en face que je n'ai pas encore lu. */
  readonly unread: boolean
}

export interface ConversationsCapability {
  /** Le fil de l'objet ; `null` s'il n'en a pas, ou si je n'en suis pas partie (même réponse). */
  useThreadFor(object: ConversationObjectRef): Loadable<ObjectConversationView | null>
  /** Ouvre le fil, de façon idempotente, d'un objet déjà en phase ouverte ; le moteur relit tout. */
  open(object: ConversationObjectRef): Promise<ActionResult<{ readonly threadId: string }>>
}
