import { describe, expect, test } from "bun:test"

// La vraie politique de sécurité des applications du moteur : le contrôle lit ce format-là.
import { buildContentSecurityPolicy } from "../../ANTSIA/packages/api/csp.mjs"
import { checkRelease, cspSources, evaluateEngineTarget, evaluateHealth, evaluateHealthText, parseCheckArgs } from "./release-check.mjs"

/** Valeurs FICTIVES (domaines réservés à la documentation, RFC 2606) : aucune ressource réelle. */
const SITE = "https://site-demo.example.org"
const ENGINE = "https://moteur-demo.example.net"
const VERSION = "diasporale-dddddddddddd-antsia-aaaaaaaaaaaa-demo"
const report = (overrides = {}) => ({ status: "ok", application: "diasporale-com", version: VERSION, backend: "configured", dataSource: "engine", engine: "reachable", ...overrides })
const productionCsp = (convexUrl) => buildContentSecurityPolicy({ convexUrl, isDev: false })

describe("ligne de commande", () => {
  test("une cible et une étiquette de la même cible", () => {
    expect(parseCheckArgs(["--target", "demo", "--version", VERSION])).toEqual({ target: "demo", version: VERSION, problems: [] })
    expect(parseCheckArgs(["--target", "production", "--version", VERSION]).problems).toEqual(["--version désigne une autre cible que --target"])
    expect(parseCheckArgs(["--target", "demo", "--version", "main-abc"]).problems).toEqual(["--version doit être une étiquette diasporale-<12>-antsia-<12>-<cible>"])
    expect(parseCheckArgs([]).problems).toEqual(["--target doit valoir demo ou production", "--version doit être une étiquette diasporale-<12>-antsia-<12>-<cible>"])
  })
})

describe("rapport de la sonde (LX-01)", () => {
  test("un rapport conforme n'a aucun écart", () => {
    expect(evaluateHealth(report(), { version: VERSION })).toEqual([])
  })

  test("chaque écart se dit : application, état, version, source, moteur", () => {
    expect(evaluateHealth(report({ application: "antsia-ga" }), { version: VERSION })).toEqual(["la sonde n'est pas celle de diasporale-com"])
    expect(evaluateHealth(report({ status: "degraded", engine: "unreachable" }), { version: VERSION })).toEqual([
      "état dégradé : le service ne peut pas servir ses données",
      "moteur injoignable depuis le site",
    ])
    expect(evaluateHealth(report({ version: "dev" }), { version: VERSION })).toEqual([`version servie « dev », attendue « ${VERSION} »`])
    expect(evaluateHealth(report({ dataSource: "demo", engine: "not_checked" }), { version: VERSION })).toEqual([
      "source de données autre que « engine » : un site publié sert le moteur, jamais les données fictives",
      "moteur injoignable depuis le site",
    ])
    expect(evaluateHealth(report({ backend: "missing" }), { version: VERSION })).toEqual(["adresse du moteur absente de la construction"])
  })

  test("sans version attendue, la version n'est pas comparée (relevé avant publication)", () => {
    expect(evaluateHealth(report({ version: "autre" }), { version: null })).toEqual([])
  })

  test("une réponse qui n'est pas un rapport est un écart", () => {
    expect(evaluateHealth(null, { version: VERSION })).toEqual(["la sonde ne rend pas un rapport lisible"])
    expect(evaluateHealthText("<html>Authentification requise</html>", { version: VERSION })).toEqual(["réponse de la sonde illisible (pas du JSON)"])
    expect(evaluateHealthText(JSON.stringify(report()), { version: VERSION })).toEqual([])
  })
})

