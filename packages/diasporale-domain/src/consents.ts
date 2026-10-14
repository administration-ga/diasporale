/**
 * Consentements (EXF-DG-02, EXF-DG-44) — explicites, horodatés, révocables.
 *
 * Trois règles que rien ne contourne :
 *   1. AUCUNE case précochée : l'état initial de toute finalité est « non » ;
 *   2. chaque geste s'enregistre (accord ET refus), avec la version du texte
 *      lu, l'heure et l'origine du geste ;
 *   3. retirer un consentement est un geste aussi simple que le donner : un
 *      nouvel enregistrement, jamais une suppression de l'historique.
 *
 * Le moteur porte la table `consents` ; ce module dit QUELLES finalités
 * DIASPORALE demande, lesquelles sont requises, et lit l'historique.
 */

export const CONSENT_PURPOSES = [
  /** Le profil social : exister dans DIASPORALE (requis pour entrer). */
  "social_profile",
  /** Apparaître dans l'annuaire opt-in des membres. */
  "directory",
  /** Recevoir des notifications de la vie communautaire. */
  "notifications",
  /** Autoriser la requête d'attestation consulaire (PD3), au moment du geste. */
  "consular_attestation",
  /** Rendre visible son profil professionnel (V2). */
  "talents",
] as const
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number]

/** Les trois consentements de l'onboarding, dans l'ordre d'affichage (E12, étape 3). */
export const ONBOARDING_CONSENT_PURPOSES = ["social_profile", "directory", "notifications"] as const
export type OnboardingConsentPurpose = (typeof ONBOARDING_CONSENT_PURPOSES)[number]

/** Sans profil social, il n'y a pas de membre : c'est la seule finalité requise pour entrer. */
export const REQUIRED_ONBOARDING_PURPOSES: readonly OnboardingConsentPurpose[] = Object.freeze(["social_profile"])

/**
 * Version du texte d'information de chaque finalité. Changer un texte change
 * sa version : les accords donnés sur l'ancienne version restent tracés tels quels.
 */
export const CONSENT_TEXT_VERSIONS: Readonly<Record<ConsentPurpose, string>> = Object.freeze({
  social_profile: "2026-10-14",
  directory: "2026-10-14",
  notifications: "2026-10-14",
  consular_attestation: "2026-10-14",
  talents: "2026-10-14",
})

export type OnboardingConsentChoices = Readonly<Record<OnboardingConsentPurpose, boolean>>

/** L'état initial des cases : tout à « non ». C'est le contrat « aucune case précochée ». */
export function initialConsentChoices(): OnboardingConsentChoices {
  return { social_profile: false, directory: false, notifications: false }
}

export function missingRequiredConsents(choices: OnboardingConsentChoices): OnboardingConsentPurpose[] {
  return REQUIRED_ONBOARDING_PURPOSES.filter((purpose) => !choices[purpose])
}

export function canCompleteOnboarding(choices: OnboardingConsentChoices): boolean {
  return missingRequiredConsents(choices).length === 0
}

export const CONSENT_ORIGINS = ["onboarding", "settings", "attestation_request", "talents_editor"] as const
export type ConsentOrigin = (typeof CONSENT_ORIGINS)[number]

export interface ConsentRecord {
  readonly purpose: ConsentPurpose
  readonly granted: boolean
  readonly textVersion: string
  readonly recordedAt: number
  readonly origin: ConsentOrigin
}

export function consentRecord(
  purpose: ConsentPurpose,
  granted: boolean,
  recordedAt: number,
  origin: ConsentOrigin,
): ConsentRecord {
  return { purpose, granted, textVersion: CONSENT_TEXT_VERSIONS[purpose], recordedAt, origin }
}

/** Les gestes de l'onboarding : un enregistrement par finalité montrée, accord comme refus. */
export function onboardingConsentRecords(choices: OnboardingConsentChoices, recordedAt: number): ConsentRecord[] {
  return ONBOARDING_CONSENT_PURPOSES.map((purpose) => consentRecord(purpose, choices[purpose], recordedAt, "onboarding"))
}

/**
 * Le consentement est-il en vigueur ? Le DERNIER geste fait foi. À égalité
 * d'heure, le refus l'emporte : dans le doute, on ne traite pas.
 */
export function isConsentActive(records: readonly ConsentRecord[], purpose: ConsentPurpose): boolean {
  let latest: ConsentRecord | null = null
  for (const record of records) {
    if (record.purpose !== purpose) continue
    if (
      latest === null ||
      record.recordedAt > latest.recordedAt ||
      (record.recordedAt === latest.recordedAt && !record.granted)
    ) {
      latest = record
    }
  }
  return latest?.granted ?? false
}
