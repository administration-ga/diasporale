// @vitest-environment jsdom
import { RoutingProvider, type FeatureRoutes, type LinkComponent } from "@diasporale/features"
import { DataSourceProvider, type DiasporaleActions, type DiasporaleDataSource, type EntryDoorsView, type Loadable } from "@diasporale/features/data"
import { DemoStore, createDemoDataSource } from "@diasporale/features/demo"
import { getFixedT, type Locale } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import EnterPage from "@/app/entrer/page"
import { peekReturnPath, rememberReturnPath } from "@/lib/return-path"
import { routes } from "@/lib/routes"

import { LandingScreen } from "./landing-screen"
import { WelcomeScreen } from "./welcome-screen"

/**
 * EA-02 — « Continuer avec IDN » sur la porte de DIASPORALE, avec une source « moteur » dont les
 * portes et le départ sont simulés : aucun moteur, aucun IDN, données fictives seulement.
 */

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ ...navigation, back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}))

const french = getFixedT("fr")
/** Le DOM lit les espaces insécables comme des espaces : le texte attendu est comparé espaces normalisés. */
const plain = (text: string) => text.replace(/\s+/g, " ")
const fr = (key: string) => plain(french(key))

const OPEN: Loadable<EntryDoorsView> = { status: "ready", data: { idn: true, emailCode: true } }
const IDN_CLOSED: Loadable<EntryDoorsView> = { status: "ready", data: { idn: false, emailCode: true } }

