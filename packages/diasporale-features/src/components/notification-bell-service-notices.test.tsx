/**
 * Cloche DIASPORALE — avis de mise en relation (DG-010, DG-015, DG-016) : phrase neutre du
 * système, lien vers la route qui relit les droits (identifiant seul), repli sur la fiche de
 * la page quand l'application ne fournit pas la route, aucun lien sans cible relue.
 */
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DataSourceProvider } from "../data/context"
import type { DiasporaleDataSource } from "../data/port"
import { SERVICE_NOTIFICATION_KINDS, type NotificationView, type ServiceNoticeView } from "../data/types"
import { getFixedT } from "../i18n"
import { RoutingProvider, type FeatureRoutes } from "../routing"
import { renderWithI18n } from "../test-utils"
import { BELL_SYSTEM_KINDS, NotificationBell } from "./notification-bell"

const fr = getFixedT("fr")
const en = getFixedT("en")
const NOW = Date.UTC(2026, 9, 18, 12)

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

/** Les adresses que la table de l'application fournit : un identifiant seul, les droits relus à l'ouverture. */
const appRoutes = {
  ...featureRoutes,
  serviceRequest: (requestId: string) => `/mes-demandes/${encodeURIComponent(requestId)}`,
  activityRequest: (requestId: string) => `/mon-activite/demandes/${encodeURIComponent(requestId)}`,
  associationMembers: (handle: string) => `/pages/${handle}/adherents`,
  myAssociations: () => "/mes-associations",
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

function notice(kind: NotificationView["kind"], target: ServiceNoticeView | null, id = `avis-${kind}`): NotificationView {
  return { id, kind, actor: null, createdAt: NOW - 60_000, read: false, pendingConnectionId: null, inviteOutcome: null, postId: null, serviceNotice: target }
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

async function openBell(count: number, locale: "fr" | "en" = "fr") {
  const t = locale === "fr" ? fr : en
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

describe("cloche — avis de mise en relation", () => {
  it("chaque genre de la tranche est une phrase entière du système (aucun nom devant)", () => {
    for (const kind of SERVICE_NOTIFICATION_KINDS) expect(BELL_SYSTEM_KINDS).toContain(kind)
  })

  it("le professionnel lit une phrase neutre et ouvre la demande reçue par sa route, identifiant seul", async () => {
    mount([notice("service_request_received", { audience: "provider", requestId: "req-1", pageHandle: "salon-demo" })])
    const dialog = await openBell(1)
    expect(within(dialog).getByText(fr("bell.system.service_request_received"))).toBeInTheDocument()
    const link = within(dialog).getByRole("link", { name: fr("bell.serviceLink.provider") })
    expect(link).toHaveAttribute("href", "/mon-activite/demandes/req-1")
    // Ni besoin, ni montant, ni nom : la ligne ne porte que la phrase du genre (et sa date relative).
    expect(dialog.textContent ?? "").not.toMatch(/€|EUR|@/u)
  })

  it("le demandeur ouvre SA demande ; une réponse à son avis mène aussi à la demande", async () => {
    mount([
      notice("service_proposal_received", { audience: "requester", requestId: "req-2", pageHandle: "salon-demo" }),
      notice("service_review_replied", { audience: "requester", requestId: "req-3", pageHandle: "salon-demo" }),
    ])
    const dialog = await openBell(2)
    const links = within(dialog).getAllByRole("link", { name: fr("bell.serviceLink.requester") })
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/mes-demandes/req-2", "/mes-demandes/req-3"])
    expect(within(dialog).getByText(fr("bell.system.service_review_replied"))).toBeInTheDocument()
  })

  it("un responsable ouvre les adhérents de l'association ; la personne, ses associations", async () => {
    mount([
      notice("association_membership_requested", { audience: "responsible", requestId: null, pageHandle: "collectif-demo" }),
      notice("association_membership_accepted", { audience: "member", requestId: null, pageHandle: "collectif-demo" }),
    ])
    const dialog = await openBell(2)
    expect(within(dialog).getByRole("link", { name: fr("bell.serviceLink.responsible") })).toHaveAttribute("href", "/pages/collectif-demo/adherents")
    expect(within(dialog).getByRole("link", { name: fr("bell.serviceLink.member") })).toHaveAttribute("href", "/mes-associations")
  })

  it("sans la route dans la table de l'application, l'avis retombe sur la fiche de la page", async () => {
    mount([notice("service_request_cancelled", { audience: "provider", requestId: "req-4", pageHandle: "salon-demo" })], featureRoutes)
    const dialog = await openBell(1)
    expect(within(dialog).queryByRole("link", { name: fr("bell.serviceLink.provider") })).toBeNull()
    expect(within(dialog).getByRole("link", { name: fr("bell.serviceLinkPage") })).toHaveAttribute("href", "/pages/salon-demo")
  })

  it("une cible qui ne se lit plus (ou sans page lisible) n'offre aucun lien inventé", async () => {
    mount([
      notice("service_request_expired", null, "avis-sans-cible"),
      notice("association_membership_removed", { audience: "member", requestId: null, pageHandle: null }, "avis-sans-page"),
    ], featureRoutes)
    const dialog = await openBell(2)
    expect(within(dialog).getByText(fr("bell.system.service_request_expired"))).toBeInTheDocument()
    expect(within(dialog).getByText(fr("bell.system.association_membership_removed"))).toBeInTheDocument()
    expect(within(dialog).queryByRole("link", { name: fr("bell.serviceLinkPage") })).toBeNull()
    expect(within(dialog).queryByRole("link", { name: fr("bell.serviceLink.member") })).toBeNull()
  })

  it("en anglais, mêmes phrases et mêmes liens", async () => {
    mount([notice("service_booking_completed", { audience: "requester", requestId: "req-5", pageHandle: "salon-demo" })], appRoutes, "en")
    const dialog = await openBell(1, "en")
    expect(within(dialog).getByText(en("bell.system.service_booking_completed"))).toBeInTheDocument()
    expect(within(dialog).getByRole("link", { name: en("bell.serviceLink.requester") })).toHaveAttribute("href", "/mes-demandes/req-5")
  })
})
