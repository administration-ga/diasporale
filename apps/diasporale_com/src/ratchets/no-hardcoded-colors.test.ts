import { describe, expect, it } from "vitest"

import { productSources } from "./sources"

/**
 * Cliquet « aucune couleur en dur » (invariant de la charte) : une couleur
 * littérale ne vit QUE dans `styles/tokens.css`, sous
 * `[data-charte="diasporale"]`. Partout ailleurs, des rôles (`bg-card`,
 * `text-muted-foreground`, `var(--dg-…)`) — jamais `#hex`, `rgb()`, `hsl()`,
 * ni la palette Tailwind (`bg-red-500`, `text-white`).
 */

const TOKENS_FILE = "packages/diasporale-features/src/styles/tokens.css"

const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose"
const UTILITY = "bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|shadow|accent|caret|divide|placeholder"

const RULES: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: "hexadécimal", pattern: /(?<![\w&/-])#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})(?![\w-])/gi },
  { name: "fonction de couleur", pattern: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(\s*[\d.]/gi },
  { name: "palette Tailwind", pattern: new RegExp(`\\b(?:${UTILITY})-(?:${PALETTE})-\\d{2,3}\\b`, "g") },
  { name: "blanc ou noir Tailwind", pattern: new RegExp(`\\b(?:${UTILITY})-(?:white|black)\\b`, "g") },
]

describe("cliquet charte — aucune couleur en dur", () => {
  const files = productSources([".ts", ".tsx", ".css"]).filter((file) => file.path !== TOKENS_FILE)

  it("relit bien les sources du produit", () => {
    expect(files.length).toBeGreaterThan(40)
  })

  it.each(RULES)("aucune couleur $name hors du fichier de jetons", ({ pattern }) => {
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
