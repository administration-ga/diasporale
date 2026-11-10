// @vitest-environment node
import { runInNewContext } from "node:vm"

import { getFixedT } from "@diasporale/features/i18n"
import { describe, expect, it } from "vitest"

import { routes } from "@/lib/routes"
import { OFFLINE_CACHE_PREFIX, SERVICE_WORKER_VERSION } from "@/lib/service-worker"
import type { ServiceWorkerConfiguration } from "@/lib/service-worker-script"

import { GET } from "./route"

/** MO-05 : la route qui sert le script de fond unique du site. */

/** La configuration inscrite en tête du script, relue telle que le navigateur la recevra. */
function configurationOf(script: string): ServiceWorkerConfiguration {
  const line = script.split("\n")[0] ?? ""
  return JSON.parse(line.slice("const config=".length, -1)) as ServiceWorkerConfiguration
}

describe("route du script de fond", () => {
  it("sert un script, jamais gardé par le navigateur, pour tout le site", () => {
    const response = GET()
    expect(response.headers.get("Content-Type")).toBe("application/javascript; charset=utf-8")
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(response.headers.get("Service-Worker-Allowed")).toBe(routes.home())
  })

  it("porte la marque, les phrases neutres de l'i18n et les seules adresses de la table des routes", async () => {
    const config = configurationOf(await GET().text())
    expect(config).toEqual({
      version: SERVICE_WORKER_VERSION,
      cachePrefix: OFFLINE_CACHE_PREFIX,
      offlinePath: routes.offline(),
      title: getFixedT("fr")("brand.name"),
      messages: { fr: getFixedT("fr")("installableApp.notificationBody"), en: getFixedT("en")("installableApp.notificationBody") },
      tagPrefix: "diasporale-notification-",
      openPath: null,
      fallbackPath: routes.feed(),
      referenceParam: "reference",
    })
    expect(config.messages.fr).not.toBe(config.messages.en)
  })

  it("le script servi s'exécute et pose ses écouteurs, sans activer aucune inscription aux notifications", async () => {
    const script = await GET().text()
    const kinds: string[] = []
    runInNewContext(script, { URL, self: { addEventListener: (kind: string) => kinds.push(kind), registration: { scope: "https://diasporale.example/" } } })
    expect(kinds.sort()).toEqual(["activate", "fetch", "install", "notificationclick", "push"])
    expect(script).not.toMatch(/pushManager|subscribe\(/)
  })
})
