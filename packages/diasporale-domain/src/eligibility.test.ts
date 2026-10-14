import { describe, expect, test } from "bun:test"
import {
  LIGHT_ACCOUNT_GROUNDS,
  MEMBERSHIP_STATUSES,
  MEMBER_CAPABILITIES,
  applyMembershipEvent,
  capabilitiesOf,
  deriveMembershipStatus,
  effectiveMembershipStatus,
  hasCapability,
  idnCountsAsGround,
  isSuspensionActive,
  writeRateTier,
  type MemberCapability,
  type MembershipEvent,
  type MembershipEventKind,
  type MembershipEventRefusal,
  type MembershipGrounds,
  type MembershipStatus,
} from "./eligibility"
import { DAY_MS } from "./time"

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)
const IDN_GA = (loa: number) => ({ loa, gaboneseNationality: true })

/** Un jeu de faits représentatif par statut (et par CHEMIN pour les statuts à plusieurs chemins). */
const FIXTURES = {
  en_attente: LIGHT_ACCOUNT_GROUNDS,
  declaree_idn: { ...LIGHT_ACCOUNT_GROUNDS, idn: IDN_GA(1) },
  declaree_sponsored: { ...LIGHT_ACCOUNT_GROUNDS, sponsored: true },
  verifiee_attested: { ...LIGHT_ACCOUNT_GROUNDS, consularAttestation: true },
  verifiee_idn_sponsored: { ...LIGHT_ACCOUNT_GROUNDS, idn: IDN_GA(2), sponsored: true },
  suspendue: {
    ...LIGHT_ACCOUNT_GROUNDS,
    idn: IDN_GA(1),
    suspension: { until: null, readAccess: "read_only" as const },
  },
  partie: { ...LIGHT_ACCOUNT_GROUNDS, idn: IDN_GA(1), leftAt: NOW - DAY_MS },
} satisfies Record<string, MembershipGrounds>

type FixtureName = keyof typeof FIXTURES

const EVENTS: Record<MembershipEventKind, MembershipEvent> = {
  idn_linked: { kind: "idn_linked", loa: 2, gaboneseNationality: true },
  idn_loa_updated: { kind: "idn_loa_updated", loa: 3 },
  idn_unlinked: { kind: "idn_unlinked" },
  sponsored: { kind: "sponsored" },
  sponsorship_revoked: { kind: "sponsorship_revoked" },
  attestation_confirmed: { kind: "attestation_confirmed" },
  attestation_revoked: { kind: "attestation_revoked" },
  suspended: { kind: "suspended", until: NOW + 7 * DAY_MS, readAccess: "read_only" },
  suspension_lifted: { kind: "suspension_lifted" },
  left: { kind: "left", at: NOW },
  rejoined: { kind: "rejoined" },
}

type Expected = MembershipStatus | { refused: MembershipEventRefusal }
const R = (refused: MembershipEventRefusal): Expected => ({ refused })

/**
 * LA matrice : chaque statut (par chacun de ses chemins) × chaque évènement.
 * Une transition ajoutée sans sa ligne ici fait échouer la couverture.
 */
