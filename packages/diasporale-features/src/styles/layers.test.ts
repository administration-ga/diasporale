// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

/**
 * Cliquet des couches (charte §4) : barres 40 < feuilles 50 < pile des avis 55 < menus 60.
 * La pile des avis (sonner) se pose sinon à 999999999 : une carte flottante passait devant le
 * dernier élément d'un menu ouvert (« Signaler… »), joignable au clavier mais plus à la souris.
 */
const FEATURES_SRC = new URL("../", import.meta.url)
const APP_SRC = new URL("../../../../apps/diasporale_com/src/", import.meta.url)

function sourceFiles(dir: URL): string[] {
  const root = fileURLToPath(dir)
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".tsx") && !path.includes(".test."))
    .map((path) => `${root}${path}`)
}

/** La balise ouvrante qui commence à `start`, accolades et chaînes comprises (`=>` ne la ferme pas). */
function openingTag(text: string, start: number): string {
  let depth = 0
  let quote: string | null = null
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]!
    if (quote !== null) {
      if (char === quote) quote = null
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char
    } else if (char === "{") {
      depth += 1
    } else if (char === "}") {
      depth -= 1
    } else if (char === ">" && depth === 0) {
      return text.slice(start, index + 1)
    }
  }
  return text.slice(start)
}

const OVERLAY_CONTENT = /<(DropdownMenu|Popover|HoverCard|ContextMenu|Menubar|Select)\.Content\b/g

describe("couches de la charte — barres 40, feuilles 50, pile des avis 55, menus 60", () => {
  it("tout contenu de menu ou de bulle se pose sur la couche des menus, devant la pile des avis", () => {
    const offenders: string[] = []
    for (const file of [...sourceFiles(FEATURES_SRC), ...sourceFiles(APP_SRC)]) {
      const text = readFileSync(file, "utf8")
      for (const match of text.matchAll(OVERLAY_CONTENT)) {
        const tag = openingTag(text, match.index)
        if (!/\bz-60\b/.test(tag)) offenders.push(`${file.split("/src/").pop()} : ${tag.slice(0, 60)}…`)
      }
    }
    expect(offenders).toEqual([])
  })

  it("la pile des avis se pose entre les feuilles et les menus", () => {
    const providers = readFileSync(new URL("components/providers.tsx", APP_SRC), "utf8")
    expect(openingTag(providers, providers.indexOf("<Toaster"))).toMatch(/className="[^"]*!z-55\b/)
    const sheet = readFileSync(new URL("primitives/sheet.tsx", FEATURES_SRC), "utf8")
    // Le voile et le panneau de la feuille.
    expect(sheet.match(/\bz-50\b/g)).toHaveLength(2)
  })
})
