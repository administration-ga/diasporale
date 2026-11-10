/**
 * Santé FONCTIONNELLE de diasporale.com (LX-01) : la sonde `/api/sante-fonctionnelle`
 * et la page `/sante-fonctionnelle` lisent ce même rapport.
 *
 * Il reprend celui des applications du moteur (`computeHealth` : état, application,
 * version construite, moteur configuré) et ajoute la source de données réellement
 * servie, puis l'état du moteur : avec la source `engine`, la sonde JOINT le moteur
 * (fonction `ping` de `convex/health.ts`, bornée à 2 s) ; sans réponse, l'état est
 * `degraded` (HTTP 503). Avec la source `demo`, le moteur n'est pas interrogé : le site sert ses données
 * fictives, et le dit.
 *
 * Le rapport ne contient ni adresse de déploiement, ni secret, ni donnée personnelle :
 * une erreur du client Convex peut citer l'adresse du moteur, elle n'est jamais recopiée.
 */
import { computeHealth, type HealthReport } from "@antsia/api/health"
import { api } from "@convex/_generated/api"
import { ConvexHttpClient } from "convex/browser"

import { resolveDataSource, type DataSourceKind } from "./data-source"

/** Le nom de l'application dans le rapport (celui du catalogue de publication du moteur). */
export const HEALTH_APPLICATION = "diasporale-com"

/** Délai au-delà duquel le moteur est dit injoignable (même borne que la sonde du moteur, EX-03). */
export const ENGINE_PING_TIMEOUT_MS = 2_000

/** `not_checked` : source `demo`, ou adresse du moteur absente. */
export type EngineReach = "reachable" | "unreachable" | "not_checked"

export type FunctionalHealthReport = HealthReport & {
  readonly dataSource: DataSourceKind
  readonly engine: EngineReach
}

export type FunctionalHealthEnv = {
  readonly dataSource: string | undefined
  readonly convexUrl: string | undefined
  readonly buildSha: string | undefined
}

const present = (value: string | undefined): string | undefined => value?.trim() || undefined

/** La réponse de la sonde du moteur : un objet d'état `ok` (des champs ajoutés plus tard sont admis). */
function isPong(value: unknown): boolean {
  return typeof value === "object" && value !== null && (value as { status?: unknown }).status === "ok"
}

/**
 * Joint le moteur par sa sonde publique (`ping`), sans session ni réseau. `true`
 * seulement si le moteur répond `ok` dans le délai ; la requête est interrompue au-delà.
 */
export async function pingEngine(convexUrl: string, timeoutMs: number = ENGINE_PING_TIMEOUT_MS): Promise<boolean> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error("engineTimeout"))
    }, timeoutMs)
  })
  try {
    // Requête bornée et jamais mise en cache : la sonde décrit le moteur de l'instant.
    const boundedFetch: typeof globalThis.fetch = (input, init) => fetch(input, { ...init, cache: "no-store", signal: controller.signal })
    const client = new ConvexHttpClient(convexUrl, { fetch: boundedFetch })
    return isPong(await Promise.race([client.query(api.health.ping, {}), deadline]))
  } catch {
    // Jamais le message : il peut citer l'adresse du déploiement.
    return false
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** Le rapport de santé pour un environnement donné ; `ping` se remplace dans les tests. */
export async function readFunctionalHealth(
  env: FunctionalHealthEnv,
  ping: (convexUrl: string) => Promise<boolean> = pingEngine,
): Promise<FunctionalHealthReport> {
  const dataSource = resolveDataSource(env.dataSource)
  const convexUrl = present(env.convexUrl)
  const base = computeHealth({ NEXT_PUBLIC_CONVEX_URL: convexUrl, NEXT_PUBLIC_BUILD_SHA: present(env.buildSha) }, HEALTH_APPLICATION)
  if (dataSource === "demo") return { ...base, status: "ok", dataSource, engine: "not_checked" }
  if (!convexUrl) return { ...base, status: "degraded", dataSource, engine: "not_checked" }
  const reachable = await ping(convexUrl)
  return { ...base, status: reachable ? "ok" : "degraded", dataSource, engine: reachable ? "reachable" : "unreachable" }
}

/**
 * Le rapport du service qui répond. Références LITTÉRALES : Next les inscrit à la
 * construction (jamais `process.env` entier) ; la source se résout comme pour le choix
 * des fournisseurs (`publicEnv.dataSource`).
 */
export function currentFunctionalHealth(): Promise<FunctionalHealthReport> {
  return readFunctionalHealth({
    dataSource: process.env.NEXT_PUBLIC_DIASPORALE_DATA_SOURCE,
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
    buildSha: process.env.NEXT_PUBLIC_BUILD_SHA,
  })
}

/** Le code HTTP de la sonde : 503 dès que le service ne peut pas servir ses données. */
export function healthHttpStatus(report: FunctionalHealthReport): 200 | 503 {
  return report.status === "ok" ? 200 : 503
}
