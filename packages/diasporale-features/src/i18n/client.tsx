"use client"

import { useState, type ReactNode } from "react"
import { I18nextProvider, useTranslation } from "react-i18next"

import { createAppI18n, DIASPORALE_NAMESPACE, type AppResources, type Locale } from "./index"

/**
 * Fournisseur i18n côté client : une instance par arbre, créée une fois au
 * montage avec les mêmes ressources que le rendu serveur (aucun écart
 * d'hydratation). Même signature que celui du moteur.
 */
export function I18nProvider(props: {
  locale: Locale
  appResources?: AppResources
  defaultNS?: string
  children: ReactNode
}) {
  const [i18n] = useState(() =>
    createAppI18n({ locale: props.locale, appResources: props.appResources, defaultNS: props.defaultNS }),
  )
  return <I18nextProvider i18n={i18n}>{props.children}</I18nextProvider>
}

/** `t` de l'espace de noms `diasporale`, et la langue courante. */
export function useDiasporaleT() {
  const { t, i18n } = useTranslation(DIASPORALE_NAMESPACE)
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "fr") as Locale
  return { t, locale }
}
