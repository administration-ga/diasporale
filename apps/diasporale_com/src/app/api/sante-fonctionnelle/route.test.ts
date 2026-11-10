import { getFunctionName, type FunctionReference } from "convex/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ENGINE_PING_TIMEOUT_MS } from "@/lib/functional-health"

type ClientOptions = { fetch?: typeof globalThis.fetch }

/** Le client HTTP de Convex, remplacé : la sonde ne joint aucun vrai déploiement pendant les tests. */
const mocks = vi.hoisted(() => ({
  construct: vi.fn<(address: string, options?: ClientOptions) => void>(),
  query: vi.fn<(reference: unknown, args: unknown, options?: ClientOptions) => Promise<unknown>>(),
}))

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    private readonly options?: ClientOptions
    constructor(address: string, options?: ClientOptions) {
      this.options = options
      mocks.construct(address, options)
    }
    query(reference: unknown, args: unknown) {
      return mocks.query(reference, args, this.options)
    }
  },
}))

import { dynamic, GET } from "./route"

/** Une adresse de moteur FICTIVE : elle ne doit jamais ressortir dans la réponse. */
const ENGINE_URL = "https://moteur-fictif.example"

function stubSource(env: { dataSource?: string; convexUrl?: string; buildSha?: string }) {
  vi.stubEnv("NEXT_PUBLIC_DIASPORALE_DATA_SOURCE", env.dataSource)
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", env.convexUrl)
  vi.stubEnv("NEXT_PUBLIC_BUILD_SHA", env.buildSha)
}

async function probe() {
  const response = await GET()
  const text = await response.text()
  return { response, text, body: JSON.parse(text) as Record<string, unknown> }
}

beforeEach(() => {
  mocks.construct.mockReset()
  mocks.query.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("GET /api/sante-fonctionnelle — source de démonstration", () => {
  it("dit la source « demo », répond 200 et n'interroge pas le moteur", async () => {
    stubSource({ dataSource: "demo", convexUrl: ENGINE_URL, buildSha: "abc1234" })
    const { response, body } = await probe()
    expect(response.status).toBe(200)
    expect(body).toEqual({
      status: "ok",
      application: "diasporale-com",
      version: "abc1234",
      backend: "configured",
      dataSource: "demo",
      engine: "not_checked",
    })
    expect(mocks.construct).not.toHaveBeenCalled()
  })

  it("sans source déclarée (développement), dit la démonstration servie, comme le choix des fournisseurs", async () => {
    stubSource({ convexUrl: ENGINE_URL })
    const { body } = await probe()
    expect(body).toMatchObject({ status: "ok", dataSource: "demo", engine: "not_checked" })
  })
})

describe("GET /api/sante-fonctionnelle — moteur joint", () => {
  it("joint le moteur par health.ping et répond 200 quand il répond « ok »", async () => {
    stubSource({ dataSource: "engine", convexUrl: ENGINE_URL, buildSha: "abc1234" })
    mocks.query.mockResolvedValue({ status: "ok" })
    const { response, body } = await probe()
    expect(response.status).toBe(200)
    expect(body).toEqual({
      status: "ok",
      application: "diasporale-com",
      version: "abc1234",
      backend: "configured",
      dataSource: "engine",
      engine: "reachable",
    })
    expect(mocks.construct).toHaveBeenCalledWith(ENGINE_URL, expect.objectContaining({ fetch: expect.any(Function) }))
    const [reference, args] = mocks.query.mock.calls[0]!
    expect(getFunctionName(reference as FunctionReference<"query">)).toBe("health:ping")
    expect(args).toEqual({})
  })

  it("admet les champs que le moteur ajoutera à sa sonde (date, version du moteur)", async () => {
    stubSource({ dataSource: "engine", convexUrl: ENGINE_URL })
    mocks.query.mockResolvedValue({ status: "ok", serverTime: 1, engineVersion: "fictive" })
    const { response, body } = await probe()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ engine: "reachable" })
    expect(body).not.toHaveProperty("engineVersion")
  })
})

