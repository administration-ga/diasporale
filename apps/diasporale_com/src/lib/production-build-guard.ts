/**
 * Garde de construction de diasporale.com (LX-01) : aucune construction de
 * production ne sert la démonstration en silence. `next.config.ts` l'appelle à la
 * phase de construction (`next build`) ; le développement (`next dev`) n'est pas
 * concerné.
 *
 * La règle :
 *  1. toute construction déclare sa source : `engine` ou `demo`, rien d'autre ;
 *     absente ou inconnue, la construction échoue ;
 *  2. la source `engine` exige l'adresse du moteur (`NEXT_PUBLIC_CONVEX_URL`) ;
 *  3. une construction destinée à un domaine public (`NEXT_PUBLIC_SITE_URL` hors de
 *     `localhost`, `127.0.0.1`, `[::1]`, `*.localhost` et `*.test`) sert le moteur, et
 *     porte sa version (`NEXT_PUBLIC_BUILD_SHA`) pour que la sonde la dise ;
 *  4. ailleurs, une version absente se signale sans bloquer : la sonde dira « dev ».
 *
 * Les messages nomment les variables, jamais leur valeur : le journal de construction
 * ne recopie ni adresse de déploiement ni secret.
 */
import { DATA_SOURCE_VARIABLE, parseDataSource } from "./data-source"

export type ProductionBuildEnv = {
  readonly dataSource: string | undefined
  readonly convexUrl: string | undefined
  readonly siteUrl: string | undefined
  readonly buildSha: string | undefined
}

export type ProductionBuildVerdict = {
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
}

/** Noms d'hôte d'un poste de développement ; tout le reste est un domaine public. */
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"])
const LOCAL_SUFFIXES = [".localhost", ".test"] as const

const present = (value: string | undefined): boolean => Boolean(value?.trim())

/**
 * `true` si l'adresse du site désigne un domaine public. Sans adresse, aucun domaine
 * n'est visé ; une adresse illisible compte comme publique (la garde se ferme).
 */
export function isPublicSiteUrl(siteUrl: string | undefined): boolean {
  const address = siteUrl?.trim()
  if (!address) return false
  let hostname: string
  try {
    hostname = new URL(address).hostname.toLowerCase()
  } catch {
    return true
  }
  if (LOCAL_HOSTNAMES.has(hostname)) return false
  return !LOCAL_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
}

/** Le verdict de la garde, sans effet : les erreurs bloquent, les avertissements se lisent. */
export function checkProductionBuild(env: ProductionBuildEnv): ProductionBuildVerdict {
  const errors: string[] = []
  const warnings: string[] = []
  const source = parseDataSource(env.dataSource)
  const publicSite = isPublicSiteUrl(env.siteUrl)

  if (source === null) {
    errors.push(
      `${DATA_SOURCE_VARIABLE} doit valoir « engine » (le moteur ANTSIA) ou « demo » (données fictives) : ` +
        "une construction déclare sa source et ne sert jamais la démonstration par défaut.",
    )
  }
  if (source === "engine" && !present(env.convexUrl)) {
    errors.push("NEXT_PUBLIC_CONVEX_URL manque : la source « engine » exige l'adresse du moteur ANTSIA.")
  }
  if (source === "demo" && publicSite) {
    errors.push(
      `${DATA_SOURCE_VARIABLE} vaut « demo » alors que NEXT_PUBLIC_SITE_URL désigne un domaine public : ` +
        "un site public sert le moteur, jamais les données fictives.",
    )
  }
  if (!present(env.buildSha)) {
    const message = "NEXT_PUBLIC_BUILD_SHA manque : la sonde de santé dira la version « dev »."
    if (publicSite) errors.push(`${message} Un domaine public porte la version construite.`)
    else warnings.push(message)
  }
  return { errors, warnings }
}

/** Applique la garde : signale les avertissements, puis refuse la construction s'il y a une erreur. */
export function assertProductionBuild(env: ProductionBuildEnv, warn: (message: string) => void = console.warn): void {
  const { errors, warnings } = checkProductionBuild(env)
  for (const warning of warnings) warn(`diasporale.com — ${warning}`)
  if (errors.length > 0) {
    throw new Error(`Construction de diasporale.com refusée :\n${errors.map((error) => `  - ${error}`).join("\n")}`)
  }
}
