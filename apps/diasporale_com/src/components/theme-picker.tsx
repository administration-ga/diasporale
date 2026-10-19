"use client"

import { useOptionalAppearance } from "@antsia/social-features/shell/appearance"
import { RadioCard, RadioGroup, cn } from "@diasporale/features"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { useId } from "react"

import { isDiasporaleThemeId, type DiasporaleThemeId } from "@/lib/appearance"

import { useAccountThemeChoice } from "./account-theme"

/** Le nom et la phrase de chaque thème (clés citées en toutes lettres : cliquet i18n). */
const THEME_TEXT = {
  sable: { name: "preferences.palette.sable.name", description: "preferences.palette.sable.description" },
  gaboma: { name: "preferences.palette.gaboma.name", description: "preferences.palette.gaboma.description" },
} as const satisfies Record<DiasporaleThemeId, { name: string; description: string }>

const SWATCHES = ["bg-[var(--esp-theme-swatch-1)]", "bg-[var(--esp-theme-swatch-2)]", "bg-[var(--esp-theme-swatch-3)]"] as const

/**
 * Réglages > Langue et apparence : le thème, au choix du membre — Sable, la charte de
 * DIASPORALE et le thème par défaut, ou Gaboma, le thème du réseau ANTSIA. Chaque
 * option est peinte dans SON thème (`data-charte` sur l'option) : le membre voit le
 * fond, la carte, le texte et les trois couleurs du thème avant de choisir, dans le
 * mode (clair ou sombre) qu'il a choisi. Le choix est immédiat, sans bouton
 * d'enregistrement : en session, il s'enregistre aussi sur le compte (`AccountTheme`) ;
 * hors session, il reste sur cet appareil (fournisseur d'apparence du moteur).
 * Comme toute option en carte de la charte, la sélection se lit sans contour : la
 * teinte de sélection et la pastille remplie.
 */
export function ThemePicker(props: { className?: string }) {
  const { t } = useDiasporaleT()
  const appearance = useOptionalAppearance()
  const accountChoice = useAccountThemeChoice()
  const labelId = useId()
  const hintId = useId()
  if (appearance === null || appearance.themes.length < 2) return null
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", props.className)}>
      <p id={labelId} className="text-sm font-semibold">
        {t("preferences.theme")}
      </p>
      <p id={hintId} className="-mt-1 text-[13px] leading-snug text-muted-foreground">
        {t("preferences.palette.hint")}
      </p>
      <RadioGroup
        aria-labelledby={labelId}
        aria-describedby={hintId}
        value={appearance.theme ?? undefined}
        onValueChange={accountChoice ?? appearance.setTheme}
        className="grid-cols-1 sm:grid-cols-2"
      >
        {appearance.themes.map((entry) => {
          const text = isDiasporaleThemeId(entry.id) ? THEME_TEXT[entry.id] : null
          if (text === null) return null
          return (
            <RadioCard key={entry.id} value={entry.id} data-charte={entry.charte} className="items-start text-foreground">
              <span className="flex min-w-0 flex-col gap-2">
                {/* L'aperçu, lu dans la charte de l'option : fond, carte, texte et les trois couleurs du thème. */}
                <span aria-hidden className="flex h-12 items-end gap-1.5 rounded-md bg-background p-1.5">
                  <span className="flex h-full min-w-0 flex-1 flex-col justify-center gap-1 rounded-[var(--radius-xs)] bg-card px-1.5 shadow-card">
                    <span className="h-1.5 w-3/4 rounded-full bg-foreground" />
                    <span className="h-1.5 w-1/2 rounded-full bg-muted-foreground" />
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {SWATCHES.map((swatch) => (
                      <span key={swatch} className={cn("size-4 rounded-full", swatch)} />
                    ))}
                  </span>
                </span>
                <span className="font-semibold">{t(text.name)}</span>
                <span className="text-[13px] leading-snug text-muted-foreground">{t(text.description)}</span>
              </span>
            </RadioCard>
          )
        })}
      </RadioGroup>
    </div>
  )
}
