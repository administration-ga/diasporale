"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { I18nextProvider, useTranslation } from "react-i18next"

import { createAppI18n, DIASPORALE_NAMESPACE, type AppResources, type Locale } from "./index"

/**
 * Fournisseur i18n côté client : une instance par arbre, créée une fois au
 * montage avec les mêmes ressources que le rendu serveur (aucun écart
 * d'hydratation). Même signature que celui du moteur.
 *
 * La langue du rendu serveur fait foi : quand un rafraîchissement (`router.refresh()`
 * après un choix de langue, langue du compte) en apporte une autre, l'instance la
 * rejoint, et tous les `useTranslation` — surfaces du moteur comprises — se
 * réaffichent sans rechargement de la page.
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
  // Seul un CHANGEMENT de la langue du serveur compte : au montage, l'instance la porte
  // déjà, et une langue appliquée entre-temps par un enfant (celle du compte) ne doit pas
  // être défaite avant que le rafraîchissement ne l'apporte.
  const serverLocale = useRef(props.locale)
  useEffect(() => {
    if (serverLocale.current === props.locale) return
    serverLocale.current = props.locale
    if (i18n.resolvedLanguage !== props.locale) void i18n.changeLanguage(props.locale)
  }, [i18n, props.locale])
  return <I18nextProvider i18n={i18n}>{props.children}</I18nextProvider>
}

/** `t` de l'espace de noms `diasporale`, et la langue courante. */
export function useDiasporaleT() {
  const { t, i18n } = useTranslation(DIASPORALE_NAMESPACE)
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "fr") as Locale
  return { t, locale }
}

/** Passer l'interface dans une autre langue tout de suite, sans attendre le rendu serveur. */
export function useChangeLocale(): (next: Locale) => Promise<void> {
  const { i18n } = useTranslation(DIASPORALE_NAMESPACE)
  return useCallback(
    async (next: Locale) => {
      if (i18n.resolvedLanguage !== next) await i18n.changeLanguage(next)
    },
    [i18n],
  )
}
