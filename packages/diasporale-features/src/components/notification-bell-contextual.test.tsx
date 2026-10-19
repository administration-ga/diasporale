/**
 * Cloche DIASPORALE — avis d'une conversation de mise en relation (CC-2b du moteur, CC-6) :
 * phrase neutre du système, lien vers le fil relu pour moi ; sans fil lisible ou sans route
 * fournie par l'application, aucun lien inventé.
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
const NOW = Date.UTC(2026, 9, 20, 9)

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

/** La route que la table de l'application fournit : la messagerie relit les droits à l'ouverture. */
const appRoutes: FeatureRoutes = {
  ...featureRoutes,
  contextualConversation: (threadId) => `/messages/mise-en-relation/${threadId}`,
}

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

function notice(kind: "contextual_message" | "contextual_closed", contextualThreadId: string | null): NotificationView {
  return { id: `avis-${kind}`, kind, actor: null, createdAt: NOW - 60_000, read: false, pendingConnectionId: null, inviteOutcome: null, postId: null, contextualThreadId }
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

describe("cloche — avis d'une conversation de mise en relation", () => {
  it("sont des phrases entières du système, sans nom devant", () => {
    for (const kind of ["contextual_message", "contextual_closed"] as const) {
      expect(BELL_SYSTEM_KINDS).toContain(kind)
      expect(BELL_ACTOR_LED_KINDS as readonly string[]).not.toContain(kind)
    }
  })

  it("un message reçu mène au fil ; un fil qui ne se lit plus garde sa phrase, sans lien", async () => {
    mount([notice("contextual_message", "fil-1"), notice("contextual_closed", null)])
    const dialog = await openBell(2)
    expect(within(dialog).getByText(fr("bell.system.contextual_message"))).toBeInTheDocument()
    expect(within(dialog).getByText(fr("bell.system.contextual_closed").replace(/\s+/g, " "))).toBeInTheDocument()
    const links = within(dialog).getAllByRole("link", { name: fr("bell.openConversation") })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute("href", "/messages/mise-en-relation/fil-1")
  })

  it("sans route fournie par l'application, aucun lien inventé", async () => {
    mount([notice("contextual_message", "fil-1")], featureRoutes)
    const dialog = await openBell(1)
    expect(within(dialog).queryByRole("link", { name: fr("bell.openConversation") })).toBeNull()
  })
})
