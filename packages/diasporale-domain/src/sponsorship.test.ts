import { describe, expect, test } from "bun:test"
import {
  SPONSORSHIPS_PER_WINDOW,
  SPONSOR_MIN_VERIFIED_DAYS,
  checkSponsorship,
  checkSponsorshipRevocation,
  countsInSponsorshipWindow,
  remainingSponsorships,
  sponsorSeniorityReachedAt,
  sponsorshipWindowStart,
  type SponsorFacts,
  type SponsorshipTargetFacts,
} from "./sponsorship"
import { DAY_MS } from "./time"

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)
const SENIOR: SponsorFacts = { status: "verifiee", verifiedSince: NOW - 31 * DAY_MS, sponsorshipsInWindow: 0 }
const PENDING_TARGET: SponsorshipTargetFacts = { isSelf: false, status: "en_attente", alreadySponsored: false }

describe("checkSponsorship — arbitrage A3", () => {
  test("un parrain vérifié depuis plus de 30 jours admet un compte en attente (R3)", () => {
    expect(checkSponsorship(SENIOR, PENDING_TARGET, NOW)).toEqual({ ok: true, value: true })
  })

  test("une identité IDN déclarée peut aussi être parrainée (elle peut devenir vérifiée)", () => {
    expect(checkSponsorship(SENIOR, { ...PENDING_TARGET, status: "declaree" }, NOW).ok).toBe(true)
  })

  test("le parrain doit être vérifié", () => {
    for (const status of ["en_attente", "declaree", "suspendue", "partie"] as const) {
      expect(checkSponsorship({ ...SENIOR, status }, PENDING_TARGET, NOW)).toEqual({ ok: false, code: "sponsor_not_verified" })
    }
    const { verifiedSince: _ignored, ...withoutDate } = SENIOR
    expect(checkSponsorship(withoutDate, PENDING_TARGET, NOW)).toEqual({ ok: false, code: "sponsor_not_verified" })
  })

  test("« depuis plus de 30 jours » : 30 jours pile ne suffisent pas, 30 jours et une milliseconde oui", () => {
    const exactly = { ...SENIOR, verifiedSince: NOW - SPONSOR_MIN_VERIFIED_DAYS * DAY_MS }
    expect(checkSponsorship(exactly, PENDING_TARGET, NOW)).toEqual({ ok: false, code: "sponsor_too_recent" })
    const justAfter = { ...SENIOR, verifiedSince: NOW - SPONSOR_MIN_VERIFIED_DAYS * DAY_MS - 1 }
    expect(checkSponsorship(justAfter, PENDING_TARGET, NOW).ok).toBe(true)
    expect(sponsorSeniorityReachedAt(0)).toBe(SPONSOR_MIN_VERIFIED_DAYS * DAY_MS)
  })

  test("dix parrainages par fenêtre : le onzième est refusé", () => {
    const nine = { ...SENIOR, sponsorshipsInWindow: SPONSORSHIPS_PER_WINDOW - 1 }
    expect(checkSponsorship(nine, PENDING_TARGET, NOW).ok).toBe(true)
    const ten = { ...SENIOR, sponsorshipsInWindow: SPONSORSHIPS_PER_WINDOW }
    expect(checkSponsorship(ten, PENDING_TARGET, NOW)).toEqual({ ok: false, code: "sponsor_quota_reached" })
  })

  test("on ne se parraine pas soi-même", () => {
    expect(checkSponsorship(SENIOR, { ...PENDING_TARGET, isSelf: true }, NOW)).toEqual({ ok: false, code: "self_sponsorship" })
  })

  test("refus INDISTINCT pour tout ce qui tient à la cible", () => {
    const refusals = [
      { ...PENDING_TARGET, status: "verifiee" as const },
      { ...PENDING_TARGET, status: "suspendue" as const },
      { ...PENDING_TARGET, status: "partie" as const },
      { ...PENDING_TARGET, alreadySponsored: true },
    ].map((target) => checkSponsorship(SENIOR, target, NOW))
    for (const refusal of refusals) expect(refusal).toEqual({ ok: false, code: "target_not_eligible" })
  })

  test("le parrain apprend ce qui le concerne AVANT tout ce qui concerne la cible", () => {
    const recent = { ...SENIOR, verifiedSince: NOW - DAY_MS }
    expect(checkSponsorship(recent, { ...PENDING_TARGET, status: "suspendue" }, NOW)).toEqual({
      ok: false,
      code: "sponsor_too_recent",
    })
  })
})

describe("quota et fenêtre glissante", () => {
  test("parrainages restants", () => {
    expect(remainingSponsorships(0)).toBe(10)
    expect(remainingSponsorships(3)).toBe(7)
    expect(remainingSponsorships(10)).toBe(0)
    expect(remainingSponsorships(12)).toBe(0)
    expect(remainingSponsorships(-4)).toBe(10)
    expect(remainingSponsorships(2.9)).toBe(8)
  })

  test("bornes de la fenêtre de 30 jours", () => {
    const start = sponsorshipWindowStart(NOW)
    expect(start).toBe(NOW - 30 * DAY_MS)
    expect(countsInSponsorshipWindow(start, NOW)).toBe(false)
    expect(countsInSponsorshipWindow(start + 1, NOW)).toBe(true)
    expect(countsInSponsorshipWindow(NOW, NOW)).toBe(true)
    expect(countsInSponsorshipWindow(NOW + 1, NOW)).toBe(false)
  })
})

describe("retrait d'un parrainage", () => {
  test("le parrain ou la modération retirent ; personne d'autre", () => {
    expect(checkSponsorshipRevocation({ actor: "sponsor", revokedAt: null })).toEqual({ ok: true, value: true })
    expect(checkSponsorshipRevocation({ actor: "moderator", revokedAt: null })).toEqual({ ok: true, value: true })
    expect(checkSponsorshipRevocation({ actor: "other", revokedAt: null })).toEqual({ ok: false, code: "not_allowed" })
  })

  test("un parrainage ne se retire qu'une fois (journal sans doublon)", () => {
    expect(checkSponsorshipRevocation({ actor: "sponsor", revokedAt: NOW })).toEqual({ ok: false, code: "already_revoked" })
  })
})
