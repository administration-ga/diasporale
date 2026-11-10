import { getRequestLocale } from "@/i18n/server"
import { installPalette } from "@/lib/install-palette"
import { offlinePageHtml } from "@/lib/offline-page"

/**
 * La page hors-ligne (MO-05). Le script de fond la demande à son installation et la garde en
 * réserve ; il la sert à la place d'une page demandée sans réseau. Jamais mise en cache par le
 * navigateur lui-même : la réserve du script est la seule copie.
 */
export async function GET() {
  const locale = await getRequestLocale()
  return new Response(offlinePageHtml({ locale, palette: installPalette() }), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  })
}
