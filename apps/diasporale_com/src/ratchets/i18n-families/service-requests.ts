/**
 * Familles de clés DYNAMIQUES du chantier « demandes et rendez-vous (DG-014/015) »,
 * énumérées depuis les constantes du domaine qui les pilotent. PROPRIÉTAIRE : ce chantier.
 * Une clé citée en toutes lettres n'a rien à faire ici ; les `errors.<code>` sont
 * couverts par les codes fermés (`SERVICE_REQUEST_ERROR_CODES`).
 */
import { SERVICE_BOOKING_STATUSES, SERVICE_REQUEST_STATUSES } from "@diasporale/domain"

export const FAMILIES: readonly string[] = [
  ...SERVICE_REQUEST_STATUSES.flatMap((status) => [`serviceRequests.status.${status}`, `serviceRequests.timeline.${status}`]),
  ...SERVICE_BOOKING_STATUSES.map((status) => `serviceRequests.bookingStatus.${status}`),
]
