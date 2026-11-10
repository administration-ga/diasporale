/**
 * Bibliothèque commune des scripts de publication de diasporale.com (LX-02) :
 * `release.mjs` (publier), `release-check.mjs` (contrôler), `rollback.mjs` (revenir
 * en arrière). Procédure : `docs/37_PUBLICATION_ET_RETOUR_ARRIERE.md`.
 *
 * Elle reprend, dans le dépôt, la méthode employée hors dépôt du 22/10 au 3/11/2026
 * pour le site de démonstration : contexte figé à partir de deux commits (`git
 * archive`), variables PUBLIQUES seulement, étiquette de version tirée des deux
 * commits, publication sans bascule, contrôle, puis bascule.
 *
 * Le dépôt est public : aucun identifiant de projet, d'équipe ou de déploiement, aucune
 * adresse n'y est écrite. Tout vient de variables de la machine qui publie, lues au
 * moment de l'exécution ; les messages et le plan affiché les NOMMENT, ils ne
 * recopient jamais leur valeur (un plan se colle tel quel dans une demande d'accord).
 */
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"

export const DIASPORALE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
export const ECOSYSTEMS_ROOT = resolve(DIASPORALE_ROOT, "..")
export const ANTSIA_ROOT = join(ECOSYSTEMS_ROOT, "ANTSIA")

/** Les dépôts du contexte figé, sous leur nom de dossier dans ECOSYSTEMES. */
export const RELEASE_REPOSITORIES = Object.freeze({ ANTSIA: ANTSIA_ROOT, DIASPORALE: DIASPORALE_ROOT })

/** Les cibles : la démonstration déclarée (ADR-0038 du moteur), puis la production. */
export const RELEASE_TARGETS = Object.freeze(["demo", "production"])

/** La cible lue d'un argument, ou `null` si elle n'est pas l'une des deux. */
export function parseTarget(raw) {
  return RELEASE_TARGETS.includes(raw) ? raw : null
}

/** L'autre cible : une variable de l'une ne doit jamais désigner la ressource de l'autre. */
export function otherTarget(target) {
  return target === "demo" ? "production" : "demo"
}

/** Le chemin de la sonde de santé du site (LX-01). */
export const HEALTH_PATH = "/api/sante-fonctionnelle"

/** Le nom de l'application dans le rapport de la sonde (catalogue de publication du moteur). */
export const HEALTH_APPLICATION = "diasporale-com"

/**
 * Les NOMS des variables de la machine pour une cible, jamais leur valeur. Une
 * variable par cible : les réglages de la démonstration ne servent jamais la
 * production, par construction.
 */
export function targetVariableNames(target) {
  const prefix = `DIASPORALE_${target.toUpperCase()}_`
  return Object.freeze({
    siteUrl: `${prefix}SITE_URL`,
    convexUrl: `${prefix}CONVEX_URL`,
    convexSiteUrl: `${prefix}CONVEX_SITE_URL`,
    projectId: `${prefix}VERCEL_PROJECT_ID`,
    idnPortalUrl: `${prefix}IDN_PORTAL_URL`,
    consulateUrl: `${prefix}CONSULATE_URL`,
  })
}

/** Variables de la machine communes aux deux cibles. */
export const SHARED_VARIABLE_NAMES = Object.freeze({
  orgId: "DIASPORALE_VERCEL_ORG_ID",
  scope: "DIASPORALE_VERCEL_SCOPE",
  workdir: "DIASPORALE_RELEASE_WORKDIR",
})

/** Ce que chaque script exige de l'environnement. */
export const RELEASE_KEYS = Object.freeze(["siteUrl", "convexUrl", "convexSiteUrl", "projectId", "orgId", "scope"])
export const CHECK_KEYS = Object.freeze(["siteUrl", "convexUrl"])
export const ROLLBACK_KEYS = Object.freeze(["siteUrl", "convexUrl", "projectId", "orgId", "scope"])

const ORIGIN_KEYS = new Set(["siteUrl", "convexUrl", "convexSiteUrl"])
const TOKEN_KEYS = new Set(["projectId", "orgId", "scope"])
const OPTIONAL_URL_KEYS = ["idnPortalUrl", "consulateUrl"]
/** Ressources qui ne se partagent jamais entre la démonstration et la production. */
const EXCLUSIVE_KEYS = ["siteUrl", "convexUrl", "convexSiteUrl", "projectId"]

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"])
const LOCAL_SUFFIXES = [".localhost", ".test"]

function isHttpsOrigin(value) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.origin === value
  } catch {
    return false
  }
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

