import { ImageResponse } from "next/og"

import type { AppIconSpec } from "./app-icon-spec"
import type { CharteSurface } from "./install-palette"

/**
 * L'image d'une icône (MO-02), dessinée par Next (`next/og`, sans dépendance nouvelle) : l'œillet
 * du mot-symbole sur le fond de page, couleurs lues dans la charte. Le moteur de rendu de
 * `next/og` ne lit pas les classes Tailwind : les styles sont donc écrits en ligne, avec les
 * seules valeurs de la palette.
 */
export function appIconResponse(spec: AppIconSpec, surface: CharteSurface): ImageResponse {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: surface.background }}>
        <div style={{ display: "flex", width: spec.outer, height: spec.outer, borderRadius: "50%", alignItems: "center", justifyContent: "center", background: surface.ink }}>
          <div style={{ display: "flex", width: spec.inner, height: spec.inner, borderRadius: "50%", background: surface.eyelet }} />
        </div>
      </div>
    ),
    { width: spec.size, height: spec.size },
  )
}