const MATRIX: Record<FixtureName, Record<MembershipEventKind, Expected>> = {
  en_attente: {
    idn_linked: "declaree",
    idn_loa_updated: R("no_idn_link"),
    idn_unlinked: R("no_idn_link"),
    sponsored: "declaree",
    sponsorship_revoked: R("no_sponsorship"),
    attestation_confirmed: "verifiee",
    attestation_revoked: R("no_attestation"),
    suspended: "suspendue",
    suspension_lifted: R("not_suspended"),
    left: "partie",
    rejoined: R("not_left"),
  },
  declaree_idn: {
    idn_linked: R("idn_already_linked"),
    idn_loa_updated: "declaree",
    idn_unlinked: "en_attente",
    sponsored: "declaree",
    sponsorship_revoked: R("no_sponsorship"),
    attestation_confirmed: "verifiee",
    attestation_revoked: R("no_attestation"),
    suspended: "suspendue",
    suspension_lifted: R("not_suspended"),
    left: "partie",
    rejoined: R("not_left"),
  },
  declaree_sponsored: {
    idn_linked: "verifiee",
    idn_loa_updated: R("no_idn_link"),
    idn_unlinked: R("no_idn_link"),
    sponsored: R("already_sponsored"),
    sponsorship_revoked: "en_attente",
    attestation_confirmed: "verifiee",
    attestation_revoked: R("no_attestation"),
    suspended: "suspendue",
    suspension_lifted: R("not_suspended"),
    left: "partie",
    rejoined: R("not_left"),
  },
  verifiee_attested: {
    idn_linked: "verifiee",
    idn_loa_updated: R("no_idn_link"),
    idn_unlinked: R("no_idn_link"),
    sponsored: "verifiee",
    sponsorship_revoked: R("no_sponsorship"),
    attestation_confirmed: R("already_attested"),
    attestation_revoked: "en_attente",
    suspended: "suspendue",
    suspension_lifted: R("not_suspended"),
    left: "partie",
    rejoined: R("not_left"),
  },
  verifiee_idn_sponsored: {
    idn_linked: R("idn_already_linked"),
    idn_loa_updated: "verifiee",
    idn_unlinked: "declaree",
    sponsored: R("already_sponsored"),
    sponsorship_revoked: "declaree",
    attestation_confirmed: "verifiee",
    attestation_revoked: R("no_attestation"),
    suspended: "suspendue",
    suspension_lifted: R("not_suspended"),
    left: "partie",
    rejoined: R("not_left"),
  },
  suspendue: {
    idn_linked: R("idn_already_linked"),
    idn_loa_updated: "suspendue",
    idn_unlinked: "suspendue",
    sponsored: "suspendue",
    sponsorship_revoked: R("no_sponsorship"),
    attestation_confirmed: "suspendue",
    attestation_revoked: R("no_attestation"),
    suspended: "suspendue",
    suspension_lifted: "declaree",
    left: "partie",
    rejoined: R("not_left"),
  },
  partie: {
    idn_linked: R("membership_left"),
    idn_loa_updated: R("membership_left"),
    idn_unlinked: R("membership_left"),
    sponsored: R("membership_left"),
    sponsorship_revoked: R("membership_left"),
    attestation_confirmed: R("membership_left"),
    attestation_revoked: R("membership_left"),
    suspended: R("membership_left"),
    suspension_lifted: R("membership_left"),
    left: R("membership_left"),
    rejoined: "declaree",
  },
}

describe("deriveMembershipStatus — la règle unique", () => {
  test("chaque jeu de faits donne le statut attendu", () => {
    expect(deriveMembershipStatus(FIXTURES.en_attente, NOW)).toBe("en_attente")
    expect(deriveMembershipStatus(FIXTURES.declaree_idn, NOW)).toBe("declaree")
    expect(deriveMembershipStatus(FIXTURES.declaree_sponsored, NOW)).toBe("declaree")
    expect(deriveMembershipStatus(FIXTURES.verifiee_attested, NOW)).toBe("verifiee")
    expect(deriveMembershipStatus(FIXTURES.verifiee_idn_sponsored, NOW)).toBe("verifiee")
    expect(deriveMembershipStatus(FIXTURES.suspendue, NOW)).toBe("suspendue")
    expect(deriveMembershipStatus(FIXTURES.partie, NOW)).toBe("partie")
  })

  test("IDN loa ≥ 2 sans parrainage reste déclarée (le badge Vérifié n'est pas le statut)", () => {
    expect(deriveMembershipStatus({ ...LIGHT_ACCOUNT_GROUNDS, idn: IDN_GA(3) }, NOW)).toBe("declaree")
  })

  test("IDN loa 1 parrainée reste déclarée : il faut loa ≥ 2 pour vérifier par parrainage", () => {
    expect(deriveMembershipStatus({ ...LIGHT_ACCOUNT_GROUNDS, idn: IDN_GA(1), sponsored: true }, NOW)).toBe("declaree")
  })

  test("une identité IDN que IDN déclare non gabonaise n'ouvre pas la porte", () => {
    const foreign = { ...LIGHT_ACCOUNT_GROUNDS, idn: { loa: 3, gaboneseNationality: false } }
    expect(deriveMembershipStatus(foreign, NOW)).toBe("en_attente")
    expect(deriveMembershipStatus({ ...foreign, sponsored: true }, NOW)).toBe("declaree")
    expect(idnCountsAsGround(foreign.idn)).toBe(false)
  })

  test("une nationalité inconnue (null) ne ferme pas la porte IDN", () => {
    const unknown = { ...LIGHT_ACCOUNT_GROUNDS, idn: { loa: 1, gaboneseNationality: null } }
    expect(deriveMembershipStatus(unknown, NOW)).toBe("declaree")
    expect(idnCountsAsGround(null)).toBe(false)
  })

  test("le départ l'emporte sur la sanction, la sanction sur l'attestation", () => {
    const suspendedAttested = {
      ...FIXTURES.verifiee_attested,
      suspension: { until: null, readAccess: "none" as const },
    }
    expect(deriveMembershipStatus(suspendedAttested, NOW)).toBe("suspendue")
    expect(deriveMembershipStatus({ ...suspendedAttested, leftAt: NOW }, NOW)).toBe("partie")
  })

  test("une sanction échue ne suspend plus", () => {
    const expired = { ...FIXTURES.declaree_idn, suspension: { until: NOW - 1, readAccess: "none" as const } }
    expect(isSuspensionActive(expired.suspension, NOW)).toBe(false)
    expect(deriveMembershipStatus(expired, NOW)).toBe("declaree")
    expect(isSuspensionActive({ until: NOW + 1, readAccess: "none" }, NOW)).toBe(true)
    expect(isSuspensionActive({ until: NOW, readAccess: "none" }, NOW)).toBe(false)
    expect(isSuspensionActive(null, NOW)).toBe(false)
  })
})

