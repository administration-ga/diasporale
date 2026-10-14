/**
 * Fournisseur d'attestation consulaire FACTICE — pour le développement et la
 * démonstration, jamais pour la production.
 *
 * Il répond comme le ferait consulat.ga selon le contrat
 * `DIASPORA-ATTESTATION-V1` (`@diasporale/domain/attestation`), à partir d'un
 * registre FICTIF de trois sujets. Il ne connaît ni nom, ni passeport, ni NIP,
 * ni date de naissance : uniquement un booléen, un pays, un poste, un statut,
 * deux dates. Le moteur relit sa réponse avec `parseAttestationResponse`
 * exactement comme il relira celle du vrai service (PD3).
 */
import type { AttestationRequest, CountryCode, RegistrationStatus } from "@diasporale/domain"

interface FakeRegistration {
  readonly country: CountryCode
  readonly postSlug: string
  readonly status: RegistrationStatus
  readonly sinceYear: number
}

/** Sujets fictifs : identifiants IDN de démonstration et empreintes d'adresses `example.com`. */
const FAKE_REGISTRY_BY_IDN_SUB: Readonly<Record<string, FakeRegistration>> = {
  "idn-demo-awa-ogooue": { country: "FR", postSlug: "poste-demo-france", status: "active", sinceYear: 2023 },
  "idn-demo-yannick-nyanga": { country: "FR", postSlug: "poste-demo-france", status: "expired", sinceYear: 2019 },
}

const FAKE_REGISTERED_EMAILS: Readonly<Record<string, FakeRegistration>> = {
  "inscrite@example.com": { country: "BE", postSlug: "poste-demo-belgique", status: "active", sinceYear: 2022 },
}

/** Empreinte d'adresse : SHA-256 de l'adresse normalisée — jamais l'adresse en clair dans la requête. */
export async function emailHash(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.trim().toLowerCase())
  const digest = await crypto.subtle.digest("SHA-256", data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

let emailIndex: Promise<Map<string, FakeRegistration>> | null = null

function hashedEmailRegistry(): Promise<Map<string, FakeRegistration>> {
  emailIndex ??= Promise.all(
    Object.entries(FAKE_REGISTERED_EMAILS).map(async ([email, registration]) => [await emailHash(email), registration] as const),
  ).then((entries) => new Map(entries))
  return emailIndex
}

/**
 * La réponse brute (JSON) du faux service. Volontairement typée `unknown` côté
 * appelant : elle passe par `parseAttestationResponse`, comme une vraie réponse.
 */
export async function fakeConsularAttestation(request: AttestationRequest, now: number): Promise<unknown> {
  const registration =
    request.subjectKind === "idnSub"
      ? FAKE_REGISTRY_BY_IDN_SUB[request.subject]
      : (await hashedEmailRegistry()).get(request.subject)
  if (registration === undefined) return { verified: false, registrationStatus: "none", attestedAt: now }
  if (registration.status !== "active") {
    return { verified: false, registrationStatus: registration.status, attestedAt: now }
  }
  return {
    verified: true,
    countryOfResidence: registration.country,
    postSlug: registration.postSlug,
    registrationStatus: "active",
    since: Date.UTC(registration.sinceYear, 0, 15),
    attestedAt: now,
  }
}
