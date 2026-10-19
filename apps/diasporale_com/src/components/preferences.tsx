"use client"

import { useOptionalAppearance } from "@antsia/social-features/shell/appearance"
import { cn } from "@diasporale/features"
import { SUPPORTED_LOCALES, type Locale } from "@diasporale/features/i18n"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { useAccountLocaleChoice, useApplyLocale } from "./account-locale"

const segment =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[var(--esp-r-chrome)] px-3 text-sm font-medium transition-colors focus-visible:shadow-focus"

/**
 * Langue : français ou anglais (mêmes clés, cliquet i18n). Le choix s'applique
 * tout de suite à toute l'interface, sans rechargement ; il est gardé par un cookie
 * lu par le rendu serveur (aucune langue ne clignote à l'hydratation) et, en
 * session, enregistré sur le compte (`AccountLocale`).
 */
export function LanguageSwitch(props: { className?: string }) {
  const { t, locale } = useDiasporaleT()
  const applyLocale = useApplyLocale()
  const accountChoice = useAccountLocaleChoice()
  const choose = (next: Locale) => {
    if (next === locale) return
    if (accountChoice) accountChoice(next)
    else void applyLocale(next)
  }
  return (
    <div role="group" aria-label={t("preferences.language")} className={cn("inline-flex gap-1 rounded-[var(--esp-r-chrome)] bg-[var(--esp-neutral-chip)] p-1", props.className)}>
      {SUPPORTED_LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={locale === option}
          onClick={() => choose(option)}
          className={cn(segment, locale === option ? "bg-thumb text-foreground shadow-card" : "text-muted-foreground hover:text-foreground")}
        >
          {t(`preferences.locale.${option}`)}
        </button>
      ))}
    </div>
  )
}

const THEMES = [
  { id: "light", icon: SunIcon },
  { id: "dark", icon: MoonIcon },
  { id: "system", icon: MonitorIcon },
] as const

/**
 * Apparence claire, sombre ou celle du système : le mode du fournisseur d'apparence du
 * moteur (classe `dark` sur <html>, mémorisée sur l'appareil). Le thème (Sable ou
 * Gaboma) est un autre réglage : `ThemePicker`. Hors du fournisseur, rien ne s'affiche.
 */
export function ThemeSwitch(props: { className?: string }) {
  const { t } = useDiasporaleT()
  const appearance = useOptionalAppearance()
  // Le mode relu sur l'appareil n'est connu qu'après le montage : aucun bouton n'est pressé avant.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (appearance === null) return null
  return (
    <div role="group" aria-label={t("preferences.appearance")} className={cn("inline-flex max-w-full flex-wrap gap-1 rounded-[var(--esp-r-chrome)] bg-[var(--esp-neutral-chip)] p-1", props.className)}>
      {THEMES.map(({ id, icon: Icon }) => {
        const active = mounted && appearance.mode === id
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => appearance.setMode(id)}
            className={cn(segment, active ? "bg-thumb text-foreground shadow-card" : "text-muted-foreground hover:text-foreground")}
          >
            <Icon className="size-4" aria-hidden />
            {t(`preferences.themeOption.${id}`)}
          </button>
        )
      })}
    </div>
  )
}
