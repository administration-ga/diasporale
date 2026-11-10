import { describe, expect, test } from "bun:test"

import { renderCommand } from "./release-lib.mjs"
import { buildRollbackPlan, executeRollback, isDeploymentReference, parseRollbackArgs, renderRollbackPlan, rollbackCommand } from "./rollback.mjs"

/** Valeurs FICTIVES (domaines réservés à la documentation, RFC 2606) : aucune ressource réelle. */
const DEMO_ENV = Object.freeze({
  DIASPORALE_DEMO_SITE_URL: "https://site-demo.example.org",
  DIASPORALE_DEMO_CONVEX_URL: "https://moteur-demo.example.net",
  DIASPORALE_DEMO_VERCEL_PROJECT_ID: "projet_fictif_demo",
  DIASPORALE_VERCEL_ORG_ID: "equipe_fictive",
  DIASPORALE_VERCEL_SCOPE: "portee-fictive",
})
const OLD_DEPLOYMENT = "https://ancien-deploiement.example.org"
const OLD_VERSION = "diasporale-111111111111-antsia-222222222222-demo"
const CSP = "default-src 'self'; connect-src 'self' https://moteur-demo.example.net wss://moteur-demo.example.net"

const plan = () => buildRollbackPlan({ target: "demo", to: OLD_DEPLOYMENT, version: OLD_VERSION })
const report = (version) => ({ status: "ok", application: "diasporale-com", version, backend: "configured", dataSource: "engine", engine: "reachable" })

describe("ligne de commande", () => {
  test("un déploiement se désigne par son adresse https ou son identifiant", () => {
    expect(isDeploymentReference(OLD_DEPLOYMENT)).toBe(true)
    expect(isDeploymentReference("deploiement_fictif-01")).toBe(true)
    expect(isDeploymentReference("http://ancien.example.org")).toBe(false)
    expect(isDeploymentReference(`${OLD_DEPLOYMENT}/chemin`)).toBe(false)
    expect(isDeploymentReference("--yes")).toBe(false)
    expect(isDeploymentReference("pas une adresse")).toBe(false)
    expect(isDeploymentReference(undefined)).toBe(false)
  })

  test("cible, déploiement et étiquette de la même cible ; aucune option ne saute la confirmation", () => {
    expect(parseRollbackArgs(["--target", "demo", "--to", OLD_DEPLOYMENT, "--version", OLD_VERSION])).toEqual({
      target: "demo",
      to: OLD_DEPLOYMENT,
      version: OLD_VERSION,
      execute: false,
      problems: [],
    })
    expect(parseRollbackArgs(["--target", "production", "--to", OLD_DEPLOYMENT, "--version", OLD_VERSION, "--execute"]).problems).toEqual([
      "--version désigne une autre cible que --target",
    ])
    expect(parseRollbackArgs(["--force"]).problems).toEqual([
      "argument inconnu : --force",
      "--target doit valoir demo ou production",
      "--to doit désigner un déploiement (adresse https ou identifiant)",
      "--version doit être une étiquette diasporale-<12>-antsia-<12>-<cible>",
    ])
  })

  test("la commande que la publication propose après un contrôle public en écart", () => {
    expect(rollbackCommand("demo", OLD_DEPLOYMENT, OLD_VERSION)).toBe(`node scripts/rollback.mjs --target demo --to ${OLD_DEPLOYMENT} --version ${OLD_VERSION}`)
    expect(rollbackCommand("demo", OLD_DEPLOYMENT, null)).toContain("--version <étiquette servie avant la bascule>")
  })
})

describe("plan de retour arrière", () => {
  test("porte, vérification du déploiement, remise en service par promotion, contrôle public", () => {
    expect(plan().steps.map((step) => step.id)).toEqual(["agreement", "inspect", "promote", "public-check"])
    expect(plan().steps[0].gate).toBe(`REVENIR demo ${OLD_VERSION}`)
    const commands = plan().steps.flatMap((step) => (step.commands ?? []).map(renderCommand))
    expect(commands).toEqual([
      `vercel inspect ${OLD_DEPLOYMENT} --scope <DIASPORALE_VERCEL_SCOPE> --format=json`,
      `vercel promote ${OLD_DEPLOYMENT} --scope <DIASPORALE_VERCEL_SCOPE> --yes`,
      `node scripts/release-check.mjs --target demo --version ${OLD_VERSION}`,
    ])
    expect(commands.some((command) => /deploy|remove|rm |convex/.test(command))).toBe(false)
  })

  test("le plan rendu nomme les variables et ne recopie aucune valeur de la machine", () => {
    const rendered = renderRollbackPlan(plan(), { problems: ["DIASPORALE_VERCEL_SCOPE manque"] })
    expect(rendered).toContain(`version attendue après le retour : ${OLD_VERSION}`)
    expect(rendered).toContain("phrase à taper : REVENIR demo")
    expect(rendered).toContain("avec VERCEL_ORG_ID=<DIASPORALE_VERCEL_ORG_ID>, VERCEL_PROJECT_ID=<DIASPORALE_DEMO_VERCEL_PROJECT_ID>")
    expect(rendered).toContain("  - DIASPORALE_VERCEL_SCOPE manque")
    for (const value of Object.values(DEMO_ENV)) expect(rendered).not.toContain(value)
  })
})

