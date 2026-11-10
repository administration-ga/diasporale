import type { Locale } from "@diasporale/features/i18n"
import type { MetadataRoute } from "next"

import { APP_ICON_FORMATS, MANIFEST_ICONS } from "./app-icon-spec"
import type { InstallPalette } from "./install-palette"
import { routes } from "./routes"

type Translate = (key: string, options?: Record<string, unknown>) => string

/**
 * Le manifeste de l'application installable (MO-02) : nom et description dans la langue de la
 * requête, adresse de départ sur le fil (la garde mène à la porte sans session), ouverture en
 * plein écran comme une application, icônes et couleurs lues dans la charte. Les adresses
 * viennent de la table des routes.
 *
 * Pas d'orientation imposée : le téléphone tourne librement (accessibilité). Sans palette (outil
 * hors de Next), les couleurs sont omises plutôt que devinées : le manifeste reste valable.
 */
export function webManifest(input: { readonly locale: Locale; readonly t: Translate; readonly palette: InstallPalette | null }): MetadataRoute.Manifest {
  const name = input.t("brand.name")
  return {
    id: routes.home(),
    name,
    short_name: name,
    description: input.t("meta.description"),
    lang: input.locale,
    dir: "ltr",
    start_url: routes.feed(),
    scope: routes.home(),
    display: "standalone",
    categories: ["social"],
    ...(input.palette ? { theme_color: input.palette.light.background, background_color: input.palette.light.background } : {}),
    icons: APP_ICON_FORMATS.map((format) => {
      const icon = MANIFEST_ICONS[format]
      return { src: routes.appIcon(format), sizes: `${icon.size}x${icon.size}`, type: "image/png", purpose: icon.purpose }
    }),
  }
}
