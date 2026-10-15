/**
 * i18n de DIASPORALE — l'instance i18next du MOTEUR (`@antia/social-features/i18n`),
 * à laquelle DIASPORALE fournit son espace de noms `diasporale`. L'application
 * reçoit en plus les espaces du moteur (`social`, codes serveur `errors` et
 * `rules`) : rien à recâbler quand les surfaces du moteur arrivent (PD4).
 *
 * Aucune chaîne d'interface hors des fichiers de locale (cliquet
 * `no-hardcoded-strings`) ; le français et l'anglais portent les mêmes clés et
 * les mêmes `{{variables}}` (cliquet `i18n-locales`).
 */
import {
  createAppI18n as createEngineI18n,
  DEFAULT_LOCALE,
  isSupportedLocale,
  SUPPORTED_LOCALES,
  type AppResources,
  type Locale,
} from "@antia/social-features/i18n"
import type { i18n as I18nInstance } from "i18next"

import enDiasporale from "./locales/en/diasporale.json"
import frDiasporale from "./locales/fr/diasporale.json"

export { DEFAULT_LOCALE, isSupportedLocale, SUPPORTED_LOCALES, type AppResources, type Locale }

/** Cookie de langue : lu par le rendu serveur, posé par le sélecteur de langue. */
export const LOCALE_COOKIE = "diasporale-langue"

export const DIASPORALE_NAMESPACE = "diasporale"

/** La marque, variable `{{brand}}` des textes du moteur. */
export const DIASPORALE_BRAND = "DIASPORALE"

/** Les ressources de l'espace de noms `diasporale`, par langue. */
export const diasporaleResources: AppResources = {
  fr: { [DIASPORALE_NAMESPACE]: frDiasporale },
  en: { [DIASPORALE_NAMESPACE]: enDiasporale },
}

/**
 * Instance i18next ISOLÉE (une par requête côté serveur, une par arbre côté
 * client), construite par le moteur : ressources en mémoire, initialisation
 * synchrone, aucun écart d'hydratation.
 */
export function createAppI18n(options: { locale: Locale; appResources?: AppResources; defaultNS?: string }): I18nInstance {
  const appResources = {} as AppResources
  for (const locale of SUPPORTED_LOCALES) {
    appResources[locale] = { ...diasporaleResources[locale], ...options.appResources?.[locale] }
  }
  return createEngineI18n({
    locale: options.locale,
    appResources,
    defaultNS: options.defaultNS ?? DIASPORALE_NAMESPACE,
    defaultVariables: { brand: DIASPORALE_BRAND },
  })
}

/** Traduction hors React (serveur, métadonnées, tests). */
export function getFixedT(locale: Locale) {
  return createAppI18n({ locale }).getFixedT(locale, DIASPORALE_NAMESPACE)
}
