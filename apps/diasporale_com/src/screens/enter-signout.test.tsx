// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { Loadable, MembershipView, SessionView } from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import EnterPage from "@/app/entrer/page"
import { routes } from "@/lib/routes"

import { LandingScreen } from "./landing-screen"

const mocks = vi.hoisted(() => ({
  session: { status: "ready", data: { status: "anonymous" } } as Loadable<SessionView>,
  router: { push: vi.fn(), replace: vi.fn() },
}))

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }))
vi.mock("@diasporale/features/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diasporale/features/data")>()),
  useSession: () => mocks.session,
  useDataSource: () => ({ kind: "demo" }),
  useActions: () => ({}),
}))
// La porte (vitrine, mot-symbole, pied de page) n'est pas l'objet de ces tests : seule la carte d'accès l'est.
vi.mock("@/components/entry-door", () => ({
  EntryDoor: (props: { children: ReactNode }) => <main>{props.children}</main>,
}))

const t = getFixedT("fr")
const membership: MembershipView = {
  personId: "persons_awa",
  handle: "awa.demo",
  displayName: "Awa",
  status: "declaree",
  badges: ["community"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1,
  verifiedSince: null,
  sponsoredBy: null,
  attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" },
  canPublish: true,
  rateTier: "reinforced",
  directoryVisibility: "hidden",
}

function signedIn(member: MembershipView | null = membership): Loadable<SessionView> {
  return {
    status: "ready",
    data: { status: "signed_in", account: { id: "account_awa", idn: null, local: null, nameHints: {} }, membership: member },
  }
}

function tree(signOutIncomplete?: boolean) {
  return <I18nProvider locale="fr"><LandingScreen signOutIncomplete={signOutIncomplete} /></I18nProvider>
}

/** Les deux accès de la carte : IDN (démonstration) et le code par e-mail. */
function expectAccess() {
  const idn = screen.getByRole("link", { name: t("landing.idnContinue") })
  expect(idn).toHaveAttribute("href", routes.enterIdn())
  expect(screen.getByRole("textbox", { name: t("code.emailLabel") })).toBeInTheDocument()
  return { idn }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.session = { status: "ready", data: { status: "anonymous" } }
})

afterEach(cleanup)

describe("Porte d'entrée — rendre visible une déconnexion incomplète", () => {
  it("affiche l'avertissement à une personne anonyme avant les accès", () => {
    render(tree(true))

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent(t("entry.signOutIncomplete"))
    const { idn } = expectAccess()
    expect(alert.compareDocumentPosition(idn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(mocks.router.replace).not.toHaveBeenCalled()
  })

  it.each(["avec_adhesion", "sans_adhesion"] as const)("conserve l'avertissement si la session reste connectée (%s)", (kind) => {
    mocks.session = signedIn(kind === "avec_adhesion" ? membership : null)
    render(tree(true))

    expect(screen.getByRole("alert")).toHaveTextContent(t("entry.signOutIncomplete"))
    expectAccess()
    expect(mocks.router.replace).not.toHaveBeenCalled()
  })

  it("garde aussi l'avertissement quand une session encore valide arrive après le chargement", () => {
    mocks.session = { status: "loading" }
    const view = render(tree(true))
    mocks.session = signedIn()
    view.rerender(tree(true))

    expect(screen.getByRole("alert")).toHaveTextContent(t("entry.signOutIncomplete"))
    expect(mocks.router.replace).not.toHaveBeenCalled()
  })

  it("conserve la redirection normale vers le fil sans indicateur de déconnexion incomplète", () => {
    mocks.session = signedIn()
    render(tree())

    expect(mocks.router.replace).toHaveBeenCalledWith(routes.feed())
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("affiche la carte de connexion ordinaire sans avertissement quand l'indicateur est absent", () => {
    render(tree())

    expectAccess()
    expect(screen.getByRole("heading", { level: 2, name: t("landing.signInTitle") })).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(mocks.router.replace).not.toHaveBeenCalled()
  })
})

describe("/entrer — validation serveur de l'indicateur de déconnexion", () => {
  const cases: readonly { label: string; params: Record<string, string | string[] | undefined>; warning: boolean }[] = [
    { label: "valeur exacte", params: { deconnexion: "incomplete" }, warning: true },
    { label: "paramètre absent", params: {}, warning: false },
    { label: "autre valeur", params: { deconnexion: "complete" }, warning: false },
    { label: "autre casse", params: { deconnexion: "INCOMPLETE" }, warning: false },
    { label: "tableau simple", params: { deconnexion: ["incomplete"] }, warning: false },
    { label: "tableau multiple", params: { deconnexion: ["incomplete", "complete"] }, warning: false },
  ]

  it.each(cases)("n'active l'avertissement que pour la chaîne attendue : $label", async ({ params, warning }) => {
    const page = await EnterPage({ searchParams: Promise.resolve(params) })
    render(<I18nProvider locale="fr">{page}</I18nProvider>)

    if (warning) expect(screen.getByRole("alert")).toHaveTextContent(t("entry.signOutIncomplete"))
    else expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expectAccess()
  })

  it("garde l'avertissement dans la carte d'inscription quand les deux intentions sont présentes", async () => {
    const page = await EnterPage({ searchParams: Promise.resolve({ inscription: "1", deconnexion: "incomplete" }) })
    render(<I18nProvider locale="fr">{page}</I18nProvider>)

    expect(screen.getByRole("heading", { level: 2, name: t("entry.signUpTitle") })).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent(t("entry.signOutIncomplete"))
    expect(mocks.router.replace).not.toHaveBeenCalled()
  })
})
