#!/usr/bin/env node
/**
 * Publication de diasporale.com (LX-02) — procédure : docs/37_PUBLICATION_ET_RETOUR_ARRIERE.md.
 *
 *   node scripts/release.mjs --target demo --antsia <commit> --diasporale <commit>
 *       affiche le plan (par défaut) : RIEN ne part, aucune commande réseau
 *   node scripts/release.mjs --target demo --antsia <commit> --diasporale <commit> --execute
 *       exécute le plan, après deux confirmations tapées dans un terminal
 *
 * Le plan suit la méthode employée du 22/10 au 3/11/2026 pour la démonstration :
 * contexte figé à partir des deux commits, variables publiques seulement, étiquette
 * de version tirée des deux commits, publication SANS bascule, contrôle privé par la
 * sonde (LX-01), bascule, contrôle public (version servie et moteur visé).
 *
 * La porte : toute exécution exige l'accord écrit et détaillé du propriétaire (commit
 * de chaque dépôt, cible, ordre, retour arrière). Le script le rappelle et s'arrête
 * devant deux phrases à taper ; aucune option ne les contourne, et une entrée qui
 * n'est pas un terminal refuse. Le backend du moteur est publié AVANT, par la session
 * du moteur : ce script ne touche à aucun backend.
 */
import { pathToFileURL } from "node:url"

import { checkRelease, evaluateHealthText } from "./release-check.mjs"
import {
  agreementNotice,
  confirmationPhrase,
  confirmPhrase,
  createWorkdir,
  deploymentUrlFrom,
  envRef,
  freezeCommands,
  freezeContext,
  HEALTH_PATH,
  isPublishedCommit,
  parseInspect,
  parseOptions,
  parseTarget,
  readTargetEnv,
  RELEASE_KEYS,
  RELEASE_REPOSITORIES,
  releaseVariables,
  releaseVersion,
  renderCommand,
  repoRef,
  resolveCommand,
  resolveCommit,
  resolveStepEnv,
  runCommand,
  runtimeRef,
  SHARED_VARIABLE_NAMES,
  targetVariableNames,
  writeRecord,
} from "./release-lib.mjs"
import { rollbackCommand } from "./rollback.mjs"

export const USAGE =
  "Usage : node scripts/release.mjs --target demo|production --antsia <commit> --diasporale <commit> [--execute]"

/** Les options de la ligne de commande ; `problems` non vide = usage refusé. */
export function parseReleaseArgs(argv) {
  const { options, problems } = parseOptions(argv, { values: ["target", "antsia", "diasporale"], flags: ["execute"] })
  const target = parseTarget(options.target)
  if (target === null) problems.push("--target doit valoir demo ou production")
  if (!options.antsia) problems.push("--antsia <commit> manque")
  if (!options.diasporale) problems.push("--diasporale <commit> manque")
  return { target, antsia: options.antsia, diasporale: options.diasporale, execute: options.execute === true, problems }
}

const DEPLOYMENT = runtimeRef("deploymentUrl", "adresse du déploiement")

/**
 * Le plan de publication, sans rien exécuter ni lire du réseau. Les valeurs de la
 * machine y restent des références : le plan rendu se colle tel quel dans une demande
 * d'accord.
 * @param {{ target: "demo" | "production", antsia: { commit: string, tree: string }, diasporale: { commit: string, tree: string }, values?: Record<string, string> }} input
 */
