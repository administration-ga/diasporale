"use client"

/**
 * L'entrée par IDN de DIASPORALE, branchée sur le moteur ANTSIA (EA-02).
 *
 * - Les portes : la configuration PUBLIQUE de l'authentification du moteur
 *   (`platform/authentication.configuration`, sans secret ni compte) dit ce que le déploiement
 *   sait servir ; la porte n'active que celles-là.
 * - Le départ : le client d'authentification du moteur (fournisseur `idn`), avec le client IDN
 *   CENTRAL du moteur (décision 2 du plan 01) — l'écran d'IDN nomme donc ANTSIA, et la porte le
 *   dit avant le départ. Retour sur `/bienvenue` de CETTE origine, sans aucun paramètre ; un
 *   échec revient à `/entrer` (`lib/idn-return.ts` le lit). La page demandée avant la connexion
 *   (UX-02, MO-03) reste dans l'onglet et survit à l'aller-retour : elle n'est jamais recopiée
 *   dans l'adresse.
 * - Le retour : IDN rappelle le moteur sur son adresse centrale, le moteur scelle la session
 *   puis renvoie ici avec un jeton à usage unique (`?ott=`), que l'amorce commune du moteur
 *   adopte et retire de l'adresse (`StableConvexBetterAuthProvider`, monté par
 *   `engine-providers.tsx`). La garde de l'accueil mène alors un membre à la page demandée,
 *   sinon à son fil, et un compte sans adhésion à l'accueil.
 *   Point d'accroche d'EA-03 (relecture du statut quand l'identité change) : ce retour est une
 *   ouverture de session ordinaire sur `/bienvenue` ; le composant d'EA-03 s'y branche sans rien
 *   savoir d'IDN.
 * - Aucun nom civil ne part ni ne revient par ici : le moteur ne recopie aucun état civil.
 */
import { api } from "@convex/_generated/api"
import type { ActionErrorCode, ActionResult, EntryDoorsView, Loadable } from "@diasporale/features/data"

import { routes } from "@/lib/routes"

import type { AuthError } from "./engine-errors"
import { type EngineSourceDeps, failed, LOADING, ready, useLoaded } from "./engine-kit"

/** Le fournisseur IDN déclaré par le moteur (`genericOAuth`, client central). */
export const IDN_PROVIDER_ID = "idn"

/** Ce que la configuration publique du moteur dit des portes, réduit à ce que la porte lit. */
export function toEntryDoorsView(configuration: { readonly idn: boolean; readonly emailOtp: boolean }): EntryDoorsView {
  return { idn: configuration.idn === true, emailCode: configuration.emailOtp === true }
}

/** Les portes ouvertes de ce déploiement, lues sans session (projection publique du moteur). */
export function useEngineEntryDoors(): Loadable<EntryDoorsView> {
  const configuration = useLoaded(api.modules.platform.authentication.configuration, {})
  if (configuration.state === "error") return failed(configuration.code)
  return configuration.state === "ready" ? ready(toEntryDoorsView(configuration.value)) : LOADING
}

/** Le refus FERMÉ d'un départ vers IDN : débit, sinon IDN indisponible (configuration, origine, fournisseur). */
export function idnStartErrorCode(error: AuthError): ActionErrorCode {
  return error?.status === 429 || error?.code === "rateLimited" ? "rate_limited" : "idn_unavailable"
}

/** Une adresse de CETTE origine : le moteur y renvoie la personne, quel que soit son site principal. */
function here(path: string): string {
  return new URL(path, window.location.origin).href
}

/**
 * Part chez IDN. `ok` : le client du moteur a reçu l'adresse d'IDN et y mène le navigateur ;
 * sinon, un refus fermé, et la personne reste sur la porte.
 */
export async function startIdnSignIn(deps: Pick<EngineSourceDeps, "authClient">): Promise<ActionResult> {
  if (typeof window === "undefined") return { ok: false, code: "idn_unavailable" }
  try {
    const started = (await deps.authClient.signIn.oauth2({
      providerId: IDN_PROVIDER_ID,
      callbackURL: here(routes.welcome()),
      errorCallbackURL: here(routes.enter()),
    })) as { readonly data?: unknown; readonly error?: AuthError }
    if (started.error) return { ok: false, code: idnStartErrorCode(started.error) }
    const data = started.data
    const leaves = typeof data === "object" && data !== null && "url" in data && typeof data.url === "string" && "redirect" in data && data.redirect === true
    return leaves ? { ok: true, value: null } : { ok: false, code: "idn_unavailable" }
  } catch {
    return { ok: false, code: "network_unavailable" }
  }
}
