import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants"
import { afterEach, describe, expect, it, vi } from "vitest"

import diasporaleNextConfig from "../../next.config"

import { assertProductionBuild, checkProductionBuild, isPublicSiteUrl, type ProductionBuildEnv } from "./production-build-guard"

/** Adresses FICTIVES : aucune ne doit ressortir dans un message de la garde. */
const ENGINE_URL = "https://moteur-fictif.example"
const PUBLIC_SITE = "https://site-public.example"

const READY: ProductionBuildEnv = { dataSource: "engine", convexUrl: ENGINE_URL, siteUrl: PUBLIC_SITE, buildSha: "abc1234" }

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("garde de construction — la source de données se déclare", () => {
  it("une construction complète vers un domaine public passe, sans avertissement", () => {
    expect(checkProductionBuild(READY)).toEqual({ errors: [], warnings: [] })
  })

  it("sans source déclarée, la construction échoue", () => {
    const { errors } = checkProductionBuild({ ...READY, dataSource: undefined })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain("NEXT_PUBLIC_DIASPORALE_DATA_SOURCE")
  })

  it("même sans domaine public : aucune construction ne sert la démonstration par défaut", () => {
    expect(checkProductionBuild({ dataSource: undefined, convexUrl: undefined, siteUrl: undefined, buildSha: undefined }).errors[0]).toContain(
      "NEXT_PUBLIC_DIASPORALE_DATA_SOURCE",
    )
  })

  it("une valeur inconnue (casse, faute de frappe, vide) échoue comme une absence", () => {
    for (const dataSource of ["Engine", "moteur", "", " engine"]) {
      expect(checkProductionBuild({ ...READY, dataSource }).errors, dataSource).toHaveLength(1)
    }
  })

  it("la source « engine » exige l'adresse du moteur", () => {
    const { errors } = checkProductionBuild({ ...READY, convexUrl: "  " })
    expect(errors).toEqual([expect.stringContaining("NEXT_PUBLIC_CONVEX_URL")])
  })

  it("la démonstration est refusée sur un domaine public", () => {
    const { errors } = checkProductionBuild({ ...READY, dataSource: "demo", convexUrl: undefined })
    expect(errors).toEqual([expect.stringContaining("domaine public")])
  })

  it("la démonstration déclarée passe en local, ou sans domaine visé", () => {
    for (const siteUrl of [undefined, "http://localhost:3031", "http://127.0.0.1:3031", "http://[::1]:3031", "http://diasporale.localhost", "https://recette.test"]) {
      expect(checkProductionBuild({ dataSource: "demo", convexUrl: undefined, siteUrl, buildSha: "abc1234" }).errors, siteUrl).toEqual([])
    }
  })

  it("une adresse de site illisible compte comme un domaine public (la garde se ferme)", () => {
    expect(isPublicSiteUrl("pas une adresse")).toBe(true)
    expect(checkProductionBuild({ ...READY, dataSource: "demo", siteUrl: "pas une adresse" }).errors).toHaveLength(1)
  })
})

describe("garde de construction — la version construite", () => {
  it("un domaine public sans version construite échoue : la sonde doit la dire", () => {
    const { errors, warnings } = checkProductionBuild({ ...READY, buildSha: undefined })
    expect(errors).toEqual([expect.stringContaining("NEXT_PUBLIC_BUILD_SHA")])
    expect(warnings).toEqual([])
  })

  it("hors domaine public, une version absente se signale sans bloquer", () => {
    const { errors, warnings } = checkProductionBuild({ ...READY, siteUrl: "http://localhost:3031", buildSha: "" })
    expect(errors).toEqual([])
    expect(warnings).toEqual([expect.stringContaining("NEXT_PUBLIC_BUILD_SHA")])
  })
})

describe("garde de construction — application", () => {
  it("refuse avec toutes les raisons, sans recopier aucune valeur de variable", () => {
    const warn = vi.fn<(message: string) => void>()
    let message = ""
    try {
      assertProductionBuild({ dataSource: "demo", convexUrl: ENGINE_URL, siteUrl: PUBLIC_SITE, buildSha: undefined }, warn)
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain("Construction de diasporale.com refusée")
    expect(message).toContain("domaine public")
    expect(message).toContain("NEXT_PUBLIC_BUILD_SHA")
    expect(message).not.toContain("moteur-fictif")
    expect(message).not.toContain("site-public")
    expect(warn).not.toHaveBeenCalled()
  })

  it("signale les avertissements et laisse passer", () => {
    const warn = vi.fn<(message: string) => void>()
    expect(() => assertProductionBuild({ ...READY, siteUrl: undefined, buildSha: undefined }, warn)).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("NEXT_PUBLIC_BUILD_SHA"))
  })
})

describe("garde de construction — branchée dans next.config.ts", () => {
  function stubBuild(env: Partial<ProductionBuildEnv>) {
    vi.stubEnv("NEXT_PUBLIC_DIASPORALE_DATA_SOURCE", env.dataSource)
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", env.convexUrl)
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", env.siteUrl)
    vi.stubEnv("NEXT_PUBLIC_BUILD_SHA", env.buildSha)
  }

  it("`next build` sans source déclarée échoue", () => {
    stubBuild({ convexUrl: ENGINE_URL, siteUrl: PUBLIC_SITE, buildSha: "abc1234" })
    expect(() => diasporaleNextConfig(PHASE_PRODUCTION_BUILD)).toThrow(/NEXT_PUBLIC_DIASPORALE_DATA_SOURCE/)
  })

  it("`next build` vers un domaine public avec la démonstration échoue", () => {
    stubBuild({ dataSource: "demo", siteUrl: PUBLIC_SITE, buildSha: "abc1234" })
    expect(() => diasporaleNextConfig(PHASE_PRODUCTION_BUILD)).toThrow(/domaine public/)
  })

  it("`next build` complet rend la configuration commune du moteur", () => {
    stubBuild(READY)
    expect(diasporaleNextConfig(PHASE_PRODUCTION_BUILD)).toMatchObject({ output: "standalone" })
  })

  it("`next dev` n'est pas concerné : la démonstration reste le défaut du poste de travail", () => {
    stubBuild({})
    expect(diasporaleNextConfig(PHASE_DEVELOPMENT_SERVER)).toMatchObject({ output: "standalone" })
  })
})
