/**
 * Cloche DIASPORALE — NP-04 : les genres communs du moteur que la cloche disait « nouvelle
 * activité » se nomment et mènent à leur objet (page suivie, album, fichier retenu, invitations,
 * statut et badges ; PG-01 : invitation à signer, revendication tranchée). Aucun contenu dans
 * l'avis ; sans route fournie ou sans objet relu, aucun lien inventé. « Voir toutes les
 * notifications » mène à la page quand l'application la sert.
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

/** Les routes que la table de l'application fournit (chacune relit les droits à l'ouverture). */
const appRoutes: FeatureRoutes = {
  ...baseRoutes,
  notifications: () => "/notifications",
  album: (handle, albumId) => `/@${handle}/albums/${albumId}`,
  agenda: () => "/agenda",
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
  return { id: `avis-${overrides.kind}`, actor: null, createdAt: NOW - 60_000, read: false, pendingConnectionId: null, inviteOutcome: null, postId: null, ...overrides }
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

/** Une phrase telle que le DOM la lit : Testing Library ramène les espaces (insécables comprises) à une espace. */
const spoken = (text: string) => text.replace(/\s+/g, " ")

/** La ligne d'un avis, par sa phrase. */
function rowOf(dialog: HTMLElement, text: string | RegExp) {
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

describe("cloche — une page que je suis a publié", () => {
  it("le nom public de la page mène à sa fiche, et la publication s'ouvre", async () => {
    mount([notice({ kind: "page_post", postId: "pub-1", page: { handle: "amicale-lyon", name: "Amicale de Lyon" } })])
    const dialog = await openBell(1)
    expect(within(dialog).getByRole("link", { name: "Amicale de Lyon" })).toHaveAttribute("href", "/pages/amicale-lyon")
    expect(within(dialog).getByText(fr("bell.kind.page_post"))).toBeInTheDocument()
    expect(within(dialog).getByRole("link", { name: fr("bell.openPost") })).toHaveAttribute("href", "/publication/pub-1")
    expect(within(dialog).queryByText(fr("bell.system.other"))).not.toBeInTheDocument()
  })

  it("sans carte de page (page retirée), la phrase du système, et toujours la publication", async () => {
    mount([notice({ kind: "page_post", postId: "pub-1", page: null })])
    const dialog = await openBell(1)
    expect(within(dialog).getByText(fr("bell.system.page_post"))).toBeInTheDocument()
    expect(within(dialog).getByRole("link", { name: fr("bell.openPost") })).toHaveAttribute("href", "/publication/pub-1")
  })
})

describe("cloche — un album publié", () => {
  it("le nom mène au profil, le lien à l'album sur le profil de son auteur", async () => {
    mount([notice({ kind: "album_published", actor: AWA, albumId: "album-7" })])
    const dialog = await openBell(1)
    expect(within(dialog).getByRole("link", { name: AWA.displayName })).toHaveAttribute("href", "/@awa.demo")
    expect(within(dialog).getByText(fr("bell.kind.album_published"))).toBeInTheDocument()
    expect(within(dialog).getByRole("link", { name: fr("bell.openAlbum") })).toHaveAttribute("href", "/@awa.demo/albums/album-7")
  })

  it("sans profil publié ou sans route d'album, aucune adresse inventée", async () => {
    mount([notice({ kind: "album_published", actor: null, albumId: "album-7" })])
    const dialog = await openBell(1)
    expect(within(dialog).getByText(`${fr("bell.someone")} ${fr("bell.kind.album_published")}`)).toBeInTheDocument()
    expect(within(dialog).queryByRole("link", { name: fr("bell.openAlbum") })).not.toBeInTheDocument()
  })
})

describe("cloche — un fichier retenu par l'analyse", () => {
  it("se lit comme tel, sans lien ; libéré depuis, il le dit", async () => {
    mount([
      notice({ id: "retenu", kind: "file_withheld", fileReleased: false }),
      notice({ id: "libere", kind: "file_withheld", fileReleased: true }),
    ])
    const dialog = await openBell(2)
    expect(within(dialog).getByText(spoken(fr("bell.system.file_withheld")))).toBeInTheDocument()
    expect(within(dialog).getByText(fr("bell.fileReleased"))).toBeInTheDocument()
    // Le seul lien de la feuille est « Voir toutes les notifications » : un fichier retenu n'a aucune page.
    expect(within(dialog).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/notifications"])
  })
})

describe("cloche — les invitations", () => {
  it("une invitation à un évènement mène à l'agenda et dit l'issue posée par le serveur", async () => {
    mount([notice({ kind: "event_invite", actor: AWA, inviteOutcome: "maybe" })])
    const dialog = await openBell(1)
    const row = rowOf(dialog, fr("bell.kind.event_invite"))
    expect(within(row).getByRole("link", { name: fr("bell.openAgenda") })).toHaveAttribute("href", "/agenda")
    expect(row).toHaveTextContent(fr("bell.outcome.maybe"))
  })

  it("une invitation à un groupe thématique se nomme, dit son issue, sans adresse que le moteur ne sert pas", async () => {
    mount([notice({ kind: "thematic_group_invite", actor: AWA, inviteOutcome: "accepted" })])
    const dialog = await openBell(1)
    const row = rowOf(dialog, fr("bell.kind.thematic_group_invite"))
    expect(row).toHaveTextContent(fr("bell.outcome.accepted"))
    expect(within(row).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/@awa.demo"])
  })

  it("PG-01 : l'invitation à signer et la revendication tranchée mènent à la page, jamais nommée dans l'avis", async () => {
    mount([
      notice({ id: "invite", kind: "page_signatory_invite", governancePageHandle: "amicale-lyon", inviteOutcome: null }),
      notice({ id: "claim", kind: "page_claim_decided", governancePageHandle: "cercle-paris" }),
      notice({ id: "illisible", kind: "page_claim_decided", governancePageHandle: null, createdAt: NOW - 120_000 }),
    ])
    const dialog = await openBell(3)
    expect(within(dialog).getByText(fr("bell.system.page_signatory_invite"))).toBeInTheDocument()
    expect(within(dialog).getAllByText(fr("bell.system.page_claim_decided"))).toHaveLength(2)
    expect(within(dialog).getAllByRole("link", { name: fr("bell.openPage") }).map((link) => link.getAttribute("href"))).toEqual(["/pages/amicale-lyon", "/pages/cercle-paris"])
  })
})

describe("cloche — statut et badges", () => {
  it("mènent aux réglages, où se lisent les réseaux et les badges", async () => {
    mount([notice({ id: "statut", kind: "membership_changed" }), notice({ id: "badges", kind: "badge_changed" })])
    const dialog = await openBell(2)
    expect(within(dialog).getByText(fr("bell.system.membership_changed"))).toBeInTheDocument()
    expect(within(dialog).getByText(fr("bell.system.badge_changed"))).toBeInTheDocument()
    expect(within(dialog).getAllByRole("link", { name: fr("bell.openSettings") }).map((link) => link.getAttribute("href"))).toEqual(["/parametres", "/parametres"])
  })
})

describe("cloche — « Voir toutes les notifications »", () => {
  it("mène à la page des notifications quand l'application la sert, et referme la feuille", async () => {
    mount([notice({ kind: "membership_changed" })])
    const dialog = await openBell(1)
    const all = within(dialog).getByRole("link", { name: fr("bell.seeAll") })
    expect(all).toHaveAttribute("href", "/notifications")
    await userEvent.setup().click(all)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("sans page servie, la feuille reste seule", async () => {
    mount([notice({ kind: "membership_changed" })], baseRoutes)
    const dialog = await openBell(1)
    expect(within(dialog).queryByRole("link", { name: fr("bell.seeAll") })).not.toBeInTheDocument()
  })

  it("en anglais, les mêmes avis et le même lien", async () => {
    mount([notice({ kind: "page_post", postId: "pub-1", page: { handle: "amicale-lyon", name: "Amicale de Lyon" } }), notice({ kind: "event_invite", actor: AWA })], appRoutes, "en")
    const dialog = await openBell(2, en)
    expect(within(dialog).getByText(en("bell.kind.page_post"))).toBeInTheDocument()
    expect(within(dialog).getByText(en("bell.kind.event_invite"))).toBeInTheDocument()
    expect(within(dialog).getByRole("link", { name: en("bell.seeAll") })).toHaveAttribute("href", "/notifications")
  })
})
