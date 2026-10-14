// @vitest-environment node
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { cascade, contrastRatio, cssBlock, declarations } from "./contrast"

/**
 * Cliquet du thème DIASPORALE tel que le moteur le sert : charte de base
 * d'ANTIA (`packages/ui/src/styles/charte.css`), puis le thème
 * `packages/ui/src/themes/diasporale.css` écrit par cette session. La cascade
 * est rejouée avec ses spécificités réelles — en sombre, le bloc sombre de la
 * base (0,2,0) passe AVANT le bloc clair du thème (0,1,0) : tout rôle que le
 * thème oublierait de redéclarer en sombre ferait reparaître le bleu du moteur.
 */

const ENGINE_UI = new URL("../../../../../ANTIA/packages/ui/src/", import.meta.url)
const base = readFileSync(new URL("styles/charte.css", ENGINE_UI), "utf8")
const theme = readFileSync(new URL("themes/diasporale.css", ENGINE_UI), "utf8")

const BASE_LIGHT = declarations(cssBlock(base, "[data-charte] {"))
const BASE_DARK = declarations(cssBlock(base, ".dark[data-charte],"))
const THEME_LIGHT = declarations(cssBlock(theme, '[data-charte="diasporale"] {'))
const THEME_DARK = declarations(cssBlock(theme, '.dark[data-charte="diasporale"],'))

const THEMES = {
  clair: cascade(BASE_LIGHT, THEME_LIGHT),
  sombre: cascade(BASE_LIGHT, THEME_LIGHT, BASE_DARK, THEME_DARK),
} as const

const TEXT_PAIRS: readonly (readonly [string, string])[] = [
  ["--foreground", "--background"],
  ["--card-foreground", "--card"],
  ["--popover-foreground", "--popover"],
  ["--muted-foreground", "--background"],
  ["--muted-foreground", "--card"],
  ["--muted-foreground", "--muted"],
  ["--secondary-foreground", "--secondary"],
  ["--accent-foreground", "--accent"],
  ["--primary-foreground", "--primary"],
  ["--primary", "--card"],
  ["--primary", "--background"],
  ["--destructive", "--card"],
  ["--success", "--card"],
  ["--warning", "--card"],
  ["--on-fill", "--primary-fill"],
  ["--ink-500", "--background"],
  ["--ink-500", "--card"],
  ["--ink-600", "--card"],
  ["--ink-900", "--ink-0"],
  ["--sidebar-foreground", "--sidebar"],
  ["--sidebar-primary-foreground", "--sidebar-primary"],
  ["--sidebar-accent-foreground", "--sidebar-accent"],
  ["--esp-segment-on-fg", "--esp-segment-on"],
  ["--esp-tone-blue", "--esp-tone-blue-bg"],
  ["--esp-tone-amber", "--esp-tone-amber-bg"],
  ["--esp-tone-rose", "--esp-tone-rose-bg"],
  ["--esp-tone-green", "--esp-tone-green-bg"],
  ...[1, 2, 3, 4, 5, 6].map((index) => ["--esp-on-avatar", `--esp-ava-${index}`] as const),
]

/** Le titre de la bannière se lit sur les deux arrêts de son dégradé (`--esp-banner`). */
const BANNER_STOPS = { clair: ["--esp-blue-700", "--esp-blue-800"], sombre: ["--esp-blue-800", "--esp-blue-950"] } as const

const NON_TEXT_PAIRS: readonly (readonly [string, string])[] = [
  ["--input", "--card"],
  ["--input", "--background"],
  ["--ring", "--card"],
  ["--ring", "--background"],
]

describe("thème DIASPORALE servi par le moteur — cascade base + thème", () => {
  it("le bloc sombre du thème redéclare chaque rôle du bloc sombre de la base", () => {
    expect([...BASE_DARK.keys()].filter((token) => !THEME_DARK.has(token))).toEqual([])
  })

  for (const [name, resolved] of Object.entries(THEMES)) {
    describe(`thème ${name}`, () => {
      it.each(TEXT_PAIRS)("texte %s sur %s ≥ 4,5:1", (foreground, background) => {
        expect(contrastRatio(resolved, foreground, background)).toBeGreaterThanOrEqual(4.5)
      })

      it.each(BANNER_STOPS[name as keyof typeof BANNER_STOPS])("titre de bannière sur l'arrêt %s ≥ 4,5:1", (stop) => {
        expect(contrastRatio(resolved, "--esp-on-banner", stop)).toBeGreaterThanOrEqual(4.5)
      })

      it.each(NON_TEXT_PAIRS)("contour %s sur %s ≥ 3:1", (foreground, background) => {
        expect(contrastRatio(resolved, foreground, background)).toBeGreaterThanOrEqual(3)
      })
    })
  }

  it("garde le bleu Gabon comme bleu d'action et le sable comme fond", () => {
    expect(THEMES.clair.get("--esp-blue-500")).toBe("#0072b9")
    expect(THEMES.clair.get("--esp-neutral-100")).toBe("#f7f6f2")
  })
})
