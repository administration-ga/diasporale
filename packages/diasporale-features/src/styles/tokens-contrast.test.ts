// @vitest-environment node
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

/**
 * Cliquet de la charte « Sable de la diaspora » : il relit `tokens.css`,
 * résout les renvois `var(--…)` et recalcule chaque contraste annoncé
 * (WCAG 2.1) — texte ≥ 4,5:1, contour de commande et anneau de focus ≥ 3:1 —
 * dans les deux thèmes. Il vérifie aussi que le contrat de thème du moteur
 * est couvert, et que le thème sombre ne redéclare aucune primitive.
 */

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8")

function block(selectorStart: string): string {
  const start = css.indexOf(selectorStart)
  if (start < 0) throw new Error(`bloc introuvable : ${selectorStart}`)
  const open = css.indexOf("{", start)
  let depth = 0
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1
    if (css[index] === "}") depth -= 1
    if (depth === 0) return css.slice(open + 1, index)
  }
  throw new Error(`bloc non fermé : ${selectorStart}`)
}

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>()
  const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, "")
  for (const match of withoutComments.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(match[1]!, match[2]!.trim())
  return out
}

const LIGHT = declarations(block('[data-charte="diasporale"] {'))
const DARK_OVERRIDES = declarations(block('.dark [data-charte="diasporale"],'))
const DARK = new Map([...LIGHT, ...DARK_OVERRIDES])
const THEMES = { clair: LIGHT, sombre: DARK } as const

function resolve(theme: Map<string, string>, name: string, depth = 0): string {
  if (depth > 12) throw new Error(`renvoi circulaire : ${name}`)
  const value = theme.get(name)
  if (value === undefined) throw new Error(`jeton absent : ${name}`)
  const reference = /^var\((--[\w-]+)\)$/.exec(value)
  return reference ? resolve(theme, reference[1]!, depth + 1) : value
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) throw new Error(`couleur non opaque ou non hexadécimale : ${hex}`)
  const channels = [0, 2, 4].map((offset) => Number.parseInt(match[1]!.slice(offset, offset + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(theme: Map<string, string>, foreground: string, background: string): number {
  const a = luminance(resolve(theme, foreground))
  const b = luminance(resolve(theme, background))
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** Paires texte / fond tenues à 4,5:1 dans les deux thèmes. */
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
  ["--destructive-foreground", "--destructive"],
  ["--success", "--card"],
  ["--warning", "--card"],
  ["--on-fill", "--primary-fill"],
  ["--ink-500", "--background"],
  ["--ink-600", "--card"],
  ["--sidebar-foreground", "--sidebar"],
  ["--sidebar-primary-foreground", "--sidebar-primary"],
  ["--sidebar-accent-foreground", "--sidebar-accent"],
  ["--esp-segment-on-fg", "--esp-segment-on"],
  ["--esp-immersive-on-ink", "--esp-immersive-ink"],
  ["--dg-tag-fg", "--dg-tag-bg"],
  ["--dg-tag-code", "--dg-tag-bg"],
  ["--dg-tag-diaspora-fg", "--dg-tag-diaspora-bg"],
  ["--dg-monument", "--card"],
  ["--dg-official-fg", "--dg-official-bg"],
  ["--dg-verified-fg", "--dg-verified-bg"],
  ["--dg-agent-fg", "--dg-agent-bg"],
  ["--dg-community-fg", "--dg-community-bg"],
  ["--dg-sponsored-fg", "--dg-sponsored-bg"],
  ["--dg-moderation-pending-fg", "--dg-moderation-pending-bg"],
  ["--dg-moderation-published-fg", "--dg-moderation-published-bg"],
  ["--dg-moderation-rejected-fg", "--dg-moderation-rejected-bg"],
  ["--dg-demo-fg", "--dg-demo-bg"],
  ...[1, 2, 3, 4, 5, 6].map((index) => ["--esp-on-avatar", `--esp-ava-${index}`] as const),
]

/** Contours de commande et focus (WCAG 1.4.11) : 3:1 sur les surfaces où ils vivent. */
const NON_TEXT_PAIRS: readonly (readonly [string, string])[] = [
  ["--input", "--card"],
  ["--input", "--background"],
  ["--ring", "--card"],
  ["--ring", "--background"],
]

/** Le contrat de thème que les composants du moteur consomment (noms shadcn, ui-v2, --esp-*). */
const CONTRACT = [
  "--background", "--foreground", "--card", "--card-foreground", "--popover", "--popover-foreground",
  "--primary", "--primary-foreground", "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
  "--accent", "--accent-foreground", "--destructive", "--destructive-foreground", "--border", "--input", "--ring",
  "--success", "--warning", "--sidebar", "--sidebar-foreground", "--sidebar-primary", "--sidebar-border",
  "--primary-50", "--primary-500", "--primary-600", "--primary-fill", "--on-fill",
  "--ink-0", "--ink-100", "--ink-500", "--ink-600", "--ink-900",
  "--info-500", "--success-500", "--warning-500", "--danger-500", "--danger-fill",
  "--radius", "--shadow-sm", "--shadow-focus", "--font-sans", "--font-display", "--font-mono",
  "--esp-surface-card", "--esp-shadow-card", "--esp-mobilebar-bg", "--esp-segment-on", "--esp-segment-on-fg",
  "--esp-on-avatar", "--esp-ava-1", "--esp-ava-6", "--esp-neutral-chip", "--esp-immersive-ink", "--esp-immersive-on-ink",
] as const

describe("charte « Sable de la diaspora » — jetons", () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    describe(`thème ${name}`, () => {
      it.each(TEXT_PAIRS)("texte %s sur %s ≥ 4,5:1", (foreground, background) => {
        expect(contrast(theme, foreground, background)).toBeGreaterThanOrEqual(4.5)
      })

      it.each(NON_TEXT_PAIRS)("contour %s sur %s ≥ 3:1", (foreground, background) => {
        expect(contrast(theme, foreground, background)).toBeGreaterThanOrEqual(3)
      })

      it("couvre le contrat de thème du moteur", () => {
        expect(CONTRACT.filter((token) => !theme.has(token))).toEqual([])
      })
    })
  }

  it("le thème sombre ré-route des rôles sans redéclarer de primitive", () => {
    const redeclared = [...DARK_OVERRIDES.keys()].filter((token) => /^--dg-(sable|gres|encre|bleu|vert|ambre|rose|nuit|drapeau|ava|papier|ombre|font)/.test(token))
    expect(redeclared).toEqual([])
  })

  it("les rôles ne portent aucune valeur littérale : seules les primitives en ont", () => {
    const literalRoles = [...LIGHT, ...DARK_OVERRIDES].filter(
      ([token, value]) => !token.startsWith("--dg-") && /#[0-9a-f]{3,8}\b|rgba?\(/i.test(value),
    )
    expect(literalRoles.map(([token]) => token)).toEqual([])
  })

  it("les couleurs du drapeau ne servent qu'au filet décoratif", () => {
    const users = [...LIGHT, ...DARK_OVERRIDES]
      .filter(([token, value]) => token !== "--dg-stripe" && /--dg-drapeau-/.test(value))
      .map(([token]) => token)
    expect(users).toEqual([])
  })
})
