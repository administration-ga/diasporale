/**
 * Magasin du fournisseur de DÉMONSTRATION — l'état fictif, sa persistance
 * locale (ce navigateur seulement) et ses écritures.
 *
 * Chaque écriture applique les règles de `@diasporale/domain`, dans l'ordre que
 * le moteur appliquera : session → adhésion → éligibilité (capacité du statut)
 * → droit sur la ressource. Les refus rendent un code FERMÉ, jamais une
 * exception. Cette implémentation disparaît au câblage du moteur (PD2/PD4) :
 * l'interface (`DiasporaleDataSource`) reste.
 */
import {
  applyAttestationToFacet,
  applyMembershipEvent,
  canCompleteOnboarding,
  canRequestAttestation,
  capabilitiesOf,
  checkSponsorship,
  checkSponsorshipRevocation,
  consentRecord,
  deriveMembershipStatus,
  hasCapability,
  isConsentActive,
  onboardingConsentRecords,
  parseAttestationResponse,
  parseContentScope,
  parseFacetInput,
  publicationPolicy,
  initialModerationState,
  resolveVisibility,
  type AttestationOutcome,
  type ConsentPurpose,
  type ContentModerationState,
  type CountryCode,
  type DirectoryVisibility,
  type FacetInput,
  type MembershipEvent,
  type MembershipGrounds,
} from "@diasporale/domain"

import type { ActionErrorCode } from "../data/errors"
import type { ActionResult, CodeDestination, IdnSignInInput, JoinInput, PublishInput } from "../data/port"
import type { ReactionKind } from "../data/types"
import { handleRefusal, handleToken, normalizeHandle } from "../lib/handle"
import { emailHash, fakeConsularAttestation } from "./attestation-provider"
import { isConnected, sponsorFacts, statusOf } from "./selectors"
import { DEMO_STATE_VERSION, createDemoSeed, type DemoMembership, type DemoPerson, type DemoState } from "./state"

export const DEMO_STORAGE_KEY = "diasporale:demonstration:v1"
export const POST_MAX_LENGTH = 2000
export const DISPLAY_NAME_MIN = 2
export const DISPLAY_NAME_MAX = 60
const CODE_TTL_MS = 10 * 60 * 1000

const OK: ActionResult = { ok: true, value: null }
const fail = (code: ActionErrorCode): ActionResult<never> => ({ ok: false, code })

