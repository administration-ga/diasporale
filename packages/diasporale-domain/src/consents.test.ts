import { describe, expect, test } from "bun:test"
import {
  CONSENT_PURPOSES,
  CONSENT_TEXT_VERSIONS,
  ONBOARDING_CONSENT_PURPOSES,
  canCompleteOnboarding,
  consentRecord,
  initialConsentChoices,
  isConsentActive,
  missingRequiredConsents,
  onboardingConsentRecords,
} from "./consents"

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)

describe("contrat « aucune case précochée »", () => {
  test("toutes les finalités de l'onboarding commencent à « non »", () => {
    const initial = initialConsentChoices()
    expect(Object.keys(initial).sort()).toEqual([...ONBOARDING_CONSENT_PURPOSES].sort())
    for (const purpose of ONBOARDING_CONSENT_PURPOSES) expect(initial[purpose]).toBe(false)
  })

  test("chaque appel rend un objet neuf (aucun état partagé entre deux personnes)", () => {
    expect(initialConsentChoices()).not.toBe(initialConsentChoices())
  })
})

describe("onboarding", () => {
  test("le profil social est la seule finalité requise", () => {
    expect(missingRequiredConsents(initialConsentChoices())).toEqual(["social_profile"])
    expect(canCompleteOnboarding(initialConsentChoices())).toBe(false)
    const minimal = { social_profile: true, directory: false, notifications: false }
    expect(canCompleteOnboarding(minimal)).toBe(true)
    expect(missingRequiredConsents(minimal)).toEqual([])
  })

  test("un enregistrement par finalité montrée, refus compris, avec la version du texte", () => {
    const records = onboardingConsentRecords({ social_profile: true, directory: false, notifications: true }, NOW)
    expect(records).toEqual([
      { purpose: "social_profile", granted: true, textVersion: CONSENT_TEXT_VERSIONS.social_profile, recordedAt: NOW, origin: "onboarding" },
      { purpose: "directory", granted: false, textVersion: CONSENT_TEXT_VERSIONS.directory, recordedAt: NOW, origin: "onboarding" },
      { purpose: "notifications", granted: true, textVersion: CONSENT_TEXT_VERSIONS.notifications, recordedAt: NOW, origin: "onboarding" },
    ])
  })

  test("chaque finalité a une version de texte", () => {
    for (const purpose of CONSENT_PURPOSES) expect(CONSENT_TEXT_VERSIONS[purpose]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe("isConsentActive — le dernier geste fait foi", () => {
  test("sans geste : non", () => {
    expect(isConsentActive([], "directory")).toBe(false)
  })

  test("accord puis retrait : non ; retrait puis accord : oui", () => {
    const granted = consentRecord("directory", true, NOW, "onboarding")
    const revoked = consentRecord("directory", false, NOW + 1, "settings")
    expect(isConsentActive([granted, revoked], "directory")).toBe(false)
    expect(isConsentActive([revoked, consentRecord("directory", true, NOW + 2, "settings")], "directory")).toBe(true)
  })

  test("l'ordre du tableau ne compte pas, seule l'heure", () => {
    const later = consentRecord("notifications", false, NOW + 10, "settings")
    const earlier = consentRecord("notifications", true, NOW, "onboarding")
    expect(isConsentActive([later, earlier], "notifications")).toBe(false)
  })

  test("à égalité d'heure, le refus l'emporte", () => {
    const yes = consentRecord("talents", true, NOW, "talents_editor")
    const no = consentRecord("talents", false, NOW, "talents_editor")
    expect(isConsentActive([yes, no], "talents")).toBe(false)
    expect(isConsentActive([no, yes], "talents")).toBe(false)
  })

  test("les autres finalités sont ignorées", () => {
    expect(isConsentActive([consentRecord("social_profile", true, NOW, "onboarding")], "consular_attestation")).toBe(false)
  })
})
