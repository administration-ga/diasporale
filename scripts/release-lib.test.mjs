import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PassThrough } from "node:stream"

import {
  agreementNotice,
  ANTSIA_ROOT,
  assertPublicOnly,
  CHECK_KEYS,
  confirmationPhrase,
  confirmPhrase,
  contextFingerprint,
  createWorkdir,
  deploymentUrlFrom,
  DIASPORALE_ROOT,
  ECOSYSTEMS_ROOT,
  envRef,
  freezeCommands,
  freezeContext,
  isExcludedFromContext,
  isInside,
  isPublishedCommit,
  otherTarget,
  parseInspect,
  parseOptions,
  parseTarget,
  parseVersionLabel,
  PUBLIC_RELEASE_VARIABLES,
  readTargetEnv,
  releaseVariables,
  releaseVersion,
  renderArg,
  renderCommand,
  repoRef,
  resolveCommand,
  resolveCommit,
  resolveStepEnv,
  runCommand,
  runtimeRef,
  targetVariableNames,
  VERCELIGNORE,
  writeRecord,
} from "./release-lib.mjs"

/** Valeurs FICTIVES (domaines réservés à la documentation, RFC 2606) : aucune ressource réelle. */
const DEMO_ENV = Object.freeze({
  DIASPORALE_DEMO_SITE_URL: "https://site-demo.example.org",
  DIASPORALE_DEMO_CONVEX_URL: "https://moteur-demo.example.net",
  DIASPORALE_DEMO_CONVEX_SITE_URL: "https://actions-demo.example.net",
  DIASPORALE_DEMO_VERCEL_PROJECT_ID: "projet_fictif_demo",
  DIASPORALE_VERCEL_ORG_ID: "equipe_fictive",
  DIASPORALE_VERCEL_SCOPE: "portee-fictive",
})

const ANTSIA_COMMIT = "a".repeat(40)
const DIASPORALE_COMMIT = "d".repeat(40)

