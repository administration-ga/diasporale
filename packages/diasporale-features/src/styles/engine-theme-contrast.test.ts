// @vitest-environment node
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { cascade, contrastRatio, cssBlock, declarations, resolveToken, tokenLuminance, type Declarations } from "./contrast"

/**
 * Cliquet des deux thèmes de DIASPORALE tels que le moteur les sert : charte de base
 * d'ANTSIA (`packages/ui/src/styles/charte.css`), puis le thème
 * (`packages/ui/src/themes/diasporale.css` pour Sable, `diasporale-gaboma.css` pour
 * Gaboma), écrit par cette session. Charte v4 (20/10/2026) : la maquette « sept
 * thèmes », dont chaque thème a trois blocs — clair, sombre, puis un bloc commun aux
 * deux modes. La cascade est rejouée avec ses spécificités réelles : en sombre, le bloc
 * sombre de la base (0,2,0) passe AVANT le bloc clair du thème (0,1,0), et le bloc
 * commun (0,2,0 en sombre) passe en dernier.
 */

const ENGINE_UI = new URL("../../../../../ANTSIA/packages/ui/src/", import.meta.url)
const base = readFileSync(new URL("styles/charte.css", ENGINE_UI), "utf8")

const BASE_LIGHT = declarations(cssBlock(base, "[data-charte] {"))
const BASE_DARK = declarations(cssBlock(base, ".dark[data-charte],"))

// Les rôles propres à DIASPORALE (`extras.css`), importés après les thèmes, mêmes sélecteurs.
const extras = readFileSync(new URL("./extras.css", import.meta.url), "utf8")
const EXTRAS_LIGHT = declarations(cssBlock(extras, '[data-charte="diasporale"], [data-charte="diasporale-gaboma"] {'))
const EXTRAS_DARK = declarations(cssBlock(extras, '.dark[data-charte="diasporale"],'))

interface ThemeSheet {
  css: string
  light: Declarations
  dark: Declarations
  common: Declarations
}

function themeSheet(file: string, charte: string): ThemeSheet {
  const css = readFileSync(new URL(`themes/${file}`, ENGINE_UI), "utf8")
  return {
    css,
    light: declarations(cssBlock(css, `[data-charte="${charte}"] {`)),
    dark: declarations(cssBlock(css, `.dark[data-charte="${charte}"],\n.dark [data-charte="${charte}"] {`)),
    common: declarations(cssBlock(css, `[data-charte="${charte}"],\n.dark[data-charte="${charte}"],`)),
  }
}

/** Les jetons résolus d'un thème, sans puis avec les rôles propres de DIASPORALE. */
function resolved(sheet: ThemeSheet) {
  return {
    theme: {
      clair: cascade(BASE_LIGHT, sheet.light, sheet.common),
      sombre: cascade(BASE_LIGHT, sheet.light, BASE_DARK, sheet.dark, sheet.common),
    },
    withExtras: {
      clair: cascade(BASE_LIGHT, sheet.light, sheet.common, EXTRAS_LIGHT),
      sombre: cascade(BASE_LIGHT, sheet.light, EXTRAS_LIGHT, BASE_DARK, sheet.dark, sheet.common, EXTRAS_DARK),
    },
  } as const
}

const SABLE_SHEET = themeSheet("diasporale.css", "diasporale")
const GABOMA_SHEET = themeSheet("diasporale-gaboma.css", "diasporale-gaboma")
const SABLE = resolved(SABLE_SHEET)
const GABOMA = resolved(GABOMA_SHEET)

