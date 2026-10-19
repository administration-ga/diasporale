/**
 * Cloche DIASPORALE — candidature reçue par une équipe (DG-025) : le lien mène au recrutement
 * de LA page concernée quand elle se lit, sinon à Mon activité ; la personne qui candidate
 * retrouve ses candidatures.
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

/** Les routes que la table de l'application fournit : chacune relit les droits à l'ouverture. */
const appRoutes: FeatureRoutes = {
  ...featureRoutes,
  jobsActivity: () => "/mon-activite?onglet=emplois",
  pageJobs: (handle) => `/pages/${handle}/gerer?onglet=emplois`,
  myApplications: () => "/mes-candidatures",
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

function notice(kind: "job_application_received" | "job_application_shortlisted", audience: "team" | "candidate", pageHandle: string | null): NotificationView {
  return {
    id: `avis-${kind}-${pageHandle ?? "sans-page"}`, kind, actor: null, createdAt: NOW - 60_000, read: false, pendingConnectionId: null, inviteOutcome: null, postId: null,
    communityNotice: { audience, opens: "jobApplication", objectId: "candidature-1", pageHandle },
  }
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

describe("cloche — candidature reçue par une équipe", () => {
  it("mène au recrutement de LA page quand elle se lit, sinon à Mon activité", async () => {
    mount([notice("job_application_received", "team", "traiteur-paris"), notice("job_application_received", "team", null)])
    const dialog = await openBell(2)
    const links = within(dialog).getAllByRole("link", { name: fr("bell.communityLink.jobApplicationTeam") })
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/pages/traiteur-paris/gerer?onglet=emplois", "/mon-activite?onglet=emplois"])
  })

  it("la personne qui candidate retrouve ses candidatures", async () => {
    mount([notice("job_application_shortlisted", "candidate", "traiteur-paris")])
    const dialog = await openBell(1)
    expect(within(dialog).getByRole("link", { name: fr("bell.communityLink.jobApplicationCandidate") })).toHaveAttribute("href", "/mes-candidatures")
  })
})
