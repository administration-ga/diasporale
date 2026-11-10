/**
 * Utilitaires des tests de l'application (jamais importés par un écran ; `test-utils` est
 * exclu des sources relues par les cliquets).
 */

/**
 * La classe de fond d'un bouton PLEIN de la charte : l'aplat de sa famille d'actions
 * (`primary`, `social`, `send`, `react`, `commerce`, `success`, `destructive`). Les variantes
 * tonales (`message`, `secondary`), neutre (`outline`), `ghost` et `link` n'en portent pas.
 */
const FILLED_BUTTON_CLASS = /^bg-(?:primary|social|message|react|commerce|success|danger)-fill$/

/**
 * Les boutons pleins d'une zone, boutons et liens habillés en bouton (`data-slot="button"`)
 * compris : la charte n'en admet qu'un par zone (DS-02).
 */
export function filledButtons(zone: ParentNode): HTMLElement[] {
  return [...zone.querySelectorAll<HTMLElement>('[data-slot="button"]')].filter((button) =>
    [...button.classList].some((name) => FILLED_BUTTON_CLASS.test(name)),
  )
}
