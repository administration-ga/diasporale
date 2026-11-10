import { appIconSpec, TAB_ICON_SIZE } from "@/lib/app-icon-spec"
import { appIconResponse } from "@/lib/app-icon"
import { requireInstallPalette } from "@/lib/install-palette"

/** Icône d'onglet (MO-02), liée par Next dans l'en-tête de chaque page. Motif provisoire (décision 3). */
export const size = { width: TAB_ICON_SIZE, height: TAB_ICON_SIZE }
export const contentType = "image/png"

export default function Icon() {
  return appIconResponse(appIconSpec(TAB_ICON_SIZE), requireInstallPalette().light)
}
