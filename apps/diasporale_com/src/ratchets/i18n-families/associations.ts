/**
 * Familles de clés DYNAMIQUES du chantier « associations (DG-010) », énumérées depuis les
 * constantes qui les pilotent. PROPRIÉTAIRE : ce chantier.
 */
import {
  ASSOCIATION_LIST_STATUSES,
  ASSOCIATION_MEMBER_ROLES,
  ASSOCIATION_MEMBERSHIP_STATUSES,
  ASSOCIATION_RESPONSIBLE_ROLES,
} from "@diasporale/domain"

/** Les issues annoncées après un geste (fiche, adhérents, « Mes associations »). */
const FEEDBACK = ["requested", "cancelled", "left", "accepted", "rejected", "removed", "roleChanged", "readmissionAllowed"] as const

export const FAMILIES: readonly string[] = [
  ...ASSOCIATION_MEMBERSHIP_STATUSES.map((status) => `associations.status.${status}`),
  ...ASSOCIATION_MEMBER_ROLES.map((role) => `associations.role.${role}`),
  ...ASSOCIATION_LIST_STATUSES.flatMap((status) => [`associations.members.tab.${status}`, `associations.members.empty.${status}`]),
  ...ASSOCIATION_RESPONSIBLE_ROLES.map((role) => `associations.members.roleNote.${role}`),
  ...FEEDBACK.map((kind) => `associations.feedback.${kind}`),
]
