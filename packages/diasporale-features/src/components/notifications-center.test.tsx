/**
 * La page des notifications (NP-04) : tous mes avis, la suite lue au curseur du fournisseur à la
 * demande ; « Non lues » ne garde que les non-lus chargés ; sections « Nouveau » (vingt-quatre
 * heures) et « Plus tôt » ; « Tout marquer comme lu » suit le décompte du serveur ; une page en
 * panne se reprend, un refus d'accès se dit sans « Réessayer » et n'affiche plus rien.
 */
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DataSourceProvider } from "../data/context"
import type { ActionErrorCode } from "../data/errors"
import type { DiasporaleDataSource } from "../data/port"
import { NOTIFICATIONS_PAGE_SIZE, type NotificationsPageQuery, type NotificationsPageRequest, type NotificationView } from "../data/types"
import { getFixedT } from "../i18n"
import { RoutingProvider, type FeatureRoutes } from "../routing"
import { renderWithI18n } from "../test-utils"
import { NotificationsCenter } from "./notifications-center"

const fr = getFixedT("fr")
const en = getFixedT("en")
const NOW = Date.UTC(2026, 10, 10, 9)
const HOUR = 60 * 60 * 1000

const routes: FeatureRoutes = {
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

function Link({ children, ...props }: ComponentProps<"a">) {
  return <a {...props}>{children}</a>
}

/**
 * 45 avis : un par heure, du plus récent ; un sur trois non lu. Les trois premiers (moins de vingt-quatre
 * heures) tombent dans « Nouveau ». Chaque avis désigne une publication : sa ligne a un lien unique.
 */
function notices(count = 45): NotificationView[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `avis-${index + 1}`,
    kind: "post_comment" as const,
    actor: { handle: `membre${index + 1}`, displayName: `Membre ${index + 1}` },
    createdAt: NOW - (index === 0 ? 1 : index < 3 ? index * HOUR : (24 + index) * HOUR),
    read: index % 3 !== 0,
    pendingConnectionId: null,
    inviteOutcome: null,
    postId: `pub-${index + 1}`,
  }))
}

interface Options {
  readonly items?: readonly NotificationView[]
  readonly unread?: number
  /** Le code rendu par une page, selon son curseur (`null` : la première). */
  readonly failAt?: (cursor: string | null) => ActionErrorCode | null
}

/**
 * Un fournisseur à curseur : la position de départ, écrite en chiffres, est le curseur opaque. Comme
 * les vrais fournisseurs (mémorisés), une même page rend le même objet d'un rendu à l'autre.
 */
function source(options: Options = {}) {
  const items = options.items ?? notices()
  const markAll = vi.fn(async () => ({ ok: true as const, value: null }))
  const retry = vi.fn()
  const reads: (string | null)[] = []
  const pages = new Map<string | null, NotificationsPageQuery>()
  const value = {
    kind: "engine",
    useNotificationsPage: ({ cursor = null }: NotificationsPageRequest): NotificationsPageQuery => {
      reads.push(cursor)
      const known = pages.get(cursor)
      if (known) return known
      const error = options.failAt?.(cursor) ?? null
      const start = cursor === null ? 0 : Number(cursor)
      const end = start + NOTIFICATIONS_PAGE_SIZE
      const page: NotificationsPageQuery = error
        ? { data: undefined, isLoading: false, error, retry }
        : { data: { items: items.slice(start, end), continueCursor: String(end), isDone: end >= items.length }, isLoading: false, error: null, retry }
      pages.set(cursor, page)
      return page
    },
    useUnreadCount: () => ({ status: "ready", data: { count: options.unread ?? items.filter((item) => !item.read).length, capped: false } }),
    actions: {
      markNotificationRead: vi.fn(async () => ({ ok: true, value: null })),
      markAllNotificationsRead: markAll,
    },
  } as unknown as DiasporaleDataSource
  return { value, markAll, retry, reads }
}

function mount(data: ReturnType<typeof source>, locale: "fr" | "en" = "fr") {
  return renderWithI18n(
    <DataSourceProvider source={data.value}>
      <RoutingProvider routes={routes} Link={Link}>
        <NotificationsCenter />
      </RoutingProvider>
    </DataSourceProvider>,
    locale,
  )
}

