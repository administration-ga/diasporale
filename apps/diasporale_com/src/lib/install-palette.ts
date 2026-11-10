/**
 * Les couleurs de l'application installée (MO-02, MO-05) : barre du système, fond de
 * démarrage, icônes et page hors-ligne. Elles ne s'écrivent nulle part ici : elles sont LUES
 * dans les jetons de la charte (`ANTSIA/packages/ui/src/themes/diasporale.css`, rôles propres
 * de `extras.css`), en rejouant la cascade réelle, comme le cliquet de contraste.
 *
 * Le manifeste, les icônes et la page hors-ligne ne voient pas la feuille de style de la page :
 * il leur faut des valeurs. `next.config.ts` lit donc les jetons à la construction (et au
 * lancement du développement) et pose la palette sérialisée dans `DIASPORALE_CHARTE_PALETTE`,
 * que Next inscrit dans le code construit : aucun fichier n'est relu au service.
 *
 * Ce module est pur (aucun accès disque) : la lecture des fichiers vit dans
 * `install-palette-files.ts`, appelée par la configuration et par les tests.
 */

/** Les rôles de la charte dont l'application installée a besoin, et le jeton qui les porte. */
export const SURFACE_TOKENS = {
  /** Fond de page : barre du système, écran de démarrage, fond des icônes. */
  background: "--background",
  /** Texte principal. */
  foreground: "--foreground",
  /** Texte secondaire. */
  muted: "--muted-foreground",
  /** Lien d'action (« Réessayer »). */
  accent: "--primary",
  /** Séparateur décoratif. */
  rule: "--border",
  /** L'œillet du mot-symbole : son disque… */
  eyelet: "--dg-tag-eyelet",
  /** … et son anneau d'encre (`ring-[var(--ink-900)]` du mot-symbole). */
  ink: "--ink-900",
} as const

export type SurfaceRole = keyof typeof SURFACE_TOKENS
export type CharteSurface = Readonly<Record<SurfaceRole, string>>

/** Le thème par défaut (Sable), en clair et en sombre. */
export interface InstallPalette {
  readonly light: CharteSurface
  readonly dark: CharteSurface
}

/** La variable que `next.config.ts` pose et que Next inscrit dans le code construit. */
export const INSTALL_PALETTE_VARIABLE = "DIASPORALE_CHARTE_PALETTE"

type Declarations = ReadonlyMap<string, string>

const OPAQUE_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
const FULL_HEX = /^#[0-9a-f]{6}$/

/** Corps du premier bloc dont le sélecteur commence par `selectorStart` (commentaires ignorés). */
export function cssBlock(css: string, selectorStart: string): string {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const start = code.indexOf(selectorStart)
  if (start < 0) throw new Error(`Charte : bloc introuvable (${selectorStart}).`)
  const open = code.indexOf("{", start)
  let depth = 0
  for (let index = open; index < code.length; index += 1) {
    if (code[index] === "{") depth += 1
    if (code[index] === "}") depth -= 1
    if (depth === 0) return code.slice(open + 1, index)
  }
  throw new Error(`Charte : bloc non fermé (${selectorStart}).`)
}

/** Les propriétés personnalisées d'un bloc. */
export function declarations(body: string): Declarations {
  const out = new Map<string, string>()
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(match[1]!, match[2]!.trim())
  return out
}

/** Superpose des couches de déclarations : la dernière l'emporte, comme dans la cascade. */
export function cascade(...layers: readonly Declarations[]): Declarations {
  return new Map(layers.flatMap((layer) => [...layer]))
}

function normalizeHex(value: string): string {
  const hex = value.slice(1).toLowerCase()
  return `#${hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex}`
}