/** Même règle que la garde de construction (LX-01) : tout sauf un poste de développement est public. */
function isPublicHost(origin) {
  const hostname = new URL(origin).hostname.toLowerCase()
  return !LOCAL_HOSTNAMES.has(hostname) && !LOCAL_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
}

const isToken = (value) => /^[A-Za-z0-9_.-]+$/.test(value)

function variableName(target, key) {
  return key in SHARED_VARIABLE_NAMES ? SHARED_VARIABLE_NAMES[key] : targetVariableNames(target)[key]
}

/**
 * Lit l'environnement de la machine pour une cible. Rend les valeurs (pour
 * l'exécution, jamais pour l'affichage) et les défauts, qui ne nomment que des
 * variables.
 * @param {"demo" | "production"} target
 * @param {Record<string, string | undefined>} env
 * @param {readonly string[]} keys les clés exigées (RELEASE_KEYS, CHECK_KEYS, ROLLBACK_KEYS)
 */
export function readTargetEnv(target, env = process.env, keys = RELEASE_KEYS) {
  const values = {}
  const problems = []
  const read = (name) => env[name]?.trim() || undefined
  for (const key of keys) {
    const name = variableName(target, key)
    const value = read(name)
    if (!value) {
      problems.push(`${name} manque`)
      continue
    }
    if (ORIGIN_KEYS.has(key) && !isHttpsOrigin(value)) problems.push(`${name} doit être une origine https, sans chemin ni barre finale`)
    else if (key === "siteUrl" && !isPublicHost(value)) problems.push(`${name} doit désigner un domaine public : un poste de développement ne se publie pas`)
    else if (TOKEN_KEYS.has(key) && !isToken(value)) problems.push(`${name} n'a pas la forme d'un identifiant (lettres, chiffres, « _ », « - », « . »)`)
    values[key] = value
  }
  for (const key of OPTIONAL_URL_KEYS) {
    const name = variableName(target, key)
    const value = read(name)
    if (value === undefined) continue
    if (!isHttpsUrl(value)) problems.push(`${name} doit être une adresse https`)
    values[key] = value
  }
  const other = otherTarget(target)
  for (const key of EXCLUSIVE_KEYS) {
    if (!keys.includes(key) || values[key] === undefined) continue
    const otherName = variableName(other, key)
    if (read(otherName) === values[key]) {
      problems.push(`${variableName(target, key)} et ${otherName} désignent la même ressource : une cible ne se publie jamais sur l'autre`)
    }
  }
  return { values, problems }
}

/**
 * Les variables qu'une publication passe au site : la liste du catalogue de
 * publication du moteur (`build_args` et `runtime_env` de `diasporale_com`), rien
 * d'autre. Aucune n'est un secret ; un nom hors de cette liste fait échouer le plan.
 */
export const PUBLIC_RELEASE_VARIABLES = Object.freeze([
  "NEXT_PUBLIC_CONVEX_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_BUILD_SHA",
  "NEXT_PUBLIC_DIASPORALE_DATA_SOURCE",
  "NEXT_PUBLIC_IDN_PORTAL_URL",
  "NEXT_PUBLIC_CONSULATE_URL",
  "CONVEX_SITE_URL",
])

/** Refuse toute variable qui ne serait pas publique. */
export function assertPublicOnly(entries) {
  const rejected = entries.map(([name]) => name).filter((name) => !PUBLIC_RELEASE_VARIABLES.includes(name))
  if (rejected.length > 0) throw new Error(`Variable refusée, hors de la liste publique : ${rejected.join(", ")}`)
  return entries
}

const FULL_COMMIT = /^[0-9a-f]{40}$/
const VERSION_LABEL = /^diasporale-([0-9a-f]{12})-antsia-([0-9a-f]{12})-(demo|production)$/

/** L'étiquette de version, tirée des deux commits : celle que la sonde doit dire après publication. */
export function releaseVersion({ diasporaleCommit, antsiaCommit, target }) {
  if (!FULL_COMMIT.test(diasporaleCommit) || !FULL_COMMIT.test(antsiaCommit)) throw new Error("Commit complet attendu (40 caractères hexadécimaux)")
  if (parseTarget(target) === null) throw new Error("Cible inconnue")
  return `diasporale-${diasporaleCommit.slice(0, 12)}-antsia-${antsiaCommit.slice(0, 12)}-${target}`
}

/** Une étiquette de version lue (contrôle, retour arrière), ou `null` si elle n'a pas la forme attendue. */
export function parseVersionLabel(raw) {
  const match = VERSION_LABEL.exec(raw ?? "")
  return match ? { diasporale: match[1], antsia: match[2], target: match[3] } : null
}

