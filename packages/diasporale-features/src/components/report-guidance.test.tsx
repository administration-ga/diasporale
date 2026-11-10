// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ContentReportsCapability } from "../data/content-reports-port"
import { DataSourceProvider } from "../data/context"
import type { DiasporaleDataSource } from "../data/port"
import type { PostView } from "../data/types"
import { getFixedT, type Locale } from "../i18n"
import { I18nProvider } from "../i18n/client"
import { RoutingProvider, type FeatureRoutes } from "../routing"
import { PostMenu } from "./post-menu"
import { ReportContentSheet } from "./report-content"

/**
 * Ce que rappelle toute feuille de signalement du paquet (feuille commune, feuille d'une
 * publication) : le lien vers les règles de la communauté (MD-05), pris dans la table de
 * routes de l'application, et rien quand la feuille est rendue hors d'elle. Données fictives.
 */
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

// Les motifs en cartes (Radix) mesurent leur taille : jsdom n'a pas d'observateur.
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Une table de routes sans l'adresse des règles, puis la même avec. */
const WITHOUT_RULES: FeatureRoutes = {
  profile: (handle) => `/@${handle}`,
  post: (id) => `/publication/${id}`,
  page: (handle) => `/pages/${handle}`,
  hub: (country) => `/pays/${country}`,
  feed: () => "/fil",
  sponsor: () => "/parrainer",
  settings: () => "/parametres",
  attestation: () => "/verification",
  enter: () => "/entrer",
}
const ROUTES: FeatureRoutes = { ...WITHOUT_RULES, communityRules: () => "/regles-communaute" }

function Link(props: ComponentProps<"a">) {
  return <a {...props} />
}

const capability: ContentReportsCapability = {
  demonstration: false,
  report: vi.fn(async () => ({ ok: true as const, value: { created: true } })),
  useReported: () => false,
}

function contentSheet(locale: Locale = "fr") {
  return (
    <I18nProvider locale={locale}>
      <ReportContentSheet capability={capability} target={{ kind: "diasporaAidQuestion", id: "question-1" }} open onOpenChange={vi.fn()} />
    </I18nProvider>
  )
}

const withRoutes = (children: ReactNode, routes: FeatureRoutes = ROUTES) => <RoutingProvider routes={routes} Link={Link}>{children}</RoutingProvider>

const POST: PostView = {
  id: "post-fixture",
  author: { kind: "person", id: "person-autre", handle: "autre.fixture", displayName: "Autre FIXTURE", badges: [] },
  body: "Publication fictive.",
  media: [],
  share: null,
  shareCount: 0,
  scope: { reach: "diaspora" },
  audience: "public",
  visibility: "network",
  moderation: "published",
  createdAt: Date.UTC(2026, 10, 10, 12),
  reactionCount: 0,
  commentCount: 0,
  myReaction: null,
  isMine: false,
  bookmarked: false,
  edited: false,
}

async function openPostReport(locale: Locale = "fr") {
  const t = getFixedT(locale)
  const source = { kind: "engine", actions: { reportPost: vi.fn() } } as unknown as DiasporaleDataSource
  const user = userEvent.setup()
  render(
    <I18nProvider locale={locale}>
      <DataSourceProvider source={source}>{withRoutes(<PostMenu post={POST} />)}</DataSourceProvider>
    </I18nProvider>,
  )
  await user.click(screen.getByRole("button", { name: t("postMenu.open") }))
  await user.click(await screen.findByRole("menuitem", { name: t("postMenu.report") }))
  return screen.findByRole("dialog", { name: t("report.title") })
}

describe("feuille de signalement — le lien vers les règles de la communauté (MD-05)", () => {
  it("la feuille commune renvoie à la page des règles", () => {
    const t = getFixedT("fr")
    render(withRoutes(contentSheet()))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByRole("link", { name: t("communityRules.read") })).toHaveAttribute("href", "/regles-communaute")
  })

  it("parle anglais", () => {
    const en = getFixedT("en")
    render(withRoutes(contentSheet("en")))
    expect(within(screen.getByRole("dialog")).getByRole("link", { name: en("communityRules.read") })).toHaveAttribute("href", "/regles-communaute")
  })

  it("rendue hors de l'application, ou sans adresse des règles : aucun lien inventé", () => {
    const first = render(contentSheet())
    expect(within(screen.getByRole("dialog")).queryByRole("link")).toBeNull()
    first.unmount()
    render(withRoutes(contentSheet(), WITHOUT_RULES))
    expect(within(screen.getByRole("dialog")).queryByRole("link")).toBeNull()
  })

  it("la feuille d'une publication renvoie aussi à la page des règles", async () => {
    const t = getFixedT("fr")
    const dialog = await openPostReport()
    expect(within(dialog).getByRole("link", { name: t("communityRules.read") })).toHaveAttribute("href", "/regles-communaute")
  })
})
