/**
 * Reconnaître une erreur de chargement de fichier : après une publication du site,
 * l'onglet resté ouvert demande des fragments de l'ancienne version, que le serveur
 * ne sert plus. Rien n'est cassé : recharger la page suffit. La page d'erreur le dit
 * (« nouvelle version disponible ») au lieu d'un incident.
 *
 * Formes reconnues :
 *  · Turbopack et webpack nomment l'erreur `ChunkLoadError` (« Failed to load chunk… »,
 *    « Loading chunk 12 failed. », « Loading CSS chunk 12 failed. ») ;
 *  · un import dynamique natif qui échoue : Chrome (« Failed to fetch dynamically
 *    imported module »), Firefox (« error loading dynamically imported module »),
 *    Safari (« Importing a module script failed »).
 * Module pur : aucune dépendance au navigateur. Le message n'est jamais affiché.
 */
const CHUNK_LOAD_ERROR = "ChunkLoadError"

const STALE_BUILD_MESSAGES: readonly RegExp[] = [
  /failed to load chunk/i,
  /loading (?:css )?chunk \S+ failed/i,
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
]

/** Profondeur bornée : une cause qui se cite elle-même ne boucle pas. */
const MAX_CAUSE_DEPTH = 3

function readString(value: unknown, key: "name" | "message"): string | null {
  if (typeof value !== "object" || value === null) return null
  const field = (value as Record<string, unknown>)[key]
  return typeof field === "string" ? field : null
}

export function isStaleBuildError(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH && typeof current === "object" && current !== null; depth += 1) {
    if (readString(current, "name") === CHUNK_LOAD_ERROR) return true
    const message = readString(current, "message")
    if (message !== null && STALE_BUILD_MESSAGES.some((pattern) => pattern.test(message))) return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}