const featureRoutes: FeatureRoutes = {
  profile: routes.profile,
  post: routes.post,
  page: routes.page,
  hub: routes.hub,
  feed: () => routes.feed(),
  sponsor: routes.sponsor,
  settings: routes.settings,
  attestation: routes.attestation,
  enter: routes.enter,
}
const PlainLink: LinkComponent = ({ href, children, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
)

function setup(options: { kind?: DiasporaleDataSource["kind"]; doors?: Loadable<EntryDoorsView> } = {}) {
  const store = new DemoStore(null, () => Date.UTC(2026, 10, 10, 12), 0)
  const demo = createDemoDataSource(store)
  const signInWithIdn = vi.fn<DiasporaleActions["signInWithIdn"]>().mockResolvedValue({ ok: true, value: null })
  const requestCode = vi.fn<DiasporaleActions["requestCode"]>().mockResolvedValue({ ok: true, value: { demoCode: null } })
  const kind = options.kind ?? "engine"
  const source: DiasporaleDataSource = {
    ...demo,
    kind,
    ...(kind === "engine" ? { useEntryDoors: () => options.doors ?? OPEN } : {}),
    actions: { ...demo.actions, signInWithIdn, requestCode },
  }
  const mount = (children: ReactNode = <LandingScreen />, locale: Locale = "fr") => render(
    <I18nProvider locale={locale}>
      <DataSourceProvider source={source}>
        <RoutingProvider routes={featureRoutes} Link={PlainLink}>{children}</RoutingProvider>
      </DataSourceProvider>
    </I18nProvider>,
  )
  return { store, signInWithIdn, requestCode, mount, user: userEvent.setup() }
}

beforeEach(() => {
  window.history.replaceState(null, "", "/")
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  window.sessionStorage.clear()
  window.history.replaceState(null, "", "/")
})

describe("EA-02 — la porte n'active IDN que si le déploiement la sert", () => {
  it.each([
    { label: "IDN ouverte", doors: OPEN, enabled: true, help: "entryDoors.idnAntsia" },
    { label: "IDN fermée", doors: IDN_CLOSED, enabled: false, help: "landing.idnUnavailable" },
    { label: "portes en lecture", doors: { status: "loading" } as const, enabled: false, help: "entryDoors.checking" },
    { label: "portes illisibles", doors: { status: "error", code: "unknown" } as const, enabled: false, help: "entryDoors.idnUnknown" },
  ])("$label", ({ doors, enabled, help }) => {
    const { mount, signInWithIdn } = setup({ doors })
    mount()
    const idn = screen.getByRole("button", { name: fr("landing.idnContinue") })
    if (enabled) expect(idn).toBeEnabled()
    else expect(idn).toBeDisabled()
    expect(idn).toHaveAccessibleDescription(french(help))
    // « Disponible prochainement » ne se dit que d'une porte fermée.
    if (help !== "landing.idnUnavailable") expect(screen.queryByText(fr("landing.idnUnavailable"))).not.toBeInTheDocument()
    expect(signInWithIdn).not.toHaveBeenCalled()
  })

  it("dit avant le départ que l'écran d'IDN nommera ANTSIA, puis part sans argument : aucun nom civil ne part", async () => {
    const { mount, user, signInWithIdn } = setup()
    mount()
    const idn = screen.getByRole("button", { name: fr("landing.idnContinue") })
    expect(screen.getByText(fr("entryDoors.idnAntsia"))).toBeInTheDocument()
    await user.click(idn)

    expect(signInWithIdn).toHaveBeenCalledExactlyOnceWith()
    // Le navigateur part chez IDN : le bouton reste « ouverture », fermé à un second appui.
    const leaving = await screen.findByRole("button", { name: fr("entryDoors.idnStarting") })
    expect(leaving).toBeDisabled()
    expect(leaving).toHaveAttribute("aria-busy", "true")
    await user.click(leaving)
    expect(signInWithIdn).toHaveBeenCalledTimes(1)
    expect(navigation.push).not.toHaveBeenCalled()
    expect(navigation.replace).not.toHaveBeenCalled()
  })

  it("un départ refusé se dit traduit, et le bouton se rouvre", async () => {
    const { mount, user, signInWithIdn } = setup()
    signInWithIdn.mockResolvedValueOnce({ ok: false, code: "idn_unavailable" })
    mount()
    await user.click(screen.getByRole("button", { name: fr("landing.idnContinue") }))

    expect(await screen.findByRole("alert")).toHaveTextContent(fr("errors.idn_unavailable"))
    expect(screen.getByRole("button", { name: fr("landing.idnContinue") })).toBeEnabled()
  })

  it("une panne au départ se dit sans phrase du serveur", async () => {
    const { mount, user, signInWithIdn } = setup()
    signInWithIdn.mockRejectedValueOnce(new Error("Server Error: détail interne"))
    mount()
    await user.click(screen.getByRole("button", { name: fr("landing.idnContinue") }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(fr("errors.network_unavailable"))
    expect(alert).not.toHaveTextContent("détail interne")
  })

  it("en anglais : l'avis ANTSIA et le refus sont traduits", async () => {
    const english = getFixedT("en")
    const en = (key: string) => plain(english(key))
    const { mount, user, signInWithIdn } = setup()
    signInWithIdn.mockResolvedValueOnce({ ok: false, code: "idn_unavailable" })
    mount(<LandingScreen />, "en")
    expect(screen.getByText(en("entryDoors.idnAntsia"))).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: en("landing.idnContinue") }))

    expect(await screen.findByRole("alert")).toHaveTextContent(en("errors.idn_unavailable"))
    expect(en("errors.idn_unavailable")).not.toBe(fr("errors.idn_unavailable"))
  })

  it("un retour arrière depuis IDN (page restaurée) rouvre le bouton", async () => {
    const { mount, user } = setup()
    mount()
    await user.click(screen.getByRole("button", { name: fr("landing.idnContinue") }))
    expect(await screen.findByRole("button", { name: fr("entryDoors.idnStarting") })).toBeDisabled()

    act(() => {
      const restored = new Event("pageshow") as PageTransitionEvent
      Object.defineProperty(restored, "persisted", { value: true })
      window.dispatchEvent(restored)
    })
    expect(await screen.findByRole("button", { name: fr("landing.idnContinue") })).toBeEnabled()
  })
})

