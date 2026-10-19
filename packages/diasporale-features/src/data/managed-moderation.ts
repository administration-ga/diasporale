/**
 * L'état de modération d'un contenu de la vague H (entraide, kit d'arrivée, mentorat, emploi),
 * montré à qui le GÈRE : sa personne propriétaire (« Mes … »), ou l'équipe vivante de la page
 * qui le porte. Jamais aux autres lecteurs, qui ne voient de toute façon ni un contenu en
 * relecture ni un contenu retiré (règle du moteur, `diaspora/moderationContent.ts`).
 *
 * Le moteur dit `removed` ; l'avis de l'interface (`ModerationBanner`) parle de `rejected`.
 */
import type { ContentModerationState } from "@diasporale/domain"

export const MANAGED_MODERATION_STATES = ["published", "pending_review", "removed"] as const
export type ManagedModerationState = (typeof MANAGED_MODERATION_STATES)[number]

/** L'état que `ModerationBanner` sait dire ; `null` pour un contenu publié (aucun avis à montrer). */
export function moderationBannerState(state: ManagedModerationState | undefined): Exclude<ContentModerationState, "published"> | null {
  if (state === "pending_review") return "pending_review"
  if (state === "removed") return "rejected"
  return null
}
