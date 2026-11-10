import { DEFAULT_LOCALE, isSupportedLocale, LOCALE_COOKIE, type Locale } from "@diasporale/features/i18n"

import { localeFromAcceptLanguage } from "./accept-language"

/**
 * La langue de la personne, lue dans le navigateur, quand le serveur ne la donne
 * pas : la page d'erreur globale remplace la mise en page racine et ne reçoit
 * aucune langue. Même ordre que `getRequestLocale` côté serveur : le cookie posé
 * par le sélecteur de langue (ou par la langue du compte), puis les langues du
 * navigateur, puis le français. Module pur : le document et le navigateur sont lus
 * par l'appelant.
 */
export function localeFromBrowser(input: { readonly cookie: string; readonly languages: readonly string[] }): Locale {
  for (const part of input.cookie.split(";")) {
    const separator = part.indexOf("=")
    if (separator === -1 || part.slice(0, separator).trim() !== LOCALE_COOKIE) continue
    const value = part.slice(separator + 1).trim()
    if (isSupportedLocale(value)) return value
  }
  return localeFromAcceptLanguage(input.languages.join(",")) ?? DEFAULT_LOCALE
}
