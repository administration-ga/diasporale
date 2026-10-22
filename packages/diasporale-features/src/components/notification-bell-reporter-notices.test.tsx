/**
 * Cloche DIASPORALE — accusé de réception et avis de décision d'un signalement (SU01d du moteur,
 * ordonnance n° 0011/PR/2026, art. 24) : phrases entières du système, au seul déclarant, qui
 * mènent à « Mes signalements » ; jamais vers le contenu signalé, aucun lien inventé sans route.
 */
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DataSourceProvider } from "../data/context"
import type { DiasporaleDataSource } from "../data/port"
import { NOTIFICATION_KINDS, REPORTER_NOTIFICATION_KINDS, type NotificationView } from "../data/types"
import { getFixedT } from "../i18n"
import { RoutingProvider, type FeatureRoutes } from "../routing"
import { renderWithI18n } from "../test-utils"
import { BELL_ACTOR_LED_KINDS, BELL_SYSTEM_KINDS, NotificationBell } from "./notification-bell"

const fr = getFixedT("fr")
const NOW = Date.UTC(2026, 9, 22, 12)

const featureRoutes: FeatureRoutes = {
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

/** L'adresse que la table de l'application fournit : la rubrique relit la session à l'ouverture. */
const appRoutes: FeatureRoutes = { ...featureRoutes, myReports: () => "/parametres#mes-signalements" }

function Link({ children, ...props }: ComponentProps<"a">) {
  return <a {...props}>{children}</a>
}

function source(items: readonly NotificationView[]): DiasporaleDataSource {
  const unread = items.filter((item) => !item.read).length
  return {
    kind: "engine",
    useNotifications: () => ({ status: "ready", data: items }),
    useUnreadCount: () => ({ status: "ready", data: { count: unread, capped: false } }),
    actions: {
      markNotificationRead: vi.fn(async () => ({ ok: true, value: null })),
      markAllNotificationsRead: vi.fn(async () => ({ ok: true, value: null })),
    },
  } as unknown as DiasporaleDataSource
}

function notice(kind: "report_received" | "report_decided"): NotificationView {
  return { id: `avis-${kind}`, kind, actor: null, createdAt: NOW - 60_000, read: false, pendingConnectionId: null, inviteOutcome: null, postId: null }
}

function mount(items: readonly NotificationView[], routes: FeatureRoutes = appRoutes) {
  return renderWithI18n(
    <DataSourceProvider source={source(items)}>
      <RoutingProvider routes={routes} Link={Link}>
        <NotificationBell />
      </RoutingProvider>
    </DataSourceProvider>,
    "fr",
  )
}

async function openBell(count: number) {
  await userEvent.setup().click(screen.getByRole("button", { name: fr("bell.openUnread", { count }) }))
  return screen.getByRole("dialog")
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("cloche — accusé de réception et décision d'un signalement", () => {
  it("se disent : deux genres connus, phrases entières du système, jamais « nouvelle activité »", () => {
    for (const kind of REPORTER_NOTIFICATION_KINDS) {
      expect(NOTIFICATION_KINDS).toContain(kind)
      expect(BELL_SYSTEM_KINDS).toContain(kind)
      expect(BELL_ACTOR_LED_KINDS as readonly string[]).not.toContain(kind)
    }
  })

  it("chacun mène à « Mes signalements », jamais vers le contenu signalé", async () => {
    mount([notice("report_received"), notice("report_decided")])
    const dialog = await openBell(2)
    expect(within(dialog).getByText(fr("bell.system.report_received"))).toBeInTheDocument()
    expect(within(dialog).getByText(fr("bell.system.report_decided"))).toBeInTheDocument()
    expect(within(dialog).queryByText(fr("bell.system.other"))).toBeNull()
    const links = within(dialog).getAllByRole("link", { name: fr("bell.openMyReports") })
    expect(links).toHaveLength(2)
    for (const link of links) expect(link).toHaveAttribute("href", "/parametres#mes-signalements")
    expect(within(dialog).queryByRole("link", { name: fr("bell.openPost") })).toBeNull()
  })

  it("sans route fournie par l'application, aucun lien inventé", async () => {
    mount([notice("report_decided")], featureRoutes)
    const dialog = await openBell(1)
    expect(within(dialog).getByText(fr("bell.system.report_decided"))).toBeInTheDocument()
    expect(within(dialog).queryByRole("link", { name: fr("bell.openMyReports") })).toBeNull()
  })
})