/** Paires des rôles propres : étiquette pays, badges, bandeaux, bouton destructif, sélection. */
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
  ["--destructive-foreground", "--role-danger-fill"],
  ["--dg-chosen-fg", "--dg-chosen-bg"],
  ["--foreground", "--dg-thumb"],
  ["--primary-700", "--dg-thumb"],
  // Boutons tonals (maquette) : l'encre de la fonction sur sa teinte douce.
  ["--primary", "--dg-primary-soft"],
  ["--role-social-ink", "--dg-social-soft"],
  ["--role-commerce-ink", "--dg-commerce-soft"],
  ["--role-success-ink", "--dg-success-soft"],
  ["--role-danger-ink", "--dg-danger-soft"],
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
  ["--primary", "--muted"],
  ["--ink-500", "--muted"],
  ["--ink-500", "--popover"],
  // La teinte de sélection (option choisie, puce de pays, ligne non lue) et la navigation active.
  ["--foreground", "--primary-50"],
  ["--primary-700", "--primary-50"],
  ["--esp-accent-deep", "--esp-accent-soft"],
  ["--esp-accent-deep", "--card"],
  ["--esp-tab-active-fg", "--esp-tab-active-bg"],
  ["--info-600", "--info-50"],
  ["--destructive", "--card"],
  ["--success", "--card"],
  ["--warning", "--card"],
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
  // Une couleur par famille d'actions (maquette) : le texte de chaque bouton plein sur son aplat…
  ["--primary-fill-on", "--primary-fill"],
  ["--role-social-on", "--role-social-fill"],
  ["--role-message-on", "--role-message-fill"],
  ["--role-react-on", "--role-react-fill"],
  ["--role-commerce-on", "--role-commerce-fill"],
  ["--role-success-on", "--role-success-fill"],
  ["--role-danger-on", "--role-danger-fill"],
  ["--ui2-button-secondary-fg", "--ui2-button-secondary-bg"],
  // … et l'encre de chaque fonction en texte, sur la carte et sur le bouton tonal d'Écrire.
  ["--role-social-ink", "--card"],
  ["--role-message-ink", "--card"],
  ["--role-message-ink", "--role-message-soft"],
  ["--role-commerce-ink", "--card"],
  ["--role-success-ink", "--card"],
  ["--role-danger-ink", "--card"],
]

/** Le titre de la bannière se lit sur les deux arrêts de son dégradé (`--esp-banner`). */
const BANNER_STOPS = { clair: ["--esp-blue-700", "--esp-blue-800"], sombre: ["--esp-blue-800", "--esp-blue-950"] } as const

const NON_TEXT_PAIRS: readonly (readonly [string, string])[] = [
  ["--input", "--card"],
  ["--input", "--background"],
  ["--ring", "--card"],
  ["--ring", "--background"],
  // L'icône d'une réaction (cœur rempli) : une encre non textuelle, ≥ 3:1.
  ["--role-react-ink", "--card"],
]

/** Les angles du système épuré, un par élément, communs aux deux thèmes. */
const GEOMETRY = {
  "--ui2-button-radius": "999px",
  "--ui2-badge-radius": "6px",
  "--esp-chip-radius": "10px",
  "--esp-avatar-page-radius": "12px",
  "--esp-field-radius": "14px",
  "--esp-media-radius": "16px",
  "--esp-fab-radius": "18px",
  "--ui2-card-radius": "24px",
  "--rp-surface-radius": "24px",
  "--esp-mobilebar-radius": "28px",
} as const

/** Les deux thèmes, mêmes exigences d'accessibilité. */
function contrastSuite(name: string, themes: ReturnType<typeof resolved>) {
  for (const [mode, tokens] of Object.entries(themes.theme)) {
    describe(`${name} ${mode}`, () => {
      it.each(TEXT_PAIRS)("texte %s sur %s ≥ 4,5:1", (foreground, background) => {
        expect(contrastRatio(tokens, foreground, background)).toBeGreaterThanOrEqual(4.5)
      })

      it.each(BANNER_STOPS[mode as keyof typeof BANNER_STOPS])("titre de bannière sur l'arrêt %s ≥ 4,5:1", (stop) => {
        expect(contrastRatio(tokens, "--esp-on-banner", stop)).toBeGreaterThanOrEqual(4.5)
      })

      it.each(NON_TEXT_PAIRS)("contour ou icône %s sur %s ≥ 3:1", (foreground, background) => {
        expect(contrastRatio(tokens, foreground, background)).toBeGreaterThanOrEqual(3)
      })
    })
  }

  for (const [mode, tokens] of Object.entries(themes.withExtras)) {
    it.each(EXTRA_TEXT_PAIRS)(`rôles propres, ${name} ${mode} : texte %s sur %s ≥ 4,5:1`, (foreground, background) => {
      expect(contrastRatio(tokens, foreground, background)).toBeGreaterThanOrEqual(4.5)
    })
  }
}

