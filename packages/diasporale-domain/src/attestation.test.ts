import { describe, expect, test } from "bun:test"
import {
  ATTESTATION_CONTRACT,
  ATTESTATION_REQUEST_INTERVAL_MS,
  attestationOutcome,
  canRequestAttestation,
  parseAttestationResponse,
} from "./attestation"

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)
const VERIFIED = {
  verified: true,
  countryOfResidence: "FR",
  postSlug: "poste-demo-france",
  registrationStatus: "active",
  since: Date.UTC(2023, 2, 1),
  attestedAt: NOW,
} as const

describe("parseAttestationResponse — la réponse et rien d'autre", () => {
  test("le contrat porte son nom versionné", () => {
    expect(ATTESTATION_CONTRACT).toBe("DIASPORA-ATTESTATION-V1")
  })

  test("R2 : une réponse vérifiée complète est acceptée telle quelle", () => {
    expect(parseAttestationResponse(VERIFIED)).toEqual({ ok: true, value: VERIFIED })
  })

  test("une réponse négative minimale est acceptée", () => {
    expect(parseAttestationResponse({ verified: false, registrationStatus: "none", attestedAt: NOW })).toEqual({
      ok: true,
      value: { verified: false, registrationStatus: "none", attestedAt: NOW },
    })
    expect(parseAttestationResponse({ verified: false, attestedAt: NOW })).toEqual({
      ok: true,
      value: { verified: false, attestedAt: NOW },
    })
  })

  test("AUCUNE donnée consulaire hors contrat : tout champ supplémentaire est refusé", () => {
    for (const extra of ["name", "passportNumber", "nip", "birthDate", "children", "email", "phone", "matricule"]) {
      expect(parseAttestationResponse({ ...VERIFIED, [extra]: "x" })).toEqual({
        ok: false,
        code: "response_field_not_allowed",
      })
    }
  })

  test("forme invalide", () => {
    for (const raw of [null, "verified", 42, [VERIFIED]]) {
      expect(parseAttestationResponse(raw)).toEqual({ ok: false, code: "response_not_object" })
    }
  })

  test("champs mal typés", () => {
    const invalid = [
      { ...VERIFIED, verified: "true" },
      { ...VERIFIED, attestedAt: "hier" },
      { ...VERIFIED, attestedAt: 0 },
      { ...VERIFIED, countryOfResidence: "GA" },
      { ...VERIFIED, countryOfResidence: 33 },
      { ...VERIFIED, postSlug: "Consulat Général de France" },
      { ...VERIFIED, postSlug: 7 },
      { ...VERIFIED, registrationStatus: "pending" },
      { ...VERIFIED, registrationStatus: 1 },
      { ...VERIFIED, since: 1.5 },
    ]
    for (const raw of invalid) expect(parseAttestationResponse(raw)).toEqual({ ok: false, code: "response_field_invalid" })
  })

  test("incohérences : vérifié sans pays, poste ou inscription active ; non vérifié mais actif", () => {
    const { countryOfResidence: _c, ...noCountry } = VERIFIED
    const { postSlug: _p, ...noPost } = VERIFIED
    for (const raw of [noCountry, noPost, { ...VERIFIED, registrationStatus: "expired" }]) {
      expect(parseAttestationResponse(raw)).toEqual({ ok: false, code: "response_incoherent" })
    }
    expect(parseAttestationResponse({ verified: false, registrationStatus: "active", attestedAt: NOW })).toEqual({
      ok: false,
      code: "response_incoherent",
    })
  })

  test("issue affichée : vérifié ou « nous n'avons pas pu confirmer », sans raison consulaire", () => {
    expect(attestationOutcome({ verified: true, attestedAt: NOW })).toBe("verified")
    expect(attestationOutcome({ verified: false, registrationStatus: "expired", attestedAt: NOW })).toBe("not_confirmed")
  })
})

describe("une demande par 24 h", () => {
  test("bornes", () => {
    expect(canRequestAttestation(null, NOW)).toBe(true)
    expect(canRequestAttestation(NOW - ATTESTATION_REQUEST_INTERVAL_MS + 1, NOW)).toBe(false)
    expect(canRequestAttestation(NOW - ATTESTATION_REQUEST_INTERVAL_MS, NOW)).toBe(true)
  })
})
