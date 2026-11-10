import { getFixedT } from "@diasporale/features/i18n"

import { routes } from "./routes"
import { OFFLINE_CACHE_PREFIX, SERVICE_WORKER_VERSION } from "./service-worker"
import type { ServiceWorkerConfiguration } from "./service-worker-script"

/** Paramètre de la future porte d'ouverture (DS-14, MO-06) ; aucune porte n'est posée par MO-05. */
const NOTIFICATION_REFERENCE_PARAM = "reference"

/**
 * La configuration du script de fond (MO-05) : textes de l'i18n (titre de la marque, phrase
 * neutre en français et en anglais), adresses de la table des routes. Aucune porte d'ouverture
 * tant que DS-14 et MO-06 ne l'ont pas posée : un clic sur une notification ouvre le fil.
 */
export function serviceWorkerConfiguration(): ServiceWorkerConfiguration {
  const fr = getFixedT("fr")
  const en = getFixedT("en")
  return {
    version: SERVICE_WORKER_VERSION,
    cachePrefix: OFFLINE_CACHE_PREFIX,
    offlinePath: routes.offline(),
    title: fr("brand.name"),
    messages: { fr: fr("installableApp.notificationBody"), en: en("installableApp.notificationBody") },
    tagPrefix: "diasporale-notification-",
    openPath: null,
    fallbackPath: routes.feed(),
    referenceParam: NOTIFICATION_REFERENCE_PARAM,
  }
}
