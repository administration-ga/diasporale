/**
 * Conversations contextuelles de DIASPORALE : sous-lot CC-3a du contrat
 * CONVERSATION-CONTEXTUELLE-V1 du moteur ANTSIA (accepté le 19/10/2026, ADR-0025).
 *
 * Règles PURES. L'état EFFECTIF d'un objet de la tranche (échéances constatées) devient une
 * phase de conversation (§6.2 du contrat), avec ce que la phase admet : appels engagés,
 * premier mot du répondant, pièces par côté. S'y ajoutent le statut d'écriture et la règle de
 * texte (D8). Trois natures :
 *   · la demande de service : ouverte dès l'envoi, sans boutique ; le répondant parle d'abord
 *     (D4) ; appels à partir d'une proposition (D5) ;
 *   · le mentorat : ouvert à l'acceptation, fermé à la clôture ;
 *   · la candidature : ouverte à la présélection, fermée à la non-sélection ou au retrait.
 *     Clore l'offre ne ferme rien (D6) ; une offre retirée par la modération ferme.
 *
 * Le chargeur de la tranche (`convex/modules/diaspora/conversationContexts.ts`) relit l'objet et
 * applique ces règles. Le moteur garde toute l'autorité : adhésion, vivacité, signataires
 * vivants, blocages, politique. Les valeurs reprennent à l'identique celles du domaine du moteur
 * (`@antsia/social-domain/contextualMessaging`), sans en dépendre.
 */
import { MEMBERSHIP_STATUSES, hasCapability, type MembershipStatus } from "./eligibility"
import type { JobApplicationStatus } from "./jobs"
import { effectiveMentoringStatus, type MentoringRequestStatus } from "./mentoring"
import { containsExactAddress, effectiveServiceRequestStatus, type ServiceRequestStatus } from "./service-requests"

export const CONVERSATION_KINDS = ["diasporaServiceRequest", "diasporaMentoring", "diasporaJobApplication"] as const
export type ConversationKind = (typeof CONVERSATION_KINDS)[number]

export const CONVERSATION_PHASES = ["not_open", "open", "closed"] as const
export type ConversationPhase = (typeof CONVERSATION_PHASES)[number]

export const CONVERSATION_SIDES = ["requester", "responder"] as const
export type ConversationSide = (typeof CONVERSATION_SIDES)[number]

export const CONVERSATION_VOICES = ["person", "page"] as const
export type ConversationVoice = (typeof CONVERSATION_VOICES)[number]

/** Ce que l'objet dit de sa conversation : jamais un droit, jamais une personne. */
export interface ConversationFacts {
  readonly phase: ConversationPhase
  /** La phase admet des appels, sous accord explicite des deux côtés (D5). */
  readonly callsEngaged: boolean
  /** Le demandeur attend le premier mot du répondant (D4). */
  readonly responderFirst: boolean
  /** Pièces admises par côté dans cette phase ; celles du demandeur attendent aussi le premier mot. */
  readonly attachments: { readonly requester: boolean; readonly responder: boolean }
}

const NO_ATTACHMENTS = Object.freeze({ requester: false, responder: false })
const BOTH_ATTACHMENTS = Object.freeze({ requester: true, responder: true })

/** Pas encore ouverte (ou jamais) : aucune conversation ne naît de cet état. */
const NOT_OPEN: ConversationFacts = Object.freeze({ phase: "not_open", callsEngaged: false, responderFirst: false, attachments: NO_ATTACHMENTS })
/** Fermée : l'historique se lit, rien ne s'écrit, aucun appel. */
const CLOSED: ConversationFacts = Object.freeze({ phase: "closed", callsEngaged: false, responderFirst: false, attachments: NO_ATTACHMENTS })
/** Engagée : les deux côtés écrivent et joignent ; appels possibles avec les deux accords. */
const ENGAGED: ConversationFacts = Object.freeze({ phase: "open", callsEngaged: true, responderFirst: false, attachments: BOTH_ATTACHMENTS })
/** Demande envoyée : ouverte, le répondant parle d'abord, aucun appel avant une proposition. */
const AWAITING_RESPONDER: ConversationFacts = Object.freeze({ phase: "open", callsEngaged: false, responderFirst: true, attachments: BOTH_ATTACHMENTS })

