#!/usr/bin/env node
/**
 * Retour arrière du site diasporale.com (LX-02) — procédure : docs/37_PUBLICATION_ET_RETOUR_ARRIERE.md.
 *
 *   node scripts/rollback.mjs --target demo --to <déploiement> --version <étiquette>
 *       affiche le plan (par défaut) : RIEN ne part
 *   node scripts/rollback.mjs --target demo --to <déploiement> --version <étiquette> --execute
 *       remet en service le déploiement désigné, après une confirmation tapée
 *
 * `--to` est le déploiement servi AVANT la dernière bascule (relevé par `release.mjs`
 * dans `release.json`, hors des dépôts) ; `--version` est l'étiquette qu'il doit dire.
 * Comme la méthode connue, le retour arrière REPROMEUT ce déploiement : rien n'est
 * reconstruit ni supprimé. Il ne vaut que pour le site ; le backend du moteur se remet
 * en arrière par sa session (republier le commit précédent, jamais d'index supprimé).
 *
 * La porte : l'accord écrit du propriétaire nomme ce retour arrière (il figure dans
 * l'accord de la publication) ; le script le rappelle et s'arrête devant une phrase à
 * taper dans un terminal. Aucune option ne la contourne.
 */
import { pathToFileURL } from "node:url"

import { checkRelease } from "./release-check.mjs"
import {
  agreementNotice,
  confirmationPhrase,
  confirmPhrase,
  envRef,
  parseInspect,
  parseOptions,
  parseTarget,
  parseVersionLabel,
  readTargetEnv,
  renderArg,
  renderCommand,
  resolveCommand,
  resolveStepEnv,
  ROLLBACK_KEYS,
  RELEASE_REPOSITORIES,
  runCommand,
  SHARED_VARIABLE_NAMES,
  targetVariableNames,
} from "./release-lib.mjs"

export const USAGE = "Usage : node scripts/rollback.mjs --target demo|production --to <déploiement> --version <étiquette> [--execute]"

/** Un déploiement désigné : son adresse https (origine seule) ou son identifiant. */
export function isDeploymentReference(raw) {
  if (typeof raw !== "string") return false
  // Un identifiant commence par une lettre ou un chiffre : jamais une option (« --yes »).
  if (/^[A-Za-z0-9][A-Za-z0-9_-]{2,}$/.test(raw)) return true
  try {
    const url = new URL(raw)
    return url.protocol === "https:" && url.origin === raw
  } catch {
    return false
  }
}

/** Les options ; la version doit être une étiquette de la même cible. */
export function parseRollbackArgs(argv) {
  const { options, problems } = parseOptions(argv, { values: ["target", "to", "version"], flags: ["execute"] })
  const target = parseTarget(options.target)
  if (target === null) problems.push("--target doit valoir demo ou production")
  if (!isDeploymentReference(options.to)) problems.push("--to doit désigner un déploiement (adresse https ou identifiant)")
  const label = parseVersionLabel(options.version)
  if (!label) problems.push("--version doit être une étiquette diasporale-<12>-antsia-<12>-<cible>")
  else if (target !== null && label.target !== target) problems.push("--version désigne une autre cible que --target")
  return { target, to: options.to, version: options.version, execute: options.execute === true, problems }
}

/** La commande de retour arrière, telle que `release.mjs` la propose après un contrôle public en échec. */
export function rollbackCommand(target, deployment, version) {
  return `node scripts/rollback.mjs --target ${target} --to ${renderArg(deployment)} --version ${version ?? "<étiquette servie avant la bascule>"}`
}

/**
 * Le plan de retour arrière, sans rien exécuter.
 * @param {{ target: "demo" | "production", to: string, version: string }} input
 */
export function buildRollbackPlan({ target, to, version }) {
  const names = targetVariableNames(target)
  const scope = envRef(SHARED_VARIABLE_NAMES.scope)
  const vercelEnv = { VERCEL_ORG_ID: envRef(SHARED_VARIABLE_NAMES.orgId), VERCEL_PROJECT_ID: envRef(names.projectId) }
  const phrase = confirmationPhrase("REVENIR", target, version)
  return {
    target,
    to,
    version,
    phrase,
    steps: [
      { id: "agreement", title: "Accord écrit du propriétaire, puis confirmation tapée", gate: phrase },
      {
        id: "inspect",
        title: "Le déploiement désigné existe, est prêt (READY), de production, et appartient au projet de la cible",
        commands: [["vercel", "inspect", to, "--scope", scope, "--format=json"]],
        env: vercelEnv,
      },
      { id: "promote", title: "Le remettre en service (promotion, sans reconstruction)", commands: [["vercel", "promote", to, "--scope", scope, "--yes"]], env: vercelEnv },
      {
        id: "public-check",
        title: `Contrôle public : la sonde dit la version ${version}, la source « engine », le moteur visé`,
        commands: [["node", "scripts/release-check.mjs", "--target", target, "--version", version]],
      },
    ],
  }
}

