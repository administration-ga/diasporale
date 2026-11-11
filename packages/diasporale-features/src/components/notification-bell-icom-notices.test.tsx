/**
 * Cloche DIASPORALE — IM-04 : les avis d'iCom se nomment et mènent à leur objet. Un message ou une
 * invitation de groupe ouvre la conversation de groupe (l'invitation s'y accepte) ; un appel manqué
 * et un message vocal mènent au journal d'appels. Aucun avis ne propose d'appel (IM-01) ; aucun ne
 * montre de contenu ; plus aucun ne se lit « Nouvelle activité dans DIASPORALE ».
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

const baseRoutes: FeatureRoutes = {
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

/** Les routes d'iCom que la table de l'application fournit : aucune n'est une route d'appel. */
const appRoutes: FeatureRoutes = {
  ...baseRoutes,
  groupConversation: (threadId) => `/messages/groupe/${threadId}`,
  callJournal: () => "/messages?brique=iappel",
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

const AWA = { handle: "awa.demo", displayName: "Awa OGOUÉ" }

function notice(overrides: Partial<NotificationView> & Pick<NotificationView, "kind">): NotificationView {
  return { id: `avis-${overrides.kind}`, actor: AWA, createdAt: NOW - 60_000, read: false, pendingConnectionId: null, inviteOutcome: null, postId: null, ...overrides }
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

function rowOf(dialog: HTMLElement, text: string) {
  return within(dialog).getByText(text).closest("li") as HTMLElement
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

describe("cloche — les avis d'iCom (IM-04)", () => {
  it("un message de groupe : l'auteur, puis la conversation de groupe", async () => {
    mount([notice({ kind: "group_message", groupThreadId: "fil-7" })])
    const dialog = await openBell(1)
    const row = rowOf(dialog, fr("bell.kind.group_message"))
    expect(within(row).getByRole("link", { name: AWA.displayName })).toHaveAttribute("href", "/@awa.demo")
    expect(within(row).getByRole("link", { name: fr("bell.openGroup") })).toHaveAttribute("href", "/messages/groupe/fil-7")
  })

  it("une invitation de groupe : la conversation où elle s'accepte, et son issue une fois tranchée", async () => {
    mount([notice({ id: "attente", kind: "group_added", groupThreadId: "fil-8" }), notice({ id: "tranchee", kind: "group_added", groupThreadId: "fil-9", inviteOutcome: "accepted", read: true })])
    const dialog = await openBell(1)
    const links = within(dialog).getAllByRole("link", { name: fr("bell.openGroupInvite") })
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/messages/groupe/fil-8", "/messages/groupe/fil-9"])
    expect(links[1]!.closest("li")).toHaveTextContent(fr("bell.outcome.accepted"))
  })

  it("un appel manqué et un message vocal mènent au journal d'appels, sans aucun bouton d'appel (IM-01)", async () => {
    mount([notice({ id: "manque", kind: "call_missed" }), notice({ id: "vocal", kind: "voicemail_left" })])
    const dialog = await openBell(2)
    for (const text of [fr("bell.kind.call_missed"), fr("bell.kind.voicemail_left")]) {
      const row = rowOf(dialog, text)
      expect(within(row).getByRole("link", { name: fr("bell.openCallJournal") })).toHaveAttribute("href", "/messages?brique=iappel")
      // Le seul geste de la ligne : la marquer comme lue.
      expect(within(row).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([fr("bell.markRead")])
    }
  })

  it("plus aucun avis d'iCom ne se lit « Nouvelle activité » ; sans profil publié, un membre sans nom", async () => {
    mount([
      notice({ id: "a", kind: "group_message", groupThreadId: "fil-1" }),
      notice({ id: "b", kind: "group_added", groupThreadId: "fil-2" }),
      notice({ id: "c", kind: "call_missed", actor: null }),
      notice({ id: "d", kind: "voicemail_left" }),
    ])
    const dialog = await openBell(4)
    expect(within(dialog).queryByText(fr("bell.system.other"))).not.toBeInTheDocument()
    expect(within(dialog).getByText(`${fr("bell.someone")} ${fr("bell.kind.call_missed")}`)).toBeInTheDocument()
  })

  it("sans route fournie ni fil relu, la phrase reste et aucun lien n'est inventé", async () => {
    mount([notice({ id: "sans-fil", kind: "group_message", groupThreadId: null }), notice({ id: "sans-route", kind: "call_missed" })], baseRoutes)
    const dialog = await openBell(2)
    expect(within(dialog).getByText(fr("bell.kind.group_message"))).toBeInTheDocument()
    expect(within(dialog).queryByRole("link", { name: fr("bell.openGroup") })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole("link", { name: fr("bell.openCallJournal") })).not.toBeInTheDocument()
  })

  it("en anglais, les mêmes avis", async () => {
    mount([notice({ kind: "voicemail_left" }), notice({ kind: "group_added", groupThreadId: "fil-3" })], appRoutes, "en")
    const dialog = await openBell(2, en)
    expect(within(dialog).getByText(en("bell.kind.voicemail_left"))).toBeInTheDocument()
    expect(within(dialog).getByRole("link", { name: en("bell.openCallJournal") })).toHaveAttribute("href", "/messages?brique=iappel")
    expect(within(dialog).getByRole("link", { name: en("bell.openGroupInvite") })).toHaveAttribute("href", "/messages/groupe/fil-3")
  })
})
