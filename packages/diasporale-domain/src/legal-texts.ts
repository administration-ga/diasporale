/**
 * Les textes d'information du site (LX-05) : mentions légales, confidentialité,
 * conditions d'utilisation, règles de la communauté et contact.
 *
 * Ce module tient la VERSION et la DATE de chaque texte, comme `consents.ts` tient
 * celles des textes de consentement : changer un texte change sa version et sa
 * date. Il tient aussi ses rubriques, dans l'ordre d'affichage — des identifiants
 * de clés de texte, jamais un contenu.
 *
 * Aucun contenu juridique ici ni dans les fichiers de langue : le fond est au
 * juriste et au propriétaire (porte A11, lot DS-07). Tant qu'un texte n'est pas
 * FOURNI (`provided: false`), l'écran garde le marqueur bloquant visible et chaque
 * rubrique dit ce qui reste à fournir. Le jour où le texte arrive : ses phrases
 * entrent dans les fichiers de langue, `provided` passe à `true`, la version et la
 * date changent.
 */

export const LEGAL_TEXT_KINDS = ["notice", "privacy", "terms", "community", "contact"] as const
export type LegalTextKind = (typeof LEGAL_TEXT_KINDS)[number]

export interface LegalTextEdition {
  /** Version du texte affiché ; elle change avec le texte. */
  readonly version: string
  /** Date de cette version, au format AAAA-MM-JJ. */
  readonly date: string
  /** `false` tant que le juriste et le propriétaire n'ont pas fourni le texte : marqueur bloquant visible. */
  readonly provided: boolean
  /** Les rubriques, dans l'ordre d'affichage : `legal.<texte>.<rubrique>.title` et `.body`. */
  readonly sections: readonly string[]
}

/**
 * L'édition en vigueur de chaque texte. Les mentions légales et la confidentialité
 * sont les charpentes du 14/10/2026, inchangées depuis ; les trois autres, celles
 * du 10/11/2026 (LX-05). Aucune n'est fournie.
 */
export const LEGAL_TEXTS: Readonly<Record<LegalTextKind, LegalTextEdition>> = Object.freeze({
  notice: { version: "0.1", date: "2026-10-14", provided: false, sections: ["section1", "section2", "section3", "section4"] },
  privacy: { version: "0.1", date: "2026-10-14", provided: false, sections: ["section1", "section2", "section3", "section4"] },
  terms: {
    version: "0.1",
    date: "2026-11-10",
    provided: false,
    sections: ["purpose", "access", "conduct", "content", "moderation", "liability", "termination", "changes", "law"],
  },
  community: {
    version: "0.1",
    date: "2026-11-10",
    provided: false,
    sections: ["spirit", "respect", "safety", "privacy", "offers", "reporting", "sanctions"],
  },
  contact: {
    version: "0.1",
    date: "2026-11-10",
    provided: false,
    sections: ["report", "messages", "data", "publisher", "dataProtection"],
  },
})

/** Les textes que le juriste et le propriétaire doivent encore fournir : chacun garde son marqueur bloquant. */
export function pendingLegalTexts(): LegalTextKind[] {
  return LEGAL_TEXT_KINDS.filter((kind) => !LEGAL_TEXTS[kind].provided)
}