describe("thèmes de DIASPORALE servis par le moteur — cascade base + thème", () => {
  for (const [name, sheet] of [["Sable", SABLE_SHEET], ["Gaboma", GABOMA_SHEET]] as const) {
    it(`${name} : le bloc sombre (ou le bloc commun) redéclare chaque rôle du bloc sombre de la base`, () => {
      expect([...BASE_DARK.keys()].filter((token) => !sheet.dark.has(token) && !sheet.common.has(token))).toEqual([])
    })
  }

  contrastSuite("Sable", SABLE)
  contrastSuite("Gaboma", GABOMA)

  describe("rôles propres à DIASPORALE (extras.css), posés sur le contrat", () => {
    it("ne porte aucune couleur littérale, et aucune couleur du drapeau", () => {
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

  it("Sable : fond papier et cartes sable en clair ; cartes éclaircies sur fond nuit en sombre", () => {
    const { clair, sombre } = SABLE.theme
    expect(tokenLuminance(clair, "--background")).toBeGreaterThan(tokenLuminance(clair, "--card"))
    expect(tokenLuminance(sombre, "--card")).toBeGreaterThan(tokenLuminance(sombre, "--background"))
    for (const theme of [clair, sombre]) {
      expect(tokenLuminance(theme, "--popover")).toBeGreaterThanOrEqual(tokenLuminance(theme, "--card"))
    }
    // Sans filet, chaque marche se voit : la carte et ce qui flotte s'écartent nettement.
    expect(contrastRatio(sombre, "--card", "--background")).toBeGreaterThanOrEqual(1.15)
    expect(contrastRatio(sombre, "--popover", "--card")).toBeGreaterThanOrEqual(1.12)
    expect(contrastRatio(clair, "--card", "--background")).toBeGreaterThanOrEqual(1.12)
  })

  it("Gaboma : carte, creux et sélection se distinguent sans filet", () => {
    const { clair, sombre } = GABOMA.theme
    expect(contrastRatio(clair, "--card", "--background")).toBeGreaterThanOrEqual(1.04)
    expect(contrastRatio(clair, "--muted", "--card")).toBeGreaterThanOrEqual(1.04)
    expect(contrastRatio(clair, "--primary-50", "--card")).toBeGreaterThanOrEqual(1.1)
    expect(tokenLuminance(sombre, "--card")).toBeGreaterThan(tokenLuminance(sombre, "--background"))
    expect(tokenLuminance(sombre, "--popover")).toBeGreaterThan(tokenLuminance(sombre, "--card"))
  })

  for (const [name, themes] of [["Sable", SABLE], ["Gaboma", GABOMA]] as const) {
    it(`${name} : en sombre, sélection, creux et teintes de statut se lèvent au-dessus de la carte (jamais un trou)`, () => {
      const { sombre } = themes.theme
      const card = tokenLuminance(sombre, "--card")
      expect(tokenLuminance(sombre, "--muted")).toBeGreaterThan(card)
      for (const selection of ["--primary-50", "--esp-accent-soft", "--esp-tab-active-bg"]) {
        expect(tokenLuminance(sombre, selection), selection).toBeGreaterThan(card)
        expect(contrastRatio(sombre, selection, "--card"), selection).toBeGreaterThanOrEqual(1.2)
      }
      for (const tint of ["--esp-tone-blue-bg", "--esp-tone-amber-bg", "--esp-tone-rose-bg", "--esp-tone-green-bg"]) {
        expect(contrastRatio(sombre, tint, "--card"), tint).toBeGreaterThanOrEqual(1.1)
        expect(tokenLuminance(sombre, tint), tint).toBeGreaterThan(card)
      }
    })

    it(`${name} : le curseur d'un sélecteur (la carte) se détache du creux de sa piste`, () => {
      for (const theme of [themes.withExtras.clair, themes.withExtras.sombre]) {
        expect(contrastRatio(theme, "--dg-thumb", "--muted")).toBeGreaterThanOrEqual(1.05)
      }
    })

    it(`${name} : système épuré — un angle par élément, aucun contour ni ombre de carte, Familjen Grotesk et Inter`, () => {
      for (const theme of [themes.theme.clair, themes.theme.sombre]) {
        for (const [token, value] of Object.entries(GEOMETRY)) expect(theme.get(token), token).toBe(value)
        expect(theme.get("--esp-surface-border")).toBe("transparent")
        expect(theme.get("--ui2-button-outline-border")).toBe("transparent")
        expect(theme.get("--esp-shadow-card")).toBe("0 0 0 0 transparent")
        expect(theme.get("--esp-mobilebar-border")).toBe("transparent")
        expect(theme.get("--font-sans")).toMatch(/^"Inter Variable", "Inter"/)
        expect(theme.get("--font-display")).toMatch(/Familjen Grotesk/)
      }
    })
  }

  it("Sable : confort de lecture — le texte principal reste fort sans éblouir (ni noir sur blanc pur, ni halo en sombre)", () => {
    const { clair, sombre } = SABLE.theme
    for (const ratio of [
      contrastRatio(clair, "--card-foreground", "--card"),
      contrastRatio(clair, "--foreground", "--background"),
      contrastRatio(sombre, "--foreground", "--background"),
      contrastRatio(sombre, "--card-foreground", "--card"),
    ]) {
      expect(ratio).toBeGreaterThanOrEqual(12)
      expect(ratio).toBeLessThanOrEqual(16)
    }
  })

  it("chaque thème a les trois couleurs de la maquette, aux fonctions de la maquette", () => {
    const fills = (themes: ReturnType<typeof resolved>) =>
      ["--primary-fill", "--role-social-fill", "--role-message-fill", "--role-react-fill", "--role-commerce-fill"].map((token) => resolveToken(themes.theme.clair, token).toLowerCase())
    // Sable : bleu Gabon publie et écrit, sarcelle suit, sable doré réagit, participe et achète.
    expect(fills(SABLE)).toEqual(["#0167a8", "#238090", "#0167a8", "#d7ad63", "#d7ad63"])
    // Gaboma : bleu publie et écrit, vert suit, safran réagit, participe et achète.
    expect(fills(GABOMA)).toEqual(["#2f67b5", "#007e4d", "#2f67b5", "#f4bb44", "#f4bb44"])
    // Les fonds de la maquette : papier et sable, Onyx.
    expect([resolveToken(SABLE.theme.clair, "--background"), resolveToken(SABLE.theme.clair, "--card")]).toEqual(["#fdfdfb", "#f1efeb"])
    expect([resolveToken(GABOMA.theme.sombre, "--background"), resolveToken(GABOMA.theme.sombre, "--card")]).toEqual(["#000000", "#141414"])
    // Le bleu Gabon de la palette DIASPORALE reste son bleu d'action (bannière, information).
    expect(SABLE.theme.clair.get("--esp-blue-500")).toBe("#0167a8")
  })
})

/**
 * Les deux thèmes partagent une seule structure : Gaboma reprend Sable jeton pour jeton
 * (mêmes jetons, même ordre, mêmes renvois, mêmes mesures) et n'en change que les couleurs.
 * Chacun recopie la charte du réseau qui porte la maquette : `antsia-sable.css` pour
 * Sable, `antsia.css` pour Gaboma.
 */
const isColorValue = (value: string) => /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i.test(value)

/**
 * Activation des nouvelles primitives ANTSIA (20/10/2026), distincte de la
 * palette reprise par DIASPORALE. Inventaire fermé : un autre jeton manquant
 * côté DIASPORALE reste une dérive, même si sa valeur n'est pas une couleur.
 * Les renvois conservent la palette partagée ; leurs nouveaux consommateurs
 * gardent leur repli historique tant que DIASPORALE ne les active pas.
 */
const ANTSIA_PRIMITIVE_OPT_INS: Readonly<Record<string, string | { clair: string; sombre: string }>> = {
  "--esp-card-padding": "16px",
  "--esp-card-gap": "12px",
  "--esp-surface-shadow": "var(--esp-theme-card-shadow)",
  "--esp-raised-border": "transparent",
  "--esp-alert-border": "transparent",
  "--esp-alert-accent-width": "0px",
  "--esp-control-min-size": "44px",
  "--esp-primitive-card-radius": "var(--ui2-card-radius)",
  "--esp-primitive-button-radius": "var(--ui2-button-radius)",
  "--esp-social-action-radius": "8px",
  "--esp-primitive-badge-radius": "var(--ui2-badge-radius)",
  "--esp-primitive-chip-radius": "var(--esp-chip-radius)",
  "--esp-primitive-chip-bg": "var(--esp-chip-bg)",
  "--esp-primitive-chip-border": "var(--esp-chip-border)",
  "--esp-input-radius": "var(--esp-field-radius)",
  "--esp-primitive-surface-border": "var(--esp-surface-border)",
  "--esp-primitive-neutral-bg": "var(--ui2-button-outline-bg)",
  "--esp-primitive-neutral-border": "var(--ui2-button-outline-border)",
  "--esp-primitive-secondary-bg": "var(--ui2-button-secondary-bg)",
  "--esp-primitive-secondary-fg": "var(--ui2-button-secondary-fg)",
  "--esp-primitive-secondary-border": "var(--ui2-button-secondary-border)",
  "--esp-primitive-tab-bg": "var(--esp-tab-active-bg)",
  "--esp-primitive-tab-fg": "var(--esp-tab-active-fg)",
  "--esp-primitive-tab-border": "var(--esp-chip-border)",
  "--esp-primitive-icon-bg": "var(--esp-header-icon-bg)",
  "--esp-primitive-identity-fill": "var(--esp-identity-fill)",
  "--esp-primitive-fill-on": "var(--primary-fill-on)",
  "--esp-action-success-fill": "var(--role-success-fill)",
  "--esp-action-success-on": "var(--role-success-on)",
  "--esp-action-danger-fill": "var(--role-danger-fill)",
  "--esp-action-danger-on": "var(--role-danger-on)",
  "--esp-action-cancel-bg": "var(--ui2-button-outline-bg)",
  "--esp-action-cancel-fg": "var(--ui2-button-outline-fg)",
  "--esp-action-cancel-border": "var(--ui2-button-outline-border)",
  "--esp-primitive-media-radius": "var(--esp-media-radius)",
  "--esp-primitive-avatar-page-radius": "var(--esp-avatar-page-radius)",
  "--ui2-button-min-h": "44px",
  "--ui2-button-sm-min-h": "44px",
  "--ui2-button-link-min-h": "44px",
  "--ui2-field-min-h": "44px",
  "--ui2-tab-min-h": "44px",
  "--esp-field-border": "var(--input)",
  "--ui2-button-outline-fg": "var(--foreground)",
  // Primitives de la recette responsive ANTSIA : elles restent initial côté DIASPORALE.
  "--esp-motif-reference-glow": { clair: "rgb(0 0 0 / 0.07)", sombre: "rgb(255 255 255 / 0.12)" },
  "--esp-motif-grain-ink": { clair: "rgb(0 0 0 / 0.07)", sombre: "rgb(255 255 255 / 0.05)" },
  "--esp-theme-card-shadow": "none",
  "--esp-heading-font-weight": "700",
  "--esp-page-title-tracking": "-0.015em",
  "--esp-section-title-tracking": "-0.01em",
  "--esp-floating-shadow": "var(--esp-mobilebar-shadow)",
  "--esp-post-shadow": "var(--esp-theme-card-shadow)",
  "--esp-field-font-size": "16px",
  "--esp-field-line-height": "1.4",
  "--esp-textarea-min-height": "104px",
  "--esp-page-title-size": "26px",
  "--esp-page-title-leading": "1.1",
  "--esp-section-title-size": "20px",
  "--esp-section-title-leading": "1.2",
  "--esp-subsection-title-size": "16px",
  "--esp-subsection-title-leading": "1.3",
  "--esp-heading-font-family": "var(--font-display)",
  "--esp-content-font-size": "15px",
  "--esp-content-line-height": "1.5",
  "--esp-profile-avatar-page-radius": "24px",
  "--esp-profile-avatar-size": "104px",
  "--esp-fab-size": "52px",
  "--esp-layout-max-width": "1400px",
  "--esp-layout-gutter": "20px",
  "--esp-layout-gap": "24px",
  "--esp-desktop-main-max": "none",
  "--esp-grid-compact-columns": "248px minmax(0, 1fr)",
  "--esp-grid-wide-columns": "248px minmax(0, 1fr) 312px",
  "--esp-mobile-content-padding": "4px 12px 120px",
  "--esp-tablet-content-padding": "8px 24px 140px",
  "--esp-tablet-content-max": "728px",
  "--esp-mobile-dock-inset": "12px",
  "--esp-mobile-dock-bottom": "16px",
  "--esp-tablet-dock-bottom": "26px",
  "--esp-tablet-dock-width": "540px",
  // Avatars et titres ANTSIA : mêmes renvois dans les deux modes, palette résolue du mode.
  "--esp-avatar-1-bg": "color-mix(in srgb, var(--role-social-fill) 15%, var(--card))",
  "--esp-avatar-1-fg": "var(--role-social-ink)",
  "--esp-avatar-2-bg": "var(--primary-fill)",
  "--esp-avatar-2-fg": "var(--primary-fill-on)",
  "--esp-avatar-3-bg": "var(--role-commerce-fill)",
  "--esp-avatar-3-fg": "var(--role-commerce-on)",
  "--esp-avatar-4-bg": "var(--role-message-soft)",
  "--esp-avatar-4-fg": "var(--role-message-ink)",
  "--esp-avatar-5-bg": "var(--role-social-fill)",
  "--esp-avatar-5-fg": "var(--role-social-on)",
  "--esp-avatar-6-bg": "var(--foreground)",
  "--esp-avatar-6-fg": "var(--background)",
  "--esp-avatar-neutral-bg": "var(--muted)",
  "--esp-avatar-neutral-fg": "var(--foreground)",
  "--esp-avatar-font-24": "9.5px",
  "--esp-avatar-font-32": "11.5px",
  "--esp-avatar-font-40": "13px",
  "--esp-avatar-font-48": "15px",
  "--esp-avatar-font-64": "20px",
  "--esp-avatar-font-104": "32px",
  "--esp-story-ring-seen-fill": "var(--border)",
  "--esp-messages-heading-size": "22px",
}

function networkTheme(file: string, charte: string) {
  const sheet = themeSheet(file, charte)
  return {
    /** Les jetons que la charte du réseau déclare elle-même, hors bannière (DIASPORALE garde la sienne). */
    own: [...new Set([...sheet.light.keys(), ...sheet.dark.keys(), ...sheet.common.keys()])].filter((token) => token !== "--esp-banner"),
    clair: cascade(BASE_LIGHT, sheet.light, sheet.common),
    sombre: cascade(BASE_LIGHT, sheet.light, BASE_DARK, sheet.dark, sheet.common),
  }
}

const swatchesOf = (css: string) => [1, 2, 3].map((index) => new RegExp(`--esp-theme-swatch-${index}:\\s*(#[0-9a-f]{6})`, "i").exec(css.replace(/\/\*[\s\S]*?\*\//g, ""))?.[1])

describe("Sable et Gaboma — une structure, deux palettes, la maquette du réseau", () => {
  it("structure de Sable, jeton pour jeton : mêmes jetons dans le même ordre, mêmes renvois et mêmes mesures ; seules les couleurs changent", () => {
    for (const block of ["light", "dark", "common"] as const) {
      const sable = SABLE_SHEET[block]
      const gaboma = GABOMA_SHEET[block]
      expect([...gaboma.keys()], block).toEqual([...sable.keys()])
      const drift = [...sable].filter(([token, value]) => !isColorValue(value) && gaboma.get(token) !== value)
      expect(drift.map(([token]) => `${block} ${token} : ${sable.get(token)} ≠ ${gaboma.get(token)}`)).toEqual([])
    }
  })

  it("garde les avatars de DIASPORALE : une personne garde sa couleur d'un thème à l'autre", () => {
    const avatars = [...SABLE_SHEET.light.keys()].filter((token) => /^--esp-(ava-|on-avatar)/.test(token))
    expect(avatars.length).toBeGreaterThanOrEqual(7)
    for (const token of avatars) expect(GABOMA_SHEET.light.get(token), token).toBe(SABLE_SHEET.light.get(token))
  })

  for (const [name, sheet, themes, file, charte] of [
    ["Sable", SABLE_SHEET, SABLE, "antsia-sable.css", "antsia-sable"],
    ["Gaboma", GABOMA_SHEET, GABOMA, "antsia.css", "antsia"],
  ] as const) {
    it(`${name} reprend chaque couleur de la charte du réseau qui porte la maquette (${file}), dans les deux modes`, () => {
      const network = networkTheme(file, charte)
      const own = new Set([...sheet.light.keys(), ...sheet.dark.keys(), ...sheet.common.keys()])
      const shared = network.own.filter((token) => !Object.hasOwn(ANTSIA_PRIMITIVE_OPT_INS, token))
      expect(shared.filter((token) => !own.has(token)), "aucun jeton partagé manquant").toEqual([])
      for (const mode of ["clair", "sombre"] as const) {
        const drift = shared.filter((token) => resolveToken(themes.theme[mode], token) !== resolveToken(network[mode], token))
        expect(drift.map((token) => `${mode} ${token}`)).toEqual([])
      }
      expect(swatchesOf(sheet.css)).toEqual(swatchesOf(readFileSync(new URL(`themes/${file}`, ENGINE_UI), "utf8")))
      expect(swatchesOf(sheet.css).every((swatch) => swatch !== undefined)).toBe(true)
    })

    it(`${name} garde les nouvelles primitives ANTSIA séparées de sa palette et au défaut de la base`, () => {
      const network = networkTheme(file, charte)
      const own = new Set([...sheet.light.keys(), ...sheet.dark.keys(), ...sheet.common.keys()])
      const networkOnly = network.own.filter((token) => !own.has(token))
      expect(networkOnly.sort()).toEqual(Object.keys(ANTSIA_PRIMITIVE_OPT_INS).sort())
      for (const mode of ["clair", "sombre"] as const) {
        const defaults = mode === "clair" ? BASE_LIGHT : cascade(BASE_LIGHT, BASE_DARK)
        for (const [token, expected] of Object.entries(ANTSIA_PRIMITIVE_OPT_INS)) {
          const value = typeof expected === "string" ? expected : expected[mode]
          expect(network[mode].get(token), `${mode} ${token} : activation ANTSIA`).toBe(value)
          if (token === "--esp-heading-font-family") {
            // Liste CSS valide : var() possède un repli de police, puis les familles de secours.
            expect(resolveToken(network[mode], token), `${mode} ${token} : familles ANTSIA`).toBe('var(--font-familjen-grotesk, "Familjen Grotesk Variable"), "Inter", system-ui, sans-serif')
          } else {
            expect(resolveToken(network[mode], token), `${mode} ${token} : renvoi ANTSIA résolu`).not.toMatch(/^(initial|var\()/)
          }
          expect(themes.theme[mode].get(token), `${mode} ${token} : défaut DIASPORALE`).toBe(defaults.get(token))
          expect(resolveToken(themes.theme[mode], token), `${mode} ${token} : repli DIASPORALE`).toBe(resolveToken(defaults, token))
        }
      }
    })
  }
})
