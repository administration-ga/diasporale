import { describe, expect, it } from "vitest"

import { productSources } from "./sources"

/**
 * Cliquet « aucune couleur en dur » (invariant de la charte) : depuis PD0, les
 * couleurs de DIASPORALE vivent dans le thème du moteur
 * (`ANTIA/packages/ui/src/themes/diasporale.css`). Dans le produit, AUCUNE
 * couleur littérale, sans exception depuis la charte v2 (15/10/2026 : le filet
 * tricolore et les couleurs du drapeau sont retirés). Partout, des rôles
 * (`bg-card`, `text-muted-foreground`, `var(--dg-…)`) — jamais `#hex`, `rgb()`,
 * `hsl()`, ni la palette Tailwind (`bg-red-500`, `text-white`).
 */

const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose"
const UTILITY = "bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|shadow|accent|caret|divide|placeholder"

const RULES: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: "hexadécimal", pattern: /(?<![\w&/-])#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})(?![\w-])/gi },
  { name: "fonction de couleur", pattern: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(\s*[\d.]/gi },
  { name: "palette Tailwind", pattern: new RegExp(`\\b(?:${UTILITY})-(?:${PALETTE})-\\d{2,3}\\b`, "g") },
  { name: "blanc ou noir Tailwind", pattern: new RegExp(`\\b(?:${UTILITY})-(?:white|black)\\b`, "g") },
]

describe("cliquet charte — aucune couleur en dur", () => {
  const files = productSources([".ts", ".tsx", ".css"])

  it("plus aucune référence au drapeau dans le produit (charte v2)", () => {
    const hits = files.filter((file) => /--dg-drapeau|--dg-stripe/.test(file.text)).map((file) => file.path)
    expect(hits).toEqual([])
  })

  it("relit bien les sources du produit", () => {
    expect(files.length).toBeGreaterThan(40)
  })

  it.each(RULES)("aucune couleur $name dans le produit", ({ pattern }) => {
    const hits = files.flatMap((file) =>
      file.text.split("\n").flatMap((line, index) => {
        // Les commentaires peuvent citer une couleur (mesure, justification) ; le code, jamais.
        const code = line.replace(/\/\/.*$|\/\*.*?\*\/|^\s*\*.*$/g, "")
        return [...code.matchAll(pattern)].map((match) => `${file.path}:${index + 1} ${match[0]}`)
      }),
    )
    expect(hits).toEqual([])
  })
})