/**
 * Les variables publiques d'une publication, dans un ordre fixe. Les valeurs tirées de
 * la machine restent des RÉFÉRENCES (`envRef`) jusqu'à l'exécution ; les liens vers IDN
 * et consulat.ga ne passent que s'ils sont posés (absents, ils ne s'affichent pas).
 */
export function releaseVariables(target, version, values) {
  const names = targetVariableNames(target)
  return assertPublicOnly([
    ["NEXT_PUBLIC_DIASPORALE_DATA_SOURCE", "engine"],
    ["NEXT_PUBLIC_SITE_URL", envRef(names.siteUrl)],
    ["NEXT_PUBLIC_CONVEX_URL", envRef(names.convexUrl)],
    ["CONVEX_SITE_URL", envRef(names.convexSiteUrl)],
    ["NEXT_PUBLIC_BUILD_SHA", version],
    ...(values.idnPortalUrl ? [["NEXT_PUBLIC_IDN_PORTAL_URL", envRef(names.idnPortalUrl)]] : []),
    ...(values.consulateUrl ? [["NEXT_PUBLIC_CONSULATE_URL", envRef(names.consulateUrl)]] : []),
  ])
}

// ═══════════════════════════════════════════════════════════════
// Commandes : références affichées par leur nom, résolues à l'exécution
// ═══════════════════════════════════════════════════════════════

/** Une valeur lue dans l'environnement de la machine : affichée `<NOM>`. */
export const envRef = (name) => Object.freeze({ env: name })
/** Une valeur connue seulement en cours d'exécution (adresse du déploiement…) : affichée `<libellé>`. */
export const runtimeRef = (key, label) => Object.freeze({ runtime: key, label })
/** Un dépôt du contexte : affiché par son nom, résolu en chemin. */
export const repoRef = (name) => Object.freeze({ repo: name })

function renderPart(part) {
  if (typeof part === "string") return part
  if ("env" in part) return `<${part.env}>`
  if ("runtime" in part) return `<${part.label}>`
  return part.repo
}

/** Un argument : une chaîne, une référence, ou une suite de morceaux (`NOM=<référence>`). */
export function renderArg(arg) {
  const text = Array.isArray(arg) ? arg.map(renderPart).join("") : renderPart(arg)
  return /^[\w@%+=:,./<>-]+$/.test(text) ? text : `'${text.replaceAll("'", "'\\''")}'`
}

/** La commande telle que le plan l'affiche : aucune valeur de la machine n'y paraît. */
export function renderCommand(argv) {
  return argv.map(renderArg).join(" ")
}

function resolvePart(part, context) {
  if (typeof part === "string") return part
  if ("env" in part) {
    const value = context.env[part.env]?.trim()
    if (!value) throw new Error(`${part.env} manque`)
    return value
  }
  if ("runtime" in part) {
    const value = context.runtime[part.runtime]
    if (!value) throw new Error(`Valeur d'exécution absente : ${part.label}`)
    return value
  }
  const path = context.repos[part.repo]
  if (!path) throw new Error(`Dépôt inconnu : ${part.repo}`)
  return path
}

/** La commande prête à lancer. */
export function resolveCommand(argv, context) {
  return argv.map((arg) => (Array.isArray(arg) ? arg.map((part) => resolvePart(part, context)).join("") : resolvePart(arg, context)))
}

/** Les variables d'environnement d'une étape (noms → références), résolues. */
export function resolveStepEnv(stepEnv, context) {
  return Object.fromEntries(Object.entries(stepEnv ?? {}).map(([name, ref]) => [name, resolvePart(ref, context)]))
}

/**
 * Lance une commande sans shell. La sortie standard est capturée (adresse du
 * déploiement, JSON) ; le journal d'erreur s'affiche en direct ; l'entrée est fermée,
 * aucun outil ne peut donc attendre une réponse cachée.
 */
export function runCommand(argv, { env, cwd } = {}) {
  const result = spawnSync(argv[0], argv.slice(1), {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  })
  return { status: result.status ?? 1, stdout: result.stdout ?? "" }
}

// ═══════════════════════════════════════════════════════════════
// Commits et contexte figé
// ═══════════════════════════════════════════════════════════════

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/

/**
 * Résout une référence en commit et en arbre, par le dépôt local seulement (aucun
 * réseau). Refuse une référence qui pourrait passer pour une option.
 */
