/**
 * Parrainage (EXF-DG-04) — un membre vérifié admet un compte en attente.
 *
 * Arbitrage A3, valeurs par défaut retenues (cahier §6.2 et §20) :
 *   · un parrain est `verifiee` depuis PLUS de 30 jours ;
 *   · dix parrainages par parrain et par mois — compté sur une fenêtre
 *     GLISSANTE de 30 jours, indépendante des fuseaux horaires ;
 *   · le parrainage se retire (journal conservé).
 *
 * Les refus qui tiennent à la CIBLE se confondent en un seul code
 * (`target_not_eligible`) : parrainer ne doit rien apprendre du statut d'un
 * autre membre (refus indistinct, cahier §12.6).
 */
import type { MembershipStatus } from "./eligibility"
import { ok, refuse, type Result } from "./result"
import { DAY_MS } from "./time"

export const SPONSOR_MIN_VERIFIED_DAYS = 30
export const SPONSORSHIPS_PER_WINDOW = 10
export const SPONSORSHIP_WINDOW_DAYS = 30

export interface SponsorFacts {
  readonly status: MembershipStatus
  /** Depuis quand le parrain est `verifiee` (ms UTC) ; absent s'il ne l'est pas. */
  readonly verifiedSince?: number
  /**
   * Parrainages CRÉÉS par ce parrain dans la fenêtre glissante, retirés
   * compris : retirer puis recommencer ne doit pas contourner le quota.
   */
  readonly sponsorshipsInWindow: number
}

export interface SponsorshipTargetFacts {
  readonly isSelf: boolean
  readonly status: MembershipStatus
  readonly alreadySponsored: boolean
}

export const SPONSORSHIP_REFUSALS = [
  "sponsor_not_verified",
  "sponsor_too_recent",
  "sponsor_quota_reached",
  "self_sponsorship",
  "target_not_eligible",
] as const
export type SponsorshipRefusal = (typeof SPONSORSHIP_REFUSALS)[number]

/** Statuts d'une cible admissible : en attente, ou déclarée (IDN qui devient vérifiée). */
const SPONSORABLE_STATUSES: ReadonlySet<MembershipStatus> = new Set(["en_attente", "declaree"])

export function sponsorSeniorityReachedAt(verifiedSince: number): number {
  return verifiedSince + SPONSOR_MIN_VERIFIED_DAYS * DAY_MS
}

/**
 * Peut-on parrainer ? Le parrain d'abord (statut, ancienneté, quota), la cible
 * ensuite — dans cet ordre, pour que le parrain sache toujours ce qui le
 * concerne avant d'apprendre quoi que ce soit (rien, en fait) sur la cible.
 */
export function checkSponsorship(
  sponsor: SponsorFacts,
  target: SponsorshipTargetFacts,
  now: number,
): Result<true, SponsorshipRefusal> {
  if (sponsor.status !== "verifiee" || sponsor.verifiedSince === undefined) {
    return refuse("sponsor_not_verified")
  }
  if (now <= sponsorSeniorityReachedAt(sponsor.verifiedSince)) return refuse("sponsor_too_recent")
  if (sponsor.sponsorshipsInWindow >= SPONSORSHIPS_PER_WINDOW) return refuse("sponsor_quota_reached")
  if (target.isSelf) return refuse("self_sponsorship")
  if (!SPONSORABLE_STATUSES.has(target.status) || target.alreadySponsored) {
    return refuse("target_not_eligible")
  }
  return ok(true)
}

/** Parrainages encore possibles dans la fenêtre — affiché au parrain (« 3 sur 10 »). */
export function remainingSponsorships(sponsorshipsInWindow: number): number {
  return Math.max(0, SPONSORSHIPS_PER_WINDOW - Math.max(0, Math.trunc(sponsorshipsInWindow)))
}

/** Début de la fenêtre glissante à compter depuis `now`. */
export function sponsorshipWindowStart(now: number): number {
  return now - SPONSORSHIP_WINDOW_DAYS * DAY_MS
}

/** Un parrainage créé à `createdAt` compte-t-il encore dans le quota ? */
export function countsInSponsorshipWindow(createdAt: number, now: number): boolean {
  return createdAt > sponsorshipWindowStart(now) && createdAt <= now
}

export const SPONSORSHIP_REVOCATION_REFUSALS = ["not_allowed", "already_revoked"] as const
export type SponsorshipRevocationRefusal = (typeof SPONSORSHIP_REVOCATION_REFUSALS)[number]

/**
 * Qui peut retirer un parrainage : le parrain lui-même (« retrait possible »)
 * ou la modération. Le retrait d'un parrainage déjà retiré est refusé, pour
 * que le journal ne porte jamais deux retraits du même acte.
 */
export function checkSponsorshipRevocation(input: {
  readonly actor: "sponsor" | "moderator" | "other"
  readonly revokedAt: number | null
}): Result<true, SponsorshipRevocationRefusal> {
  if (input.actor === "other") return refuse("not_allowed")
  if (input.revokedAt !== null) return refuse("already_revoked")
  return ok(true)
}