/** Les publications désignées par les lignes affichées, dans l'ordre. */
function shownPosts() {
  return screen.queryAllByRole("link", { name: fr("bell.openPost") }).map((link) => link.getAttribute("href"))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe("page des notifications — la suite au curseur", () => {
  it("avec 45 avis, la page les montre tous, page après page, puis ne propose plus de suite", async () => {
    const data = source()
    mount(data)
    const user = userEvent.setup()
    expect(screen.getByRole("heading", { level: 1, name: fr("notificationsCenter.title") })).toBeInTheDocument()
    expect(shownPosts()).toHaveLength(20)
    await user.click(screen.getByRole("button", { name: fr("notificationsCenter.loadMore") }))
    expect(shownPosts()).toHaveLength(40)
    await user.click(screen.getByRole("button", { name: fr("notificationsCenter.loadMore") }))
    expect(shownPosts()).toEqual(Array.from({ length: 45 }, (_, index) => `/publication/pub-${index + 1}`))
    expect(screen.queryByRole("button", { name: fr("notificationsCenter.loadMore") })).not.toBeInTheDocument()
    // Chaque page a été lue par le curseur que la précédente a rendu.
    expect([...new Set(data.reads)]).toEqual([null, "20", "40"])
  })

  it("sections « Nouveau » (vingt-quatre heures) et « Plus tôt »", () => {
    mount(source())
    const recent = screen.getByRole("region", { name: fr("notificationsCenter.groups.new") })
    const earlier = screen.getByRole("region", { name: fr("notificationsCenter.groups.earlier") })
    expect(within(recent).getAllByRole("listitem")).toHaveLength(3)
    expect(within(earlier).getAllByRole("listitem")).toHaveLength(17)
  })
})

describe("page des notifications — le filtre", () => {
  it("« Non lues » ne garde que les non-lus chargés, et le dit ; « Toutes » les rend", async () => {
    mount(source())
    const user = userEvent.setup()
    const filters = screen.getByRole("group", { name: fr("notificationsCenter.filterLabel") })
    const all = within(filters).getByRole("button", { name: fr("notificationsCenter.filter.all") })
    const unread = within(filters).getByRole("button", { name: fr("notificationsCenter.filter.unread") })
    expect(all).toHaveAttribute("aria-pressed", "true")
    await user.click(unread)
    expect(unread).toHaveAttribute("aria-pressed", "true")
    // Avis 1, 4, 7, … 19 : sept non lus parmi les vingt premiers.
    expect(shownPosts()).toEqual(["/publication/pub-1", "/publication/pub-4", "/publication/pub-7", "/publication/pub-10", "/publication/pub-13", "/publication/pub-16", "/publication/pub-19"])
    expect(screen.getByText(fr("notificationsCenter.filterScope"))).toBeInTheDocument()
    await user.click(all)
    expect(shownPosts()).toHaveLength(20)
  })

  it("aucun non-lu chargé : la page le dit, et la suite reste à portée", async () => {
    mount(source({ items: notices().map((item) => ({ ...item, read: true })), unread: 0 }))
    await userEvent.setup().click(screen.getByRole("button", { name: fr("notificationsCenter.filter.unread") }))
    expect(screen.getByRole("status")).toHaveTextContent(fr("notificationsCenter.emptyUnread"))
    expect(screen.getByRole("button", { name: fr("notificationsCenter.loadMore") })).toBeInTheDocument()
  })
})

describe("page des notifications — tout marquer comme lu", () => {
  it("suit le décompte du serveur : présent avec des non-lus, absent sans", async () => {
    const data = source()
    const view = mount(data)
    await userEvent.setup().click(screen.getByRole("button", { name: fr("bell.markAll") }))
    expect(data.markAll).toHaveBeenCalledTimes(1)
    view.unmount()
    mount(source({ unread: 0 }))
    expect(screen.queryByRole("button", { name: fr("bell.markAll") })).not.toBeInTheDocument()
  })
})

describe("page des notifications — vide, panne, refus", () => {
  it("sans aucun avis : l'état vide de la cloche", () => {
    mount(source({ items: [] }))
    expect(screen.getByText(fr("bell.emptyTitle"))).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: fr("notificationsCenter.loadMore") })).not.toBeInTheDocument()
  })

  it("une page suivante en panne garde les avis lus et se reprend", async () => {
    const data = source({ failAt: (cursor) => (cursor === "20" ? "unknown" : null) })
    mount(data)
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: fr("notificationsCenter.loadMore") }))
    expect(shownPosts()).toHaveLength(20)
    expect(screen.getByRole("alert")).toHaveTextContent(fr("errors.unknown"))
    await user.click(screen.getByRole("button", { name: fr("notificationsCenter.retry") }))
    expect(data.retry).toHaveBeenCalled()
  })

  it("un refus d'accès se dit tel quel, sans « Réessayer », et n'affiche plus aucun avis", () => {
    mount(source({ failAt: () => "not_member" }))
    expect(screen.getByRole("alert")).toHaveTextContent(fr("errors.not_member"))
    expect(screen.queryByRole("button", { name: fr("notificationsCenter.retry") })).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: fr("notificationsCenter.filterLabel") })).not.toBeInTheDocument()
    expect(shownPosts()).toEqual([])
  })
})

describe("page des notifications — en anglais", () => {
  it("titre, filtres, sections et suite", () => {
    mount(source(), "en")
    expect(screen.getByRole("heading", { level: 1, name: en("notificationsCenter.title") })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: en("notificationsCenter.filter.unread") })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: en("notificationsCenter.groups.earlier") })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: en("notificationsCenter.loadMore") })).toBeInTheDocument()
  })
})
