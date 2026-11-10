// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY, type MembershipStatus } from "@diasporale/domain"
import type { AccountView, MembershipView, SessionView } from "@diasporale/features/data"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { parseReturnPath, peekReturnPath, rememberReturnPath } from "@/lib/return-path"
import { routes } from "@/lib/routes"

import { Gate, gateRedirect, type GateRequirement } from "./gate"

/**
 * La garde de session, côté client (confort de navigation : l'autorité reste au moteur).
 * NP-02 : la garde `person` admet toute personne connectée, adhésion facultative, pour les
 * seuls droits personnels ; la garde `member` continue de fermer les surfaces sociales à qui
 * n'a pas d'adhésion ou l'a quittée.
 */

const mocks = vi.hoisted(() => ({ session: { status: "loading" } as unknown, replace: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, push: vi.fn() }) }))
vi.mock("@diasporale/features/data", async (original) => ({
  ...(await original<typeof import("@diasporale/features/data")>()),
  useSession: () => mocks.session,
}))

const ACCOUNT: AccountView = { id: "person_lecture", idn: null, local: { kind: "email", masked: "l…@exemple.test" }, nameHints: {} }

function membership(status: MembershipStatus): MembershipView {
  return {
    personId: "person_lecture",
    handle: "lecture.demo",
    displayName: "Lecteur fictif",
    status,
    badges: [],
    facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
    joinedAt: 1,
    verifiedSince: null,
    sponsoredBy: null,
    attestation: { outcome: "none", postSlug: null, requestedAt: null },
    root: { network: "antsia", status: status === "partie" ? "declaree" : status, derivedFrom: "diasporale" },
    canPublish: status === "declaree" || status === "verifiee",
    rateTier: "standard",
    directoryVisibility: "hidden",
  }
}

const signedIn = (member: MembershipView | null): SessionView => ({ status: "signed_in", account: ACCOUNT, membership: member })
const SESSIONS = {
  "sans adhésion": signedIn(null),
  partie: signedIn(membership("partie")),
  suspendue: signedIn(membership("suspendue")),
  "en attente": signedIn(membership("en_attente")),
  déclarée: signedIn(membership("declaree")),
} as const

function renderGate(require: GateRequirement, session: SessionView) {
  mocks.session = { status: "ready", data: session }
  return render(<Gate require={require}>{(admitted) => <p data-testid="admis">{admitted.account.id}</p>}</Gate>)
}

beforeEach(() => {
  mocks.replace.mockClear()
  mocks.session = { status: "loading" }
})
afterEach(cleanup)

describe("gateRedirect — la règle de la garde", () => {
  it("sans session, toute page renvoie à l'entrée", () => {
    for (const require of ["account", "member", "person"] as const) expect(gateRedirect({ status: "anonymous" }, require)).toBe(routes.enter())
  })

  it("`person` admet toute personne connectée, adhésion facultative", () => {
    for (const session of Object.values(SESSIONS)) expect(gateRedirect(session, "person")).toBeNull()
  })

  it("`member` renvoie à l'accueil qui n'a pas d'adhésion ou l'a quittée, et admet le membre suspendu", () => {
    expect(gateRedirect(SESSIONS["sans adhésion"], "member")).toBe(routes.welcome())
    expect(gateRedirect(SESSIONS.partie, "member")).toBe(routes.welcome())
    expect(gateRedirect(SESSIONS.suspendue, "member")).toBeNull()
    expect(gateRedirect(SESSIONS.déclarée, "member")).toBeNull()
  })

  it("`account` (l'accueil) renvoie le membre à son fil et garde qui est parti ou jamais entré", () => {
    expect(gateRedirect(SESSIONS.déclarée, "account")).toBe(routes.feed())
    expect(gateRedirect(SESSIONS.suspendue, "account")).toBe(routes.feed())
    expect(gateRedirect(SESSIONS.partie, "account")).toBeNull()
    expect(gateRedirect(SESSIONS["sans adhésion"], "account")).toBeNull()
  })
})