describe("cibles et variables de la machine", () => {
  test("deux cibles seulement, chacune avec ses propres noms de variables", () => {
    expect(parseTarget("demo")).toBe("demo")
    expect(parseTarget("production")).toBe("production")
    expect(parseTarget("preview")).toBeNull()
    expect(parseTarget(undefined)).toBeNull()
    expect(otherTarget("demo")).toBe("production")
    expect(otherTarget("production")).toBe("demo")
    expect(targetVariableNames("demo")).toEqual({
      siteUrl: "DIASPORALE_DEMO_SITE_URL",
      convexUrl: "DIASPORALE_DEMO_CONVEX_URL",
      convexSiteUrl: "DIASPORALE_DEMO_CONVEX_SITE_URL",
      projectId: "DIASPORALE_DEMO_VERCEL_PROJECT_ID",
      idnPortalUrl: "DIASPORALE_DEMO_IDN_PORTAL_URL",
      consulateUrl: "DIASPORALE_DEMO_CONSULATE_URL",
    })
    expect(Object.values(targetVariableNames("production")).every((name) => name.startsWith("DIASPORALE_PRODUCTION_"))).toBe(true)
  })

  test("un environnement complet se lit sans défaut", () => {
    const { values, problems } = readTargetEnv("demo", { ...DEMO_ENV, DIASPORALE_DEMO_SITE_URL: "  https://site-demo.example.org  " })
    expect(problems).toEqual([])
    expect(values).toEqual({
      siteUrl: "https://site-demo.example.org",
      convexUrl: DEMO_ENV.DIASPORALE_DEMO_CONVEX_URL,
      convexSiteUrl: DEMO_ENV.DIASPORALE_DEMO_CONVEX_SITE_URL,
      projectId: DEMO_ENV.DIASPORALE_DEMO_VERCEL_PROJECT_ID,
      orgId: DEMO_ENV.DIASPORALE_VERCEL_ORG_ID,
      scope: DEMO_ENV.DIASPORALE_VERCEL_SCOPE,
    })
  })

  test("les défauts nomment les variables, jamais leur valeur", () => {
    const { problems } = readTargetEnv("demo", {
      ...DEMO_ENV,
      DIASPORALE_DEMO_SITE_URL: "http://site-demo.example.org",
      DIASPORALE_DEMO_CONVEX_URL: "https://moteur-demo.example.net/chemin",
      DIASPORALE_DEMO_VERCEL_PROJECT_ID: "projet fictif",
      DIASPORALE_VERCEL_SCOPE: undefined,
    })
    expect(problems).toEqual([
      "DIASPORALE_DEMO_SITE_URL doit être une origine https, sans chemin ni barre finale",
      "DIASPORALE_DEMO_CONVEX_URL doit être une origine https, sans chemin ni barre finale",
      "DIASPORALE_DEMO_VERCEL_PROJECT_ID n'a pas la forme d'un identifiant (lettres, chiffres, « _ », « - », « . »)",
      "DIASPORALE_VERCEL_SCOPE manque",
    ])
    expect(problems.join(" ")).not.toContain("example")
  })

  test("un poste de développement ne se publie pas", () => {
    for (const site of ["https://localhost:3031", "https://diasporale.localhost", "https://essai.test", "https://127.0.0.1"]) {
      expect(readTargetEnv("demo", { ...DEMO_ENV, DIASPORALE_DEMO_SITE_URL: site }).problems).toEqual([
        "DIASPORALE_DEMO_SITE_URL doit désigner un domaine public : un poste de développement ne se publie pas",
      ])
    }
  })

  test("une cible ne se publie jamais sur la ressource de l'autre", () => {
    const { problems } = readTargetEnv("demo", {
      ...DEMO_ENV,
      DIASPORALE_PRODUCTION_CONVEX_URL: DEMO_ENV.DIASPORALE_DEMO_CONVEX_URL,
      DIASPORALE_PRODUCTION_VERCEL_PROJECT_ID: DEMO_ENV.DIASPORALE_DEMO_VERCEL_PROJECT_ID,
      DIASPORALE_PRODUCTION_SITE_URL: "https://autre-site.example.org",
    })
    expect(problems).toEqual([
      "DIASPORALE_DEMO_CONVEX_URL et DIASPORALE_PRODUCTION_CONVEX_URL désignent la même ressource : une cible ne se publie jamais sur l'autre",
      "DIASPORALE_DEMO_VERCEL_PROJECT_ID et DIASPORALE_PRODUCTION_VERCEL_PROJECT_ID désignent la même ressource : une cible ne se publie jamais sur l'autre",
    ])
  })

  test("les liens d'élévation sont facultatifs, en https quand ils sont posés", () => {
    expect(readTargetEnv("demo", { ...DEMO_ENV, DIASPORALE_DEMO_IDN_PORTAL_URL: "https://idn.example.org/entrer" }).values.idnPortalUrl).toBe("https://idn.example.org/entrer")
    expect(readTargetEnv("demo", { ...DEMO_ENV, DIASPORALE_DEMO_CONSULATE_URL: "ftp://consulat.example.org" }).problems).toEqual(["DIASPORALE_DEMO_CONSULATE_URL doit être une adresse https"])
  })

  test("le contrôle n'exige que le site et le moteur", () => {
    expect(readTargetEnv("production", {}, CHECK_KEYS).problems).toEqual(["DIASPORALE_PRODUCTION_SITE_URL manque", "DIASPORALE_PRODUCTION_CONVEX_URL manque"])
  })
})

