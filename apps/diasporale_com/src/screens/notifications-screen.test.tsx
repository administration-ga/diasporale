// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import { RoutingProvider, type FeatureRoutes, type LinkComponent } from "@diasporale/features"
import { DataSourceProvider, NOTIFICATIONS_PAGE_SIZE, type DiasporaleDataSource, type MembershipView, type NotificationsPageQuery, type NotificationView } from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { routes } from "@/lib/routes"

import { NotificationsScreen } from "./notifications-screen"

/** `/notifications` (NP-04) : la garde de membre, la coque, puis la page des notifications sur la source. */
const mocks = vi.hoisted(() => ({ gate: vi.fn(), membership: null as MembershipView | null }))

vi.mock("@/components/gate", () => ({
  Gate: (props: { require: string; children: (session: { membership: MembershipView | null }) => ReactNode }) => {
    mocks.gate(props.require)
    return <>{props.children({ membership: mocks.membership })}</>
  },
}))
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <div data-testid="coque">{children}</div> }))

const fr = getFixedT("fr")
const MEMBER: MembershipView = {
  personId: "person-me", handle: "recette", displayName: "Recette", status: "declaree", badges: ["community"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: null, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: true, rateTier: "reinforced", directoryVisibility: "hidden",
}

const featureRoutes: FeatureRoutes = {
  profile: routes.profile, post: routes.post, page: routes.page, hub: routes.hub,
  feed: (tag, context) => routes.feed(context?.scope, tag, context?.country),
  sponsor: routes.sponsor, settings: routes.settings, attestation: routes.attestation, enter: routes.enter,
}
const Link: LinkComponent = ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>

const ITEM: NotificationView = {
  id: "avis-1", kind: "post_comment", actor: { handle: "awa.demo", displayName: "Awa OGOUÉ" }, createdAt: Date.now() - 60_000,
  read: false, pendingConnectionId: null, inviteOutcome: null, postId: "pub-1",
}
const PAGE: NotificationsPageQuery = { data: { items: [ITEM], continueCursor: String(NOTIFICATIONS_PAGE_SIZE), isDone: true }, isLoading: false, error: null, retry: () => undefined }

function mount() {
  const source = {
    kind: "engine",
    useNotificationsPage: () => PAGE,
    useUnreadCount: () => ({ status: "ready", data: { count: 1, capped: false } }),
    actions: { markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() },
  } as unknown as DiasporaleDataSource
  return render(
    <I18nProvider locale="fr">
      <DataSourceProvider source={source}>
        <RoutingProvider routes={featureRoutes} Link={Link}>
          <NotificationsScreen />
        </RoutingProvider>
      </DataSourceProvider>
    </I18nProvider>,
  )
}

describe("écran /notifications", () => {
  it("réservé aux membres, dans la coque : la page des notifications et ses avis", () => {
    mocks.membership = MEMBER
    mount()
    expect(mocks.gate).toHaveBeenCalledWith("member")
    expect(screen.getByTestId("coque")).toContainElement(screen.getByRole("heading", { level: 1, name: fr("notificationsCenter.title") }))
    expect(screen.getByRole("link", { name: fr("bell.openPost") })).toHaveAttribute("href", routes.post("pub-1"))
  })

  it("sans adhésion, rien n'est monté (la garde redirige)", () => {
    mocks.membership = null
    mount()
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
  })
})
