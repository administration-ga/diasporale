import { routes } from "@/lib/routes"
import { OFFLINE_CACHE_PREFIX, SERVICE_WORKER_RETIRED } from "@/lib/service-worker"
import { serviceWorkerConfiguration } from "@/lib/service-worker-configuration"
import { retiredServiceWorkerScript, serviceWorkerScript } from "@/lib/service-worker-script"

/**
 * Le script de fond UNIQUE du site (MO-05), servi à chaque demande et jamais mis en cache par le
 * navigateur : une nouvelle version est vue dès la visite suivante. Portée : tout le site. Retiré
 * (`SERVICE_WORKER_RETIRED`), la même adresse sert le script qui efface ses réserves et se
 * désinscrit.
 */
export function GET() {
  const script = SERVICE_WORKER_RETIRED
    ? retiredServiceWorkerScript({ cachePrefix: OFFLINE_CACHE_PREFIX })
    : serviceWorkerScript(serviceWorkerConfiguration())
  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "Service-Worker-Allowed": routes.home(),
    },
  })
}