describe("variables publiques seulement", () => {
  test("la liste est celle du catalogue de publication du moteur pour diasporale_com", () => {
    const catalog = JSON.parse(readFileSync(join(ANTSIA_ROOT, "deploy", "catalog.json"), "utf8"))
    const app = catalog.applications.diasporale_com
    expect([...PUBLIC_RELEASE_VARIABLES].sort()).toEqual([...app.build_args, ...app.runtime_env].sort())
  })

  test("un secret, ou toute variable hors liste, fait échouer le plan", () => {
    expect(() => assertPublicOnly([["BETTER_AUTH_SECRET", "x"]])).toThrow("BETTER_AUTH_SECRET")
    expect(() => assertPublicOnly([["NEXT_PUBLIC_SITE_URL", "x"], ["CONVEX_DEPLOY_KEY", "y"]])).toThrow("CONVEX_DEPLOY_KEY")
    expect(assertPublicOnly([["CONVEX_SITE_URL", "x"]])).toEqual([["CONVEX_SITE_URL", "x"]])
  })

  test("la source est toujours le moteur, la version tirée des commits, les adresses des références", () => {
    const version = releaseVersion({ diasporaleCommit: DIASPORALE_COMMIT, antsiaCommit: ANTSIA_COMMIT, target: "demo" })
    expect(releaseVariables("demo", version, {})).toEqual([
      ["NEXT_PUBLIC_DIASPORALE_DATA_SOURCE", "engine"],
      ["NEXT_PUBLIC_SITE_URL", envRef("DIASPORALE_DEMO_SITE_URL")],
      ["NEXT_PUBLIC_CONVEX_URL", envRef("DIASPORALE_DEMO_CONVEX_URL")],
      ["CONVEX_SITE_URL", envRef("DIASPORALE_DEMO_CONVEX_SITE_URL")],
      ["NEXT_PUBLIC_BUILD_SHA", version],
    ])
    const withLinks = releaseVariables("demo", version, { idnPortalUrl: "x", consulateUrl: "y" }).map(([name]) => name)
    expect(withLinks.slice(-2)).toEqual(["NEXT_PUBLIC_IDN_PORTAL_URL", "NEXT_PUBLIC_CONSULATE_URL"])
  })
})

describe("étiquette de version", () => {
  test("tirée des deux commits et de la cible, comme la méthode du 22/10", () => {
    expect(releaseVersion({ diasporaleCommit: DIASPORALE_COMMIT, antsiaCommit: ANTSIA_COMMIT, target: "production" })).toBe(
      "diasporale-dddddddddddd-antsia-aaaaaaaaaaaa-production",
    )
    expect(() => releaseVersion({ diasporaleCommit: "abc123", antsiaCommit: ANTSIA_COMMIT, target: "demo" })).toThrow("Commit complet")
    expect(() => releaseVersion({ diasporaleCommit: DIASPORALE_COMMIT, antsiaCommit: ANTSIA_COMMIT, target: "preview" })).toThrow("Cible inconnue")
  })

  test("se relit, ou rien", () => {
    expect(parseVersionLabel("diasporale-0123456789ab-antsia-ba9876543210-demo")).toEqual({ diasporale: "0123456789ab", antsia: "ba9876543210", target: "demo" })
    expect(parseVersionLabel("main-0123456789ab-demo")).toBeNull()
    expect(parseVersionLabel(undefined)).toBeNull()
  })
})

describe("commandes affichées et résolues", () => {
  const argv = ["vercel", "deploy", runtimeRef("context", "contexte figé"), "--scope", envRef("DIASPORALE_VERCEL_SCOPE"), "--build-env", ["NEXT_PUBLIC_SITE_URL=", envRef("DIASPORALE_DEMO_SITE_URL")]]

  test("le plan nomme les variables et ne recopie aucune valeur", () => {
    expect(renderCommand(argv)).toBe("vercel deploy '<contexte figé>' --scope <DIASPORALE_VERCEL_SCOPE> --build-env NEXT_PUBLIC_SITE_URL=<DIASPORALE_DEMO_SITE_URL>")
    expect(renderArg(repoRef("ANTSIA"))).toBe("ANTSIA")
    expect(renderArg("l'arbre")).toBe("'l'\\''arbre'")
  })

  test("l'exécution résout chaque référence, et refuse une valeur absente en la nommant", () => {
    const context = { env: DEMO_ENV, runtime: { context: "/tmp/contexte" }, repos: { ANTSIA: "/depots/ANTSIA" } }
    expect(resolveCommand(argv, context)).toEqual([
      "vercel",
      "deploy",
      "/tmp/contexte",
      "--scope",
      "portee-fictive",
      "--build-env",
      "NEXT_PUBLIC_SITE_URL=https://site-demo.example.org",
    ])
    expect(resolveCommand(["git", "-C", repoRef("ANTSIA")], context)).toEqual(["git", "-C", "/depots/ANTSIA"])
    expect(() => resolveCommand(argv, { ...context, env: {} })).toThrow("DIASPORALE_VERCEL_SCOPE manque")
    expect(() => resolveCommand(argv, { ...context, runtime: {} })).toThrow("Valeur d'exécution absente : contexte figé")
    expect(() => resolveCommand([repoRef("AUTRE")], context)).toThrow("Dépôt inconnu : AUTRE")
    expect(resolveStepEnv({ VERCEL_ORG_ID: envRef("DIASPORALE_VERCEL_ORG_ID") }, context)).toEqual({ VERCEL_ORG_ID: "equipe_fictive" })
    expect(resolveStepEnv(undefined, context)).toEqual({})
  })

  test("une commande se lance sans shell, sortie capturée", () => {
    expect(runCommand(["git", "--version"])).toMatchObject({ status: 0 })
    expect(runCommand(["git", "--version"]).stdout).toStartWith("git version")
    expect(runCommand(["commande-inexistante-diasporale"]).status).toBe(1)
  })
})