export function buildReleasePlan({ target, antsia, diasporale, values = {} }) {
  const names = targetVariableNames(target)
  const version = releaseVersion({ diasporaleCommit: diasporale.commit, antsiaCommit: antsia.commit, target })
  const variables = releaseVariables(target, version, values)
  const scope = envRef(SHARED_VARIABLE_NAMES.scope)
  const vercelEnv = { VERCEL_ORG_ID: envRef(SHARED_VARIABLE_NAMES.orgId), VERCEL_PROJECT_ID: envRef(names.projectId) }
  const publishPhrase = confirmationPhrase("PUBLIER", target, version)
  const promotePhrase = confirmationPhrase("BASCULER", target, version)
  const steps = [
    { id: "agreement", title: "Accord écrit du propriétaire, puis confirmation tapée", gate: publishPhrase },
    { id: "fetch", title: "Relire origin/main des deux dépôts", commands: ["ANTSIA", "DIASPORALE"].map((name) => ["git", "-C", repoRef(name), "fetch", "origin", "main"]) },
    {
      id: "published",
      title: "Chaque commit est sur origin/main (jamais une branche ni un HEAD local)",
      commands: [
        ["git", "-C", repoRef("ANTSIA"), "merge-base", "--is-ancestor", antsia.commit, "origin/main"],
        ["git", "-C", repoRef("DIASPORALE"), "merge-base", "--is-ancestor", diasporale.commit, "origin/main"],
      ],
    },
    {
      id: "freeze",
      title: "Contexte figé : fichiers suivis des deux commits, dans un dossier vide hors des dépôts, avec .vercelignore et empreinte",
      commands: [...freezeCommands("ANTSIA", antsia.commit), ...freezeCommands("DIASPORALE", diasporale.commit)],
    },
    {
      id: "served",
      title: "Relever le déploiement servi et sa version : la cible du retour arrière",
      commands: [["vercel", "inspect", envRef(names.siteUrl), "--scope", scope, "--format=json"]],
      env: vercelEnv,
    },
    {
      id: "deploy",
      title: "Publier sans bascule (aucun domaine ne change)",
      commands: [
        [
          "vercel",
          "deploy",
          runtimeRef("context", "contexte figé"),
          "--prod",
          "--skip-domain",
          "--archive=tgz",
          "--yes",
          "--scope",
          scope,
          ...variables.flatMap(([name, value]) => ["--build-env", [`${name}=`, value], "--env", [`${name}=`, value]]),
          "--meta",
          `diasporaleReleaseCommit=${diasporale.commit}`,
          "--meta",
          `antsiaReleaseCommit=${antsia.commit}`,
          "--meta",
          ["sourceFingerprint=", runtimeRef("fingerprint", "empreinte des sources")],
        ],
      ],
      env: vercelEnv,
    },
    { id: "ready", title: "Le déploiement est prêt (READY)", commands: [["vercel", "inspect", DEPLOYMENT, "--scope", scope, "--format=json"]], env: vercelEnv },
    {
      id: "private-check",
      title: `Contrôle privé avant bascule : la sonde dit « ok », la version ${version}, la source « engine », le moteur joint`,
      commands: [["vercel", "curl", HEALTH_PATH, "--deployment", DEPLOYMENT, "--scope", scope]],
      env: vercelEnv,
    },
    { id: "confirm-promote", title: "Bascule : seconde confirmation tapée, après lecture du contrôle", gate: promotePhrase },
    { id: "promote", title: "Basculer le domaine sur le nouveau déploiement", commands: [["vercel", "promote", DEPLOYMENT, "--scope", scope, "--yes"]], env: vercelEnv },
    {
      id: "public-check",
      title: "Contrôle public : sonde, version servie, moteur visé (CSP limitée au moteur de la cible)",
      commands: [["node", "scripts/release-check.mjs", "--target", target, "--version", version]],
    },
  ]
  return { target, version, antsia, diasporale, variables, steps, confirmations: { publish: publishPhrase, promote: promotePhrase } }
}

/** Les quatre points de l'accord du propriétaire, pour ce plan. */
export function releaseAgreementPoints(plan) {
  return [
    `commits : ANTSIA ${plan.antsia.commit}, DIASPORALE ${plan.diasporale.commit}`,
    `cible : ${plan.target} (variables ${targetVariableNames(plan.target).siteUrl} et suivantes)`,
    "ordre : backend du moteur déjà publié depuis le même commit d'ANTSIA, puis ce site ; un seul publieur à la fois",
    "retour arrière : le déploiement servi avant la bascule, relevé à l'étape « served » (node scripts/rollback.mjs)",
  ]
}

/**
 * Le plan rendu en texte : étapes numérotées, commandes sans aucune valeur de la machine.
 * @param {{ published?: { antsia: boolean, diasporale: boolean }, problems?: string[] }} facts relevés locaux
 */
