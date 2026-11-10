/**
 * Le retour d'un échec d'IDN à la porte (EA-02). Quand la connexion n'aboutit pas, le moteur
 * renvoie la personne à `/entrer` avec un code d'erreur dans l'adresse (`?error=…`, posé par
 * Better Auth). Cette fonction PURE le lit en un refus FERMÉ de DIASPORALE, traduit par
 * `errors.<code>` : jamais la phrase du serveur ni sa description (`error_description`) à l'écran.
 *
 * `idnReturnRefusal` n'a aucune dépendance cliente : la page serveur `/entrer` la lit avant le
 * rendu. La porte retire ensuite le code de l'adresse (`forgetIdnReturnError`).
 */
import type { EntryDoorsErrorCode } from "@diasporale/features/data"

/** Refus ou abandon chez IDN (codes OpenID Connect d'une autorisation non donnée). */
const REFUSED = new Set(["access_denied", "login_required", "consent_required", "interaction_required", "account_selection_required"])

/** IDN ou le moteur momentanément indisponibles (code du moteur, code OpenID Connect). */
const UNAVAILABLE = new Set(["idnUnavailable", "temporarily_unavailable"])

/** Une adresse e-mail qui a déjà son compte par code : le moteur ne relie jamais d'office (liaison explicite). */
const ACCOUNT_EXISTS = new Set(["account_not_linked"])

/** Au-delà, ce n'est plus un code d'erreur : rien n'est lu. */
const MAX_CODE_LENGTH = 120

/** Les paramètres que le retour d'un échec pose dans l'adresse (Better Auth). */
const RETURN_ERROR_PARAMS = ["error", "error_description"] as const

/**
 * Le refus à dire à la porte, ou `null` sans erreur lisible. Une valeur répétée (tableau), vide
 * ou démesurée ne dit rien ; tout autre code devient l'échec générique `idn_failed`.
 */
export function idnReturnRefusal(raw: unknown): EntryDoorsErrorCode | null {
  if (typeof raw !== "string") return null
  const code = raw.trim()
  if (code.length === 0 || code.length > MAX_CODE_LENGTH) return null
  if (REFUSED.has(code)) return "idn_refused"
  if (UNAVAILABLE.has(code)) return "idn_unavailable"
  if (ACCOUNT_EXISTS.has(code)) return "idn_account_exists"
  return "idn_failed"
}

/**
 * Retire de l'adresse affichée le code d'échec du retour (et sa description), sans recharger ni
 * toucher aux autres paramètres : un rechargement ou un lien copié ne redit pas l'échec.
 * Navigateur seulement.
 */
export function forgetIdnReturnError(): void {
  const url = new URL(window.location.href)
  if (!RETURN_ERROR_PARAMS.some((name) => url.searchParams.has(name))) return
  for (const name of RETURN_ERROR_PARAMS) url.searchParams.delete(name)
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
}
