import {
  DEFAULT_LOCALE,
  DIASPORALE_NAMESPACE,
  LOCALE_COOKIE,
  createAppI18n,
  isSupportedLocale,
  type Locale,
} from "@diasporale/features/i18n"
import { cookies } from "next/headers"

/** Langue de la requête : le cookie posé par le sélecteur de langue, sinon le français. */
export async function getRequestLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE
}

/**
 * Traduction côté serveur (composants serveur, métadonnées). Une instance par
 * appel : aucune langue ne fuit d'une requête à l'autre. Même forme que
 * `getAppT` des applications du moteur.
 */
export async function getAppT() {
  const locale = await getRequestLocale()
  const i18n = createAppI18n({ locale })
  const t = i18n.getFixedT(locale, DIASPORALE_NAMESPACE)
  return { locale, t: (key: string, options: Record<string, unknown> = {}) => t(key, options) }
}
