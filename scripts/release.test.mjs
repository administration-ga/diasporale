import { describe, expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { buildReleasePlan, executeRelease, parseReleaseArgs, releaseAgreementPoints, renderReleasePlan } from "./release.mjs"
import { PUBLIC_RELEASE_VARIABLES, renderCommand } from "./release-lib.mjs"

/** Valeurs FICTIVES (domaines réservés à la documentation, RFC 2606) : aucune ressource réelle. */
const DEMO_ENV = Object.freeze({
  DIASPORALE_DEMO_SITE_URL: "https://site-demo.example.org",
  DIASPORALE_DEMO_CONVEX_URL: "https://moteur-demo.example.net",
  DIASPORALE_DEMO_CONVEX_SITE_URL: "https://actions-demo.example.net",
  DIASPORALE_DEMO_VERCEL_PROJECT_ID: "projet_fictif_demo",
  DIASPORALE_VERCEL_ORG_ID: "equipe_fictive",
  DIASPORALE_VERCEL_SCOPE: "portee-fictive",
})
const ANTSIA = Object.freeze({ commit: "a".repeat(40), tree: "b".repeat(40) })
const DIASPORALE = Object.freeze({ commit: "d".repeat(40), tree: "e".repeat(40) })
const VERSION = "diasporale-dddddddddddd-antsia-aaaaaaaaaaaa-demo"
const OLD_VERSION = "diasporale-111111111111-antsia-222222222222-demo"
const NEW_DEPLOYMENT = "https://nouveau-deploiement.example.org"
const OLD_DEPLOYMENT = "https://ancien-deploiement.example.org"
const CSP = "default-src 'self'; connect-src 'self' https://moteur-demo.example.net wss://moteur-demo.example.net https://moteur-demo.example.site; object-src 'none'"

const plan = () => buildReleasePlan({ target: "demo", antsia: ANTSIA, diasporale: DIASPORALE })
const report = (version) => ({ status: "ok", application: "diasporale-com", version, backend: "configured", dataSource: "engine", engine: "reachable" })

describe("ligne de commande", () => {
  test("cible, deux commits, et --execute seulement en drapeau", () => {
    expect(parseReleaseArgs(["--target", "demo", "--antsia", "origin/main", "--diasporale", "abc1234"])).toEqual({
      target: "demo",
      antsia: "origin/main",
      diasporale: "abc1234",
      execute: false,
      problems: [],
    })
    expect(parseReleaseArgs(["--target", "production", "--antsia", "x", "--diasporale", "y", "--execute"]).execute).toBe(true)
  })

  test("aucune option ne saute la confirmation : --yes ou --force sont des arguments inconnus", () => {
    const { problems } = parseReleaseArgs(["--target", "staging", "--yes", "--force"])
    expect(problems).toEqual([
      "argument inconnu : --yes",
      "argument inconnu : --force",
      "--target doit valoir demo ou production",
      "--antsia <commit> manque",
      "--diasporale <commit> manque",
    ])
  })
})

describe("plan de publication", () => {
  test("suit la méthode du 22/10 au 3/11 : figer, publier sans bascule, contrôler, basculer, contrôler", () => {
    expect(plan().steps.map((step) => step.id)).toEqual([
      "agreement",
      "fetch",
      "published",
      "freeze",
      "served",
      "deploy",
      "ready",
      "private-check",
      "confirm-promote",
      "promote",
      "public-check",
    ])
    expect(plan().version).toBe(VERSION)
  })

  test("deux portes tapées : avant toute commande, puis avant la bascule", () => {
    const steps = plan().steps
    expect(steps[0].gate).toBe(`PUBLIER demo ${VERSION}`)
    expect(steps.findIndex((step) => step.gate === `BASCULER demo ${VERSION}`)).toBe(steps.findIndex((step) => step.id === "promote") - 1)
    expect(steps.filter((step) => step.gate).length).toBe(2)
  })

  test("la publication part sans bascule, avec les seules variables publiques et les deux commits en métadonnées", () => {
    const [deploy] = plan().steps.find((step) => step.id === "deploy").commands
    const text = renderCommand(deploy)
    for (const flag of ["--prod", "--skip-domain", "--archive=tgz", "--yes"]) expect(deploy).toContain(flag)
    expect(text).toContain(`--meta diasporaleReleaseCommit=${DIASPORALE.commit}`)
    expect(text).toContain(`--meta antsiaReleaseCommit=${ANTSIA.commit}`)
    expect(text).toContain("--build-env NEXT_PUBLIC_DIASPORALE_DATA_SOURCE=engine --env NEXT_PUBLIC_DIASPORALE_DATA_SOURCE=engine")
    expect(text).toContain(`--build-env NEXT_PUBLIC_BUILD_SHA=${VERSION}`)
    expect(text).toContain("--build-env NEXT_PUBLIC_CONVEX_URL=<DIASPORALE_DEMO_CONVEX_URL>")
    const passed = deploy.filter((_, index) => deploy[index - 1] === "--build-env").map((arg) => arg[0].slice(0, -1))
    expect(passed.every((name) => PUBLIC_RELEASE_VARIABLES.includes(name))).toBe(true)
    expect(passed).not.toContain("NEXT_PUBLIC_IDN_PORTAL_URL")
  })

  test("aucune commande de bascule avant la seconde porte, aucune commande de backend", () => {
    const commands = plan().steps.flatMap((step) => (step.commands ?? []).map(renderCommand))
    const promoteAt = commands.findIndex((command) => command.startsWith("vercel promote"))
    expect(commands.filter((command) => command.startsWith("vercel promote")).length).toBe(1)
    expect(commands.slice(0, promoteAt).some((command) => command.includes("promote"))).toBe(false)
    expect(commands.some((command) => /convex (deploy|run|env)/.test(command))).toBe(false)
  })

  test("les liens d'élévation ne passent que s'ils sont posés sur la machine", () => {
    const withLinks = buildReleasePlan({ target: "demo", antsia: ANTSIA, diasporale: DIASPORALE, values: { idnPortalUrl: "x", consulateUrl: "y" } })
    expect(withLinks.variables.map(([name]) => name)).toContain("NEXT_PUBLIC_IDN_PORTAL_URL")
    expect(withLinks.variables.map(([name]) => name)).toContain("NEXT_PUBLIC_CONSULATE_URL")
  })

  test("la production a ses propres variables et sa propre étiquette", () => {
    const production = buildReleasePlan({ target: "production", antsia: ANTSIA, diasporale: DIASPORALE })
    const rendered = renderReleasePlan(production)
    expect(production.version).toBe("diasporale-dddddddddddd-antsia-aaaaaaaaaaaa-production")
    expect(rendered).toContain("<DIASPORALE_PRODUCTION_SITE_URL>")
    expect(rendered).not.toContain("DIASPORALE_DEMO_")
  })

  test("le plan rendu nomme les variables et ne recopie aucune valeur de la machine", () => {
    const rendered = renderReleasePlan(buildReleasePlan({ target: "demo", antsia: ANTSIA, diasporale: DIASPORALE, values: { siteUrl: DEMO_ENV.DIASPORALE_DEMO_SITE_URL } }), {
      published: { antsia: true, diasporale: false },
      problems: ["DIASPORALE_VERCEL_SCOPE manque"],
    })
    expect(rendered).toContain(`version : ${VERSION}`)
    expect(rendered).toContain(`ANTSIA ${ANTSIA.commit} (arbre ${ANTSIA.tree})`)
    expect(rendered).toContain("ANTSIA oui, DIASPORALE NON")
    expect(rendered).toContain("phrase à taper : PUBLIER demo")
    expect(rendered).toContain("avec VERCEL_ORG_ID=<DIASPORALE_VERCEL_ORG_ID>, VERCEL_PROJECT_ID=<DIASPORALE_DEMO_VERCEL_PROJECT_ID>")
    expect(rendered).toContain("  - DIASPORALE_VERCEL_SCOPE manque")
    for (const value of Object.values(DEMO_ENV)) expect(rendered).not.toContain(value)
  })

  test("l'accord porte sur les commits, la cible, l'ordre et le retour arrière", () => {
    const points = releaseAgreementPoints(plan())
    expect(points.map((point) => point.split(" : ")[0])).toEqual(["commits", "cible", "ordre", "retour arrière"])
    expect(points[0]).toContain(ANTSIA.commit)
    expect(points[0]).toContain(DIASPORALE.commit)
  })
})

/** Une machine et un hébergeur simulés : chaque commande est relevée, rien ne sort. */
function fakeDeps({ answers = [true, true], published = true, deploy = `${NEW_DEPLOYMENT}\n`, ready = "READY", privateReport = report(VERSION), publicVersion = VERSION, freezeError = null, servedFails = false } = {}) {
  const calls = []
  const logs = []
  const records = []
  let promoted = false
  const confirmations = [...answers]
  const run = (argv, options) => {
    calls.push({ argv, env: options?.env ?? {} })
    const [tool, verb] = argv
    if (tool === "git" && argv.includes("merge-base")) return { status: published === true || argv.includes(published) ? 0 : 1, stdout: "" }
    if (tool === "git") return { status: 0, stdout: "" }
    if (verb === "inspect" && argv[2] === DEMO_ENV.DIASPORALE_DEMO_SITE_URL) {
      return servedFails ? { status: 1, stdout: "" } : { status: 0, stdout: JSON.stringify({ id: "ancien", url: OLD_DEPLOYMENT.replace("https://", ""), readyState: "READY" }) }
    }
    if (verb === "deploy") return { status: deploy ? 0 : 1, stdout: deploy ?? "" }
    if (verb === "inspect") return { status: 0, stdout: JSON.stringify({ id: "nouveau", url: NEW_DEPLOYMENT, readyState: ready }) }
    if (verb === "curl") return { status: 0, stdout: typeof privateReport === "string" ? privateReport : JSON.stringify(privateReport) }
    if (verb === "promote") {
      promoted = true
      return { status: 0, stdout: "" }
    }
    throw new Error(`commande inattendue : ${argv.join(" ")}`)
  }
  const fetch = async (url) => {
    expect(String(url)).toBe(`${DEMO_ENV.DIASPORALE_DEMO_SITE_URL}/api/sante-fonctionnelle`)
    return new Response(JSON.stringify(report(promoted ? publicVersion : OLD_VERSION)), { status: 200, headers: { "content-security-policy": CSP } })
  }
  const deps = {
    run,
    fetch,
    confirm: async () => confirmations.shift() ?? false,
    log: (line) => logs.push(line),
    env: DEMO_ENV,
    repos: { ANTSIA: "/depots/ANTSIA", DIASPORALE: "/depots/DIASPORALE" },
    makeWorkdir: () => mkdtempSync(join(tmpdir(), "diasporale-essai-publication-")),
    freeze: ({ workdir, commits }) => {
      if (freezeError) throw new Error(freezeError)
      expect(commits).toEqual({ ANTSIA: ANTSIA.commit, DIASPORALE: DIASPORALE.commit })
      return { context: join(workdir, "ECOSYSTEMES"), fingerprint: "f".repeat(64), files: 42 }
    },
    record: (_workdir, record) => records.push(structuredClone(record)),
    sleep: async () => {},
  }
  const commands = () => calls.map((call) => call.argv.slice(0, 2).join(" "))
  return { deps, calls, logs, records, commands }
}

describe("exécution", () => {
  test("sans la première confirmation, aucune commande ne part", async () => {
    const fake = fakeDeps({ answers: [false] })
    const result = await executeRelease(plan(), fake.deps)
    expect(result).toMatchObject({ ok: false, stage: "agreement" })
    expect(fake.calls).toEqual([])
    expect(fake.logs[0]).toContain("accord écrit et détaillé du propriétaire")
  })

  test("le chemin complet : figer, publier sans bascule, contrôler, basculer, contrôler", async () => {
    const fake = fakeDeps()
    const result = await executeRelease(plan(), fake.deps)
    expect(result.ok).toBe(true)
    expect(fake.commands()).toEqual(["git -C", "git -C", "git -C", "git -C", "vercel inspect", "vercel deploy", "vercel inspect", "vercel curl", "vercel promote"])
    const deploy = fake.calls.find((call) => call.argv[1] === "deploy")
    expect(deploy.argv).toContain("--skip-domain")
    expect(deploy.argv).toContain(`NEXT_PUBLIC_SITE_URL=${DEMO_ENV.DIASPORALE_DEMO_SITE_URL}`)
    expect(deploy.argv).toContain(`sourceFingerprint=${"f".repeat(64)}`)
    expect(deploy.env).toEqual({ VERCEL_ORG_ID: "equipe_fictive", VERCEL_PROJECT_ID: "projet_fictif_demo" })
    expect(fake.calls.find((call) => call.argv[1] === "promote").argv).toEqual(["vercel", "promote", NEW_DEPLOYMENT, "--scope", "portee-fictive", "--yes"])
    expect(result.record).toMatchObject({
      version: VERSION,
      deployment: NEW_DEPLOYMENT,
      previous: { deployment: OLD_DEPLOYMENT, version: OLD_VERSION },
      sourceFingerprint: "f".repeat(64),
      sourceFiles: 42,
      publicCheck: [],
    })
    expect(result.record.stages).toEqual(["agreement", "fetch", "published", "freeze", "served", "deploy", "ready", "private-check", "confirm-promote", "promote", "public-check"])
  })

  test("un commit absent d'origin/main arrête tout avant le gel", async () => {
    const fake = fakeDeps({ published: ANTSIA.commit })
    const result = await executeRelease(plan(), fake.deps)
    expect(result).toMatchObject({ ok: false, stage: "published", reason: "le commit de DIASPORALE n'est pas sur origin/main" })
    expect(fake.calls.some((call) => call.argv[0] === "vercel")).toBe(false)
  })

  test("un gel impossible arrête tout avant l'hébergeur", async () => {
    const fake = fakeDeps({ freezeError: "Contexte figé impossible" })
    expect(await executeRelease(plan(), fake.deps)).toMatchObject({ ok: false, stage: "freeze" })
    expect(fake.calls.some((call) => call.argv[0] === "vercel")).toBe(false)
  })

  test("une publication sans adresse de déploiement s'arrête", async () => {
    const fake = fakeDeps({ deploy: "Error: build failed\n" })
    expect(await executeRelease(plan(), fake.deps)).toMatchObject({ ok: false, stage: "deploy" })
    expect(fake.commands()).not.toContain("vercel promote")
  })

  test("un déploiement qui n'est pas prêt ne se contrôle ni ne bascule", async () => {
    const fake = fakeDeps({ ready: "ERROR" })
    expect(await executeRelease(plan(), fake.deps)).toMatchObject({ ok: false, stage: "ready" })
    expect(fake.commands()).not.toContain("vercel curl")
    expect(fake.commands()).not.toContain("vercel promote")
  })

  test("un contrôle privé en écart (version, source, moteur) empêche la bascule", async () => {
    for (const privateReport of [report(OLD_VERSION), { ...report(VERSION), dataSource: "demo" }, { ...report(VERSION), status: "degraded", engine: "unreachable" }, "<html>"]) {
      const fake = fakeDeps({ privateReport })
      const result = await executeRelease(plan(), fake.deps)
      expect(result).toMatchObject({ ok: false, stage: "private-check" })
      expect(result.reason).toContain("aucune bascule")
      expect(fake.commands()).not.toContain("vercel promote")
    }
  })

  test("sans la seconde confirmation, le déploiement reste publié sans domaine", async () => {
    const fake = fakeDeps({ answers: [true, false] })
    expect(await executeRelease(plan(), fake.deps)).toMatchObject({ ok: false, stage: "confirm-promote" })
    expect(fake.commands()).not.toContain("vercel promote")
  })

  test("un contrôle public en écart propose le retour arrière, sans le jouer", async () => {
    const fake = fakeDeps({ publicVersion: OLD_VERSION })
    const result = await executeRelease(plan(), fake.deps)
    expect(result).toMatchObject({ ok: false, stage: "public-check" })
    expect(result.reason).toContain(`node scripts/rollback.mjs --target demo --to ${OLD_DEPLOYMENT} --version ${OLD_VERSION}`)
    expect(fake.commands().filter((command) => command === "vercel promote").length).toBe(1)
    expect(fake.records.at(-1)).toMatchObject({ stoppedAt: "public-check" })
  })

  test("une première publication le dit : aucun retour arrière possible", async () => {
    const fake = fakeDeps({ servedFails: true, publicVersion: OLD_VERSION })
    const result = await executeRelease(plan(), fake.deps)
    expect(fake.logs.some((line) => line.includes("première publication"))).toBe(true)
    expect(result.reason).toContain("aucun déploiement précédent relevé")
  })

  test("le journal d'exécution ne recopie aucune valeur de la machine", async () => {
    const fake = fakeDeps({ privateReport: report(OLD_VERSION) })
    await executeRelease(plan(), fake.deps)
    const journal = fake.logs.join("\n")
    for (const value of Object.values(DEMO_ENV)) expect(journal).not.toContain(value)
  })
})
