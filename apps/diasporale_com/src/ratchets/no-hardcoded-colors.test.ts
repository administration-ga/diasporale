import { describe, expect, it } from "vitest"

import { productSources } from "./sources"

/**
 * Cliquet « aucune couleur en dur » (invariant de la charte) : depuis PD0, les
 * couleurs de DIASPORALE vivent dans le thème du moteur
 * (`ANTIA/packages/ui/src/themes/diasporale.css`) ; ici, seules les trois couleurs
 * du drapeau du filet décoratif (`extras.css`). Partout ailleurs, des rôles (`bg-card`,
 * `text-muted-foreground`, `var(--dg-…)`) — jamais `#hex`, `rgb()`, `hsl()`,
 * ni la palette Tailwind (`bg-red-500`, `text-white`).
 */

/**
 * Rôles propres posés sur le contrat du moteur : renvois seulement. Seules les
 * trois couleurs du drapeau du filet décoratif y sont littérales, ligne par ligne.
 */
const EXTRAS_FILE = "packages/diasporale-features/src/styles/extras.css"
const FLAG_LINE = /^\s*--dg-drapeau-(?:vert|jaune|bleu):\s*#[0-9a-f]{6};\s*$/i

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

  it("dans les rôles propres, seul le filet tricolore porte des couleurs littérales", () => {
    expect(FLAG_LINE.test("  --dg-drapeau-vert: #009e60;")).toBe(true)
    expect(FLAG_LINE.test("  --dg-tag-bg: #efebe0;")).toBe(false)
  })

  it("relit bien les sources du produit", () => {
    expect(files.length).toBeGreaterThan(40)
  })

  it.each(RULES)("aucune couleur $name dans le produit, hors du filet tricolore", ({ pattern }) => {
    const hits = files.flatMap((file) =>
      file.text.split("\n").flatMap((line, index) => {
        if (file.path === EXTRAS_FILE && FLAG_LINE.test(line)) return []
        // Les commentaires peuvent citer une couleur (mesure, justification) ; le code, jamais.
        const code = line.replace(/\/\/.*$|\/\*.*?\*\/|^\s*\*.*$/g, "")
        return [...code.matchAll(pattern)].map((match) => `${file.path}:${index + 1} ${match[0]}`)
      }),
    )
    expect(hits).toEqual([])
  })
})
