import { isSupportedLocale, type Locale } from "@diasporale/features/i18n"

/**
 * La langue d'une première visite, tirée de l'en-tête `Accept-Language` du
 * navigateur : la première langue prise en charge (`fr`, `en`) dans l'ordre des
 * préférences (`q`), sous-étiquette régionale ignorée (`fr-CA` → `fr`). `null` si
 * rien ne correspond : la langue par défaut s'applique alors.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";")
      // Un poids illisible vaut zéro : la langue est ignorée plutôt que préférée.
      const q = params.map((param) => param.trim()).find((param) => param.startsWith("q="))
      const weight = q === undefined ? 1 : Number(q.slice(2))
      return { language: tag.trim().toLowerCase().split("-")[0] ?? "", weight: Number.isFinite(weight) ? weight : 0, index }
    })
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
  const found = ranked.find((entry) => isSupportedLocale(entry.language))
  return found ? (found.language as Locale) : null
}