describe("commits", () => {
  const fakeRun = (answers) => (argv) => ({ status: 0, stdout: answers[argv.at(-1)] ?? "" })

  test("une référence se résout en commit et arbre complets", () => {
    const run = fakeRun({ "origin/main^{commit}": `${DIASPORALE_COMMIT}\n`, [`${DIASPORALE_COMMIT}^{tree}`]: `${"e".repeat(40)}\n` })
    expect(resolveCommit("/depot", "origin/main", run)).toEqual({ commit: DIASPORALE_COMMIT, tree: "e".repeat(40) })
  })

  test("une référence illisible, introuvable ou qui passerait pour une option est refusée", () => {
    expect(() => resolveCommit("/depot", "--upload-pack=x", fakeRun({}))).toThrow("illisible")
    expect(() => resolveCommit("/depot", "main;rm", fakeRun({}))).toThrow("illisible")
    expect(() => resolveCommit("/depot", "inconnu", fakeRun({}))).toThrow("Commit introuvable")
    expect(() => resolveCommit("/depot", "main", fakeRun({ "main^{commit}": DIASPORALE_COMMIT }))).toThrow("Arbre introuvable")
  })

  test("« publié » veut dire ancêtre d'origin/main", () => {
    const calls = []
    const run = (argv) => {
      calls.push(argv)
      return { status: argv.includes(ANTSIA_COMMIT) ? 0 : 1, stdout: "" }
    }
    expect(isPublishedCommit("/depot", ANTSIA_COMMIT, run)).toBe(true)
    expect(isPublishedCommit("/depot", DIASPORALE_COMMIT, run)).toBe(false)
    expect(calls[0]).toEqual(["git", "-C", "/depot", "merge-base", "--is-ancestor", ANTSIA_COMMIT, "origin/main"])
  })
})

