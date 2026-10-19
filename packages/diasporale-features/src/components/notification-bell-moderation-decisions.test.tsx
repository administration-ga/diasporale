/**
 * Cloche DIASPORALE — avis de décision de modération (P16 · G9) : phrase neutre du système,
 * lien vers « Mes données » pour un dossier personnel, vers les décisions de la page pour un
 * dossier de page lu par un signataire vivant ; aucun lien inventé sans route fournie.
 */
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DataSourceProvider } from "../data/context"
import type { DiasporaleDataSource } from "../data/port"
import type { NotificationView } from "../data/types"
import { getFixedT } from "../i18n"
import { RoutingProvider, type FeatureRoutes } from "../routing"
import { renderWithI18n } from "../test-utils"
import { BELL_ACTOR_LED_KINDS, BELL_SYSTEM_KINDS, NotificationBell } from "./notification-bell"

const fr = getFixedT("fr")
const NOW = Date.UTC(2026, 9, 19, 12)

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

/** Les adresses que la table de l'application fournit : les droits sont relus à l'ouverture. */
const appRoutes: FeatureRoutes = {
  ...featureRoutes,
  myDecisions: () => "/parametres#mes-donnees",
  pageDecisions: (handle) => `/pages/${handle}/gerer?onglet=decisions`,
}

function Link(props: ComponentProps<"a">) {
  return <a {...props} />
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

function decision(pageHandle: string | null, id = `avis-${pageHandle ?? "personnel"}`): NotificationView {
  return { id, kind: "moderation_decision", actor: null, createdAt: NOW - 60_000, read: false, pendingConnectionId: null, inviteOutcome: null, postId: null, moderationDecision: { pageHandle } }
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

describe("cloche — avis de décision de modération", () => {
  it("est une phrase entière du système, sans nom devant", () => {
    expect(BELL_SYSTEM_KINDS).toContain("moderation_decision")
    expect(BELL_ACTOR_LED_KINDS as readonly string[]).not.toContain("moderation_decision")
  })

  it("un dossier personnel mène à « Mes données » ; un dossier de page, aux décisions de la page", async () => {
    mount([decision(null), decision("collectif-demo")])
    const dialog = await openBell(2)
    expect(within(dialog).getAllByText(fr("bell.system.moderation_decision"))).toHaveLength(2)
    expect(within(dialog).getByRole("link", { name: fr("bell.openMyDecisions") })).toHaveAttribute("href", "/parametres#mes-donnees")
    expect(within(dialog).getByRole("link", { name: fr("bell.openPageDecisions") })).toHaveAttribute("href", "/pages/collectif-demo/gerer?onglet=decisions")
  })

  it("sans route fournie par l'application, aucun lien inventé", async () => {
    mount([decision(null), decision("collectif-demo")], featureRoutes)
    const dialog = await openBell(2)
    expect(within(dialog).queryByRole("link", { name: fr("bell.openMyDecisions") })).toBeNull()
    expect(within(dialog).queryByRole("link", { name: fr("bell.openPageDecisions") })).toBeNull()
  })
})
