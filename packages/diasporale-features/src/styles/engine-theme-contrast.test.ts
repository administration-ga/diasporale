// @vitest-environment node
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { cascade, contrastRatio, cssBlock, declarations, resolveToken, tokenLuminance } from "./contrast"

/**
 * Cliquet du thème DIASPORALE tel que le moteur le sert : charte de base
 * d'ANTSIA (`packages/ui/src/styles/charte.css`), puis le thème
 * `packages/ui/src/themes/diasporale.css` écrit par cette session. La cascade
 * est rejouée avec ses spécificités réelles — en sombre, le bloc sombre de la
 * base (0,2,0) passe AVANT le bloc clair du thème (0,1,0) : tout rôle que le
 * thème oublierait de redéclarer en sombre ferait reparaître le bleu du moteur.
 */

const ENGINE_UI = new URL("../../../../../ANTSIA/packages/ui/src/", import.meta.url)
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

// Les rôles propres à DIASPORALE (`extras.css`), importés après le thème, mêmes sélecteurs.
const extras = readFileSync(new URL("./extras.css", import.meta.url), "utf8")
const EXTRAS_LIGHT = declarations(cssBlock(extras, '[data-charte="diasporale"], [data-charte="diasporale-gaboma"] {'))
const EXTRAS_DARK = declarations(cssBlock(extras, '.dark[data-charte="diasporale"],'))
const WITH_EXTRAS = {
  clair: cascade(BASE_LIGHT, THEME_LIGHT, EXTRAS_LIGHT),
  sombre: cascade(BASE_LIGHT, THEME_LIGHT, EXTRAS_LIGHT, BASE_DARK, THEME_DARK, EXTRAS_DARK),
} as const

/** Paires des rôles propres : étiquette pays, badges, bandeaux, bouton destructif. */
const EXTRA_TEXT_PAIRS: readonly (readonly [string, string])[] = [
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
  ["--destructive-foreground", "--destructive"],
  // Sélection sans contour (v3.2) : la pilule choisie, le curseur des sélecteurs.
  ["--dg-chosen-fg", "--dg-chosen-bg"],
  ["--foreground", "--dg-thumb"],
  ["--primary-700", "--dg-thumb"],
]

