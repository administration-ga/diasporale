import type { EngineAuthClient } from "@antia/api/auth-client"
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { describe, expect, it, vi } from "vitest"

import { authActionErrorCode, engineActionErrorCode } from "./engine-errors"
import { createEngineActions } from "./engine-source"
import { toFacetArgs, toFeed, toMembershipView, toOpenCountries } from "./engine-views"

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
  it("l'adhésion de la session, avec l'adhésion ANTIA dérivée", () => {
    expect(toMembershipView(PERSON, MEMBERSHIP as never)).toMatchObject({
      personId: "p1",
      handle: "ada",
      status: "declaree",
      facet: { countryOfResidence: "FR", city: "Lyon" },
      root: { network: "antia", status: "declaree", derivedFrom: "diasporale" },
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
        audience: "public",
        visibility: "network",
        publishedAt: 1,
        isMine,
        author: { personId: "p2", handle: null, displayName: null, badges: [] },
        reactions: { counts: { like: 0, bravo: 0, soutien: 0, instructif: 0 }, total: 0, mine: null },
      }) as never
    const items = [item("a", false), item("b", true)]
    expect(toFeed(items, "mon_pays", "FR").map((post) => post.id)).toEqual(["a", "b"])
    expect(toFeed(items, "diaspora", "BE").map((post) => post.id)).toEqual(["a", "b"])
    expect(toFeed(items, "pour_vous", "FR").map((post) => post.id)).toEqual(["b"])
    expect(toFeed(items, "recents", "FR")[0]).toMatchObject({ scope: { reach: "diaspora" }, author: { handle: "", displayName: "" }, moderation: "published" })
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
    expect(await actions.requestAttestation()).toEqual({ ok: false, code: "attestation_unavailable" })
    expect(await actions.publish({ body: "Bonjour", reach: "local", country: "FR", audience: "public", alsoOnRoot: false })).toEqual({
      ok: false,
      code: "feature_unavailable",
    })
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
