"use client"

import { useOptionalAppearance } from "@antsia/social-features/shell/appearance"
import { useDataSource } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef } from "react"
import { toast } from "sonner"

import { isDiasporaleThemeId, type DiasporaleThemeId } from "@/lib/appearance"
import { createThemeAccountSync, type ThemeAccountSync } from "@/lib/theme-account-sync"

type ThemeChoice = (theme: string) => void

const ThemeChoiceContext = createContext<ThemeChoice | null>(null)

/** Choisir un thème EN SESSION : appliqué tout de suite, enregistré sur le compte. `null` hors session. */
export function useAccountThemeChoice(): ThemeChoice | null {
  return useContext(ThemeChoiceContext)
}

/** Un enregistrement refusé par le fournisseur, avec son code traduisible. */
class ThemeSaveRefused extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

/**
 * Le thème du compte, sous la session (même mécanisme qu'antsia.ga, ADR-0026 du moteur) :
 * la valeur du compte s'applique à l'appareil, qui la garde en cache pour le script
 * d'amorçage, et le choix du membre s'y enregistre — règles dans `lib/theme-account-sync.ts`.
 *
 * Le compte est commun aux réseaux du moteur : Sable et Gaboma y portent les mêmes
 * identifiants qu'antsia.ga, et le choix suit la personne d'une application à l'autre.
 * Un thème qu'antsia.ga propose et que DIASPORALE n'a pas (Soleil, Forêt…) laisse ici le
 * choix de l'appareil. Hors session, ou sans la capacité chez le fournisseur, rien ne
 * s'enregistre : le sélecteur retombe sur la mémoire de l'appareil.
 */
export function AccountTheme(props: { children: ReactNode }) {
  const source = useDataSource()
  const session = source.useSession()
  const appearance = useOptionalAppearance()
  const { t } = useDiasporaleT()
  const signedIn = session.status === "ready" && session.data.status === "signed_in"
  const stored = session.status === "ready" && session.data.status === "signed_in" ? session.data.account.theme : undefined
  const accountTheme = isDiasporaleThemeId(stored) ? stored : undefined
  const actions = source.actions
  const canSave = actions.saveAccountTheme !== undefined

  // La synchronisation vit aussi longtemps que le composant : créée au montage,
  // elle relit les fonctions courantes plutôt que celles du premier rendu.
  const current = useRef({ setTheme: appearance?.setTheme, actions, t })
  const sync = useRef<ThemeAccountSync<DiasporaleThemeId> | null>(null)
  useEffect(() => {
    current.current = { setTheme: appearance?.setTheme, actions, t }
  })
  useEffect(() => {
    sync.current = createThemeAccountSync<DiasporaleThemeId>({
      apply: (theme) => current.current.setTheme?.(theme),
      save: async (theme) => {
        const result = await current.current.actions.saveAccountTheme?.(theme)
        if (result !== undefined && !result.ok) throw new ThemeSaveRefused(result.code)
      },
      onSaveFailed: (error) => {
        const translate = current.current.t
        const code = error instanceof ThemeSaveRefused ? error.code : "unknown"
        toast.error(translate("preferences.palette.saveFailed"), { description: translate(`errors.${code}`) })
      },
    })
    return () => {
      sync.current = null
    }
  }, [])

  useEffect(() => {
    sync.current?.accountChanged(accountTheme)
  }, [accountTheme])

  const choose = useCallback((theme: string) => {
    if (isDiasporaleThemeId(theme)) sync.current?.choose(theme)
  }, [])

  return <ThemeChoiceContext.Provider value={signedIn && canSave ? choose : null}>{props.children}</ThemeChoiceContext.Provider>
}