describe("GET /api/sante-fonctionnelle — moteur absent", () => {
  it("adresse du moteur absente : 503, configuration absente, moteur non interrogé", async () => {
    stubSource({ dataSource: "engine", buildSha: "abc1234" })
    const { response, body } = await probe()
    expect(response.status).toBe(503)
    expect(body).toMatchObject({ status: "degraded", backend: "missing", dataSource: "engine", engine: "not_checked" })
    expect(mocks.construct).not.toHaveBeenCalled()
  })

  it("moteur injoignable : 503, et l'erreur (qui cite l'adresse) n'est jamais recopiée", async () => {
    stubSource({ dataSource: "engine", convexUrl: ENGINE_URL })
    mocks.query.mockRejectedValue(new Error(`fetch failed: ${ENGINE_URL}/api/query`))
    const { response, body, text } = await probe()
    expect(response.status).toBe(503)
    expect(body).toMatchObject({ status: "degraded", backend: "configured", dataSource: "engine", engine: "unreachable" })
    expect(text).not.toContain("moteur-fictif")
    expect(text).not.toContain("fetch failed")
  })

  it("réponse inattendue du moteur : 503", async () => {
    stubSource({ dataSource: "engine", convexUrl: ENGINE_URL })
    mocks.query.mockResolvedValue({ status: "down" })
    const { response, body } = await probe()
    expect(response.status).toBe(503)
    expect(body).toMatchObject({ status: "degraded", engine: "unreachable" })
  })

  it("moteur muet au-delà de 2 s : 503, et la requête vers le moteur est interrompue", async () => {
    vi.useFakeTimers()
    stubSource({ dataSource: "engine", convexUrl: ENGINE_URL })
    let signal: AbortSignal | undefined
    let cache: RequestCache | undefined
    vi.stubGlobal("fetch", (_input: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined
      cache = init?.cache
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true })
      })
    })
    // Le client remplacé passe par le `fetch` borné que la sonde lui confie.
    mocks.query.mockImplementation(async (_reference, _args, options) => options?.fetch?.(`${ENGINE_URL}/api/query`, {}))
    const pending = probe()
    await vi.advanceTimersByTimeAsync(ENGINE_PING_TIMEOUT_MS - 1)
    expect(signal?.aborted).toBe(false)
    expect(cache).toBe("no-store")
    await vi.advanceTimersByTimeAsync(1)
    const { response, body } = await pending
    expect(response.status).toBe(503)
    expect(body).toMatchObject({ status: "degraded", engine: "unreachable" })
    expect(signal?.aborted).toBe(true)
  })
})

describe("GET /api/sante-fonctionnelle — version servie", () => {
  it("dit la version construite (NEXT_PUBLIC_BUILD_SHA)", async () => {
    stubSource({ dataSource: "demo", buildSha: "4d5f421" })
    expect((await probe()).body.version).toBe("4d5f421")
  })

  it("sans version déclarée, ou avec un ARG de construction vide, dit « dev »", async () => {
    stubSource({ dataSource: "demo" })
    expect((await probe()).body.version).toBe("dev")
    stubSource({ dataSource: "demo", buildSha: "" })
    expect((await probe()).body.version).toBe("dev")
  })
})

describe("GET /api/sante-fonctionnelle — forme de la réponse", () => {
  it("n'est jamais rendue statiquement ni mise en cache", async () => {
    stubSource({ dataSource: "demo" })
    expect(dynamic).toBe("force-dynamic")
    expect((await probe()).response.headers.get("Cache-Control")).toBe("no-store")
  })

  it("ne porte que des champs d'état : ni adresse de déploiement, ni secret, ni donnée personnelle", async () => {
    stubSource({ dataSource: "engine", convexUrl: ENGINE_URL, buildSha: "abc1234" })
    mocks.query.mockResolvedValue({ status: "ok" })
    const { body, text } = await probe()
    expect(Object.keys(body).sort()).toEqual(["application", "backend", "dataSource", "engine", "status", "version"])
    expect(text).not.toContain("moteur-fictif")
    expect(text).not.toMatch(/https?:/)
  })
})