describe("Gate — `person` : « Mes données » hors adhésion (NP-02)", () => {
  it.each(Object.entries(SESSIONS))("admet une personne %s, sans la renvoyer ailleurs", (_label, session) => {
    renderGate("person", session)
    expect(screen.getByTestId("admis")).toHaveTextContent("person_lecture")
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("sans session : rien n'est monté, renvoi à l'entrée", () => {
    renderGate("person", { status: "anonymous" })
    expect(screen.queryByTestId("admis")).toBeNull()
    expect(mocks.replace).toHaveBeenCalledWith(routes.enter())
  })

  it("pendant le chargement : rien n'est monté, aucun renvoi", () => {
    render(<Gate require="person">{() => <p data-testid="admis" />}</Gate>)
    expect(screen.queryByTestId("admis")).toBeNull()
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})

describe("Gate — `member` : aucune surface sociale hors adhésion", () => {
  it.each(["sans adhésion", "partie"] as const)("une personne %s n'en voit rien : renvoi à l'accueil", (label) => {
    renderGate("member", SESSIONS[label])
    expect(screen.queryByTestId("admis")).toBeNull()
    expect(mocks.replace).toHaveBeenCalledWith(routes.welcome())
  })
})

describe("la page demandée avant la connexion (UX-02, MO-03)", () => {
  const EVENT = routes.associationEvent("amicale-lyon", "evt-42")
  const event = parseReturnPath(EVENT)
  const stored = () => peekReturnPath()

  afterEach(() => {
    window.sessionStorage.clear()
    window.history.replaceState(null, "", "/")
  })

  it("gateRedirect : l'accueil rend au membre la page demandée, au compte en attente ce qu'il peut lire", () => {
    expect(gateRedirect(SESSIONS.déclarée, "account", event)).toBe(EVENT)
    expect(gateRedirect(SESSIONS["en attente"], "account", event)).toBe(EVENT)
    expect(gateRedirect(SESSIONS["en attente"], "account", parseReturnPath(routes.messages()))).toBe(routes.hub("FR"))
    // Sans adhésion, l'accueil d'abord ; « Mes données » s'ouvre sans lui.
    expect(gateRedirect(SESSIONS["sans adhésion"], "account", event)).toBeNull()
    expect(gateRedirect(SESSIONS.partie, "account", parseReturnPath(routes.myData()))).toBe(routes.myData())
  })

  it("sans session, une page de membre est retenue dans l'onglet, jamais dans l'adresse, puis renvoi à l'entrée", () => {
    window.history.replaceState(null, "", `${EVENT}?token=secret`)
    renderGate("member", { status: "anonymous" })
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(routes.enter())
    expect(stored()).toEqual({ path: EVENT, needs: "read_network" })
  })

  it("connecté sans adhésion, la page est retenue avant l'accueil", () => {
    window.history.replaceState(null, "", EVENT)
    renderGate("member", SESSIONS["sans adhésion"])
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(routes.welcome())
    expect(stored()?.path).toBe(EVENT)
  })

  it("l'accueil sans session ne remplace pas la page déjà retenue", () => {
    rememberReturnPath({ pathname: EVENT, search: "", hash: "" })
    window.history.replaceState(null, "", routes.welcome())
    renderGate("account", { status: "anonymous" })
    expect(mocks.replace).toHaveBeenCalledWith(routes.enter())
    expect(stored()?.path).toBe(EVENT)
  })

  it("un membre qui arrive sur l'accueil va à la page demandée ; l'arrivée l'efface", () => {
    rememberReturnPath({ pathname: EVENT, search: "", hash: "" })
    const welcome = renderGate("account", SESSIONS.déclarée)
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(EVENT)
    // Lire ne consomme pas : la porte et l'accueil mènent au même endroit.
    expect(stored()?.path).toBe(EVENT)
    welcome.unmount()

    renderGate("member", SESSIONS.déclarée)
    expect(screen.getByTestId("admis")).toBeInTheDocument()
    expect(stored()).toBeNull()
  })

  it("pendant l'entrée qu'il écrit, l'accueil garde la main : aucun renvoi du membre qui naît", () => {
    rememberReturnPath({ pathname: EVENT, search: "", hash: "" })
    mocks.session = { status: "ready", data: SESSIONS.déclarée }
    render(<Gate require="account" holdMember>{() => <p data-testid="accueil" />}</Gate>)
    expect(screen.getByTestId("accueil")).toBeInTheDocument()
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})