function fakeDeps({ confirmed = true, inspect = { id: "ancien", url: OLD_DEPLOYMENT, readyState: "READY", target: "production", projectId: "projet_fictif_demo" }, promote = 0, servedVersion = OLD_VERSION } = {}) {
  const calls = []
  const logs = []
  const deps = {
    run: (argv, options) => {
      calls.push({ argv, env: options?.env ?? {} })
      if (argv[1] === "inspect") return inspect ? { status: 0, stdout: JSON.stringify(inspect) } : { status: 1, stdout: "" }
      if (argv[1] === "promote") return { status: promote, stdout: "" }
      throw new Error(`commande inattendue : ${argv.join(" ")}`)
    },
    confirm: async () => confirmed,
    fetch: async () => new Response(JSON.stringify(report(servedVersion)), { headers: { "content-security-policy": CSP } }),
    log: (line) => logs.push(line),
    env: DEMO_ENV,
    repos: {},
    sleep: async () => {},
  }
  return { deps, calls, logs, commands: () => calls.map((call) => call.argv.slice(0, 2).join(" ")) }
}

describe("exécution", () => {
  test("sans confirmation, aucune commande ne part", async () => {
    const fake = fakeDeps({ confirmed: false })
    expect(await executeRollback(plan(), fake.deps)).toMatchObject({ ok: false, stage: "agreement" })
    expect(fake.calls).toEqual([])
    expect(fake.logs[0]).toContain("accord écrit et détaillé du propriétaire")
  })

  test("le chemin complet : vérifier, repromouvoir, contrôler la version revenue", async () => {
    const fake = fakeDeps()
    expect(await executeRollback(plan(), fake.deps)).toEqual({ ok: true, stage: "public-check" })
    expect(fake.commands()).toEqual(["vercel inspect", "vercel promote"])
    expect(fake.calls[1]).toEqual({
      argv: ["vercel", "promote", OLD_DEPLOYMENT, "--scope", "portee-fictive", "--yes"],
      env: { VERCEL_ORG_ID: "equipe_fictive", VERCEL_PROJECT_ID: "projet_fictif_demo" },
    })
  })

  test("un déploiement introuvable, non prêt, hors production ou d'un autre projet n'est pas remis en service", async () => {
    const cases = [
      [null, "déploiement introuvable ou réponse illisible"],
      [{ id: "x", readyState: "ERROR" }, "déploiement non prêt (ERROR)"],
      [{ id: "x", readyState: "READY", target: "preview" }, "ce déploiement n'a pas été publié pour la production de la cible"],
      [{ id: "x", readyState: "READY", target: "production", projectId: "autre_projet" }, "ce déploiement n'appartient pas au projet de DIASPORALE_DEMO_VERCEL_PROJECT_ID"],
    ]
    for (const [inspect, reason] of cases) {
      const fake = fakeDeps({ inspect })
      expect(await executeRollback(plan(), fake.deps)).toEqual({ ok: false, stage: "inspect", reason })
      expect(fake.commands()).not.toContain("vercel promote")
    }
  })

  test("une remise en service qui échoue, ou une version qui ne revient pas, se disent", async () => {
    expect(await executeRollback(plan(), fakeDeps({ promote: 1 }).deps)).toMatchObject({ ok: false, stage: "promote" })
    const result = await executeRollback(plan(), fakeDeps({ servedVersion: "diasporale-dddddddddddd-antsia-aaaaaaaaaaaa-demo" }).deps)
    expect(result).toMatchObject({ ok: false, stage: "public-check" })
    expect(result.reason).toContain(`attendue « ${OLD_VERSION} »`)
  })
})
