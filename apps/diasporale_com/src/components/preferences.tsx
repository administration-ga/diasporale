"use client"

import { cn } from "@diasporale/features"
import { LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from "@diasporale/features/i18n"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const segment =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[var(--esp-r-chrome)] px-3 text-sm font-medium transition-colors focus-visible:shadow-focus"

/** Mémorise la langue choisie (un an) ; le rendu serveur la lit au prochain rafraîchissement. */
function persistLocale(next: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
}

/**
 * Langue : français ou anglais (mêmes clés, cliquet i18n). Le choix est un
 * cookie lu par le rendu serveur — aucune langue ne clignote à l'hydratation.
 */
export function LanguageSwitch(props: { className?: string }) {
  const { t, locale } = useDiasporaleT()
  const router = useRouter()
  const choose = (next: Locale) => {
    persistLocale(next)
    router.refresh()
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
          className={cn(segment, locale === option ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground")}
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

/** Thème clair, sombre ou celui du système (next-themes, classe `dark` sur <html>). */
export function ThemeSwitch(props: { className?: string }) {
  const { t } = useDiasporaleT()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return (
    <div role="group" aria-label={t("preferences.theme")} className={cn("inline-flex gap-1 rounded-[var(--esp-r-chrome)] bg-[var(--esp-neutral-chip)] p-1", props.className)}>
      {THEMES.map(({ id, icon: Icon }) => {
        const active = mounted && theme === id
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(id)}
            className={cn(segment, active ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground")}
          >
            <Icon className="size-4" aria-hidden />
            {t(`preferences.themeOption.${id}`)}
          </button>
        )
      })}
    </div>
  )
}
