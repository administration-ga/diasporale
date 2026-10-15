import { describe, expect, test } from "bun:test"
import {
  ATTESTATION_CONTRACT,
  ATTESTATION_HEADERS,
  ATTESTATION_PATH,
  ATTESTATION_REQUEST_INTERVAL_MS,
  attestationOutcome,
  attestationRequestBody,
  canonicalAttestationString,
  canRequestAttestation,
  CONSENT_REF_PATTERN,
  parseAttestationResponse,
} from "./attestation"

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)
const VERIFIED = {
  contract: "DIASPORA-ATTESTATION-V1",
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

  test("R2 : une réponse vérifiée complète est acceptée ; le nom du contrat est vérifié puis écarté", () => {
    const { contract: _contract, ...expected } = VERIFIED
    expect(parseAttestationResponse(VERIFIED)).toEqual({ ok: true, value: expected })
  })

  test("une réponse négative minimale est acceptée", () => {
    expect(parseAttestationResponse({ contract: ATTESTATION_CONTRACT, verified: false, registrationStatus: "none", attestedAt: NOW })).toEqual({
      ok: true,
      value: { verified: false, registrationStatus: "none", attestedAt: NOW },
    })
  })

  test("le nom du contrat et le statut d'inscription sont exigés dans TOUTE réponse", () => {
    const { contract: _contract, ...withoutContract } = VERIFIED
    const { registrationStatus: _status, ...withoutStatus } = VERIFIED
    for (const raw of [withoutContract, { ...VERIFIED, contract: "DIASPORA-ATTESTATION-V2" }, withoutStatus]) {
      expect(parseAttestationResponse(raw)).toEqual({ ok: false, code: "response_field_invalid" })
    }
    expect(parseAttestationResponse({ contract: ATTESTATION_CONTRACT, verified: false, attestedAt: NOW })).toEqual({
      ok: false,
      code: "response_field_invalid",
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
    expect(parseAttestationResponse({ contract: ATTESTATION_CONTRACT, verified: false, registrationStatus: "active", attestedAt: NOW })).toEqual({
      ok: false,
      code: "response_incoherent",
    })
  })

  test("issue affichée : vérifié ou « nous n'avons pas pu confirmer », sans raison consulaire", () => {
    expect(attestationOutcome({ verified: true, registrationStatus: "active", attestedAt: NOW })).toBe("verified")
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

describe("la requête signée du contrat (§3.1, §3.2)", () => {
  test("chaîne canonique : v1, horodatage, méthode, chemin, empreinte du corps", () => {
    expect(ATTESTATION_PATH).toBe("/api/partner/diaspora/attestation")
    expect(canonicalAttestationString({ timestamp: "1760486400000", bodySha256: "ab12" })).toBe(
      "v1\n1760486400000\nPOST\n/api/partner/diaspora/attestation\nab12",
    )
    expect(ATTESTATION_HEADERS).toEqual({
      keyId: "x-diaspora-key-id",
      timestamp: "x-diaspora-timestamp",
      signature: "x-diaspora-signature",
    })
  })

  test("le corps porte les quatre champs du contrat, dans son ordre, et rien d'autre", () => {
    const request = { subjectKind: "idnSub", subject: "sub-1", consentRef: "consent:abc-123", requestedAt: NOW } as const
    const body = attestationRequestBody({ ...request, ...({ name: "jamais" } as object) } as typeof request)
    expect(body).toBe(`{"subjectKind":"idnSub","subject":"sub-1","consentRef":"consent:abc-123","requestedAt":${NOW}}`)
  })

  test("référence de consentement : 8 à 128 caractères admis par le contrat", () => {
    expect(CONSENT_REF_PATTERN.test("consent:7f3c2a9e-4d1b")).toBe(true)
    expect(CONSENT_REF_PATTERN.test("court")).toBe(false)
    expect(CONSENT_REF_PATTERN.test("consent ref avec espaces")).toBe(false)
    expect(CONSENT_REF_PATTERN.test("x".repeat(129))).toBe(false)
  })
})
