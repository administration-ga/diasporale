import { describe, expect, test } from "bun:test"

import { LIGHT_ACCOUNT_GROUNDS, MEMBERSHIP_STATUSES } from "./eligibility"
import {
  FOUNDING_ADMISSION_REFUSALS,
  FOUNDING_COHORT_MAX,
  FOUNDING_REASON_MIN,
  FOUNDING_WITHDRAWAL_CAUSES,
  checkFoundingAdmission,
  checkFoundingWithdrawal,
  foundingSeniorityWaived,
} from "./founders"

const MEMBER = { targetStatus: "en_attente", alreadyAdmitted: false, activeCohort: 0 } as const

describe("checkFoundingAdmission — cohorte fondatrice (EA-01)", () => {
  test("un membre actif, quelle que soit sa porte, peut être admis tant que la cohorte n'est pas pleine", () => {
    for (const targetStatus of ["en_attente", "declaree", "verifiee"] as const) {
      expect(checkFoundingAdmission({ ...MEMBER, targetStatus })).toEqual({ ok: true, value: true })
    }
    expect(checkFoundingAdmission({ ...MEMBER, activeCohort: FOUNDING_COHORT_MAX - 1 })).toEqual({ ok: true, value: true })
  })

  test("rien d'office : sans adhésion, partie ou suspendue, la personne n'est pas admissible", () => {
    expect(checkFoundingAdmission({ ...MEMBER, targetStatus: null })).toEqual({ ok: false, code: "founding_target_not_member" })
    for (const targetStatus of ["suspendue", "partie"] as const) {
      expect(checkFoundingAdmission({ ...MEMBER, targetStatus })).toEqual({ ok: false, code: "founding_target_not_member" })
    }
  })

  test("le plafond tient : la cohorte pleine refuse, une admission en vigueur ne se double pas", () => {
    expect(checkFoundingAdmission({ ...MEMBER, activeCohort: FOUNDING_COHORT_MAX })).toEqual({ ok: false, code: "founding_cohort_full" })
    expect(checkFoundingAdmission({ ...MEMBER, alreadyAdmitted: true })).toEqual({ ok: false, code: "founding_already_admitted" })
    // La cible d'abord, le plafond ensuite.
    expect(checkFoundingAdmission({ targetStatus: "partie", alreadyAdmitted: true, activeCohort: FOUNDING_COHORT_MAX })).toEqual({ ok: false, code: "founding_target_not_member" })
    expect(checkFoundingAdmission({ ...MEMBER, alreadyAdmitted: true, activeCohort: FOUNDING_COHORT_MAX })).toEqual({ ok: false, code: "founding_already_admitted" })
  })

  test("constantes : un plafond prudent et un motif exigé ; refus et causes de fin en listes fermées", () => {
    expect(FOUNDING_COHORT_MAX).toBeGreaterThan(0)
    expect(Number.isInteger(FOUNDING_COHORT_MAX)).toBe(true)
    expect(FOUNDING_REASON_MIN).toBeGreaterThan(0)
    expect([...FOUNDING_ADMISSION_REFUSALS]).toEqual(["founding_target_not_member", "founding_already_admitted", "founding_cohort_full"])
    expect([...FOUNDING_WITHDRAWAL_CAUSES]).toEqual(["operator", "departure"])
    // Les statuts admissibles sont des statuts du domaine.
    expect(MEMBERSHIP_STATUSES).toContain("en_attente")
  })
})

describe("checkFoundingWithdrawal — retrait d'une admission", () => {
  test("seule une admission en vigueur se retire", () => {
    expect(checkFoundingWithdrawal({ admitted: true })).toEqual({ ok: true, value: true })
    expect(checkFoundingWithdrawal({ admitted: false })).toEqual({ ok: false, code: "founding_not_admitted" })
  })
})

describe("foundingSeniorityWaived — la dispense suit la décision en vigueur", () => {
  test("dispensé seulement si la décision l'accorde", () => {
    expect(foundingSeniorityWaived({ foundingAdmission: { seniorityWaiver: true } })).toBe(true)
    expect(foundingSeniorityWaived({ foundingAdmission: { seniorityWaiver: false } })).toBe(false)
    expect(foundingSeniorityWaived(LIGHT_ACCOUNT_GROUNDS)).toBe(false)
  })
})