/** Un objet retiré par la modération ferme une conversation ouverte ; un objet jamais ouvert le reste. */
function underModeration(facts: ConversationFacts, removedByModeration: boolean): ConversationFacts {
  return removedByModeration && facts.phase === "open" ? CLOSED : facts
}

/** Demande de service (DG-013, DG-014) : l'état effectif, échéance constatée. */
export function serviceRequestConversation(request: { readonly status: ServiceRequestStatus; readonly deadlineAt: number | null }, now: number): ConversationFacts {
  switch (effectiveServiceRequestStatus(request, now)) {
    case "sent":
      return AWAITING_RESPONDER
    case "proposed":
    case "confirmed":
      return ENGAGED
    case "completed":
    case "refused":
    case "cancelled":
    case "expired":
    case "no_show":
      return CLOSED
  }
}

/**
 * Mentorat (DG-024 c) : ouvert à l'acceptation ; une demande envoyée, déclinée, annulée ou
 * expirée n'ouvre jamais de conversation. Une demande ou un profil de mentor retirés par la
 * modération ferment la conversation.
 */
export function mentoringConversation(request: { readonly status: MentoringRequestStatus; readonly expiresAt: number }, now: number, removedByModeration: boolean): ConversationFacts {
  const status = effectiveMentoringStatus(request, now)
  const facts = status === "accepted" ? ENGAGED : status === "closed" ? CLOSED : NOT_OPEN
  return underModeration(facts, removedByModeration)
}

/**
 * Candidature (DG-025) : ouverte à la présélection. Clore l'offre ne touche pas la
 * candidature : l'équipe décide encore, la personne se retire encore (D6). La candidature ou
 * son offre retirées par la modération ferment la conversation.
 */
export function jobApplicationConversation(
  application: { readonly status: JobApplicationStatus },
  removedByModeration: { readonly application: boolean; readonly offer: boolean },
): ConversationFacts {
  const facts = application.status === "shortlisted"
    ? ENGAGED
    : application.status === "not_selected" || application.status === "withdrawn" ? CLOSED : NOT_OPEN
  return underModeration(facts, removedByModeration.application || removedByModeration.offer)
}

/**
 * Le statut d'écriture de chaque côté, pour les trois natures : le premier statut qui porte la
 * capacité « communiquer » (messagerie, appels) de DIASPORALE.
 */
export const CONVERSATION_WRITE_MIN_STATUS = "declaree" as const satisfies MembershipStatus

/** Le premier statut d'adhésion qui porte une capacité donnée (ordre de `MEMBERSHIP_STATUSES`). */
export function lowestStatusWith(capability: Parameters<typeof hasCapability>[1]): MembershipStatus | null {
  return MEMBERSHIP_STATUSES.find((status) => hasCapability(status, capability)) ?? null
}

/** Les codes fermés de la règle de texte, au format des règles de la tranche. */
export const CONVERSATION_TEXT_REFUSALS = ["context_address_forbidden"] as const
export type ConversationTextRefusal = (typeof CONVERSATION_TEXT_REFUSALS)[number]

/**
 * D8 : une adresse exacte (numéro et voie) n'entre pas dans un message en voix de PERSONNE :
 * un domicile est possible, des deux côtés d'un mentorat. En voix de PAGE, elle est admise :
 * c'est l'adresse professionnelle (salon, bureau, local associatif), le lieu même de la
 * prestation ou de l'entretien, que le moteur ne porte nulle part ailleurs. Les coordonnées
 * (téléphone, courriel) restent permises : la conversation est le canal de contact. Le texte
 * reçu est déjà normalisé par le moteur.
 */
export function conversationTextRefusal(input: { readonly text: string; readonly voice: ConversationVoice }): ConversationTextRefusal | null {
  return input.voice === "person" && containsExactAddress(input.text) ? "context_address_forbidden" : null
}
