import { APP_ICON_FORMATS, MANIFEST_ICONS, appIconSpec, isAppIconFormat } from "@/lib/app-icon-spec"
import { appIconResponse } from "@/lib/app-icon"
import { requireInstallPalette } from "@/lib/install-palette"

/** Les trois icônes du manifeste sont dessinées à la construction ; aucun autre format n'existe. */
export const dynamicParams = false

export function generateStaticParams() {
  return APP_ICON_FORMATS.map((format) => ({ format }))
}

/**
 * Icônes de l'application installée déclarées par le manifeste (MO-02) : 192 et 512 px, et la
 * variante masquable, dont le symbole tient dans la zone sûre que le système découpe (cercle,
 * carré arrondi). Motif provisoire : l'œillet du mot-symbole, en attendant l'icône validée par le
 * propriétaire (plan 16, décision 3).
 */
export async function GET(_request: Request, context: { params: Promise<{ format: string }> }) {
  const { format } = await context.params
  if (!isAppIconFormat(format)) return new Response(null, { status: 404 })
  const icon = MANIFEST_ICONS[format]
  return appIconResponse(appIconSpec(icon.size, icon.purpose), requireInstallPalette().light)
}
