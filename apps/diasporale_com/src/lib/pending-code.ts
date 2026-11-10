/**
 * L'adresse en attente d'un code (EA-08, MO-04) : la personne demande un code, part le lire dans
 * sa messagerie, puis revient — après un rechargement, ou quand le téléphone a fermé l'onglet en
 * arrière-plan — sur la saisie du code, sans en redemander un.
 *
 *  · La mémoire vit dans l'onglet (`sessionStorage`), à côté de la page demandée
 *    (`return-path.ts`) : jamais dans l'adresse de la page, jamais hors du navigateur. Elle ne garde
 *    que le moyen (e-mail ou SMS), l'adresse saisie et l'heure de l'envoi — JAMAIS le code.
 *  · Elle s'efface à la connexion (garde, entrée), à la déconnexion, au changement d'adresse, et
 *    passé une échéance de confort. Le moteur ne publie pas la durée de validité du code : cette
 *    échéance n'en dit rien, et aucun texte n'en cite une ; un code échu se redemande.
 *  · Préfixe `antsia:` : la déconnexion de partout du moteur purge aussi cette clé.
 *  · Renvoyer le code attend `CODE_RESEND_DELAY_MS` après le dernier envoi, rechargement compris.
 */
import type { CodeDestination } from "@diasporale/features/data"

import { tabStorage, type TabStorage } from "./return-path"

/** Préfixe `antsia:` : la déconnexion de partout du moteur purge aussi cette clé. */
export const PENDING_CODE_KEY = "antsia:diasporale:pending-code"
/** Le temps de lire son courriel et de revenir ; au-delà, la porte repart du début. Ce n'est pas la validité du code. */
export const PENDING_CODE_TTL_MS = 30 * 60 * 1000
/** Le délai entre deux envois d'un code depuis cet onglet (même valeur que la porte du moteur). */
export const CODE_RESEND_DELAY_MS = 60 * 1000

/** Une adresse e-mail tient en 254 caractères ; un numéro, bien moins. Au-delà, l'entrée est altérée. */
const MAX_DESTINATION_LENGTH = 320

export interface PendingCode {
  readonly destination: CodeDestination
  /** L'heure du dernier envoi (ms UTC) : le délai du renvoi part d'elle. */
  readonly sentAt: number
}

/** Un caractère de contrôle ou un blanc de saut de ligne : une adresse tient sur une ligne. */
function hasControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

function parseDestination(kind: unknown, value: unknown): CodeDestination | null {
  if (kind !== "email" && kind !== "phone") return null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_DESTINATION_LENGTH || hasControl(trimmed)) return null
  return { kind, value: trimmed }
}

/** Retient l'adresse à laquelle un code vient de partir ; un stockage refusé n'empêche pas d'entrer. */
export function rememberPendingCode(
  destination: CodeDestination,
  now: number = Date.now(),
  storage: TabStorage | null = tabStorage(),
): PendingCode {
  const parsed = parseDestination(destination.kind, destination.value) ?? destination
  const pending: PendingCode = { destination: parsed, sentAt: now }
  try {
    storage?.setItem(PENDING_CODE_KEY, JSON.stringify({ kind: parsed.kind, value: parsed.value, sentAt: now }))
  } catch {
    // Stockage refusé : un rechargement ramène au début de la porte, seul le confort est perdu.
  }
  return pending
}

/** L'adresse en attente, relue et revalidée ; `null` si absente, échue ou altérée. */
export function peekPendingCode(now: number = Date.now(), storage: TabStorage | null = tabStorage()): PendingCode | null {
  try {
    const raw = storage?.getItem(PENDING_CODE_KEY)
    if (!raw) return null
    const stored: unknown = JSON.parse(raw)
    if (typeof stored !== "object" || stored === null) return null
    const { kind, value, sentAt } = stored as { readonly kind?: unknown; readonly value?: unknown; readonly sentAt?: unknown }
    if (typeof sentAt !== "number" || !Number.isFinite(sentAt) || sentAt > now || now - sentAt > PENDING_CODE_TTL_MS) return null
    const destination = parseDestination(kind, value)
    return destination === null ? null : { destination, sentAt }
  } catch {
    return null
  }
}

/** Oublie l'adresse en attente : à la connexion, à la déconnexion, au changement d'adresse. */
export function forgetPendingCode(storage: TabStorage | null = tabStorage()): void {
  try {
    storage?.removeItem(PENDING_CODE_KEY)
  } catch {
    // Rien à oublier.
  }
}

/** Les secondes à attendre avant de pouvoir renvoyer le code ; `0` quand le renvoi est ouvert. */
export function resendWaitSeconds(pending: Pick<PendingCode, "sentAt"> | null, now: number): number {
  if (pending === null) return 0
  const remaining = pending.sentAt + CODE_RESEND_DELAY_MS - now
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0
}
