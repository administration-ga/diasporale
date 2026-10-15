// @vitest-environment jsdom
import { RoutingProvider, type FeatureRoutes, type LinkComponent } from "@diasporale/features"
import { DataSourceProvider } from "@diasporale/features/data"
import { DemoStore, createDemoDataSource } from "@diasporale/features/demo"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { routes } from "@/lib/routes"

import { WelcomeScreen } from "./welcome-screen"

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ ...navigation, back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/bienvenue",
  useSearchParams: () => new URLSearchParams(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

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

async function signedInAwa() {
  const store = new DemoStore(null, () => Date.UTC(2026, 9, 14, 12), 0)
  await store.signInWithIdn({ firstName: "Awa", lastName: "Ogooué", loa: 2, gaboneseNationality: true })
  render(
    <I18nProvider locale="fr">
      <DataSourceProvider source={createDemoDataSource(store)}>
        <RoutingProvider routes={featureRoutes} Link={PlainLink}>
          <WelcomeScreen />
        </RoutingProvider>
      </DataSourceProvider>
    </I18nProvider>,
  )
  return { store, user: userEvent.setup() }
}

describe("/bienvenue — l'onboarding en trois écrans", () => {
  it("mène au hub, sans qu'aucun consentement ne soit jamais précoché", async () => {
    const { store, user } = await signedInAwa()

    // 1. Pays et ville — le pays est obligatoire.
    expect(await screen.findByRole("heading", { name: "Où vivez-vous ?" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Continuer/ }))
    expect(await screen.findByText("Choisissez votre pays de résidence.")).toBeInTheDocument()
    await user.click(screen.getByRole("combobox", { name: "Pays de résidence" }))
    await user.type(screen.getByRole("searchbox"), "France")
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /France/ }))
    await user.type(screen.getByRole("textbox", { name: "Ville" }), "Lyon")
    await user.click(screen.getByRole("button", { name: /Continuer/ }))

    // 2. Nom affiché et identifiant — aucune proposition n'est choisie d'office.
    expect(await screen.findByRole("heading", { name: "Comment vous appeler ?" })).toBeInTheDocument()
    const suggestions = screen.getAllByRole("radio")
    expect(suggestions.every((radio) => radio.getAttribute("aria-checked") === "false")).toBe(true)
    await user.type(screen.getByRole("textbox", { name: "Nom affiché" }), "Awa Ogooué")
    await user.click(screen.getByRole("radio", { name: "@awa.ogooue" }))
    await user.click(screen.getByRole("button", { name: /Continuer/ }))

    // 3. Consentements : trois cases, toutes décochées.
    expect(await screen.findByRole("heading", { name: "Vos choix" })).toBeInTheDocument()
    const boxes = screen.getAllByRole("checkbox")
    expect(boxes).toHaveLength(3)
    for (const box of boxes) expect(box).not.toBeChecked()

    // Sans le profil social, pas d'adhésion.
    await user.click(screen.getByRole("button", { name: /Entrer dans DIASPORALE/ }))
    expect(await screen.findByText("Ce consentement est nécessaire pour devenir membre.")).toBeInTheDocument()
    expect(navigation.push).not.toHaveBeenCalled()

    await user.click(screen.getByRole("checkbox", { name: /Créer mon profil social/ }))
    await user.click(screen.getByRole("button", { name: /Entrer dans DIASPORALE/ }))
    await vi.waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`${routes.hub("FR")}?bienvenue=1`))

    const me = store.getState().session.personId ?? ""
    expect(store.statusOf(me)).toBe("declaree")
    expect(store.getState().memberships[me]?.directoryVisibility).toBe("hidden")
  })
})
