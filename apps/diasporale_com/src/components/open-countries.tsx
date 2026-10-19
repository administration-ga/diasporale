"use client"

import { CountryTag } from "@diasporale/features"
import { useOpenCountries } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"

/**
 * Les pays réellement ouverts, lus dans la source de données : leurs pastilles,
 * et « Bientôt disponible » pour un pays en sommeil. Rien plutôt qu'un zéro ni
 * qu'un chiffre promotionnel : une liste vide ou pas encore lue ne rend rien
 * (`useHasOpenCountries` le dit à qui veut aussi taire son titre).
 */
export function OpenCountriesList() {
  const { t } = useDiasporaleT()
  const open = useOpenCountries()
  if (open.status !== "ready" || open.data.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2">
      {open.data.map((item) => (
        <li key={item.country} className="flex items-center gap-2">
          <CountryTag country={item.country} size="md" />
          {item.counters.dormant ? <span className="text-[13px] text-muted-foreground">{t("hub.soon")}</span> : null}
        </li>
      ))}
    </ul>
  )
}

export function useHasOpenCountries(): boolean {
  const open = useOpenCountries()
  return open.status === "ready" && open.data.length > 0
}
