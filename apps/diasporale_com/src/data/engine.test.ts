import type { EngineAuthClient } from "@antsia/api/auth-client"
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { describe, expect, it, vi } from "vitest"

import { authActionErrorCode, engineActionErrorCode } from "./engine-errors"
import { createEngineActions, feedRequest } from "./engine-source"
import {
  toBookmarkView,
  toCommentThreadView,
  toDeclaredMedia,
  toFacetArgs,
  toFeed,
  toMemberHitView,
  toMembershipView,
  toNotificationView,
  toOpenCountries,
  toPostMediaView,
  toSharedPostView,
  toProfileView,
  toRelationView,
  toSuggestionView,
  toWall,
} from "./engine-views"

/**
 * La source « moteur » sans moteur : traduction des refus, projections pures, et
 * écritures jouées contre un client Convex et un client Better Auth FACTICES
 * (aucune donnée réelle : adresses en @exemple.test).
 */

function engineError(data: Record<string, unknown>) {
  return new ConvexError(data as never)
}

describe("traduction des refus du moteur en codes fermés", () => {
  it("un refus métier de la tranche passe tel quel s'il est connu de DIASPORALE", () => {
    expect(engineActionErrorCode(engineError({ code: "policyRefused", appRule: "sponsor_too_recent", appParams: { availableAt: 1 } }))).toBe(
      "sponsor_too_recent",
    )
    expect(engineActionErrorCode(engineError({ code: "invalidArgument", appRule: "country_is_home" }))).toBe("country_is_home")
    // Un code d'application inconnu retombe sur le code du moteur.
    expect(engineActionErrorCode(engineError({ code: "policyRefused", appRule: "regle_inconnue" }))).toBe("unknown")
  })

  it("les règles du domaine du moteur que DIASPORALE sait dire, puis les codes du moteur", () => {
    expect(engineActionErrorCode(engineError({ code: "invalidArgument", rule: "HANDLE_LENGTH", params: { min: 3, max: 30 } }))).toBe("handle_length")
    expect(engineActionErrorCode(engineError({ code: "invalidArgument", rule: "POST_EMPTY" }))).toBe("post_empty")
    expect(engineActionErrorCode(engineError({ code: "notFound" }))).toBe("not_found")
    expect(engineActionErrorCode(engineError({ code: "rateLimited", retryAfterMs: 1000 }))).toBe("rate_limited")
    expect(engineActionErrorCode(engineError({ code: "membershipSuspended" }))).toBe("suspended")
    expect(engineActionErrorCode(engineError({ code: "handleUnavailable" }))).toBe("handle_taken")
  })

  it("tout le reste est `unknown` : jamais une phrase du serveur", () => {
    expect(engineActionErrorCode(engineError({ code: "codeFutur" }))).toBe("unknown")
    expect(engineActionErrorCode(new Error("Server Error: détail interne"))).toBe("unknown")
    expect(engineActionErrorCode(null)).toBe("unknown")
  })

  it("les refus de Better Auth (codes à usage unique)", () => {
    expect(authActionErrorCode({ code: "INVALID_OTP" })).toBe("code_invalid")
    expect(authActionErrorCode({ code: "OTP_EXPIRED" })).toBe("code_expired")
    expect(authActionErrorCode({ code: "TOO_MANY_ATTEMPTS" })).toBe("too_many_attempts")
    expect(authActionErrorCode({ code: "otpDeliveryUnavailable" })).toBe("delivery_unavailable")
    expect(authActionErrorCode({ status: 429 })).toBe("rate_limited")
    expect(authActionErrorCode({ code: "AUTRE" })).toBe("unknown")
    expect(authActionErrorCode(null)).toBe("unknown")
  })
})

const PERSON = { _id: "p1", handle: "ada", displayName: "Ada", published: true, private: false, badges: [], consentsInForce: [] } as never

