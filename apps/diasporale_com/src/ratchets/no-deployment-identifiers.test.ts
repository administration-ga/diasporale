import { readdirSync, readFileSync, statSync } from "node:fs"
import { extname, join, relative } from "node:path"

import { describe, expect, it } from "vitest"

import { detectDeploymentIdentifiers, type IdentifierRuleId } from "./deployment-identifiers"
import { REPO_ROOT } from "./sources"

/**
 * Cliquet « aucun identifiant de déploiement » (lot LX-06) : les documents, les
 * scripts, les gabarits de `.github/` et les fichiers de la racine ne disent ni
 * l'adresse, ni le projet, ni l'équipe, ni le déploiement réels, ni une valeur
 * de variable, ni une adresse personnelle. Les échecs nomment le fichier, la
 * ligne et la nature, jamais la valeur.
 */
const DIRECTORIES = ["docs", "scripts", ".github"] as const
const TEXT_EXTENSIONS = new Set([".md", ".mdx", ".json", ".mjs", ".cjs", ".js", ".ts", ".sh", ".yml", ".yaml", ".txt", ".toml", ".csv", ".html"])
const ROOT_DOTFILES = new Set([".gitignore"])
const SKIPPED_DIRECTORIES = new Set(["node_modules", ".next", ".turbo", ".vercel", ".convex", "coverage", "dist", "out", ".git"])

/** Jamais relus : fichiers d'environnement et fichiers locaux, qui ne sont pas versionnés. */
const isLocalOnly = (name: string) => name.startsWith(".env") || /\.local(?:\.|$)/.test(name)

function textFilesUnder(directory: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(directory)
  } catch {
    return []
  }
  return entries.flatMap((name) => {
    if (SKIPPED_DIRECTORIES.has(name) || isLocalOnly(name)) return []
    const full = join(directory, name)
    if (statSync(full).isDirectory()) return textFilesUnder(full)
    return TEXT_EXTENSIONS.has(extname(name)) ? [full] : []
  })
}

function rootFiles(): string[] {
  return readdirSync(REPO_ROOT)
    .filter((name) => !isLocalOnly(name) && (ROOT_DOTFILES.has(name) || (!name.startsWith(".") && TEXT_EXTENSIONS.has(extname(name)))))
    .map((name) => join(REPO_ROOT, name))
    .filter((full) => statSync(full).isFile())
}

describe("cliquet dépôt public — aucun identifiant de déploiement dans les documents, les scripts et la racine", () => {
  const files = [...DIRECTORIES.flatMap((directory) => textFilesUnder(join(REPO_ROOT, directory))), ...rootFiles()].map((full) => relative(REPO_ROOT, full))

  it("relit bien les documents et les fichiers de la racine", () => {
    expect(files.filter((file) => file.startsWith("docs/")).length).toBeGreaterThan(40)
    expect(files).toEqual(expect.arrayContaining(["README.md", "CLAUDE.md", "package.json"]))
  })

  it("aucun identifiant de déploiement, aucune valeur de variable, aucune adresse personnelle", () => {
    const findings = files.flatMap((file) =>
      detectDeploymentIdentifiers(readFileSync(join(REPO_ROOT, file), "utf8")).map((finding) => `${file}:${finding.line} — ${finding.reason} (${finding.rule})`),
    )
    expect(findings).toEqual([])
  })

  // Exemples FABRIQUÉS : aucun ne désigne un déploiement réel. Les formes de clés
  // sont assemblées à l'exécution pour ne pas ressembler à une clé dans la source.
  const fake = "FAUX".repeat(5)
  const fabricated: Record<IdentifierRuleId, string> = {
    "hosted-address": "Site : https://faux-site-zz.vercel.app, publié le 2/11.",
    "console-address": "Tableau : vercel.com/equipe-fictive/projet-fictif",
    "deployment-id": `Retour arrière : promouvoir ${"dpl"}_${fake}.`,
    "backend-deployment-name": "branché sur le backend (`fictif-pangolin-000`)",
    "named-hosting-project": "le projet Vercel `projet-fictif` sert la démonstration",
    "cli-scope": "vercel deploy --scope equipe-fictive-1",
    "registry-path": "image : europe-west1-docker.pkg.dev/projet-fictif/images/app",
    "cloud-project-path": "secret : projects/projet-fictif/secrets/CLE",
    "service-account": "compte : robot@projet-fictif.iam.gserviceaccount.com",
    "secret-value": `clé : ${"sk"}_${"live"}_${fake}`,
    "variable-value": "CONVEX_DEPLOYMENT=dev:fictif-pangolin-000",
    "personal-email": "écrire à prenom.nom@fournisseur-fictif.ga",
  }

  it.each(Object.entries(fabricated))("test du test : %s fabriqué fait échouer le cliquet", (rule, line) => {
    expect(detectDeploymentIdentifiers(`# Rapport\n\n${line}\n`).map((finding) => finding.rule)).toContain(rule)
  })

  it("test du test : un échec ne recopie jamais la valeur trouvée", () => {
    const findings = detectDeploymentIdentifiers(Object.values(fabricated).join("\n"))
    const rendered = JSON.stringify(findings)
    for (const value of ["faux-site-zz", "projet-fictif", "fictif-pangolin-000", fake, "prenom.nom"]) expect(rendered).not.toContain(value)
  })

  it("test du test : une adresse de backend ne compte que sous la forme générée", () => {
    expect(detectDeploymentIdentifiers("moteur : https://fictif-pangolin-000.convex.cloud").map((finding) => finding.rule)).toEqual(["hosted-address"])
    expect(detectDeploymentIdentifiers('expect(check("https://moteur-demo.convex.cloud")).toEqual([])')).toEqual([])
  })

  it("test du test : un document sain passe (gabarits, noms de variables, scripts, captures, adresses de rôle)", () => {
    const healthy = [
      "Adresse : `<projet>.vercel.app`, ou `*.vercel.app` ; exemple : https://exemple.vercel.app",
      "Documentation : https://vercel.com/docs/cli et https://docs.convex.dev/production",
      "Le site de démonstration, branché sur le backend de démonstration du moteur.",
      "Le projet Vercel de la démonstration ; le service Cloud Run du moteur.",
      "Lancer `bun run dev:engine` ; scripts `dev:diasporale`, `dev:convex`.",
      "Captures : `en-ligne-fil-390.jpg`, `3-file-ordinaire-390.jpg` ; dossier `fils-mobiles-2026-10-18/`.",
      "Version servie : `diasporale-0000000-antsia-1111111-demo` (front et moteur).",
      "`CONVEX_URL` : l'adresse du backend ; CONVEX_DEPLOYMENT=<déploiement> ; --scope $VERCEL_SCOPE ; --project <projet>",
      "const vercelEnv = { VERCEL_ORG_ID: envRef(SHARED_VARIABLE_NAMES.orgId), CONVEX_URL: process.env.CONVEX_URL }",
      "Écrire à contact@organisation-fictive.ga, dpo@organisation.example ou prenom@exemple.org.",
      '"packageManager": "bun@1.4.2"',
    ].join("\n")
    expect(detectDeploymentIdentifiers(healthy)).toEqual([])
  })
})
