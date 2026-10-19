// @vitest-environment jsdom
import { RoutingProvider, type FeatureRoutes, type LinkComponent } from "@diasporale/features"
import { DataSourceProvider, type DiasporaleDataSource } from "@diasporale/features/data"
import { DemoStore, createDemoDataSource, createDemoSeed } from "@diasporale/features/demo"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { FeedPagesProps } from "@/components/feed-pages"
import { routes } from "@/lib/routes"

import { CommunitiesScreen } from "./communities-screen"

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), feed: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace, refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/communautes",
  useSearchParams: () => new URLSearchParams(),
}))

// Une seule coque : le hub la pose ; la sonde la rend visible dans le DOM.
vi.mock("@/components/app-shell", () => ({
  AppShell: (props: { children: ReactNode }) => <div data-slot="coque-sonde">{props.children}</div>,
  useComposer: () => ({ canPublish: true, open: vi.fn() }),
}))
vi.mock("@/components/status-banner", () => ({ StatusBanner: () => null }))
vi.mock("@/components/feed-pages", () => ({
  FeedPages: (props: FeedPagesProps) => {
    mocks.feed(props)
    return <section aria-label="Publications paginées du hub" />
  },
}))

const NOW = Date.UTC(2026, 9, 18, 12)

/** La table de routes de l'application, telle que les cartes de `@diasporale/features` la lisent. */
const featureRoutes: FeatureRoutes = {
  profile: routes.profile,
  post: routes.post,
  page: routes.page,
  hub: routes.hub,
  feed: (tag, context) => routes.feed(context?.scope, tag, context?.country),
  sponsor: routes.sponsor,
  settings: routes.settings,
  attestation: routes.attestation,
  enter: routes.enter,
}
const Link: LinkComponent = ({ href, children, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
)

function demo(personId: string) {
  const state = { ...createDemoSeed(NOW), session: { personId } }
  const storage = { getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }
  const store = new DemoStore(storage, () => NOW, 0)
  return { store, source: createDemoDataSource(store) }
}

function renderCommunities(source: DiasporaleDataSource, locale: "fr" | "en" = "fr") {
  return render(
    <I18nProvider locale={locale}>
      <DataSourceProvider source={source}>
        <RoutingProvider routes={featureRoutes} Link={Link}>
          <CommunitiesScreen />
        </RoutingProvider>
      </DataSourceProvider>
    </I18nProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

describe("/communautes — le hub de mon pays", () => {
  it("monte, dans une seule coque, le hub du pays de résidence de la personne", () => {
    const { source } = demo("p-mireille")
    const { container } = renderCommunities(source)

    // Le titre porte une espace insécable avant le tiret (typographie française).
    expect(screen.getByRole("heading", { level: 1, name: /^La communauté\s—\sFrance$/ })).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="coque-sonde"]')).toHaveLength(1)
    expect(mocks.feed).toHaveBeenLastCalledWith(expect.objectContaining({ scope: "mon_pays", hubCountry: "FR" }))
    expect(screen.getByRole("button", { name: "Changer de pays" })).toBeInTheDocument()
  })

  it("suit la résidence de chacun : le Canada pour un membre de Montréal", () => {
    const { source } = demo("p-rodrigue")
    renderCommunities(source, "en")
    expect(screen.getByRole("heading", { level: 1, name: /^The community\s—\sCanada$/ })).toBeInTheDocument()
    expect(mocks.feed).toHaveBeenLastCalledWith(expect.objectContaining({ hubCountry: "CA" }))
  })

  it("changer de zone mène au hub choisi, visiblement, sans modifier la résidence", async () => {
    const user = userEvent.setup()
    const { store, source } = demo("p-mireille")
    renderCommunities(source)

    await user.click(screen.getByRole("button", { name: "Changer de pays" }))
    const sheet = await screen.findByRole("dialog", { name: "Changer de pays" })
    await user.type(within(sheet).getByRole("searchbox", { name: "Rechercher un pays" }), "Canada")
    await user.click(within(sheet).getByRole("button", { name: /Canada/ }))

    expect(mocks.push).toHaveBeenCalledWith("/pays/ca")
    expect(store.getState().memberships["p-mireille"]?.facet.countryOfResidence).toBe("FR")
  })

  it("sans session, ne montre aucun hub et renvoie vers l'entrée", () => {
    const { source } = demo("p-mireille")
    const anonymous: DiasporaleDataSource = { ...source, useSession: () => ({ status: "ready", data: { status: "anonymous" } }) }
    renderCommunities(anonymous)
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
    expect(mocks.replace).toHaveBeenCalledWith("/entrer")
  })
})
