// @vitest-environment jsdom
import type { EngineAuthClient } from "@antsia/api/auth-client"
import { renderHook } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { peekReturnPath, rememberReturnPath } from "@/lib/return-path"
import { routes } from "@/lib/routes"

import { createEngineActions } from "./engine-source"
import { IDN_PROVIDER_ID, idnStartErrorCode, startIdnSignIn, toEntryDoorsView, useEngineEntryDoors } from "./engine-idn"

/**
 * L'entrée par IDN sans moteur ni IDN (EA-02) : un client d'authentification FACTICE et une
 * configuration publique jouée par un `useQueries` factice. Aucune adresse ni identifiant réels.
 */
type Reference = Parameters<typeof getFunctionName>[0]

const mocks = vi.hoisted(() => ({
  respond: (() => undefined) as (name: string) => unknown,
  read: vi.fn(),
}))
vi.mock("@antsia/api/hooks", () => ({ useStableConvexAuth: () => ({ isAuthenticated: false, isPending: false, isUnauthenticated: true }) }))
vi.mock("convex/react", () => ({
  useQueries: (queries: Record<string, { query: Reference; args?: unknown }>) => {
    if (!queries.value) return {}
    const name = getFunctionName(queries.value.query)
    mocks.read(name, queries.value.args)
    return { value: mocks.respond(name) }
  },
}))

const CONFIGURATION = "modules/platform/authentication:configuration"

function fakeAuth(oauth2: (args: Record<string, unknown>) => Promise<unknown>) {
  const spy = vi.fn(oauth2)
  return { client: { signIn: { oauth2: spy } } as unknown as EngineAuthClient, oauth2: spy }
}

/** La réponse du moteur à un départ accepté : l'adresse d'IDN, et l'ordre d'y aller. */
const LEAVES = async () => ({ data: { url: "https://idn.example.test/authorize?state=fictif", redirect: true }, error: null })

beforeEach(() => {
  vi.clearAllMocks()
  window.sessionStorage.clear()
  window.history.replaceState(null, "", "/")
})
afterEach(() => {
  window.sessionStorage.clear()
})

describe("EA-02 — départ vers IDN par le client du moteur", () => {
  it("part avec le fournisseur `idn` ; retour sur /bienvenue de cette origine, sans aucun paramètre ; échec vers /entrer", async () => {
    const auth = fakeAuth(LEAVES)
    expect(await startIdnSignIn({ authClient: auth.client })).toEqual({ ok: true, value: null })
    expect(auth.oauth2).toHaveBeenCalledExactlyOnceWith({
      providerId: IDN_PROVIDER_ID,
      callbackURL: `${window.location.origin}${routes.welcome()}`,
      errorCallbackURL: `${window.location.origin}${routes.enter()}`,
    })
    const callback = new URL(String(auth.oauth2.mock.calls[0]?.[0]?.callbackURL))
    expect(callback.search).toBe("")
    expect(callback.hash).toBe("")
  })

  it("la page demandée reste dans l'onglet : jamais recopiée dans l'adresse de retour, ni consommée au départ", async () => {
    const event = routes.associationEvent("amicale-lyon", "evt-42")
    rememberReturnPath({ pathname: event, search: "", hash: "" })
    window.history.replaceState(null, "", `${routes.enter()}?inscription=1`)
    const auth = fakeAuth(LEAVES)
    await startIdnSignIn({ authClient: auth.client })
    const sent = JSON.stringify(auth.oauth2.mock.calls[0]?.[0])
    expect(sent).not.toContain("amicale-lyon")
    expect(sent).not.toContain("inscription")
    expect(peekReturnPath()?.path).toBe(event)
  })

  it("la source moteur ignore toute identité simulée : aucun nom civil ne part", async () => {
    const auth = fakeAuth(LEAVES)
    const actions = createEngineActions({ convex: {} as never, authClient: auth.client })
    expect(await actions.signInWithIdn({ firstName: "Éloïse", lastName: "NDONG", loa: 2, gaboneseNationality: true })).toEqual({ ok: true, value: null })
    const sent = JSON.stringify(auth.oauth2.mock.calls[0]?.[0])
    expect(sent).not.toMatch(/Éloïse|NDONG|loa|gabonese/i)
  })

  it("un départ refusé rend un code fermé et la personne reste sur la porte", async () => {
    expect(await startIdnSignIn({ authClient: fakeAuth(async () => ({ data: null, error: { code: "INVALID_ORIGIN", status: 403 } })).client })).toEqual({ ok: false, code: "idn_unavailable" })
    expect(await startIdnSignIn({ authClient: fakeAuth(async () => ({ data: null, error: { status: 404 } })).client })).toEqual({ ok: false, code: "idn_unavailable" })
    expect(await startIdnSignIn({ authClient: fakeAuth(async () => ({ data: null, error: { code: "rateLimited", status: 429 } })).client })).toEqual({ ok: false, code: "rate_limited" })
    // Une réponse sans adresse d'IDN ne dit jamais « vous partez ».
    expect(await startIdnSignIn({ authClient: fakeAuth(async () => ({ data: { url: "x" }, error: null })).client })).toEqual({ ok: false, code: "idn_unavailable" })
    expect(await startIdnSignIn({ authClient: fakeAuth(async () => { throw new TypeError("Failed to fetch") }).client })).toEqual({ ok: false, code: "network_unavailable" })
  })

  it("traduit les refus du départ sans jamais lire la phrase du serveur", () => {
    expect(idnStartErrorCode({ status: 429 })).toBe("rate_limited")
    expect(idnStartErrorCode({ code: "idnUnavailable", status: 503 })).toBe("idn_unavailable")
    expect(idnStartErrorCode(null)).toBe("idn_unavailable")
  })
})

describe("EA-02 — les portes ouvertes, lues dans la configuration publique du moteur", () => {
  it("réduit la configuration à ce que la porte lit, sans origine ni application", () => {
    expect(toEntryDoorsView({ idn: true, emailOtp: false })).toEqual({ idn: true, emailCode: false })
    expect(toEntryDoorsView({ idn: false, emailOtp: true })).toEqual({ idn: false, emailCode: true })
  })

  it("lit la configuration sans session, puis rend les portes ; en chargement d'abord", () => {
    mocks.respond = () => undefined
    expect(renderHook(() => useEngineEntryDoors()).result.current).toEqual({ status: "loading" })
    mocks.respond = (name) => name === CONFIGURATION
      ? { idn: true, emailOtp: true, smsOtp: true, localCodes: true, demoAccounts: false, trustedOrigins: ["https://site.example.test"], applications: [] }
      : undefined
    expect(renderHook(() => useEngineEntryDoors()).result.current).toEqual({ status: "ready", data: { idn: true, emailCode: true } })
    expect(mocks.read).toHaveBeenCalledWith(CONFIGURATION, {})
  })

  it("une configuration illisible rend une erreur fermée, jamais une porte ouverte par défaut", () => {
    mocks.respond = () => new ConvexError({ code: "codeFutur" } as never)
    expect(renderHook(() => useEngineEntryDoors()).result.current).toEqual({ status: "error", code: "unknown" })
  })
})
