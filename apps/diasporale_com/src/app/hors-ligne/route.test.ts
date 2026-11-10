// @vitest-environment node
import { fileURLToPath } from "node:url"

import { getFixedT, type Locale } from "@diasporale/features/i18n"
import { afterEach, describe, expect, it, vi } from "vitest"

import { INSTALL_PALETTE_VARIABLE, serializeInstallPalette } from "@/lib/install-palette"
import { readInstallPalette } from "@/lib/install-palette-files"
import { offlinePageHtml } from "@/lib/offline-page"

/** La langue de la requête, sans requête Next : la route ne lit rien d'autre de la personne. */
const request = vi.hoisted(() => ({ locale: "fr" as Locale }))
vi.mock("@/i18n/server", () => ({ getRequestLocale: async () => request.locale }))

import { GET } from "./route"

/** MO-05 : la page hors-ligne, seule réserve du script de fond. */

const palette = readInstallPalette(fileURLToPath(new URL("../../../", import.meta.url)))

afterEach(() => {
  vi.unstubAllEnvs()
  request.locale = "fr"
})

describe("page hors-ligne", () => {
  it("dit l'absence de réseau en français et en anglais, la langue de la personne d'abord", () => {
    for (const locale of ["fr", "en"] as const) {
      const html = offlinePageHtml({ locale, palette })
      const other = locale === "fr" ? "en" : "fr"
      const own = html.indexOf(`<section lang="${locale}">`)
      const second = html.indexOf(`<section lang="${other}">`)
      expect(own).toBeGreaterThan(-1)
      expect(second).toBeGreaterThan(own)
      expect(html).toContain(`<html lang="${locale}"`)
      for (const language of ["fr", "en"] as const) {
        const t = getFixedT(language)
        expect(html).toContain(t("installableApp.offline.retry"))
        expect(html).toContain(t("installableApp.offline.title").replace("'", "&#39;"))
      }
      expect(html.match(/<h1>/g)).toHaveLength(1)
    }
  })

  it("est à la marque : mot-symbole, œillet et couleurs de la charte, en clair et en sombre", () => {
    const html = offlinePageHtml({ locale: "fr", palette })
    expect(html).toContain(`${getFixedT("fr")("brand.name")}</p>`)
    expect(html).toContain('class="eyelet"')
    for (const color of [palette.light.background, palette.light.accent, palette.dark.background, palette.dark.foreground]) expect(html).toContain(color)
    expect(html).toContain("prefers-color-scheme: dark")
  })

  it("se suffit à elle-même : aucun script, aucune feuille, police ou image à charger", () => {
    const html = offlinePageHtml({ locale: "en", palette })
    expect(html).not.toMatch(/<script|<link|<img|src=|url\(|https?:/i)
  })

  it("sans palette, prend les couleurs du système plutôt que d'en inventer", () => {
    const html = offlinePageHtml({ locale: "fr", palette: null })
    expect(html).toContain("--bg:Canvas")
    expect(html).not.toMatch(/#[0-9a-f]{6}/i)
  })

  it("la route sert la page dans la langue de la requête, jamais gardée par le navigateur", async () => {
    vi.stubEnv(INSTALL_PALETTE_VARIABLE, serializeInstallPalette(palette))
    request.locale = "en"
    const response = await GET()
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8")
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    const html = await response.text()
    expect(html).toBe(offlinePageHtml({ locale: "en", palette }))
  })
})
