/**
 * Familles de clés DYNAMIQUES du chantier « kit d'arrivée » (DG-024 b), énumérées depuis les
 * constantes qui les pilotent. PROPRIÉTAIRE : ce chantier. Une clé citée en toutes lettres
 * n'a rien à faire ici.
 */
import { ARRIVAL_KIT_CATEGORIES, ARRIVAL_KIT_OUTDATED_REASONS, ARRIVAL_KIT_REVIEW_CAUSES, ARRIVAL_KIT_STATUSES } from "@diasporale/domain"

import { ARRIVAL_KIT_FEEDBACK, ARRIVAL_KIT_VIEWS } from "@diasporale/features/data"

export const FAMILIES: readonly string[] = [
  ...ARRIVAL_KIT_CATEGORIES.map((category) => `arrivalKit.category.${category}`),
  // L'état se dit sur la carte et la fiche ; sa note (ce qu'il veut dire pour qui gère) sur la fiche.
  ...ARRIVAL_KIT_STATUSES.flatMap((status) => [`arrivalKit.status.${status}`, `arrivalKit.statusNote.${status}`]),
  ...ARRIVAL_KIT_REVIEW_CAUSES.map((cause) => `arrivalKit.reviewCause.${cause}`),
  ...ARRIVAL_KIT_OUTDATED_REASONS.map((reason) => `arrivalKit.outdatedReason.${reason}`),
  ...ARRIVAL_KIT_VIEWS.map((view) => `arrivalKit.tabs.${view}`),
  ...ARRIVAL_KIT_FEEDBACK.map((kind) => `arrivalKit.feedback.${kind}`),
]
