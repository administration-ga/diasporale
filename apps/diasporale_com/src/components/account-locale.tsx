"use client"

import { useDataSource } from "@diasporale/features/data"
import { isSupportedLocale, LOCALE_COOKIE, type Locale } from "@diasporale/features/i18n"
import { useChangeLocale, useDiasporaleT } from "@diasporale/features/i18n/client"
import { useRouter } from "next/navigation"
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef } from "react"
import { toast } from "sonner"

import { createThemeAccountSync, type ThemeAccountSync } from "@/lib/theme-account-sync"

/** Mémorise la langue de l'appareil (un an) : le rendu serveur la lit à chaque requête. */
export function persistLocale(next: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
}

/**
 * Appliquer une langue à l'appareil, tout de suite : le cookie que lit le rendu
 * serveur, l'instance i18n du client (écrans de DIASPORALE et surfaces du moteur),
 * `<html lang>` pour les lecteurs d'écran, puis le rafraîchissement des composants
 * serveur (titre de l'onglet, métadonnées). Une langue déjà en place ne rafraîchit rien.
 */
export function useApplyLocale(): (next: Locale) => Promise<void> {
  const changeLocale = useChangeLocale()
  const { locale } = useDiasporaleT()
  const router = useRouter()
  return useCallback(
    async (next: Locale) => {
      persistLocale(next)
      if (next === locale && document.documentElement.lang === next) return
      document.documentElement.lang = next
      await changeLocale(next)
      router.refresh()
    },
    [changeLocale, locale, router],
  )
}

type LocaleChoice = (locale: Locale) => void

const LocaleChoiceContext = createContext<LocaleChoice | null>(null)

/** Choisir une langue EN SESSION : appliquée tout de suite, enregistrée sur le compte. `null` hors session. */
export function useAccountLocaleChoice(): LocaleChoice | null {
  return useContext(LocaleChoiceContext)
}

class LocaleSaveRefused extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

/**
 * La langue du compte, sous la session — même mécanisme que le thème (`AccountTheme`,
 * `lib/theme-account-sync.ts`) et que la langue personnelle d'antsia.ga : le compte
 * fait foi, sa langue s'applique à l'appareil dès qu'elle est connue ; un choix du
 * membre s'applique tout de suite puis s'enregistre ; un refus rend la langue du
 * compte et le signale. Le compte est commun aux réseaux du moteur : la langue suit
 * la personne, jusqu'aux avis poussés et aux récapitulatifs. Sans langue enregistrée,
 * l'appareil garde la sienne ; hors session, rien ne s'enregistre.
 */
export function AccountLocale(props: { children: ReactNode }) {
  const source = useDataSource()
  const session = source.useSession()
  const { t } = useDiasporaleT()
  const applyLocale = useApplyLocale()
  const signedIn = session.status === "ready" && session.data.status === "signed_in"
  const stored = session.status === "ready" && session.data.status === "signed_in" ? session.data.account.locale : undefined
  const accountLocale = isSupportedLocale(stored) ? stored : undefined
  const actions = source.actions
  const canSave = actions.saveAccountLocale !== undefined

  const current = useRef({ applyLocale, actions, t })
  const sync = useRef<ThemeAccountSync<Locale> | null>(null)
  useEffect(() => {
    current.current = { applyLocale, actions, t }
  })
  useEffect(() => {
    sync.current = createThemeAccountSync<Locale>({
      apply: (locale) => void current.current.applyLocale(locale),
      save: async (locale) => {
        const result = await current.current.actions.saveAccountLocale?.(locale)
        if (result !== undefined && !result.ok) throw new LocaleSaveRefused(result.code)
      },
      onSaveFailed: (error) => {
        const translate = current.current.t
        const code = error instanceof LocaleSaveRefused ? error.code : "unknown"
        toast.error(translate("preferences.languageSaveFailed"), { description: translate(`errors.${code}`) })
      },
    })
    return () => {
      sync.current = null
    }
  }, [])

  useEffect(() => {
    sync.current?.accountChanged(accountLocale)
  }, [accountLocale])

  const choose = useCallback((locale: Locale) => {
    sync.current?.choose(locale)
  }, [])

  return <LocaleChoiceContext.Provider value={signedIn && canSave ? choose : null}>{props.children}</LocaleChoiceContext.Provider>
}