export function resolveCommit(repoPath, ref, run = runCommand) {
  if (typeof ref !== "string" || !SAFE_REF.test(ref)) throw new Error("Référence de commit illisible")
  const commit = run(["git", "-C", repoPath, "rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).stdout.trim()
  if (!FULL_COMMIT.test(commit)) throw new Error(`Commit introuvable : ${ref}`)
  const tree = run(["git", "-C", repoPath, "rev-parse", "--verify", "--quiet", `${commit}^{tree}`]).stdout.trim()
  if (!FULL_COMMIT.test(tree)) throw new Error(`Arbre introuvable pour ${ref}`)
  return { commit, tree }
}

/** Le commit est-il sur `origin/main` (relevé du dépôt local) ? */
export function isPublishedCommit(repoPath, commit, run = runCommand) {
  return run(["git", "-C", repoPath, "merge-base", "--is-ancestor", commit, "origin/main"]).status === 0
}

/** Ce qui ne part jamais dans le contexte figé (même liste que la méthode du 22/10). */
export const CONTEXT_EXCLUDED_DIRECTORIES = Object.freeze(["node_modules", ".next", ".git", "docs", "coverage", ".convex", ".turbo", ".vercel"])
const CONTEXT_EXCLUDED_FILES = new Set(["CLAUDE.md", "AGENTS.md"])

/** Le `.vercelignore` posé à la racine du contexte : la même liste, pour l'hébergeur. */
export const VERCELIGNORE = [
  ...CONTEXT_EXCLUDED_DIRECTORIES.map((directory) => `**/${directory}/**`),
  "**/.env*",
  "**/CLAUDE.md",
  "**/AGENTS.md",
  "**/*.tsbuildinfo",
].join("\n") + "\n"

/** Un chemin relatif du contexte est-il exclu de l'empreinte et de l'envoi ? */
export function isExcludedFromContext(relativePath) {
  const parts = relativePath.split("/")
  const name = parts.at(-1) ?? ""
  return (
    parts.some((part) => CONTEXT_EXCLUDED_DIRECTORIES.includes(part)) ||
    name.startsWith(".env") ||
    CONTEXT_EXCLUDED_FILES.has(name) ||
    name.endsWith(".tsbuildinfo")
  )
}

/**
 * L'empreinte des sources d'un contexte : SHA-256 de chaque fichier retenu, puis
 * SHA-256 de la liste triée « chemin NUL empreinte ». Un lien symbolique compte par sa cible.
 */
export function contextFingerprint(contextDir) {
  const files = {}
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name)
      const path = relative(contextDir, absolute).split("\\").join("/")
      if (isExcludedFromContext(path)) continue
      if (entry.isDirectory()) walk(absolute)
      else if (entry.isSymbolicLink()) files[path] = createHash("sha256").update(`lien:${readlinkSync(absolute)}`).digest("hex")
      else if (entry.isFile()) files[path] = createHash("sha256").update(readFileSync(absolute)).digest("hex")
    }
  }
  walk(contextDir)
  const lines = Object.keys(files)
    .sort()
    .map((path) => `${path}\0${files[path]}\n`)
    .join("")
  return { fingerprint: createHash("sha256").update(lines).digest("hex"), files: Object.keys(files).length }
}

/** `child` est-il `parent` ou sous lui ? */
export function isInside(child, parent) {
  const path = relative(parent, child)
  return path === "" || (!path.startsWith("..") && !isAbsolute(path))
}

/**
 * Crée un dossier de travail VIDE, hors des dépôts : sous `DIASPORALE_RELEASE_WORKDIR`
 * s'il est posé, sinon sous le dossier temporaire du système. Rien n'est effacé.
 */
export function createWorkdir(env = process.env, base = tmpdir()) {
  const parent = resolve(env[SHARED_VARIABLE_NAMES.workdir]?.trim() || base)
  if (isInside(parent, ECOSYSTEMS_ROOT)) throw new Error(`${SHARED_VARIABLE_NAMES.workdir} doit être hors des dépôts`)
  mkdirSync(parent, { recursive: true })
  return mkdtempSync(join(parent, "diasporale-publication-"))
}

/** Les commandes qui figent un dépôt : `git archive` du commit, puis extraction. */
export function freezeCommands(name, commit) {
  return [
    ["git", "-C", repoRef(name), "archive", "--format=tar", "-o", [runtimeRef("workdir", "dossier de travail"), `/${name}.tar`], commit],
    ["tar", "-xf", [runtimeRef("workdir", "dossier de travail"), `/${name}.tar`], "-C", [runtimeRef("context", "contexte figé"), `/${name}`]],
  ]
}