describe("applyMembershipEvent — 100 % des transitions", () => {
  for (const [fixtureName, row] of Object.entries(MATRIX) as [FixtureName, Record<MembershipEventKind, Expected>][]) {
    for (const [eventKind, expected] of Object.entries(row) as [MembershipEventKind, Expected][]) {
      const label = typeof expected === "string" ? expected : `refus ${expected.refused}`
      test(`${fixtureName} + ${eventKind} → ${label}`, () => {
        const grounds = FIXTURES[fixtureName]
        const result = applyMembershipEvent(grounds, EVENTS[eventKind], NOW)
        if (typeof expected === "string") {
          expect(result.ok).toBe(true)
          if (!result.ok) return
          expect(result.value.status).toBe(expected)
          expect(result.value.previous).toBe(deriveMembershipStatus(grounds, NOW))
        } else {
          expect(result).toEqual({ ok: false, code: expected.refused })
        }
      })
    }
  }

  test("la matrice couvre tous les évènements et tous les statuts", () => {
    for (const row of Object.values(MATRIX)) {
      expect(Object.keys(row).sort()).toEqual(Object.keys(EVENTS).sort())
    }
    const covered = new Set(Object.keys(FIXTURES).map((name) => deriveMembershipStatus(FIXTURES[name as FixtureName], NOW)))
    expect([...covered].sort()).toEqual([...MEMBERSHIP_STATUSES].sort())
  })

  test("un niveau de garantie hors bornes est refusé, au lien comme à la mise à jour", () => {
    for (const loa of [-1, 5, 1.5, Number.NaN]) {
      expect(applyMembershipEvent(LIGHT_ACCOUNT_GROUNDS, { kind: "idn_linked", loa, gaboneseNationality: true }, NOW)).toEqual({
        ok: false,
        code: "loa_invalid",
      })
      expect(applyMembershipEvent(FIXTURES.declaree_idn, { kind: "idn_loa_updated", loa }, NOW)).toEqual({
        ok: false,
        code: "loa_invalid",
      })
    }
  })

  test("le départ éteint le parrainage : au retour, il faut un nouveau parrain", () => {
    const left = applyMembershipEvent(FIXTURES.declaree_sponsored, EVENTS.left, NOW)
    if (!left.ok) throw new Error("départ refusé")
    expect(left.value.grounds.sponsored).toBe(false)
    const back = applyMembershipEvent(left.value.grounds, EVENTS.rejoined, NOW)
    if (!back.ok) throw new Error("retour refusé")
    expect(back.value.status).toBe("en_attente")
  })

  test("on ne sort pas d'une sanction en partant puis en revenant", () => {
    const left = applyMembershipEvent(FIXTURES.suspendue, EVENTS.left, NOW)
    if (!left.ok) throw new Error("départ refusé")
    const back = applyMembershipEvent(left.value.grounds, EVENTS.rejoined, NOW)
    if (!back.ok) throw new Error("retour refusé")
    expect(back.value.status).toBe("suspendue")
  })

  test("lever une sanction déjà échue est refusé", () => {
    const expired = { ...FIXTURES.declaree_idn, suspension: { until: NOW - 1, readAccess: "none" as const } }
    expect(applyMembershipEvent(expired, EVENTS.suspension_lifted, NOW)).toEqual({ ok: false, code: "not_suspended" })
  })

  test("une nouvelle sanction remplace l'ancienne (durée et accès)", () => {
    const result = applyMembershipEvent(FIXTURES.suspendue, { kind: "suspended", until: NOW + DAY_MS, readAccess: "none" }, NOW)
    if (!result.ok) throw new Error("sanction refusée")
    expect(result.value.grounds.suspension).toEqual({ until: NOW + DAY_MS, readAccess: "none" })
  })

  test("un évènement ne modifie jamais les faits d'entrée (immutabilité)", () => {
    const before = JSON.stringify(FIXTURES.declaree_sponsored)
    applyMembershipEvent(FIXTURES.declaree_sponsored, EVENTS.sponsorship_revoked, NOW)
    expect(JSON.stringify(FIXTURES.declaree_sponsored)).toBe(before)
  })
})

