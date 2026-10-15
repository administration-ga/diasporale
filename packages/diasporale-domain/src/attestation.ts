/**
 * Contrat `DIASPORA-ATTESTATION-V1` — côté CONSOMMATEUR (le moteur).
 *
 * consulat.ga n'est pas un fournisseur d'identité : il ATTESTE, avec le
 * consentement de la personne, qu'une inscription consulaire active existe.
 * La réponse est minimale et FERMÉE : un booléen, un pays, un poste, un
 * statut, deux dates. Ce module la relit champ par champ et refuse toute
 * réponse qui porterait autre chose — c'est la garantie, testée, qu'aucune
 * donnée consulaire (nom, passeport, NIP, état civil, mineur) n'entre jamais
 * dans le moteur (cahier §5, invariant 4).
 *
 * Les types sont COPIÉS chez le consommateur (doctrine d'interopérabilité) :
 * la source du contrat est `GABON_DIPLOMATIE/docs/contrats/DIASPORA-ATTESTATION-V1.md`.
 */
import { isResidenceCountry, type CountryCode } from "./countries"
import { ok, refuse, type Result } from "./result"

export const ATTESTATION_CONTRACT = "DIASPORA-ATTESTATION-V1"

export const ATTESTATION_SUBJECT_KINDS = ["idnSub", "emailHash"] as const
export type AttestationSubjectKind = (typeof ATTESTATION_SUBJECT_KINDS)[number]

export const REGISTRATION_STATUSES = ["active", "expired", "none"] as const
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number]

/** La requête : un sujet (jamais en clair pour l'e-mail), une référence de consentement, une date. */
export interface AttestationRequest {
  readonly subjectKind: AttestationSubjectKind
  readonly subject: string
  readonly consentRef: string
  readonly requestedAt: number
}

/**
 * La réponse — et RIEN d'autre. Le nom du contrat (`contract`), émis dans toute
 * réponse, est EXIGÉ à sa valeur exacte puis écarté : il ne dit rien de la personne.
 */
export interface AttestationResponse {
  readonly verified: boolean
  readonly countryOfResidence?: CountryCode
  readonly postSlug?: string
  /** Toujours présent (contrat §3.3) : `active`, `expired` ou `none`. */
  readonly registrationStatus: RegistrationStatus
  readonly since?: number
  readonly attestedAt: number
}

const RESPONSE_FIELDS: ReadonlySet<string> = new Set([
  "contract",
  "verified",
  "countryOfResidence",
  "postSlug",
  "registrationStatus",
  "since",
  "attestedAt",
])

export const ATTESTATION_RESPONSE_REFUSALS = [
  "response_not_object",
  "response_field_not_allowed",
  "response_field_invalid",
  "response_incoherent",
] as const
export type AttestationResponseRefusal = (typeof ATTESTATION_RESPONSE_REFUSALS)[number]

/** Slug de poste : minuscules, chiffres et tirets — un identifiant public, jamais un nom de personne. */
const POST_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
}

/**
 * Relit une réponse reçue (JSON déjà signé et vérifié par l'action) : tout
 * champ hors contrat est un REFUS, pas un oubli silencieux. Le nom du contrat et
 * le statut d'inscription sont exigés dans toute réponse ; une réponse
 * `verified: true` doit porter le pays, le poste et un statut `active`.
 */
export function parseAttestationResponse(raw: unknown): Result<AttestationResponse, AttestationResponseRefusal> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return refuse("response_not_object")
  const record = raw as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (!RESPONSE_FIELDS.has(key)) return refuse("response_field_not_allowed")
  }
  const { contract, verified, countryOfResidence, postSlug, registrationStatus, since, attestedAt } = record
  if (contract !== ATTESTATION_CONTRACT) return refuse("response_field_invalid")
  if (typeof verified !== "boolean" || !isTimestamp(attestedAt)) return refuse("response_field_invalid")
  if (countryOfResidence !== undefined && (typeof countryOfResidence !== "string" || !isResidenceCountry(countryOfResidence))) {
    return refuse("response_field_invalid")
  }
  if (postSlug !== undefined && (typeof postSlug !== "string" || !POST_SLUG.test(postSlug))) {
    return refuse("response_field_invalid")
  }
  if (typeof registrationStatus !== "string" || !(REGISTRATION_STATUSES as readonly string[]).includes(registrationStatus)) {
    return refuse("response_field_invalid")
  }
  if (since !== undefined && !isTimestamp(since)) return refuse("response_field_invalid")
  if (verified && (countryOfResidence === undefined || postSlug === undefined || registrationStatus !== "active")) {
    return refuse("response_incoherent")
  }
  if (!verified && registrationStatus === "active") return refuse("response_incoherent")
  return ok({
    verified,
    attestedAt,
    registrationStatus: registrationStatus as RegistrationStatus,
    ...(countryOfResidence !== undefined ? { countryOfResidence: countryOfResidence as CountryCode } : {}),
    ...(postSlug !== undefined ? { postSlug } : {}),
    ...(since !== undefined ? { since } : {}),
  })
}

// ═══════════════════════════════════════════════════════════════
// La requête signée (contrat §3.1 et §3.2), côté consommateur
// ═══════════════════════════════════════════════════════════════

/** Le chemin de la route du contrat chez consulat.ga. */
export const ATTESTATION_PATH = "/api/partner/diaspora/attestation"

/** En-têtes de la signature HMAC du contrat. */
export const ATTESTATION_HEADERS = Object.freeze({
  keyId: "x-diaspora-key-id",
  timestamp: "x-diaspora-timestamp",
  signature: "x-diaspora-signature",
})

/** Référence de consentement admise par le contrat : 8 à 128 caractères `[A-Za-z0-9:_-]`. */
export const CONSENT_REF_PATTERN = /^[A-Za-z0-9:_-]{8,128}$/

/**
 * La chaîne canonique signée : `v1`, l'horodatage (millisecondes Unix), la
 * méthode, le chemin, puis l'empreinte SHA-256 hexadécimale minuscule du corps brut.
 */
export function canonicalAttestationString(input: { readonly timestamp: string; readonly bodySha256: string }): string {
  return ["v1", input.timestamp, "POST", ATTESTATION_PATH, input.bodySha256].join("\n")
}

/** Le corps de la requête : les quatre champs du contrat, dans son ordre — et rien d'autre. */
export function attestationRequestBody(request: AttestationRequest): string {
  return JSON.stringify({
    subjectKind: request.subjectKind,
    subject: request.subject,
    consentRef: request.consentRef,
    requestedAt: request.requestedAt,
  })
}

/** Une demande d'attestation par 24 h et par personne (PD3, point 4). */
export const ATTESTATION_REQUEST_INTERVAL_MS = 24 * 60 * 60 * 1000

export function canRequestAttestation(lastRequestedAt: number | null, now: number): boolean {
  return lastRequestedAt === null || now - lastRequestedAt >= ATTESTATION_REQUEST_INTERVAL_MS
}

/**
 * Ce que l'interface dit d'une réponse. Le refus ou l'absence est expliqué SANS
 * la raison consulaire (EXF-DG-03) : « nous n'avons pas pu confirmer ».
 */
export type AttestationOutcome = "verified" | "not_confirmed"

export function attestationOutcome(response: AttestationResponse): AttestationOutcome {
  return response.verified ? "verified" : "not_confirmed"
}