export function renderReleasePlan(plan, { published, problems = [] } = {}) {
  const lines = [
    `Plan de publication de diasporale.com — cible ${plan.target}`,
    `  version : ${plan.version}`,
    `  ANTSIA ${plan.antsia.commit} (arbre ${plan.antsia.tree})`,
    `  DIASPORALE ${plan.diasporale.commit} (arbre ${plan.diasporale.tree})`,
    `  variables publiques : ${plan.variables.map(([name]) => name).join(", ")}`,
  ]
  if (published) {
    lines.push(
      `  sur origin/main (relevé local, relu avant exécution) : ANTSIA ${published.antsia ? "oui" : "NON"}, DIASPORALE ${published.diasporale ? "oui" : "NON"}`,
    )
  }
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
 * Exécute un plan, étape par étape, et s'arrête au premier écart. Tout ce qui touche
 * la machine ou le réseau passe par `deps` (remplacé dans les tests) :
 * `run(argv, { env }) → { status, stdout }`, `confirm(phrase) → Promise<boolean>`,
 * `fetch`, `log`, `env`, `repos`, `makeWorkdir()`, `freeze({ workdir, commits })`,
 * `record(workdir, relevé)`, `sleep(ms)`.
 * @returns {Promise<{ ok: boolean, stage: string, reason?: string, record: object }>}
 */
export async function executeRelease(plan, deps) {
  const names = targetVariableNames(plan.target)
  const record = { target: plan.target, version: plan.version, antsiaCommit: plan.antsia.commit, diasporaleCommit: plan.diasporale.commit, stages: [] }
  const runtime = {}
  let workdir = null
  const context = () => ({ env: deps.env, runtime, repos: deps.repos })
  const save = () => {
    if (workdir) deps.record(workdir, record)
  }
  const stop = (stage, reason) => {
    record.stoppedAt = stage
    record.reason = reason
    save()
    deps.log(`✗ arrêt à l'étape « ${stage} » : ${reason}`)
    return { ok: false, stage, reason, record }
  }
  const step = (id) => plan.steps.find((candidate) => candidate.id === id)
  const runStep = (id, index = 0) => {
    const current = step(id)
    return deps.run(resolveCommand(current.commands[index], context()), { env: resolveStepEnv(current.env, context()) })
  }
  const done = (stage) => {
    record.stages.push(stage)
    save()
    deps.log(`✓ ${step(stage).title}`)
  }

  deps.log(agreementNotice(releaseAgreementPoints(plan)))
  if (!(await deps.confirm(plan.confirmations.publish))) return stop("agreement", "confirmation absente : rien n'est parti")
  record.stages.push("agreement")

  for (const index of [0, 1]) {
    if (runStep("fetch", index).status !== 0) return stop("fetch", "origin/main n'a pas pu être relu")
  }
  done("fetch")
  for (const [index, name] of [[0, "ANTSIA"], [1, "DIASPORALE"]]) {
    if (runStep("published", index).status !== 0) return stop("published", `le commit de ${name} n'est pas sur origin/main`)
  }
  done("published")

  try {
    workdir = deps.makeWorkdir()
    runtime.workdir = workdir
    const frozen = deps.freeze({ workdir, commits: { ANTSIA: plan.antsia.commit, DIASPORALE: plan.diasporale.commit } })
    runtime.context = frozen.context
    runtime.fingerprint = frozen.fingerprint
    record.sourceFingerprint = frozen.fingerprint
    record.sourceFiles = frozen.files
  } catch (error) {
    return stop("freeze", error instanceof Error ? error.message : "contexte figé impossible")
  }
  done("freeze")

  const served = runStep("served")
  const servedDeployment = served.status === 0 ? parseInspect(served.stdout) : null
  const siteUrl = deps.env[names.siteUrl]?.trim()
  const convexUrl = deps.env[names.convexUrl]?.trim()
  // Relevé seulement : la version servie avant la bascule, que le retour arrière devra retrouver.
  const servedHealth = await checkRelease({ target: plan.target, siteUrl, convexUrl, version: null, fetch: deps.fetch })
  record.previous = servedDeployment?.url ? { deployment: servedDeployment.url, version: servedHealth.report?.version ?? null } : null
  done("served")
  deps.log(
    record.previous
      ? `  retour arrière possible vers la version ${record.previous.version ?? "inconnue"} (relevé : ${workdir}/release.json)`
      : "  aucun déploiement servi relevé : première publication, aucun retour arrière possible",
  )

  const deployed = runStep("deploy")
  const deploymentUrl = deployed.status === 0 ? deploymentUrlFrom(deployed.stdout) : null
  if (!deploymentUrl) return stop("deploy", "la publication a échoué ou n'a pas rendu l'adresse du déploiement")
  runtime.deploymentUrl = deploymentUrl
  record.deployment = deploymentUrl
  done("deploy")

  const inspected = runStep("ready")
  const readyState = inspected.status === 0 ? parseInspect(inspected.stdout)?.readyState : null
  if (readyState !== "READY") return stop("ready", `le déploiement n'est pas prêt (${readyState ?? "état illisible"}) ; aucune bascule`)
  done("ready")

  const privateCheck = runStep("private-check")
  const privateProblems = privateCheck.status === 0 ? evaluateHealthText(privateCheck.stdout, { version: plan.version }) : ["la sonde n'a pas répondu"]
  if (privateProblems.length > 0) return stop("private-check", `${privateProblems.join(" ; ")} — aucune bascule, le domaine sert toujours l'ancienne version`)
  done("private-check")

  if (!(await deps.confirm(plan.confirmations.promote))) return stop("confirm-promote", "bascule non confirmée : le déploiement reste publié sans domaine")
  record.stages.push("confirm-promote")

  if (runStep("promote").status !== 0) return stop("promote", "la bascule a échoué : vérifier la version servie avec release-check")
  record.promotedAt = new Date().toISOString()
  done("promote")

  const check = await checkRelease({
    target: plan.target,
    siteUrl,
    convexUrl,
    version: plan.version,
    fetch: deps.fetch,
    attempts: 5,
    sleep: deps.sleep,
  })
  record.publicCheck = check.problems
  if (!check.ok) {
    const back = record.previous ? rollbackCommand(plan.target, record.previous.deployment, record.previous.version) : null
    return stop(
      "public-check",
      `${check.problems.join(" ; ")}${back ? ` — retour arrière, sur accord : ${back}` : " — aucun déploiement précédent relevé"}`,
    )
  }
  done("public-check")
  return { ok: true, stage: "public-check", record }
}

async function main() {
  const args = parseReleaseArgs(process.argv.slice(2))
  if (args.problems.length > 0) {
    console.error([USAGE, ...args.problems.map((problem) => `  - ${problem}`)].join("\n"))
    process.exitCode = 1
    return
  }
  let antsia
  let diasporale
  try {
    antsia = resolveCommit(RELEASE_REPOSITORIES.ANTSIA, args.antsia)
    diasporale = resolveCommit(RELEASE_REPOSITORIES.DIASPORALE, args.diasporale)
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : "commit illisible"}`)
    process.exitCode = 1
    return
  }
  const { values, problems } = readTargetEnv(args.target, process.env, RELEASE_KEYS)
  const plan = buildReleasePlan({ target: args.target, antsia, diasporale, values })
  const published = {
    antsia: isPublishedCommit(RELEASE_REPOSITORIES.ANTSIA, antsia.commit),
    diasporale: isPublishedCommit(RELEASE_REPOSITORIES.DIASPORALE, diasporale.commit),
  }
  console.log(renderReleasePlan(plan, { published, problems }))
  if (!args.execute) {
    console.log("\nRien n'est parti : ceci est le plan. L'exécution (--execute) exige l'accord écrit du propriétaire.")
    return
  }
  if (problems.length > 0) {
    console.error("\n✗ exécution refusée : variables de la machine à corriger (voir ci-dessus).")
    process.exitCode = 1
    return
  }
  const result = await executeRelease(plan, {
    run: runCommand,
    confirm: (phrase) => confirmPhrase(phrase),
    fetch: globalThis.fetch,
    log: (line) => console.log(line),
    env: process.env,
    repos: RELEASE_REPOSITORIES,
    makeWorkdir: () => createWorkdir(process.env),
    freeze: ({ workdir, commits }) => freezeContext({ workdir, commits }),
    record: writeRecord,
    sleep: (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms)),
  })
  console.log(result.ok ? `\n✓ ${plan.version} servie sur la cible ${plan.target}.` : "\nPublication interrompue.")
  process.exitCode = result.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