describe("contexte figé", () => {
  test("exclut ce que la méthode du 22/10 excluait", () => {
    for (const path of ["ANTSIA/node_modules/x.js", "DIASPORALE/docs/a.md", "ANTSIA/.env.local", "DIASPORALE/CLAUDE.md", "x/tsconfig.tsbuildinfo", "ANTSIA/.convex/y", "a/.vercel/project.json"]) {
      expect(isExcludedFromContext(path)).toBe(true)
    }
    for (const path of ["ANTSIA/package.json", "DIASPORALE/apps/diasporale_com/Dockerfile", ".vercelignore"]) {
      expect(isExcludedFromContext(path)).toBe(false)
    }
    expect(VERCELIGNORE.split("\n")).toContain("**/.env*")
    expect(VERCELIGNORE.split("\n")).toContain("**/docs/**")
  })

  test("l'empreinte ne dépend que des fichiers retenus, et change avec eux", () => {
    const dir = mkdtempSync(join(tmpdir(), "diasporale-empreinte-"))
    mkdirSync(join(dir, "ANTSIA", "node_modules"), { recursive: true })
    writeFileSync(join(dir, "ANTSIA", "a.ts"), "export const a = 1\n")
    writeFileSync(join(dir, "ANTSIA", ".env.local"), "SECRET=fictif\n")
    writeFileSync(join(dir, "ANTSIA", "node_modules", "b.js"), "x")
    symlinkSync("a.ts", join(dir, "ANTSIA", "lien.ts"))
    const first = contextFingerprint(dir)
    expect(first.files).toBe(2)
    writeFileSync(join(dir, "ANTSIA", ".env.local"), "SECRET=autre\n")
    expect(contextFingerprint(dir)).toEqual(first)
    writeFileSync(join(dir, "ANTSIA", "a.ts"), "export const a = 2\n")
    expect(contextFingerprint(dir).fingerprint).not.toBe(first.fingerprint)
  })

  test("les commandes de gel : git archive du commit, puis extraction dans le contexte", () => {
    expect(freezeCommands("ANTSIA", ANTSIA_COMMIT).map(renderCommand)).toEqual([
      `git -C ANTSIA archive --format=tar -o '<dossier de travail>/ANTSIA.tar' ${ANTSIA_COMMIT}`,
      "tar -xf '<dossier de travail>/ANTSIA.tar' -C '<contexte figé>/ANTSIA'",
    ])
  })

  test("de vrais dépôts : seuls les fichiers SUIVIS du commit partent, jamais un .env.local", () => {
    const root = mkdtempSync(join(tmpdir(), "diasporale-depots-"))
    const git = (cwd, ...args) => {
      const result = spawnSync("git", ["-c", "user.name=Essai", "-c", "user.email=essai@exemple.test", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], { cwd, encoding: "utf8" })
      expect(result.status).toBe(0)
      return result.stdout.trim()
    }
    const commits = {}
    for (const name of ["ANTSIA", "DIASPORALE"]) {
      const repo = join(root, name)
      mkdirSync(join(repo, "docs"), { recursive: true })
      git(repo, "init", "-q")
      writeFileSync(join(repo, "package.json"), `{"name":"${name.toLowerCase()}"}\n`)
      writeFileSync(join(repo, "docs", "note.md"), "document de travail\n")
      git(repo, "add", "package.json", "docs/note.md")
      git(repo, "commit", "-q", "-m", "essai")
      commits[name] = git(repo, "rev-parse", "HEAD")
      writeFileSync(join(repo, ".env.local"), "SECRET=fictif\n")
      writeFileSync(join(repo, "brouillon.ts"), "non suivi\n")
    }
    const workdir = mkdtempSync(join(tmpdir(), "diasporale-travail-"))
    const frozen = freezeContext({ workdir, commits, repos: { ANTSIA: join(root, "ANTSIA"), DIASPORALE: join(root, "DIASPORALE") } })
    expect(frozen.context).toBe(join(workdir, "ECOSYSTEMES"))
    expect(readdirSync(join(frozen.context, "ANTSIA")).sort()).toEqual(["docs", "package.json"])
    expect(existsSync(join(frozen.context, "DIASPORALE", ".env.local"))).toBe(false)
    expect(existsSync(join(frozen.context, "DIASPORALE", "brouillon.ts"))).toBe(false)
    expect(readFileSync(join(frozen.context, ".vercelignore"), "utf8")).toBe(VERCELIGNORE)
    expect(frozen.files).toBe(3)
    expect(frozen.fingerprint).toMatch(/^[0-9a-f]{64}$/)
  })

  test("un gel qui échoue s'arrête en nommant la commande", () => {
    const workdir = mkdtempSync(join(tmpdir(), "diasporale-travail-"))
    expect(() => freezeContext({ workdir, commits: { ANTSIA: ANTSIA_COMMIT }, run: () => ({ status: 128, stdout: "" }) })).toThrow("git -C ANTSIA archive")
  })

  test("le dossier de travail est neuf, vide, hors des dépôts", () => {
    const base = mkdtempSync(join(tmpdir(), "diasporale-base-"))
    const workdir = createWorkdir({}, base)
    expect(isInside(workdir, base)).toBe(true)
    expect(readdirSync(workdir)).toEqual([])
    expect(createWorkdir({}, base)).not.toBe(workdir)
    expect(isInside(createWorkdir({ DIASPORALE_RELEASE_WORKDIR: base }), base)).toBe(true)
    expect(() => createWorkdir({ DIASPORALE_RELEASE_WORKDIR: join(DIASPORALE_ROOT, "tmp") })).toThrow("hors des dépôts")
    expect(isInside(DIASPORALE_ROOT, ECOSYSTEMS_ROOT)).toBe(true)
    expect(isInside(ECOSYSTEMS_ROOT, DIASPORALE_ROOT)).toBe(false)
  })

  test("le relevé s'écrit dans le dossier de travail", () => {
    const workdir = mkdtempSync(join(tmpdir(), "diasporale-travail-"))
    writeRecord(workdir, { version: "v" })
    expect(JSON.parse(readFileSync(join(workdir, "release.json"), "utf8"))).toEqual({ version: "v" })
  })
})