/** `color-mix(in srgb, a p%, b)` de deux couleurs opaques : mélange canal par canal. */
function mixSrgb(first: string, second: string, weight: number): string {
  const channels = (hex: string) => [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
  const a = channels(first)
  const b = channels(second)
  return `#${a.map((channel, index) => Math.round(channel * weight + b[index]! * (1 - weight)).toString(16).padStart(2, "0")).join("")}`
}

/**
 * La valeur opaque `#rrggbb` d'un jeton, renvois `var(--…)` et mélanges `color-mix(in srgb, …)`
 * résolus. Toute autre forme (transparence, mot-clé, fonction) lève : une couleur qu'on ne sait
 * pas lire n'est jamais remplacée par une couleur inventée.
 */
export function resolveToken(theme: Declarations, name: string, depth = 0): string {
  if (depth > 12) throw new Error(`Charte : renvoi circulaire (${name}).`)
  const value = theme.get(name)
  if (value === undefined) throw new Error(`Charte : jeton absent (${name}).`)
  const operand = (raw: string): string => {
    const reference = /^var\((--[\w-]+)\)$/.exec(raw)
    if (reference) return resolveToken(theme, reference[1]!, depth + 1)
    if (OPAQUE_HEX.test(raw)) return normalizeHex(raw)
    throw new Error(`Charte : ${name} n'est pas une couleur opaque lisible (${raw}).`)
  }
  const mix = /^color-mix\(in srgb,\s*(var\(--[\w-]+\)|#[0-9a-f]{3,6})\s+(\d+(?:\.\d+)?)%,\s*(var\(--[\w-]+\)|#[0-9a-f]{3,6})\)$/i.exec(value)
  if (mix) return mixSrgb(operand(mix[1]!), operand(mix[3]!), Number(mix[2]) / 100)
  return operand(value)
}

/** Les feuilles de la charte, telles que l'application les importe (base, thème, rôles propres). */
export interface CharteSheets {
  /** `ANTSIA/packages/ui/src/styles/charte.css` : la charte de base du moteur. */
  readonly base: string
  /** `ANTSIA/packages/ui/src/themes/diasporale.css` : le thème Sable de DIASPORALE. */
  readonly theme: string
  /** `packages/diasporale-features/src/styles/extras.css` : les rôles propres. */
  readonly extras: string
}

const CHARTE = "diasporale"

function surface(theme: Declarations): CharteSurface {
  const entries = (Object.keys(SURFACE_TOKENS) as SurfaceRole[]).map((role) => [role, resolveToken(theme, SURFACE_TOKENS[role])] as const)
  return Object.fromEntries(entries) as Record<SurfaceRole, string>
}

/**
 * La palette du thème par défaut, cascade rejouée avec ses spécificités réelles (voir
 * `engine-theme-contrast.test.ts` du paquet de surfaces) : en sombre, le bloc sombre de la base
 * passe avant le bloc clair du thème, et le bloc commun du thème passe en dernier.
 */
export function paletteFromSheets(sheets: CharteSheets): InstallPalette {
  const baseLight = declarations(cssBlock(sheets.base, "[data-charte] {"))
  const baseDark = declarations(cssBlock(sheets.base, ".dark[data-charte],"))
  const light = declarations(cssBlock(sheets.theme, `[data-charte="${CHARTE}"] {`))
  const dark = declarations(cssBlock(sheets.theme, `.dark[data-charte="${CHARTE}"],\n.dark [data-charte="${CHARTE}"] {`))
  const common = declarations(cssBlock(sheets.theme, `[data-charte="${CHARTE}"],\n.dark[data-charte="${CHARTE}"],`))
  const extrasLight = declarations(cssBlock(sheets.extras, `[data-charte="${CHARTE}"], [data-charte="diasporale-gaboma"] {`))
  const extrasDark = declarations(cssBlock(sheets.extras, `.dark[data-charte="${CHARTE}"],`))
  return {
    light: surface(cascade(baseLight, light, common, extrasLight)),
    dark: surface(cascade(baseLight, light, extrasLight, baseDark, dark, common, extrasDark)),
  }
}

export function serializeInstallPalette(palette: InstallPalette): string {
  return JSON.stringify(palette)
}

function parseSurface(value: unknown): CharteSurface | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const roles = Object.keys(SURFACE_TOKENS) as SurfaceRole[]
  if (Object.keys(record).length !== roles.length) return null
  const out: Partial<Record<SurfaceRole, string>> = {}
  for (const role of roles) {
    const color = record[role]
    if (typeof color !== "string" || !FULL_HEX.test(color)) return null
    out[role] = color
  }
  return out as Record<SurfaceRole, string>
}

/**
 * La palette relue depuis sa forme sérialisée. Forme inattendue ou couleur qui n'est pas un
 * `#rrggbb` : `null` (l'appelant s'en passe), jamais une valeur devinée.
 */
export function parseInstallPalette(raw: string | undefined): InstallPalette | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const light = parseSurface(record.light)
  const dark = parseSurface(record.dark)
  return light && dark ? { light, dark } : null
}

/**
 * La palette inscrite à la construction. Référence LITTÉRALE de la variable : Next la remplace
 * par sa valeur dans le code construit. Absente (tests, outil hors de Next) : `null`.
 */
export function installPalette(): InstallPalette | null {
  return parseInstallPalette(process.env.DIASPORALE_CHARTE_PALETTE)
}

/** Pour ce qui ne se dessine pas sans couleurs (icônes) : l'absence est une erreur de construction. */
export function requireInstallPalette(): InstallPalette {
  const palette = installPalette()
  if (!palette) throw new Error(`Palette de la charte absente : ${INSTALL_PALETTE_VARIABLE} n'est pas posée par next.config.ts.`)
  return palette
}
