// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { CountryHubView, Loadable, MembershipView } from "@diasporale/features/data"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { FeedPagesProps } from "@/components/feed-pages"

import { HubScreen } from "./hub-screen"

const mocks = vi.hoisted(() => ({
  membership: null as MembershipView | null,
  hub: { status: "loading" } as Loadable<CountryHubView>,
  countryHub: vi.fn(),
  gate: vi.fn(),
  feed: vi.fn(),
  open: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@diasporale/features/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diasporale/features/data")>()),
  useCountryHub: (country: string) => {
    mocks.countryHub(country)
    return mocks.hub
  },
  useOpenCountries: () => ({ status: "ready", data: [] }),
}))

vi.mock("@/components/gate", () => ({
  Gate: (props: { require: "member"; children: (session: { membership: MembershipView | null }) => ReactNode }) => {
    mocks.gate(props.require)
    return <>{props.children({ membership: mocks.membership })}</>
  },
}))

vi.mock("@/components/app-shell", () => ({
  AppShell: (props: { children: ReactNode }) => <>{props.children}</>,
  useComposer: () => ({ canPublish: true, open: mocks.open }),
}))

vi.mock("@/components/status-banner", () => ({ StatusBanner: () => null }))

vi.mock("@/components/feed-pages", () => ({
  FeedPages: (props: FeedPagesProps) => {
    mocks.feed(props)
    return <section aria-label="Publications paginées du hub" />
  },
}))

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

const hub: CountryHubView = {
  country: "CA",
  open: true,
  counters: {
    dormant: false,
    members: { kind: "below_threshold", threshold: 10 },
    associations: { kind: "value", value: 0 },
    companies: { kind: "value", value: 0 },
    upcomingEvents: { kind: "value", value: 0 },
  },
  countersSource: "materialized",
  officialPages: [],
  associations: [],
  companies: [],
  events: [],
}

function tree(iso = "CA") {
  return <I18nProvider locale="fr"><HubScreen iso={iso} /></I18nProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.membership = membership
  mocks.hub = { status: "loading" }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("HubScreen — reprise des informations du pays", () => {
  it("remplace une erreur de lecture par une alerte traduite et recharge réellement la page", () => {
    mocks.hub = { status: "error", code: "PRIVATE_BACKEND_FAILURE" }
    const { container } = render(tree())

    const alert = screen.getByRole("alert")
    expect(within(alert).getByRole("heading", { name: "Les informations de ce pays ne sont pas disponibles." })).toBeInTheDocument()
    expect(alert).toHaveTextContent("Vérifiez votre connexion et rechargez la page pour réessayer.")
    expect(screen.queryByText("PRIVATE_BACKEND_FAILURE")).not.toBeInTheDocument()
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument()
    expect(mocks.feed).not.toHaveBeenCalled()

    // Location.reload est non configurable dans jsdom. Cette façade n'altère
    // ni les documents ni les évènements DOM ; elle observe seulement le geste.
    vi.stubGlobal("window", new Proxy(window, {
      get(target, property) {
        return property === "location" ? { reload: mocks.reload } : Reflect.get(target, property, target)
      },
    }))
    fireEvent.click(within(alert).getByRole("button", { name: "Recharger la page" }))

    expect(mocks.reload).toHaveBeenCalledOnce()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("conserve un chargement distinct sans alerte ni action de reprise", () => {
    const { container } = render(tree())

    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Recharger la page" })).not.toBeInTheDocument()
    expect(mocks.feed).not.toHaveBeenCalled()
  })

  it("monte le fil prêt avec le pays consulté, l'adhésion et sa portée", () => {
    mocks.hub = { status: "ready", data: hub }
    const { container } = render(tree())

    expect(mocks.gate).toHaveBeenLastCalledWith("member")
    expect(mocks.countryHub).toHaveBeenLastCalledWith("CA")
    expect(screen.getByRole("region", { name: "Publications paginées du hub" })).toBeInTheDocument()
    expect(mocks.feed).toHaveBeenLastCalledWith(expect.objectContaining({
      membership,
      scope: "mon_pays",
      hubCountry: "CA",
      now: expect.any(Number),
      emptyFallback: expect.anything(),
    }))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument()
  })
})
