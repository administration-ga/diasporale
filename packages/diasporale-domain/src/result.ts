/**
 * Résultat d'une règle de domaine : une valeur, ou un code de refus FERMÉ.
 *
 * Le domaine ne parle pas à l'utilisateur : il rend des CODES, que
 * l'interface traduit (locales `diasporale`) et que le moteur convertit en
 * `ConvexError` à son bord. Aucune phrase française ne vit ici — c'est ce
 * qui permet de servir le français et l'anglais depuis les mêmes règles.
 */
export type Ok<T> = { readonly ok: true; readonly value: T }
export type Refused<C extends string> = { readonly ok: false; readonly code: C }
export type Result<T, C extends string> = Ok<T> | Refused<C>

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

export function refuse<C extends string>(code: C): Refused<C> {
  return { ok: false, code }
}

/**
 * Violation levée par `unwrap` : utile au bord (fonction Convex, action de
 * formulaire) quand un refus doit interrompre le traitement. Le message EST
 * le code — jamais un texte destiné à l'écran.
 */
export class DiasporaleViolation extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = "DiasporaleViolation"
  }
}

export function unwrap<T, C extends string>(result: Result<T, C>): T {
  if (result.ok) return result.value
  throw new DiasporaleViolation(result.code)
}