const MEMBERSHIP = {
  status: "declaree",
  role: "member",
  joinedAt: 1,
  verifiedSince: null,
  facet: { countryOfResidence: "FR", city: "Lyon", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  directoryVisibility: "hidden",
  sponsoredBy: { handle: "parrain", displayName: "Parrain" },
  attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { status: "declaree" },
  badges: ["community"],
  capabilities: ["read_network", "publish"],
  rateTier: "reinforced",
} as const

describe("projections du moteur vers les vues de DIASPORALE", () => {
  it("l'adhésion de la session, avec l'adhésion ANTSIA dérivée", () => {
    expect(toMembershipView(PERSON, MEMBERSHIP as never)).toMatchObject({
      personId: "p1",
      handle: "ada",
      status: "declaree",
      facet: { countryOfResidence: "FR", city: "Lyon" },
      root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" },
      canPublish: true,
      sponsoredBy: { handle: "parrain", displayName: "Parrain" },
    })
  })

  it("sans facette lisible ou sans profil, pas d'adhésion à montrer (l'accueil reprend la main)", () => {
    expect(toMembershipView(PERSON, { ...MEMBERSHIP, facet: null } as never)).toBeNull()
    expect(toMembershipView(PERSON, { ...MEMBERSHIP, facet: { ...MEMBERSHIP.facet, countryOfResidence: "ZZ" } } as never)).toBeNull()
    expect(toMembershipView({ ...(PERSON as object), handle: undefined } as never, MEMBERSHIP as never)).toBeNull()
  })

  it("les pays ouverts gardent la présentation du serveur, jamais un chiffre recalculé", () => {
    const counters = { dormant: false, members: { kind: "below_threshold", threshold: 20 }, associations: { kind: "value", value: 2 } }
    expect(toOpenCountries([{ country: "FR", open: true, counters, countersComputedAt: 1 } as never, { country: "ZZ" } as never])).toEqual([
      { country: "FR", counters, countersSource: "materialized" },
    ])
  })

  it("une publication du moteur est de portée « diaspora » : elle paraît dans « Mon pays » et « Diaspora », « Pour vous » si elle est à soi", () => {
    const item = (id: string, isMine: boolean) =>
      ({
        _id: id,
        body: "Bonjour",
        media: [],
        share: null,
        shareCount: 0,
        audience: "public",
        visibility: "network",
        publishedAt: 1,
        isMine,
        author: { personId: "p2", handle: null, displayName: null, badges: [] },
        reactions: { counts: { like: 0, bravo: 0, soutien: 0, instructif: 0 }, total: 0, mine: null },
        viewer: { bookmarked: false, notifying: false },
      }) as never
    const items = [item("a", false), item("b", true)]
    expect(toFeed(items, "mon_pays", "FR").map((post) => post.id)).toEqual(["a", "b"])
    expect(toFeed(items, "diaspora", "BE").map((post) => post.id)).toEqual(["a", "b"])
    expect(toFeed(items, "pour_vous", "FR").map((post) => post.id)).toEqual(["b"])
    expect(toFeed(items, "recents", "FR")[0]).toMatchObject({ scope: { reach: "diaspora" }, author: { handle: "", displayName: "" }, moderation: "published" })
  })

  it("le profil : identité publique du moteur et facette projetée ; l'aperçu n'existe que pour soi", () => {
    const profile = { personId: "p2", handle: "ada", displayName: "Ada", headline: null, avatar: { url: null, withheld: null }, cover: { url: null, withheld: null }, badges: ["verified"], isMe: false } as never
    const other = toProfileView(profile, { facet: { countryOfResidence: "FR", city: "Lyon" }, preview: null } as never)
    expect(other).toMatchObject({ handle: "ada", isSelf: false, facet: { countryOfResidence: "FR", city: "Lyon" }, publicFacet: { countryOfResidence: "FR", city: "Lyon" }, posts: [], postName: null })
    const self = toProfileView({ ...(profile as object), isMe: true } as never, { facet: { countryOfResidence: "FR", city: "Lyon" }, preview: { countryOfResidence: "FR" } } as never)
    expect(self).toMatchObject({ isSelf: true, publicFacet: { countryOfResidence: "FR" } })
    // Un pays hors forme est écarté, jamais deviné.
    expect(toProfileView(profile, { facet: { countryOfResidence: "ZZ" }, preview: null } as never).facet).toEqual({})
  })

  it("les images du profil ne délivrent aucune URL retenue par le moteur", () => {
    const profile = { personId: "p2", handle: "ada", displayName: "Ada", headline: null, badges: [], isMe: false }
    const member = { facet: {}, preview: null } as never
    const absent = toProfileView(profile as never, member)
    expect([absent.avatar, absent.cover]).toEqual([null, null])
    const delivered = toProfileView({ ...profile, avatar: { url: "/image-livree", withheld: null }, cover: { url: null, withheld: null } } as never, member)
    expect(delivered.avatar).toEqual({ url: "/image-livree", withheld: null })
    expect(delivered.cover).toBeNull()
    const held = toProfileView({ ...profile, avatar: { url: "/ne-pas-afficher", withheld: "fileScanPending" }, cover: { url: "/ne-pas-afficher", withheld: "fileQuarantined" } } as never, member)
    expect(held.avatar).toEqual({ url: null, withheld: "fileScanPending" })
    expect(held.cover).toEqual({ url: null, withheld: "fileQuarantined" })
  })

  it("la saisie de facette part aux arguments du moteur sans niveau inconnu, listes copiées", () => {
    const ids = ["asso-1"]
    const args = toFacetArgs({ countryOfResidence: "FR", city: null, associationIds: ids, visibility: { city: "country", arrivedAt: "tout le monde" } })
    expect(args).toEqual({ countryOfResidence: "FR", city: null, associationIds: ["asso-1"], visibility: { city: "country" } })
    expect(args.associationIds).not.toBe(ids)
  })
})

/** Un client Convex FACTICE : chaque fonction répond par son nom. */
function fakeConvex(handlers: Record<string, (args: Record<string, unknown>) => unknown>) {
  const calls: { name: string; args: Record<string, unknown> }[] = []
  const run = async (reference: unknown, args: Record<string, unknown> = {}) => {
    const name = getFunctionName(reference as never)
    calls.push({ name, args })
    const handler = handlers[name]
    if (!handler) throw new Error(`fonction non prévue par le test : ${name}`)
    return handler(args)
  }
  return { convex: { query: run, mutation: run } as unknown as ConvexReactClient, calls }
}

const NETWORK = { "modules/networks/networks:getBySlug": () => ({ _id: "n-diasporale", slug: "diasporale" }) }

function fakeAuth(overrides: Partial<Record<"send" | "signIn" | "signOut", () => Promise<unknown>>> = {}) {
  const send = vi.fn(overrides.send ?? (async () => ({ data: { success: true }, error: null })))
  const signIn = vi.fn(overrides.signIn ?? (async () => ({ data: {}, error: null })))
  const signOut = vi.fn(overrides.signOut ?? (async () => ({})))
  const client = { emailOtp: { sendVerificationOtp: send }, signIn: { emailOtp: signIn }, signOut } as unknown as EngineAuthClient
  return { client, send, signIn, signOut }
}

describe("écritures de la source « moteur »", () => {
  it("le code à usage unique : courriel seulement (SMS avec PA4), code de développement relu s'il existe", async () => {
    const { convex, calls } = fakeConvex({ "modules/platform/devTools:latestOtp": () => ({ code: "123456", expiresAt: 2 }) })
    const auth = fakeAuth()
    const actions = createEngineActions({ convex, authClient: auth.client })
    expect(await actions.requestCode({ kind: "phone", value: "+33 6 00 00 00 00" })).toEqual({ ok: false, code: "feature_unavailable" })
    expect(await actions.requestCode({ kind: "email", value: " Ada@Exemple.test " })).toEqual({ ok: true, value: { demoCode: "123456" } })
    expect(auth.send).toHaveBeenCalledWith({ email: "ada@exemple.test", type: "sign-in" })
    expect(calls).toEqual([{ name: "modules/platform/devTools:latestOtp", args: { email: "ada@exemple.test" } }])
    expect(await actions.verifyCode("654321")).toEqual({ ok: true, value: null })
    expect(auth.signIn).toHaveBeenCalledWith({ email: "ada@exemple.test", otp: "654321" })
  })

  it("un code refusé rend son code fermé ; sans envoi préalable, le code a expiré", async () => {
    const { convex } = fakeConvex({ "modules/platform/devTools:latestOtp": () => null })
    const auth = fakeAuth({ signIn: async () => ({ data: null, error: { code: "INVALID_OTP", status: 400 } }) })
    const actions = createEngineActions({ convex, authClient: auth.client })
    expect(await actions.verifyCode("000000")).toEqual({ ok: false, code: "code_expired" })
    await actions.requestCode({ kind: "email", value: "ada@exemple.test" })
    expect(await actions.verifyCode("000000")).toEqual({ ok: false, code: "code_invalid" })
    const refused = createEngineActions({ convex, authClient: fakeAuth({ send: async () => ({ data: null, error: { status: 429 } }) }).client })
    expect(await refused.requestCode({ kind: "email", value: "ada@exemple.test" })).toEqual({ ok: false, code: "rate_limited" })
  })

  it("entrer : profil, consentements accordés seulement, puis l'adhésion par la tranche", async () => {
    const { convex, calls } = fakeConvex({
      ...NETWORK,
      "modules/people/profile:publishMyProfile": () => ({ handle: "ada" }),
      "modules/people/consents:recordConsent": () => null,
      "modules/diaspora/membership:joinDiasporale": () => ({ status: "en_attente", rootStatus: "declaree" }),
    })
    const actions = createEngineActions({ convex, authClient: fakeAuth().client })
    const result = await actions.join({
      facet: { countryOfResidence: "fr", city: "Lyon" },
      handle: "ada",
      displayName: "Ada",
      consents: { social_profile: true, directory: false, notifications: true },
      directoryVisibility: "country",
    })
    expect(result).toEqual({ ok: true, value: { country: "FR" } })
    expect(calls.map((call) => call.name)).toEqual([
      "modules/networks/networks:getBySlug",
      "modules/people/profile:publishMyProfile",
      "modules/people/consents:recordConsent",
      "modules/people/consents:recordConsent",
      "modules/diaspora/membership:joinDiasporale",
    ])
    expect(calls[3]?.args).toEqual({ purpose: "notifications", origin: "onboarding" })
    // Sans consentement à l'annuaire, aucun niveau visible n'est demandé.
    expect(calls[4]?.args).toMatchObject({ networkId: "n-diasporale", directoryVisibility: "hidden", facet: { countryOfResidence: "fr", city: "Lyon" } })
  })

  it("entrer : refus avant toute écriture (consentement, pays), et un refus du moteur traduit", async () => {
    const { convex, calls } = fakeConvex({
      ...NETWORK,
      "modules/people/profile:publishMyProfile": () => {
        throw engineError({ code: "handleUnavailable" })
      },
    })
    const actions = createEngineActions({ convex, authClient: fakeAuth().client })
    const base = { facet: { countryOfResidence: "FR" }, handle: "ada", displayName: "Ada", directoryVisibility: "hidden" as const }
    expect(await actions.join({ ...base, consents: { social_profile: false, directory: false, notifications: false } })).toEqual({
      ok: false,
      code: "consent_social_profile_required",
    })
    expect(await actions.join({ ...base, facet: { countryOfResidence: "GA" }, consents: { social_profile: true, directory: false, notifications: false } })).toEqual({
      ok: false,
      code: "country_is_home",
    })
    expect(calls).toEqual([])
    expect(await actions.join({ ...base, consents: { social_profile: true, directory: false, notifications: false } })).toEqual({ ok: false, code: "handle_taken" })
  })

  it("parrainer : le refus métier de la tranche arrive à l'écran avec son code", async () => {
    const { convex } = fakeConvex({
      ...NETWORK,
      "modules/diaspora/membership:sponsor": () => {
        throw engineError({ code: "policyRefused", appRule: "target_not_eligible", appParams: {} })
      },
    })
    const actions = createEngineActions({ convex, authClient: fakeAuth().client })
    expect(await actions.sponsor("inconnu")).toEqual({ ok: false, code: "target_not_eligible" })
  })

  it("réseau absent du moteur : réseau indisponible, rien d'écrit", async () => {
    const { convex, calls } = fakeConvex({ "modules/networks/networks:getBySlug": () => null })
    const actions = createEngineActions({ convex, authClient: fakeAuth().client })
    expect(await actions.setDirectoryVisibility("country")).toEqual({ ok: false, code: "network_unavailable" })
    expect(calls.map((call) => call.name)).toEqual(["modules/networks/networks:getBySlug"])
  })

  it("ce que le moteur ne sert pas encore se dit, sans rien inventer", async () => {
    const { convex, calls } = fakeConvex(NETWORK)
    const actions = createEngineActions({ convex, authClient: fakeAuth().client })
    expect(await actions.signInWithIdn({ firstName: "A", lastName: "B", loa: 2, gaboneseNationality: true })).toEqual({ ok: false, code: "feature_unavailable" })
    expect(await actions.exportMyData()).toEqual({ ok: false, code: "feature_unavailable" })
    expect(await actions.deleteMyAccount()).toEqual({ ok: false, code: "feature_unavailable" })
    expect(await actions.react("post-1", null)).toEqual({ ok: true, value: null })
    expect(calls).toEqual([])
  })

  it("retirer le consentement à l'annuaire referme aussi le niveau d'annuaire", async () => {
    const { convex, calls } = fakeConvex({
      ...NETWORK,
      "modules/people/consents:revokeConsent": () => null,
      "modules/diaspora/facet:setDirectoryVisibility": () => null,
    })
    const actions = createEngineActions({ convex, authClient: fakeAuth().client })
    expect(await actions.setConsent("directory", false)).toEqual({ ok: true, value: null })
    expect(calls.slice(1)).toEqual([
      { name: "modules/people/consents:revokeConsent", args: { purpose: "directory", networkId: "n-diasporale" } },
      { name: "modules/diaspora/facet:setDirectoryVisibility", args: { networkId: "n-diasporale", level: "hidden" } },
    ])
  })
})

describe("attestation consulaire par le moteur (PD3)", () => {
  function attestationConvex(results: string[], mutationError?: unknown) {
    let read = 0
    return fakeConvex({
      ...NETWORK,
      "modules/diaspora/attestation:requestConsularAttestation": () => {
        if (mutationError) throw mutationError
        return { attestationId: "att-1" }
      },
      "modules/diaspora/attestation:myAttestationRequest": () => ({ result: results[Math.min(read++, results.length - 1)] }),
    })
  }
  const noWait = async () => undefined

  it("la demande part avec le geste de consentement, puis l'issue de consulat.ga est lue", async () => {
    const { convex, calls } = attestationConvex(["pending", "pending", "verified"])
    const actions = createEngineActions({ convex, authClient: fakeAuth().client, sleep: noWait })
    expect(await actions.requestAttestation()).toEqual({ ok: true, value: { outcome: "verified" } })
    expect(calls[1]).toEqual({ name: "modules/diaspora/attestation:requestConsularAttestation", args: { networkId: "n-diasporale", consent: true } })
    expect(calls.filter((call) => call.name.endsWith("myAttestationRequest"))).toHaveLength(3)
  })

  it("non confirmée se dit sans raison ; un échec technique ou un délai dépassé : indisponible", async () => {
    const notConfirmed = createEngineActions({ convex: attestationConvex(["not_confirmed"]).convex, authClient: fakeAuth().client, sleep: noWait })
    expect(await notConfirmed.requestAttestation()).toEqual({ ok: true, value: { outcome: "not_confirmed" } })
    const failed = createEngineActions({ convex: attestationConvex(["failed"]).convex, authClient: fakeAuth().client, sleep: noWait })
    expect(await failed.requestAttestation()).toEqual({ ok: false, code: "attestation_unavailable" })
    const slow = createEngineActions({ convex: attestationConvex(["pending"]).convex, authClient: fakeAuth().client, sleep: noWait })
    expect(await slow.requestAttestation()).toEqual({ ok: false, code: "attestation_unavailable" })
  })

  it("les refus de la tranche arrivent avec leur code : trop tôt, inutile", async () => {
    const tooSoon = attestationConvex([], engineError({ code: "policyRefused", appRule: "attestation_too_soon", appParams: { availableAt: 1 } }))
    expect(await createEngineActions({ convex: tooSoon.convex, authClient: fakeAuth().client, sleep: noWait }).requestAttestation()).toEqual({
      ok: false,
      code: "attestation_too_soon",
    })
    const notNeeded = attestationConvex([], engineError({ code: "conflict", appRule: "attestation_not_needed" }))
    expect(await createEngineActions({ convex: notNeeded.convex, authClient: fakeAuth().client, sleep: noWait }).requestAttestation()).toEqual({
      ok: false,
      code: "attestation_not_needed",
    })
  })
})

describe("relations par le graphe du moteur (PD4)", () => {
  it("l'état du graphe devient la relation de l'écran ; une demande refusée redevient « aucune »", () => {
    expect(toRelationView({ state: "none" } as never, true)).toEqual({ connection: "none", connectionId: null, following: true })
    expect(toRelationView({ state: "declined", connectionId: "c1" } as never, false)).toEqual({ connection: "none", connectionId: null, following: false })
    expect(toRelationView({ state: "requested_by_them", connectionId: "c2", message: "Bonjour" } as never, false)).toEqual({
      connection: "requested_by_them",
      connectionId: "c2",
      following: false,
    })
    expect(toRelationView({ state: "connected", connectionId: "c3", since: 1 } as never, true)).toEqual({ connection: "connected", connectionId: "c3", following: true })
    // Mon blocage : aucun abonnement ne survit.
    expect(toRelationView({ state: "blocked_by_me", connectionId: "c4" } as never, true)).toEqual({ connection: "blocked_by_me", connectionId: "c4", following: false })
  })

  it("chaque geste part vers sa fonction du graphe, borné par le réseau diasporale", async () => {
    const ok = () => ({ status: "requested" })
    const { convex, calls } = fakeConvex({
      ...NETWORK,
      "modules/graph/connections:requestConnection": ok,
      "modules/graph/connections:respondToConnection": () => ({ status: "accepted" }),
      "modules/graph/follows:follow": () => ({ targetPersonId: "p2", following: true }),
      "modules/graph/follows:unfollow": () => ({ following: false }),
      "modules/graph/connections:blockPerson": () => null,
      "modules/graph/connections:unblockPerson": () => null,
    })
    const actions = createEngineActions({ convex, authClient: fakeAuth().client })
    await actions.connect("p2")
    await actions.respondToConnection("c1", true)
    await actions.follow("@ada")
    await actions.unfollow("p2")
    await actions.block("p2")
    await actions.unblock("p2")
    expect(calls.slice(1)).toEqual([
      { name: "modules/graph/connections:requestConnection", args: { networkId: "n-diasporale", targetPersonId: "p2" } },
      { name: "modules/graph/connections:respondToConnection", args: { networkId: "n-diasporale", connectionId: "c1", accept: true } },
      { name: "modules/graph/follows:follow", args: { networkId: "n-diasporale", handle: "ada" } },
      { name: "modules/graph/follows:unfollow", args: { networkId: "n-diasporale", targetPersonId: "p2" } },
      { name: "modules/graph/connections:blockPerson", args: { networkId: "n-diasporale", targetPersonId: "p2" } },
      { name: "modules/graph/connections:unblockPerson", args: { networkId: "n-diasporale", targetPersonId: "p2" } },
    ])
  })

  it("un statut insuffisant se dit comme tel", async () => {
    const { convex } = fakeConvex({
      ...NETWORK,
      "modules/graph/connections:requestConnection": () => {
        throw engineError({ code: "statusInsufficient" })
      },
    })
    expect(await createEngineActions({ convex, authClient: fakeAuth().client }).connect("p2")).toEqual({ ok: false, code: "status_insufficient" })
  })
})

describe("la cloche du moteur (PD4)", () => {
  const notice = (overrides: Record<string, unknown> = {}) =>
    ({
      notificationId: "nt1",
      kind: "connection_request",
      subject: { kind: "connection", id: "c1" },
      createdAt: 5,
      readAt: null,
      resolution: null,
      inviteState: { status: "requested", iAmRecipient: true },
      fileScanStatus: null,
      actor: { personId: "p2", displayName: "Ada", handle: "ada", avatarUrl: null, badges: [] },
      ...overrides,
    }) as never

  it("une demande encore à trancher par moi se tranche d'ici ; une demande tranchée dit ce qu'elle est devenue", () => {
    expect(toNotificationView(notice())).toEqual({
      id: "nt1",
      kind: "connection_request",
      actor: { handle: "ada", displayName: "Ada" },
      createdAt: 5,
      read: false,
      pendingConnectionId: "c1",
      inviteOutcome: null,
      postId: null,
    })
    expect(toNotificationView(notice({ inviteState: { status: "accepted", iAmRecipient: true } }))).toMatchObject({ pendingConnectionId: null, inviteOutcome: "accepted" })
    expect(toNotificationView(notice({ inviteState: { status: "declined", iAmRecipient: true } }))).toMatchObject({ inviteOutcome: "declined" })
    // Ligne disparue ou blocage : la demande n'est plus d'actualité.
    expect(toNotificationView(notice({ inviteState: { status: "missing", iAmRecipient: false } }))).toMatchObject({ pendingConnectionId: null, inviteOutcome: "gone" })
    expect(toNotificationView(notice({ inviteState: { status: "blocked", iAmRecipient: true } }))).toMatchObject({ inviteOutcome: "gone" })
    // Sans état (je ne suis pas partie à la demande), rien n'est inventé.
    expect(toNotificationView(notice({ inviteState: null }))).toMatchObject({ pendingConnectionId: null, inviteOutcome: null })
  })

  it("un genre inconnu se dit « nouvelle activité » ; un profil non publié ne nomme personne ; lu, c'est lu", () => {
    const view = toNotificationView(notice({ kind: "file_withheld", subject: null, inviteState: null, readAt: 9, actor: { personId: "p3", displayName: null, handle: null, avatarUrl: null, badges: [] } }))
    expect(view).toEqual({ id: "nt1", kind: "other", actor: null, createdAt: 5, read: true, pendingConnectionId: null, inviteOutcome: null, postId: null })
    expect(toNotificationView(notice({ kind: "sponsorship_withdrawn", inviteState: null, actor: null }))).toMatchObject({ kind: "sponsorship_withdrawn", actor: null })
  })

  it("marquer lu : un avis ou tous, dans le réseau diasporale", async () => {
    const { convex, calls } = fakeConvex({
      ...NETWORK,
      "modules/notifications/bell:markRead": () => null,
      "modules/notifications/bell:markAllRead": () => ({ marked: 2 }),
    })
    const actions = createEngineActions({ convex, authClient: fakeAuth().client })
    expect(await actions.markNotificationRead("nt1")).toEqual({ ok: true, value: null })
    expect(await actions.markAllNotificationsRead()).toEqual({ ok: true, value: null })
    expect(calls.slice(1)).toEqual([
      { name: "modules/notifications/bell:markRead", args: { networkId: "n-diasporale", notificationId: "nt1" } },
      { name: "modules/notifications/bell:markAllRead", args: { networkId: "n-diasporale" } },
    ])
  })
})

describe("annuaire de la tranche (PD4, EXF-DG-19)", () => {
  it("un membre trouvé garde la facette déjà projetée par le serveur ; un pays inconnu est écarté, jamais deviné", () => {
    const hit = {
      personId: "p2",
      handle: "ada",
      displayName: "Ada",
      headline: null,
      avatarUrl: null,
      badges: ["community"],
      facet: { countryOfResidence: "FR", city: "Lyon" },
    } as never
    expect(toMemberHitView(hit)).toEqual({
      personId: "p2",
      handle: "ada",
      displayName: "Ada",
      headline: null,
      badges: ["community"],
      facet: { countryOfResidence: "FR", city: "Lyon" },
    })
    expect(toMemberHitView({ ...(hit as object), facet: { countryOfResidence: "XX" } } as never).facet).toEqual({})
  })
})

describe("publications à portée et pays (PD4, lot 7 d'ANTSIA)", () => {
  const base = {
    body: "Bonjour",
    media: [],
    share: null,
    shareCount: 0,
    audience: "public",
    visibility: "network",
    publishedAt: 1,
    author: { personId: "p2", handle: "ada", displayName: "Ada", badges: [] },
    reactions: { counts: { like: 0, bravo: 0, soutien: 0, instructif: 0 }, total: 0, mine: null },
    commentCount: 2,
    viewer: { bookmarked: true, notifying: false },
  }
  const item = (id: string, reach: string | null, country: string | null, reason = "public", isMine = false) =>
    ({ ...base, _id: id, reach, country, reason, isMine }) as never
  const ids = (posts: readonly { id: string }[]) => posts.map((post) => post.id)

  it("« Mon pays » et un hub : le local du pays plus toute la diaspora ; « Pour vous » suit la raison du moteur", () => {
    const items = [item("fr-local", "local", "FR"), item("be-local", "local", "BE"), item("diaspora-be", "diaspora", "BE", "connection"), item("ancienne", null, null)]
    expect(ids(toFeed(items, "mon_pays", "FR"))).toEqual(["fr-local", "diaspora-be", "ancienne"])
    expect(ids(toFeed(items, "mon_pays", "BE"))).toEqual(["be-local", "diaspora-be", "ancienne"])
    expect(ids(toFeed(items, "diaspora", "FR"))).toEqual(["diaspora-be", "ancienne"])
    expect(ids(toFeed(items, "pour_vous", "FR"))).toEqual(["diaspora-be"])
    // Le pays d'origine d'une publication diaspora reste lisible : la pastille des autres hubs.
    expect(toFeed(items, "recents", "FR").find((post) => post.id === "diaspora-be")).toMatchObject({
      scope: { reach: "diaspora", country: "BE" },
      commentCount: 2,
    })
  })

  it("la requête du fil : portées du moteur, ou voies composées par la règle du hub", () => {
    expect(feedRequest("pour_vous", "FR")).toEqual({ scope: "pour_vous" })
    expect(feedRequest("recents", "FR")).toEqual({ scope: "recents" })
    expect(feedRequest("mon_pays", "CA")).toEqual({ lanes: [{ reach: "local", country: "CA" }, { reach: "diaspora" }] })
    expect(feedRequest("diaspora", "CA")).toEqual({ lanes: [{ reach: "diaspora" }] })
  })

  it("le mur d'un auteur : l'épinglée d'abord, jamais deux fois", () => {
    const pinned = item("epinglee", "local", "FR")
    expect(ids(toWall({ items: [item("a", "local", "FR"), pinned, item("b", "diaspora", null)], pinned }))).toEqual(["epinglee", "a", "b"])
    expect(ids(toWall({ items: [item("a", "local", "FR")], pinned: null }))).toEqual(["a"])
  })

  const OPEN_FR = { "modules/diaspora/hubs:listOpenCountries": () => [{ country: "FR" }] }

  it("local dans un pays ouvert : portée et pays partent au moteur ; diaspora garde son pays d'origine ; ANTSIA seulement en public", async () => {
    const { convex, calls } = fakeConvex({ ...NETWORK, ...OPEN_FR, "modules/posts/posts:publish": () => ({ postId: "post-1", created: true }) })
    const actions = createEngineActions({ convex, authClient: fakeAuth().client })
    expect(await actions.publish({ body: "Bonjour Lyon", reach: "local", country: "FR", audience: "public", alsoOnRoot: true })).toEqual({
      ok: true,
      value: { moderation: "published" },
    })
    expect(await actions.publish({ body: "Pour tous", reach: "diaspora", country: "FR", audience: "connections", alsoOnRoot: true })).toEqual({
      ok: true,
      value: { moderation: "published" },
    })
    expect(calls.filter((call) => call.name === "modules/posts/posts:publish").map((call) => call.args)).toEqual([
      { networkId: "n-diasporale", body: "Bonjour Lyon", audience: "public", reach: "local", country: "FR", alsoOnRoot: true },
      { networkId: "n-diasporale", body: "Pour tous", audience: "connections", reach: "diaspora", country: "FR", alsoOnRoot: false },
    ])
  })

  it("local dans un pays non ouvert : refusé avant toute écriture, tant que le moteur ne retient rien en relecture", async () => {
    const { convex, calls } = fakeConvex({ ...NETWORK, ...OPEN_FR })
    const actions = createEngineActions({ convex, authClient: fakeAuth().client })
    expect(await actions.publish({ body: "Bonjour Montréal", reach: "local", country: "CA", audience: "public", alsoOnRoot: false })).toEqual({
      ok: false,
      code: "feature_unavailable",
    })
    expect(calls.some((call) => call.name === "modules/posts/posts:publish")).toBe(false)
  })

  it("un pays absent ou le Gabon : le refus du domaine, sans appel ; un refus de portée du moteur arrive avec son code", async () => {
    const { convex, calls } = fakeConvex({
      ...NETWORK,
      ...OPEN_FR,
      "modules/posts/posts:publish": () => {
        throw engineError({ code: "invalidArgument", rule: "POST_REACH_INVALID" })
      },
    })
    const actions = createEngineActions({ convex, authClient: fakeAuth().client })
    expect(await actions.publish({ body: "x", reach: "local", audience: "public", alsoOnRoot: false })).toEqual({ ok: false, code: "scope_country_required" })
    expect(await actions.publish({ body: "x", reach: "local", country: "GA" as never, audience: "public", alsoOnRoot: false })).toEqual({
      ok: false,
      code: "scope_country_invalid",
    })
    expect(calls).toEqual([])
    expect(await actions.publish({ body: "x", reach: "diaspora", audience: "public", alsoOnRoot: false })).toEqual({ ok: false, code: "scope_reach_invalid" })
  })
})

describe("commentaires par le moteur (PD4, lot 8 d'ANTSIA)", () => {
  it("un fil du moteur : l'auteur par son profil publié (nom neutre s'il est retiré), modifié se dit, les réponses suivent", () => {
    const reply = { commentId: "r1", author: { personId: "p3", displayName: null, handle: null, avatarUrl: null }, body: "Merci", createdAt: 2, editedAt: 3, isMine: true }
    const thread = {
      commentId: "c1",
      author: { personId: "p2", displayName: "Ada", handle: "ada", avatarUrl: null },
      body: "Bonjour",
      createdAt: 1,
      editedAt: null,
      isMine: false,
      replyCount: 4,
      replies: [reply],
    } as never
    expect(toCommentThreadView(thread)).toEqual({
      id: "c1",
      author: { personId: "p2", handle: "ada", displayName: "Ada" },
      body: "Bonjour",
      createdAt: 1,
      edited: false,
      isMine: false,
      replyCount: 4,
      replies: [{ id: "r1", author: { personId: "p3", handle: null, displayName: null }, body: "Merci", createdAt: 2, edited: true, isMine: true }],
    })
  })

  it("commenter, répondre et retirer partent vers l'engagement du moteur, bornés par le réseau ; un refus du domaine se traduit", async () => {
    const { convex, calls } = fakeConvex({
      ...NETWORK,
      "modules/engagement/engagement:comment": (args) => {
        if (String(args.body).length > 1000) throw engineError({ code: "invalidArgument", rule: "COMMENT_TOO_LONG", params: { max: 1000 } })
        return { commentId: "c9" }
      },
      "modules/engagement/engagement:removeComment": () => ({ removed: true }),
    })
    const actions = createEngineActions({ convex, authClient: fakeAuth().client })
    expect(await actions.comment({ postId: "post-1", body: "Bonjour" })).toEqual({ ok: true, value: null })
    expect(await actions.comment({ postId: "post-1", body: "Merci", parentCommentId: "c1" })).toEqual({ ok: true, value: null })
    expect(await actions.removeComment("c9")).toEqual({ ok: true, value: null })
    expect(await actions.comment({ postId: "post-1", body: "x".repeat(1001) })).toEqual({ ok: false, code: "comment_too_long" })
    expect(calls.slice(1, 4)).toEqual([
      { name: "modules/engagement/engagement:comment", args: { networkId: "n-diasporale", postId: "post-1", body: "Bonjour" } },
      { name: "modules/engagement/engagement:comment", args: { networkId: "n-diasporale", postId: "post-1", body: "Merci", parentCommentId: "c1" } },
      { name: "modules/engagement/engagement:removeComment", args: { networkId: "n-diasporale", commentId: "c9" } },
    ])
  })
})

describe("menu d'une publication par le moteur (PD4, lots 7 et 8 d'ANTSIA)", () => {
  it("signet, masquage, sourdine, signalement et retrait partent vers leurs fonctions, bornés par le réseau", async () => {
    const { convex, calls } = fakeConvex({
      ...NETWORK,
      "modules/marks/marks:toggleMark": () => ({ marked: true }),
      "modules/marks/marks:hidePost": () => ({ hidden: true }),
      "modules/marks/marks:muteAuthor": () => ({ muted: true }),
      "modules/moderation/moderation:reportPost": () => ({ reportId: "r1", created: true, hidden: true }),
      "modules/posts/posts:remove": () => ({ removed: true }),
    })
    const actions = createEngineActions({ convex, authClient: fakeAuth().client })
    expect(await actions.toggleBookmark("post-1")).toEqual({ ok: true, value: { bookmarked: true } })
    expect(await actions.hidePost("post-1")).toEqual({ ok: true, value: null })
    expect(await actions.muteAuthor("p2")).toEqual({ ok: true, value: null })
    expect(await actions.reportPost({ postId: "post-1", reason: "hate", note: "  " })).toEqual({ ok: true, value: null })
    expect(await actions.reportPost({ postId: "post-1", reason: "other", note: " Détail. " })).toEqual({ ok: true, value: null })
    expect(await actions.removePost("post-9")).toEqual({ ok: true, value: null })
    expect(calls.slice(1)).toEqual([
      { name: "modules/marks/marks:toggleMark", args: { networkId: "n-diasporale", postId: "post-1", kind: "bookmark" } },
      { name: "modules/marks/marks:hidePost", args: { networkId: "n-diasporale", postId: "post-1" } },
      { name: "modules/marks/marks:muteAuthor", args: { networkId: "n-diasporale", targetPersonId: "p2" } },
      { name: "modules/moderation/moderation:reportPost", args: { networkId: "n-diasporale", postId: "post-1", reason: "hate" } },
      { name: "modules/moderation/moderation:reportPost", args: { networkId: "n-diasporale", postId: "post-1", reason: "other", note: "Détail." } },
      { name: "modules/posts/posts:remove", args: { networkId: "n-diasporale", postId: "post-9" } },
    ])
  })
})

describe("suggestions par la tranche (PD4, EXF-DG-18)", () => {
  it("une suggestion garde la facette projetée par le serveur et ce qui rapproche ; « ne plus me proposer » passe par le masquage du moteur", async () => {
    const reasons = { sameCountry: true, sameCity: false, sharedAssociations: 0, mutualConnections: 2 }
    const item = { personId: "p2", handle: "ada", displayName: "Ada", headline: null, avatarUrl: null, badges: [], facet: { countryOfResidence: "FR" }, reasons } as never
    expect(toSuggestionView(item)).toEqual({ personId: "p2", handle: "ada", displayName: "Ada", headline: null, badges: [], facet: { countryOfResidence: "FR" }, reasons })

    const { convex, calls } = fakeConvex({ ...NETWORK, "modules/suggestions/suggestions:dismiss": () => ({ targetPersonId: "p2", dismissed: true }) })
    const actions = createEngineActions({ convex, authClient: fakeAuth().client })
    expect(await actions.dismissSuggestion("ada")).toEqual({ ok: true, value: null })
    expect(calls.slice(1)).toEqual([{ name: "modules/suggestions/suggestions:dismiss", args: { networkId: "n-diasporale", handle: "ada" } }])
  })
})

describe("publication seule, modification et signets par le moteur (PD4)", () => {
  it("un signet du moteur : la page quand elle parle, sinon la personne ; modifier part vers posts.edit ; l'avis porte sa publication", async () => {
    const base = { postId: "post-1", body: "Bonjour", publishedAt: 1, markedAt: 2, author: { personId: "p2", displayName: "Ada", handle: "ada", avatarUrl: null } }
    expect(toBookmarkView({ ...base, page: null } as never)).toEqual({
      postId: "post-1",
      author: { kind: "person", handle: "ada", displayName: "Ada" },
      body: "Bonjour",
      publishedAt: 1,
      markedAt: 2,
    })
    const page = { pageId: "pg1", networkId: "n", handle: "consulat-lyon", name: "Consulat de Lyon", shortName: null, logoUrl: null, badge: "official", ownerKind: "institution", country: "FR" }
    expect(toBookmarkView({ ...base, page } as never).author).toEqual({ kind: "page", handle: "consulat-lyon", displayName: "Consulat de Lyon" })

    const notice = { notificationId: "nt1", kind: "post_comment", subject: { kind: "post", id: "post-1" }, createdAt: 1, readAt: null, resolution: null, inviteState: null, fileScanStatus: null, actor: null }
    expect(toNotificationView(notice as never).postId).toBe("post-1")
    expect(toNotificationView({ ...notice, subject: { kind: "connection", id: "c1" } } as never).postId).toBeNull()

    const { convex, calls } = fakeConvex({ ...NETWORK, "modules/posts/posts:edit": () => ({ editedAt: 3 }) })
    const actions = createEngineActions({ convex, authClient: fakeAuth().client })
    expect(await actions.editPost("post-1", "Texte corrigé")).toEqual({ ok: true, value: null })
    expect(calls.slice(1)).toEqual([{ name: "modules/posts/posts:edit", args: { networkId: "n-diasporale", postId: "post-1", body: "Texte corrigé" } }])
  })
})

describe("médias des publications par le moteur (EXF-DG-10)", () => {
  it("la garde des fichiers délivre une URL, ou dit la raison de la retenue", () => {
    expect(toPostMediaView({ url: "https://f.test/1", withheld: null, kind: "image", mimeType: "image/jpeg", width: 4, height: 3, altText: "Le fleuve" } as never)).toEqual({
      kind: "image",
      url: "https://f.test/1",
      withheld: null,
      altText: "Le fleuve",
      width: 4,
      height: 3,
    })
    expect(toPostMediaView({ url: null, withheld: "fileScanPending", kind: "video", mimeType: "video/mp4" } as never)).toEqual({
      kind: "video",
      url: null,
      withheld: "scan_pending",
      altText: null,
      width: null,
      height: null,
    })
    expect(toPostMediaView({ url: null, withheld: "fileQuarantined", kind: "image", mimeType: "image/png" } as never).withheld).toBe("quarantined")
  })

  it("un dépôt déclaré à la publication : texte alternatif nettoyé, absent s'il est vide ; seules les mesures connues partent", () => {
    const upload = { ref: "kg-photo", kind: "image" as const, mimeType: "image/jpeg", sizeBytes: 2048, width: 1200, height: 800 }
    expect(toDeclaredMedia({ upload, altText: "  Le fleuve  " })).toEqual({
      storageId: "kg-photo",
      kind: "image",
      mimeType: "image/jpeg",
      sizeBytes: 2048,
      width: 1200,
      height: 800,
      altText: "Le fleuve",
    })
    expect(toDeclaredMedia({ upload: { ref: "kg-video", kind: "video", mimeType: "video/mp4", sizeBytes: 9 }, altText: "   " })).toEqual({
      storageId: "kg-video",
      kind: "video",
      mimeType: "video/mp4",
      sizeBytes: 9,
    })
  })

  it("les refus des médias et du dépôt se disent par leur code fermé", () => {
    expect(engineActionErrorCode(engineError({ code: "invalidArgument", rule: "POST_VIDEO_MUST_BE_ALONE" }))).toBe("media_video_alone")
    expect(engineActionErrorCode(engineError({ code: "invalidArgument", rule: "POST_MEDIA_TOO_MANY", params: { max: 4 } }))).toBe("media_too_many")
    expect(engineActionErrorCode(engineError({ code: "invalidArgument", rule: "UPLOAD_SIZE_OUT_OF_RANGE", params: { maxMegabytes: 20 } }))).toBe("media_too_large")
    expect(engineActionErrorCode(engineError({ code: "invalidArgument", rule: "UPLOAD_MISMATCH" }))).toBe("media_upload_failed")
  })

  it("une photo : URL de dépôt pour la publication, envoi du fichier, puis déclarée à la publication", async () => {
    const { convex, calls } = fakeConvex({
      ...NETWORK,
      "modules/diaspora/hubs:listOpenCountries": () => [{ country: "FR" }],
      "modules/media/media:generateUploadUrl": () => "https://depot.test/televersement",
      "modules/posts/posts:publish": () => ({ postId: "post-1", created: true }),
    })
    const deposit = vi.fn(async () => new Response(JSON.stringify({ storageId: "kg-photo" }), { status: 200 }))
    vi.stubGlobal("fetch", deposit)
    try {
      const actions = createEngineActions({ convex, authClient: fakeAuth().client })
      const file = new File(["photo"], "fleuve.jpg", { type: "image/jpeg" })
      const uploaded = await actions.uploadMedia(file)
      expect(uploaded).toEqual({ ok: true, value: { ref: "kg-photo", kind: "image", mimeType: "image/jpeg", sizeBytes: 5 } })
      expect(deposit).toHaveBeenCalledWith("https://depot.test/televersement", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: file })
      if (!uploaded.ok) throw new Error("dépôt refusé")
      expect(
        await actions.publish({ body: "", reach: "local", country: "FR", audience: "public", alsoOnRoot: false, media: [{ upload: uploaded.value, altText: " Le fleuve " }] }),
      ).toEqual({ ok: true, value: { moderation: "published" } })
      expect(calls.find((call) => call.name === "modules/media/media:generateUploadUrl")?.args).toEqual({ networkId: "n-diasporale", usage: "media_social" })
      expect(calls.find((call) => call.name === "modules/posts/posts:publish")?.args).toMatchObject({
        body: "",
        media: [{ storageId: "kg-photo", kind: "image", mimeType: "image/jpeg", sizeBytes: 5, altText: "Le fleuve" }],
      })
      // Le dépôt refusé se dit sans jamais montrer la réponse du serveur ; un type refusé ne part pas.
      deposit.mockResolvedValueOnce(new Response("", { status: 500 }))
      expect(await actions.uploadMedia(file)).toEqual({ ok: false, code: "media_upload_failed" })
      const before = calls.length
      expect(await actions.uploadMedia(new File(["%PDF"], "dossier.pdf", { type: "application/pdf" }))).toEqual({ ok: false, code: "media_type_invalid" })
      expect(calls.length).toBe(before)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe("partage cité par le moteur (EXF-DG-10)", () => {
  it("l'original re-gardé : la page parle en son nom, sinon la personne ; indisponible, il ne dit que cela", () => {
    const media = [{ url: "https://f.test/1", withheld: null, kind: "image", mimeType: "image/jpeg" }]
    const person = { available: true, postId: "post-7", author: { displayName: "Prisca", handle: "prisca", avatarUrl: null }, page: null, body: "Bonjour", media, publishedAt: 5 }
    expect(toSharedPostView(person as never)).toEqual({
      available: true,
      postId: "post-7",
      author: { kind: "person", handle: "prisca", displayName: "Prisca" },
      body: "Bonjour",
      media: [{ kind: "image", url: "https://f.test/1", withheld: null, altText: null, width: null, height: null }],
      publishedAt: 5,
    })
    const page = { pageId: "pg1", handle: "consulat-lyon", name: "Consulat de Lyon", badge: "official" }
    expect(toSharedPostView({ ...person, page } as never)).toMatchObject({ author: { kind: "page", handle: "consulat-lyon", displayName: "Consulat de Lyon" } })
    expect(toSharedPostView({ available: false } as never)).toEqual({ available: false })
  })

  it("le partage part au moteur avec l'original ; ses refus se disent par leur code", async () => {
    const { convex, calls } = fakeConvex({
      ...NETWORK,
      "modules/diaspora/hubs:listOpenCountries": () => [{ country: "FR" }],
      "modules/posts/posts:publish": () => ({ postId: "post-9", created: true }),
    })
    const actions = createEngineActions({ convex, authClient: fakeAuth().client })
    expect(await actions.publish({ body: "", reach: "local", country: "FR", audience: "public", alsoOnRoot: false, sharedPostId: "post-7" })).toEqual({
      ok: true,
      value: { moderation: "published" },
    })
    expect(calls.find((call) => call.name === "modules/posts/posts:publish")?.args).toMatchObject({ body: "", sharedPostId: "post-7" })
    await actions.publish({ body: "Une seule fois", reach: "local", country: "FR", audience: "public", alsoOnRoot: false, idempotencyKey: "cle-1" })
    expect(calls.filter((call) => call.name === "modules/posts/posts:publish").at(-1)?.args).toMatchObject({ idempotencyKey: "cle-1" })
    expect(engineActionErrorCode(engineError({ code: "invalidArgument", rule: "POST_NOT_SHAREABLE" }))).toBe("share_not_allowed")
    expect(engineActionErrorCode(engineError({ code: "invalidArgument", rule: "POST_SHARE_WITH_MEDIA" }))).toBe("share_with_media")
  })
})
