/**
 * Teinte d'avatar stable par personne — l'une des six teintes de la charte
 * (`--esp-ava-1…6`), choisie par l'identifiant, jamais par le nom : changer de
 * nom affiché ne change pas de couleur.
 */
export const AVATAR_TONES = 6

export function avatarTone(id: string): number {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0
  }
  return (Math.abs(hash) % AVATAR_TONES) + 1
}

/** Initiales d'un nom affiché : deux lettres au plus, capitales, accents conservés. */
export function initials(displayName: string): string {
  const parts = displayName
    .trim()
    .split(/[\s\-’']+/)
    .filter((part) => part.length > 0)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return `${first}${last}`.toLocaleUpperCase()
}
