import { APPLE_ICON_SIZE, appIconSpec } from "@/lib/app-icon-spec"
import { appIconResponse } from "@/lib/app-icon"
import { requireInstallPalette } from "@/lib/install-palette"

/**
 * Icône Apple (MO-02) : celle que Safari pose sur l'écran d'accueil de l'iPhone. Fond plein (iOS
 * remplit de noir une transparence, puis arrondit lui-même les coins). Motif provisoire (décision 3).
 */
export const size = { width: APPLE_ICON_SIZE, height: APPLE_ICON_SIZE }
export const contentType = "image/png"

export default function AppleIcon() {
  return appIconResponse(appIconSpec(APPLE_ICON_SIZE), requireInstallPalette().light)
}
