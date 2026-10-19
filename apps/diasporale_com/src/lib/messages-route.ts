// Dupliqué de ANTSIA/apps/antsia_ga/src/lib/messages-route.ts @ f1eed7f — adaptations : accepte aussi le segment contextuel `mise-en-relation/<fil>` (CC-6 : DIASPORALE injecte sa source contextuelle dans `MessagesRoute`) ; en-tête de provenance.
import { COMPOSE_GROUPE_LEAF, COMPOSE_LEAF, CONTEXTUAL_ROUTE_KIND, CONVERSATION_ROUTE_KINDS } from "@antsia/social-features/features/messagerie/messagerie-routes"

/** Ce que l'aiguillage de la messagerie (`MessagesRoute`) reçoit d'une adresse. */
export type MessagesRouteTarget = { kind?: string; id?: string; compose?: "personne" | "groupe" }

/**
 * Les segments d'une adresse de messagerie → l'aiguillage de `MessagesRoute`
 * (liste, composeurs, conversation `<genre>/<identifiant>`), `null` pour toute
 * autre forme (la page répond « introuvable »). Module PUR : la page serveur le
 * lit avant de rendre l'écran client.
 */
export function parseMessagesSegments(segments: readonly string[]): MessagesRouteTarget | null {
  if (segments.length === 0) return {}
  const [first, second, ...rest] = segments
  if (rest.length > 0 || first === undefined) return null
  if (second === undefined) {
    if (first === COMPOSE_LEAF) return { compose: "personne" }
    if (first === COMPOSE_GROUPE_LEAF) return { compose: "groupe" }
    return null
  }
  const kind = decodeURIComponent(first)
  // CC-6 : une conversation de mise en relation, servie parce que l'écran injecte sa source contextuelle.
  if (kind !== CONTEXTUAL_ROUTE_KIND && !(CONVERSATION_ROUTE_KINDS as readonly string[]).includes(kind)) return null
  return { kind, id: decodeURIComponent(second) }
}
