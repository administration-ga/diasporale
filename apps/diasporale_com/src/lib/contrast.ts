/**
 * Contraste WCAG 2.1 entre deux couleurs opaques `#rrggbb` ou `#rgb`, tel que la
 * charte le mesure en direct (`/charte`). Une valeur qui n'est pas une couleur
 * hexadécimale opaque rend `null` : on n'affiche jamais un chiffre qu'on n'a
 * pas mesuré.
 */
export function relativeLuminance(color: string): number | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())?.[1]
  if (hex === undefined) return null
  const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex
  const [red, green, blue] = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(full.slice(offset, offset + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export function contrastRatio(foreground: string, background: string): number | null {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  if (a === null || b === null) return null
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export type ContrastLevel = "aaa" | "aa" | "component" | "fail"

/** Le niveau atteint : un texte (4,5:1, puis 7:1) ou un composant non textuel (3:1, critère 1.4.11). */
export function contrastLevel(ratio: number, kind: "text" | "component"): ContrastLevel {
  if (kind === "component") return ratio >= 3 ? "component" : "fail"
  if (ratio >= 7) return "aaa"
  if (ratio >= 4.5) return "aa"
  return "fail"
}
