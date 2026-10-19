/**
 * Handle (`@prenom.nom`) — règle PROVISOIRE côté interface, miroir exact de
 * `assertHandle` du domaine social du socle (reseauPersonnel/domain.ts @ ad2e7fdc2 :
 * 3 à 30 caractères, lettres non accentuées, chiffres, point, tiret, souligné).
 * La règle qui fait foi est celle du moteur (`@antsia/social-domain`, PA2) :
 * au câblage PD2, ce fichier importe la sienne et disparaît.
 */
export const HANDLE_MIN_LENGTH = 3
export const HANDLE_MAX_LENGTH = 30
const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase()
}

export const HANDLE_REFUSALS = ["handle_length", "handle_charset"] as const
export type HandleRefusal = (typeof HANDLE_REFUSALS)[number]

export function handleRefusal(raw: string): HandleRefusal | null {
  const handle = normalizeHandle(raw)
  if (handle.length < HANDLE_MIN_LENGTH || handle.length > HANDLE_MAX_LENGTH) return "handle_length"
  if (!HANDLE_PATTERN.test(handle)) return "handle_charset"
  return null
}

/** `Jean-Pierre` → `jeanpierre` ; `NZÉ` → `nze` (même translittération que le socle). */
export function handleToken(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

/**
 * Propositions `prenom.nom` et `nom.prenom`, dans cet ordre, SANS
 * pré-sélection (décision du socle : la plateforme ne choisit pas l'ordre).
 */
export function suggestHandles(firstName: string, lastName: string): string[] {
  const first = handleToken(firstName.split(/\s+/)[0] ?? "")
  const last = handleToken(lastName)
  const candidates = [
    first && last ? `${first}.${last}` : "",
    first && last ? `${last}.${first}` : "",
    first || last,
  ]
  return [...new Set(candidates)].filter((candidate) => handleRefusal(candidate) === null)
}

/** Sépare un nom affiché en prénom / nom pour les propositions (premier mot / reste). */
export function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") }
}