describe("effectiveMembershipStatus — la racine suspend partout", () => {
  test("suspension à la racine → suspendue dans le réseau", () => {
    for (const status of ["en_attente", "declaree", "verifiee", "suspendue"] as const) {
      expect(effectiveMembershipStatus(status, { suspended: true })).toBe("suspendue")
      expect(effectiveMembershipStatus(status, { suspended: false })).toBe(status)
    }
  })

  test("un départ reste un départ", () => {
    expect(effectiveMembershipStatus("partie", { suspended: true })).toBe("partie")
    expect(effectiveMembershipStatus("partie", { suspended: false })).toBe("partie")
  })
})

describe("capacités — table du cahier §6.2", () => {
  const EXPECTED: Record<MembershipStatus, readonly MemberCapability[]> = {
    en_attente: ["read_network", "request_attestation"],
    declaree: [
      "read_network",
      "publish",
      "communicate",
      "create_event",
      "appear_in_directory",
      "view_directory",
      "request_attestation",
    ],
    verifiee: [
      "read_network",
      "publish",
      "communicate",
      "create_event",
      "create_page",
      "appear_in_directory",
      "view_directory",
      "sponsor",
    ],
    suspendue: [],
    partie: [],
  }

  for (const status of MEMBERSHIP_STATUSES) {
    test(`${status} : capacités exactes`, () => {
      expect([...capabilitiesOf(status)].sort()).toEqual([...EXPECTED[status]].sort())
      for (const capability of MEMBER_CAPABILITIES) {
        expect(hasCapability(status, capability)).toBe(EXPECTED[status].includes(capability))
      }
    })
  }

  test("en attente : lecture seule, jamais de publication ni de messagerie (R3)", () => {
    expect(hasCapability("en_attente", "read_network")).toBe(true)
    expect(hasCapability("en_attente", "publish")).toBe(false)
    expect(hasCapability("en_attente", "communicate")).toBe(false)
  })

  test("déclarée : évènement oui, page après vérification seulement", () => {
    expect(hasCapability("declaree", "create_event")).toBe(true)
    expect(hasCapability("declaree", "create_page")).toBe(false)
  })

  test("suspendue : lecture seule OU rien, selon la sanction", () => {
    expect([...capabilitiesOf("suspendue", { suspensionReadAccess: "read_only" })]).toEqual(["read_network"])
    expect([...capabilitiesOf("suspendue", { suspensionReadAccess: "none" })]).toEqual([])
    expect(hasCapability("suspendue", "read_network", { suspensionReadAccess: "read_only" })).toBe(true)
    expect(hasCapability("suspendue", "publish", { suspensionReadAccess: "read_only" })).toBe(false)
  })
})

describe("writeRateTier — limitation de débit renforcée pour les déclarés sans badge", () => {
  test("seaux par statut et badge", () => {
    expect(writeRateTier("en_attente", ["community"])).toBe("none")
    expect(writeRateTier("suspendue", ["verified"])).toBe("none")
    expect(writeRateTier("partie", ["community"])).toBe("none")
    expect(writeRateTier("declaree", ["community"])).toBe("reinforced")
    expect(writeRateTier("declaree", ["public_agent"])).toBe("reinforced")
    expect(writeRateTier("declaree", ["verified"])).toBe("standard")
    expect(writeRateTier("verifiee", ["verified"])).toBe("standard")
  })
})
