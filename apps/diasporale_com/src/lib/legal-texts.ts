/**
 * Les textes du site vus par l'application (LX-05) — module PUR : l'adresse et le
 * libellé court de chaque texte, partagés par le pied de page, le menu du compte
 * et les réglages. Leur version, leur date et leurs rubriques vivent dans le
 * domaine (`LEGAL_TEXTS` de `@diasporale/domain`).
 */
import type { LegalTextKind } from "@diasporale/domain"

import { routes } from "./routes"

/** L'adresse de chaque texte, prise dans la table des routes. */
export const LEGAL_TEXT_ROUTES: Readonly<Record<LegalTextKind, () => string>> = {
  notice: routes.legalNotice,
  privacy: routes.privacy,
  terms: routes.terms,
  community: routes.communityRules,
  contact: routes.contact,
}

/** Le libellé court de chaque texte : le même partout où il est proposé. */
export const LEGAL_TEXT_LABELS: Readonly<Record<LegalTextKind, string>> = {
  notice: "footer.legalNotice",
  privacy: "footer.privacy",
  terms: "footer.terms",
  community: "footer.community",
  contact: "footer.contact",
}

/**
 * La date d'une édition (AAAA-MM-JJ), dite dans la langue de la personne. Lue en
 * temps universel : une date civile ne recule pas d'un jour dans un fuseau à l'ouest.
 */
export function formatLegalTextDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`))
}