/** Sujet IDN de démonstration, dérivé du nom (le vrai `sub` vient d'IDN). */
export function demoIdnSub(firstName: string, lastName: string): string {
  return `idn-demo-${handleToken(firstName)}-${handleToken(lastName)}`
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE = /^\+?[0-9 ().-]{8,20}$/

export function isValidDestination(destination: CodeDestination): boolean {
  const value = destination.value.trim()
  return destination.kind === "email" ? EMAIL.test(value) : PHONE.test(value) && value.replace(/\D/g, "").length >= 8
}

export class DemoStore {
  private state: DemoState
  private version = 0
  private readonly listeners = new Set<() => void>()

  constructor(
    private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null,
    private readonly clock: () => number = Date.now,
    private readonly latencyMs = 220,
  ) {
    this.state = this.load()
  }

  // ── Abonnement (useSyncExternalStore) ─────────────────────────────────
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getVersion = (): number => this.version

  getState(): DemoState {
    return this.state
  }

  now(): number {
    return this.clock()
  }

  private load(): DemoState {
    try {
      const raw = this.storage?.getItem(DEMO_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as DemoState
        if (parsed.version === DEMO_STATE_VERSION) return parsed
      }
    } catch {
      // Stockage illisible ou bloqué : on repart du jeu de démonstration.
    }
    return createDemoSeed(this.clock())
  }

  private commit(next: DemoState): void {
    this.state = next
    this.version += 1
    try {
      this.storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Stockage plein ou interdit : la démonstration continue en mémoire.
    }
    for (const listener of this.listeners) listener()
  }

  private async pause(): Promise<void> {
    if (this.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, this.latencyMs))
  }

  private nextId(prefix: string): [string, number] {
    return [`${prefix}-${this.state.sequence}`, this.state.sequence + 1]
  }

  private viewer(): { person: DemoPerson; membership: DemoMembership | undefined } | null {
    const personId = this.state.session.personId
    const person = personId ? this.state.persons[personId] : undefined
    return person ? { person, membership: this.state.memberships[person.id] } : null
  }

  /** Applique un évènement d'adhésion et tient `verifiedSince` (date d'entrée en `verifiee`). */
  private withEvent(membership: DemoMembership, event: MembershipEvent, now: number): DemoMembership | null {
    const result = applyMembershipEvent(membership.grounds, event, now)
    if (!result.ok) return null
    const becameVerified = result.value.status === "verifiee" && result.value.previous !== "verifiee"
    const lostVerified = result.value.status !== "verifiee" && result.value.previous === "verifiee"
    return {
      ...membership,
      grounds: result.value.grounds,
      verifiedSince: becameVerified ? now : lostVerified ? null : membership.verifiedSince,
    }
  }

  // ── Entrée ─────────────────────────────────────────────────────────────
  async signInWithIdn(input: IdnSignInInput): Promise<ActionResult> {
    await this.pause()
    const firstName = input.firstName.trim()
    const lastName = input.lastName.trim()
    if (!firstName || !lastName || !Number.isInteger(input.loa) || input.loa < 0 || input.loa > 4) {
      return fail("idn_invalid")
    }
    const sub = demoIdnSub(firstName, lastName)
    const existing = Object.values(this.state.persons).find((person) => person.idn?.sub === sub)
    const now = this.clock()
    if (existing) {
      this.commit({ ...this.state, session: { personId: existing.id } })
      return OK
    }
    const [id, sequence] = this.nextId("p")
    const person: DemoPerson = {
      id,
      idn: { sub, loa: input.loa, gaboneseNationality: input.gaboneseNationality, firstName, lastName },
      local: null,
      // Aucun profil créé d'office : il naîtra de l'onboarding, avec consentement.
      profile: null,
      administrationLink: false,
      createdAt: now,
      demoAccountKey: null,
    }
    this.commit({ ...this.state, persons: { ...this.state.persons, [id]: person }, session: { personId: id }, sequence })
    return OK
  }

  async requestCode(destination: CodeDestination): Promise<ActionResult<{ demoCode: string | null }>> {
    await this.pause()
    if (!isValidDestination(destination)) return fail(destination.kind === "email" ? "email_invalid" : "phone_invalid")
    const code = String(Math.floor(100000 + Math.random() * 900000))
    this.commit({
      ...this.state,
      pendingCode: { kind: destination.kind, value: destination.value.trim(), code, expiresAt: this.clock() + CODE_TTL_MS },
    })
    // En démonstration, le code s'affiche à l'écran ; en production il part par e-mail ou SMS.
    return { ok: true, value: { demoCode: code } }
  }

  async verifyCode(code: string): Promise<ActionResult> {
    await this.pause()
    const pending = this.state.pendingCode
    const now = this.clock()
    if (!pending || pending.expiresAt < now) return fail("code_expired")
    if (code.replace(/\s/g, "") !== pending.code) return fail("code_invalid")
    const existing = Object.values(this.state.persons).find(
      (person) => person.local?.kind === pending.kind && person.local.value.toLowerCase() === pending.value.toLowerCase(),
    )
    if (existing) {
      this.commit({ ...this.state, pendingCode: null, session: { personId: existing.id } })
      return OK
    }
    const [id, sequence] = this.nextId("p")
    const person: DemoPerson = {
      id,
      idn: null,
      local: { kind: pending.kind, value: pending.value },
      profile: null,
      administrationLink: false,
      createdAt: now,
      demoAccountKey: null,
    }
    this.commit({
      ...this.state,
      persons: { ...this.state.persons, [id]: person },
      pendingCode: null,
      session: { personId: id },
      sequence,
    })
    return OK
  }

  async signOutEverywhere(): Promise<void> {
    await this.pause()
    this.commit({ ...this.state, session: { personId: null }, pendingCode: null })
  }

  // ── Onboarding ─────────────────────────────────────────────────────────
  async checkHandle(raw: string): Promise<ActionResult<{ available: boolean }>> {
    const refusal = handleRefusal(raw)
    if (refusal) return fail(refusal)
    const handle = normalizeHandle(raw)
    const viewerId = this.state.session.personId
    const taken = Object.values(this.state.persons).some((person) => person.profile?.handle === handle && person.id !== viewerId)
    return { ok: true, value: { available: !taken } }
  }

  async join(input: JoinInput): Promise<ActionResult<{ country: CountryCode }>> {
    await this.pause()
    const viewer = this.viewer()
    if (!viewer) return fail("not_signed_in")
    const now = this.clock()
    if (viewer.membership && deriveMembershipStatus(viewer.membership.grounds, now) !== "partie") return fail("already_member")
    const facet = parseFacetInput(input.facet, now)
    if (!facet.ok) return fail(facet.code)
    const handleCheck = await this.checkHandle(input.handle)
    if (!handleCheck.ok) return fail(handleCheck.code)
    if (!handleCheck.value.available) return fail("handle_taken")
    const displayName = input.displayName.trim().replace(/\s+/g, " ")
    if (displayName.length < DISPLAY_NAME_MIN || displayName.length > DISPLAY_NAME_MAX) return fail("display_name_invalid")
    if (!canCompleteOnboarding(input.consents)) return fail("consent_social_profile_required")

    const grounds: MembershipGrounds = {
      idn: viewer.person.idn
        ? { loa: viewer.person.idn.loa, gaboneseNationality: viewer.person.idn.gaboneseNationality }
        : null,
      sponsored: false,
      consularAttestation: false,
      suspension: null,
      leftAt: null,
    }
    const status = deriveMembershipStatus(grounds, now)
    const directoryVisibility: DirectoryVisibility = input.consents.directory ? input.directoryVisibility : "hidden"
    const membership: DemoMembership = {
      personId: viewer.person.id,
      grounds,
      joinedAt: now,
      verifiedSince: status === "verifiee" ? now : null,
      facet: facet.value,
      directoryVisibility,
      attestation: { outcome: "none", postSlug: null, requestedAt: null },
    }
    const person: DemoPerson = {
      ...viewer.person,
      profile: { handle: normalizeHandle(input.handle), displayName, headline: null },
    }
    this.commit({
      ...this.state,
      persons: { ...this.state.persons, [person.id]: person },
      memberships: { ...this.state.memberships, [person.id]: membership },
      consents: [
        ...this.state.consents,
        ...onboardingConsentRecords(input.consents, now).map((record) => ({ ...record, personId: person.id })),
      ],
    })
    return { ok: true, value: { country: facet.value.countryOfResidence } }
  }

  // ── Contenus ───────────────────────────────────────────────────────────
  async publish(input: PublishInput): Promise<ActionResult<{ moderation: ContentModerationState }>> {
    await this.pause()
    const viewer = this.viewer()
    if (!viewer?.membership) return fail("not_member")
    const now = this.clock()
    const status = deriveMembershipStatus(viewer.membership.grounds, now)
    if (!capabilitiesOf(status).has("publish")) return fail("publish_not_allowed")
    const body = input.body.trim()
    if (body.length === 0) return fail("post_empty")
    if (body.length > POST_MAX_LENGTH) return fail("post_too_long")
    // Un contenu local porte le pays choisi (par défaut celui de l'auteur) ; un
    // contenu diaspora garde ce pays comme ORIGINE (pastille dans les autres hubs).
    const scope = parseContentScope({
      reach: input.reach,
      country: input.country ?? viewer.membership.facet.countryOfResidence,
    })
    if (!scope.ok) return fail(scope.code)
    const policy = publicationPolicy({
      scope: scope.value,
      openCountries: this.state.openCountries,
      countryActiveModerators: scope.value.reach === "local" ? (this.state.countryModerators[scope.value.country] ?? 0) : 0,
      networkActiveModerators: this.state.networkModerators,
    })
    const moderation = initialModerationState(policy)
    const [id, sequence] = this.nextId("post")
    this.commit({
      ...this.state,
      posts: [
        {
          id,
          author: { kind: "person", id: viewer.person.id },
          body,
          scope: scope.value,
          audience: input.audience,
          visibility: resolveVisibility({ audience: input.audience, alsoOnRoot: input.alsoOnRoot }),
          moderation,
          createdAt: now,
          reactions: {},
          baseReactions: 0,
          commentCount: 0,
        },
        ...this.state.posts,
      ],
      sequence,
    })
    return { ok: true, value: { moderation } }
  }

  async react(postId: string, kind: ReactionKind | null): Promise<ActionResult> {
    const viewer = this.viewer()
    if (!viewer?.membership) return fail("not_member")
    const status = deriveMembershipStatus(viewer.membership.grounds, this.clock())
    if (!capabilitiesOf(status).has("publish")) return fail("publish_not_allowed")
    const post = this.state.posts.find((candidate) => candidate.id === postId)
    if (!post) return fail("not_found")
    const reactions = { ...post.reactions }
    if (kind === null) delete reactions[viewer.person.id]
    else reactions[viewer.person.id] = kind
    this.commit({
      ...this.state,
      posts: this.state.posts.map((candidate) => (candidate.id === postId ? { ...candidate, reactions } : candidate)),
    })
    return OK
  }

  // ── Relations (EXF-DG-11, EXF-DG-12) ─────────────────────────────────────
  /** Un autre membre ACTIF du réseau (ni soi, ni parti), désigné par son identifiant interne. */
  private memberTarget(personId: string, viewerId: string): DemoPerson | null {
    const target = this.state.persons[personId]
    const membership = target ? this.state.memberships[target.id] : undefined
    if (!target?.profile || !membership || target.id === viewerId) return null
    const status = deriveMembershipStatus(membership.grounds, this.clock())
    return status === "partie" || status === "suspendue" ? null : target
  }

  private blockedBetween(a: string, b: string): boolean {
    return this.state.blocks.some((block) => (block.byId === a && block.targetId === b) || (block.byId === b && block.targetId === a))
  }

  /** Le membre de la session, quand son statut lui permet d'échanger (déclaré ou vérifié). */
  private communicatingViewer(): ActionResult<DemoPerson> {
    const viewer = this.viewer()
    if (!viewer) return fail("not_signed_in")
    if (!viewer.membership) return fail("not_member")
    if (!hasCapability(deriveMembershipStatus(viewer.membership.grounds, this.clock()), "communicate")) return fail("status_insufficient")
    return { ok: true, value: viewer.person }
  }

  async connect(personId: string): Promise<ActionResult> {
    await this.pause()
    const viewer = this.communicatingViewer()
    if (!viewer.ok) return viewer
    const target = this.memberTarget(personId, viewer.value.id)
    if (!target) return fail("not_found")
    // Bloqué dans un sens ou dans l'autre : la même réponse qu'une demande envoyée, sans rien écrire.
    if (this.blockedBetween(viewer.value.id, target.id)) return OK
    const known =
      isConnected(this.state, viewer.value.id, target.id) ||
      this.state.connectionRequests.some(
        (request) => (request.fromId === viewer.value.id && request.toId === target.id) || (request.fromId === target.id && request.toId === viewer.value.id),
      )
    if (known) return OK
    const [id, sequence] = this.nextId("cr")
    this.commit({
      ...this.state,
      connectionRequests: [...this.state.connectionRequests, { id, fromId: viewer.value.id, toId: target.id, createdAt: this.clock() }],
      sequence,
    })
    return OK
  }

  async respondToConnection(connectionId: string, accept: boolean): Promise<ActionResult> {
    await this.pause()
    const viewer = this.communicatingViewer()
    if (!viewer.ok) return viewer
    // Seul le DESTINATAIRE répond ; pour tout autre, la demande n'existe pas.
    const request = this.state.connectionRequests.find((item) => item.id === connectionId && item.toId === viewer.value.id)
    if (!request) return fail("not_found")
    this.commit({
      ...this.state,
      connectionRequests: this.state.connectionRequests.filter((item) => item.id !== request.id),
      connections: accept ? [...this.state.connections, [request.fromId, request.toId] as const] : this.state.connections,
    })
    return OK
  }

  async follow(rawHandle: string): Promise<ActionResult> {
    await this.pause()
    const viewer = this.communicatingViewer()
    if (!viewer.ok) return viewer
    const handle = normalizeHandle(rawHandle)
    const person = Object.values(this.state.persons).find((candidate) => candidate.profile?.handle === handle)
    const target = person ? this.memberTarget(person.id, viewer.value.id) : null
    // Inconnu, soi-même ou bloqué : le même refus.
    if (!target || this.blockedBetween(viewer.value.id, target.id)) return fail("not_found")
    if (this.state.follows.some(([follower, followed]) => follower === viewer.value.id && followed === target.id)) return OK
    this.commit({ ...this.state, follows: [...this.state.follows, [viewer.value.id, target.id] as const] })
    return OK
  }

  async unfollow(personId: string): Promise<ActionResult> {
    await this.pause()
    const viewer = this.viewer()
    if (!viewer) return fail("not_signed_in")
    this.commit({ ...this.state, follows: this.state.follows.filter(([follower, followed]) => !(follower === viewer.person.id && followed === personId)) })
    return OK
  }

  async block(personId: string): Promise<ActionResult> {
    await this.pause()
    const viewer = this.viewer()
    if (!viewer) return fail("not_signed_in")
    const target = this.state.persons[personId]
    if (!target || target.id === viewer.person.id) return fail("not_found")
    const me = viewer.person.id
    const pair = (a: string, b: string) => (a === me && b === target.id) || (a === target.id && b === me)
    const already = this.state.blocks.some((block) => block.byId === me && block.targetId === target.id)
    const [id, sequence] = this.nextId("bl")
    // Le lien, les demandes et les abonnements de la paire tombent, dans les deux sens.
    this.commit({
      ...this.state,
      connections: this.state.connections.filter(([a, b]) => !pair(a, b)),
      connectionRequests: this.state.connectionRequests.filter((request) => !pair(request.fromId, request.toId)),
      follows: this.state.follows.filter(([a, b]) => !pair(a, b)),
      blocks: already ? this.state.blocks : [...this.state.blocks, { id, byId: me, targetId: target.id, createdAt: this.clock() }],
      sequence: already ? this.state.sequence : sequence,
    })
    return OK
  }

  async unblock(personId: string): Promise<ActionResult> {
    await this.pause()
    const viewer = this.viewer()
    if (!viewer) return fail("not_signed_in")
    this.commit({ ...this.state, blocks: this.state.blocks.filter((block) => !(block.byId === viewer.person.id && block.targetId === personId)) })
    return OK
  }

  // ── Parrainage ─────────────────────────────────────────────────────────
  async sponsor(rawHandle: string): Promise<ActionResult> {
    await this.pause()
    const viewer = this.viewer()
    if (!viewer?.membership) return fail("not_member")
    const now = this.clock()
    const handle = normalizeHandle(rawHandle)
    const target = Object.values(this.state.persons).find((person) => person.profile?.handle === handle)
    const targetMembership = target ? this.state.memberships[target.id] : undefined
    const facts = sponsorFacts(this.state, viewer.person.id, now)
    const check = checkSponsorship(
      facts,
      {
        isSelf: target?.id === viewer.person.id,
        // Cible introuvable : refus INDISTINCT, comme une cible non admissible.
        status: targetMembership ? deriveMembershipStatus(targetMembership.grounds, now) : "partie",
        alreadySponsored: targetMembership?.grounds.sponsored ?? false,
      },
      now,
    )
    if (!check.ok) return fail(check.code)
    if (!target || !targetMembership) return fail("target_not_eligible")
    const updated = this.withEvent(targetMembership, { kind: "sponsored" }, now)
    if (!updated) return fail("target_not_eligible")
    const [id, sequence] = this.nextId("s")
    this.commit({
      ...this.state,
      memberships: { ...this.state.memberships, [target.id]: updated },
      sponsorships: [
        ...this.state.sponsorships,
        { id, sponsorId: viewer.person.id, sponsoredId: target.id, createdAt: now, revokedAt: null },
      ],
      sequence,
    })
    return OK
  }

  async revokeSponsorship(sponsorshipId: string): Promise<ActionResult> {
    await this.pause()
    const viewer = this.viewer()
    const sponsorship = this.state.sponsorships.find((item) => item.id === sponsorshipId)
    if (!viewer || !sponsorship) return fail("not_found")
    const check = checkSponsorshipRevocation({
      actor: sponsorship.sponsorId === viewer.person.id ? "sponsor" : "other",
      revokedAt: sponsorship.revokedAt,
    })
    if (!check.ok) return fail(check.code)
    const now = this.clock()
    const sponsored = this.state.memberships[sponsorship.sponsoredId]
    const updated = sponsored ? this.withEvent(sponsored, { kind: "sponsorship_revoked" }, now) : null
    this.commit({
      ...this.state,
      memberships: updated ? { ...this.state.memberships, [sponsorship.sponsoredId]: updated } : this.state.memberships,
      sponsorships: this.state.sponsorships.map((item) => (item.id === sponsorshipId ? { ...item, revokedAt: now } : item)),
    })
    return OK
  }

  // ── Attestation consulaire (fournisseur factice, contrat V1) ───────────
  async requestAttestation(): Promise<ActionResult<{ outcome: AttestationOutcome }>> {
    await this.pause()
    const viewer = this.viewer()
    if (!viewer?.membership) return fail("not_member")
    const now = this.clock()
    const status = deriveMembershipStatus(viewer.membership.grounds, now)
    if (!capabilitiesOf(status).has("request_attestation")) return fail("attestation_not_needed")
    if (!canRequestAttestation(viewer.membership.attestation.requestedAt, now)) return fail("attestation_too_soon")
    const subject = viewer.person.idn
      ? { subjectKind: "idnSub" as const, subject: viewer.person.idn.sub }
      : viewer.person.local?.kind === "email"
        ? { subjectKind: "emailHash" as const, subject: await emailHash(viewer.person.local.value) }
        : null
    if (!subject) return fail("attestation_unavailable")
    // Le consentement est enregistré AVANT la requête (PD3, point 4).
    const consent = consentRecord("consular_attestation", true, now, "attestation_request")
    const raw = await fakeConsularAttestation({ ...subject, consentRef: `consent-${now}`, requestedAt: now }, now)
    const response = parseAttestationResponse(raw)
    const outcome: AttestationOutcome = response.ok && response.value.verified ? "verified" : "not_confirmed"
    let membership: DemoMembership = {
      ...viewer.membership,
      attestation: { ...viewer.membership.attestation, outcome, requestedAt: now },
    }
    if (response.ok && response.value.verified && response.value.postSlug && response.value.countryOfResidence) {
      const withEvent = membership.grounds.consularAttestation ? membership : this.withEvent(membership, { kind: "attestation_confirmed" }, now)
      if (withEvent) {
        membership = {
          ...withEvent,
          facet: applyAttestationToFacet(withEvent.facet, {
            postSlug: response.value.postSlug,
            countryOfResidence: response.value.countryOfResidence,
          }),
          attestation: { outcome, postSlug: response.value.postSlug, requestedAt: now },
        }
      }
    }
    this.commit({
      ...this.state,
      memberships: { ...this.state.memberships, [viewer.person.id]: membership },
      consents: [...this.state.consents, { ...consent, personId: viewer.person.id }],
    })
    return { ok: true, value: { outcome } }
  }

  // ── Paramètres, consentements, données ─────────────────────────────────
  async setConsent(purpose: ConsentPurpose, granted: boolean): Promise<ActionResult> {
    await this.pause()
    const viewer = this.viewer()
    if (!viewer?.membership) return fail("not_member")
    const now = this.clock()
    let membership = viewer.membership
    if (purpose === "social_profile" && !granted) {
      // Retirer le consentement au profil social, c'est quitter DIASPORALE.
      const left = this.withEvent(membership, { kind: "left", at: now }, now)
      if (!left) return fail("not_member")
      membership = left
    }
    if (purpose === "directory" && !granted) membership = { ...membership, directoryVisibility: "hidden" }
    this.commit({
      ...this.state,
      memberships: { ...this.state.memberships, [viewer.person.id]: membership },
      consents: [...this.state.consents, { ...consentRecord(purpose, granted, now, "settings"), personId: viewer.person.id }],
    })
    return OK
  }

  async updateFacet(input: FacetInput): Promise<ActionResult> {
    await this.pause()
    const viewer = this.viewer()
    if (!viewer?.membership) return fail("not_member")
    const facet = parseFacetInput(input, this.clock(), viewer.membership.facet)
    if (!facet.ok) return fail(facet.code)
    this.commit({
      ...this.state,
      memberships: { ...this.state.memberships, [viewer.person.id]: { ...viewer.membership, facet: facet.value } },
    })
    return OK
  }

  async setDirectoryVisibility(level: DirectoryVisibility): Promise<ActionResult> {
    await this.pause()
    const viewer = this.viewer()
    if (!viewer?.membership) return fail("not_member")
    const records = this.state.consents.filter((record) => record.personId === viewer.person.id)
    if (level !== "hidden" && !isConsentActive(records, "directory")) return fail("consent_directory_required")
    this.commit({
      ...this.state,
      memberships: { ...this.state.memberships, [viewer.person.id]: { ...viewer.membership, directoryVisibility: level } },
    })
    return OK
  }

  async exportMyData(): Promise<ActionResult<string>> {
    await this.pause()
    const viewer = this.viewer()
    if (!viewer) return fail("not_signed_in")
    const personId = viewer.person.id
    const data = {
      exportedAt: new Date(this.clock()).toISOString(),
      demonstration: true,
      person: viewer.person,
      membership: viewer.membership ?? null,
      consents: this.state.consents.filter((record) => record.personId === personId),
      sponsorships: this.state.sponsorships.filter((item) => item.sponsorId === personId || item.sponsoredId === personId),
      posts: this.state.posts.filter((post) => post.author.kind === "person" && post.author.id === personId),
    }
    return { ok: true, value: JSON.stringify(data, null, 2) }
  }

  /**
   * Effacement (R9) : la personne, son adhésion, ses consentements, ses
   * parrainages, ses publications et ses réactions disparaissent. Les
   * parrainages qu'elle avait donnés sont retirés (le filleul retombe selon ses
   * faits restants).
   */
  async deleteMyAccount(): Promise<ActionResult> {
    await this.pause()
    const viewer = this.viewer()
    if (!viewer) return fail("not_signed_in")
    const personId = viewer.person.id
    const now = this.clock()
    const memberships: Record<string, DemoMembership> = { ...this.state.memberships }
    delete memberships[personId]
    for (const sponsorship of this.state.sponsorships) {
      if (sponsorship.sponsorId !== personId || sponsorship.revokedAt !== null) continue
      const sponsored = memberships[sponsorship.sponsoredId]
      const updated = sponsored ? this.withEvent(sponsored, { kind: "sponsorship_revoked" }, now) : null
      if (updated) memberships[sponsorship.sponsoredId] = updated
    }
    const persons: Record<string, DemoPerson> = { ...this.state.persons }
    delete persons[personId]
    this.commit({
      ...this.state,
      persons,
      memberships,
      consents: this.state.consents.filter((record) => record.personId !== personId),
      sponsorships: this.state.sponsorships.filter((item) => item.sponsorId !== personId && item.sponsoredId !== personId),
      posts: this.state.posts
        .filter((post) => !(post.author.kind === "person" && post.author.id === personId))
        .map((post) => {
          if (!(personId in post.reactions)) return post
          const reactions = { ...post.reactions }
          delete reactions[personId]
          return { ...post, reactions }
        }),
      connections: this.state.connections.filter(([a, b]) => a !== personId && b !== personId),
      connectionRequests: this.state.connectionRequests.filter((request) => request.fromId !== personId && request.toId !== personId),
      blocks: this.state.blocks.filter((block) => block.byId !== personId && block.targetId !== personId),
      follows: this.state.follows.filter(([a, b]) => a !== personId && b !== personId),
      session: { personId: null },
    })
    return OK
  }

  // ── Démonstration ──────────────────────────────────────────────────────
  async switchTo(personId: string): Promise<void> {
    if (!this.state.persons[personId]) return
    this.commit({ ...this.state, session: { personId } })
  }

  async reset(): Promise<void> {
    try {
      this.storage?.removeItem(DEMO_STORAGE_KEY)
    } catch {
      // ignoré : la remise à zéro en mémoire suffit
    }
    this.commit(createDemoSeed(this.clock()))
  }

  /** Statut courant (tests, diagnostics). */
  statusOf(personId: string) {
    return statusOf(this.state, personId, this.clock())
  }
}
