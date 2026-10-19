/**
 * Familles de clés DYNAMIQUES du chantier « gestion des pages (DG-008) » (ex. `services.category.${slug}`),
 * énumérées depuis les constantes qui les pilotent. PROPRIÉTAIRE : ce chantier.
 * Une clé citée en toutes lettres n'a rien à faire ici.
 */
import { PAGE_OWNER_KINDS, PAGE_TRUST_LEVELS } from "@diasporale/domain"
import { MANAGED_PAGE_ROLES, MEMBER_PAGE_KINDS, PAGE_CLAIM_MANDATES, PAGE_CLAIM_OUTCOMES, PAGE_CLAIM_STATES } from "@diasporale/features/data"

export const FAMILIES: readonly string[] = [
  ...PAGE_OWNER_KINDS.map((kind) => `pageAdmin.kind.${kind}`),
  ...MEMBER_PAGE_KINDS.map((kind) => `pageAdmin.create.kindHint.${kind}`),
  ...MANAGED_PAGE_ROLES.map((role) => `pageAdmin.role.${role}`),
  ...PAGE_CLAIM_STATES.map((status) => `pageAdmin.claimStatus.${status}`),
  ...PAGE_CLAIM_MANDATES.map((mandate) => `pageAdmin.claim.mandate.${mandate}`),
  ...PAGE_CLAIM_OUTCOMES.map((decision) => `pageAdmin.review.decision.${decision}`),
  ...PAGE_TRUST_LEVELS.map((badge) => `pageAdmin.verification.state.${badge}`),
]
