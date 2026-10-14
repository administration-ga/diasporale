/**
 * i18n de DIASPORALE — i18next, comme le moteur, le socle et consulat.ga.
 *
 * Un espace de noms : `diasporale` (ce paquet et l'application). Aucune chaîne
 * d'interface hors des fichiers de locale (cliquet `no-hardcoded-strings`) ; le
 * français et l'anglais portent les mêmes clés et les mêmes `{{variables}}`
 * (cliquet `i18n-locales`).
 *
 * L'API (`createAppI18n`, `SUPPORTED_LOCALES`…) est celle de
 * `@antia/social-features/i18n` : au câblage PD0, l'application passe sur
 * l'instance du moteur sans changer ses appels, et ces ressources deviennent
 * l'espace de noms `diasporale` qu'elle lui fournit.
 */
import { createInstance, type i18n as I18nInstance, type Resource } from "i18next"

import enDiasporale from "./locales/en/diasporale.json"
import frDiasporale from "./locales/fr/diasporale.json"

export const SUPPORTED_LOCALES = ["fr", "en"] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = "fr"

/** Cookie de langue : lu par le rendu serveur, posé par le sélecteur de langue. */
export const LOCALE_COOKIE = "diasporale-langue"

export const DIASPORALE_NAMESPACE = "diasporale"

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export type AppResources = Record<Locale, Record<string, Record<string, unknown>>>

/** Les ressources de l'espace de noms `diasporale`, par langue. */
export const diasporaleResources: AppResources = {
  fr: { [DIASPORALE_NAMESPACE]: frDiasporale },
  en: { [DIASPORALE_NAMESPACE]: enDiasporale },
}

/**
 * Instance i18next ISOLÉE : une par requête côté serveur, une par arbre côté
 * client. Ressources en mémoire, initialisation synchrone : aucun clignotement
 * de clés au premier rendu, aucun écart d'hydratation.
 */
export function createAppI18n(options: {
  locale: Locale
  appResources?: AppResources
  defaultNS?: string
}): I18nInstance {
  const resources: Resource = {}
  for (const locale of SUPPORTED_LOCALES) {
    resources[locale] = { ...diasporaleResources[locale], ...options.appResources?.[locale] }
  }
  const instance = createInstance()
  void instance.init({
    lng: options.locale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    resources,
    defaultNS: options.defaultNS ?? DIASPORALE_NAMESPACE,
    ns: Object.keys(resources[DEFAULT_LOCALE] ?? {}),
    interpolation: { escapeValue: false },
    initAsync: false,
    returnNull: false,
  })
  return instance
}

/** Traduction hors React (serveur, métadonnées, tests). */
export function getFixedT(locale: Locale) {
  return createAppI18n({ locale }).getFixedT(locale, DIASPORALE_NAMESPACE)
}
