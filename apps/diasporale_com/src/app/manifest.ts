import type { MetadataRoute } from "next"

import { getAppT } from "@/i18n/server"
import { installPalette } from "@/lib/install-palette"
import { webManifest } from "@/lib/web-manifest"

/**
 * Manifeste de l'application installable (MO-02), lié par Next dans l'en-tête de chaque page. Le
 * navigateur le demande sans cookie : sa langue suit alors celle du navigateur (`Accept-Language`),
 * sinon le français.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { locale, t } = await getAppT()
  return webManifest({ locale, t, palette: installPalette() })
}
