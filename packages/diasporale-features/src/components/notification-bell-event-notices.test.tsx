/**
 * Cloche DIASPORALE — EV-03 : l'inscrit apprend que l'évènement est annulé ; la personne en
 * attente, qu'elle a obtenu sa place. Phrase neutre du système (ni titre, ni lieu, ni date, ni
 * motif, ni nom), et un lien « Voir l'événement » vers la fiche, relue avec ses droits.
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
/** Le texte tel que Testing Library relit le DOM : espaces normalisées, insécables comprises. */
const plain = (value: string) => value.replace(/\s+/g, " ").trim()

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
const appRoutes: FeatureRoutes = { ...featureRoutes, associationEvent: (handle, eventId) => `/pages/${handle}/evenements/${eventId}` }

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

function notice(kind: "association_event_cancelled" | "association_event_seat_confirmed", associationEvent: NotificationView["associationEvent"] = { eventId: "evenement-1", pageHandle: "collectif-lyon" }): NotificationView {
  return { id: `avis-${kind}`, kind, actor: null, createdAt: NOW - 60_000, read: false, pendingConnectionId: null, inviteOutcome: null, postId: null, associationEvent }
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

describe("cloche — évènement annulé, place obtenue", () => {
  it("nomme chaque avis par sa phrase neutre et mène à la fiche de l'évènement", async () => {
    mount([notice("association_event_cancelled"), notice("association_event_seat_confirmed")])
    const dialog = await openBell(2)
    expect(within(dialog).getByText(fr("bell.system.association_event_cancelled"))).toBeInTheDocument()
    expect(within(dialog).getByText(plain(fr("bell.system.association_event_seat_confirmed")))).toBeInTheDocument()
    // Jamais la phrase de repli d'un genre inconnu.
    expect(within(dialog).queryByText(fr("bell.system.other"))).not.toBeInTheDocument()
    const links = within(dialog).getAllByRole("link", { name: fr("bell.openAssociationEvent") })
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/pages/collectif-lyon/evenements/evenement-1", "/pages/collectif-lyon/evenements/evenement-1"])
  })

  it("en anglais, les mêmes avis", async () => {
    mount([notice("association_event_seat_confirmed")], appRoutes, "en")
    const dialog = await openBell(1, en)
    expect(within(dialog).getByText(en("bell.system.association_event_seat_confirmed"))).toBeInTheDocument()
    expect(within(dialog).getByRole("link", { name: en("bell.openAssociationEvent") })).toHaveAttribute("href", "/pages/collectif-lyon/evenements/evenement-1")
  })

  it("sans route de fiche, la page ; sans évènement relu, aucun lien inventé", async () => {
    mount([notice("association_event_cancelled"), notice("association_event_seat_confirmed", null)], featureRoutes)
    const dialog = await openBell(2)
    expect(within(dialog).getByText(plain(fr("bell.system.association_event_seat_confirmed")))).toBeInTheDocument()
    expect(within(dialog).getAllByRole("link", { name: fr("bell.openAssociationEvent") }).map((link) => link.getAttribute("href"))).toEqual(["/pages/collectif-lyon"])
  })
})