const TEXT_PAIRS: readonly (readonly [string, string])[] = [
  ["--foreground", "--background"],
  ["--card-foreground", "--card"],
  ["--popover-foreground", "--popover"],
  ["--muted-foreground", "--popover"],
  ["--muted-foreground", "--background"],
  ["--muted-foreground", "--card"],
  ["--muted-foreground", "--muted"],
  ["--secondary-foreground", "--secondary"],
  ["--accent-foreground", "--accent"],
  ["--primary-foreground", "--primary"],
  ["--primary", "--card"],
  ["--primary", "--background"],
  // v3.2 : le lien et le texte discret tiennent aussi sur l'aplat (4,33 et 4,48 avant, en clair).
  ["--primary", "--muted"],
  ["--ink-500", "--muted"],
  ["--ink-500", "--popover"],
  // La teinte de sélection (option choisie, puce de pays, ligne non lue) et la navigation active.
  ["--foreground", "--primary-50"],
  ["--primary-700", "--primary-50"],
  ["--esp-accent-deep", "--esp-accent-soft"],
  // La barre basse lit `--esp-accent-deep` sur la carte : 1,8:1 en sombre avant la v3.2.
  ["--esp-accent-deep", "--card"],
  ["--info-600", "--info-50"],
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

  describe("rôles propres à DIASPORALE (extras.css), posés sur le contrat", () => {
    for (const [name, resolved] of Object.entries(WITH_EXTRAS)) {
      it.each(EXTRA_TEXT_PAIRS)(`${name} : texte %s sur %s ≥ 4,5:1`, (foreground, background) => {
        expect(contrastRatio(resolved, foreground, background)).toBeGreaterThanOrEqual(4.5)
      })
    }

    it("ne porte aucune couleur littérale, et plus aucune couleur du drapeau (charte v2)", () => {
      const literal = [...EXTRAS_LIGHT, ...EXTRAS_DARK].filter(([, value]) => /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i.test(value))
      expect(literal.map(([token]) => token)).toEqual([])
      expect([...EXTRAS_LIGHT.keys()].filter((token) => /drapeau|stripe/.test(token))).toEqual([])
    })

    it("chaque rôle propre utilisé par la couche Tailwind est déclaré", () => {
      const layer = readFileSync(new URL("./tailwind-theme.css", import.meta.url), "utf8")
      const used = new Set([...layer.matchAll(/var\((--dg-[a-z0-9-]+)\)/g)].map((match) => match[1]!))
      expect([...used].filter((token) => !EXTRAS_LIGHT.has(token))).toEqual([])
    })
  })

  it("fond papier et cartes sable en clair ; cartes éclaircies sur fond nuit en sombre", () => {
    expect(tokenLuminance(THEMES.clair, "--background")).toBeGreaterThan(tokenLuminance(THEMES.clair, "--card"))
    expect(tokenLuminance(THEMES.sombre, "--card")).toBeGreaterThan(tokenLuminance(THEMES.sombre, "--background"))
    for (const theme of [THEMES.clair, THEMES.sombre]) {
      expect(tokenLuminance(theme, "--popover")).toBeGreaterThanOrEqual(tokenLuminance(theme, "--card"))
    }
    // Sans filet, chaque marche se voit : la carte et ce qui flotte s'écartent nettement.
    expect(contrastRatio(THEMES.sombre, "--card", "--background")).toBeGreaterThanOrEqual(1.15)
    expect(contrastRatio(THEMES.sombre, "--popover", "--card")).toBeGreaterThanOrEqual(1.12)
    // Correction du propriétaire (v3.3) : les cartes sable se détachent du fond papier.
    expect(contrastRatio(THEMES.clair, "--card", "--background")).toBeGreaterThanOrEqual(1.12)
  })

  it("une sélection se lit sans contour : en sombre, sa teinte se lève au-dessus de la carte et de ce qui flotte", () => {
    for (const selection of ["--primary-50", "--esp-accent-soft"]) {
      expect(tokenLuminance(THEMES.sombre, selection), selection).toBeGreaterThan(tokenLuminance(THEMES.sombre, "--card"))
      expect(tokenLuminance(THEMES.sombre, selection), selection).toBeGreaterThan(tokenLuminance(THEMES.sombre, "--popover"))
      expect(contrastRatio(THEMES.sombre, selection, "--card"), selection).toBeGreaterThanOrEqual(1.2)
    }
    // Le curseur d'un sélecteur est la surface la plus claire de sa piste, dans les deux thèmes.
    for (const theme of [WITH_EXTRAS.clair, WITH_EXTRAS.sombre]) {
      expect(tokenLuminance(theme, "--dg-thumb")).toBeGreaterThan(tokenLuminance(theme, "--esp-neutral-chip"))
    }
    // La pilule choisie inverse la clarté (encre sur sable, sable sur nuit) : elle se lit sans la couleur.
    expect(contrastRatio(WITH_EXTRAS.clair, "--dg-chosen-bg", "--background")).toBeGreaterThanOrEqual(7)
    expect(contrastRatio(WITH_EXTRAS.sombre, "--dg-chosen-bg", "--background")).toBeGreaterThanOrEqual(7)
  })

  it("en sombre, les aplats et les teintes de statut se lèvent au-dessus de la carte (jamais un trou)", () => {
    const card = tokenLuminance(THEMES.sombre, "--card")
    // Survol, étiquettes, squelettes : le survol éclaircit en sombre, il ne creuse pas.
    expect(tokenLuminance(THEMES.sombre, "--muted")).toBeGreaterThan(card)
    for (const tint of ["--esp-tone-blue-bg", "--esp-tone-amber-bg", "--esp-tone-rose-bg", "--esp-tone-green-bg"]) {
      expect(contrastRatio(THEMES.sombre, tint, "--card"), tint).toBeGreaterThanOrEqual(1.1)
      expect(tokenLuminance(THEMES.sombre, tint), tint).toBeGreaterThan(card)
    }
  })

  it("rayons resserrés (contrôles 6 px, cartes 8 px, panneaux 12 px), pilule intacte", () => {
    expect(THEMES.clair.get("--radius-md")).toBe("6px")
    expect(THEMES.clair.get("--radius-xl")).toBe("8px")
    expect(THEMES.clair.get("--radius-2xl")).toBe("12px")
    expect(THEMES.clair.get("--esp-r-chrome")).toBe("999px")
  })

  it("confort de lecture : le texte principal reste fort sans éblouir (ni noir sur blanc pur, ni halo en sombre)", () => {
    const comfort = [
      ["clair", contrastRatio(THEMES.clair, "--card-foreground", "--card")],
      ["clair", contrastRatio(THEMES.clair, "--foreground", "--background")],
      ["sombre", contrastRatio(THEMES.sombre, "--foreground", "--background")],
      ["sombre", contrastRatio(THEMES.sombre, "--card-foreground", "--card")],
    ] as const
    for (const [, ratio] of comfort) {
      expect(ratio).toBeGreaterThanOrEqual(12)
      expect(ratio).toBeLessThanOrEqual(16)
    }
  })

  it("garde le bleu Gabon foncé comme bleu d'action et la palette papier/sable", () => {
    expect(THEMES.clair.get("--esp-blue-500")).toBe("#0167a8")
    expect(THEMES.clair.get("--esp-neutral-100")).toBe("#f1efeb")
  })
})

