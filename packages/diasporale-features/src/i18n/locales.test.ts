// @vitest-environment node
import { describe, expect, it } from "vitest"

import { DIASPORALE_LOCALES, LOCALE_PARTS, mergeLocaleParts } from "./resources"

/**
 * Cliquet i18n — les deux locales disent la même chose : mêmes clés, mêmes
 * variables, mêmes paires de pluriel. Le français suit la typographie
 * française (espaces insécables), l'anglais la sienne. Les textes sont relus
 * APRÈS fusion du fichier principal et des fragments de chantier.
 */
const fr = DIASPORALE_LOCALES.fr as Tree
const en = DIASPORALE_LOCALES.en as Tree

type Tree = { readonly [key: string]: string | Tree }

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>()
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") out.set(path, value)
    else for (const [nested, text] of flatten(value, path)) out.set(nested, text)
  }
  return out
}

const variables = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]).sort()

const FR = flatten(fr)
const EN = flatten(en)

describe("fragments de locale", () => {
  it("existent sous le même nom dans chaque langue", () => {
    expect(Object.keys(LOCALE_PARTS.en).sort()).toEqual(Object.keys(LOCALE_PARTS.fr).sort())
  })

  it("refusent une phrase posée deux fois ou un groupe remplacé par une phrase", () => {
    expect(() => mergeLocaleParts({ a: { nav: { feed: "Fil" } }, b: { nav: { feed: "Autre" } } })).toThrow(/nav\.feed/)
    expect(() => mergeLocaleParts({ a: { nav: { feed: "Fil" } }, b: { nav: "Navigation" } })).toThrow(/nav/)
    expect(() => mergeLocaleParts({ a: { nav: "Navigation" }, b: { nav: { feed: "Fil" } } })).toThrow(/nav/)
    expect(mergeLocaleParts({ a: { nav: { feed: "Fil" } }, b: { nav: { explore: "Explorer" } } })).toEqual({ nav: { feed: "Fil", explore: "Explorer" } })
  })
})

describe("locales fr / en", () => {
  it("portent exactement les mêmes clés", () => {
    expect([...EN.keys()].filter((key) => !FR.has(key))).toEqual([])
    expect([...FR.keys()].filter((key) => !EN.has(key))).toEqual([])
  })

  it("portent les mêmes variables {{…}} pour chaque clé", () => {
    const mismatches = [...FR].filter(([key, text]) => variables(text).join() !== variables(EN.get(key) ?? "").join())
    expect(mismatches.map(([key]) => key)).toEqual([])
  })

  it("complètent chaque pluriel (_one ↔ _other) et le dotent de {{count}}", () => {
    for (const locale of [FR, EN]) {
      for (const key of locale.keys()) {
        const plural = /_(one|other)$/.exec(key)
        if (!plural) continue
        const base = key.slice(0, -plural[0].length)
        expect(locale.has(`${base}_one`) && locale.has(`${base}_other`), key).toBe(true)
        expect(variables(locale.get(key) ?? ""), key).toContain("count")
      }
    }
  })

  it("n'ont aucune chaîne vide ni d'espace en bordure", () => {
    for (const locale of [FR, EN]) {
      for (const [key, text] of locale) {
        expect(text.length, key).toBeGreaterThan(0)
        expect(text, key).toBe(text.trim())
      }
    }
  })

  it("français : une espace insécable avant « : ; ? ! », dans les guillemets et devant le tiret", () => {
    const faults = [...FR].filter(([, text]) => / [:;?!»]|« | — /.test(text))
    expect(faults.map(([key]) => key)).toEqual([])
  })

  it("anglais : aucune espace avant la ponctuation haute", () => {
    const faults = [...EN].filter(([, text]) => /[  ][:;?!]/.test(text))
    expect(faults.map(([key]) => key)).toEqual([])
  })
})
