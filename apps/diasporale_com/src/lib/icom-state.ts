/**
 * L'état d'iCom pour une session (PD7) — module PUR : la coque, les pages iCom
 * et le profil le lisent par `useIcomState()` (`components/icom.tsx`).
 */
import type { Id } from "@convex/_generated/dataModel"
import { DIASPORALE_NETWORK_SLUG } from "@diasporale/domain"

export interface IcomNetwork {
  readonly networkId: Id<"networks">
  readonly slug: string
  readonly personId: Id<"persons">
}

/** Pourquoi iCom est fermé : la démonstration, un membre qui ne peut pas encore écrire, ou le réseau introuvable. */
export type IcomOffReason = "demo" | "not_allowed" | "unavailable"

/** iCom pour cette session : fermé (avec sa raison), en cours de résolution, ou ouvert. */
export type IcomState =
  | { readonly status: "off"; readonly reason: IcomOffReason }
  | { readonly status: "loading" }
  | { readonly status: "on"; readonly network: IcomNetwork }

/** En démonstration, aucun fournisseur ne l'ouvre : c'est l'état par défaut. */
export const ICOM_DEMO: IcomState = { status: "off", reason: "demo" }
const NOT_ALLOWED: IcomState = { status: "off", reason: "not_allowed" }
const UNAVAILABLE: IcomState = { status: "off", reason: "unavailable" }
const LOADING: IcomState = { status: "loading" }

/**
 * L'état d'iCom, décidé dans cet ordre : la session d'abord (en attente → en
 * cours), le droit ensuite (une personne qui peut écrire), le réseau enfin (en
 * attente → en cours ; absent → introuvable).
 */
export function resolveIcomState(input: {
  readonly sessionReady: boolean
  /** La personne du membre QUI PEUT ÉCRIRE, `null` sinon (anonyme, non-membre, pas encore déclaré). */
  readonly personId: string | null
  /** `undefined` : la lecture du réseau est en cours ; `null` : réseau introuvable. */
  readonly networkId: string | null | undefined
}): IcomState {
  if (!input.sessionReady) return LOADING
  if (input.personId === null) return NOT_ALLOWED
  if (input.networkId === undefined) return LOADING
  if (input.networkId === null) return UNAVAILABLE
  return {
    status: "on",
    network: { networkId: input.networkId as Id<"networks">, slug: DIASPORALE_NETWORK_SLUG, personId: input.personId as Id<"persons"> },
  }
}