/**
 * Le second thème au choix du membre (19/10/2026) : Gaboma, le thème du réseau ANTSIA,
 * sur la structure de DIASPORALE. `diasporale-gaboma.css` est une charte complète, sur son
 * seul nœud (cliquet `theme-contract` du moteur) : il reprend Sable jeton pour jeton et
 * n'en change que les couleurs. Les règles WCAG sont celles de Sable ; les marches de
 * surface sont celles de la charte du réseau (blanc franc et noir absolu), plus serrées
 * que le papier et le sable.
 */
const gabomaTheme = readFileSync(new URL("themes/diasporale-gaboma.css", ENGINE_UI), "utf8")
const GABOMA_LIGHT = declarations(cssBlock(gabomaTheme, '[data-charte="diasporale-gaboma"] {'))
const GABOMA_DARK = declarations(cssBlock(gabomaTheme, '.dark[data-charte="diasporale-gaboma"],'))
const GABOMA = {
  clair: cascade(BASE_LIGHT, GABOMA_LIGHT),
  sombre: cascade(BASE_LIGHT, GABOMA_LIGHT, BASE_DARK, GABOMA_DARK),
} as const
const GABOMA_WITH_EXTRAS = {
  clair: cascade(BASE_LIGHT, GABOMA_LIGHT, EXTRAS_LIGHT),
  sombre: cascade(BASE_LIGHT, GABOMA_LIGHT, EXTRAS_LIGHT, BASE_DARK, GABOMA_DARK, EXTRAS_DARK),
} as const
/** Une valeur de couleur (aplat, relief teinté) : la seule chose qu'un thème change. */
const isColorValue = (value: string) => /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i.test(value)

