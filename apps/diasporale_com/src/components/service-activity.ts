/**
 * Les onglets de « Mon activité » (`/mon-activite?onglet=…`), module pur : lu par
 * l'écran, par les cliquets i18n et par les tests, sans rien monter de React.
 * Mêmes valeurs que `routes.myActivity(tab)`.
 */
// « emplois » (DG-025) : les offres d'emploi et candidatures des pages employeuses.
export const ACTIVITY_TABS = ["offres", "demandes", "emplois", "pages"] as const
export type ActivityTab = (typeof ACTIVITY_TABS)[number]

/** L'onglet demandé par l'adresse ; inconnu ou absent : « Offres ». */
export function parseActivityTab(raw: string | null): ActivityTab {
  return (ACTIVITY_TABS as readonly string[]).includes(raw ?? "") ? (raw as ActivityTab) : "offres"
}
