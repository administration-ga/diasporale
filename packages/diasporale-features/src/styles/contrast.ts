/**
 * Outils des cliquets de contraste : lecture des déclarations d'un bloc CSS,
 * résolution des renvois `var(--…)` et des mélanges `color-mix(in srgb, …)`,
 * ratio WCAG 2.1. Utilisés par les tests, jamais par l'interface.
 */

export type Declarations = Map<string, string>

/** Corps du premier bloc dont le sélecteur commence par `selectorStart` (commentaires ignorés). */
export function cssBlock(css: string, selectorStart: string): string {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const start = code.indexOf(selectorStart)
  if (start < 0) throw new Error(`bloc introuvable : ${selectorStart}`)
  const open = code.indexOf("{", start)
  let depth = 0
  for (let index = open; index < code.length; index += 1) {
    if (code[index] === "{") depth += 1
    if (code[index] === "}") depth -= 1
    if (depth === 0) return code.slice(open + 1, index)
  }
  throw new Error(`bloc non fermé : ${selectorStart}`)
}

export function declarations(body: string): Declarations {
  const out: Declarations = new Map()
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(match[1]!, match[2]!.trim())
  return out
}

/** Superpose des couches de déclarations : la dernière l'emporte, comme dans la cascade. */
export function cascade(...layers: Declarations[]): Declarations {
  return new Map(layers.flatMap((layer) => [...layer]))
}

export function resolveToken(theme: Declarations, name: string, depth = 0): string {
  if (depth > 12) throw new Error(`renvoi circulaire : ${name}`)
  const value = theme.get(name)
  if (value === undefined) throw new Error(`jeton absent : ${name}`)
  const reference = /^var\((--[\w-]+)\)$/.exec(value)
  if (reference) return resolveToken(theme, reference[1]!, depth + 1)
  const mix = /^color-mix\(in srgb,\s*(var\(--[\w-]+\)|#[0-9a-f]{6})\s+(\d+(?:\.\d+)?)%,\s*(var\(--[\w-]+\)|#[0-9a-f]{6})\)$/i.exec(value)
  if (mix) return mixSrgb(resolveOperand(theme, mix[1]!, depth), resolveOperand(theme, mix[3]!, depth), Number(mix[2]) / 100)
  return value
}

function resolveOperand(theme: Declarations, operand: string, depth: number): string {
  const reference = /^var\((--[\w-]+)\)$/.exec(operand)
  return reference ? resolveToken(theme, reference[1]!, depth + 1) : operand
}

/** `color-mix(in srgb, a p%, b)` de deux couleurs opaques : mélange canal par canal dans l'espace sRGB encodé. */
function mixSrgb(first: string, second: string, weight: number): string {
  const channels = (hex: string) => {
    const match = /^#([0-9a-f]{6})$/i.exec(hex)
    if (!match) throw new Error(`mélange d'une couleur non opaque ou non hexadécimale : ${hex}`)
    return [0, 2, 4].map((offset) => Number.parseInt(match[1]!.slice(offset, offset + 2), 16))
  }
  const a = channels(first)
  const b = channels(second)
  return `#${a.map((channel, index) => Math.round(channel * weight + b[index]! * (1 - weight)).toString(16).padStart(2, "0")).join("")}`
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) throw new Error(`couleur non opaque ou non hexadécimale : ${hex}`)
  const channels = [0, 2, 4].map((offset) => Number.parseInt(match[1]!.slice(offset, offset + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Luminance relative d'un jeton résolu (pour comparer deux surfaces, pas seulement un texte). */
export function tokenLuminance(theme: Declarations, token: string): number {
  return luminance(resolveToken(theme, token))
}

export function contrastRatio(theme: Declarations, foreground: string, background: string): number {
  const a = luminance(resolveToken(theme, foreground))
  const b = luminance(resolveToken(theme, background))
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