/**
 * Fige le contexte de publication dans `workdir/ECOSYSTEMES` : les fichiers SUIVIS des
 * deux commits (aucun `.env.local`, aucun fichier de travail), le `.vercelignore`, puis
 * l'empreinte des sources.
 */
export function freezeContext({ workdir, commits, repos = RELEASE_REPOSITORIES, run = runCommand }) {
  const context = join(workdir, "ECOSYSTEMES")
  const runtime = { workdir, context }
  for (const [name, commit] of Object.entries(commits)) {
    mkdirSync(join(context, name), { recursive: true })
    for (const argv of freezeCommands(name, commit)) {
      if (run(resolveCommand(argv, { env: {}, runtime, repos })).status !== 0) throw new Error(`Contexte figé impossible : ${renderCommand(argv)}`)
    }
  }
  writeFileSync(join(context, ".vercelignore"), VERCELIGNORE)
  return { context, ...contextFingerprint(context) }
}

/** Écrit le relevé d'une publication dans le dossier de travail (hors des dépôts : il contient des identifiants). */
export function writeRecord(workdir, record) {
  writeFileSync(join(workdir, "release.json"), `${JSON.stringify(record, null, 2)}\n`)
}

// ═══════════════════════════════════════════════════════════════
// Hébergeur : lecture de ses réponses
// ═══════════════════════════════════════════════════════════════

/** Un JSON lu, ou `null`. */
export function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** La réponse de `vercel inspect --format=json`, réduite à ce qui sert ; `null` si illisible. */
export function parseInspect(text) {
  const value = parseJson(text)
  if (!value || typeof value !== "object" || typeof value.id !== "string") return null
  const url = typeof value.url === "string" && value.url ? (value.url.startsWith("https://") ? value.url : `https://${value.url}`) : null
  return {
    id: value.id,
    url,
    readyState: typeof value.readyState === "string" ? value.readyState : null,
    target: typeof value.target === "string" ? value.target : null,
    projectId: typeof value.projectId === "string" ? value.projectId : null,
  }
}

/** L'adresse du déploiement : la dernière ligne de la sortie standard de `vercel deploy`. */
export function deploymentUrlFrom(stdout) {
  const line = stdout.trim().split("\n").at(-1)?.trim() ?? ""
  return isHttpsOrigin(line) ? line : null
}

// ═══════════════════════════════════════════════════════════════
// La porte : accord écrit du propriétaire, puis confirmation tapée
// ═══════════════════════════════════════════════════════════════

/** La phrase exacte à taper pour franchir une porte. */
export function confirmationPhrase(action, target, version) {
  return `${action} ${target} ${version}`
}

/**
 * Le rappel de la porte, affiché avant chaque confirmation. Aucune option ne la
 * contourne : sans accord écrit et détaillé du propriétaire, l'opérateur répond autre
 * chose et rien ne part.
 */
export function agreementNotice(points) {
  return [
    "",
    "PORTE — accord écrit et détaillé du propriétaire, avant toute commande vers l'hébergeur :",
    ...points.map((point) => `  • ${point}`),
    "Sans cet accord, tapez autre chose que la phrase demandée : rien ne partira.",
  ].join("\n")
}

/**
 * Demande la phrase exacte dans un TERMINAL. Toute autre réponse, une entrée qui n'est
 * pas un terminal (tube, script, agent) ou une fin de flux refusent.
 */
export async function confirmPhrase(phrase, { input = process.stdin, output = process.stdout } = {}) {
  if (!input.isTTY) {
    output.write("Confirmation refusée : elle se tape dans un terminal, par une personne.\n")
    return false
  }
  const reader = createInterface({ input, output, terminal: false })
  try {
    const answer = await new Promise((resolveAnswer) => {
      reader.once("close", () => resolveAnswer(null))
      reader.question(`\nPour confirmer, tapez exactement :\n  ${phrase}\n> `).then(resolveAnswer, () => resolveAnswer(null))
    })
    return typeof answer === "string" && answer.trim() === phrase
  } finally {
    reader.close()
  }
}

/** Lit `--nom valeur` et les drapeaux d'une ligne de commande ; tout le reste est un défaut. */
export function parseOptions(argv, { values: valueNames, flags: flagNames }) {
  const options = {}
  const problems = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const name = arg.startsWith("--") ? arg.slice(2) : null
    if (name !== null && flagNames.includes(name)) options[name] = true
    else if (name !== null && valueNames.includes(name)) {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith("--")) problems.push(`--${name} attend une valeur`)
      else {
        options[name] = value
        index += 1
      }
    } else problems.push(`argument inconnu : ${arg}`)
  }
  return { options, problems }
}
