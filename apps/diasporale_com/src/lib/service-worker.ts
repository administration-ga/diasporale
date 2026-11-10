/**
 * Le script de fond UNIQUE de diasporale.com (MO-05), côté pages : sa version, le nom de sa seule
 * réserve, son inscription, son retrait propre, et la purge de ses réserves à la sortie partout.
 *
 *  · Un site n'a qu'un script de fond : DS-14 (notifications du navigateur) et MO-06 écriront
 *    dans CE script (`service-worker-script.ts`), servi à la même adresse (`routes.serviceWorker`).
 *  · Sa seule réserve est la page hors-ligne : aucune réponse du moteur, aucun contenu social,
 *    aucune image de membre, aucune donnée de session.
 *  · Mise à jour sans rechargement forcé : le navigateur relit le script à chaque visite
 *    (`updateViaCache: "none"`, `Cache-Control: no-store`) ; une nouvelle version prend la main
 *    d'elle-même, et aucune page n'est rechargée de force (rien d'autre n'est en réserve).
 */
import { routes } from "./routes"

/** À relever à chaque changement de la logique ou de la réserve du script : nouvelle réserve, l'ancienne est effacée. */
export const SERVICE_WORKER_VERSION = 1

/** Préfixe des réserves du script : seules celles-ci sont créées, purgées et effacées. */
export const OFFLINE_CACHE_PREFIX = "diasporale-hors-ligne-v"

export function offlineCacheName(version: number = SERVICE_WORKER_VERSION): string {
  return `${OFFLINE_CACHE_PREFIX}${version}`
}

/**
 * Retrait propre : passer à `true`, puis publier. La route sert alors un script qui efface ses
 * réserves et se désinscrit lui-même, et les pages désinscrivent l'ancien sans en inscrire de
 * nouveau. Laisser ensuite la route en place le temps que les appareils l'aient relue.
 */
export const SERVICE_WORKER_RETIRED: boolean = false

/** La purge ne retient jamais la sortie au-delà de ce délai. */
const PURGE_TIMEOUT_MS = 2_000

export type ReserveStorage = Pick<CacheStorage, "keys" | "delete">

function browserCaches(): ReserveStorage | undefined {
  return typeof caches === "undefined" ? undefined : caches
}

/** Le navigateur peut-il porter des réserves de script de fond ? Sinon, il n'y a rien à purger. */
export function offlineReservesSupported(): boolean {
  return browserCaches() !== undefined
}

/**
 * Efface les réserves du script de fond (sortie partout, retrait). Seules celles du préfixe : le
 * reste de l'origine n'est pas touché. Ne lève jamais et ne dure jamais plus de deux secondes :
 * `true` si rien ne reste à effacer, `false` si la purge a échoué ou n'a pas fini à temps.
 */
export async function clearOfflineReserves(storage: ReserveStorage | undefined = browserCaches(), timeoutMs = PURGE_TIMEOUT_MS): Promise<boolean> {
  if (!storage) return true
  let timer: ReturnType<typeof setTimeout> | undefined
  const purge = (async () => {
    const names = await storage.keys()
    await Promise.all(names.filter((name) => name.startsWith(OFFLINE_CACHE_PREFIX)).map((name) => storage.delete(name)))
    return true
  })()
  try {
    return await Promise.race([purge, new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs) })])
  } catch {
    return false
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

export type WorkerContainer = Pick<ServiceWorkerContainer, "register" | "getRegistrations">

function browserContainer(): WorkerContainer | undefined {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator ? navigator.serviceWorker : undefined
}

/** Le script de CE site, reconnu à son adresse (jamais un autre script de l'origine). */
function isOwnRegistration(registration: ServiceWorkerRegistration): boolean {
  const worker = registration.active ?? registration.waiting ?? registration.installing
  if (!worker) return false
  try {
    return new URL(worker.scriptURL).pathname === routes.serviceWorker()
  } catch {
    return false
  }
}

export type ServiceWorkerSync = "registered" | "retired" | "unsupported" | "failed"

/**
 * Inscrit le script de fond (portée : tout le site), ou, s'il est retiré, désinscrit l'ancien et
 * efface ses réserves. Sans script de fond (navigateur ancien, adresse non sécurisée) : rien, le
 * site marche comme avant. Ne lève jamais.
 */
export async function syncServiceWorker(options: {
  readonly container?: WorkerContainer
  readonly storage?: ReserveStorage
  readonly retired?: boolean
} = {}): Promise<ServiceWorkerSync> {
  const container = options.container ?? browserContainer()
  if (!container) return "unsupported"
  try {
    if (options.retired ?? SERVICE_WORKER_RETIRED) {
      const registrations = await container.getRegistrations()
      await Promise.all(registrations.filter(isOwnRegistration).map((registration) => registration.unregister()))
      await clearOfflineReserves(options.storage ?? browserCaches())
      return "retired"
    }
    await container.register(routes.serviceWorker(), { scope: routes.home(), updateViaCache: "none" })
    return "registered"
  } catch {
    return "failed"
  }
}
