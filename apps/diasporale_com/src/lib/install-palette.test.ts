// @vitest-environment node
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { PHASE_DEVELOPMENT_SERVER } from "next/constants"
import { afterEach, describe, expect, it, vi } from "vitest"

import diasporaleNextConfig from "../../next.config"
import {
  INSTALL_PALETTE_VARIABLE,
  SURFACE_TOKENS,
  installPalette,
  paletteFromSheets,
  parseInstallPalette,
  requireInstallPalette,
  resolveToken,
  serializeInstallPalette,
} from "./install-palette"
import { CHARTE_SHEET_PATHS, readInstallPalette } from "./install-palette-files"

/**
 * MO-02 : les couleurs de l'application installée sont lues dans les jetons de la charte, jamais
 * écrites. Les attentes ci-dessous relisent les feuilles par une autre voie (expression sur le
 * texte brut) : la palette suit la charte quand la charte change.
 */

const APP_DIR = fileURLToPath(new URL("../../", import.meta.url))
const theme = readFileSync(join(APP_DIR, CHARTE_SHEET_PATHS.theme), "utf8")
const palette = readInstallPalette(APP_DIR)

/** La valeur hexadécimale écrite en toutes lettres pour un jeton, dans le premier bloc qui suit `selector`. */
function literal(css: string, selector: string, token: string): string {
  const after = css.slice(css.indexOf(selector))
  const match = new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(after)
  if (!match) throw new Error(`${token} introuvable après ${selector}`)
  return match[1]!.toLowerCase()
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("palette de l'application installée — lue dans la charte", () => {
  it("donne une couleur opaque à chaque rôle, en clair comme en sombre", () => {
    for (const mode of [palette.light, palette.dark]) {
      expect(Object.keys(mode).sort()).toEqual(Object.keys(SURFACE_TOKENS).sort())
      for (const color of Object.values(mode)) expect(color).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it("le fond clair est le papier du thème Sable, le fond sombre sa nuit brune", () => {
    expect(palette.light.background).toBe(literal(theme, '[data-charte="diasporale"] {', "--background"))
    expect(palette.dark.background).toBe(literal(theme, '[data-charte="diasporale"] {', "--esp-night-bg"))
    expect(palette.dark.background).not.toBe(palette.light.background)
  })

  it("l'œillet du mot-symbole : disque de la couleur du fond, anneau de l'encre du texte", () => {
    for (const mode of [palette.light, palette.dark]) {
      expect(mode.eyelet).toBe(mode.background)
      expect(mode.ink).toBe(mode.foreground)
      expect(mode.ink).not.toBe(mode.background)
    }
  })
})

describe("résolution d'un jeton", () => {
  const sheet = (body: string) => new Map([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1]!, match[2]!.trim()]))

  it("suit les renvois et normalise l'écriture courte", () => {
    const tokens = sheet("--a: var(--b); --b: var(--c); --c: #AbC;")
    expect(resolveToken(tokens, "--a")).toBe("#aabbcc")
  })

  it("mélange deux couleurs opaques comme color-mix en srgb", () => {
    const tokens = sheet("--paper: #ffffff; --ink: #000000; --mix: color-mix(in srgb, var(--ink) 50%, var(--paper));")
    expect(resolveToken(tokens, "--mix")).toBe("#808080")
  })

  it("refuse une couleur transparente, un jeton absent ou un renvoi circulaire", () => {
    expect(() => resolveToken(sheet("--a: transparent;"), "--a")).toThrow(/--a/)
    expect(() => resolveToken(sheet("--a: var(--absent);"), "--a")).toThrow(/--absent/)
    expect(() => resolveToken(sheet("--a: var(--b); --b: var(--a);"), "--a")).toThrow(/circulaire/)
  })

  it("une feuille sans le bloc attendu fait échouer la lecture, jamais une couleur devinée", () => {
    expect(() => paletteFromSheets({ base: "", theme, extras: "" })).toThrow(/bloc introuvable/)
  })
})

describe("palette inscrite à la construction", () => {
  it("fait l'aller-retour par sa forme sérialisée", () => {
    expect(parseInstallPalette(serializeInstallPalette(palette))).toEqual(palette)
  })

  it.each([
    ["absente", undefined],
    ["illisible", "{"],
    ["sans le mode sombre", JSON.stringify({ light: palette.light })],
    ["avec un rôle en trop", JSON.stringify({ ...palette, light: { ...palette.light, extra: palette.light.background } })],
    ["avec une couleur qui n'est pas #rrggbb", JSON.stringify({ ...palette, dark: { ...palette.dark, accent: "red" } })],
  ])("une forme %s ne donne aucune palette", (_label, raw) => {
    expect(parseInstallPalette(raw)).toBeNull()
  })

  it("next.config.ts la lit dans la charte et la pose pour la construction", () => {
    const config = diasporaleNextConfig(PHASE_DEVELOPMENT_SERVER)
    expect(parseInstallPalette(config.env?.[INSTALL_PALETTE_VARIABLE])).toEqual(palette)
    // La configuration commune du moteur garde ses propres variables.
    expect(config.env).toHaveProperty("NEXT_PUBLIC_CONVEX_URL")
  })

  it("se lit dans la variable posée par next.config.ts", () => {
    vi.stubEnv(INSTALL_PALETTE_VARIABLE, serializeInstallPalette(palette))
    expect(installPalette()).toEqual(palette)
    expect(requireInstallPalette()).toEqual(palette)
  })

  it("absente, les icônes refusent de se dessiner plutôt que d'inventer une couleur", () => {
    vi.stubEnv(INSTALL_PALETTE_VARIABLE, undefined)
    expect(installPalette()).toBeNull()
    expect(() => requireInstallPalette()).toThrow(INSTALL_PALETTE_VARIABLE)
  })
})