describe("moteur visé, lu dans la politique de sécurité", () => {
  test("lit les sources d'une directive", () => {
    expect(cspSources("default-src 'self'; connect-src 'self' https://a.example wss://a.example", "connect-src")).toEqual(["'self'", "https://a.example", "wss://a.example"])
    expect(cspSources("default-src 'self'", "connect-src")).toEqual([])
    expect(cspSources(null, "connect-src")).toEqual([])
  })

  test("la politique réelle du moteur, construite pour le moteur de la cible, est conforme", () => {
    expect(evaluateEngineTarget(productionCsp("https://moteur-demo.convex.cloud"), "https://moteur-demo.convex.cloud", "DIASPORALE_DEMO_CONVEX_URL")).toEqual([])
    expect(evaluateEngineTarget(productionCsp(ENGINE), ENGINE, "DIASPORALE_DEMO_CONVEX_URL")).toEqual([])
  })

  test("un site construit pour un autre moteur est signalé, en nommant la variable", () => {
    const csp = productionCsp("https://moteur-production.convex.cloud")
    expect(evaluateEngineTarget(csp, "https://moteur-demo.convex.cloud", "DIASPORALE_DEMO_CONVEX_URL")).toEqual([
      "la politique de sécurité n'autorise pas le moteur de DIASPORALE_DEMO_CONVEX_URL",
      "la politique de sécurité autorise 2 origine(s) d'un autre moteur que celui de DIASPORALE_DEMO_CONVEX_URL",
    ])
  })

  test("un moteur de trop, ou une politique absente, sont des écarts", () => {
    const csp = productionCsp("https://moteur-demo.convex.cloud").replace("connect-src 'self'", "connect-src 'self' https://autre.convex.cloud")
    expect(evaluateEngineTarget(csp, "https://moteur-demo.convex.cloud", "DIASPORALE_DEMO_CONVEX_URL")).toEqual([
      "la politique de sécurité autorise 1 origine(s) d'un autre moteur que celui de DIASPORALE_DEMO_CONVEX_URL",
    ])
    expect(evaluateEngineTarget(null, ENGINE, "DIASPORALE_DEMO_CONVEX_URL")).toEqual(["en-tête Content-Security-Policy absent : le moteur visé ne se vérifie pas"])
  })
})

describe("contrôle d'une version servie", () => {
  const respond = (body, csp = productionCsp(ENGINE)) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status: 200, headers: csp ? { "content-security-policy": csp } : {} })

  test("lit la sonde du site, sans cache et sans suivre de redirection", async () => {
    const requests = []
    const fetch = async (url, init) => {
      requests.push({ url: String(url), init })
      return respond(report())
    }
    expect(await checkRelease({ target: "demo", siteUrl: SITE, convexUrl: ENGINE, version: VERSION, fetch })).toEqual({ ok: true, problems: [], report: report(), attempts: 1 })
    expect(requests).toEqual([{ url: `${SITE}/api/sante-fonctionnelle`, init: { cache: "no-store", redirect: "error", headers: { accept: "application/json" } } }])
  })

  test("réessaie le temps que la bascule se propage, puis conclut", async () => {
    const answers = [respond(report({ version: "ancienne" })), respond(report())]
    const pauses = []
    const result = await checkRelease({ target: "demo", siteUrl: SITE, convexUrl: ENGINE, version: VERSION, fetch: async () => answers.shift(), attempts: 3, delayMs: 10, sleep: async (ms) => pauses.push(ms) })
    expect(result).toMatchObject({ ok: true, attempts: 2 })
    expect(pauses).toEqual([10])
  })

  test("un écart persistant échoue avec ses raisons ; la politique compte autant que la sonde", async () => {
    const result = await checkRelease({ target: "demo", siteUrl: SITE, convexUrl: ENGINE, version: VERSION, fetch: async () => respond(report(), null), attempts: 2 })
    expect(result).toEqual({ ok: false, problems: ["en-tête Content-Security-Policy absent : le moteur visé ne se vérifie pas"], report: report(), attempts: 2 })
    expect((await checkRelease({ target: "demo", siteUrl: SITE, convexUrl: ENGINE, version: VERSION, fetch: async () => respond("<html>") })).problems).toEqual([
      "réponse de la sonde illisible (pas du JSON)",
    ])
  })

  test("un site injoignable se dit sans recopier l'erreur, qui peut citer une adresse", async () => {
    const result = await checkRelease({
      target: "production",
      siteUrl: SITE,
      convexUrl: ENGINE,
      version: VERSION,
      fetch: async () => {
        throw new Error(`getaddrinfo ENOTFOUND ${SITE}`)
      },
    })
    expect(result).toEqual({ ok: false, problems: ["site de DIASPORALE_PRODUCTION_SITE_URL injoignable"], report: null, attempts: 1 })
  })
})
