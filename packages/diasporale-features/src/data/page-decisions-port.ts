/**
 * Capacité « décisions de page » du port (P16 du moteur, lot de confiance G9) :
 * les décisions de modération qui ont RETIRÉ un contenu porté par une page
 * (mission bénévole, offre d'emploi, ressource du kit portée par une page,
 * réponse à un avis, évènement), lues par un signataire VIVANT de cette page, et
 * leur recours. PROPRIÉTAIRE : chantier « confiance des surfaces ».
 *
 * Même vue que « Mes données » (`ModerationDecisionView`) : aucun déclarant,
 * aucun contenu, aucune identité du modérateur. Une décision de page ne porte
 * aucune sanction personnelle (`sanctions` toujours vide).
 *
 * Le moteur relit le droit à chaque lecture (`moderation/cases.pageDecisions`,
 * signataire vivant dans le réseau DIASPORALE) et à chaque recours
 * (`moderation/cases.fileAppeal`, la même porte que le recours personnel,
 * ouverte au signataire vivant de la page porteuse). Qui ne signe pas, ou plus,
 * pour la page lit `null`, la même réponse qu'une page introuvable.
 */
import type { ModerationDecisionsPage } from "./data-rights-port"
import type { ActionResult } from "./port"
import type { Loadable } from "./types"

export interface PageDecisionsRequest {
  readonly pageId: string
  readonly cursor: string | null
}

/** `null` : je ne signe pas, ou plus, pour cette page (même réponse qu'une page introuvable). */
export type PageDecisionsQuery = Loadable<ModerationDecisionsPage | null> & {
  readonly retry?: () => Promise<unknown>
}

export interface PageAppealInput {
  /** La page affichée : le geste lui reste lié, le moteur relit le droit sur la page porteuse. */
  readonly pageId: string
  readonly reportId: string
  readonly reason: string
}

export interface PageDecisionsCapability {
  /** Les décisions qui ont retiré un contenu de cette page, des plus récentes aux plus anciennes. */
  useDecisions(args: PageDecisionsRequest): PageDecisionsQuery
  /** Recours d'un signataire vivant ; rejoué au même niveau, il rend le recours existant (`created: false`). */
  fileAppeal(input: PageAppealInput): Promise<ActionResult<{ readonly created: boolean }>>
}
