// @vitest-environment node
import { fileURLToPath } from "node:url"

import { getFixedT, type Locale } from "@diasporale/features/i18n"
import { describe, expect, it } from "vitest"

import { APP_ICON_FORMATS, APPLE_ICON_SIZE, MANIFEST_ICONS, TAB_ICON_SIZE, appIconSpec, isAppIconFormat } from "./app-icon-spec"
import { readInstallPalette } from "./install-palette-files"
import { routes } from "./routes"
import { webManifest } from "./web-manifest"

/** MO-02 : le manifeste de l'application installable et la géométrie de ses icônes. */

const palette = readInstallPalette(fileURLToPath(new URL("../../", import.meta.url)))

function manifestIn(locale: Locale) {
  const fixed = getFixedT(locale)
  return webManifest({ locale, t: (key, options = {}) => fixed(key, options), palette })
}

describe("manifeste de l'application installable", () => {
  it("s'ouvre comme une application, sur le fil, à la portée du site entier", () => {
    const manifest = manifestIn("fr")
    expect(manifest.display).toBe("standalone")
    expect(manifest.start_url).toBe(routes.feed())
    expect(manifest.scope).toBe(routes.home())
    expect(manifest.id).toBe(routes.home())
    expect(manifest.orientation).toBeUndefined()
  })

  it("porte le nom de la marque et la description dans la langue de la requête", () => {
    const fr = manifestIn("fr")
    const en = manifestIn("en")
    expect(fr.name).toBe(getFixedT("fr")("brand.name"))
    expect(fr.short_name).toBe(fr.name)
    expect(fr.description).toBe(getFixedT("fr")("meta.description"))
    expect(en.description).toBe(getFixedT("en")("meta.description"))
    expect(en.description).not.toBe(fr.description)
    expect([fr.lang, en.lang]).toEqual(["fr", "en"])
  })

  it("déclare les icônes 192, 512 et masquable, toutes servies par la table des routes", () => {
    const icons = manifestIn("fr").icons ?? []
    expect(icons).toEqual([
      { src: routes.appIcon("192"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: routes.appIcon("512"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: routes.appIcon("masquable"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ])
  })

  it("prend ses couleurs dans la charte, et les omet plutôt que de les deviner", () => {
    const manifest = manifestIn("fr")
    expect(manifest.theme_color).toBe(palette.light.background)
    expect(manifest.background_color).toBe(palette.light.background)
    const fixed = getFixedT("fr")
    const bare = webManifest({ locale: "fr", t: (key, options = {}) => fixed(key, options), palette: null })
    expect(bare.theme_color).toBeUndefined()
    expect(bare.background_color).toBeUndefined()
  })

  it("aucune adresse complète : tout reste sur l'origine du site", () => {
    const manifest = manifestIn("en")
    const addresses = [manifest.start_url, manifest.scope, manifest.id, ...(manifest.icons ?? []).map((icon) => icon.src)]
    for (const address of addresses) expect(address).toMatch(/^\/(?!\/)/)
  })
})

describe("icônes — l'œillet du mot-symbole", () => {
  it("garde les proportions du mot-symbole (disque de 10 dans un anneau de 14)", () => {
    for (const size of [TAB_ICON_SIZE, APPLE_ICON_SIZE, 192, 512]) {
      const spec = appIconSpec(size)
      expect(spec.size).toBe(size)
      expect(spec.inner / spec.outer).toBeCloseTo(10 / 14, 1)
      expect(spec.outer).toBeLessThan(size)
    }
  })

  it("la variante masquable tient dans la zone sûre (cercle de 80 % du côté)", () => {
    const icon = MANIFEST_ICONS.masquable
    const spec = appIconSpec(icon.size, icon.purpose)
    expect(icon.purpose).toBe("maskable")
    expect(spec.outer).toBeLessThanOrEqual(icon.size * 0.8)
    expect(spec.outer).toBeLessThan(appIconSpec(icon.size).outer)
  })

  it("ne connaît que les formats du manifeste", () => {
    expect(APP_ICON_FORMATS.every(isAppIconFormat)).toBe(true)
    for (const unknown of ["1024", "../manifest", "", "MASQUABLE"]) expect(isAppIconFormat(unknown)).toBe(false)
  })
})
