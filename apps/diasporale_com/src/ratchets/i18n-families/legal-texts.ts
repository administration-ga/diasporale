/**
 * Familles de clés DYNAMIQUES des textes du site (LX-05), énumérées depuis le registre du
 * domaine (`LEGAL_TEXTS`) : le titre de chaque texte, puis le titre et le corps de chacune de
 * ses rubriques (`legal.<texte>.<rubrique>.title` et `.body`). PROPRIÉTAIRE : ce lot.
 */
import { LEGAL_TEXT_KINDS, LEGAL_TEXTS } from "@diasporale/domain"

export const FAMILIES: readonly string[] = LEGAL_TEXT_KINDS.flatMap((kind) => [
  `legal.${kind}.title`,
  ...LEGAL_TEXTS[kind].sections.flatMap((section) => [`legal.${kind}.${section}.title`, `legal.${kind}.${section}.body`]),
])