describe("réponses de l'hébergeur", () => {
  test("inspect : ce qui sert, adresse en https", () => {
    expect(parseInspect(JSON.stringify({ id: "d1", url: "deploiement.example.org", readyState: "READY", target: "production", projectId: "p1" }))).toEqual({
      id: "d1",
      url: "https://deploiement.example.org",
      readyState: "READY",
      target: "production",
      projectId: "p1",
    })
    expect(parseInspect(JSON.stringify({ id: "d2", url: "https://deploiement.example.org" }))).toEqual({
      id: "d2",
      url: "https://deploiement.example.org",
      readyState: null,
      target: null,
      projectId: null,
    })
    expect(parseInspect(JSON.stringify({ id: "d3" }))?.url).toBeNull()
    expect(parseInspect("pas du JSON")).toBeNull()
    expect(parseInspect(JSON.stringify({ url: "x" }))).toBeNull()
  })

  test("deploy : l'adresse est la dernière ligne de la sortie standard", () => {
    expect(deploymentUrlFrom("journal\nhttps://deploiement.example.org\n")).toBe("https://deploiement.example.org")
    expect(deploymentUrlFrom("Error: quota\n")).toBeNull()
    expect(deploymentUrlFrom("")).toBeNull()
  })
})

describe("la porte", () => {
  test("la phrase nomme l'action, la cible et la version", () => {
    expect(confirmationPhrase("PUBLIER", "demo", "v1")).toBe("PUBLIER demo v1")
    const notice = agreementNotice(["commits : …", "cible : demo"])
    expect(notice).toContain("accord écrit et détaillé du propriétaire")
    expect(notice).toContain("  • cible : demo")
    expect(notice).toContain("rien ne partira")
  })

  test("hors d'un terminal, la confirmation est refusée sans rien lire", async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    input.write("PUBLIER demo v1\n")
    expect(await confirmPhrase("PUBLIER demo v1", { input, output })).toBe(false)
    expect(output.read().toString()).toContain("se tape dans un terminal")
  })

  test("dans un terminal, seule la phrase exacte confirme", async () => {
    const ask = async (answer) => {
      const input = Object.assign(new PassThrough(), { isTTY: true })
      const pending = confirmPhrase("PUBLIER demo v1", { input, output: new PassThrough() })
      if (answer === null) input.end()
      else input.write(`${answer}\n`)
      return pending
    }
    expect(await ask("PUBLIER demo v1")).toBe(true)
    expect(await ask("  PUBLIER demo v1  ")).toBe(true)
    expect(await ask("oui")).toBe(false)
    expect(await ask("PUBLIER production v1")).toBe(false)
    expect(await ask(null)).toBe(false)
  })
})

describe("ligne de commande", () => {
  test("valeurs, drapeaux, et tout le reste en défaut", () => {
    expect(parseOptions(["--target", "demo", "--execute"], { values: ["target"], flags: ["execute"] })).toEqual({ options: { target: "demo", execute: true }, problems: [] })
    expect(parseOptions(["--target", "--execute", "--yes", "seul"], { values: ["target"], flags: ["execute"] })).toEqual({
      options: { execute: true },
      problems: [
        "--target attend une valeur",
        "argument inconnu : --yes",
        "argument inconnu : seul",
      ],
    })
    expect(parseOptions(["--target"], { values: ["target"], flags: [] }).problems).toEqual(["--target attend une valeur"])
  })
})
