/**
 * Lecture sur le disque des feuilles de la charte (MO-02). Appelée par `next.config.ts` (à la
 * construction et au lancement du développement, dossier de l'application comme répertoire
 * courant) et par les tests. Jamais au service : la palette arrive alors inscrite dans le code.
 *
 * Les chemins sont ceux de l'espace de travail ECOSYSTEMES, le même que le Dockerfile copie :
 * `ANTSIA/` à côté de `DIASPORALE/`.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { paletteFromSheets, type InstallPalette } from "./install-palette"

/** Les trois feuilles, depuis le dossier de l'application (`apps/diasporale_com`). */
export const CHARTE_SHEET_PATHS = {
  base: "../../../ANTSIA/packages/ui/src/styles/charte.css",
  theme: "../../../ANTSIA/packages/ui/src/themes/diasporale.css",
  extras: "../../packages/diasporale-features/src/styles/extras.css",
} as const

export function readInstallPalette(appDir: string): InstallPalette {
  const read = (path: string) => readFileSync(join(appDir, path), "utf8")
  return paletteFromSheets({
    base: read(CHARTE_SHEET_PATHS.base),
    theme: read(CHARTE_SHEET_PATHS.theme),
    extras: read(CHARTE_SHEET_PATHS.extras),
  })
}
