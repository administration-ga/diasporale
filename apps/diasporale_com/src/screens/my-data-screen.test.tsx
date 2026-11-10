// @vitest-environment jsdom
import { RoutingProvider, type FeatureRoutes, type LinkComponent } from "@diasporale/features"
import { DataSourceProvider } from "@diasporale/features/data"
import { DemoStore, createDemoDataSource } from "@diasporale/features/demo"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { routes } from "@/lib/routes"

import { MyDataScreen } from "./my-data-screen"

/**
 * `/mes-donnees` (NP-02, EA-05) avec le fournisseur de DÉMONSTRATION (données fictives) :
 * la personne sans adhésion, la personne partie et le membre y exercent leurs droits ; aucune
 * surface sociale n'est montée.
 */

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ ...navigation, back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/mes-donnees",
  useSearchParams: () => new URLSearchParams(),
}))

const translate = getFixedT("fr")
const raw = (key: string) => String(translate(key))
/** Le texte tel que Testing Library le lit dans le DOM (espaces insécables normalisées). */
const text = (key: string) => raw(key).replace(/\s+/g, " ")

const NOW = Date.UTC(2026, 10, 10, 12)
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

/** Les seules adresses que la page peut offrir : coque publique, pied de page, retour, droits. */
const ALLOWED_LINKS = new Set([
  routes.home(),
  routes.legalNotice(),
  routes.privacy(),
  routes.terms(),
  routes.communityRules(),
  routes.contact(),
  routes.myData(),
  routes.charte(),
  routes.welcome(),
  routes.settings(),
])

type Situation = "sans adhésion" | "partie" | "membre"

async function storeFor(situation: Situation): Promise<DemoStore> {
  const store = new DemoStore(null, () => NOW, 0)
  await store.signInWithIdn({ firstName: "Awa", lastName: "Ogooué", loa: 2, gaboneseNationality: true })
  if (situation === "sans adhésion") return store
  const joined = await store.join({
    facet: { countryOfResidence: "FR", city: "Lyon" },
    handle: "awa.essai",
    displayName: "Awa OGOOUÉ",
    consents: { social_profile: true, directory: false, notifications: false },
    directoryVisibility: "hidden",
  })
  expect(joined.ok).toBe(true)
  if (situation === "partie") expect(await store.leaveDiasporale()).toEqual({ ok: true, value: null })
  return store
}

function renderScreen(store: DemoStore) {
  render(
    <I18nProvider locale="fr">
      <DataSourceProvider source={createDemoDataSource(store)}>
        <RoutingProvider routes={featureRoutes} Link={PlainLink}>
          <MyDataScreen />
        </RoutingProvider>
      </DataSourceProvider>
    </I18nProvider>,
  )
  return userEvent.setup()
}

let saved: string[] = []
beforeEach(() => {
  saved = []
  Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:local-1"), configurable: true, writable: true })
  Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true, writable: true })
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    if (this.download) saved.push(this.download)
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe("/mes-donnees — droits personnels, adhésion facultative", () => {
  it.each([
    ["sans adhésion", routes.welcome(), "myData.backToWelcome", "diasporale-2026-11-10.json"],
    ["partie", routes.welcome(), "myData.backToWelcome", "diasporale-awa.essai-2026-11-10.json"],
    ["membre", routes.settings(), "myData.backToSettings", "diasporale-awa.essai-2026-11-10.json"],
  ] as const)("une personne %s y accède et télécharge son export", async (situation, back, backKey, file) => {
    const store = await storeFor(situation)
    const user = renderScreen(store)

    expect(await screen.findByRole("heading", { level: 1, name: raw("settings.data") })).toBeInTheDocument()
    expect(navigation.replace).not.toHaveBeenCalled()
    expect(screen.getByRole("link", { name: raw(backKey) })).toHaveAttribute("href", back)

    await user.click(screen.getByRole("button", { name: raw("settings.export") }))
    await waitFor(() => expect(saved).toEqual([file]))
    // « Mes signalements » s'affiche aussi en démonstration : aucun signalement transmis.
    const reports = await screen.findByRole("region", { name: raw("settings.dataRights.reports.title") })
    expect(within(reports).getByText(text("settings.dataRights.reports.empty"))).toBeInTheDocument()
  })

  it.each(["sans adhésion", "partie"] as const)("une personne %s n'y voit aucune surface sociale", async (situation) => {
    renderScreen(await storeFor(situation))
    await screen.findByRole("heading", { level: 1, name: raw("settings.data") })
    // Ni coque de membre (navigation, cloche, iCom), ni fil : seules les adresses publiques et le retour.
    expect(screen.queryByRole("navigation", { name: raw("nav.label") })).toBeNull()
    expect(screen.queryByRole("button", { name: /notification/i })).toBeNull()
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href") ?? "")
    expect(hrefs.filter((href) => !ALLOWED_LINKS.has(href))).toEqual([])
    // Rien à quitter : l'effacement ne propose pas « Quitter DIASPORALE ».
    expect(screen.queryByText(text("settings.dataRights.erasure.leaveInstead"))).toBeNull()
  })

  it("un compte abandonné à l'accueil demande son effacement, puis l'annule (EA-05)", async () => {
    const user = renderScreen(await storeFor("sans adhésion"))
    await user.click(await screen.findByRole("button", { name: raw("settings.delete") }))
    const dialog = within(screen.getByRole("dialog"))
    await user.click(dialog.getByRole("checkbox"))
    await user.click(dialog.getByRole("button", { name: raw("settings.dataRights.erasure.confirm") }))
    const cancel = await screen.findByRole("button", { name: raw("settings.dataRights.erasure.cancel") })
    await user.click(cancel)
    expect(await screen.findByRole("button", { name: raw("settings.delete") })).toBeEnabled()
    expect(screen.getByRole("status")).toHaveTextContent(text("settings.dataRights.erasure.cancelled"))
  })

  it("sans session : renvoi à l'entrée, rien n'est monté", async () => {
    const store = new DemoStore(null, () => NOW, 0)
    renderScreen(store)
    await act(async () => {})
    expect(navigation.replace).toHaveBeenCalledWith(routes.enter())
    expect(screen.queryByRole("heading", { level: 1, name: raw("settings.data") })).toBeNull()
  })
})