describe("EA-02 — le retour d'un refus ou d'un échec chez IDN", () => {
  it.each([
    { error: "access_denied", code: "errors.idn_refused" },
    { error: "account_not_linked", code: "errors.idn_account_exists" },
    { error: "oauth_code_verification_failed", code: "errors.idn_failed" },
  ])("$error : la porte le dit traduit, puis le code quitte l'adresse", async ({ error, code }) => {
    window.history.replaceState(null, "", `${routes.enter()}?error=${error}&error_description=detail-serveur`)
    const { mount } = setup()
    mount(await EnterPage({ searchParams: Promise.resolve({ error, error_description: "detail-serveur" }) }))

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent(fr(code))
    expect(alert).not.toHaveTextContent("detail-serveur")
    await waitFor(() => expect(window.location.search).toBe(""))
    expect(window.location.pathname).toBe(routes.enter())
    // La porte reste utilisable : IDN se relance d'un appui.
    expect(screen.getByRole("button", { name: fr("landing.idnContinue") })).toBeEnabled()
  })

  it("garde l'intention d'inscription en retirant seulement le code d'échec", async () => {
    window.history.replaceState(null, "", `${routes.register()}&error=access_denied`)
    const { mount } = setup()
    mount(await EnterPage({ searchParams: Promise.resolve({ inscription: "1", error: "access_denied" }) }))

    expect(screen.getByRole("heading", { level: 2, name: fr("entry.signUpTitle") })).toBeInTheDocument()
    await waitFor(() => expect(`${window.location.pathname}${window.location.search}`).toBe(routes.register()))
  })

  it("sans erreur lisible, rien n'est dit ni retiré", async () => {
    window.history.replaceState(null, "", `${routes.enter()}?deconnexion=incomplete`)
    const { mount } = setup()
    mount(await EnterPage({ searchParams: Promise.resolve({ deconnexion: "incomplete", error: ["a", "b"] }) }))

    expect(screen.queryByText(fr("errors.idn_failed"))).not.toBeInTheDocument()
    expect(window.location.search).toBe("?deconnexion=incomplete")
  })
})

describe("EA-02 — l'entrée par code suit aussi la configuration", () => {
  it("un déploiement qui ne sait pas envoyer le code le dit, et l'envoi reste fermé", async () => {
    const { mount, user, requestCode } = setup({ doors: { status: "ready", data: { idn: true, emailCode: false } } })
    mount()
    const destination = screen.getByRole("textbox", { name: fr("code.emailLabel") })
    expect(destination).toBeDisabled()
    expect(screen.getByText(fr("entryDoors.codeClosed"))).toBeInTheDocument()
    const send = screen.getByRole("button", { name: fr("landing.signIn") })
    expect(send).toBeDisabled()
    await user.click(send)
    expect(requestCode).not.toHaveBeenCalled()
    // IDN reste la porte ouverte.
    expect(screen.getByRole("button", { name: fr("landing.idnContinue") })).toBeEnabled()
  })
})

describe("EA-02 — la démonstration est inchangée", () => {
  it("IDN reste la simulation de /entrer/idn : un lien, aucun départ, quelles que soient les portes", () => {
    const { mount, signInWithIdn } = setup({ kind: "demo" })
    mount()
    expect(screen.getByRole("link", { name: fr("landing.idnContinue") })).toHaveAttribute("href", routes.enterIdn())
    expect(screen.queryByRole("button", { name: fr("landing.idnContinue") })).not.toBeInTheDocument()
    expect(screen.queryByText(fr("entryDoors.idnAntsia"))).not.toBeInTheDocument()
    expect(signInWithIdn).not.toHaveBeenCalled()
  })

  it("la démonstration sert toutes ses portes, et refuse une entrée IDN sans identité simulée", async () => {
    const demo = createDemoDataSource(new DemoStore(null, () => Date.UTC(2026, 10, 10, 12), 0))
    expect(demo.useEntryDoors?.()).toEqual(OPEN)
    expect(await demo.actions.signInWithIdn()).toEqual({ ok: false, code: "idn_invalid" })
  })
})

describe("EA-02 — l'arrivée après le retour d'IDN", () => {
  it("la page demandée survit à l'aller-retour, sans jamais passer par l'adresse, et l'arrivée y mène", async () => {
    const event = routes.associationEvent("amicale-lyon", "evt-42")
    rememberReturnPath({ pathname: event, search: "", hash: "" })
    window.history.replaceState(null, "", routes.enter())
    const { mount, user, signInWithIdn, store } = setup()
    const door = mount()
    await user.click(screen.getByRole("button", { name: fr("landing.idnContinue") }))
    expect(signInWithIdn).toHaveBeenCalledExactlyOnceWith()
    expect(window.location.search).toBe("")
    expect(peekReturnPath()?.path).toBe(event)
    door.unmount()

    // Retour d'IDN : la session est ouverte (ici, un membre fictif), l'adresse est `/bienvenue` nue.
    await store.switchTo("p-steeve")
    window.history.replaceState(null, "", routes.welcome())
    mount(<WelcomeScreen />)
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(event))
    expect(navigation.replace).not.toHaveBeenCalledWith(routes.feed())
  })
})
