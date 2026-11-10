import { getFixedT, SUPPORTED_LOCALES, type Locale } from "@diasporale/features/i18n"

import type { CharteSurface, InstallPalette } from "./install-palette"

/**
 * La page hors-ligne (MO-05), seule réserve du script de fond. Un document AUTONOME : styles en
 * ligne, aucune feuille, police, image ni script à charger, puisqu'elle s'affiche sans réseau.
 * Elle ne dit rien de la personne (aucune donnée de session) : la mettre en réserve ne garde
 * rien de privé sur l'appareil.
 *
 *  · À la marque : le mot-symbole et son œillet, les couleurs lues dans la charte (clair et
 *    sombre selon le téléphone) ; sans palette, les couleurs du système.
 *  · En français ET en anglais, la langue de la personne d'abord : la page est mise en réserve
 *    une fois, et doit rester lisible si la langue change ensuite.
 *  · « Réessayer » est un lien vers l'adresse même où la page s'affiche (le script de fond la sert
 *    à la place de la page demandée) : il relance la navigation, sans script.
 */

const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character)
}

function surfaceVariables(surface: CharteSurface): string {
  return `--bg:${surface.background};--fg:${surface.foreground};--muted:${surface.muted};--accent:${surface.accent};--rule:${surface.rule};--eyelet:${surface.eyelet};--ink:${surface.ink}`
}

/** Sans palette : les couleurs du système, qui suivent d'elles-mêmes le mode sombre. */
const SYSTEM_VARIABLES = "--bg:Canvas;--fg:CanvasText;--muted:GrayText;--accent:LinkText;--rule:GrayText;--eyelet:Canvas;--ink:CanvasText"

function styles(palette: InstallPalette | null): string {
  const light = palette ? surfaceVariables(palette.light) : SYSTEM_VARIABLES
  const dark = palette ? `@media (prefers-color-scheme: dark){:root{${surfaceVariables(palette.dark)}}}` : ""
  return [
    `:root{color-scheme:light dark;${light}}`,
    dark,
    "*{box-sizing:border-box}",
    "body{margin:0;min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:max(24px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,sans-serif}",
    "main{width:100%;max-width:28rem}",
    ".mark{display:flex;align-items:center;gap:8px;margin:0 0 24px;color:var(--fg);font-weight:700;font-size:20px;letter-spacing:.04em;text-transform:uppercase}",
    ".eyelet{width:10px;height:10px;border-radius:50%;background:var(--eyelet);box-shadow:0 0 0 2px var(--ink)}",
    "section+section{margin-top:24px;padding-top:24px;border-top:1px solid var(--rule)}",
    "h1,h2{margin:0 0 8px;font-size:22px;line-height:1.25}",
    "p{margin:0;color:var(--muted)}",
    "a{display:inline-flex;align-items:center;min-height:44px;margin-top:8px;color:var(--accent);font-weight:600;text-underline-offset:4px}",
    "a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}",
  ].join("")
}

/** Le document complet, la langue `locale` en premier, puis les autres langues du site. */
export function offlinePageHtml(input: { readonly locale: Locale; readonly palette: InstallPalette | null }): string {
  const order = [input.locale, ...SUPPORTED_LOCALES.filter((locale) => locale !== input.locale)]
  const first = getFixedT(input.locale)
  const sections = order
    .map((locale, index) => {
      const t = getFixedT(locale)
      const heading = index === 0 ? "h1" : "h2"
      return [
        `<section lang="${locale}">`,
        `<${heading}>${escapeHtml(t("installableApp.offline.title"))}</${heading}>`,
        `<p>${escapeHtml(t("installableApp.offline.body"))}</p>`,
        `<a href="">${escapeHtml(t("installableApp.offline.retry"))}</a>`,
        "</section>",
      ].join("")
    })
    .join("")
  return [
    "<!doctype html>",
    `<html lang="${input.locale}" dir="ltr">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<meta name="robots" content="noindex">',
    '<meta name="color-scheme" content="light dark">',
    `<title>${escapeHtml(first("installableApp.offline.documentTitle"))}</title>`,
    `<style>${styles(input.palette)}</style>`,
    "</head>",
    "<body><main>",
    `<p class="mark"><span class="eyelet" aria-hidden="true"></span>${escapeHtml(first("brand.name"))}</p>`,
    sections,
    "</main></body>",
    "</html>",
  ].join("")
}
