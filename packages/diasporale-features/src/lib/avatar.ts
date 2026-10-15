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

/**
 * Initiales d'un nom affiché : deux lettres au plus, capitales, accents
 * conservés. Une mention entre parenthèses (« (démo) ») et les mots sans lettre
 * ne comptent pas : « Association d'exemple (démo) » donne « AE », pas « A( ».
 */
export function initials(displayName: string): string {
  const letters = displayName
    .replace(/\([^)]*\)/g, " ")
    .split(/[\s\-’']+/)
    .map((part) => /\p{L}/u.exec(part)?.[0])
    .filter((letter): letter is string => letter !== undefined)
  const first = letters[0] ?? ""
  const last = letters.length > 1 ? (letters[letters.length - 1] ?? "") : ""
  return `${first}${last}`.toLocaleUpperCase()
}
