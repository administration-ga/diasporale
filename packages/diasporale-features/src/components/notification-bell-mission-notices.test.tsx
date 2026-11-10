/**
 * Cloche DIASPORALE — ET-01 : le bénévole inscrit apprend qu'une mission est annulée ou que son
 * horaire a changé. Phrase neutre du système (ni titre, ni motif, ni horaire, ni nom), et un lien
 * « Voir la mission » vers la fiche, relue avec ses droits ; sans route fournie, aucun lien inventé.
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
import { NotificationBell } from "./notification-bell"

const fr = getFixedT("fr")
const en = getFixedT("en")
const NOW = Date.UTC(2026, 10, 10, 9)

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

/** La route de la fiche, que la table de l'application fournit : elle relit les droits à l'ouverture. */
const appRoutes: FeatureRoutes = { ...featureRoutes, mutualAidItem: (id) => `/entraide/${id}` }

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

function notice(kind: "aid_mission_cancelled" | "aid_mission_rescheduled", communityNotice: NotificationView["communityNotice"] = { audience: "volunteer", opens: "aidMission", objectId: "mission-1", pageHandle: "collectif-lyon" }): NotificationView {
  return { id: `avis-${kind}`, kind, actor: null, createdAt: NOW - 60_000, read: false, pendingConnectionId: null, inviteOutcome: null, postId: null, communityNotice }
}

function mount(items: readonly NotificationView[], routes: FeatureRoutes = appRoutes, locale: "fr" | "en" = "fr") {
  return renderWithI18n(
    <DataSourceProvider source={source(items)}>
      <RoutingProvider routes={routes} Link={Link}>
        <NotificationBell />
      </RoutingProvider>
    </DataSourceProvider>,
    locale,
  )
}

async function openBell(count: number, t = fr) {
  await userEvent.setup().click(screen.getByRole("button", { name: t("bell.openUnread", { count }) }))
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

describe("cloche — mission annulée ou déplacée, au bénévole inscrit", () => {
  it("nomme chaque avis par sa phrase neutre et mène à la fiche de la mission", async () => {
    mount([notice("aid_mission_cancelled"), notice("aid_mission_rescheduled")])
    const dialog = await openBell(2)
    expect(within(dialog).getByText(fr("bell.system.aid_mission_cancelled"))).toBeInTheDocument()
    expect(within(dialog).getByText(fr("bell.system.aid_mission_rescheduled"))).toBeInTheDocument()
    // Jamais la phrase de repli d'un genre inconnu.
    expect(within(dialog).queryByText(fr("bell.system.other"))).not.toBeInTheDocument()
    const links = within(dialog).getAllByRole("link", { name: fr("bell.communityLink.aidMission") })
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/entraide/mission-1", "/entraide/mission-1"])
  })

  it("en anglais, les mêmes avis", async () => {
    mount([notice("aid_mission_cancelled")], appRoutes, "en")
    const dialog = await openBell(1, en)
    expect(within(dialog).getByText(en("bell.system.aid_mission_cancelled"))).toBeInTheDocument()
    expect(within(dialog).getByRole("link", { name: en("bell.communityLink.aidMission") })).toHaveAttribute("href", "/entraide/mission-1")
  })

  it("sans objet relu ni route fournie, la phrase reste et aucun lien n'est inventé", async () => {
    mount([notice("aid_mission_cancelled", null), notice("aid_mission_rescheduled")], featureRoutes)
    const dialog = await openBell(2)
    expect(within(dialog).getByText(fr("bell.system.aid_mission_cancelled"))).toBeInTheDocument()
    expect(within(dialog).queryByRole("link", { name: fr("bell.communityLink.aidMission") })).not.toBeInTheDocument()
  })
})
