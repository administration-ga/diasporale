#!/usr/bin/env node
/**
 * Contrôle d'une version servie de diasporale.com (LX-02), en lecture seule :
 *
 *   node scripts/release-check.mjs --target demo --version diasporale-<12>-antsia-<12>-demo
 *
 * Trois preuves, lues sur le site de la cible (`DIASPORALE_<CIBLE>_SITE_URL`) :
 *  1. la sonde `/api/sante-fonctionnelle` (LX-01) dit « ok », l'application
 *     `diasporale-com`, la source « engine », le moteur configuré et joint ;
 *  2. la version servie est l'étiquette attendue (tirée des deux commits publiés) ;
 *  3. le moteur visé est celui de la cible : la politique de sécurité du contenu
 *     autorise l'origine de `DIASPORALE_<CIBLE>_CONVEX_URL`, et aucun autre moteur.
 *
 * Aucune écriture, aucun identifiant affiché : les messages nomment les variables,
 * jamais leur valeur, et une erreur du réseau n'est jamais recopiée (elle peut citer
 * une adresse). `release.mjs` et `rollback.mjs` s'en servent après la bascule.
 */
import { pathToFileURL } from "node:url"

import {
  CHECK_KEYS,
  HEALTH_APPLICATION,
  HEALTH_PATH,
  parseJson,
  parseOptions,
  parseTarget,
  parseVersionLabel,
  readTargetEnv,
  targetVariableNames,
} from "./release-lib.mjs"

export const USAGE = "Usage : node scripts/release-check.mjs --target demo|production --version diasporale-<12>-antsia-<12>-<cible>"

/** Les options ; la version doit avoir la forme d'une étiquette de la même cible. */
export function parseCheckArgs(argv) {
  const { options, problems } = parseOptions(argv, { values: ["target", "version"], flags: [] })
  const target = parseTarget(options.target)
  if (target === null) problems.push("--target doit valoir demo ou production")
  const label = parseVersionLabel(options.version)
  if (!label) problems.push("--version doit être une étiquette diasporale-<12>-antsia-<12>-<cible>")
  else if (target !== null && label.target !== target) problems.push("--version désigne une autre cible que --target")
  return { target, version: options.version, problems }
}

/**
 * Les écarts d'un rapport de sonde. `version: null` : la version n'est pas comparée
 * (relevé de la version servie avant une publication).
 * @param {unknown} report
 * @param {{ version: string | null }} expected
 */
export function evaluateHealth(report, { version }) {
  if (!report || typeof report !== "object") return ["la sonde ne rend pas un rapport lisible"]
  const problems = []
  if (report.application !== HEALTH_APPLICATION) problems.push(`la sonde n'est pas celle de ${HEALTH_APPLICATION}`)
  if (report.status !== "ok") problems.push("état dégradé : le service ne peut pas servir ses données")
  if (version !== null && report.version !== version) problems.push(`version servie « ${String(report.version)} », attendue « ${version} »`)
  if (report.dataSource !== "engine") problems.push("source de données autre que « engine » : un site publié sert le moteur, jamais les données fictives")
  if (report.backend !== "configured") problems.push("adresse du moteur absente de la construction")
  if (report.engine !== "reachable") problems.push("moteur injoignable depuis le site")
  return problems
}

/** Les écarts d'une réponse de sonde reçue en texte (sortie de `vercel curl`). */
export function evaluateHealthText(text, expected) {
  const report = parseJson(text)
  return report === null ? ["réponse de la sonde illisible (pas du JSON)"] : evaluateHealth(report, expected)
}

/** Les sources d'une directive de la politique de sécurité du contenu (vide si absente). */
export function cspSources(csp, directive) {
  for (const part of (csp ?? "").split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/)
    if (name === directive) return sources
  }
  return []
}

/**
 * Le moteur visé : `connect-src` autorise l'origine du moteur de la cible (https et
 * wss), et aucune autre origine de moteur Convex. Les messages nomment la variable.
 */
export function evaluateEngineTarget(csp, convexUrl, variableName) {
  if (!csp) return ["en-tête Content-Security-Policy absent : le moteur visé ne se vérifie pas"]
  const sources = cspSources(csp, "connect-src")
  const expected = new URL(convexUrl)
  const problems = []
  if (!sources.includes(expected.origin) || !sources.includes(`wss://${expected.host}`)) {
    problems.push(`la politique de sécurité n'autorise pas le moteur de ${variableName}`)
  }
  const others = sources.filter((source) => {
    try {
      const url = new URL(source)
      return url.hostname.endsWith(".convex.cloud") && url.host !== expected.host
    } catch {
      return false
    }
  })
  if (others.length > 0) problems.push(`la politique de sécurité autorise ${others.length} origine(s) d'un autre moteur que celui de ${variableName}`)
  return problems
}

/**
 * Lit la sonde du site et contrôle version, état et moteur visé, en `attempts` essais
 * espacés (la bascule met quelques secondes à se propager).
 * @param {{ target: "demo" | "production", siteUrl: string, convexUrl: string, version: string | null, fetch: typeof fetch, attempts?: number, delayMs?: number, sleep?: (ms: number) => Promise<void> }} input
 * @returns {Promise<{ ok: boolean, problems: string[], report: object | null, attempts: number }>}
 */
export async function checkRelease({ target, siteUrl, convexUrl, version, fetch, attempts = 1, delayMs = 6_000, sleep = async () => {} }) {
  const names = targetVariableNames(target)
  let problems = []
  let report = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(new URL(HEALTH_PATH, siteUrl), { cache: "no-store", redirect: "error", headers: { accept: "application/json" } })
      report = parseJson(await response.text())
      problems = [
        ...(report === null ? ["réponse de la sonde illisible (pas du JSON)"] : evaluateHealth(report, { version })),
        ...evaluateEngineTarget(response.headers.get("content-security-policy"), convexUrl, names.convexUrl),
      ]
    } catch {
      report = null
      problems = [`site de ${names.siteUrl} injoignable`]
    }
    if (problems.length === 0) return { ok: true, problems, report, attempts: attempt }
    if (attempt < attempts) await sleep(delayMs)
  }
  return { ok: false, problems, report, attempts }
}

async function main() {
  const args = parseCheckArgs(process.argv.slice(2))
  if (args.problems.length > 0) {
    console.error([USAGE, ...args.problems.map((problem) => `  - ${problem}`)].join("\n"))
    process.exitCode = 1
    return
  }
  const { values, problems } = readTargetEnv(args.target, process.env, CHECK_KEYS)
  if (problems.length > 0) {
    console.error(["✗ contrôle impossible :", ...problems.map((problem) => `  - ${problem}`)].join("\n"))
    process.exitCode = 1
    return
  }
  const result = await checkRelease({ target: args.target, siteUrl: values.siteUrl, convexUrl: values.convexUrl, version: args.version, fetch: globalThis.fetch, attempts: 3 })
  if (result.ok) {
    console.log(`✓ ${args.target} sert ${args.version} : sonde « ok », source « engine », moteur joint et visé (${targetVariableNames(args.target).convexUrl}).`)
    return
  }
  console.error([`✗ ${args.target} ne sert pas ${args.version} comme attendu :`, ...result.problems.map((problem) => `  - ${problem}`)].join("\n"))
  process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
