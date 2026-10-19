import { PAGE_OWNER_KINDS } from "@diasporale/domain"

/**
 * Familles de clés DYNAMIQUES du chantier « pages (DG-007) » (ex. `services.category.${slug}`),
 * énumérées depuis les constantes qui les pilotent. PROPRIÉTAIRE : ce chantier.
 * Une clé citée en toutes lettres n'a rien à faire ici.
 */
export const FAMILIES: readonly string[] = [
  // La nature d'une page dans l'annuaire (`t(\`page.kind.${ownerKind}\`)`).
  ...PAGE_OWNER_KINDS.map((kind) => `page.kind.${kind}`),
]
