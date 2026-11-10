import { describe, expect, it } from "vitest"

import { detectHardcodedUrls } from "./hardcoded-urls"
import { PRODUCT_AND_DOMAIN_ROOTS, productSources } from "./sources"

/**
 * Cliquet « aucune adresse en dur » (copie locale du cliquet du moteur, qui ne
 * relit que ses propres dossiers) : l'application, le paquet de surfaces et le
 * domaine passent par la table des routes et par l'environnement. La table des
 * routes est le SEUL fichier où une route s'écrit.
 */
const ROUTE_TABLE = "apps/diasporale_com/src/lib/routes.ts"

describe("cliquet adresses — aucune route ni URL écrite en dur", () => {
  const files = productSources([".ts", ".tsx"], PRODUCT_AND_DOMAIN_ROOTS).filter((file) => file.path !== ROUTE_TABLE)

  it("relit bien l'application, les surfaces et le domaine", () => {
    const roots = new Set(files.map((file) => file.path.split("/").slice(0, 2).join("/")))
    expect([...roots].sort()).toEqual(["apps/diasporale_com", "packages/diasporale-domain", "packages/diasporale-features"])
    expect(files.length).toBeGreaterThan(40)
  })

  it("le cliquet sait reconnaître un lien, une navigation, une propriété de route et une URL absolue", () => {
    const source = [
      'import x from "/abs/module"',
      '<Link href="/hub/france" />',
      'router.push("/parametres")',
      'const link = { href: "/pages/association-fictive" }',
      'const parts = path.split("/")',
      'const api = "https://exemple.org/api"',
      '<Link href={routes.feed()} />',
      'redirect("/entrer")',
      'type Path = "/fil"',
    ].join("\n")
    const lines = detectHardcodedUrls("apps/diasporale_com/src/a.tsx", source).map((finding) => Number(finding.split(":")[1]?.split(" ")[0]))
    expect(lines).toEqual([2, 3, 4, 6, 8])
  })

  it("aucune route ni URL absolue hors de la table des routes", () => {
    expect(files.flatMap((file) => detectHardcodedUrls(file.path, file.text))).toEqual([])
  })
})