/** Le plan rendu en texte, sans aucune valeur de la machine. */
export function renderRollbackPlan(plan, { problems = [] } = {}) {
  const lines = [`Plan de retour arrière de diasporale.com — cible ${plan.target}`, `  version attendue après le retour : ${plan.version}`]
  plan.steps.forEach((step, index) => {
    lines.push("", `${index + 1}. ${step.title}`)
    if (step.gate) lines.push(`   phrase à taper : ${step.gate}`)
    for (const argv of step.commands ?? []) lines.push(`   $ ${renderCommand(argv)}`)
    if (step.env) lines.push(`   avec ${Object.entries(step.env).map(([name, ref]) => `${name}=<${ref.env}>`).join(", ")}`)
  })
  if (problems.length > 0) lines.push("", "Variables de la machine à corriger avant toute exécution :", ...problems.map((problem) => `  - ${problem}`))
  return lines.join("\n")
}

/**
 * Exécute un retour arrière ; mêmes dépendances que `executeRelease` (`run`, `confirm`,
 * `fetch`, `log`, `env`, `repos`, `sleep`).
 * @returns {Promise<{ ok: boolean, stage: string, reason?: string }>}
 */
export async function executeRollback(plan, deps) {
  const names = targetVariableNames(plan.target)
  const context = { env: deps.env, runtime: {}, repos: deps.repos }
  const step = (id) => plan.steps.find((candidate) => candidate.id === id)
  const runStep = (id) => deps.run(resolveCommand(step(id).commands[0], context), { env: resolveStepEnv(step(id).env, context) })
  const stop = (stage, reason) => {
    deps.log(`✗ arrêt à l'étape « ${stage} » : ${reason}`)
    return { ok: false, stage, reason }
  }

  deps.log(
    agreementNotice([
      `cible : ${plan.target} (variables ${names.siteUrl} et suivantes)`,
      `déploiement remis en service : celui désigné par --to, qui doit dire ${plan.version}`,
      "ordre : le site seulement ; un backend du moteur se remet en arrière par sa session, avant ou après selon l'accord",
    ]),
  )
  if (!(await deps.confirm(plan.phrase))) return stop("agreement", "confirmation absente : rien n'est parti")

  const inspected = runStep("inspect")
  const deployment = inspected.status === 0 ? parseInspect(inspected.stdout) : null
  if (!deployment) return stop("inspect", "déploiement introuvable ou réponse illisible")
  if (deployment.readyState !== "READY") return stop("inspect", `déploiement non prêt (${deployment.readyState ?? "état illisible"})`)
  if (deployment.target !== null && deployment.target !== "production") return stop("inspect", "ce déploiement n'a pas été publié pour la production de la cible")
  if (deployment.projectId !== null && deployment.projectId !== deps.env[names.projectId]?.trim()) {
    return stop("inspect", `ce déploiement n'appartient pas au projet de ${names.projectId}`)
  }
  deps.log("✓ déploiement prêt, de production, du projet de la cible")

  if (runStep("promote").status !== 0) return stop("promote", "la remise en service a échoué")
  deps.log("✓ déploiement remis en service")

  const check = await checkRelease({
    target: plan.target,
    siteUrl: deps.env[names.siteUrl]?.trim(),
    convexUrl: deps.env[names.convexUrl]?.trim(),
    version: plan.version,
    fetch: deps.fetch,
    attempts: 5,
    sleep: deps.sleep,
  })
  if (!check.ok) return stop("public-check", check.problems.join(" ; "))
  deps.log(`✓ ${plan.target} sert de nouveau ${plan.version}`)
  return { ok: true, stage: "public-check" }
}

async function main() {
  const args = parseRollbackArgs(process.argv.slice(2))
  if (args.problems.length > 0) {
    console.error([USAGE, ...args.problems.map((problem) => `  - ${problem}`)].join("\n"))
    process.exitCode = 1
    return
  }
  const { problems } = readTargetEnv(args.target, process.env, ROLLBACK_KEYS)
  const plan = buildRollbackPlan(args)
  console.log(renderRollbackPlan(plan, { problems }))
  if (!args.execute) {
    console.log("\nRien n'est parti : ceci est le plan. L'exécution (--execute) exige l'accord écrit du propriétaire.")
    return
  }
  if (problems.length > 0) {
    console.error("\n✗ exécution refusée : variables de la machine à corriger (voir ci-dessus).")
    process.exitCode = 1
    return
  }
  const result = await executeRollback(plan, {
    run: runCommand,
    confirm: (phrase) => confirmPhrase(phrase),
    fetch: globalThis.fetch,
    log: (line) => console.log(line),
    env: process.env,
    repos: RELEASE_REPOSITORIES,
    sleep: (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms)),
  })
  process.exitCode = result.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