// La charte du réseau, source des couleurs de Gaboma.
const network = readFileSync(new URL("themes/antsia.css", ENGINE_UI), "utf8")
const NETWORK_LIGHT = declarations(cssBlock(network, '[data-charte="antsia"] {'))
const NETWORK = {
  clair: NETWORK_LIGHT,
  sombre: cascade(NETWORK_LIGHT, declarations(cssBlock(network, '.dark[data-charte="antsia"],'))),
} as const
const swatchesOf = (css: string) => [1, 2, 3].map((index) => new RegExp(`--esp-theme-swatch-${index}:\\s*(#[0-9a-f]{6})`, "i").exec(css.replace(/\/\*[\s\S]*?\*\//g, ""))?.[1])

describe("thème Gaboma de DIASPORALE — cascade base + Sable + Gaboma", () => {
  it("structure de Sable, jeton pour jeton : mêmes jetons dans le même ordre, mêmes renvois et mêmes mesures ; seules les couleurs changent", () => {
    for (const [sable, gaboma] of [[THEME_LIGHT, GABOMA_LIGHT], [THEME_DARK, GABOMA_DARK]] as const) {
      expect([...gaboma.keys()]).toEqual([...sable.keys()])
      const drift = [...sable].filter(([token, value]) => !isColorValue(value) && gaboma.get(token) !== value)
      expect(drift.map(([token]) => `${token} : ${sable.get(token)} ≠ ${gaboma.get(token)}`)).toEqual([])
    }
  })

  it("le bloc sombre redéclare chaque rôle du bloc sombre de la base", () => {
    expect([...BASE_DARK.keys()].filter((token) => !GABOMA_DARK.has(token))).toEqual([])
  })

  it("garde les avatars de DIASPORALE : une personne garde sa couleur d'un thème à l'autre", () => {
    const avatars = [...THEME_LIGHT.keys()].filter((token) => /^--esp-(ava-|on-avatar)/.test(token))
    expect(avatars.length).toBeGreaterThanOrEqual(7)
    for (const token of avatars) expect(GABOMA_LIGHT.get(token), token).toBe(THEME_LIGHT.get(token))
  })

  it("reprend les couleurs de la charte du réseau (antsia.css), dans les deux modes", () => {
    const same = (mode: "clair" | "sombre", ours: string, theirs: string) =>
      expect(resolveToken(GABOMA[mode], ours), `${mode} ${ours}`).toBe(resolveToken(NETWORK[mode], theirs))
    for (const mode of ["clair", "sombre"] as const) {
      same(mode, "--primary", "--primary-500")
      same(mode, "--background", "--background")
      same(mode, "--card", "--card")
      same(mode, "--muted-foreground", "--muted-foreground")
      same(mode, "--input", "--input")
    }
    same("clair", "--foreground", "--foreground")
    same("clair", "--muted", "--muted")
    same("clair", "--border", "--border")
    same("clair", "--success", "--success-500")
    same("clair", "--destructive", "--danger-500")
    same("sombre", "--popover", "--popover")
    same("sombre", "--primary-50", "--primary-50")
    expect(swatchesOf(gabomaTheme)).toEqual(swatchesOf(network))
  })

  it("chaque thème montre trois couleurs dans son aperçu", () => {
    for (const css of [theme, gabomaTheme]) expect(swatchesOf(css).every((swatch) => swatch !== undefined)).toBe(true)
  })

  for (const [name, resolved] of Object.entries(GABOMA)) {
    describe(`Gaboma ${name}`, () => {
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

  for (const [name, resolved] of Object.entries(GABOMA_WITH_EXTRAS)) {
    it.each(EXTRA_TEXT_PAIRS)(`rôles propres, Gaboma ${name} : texte %s sur %s ≥ 4,5:1`, (foreground, background) => {
      expect(contrastRatio(resolved, foreground, background)).toBeGreaterThanOrEqual(4.5)
    })
  }

  it("surfaces de la charte du réseau : carte, creux et sélection se distinguent sans filet", () => {
    expect(contrastRatio(GABOMA.clair, "--card", "--background")).toBeGreaterThanOrEqual(1.04)
    expect(contrastRatio(GABOMA.clair, "--muted", "--card")).toBeGreaterThanOrEqual(1.04)
    expect(contrastRatio(GABOMA.clair, "--primary-50", "--card")).toBeGreaterThanOrEqual(1.1)
    const card = tokenLuminance(GABOMA.sombre, "--card")
    expect(card).toBeGreaterThan(tokenLuminance(GABOMA.sombre, "--background"))
    expect(tokenLuminance(GABOMA.sombre, "--popover")).toBeGreaterThan(card)
    expect(tokenLuminance(GABOMA.sombre, "--muted")).toBeGreaterThan(card)
    for (const selection of ["--primary-50", "--esp-accent-soft"]) {
      expect(tokenLuminance(GABOMA.sombre, selection), selection).toBeGreaterThan(tokenLuminance(GABOMA.sombre, "--popover"))
      expect(contrastRatio(GABOMA.sombre, selection, "--card"), selection).toBeGreaterThanOrEqual(1.2)
    }
    for (const tint of ["--esp-tone-blue-bg", "--esp-tone-amber-bg", "--esp-tone-rose-bg", "--esp-tone-green-bg"]) {
      expect(contrastRatio(GABOMA.sombre, tint, "--card"), tint).toBeGreaterThanOrEqual(1.1)
    }
    for (const resolved of [GABOMA_WITH_EXTRAS.clair, GABOMA_WITH_EXTRAS.sombre]) {
      expect(tokenLuminance(resolved, "--dg-thumb")).toBeGreaterThan(tokenLuminance(resolved, "--esp-neutral-chip"))
      expect(contrastRatio(resolved, "--dg-chosen-bg", "--background")).toBeGreaterThanOrEqual(7)
    }
  })
})
